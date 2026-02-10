"""
Root Agent - Event routing and orchestration.

Routes incoming Slack events to the appropriate sub-agents based on
event type and content.
"""

import re
import time
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Any

from services.firestore_service import FirestoreService
from services.slack_service import SlackService

from .base_agent import BaseAgent
from .intake_agent import IntakeAgent
from .context_agent import ContextAgent, SaveAgent
from .alert_agent import AlertAgent
from .summary_agent import SummaryAgent


# LRU-based dedup cache for processed message timestamps
_processed_messages: OrderedDict[str, None] = OrderedDict()
_MAX_PROCESSED = 5000

# Channel-to-patient mapping cache (TTL 300s)
_channel_patient_cache: dict[str, tuple[dict[str, Any] | None, float]] = {}
_CHANNEL_CACHE_TTL = 300

# User name cache (persists for process lifetime, cleared on redeploy)
_user_name_cache: dict[str, str] = {}


class RootAgent:
    """
    Root Agent for orchestrating sub-agents.

    Routes Slack events to the appropriate agent based on:
    - Event type (message, app_mention)
    - Message content (keywords, commands)
    - Thread context (anchor message replies)
    """

    def __init__(self):
        self.intake_agent: IntakeAgent | None = None
        self.context_agent: ContextAgent | None = None
        self.save_agent: SaveAgent | None = None
        self.alert_agent: AlertAgent | None = None
        self.summary_agent: SummaryAgent | None = None

    async def _init_agents(self, org_id: str | None) -> None:
        """Initialize sub-agents with org-specific custom prompts."""
        custom: dict = {}
        if org_id:
            custom = await BaseAgent.get_agent_prompts(org_id)
        shared = custom.get("shared_prompt")
        agent_prompts = custom.get("agent_prompts", {})

        self.intake_agent = IntakeAgent(
            system_prompt=agent_prompts.get("intake"), shared_prompt=shared
        )
        self.context_agent = ContextAgent(
            system_prompt=agent_prompts.get("context"), shared_prompt=shared
        )
        self.save_agent = SaveAgent()
        self.alert_agent = AlertAgent(
            system_prompt=agent_prompts.get("alert"), shared_prompt=shared
        )
        self.summary_agent = SummaryAgent(
            system_prompt=agent_prompts.get("summary"), shared_prompt=shared
        )

    async def route_event(
        self, event: dict[str, Any], org_id: str | None = None
    ) -> dict[str, Any]:
        """
        Route a Slack event to the appropriate agent.

        Args:
            event: Slack event data
            org_id: Organization ID (from signature verification)

        Returns:
            dict with processing results
        """
        event_type = event.get("type")
        channel = event.get("channel")
        text = event.get("text", "")
        thread_ts = event.get("thread_ts")
        user = event.get("user")
        ts = event.get("ts")

        # Resolve patient from channel
        patient = await self._resolve_patient_from_channel(channel)
        if not patient:
            return {
                "success": False,
                "error": "このチャンネルに紐づく患者が見つかりません",
                "response": None,
            }

        patient_id = patient.get("id")
        anchor_ts = patient.get("anchor_message_ts")

        # Resolve org_id: prefer argument, fallback to patient's org_id
        if not org_id:
            org_id = patient.get("org_id")

        # Store org_id for RAG lookups
        self._current_org_id = org_id

        # Initialize sub-agents with org-specific prompts
        await self._init_agents(org_id)

        # Get Slack bot token for this org
        self._slack_token = await SlackService.get_bot_token(org_id) if org_id else None
        if not self._slack_token:
            return {
                "success": False,
                "error": f"Slack Bot Tokenが取得できません (org_id={org_id})",
                "response": None,
            }

        # Route based on event type
        if event_type == "message":
            # Check if this is a reply to the anchor message
            if thread_ts and thread_ts == anchor_ts:
                return await self._handle_report(
                    patient_id=patient_id,
                    text=text,
                    user=user,
                    message_ts=ts,
                    channel=channel,
                    thread_ts=thread_ts,
                )
            # Regular message - ignore (don't save casual chat)
            return {
                "success": True,
                "action": "ignored",
                "reason": "casual_chat",
                "response": None,
            }

        elif event_type == "app_mention":
            # Deduplicate app_mention events too
            if ts and self._is_already_processed(channel, ts):
                return {
                    "success": True,
                    "action": "skipped",
                    "reason": "already_processed",
                    "response": None,
                }
            if ts:
                self._mark_as_processed(channel, ts)

            return await self._handle_mention(
                patient_id=patient_id,
                text=text,
                user=user,
                channel=channel,
                thread_ts=thread_ts,
            )

        return {
            "success": False,
            "error": f"Unknown event type: {event_type}",
            "response": None,
        }

    async def _resolve_patient_from_channel(
        self, channel_id: str
    ) -> dict[str, Any] | None:
        """
        Resolve patient from Slack channel ID (cached with 300s TTL).
        """
        if not channel_id:
            return None

        # Check cache
        if channel_id in _channel_patient_cache:
            data, ts = _channel_patient_cache[channel_id]
            if time.monotonic() - ts < _CHANNEL_CACHE_TTL:
                return data

        # Query Firestore
        db = FirestoreService.get_client()
        query = db.collection("patients").where(
            "slack_channel_id", "==", channel_id
        ).limit(1)

        docs = list(query.stream())
        if docs:
            doc = docs[0]
            data = doc.to_dict()
            data["id"] = doc.id
            _channel_patient_cache[channel_id] = (data, time.monotonic())
            return data

        _channel_patient_cache[channel_id] = (None, time.monotonic())
        return None

    def _claim_message(self, channel: str, message_ts: str) -> bool:
        """
        Attempt to claim a message for processing using Slack reaction.
        Returns True if claimed (first processor), False if already claimed.
        Uses reactions.add as a distributed lock across Cloud Run instances.
        """
        try:
            client = SlackService.get_client(self._slack_token)
            client.reactions_add(channel=channel, name="eyes", timestamp=message_ts)
            return True  # 👀 added — we are the first processor
        except Exception as e:
            if "already_reacted" in str(e):
                return False  # Another instance already processing
            # Other errors (network etc.) — fall through to in-memory dedup
            print(f"Reaction claim failed: {e}")
            return True  # Err on side of processing (in-memory dedup catches actual dupes)

    def _is_already_processed(self, channel: str, message_ts: str) -> bool:
        """Check if a message was already processed using in-memory set."""
        key = f"{channel}:{message_ts}"
        return key in _processed_messages

    def _mark_as_processed(self, channel: str, message_ts: str) -> None:
        """Mark message as processed in LRU cache."""
        key = f"{channel}:{message_ts}"
        _processed_messages[key] = None
        # Evict oldest entries to prevent unbounded growth
        while len(_processed_messages) > _MAX_PROCESSED:
            _processed_messages.popitem(last=False)

    async def _handle_report(
        self,
        patient_id: str,
        text: str,
        user: str,
        message_ts: str,
        channel: str,
        thread_ts: str,
    ) -> dict[str, Any]:
        """
        Handle a report (thread reply to anchor message).

        Routes to Intake Agent for BPS structuring.
        Dedup: in-memory Set (fast) → Slack reaction 👀 (distributed lock).
        """
        # Check if already processed (duplicate event from Slack retry)
        if self._is_already_processed(channel, message_ts):
            return {
                "success": True,
                "action": "skipped",
                "reason": "already_processed",
                "response": None,
            }

        # Mark as processing immediately to prevent race conditions
        self._mark_as_processed(channel, message_ts)

        # Distributed dedup: claim via Slack reaction (works across instances)
        if not self._claim_message(channel, message_ts):
            return {
                "success": True,
                "action": "skipped",
                "reason": "already_claimed",
                "response": None,
            }

        # Get user info for reporter name
        reporter_name = await self._get_user_name(user)
        reporter_role = self._infer_role_from_text(text)

        # Search RAG knowledge base
        knowledge_chunks = await self._search_knowledge(text, "intake")

        # Process with Intake Agent
        result = await self.intake_agent.process(
            patient_id=patient_id,
            raw_text=text,
            reporter_name=reporter_name,
            reporter_role=reporter_role,
            slack_message_ts=message_ts,
            slack_user_id=user,
            knowledge_chunks=knowledge_chunks,
        )

        if result.get("success"):
            # Post confirmation in thread
            client = SlackService.get_client(self._slack_token)
            client.chat_postMessage(
                channel=channel,
                thread_ts=thread_ts,
                text=result.get("confirmation_message", "✅ 保存しました"),
            )

            # Real-time alert detection
            detected_alerts = []
            try:
                alert_knowledge = await self._search_knowledge(
                    "患者状態変化 アラート検知", "alert"
                )
                new_report_data = {
                    "timestamp": datetime.now(timezone.utc),
                    "reporter_name": reporter_name,
                    "reporter_role": reporter_role,
                    "bps_classification": result.get("bps_data", {}),
                }
                alert_result = await self.alert_agent.process(
                    patient_id,
                    new_report=new_report_data,
                    knowledge_chunks=alert_knowledge,
                )
                detected_alerts = alert_result.get("alerts", [])
                if detected_alerts:
                    for alert in detected_alerts:
                        alert_msg = self.alert_agent.format_alert_message(alert)
                        client.chat_postMessage(
                            channel=channel,
                            thread_ts=thread_ts,
                            text=alert_msg,
                        )
            except Exception as e:
                print(f"[WARN] Real-time alert detection failed for patient={patient_id}: {e}")

        return {
            "success": result.get("success"),
            "action": "intake",
            "report_id": result.get("report_id"),
            "alerts": detected_alerts if result.get("success") else [],
            "response": result.get("confirmation_message"),
        }

    async def _handle_mention(
        self,
        patient_id: str,
        text: str,
        user: str,
        channel: str,
        thread_ts: str | None,
    ) -> dict[str, Any]:
        """
        Handle an @bot mention.
        
        Routes to appropriate agent based on keywords.
        """
        # Remove the bot mention from text
        clean_text = re.sub(r"<@[A-Z0-9]+>", "", text).strip()

        # Check for summary keywords
        if re.search(r"(サマリー|経過|引き継ぎ|まとめ)", clean_text):
            return await self._handle_summary(patient_id, channel, thread_ts)

        # Check for save command
        if re.search(r"(保存|記録)", clean_text):
            return await self._handle_save(patient_id, channel, thread_ts)

        # Default to context query (question answering)
        return await self._handle_question(
            patient_id, clean_text, channel, thread_ts
        )

    async def _handle_summary(
        self,
        patient_id: str,
        channel: str,
        thread_ts: str | None,
    ) -> dict[str, Any]:
        """Handle summary request."""
        knowledge_chunks = await self._search_knowledge("BPS経過サマリー 患者状態", "summary")
        result = await self.summary_agent.process(
            patient_id=patient_id,
            knowledge_chunks=knowledge_chunks,
        )

        if result.get("success"):
            SlackService.get_client(self._slack_token).chat_postMessage(
                channel=channel,
                thread_ts=thread_ts,
                text=result.get("summary", "サマリーを生成できませんでした"),
            )

        return {
            "success": result.get("success"),
            "action": "summary",
            "response": result.get("summary"),
        }

    async def _handle_save(
        self,
        patient_id: str,
        channel: str,
        thread_ts: str | None,
    ) -> dict[str, Any]:
        """Handle save command."""
        result = await self.save_agent.process(
            patient_id=patient_id,
            channel_id=channel,
            thread_ts=thread_ts,
        )

        SlackService.get_client(self._slack_token).chat_postMessage(
            channel=channel,
            thread_ts=thread_ts,
            text=result.get("message", ""),
        )

        return {
            "success": True,
            "action": "save_instruction",
            "response": result.get("message"),
        }

    async def _handle_question(
        self,
        patient_id: str,
        question: str,
        channel: str,
        thread_ts: str | None,
    ) -> dict[str, Any]:
        """Handle question/query."""
        knowledge_chunks = await self._search_knowledge(question, "context")
        result = await self.context_agent.process(
            patient_id=patient_id,
            question=question,
            knowledge_chunks=knowledge_chunks,
        )

        if result.get("success"):
            SlackService.get_client(self._slack_token).chat_postMessage(
                channel=channel,
                thread_ts=thread_ts,
                text=result.get("response", "回答を生成できませんでした"),
            )

        return {
            "success": result.get("success"),
            "action": "context_query",
            "response": result.get("response"),
        }

    async def _get_user_name(self, user_id: str) -> str:
        """Get user display name from Slack user ID with caching and retry."""
        if not user_id:
            return "不明"

        # Check cache first
        if user_id in _user_name_cache:
            return _user_name_cache[user_id]

        for attempt in range(2):  # 1 retry
            try:
                client = SlackService.get_client(self._slack_token)
                response = client.users_info(user=user_id)
                if response.get("ok"):
                    user_info = response.get("user", {})
                    profile = user_info.get("profile", {})
                    name = (
                        profile.get("display_name_normalized")
                        or profile.get("display_name")
                        or profile.get("real_name_normalized")
                        or profile.get("real_name")
                        or user_info.get("real_name")
                        or user_info.get("name")
                    )
                    if name:
                        _user_name_cache[user_id] = name
                        return name
                    print(f"[WARN] No name fields for user_id={user_id}")
                else:
                    error = response.get("error", "unknown")
                    print(f"[ERROR] users.info ok=false: error={error}, user_id={user_id}")
            except Exception as e:
                print(f"[ERROR] users.info attempt {attempt+1} failed for {user_id}: {type(e).__name__}: {e}")
                if attempt == 0:
                    import asyncio
                    await asyncio.sleep(0.5)
                    continue

        return "不明"

    async def _search_knowledge(self, query: str, agent_id: str) -> list[dict[str, Any]]:
        """Search RAG knowledge base for relevant chunks."""
        try:
            from services.rag_service import RAGService

            org_id = getattr(self, "_current_org_id", None)
            if not org_id:
                return []

            api_key = await BaseAgent.get_gemini_api_key(org_id)
            if not api_key:
                return []

            categories = await FirestoreService.get_agent_bindings(org_id, agent_id)
            return await RAGService.search(
                query=query,
                org_id=org_id,
                categories=categories,
                api_key=api_key,
                limit=5,
            )
        except Exception as e:
            print(f"[WARN] Knowledge search failed: {e}")
            return []

    def _infer_role_from_text(self, text: str) -> str:
        """Infer reporter role from text content."""
        text_lower = text.lower()

        # Check for role indicators
        if any(kw in text_lower for kw in ["看護", "ns", "訪看"]):
            return "nurse"
        if any(kw in text_lower for kw in ["薬剤", "ph", "調剤"]):
            return "pharmacist"
        if any(kw in text_lower for kw in ["pt", "理学", "リハ"]):
            return "pt"
        if any(kw in text_lower for kw in ["ot", "作業"]):
            return "ot"
        if any(kw in text_lower for kw in ["st", "言語"]):
            return "st"
        if any(kw in text_lower for kw in ["sw", "ソーシャル", "相談"]):
            return "sw"
        if any(kw in text_lower for kw in ["ケアマネ", "cm", "介護支援"]):
            return "cm"
        if any(kw in text_lower for kw in ["ヘルパー", "介護"]):
            return "helper"
        if any(kw in text_lower for kw in ["医師", "dr", "先生"]):
            return "doctor"
        if any(kw in text_lower for kw in ["家族", "妻", "夫", "娘", "息子"]):
            return "family"

        return "unknown"

    async def run_morning_scan(
        self, org_id: str, lookback_days: int = 7
    ) -> dict[str, Any]:
        """
        Run the morning scan for all patients.

        Called by Cloud Scheduler via /cron/morning-scan endpoint,
        or manually via POST /api/alerts/scan.

        Args:
            org_id: Organization ID
            lookback_days: How many days back to check for reports (default 7)
        """
        # Store org_id for RAG lookups
        self._current_org_id = org_id

        # Initialize sub-agents with org-specific prompts
        await self._init_agents(org_id)

        # Search RAG knowledge base for alert context
        knowledge_chunks = await self._search_knowledge("患者状態変化 アラート検知", "alert")

        # Run alert agent scan
        scan_results = await self.alert_agent.scan_all_patients(
            org_id, knowledge_chunks=knowledge_chunks, lookback_days=lookback_days
        )

        # Format morning report
        report = self.alert_agent.format_morning_report(scan_results)

        # Post to #oncall-night channel (if configured)
        # This would be retrieved from organization settings
        # For now, just return the report
        return {
            "success": True,
            "report": report,
            "scan_results": scan_results,
        }

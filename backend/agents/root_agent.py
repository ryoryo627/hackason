"""
Root Agent - Event routing and orchestration.

Routes incoming Slack events to the appropriate sub-agents based on
event type and content.
"""

import re
from typing import Any

from services.firestore_service import FirestoreService
from services.slack_service import SlackService

from .intake_agent import IntakeAgent
from .context_agent import ContextAgent, SaveAgent
from .alert_agent import AlertAgent
from .summary_agent import SummaryAgent


class RootAgent:
    """
    Root Agent for orchestrating sub-agents.
    
    Routes Slack events to the appropriate agent based on:
    - Event type (message, app_mention)
    - Message content (keywords, commands)
    - Thread context (anchor message replies)
    """

    def __init__(self):
        self.intake_agent = IntakeAgent()
        self.context_agent = ContextAgent()
        self.save_agent = SaveAgent()
        self.alert_agent = AlertAgent()
        self.summary_agent = SummaryAgent()

    async def route_event(self, event: dict[str, Any]) -> dict[str, Any]:
        """
        Route a Slack event to the appropriate agent.

        Args:
            event: Slack event data

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
        Resolve patient from Slack channel ID.
        
        Searches Firestore for a patient with matching slack_channel_id.
        """
        if not channel_id:
            return None

        # Get the patient by channel ID
        # This requires a query on slack_channel_id field
        db = FirestoreService.get_client()
        query = db.collection("patients").where(
            "slack_channel_id", "==", channel_id
        ).limit(1)

        docs = list(query.stream())
        if docs:
            doc = docs[0]
            data = doc.to_dict()
            data["id"] = doc.id
            return data

        return None

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
        """
        # Get user info for reporter name
        reporter_name = await self._get_user_name(user)
        reporter_role = self._infer_role_from_text(text)

        # Process with Intake Agent
        result = await self.intake_agent.process(
            patient_id=patient_id,
            raw_text=text,
            reporter_name=reporter_name,
            reporter_role=reporter_role,
            slack_message_ts=message_ts,
        )

        if result.get("success"):
            # Post confirmation in thread
            await SlackService.get_client().chat_postMessage(
                channel=channel,
                thread_ts=thread_ts,
                text=result.get("confirmation_message", "✅ 保存しました"),
            )

            # Run immediate alert detection
            alert_result = await self.alert_agent.process(
                patient_id=patient_id,
                new_report=result.get("bps_data"),
            )

            # Post alerts if any
            for alert in alert_result.get("alerts", []):
                alert_message = self.alert_agent.format_alert_message(alert)
                await SlackService.get_client().chat_postMessage(
                    channel=channel,
                    text=alert_message,
                )

        return {
            "success": result.get("success"),
            "action": "intake",
            "report_id": result.get("report_id"),
            "alerts": result.get("alerts", []),
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
        result = await self.summary_agent.process(patient_id=patient_id)

        if result.get("success"):
            await SlackService.get_client().chat_postMessage(
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

        await SlackService.get_client().chat_postMessage(
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
        result = await self.context_agent.process(
            patient_id=patient_id,
            question=question,
        )

        if result.get("success"):
            await SlackService.get_client().chat_postMessage(
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
        """Get user name from Slack user ID."""
        try:
            response = await SlackService.get_client().users_info(user=user_id)
            if response.get("ok"):
                user_info = response.get("user", {})
                return (
                    user_info.get("real_name")
                    or user_info.get("profile", {}).get("display_name")
                    or user_info.get("name")
                    or "不明"
                )
        except Exception:
            pass
        return "不明"

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

    async def run_morning_scan(self, org_id: str) -> dict[str, Any]:
        """
        Run the morning scan for all patients.
        
        Called by Cloud Scheduler via /cron/morning-scan endpoint.
        """
        # Run alert agent scan
        scan_results = await self.alert_agent.scan_all_patients(org_id)

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

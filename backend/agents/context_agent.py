"""
Context Agent - BPS-aware question answering.

Handles @bot mentions with questions, providing context-aware responses
based on patient data and RAG knowledge.
"""

from typing import Any

from .base_agent import BaseAgent, DEFAULT_AGENT_PROMPTS
from services.firestore_service import FirestoreService


# Question answering prompt template
QA_PROMPT_TEMPLATE = """
{knowledge_block}

{patient_context}

[RECENT_REPORTS]
{recent_reports}
[/RECENT_REPORTS]

ユーザーの質問:
{question}

BPSフレームワークに基づいて回答してください。
根拠となった報告は日時と報告者を明示してください。
不確実な情報には確信度を付与し、主治医への相談が必要な場合は明示してください。
"""


class ContextAgent(BaseAgent):
    """
    Context Agent for answering questions about patients.

    Provides BPS-aware responses using patient context and RAG knowledge.
    """

    def __init__(self, system_prompt: str | None = None, shared_prompt: str | None = None):
        super().__init__(
            thinking_level="medium",
            system_prompt=system_prompt or DEFAULT_AGENT_PROMPTS["context"],
            shared_prompt=shared_prompt,
        )

    async def process(
        self,
        patient_id: str,
        question: str,
        knowledge_chunks: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Process a question about a patient.

        Args:
            patient_id: The patient ID in Firestore
            question: The user's question
            knowledge_chunks: RAG knowledge chunks (optional)

        Returns:
            dict with success status and response message
        """
        # Get patient data
        patient = await FirestoreService.get_patient(patient_id)
        if not patient:
            return {
                "success": False,
                "error": "患者が見つかりません",
            }

        # Get current context
        context = await FirestoreService.get_patient_context(patient_id)

        # Get recent reports
        reports = await FirestoreService.list_reports(patient_id, limit=10)

        # Build prompt components
        knowledge_block = self.build_knowledge_block(knowledge_chunks or [])
        patient_context = self.build_patient_context(patient, context)
        recent_reports = self._format_reports(reports)

        prompt = QA_PROMPT_TEMPLATE.format(
            knowledge_block=knowledge_block,
            patient_context=patient_context,
            recent_reports=recent_reports,
            question=question,
        )

        # Generate response
        response = await self.generate(prompt)

        return {
            "success": True,
            "response": response,
        }

    def _format_reports(self, reports: list[dict[str, Any]]) -> str:
        """Format recent reports for the prompt."""
        if not reports:
            return "報告データなし"

        formatted = []
        for report in reports:
            timestamp = report.get("timestamp", "")
            if hasattr(timestamp, "strftime"):
                timestamp = timestamp.strftime("%Y-%m-%d %H:%M")
            
            reporter = report.get("reporter_name", "不明")
            role = report.get("reporter_role", "")
            
            bps = report.get("bps_classification", {})
            bio = self._summarize_section(bps.get("bio", {}))
            psycho = self._summarize_section(bps.get("psycho", {}))
            social = self._summarize_section(bps.get("social", {}))

            formatted.append(
                f"[{timestamp}] {reporter}({role})\n"
                f"  Bio: {bio or '-'}\n"
                f"  Psycho: {psycho or '-'}\n"
                f"  Social: {social or '-'}"
            )

        return "\n\n".join(formatted)

    def _summarize_section(self, section: dict[str, Any]) -> str:
        """Summarize a BPS section briefly."""
        items = []
        for key, value in section.items():
            if value:
                if isinstance(value, list):
                    if value:
                        items.append(str(value[0]) if len(value) == 1 else f"{key}: {len(value)}件")
                elif isinstance(value, dict):
                    items.append(f"{key}: あり")
                else:
                    items.append(str(value))
        return ", ".join(items[:3]) if items else ""


class SaveAgent(BaseAgent):
    """
    Save Agent - Handles "@bot 保存" commands.
    
    Retrieves recent conversation messages and routes to Intake Agent.
    """

    def __init__(self):
        super().__init__(
            thinking_level="low",
            system_prompt="直近のメッセージを取得して保存処理に渡すエージェントです。",
        )

    async def process(
        self,
        patient_id: str,
        channel_id: str,
        thread_ts: str | None = None,
    ) -> dict[str, Any]:
        """
        Process a save command.
        
        This would typically fetch recent messages from Slack
        and pass them to the Intake Agent.

        Args:
            patient_id: The patient ID
            channel_id: Slack channel ID
            thread_ts: Thread timestamp (optional)

        Returns:
            dict with instructions or results
        """
        # This would integrate with Slack API to get recent messages
        # For now, return instructions
        return {
            "success": True,
            "message": (
                "直近のメッセージを保存する場合は、"
                "アンカーメッセージへの返信として報告を投稿してください。"
            ),
        }

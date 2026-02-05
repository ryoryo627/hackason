"""
Summary Agent - BPS progress summary generation.

Generates comprehensive Bio-Psycho-Social summaries for patients,
typically used for handoffs and care coordination.
"""

from datetime import datetime, timezone
from typing import Any

from .base_agent import BaseAgent
from services.firestore_service import FirestoreService


# Summary generation prompt
SUMMARY_PROMPT_TEMPLATE = """
{knowledge_block}

{patient_context}

[RECENT_REPORTS]
{recent_reports}
[/RECENT_REPORTS]

上記の患者情報と報告データに基づいて、BPS経過サマリーを生成してください。

以下の形式で出力してください:

📋 {patient_name}さん BPSサマリー（{date}時点）

🫀 Biological
• バイタルの状態とトレンド
• 症状の変化
• 服薬状況
• ADL状態

🧠 Psychological
• 気分・感情状態
• 認知機能の状態
• 懸念事項

👥 Social
• 家族状況・介護者の状態
• サービス利用状況
• 今後の予定

⚠️ 注意点
• 特に注意が必要な事項
• 推奨されるフォローアップ

根拠となった報告の日時と報告者を適宜明示してください。
確実でない情報には「可能性」「報告あり」などの表現を使用してください。
"""


class SummaryAgent(BaseAgent):
    """
    Summary Agent for generating BPS progress summaries.
    
    Creates comprehensive summaries for care coordination and handoffs.
    """

    def __init__(self):
        super().__init__(
            thinking_level="medium",
            system_prompt=(
                "あなたは患者のBPS経過サマリーを作成する医療AIです。\n"
                "報告データを統合し、ケア連携に役立つサマリーを生成してください。\n"
                "重要な変化や注意点を明確に示してください。"
            ),
        )

    async def process(
        self,
        patient_id: str,
        knowledge_chunks: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Generate a BPS summary for a patient.

        Args:
            patient_id: The patient ID in Firestore
            knowledge_chunks: RAG knowledge chunks (optional)

        Returns:
            dict with success status and summary text
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

        # Get recent reports (up to 20)
        reports = await FirestoreService.list_reports(patient_id, limit=20)

        # Build prompt
        knowledge_block = self.build_knowledge_block(knowledge_chunks or [])
        patient_context = self.build_patient_context(patient, context)
        recent_reports = self._format_reports(reports)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        prompt = SUMMARY_PROMPT_TEMPLATE.format(
            knowledge_block=knowledge_block,
            patient_context=patient_context,
            recent_reports=recent_reports,
            patient_name=patient.get("name", "不明"),
            date=today,
        )

        # Generate summary
        summary = await self.generate(prompt)

        return {
            "success": True,
            "summary": summary,
            "patient_name": patient.get("name", "不明"),
        }

    def _format_reports(self, reports: list[dict[str, Any]]) -> str:
        """Format reports for the summary prompt."""
        if not reports:
            return "報告データなし"

        formatted = []
        for report in reports:
            timestamp = report.get("timestamp", "")
            if hasattr(timestamp, "strftime"):
                timestamp = timestamp.strftime("%Y-%m-%d %H:%M")

            reporter = report.get("reporter_name", "不明")
            role = report.get("reporter_role", "")
            raw_text = report.get("raw_text", "")

            bps = report.get("bps_classification", {})
            
            lines = [
                f"[{timestamp}] {reporter}({role})",
                f"原文: {raw_text[:200]}..." if len(raw_text) > 200 else f"原文: {raw_text}",
            ]

            bio = bps.get("bio", {})
            if bio:
                lines.append(f"Bio: {self._summarize_section(bio)}")

            psycho = bps.get("psycho", {})
            if psycho:
                lines.append(f"Psycho: {self._summarize_section(psycho)}")

            social = bps.get("social", {})
            if social:
                lines.append(f"Social: {self._summarize_section(social)}")

            formatted.append("\n".join(lines))

        return "\n\n---\n\n".join(formatted)

    def _summarize_section(self, section: dict[str, Any]) -> str:
        """Summarize a BPS section briefly."""
        items = []
        for key, value in section.items():
            if value:
                if isinstance(value, list):
                    if isinstance(value[0], dict):
                        # Handle vitals/medications
                        for item in value[:2]:
                            if isinstance(item, dict):
                                name = item.get("type") or item.get("name", "")
                                val = item.get("value", "")
                                if name:
                                    items.append(f"{name}: {val}" if val else name)
                    else:
                        items.extend(str(v) for v in value[:3])
                elif isinstance(value, dict):
                    items.append(f"{key}: あり")
                else:
                    items.append(str(value))
        return ", ".join(items[:5]) if items else "特記なし"

"""
Intake Agent - Text to BPS structured data conversion.

Processes incoming reports from Slack and converts them to structured
Bio-Psycho-Social data stored in Firestore.
"""

import json
from datetime import datetime, timezone
from typing import Any

from .base_agent import BaseAgent
from services.firestore_service import FirestoreService

# BPS structuring prompt template
BPS_PROMPT_TEMPLATE = """
{knowledge_block}

{patient_context}

以下の報告テキストをBio-Psycho-Socialフレームワークで構造化してください。

報告者: {reporter_name} ({reporter_role})
報告テキスト:
{raw_text}

以下のJSON形式で出力してください:

{{
  "bio": {{
    "vitals": [
      {{ "type": "バイタル名", "value": 数値, "unit": "単位", "trend": "↑/↓/→", "note": "備考" }}
    ],
    "symptoms": ["症状1", "症状2"],
    "medications": [
      {{ "name": "薬剤名", "adherence": "良好/低下/不明", "note": "備考" }}
    ],
    "adl": "ADL状況の記述"
  }},
  "psycho": {{
    "mood": "気分の状態",
    "cognition": "認知機能の状態",
    "concerns": ["懸念事項1", "懸念事項2"]
  }},
  "social": {{
    "family": "家族状況",
    "services": "サービス利用状況",
    "concerns": ["懸念事項1"]
  }},
  "confidence": 0.0-1.0の確信度
}}

注意:
- 報告にない情報はnullまたは空配列とする（推測で埋めない）
- バイタルのtrendは過去のコンテキストと比較して判断
- confidenceは構造化の確信度（0.0-1.0）
- 日本語で出力すること
"""

# Confirmation message template
CONFIRMATION_TEMPLATE = """✅ 保存しました

Bio: {bio_summary}
Psycho: {psycho_summary}
Social: {social_summary}

📊 確信度: {confidence:.2f} | 報告者: {reporter_name} | ソース: テキスト"""


class IntakeAgent(BaseAgent):
    """
    Intake Agent for processing incoming reports.
    
    Converts free-text reports into structured BPS data and stores
    them in Firestore.
    """

    def __init__(self):
        super().__init__(
            thinking_level="low",
            system_prompt="あなたは報告テキストをBPS形式に構造化するエキスパートです。正確かつ客観的に情報を抽出してください。",
        )

    async def process(
        self,
        patient_id: str,
        raw_text: str,
        reporter_name: str = "不明",
        reporter_role: str = "不明",
        slack_message_ts: str | None = None,
        knowledge_chunks: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Process an incoming report and store structured BPS data.

        Args:
            patient_id: The patient ID in Firestore
            raw_text: The raw report text
            reporter_name: Name of the reporter
            reporter_role: Role of the reporter (nurse, pharmacist, etc.)
            slack_message_ts: Slack message timestamp (optional)
            knowledge_chunks: RAG knowledge chunks (optional)

        Returns:
            dict with success status, report_id, and confirmation message
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

        # Build prompt
        knowledge_block = self.build_knowledge_block(knowledge_chunks or [])
        patient_context = self.build_patient_context(patient, context)

        prompt = BPS_PROMPT_TEMPLATE.format(
            knowledge_block=knowledge_block,
            patient_context=patient_context,
            reporter_name=reporter_name,
            reporter_role=reporter_role,
            raw_text=raw_text,
        )

        # Generate BPS structure
        try:
            response = await self.generate(prompt, json_mode=True)
            bps_data = json.loads(response)
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "BPS構造化に失敗しました",
            }

        # Build report data
        timestamp = datetime.now(timezone.utc)
        report_data = {
            "timestamp": timestamp,
            "reporter_name": reporter_name,
            "reporter_role": reporter_role,
            "raw_text": raw_text,
            "bps_classification": {
                "bio": bps_data.get("bio", {}),
                "psycho": bps_data.get("psycho", {}),
                "social": bps_data.get("social", {}),
            },
            "confidence": bps_data.get("confidence", 0.0),
            "source_type": "text",
            "slack_message_ts": slack_message_ts,
        }

        # Save to Firestore
        report_id = await FirestoreService.create_report(patient_id, report_data)

        # Update patient context
        await self._update_context(patient_id, bps_data)

        # Generate confirmation message
        confirmation = self._format_confirmation(
            bps_data,
            reporter_name,
            bps_data.get("confidence", 0.0),
        )

        return {
            "success": True,
            "report_id": report_id,
            "bps_data": bps_data,
            "confirmation_message": confirmation,
        }

    async def _update_context(
        self,
        patient_id: str,
        bps_data: dict[str, Any],
    ) -> None:
        """
        Update the patient's current context with new BPS data.
        
        Merges new data with existing context.
        """
        current = await FirestoreService.get_patient_context(patient_id)
        if not current:
            current = {"bio": {}, "psycho": {}, "social": {}}

        # Merge BPS sections
        for section in ["bio", "psycho", "social"]:
            new_section = bps_data.get(section, {})
            if new_section:
                if section not in current:
                    current[section] = {}
                # Update with new values (simple merge for now)
                for key, value in new_section.items():
                    if value:  # Only update non-empty values
                        current[section][key] = value

        await FirestoreService.update_patient_context(patient_id, current)

    def _format_confirmation(
        self,
        bps_data: dict[str, Any],
        reporter_name: str,
        confidence: float,
    ) -> str:
        """Format the confirmation message for Slack."""
        bio = bps_data.get("bio", {})
        psycho = bps_data.get("psycho", {})
        social = bps_data.get("social", {})

        bio_summary = self._summarize_bio(bio)
        psycho_summary = self._summarize_psycho(psycho)
        social_summary = self._summarize_social(social)

        return CONFIRMATION_TEMPLATE.format(
            bio_summary=bio_summary or "-",
            psycho_summary=psycho_summary or "-",
            social_summary=social_summary or "-",
            confidence=confidence,
            reporter_name=reporter_name,
        )

    def _summarize_bio(self, bio: dict[str, Any]) -> str:
        """Summarize biological section."""
        parts = []
        
        # Vitals
        vitals = bio.get("vitals", [])
        for vital in vitals[:3]:  # Limit to 3
            v_type = vital.get("type", "")
            value = vital.get("value", "")
            unit = vital.get("unit", "")
            trend = vital.get("trend", "")
            if v_type and value:
                parts.append(f"{v_type} {value}{unit}{trend}")

        # Symptoms
        symptoms = bio.get("symptoms", [])
        if symptoms:
            parts.extend(symptoms[:2])  # Limit to 2

        # ADL
        adl = bio.get("adl")
        if adl:
            parts.append(adl)

        return ", ".join(parts) if parts else ""

    def _summarize_psycho(self, psycho: dict[str, Any]) -> str:
        """Summarize psychological section."""
        parts = []
        
        mood = psycho.get("mood")
        if mood:
            parts.append(mood)

        cognition = psycho.get("cognition")
        if cognition:
            parts.append(cognition)

        concerns = psycho.get("concerns", [])
        if concerns:
            parts.extend(concerns[:2])

        return ", ".join(parts) if parts else ""

    def _summarize_social(self, social: dict[str, Any]) -> str:
        """Summarize social section."""
        parts = []
        
        family = social.get("family")
        if family:
            parts.append(family)

        services = social.get("services")
        if services:
            parts.append(services)

        concerns = social.get("concerns", [])
        if concerns:
            parts.extend(concerns[:2])

        return ", ".join(parts) if parts else ""

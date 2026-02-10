"""
Summary Agent - BPS progress summary generation.

Generates comprehensive Bio-Psycho-Social summaries for patients,
typically used for handoffs and care coordination.
"""

from datetime import datetime, timezone
from typing import Any

from .base_agent import BaseAgent, DEFAULT_AGENT_PROMPTS
from services.firestore_service import FirestoreService


# Summary generation prompt
SUMMARY_PROMPT_TEMPLATE = """
{knowledge_block}

{patient_context}

[RECENT_REPORTS]
{recent_reports}
[/RECENT_REPORTS]

上記の患者情報と報告データに基づいて、BPS経過サマリーをナラティブ（文章）形式で生成してください。

以下の構成で、それぞれ自然な日本語の文章として記述してください。
箇条書きではなく、申し送りや紹介状のように読みやすい文章にしてください。

{patient_name}さん BPSサマリー（{date}時点）

Biological
バイタルサイン、症状の変化、服薬状況、ADL状態について、時系列の変化やトレンドを含めて文章で記述。

Psychological
気分・感情状態、認知機能、意欲やモチベーション、睡眠状況について、全体像が伝わるように文章で記述。

Social
家族状況・介護者の負担、サービス利用状況、地域との繋がり、今後の予定について文章で記述。

注意点・推奨事項
特に注意が必要な事項と推奨されるフォローアップについて文章で記述。

ルール:
- 根拠となった報告の日時と報告者を文中に自然に織り込んでください
- 確実でない情報には「可能性」「報告あり」などの表現を使用してください
- 各セクションは2〜4文程度でまとめてください
"""


BPS_NARRATIVE_PROMPT = """
以下の患者情報・蓄積コンテキスト・直近の報告に基づいて、現在の状態をBio・Psycho・Socialの
3軸でナラティブ（自然な日本語の文章）にまとめてください。

{patient_info}

[蓄積BPSコンテキスト]
{accumulated_context}

[直近の報告]
{recent_reports}

出力JSON:
{{
  "bio_narrative": "バイタルサイン、症状、服薬、ADLの状態を2-4文で。数値やトレンドを含める。",
  "psycho_narrative": "気分、意欲、認知、睡眠の状態を2-4文で。本人の発言があれば引用。",
  "social_narrative": "家族状況、サービス利用、地域との繋がりを2-4文で。",
  "bio_trend": "Biological軸の20文字以内の1行トレンド要約（例: バイタル安定、食欲やや低下傾向）",
  "psycho_trend": "Psychological軸の20文字以内の1行トレンド要約（例: 意欲改善、認知機能は横ばい）",
  "social_trend": "Social軸の20文字以内の1行トレンド要約（例: 家族支援安定、デイ利用順調）"
}}

ルール:
- 申し送りのように読みやすい自然な日本語で書く
- 箇条書きではなく文章にする
- 具体的な数値（BP、SpO2、TUGスコア等）は必ず含める
- 変化のトレンドがあれば「前回より改善」「悪化傾向」等を明記
- 情報がない軸のnarrativeは「現時点で報告なし」とする
- 情報がない軸のtrendは空文字とする
- trendは四季報の見出しのような簡潔な表現にする（20文字以内）
- 推測ではなく報告された事実に基づく
"""


class SummaryAgent(BaseAgent):
    """
    Summary Agent for generating BPS progress summaries.

    Creates comprehensive summaries for care coordination and handoffs.
    """

    def __init__(self, system_prompt: str | None = None, shared_prompt: str | None = None,
                 thinking_level: str = "medium"):
        super().__init__(
            thinking_level=thinking_level,
            system_prompt=system_prompt or DEFAULT_AGENT_PROMPTS["summary"],
            shared_prompt=shared_prompt,
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
                    if value and isinstance(value[0], dict):
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

    async def generate_bps_narrative(
        self,
        patient_id: str,
        patient: dict[str, Any],
        bps_data: dict[str, Any],
    ) -> dict[str, str] | None:
        """
        Generate a BPS narrative summary using lightweight Gemini call.

        Uses accumulated context + recent reports for comprehensive narrative.

        Args:
            patient_id: The patient ID
            patient: Patient data dict
            bps_data: Latest BPS classification data

        Returns:
            dict with bio_narrative, psycho_narrative, social_narrative or None
        """
        import json as _json

        # Patient basic info
        patient_info = (
            f"患者名: {patient.get('name', '不明')}\n"
            f"年齢: {patient.get('age', '不明')}歳\n"
            f"性別: {patient.get('gender', '不明')}\n"
            f"主病名: {patient.get('primary_diagnosis', '未設定')}"
        )

        # Accumulated BPS context from Firestore
        context = await FirestoreService.get_patient_context(patient_id)
        accumulated_context = ""
        if context:
            for section in ["bio", "psycho", "social"]:
                data = context.get(section, {})
                if data:
                    accumulated_context += f"{section}: {_json.dumps(data, ensure_ascii=False, default=str)}\n"
        if not accumulated_context:
            accumulated_context = "蓄積データなし"

        # Recent reports (up to 5)
        reports = await FirestoreService.list_reports(patient_id, limit=5)
        recent_reports = ""
        if reports:
            for r in reports:
                ts = r.get("timestamp", "")
                if hasattr(ts, "strftime"):
                    ts = ts.strftime("%Y-%m-%d %H:%M")
                reporter = r.get("reporter_name", "不明")
                role = r.get("reporter_role", "")
                raw = r.get("raw_text", "")[:300]
                recent_reports += f"[{ts}] {reporter}({role}): {raw}\n\n"
        if not recent_reports:
            # Use current BPS data as fallback
            recent_reports = _json.dumps(bps_data, ensure_ascii=False, default=str)

        prompt = BPS_NARRATIVE_PROMPT.format(
            patient_info=patient_info,
            accumulated_context=accumulated_context,
            recent_reports=recent_reports,
        )

        response = await self.generate(prompt, json_mode=True)

        # Robust JSON parsing
        try:
            result = _json.loads(response)
        except _json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            match = re.search(r'\{[^{}]*"bio_narrative"[^{}]*\}', response, re.DOTALL)
            if match:
                result = _json.loads(match.group())
            else:
                return None

        return {
            "bio_narrative": result.get("bio_narrative", "現時点で報告なし"),
            "psycho_narrative": result.get("psycho_narrative", "現時点で報告なし"),
            "social_narrative": result.get("social_narrative", "現時点で報告なし"),
            "bio_trend": result.get("bio_trend", ""),
            "psycho_trend": result.get("psycho_trend", ""),
            "social_trend": result.get("social_trend", ""),
        }

"""
Alert Agent - BPS anomaly detection and alerting.

Monitors patient reports for concerning patterns and generates alerts
based on predefined detection patterns.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from .base_agent import BaseAgent, DEFAULT_AGENT_PROMPTS
from services.firestore_service import FirestoreService
from services.slack_service import SlackService


# Alert detection patterns
ALERT_PATTERNS = """
| ID | パターン名 | 検知条件 | 緊急度 | 推奨アクション |
|----|-----------|---------|--------|--------------|
| A-1 | バイタル低下トレンド | SpO2/BP等が連続2回以上低下 | HIGH | 主治医への早期相談 |
| A-2 | 複合Bio悪化 | 2項目以上のBio指標が同時悪化 | HIGH | 診察・検査の推奨 |
| A-3 | Bio+Psycho複合 | 食欲低下 + 意欲低下 | MEDIUM | うつ病スクリーニング推奨 |
| A-4 | Bio+Social複合 | 服薬低下 + 介護負担増加 | MEDIUM | 服薬管理方法の見直し |
| A-5 | 全軸複合 | Bio + Psycho + Social同時変化 | HIGH | 緊急カンファレンス推奨 |
| A-6 | 認知変化 | 家族からの認知変化報告 | MEDIUM | 認知機能評価の実施推奨 |
"""

# Alert detection prompt
ALERT_PROMPT_TEMPLATE = """
{knowledge_block}

{patient_context}

[NEW_REPORT]
{new_report}
[/NEW_REPORT]

[HISTORICAL_REPORTS]
{historical_reports}
[/HISTORICAL_REPORTS]

以下のアラートパターンと照合し、該当するものがあれば報告してください:
{alert_patterns}

出力JSON:
{{
  "alerts": [
    {{
      "pattern_id": "A-1",
      "pattern_name": "パターン名",
      "severity": "HIGH/MEDIUM/LOW",
      "title": "アラートのタイトル",
      "message": "詳細な説明",
      "evidence": ["根拠1", "根拠2"],
      "recommendations": ["推奨アクション1", "推奨アクション2"]
    }}
  ]
}}

該当なしの場合は空配列を返してください。
慎重に判断し、誤検知を避けてください。
"""


class AlertAgent(BaseAgent):
    """
    Alert Agent for detecting concerning patterns.
    
    Analyzes patient reports against predefined patterns and
    generates alerts when anomalies are detected.
    """

    def __init__(self, system_prompt: str | None = None, shared_prompt: str | None = None):
        super().__init__(
            thinking_level="high",
            system_prompt=system_prompt or DEFAULT_AGENT_PROMPTS["alert"],
            shared_prompt=shared_prompt,
        )

    async def process(
        self,
        patient_id: str,
        new_report: dict[str, Any] | None = None,
        knowledge_chunks: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Process alert detection for a patient.

        Args:
            patient_id: The patient ID in Firestore
            new_report: New report data (for immediate trigger)
            knowledge_chunks: RAG knowledge chunks (optional)

        Returns:
            dict with alerts and status
        """
        # Get patient data
        patient = await FirestoreService.get_patient(patient_id)
        if not patient:
            return {
                "success": False,
                "error": "患者が見つかりません",
                "alerts": [],
            }

        # Get current context
        context = await FirestoreService.get_patient_context(patient_id)

        # Get historical reports (past 7 days)
        seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
        historical = await FirestoreService.list_reports(
            patient_id, limit=20, since=seven_days_ago
        )

        # Build prompt
        knowledge_block = self.build_knowledge_block(knowledge_chunks or [])
        patient_context = self.build_patient_context(patient, context)
        new_report_text = self._format_report(new_report) if new_report else "なし"
        historical_text = self._format_historical_reports(historical)

        prompt = ALERT_PROMPT_TEMPLATE.format(
            knowledge_block=knowledge_block,
            patient_context=patient_context,
            new_report=new_report_text,
            historical_reports=historical_text,
            alert_patterns=ALERT_PATTERNS,
        )

        # Generate alert analysis
        try:
            response = await self.generate(prompt, json_mode=True)
            result = json.loads(response)
        except json.JSONDecodeError as e:
            print(
                f"[ERROR] AlertAgent JSON parse failed for patient={patient_id}: "
                f"{e}; response[:500]={response[:500]!r}"
            )
            return {
                "success": False,
                "error": f"アラート分析のJSON解析に失敗: {e}",
                "alerts": [],
            }

        alerts = result.get("alerts", [])

        # Save alerts to Firestore
        saved_alerts = []
        for alert in alerts:
            alert_data = {
                "pattern_id": alert.get("pattern_id"),
                "pattern_name": alert.get("pattern_name"),
                "severity": alert.get("severity", "MEDIUM").lower(),
                "title": alert.get("title"),
                "message": alert.get("message"),
                "evidence": alert.get("evidence", []),
                "recommendations": alert.get("recommendations", []),
                "patient_id": patient_id,
                "org_id": patient.get("org_id"),
            }
            alert_id = await FirestoreService.create_alert(patient_id, alert_data)
            alert_data["id"] = alert_id
            saved_alerts.append(alert_data)

        # Recalculate risk level if new alerts were created
        if saved_alerts:
            from services.risk_service import RiskService
            await RiskService.recalculate(patient_id, trigger="alert_created")

        return {
            "success": True,
            "alerts": saved_alerts,
            "patient_name": patient.get("name", "不明"),
        }

    async def scan_all_patients(
        self,
        org_id: str,
        knowledge_chunks: list[dict[str, Any]] | None = None,
        lookback_days: int = 7,
    ) -> dict[str, Any]:
        """
        Scan all patients for alerts (morning scan).

        Args:
            org_id: Organization ID
            knowledge_chunks: RAG knowledge chunks (optional)
            lookback_days: How many days back to check for reports (default 7)

        Returns:
            dict with scan results
        """
        # Get all active patients
        patients = await FirestoreService.list_patients(org_id, status="active", limit=100)

        results = {
            "high": [],
            "medium": [],
            "low": [],
            "unchanged": 0,
            "scanned": 0,
        }

        for patient in patients:
            patient_id = patient.get("id")
            if not patient_id:
                continue

            results["scanned"] += 1

            # Check for recent reports within lookback window
            since = datetime.now(timezone.utc) - timedelta(days=lookback_days)
            recent_reports = await FirestoreService.list_reports(
                patient_id, limit=10, since=since
            )

            if not recent_reports:
                print(f"[INFO] AlertAgent: patient={patient_id} has no reports in past {lookback_days}d, skipping")
                results["unchanged"] += 1
                continue

            # Run alert detection
            alert_result = await self.process(
                patient_id,
                new_report=recent_reports[0] if recent_reports else None,
                knowledge_chunks=knowledge_chunks,
            )

            if not alert_result.get("success"):
                print(
                    f"[WARN] AlertAgent: scan failed for patient={patient_id}: "
                    f"{alert_result.get('error')}"
                )
                continue

            for alert in alert_result.get("alerts", []):
                severity = alert.get("severity", "medium").lower()
                alert["patient_name"] = patient.get("name", "不明")
                alert["patient_id"] = patient_id
                alert["slack_channel_name"] = patient.get("slack_channel_name", "")

                if severity == "high":
                    results["high"].append(alert)
                elif severity == "medium":
                    results["medium"].append(alert)
                else:
                    results["low"].append(alert)

        return results

    def format_morning_report(
        self,
        scan_results: dict[str, Any],
    ) -> str:
        """Format the morning report for Slack."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        weekday = ["月", "火", "水", "木", "金", "土", "日"][
            datetime.now(timezone.utc).weekday()
        ]

        total_alerts = (
            len(scan_results["high"])
            + len(scan_results["medium"])
            + len(scan_results["low"])
        )
        total_patients = scan_results["scanned"]
        changed = total_patients - scan_results["unchanged"]

        lines = [
            f"📊 朝レポート | {today}（{weekday}）",
            "",
            f"状態変化: {changed}名 / 全{total_patients}名",
            "",
        ]

        # HIGH alerts
        if scan_results["high"]:
            lines.append(f"🔴 HIGH ({len(scan_results['high'])}名)")
            for alert in scan_results["high"][:5]:
                name = alert.get("patient_name", "不明")
                title = alert.get("title", "")
                channel = alert.get("slack_channel_name", "")
                lines.append(f"• {name} - {title} → #{channel}")
            lines.append("")

        # MEDIUM alerts
        if scan_results["medium"]:
            lines.append(f"🟡 MED ({len(scan_results['medium'])}名)")
            for alert in scan_results["medium"][:5]:
                name = alert.get("patient_name", "不明")
                title = alert.get("title", "")
                channel = alert.get("slack_channel_name", "")
                lines.append(f"• {name} - {title} → #{channel}")
            lines.append("")

        # Summary
        unchanged = scan_results["unchanged"]
        lines.append(f"🟢 変化なし: {unchanged}名")

        return "\n".join(lines)

    def format_alert_message(self, alert: dict[str, Any]) -> str:
        """Format a single alert for Slack posting."""
        severity = alert.get("severity", "medium").lower()
        severity_emoji = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(
            severity, "⚪"
        )

        lines = [
            f"{severity_emoji} {alert.get('title', 'アラート')}",
            "",
            alert.get("message", ""),
            "",
        ]

        evidence = alert.get("evidence", [])
        if evidence:
            lines.append("📎 根拠:")
            for e in evidence:
                lines.append(f"• {e}")
            lines.append("")

        recommendations = alert.get("recommendations", [])
        if recommendations:
            lines.append("📋 推奨アクション:")
            for r in recommendations:
                lines.append(f"• {r}")

        return "\n".join(lines)

    def _format_report(self, report: dict[str, Any]) -> str:
        """Format a single report for the prompt."""
        timestamp = report.get("timestamp", "")
        if hasattr(timestamp, "strftime"):
            timestamp = timestamp.strftime("%Y-%m-%d %H:%M")

        reporter = report.get("reporter_name", "不明")
        role = report.get("reporter_role", "")
        bps = report.get("bps_classification", {})

        return (
            f"日時: {timestamp}\n"
            f"報告者: {reporter}({role})\n"
            f"Bio: {json.dumps(bps.get('bio', {}), ensure_ascii=False)}\n"
            f"Psycho: {json.dumps(bps.get('psycho', {}), ensure_ascii=False)}\n"
            f"Social: {json.dumps(bps.get('social', {}), ensure_ascii=False)}"
        )

    def _format_historical_reports(self, reports: list[dict[str, Any]]) -> str:
        """Format historical reports for the prompt."""
        if not reports:
            return "過去7日間の報告なし"

        formatted = []
        for report in reports[:10]:
            formatted.append(self._format_report(report))

        return "\n\n---\n\n".join(formatted)

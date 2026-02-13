"""
Risk Service - Automatic risk level escalation/de-escalation.

Calculates patient risk levels based on unacknowledged alert counts
and severity, with support for manual overrides.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from services.firestore_service import FirestoreService

logger = logging.getLogger(__name__)

# Severity labels (Japanese)
SEVERITY_LABELS = {
    "high": "緊急",
    "medium": "注意",
    "low": "情報",
}


class RiskService:
    """Service for automatic risk level calculation and history tracking."""

    @classmethod
    async def recalculate(cls, patient_id: str, trigger: str) -> dict[str, Any]:
        """
        Recalculate risk level for a patient based on unacknowledged alerts.

        Args:
            patient_id: The patient ID.
            trigger: What triggered this recalculation (e.g. "alert_created", "alert_acknowledged").

        Returns:
            dict with changed (bool), previous_level, new_level, reason.
        """
        patient = await FirestoreService.get_patient(patient_id)
        if not patient:
            return {"changed": False, "error": "患者が見つかりません"}

        current_level = (patient.get("risk_level") or "low").lower()
        current_source = patient.get("risk_level_source", "manual")

        # Get unacknowledged alerts
        unacked_alerts = await FirestoreService.list_alerts(
            patient_id=patient_id,
            acknowledged=False,
            limit=100,
        )

        # Get latest alert timestamp for de-escalation logic
        latest_alert_at = await FirestoreService.get_latest_alert_timestamp(patient_id)

        # Calculate new level
        new_level, reason = cls._calculate(
            unacked_alerts=unacked_alerts,
            current_level=current_level,
            current_source=current_source,
            latest_alert_at=latest_alert_at,
        )

        if new_level == current_level:
            return {
                "changed": False,
                "current_level": current_level,
                "reason": reason,
            }

        # Build alert snapshot
        snapshot = {"high": 0, "medium": 0, "low": 0}
        for a in unacked_alerts:
            sev = (a.get("severity") or "low").lower()
            if sev in snapshot:
                snapshot[sev] += 1

        # Update patient risk_level
        await FirestoreService.update_patient(patient_id, {
            "risk_level": new_level,
            "risk_level_source": "auto",
            "risk_level_reason": reason,
            "risk_level_updated_at": datetime.now(timezone.utc).isoformat(),
        })

        # Record history
        await FirestoreService.create_risk_history_entry(patient_id, {
            "previous_level": current_level,
            "new_level": new_level,
            "source": "auto",
            "reason": reason,
            "trigger": trigger,
            "alert_snapshot": snapshot,
            "created_by": "system",
        })

        logger.info(
            f"[RiskService] patient={patient_id} risk changed: "
            f"{current_level} -> {new_level} (trigger={trigger})"
        )

        return {
            "changed": True,
            "previous_level": current_level,
            "new_level": new_level,
            "reason": reason,
        }

    @classmethod
    def _calculate(
        cls,
        unacked_alerts: list[dict[str, Any]],
        current_level: str,
        current_source: str,
        latest_alert_at: datetime | None,
    ) -> tuple[str, str]:
        """
        Pure calculation function (no side effects).

        Returns:
            (new_level, reason) tuple.
        """
        # Count unacknowledged alerts by severity
        counts = {"high": 0, "medium": 0, "low": 0}
        for alert in unacked_alerts:
            sev = (alert.get("severity") or "low").lower()
            if sev in counts:
                counts[sev] += 1

        total_unacked = counts["high"] + counts["medium"] + counts["low"]

        # === Escalation (priority order, first match wins) ===
        if counts["high"] >= 1:
            return ("high", f"未確認の{SEVERITY_LABELS['high']}アラートが{counts['high']}件あります")

        if counts["medium"] >= 2:
            return ("high", f"未確認の{SEVERITY_LABELS['medium']}アラートが{counts['medium']}件あります")

        if counts["medium"] == 1:
            return ("medium", f"未確認の{SEVERITY_LABELS['medium']}アラートが1件あります")

        if counts["low"] >= 3:
            return ("medium", f"未確認の{SEVERITY_LABELS['low']}アラートが{counts['low']}件あります")

        if counts["low"] >= 1:
            return ("low", f"未確認の{SEVERITY_LABELS['low']}アラートが{counts['low']}件あります")

        # === De-escalation (0 unacknowledged alerts) ===
        if total_unacked == 0:
            # Manual override: don't auto de-escalate
            if current_source == "manual":
                return (current_level, "手動設定中のため自動変更なし")

            now = datetime.now(timezone.utc)

            if latest_alert_at is None:
                # No alerts ever → LOW
                return ("low", "アラート履歴がないため低リスクに設定")

            days_since = (now - latest_alert_at).days

            if days_since >= 14:
                return ("low", f"全アラート確認済み・{days_since}日間新規アラートなし")

            if days_since >= 7:
                # Step down one level
                level_order = ["high", "medium", "low"]
                current_idx = level_order.index(current_level) if current_level in level_order else 0
                new_idx = min(current_idx + 1, len(level_order) - 1)
                new_level = level_order[new_idx]
                if new_level != current_level:
                    return (new_level, f"全アラート確認済み・{days_since}日間新規アラートなし（1段階下げ）")
                return (current_level, "現状維持")

            # Within 7 days of last alert → maintain
            return (current_level, "7日以内にアラートがあるため現状維持")

        return (current_level, "現状維持")

    @classmethod
    async def record_manual_change(
        cls,
        patient_id: str,
        new_level: str,
        changed_by: str,
        previous_level: str,
    ) -> None:
        """Record a manual risk level change in history."""
        # Get current unacknowledged alert counts for snapshot
        unacked_alerts = await FirestoreService.list_alerts(
            patient_id=patient_id,
            acknowledged=False,
            limit=100,
        )
        snapshot = {"high": 0, "medium": 0, "low": 0}
        for a in unacked_alerts:
            sev = (a.get("severity") or "low").lower()
            if sev in snapshot:
                snapshot[sev] += 1

        await FirestoreService.create_risk_history_entry(patient_id, {
            "previous_level": previous_level,
            "new_level": new_level,
            "source": "manual",
            "reason": f"手動変更（{changed_by}による）",
            "trigger": "manual_update",
            "alert_snapshot": snapshot,
            "created_by": changed_by,
        })

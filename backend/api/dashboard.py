"""
Dashboard API - Statistics and overview data.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Query

from services.firestore_service import FirestoreService

router = APIRouter()


@router.get("/stats")
async def get_dashboard_stats(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    Get dashboard statistics.
    """
    # Parallel fetch: patients and alerts
    all_patients, unack_alerts = await asyncio.gather(
        FirestoreService.list_patients(org_id, status="active", limit=500),
        FirestoreService.list_alerts(org_id=org_id, acknowledged=False, limit=100),
    )

    # Count by risk level
    high_risk = sum(1 for p in all_patients if p.get("risk_level") == "high")

    # Count recent reports (past 24 hours) - parallel fetch for top 20 patients
    one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)

    async def _count_reports(patient_id: str) -> int:
        reports = await FirestoreService.list_reports(patient_id, limit=10, since=one_day_ago)
        return len(reports)

    patient_ids = [p["id"] for p in all_patients[:20] if p.get("id")]
    report_counts = await asyncio.gather(*[_count_reports(pid) for pid in patient_ids])
    recent_reports_count = sum(report_counts)

    return {
        "total_patients": len(all_patients),
        "high_risk_patients": high_risk,
        "unacknowledged_alerts": len(unack_alerts),
        "recent_reports_24h": recent_reports_count,
    }


@router.get("/recent-alerts")
async def get_recent_alerts(
    org_id: str = Query(..., description="Organization ID"),
    limit: int = Query(5, description="Number of alerts"),
) -> dict[str, Any]:
    """
    Get recent unacknowledged alerts for dashboard.
    """
    alerts = await FirestoreService.list_alerts(
        org_id=org_id,
        acknowledged=False,
        limit=limit,
    )
    
    # Batch fetch patient names to avoid N+1
    patient_ids = list({a.get("patient_id") for a in alerts if a.get("patient_id")})
    patients_map = await FirestoreService.get_patients_batch(patient_ids)

    for alert in alerts:
        patient_id = alert.get("patient_id")
        if patient_id and patient_id in patients_map:
            alert["patient_name"] = patients_map[patient_id].get("name", "不明")
        if not alert.get("title"):
            alert["title"] = alert.get("pattern_name", "アラート")

    return {
        "alerts": alerts,
    }


@router.get("/connection-status")
async def get_connection_status(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    Get connection status for external services.
    """
    # Get organization
    org = await FirestoreService.get_organization(org_id)
    
    # Get service configs
    slack_config = await FirestoreService.get_service_config(org_id, "slack")
    gemini_config = await FirestoreService.get_service_config(org_id, "gemini")
    vertex_config = await FirestoreService.get_service_config(org_id, "vertex")
    
    return {
        "slack": {
            "connected": bool(slack_config and slack_config.get("slack_configured")),
            "team_name": slack_config.get("slack_team_name") if slack_config else None,
        },
        "gemini": {
            "connected": bool(gemini_config and gemini_config.get("configured")),
            "model": gemini_config.get("model") if gemini_config else None,
        },
        "vertex": {
            "connected": bool(vertex_config and vertex_config.get("configured")),
        },
        "firestore": {
            "connected": True,  # If we got here, Firestore is working
        },
    }


@router.get("/night-summary")
async def get_night_summary(
    org_id: str = Query(..., description="Organization ID"),
    hours: int = Query(14, description="Hours to look back (default 14 = 18:00-08:00)"),
) -> dict[str, Any]:
    """
    Get night events summary for morning dashboard.
    Aggregates reports and alerts from the past N hours across all patients.
    """
    now = datetime.now(timezone.utc)
    since = now - timedelta(hours=hours)

    # Fetch all active patients
    all_patients = await FirestoreService.list_patients(org_id, status="active", limit=500)

    # Parallel fetch reports + alerts for each patient
    async def _fetch_patient_events(patient: dict) -> dict | None:
        pid = patient.get("id")
        if not pid:
            return None
        reports, alerts = await asyncio.gather(
            FirestoreService.list_reports(pid, limit=20, since=since),
            FirestoreService.list_alerts(patient_id=pid, limit=20, since=since),
        )
        if not reports and not alerts:
            return None
        # Build latest report summary
        latest_report = None
        if reports:
            r = reports[0]
            latest_report = {
                "timestamp": r.get("timestamp", ""),
                "reporter_name": r.get("reporter_name", ""),
                "reporter_role": r.get("reporter_role", ""),
                "raw_text": r.get("raw_text", ""),
            }
        return {
            "patient_id": pid,
            "patient_name": patient.get("name", "不明"),
            "risk_level": patient.get("risk_level", "low"),
            "reports_count": len(reports),
            "alerts": [
                {
                    "severity": a.get("severity", "low"),
                    "title": a.get("title") or a.get("pattern_name", "アラート"),
                    "message": a.get("message", ""),
                    "created_at": a.get("created_at", ""),
                }
                for a in alerts
            ],
            "latest_report": latest_report,
        }

    results = await asyncio.gather(
        *[_fetch_patient_events(p) for p in all_patients]
    )
    patients_with_events = [r for r in results if r is not None]

    # Sort: highest severity first, then by alert count
    severity_order = {"high": 0, "medium": 1, "low": 2}

    def _sort_key(p: dict) -> tuple:
        alerts = p.get("alerts", [])
        max_sev = min(
            (severity_order.get(a.get("severity", "low"), 2) for a in alerts),
            default=3,
        )
        return (max_sev, -len(alerts))

    patients_with_events.sort(key=_sort_key)

    # Aggregate severity counts
    alerts_by_severity: dict[str, int] = {"high": 0, "medium": 0, "low": 0}
    total_reports = 0
    for p in patients_with_events:
        total_reports += p.get("reports_count", 0)
        for a in p.get("alerts", []):
            sev = a.get("severity", "low")
            if sev in alerts_by_severity:
                alerts_by_severity[sev] += 1

    return {
        "window": {
            "since": since.isoformat(),
            "until": now.isoformat(),
            "hours": hours,
        },
        "summary": {
            "total_patients": len(all_patients),
            "patients_with_events": len(patients_with_events),
            "total_reports": total_reports,
            "alerts_by_severity": alerts_by_severity,
        },
        "patients": patients_with_events,
    }


@router.get("/activity-feed")
async def get_activity_feed(
    org_id: str = Query(..., description="Organization ID"),
    limit: int = Query(20, description="Number of activities"),
    hours: int = Query(48, description="Hours to look back"),
) -> dict[str, Any]:
    """
    Get cross-patient activity feed (recent reports from all patients).
    """
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Fetch all active patients
    all_patients = await FirestoreService.list_patients(org_id, status="active", limit=500)

    # Parallel fetch recent reports from each patient
    async def _fetch_reports(patient: dict) -> list[dict]:
        pid = patient.get("id")
        if not pid:
            return []
        reports = await FirestoreService.list_reports(pid, limit=10, since=since)
        for r in reports:
            r["patient_id"] = pid
            r["patient_name"] = patient.get("name", "不明")
        return reports

    all_reports_lists = await asyncio.gather(
        *[_fetch_reports(p) for p in all_patients]
    )

    # Flatten and sort
    activities = [r for reports in all_reports_lists for r in reports]
    activities.sort(key=lambda x: x.get("timestamp", "") or "", reverse=True)

    return {
        "activities": activities[:limit],
    }

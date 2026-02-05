"""
Dashboard API - Statistics and overview data.
"""

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
    # Get all patients
    all_patients = await FirestoreService.list_patients(org_id, status="active", limit=500)
    
    # Count by risk level
    high_risk = sum(1 for p in all_patients if p.get("risk_level") == "high")
    
    # Get unacknowledged alerts
    unack_alerts = await FirestoreService.list_alerts(
        org_id=org_id,
        acknowledged=False,
        limit=100,
    )
    
    # Count recent reports (past 24 hours) - simplified for now
    # In production, would use a more efficient query
    recent_reports_count = 0
    one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    
    for patient in all_patients[:20]:  # Limit to avoid too many queries
        patient_id = patient.get("id")
        if patient_id:
            reports = await FirestoreService.list_reports(
                patient_id, limit=10, since=one_day_ago
            )
            recent_reports_count += len(reports)
    
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
    
    # Enrich with patient names
    enriched = []
    for alert in alerts:
        patient_id = alert.get("patient_id")
        if patient_id:
            patient = await FirestoreService.get_patient(patient_id)
            if patient:
                alert["patient_name"] = patient.get("name", "不明")
        enriched.append(alert)
    
    return {
        "alerts": enriched,
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

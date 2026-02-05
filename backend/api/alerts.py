"""
Alerts API - Alert management endpoints.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from services.firestore_service import FirestoreService

router = APIRouter()


@router.get("")
async def list_alerts(
    org_id: str = Query(..., description="Organization ID"),
    acknowledged: bool | None = Query(None, description="Filter by acknowledged status"),
    severity: str | None = Query(None, description="Filter by severity"),
    limit: int = Query(50, description="Maximum number of alerts"),
) -> dict[str, Any]:
    """
    List alerts for an organization.
    """
    # Get all alerts (cross-patient)
    alerts = await FirestoreService.list_alerts(
        org_id=org_id,
        acknowledged=acknowledged,
        severity=severity,
        limit=limit,
    )
    
    # Enrich with patient info
    enriched_alerts = []
    for alert in alerts:
        # Get patient name from the alert's patient reference
        patient_id = alert.get("patient_id")
        if patient_id:
            patient = await FirestoreService.get_patient(patient_id)
            if patient:
                alert["patient_name"] = patient.get("name", "不明")
        enriched_alerts.append(alert)
    
    return {
        "alerts": enriched_alerts,
        "total": len(enriched_alerts),
    }


@router.get("/{alert_id}")
async def get_alert(
    alert_id: str,
    patient_id: str = Query(..., description="Patient ID"),
) -> dict[str, Any]:
    """
    Get alert details.
    """
    # Get alerts for the patient and find the specific one
    alerts = await FirestoreService.list_alerts(patient_id=patient_id, limit=100)
    
    alert = None
    for a in alerts:
        if a.get("id") == alert_id:
            alert = a
            break
    
    if not alert:
        raise HTTPException(status_code=404, detail="アラートが見つかりません")
    
    # Get patient info
    patient = await FirestoreService.get_patient(patient_id)
    
    return {
        "alert": alert,
        "patient": patient,
    }


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    patient_id: str = Query(..., description="Patient ID"),
    acknowledged_by: str = Query(..., description="User ID who acknowledged"),
) -> dict[str, Any]:
    """
    Acknowledge an alert.
    """
    await FirestoreService.acknowledge_alert(
        patient_id=patient_id,
        alert_id=alert_id,
        acknowledged_by=acknowledged_by,
    )
    
    return {
        "success": True,
        "alert_id": alert_id,
    }


@router.get("/stats/summary")
async def get_alert_stats(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    Get alert statistics for dashboard.
    """
    # Get unacknowledged alerts
    unack_alerts = await FirestoreService.list_alerts(
        org_id=org_id,
        acknowledged=False,
        limit=100,
    )
    
    # Count by severity
    severity_counts = {"high": 0, "medium": 0, "low": 0}
    for alert in unack_alerts:
        severity = alert.get("severity", "medium")
        if severity in severity_counts:
            severity_counts[severity] += 1
    
    return {
        "total_unacknowledged": len(unack_alerts),
        "by_severity": severity_counts,
        "recent_alerts": unack_alerts[:5],
    }

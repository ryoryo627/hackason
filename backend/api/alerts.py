"""
Alerts API - Alert management endpoints.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from agents.base_agent import BaseAgent
from agents.alert_agent import AlertAgent
from agents.root_agent import RootAgent
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
    
    # Enrich with patient info (batch fetch to avoid N+1)
    patient_ids = list({a.get("patient_id") for a in alerts if a.get("patient_id")})
    patients_map = await FirestoreService.get_patients_batch(patient_ids)

    for alert in alerts:
        patient_id = alert.get("patient_id")
        if patient_id and patient_id in patients_map:
            alert["patient_name"] = patients_map[patient_id].get("name", "不明")
        # シードデータには title がない → pattern_name をフォールバック
        if not alert.get("title"):
            alert["title"] = alert.get("pattern_name", "アラート")

    return {
        "alerts": alerts,
        "total": len(alerts),
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

    # Recalculate risk level after acknowledgment
    from services.risk_service import RiskService
    await RiskService.recalculate(patient_id, trigger="alert_acknowledged")

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


@router.post("/scan/{patient_id}")
async def scan_patient_alerts(
    patient_id: str,
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    Run on-demand alert scan for a specific patient.
    """
    # Verify patient exists
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")

    # Initialize AlertAgent with org-specific prompts
    custom = await BaseAgent.get_agent_prompts(org_id)
    shared = custom.get("shared_prompt")
    agent_prompts = custom.get("agent_prompts", {})
    alert_agent = AlertAgent(
        system_prompt=agent_prompts.get("alert"), shared_prompt=shared
    )

    # Get latest report as new_report
    since = datetime.now(timezone.utc) - timedelta(days=7)
    reports = await FirestoreService.list_reports(patient_id, limit=1, since=since)
    new_report = reports[0] if reports else None

    result = await alert_agent.process(
        patient_id,
        new_report=new_report,
    )

    # Recalculate risk level after scan
    from services.risk_service import RiskService
    await RiskService.recalculate(patient_id, trigger="alert_scan")

    return {
        "success": result.get("success", False),
        "patient_id": patient_id,
        "patient_name": result.get("patient_name", patient.get("name", "不明")),
        "alerts": result.get("alerts", []),
        "error": result.get("error"),
    }


@router.post("/scan")
async def scan_all_alerts(
    org_id: str = Query(..., description="Organization ID"),
    lookback_days: int = Query(7, description="Days to look back for reports"),
) -> dict[str, Any]:
    """
    Run on-demand alert scan for all patients (manual morning scan).
    Does not require Cloud Scheduler.
    """
    root_agent = RootAgent()
    result = await root_agent.run_morning_scan(
        org_id, lookback_days=lookback_days
    )

    return {
        "success": result.get("success", False),
        "report": result.get("report", ""),
        "scan_results": result.get("scan_results", {}),
    }

"""
Patients API - Patient management with Slack channel integration.
"""

from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.firestore_service import FirestoreService
from services.slack_service import SlackService

router = APIRouter()


class PatientCreateRequest(BaseModel):
    """Request body for creating a new patient."""
    org_id: str = Field(..., description="Organization ID")
    name: str = Field(..., description="Patient name")
    name_kana: str | None = Field(None, description="Patient name in kana")
    birth_date: date | None = Field(None, description="Birth date")
    gender: str | None = Field(None, description="Gender")
    address: str | None = Field(None, description="Address")
    phone: str | None = Field(None, description="Phone number")
    primary_diagnosis: str | None = Field(None, description="Primary diagnosis")
    facility: str | None = Field(None, description="Facility ID")
    area: str | None = Field(None, description="Area ID")
    care_level: str | None = Field(None, description="Care level")
    team_member_ids: list[str] = Field(default_factory=list, description="Slack user IDs for team")
    create_slack_channel: bool = Field(True, description="Whether to create a Slack channel")


class PatientUpdateRequest(BaseModel):
    """Request body for updating a patient."""
    name: str | None = None
    name_kana: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    address: str | None = None
    phone: str | None = None
    primary_diagnosis: str | None = None
    facility: str | None = None
    area: str | None = None
    care_level: str | None = None
    status: str | None = None
    risk_level: str | None = None


class PatientResponse(BaseModel):
    """Response model for patient data."""
    id: str
    name: str
    name_kana: str | None = None
    birth_date: date | None = None
    gender: str | None = None
    address: str | None = None
    phone: str | None = None
    primary_diagnosis: str | None = None
    facility: str | None = None
    area: str | None = None
    care_level: str | None = None
    status: str = "active"
    risk_level: str = "low"
    slack_channel_id: str | None = None
    slack_channel_name: str | None = None
    anchor_message_ts: str | None = None
    org_id: str
    created_at: Any = None
    updated_at: Any = None


@router.get("")
async def list_patients(
    org_id: str = Query(..., description="Organization ID"),
    status: str = Query("active", description="Patient status filter"),
    risk_level: str | None = Query(None, description="Risk level filter"),
    facility: str | None = Query(None, description="Facility filter"),
    area: str | None = Query(None, description="Area filter"),
    limit: int = Query(100, description="Maximum number of patients"),
) -> dict[str, Any]:
    """
    List patients with optional filters.
    """
    patients = await FirestoreService.list_patients(
        org_id=org_id,
        status=status,
        risk_level=risk_level,
        facility=facility,
        area=area,
        limit=limit,
    )
    
    return {
        "patients": patients,
        "total": len(patients),
    }


@router.get("/{patient_id}")
async def get_patient(patient_id: str) -> dict[str, Any]:
    """
    Get patient details by ID.
    """
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")
    
    # Get recent reports
    reports = await FirestoreService.list_reports(patient_id, limit=10)
    
    # Get alerts
    alerts = await FirestoreService.list_alerts(patient_id=patient_id, limit=5)
    
    # Get context
    context = await FirestoreService.get_patient_context(patient_id)
    
    return {
        "patient": patient,
        "recent_reports": reports,
        "alerts": alerts,
        "context": context,
    }


@router.post("")
async def create_patient(request: PatientCreateRequest) -> dict[str, Any]:
    """
    Create a new patient with optional Slack channel.
    
    This endpoint:
    1. Creates the patient record in Firestore
    2. Creates a Slack channel (if requested)
    3. Posts the anchor message
    4. Invites team members to the channel
    """
    # Prepare patient data
    patient_data = {
        "org_id": request.org_id,
        "name": request.name,
        "name_kana": request.name_kana,
        "gender": request.gender,
        "address": request.address,
        "phone": request.phone,
        "primary_diagnosis": request.primary_diagnosis,
        "facility": request.facility,
        "area": request.area,
        "care_level": request.care_level,
        "risk_level": "low",
        "team_member_ids": request.team_member_ids,
    }
    
    if request.birth_date:
        patient_data["birth_date"] = request.birth_date.isoformat()
        # Calculate age
        today = date.today()
        age = today.year - request.birth_date.year
        if today.month < request.birth_date.month or (
            today.month == request.birth_date.month and today.day < request.birth_date.day
        ):
            age -= 1
        patient_data["age"] = age
    
    # Create patient in Firestore
    patient_id = await FirestoreService.create_patient(patient_data)
    
    slack_result = None
    
    # Create Slack channel if requested
    if request.create_slack_channel:
        # Get Slack config
        slack_config = await FirestoreService.get_service_config(request.org_id, "slack")
        
        if slack_config and slack_config.get("slack_configured"):
            # Create channel
            channel_result = await SlackService.create_channel(
                name=request.name,
                is_private=False,
            )
            
            if channel_result["success"]:
                channel_id = channel_result["channel"]["id"]
                channel_name = channel_result["channel"]["name"]
                
                # Post anchor message
                anchor_result = await SlackService.post_anchor_message(
                    channel_id=channel_id,
                    patient_name=request.name,
                    patient_info={
                        "age": patient_data.get("age"),
                        "primary_diagnosis": request.primary_diagnosis,
                        "area": request.area,
                    },
                )
                
                # Update patient with Slack info
                slack_update = {
                    "slack_channel_id": channel_id,
                    "slack_channel_name": channel_name,
                }
                
                if anchor_result["success"]:
                    slack_update["anchor_message_ts"] = anchor_result["message_ts"]
                
                await FirestoreService.update_patient(patient_id, slack_update)
                
                # Invite team members
                if request.team_member_ids:
                    await SlackService.invite_users_to_channel(
                        channel_id=channel_id,
                        user_ids=request.team_member_ids,
                    )
                
                slack_result = {
                    "channel_created": True,
                    "channel_id": channel_id,
                    "channel_name": channel_name,
                    "anchor_posted": anchor_result["success"],
                }
            else:
                slack_result = {
                    "channel_created": False,
                    "error": channel_result.get("error"),
                }
    
    return {
        "success": True,
        "patient_id": patient_id,
        "slack": slack_result,
    }


@router.put("/{patient_id}")
async def update_patient(patient_id: str, request: PatientUpdateRequest) -> dict[str, Any]:
    """
    Update patient information.
    """
    # Check if patient exists
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")
    
    # Build update data (only include non-None fields)
    update_data = {}
    for field, value in request.model_dump().items():
        if value is not None:
            if field == "birth_date":
                update_data[field] = value.isoformat()
                # Recalculate age
                today = date.today()
                age = today.year - value.year
                if today.month < value.month or (
                    today.month == value.month and today.day < value.day
                ):
                    age -= 1
                update_data["age"] = age
            else:
                update_data[field] = value
    
    if update_data:
        await FirestoreService.update_patient(patient_id, update_data)
    
    return {
        "success": True,
        "patient_id": patient_id,
        "updated_fields": list(update_data.keys()),
    }


@router.get("/{patient_id}/reports")
async def get_patient_reports(
    patient_id: str,
    limit: int = Query(50, description="Maximum number of reports"),
) -> dict[str, Any]:
    """
    Get reports for a patient.
    """
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")
    
    reports = await FirestoreService.list_reports(patient_id, limit=limit)
    
    return {
        "patient_id": patient_id,
        "reports": reports,
        "total": len(reports),
    }


@router.get("/{patient_id}/alerts")
async def get_patient_alerts(
    patient_id: str,
    acknowledged: bool | None = Query(None, description="Filter by acknowledged status"),
    limit: int = Query(20, description="Maximum number of alerts"),
) -> dict[str, Any]:
    """
    Get alerts for a patient.
    """
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")
    
    alerts = await FirestoreService.list_alerts(
        patient_id=patient_id,
        acknowledged=acknowledged,
        limit=limit,
    )
    
    return {
        "patient_id": patient_id,
        "alerts": alerts,
        "total": len(alerts),
    }


@router.post("/{patient_id}/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    patient_id: str,
    alert_id: str,
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


@router.get("/{patient_id}/context")
async def get_patient_context(patient_id: str) -> dict[str, Any]:
    """
    Get the current BPS context for a patient.
    """
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")
    
    context = await FirestoreService.get_patient_context(patient_id)
    
    return {
        "patient_id": patient_id,
        "context": context or {
            "bio": {},
            "psycho": {},
            "social": {},
        },
    }

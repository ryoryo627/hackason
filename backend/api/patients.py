"""
Patients API - Patient management with Slack channel integration.
"""

import asyncio
import logging
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from google.cloud import firestore
from pydantic import BaseModel, Field

from services.firestore_service import FirestoreService
from services.slack_service import SlackService
from services.storage_service import StorageService

logger = logging.getLogger(__name__)

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
    # 在宅5つの呪文
    medical_procedures: list[str] | None = Field(None, description="医療処置 (HOT, CV管理等)")
    residence_type: str | None = Field(None, description="居住場所 (自宅(独居), グループホーム等)")
    insurance_type: str | None = Field(None, description="保険種別 (後期高齢者1割等)")
    adl_description: str | None = Field(None, description="ADL概要")
    special_disease_flag: str | None = Field(None, description="特定疾患 (別表7, 別表8)")
    # 紹介元・経緯
    referral_source: dict | None = Field(None, description="紹介元医療機関情報")
    clinical_background: str | None = Field(None, description="訪問診療開始までの経緯")
    key_person: dict | None = Field(None, description="キーパーソン情報")


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
    # 在宅5つの呪文
    medical_procedures: list[str] | None = None
    residence_type: str | None = None
    insurance_type: str | None = None
    adl_description: str | None = None
    special_disease_flag: str | None = None
    # 紹介元・経緯
    referral_source: dict | None = None
    clinical_background: str | None = None
    key_person: dict | None = None


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
    # 在宅5つの呪文
    medical_procedures: list[str] | None = None
    residence_type: str | None = None
    insurance_type: str | None = None
    adl_description: str | None = None
    special_disease_flag: str | None = None
    # 紹介元・経緯
    referral_source: dict | None = None
    clinical_background: str | None = None
    key_person: dict | None = None


class BulkPatientItem(BaseModel):
    """A single patient entry for bulk import."""
    name: str = Field(..., description="Patient name (required)")
    name_kana: str | None = Field(None, description="Patient name in kana")
    birth_date: str | None = Field(None, description="Birth date (YYYY-MM-DD string)")
    gender: str | None = Field(None, description="Gender")
    address: str | None = Field(None, description="Address")
    phone: str | None = Field(None, description="Phone number")
    primary_diagnosis: str | None = Field(None, description="Primary diagnosis")
    facility: str | None = Field(None, description="Facility")
    area: str | None = Field(None, description="Area")
    care_level: str | None = Field(None, description="Care level")


class BulkPatientCreateRequest(BaseModel):
    """Request body for bulk patient creation."""
    org_id: str = Field(..., description="Organization ID")
    patients: list[BulkPatientItem] = Field(..., description="List of patients to create")
    create_slack_channels: bool = Field(False, description="Whether to create Slack channels")


class BulkAssignMembersRequest(BaseModel):
    """Request body for bulk team member assignment."""
    org_id: str = Field(..., description="Organization ID")
    patient_ids: list[str] = Field(..., description="Patient IDs to assign members to")
    user_ids: list[str] = Field(..., description="Slack user IDs to assign")


# Module-level dict to track bulk assign task progress
_bulk_assign_tasks: dict[str, dict[str, Any]] = {}


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


@router.get("/bulk-assign-members/{task_id}")
async def get_bulk_assign_progress(task_id: str) -> dict[str, Any]:
    """Get progress of a bulk member assignment task."""
    task = _bulk_assign_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="タスクが見つかりません")
    return task


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

    # Get recent risk history (latest 5)
    risk_history = await FirestoreService.list_risk_history(patient_id, limit=5)

    return {
        "patient": patient,
        "recent_reports": reports,
        "alerts": alerts,
        "context": context,
        "risk_history": risk_history,
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
        "risk_level_source": "auto",
        "team_member_ids": request.team_member_ids,
        "medical_procedures": request.medical_procedures,
        "residence_type": request.residence_type,
        "insurance_type": request.insurance_type,
        "adl_description": request.adl_description,
        "special_disease_flag": request.special_disease_flag,
        "referral_source": request.referral_source,
        "clinical_background": request.clinical_background,
        "key_person": request.key_person,
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
            slack_bot_token = slack_config.get("slack_bot_token")

            # Create channel
            channel_result = await SlackService.create_channel(
                name=request.name,
                token=slack_bot_token,
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
                    token=slack_bot_token,
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
                        token=slack_bot_token,
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


@router.post("/bulk")
async def bulk_create_patients(request: BulkPatientCreateRequest) -> dict[str, Any]:
    """
    Bulk create patients from CSV import.

    Phase 1: Create all patient records in Firestore (fast, no rate limit).
    Phase 2: If requested, create Slack channels in the background with
             3-second delays between each to respect Tier 2 rate limits (~20 req/min).
    """
    if not request.patients:
        raise HTTPException(status_code=400, detail="患者データが空です")

    created_ids: list[str] = []
    errors: list[dict[str, Any]] = []

    # Phase 1: Batch create patients in Firestore
    for idx, patient in enumerate(request.patients):
        try:
            patient_data: dict[str, Any] = {
                "org_id": request.org_id,
                "name": patient.name,
                "name_kana": patient.name_kana,
                "gender": patient.gender,
                "address": patient.address,
                "phone": patient.phone,
                "primary_diagnosis": patient.primary_diagnosis,
                "facility": patient.facility,
                "area": patient.area,
                "care_level": patient.care_level,
                "risk_level": "low",
                "risk_level_source": "auto",
                "team_member_ids": [],
            }

            if patient.birth_date and patient.birth_date.strip():
                try:
                    parsed_date = date.fromisoformat(
                        patient.birth_date.strip().replace("/", "-")
                    )
                    patient_data["birth_date"] = parsed_date.isoformat()
                    today = date.today()
                    age = today.year - parsed_date.year
                    if today.month < parsed_date.month or (
                        today.month == parsed_date.month
                        and today.day < parsed_date.day
                    ):
                        age -= 1
                    patient_data["age"] = age
                except ValueError:
                    logger.warning(
                        f"Invalid birth_date at index {idx}: {patient.birth_date!r}, skipping"
                    )

            patient_id = await FirestoreService.create_patient(patient_data)
            created_ids.append(patient_id)
        except Exception as e:
            logger.error(f"Failed to create patient at index {idx}: {e}")
            errors.append({"index": idx, "name": patient.name, "error": str(e)})

    # Phase 2: Background Slack channel creation
    slack_status = "skipped"
    if request.create_slack_channels and created_ids:
        slack_config = await FirestoreService.get_service_config(request.org_id, "slack")
        if slack_config and slack_config.get("slack_configured"):
            slack_status = "processing"
            asyncio.ensure_future(
                _create_slack_channels_background(
                    org_id=request.org_id,
                    patient_ids=created_ids,
                    patients=[p for i, p in enumerate(request.patients) if i not in {e["index"] for e in errors}],
                    slack_bot_token=slack_config.get("slack_bot_token"),
                )
            )
        else:
            slack_status = "not_configured"

    return {
        "success": True,
        "total": len(request.patients),
        "created": len(created_ids),
        "patient_ids": created_ids,
        "errors": errors,
        "slack_status": slack_status,
    }


async def _create_slack_channels_background(
    org_id: str,
    patient_ids: list[str],
    patients: list[BulkPatientItem],
    slack_bot_token: str | None,
) -> None:
    """
    Background task: create Slack channels for bulk-imported patients.
    Inserts 3-second delays between each channel creation to comply with
    Slack's Tier 2 rate limit (~20 requests/minute).
    """
    for idx, (patient_id, patient) in enumerate(zip(patient_ids, patients)):
        try:
            if idx > 0:
                await asyncio.sleep(3)

            # Create channel
            channel_result = await SlackService.create_channel(
                name=patient.name,
                token=slack_bot_token,
                is_private=False,
            )

            if channel_result["success"]:
                channel_id = channel_result["channel"]["id"]
                channel_name = channel_result["channel"]["name"]

                # Post anchor message
                anchor_result = await SlackService.post_anchor_message(
                    channel_id=channel_id,
                    patient_name=patient.name,
                    patient_info={
                        "age": None,
                        "primary_diagnosis": patient.primary_diagnosis,
                        "area": patient.area,
                    },
                    token=slack_bot_token,
                )

                # Update patient record with Slack info
                slack_update: dict[str, Any] = {
                    "slack_channel_id": channel_id,
                    "slack_channel_name": channel_name,
                }
                if anchor_result["success"]:
                    slack_update["anchor_message_ts"] = anchor_result["message_ts"]

                await FirestoreService.update_patient(patient_id, slack_update)
                logger.info(
                    f"[BulkImport] Slack channel created for patient {patient_id}: #{channel_name}"
                )
            else:
                logger.warning(
                    f"[BulkImport] Failed to create Slack channel for {patient_id}: "
                    f"{channel_result.get('error')}"
                )
        except Exception as e:
            logger.error(
                f"[BulkImport] Error creating Slack channel for {patient_id}: {e}"
            )


@router.post("/bulk-assign-members")
async def bulk_assign_members(request: BulkAssignMembersRequest) -> dict[str, Any]:
    """
    Bulk assign team members to patients' Slack channels.

    Validates Slack config, then processes each patient in the background
    with 3-second delays between invitations (Tier 2 rate limit).
    Returns a task_id for progress polling.
    """
    if not request.patient_ids:
        raise HTTPException(status_code=400, detail="患者IDが指定されていません")
    if not request.user_ids:
        raise HTTPException(status_code=400, detail="メンバーが指定されていません")

    # Verify Slack config
    slack_config = await FirestoreService.get_service_config(request.org_id, "slack")
    if not slack_config or not slack_config.get("slack_configured"):
        raise HTTPException(status_code=400, detail="Slack設定が完了していません")

    slack_bot_token = slack_config.get("slack_bot_token")
    if not slack_bot_token:
        raise HTTPException(status_code=400, detail="Slack Bot Tokenが設定されていません")

    task_id = f"ba-{uuid.uuid4().hex[:12]}"
    _bulk_assign_tasks[task_id] = {
        "task_id": task_id,
        "status": "processing",
        "total": len(request.patient_ids),
        "completed": 0,
        "results": [],
    }

    asyncio.ensure_future(
        _bulk_assign_members_background(
            task_id=task_id,
            org_id=request.org_id,
            patient_ids=request.patient_ids,
            user_ids=request.user_ids,
            slack_bot_token=slack_bot_token,
        )
    )

    return {
        "success": True,
        "task_id": task_id,
        "total_patients": len(request.patient_ids),
        "status": "processing",
    }


async def _bulk_assign_members_background(
    task_id: str,
    org_id: str,
    patient_ids: list[str],
    user_ids: list[str],
    slack_bot_token: str,
) -> None:
    """
    Background task: assign team members to patients' Slack channels.

    For each patient:
    1. Fetch patient from Firestore
    2. Check for slack_channel_id
    3. Invite users via invite_users_to_channel_safe
    4. Merge team_member_ids via ArrayUnion
    5. Record result
    """
    task = _bulk_assign_tasks[task_id]

    for idx, patient_id in enumerate(patient_ids):
        try:
            if idx > 0:
                await asyncio.sleep(3)

            patient = await FirestoreService.get_patient(patient_id)
            if not patient:
                task["results"].append({
                    "patient_id": patient_id,
                    "patient_name": "不明",
                    "success": False,
                    "error": "患者が見つかりません",
                })
                task["completed"] += 1
                continue

            patient_name = patient.get("name", "不明")
            channel_id = patient.get("slack_channel_id")

            if not channel_id:
                task["results"].append({
                    "patient_id": patient_id,
                    "patient_name": patient_name,
                    "success": False,
                    "error": "Slackチャンネル未作成",
                })
                task["completed"] += 1
                continue

            # Invite users to Slack channel
            invite_result = await SlackService.invite_users_to_channel_safe(
                channel_id=channel_id,
                user_ids=user_ids,
                token=slack_bot_token,
            )

            # Update Firestore team_member_ids with ArrayUnion (dedup)
            db = FirestoreService.get_client()
            db.collection("patients").document(patient_id).update({
                "team_member_ids": firestore.ArrayUnion(user_ids),
            })

            task["results"].append({
                "patient_id": patient_id,
                "patient_name": patient_name,
                "success": invite_result.get("success", False),
                "invited": invite_result.get("invited", 0),
                "note": invite_result.get("note"),
                "error": invite_result.get("error"),
            })
            task["completed"] += 1

            logger.info(
                f"[BulkAssign] Patient {patient_id} ({patient_name}): "
                f"invited={invite_result.get('invited', 0)}, "
                f"note={invite_result.get('note')}"
            )
        except Exception as e:
            logger.error(f"[BulkAssign] Error for patient {patient_id}: {e}")
            task["results"].append({
                "patient_id": patient_id,
                "patient_name": "不明",
                "success": False,
                "error": str(e),
            })
            task["completed"] += 1

    task["status"] = "completed"
    logger.info(f"[BulkAssign] Task {task_id} completed: {task['completed']}/{task['total']}")


@router.put("/{patient_id}")
async def update_patient(patient_id: str, request: PatientUpdateRequest) -> dict[str, Any]:
    """
    Update patient information with Slack channel synchronization.
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

    # Handle manual risk_level change
    if "risk_level" in update_data and update_data["risk_level"] != patient.get("risk_level"):
        previous_level = patient.get("risk_level", "low")
        update_data["risk_level_source"] = "manual"
        update_data["risk_level_reason"] = "手動変更"
        update_data["risk_level_updated_at"] = datetime.now().isoformat()

    if update_data:
        await FirestoreService.update_patient(patient_id, update_data)

    # Record manual risk change in history
    if "risk_level" in update_data and update_data.get("risk_level_source") == "manual":
        from services.risk_service import RiskService
        await RiskService.record_manual_change(
            patient_id=patient_id,
            new_level=update_data["risk_level"],
            changed_by="user",
            previous_level=patient.get("risk_level", "low"),
        )

    # Slack synchronization
    slack_sync = {}
    org_id = patient.get("org_id")
    channel_id = patient.get("slack_channel_id")

    if org_id and channel_id:
        slack_config = await FirestoreService.get_service_config(org_id, "slack")
        if slack_config and slack_config.get("slack_bot_token"):
            token = slack_config["slack_bot_token"]

            # Rename channel if patient name changed
            if "name" in update_data and update_data["name"] != patient.get("name"):
                rename_result = await SlackService.rename_channel(
                    channel_id=channel_id,
                    new_name=update_data["name"],
                    token=token,
                )
                slack_sync["channel_renamed"] = rename_result.get("success", False)
                if rename_result.get("success") and rename_result.get("channel_name"):
                    await FirestoreService.update_patient(
                        patient_id, {"slack_channel_name": rename_result["channel_name"]}
                    )
                if not rename_result.get("success"):
                    slack_sync["rename_error"] = rename_result.get("error")

            # Update anchor message if relevant fields changed
            anchor_fields = {"name", "birth_date", "primary_diagnosis", "area"}
            if anchor_fields & set(update_data.keys()):
                anchor_ts = patient.get("anchor_message_ts")
                if anchor_ts:
                    merged = {**patient, **update_data}
                    anchor_result = await SlackService.update_anchor_message(
                        channel_id=channel_id,
                        message_ts=anchor_ts,
                        patient_name=merged.get("name", ""),
                        patient_info={
                            "age": merged.get("age"),
                            "primary_diagnosis": merged.get("primary_diagnosis"),
                            "area": merged.get("area"),
                        },
                        token=token,
                    )
                    slack_sync["anchor_updated"] = anchor_result.get("success", False)
                    if not anchor_result.get("success"):
                        slack_sync["anchor_error"] = anchor_result.get("error")

    return {
        "success": True,
        "patient_id": patient_id,
        "updated_fields": list(update_data.keys()),
        "slack_sync": slack_sync if slack_sync else None,
    }


@router.delete("/{patient_id}")
async def delete_patient(patient_id: str) -> dict[str, Any]:
    """
    Archive a patient and their Slack channel.

    This is a soft delete — the patient status is set to 'archived'
    and the Slack channel is archived. Data is preserved for history.
    """
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")

    if patient.get("status") == "archived":
        raise HTTPException(status_code=400, detail="この患者は既にアーカイブ済みです")

    # Slack channel archival
    slack_result: dict[str, Any] = {}
    org_id = patient.get("org_id")
    channel_id = patient.get("slack_channel_id")

    if org_id and channel_id:
        slack_config = await FirestoreService.get_service_config(org_id, "slack")
        if slack_config and slack_config.get("slack_bot_token"):
            token = slack_config["slack_bot_token"]

            # Post notification before archiving
            try:
                client = SlackService.get_client(token)
                client.chat_postMessage(
                    channel=channel_id,
                    text=f"📦 このチャンネルは患者「{patient.get('name', '')}」のアーカイブに伴い、まもなくアーカイブされます。",
                )
            except Exception:
                pass  # Don't fail if notification can't be posted

            archive_result = await SlackService.archive_channel(
                channel_id=channel_id,
                token=token,
            )
            slack_result["channel_archived"] = archive_result.get("success", False)
            if not archive_result.get("success"):
                slack_result["error"] = archive_result.get("error")

    # Archive patient in Firestore
    await FirestoreService.archive_patient(patient_id)

    return {
        "success": True,
        "patient_id": patient_id,
        "slack": slack_result if slack_result else None,
    }


@router.get("/{patient_id}/risk-history")
async def get_risk_history(
    patient_id: str,
    limit: int = Query(20, description="Maximum number of history entries"),
) -> dict[str, Any]:
    """
    Get risk level change history for a patient.
    """
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")

    history = await FirestoreService.list_risk_history(patient_id, limit=limit)

    return {
        "patient_id": patient_id,
        "current_risk_level": patient.get("risk_level", "low"),
        "risk_level_source": patient.get("risk_level_source", "manual"),
        "history": history,
    }


@router.get("/{patient_id}/reports")
async def get_patient_reports(
    patient_id: str,
    acknowledged: bool | None = Query(None, description="Filter by acknowledged status"),
    limit: int = Query(50, description="Maximum number of reports"),
) -> dict[str, Any]:
    """
    Get reports for a patient.
    """
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")

    reports = await FirestoreService.list_reports(
        patient_id, limit=limit, acknowledged=acknowledged
    )

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

    # Recalculate risk level after acknowledgment
    from services.risk_service import RiskService
    await RiskService.recalculate(patient_id, trigger="alert_acknowledged")

    return {
        "success": True,
        "alert_id": alert_id,
    }


@router.post("/{patient_id}/reports/{report_id}/acknowledge")
async def acknowledge_report(
    patient_id: str,
    report_id: str,
    acknowledged_by: str = Query(..., description="User ID who acknowledged"),
) -> dict[str, Any]:
    """
    Acknowledge a report and add checkmark reaction on Slack.
    """
    # Mark as acknowledged in Firestore
    await FirestoreService.acknowledge_report(
        patient_id=patient_id,
        report_id=report_id,
        acknowledged_by=acknowledged_by,
    )

    # Add checkmark reaction on Slack
    try:
        patient = await FirestoreService.get_patient(patient_id)
        if patient and patient.get("slack_channel_id"):
            # Get report to find its slack_message_ts
            db = FirestoreService.get_client()
            report_doc = (
                db.collection("patients")
                .document(patient_id)
                .collection("reports")
                .document(report_id)
                .get()
            )
            if report_doc.exists:
                report_data = report_doc.to_dict()
                message_ts = report_data.get("slack_message_ts")
                if message_ts:
                    # Get Slack token from service config
                    org_id = patient.get("org_id")
                    if org_id:
                        slack_config = await FirestoreService.get_service_config(
                            org_id, "slack"
                        )
                        if slack_config and slack_config.get("slack_bot_token"):
                            client = SlackService.get_client(
                                slack_config["slack_bot_token"]
                            )
                            client.reactions_add(
                                channel=patient["slack_channel_id"],
                                name="white_check_mark",
                                timestamp=message_ts,
                            )
    except Exception as e:
        # Don't fail the acknowledge if Slack reaction fails
        print(f"Failed to add Slack reaction: {e}")

    return {
        "success": True,
        "report_id": report_id,
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


@router.get("/{patient_id}/files")
async def list_patient_files(
    patient_id: str,
    limit: int = Query(20, description="Maximum number of files"),
) -> dict[str, Any]:
    """
    List attached files for a patient (Slack uploads stored in GCS).
    """
    patient = await FirestoreService.get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="患者が見つかりません")

    files = await FirestoreService.list_raw_files(patient_id, limit=limit)
    return {
        "patient_id": patient_id,
        "files": files,
        "total": len(files),
    }


@router.get("/{patient_id}/files/{file_id}/url")
async def get_patient_file_url(
    patient_id: str,
    file_id: str,
) -> dict[str, Any]:
    """
    Get a signed download URL for a patient's attached file.
    """
    db = FirestoreService.get_client()
    doc = (
        db.collection("patients")
        .document(patient_id)
        .collection("raw_files")
        .document(file_id)
        .get()
    )

    if not doc.exists:
        raise HTTPException(status_code=404, detail="ファイルが見つかりません")

    data = doc.to_dict()
    gcs_uri = data.get("gcs_uri")
    if not gcs_uri:
        raise HTTPException(status_code=404, detail="ファイルが保存されていません")

    signed_url = await StorageService.generate_signed_url(gcs_uri)
    return {
        "url": signed_url,
        "file_name": data.get("original_name", ""),
        "file_type": data.get("file_type", ""),
    }

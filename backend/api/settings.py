"""
Settings API - Service configuration management.
"""

import re
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.firestore_service import FirestoreService
from services.slack_service import SlackService
from agents.base_agent import DEFAULT_AGENT_PROMPTS, SHARED_SYSTEM_PROMPT

router = APIRouter()


class GeminiConfigRequest(BaseModel):
    """Request body for Gemini configuration."""
    org_id: str = Field(..., description="Organization ID")
    api_key: str = Field(..., description="Gemini API Key")
    model: str = Field("gemini-3-flash-preview", description="Model to use")


class VertexConfigRequest(BaseModel):
    """Request body for Vertex AI configuration."""
    org_id: str = Field(..., description="Organization ID")
    project_id: str = Field(..., description="GCP Project ID")
    region: str = Field("asia-northeast1", description="Region")
    embedding_model: str = Field("text-embedding-005", description="Embedding model")


class SlackConfigResponse(BaseModel):
    """Response model for Slack configuration."""
    configured: bool
    team_id: str | None = None
    team_name: str | None = None
    bot_id: str | None = None
    default_channel: str | None = None
    oncall_channel_name: str | None = None
    morning_scan_time: str | None = None


class GeminiConfigResponse(BaseModel):
    """Response model for Gemini configuration."""
    configured: bool
    model: str | None = None
    has_api_key: bool = False


class VertexConfigResponse(BaseModel):
    """Response model for Vertex AI configuration."""
    configured: bool
    project_id: str | None = None
    region: str | None = None
    embedding_model: str | None = None


@router.get("/slack")
async def get_slack_config(
    org_id: str = Query(..., description="Organization ID"),
) -> SlackConfigResponse:
    """
    Get Slack configuration status.
    
    Note: Does not return sensitive tokens.
    """
    config = await FirestoreService.get_service_config(org_id, "slack")
    
    if not config:
        return SlackConfigResponse(configured=False)
    
    return SlackConfigResponse(
        configured=config.get("slack_configured", False),
        team_id=config.get("slack_team_id"),
        team_name=config.get("slack_team_name"),
        bot_id=config.get("slack_bot_id"),
        default_channel=config.get("default_channel"),
        oncall_channel_name=config.get("oncall_channel_name"),
        morning_scan_time=config.get("morning_scan_time", "08:00"),
    )


class CreateOncallChannelRequest(BaseModel):
    """Request body for oncall channel creation."""
    org_id: str = Field(..., description="Organization ID")


@router.post("/slack/oncall-channel")
async def create_oncall_channel(request: CreateOncallChannelRequest) -> dict[str, Any]:
    """
    Create the #oncall-night Slack channel.
    """
    print(f"[Settings] Creating oncall channel for org: {request.org_id}")

    # Get Slack token from service_configs
    config = await FirestoreService.get_service_config(request.org_id, "slack")
    if not config:
        print(f"[Settings] No Slack config found for org: {request.org_id}")
        raise HTTPException(
            status_code=400,
            detail="Slack設定が見つかりません。先にSlack連携を完了してください。",
        )

    if not config.get("slack_bot_token"):
        print(f"[Settings] No Slack bot token in config for org: {request.org_id}")
        raise HTTPException(
            status_code=400,
            detail="Slack Bot Tokenが設定されていません。先にSlack連携を完了してください。",
        )

    token = config["slack_bot_token"]

    # Create channel via SlackService
    try:
        result = await SlackService.create_raw_channel("oncall-night", token)
    except Exception as e:
        print(f"[Settings] Unexpected error calling create_raw_channel: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"チャンネル作成中にエラーが発生しました: {str(e)}",
        )

    if not result["success"]:
        print(f"[Settings] Channel creation failed: {result['error']}")
        raise HTTPException(status_code=400, detail=result["error"])

    channel = result["channel"]
    print(f"[Settings] Channel created/found: {channel['id']} ({channel['name']})")

    # Save channel ID and name to service_configs
    try:
        await FirestoreService.update_service_config(
            request.org_id,
            "slack",
            {
                "default_channel": channel["id"],
                "oncall_channel_name": channel["name"],
            },
        )
    except Exception as e:
        print(f"[Settings] Failed to save channel config to Firestore: {e}")
        # Channel was created in Slack but config save failed
        # Return success with a warning so the user knows the channel exists
        return {
            "success": True,
            "channel_id": channel["id"],
            "channel_name": channel["name"],
            "warning": "チャンネルは作成されましたが、設定の保存に失敗しました。ページを再読み込みしてください。",
        }

    return {
        "success": True,
        "channel_id": channel["id"],
        "channel_name": channel["name"],
    }


class AlertScheduleRequest(BaseModel):
    """Request body for alert scan schedule update."""
    org_id: str = Field(..., description="Organization ID")
    alert_scan_times: list[str] = Field(..., description="List of HH:MM format time strings")


@router.get("/alert-schedule")
async def get_alert_schedule(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """Get alert scan schedule times."""
    config = await FirestoreService.get_service_config(org_id, "slack")
    times = config.get("alert_scan_times", ["08:00"]) if config else ["08:00"]
    return {"alert_scan_times": times}


@router.put("/alert-schedule")
async def update_alert_schedule(request: AlertScheduleRequest) -> dict[str, Any]:
    """Update alert scan schedule times."""
    if not request.alert_scan_times:
        raise HTTPException(status_code=400, detail="少なくとも1つの時刻を指定してください。")

    for t in request.alert_scan_times:
        if not re.match(r"^\d{2}:\d{2}$", t):
            raise HTTPException(status_code=400, detail=f"時刻はHH:MM形式で指定してください: {t}")
        hours, minutes = map(int, t.split(":"))
        if not (0 <= hours <= 23 and 0 <= minutes <= 59):
            raise HTTPException(status_code=400, detail=f"時刻の範囲が不正です: {t}")

    # Deduplicate and sort
    unique_times = sorted(set(request.alert_scan_times))

    await FirestoreService.update_service_config(
        request.org_id,
        "slack",
        {"alert_scan_times": unique_times},
    )

    return {
        "success": True,
        "alert_scan_times": unique_times,
    }


class MorningScanTimeRequest(BaseModel):
    """Request body for morning scan time update."""
    org_id: str = Field(..., description="Organization ID")
    time: str = Field(..., description="HH:MM format time string")


@router.put("/slack/morning-scan-time")
async def update_morning_scan_time(request: MorningScanTimeRequest) -> dict[str, Any]:
    """
    Update the morning scan report delivery time.
    """
    # Validate HH:MM format
    if not re.match(r"^\d{2}:\d{2}$", request.time):
        raise HTTPException(status_code=400, detail="時刻はHH:MM形式で指定してください。")

    hours, minutes = map(int, request.time.split(":"))
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        raise HTTPException(status_code=400, detail="時刻の範囲が不正です。")

    await FirestoreService.update_service_config(
        request.org_id,
        "slack",
        {"morning_scan_time": request.time},
    )

    return {
        "success": True,
        "morning_scan_time": request.time,
    }


@router.get("/gemini")
async def get_gemini_config(
    org_id: str = Query(..., description="Organization ID"),
) -> GeminiConfigResponse:
    """
    Get Gemini configuration status.

    Note: Does not return the API key.
    """
    config = await FirestoreService.get_service_config(org_id, "gemini")

    if not config:
        return GeminiConfigResponse(configured=False)

    return GeminiConfigResponse(
        configured=config.get("configured", False),
        model=config.get("model"),
        has_api_key=bool(config.get("gemini_api_key")),
    )


@router.post("/gemini")
async def configure_gemini(request: GeminiConfigRequest) -> dict[str, Any]:
    """
    Configure Gemini API settings.
    """
    # Store configuration with API key
    config_data = {
        "configured": True,
        "model": request.model,
        "gemini_api_key": request.api_key,
    }

    await FirestoreService.update_service_config(
        request.org_id,
        "gemini",
        config_data,
    )

    # Update organization status
    await FirestoreService.update_organization(
        request.org_id,
        {"gemini_configured": True},
    )

    return {
        "success": True,
        "model": request.model,
    }


@router.get("/vertex")
async def get_vertex_config(
    org_id: str = Query(..., description="Organization ID"),
) -> VertexConfigResponse:
    """
    Get Vertex AI configuration status.
    """
    config = await FirestoreService.get_service_config(org_id, "vertex")
    
    if not config:
        return VertexConfigResponse(configured=False)
    
    return VertexConfigResponse(
        configured=config.get("configured", False),
        project_id=config.get("project_id"),
        region=config.get("region"),
        embedding_model=config.get("embedding_model"),
    )


@router.post("/vertex")
async def configure_vertex(request: VertexConfigRequest) -> dict[str, Any]:
    """
    Configure Vertex AI settings.
    """
    config_data = {
        "configured": True,
        "project_id": request.project_id,
        "region": request.region,
        "embedding_model": request.embedding_model,
    }
    
    await FirestoreService.update_service_config(
        request.org_id,
        "vertex",
        config_data,
    )
    
    # Update organization status
    await FirestoreService.update_organization(
        request.org_id,
        {"vertex_configured": True},
    )
    
    return {
        "success": True,
        "project_id": request.project_id,
        "region": request.region,
    }


@router.get("/organization")
async def get_organization_settings(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    Get organization settings.
    """
    org = await FirestoreService.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    
    return {
        "id": org_id,
        "name": org.get("name", ""),
        "admin_email": org.get("admin_email", ""),
        "status": org.get("status", "setup"),
        "slack_configured": org.get("slack_configured", False),
        "gemini_configured": org.get("gemini_configured", False),
        "vertex_configured": org.get("vertex_configured", False),
    }


@router.put("/organization")
async def update_organization_settings(
    org_id: str = Query(..., description="Organization ID"),
    name: str | None = None,
    admin_email: str | None = None,
) -> dict[str, Any]:
    """
    Update organization settings.
    """
    org = await FirestoreService.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    
    update_data = {}
    if name is not None:
        update_data["name"] = name
    if admin_email is not None:
        update_data["admin_email"] = admin_email
    
    if update_data:
        await FirestoreService.update_organization(org_id, update_data)
    
    return {
        "success": True,
        "updated_fields": list(update_data.keys()),
    }


@router.get("/master/facilities")
async def list_facilities(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    List facilities for an organization.
    """
    facilities = await FirestoreService.list_facilities(org_id)
    return {
        "facilities": facilities,
        "total": len(facilities),
    }


@router.post("/master/facilities")
async def create_facility(
    org_id: str = Query(..., description="Organization ID"),
    name: str = Query(..., description="Facility name"),
    address: str | None = Query(None, description="Facility address"),
    phone: str | None = Query(None, description="Facility phone"),
) -> dict[str, Any]:
    """
    Create a new facility.
    """
    facility_data = {
        "name": name,
        "address": address,
        "phone": phone,
    }

    facility_id = await FirestoreService.create_facility(org_id, facility_data)

    return {
        "success": True,
        "facility_id": facility_id,
    }


@router.delete("/master/facilities/{facility_id}")
async def delete_facility(
    facility_id: str,
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    Delete a facility.
    """
    await FirestoreService.delete_facility(org_id, facility_id)

    return {
        "success": True,
    }


@router.get("/master/areas")
async def list_areas(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    List areas for an organization.
    """
    areas = await FirestoreService.list_areas(org_id)
    return {
        "areas": areas,
        "total": len(areas),
    }


@router.post("/master/areas")
async def create_area(
    org_id: str = Query(..., description="Organization ID"),
    name: str = Query(..., description="Area name"),
    code: str | None = Query(None, description="Area code"),
) -> dict[str, Any]:
    """
    Create a new area.
    """
    area_data = {
        "name": name,
        "code": code,
    }

    area_id = await FirestoreService.create_area(org_id, area_data)

    return {
        "success": True,
        "area_id": area_id,
    }


@router.delete("/master/areas/{area_id}")
async def delete_area(
    area_id: str,
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    Delete an area.
    """
    await FirestoreService.delete_area(org_id, area_id)

    return {
        "success": True,
    }


# === Agent Prompt Settings ===


class AgentPromptsRequest(BaseModel):
    """Request body for agent prompts configuration."""
    org_id: str = Field(..., description="Organization ID")
    shared_prompt: str | None = Field(None, description="Custom shared prompt")
    agent_prompts: dict[str, str] = Field(default_factory=dict, description="Per-agent prompts")


@router.get("/agents")
async def get_agent_prompts(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    Get agent prompt configuration.

    Returns custom prompts if set, otherwise defaults.
    Includes is_customized flag to indicate if any customization exists.
    """
    config = await FirestoreService.get_service_config(org_id, "agent_prompts")

    if config:
        return {
            "shared_prompt": config.get("shared_prompt", SHARED_SYSTEM_PROMPT),
            "agent_prompts": {
                agent_id: config.get("agent_prompts", {}).get(agent_id, default_prompt)
                for agent_id, default_prompt in DEFAULT_AGENT_PROMPTS.items()
            },
            "is_customized": True,
        }

    return {
        "shared_prompt": SHARED_SYSTEM_PROMPT,
        "agent_prompts": dict(DEFAULT_AGENT_PROMPTS),
        "is_customized": False,
    }


@router.put("/agents")
async def update_agent_prompts(request: AgentPromptsRequest) -> dict[str, Any]:
    """
    Update agent prompt configuration.

    Saves custom shared_prompt and/or per-agent prompts.
    Empty strings are rejected.
    """
    # Validate non-empty
    if request.shared_prompt is not None and request.shared_prompt.strip() == "":
        raise HTTPException(status_code=400, detail="共通プロンプトは空にできません")

    for agent_id, prompt in request.agent_prompts.items():
        if agent_id not in DEFAULT_AGENT_PROMPTS:
            raise HTTPException(status_code=400, detail=f"不明なエージェント: {agent_id}")
        if prompt.strip() == "":
            raise HTTPException(status_code=400, detail=f"{agent_id}のプロンプトは空にできません")

    config_data: dict[str, Any] = {}

    if request.shared_prompt is not None:
        config_data["shared_prompt"] = request.shared_prompt

    if request.agent_prompts:
        # Merge with existing agent_prompts
        existing = await FirestoreService.get_service_config(request.org_id, "agent_prompts")
        existing_prompts = existing.get("agent_prompts", {}) if existing else {}
        existing_prompts.update(request.agent_prompts)
        config_data["agent_prompts"] = existing_prompts

    await FirestoreService.update_service_config(
        request.org_id, "agent_prompts", config_data
    )

    return {"success": True}


@router.delete("/agents")
async def reset_agent_prompt(
    org_id: str = Query(..., description="Organization ID"),
    agent_id: str | None = Query(None, description="Agent ID to reset (omit for full reset)"),
) -> dict[str, Any]:
    """
    Reset agent prompt to default.

    If agent_id is specified, only that agent's prompt is reset.
    If omitted, all customizations (shared + all agents) are removed.
    """
    if agent_id and agent_id not in DEFAULT_AGENT_PROMPTS:
        raise HTTPException(status_code=400, detail=f"不明なエージェント: {agent_id}")

    if agent_id:
        # Reset single agent prompt
        config = await FirestoreService.get_service_config(org_id, "agent_prompts")
        if config:
            agent_prompts = config.get("agent_prompts", {})
            agent_prompts.pop(agent_id, None)
            await FirestoreService.update_service_config(
                org_id, "agent_prompts", {"agent_prompts": agent_prompts}
            )
    else:
        # Full reset: delete the entire config document
        db = FirestoreService.get_client()
        db.collection("service_configs").document(f"{org_id}_agent_prompts").delete()

    return {"success": True}

"""
Settings API - Service configuration management.
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.firestore_service import FirestoreService

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
    )


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
        has_api_key=bool(config.get("api_key_ref")),
    )


@router.post("/gemini")
async def configure_gemini(request: GeminiConfigRequest) -> dict[str, Any]:
    """
    Configure Gemini API settings.
    
    In production, the API key should be stored in Secret Manager.
    """
    # Store configuration
    config_data = {
        "configured": True,
        "model": request.model,
        # Note: In production, store reference to Secret Manager
        "api_key_ref": f"projects/homecare-ai/secrets/gemini-api-key-{request.org_id}/versions/latest",
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

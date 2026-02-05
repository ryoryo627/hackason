"""
Setup API - Initial configuration and Slack integration setup.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.firestore_service import FirestoreService
from services.slack_service import SlackService

router = APIRouter()


class SlackTestRequest(BaseModel):
    """Request body for Slack connection test."""
    bot_token: str = Field(..., description="Slack Bot OAuth Token")


class SlackTestResponse(BaseModel):
    """Response for Slack connection test."""
    success: bool
    team: dict[str, Any] | None = None
    bot: dict[str, Any] | None = None
    error: str | None = None


class SlackConfigureRequest(BaseModel):
    """Request body for Slack configuration."""
    org_id: str = Field(..., description="Organization ID")
    bot_token: str = Field(..., description="Slack Bot OAuth Token")
    signing_secret: str = Field(..., description="Slack Signing Secret")
    default_channel: str | None = Field(None, description="Default notification channel")


class OrganizationInitRequest(BaseModel):
    """Request body for organization initialization."""
    org_id: str = Field(..., description="Organization ID")
    name: str = Field(..., description="Organization name")
    admin_email: str = Field(..., description="Admin email")


class OrganizationInitResponse(BaseModel):
    """Response for organization initialization."""
    success: bool
    org_id: str | None = None
    error: str | None = None


@router.post("/slack/test", response_model=SlackTestResponse)
async def test_slack_connection(request: SlackTestRequest) -> SlackTestResponse:
    """
    Test Slack connection with the provided bot token.
    
    This endpoint validates the token and returns workspace information.
    """
    result = await SlackService.test_connection(request.bot_token)
    
    return SlackTestResponse(
        success=result["success"],
        team=result.get("team"),
        bot=result.get("bot"),
        error=result.get("error"),
    )


@router.post("/slack/configure")
async def configure_slack(request: SlackConfigureRequest) -> dict[str, Any]:
    """
    Save Slack configuration for an organization.
    
    Stores the bot token and signing secret reference in Firestore.
    In production, tokens should be stored in Secret Manager.
    """
    # First test the connection
    test_result = await SlackService.test_connection(request.bot_token)
    if not test_result["success"]:
        raise HTTPException(
            status_code=400,
            detail=test_result.get("error", "Slack接続テストに失敗しました"),
        )
    
    # Store configuration (in production, store token in Secret Manager)
    config_data = {
        "slack_team_id": test_result["team"]["id"],
        "slack_team_name": test_result["team"]["name"],
        "slack_bot_id": test_result["bot"]["id"],
        "slack_configured": True,
        "default_channel": request.default_channel,
        # Note: In production, store token reference to Secret Manager, not the actual token
        "slack_bot_token_ref": f"projects/homecare-ai/secrets/slack-bot-token-{request.org_id}/versions/latest",
    }
    
    await FirestoreService.update_service_config(
        request.org_id,
        "slack",
        config_data,
    )
    
    # Update organization status
    await FirestoreService.update_organization(
        request.org_id,
        {"slack_configured": True},
    )
    
    return {
        "success": True,
        "team": test_result["team"],
        "bot": test_result["bot"],
    }


@router.post("/init", response_model=OrganizationInitResponse)
async def initialize_organization(request: OrganizationInitRequest) -> OrganizationInitResponse:
    """
    Initialize a new organization.
    
    Creates the organization document and default configuration.
    """
    # Check if organization already exists
    existing = await FirestoreService.get_organization(request.org_id)
    if existing:
        return OrganizationInitResponse(
            success=True,
            org_id=request.org_id,
        )
    
    # Create organization
    org_data = {
        "name": request.name,
        "admin_email": request.admin_email,
        "slack_configured": False,
        "gemini_configured": False,
        "vertex_configured": False,
        "status": "setup",
    }
    
    await FirestoreService.create_organization(request.org_id, org_data)
    
    return OrganizationInitResponse(
        success=True,
        org_id=request.org_id,
    )


@router.get("/status/{org_id}")
async def get_setup_status(org_id: str) -> dict[str, Any]:
    """
    Get the current setup status for an organization.
    """
    org = await FirestoreService.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="組織が見つかりません")
    
    # Get service configs
    slack_config = await FirestoreService.get_service_config(org_id, "slack")
    gemini_config = await FirestoreService.get_service_config(org_id, "gemini")
    
    return {
        "organization": {
            "id": org_id,
            "name": org.get("name", ""),
            "status": org.get("status", "setup"),
        },
        "slack": {
            "configured": org.get("slack_configured", False),
            "team_name": slack_config.get("slack_team_name") if slack_config else None,
        },
        "gemini": {
            "configured": org.get("gemini_configured", False),
        },
        "vertex": {
            "configured": org.get("vertex_configured", False),
        },
    }


@router.get("/slack/users/{org_id}")
async def list_slack_users(org_id: str) -> dict[str, Any]:
    """
    List users in the connected Slack workspace.
    
    Used for selecting team members to invite to patient channels.
    """
    # Get Slack config for the organization
    slack_config = await FirestoreService.get_service_config(org_id, "slack")
    if not slack_config or not slack_config.get("slack_configured"):
        raise HTTPException(status_code=400, detail="Slackが設定されていません")
    
    # In production, retrieve token from Secret Manager
    # For demo, we'll use the configured token or demo mode
    result = await SlackService.list_workspace_users()
    
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "ユーザー取得に失敗しました"))
    
    return {
        "users": result["users"],
    }

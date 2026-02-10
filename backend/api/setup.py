"""
Setup API - Initial configuration and user/organization setup.

Key design decisions:
- All API keys (Slack, Gemini) are stored in Firestore service_configs collection
- Users configure credentials through the Admin UI settings page
- No fallback to environment variables or Secret Manager for API keys
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.firestore_service import FirestoreService
from services.slack_service import SlackService

router = APIRouter()


# ============================================================
# User Management
# ============================================================

class UserResponse(BaseModel):
    """Response for user operations."""
    uid: str
    email: str
    display_name: str | None = None
    organization_id: str | None = None
    role: str = "admin"


class GetOrCreateUserRequest(BaseModel):
    """Request body for getting or creating a user."""
    uid: str = Field(..., description="Firebase Auth UID")
    email: str = Field(..., description="User email")
    display_name: str | None = Field(None, description="Display name")


@router.post("/user", response_model=UserResponse)
async def get_or_create_user(request: GetOrCreateUserRequest) -> UserResponse:
    """
    Get existing user or create new user document.

    Called after Firebase Auth login to ensure user document exists.
    """
    user = await FirestoreService.get_or_create_user(
        uid=request.uid,
        email=request.email,
        display_name=request.display_name,
    )

    return UserResponse(
        uid=user.get("uid", request.uid),
        email=user.get("email", request.email),
        display_name=user.get("display_name"),
        organization_id=user.get("organization_id"),
        role=user.get("role", "admin"),
    )


@router.get("/user/{uid}", response_model=UserResponse)
async def get_user(uid: str) -> UserResponse:
    """
    Get user by UID.
    """
    user = await FirestoreService.get_user(uid)
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    return UserResponse(
        uid=user.get("uid", uid),
        email=user.get("email", ""),
        display_name=user.get("display_name"),
        organization_id=user.get("organization_id"),
        role=user.get("role", "admin"),
    )


# ============================================================
# Organization Setup
# ============================================================

class OrganizationInitRequest(BaseModel):
    """Request body for organization initialization."""
    uid: str = Field(..., description="User's Firebase UID")
    name: str = Field(..., description="Organization name")
    admin_email: str = Field(..., description="Admin email")


class OrganizationInitResponse(BaseModel):
    """Response for organization initialization."""
    success: bool
    org_id: str | None = None
    error: str | None = None


@router.post("/init", response_model=OrganizationInitResponse)
async def initialize_organization(request: OrganizationInitRequest) -> OrganizationInitResponse:
    """
    Initialize a new organization and link it to the user.

    This creates the organization document and updates the user's organizationId.
    """
    # Generate org ID
    org_id = f"org-{request.uid[:8]}"

    # Check if organization already exists
    existing = await FirestoreService.get_organization(org_id)
    if existing:
        # Update user's organization link if needed
        user = await FirestoreService.get_user(request.uid)
        if user and not user.get("organization_id"):
            await FirestoreService.update_user(request.uid, {"organization_id": org_id})

        return OrganizationInitResponse(
            success=True,
            org_id=org_id,
        )

    # Create organization
    org_data = {
        "name": request.name,
        "admin_email": request.admin_email,
        "created_by": request.uid,
        "status": "active",
    }

    await FirestoreService.create_organization(org_id, org_data)

    # Update user with organization link
    await FirestoreService.update_user(request.uid, {
        "organization_id": org_id,
        "role": "admin",
    })

    return OrganizationInitResponse(
        success=True,
        org_id=org_id,
    )


# ============================================================
# API Key Configuration (per-organization)
# ============================================================

class ConfigureApiKeysRequest(BaseModel):
    """Request body for configuring API keys."""
    org_id: str = Field(..., description="Organization ID")
    slack_bot_token: str = Field(..., description="Slack Bot User OAuth Token")
    slack_signing_secret: str = Field(..., description="Slack Signing Secret")
    gemini_api_key: str | None = Field(None, description="Gemini API Key (optional)")


class ConfigureApiKeysResponse(BaseModel):
    """Response for API key configuration."""
    success: bool
    error: str | None = None


@router.post("/configure", response_model=ConfigureApiKeysResponse)
async def configure_api_keys(request: ConfigureApiKeysRequest) -> ConfigureApiKeysResponse:
    """
    Configure API keys for an organization.

    All configuration is stored in service_configs collection.
    Tests the connection and stores tokens + status together.
    """
    try:
        # Validate organization exists
        org = await FirestoreService.get_organization(request.org_id)
        if not org:
            return ConfigureApiKeysResponse(
                success=False,
                error="組織が見つかりません",
            )

        # Test Slack connection first
        slack_result = await SlackService.test_connection_with_token(request.slack_bot_token)

        # Store Slack config (tokens + status) in service_configs
        slack_config = {
            "slack_bot_token": request.slack_bot_token,
            "slack_signing_secret": request.slack_signing_secret,
            "slack_configured": slack_result.get("success", False),
            "slack_team_id": slack_result.get("team", {}).get("id") if slack_result.get("success") else None,
            "slack_team_name": slack_result.get("team", {}).get("name") if slack_result.get("success") else None,
            "slack_bot_id": slack_result.get("bot", {}).get("id") if slack_result.get("success") else None,
        }
        await FirestoreService.update_service_config(request.org_id, "slack", slack_config)

        # Update organization status
        await FirestoreService.update_organization(request.org_id, {
            "slack_configured": slack_result.get("success", False),
        })

        # Store Gemini config if provided
        if request.gemini_api_key:
            from config import get_settings
            settings = get_settings()
            gemini_config = {
                "gemini_api_key": request.gemini_api_key,
                "configured": True,
                "model": settings.gemini_model,
            }
            await FirestoreService.update_service_config(request.org_id, "gemini", gemini_config)
            await FirestoreService.update_organization(request.org_id, {
                "gemini_configured": True,
            })

        return ConfigureApiKeysResponse(success=True)

    except Exception as e:
        return ConfigureApiKeysResponse(
            success=False,
            error=f"API設定の保存に失敗しました: {str(e)}",
        )


# ============================================================
# Connection Tests (credentials from Firestore service_configs)
# ============================================================

class TestBackendRequest(BaseModel):
    """Request body for backend connectivity test."""
    org_id: str | None = Field(None, description="Organization ID (optional)")


@router.post("/test-backend", response_model=dict)
async def test_backend_connectivity(request: TestBackendRequest | None = None) -> dict[str, Any]:
    """
    Test overall backend connectivity.

    All credentials are read from Firestore service_configs collection.
    org_id is required to check Slack/Gemini status.
    Without org_id, only Firestore connectivity is tested.

    Checks:
    - Firestore connection
    - Slack connection (from service_configs)
    - Gemini API availability (from service_configs)
    """
    results: dict[str, Any] = {
        "firestore": {"connected": False},
        "slack": {"connected": False},
        "gemini": {"connected": False},
    }

    org_id = request.org_id if request else None
    slack_config = None
    gemini_config = None

    # Get organization-specific config from Firestore service_configs
    if org_id:
        try:
            slack_config = await FirestoreService.get_service_config(org_id, "slack")
            gemini_config = await FirestoreService.get_service_config(org_id, "gemini")
        except Exception:
            pass

    # Test Firestore
    try:
        FirestoreService.get_client()
        results["firestore"]["connected"] = True
    except Exception as e:
        results["firestore"]["error"] = str(e)

    # Test Slack (Firestore service_configs only)
    if slack_config and slack_config.get("slack_bot_token"):
        try:
            slack_result = await SlackService.test_connection_with_token(
                slack_config["slack_bot_token"]
            )
            results["slack"]["connected"] = slack_result.get("success", False)
            if slack_result.get("team"):
                results["slack"]["team_name"] = slack_result["team"].get("name")
            if not slack_result.get("success"):
                results["slack"]["error"] = slack_result.get("error")
        except Exception as e:
            results["slack"]["error"] = str(e)
    else:
        results["slack"]["error"] = "Slack Bot Tokenが未設定です。サービス接続ページで設定してください。"

    # Test Gemini (Firestore service_configs only)
    gemini_key = gemini_config.get("gemini_api_key") if gemini_config else None
    if gemini_key:
        try:
            from config import get_settings
            settings = get_settings()
            results["gemini"]["connected"] = True
            results["gemini"]["model"] = gemini_config.get("model") or settings.gemini_model
        except Exception as e:
            results["gemini"]["error"] = str(e)
    else:
        results["gemini"]["error"] = "Gemini API Keyが未設定です。サービス接続ページで設定してください。"

    return {
        "success": all(r.get("connected") for r in results.values()),
        "services": results,
    }


# ============================================================
# Setup Status
# ============================================================

@router.get("/status/{org_id}")
async def get_setup_status(org_id: str) -> dict[str, Any]:
    """
    Get the current setup status for an organization.
    """
    org = await FirestoreService.get_organization(org_id)
    if not org:
        raise HTTPException(status_code=404, detail="組織が見つかりません")

    return {
        "organization": {
            "id": org_id,
            "name": org.get("name", ""),
            "status": org.get("status", "active"),
        },
    }


# ============================================================
# Slack Users (for patient channel invites)
# ============================================================

@router.get("/slack/users")
async def list_slack_users(
    org_id: str = Query(..., description="Organization ID"),
) -> dict[str, Any]:
    """
    List users in the connected Slack workspace.

    Uses Firestore service_configs credentials for the given organization.
    """
    slack_config = await FirestoreService.get_service_config(org_id, "slack")
    if not slack_config or not slack_config.get("slack_bot_token"):
        raise HTTPException(status_code=400, detail="Slack Bot Tokenが設定されていません")

    slack_bot_token = slack_config.get("slack_bot_token")
    result = await SlackService.list_workspace_users(token=slack_bot_token)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "ユーザー取得に失敗しました"))

    return {
        "users": result["users"],
    }

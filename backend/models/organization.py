"""
Organization models for HomeCare AI Agent.
Based on data-model.md specifications.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class OrganizationBase(BaseModel):
    """Base organization fields."""

    name: str = Field(..., description="Organization name")
    slack_workspace_id: str | None = Field(None, description="Slack workspace ID")
    slack_workspace_name: str | None = Field(None, description="Slack workspace name")
    slack_bot_user_id: str | None = Field(None, description="Bot user ID in Slack")
    slack_token_ref: str | None = Field(None, description="Secret Manager reference for Slack token")
    signing_secret_ref: str | None = Field(None, description="Secret Manager reference for signing secret")
    oncall_channel_id: str | None = Field(None, description="#oncall-night channel ID")


class OrganizationCreate(OrganizationBase):
    """Organization creation request."""

    pass


class OrganizationUpdate(BaseModel):
    """Organization update request."""

    name: str | None = None
    slack_workspace_id: str | None = None
    slack_workspace_name: str | None = None
    slack_bot_user_id: str | None = None
    slack_token_ref: str | None = None
    signing_secret_ref: str | None = None
    oncall_channel_id: str | None = None
    setup_completed_at: datetime | None = None


class Organization(OrganizationBase):
    """Organization response model."""

    id: str
    setup_completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# === Facility ===


class FacilityBase(BaseModel):
    """Base facility fields."""

    name: str = Field(..., description="Facility name")
    address: str | None = Field(None, description="Facility address")


class FacilityCreate(FacilityBase):
    """Facility creation request."""

    pass


class Facility(FacilityBase):
    """Facility response model."""

    id: str
    created_at: datetime

    class Config:
        from_attributes = True


# === Area ===


class AreaBase(BaseModel):
    """Base area fields."""

    name: str = Field(..., description="Area name")


class AreaCreate(AreaBase):
    """Area creation request."""

    pass


class Area(AreaBase):
    """Area response model."""

    id: str
    created_at: datetime

    class Config:
        from_attributes = True

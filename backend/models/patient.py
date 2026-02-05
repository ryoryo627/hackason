"""
Patient models for HomeCare AI Agent.
Based on data-model.md specifications.
"""

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Sex(str, Enum):
    """Patient sex."""

    MALE = "M"
    FEMALE = "F"


class RiskLevel(str, Enum):
    """Patient risk level."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class PatientStatus(str, Enum):
    """Patient status."""

    ACTIVE = "active"
    ARCHIVED = "archived"


class PatientBase(BaseModel):
    """Base patient fields."""

    name: str = Field(..., description="Patient name")
    name_kana: str | None = Field(None, description="Patient name in katakana")
    age: int = Field(..., ge=0, le=150, description="Patient age")
    sex: Sex = Field(..., description="Patient sex")
    conditions: list[str] = Field(default_factory=list, description="List of conditions")
    facility: str | None = Field(None, description="Facility name")
    area: str | None = Field(None, description="Area name")
    tags: list[str] = Field(default_factory=list, description="Custom tags")
    memo: str | None = Field(None, description="Notes")


class PatientCreate(PatientBase):
    """Patient creation request."""

    org_id: str = Field(..., description="Organization ID")
    risk_level: RiskLevel = Field(default=RiskLevel.LOW, description="Initial risk level")


class PatientUpdate(BaseModel):
    """Patient update request."""

    name: str | None = None
    name_kana: str | None = None
    age: int | None = Field(None, ge=0, le=150)
    sex: Sex | None = None
    conditions: list[str] | None = None
    facility: str | None = None
    area: str | None = None
    tags: list[str] | None = None
    memo: str | None = None
    risk_level: RiskLevel | None = None
    status: PatientStatus | None = None


class Patient(PatientBase):
    """Patient response model."""

    id: str
    org_id: str
    slack_channel_id: str | None = None
    slack_channel_name: str | None = None
    slack_anchor_message_ts: str | None = None
    risk_level: RiskLevel
    status: PatientStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientListItem(BaseModel):
    """Simplified patient for list view."""

    id: str
    name: str
    age: int
    sex: Sex
    facility: str | None
    area: str | None
    risk_level: RiskLevel
    status: PatientStatus
    tags: list[str]
    updated_at: datetime

    class Config:
        from_attributes = True


class PatientListResponse(BaseModel):
    """Patient list response."""

    patients: list[PatientListItem]
    total: int


# === Patient Context ===


class TrendDirection(str, Enum):
    """Trend direction."""

    IMPROVING = "improving"
    STABLE = "stable"
    WORSENING = "worsening"


class TrendItem(BaseModel):
    """Trend item for BPS tracking."""

    indicator: str
    direction: TrendDirection
    detail: str


class RecommendationPriority(str, Enum):
    """Recommendation priority."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class BPSAxis(str, Enum):
    """BPS axis."""

    BIO = "bio"
    PSYCHO = "psycho"
    SOCIAL = "social"
    CROSS = "cross"


class Recommendation(BaseModel):
    """Recommendation for patient care."""

    priority: RecommendationPriority
    bps_axis: BPSAxis
    text: str


class PatientContext(BaseModel):
    """Patient context (single document per patient)."""

    current_summary: str = Field(..., description="Current BPS narrative summary")
    bio_trends: list[TrendItem] = Field(default_factory=list)
    psycho_trends: list[TrendItem] = Field(default_factory=list)
    social_trends: list[TrendItem] = Field(default_factory=list)
    risk_factors: list[str] = Field(default_factory=list)
    recommendations: list[Recommendation] = Field(default_factory=list)
    last_updated: datetime | None = None

    class Config:
        from_attributes = True

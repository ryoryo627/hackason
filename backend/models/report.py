"""
Report models for HomeCare AI Agent.
Based on data-model.md specifications - BPS structured reports.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class VitalType(str, Enum):
    """Vital sign types."""

    SPO2 = "SpO2"
    BP_SYSTOLIC = "BP_systolic"
    BP_DIASTOLIC = "BP_diastolic"
    HR = "HR"
    BT = "BT"
    WEIGHT = "weight"


class VitalTrend(str, Enum):
    """Vital sign trend indicators."""

    UP = "↑"
    DOWN = "↓"
    STABLE = "→"


class MedicationAdherence(str, Enum):
    """Medication adherence levels."""

    GOOD = "良好"
    DECREASED = "低下"
    STOPPED = "中断"


class ReporterType(str, Enum):
    """Reporter types."""

    NURSE = "nurse"
    PHARMACIST = "pharmacist"
    CARE_MANAGER = "care_manager"
    DOCTOR = "doctor"
    FAMILY = "family"


class SourceType(str, Enum):
    """Report source types."""

    TEXT = "text"
    PDF = "pdf"
    IMAGE = "image"
    VOICE = "voice"


# === BPS Sub-models ===


class VitalReading(BaseModel):
    """Vital sign reading."""

    type: VitalType
    value: float
    unit: str = Field(..., description="Unit of measurement")
    trend: VitalTrend | None = None
    delta: float | None = Field(None, description="Change from previous reading")
    period: str | None = Field(None, description="Period for comparison (1w, 1d, 1m)")


class MedicationStatus(BaseModel):
    """Medication status in report."""

    name: str = Field(..., description="Medication name with dosage")
    adherence: MedicationAdherence | None = None
    note: str | None = Field(None, description="Additional notes")


class BioData(BaseModel):
    """Biological data in BPS report."""

    vitals: list[VitalReading] = Field(default_factory=list)
    symptoms: list[str] = Field(default_factory=list, description="Observed symptoms")
    medications: list[MedicationStatus] = Field(default_factory=list)
    adl: str | None = Field(None, description="ADL status note")


class PsychoData(BaseModel):
    """Psychological data in BPS report."""

    mood: str | None = Field(None, description="Mood description")
    cognition: str | None = Field(None, description="Cognition status")
    concerns: list[str] = Field(default_factory=list, description="Psychological concerns")


class SocialData(BaseModel):
    """Social data in BPS report."""

    family: str | None = Field(None, description="Family situation")
    services: str | None = Field(None, description="Service changes")
    concerns: list[str] = Field(default_factory=list, description="Social concerns")


# === Report Models ===


class ReportBase(BaseModel):
    """Base report fields."""

    bio: BioData = Field(default_factory=BioData)
    psycho: PsychoData = Field(default_factory=PsychoData)
    social: SocialData = Field(default_factory=SocialData)
    reporter: ReporterType
    reporter_name: str
    source_type: SourceType = SourceType.TEXT
    raw_text: str = Field(..., description="Original report text")


class ReportCreate(ReportBase):
    """Report creation request (from Intake Agent)."""

    confidence: float = Field(..., ge=0.0, le=1.0, description="Structuring confidence")
    alert_triggered: bool = Field(default=False)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Report(ReportBase):
    """Report response model."""

    id: str
    confidence: float
    alert_triggered: bool
    timestamp: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ReportListItem(BaseModel):
    """Simplified report for list/timeline view."""

    id: str
    reporter: ReporterType
    reporter_name: str
    source_type: SourceType
    timestamp: datetime
    alert_triggered: bool
    # Summary fields for quick view
    has_vitals: bool
    symptom_count: int
    has_bio_concerns: bool
    has_psycho_concerns: bool
    has_social_concerns: bool

    class Config:
        from_attributes = True


# === Raw Files ===


class FileType(str, Enum):
    """Raw file types."""

    PDF = "pdf"
    IMAGE = "image"
    VOICE = "voice"


class RawFileBase(BaseModel):
    """Base raw file fields."""

    file_type: FileType
    original_name: str
    size_bytes: int
    uploaded_by: str


class RawFileCreate(RawFileBase):
    """Raw file creation request."""

    gcs_uri: str
    linked_report_id: str | None = None


class RawFile(RawFileBase):
    """Raw file response model."""

    id: str
    gcs_uri: str
    linked_report_id: str | None
    timestamp: datetime

    class Config:
        from_attributes = True

"""
Alert models for HomeCare AI Agent.
Based on data-model.md and agent-design.md specifications.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class AlertPatternType(str, Enum):
    """
    Alert pattern types from agent-design.md.

    A-1: バイタル低下トレンド (Vital sign decline trend)
    A-2: 複合Bio悪化 (Compound Bio deterioration)
    A-3: Psycho変化シグナル (Psycho change signal)
    A-4: Social変化シグナル (Social change signal)
    A-5: 全軸複合 (Cross-axis compound)
    A-6: 急性イベント (Acute event)
    """

    A1_VITAL_TREND = "A-1"
    A2_COMPOUND_BIO = "A-2"
    A3_PSYCHO_SIGNAL = "A-3"
    A4_SOCIAL_SIGNAL = "A-4"
    A5_CROSS_AXIS = "A-5"
    A6_ACUTE_EVENT = "A-6"


PATTERN_NAMES = {
    AlertPatternType.A1_VITAL_TREND: "バイタル低下トレンド",
    AlertPatternType.A2_COMPOUND_BIO: "複合Bio悪化",
    AlertPatternType.A3_PSYCHO_SIGNAL: "Psycho変化シグナル",
    AlertPatternType.A4_SOCIAL_SIGNAL: "Social変化シグナル",
    AlertPatternType.A5_CROSS_AXIS: "全軸複合",
    AlertPatternType.A6_ACUTE_EVENT: "急性イベント",
}


class AlertEvidence(BaseModel):
    """Evidence supporting an alert."""

    report_id: str
    reporter_name: str
    timestamp: datetime
    summary: str = Field(..., description="Brief summary of the evidence")


class AlertBase(BaseModel):
    """Base alert fields."""

    severity: AlertSeverity
    pattern_type: AlertPatternType
    pattern_name: str
    message: str = Field(..., description="Alert message (posted to Slack)")
    evidence: list[AlertEvidence] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)


class AlertCreate(AlertBase):
    """Alert creation request."""

    slack_message_ts: str | None = None


class AlertUpdate(BaseModel):
    """Alert update request (for acknowledgment)."""

    acknowledged: bool = True
    acknowledged_by: str


class Alert(AlertBase):
    """Alert response model."""

    id: str
    slack_message_ts: str | None
    acknowledged: bool
    acknowledged_by: str | None
    acknowledged_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class AlertListItem(BaseModel):
    """Simplified alert for list view."""

    id: str
    patient_id: str
    patient_name: str
    severity: AlertSeverity
    pattern_type: AlertPatternType
    pattern_name: str
    message: str
    acknowledged: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AlertListResponse(BaseModel):
    """Alert list response."""

    alerts: list[AlertListItem]
    total: int
    unacknowledged_count: int


# === Morning Scan Report ===


class MorningScanPatientSummary(BaseModel):
    """Patient summary for morning scan report."""

    patient_id: str
    patient_name: str
    risk_level: str
    urgency_score: float = Field(..., ge=0.0, le=1.0)
    key_concerns: list[str]
    recommended_priority: str


class MorningScanReport(BaseModel):
    """Morning scan report for #oncall-night channel."""

    scan_time: datetime
    total_patients_scanned: int
    high_priority: list[MorningScanPatientSummary]
    medium_priority: list[MorningScanPatientSummary]
    low_priority: list[MorningScanPatientSummary]
    summary_message: str

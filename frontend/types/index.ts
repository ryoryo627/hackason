/**
 * Shared types for HomeCare Admin UI.
 */

// Patient types
export type Sex = "M" | "F";
export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type PatientStatus = "active" | "archived";

export interface Patient {
  id: string;
  org_id: string;
  name: string;
  name_kana: string | null;
  age: number;
  sex: Sex;
  conditions: string[];
  facility: string | null;
  area: string | null;
  tags: string[];
  memo: string | null;
  slack_channel_id: string | null;
  slack_channel_name: string | null;
  risk_level: RiskLevel;
  status: PatientStatus;
  created_at: string;
  updated_at: string;
}

export interface PatientListItem {
  id: string;
  name: string;
  age: number;
  sex: Sex;
  facility: string | null;
  area: string | null;
  risk_level: RiskLevel;
  status: PatientStatus;
  tags: string[];
  updated_at: string;
}

// Alert types
export type AlertSeverity = "HIGH" | "MEDIUM" | "LOW";
export type AlertPatternType = "A-1" | "A-2" | "A-3" | "A-4" | "A-5" | "A-6";

export interface Alert {
  id: string;
  patient_id: string;
  patient_name: string;
  severity: AlertSeverity;
  pattern_type: AlertPatternType;
  pattern_name: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

// Report types
export type ReporterType = "nurse" | "pharmacist" | "care_manager" | "doctor" | "family";

export interface ReportListItem {
  id: string;
  reporter: ReporterType;
  reporter_name: string;
  timestamp: string;
  alert_triggered: boolean;
}

// Dashboard stats
export interface DashboardStats {
  total_patients: number;
  high_risk_patients: number;
  unacknowledged_alerts: number;
  recent_reports_24h: number;
  slack_connected: boolean;
}

// Navigation
export interface NavItem {
  name: string;
  href: string;
  icon: string;
  badge?: number;
}

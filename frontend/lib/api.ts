/**
 * API Client for HomeCare AI Backend.
 *
 * Handles all API requests with authentication and error handling.
 */

import { getIdToken } from "./firebase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// ============================================================
// User & Organization Management
// ============================================================

/**
 * User data stored in Firestore.
 */
export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  organizationId: string | null;
  role: string;
}

// Cache for current user data
let cachedUserData: UserData | null = null;

/**
 * Get the current organization ID from cached user data.
 * Falls back to localStorage for backwards compatibility.
 */
export function getOrgId(): string {
  if (cachedUserData?.organizationId) {
    return cachedUserData.organizationId;
  }
  // Fallback to localStorage for backwards compatibility
  if (typeof window !== "undefined") {
    const orgId = localStorage.getItem("org_id");
    if (orgId) return orgId;
  }
  throw new Error("組織IDが設定されていません。セットアップを完了してください。");
}

/**
 * Set the organization ID (used during setup).
 */
export function setOrgId(orgId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("org_id", orgId);
  }
  // Also update cached user data if available
  if (cachedUserData) {
    cachedUserData.organizationId = orgId;
  }
}

/**
 * Set user data (called after login/user sync).
 */
export function setUserData(userData: UserData): void {
  cachedUserData = userData;
  // Also store org_id in localStorage for backwards compatibility
  if (userData.organizationId && typeof window !== "undefined") {
    localStorage.setItem("org_id", userData.organizationId);
  }
}

/**
 * Get cached user data.
 */
export function getUserData(): UserData | null {
  return cachedUserData;
}

/**
 * Clear user data (called on logout).
 */
export function clearUserData(): void {
  cachedUserData = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("org_id");
  }
}

/**
 * API request helper with authentication.
 * Exported for SWR fetcher integration.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getIdToken();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: "APIエラー" }));
    // Handle FastAPI's various error formats
    let errorMessage: string;
    if (typeof errorBody.detail === "string") {
      errorMessage = errorBody.detail;
    } else if (Array.isArray(errorBody.detail)) {
      // Pydantic validation errors return an array of error objects
      errorMessage = errorBody.detail
        .map((e: { msg?: string; loc?: string[] }) => e.msg || JSON.stringify(e))
        .join(", ");
    } else if (errorBody.message) {
      errorMessage = errorBody.message;
    } else if (errorBody.error) {
      errorMessage = errorBody.error;
    } else {
      errorMessage = `HTTP ${response.status}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// ============================================================
// Setup API
// ============================================================

export interface SetupStatus {
  organization: {
    id: string;
    name: string;
    status: string;
  };
}

export interface BackendTestResult {
  success: boolean;
  services: {
    firestore: { connected: boolean; error?: string };
    slack: { connected: boolean; team_name?: string; error?: string };
    gemini: { connected: boolean; model?: string; error?: string };
  };
}

// API response types
interface UserApiResponse {
  uid: string;
  email: string;
  display_name?: string;
  organization_id: string | null;
  role: string;
}

export const setupApi = {
  /**
   * Get or create user document after login.
   */
  getOrCreateUser: (data: {
    uid: string;
    email: string;
    displayName?: string;
  }): Promise<UserData> => {
    return apiRequest<UserApiResponse>("/api/setup/user", {
      method: "POST",
      body: JSON.stringify({
        uid: data.uid,
        email: data.email,
        display_name: data.displayName,
      }),
    }).then((response) => {
      const userData: UserData = {
        uid: response.uid,
        email: response.email,
        displayName: response.display_name,
        organizationId: response.organization_id,
        role: response.role,
      };
      setUserData(userData);
      return userData;
    });
  },

  /**
   * Get user by UID.
   */
  getUser: (uid: string): Promise<UserData> => {
    return apiRequest<UserApiResponse>(`/api/setup/user/${uid}`).then((response) => ({
      uid: response.uid,
      email: response.email,
      displayName: response.display_name,
      organizationId: response.organization_id,
      role: response.role,
    }));
  },

  /**
   * Initialize organization (links to user automatically).
   */
  initOrganization: (data: {
    uid: string;
    name: string;
    adminEmail: string;
  }): Promise<{ success: boolean; org_id: string }> => {
    return apiRequest("/api/setup/init", {
      method: "POST",
      body: JSON.stringify({
        uid: data.uid,
        name: data.name,
        admin_email: data.adminEmail,
      }),
    });
  },

  /**
   * Test backend connectivity (Firestore, Slack, Gemini).
   * Uses Secret Manager credentials - no user input needed.
   */
  testBackend: (): Promise<BackendTestResult> => {
    return apiRequest("/api/setup/test-backend", {
      method: "POST",
    });
  },

  /**
   * Configure API keys for an organization.
   * Saves Slack and Gemini credentials to Firestore (encrypted).
   */
  configureApiKeys: (data: {
    orgId: string;
    slackBotToken: string;
    slackSigningSecret: string;
    geminiApiKey?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    return apiRequest("/api/setup/configure", {
      method: "POST",
      body: JSON.stringify({
        org_id: data.orgId,
        slack_bot_token: data.slackBotToken,
        slack_signing_secret: data.slackSigningSecret,
        gemini_api_key: data.geminiApiKey,
      }),
    });
  },

  /**
   * Test backend connectivity with organization-specific credentials.
   * Uses credentials stored for the specified organization.
   */
  testBackendWithOrg: (orgId: string): Promise<BackendTestResult> => {
    return apiRequest("/api/setup/test-backend", {
      method: "POST",
      body: JSON.stringify({ org_id: orgId }),
    });
  },

  /**
   * Get setup status.
   */
  getStatus: (): Promise<SetupStatus> => {
    return apiRequest(`/api/setup/status/${getOrgId()}`);
  },

  /**
   * List Slack workspace users.
   */
  listSlackUsers: (): Promise<{
    users: Array<{
      id: string;
      name: string;
      email: string;
      display_name: string;
    }>;
  }> => {
    return apiRequest(`/api/setup/slack/users?org_id=${getOrgId()}`);
  },
};

// ============================================================
// Patients API
// ============================================================

export interface RiskHistoryEntry {
  id: string;
  previous_level: string;
  new_level: string;
  source: "auto" | "manual";
  reason: string;
  trigger: string;
  alert_snapshot: { high: number; medium: number; low: number };
  created_at: string;
  created_by: string;
}

export interface Patient {
  id: string;
  name: string;
  name_kana?: string;
  birth_date?: string;
  age?: number;
  gender?: string;
  address?: string;
  phone?: string;
  primary_diagnosis?: string;
  facility?: string;
  area?: string;
  care_level?: string;
  status: string;
  risk_level: string;
  risk_level_source?: "auto" | "manual";
  risk_level_reason?: string;
  risk_level_updated_at?: string;
  slack_channel_id?: string;
  slack_channel_name?: string;
  org_id: string;
  created_at?: string;
  updated_at?: string;
  // 在宅5つの呪文
  medical_procedures?: string[];
  residence_type?: string;
  insurance_type?: string;
  adl_description?: string;
  special_disease_flag?: string;
  // 紹介元・経緯
  referral_source?: {
    institution_name?: string;
    doctor_name?: string;
    department?: string;
    referral_date?: string;
  };
  clinical_background?: string;
  key_person?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
}

export interface PatientDetail extends Patient {
  recent_reports: Report[];
  alerts: Alert[];
  context?: BPSContext;
}

export interface Report {
  id: string;
  timestamp: string;
  reporter_name: string;
  reporter_role: string;
  raw_text: string;
  bps_classification: {
    bio?: string[];
    psycho?: string[];
    social?: string[];
  };
  acknowledged?: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
}

export interface Alert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
  patient_id?: string;
  patient_name?: string;
}

export interface BPSContext {
  bio: Record<string, unknown>;
  psycho: Record<string, unknown>;
  social: Record<string, unknown>;
  bps_summary?: {
    bio_narrative?: string;
    psycho_narrative?: string;
    social_narrative?: string;
    bio_trend?: string;
    psycho_trend?: string;
    social_trend?: string;
  };
  last_updated?: string;
}

export interface CreatePatientData {
  name: string;
  name_kana?: string;
  birth_date?: string;
  gender?: string;
  address?: string;
  phone?: string;
  primary_diagnosis?: string;
  facility?: string;
  area?: string;
  care_level?: string;
  team_member_ids?: string[];
  create_slack_channel?: boolean;
  // 在宅5つの呪文
  medical_procedures?: string[];
  residence_type?: string;
  insurance_type?: string;
  adl_description?: string;
  special_disease_flag?: string;
  // 紹介元・経緯
  referral_source?: {
    institution_name?: string;
    doctor_name?: string;
    department?: string;
    referral_date?: string;
  };
  clinical_background?: string;
  key_person?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
}

export const patientsApi = {
  /**
   * List patients with filters.
   */
  list: (params?: {
    status?: string;
    risk_level?: string;
    facility?: string;
    area?: string;
    limit?: number;
  }): Promise<{ patients: Patient[]; total: number }> => {
    const searchParams = new URLSearchParams({
      org_id: getOrgId(),
      ...(params?.status && { status: params.status }),
      ...(params?.risk_level && { risk_level: params.risk_level }),
      ...(params?.facility && { facility: params.facility }),
      ...(params?.area && { area: params.area }),
      ...(params?.limit && { limit: params.limit.toString() }),
    });
    return apiRequest(`/api/patients?${searchParams}`);
  },

  /**
   * Get patient details.
   */
  get: (
    patientId: string
  ): Promise<{
    patient: Patient;
    recent_reports: Report[];
    alerts: Alert[];
    context: BPSContext | null;
    risk_history: RiskHistoryEntry[];
  }> => {
    return apiRequest(`/api/patients/${patientId}`);
  },

  /**
   * Create a new patient.
   */
  create: (
    data: CreatePatientData
  ): Promise<{
    success: boolean;
    patient_id: string;
    slack?: {
      channel_created: boolean;
      channel_id?: string;
      channel_name?: string;
      error?: string;
    };
  }> => {
    return apiRequest("/api/patients", {
      method: "POST",
      body: JSON.stringify({
        org_id: getOrgId(),
        ...data,
      }),
    });
  },

  /**
   * Update patient.
   */
  update: (
    patientId: string,
    data: Partial<CreatePatientData> & { status?: string; risk_level?: string }
  ): Promise<{
    success: boolean;
    updated_fields: string[];
    slack_sync?: {
      channel_renamed?: boolean;
      rename_error?: string;
      anchor_updated?: boolean;
      anchor_error?: string;
    } | null;
  }> => {
    return apiRequest(`/api/patients/${patientId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Bulk create patients from CSV import.
   */
  bulkCreate: (
    data: {
      patients: Omit<CreatePatientData, "team_member_ids" | "create_slack_channel">[];
      create_slack_channels?: boolean;
    }
  ): Promise<{
    success: boolean;
    total: number;
    created: number;
    patient_ids: string[];
    errors: { index: number; name: string; error: string }[];
    slack_status: string;
  }> => {
    return apiRequest("/api/patients/bulk", {
      method: "POST",
      body: JSON.stringify({
        org_id: getOrgId(),
        patients: data.patients,
        create_slack_channels: data.create_slack_channels ?? false,
      }),
    });
  },

  /**
   * Bulk assign team members to patients' Slack channels.
   */
  bulkAssignMembers: (data: {
    patient_ids: string[];
    user_ids: string[];
  }): Promise<{
    success: boolean;
    task_id: string;
    total_patients: number;
    status: string;
  }> => {
    return apiRequest("/api/patients/bulk-assign-members", {
      method: "POST",
      body: JSON.stringify({
        org_id: getOrgId(),
        patient_ids: data.patient_ids,
        user_ids: data.user_ids,
      }),
    });
  },

  /**
   * Get progress of a bulk member assignment task.
   */
  getBulkAssignProgress: (taskId: string): Promise<{
    task_id: string;
    status: string;
    total: number;
    completed: number;
    results: Array<{
      patient_id: string;
      patient_name: string;
      success: boolean;
      invited?: number;
      note?: string;
      error?: string;
    }>;
  }> => {
    return apiRequest(`/api/patients/bulk-assign-members/${taskId}`);
  },

  /**
   * Delete (archive) a patient.
   */
  delete: (
    patientId: string
  ): Promise<{
    success: boolean;
    patient_id: string;
    slack?: {
      channel_archived?: boolean;
      error?: string;
    } | null;
  }> => {
    return apiRequest(`/api/patients/${patientId}`, {
      method: "DELETE",
    });
  },

  /**
   * Get patient reports.
   */
  getReports: (
    patientId: string,
    params?: { limit?: number; acknowledged?: boolean }
  ): Promise<{ patient_id: string; reports: Report[]; total: number }> => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", params.limit.toString());
    if (params?.acknowledged !== undefined)
      searchParams.set("acknowledged", params.acknowledged.toString());
    const qs = searchParams.toString();
    return apiRequest(`/api/patients/${patientId}/reports${qs ? `?${qs}` : ""}`);
  },

  /**
   * Get patient alerts.
   */
  getAlerts: (
    patientId: string,
    acknowledged?: boolean
  ): Promise<{ patient_id: string; alerts: Alert[]; total: number }> => {
    const params = acknowledged !== undefined ? `?acknowledged=${acknowledged}` : "";
    return apiRequest(`/api/patients/${patientId}/alerts${params}`);
  },

  /**
   * Acknowledge an alert.
   */
  acknowledgeAlert: (
    patientId: string,
    alertId: string,
    userId: string
  ): Promise<{ success: boolean }> => {
    return apiRequest(
      `/api/patients/${patientId}/alerts/${alertId}/acknowledge?acknowledged_by=${userId}`,
      { method: "POST" }
    );
  },

  /**
   * List attached files for a patient.
   */
  listFiles: (
    patientId: string,
    limit?: number
  ): Promise<{ patient_id: string; files: RawFile[]; total: number }> => {
    const params = limit ? `?limit=${limit}` : "";
    return apiRequest(`/api/patients/${patientId}/files${params}`);
  },

  /**
   * Get a signed download URL for a patient's attached file.
   */
  getFileUrl: (
    patientId: string,
    fileId: string
  ): Promise<{ url: string; file_name: string; file_type: string }> => {
    return apiRequest(`/api/patients/${patientId}/files/${fileId}/url`);
  },

  /**
   * Get risk level change history.
   */
  getRiskHistory: (
    patientId: string,
    limit?: number
  ): Promise<{
    patient_id: string;
    current_risk_level: string;
    risk_level_source: string;
    history: RiskHistoryEntry[];
  }> => {
    return apiRequest(
      `/api/patients/${patientId}/risk-history?limit=${limit || 20}`
    );
  },

  /**
   * Acknowledge a report (mark as read).
   */
  acknowledgeReport: (
    patientId: string,
    reportId: string,
    userId: string
  ): Promise<{ success: boolean }> => {
    return apiRequest(
      `/api/patients/${patientId}/reports/${reportId}/acknowledge?acknowledged_by=${userId}`,
      { method: "POST" }
    );
  },
};

// ============================================================
// Alerts API
// ============================================================

export const alertsApi = {
  /**
   * List all alerts.
   */
  list: (params?: {
    acknowledged?: boolean;
    severity?: string;
    limit?: number;
  }): Promise<{ alerts: Alert[]; total: number }> => {
    const searchParams = new URLSearchParams({
      org_id: getOrgId(),
      ...(params?.acknowledged !== undefined && {
        acknowledged: params.acknowledged.toString(),
      }),
      ...(params?.severity && { severity: params.severity }),
      ...(params?.limit && { limit: params.limit.toString() }),
    });
    return apiRequest(`/api/alerts?${searchParams}`);
  },

  /**
   * Get alert statistics.
   */
  getStats: (): Promise<{
    total_unacknowledged: number;
    by_severity: { high: number; medium: number; low: number };
    recent_alerts: Alert[];
  }> => {
    return apiRequest(`/api/alerts/stats/summary?org_id=${getOrgId()}`);
  },

  /**
   * Acknowledge an alert.
   */
  acknowledge: (
    alertId: string,
    patientId: string,
    userId: string
  ): Promise<{ success: boolean }> => {
    return apiRequest(
      `/api/alerts/${alertId}/acknowledge?patient_id=${patientId}&acknowledged_by=${userId}`,
      { method: "POST" }
    );
  },

  /**
   * Run on-demand alert scan for a specific patient.
   */
  scanPatient: (
    patientId: string
  ): Promise<{ success: boolean; patient_id: string; patient_name: string; alerts: Alert[]; error?: string }> => {
    return apiRequest(`/api/alerts/scan/${patientId}?org_id=${getOrgId()}`, {
      method: "POST",
    });
  },

  /**
   * Run on-demand alert scan for all patients.
   */
  scanAll: (
    lookbackDays: number = 7
  ): Promise<{ success: boolean; report: string; scan_results: Record<string, unknown> }> => {
    return apiRequest(
      `/api/alerts/scan?org_id=${getOrgId()}&lookback_days=${lookbackDays}`,
      { method: "POST" }
    );
  },
};

// ============================================================
// Dashboard API
// ============================================================

export interface DashboardStats {
  total_patients: number;
  high_risk_patients: number;
  unacknowledged_alerts: number;
  recent_reports_24h: number;
}

export interface ConnectionStatus {
  slack: { connected: boolean; team_name?: string };
  gemini: { connected: boolean; model?: string };
  vertex: { connected: boolean; project_id?: string };
  firestore: { connected: boolean };
}

export interface NightPatientEvent {
  patient_id: string;
  patient_name: string;
  risk_level: string;
  reports_count: number;
  alerts: {
    severity: string;
    title: string;
    message: string;
    created_at: string;
  }[];
  latest_report: {
    timestamp: string;
    reporter_name: string;
    reporter_role: string;
    raw_text: string;
  } | null;
}

export interface NightSummary {
  window: {
    since: string;
    until: string;
    hours: number;
  };
  summary: {
    total_patients: number;
    patients_with_events: number;
    total_reports: number;
    alerts_by_severity: { high: number; medium: number; low: number };
  };
  patients: NightPatientEvent[];
}

export const dashboardApi = {
  /**
   * Get dashboard statistics.
   */
  getStats: (): Promise<DashboardStats> => {
    return apiRequest(`/api/dashboard/stats?org_id=${getOrgId()}`);
  },

  /**
   * Get recent alerts for dashboard.
   */
  getRecentAlerts: (limit: number = 5): Promise<{ alerts: Alert[] }> => {
    return apiRequest(`/api/dashboard/recent-alerts?org_id=${getOrgId()}&limit=${limit}`);
  },

  /**
   * Get connection status for external services.
   */
  getConnectionStatus: (): Promise<ConnectionStatus> => {
    return apiRequest(`/api/dashboard/connection-status?org_id=${getOrgId()}`);
  },
};

// ============================================================
// Settings API
// ============================================================

export interface SlackConfig {
  configured: boolean;
  team_id?: string;
  team_name?: string;
  bot_id?: string;
  default_channel?: string;
  oncall_channel_name?: string;
  morning_scan_time?: string;
}

export interface GeminiConfig {
  configured: boolean;
  model?: string;
  has_api_key: boolean;
}

export interface VertexConfig {
  configured: boolean;
  project_id?: string;
  region?: string;
  embedding_model?: string;
}

export interface OrganizationSettings {
  id: string;
  name: string;
  admin_email: string;
  status: string;
}

export interface Facility {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

export interface Area {
  id: string;
  name: string;
  code?: string;
}

export interface AgentPromptConfig {
  shared_prompt: string;
  agent_prompts: Record<string, string>;
  is_customized: boolean;
}

export const settingsApi = {
  /**
   * Get Slack configuration.
   */
  getSlackConfig: (): Promise<SlackConfig> => {
    return apiRequest(`/api/settings/slack?org_id=${getOrgId()}`);
  },

  /**
   * Get Gemini configuration.
   */
  getGeminiConfig: (): Promise<GeminiConfig> => {
    return apiRequest(`/api/settings/gemini?org_id=${getOrgId()}`);
  },

  /**
   * Configure Gemini API Key.
   */
  configureGemini: (data: {
    apiKey: string;
    model?: string;
  }): Promise<{ success: boolean; model: string }> => {
    return apiRequest("/api/settings/gemini", {
      method: "POST",
      body: JSON.stringify({
        org_id: getOrgId(),
        api_key: data.apiKey,
        model: data.model || "gemini-3-flash-preview",
      }),
    });
  },

  /**
   * Get Vertex AI configuration.
   */
  getVertexConfig: (): Promise<VertexConfig> => {
    return apiRequest(`/api/settings/vertex?org_id=${getOrgId()}`);
  },

  /**
   * Get organization settings.
   */
  getOrganization: (): Promise<OrganizationSettings> => {
    return apiRequest(`/api/settings/organization?org_id=${getOrgId()}`);
  },

  /**
   * Update organization settings.
   */
  updateOrganization: (data: {
    name?: string;
    adminEmail?: string;
  }): Promise<{ success: boolean; updated_fields: string[] }> => {
    const params = new URLSearchParams({ org_id: getOrgId() });
    if (data.name) params.append("name", data.name);
    if (data.adminEmail) params.append("admin_email", data.adminEmail);
    return apiRequest(`/api/settings/organization?${params}`, {
      method: "PUT",
    });
  },

  /**
   * List facilities.
   */
  listFacilities: (): Promise<{ facilities: Facility[]; total: number }> => {
    return apiRequest(`/api/settings/master/facilities?org_id=${getOrgId()}`);
  },

  /**
   * Create a facility.
   */
  createFacility: (data: {
    name: string;
    address?: string;
    phone?: string;
  }): Promise<{ success: boolean; facility_id: string }> => {
    const params = new URLSearchParams({
      org_id: getOrgId(),
      name: data.name,
      ...(data.address && { address: data.address }),
      ...(data.phone && { phone: data.phone }),
    });
    return apiRequest(`/api/settings/master/facilities?${params}`, {
      method: "POST",
    });
  },

  /**
   * Delete a facility.
   */
  deleteFacility: (facilityId: string): Promise<{ success: boolean }> => {
    return apiRequest(
      `/api/settings/master/facilities/${facilityId}?org_id=${getOrgId()}`,
      { method: "DELETE" }
    );
  },

  /**
   * List areas.
   */
  listAreas: (): Promise<{ areas: Area[]; total: number }> => {
    return apiRequest(`/api/settings/master/areas?org_id=${getOrgId()}`);
  },

  /**
   * Create an area.
   */
  createArea: (data: {
    name: string;
    code?: string;
  }): Promise<{ success: boolean; area_id: string }> => {
    const params = new URLSearchParams({
      org_id: getOrgId(),
      name: data.name,
      ...(data.code && { code: data.code }),
    });
    return apiRequest(`/api/settings/master/areas?${params}`, {
      method: "POST",
    });
  },

  /**
   * Delete an area.
   */
  deleteArea: (areaId: string): Promise<{ success: boolean }> => {
    return apiRequest(
      `/api/settings/master/areas/${areaId}?org_id=${getOrgId()}`,
      { method: "DELETE" }
    );
  },

  /**
   * Create the #oncall-night Slack channel.
   */
  createOncallChannel: (): Promise<{
    success: boolean;
    channel_id: string;
    channel_name: string;
  }> => {
    return apiRequest("/api/settings/slack/oncall-channel", {
      method: "POST",
      body: JSON.stringify({ org_id: getOrgId() }),
    });
  },

  /**
   * Update morning scan report delivery time.
   */
  updateMorningScanTime: (
    time: string
  ): Promise<{ success: boolean; morning_scan_time: string }> => {
    return apiRequest("/api/settings/slack/morning-scan-time", {
      method: "PUT",
      body: JSON.stringify({ org_id: getOrgId(), time }),
    });
  },

  /**
   * Get alert scan schedule times.
   */
  getAlertSchedule: (): Promise<{ alert_scan_times: string[] }> => {
    return apiRequest(`/api/settings/alert-schedule?org_id=${getOrgId()}`);
  },

  /**
   * Update alert scan schedule times.
   */
  updateAlertSchedule: (
    times: string[]
  ): Promise<{ success: boolean; alert_scan_times: string[] }> => {
    return apiRequest("/api/settings/alert-schedule", {
      method: "PUT",
      body: JSON.stringify({ org_id: getOrgId(), alert_scan_times: times }),
    });
  },

  /**
   * Get agent prompt configuration.
   */
  getAgentPrompts: (): Promise<AgentPromptConfig> => {
    return apiRequest(`/api/settings/agents?org_id=${getOrgId()}`);
  },

  /**
   * Update agent prompt configuration.
   */
  updateAgentPrompts: (data: {
    shared_prompt?: string;
    agent_prompts?: Record<string, string>;
  }): Promise<{ success: boolean }> => {
    return apiRequest("/api/settings/agents", {
      method: "PUT",
      body: JSON.stringify({
        org_id: getOrgId(),
        ...data,
      }),
    });
  },

  /**
   * Reset agent prompt to default.
   */
  resetAgentPrompt: (agentId?: string): Promise<{ success: boolean }> => {
    const params = new URLSearchParams({ org_id: getOrgId() });
    if (agentId) params.append("agent_id", agentId);
    return apiRequest(`/api/settings/agents?${params}`, {
      method: "DELETE",
    });
  },
};

// ============================================================
// Users API (Admin)
// ============================================================

export interface OrgMember {
  uid: string;
  email: string;
  display_name?: string;
  role: string;
  organization_id: string | null;
  created_at?: string;
}

export const usersApi = {
  /**
   * List organization members.
   */
  list: (): Promise<{ users: OrgMember[]; total: number }> => {
    return apiRequest("/api/users");
  },

  /**
   * Create a new user.
   */
  create: (data: {
    email: string;
    password: string;
    displayName?: string;
    role: string;
  }): Promise<{ success: boolean; uid: string }> => {
    return apiRequest("/api/users", {
      method: "POST",
      body: JSON.stringify({
        email: data.email,
        password: data.password,
        display_name: data.displayName || "",
        role: data.role,
      }),
    });
  },

  /**
   * Update a user's role.
   */
  updateRole: (
    uid: string,
    role: string
  ): Promise<{ success: boolean; uid: string; role: string }> => {
    return apiRequest(`/api/users/${uid}/role`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  },

  /**
   * Delete a user.
   */
  delete: (uid: string): Promise<{ success: boolean; uid: string }> => {
    return apiRequest(`/api/users/${uid}`, {
      method: "DELETE",
    });
  },
};

// ============================================================
// Knowledge API
// ============================================================

export interface RawFile {
  id: string;
  file_type: "pdf" | "image" | "voice";
  original_name: string;
  size_bytes: number;
  uploaded_by: string;
  gcs_uri: string;
  linked_report_id?: string;
  source?: string;
  created_at?: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  source?: string;
  status: "pending" | "processing" | "indexed" | "error";
  total_chunks: number;
  agent_bindings?: string[];
  file_name?: string;
  file_type?: string;
  gcs_uri?: string;
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
}

export interface SearchResult {
  document_id: string;
  title: string;
  category: string;
  source?: string;
  score: number;
  snippet: string;
}

export const knowledgeApi = {
  /**
   * List knowledge documents.
   */
  listDocuments: (params?: {
    category?: string;
    status?: string;
    limit?: number;
  }): Promise<{ documents: KnowledgeDocument[]; total: number }> => {
    const searchParams = new URLSearchParams({
      org_id: getOrgId(),
      ...(params?.category && { category: params.category }),
      ...(params?.status && { status: params.status }),
      ...(params?.limit && { limit: params.limit.toString() }),
    });
    return apiRequest(`/api/knowledge/documents?${searchParams}`);
  },

  /**
   * Create a new knowledge document.
   */
  createDocument: (data: {
    title: string;
    category: string;
    source?: string;
  }): Promise<{ success: boolean; document_id: string }> => {
    const params = new URLSearchParams({
      org_id: getOrgId(),
      title: data.title,
      category: data.category,
      ...(data.source && { source: data.source }),
    });
    return apiRequest(`/api/knowledge/documents?${params}`, {
      method: "POST",
    });
  },

  /**
   * Upload a file for a knowledge document.
   */
  uploadFile: async (
    documentId: string,
    file: File
  ): Promise<{ success: boolean; document_id: string; status: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const token = await getIdToken();
    const response = await fetch(
      `${API_BASE_URL}/api/knowledge/documents/${documentId}/upload?org_id=${getOrgId()}`,
      {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "アップロードエラー" }));
      throw new Error(error.detail || `HTTP ${response.status}`);
    }

    return response.json();
  },

  /**
   * Get a knowledge document.
   */
  getDocument: (documentId: string): Promise<{ document: KnowledgeDocument }> => {
    return apiRequest(`/api/knowledge/documents/${documentId}?org_id=${getOrgId()}`);
  },

  /**
   * Update a knowledge document.
   */
  updateDocument: (
    documentId: string,
    data: { title?: string; category?: string; source?: string }
  ): Promise<{ success: boolean; updated_fields: string[] }> => {
    const params = new URLSearchParams({
      org_id: getOrgId(),
      ...(data.title && { title: data.title }),
      ...(data.category && { category: data.category }),
      ...(data.source && { source: data.source }),
    });
    return apiRequest(`/api/knowledge/documents/${documentId}?${params}`, {
      method: "PUT",
    });
  },

  /**
   * Delete a knowledge document.
   */
  deleteDocument: (documentId: string): Promise<{ success: boolean }> => {
    return apiRequest(`/api/knowledge/documents/${documentId}?org_id=${getOrgId()}`, {
      method: "DELETE",
    });
  },

  /**
   * Search knowledge base.
   */
  search: (
    query: string,
    params?: { category?: string; limit?: number }
  ): Promise<{ results: SearchResult[]; query: string; total: number }> => {
    const searchParams = new URLSearchParams({
      org_id: getOrgId(),
      query,
      ...(params?.category && { category: params.category }),
      ...(params?.limit && { limit: params.limit.toString() }),
    });
    return apiRequest(`/api/knowledge/search?${searchParams}`, {
      method: "POST",
    });
  },

  /**
   * List knowledge categories.
   */
  listCategories: (): Promise<{ categories: KnowledgeCategory[] }> => {
    return apiRequest("/api/knowledge/categories");
  },

  /**
   * Update agent bindings for a document.
   */
  updateAgentBindings: (
    documentId: string,
    agentIds: string[]
  ): Promise<{ success: boolean; agent_bindings: string[] }> => {
    const params = new URLSearchParams({
      org_id: getOrgId(),
    });
    agentIds.forEach((id) => params.append("agent_ids", id));
    return apiRequest(`/api/knowledge/documents/${documentId}/bindings?${params}`, {
      method: "PUT",
    });
  },

  /**
   * Get a signed download URL for the original document file.
   */
  getDownloadUrl: (
    documentId: string
  ): Promise<{ url: string; file_name: string }> => {
    return apiRequest(
      `/api/knowledge/documents/${documentId}/download?org_id=${getOrgId()}`
    );
  },

  /**
   * Get chunks for a knowledge document.
   */
  getChunks: (
    documentId: string
  ): Promise<{
    chunks: Array<{
      id: string;
      chunk_index: number;
      text: string;
      token_count: number;
      category?: string;
      source?: string;
    }>;
    total: number;
  }> => {
    return apiRequest(
      `/api/knowledge/documents/${documentId}/chunks?org_id=${getOrgId()}`
    );
  },
};

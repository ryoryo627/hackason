/**
 * API Client for HomeCare AI Backend.
 *
 * Handles all API requests with authentication and error handling.
 */

import { getIdToken } from "./firebase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

// Default organization ID for demo
const DEFAULT_ORG_ID = "demo-org";

/**
 * Get the current organization ID.
 * In production, this would come from the user's session.
 */
export function getOrgId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("org_id") || DEFAULT_ORG_ID;
  }
  return DEFAULT_ORG_ID;
}

/**
 * Set the current organization ID.
 */
export function setOrgId(orgId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("org_id", orgId);
  }
}

/**
 * API request helper with authentication.
 */
async function apiRequest<T>(
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
    const error = await response.json().catch(() => ({ detail: "APIエラー" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ============================================================
// Setup API
// ============================================================

export interface SlackTestResult {
  success: boolean;
  team?: {
    id: string;
    name: string;
    domain: string;
  };
  bot?: {
    id: string;
    name: string;
  };
  error?: string;
}

export interface SetupStatus {
  organization: {
    id: string;
    name: string;
    status: string;
  };
  slack: {
    configured: boolean;
    team_name?: string;
  };
  gemini: {
    configured: boolean;
  };
  vertex: {
    configured: boolean;
  };
}

export const setupApi = {
  /**
   * Test Slack connection with a bot token.
   */
  testSlackConnection: (botToken: string): Promise<SlackTestResult> => {
    return apiRequest("/api/setup/slack/test", {
      method: "POST",
      body: JSON.stringify({ bot_token: botToken }),
    });
  },

  /**
   * Configure Slack integration.
   */
  configureSlack: (data: {
    botToken: string;
    signingSecret: string;
    defaultChannel?: string;
  }): Promise<{ success: boolean; team: unknown; bot: unknown }> => {
    return apiRequest("/api/setup/slack/configure", {
      method: "POST",
      body: JSON.stringify({
        org_id: getOrgId(),
        bot_token: data.botToken,
        signing_secret: data.signingSecret,
        default_channel: data.defaultChannel,
      }),
    });
  },

  /**
   * Initialize organization.
   */
  initOrganization: (data: {
    orgId: string;
    name: string;
    adminEmail: string;
  }): Promise<{ success: boolean; org_id: string }> => {
    return apiRequest("/api/setup/init", {
      method: "POST",
      body: JSON.stringify({
        org_id: data.orgId,
        name: data.name,
        admin_email: data.adminEmail,
      }),
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
    return apiRequest(`/api/setup/slack/users/${getOrgId()}`);
  },
};

// ============================================================
// Patients API
// ============================================================

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
  slack_channel_id?: string;
  slack_channel_name?: string;
  org_id: string;
  created_at?: string;
  updated_at?: string;
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
    data: Partial<CreatePatientData>
  ): Promise<{ success: boolean; updated_fields: string[] }> => {
    return apiRequest(`/api/patients/${patientId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * Get patient reports.
   */
  getReports: (
    patientId: string,
    limit?: number
  ): Promise<{ patient_id: string; reports: Report[]; total: number }> => {
    const params = limit ? `?limit=${limit}` : "";
    return apiRequest(`/api/patients/${patientId}/reports${params}`);
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
  slack_configured: boolean;
  gemini_configured: boolean;
  vertex_configured: boolean;
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
   * Configure Gemini.
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
   * Configure Vertex AI.
   */
  configureVertex: (data: {
    projectId: string;
    region?: string;
    embeddingModel?: string;
  }): Promise<{ success: boolean; project_id: string; region: string }> => {
    return apiRequest("/api/settings/vertex", {
      method: "POST",
      body: JSON.stringify({
        org_id: getOrgId(),
        project_id: data.projectId,
        region: data.region || "asia-northeast1",
        embedding_model: data.embeddingModel || "text-embedding-005",
      }),
    });
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
};

// ============================================================
// Knowledge API
// ============================================================

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

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/knowledge/documents/${documentId}/upload?org_id=${getOrgId()}`,
      {
        method: "POST",
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
};

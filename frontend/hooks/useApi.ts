"use client";

/**
 * SWR-based data fetching hooks for HomeCare AI.
 *
 * Global SWR config (fetcher, revalidateOnFocus, dedupingInterval, errorRetryCount)
 * is provided by <Providers> in layout.tsx. Hooks here only specify overrides.
 */

import useSWR from "swr";
import {
  getOrgId,
  type Patient,
  type Report,
  type Alert,
  type BPSContext,
  type DashboardStats,
  type ConnectionStatus,
  type NightSummary,
  type AgentPromptConfig,
  type RiskHistoryEntry,
} from "@/lib/api";

// ============================================================
// Helpers
// ============================================================

/**
 * Safe org_id getter that returns null instead of throwing.
 * Returns null when org is not yet set (e.g. setup flow).
 */
function safeGetOrgId(): string | null {
  try {
    return getOrgId();
  } catch {
    return null;
  }
}

// ============================================================
// Dashboard Hooks
// ============================================================

export function useDashboardStats() {
  const orgId = safeGetOrgId();
  return useSWR<DashboardStats>(
    orgId ? `/api/dashboard/stats?org_id=${orgId}` : null,
    { refreshInterval: 60000 }
  );
}

export function useRecentAlerts(limit: number = 5) {
  const orgId = safeGetOrgId();
  return useSWR<{ alerts: Alert[] }>(
    orgId ? `/api/dashboard/recent-alerts?org_id=${orgId}&limit=${limit}` : null,
    { refreshInterval: 60000 }
  );
}

export function useNightSummary(hours: number = 14) {
  const orgId = safeGetOrgId();
  return useSWR<NightSummary>(
    orgId ? `/api/dashboard/night-summary?org_id=${orgId}&hours=${hours}` : null,
    { refreshInterval: 60000 }
  );
}

export function useConnectionStatus() {
  const orgId = safeGetOrgId();
  return useSWR<ConnectionStatus>(
    orgId ? `/api/dashboard/connection-status?org_id=${orgId}` : null,
    { revalidateOnFocus: false }
  );
}

// ============================================================
// Patient Hooks
// ============================================================

export function usePatients(params?: {
  status?: string;
  risk_level?: string;
  facility?: string;
  area?: string;
  limit?: number;
}) {
  const orgId = safeGetOrgId();
  const searchParams = new URLSearchParams({
    org_id: orgId || "",
    ...(params?.status && { status: params.status }),
    ...(params?.risk_level && { risk_level: params.risk_level }),
    ...(params?.facility && { facility: params.facility }),
    ...(params?.area && { area: params.area }),
    ...(params?.limit && { limit: params.limit.toString() }),
  });
  return useSWR<{ patients: Patient[]; total: number }>(
    orgId ? `/api/patients?${searchParams}` : null
  );
}

export function usePatient(patientId: string | null) {
  return useSWR<{
    patient: Patient;
    recent_reports: Report[];
    alerts: Alert[];
    context: BPSContext | null;
    risk_history: RiskHistoryEntry[];
  }>(patientId ? `/api/patients/${patientId}` : null);
}

export function useRiskHistory(patientId: string | null, limit = 10) {
  return useSWR<{
    patient_id: string;
    current_risk_level: string;
    risk_level_source: string;
    history: RiskHistoryEntry[];
  }>(
    patientId ? `/api/patients/${patientId}/risk-history?limit=${limit}` : null
  );
}

export function usePatientReports(
  patientId: string | null,
  params?: { limit?: number; acknowledged?: boolean }
) {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.set("limit", params.limit.toString());
  if (params?.acknowledged !== undefined)
    searchParams.set("acknowledged", params.acknowledged.toString());
  const qs = searchParams.toString();
  return useSWR<{ patient_id: string; reports: Report[]; total: number }>(
    patientId ? `/api/patients/${patientId}/reports${qs ? `?${qs}` : ""}` : null
  );
}

// ============================================================
// Alert Hooks
// ============================================================

export function useAlerts(params?: {
  acknowledged?: boolean;
  severity?: string;
  limit?: number;
}) {
  const orgId = safeGetOrgId();
  const searchParams = new URLSearchParams({
    org_id: orgId || "",
    ...(params?.acknowledged !== undefined && {
      acknowledged: params.acknowledged.toString(),
    }),
    ...(params?.severity && { severity: params.severity }),
    ...(params?.limit && { limit: params.limit.toString() }),
  });
  return useSWR<{ alerts: Alert[]; total: number }>(
    orgId ? `/api/alerts?${searchParams}` : null,
    { refreshInterval: 60000 }
  );
}

// ============================================================
// Activity Feed Hook
// ============================================================

export interface ActivityItem {
  id: string;
  patient_id: string;
  patient_name: string;
  timestamp: string;
  reporter_name: string;
  reporter_role: string;
  raw_text: string;
  bps_classification?: {
    bio?: string[];
    psycho?: string[];
    social?: string[];
  };
}

export function useActivityFeed(limit: number = 20, hours: number = 48) {
  const orgId = safeGetOrgId();
  return useSWR<{ activities: ActivityItem[] }>(
    orgId
      ? `/api/dashboard/activity-feed?org_id=${orgId}&limit=${limit}&hours=${hours}`
      : null,
    { refreshInterval: 60000 }
  );
}

// ============================================================
// Alert Stats Hook
// ============================================================

export function useAlertStats() {
  const orgId = safeGetOrgId();
  return useSWR<{
    total_unacknowledged: number;
    by_severity: { high: number; medium: number; low: number };
    recent_alerts: Alert[];
  }>(
    orgId ? `/api/alerts/stats/summary?org_id=${orgId}` : null,
    { refreshInterval: 60000 }
  );
}

// ============================================================
// Knowledge Hooks
// ============================================================

import type { KnowledgeDocument, KnowledgeCategory, SearchResult } from "@/lib/api";

export function useKnowledgeDocuments(category?: string) {
  const orgId = safeGetOrgId();
  const params = new URLSearchParams({
    org_id: orgId || "",
    ...(category && { category }),
  });
  return useSWR<{ documents: KnowledgeDocument[]; total: number }>(
    orgId ? `/api/knowledge/documents?${params}` : null
  );
}

export function useKnowledgeCategories() {
  return useSWR<{ categories: KnowledgeCategory[] }>(
    "/api/knowledge/categories"
  );
}

export function useKnowledgeSearch(query: string, category?: string) {
  const orgId = safeGetOrgId();
  const params = new URLSearchParams({
    org_id: orgId || "",
    query,
    ...(category && { category }),
    limit: "10",
  });
  return useSWR<{ results: SearchResult[]; query: string; total: number }>(
    orgId && query ? `/api/knowledge/search?${params}` : null,
    { revalidateOnFocus: false }
  );
}

export interface KnowledgeChunk {
  id: string;
  chunk_index: number;
  text: string;
  token_count: number;
  category?: string;
  source?: string;
}

export function useKnowledgeChunks(docId: string | null) {
  const orgId = safeGetOrgId();
  return useSWR<{ chunks: KnowledgeChunk[]; total: number }>(
    orgId && docId
      ? `/api/knowledge/documents/${docId}/chunks?org_id=${orgId}`
      : null,
    { revalidateOnFocus: false }
  );
}

// ============================================================
// Agent Prompts Hook
// ============================================================

export function useAgentPrompts() {
  const orgId = safeGetOrgId();
  return useSWR<AgentPromptConfig>(
    orgId ? `/api/settings/agents?org_id=${orgId}` : null
  );
}

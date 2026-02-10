"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  Badge,
  SeverityBadge,
  RiskBadge,
  Button,
  Tabs,
  SkeletonText,
  EmptyState,
} from "@/components/ui";
import {
  AlertTriangle,
  Check,
  Eye,
  Loader2,
  Users,
  FileText,
  Clock,
  Link as LinkIcon,
  ChevronRight,
  Bell,
  Moon,
  BookOpen,
} from "lucide-react";
import { alertsApi, type Alert, type Patient, type DashboardStats } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  useAlerts,
  useAlertStats,
  usePatients,
  useActivityFeed,
  useConnectionStatus,
  useNightSummary,
  useKnowledgeDocuments,
  type ActivityItem,
} from "@/hooks/useApi";

// ============================================================
// Reporter role Japanese labels
// ============================================================

const ROLE_LABELS: Record<string, string> = {
  nurse: "看護師",
  pharmacist: "薬剤師",
  care_manager: "ケアマネ",
  doctor: "医師",
  family: "家族",
  other: "その他",
};

const ROLE_COLORS: Record<string, string> = {
  nurse: "bg-accent-50 text-accent-700",
  pharmacist: "bg-success-subtle text-success",
  care_manager: "bg-warning-subtle text-warning",
  doctor: "bg-danger-subtle text-danger",
  family: "bg-bg-secondary text-text-primary",
  other: "bg-bg-secondary text-text-secondary",
};

// ============================================================
// 3a. PriorityAlertBanner
// ============================================================

export function PriorityAlertBanner() {
  const { user } = useAuth();
  const { data: alertStats } = useAlertStats();
  const { data: alertsData, mutate } = useAlerts({
    acknowledged: false,
    severity: "high",
    limit: 3,
  });
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const router = useRouter();

  const highCount = alertStats?.by_severity?.high ?? 0;
  const criticalAlerts = alertsData?.alerts ?? [];

  if (highCount === 0) return null;

  const handleAcknowledge = async (alert: Alert) => {
    if (!alert.patient_id || acknowledging) return;
    try {
      setAcknowledging(alert.id);
      await alertsApi.acknowledge(alert.id, alert.patient_id, user?.uid || "anonymous");
      mutate();
    } catch (err) {
      console.error("Acknowledge error:", err);
    } finally {
      setAcknowledging(null);
    }
  };

  return (
    <Card className="border-danger/30 bg-danger-light mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-5 h-5 text-danger" />
        <span className="font-semibold text-danger">
          {highCount}件の緊急アラートが未確認です
        </span>
      </div>
      <div className="space-y-2">
        {criticalAlerts.map((alert) => (
          <div
            key={alert.id}
            className="flex items-center justify-between bg-white/80 rounded-md px-3 py-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <SeverityBadge severity="HIGH" />
              <span className="font-medium text-text-primary truncate">
                {alert.patient_name || "患者名不明"}
              </span>
              <span className="text-sm text-text-secondary truncate hidden sm:inline">
                {alert.title}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              {alert.patient_id && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/patients/${alert.patient_id}`)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleAcknowledge(alert)}
                disabled={acknowledging === alert.id}
              >
                {acknowledging === alert.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    確認
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// 3b. EnhancedStatCard
// ============================================================

export function EnhancedStatCards({
  stats,
  loading,
}: {
  stats: DashboardStats | undefined;
  loading: boolean;
}) {
  const { data: alertStats } = useAlertStats();
  const { data: patientsData } = usePatients();

  // Risk distribution from patient data
  const patients = patientsData?.patients ?? [];
  const riskCounts = {
    high: patients.filter((p) => p.risk_level === "high").length,
    medium: patients.filter((p) => p.risk_level === "medium").length,
    low: patients.filter(
      (p) => p.risk_level === "low" || !p.risk_level
    ).length,
  };
  const totalPatients = patients.length || stats?.total_patients || 0;

  const bySeverity = alertStats?.by_severity ?? { high: 0, medium: 0, low: 0 };

  const cards = [
    {
      title: "総患者数",
      value: stats?.total_patients ?? 0,
      icon: Users,
      color: "bg-accent-50 text-accent-600",
      detail: totalPatients > 0 ? (
        <RiskDistributionMiniBar counts={riskCounts} total={totalPatients} />
      ) : null,
    },
    {
      title: "高リスク患者",
      value: stats?.high_risk_patients ?? 0,
      icon: AlertTriangle,
      color: "bg-danger-subtle text-danger",
      detail: null,
    },
    {
      title: "未確認アラート",
      value: stats?.unacknowledged_alerts ?? 0,
      icon: AlertTriangle,
      color: "bg-warning-subtle text-warning",
      detail:
        (bySeverity.high > 0 || bySeverity.medium > 0) ? (
          <div className="flex gap-1.5 mt-1">
            {bySeverity.high > 0 && (
              <Badge variant="danger" size="sm">緊急 {bySeverity.high}</Badge>
            )}
            {bySeverity.medium > 0 && (
              <Badge variant="warning" size="sm">注意 {bySeverity.medium}</Badge>
            )}
          </div>
        ) : null,
    },
    {
      title: "24時間の報告数",
      value: stats?.recent_reports_24h ?? 0,
      icon: FileText,
      color: "bg-success-subtle text-success",
      detail: null,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card) => (
        <div key={card.title} className="animate-slide-up">
          <Card>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-text-secondary">{card.title}</p>
                {loading ? (
                  <div className="h-8 flex items-center">
                    <div className="h-8 w-24 bg-bg-hover rounded animate-skeleton" />
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-text-primary tabular-nums">
                    {card.value}
                  </p>
                )}
                {!loading && card.detail}
              </div>
            </div>
          </Card>
        </div>
      ))}
    </div>
  );
}

function RiskDistributionMiniBar({
  counts,
  total,
}: {
  counts: { high: number; medium: number; low: number };
  total: number;
}) {
  if (total === 0) return null;
  const pct = (n: number) => Math.max((n / total) * 100, n > 0 ? 4 : 0);
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-bg-tertiary">
        <div
          className="bg-danger rounded-l-full"
          style={{ width: `${pct(counts.high)}%` }}
        />
        <div className="bg-warning" style={{ width: `${pct(counts.medium)}%` }} />
        <div
          className="bg-success rounded-r-full"
          style={{ width: `${pct(counts.low)}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// 3c. AlertFeed
// ============================================================

export function AlertFeed() {
  const { user } = useAuth();
  const router = useRouter();
  const { data: alertsData, isLoading, mutate } = useAlerts({
    acknowledged: false,
    limit: 15,
  });
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const alerts = alertsData?.alerts ?? [];

  const handleAcknowledge = async (alert: Alert) => {
    if (!alert.patient_id || acknowledging) return;
    try {
      setAcknowledging(alert.id);
      await alertsApi.acknowledge(alert.id, alert.patient_id, user?.uid || "anonymous");
      mutate();
    } catch (err) {
      console.error("Acknowledge error:", err);
    } finally {
      setAcknowledging(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-4 px-1">
        <SkeletonText lines={5} />
      </div>
    );
  }

  if (alerts.length === 0) {
    return <EmptyState title="アラートなし" description="未確認のアラートはありません" />;
  }

  return (
    <div>
      <div className="space-y-2">
        {alerts.map((alert) => {
          const borderColor =
            alert.severity === "high"
              ? "border-l-danger"
              : alert.severity === "medium"
                ? "border-l-warning"
                : "border-l-accent-400";
          return (
            <div
              key={alert.id}
              className={`border-l-2 ${borderColor} bg-bg-secondary rounded-md px-3 py-2.5`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <SeverityBadge
                      severity={alert.severity.toUpperCase() as "HIGH" | "MEDIUM" | "LOW"}
                    />
                    <span className="font-medium text-text-primary text-sm truncate">
                      {alert.patient_name || "患者名不明"}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate">{alert.title}</p>
                  <p className="text-xs text-text-tertiary mt-1 line-clamp-2">
                    {alert.message}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {alert.patient_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/patients/${alert.patient_id}`)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAcknowledge(alert)}
                    disabled={acknowledging === alert.id}
                  >
                    {acknowledging === alert.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 mr-0.5" />
                        確認
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-center">
        <Button variant="ghost" size="sm" onClick={() => router.push("/alerts")}>
          すべてのアラートを表示
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// 3d. ActivityTimeline
// ============================================================

export function ActivityTimeline() {
  const router = useRouter();
  const { data, isLoading } = useActivityFeed(20, 48);
  const activities = data?.activities ?? [];

  if (isLoading) {
    return (
      <div className="py-4 px-1">
        <SkeletonText lines={5} />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <EmptyState
        title="報告なし"
        description="直近48時間の報告はありません"
        icon={FileText}
      />
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

      <div className="space-y-3">
        {activities.map((activity) => (
          <div key={activity.id} className="relative pl-8">
            {/* Timeline dot */}
            <div className="absolute left-[9px] top-2 w-1.5 h-1.5 rounded-full bg-accent-400" />

            <div className="bg-bg-secondary rounded-md px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <time className="text-xs text-text-tertiary tabular-nums">
                  {formatTimeAgo(activity.timestamp)}
                </time>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded font-medium ${ROLE_COLORS[activity.reporter_role] || ROLE_COLORS.other}`}
                >
                  {ROLE_LABELS[activity.reporter_role] || activity.reporter_role}
                </span>
              </div>
              <button
                onClick={() => router.push(`/patients/${activity.patient_id}`)}
                className="text-sm font-medium text-accent-600 hover:text-accent-700 hover:underline"
              >
                {activity.patient_name}
              </button>
              <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                {activity.raw_text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

// ============================================================
// 3e. PatientRiskPanel
// ============================================================

export function PatientRiskPanel() {
  const router = useRouter();
  const { data: patientsData, isLoading } = usePatients();
  const patients = patientsData?.patients ?? [];

  const riskGroups = {
    high: patients.filter((p) => p.risk_level === "high"),
    medium: patients.filter((p) => p.risk_level === "medium"),
    low: patients.filter((p) => p.risk_level === "low" || !p.risk_level),
  };
  const total = patients.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="患者リスク概要" />
        <SkeletonText lines={4} />
      </Card>
    );
  }

  if (total === 0) {
    return (
      <Card>
        <CardHeader title="患者リスク概要" />
        <EmptyState
          title="患者なし"
          description="登録された患者がいません"
          icon={Users}
        />
      </Card>
    );
  }

  const pct = (n: number) => Math.max((n / total) * 100, n > 0 ? 3 : 0);

  return (
    <Card>
      <CardHeader title="患者リスク概要" />

      {/* Risk distribution bar */}
      <div className="mb-4">
        <div className="flex h-3 rounded-full overflow-hidden bg-bg-tertiary">
          <div
            className="bg-danger transition-all"
            style={{ width: `${pct(riskGroups.high.length)}%` }}
            title={`高リスク: ${riskGroups.high.length}`}
          />
          <div
            className="bg-warning transition-all"
            style={{ width: `${pct(riskGroups.medium.length)}%` }}
            title={`中リスク: ${riskGroups.medium.length}`}
          />
          <div
            className="bg-success transition-all"
            style={{ width: `${pct(riskGroups.low.length)}%` }}
            title={`低リスク: ${riskGroups.low.length}`}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-secondary">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-danger" />
            高: {riskGroups.high.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-warning" />
            中: {riskGroups.medium.length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success" />
            低: {riskGroups.low.length}
          </span>
        </div>
      </div>

      {/* High-risk patient list */}
      {riskGroups.high.length > 0 && (
        <>
          <div className="border-t border-border pt-3 mb-2">
            <p className="text-xs font-medium text-text-secondary mb-2">高リスク患者</p>
          </div>
          <div className="space-y-2">
            {riskGroups.high.slice(0, 5).map((patient) => (
              <button
                key={patient.id}
                onClick={() => router.push(`/patients/${patient.id}`)}
                className="flex items-center justify-between w-full bg-bg-secondary hover:bg-bg-tertiary rounded-md px-3 py-2 text-left transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-text-primary">
                    {patient.name}
                  </span>
                  <span className="text-xs text-text-tertiary ml-2">
                    {patient.age ? `${patient.age}歳` : ""}
                    {patient.primary_diagnosis ? ` ${patient.primary_diagnosis}` : ""}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-3 text-center">
        <Button variant="ghost" size="sm" onClick={() => router.push("/patients")}>
          全患者を表示
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </Card>
  );
}

// ============================================================
// 3f. CompactConnectionStatus
// ============================================================

export function CompactConnectionStatus() {
  const { data, isLoading } = useConnectionStatus();
  const { data: knowledgeData } = useKnowledgeDocuments();

  if (isLoading || !data) return null;

  const services = [
    { name: "Slack", connected: data.slack.connected, detail: data.slack.team_name },
    { name: "Gemini", connected: data.gemini.connected, detail: data.gemini.model },
    { name: "Vertex AI", connected: data.vertex?.connected ?? false },
    { name: "Firestore", connected: data.firestore.connected },
  ];

  const knowledgeDocs = knowledgeData?.documents ?? [];
  const indexedDocs = knowledgeDocs.filter((d) => d.status === "indexed");
  const totalChunks = indexedDocs.reduce((sum, d) => sum + (d.total_chunks ?? 0), 0);

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-bg-secondary rounded-md text-sm flex-wrap">
      <span className="text-text-tertiary flex items-center gap-1.5">
        <LinkIcon className="w-3.5 h-3.5" />
        接続状態
      </span>
      {services.map((svc) => (
        <span key={svc.name} className="flex items-center gap-1.5 text-text-secondary">
          <span
            className={`w-1.5 h-1.5 rounded-full ${svc.connected ? "bg-success" : "bg-border-strong"}`}
          />
          {svc.name}
        </span>
      ))}
      <span className="border-l border-border pl-4 flex items-center gap-1.5 text-text-secondary">
        <BookOpen className="w-3.5 h-3.5" />
        ナレッジ: {indexedDocs.length}件 / {totalChunks}チャンク
      </span>
    </div>
  );
}

// ============================================================
// 3g. NightEventsSummary
// ============================================================

export function NightEventsSummary() {
  const router = useRouter();
  const { data, isLoading } = useNightSummary(14);

  if (isLoading) {
    return (
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Moon className="w-5 h-5 text-accent-500" />
          <h3 className="font-semibold text-text-primary">夜間イベントサマリー</h3>
        </div>
        <SkeletonText lines={4} />
      </Card>
    );
  }

  if (!data) return null;

  const { summary, patients, window } = data;

  return (
    <Card className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="w-5 h-5 text-accent-500" />
          <h3 className="font-semibold text-text-primary">夜間イベントサマリー</h3>
        </div>
        <span className="text-xs text-text-tertiary">
          18:00〜08:00（{window.hours}h）
        </span>
      </div>

      {patients.length === 0 ? (
        <EmptyState
          title="夜間の状態変化はありません"
          description="対象期間内にイベントは検出されませんでした"
          icon={Moon}
        />
      ) : (
        <>
          {/* Summary stats */}
          <div className="flex items-center gap-4 mb-4 flex-wrap">
            <span className="text-sm text-text-secondary">
              変化あり: <span className="font-semibold text-text-primary">{summary.patients_with_events}名</span> / 全{summary.total_patients}名
            </span>
            <div className="flex gap-1.5">
              {summary.alerts_by_severity.high > 0 && (
                <Badge variant="danger" size="sm">緊急 {summary.alerts_by_severity.high}</Badge>
              )}
              {summary.alerts_by_severity.medium > 0 && (
                <Badge variant="warning" size="sm">注意 {summary.alerts_by_severity.medium}</Badge>
              )}
              {summary.alerts_by_severity.low > 0 && (
                <Badge variant="default" size="sm">情報 {summary.alerts_by_severity.low}</Badge>
              )}
            </div>
            <span className="text-sm text-text-tertiary">
              報告 {summary.total_reports}件
            </span>
          </div>

          {/* Patient event cards */}
          <div className="space-y-2">
            {patients.map((patient) => {
              const maxSeverity = patient.alerts.length > 0
                ? patient.alerts.reduce((max, a) => {
                    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
                    return (order[a.severity] ?? 2) < (order[max] ?? 2) ? a.severity : max;
                  }, patient.alerts[0].severity)
                : null;
              const borderColor = maxSeverity === "high"
                ? "border-l-danger"
                : maxSeverity === "medium"
                  ? "border-l-warning"
                  : "border-l-accent-400";

              return (
                <div
                  key={patient.patient_id}
                  className={`border-l-2 ${borderColor} bg-bg-secondary rounded-md px-3 py-2.5`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <button
                          onClick={() => router.push(`/patients/${patient.patient_id}`)}
                          className="font-medium text-sm text-accent-600 hover:text-accent-700 hover:underline truncate"
                        >
                          {patient.patient_name}
                        </button>
                        {patient.alerts.length > 0 && (
                          <SeverityBadge
                            severity={(maxSeverity || "low").toUpperCase() as "HIGH" | "MEDIUM" | "LOW"}
                          />
                        )}
                        {patient.alerts.length > 0 && patient.alerts[0].created_at && (
                          <span className="text-xs text-text-tertiary tabular-nums">
                            {formatTimeAgo(patient.alerts[0].created_at)}
                          </span>
                        )}
                      </div>
                      {patient.alerts.length > 0 && (
                        <p className="text-xs text-text-secondary truncate">
                          {patient.alerts[0].title}
                        </p>
                      )}
                      {patient.latest_report && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 text-xs rounded font-medium ${ROLE_COLORS[patient.latest_report.reporter_role] || ROLE_COLORS.other}`}
                          >
                            {ROLE_LABELS[patient.latest_report.reporter_role] || patient.latest_report.reporter_role}
                          </span>
                          <p className="text-xs text-text-tertiary line-clamp-1 min-w-0">
                            {patient.latest_report.raw_text}
                          </p>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/patients/${patient.patient_id}`)}
                      className="shrink-0"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}

// ============================================================
// AlertActivityTabs - Tab container for AlertFeed + ActivityTimeline
// ============================================================

export function AlertActivityTabs() {
  const [activeTab, setActiveTab] = useState("alerts");
  const { data: alertsData } = useAlerts({ acknowledged: false, limit: 15 });
  const unacknowledgedCount = alertsData?.alerts?.length ?? 0;

  const tabs = [
    { id: "alerts", label: "アラート", badge: unacknowledgedCount, icon: AlertTriangle },
    { id: "activity", label: "最近の報告", icon: Clock },
  ];

  return (
    <Card>
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-4" />
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "alerts" ? <AlertFeed /> : <ActivityTimeline />}
      </div>
    </Card>
  );
}

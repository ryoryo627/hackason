"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, SeverityBadge, Badge, Select } from "@/components/ui";
import { Check, AlertTriangle, Eye, Loader2, Filter, X, ChevronLeft } from "lucide-react";
import { alertsApi, Alert } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useAlerts } from "@/hooks/useApi";

type SeverityFilter = "all" | "high" | "medium" | "low";
type AcknowledgedFilter = "all" | "unacknowledged" | "acknowledged";

export default function AlertsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [acknowledgedFilter, setAcknowledgedFilter] =
    useState<AcknowledgedFilter>("unacknowledged");

  // SWR data fetching with filters
  const alertParams = {
    ...(acknowledgedFilter === "unacknowledged" && { acknowledged: false }),
    ...(acknowledgedFilter === "acknowledged" && { acknowledged: true }),
    ...(severityFilter !== "all" && { severity: severityFilter }),
  };
  const { data: alertsData, isLoading: loading, error: swrError, mutate } = useAlerts(alertParams);
  const alerts = alertsData?.alerts ?? [];
  const error = swrError?.message ?? actionError;

  // Acknowledge alert
  const handleAcknowledge = async (alert: Alert) => {
    if (!alert.patient_id || acknowledging) return;

    try {
      setAcknowledging(alert.id);
      setActionError(null);
      await alertsApi.acknowledge(
        alert.id,
        alert.patient_id,
        user?.uid || "anonymous"
      );
      mutate();
    } catch (err) {
      console.error("Acknowledge error:", err);
      setActionError(err instanceof Error ? err.message : "確認に失敗しました");
    } finally {
      setAcknowledging(null);
    }
  };

  // Navigate to patient
  const handleViewPatient = (patientId: string | undefined) => {
    if (patientId) {
      router.push(`/patients/${patientId}`);
    }
  };

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;
  const hasActiveFilters = severityFilter !== "all" || acknowledgedFilter !== "all";

  const clearFilters = () => {
    setSeverityFilter("all");
    setAcknowledgedFilter("unacknowledged");
  };

  return (
    <AdminLayout title="アラート一覧">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        ダッシュボード
      </button>

      {/* Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-sm text-text-secondary">未確認</span>
            <span className="text-xl font-semibold text-text-primary tabular-nums">
              {unacknowledgedCount}
            </span>
          </div>
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">表示</span>
            <span className="text-xl font-semibold text-text-primary tabular-nums">
              {alerts.length}
            </span>
          </div>
        </div>
        <div className="sm:ml-auto">
          <Button
            variant={showFilters || hasActiveFilters ? "primary" : "secondary"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            フィルタ
            {hasActiveFilters && (
              <span className="ml-1 bg-white text-accent-600 rounded-full px-1.5 text-xs">
                !
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-text-primary">フィルタ条件</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                クリア
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="重要度"
              value={severityFilter}
              onChange={(val) => setSeverityFilter(val as SeverityFilter)}
              options={[
                { value: "all", label: "すべて" },
                { value: "high", label: "緊急" },
                { value: "medium", label: "注意" },
                { value: "low", label: "低" },
              ]}
            />
            <Select
              label="確認状態"
              value={acknowledgedFilter}
              onChange={(val) => setAcknowledgedFilter(val as AcknowledgedFilter)}
              options={[
                { value: "all", label: "すべて" },
                { value: "unacknowledged", label: "未確認のみ" },
                { value: "acknowledged", label: "確認済みのみ" },
              ]}
            />
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-danger-subtle border border-danger/20 rounded-lg text-danger">
          {error}
        </div>
      )}

      {/* Alert List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-text-secondary">
            {hasActiveFilters
              ? "条件に一致するアラートがありません"
              : "アラートはありません"}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const borderColor =
              alert.severity === "high" ? "border-l-danger" :
              alert.severity === "medium" ? "border-l-warning" :
              "border-l-accent-400";
            return (
            <Card
              key={alert.id}
              className={`border-l-2 ${borderColor} ${alert.acknowledged ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <SeverityBadge severity={alert.severity.toUpperCase() as "HIGH" | "MEDIUM" | "LOW"} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-text-primary">
                        {alert.patient_name || "患者名不明"}
                      </span>
                      <Badge variant="default" size="sm">
                        {alert.title}
                      </Badge>
                    </div>
                    <p className="text-text-secondary whitespace-pre-line">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-text-tertiary">
                      <span>
                        {new Date(alert.created_at).toLocaleString("ja-JP")}
                      </span>
                      {alert.acknowledged && alert.acknowledged_by && (
                        <span className="text-success">
                          確認済み
                          {alert.acknowledged_at &&
                            ` (${new Date(alert.acknowledged_at).toLocaleString("ja-JP")})`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {alert.patient_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewPatient(alert.patient_id)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {!alert.acknowledged && (
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
                  )}
                </div>
              </div>
            </Card>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}

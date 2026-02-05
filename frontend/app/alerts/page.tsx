"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, SeverityBadge, Badge } from "@/components/ui";
import { Check, AlertTriangle, Eye, Loader2, Filter, ChevronDown, X } from "lucide-react";
import { alertsApi, Alert } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

type SeverityFilter = "all" | "high" | "medium" | "low";
type AcknowledgedFilter = "all" | "unacknowledged" | "acknowledged";

export default function AlertsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [acknowledgedFilter, setAcknowledgedFilter] =
    useState<AcknowledgedFilter>("unacknowledged");

  // Fetch alerts
  useEffect(() => {
    async function fetchAlerts() {
      try {
        setLoading(true);
        setError(null);

        const params: {
          acknowledged?: boolean;
          severity?: string;
        } = {};

        if (acknowledgedFilter === "unacknowledged") {
          params.acknowledged = false;
        } else if (acknowledgedFilter === "acknowledged") {
          params.acknowledged = true;
        }

        if (severityFilter !== "all") {
          params.severity = severityFilter;
        }

        const data = await alertsApi.list(params);
        setAlerts(data.alerts);
      } catch (err) {
        console.error("Alerts fetch error:", err);
        setError(err instanceof Error ? err.message : "アラートの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchAlerts();
  }, [severityFilter, acknowledgedFilter]);

  // Acknowledge alert
  const handleAcknowledge = async (alert: Alert) => {
    if (!alert.patient_id || acknowledging) return;

    try {
      setAcknowledging(alert.id);
      await alertsApi.acknowledge(
        alert.id,
        alert.patient_id,
        user?.uid || "anonymous"
      );

      // Update local state
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === alert.id
            ? {
                ...a,
                acknowledged: true,
                acknowledged_by: user?.uid || "anonymous",
                acknowledged_at: new Date().toISOString(),
              }
            : a
        )
      );
    } catch (err) {
      console.error("Acknowledge error:", err);
      setError(err instanceof Error ? err.message : "確認に失敗しました");
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
      {/* Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <span className="font-medium text-red-700">
              未確認: {unacknowledgedCount}件
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
            <span className="text-gray-600">表示: {alerts.length}件</span>
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
              <span className="ml-1 bg-white text-blue-600 rounded-full px-1.5 text-xs">
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
            <h3 className="font-medium text-gray-900">フィルタ条件</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                クリア
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Severity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                重要度
              </label>
              <div className="relative">
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">すべて</option>
                  <option value="high">緊急</option>
                  <option value="medium">注意</option>
                  <option value="low">低</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Acknowledged Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                確認状態
              </label>
              <div className="relative">
                <select
                  value={acknowledgedFilter}
                  onChange={(e) =>
                    setAcknowledgedFilter(e.target.value as AcknowledgedFilter)
                  }
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">すべて</option>
                  <option value="unacknowledged">未確認のみ</option>
                  <option value="acknowledged">確認済みのみ</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Alert List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : alerts.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-gray-500">
            {hasActiveFilters
              ? "条件に一致するアラートがありません"
              : "アラートはありません"}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card
              key={alert.id}
              className={alert.acknowledged ? "opacity-60" : ""}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    <SeverityBadge severity={alert.severity.toUpperCase() as "HIGH" | "MEDIUM" | "LOW"} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900">
                        {alert.patient_name || "患者名不明"}
                      </span>
                      <Badge variant="default" size="sm">
                        {alert.title}
                      </Badge>
                    </div>
                    <p className="text-gray-600 whitespace-pre-line">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                      <span>
                        {new Date(alert.created_at).toLocaleString("ja-JP")}
                      </span>
                      {alert.acknowledged && alert.acknowledged_by && (
                        <span className="text-green-600">
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
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Badge } from "@/components/ui";
import { Users, AlertTriangle, FileText, Link as LinkIcon, Loader2 } from "lucide-react";
import {
  dashboardApi,
  setupApi,
  DashboardStats,
  ConnectionStatus,
  Alert,
  setUserData,
  setOrgId,
  UserData,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  loading,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          {loading ? (
            <div className="h-8 flex items-center">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ConnectionItem({
  name,
  connected,
  detail,
}: {
  name: string;
  connected: boolean;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <LinkIcon className="w-5 h-5 text-gray-400" />
        <div>
          <span className="font-medium">{name}</span>
          {detail && <p className="text-xs text-gray-400">{detail}</p>}
        </div>
      </div>
      <Badge variant={connected ? "success" : "default"}>
        {connected ? "接続済み" : "未接続"}
      </Badge>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user has organization, redirect to setup if not
  useEffect(() => {
    async function checkUserOrganization() {
      // Wait for auth to complete
      if (authLoading) return;

      // If not logged in, redirect to login
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        // Get or create user document from Firestore
        const userData: UserData = await setupApi.getOrCreateUser({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || undefined,
        });

        // Cache user data for use throughout the app
        setUserData(userData);

        // Check if user has an organization
        if (!userData.organizationId) {
          // No organization - redirect to setup
          console.log("User has no organization, redirecting to setup...");
          router.push("/setup");
          return;
        }

        // Save org ID for API calls
        setOrgId(userData.organizationId);

        // Organization exists, continue to dashboard
        setCheckingSetup(false);
      } catch (err) {
        console.error("Error checking user organization:", err);
        // On error, redirect to setup as a fallback
        router.push("/setup");
      }
    }

    checkUserOrganization();
  }, [user, authLoading, router]);

  useEffect(() => {
    // Don't fetch dashboard data until setup check is complete
    if (checkingSetup) return;

    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all dashboard data in parallel
        const [statsData, alertsData, statusData] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getRecentAlerts(5),
          dashboardApi.getConnectionStatus(),
        ]);

        setStats(statsData);
        setAlerts(alertsData.alerts);
        setConnectionStatus(statusData);
      } catch (err) {
        console.error("Dashboard data fetch error:", err);
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [checkingSetup]);

  // Show loading while checking setup or auth
  if (authLoading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout title="ダッシュボード">
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="総患者数"
          value={stats?.total_patients ?? 0}
          icon={Users}
          color="bg-blue-500"
          loading={loading}
        />
        <StatCard
          title="高リスク患者"
          value={stats?.high_risk_patients ?? 0}
          icon={AlertTriangle}
          color="bg-red-500"
          loading={loading}
        />
        <StatCard
          title="未確認アラート"
          value={stats?.unacknowledged_alerts ?? 0}
          icon={AlertTriangle}
          color="bg-yellow-500"
          loading={loading}
        />
        <StatCard
          title="24時間の報告数"
          value={stats?.recent_reports_24h ?? 0}
          icon={FileText}
          color="bg-green-500"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card>
          <CardHeader title="最近のアラート" description="直近の未確認アラート" />
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : alerts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                未確認のアラートはありません
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={alert.severity === "high" ? "danger" : "warning"}>
                      {alert.severity === "high" ? "緊急" : "注意"}
                    </Badge>
                    <div>
                      <p className="font-medium text-gray-900">
                        {alert.patient_name || "患者名不明"}
                      </p>
                      <p className="text-sm text-gray-500">{alert.title}</p>
                    </div>
                  </div>
                  <time className="text-sm text-gray-400">
                    {new Date(alert.created_at).toLocaleDateString("ja-JP")}
                  </time>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Connection Status */}
        <Card>
          <CardHeader title="接続状態" description="外部サービスとの接続状態" />
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <ConnectionItem
                  name="Slack"
                  connected={connectionStatus?.slack.connected ?? false}
                  detail={connectionStatus?.slack.team_name}
                />
                <ConnectionItem
                  name="Gemini API"
                  connected={connectionStatus?.gemini.connected ?? false}
                  detail={connectionStatus?.gemini.model}
                />
                <ConnectionItem
                  name="Vertex AI"
                  connected={connectionStatus?.vertex.connected ?? false}
                  detail={connectionStatus?.vertex.project_id}
                />
                <ConnectionItem
                  name="Firestore"
                  connected={connectionStatus?.firestore.connected ?? false}
                />
              </>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

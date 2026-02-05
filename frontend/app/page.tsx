"use client";

import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Badge } from "@/components/ui";
import { Users, AlertTriangle, FileText, Link as LinkIcon } from "lucide-react";

// Demo stats for initial display
const demoStats = {
  total_patients: 24,
  high_risk_patients: 4,
  unacknowledged_alerts: 3,
  recent_reports_24h: 12,
  slack_connected: false,
};

const recentAlerts = [
  {
    id: "1",
    patient_name: "田中太郎",
    severity: "HIGH" as const,
    pattern_name: "全軸複合",
    created_at: "2026-02-05T09:30:00",
  },
  {
    id: "2",
    patient_name: "田中太郎",
    severity: "HIGH" as const,
    pattern_name: "複合Bio悪化",
    created_at: "2026-02-03T14:20:00",
  },
  {
    id: "3",
    patient_name: "山田花子",
    severity: "MEDIUM" as const,
    pattern_name: "バイタル低下トレンド",
    created_at: "2026-02-02T11:45:00",
  },
];

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <AdminLayout title="ダッシュボード">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="総患者数"
          value={demoStats.total_patients}
          icon={Users}
          color="bg-blue-500"
        />
        <StatCard
          title="高リスク患者"
          value={demoStats.high_risk_patients}
          icon={AlertTriangle}
          color="bg-red-500"
        />
        <StatCard
          title="未確認アラート"
          value={demoStats.unacknowledged_alerts}
          icon={AlertTriangle}
          color="bg-yellow-500"
        />
        <StatCard
          title="24時間の報告数"
          value={demoStats.recent_reports_24h}
          icon={FileText}
          color="bg-green-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card>
          <CardHeader title="最近のアラート" description="直近のアラート通知" />
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant={alert.severity === "HIGH" ? "danger" : "warning"}>
                    {alert.severity === "HIGH" ? "緊急" : "注意"}
                  </Badge>
                  <div>
                    <p className="font-medium text-gray-900">{alert.patient_name}</p>
                    <p className="text-sm text-gray-500">{alert.pattern_name}</p>
                  </div>
                </div>
                <time className="text-sm text-gray-400">
                  {new Date(alert.created_at).toLocaleDateString("ja-JP")}
                </time>
              </div>
            ))}
          </div>
        </Card>

        {/* Connection Status */}
        <Card>
          <CardHeader title="接続状態" description="外部サービスとの接続状態" />
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <LinkIcon className="w-5 h-5 text-gray-400" />
                <span className="font-medium">Slack</span>
              </div>
              <Badge variant={demoStats.slack_connected ? "success" : "default"}>
                {demoStats.slack_connected ? "接続済み" : "未接続"}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <LinkIcon className="w-5 h-5 text-gray-400" />
                <span className="font-medium">Gemini API</span>
              </div>
              <Badge variant="default">未設定</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <LinkIcon className="w-5 h-5 text-gray-400" />
                <span className="font-medium">Firestore</span>
              </div>
              <Badge variant="success">接続済み</Badge>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, RiskBadge, Badge } from "@/components/ui";
import { ArrowLeft, Download, MessageSquare, Loader2, AlertTriangle } from "lucide-react";
import { patientsApi, Patient, Report, Alert, BPSContext } from "@/lib/api";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

const reporterLabels: Record<string, string> = {
  nurse: "看護師",
  pharmacist: "薬剤師",
  care_manager: "ケアマネ",
  doctor: "医師",
  family: "家族",
  therapist: "療法士",
  other: "その他",
};

function BPSSummaryCard({ context }: { context: BPSContext | null }) {
  if (!context) {
    return (
      <Card>
        <CardHeader title="BPSサマリー" description="AIが生成した現在の状態サマリー" />
        <div className="text-center py-8 text-gray-500">
          まだサマリーが生成されていません
        </div>
      </Card>
    );
  }

  // Format BPS context into readable summary
  const formatBPSSection = (data: Record<string, unknown>, label: string): string => {
    if (!data || Object.keys(data).length === 0) return "";
    const items = Object.entries(data)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${v}`)
      .join("、");
    return items ? `【${label}】${items}` : "";
  };

  const bio = formatBPSSection(context.bio, "Bio");
  const psycho = formatBPSSection(context.psycho, "Psycho");
  const social = formatBPSSection(context.social, "Social");
  const summary = [bio, psycho, social].filter(Boolean).join("\n\n");

  return (
    <Card>
      <CardHeader title="BPSサマリー" description="AIが生成した現在の状態サマリー" />
      {summary ? (
        <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line">
          {summary}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          BPS情報が収集されていません
        </div>
      )}
      {context.last_updated && (
        <p className="text-xs text-gray-400 mt-4">
          最終更新: {new Date(context.last_updated).toLocaleString("ja-JP")}
        </p>
      )}
    </Card>
  );
}

function AlertsCard({ alerts }: { alerts: Alert[] }) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  return (
    <Card>
      <CardHeader
        title="アラート"
        description={`未確認: ${unacknowledged.length}件`}
      />
      {alerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          アラートはありません
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                alert.acknowledged ? "bg-gray-50" : "bg-red-50"
              }`}
            >
              <Badge
                variant={
                  alert.severity === "high"
                    ? "danger"
                    : alert.severity === "medium"
                    ? "warning"
                    : "default"
                }
                size="sm"
              >
                {alert.severity === "high" ? "緊急" : alert.severity === "medium" ? "注意" : "低"}
              </Badge>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{alert.title}</p>
                <p className="text-sm text-gray-600">{alert.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(alert.created_at).toLocaleString("ja-JP")}
                </p>
              </div>
              {alert.acknowledged && (
                <span className="text-xs text-green-600">確認済み</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReportsTimeline({ reports }: { reports: Report[] }) {
  return (
    <Card className="mt-6">
      <CardHeader title="報告タイムライン" description="職種からの報告履歴" />
      {reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          まだ報告がありません
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex-shrink-0">
                <Badge variant="info" size="sm">
                  {reporterLabels[report.reporter_role] || report.reporter_role}
                </Badge>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">
                    {report.reporter_name}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{report.raw_text}</p>
                {report.bps_classification && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {report.bps_classification.bio?.map((item, i) => (
                      <Badge key={`bio-${i}`} variant="info" size="sm">
                        Bio: {item}
                      </Badge>
                    ))}
                    {report.bps_classification.psycho?.map((item, i) => (
                      <Badge key={`psycho-${i}`} variant="warning" size="sm">
                        Psycho: {item}
                      </Badge>
                    ))}
                    {report.bps_classification.social?.map((item, i) => (
                      <Badge key={`social-${i}`} variant="default" size="sm">
                        Social: {item}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-sm text-gray-400 mt-2">
                  {new Date(report.timestamp).toLocaleString("ja-JP")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [context, setContext] = useState<BPSContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPatientData() {
      try {
        setLoading(true);
        setError(null);

        const data = await patientsApi.get(id);
        setPatient(data.patient);
        setReports(data.recent_reports || []);
        setAlerts(data.alerts || []);
        setContext(data.context || null);
      } catch (err) {
        console.error("Patient fetch error:", err);
        setError(err instanceof Error ? err.message : "患者データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchPatientData();
  }, [id]);

  const getRiskLevel = (level: string): RiskLevel => {
    const normalizedLevel = level.toUpperCase();
    if (normalizedLevel === "HIGH") return "HIGH";
    if (normalizedLevel === "MEDIUM") return "MEDIUM";
    return "LOW";
  };

  const handleSlackClick = () => {
    if (patient?.slack_channel_name) {
      // Open Slack channel (this would need proper Slack deep link)
      window.open(
        `slack://channel?team=&id=${patient.slack_channel_id}`,
        "_blank"
      );
    }
  };

  if (loading) {
    return (
      <AdminLayout title="患者詳細">
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !patient) {
    return (
      <AdminLayout title="患者詳細">
        <div className="mb-6">
          <Link
            href="/patients"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            患者一覧に戻る
          </Link>
        </div>
        <Card>
          <div className="flex flex-col items-center py-12">
            <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
            <p className="text-red-600 font-medium">
              {error || "患者が見つかりません"}
            </p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => router.push("/patients")}
            >
              患者一覧に戻る
            </Button>
          </div>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`患者詳細: ${patient.name}`}>
      {/* Back Button */}
      <div className="mb-6">
        <Link
          href="/patients"
          className="inline-flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          患者一覧に戻る
        </Link>
      </div>

      {/* Patient Header */}
      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{patient.name}</h2>
              <RiskBadge level={getRiskLevel(patient.risk_level)} />
            </div>
            {patient.name_kana && (
              <p className="text-gray-500 mb-3">{patient.name_kana}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {patient.age && patient.gender && (
                <span>
                  {patient.age}歳 / {patient.gender === "male" ? "男性" : "女性"}
                </span>
              )}
              {patient.facility && <span>事業所: {patient.facility}</span>}
              {patient.area && <span>地区: {patient.area}</span>}
              {patient.care_level && <span>介護度: {patient.care_level}</span>}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {patient.primary_diagnosis && (
                <Badge variant="info" size="sm">
                  {patient.primary_diagnosis}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {patient.slack_channel_name && (
              <Button variant="secondary" onClick={handleSlackClick}>
                <MessageSquare className="w-4 h-4 mr-2" />
                #{patient.slack_channel_name}
              </Button>
            )}
            <Button variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              エクスポート
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BPS Summary */}
        <BPSSummaryCard context={context} />

        {/* Alerts */}
        <AlertsCard alerts={alerts} />
      </div>

      {/* Timeline */}
      <ReportsTimeline reports={reports} />
    </AdminLayout>
  );
}

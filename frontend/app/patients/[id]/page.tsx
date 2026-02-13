"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, RiskBadge, Badge, Alert as AlertBanner, SkeletonCard } from "@/components/ui";
import { ArrowLeft, Download, MessageSquare, Loader2, CheckCircle2, Eye, EyeOff, Pencil, Trash2, Heart, Brain, Users, FileText, Image, ExternalLink } from "lucide-react";
import { patientsApi, getUserData, type Report, type Alert, type BPSContext, type RawFile } from "@/lib/api";
import { usePatient } from "@/hooks/useApi";
import { getRiskLevel } from "@/lib/utils";
import { DeletePatientModal } from "./DeletePatientModal";
import { ExportModal } from "./ExportModal";
import { GomonCard } from "./GomonCard";
import { ReferralCard } from "./ReferralCard";

const reporterLabels: Record<string, string> = {
  nurse: "看護師",
  pharmacist: "薬剤師",
  care_manager: "ケアマネ",
  cm: "ケアマネ",
  doctor: "医師",
  family: "家族",
  therapist: "療法士",
  pt: "理学療法士",
  ot: "作業療法士",
  st: "言語聴覚士",
  sw: "ソーシャルワーカー",
  helper: "ヘルパー",
  other: "その他",
  unknown: "スタッフ",
};

const BPS_SECTIONS = [
  {
    key: "bio" as const,
    label: "Biological",
    narrativeKey: "bio_narrative" as const,
    trendKey: "bio_trend" as const,
    icon: Heart,
    iconColor: "text-accent-500",
    iconBg: "bg-accent-50",
    borderColor: "border-accent-200",
  },
  {
    key: "psycho" as const,
    label: "Psychological",
    narrativeKey: "psycho_narrative" as const,
    trendKey: "psycho_trend" as const,
    icon: Brain,
    iconColor: "text-warning",
    iconBg: "bg-warning-subtle",
    borderColor: "border-warning/20",
  },
  {
    key: "social" as const,
    label: "Social",
    narrativeKey: "social_narrative" as const,
    trendKey: "social_trend" as const,
    icon: Users,
    iconColor: "text-success",
    iconBg: "bg-success-subtle",
    borderColor: "border-success/20",
  },
] as const;

function BPSSummaryCard({ context }: { context: BPSContext | null }) {
  if (!context) {
    return (
      <Card>
        <CardHeader title="BPSサマリー" description="AIが生成した現在の状態サマリー" />
        <div className="text-center py-8 text-text-secondary">
          まだサマリーが生成されていません
        </div>
      </Card>
    );
  }

  const narrative = context.bps_summary;

  // Fallback: format BPS context into readable summary
  const formatValue = (v: unknown): string => {
    if (v == null || v === "") return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (Array.isArray(v)) {
      return v.map((item) => {
        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          if (obj.type || obj.name) {
            const parts = [obj.type || obj.name, obj.value, obj.unit, obj.trend].filter(Boolean);
            return parts.join(" ");
          }
          return Object.values(obj).filter(Boolean).join(" ");
        }
        return String(item);
      }).filter(Boolean).join(", ");
    }
    if (typeof v === "object") {
      const obj = v as Record<string, unknown>;
      return Object.entries(obj)
        .filter(([, val]) => val != null && val !== "")
        .map(([, val]) => formatValue(val))
        .filter(Boolean)
        .join(", ");
    }
    return String(v);
  };

  const formatBPSSection = (data: Record<string, unknown>, label: string): string => {
    if (!data || Object.keys(data).length === 0) return "";
    const items = Object.entries(data)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${formatValue(v)}`)
      .filter(([, text]) => text)
      .join("、");
    return items ? `【${label}】${items}` : "";
  };

  return (
    <Card>
      <CardHeader title="BPSサマリー" description="AIが生成した現在の状態サマリー" />
      {narrative ? (
        <div className="space-y-3">
          {BPS_SECTIONS.map((section) => {
            const Icon = section.icon;
            const narrativeText = narrative[section.narrativeKey] || "現時点で報告なし";
            const trendText = narrative[section.trendKey];
            return (
              <div key={section.key} className={`rounded-lg border ${section.borderColor} p-3`}>
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-md ${section.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${section.iconColor}`} />
                  </div>
                  <span className="text-sm font-medium text-text-primary">{section.label}</span>
                  {trendText && (
                    <span className="text-xs text-text-tertiary ml-auto">{trendText}</span>
                  )}
                </div>
                <p className="text-sm text-text-secondary leading-relaxed pl-8 mt-1">
                  {narrativeText}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        (() => {
          const bio = formatBPSSection(context.bio, "Bio");
          const psycho = formatBPSSection(context.psycho, "Psycho");
          const social = formatBPSSection(context.social, "Social");
          const summary = [bio, psycho, social].filter(Boolean).join("\n\n");
          return summary ? (
            <div className="prose prose-sm max-w-none text-text-secondary whitespace-pre-line">
              {summary}
            </div>
          ) : (
            <div className="text-center py-8 text-text-secondary">
              BPS情報が収集されていません
            </div>
          );
        })()
      )}
      {context.last_updated && (
        <p className="text-xs text-text-tertiary mt-3">
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
        <div className="text-center py-8 text-text-secondary">
          アラートはありません
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert) => (
            <div
              key={alert.id}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                alert.acknowledged ? "bg-bg-secondary" : "bg-danger-subtle"
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
                <p className="font-medium text-text-primary">{alert.title}</p>
                <p className="text-sm text-text-secondary">{alert.message}</p>
                <p className="text-xs text-text-tertiary mt-1">
                  {new Date(alert.created_at).toLocaleString("ja-JP")}
                </p>
              </div>
              {alert.acknowledged && (
                <span className="text-xs text-success">確認済み</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatBpsValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatBpsValue(item))
      .filter(Boolean);
    return items.length > 0 ? items.join(", ") : null;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([, v]) => formatBpsValue(v))
      .filter(Boolean);
    return entries.length > 0 ? entries.join(", ") : null;
  }
  return null;
}

function BpsTags({ bps }: { bps: Record<string, unknown> }) {
  const sections: { key: string; label: string; variant: "info" | "warning" | "default" }[] = [
    { key: "bio", label: "Bio", variant: "info" },
    { key: "psycho", label: "Psycho", variant: "warning" },
    { key: "social", label: "Social", variant: "default" },
  ];

  const tags: { label: string; text: string; variant: "info" | "warning" | "default"; key: string }[] = [];

  for (const section of sections) {
    const data = bps[section.key];
    if (!data || typeof data !== "object") continue;

    for (const [field, value] of Object.entries(data as Record<string, unknown>)) {
      const text = formatBpsValue(value);
      if (text) {
        tags.push({ label: section.label, text, variant: section.variant, key: `${section.key}-${field}` });
      }
    }
  }

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {tags.map((tag) => (
        <Badge key={tag.key} variant={tag.variant} size="sm">
          {tag.label}: {tag.text}
        </Badge>
      ))}
    </div>
  );
}

function FilesCard({ patientId }: { patientId: string }) {
  const [files, setFiles] = useState<RawFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    patientsApi
      .listFiles(patientId)
      .then((res) => setFiles(res.files))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [patientId]);

  const handleOpen = async (fileId: string) => {
    setOpeningId(fileId);
    try {
      const { url } = await patientsApi.getFileUrl(patientId, fileId);
      window.open(url, "_blank");
    } catch {
      // silently fail
    } finally {
      setOpeningId(null);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const FileIcon = ({ type }: { type: string }) =>
    type === "pdf" ? (
      <FileText className="w-4 h-4 text-danger" />
    ) : (
      <Image className="w-4 h-4 text-accent-500" />
    );

  if (loading) {
    return (
      <Card>
        <CardHeader title="添付ファイル" description="Slackからの添付ファイル" />
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="添付ファイル"
        description={`${files.length}件`}
      />
      {files.length === 0 ? (
        <div className="text-center py-6 text-text-secondary text-sm">
          添付ファイルはありません
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-bg-secondary"
            >
              <FileIcon type={file.file_type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {file.original_name}
                </p>
                <p className="text-xs text-text-tertiary">
                  {formatSize(file.size_bytes)} | {file.uploaded_by}
                  {file.created_at && (
                    <> | {new Date(file.created_at).toLocaleDateString("ja-JP")}</>
                  )}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpen(file.id)}
                disabled={openingId === file.id}
              >
                {openingId === file.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ReportsTimeline({
  reports,
  patientId,
  onAcknowledge,
}: {
  reports: Report[];
  patientId: string;
  onAcknowledge: (reportId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const unreadCount = reports.filter((r) => !r.acknowledged).length;
  const displayReports = showAll
    ? reports
    : reports.filter((r) => !r.acknowledged);

  const handleAcknowledge = async (reportId: string) => {
    setAcknowledgingId(reportId);
    try {
      onAcknowledge(reportId);
    } finally {
      setAcknowledgingId(null);
    }
  };

  return (
    <Card className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <CardHeader
          title="報告タイムライン"
          description={`未読: ${unreadCount}件`}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <EyeOff className="w-4 h-4 mr-1" />
              未読のみ
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-1" />
              全件表示
            </>
          )}
        </Button>
      </div>
      {displayReports.length === 0 ? (
        <div className="text-center py-8 text-text-secondary">
          {showAll ? "まだ報告がありません" : "未読の報告はありません"}
        </div>
      ) : (
        <div className="relative space-y-4 pl-4 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-border">
          {displayReports.map((report) => (
            <div
              key={report.id}
              className={`relative flex items-start gap-4 p-4 border rounded-lg ${
                report.acknowledged
                  ? "border-border-light bg-bg-secondary opacity-60"
                  : "border-border"
              }`}
            >
              <div className="absolute -left-[1.125rem] top-6 w-2.5 h-2.5 rounded-full bg-white border-2 border-border-strong" />
              <div className="flex-shrink-0">
                <Badge variant="info" size="sm">
                  {reporterLabels[report.reporter_role] || report.reporter_role}
                </Badge>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-text-primary">
                    {report.reporter_name || "報告者"}
                  </span>
                  {report.acknowledged && (
                    <span className="text-xs text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      確認済み
                    </span>
                  )}
                </div>
                <p className="text-text-secondary text-sm">{report.raw_text}</p>
                {report.bps_classification && (
                  <BpsTags bps={report.bps_classification} />
                )}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-text-tertiary">
                    {new Date(report.timestamp).toLocaleString("ja-JP")}
                  </p>
                  {!report.acknowledged && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAcknowledge(report.id)}
                      disabled={acknowledgingId === report.id}
                    >
                      {acknowledgingId === report.id ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                      )}
                      確認済みにする
                    </Button>
                  )}
                </div>
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

  const { data, isLoading: loading, error: swrError, mutate } = usePatient(id);
  const patient = data?.patient ?? null;
  const reports = data?.recent_reports ?? [];
  const alerts = data?.alerts ?? [];
  const context = data?.context ?? null;
  const error = swrError?.message ?? null;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const handleSlackClick = () => {
    if (patient?.slack_channel_name) {
      window.open(
        `slack://channel?team=&id=${patient.slack_channel_id}`,
        "_blank"
      );
    }
  };

  if (loading) {
    return (
      <AdminLayout title="患者詳細">
        <div className="space-y-6">
          <SkeletonCard />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
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
            className="inline-flex items-center text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            患者一覧に戻る
          </Link>
        </div>
        <Card>
          <div className="flex flex-col items-center py-12">
            <AlertBanner variant="error">{error || "患者が見つかりません"}</AlertBanner>
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
          className="inline-flex items-center text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          患者一覧に戻る
        </Link>
      </div>

      {/* Patient Basic Info - Header + 5つの呪文 + Referral unified */}
      <Card className="mb-6">
        {/* Header row */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-text-primary">{patient.name}</h2>
              <RiskBadge level={getRiskLevel(patient.risk_level)} />
            </div>
            {patient.name_kana && (
              <p className="text-sm text-text-secondary mb-1">{patient.name_kana}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm text-text-secondary">
              {patient.age && patient.gender && (
                <span>
                  {patient.age}歳 / {patient.gender === "male" ? "男性" : "女性"}
                </span>
              )}
              {patient.facility && <span>{patient.facility}</span>}
              {patient.area && <span>{patient.area}</span>}
            </div>
          </div>
          <div className="flex gap-1 items-center">
            {patient.slack_channel_name && (
              <Button variant="ghost" size="sm" onClick={handleSlackClick}>
                <MessageSquare className="w-4 h-4 mr-1.5" />
                #{patient.slack_channel_name}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setShowExportModal(true)}>
              <Download className="w-4 h-4 mr-1.5" />
              エクスポート
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/patients/${id}/edit`)}
            >
              <Pencil className="w-4 h-4 mr-1.5" />
              編集
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              アーカイブ
            </Button>
          </div>
        </div>

        {/* 在宅5つの呪文 - inline */}
        <GomonCard patient={patient} inline />

        {/* 紹介元・経緯 - inline */}
        <ReferralCard patient={patient} inline />
      </Card>

      {/* BPS Summary + Alerts - 2 column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BPSSummaryCard context={context} />
        <div className="space-y-6">
          <AlertsCard alerts={alerts} />
          <FilesCard patientId={id} />
        </div>
      </div>

      {/* Timeline */}
      <ReportsTimeline
        reports={reports}
        patientId={id}
        onAcknowledge={async (reportId) => {
          const user = getUserData();
          const userId = user?.uid || "unknown";
          await patientsApi.acknowledgeReport(id, reportId, userId);
          mutate();
        }}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        patient={patient}
        context={context}
      />

      {/* Delete (Archive) Modal */}
      <DeletePatientModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        patient={patient}
      />
    </AdminLayout>
  );
}

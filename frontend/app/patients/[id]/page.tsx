"use client";

import { use } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, RiskBadge, Badge } from "@/components/ui";
import { ArrowLeft, Download, MessageSquare } from "lucide-react";

// Demo patient detail
const demoPatient = {
  id: "1",
  name: "田中太郎",
  name_kana: "タナカタロウ",
  age: 85,
  sex: "M" as const,
  conditions: ["COPD", "高血圧", "糖尿病"],
  facility: "本院",
  area: "渋谷区",
  tags: ["要注意", "独居"],
  risk_level: "HIGH" as const,
  slack_channel_name: "pt-田中太郎",
  context: {
    current_summary: `【BPS経過サマリー】田中太郎様（85歳男性）

Bio: SpO2が1週間で96%→92%と低下傾向。発熱（37.4℃）、咳嗽・痰の増加あり。食欲低下継続。服薬アドヒアランス低下（アムロジピン3日未服用）。ADLは臥床傾向。

Psycho: 意欲低下、表情暗い。認知機能の変化の可能性あり。抑うつ傾向を示唆する所見。

Social: 主介護者である妻の体調不良により介護力低下。訪問看護の頻度増加を検討中。介護負担の増加が懸念される状況。`,
    recommendations: [
      { priority: "HIGH", text: "主治医への報告と診察依頼（発熱・SpO2低下の精査）" },
      { priority: "HIGH", text: "服薬管理方法の見直し（一包化、服薬カレンダー等）" },
      { priority: "MEDIUM", text: "訪問看護の頻度増加（週2回→3回）" },
      { priority: "MEDIUM", text: "妻の介護負担軽減（レスパイト検討）" },
    ],
  },
};

const demoReports = [
  {
    id: "1",
    reporter: "nurse",
    reporter_name: "看護師A",
    timestamp: "2026-02-05T10:30:00",
    summary: "SpO2 92%、発熱37.4℃、咳嗽悪化、ぐったり",
    alert_triggered: true,
  },
  {
    id: "2",
    reporter: "pharmacist",
    reporter_name: "薬剤師C",
    timestamp: "2026-02-03T14:00:00",
    summary: "服薬アドヒアランス低下（アムロジピン3日未服用）",
    alert_triggered: true,
  },
  {
    id: "3",
    reporter: "nurse",
    reporter_name: "看護師B",
    timestamp: "2026-02-01T09:15:00",
    summary: "SpO2 93%、咳嗽・痰、食欲低下継続",
    alert_triggered: true,
  },
];

const reporterLabels: Record<string, string> = {
  nurse: "看護師",
  pharmacist: "薬剤師",
  care_manager: "ケアマネ",
  doctor: "医師",
  family: "家族",
};

export default function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const patient = demoPatient; // In real app, fetch by id

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
              <RiskBadge level={patient.risk_level} />
            </div>
            <p className="text-gray-500 mb-3">{patient.name_kana}</p>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>{patient.age}歳 / {patient.sex === "M" ? "男性" : "女性"}</span>
              <span>事業所: {patient.facility}</span>
              <span>地区: {patient.area}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {patient.conditions.map((condition) => (
                <Badge key={condition} variant="info" size="sm">
                  {condition}
                </Badge>
              ))}
              {patient.tags.map((tag) => (
                <Badge key={tag} variant="warning" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary">
              <MessageSquare className="w-4 h-4 mr-2" />
              Slack
            </Button>
            <Button variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              エクスポート
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BPS Summary */}
        <Card>
          <CardHeader title="BPSサマリー" description="AIが生成した現在の状態サマリー" />
          <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line">
            {patient.context.current_summary}
          </div>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader title="推奨事項" description="AIが提案するアクション" />
          <div className="space-y-3">
            {patient.context.recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <Badge
                  variant={rec.priority === "HIGH" ? "danger" : "warning"}
                  size="sm"
                >
                  {rec.priority === "HIGH" ? "高" : "中"}
                </Badge>
                <p className="text-gray-700">{rec.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Timeline */}
      <Card className="mt-6">
        <CardHeader title="報告タイムライン" description="職種からの報告履歴" />
        <div className="space-y-4">
          {demoReports.map((report) => (
            <div
              key={report.id}
              className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg"
            >
              <div className="flex-shrink-0">
                <Badge variant="info" size="sm">
                  {reporterLabels[report.reporter] || report.reporter}
                </Badge>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900">{report.reporter_name}</span>
                  {report.alert_triggered && (
                    <Badge variant="danger" size="sm">
                      アラート発火
                    </Badge>
                  )}
                </div>
                <p className="text-gray-600">{report.summary}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {new Date(report.timestamp).toLocaleString("ja-JP")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </AdminLayout>
  );
}

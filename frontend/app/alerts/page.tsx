"use client";

import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, SeverityBadge, Badge } from "@/components/ui";
import { Check, AlertTriangle, Eye } from "lucide-react";

// Demo alert data
const demoAlerts = [
  {
    id: "1",
    patient_id: "1",
    patient_name: "田中太郎",
    severity: "HIGH" as const,
    pattern_type: "A-5",
    pattern_name: "全軸複合",
    message: "Bio: SpO2 92%、発熱37.4℃、臥床傾向\nPsycho: 意欲低下、認知変化の可能性\nSocial: 主介護者（妻）の体調不良",
    acknowledged: false,
    created_at: "2026-02-05T09:30:00",
  },
  {
    id: "2",
    patient_id: "1",
    patient_name: "田中太郎",
    severity: "HIGH" as const,
    pattern_type: "A-2",
    pattern_name: "複合Bio悪化",
    message: "SpO2低下（93%）+ 咳嗽悪化 + 食欲低下継続 + 服薬アドヒアランス低下",
    acknowledged: false,
    created_at: "2026-02-03T14:20:00",
  },
  {
    id: "3",
    patient_id: "2",
    patient_name: "山田花子",
    severity: "MEDIUM" as const,
    pattern_type: "A-1",
    pattern_name: "バイタル低下トレンド",
    message: "血圧が1週間で上昇傾向（148/92mmHg → 162/98mmHg）",
    acknowledged: true,
    created_at: "2026-02-02T11:45:00",
  },
  {
    id: "4",
    patient_id: "3",
    patient_name: "佐藤一郎",
    severity: "LOW" as const,
    pattern_type: "A-4",
    pattern_name: "Social変化シグナル",
    message: "訪問介護の時間変更希望あり。家族の就労状況変化。",
    acknowledged: true,
    created_at: "2026-02-01T16:30:00",
  },
];

export default function AlertsPage() {
  const unacknowledgedCount = demoAlerts.filter((a) => !a.acknowledged).length;

  return (
    <AdminLayout title="アラート一覧">
      {/* Summary */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <span className="font-medium text-red-700">未確認: {unacknowledgedCount}件</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
          <span className="text-gray-600">全体: {demoAlerts.length}件</span>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-4">
        {demoAlerts.map((alert) => (
          <Card key={alert.id} className={alert.acknowledged ? "opacity-60" : ""}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="mt-1">
                  <SeverityBadge severity={alert.severity} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900">{alert.patient_name}</span>
                    <Badge variant="default" size="sm">
                      {alert.pattern_type}
                    </Badge>
                    <span className="text-sm text-gray-500">{alert.pattern_name}</span>
                  </div>
                  <p className="text-gray-600 whitespace-pre-line">{alert.message}</p>
                  <p className="text-sm text-gray-400 mt-2">
                    {new Date(alert.created_at).toLocaleString("ja-JP")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">
                  <Eye className="w-4 h-4" />
                </Button>
                {!alert.acknowledged && (
                  <Button variant="secondary" size="sm">
                    <Check className="w-4 h-4 mr-1" />
                    確認
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </AdminLayout>
  );
}

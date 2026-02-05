"use client";

import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Badge } from "@/components/ui";
import { Upload, FileText, Search, Trash2 } from "lucide-react";

// Demo knowledge documents
const demoDocuments = [
  {
    id: "1",
    title: "BPSモデル概論",
    category: "bps",
    status: "indexed" as const,
    total_chunks: 45,
    source: "院内教育資料",
    updated_at: "2026-01-15T10:00:00",
  },
  {
    id: "2",
    title: "COPD診療ガイドライン 2024",
    category: "guidelines",
    status: "indexed" as const,
    total_chunks: 128,
    source: "日本呼吸器学会",
    updated_at: "2026-01-10T14:30:00",
  },
  {
    id: "3",
    title: "在宅医療制度解説",
    category: "homecare",
    status: "indexed" as const,
    total_chunks: 67,
    source: "厚生労働省資料",
    updated_at: "2026-01-08T09:15:00",
  },
  {
    id: "4",
    title: "緩和ケアマニュアル",
    category: "palliative",
    status: "processing" as const,
    total_chunks: 0,
    source: "院内プロトコル",
    updated_at: "2026-02-05T11:00:00",
  },
];

const categoryLabels: Record<string, string> = {
  bps: "BPSモデル",
  clinical: "臨床推論",
  guidelines: "診療ガイドライン",
  homecare: "在宅医療制度",
  palliative: "緩和ケア",
  geriatric: "老年医学",
  medication: "薬剤管理",
  custom: "カスタム",
};

const statusConfig: Record<string, { variant: "success" | "warning" | "danger" | "default"; label: string }> = {
  indexed: { variant: "success", label: "インデックス済み" },
  processing: { variant: "warning", label: "処理中" },
  error: { variant: "danger", label: "エラー" },
  uploading: { variant: "default", label: "アップロード中" },
};

export default function KnowledgePage() {
  return (
    <AdminLayout title="ナレッジベース">
      {/* Actions */}
      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600">
          RAGナレッジベースのドキュメント管理。エージェントが参照する知識を追加・編集できます。
        </p>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          ドキュメント追加
        </Button>
      </div>

      {/* Document List */}
      <div className="space-y-4">
        {demoDocuments.map((doc) => {
          const status = statusConfig[doc.status];
          return (
            <Card key={doc.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <FileText className="w-6 h-6 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="info" size="sm">
                        {categoryLabels[doc.category] || doc.category}
                      </Badge>
                      <Badge variant={status.variant} size="sm">
                        {status.label}
                      </Badge>
                      {doc.total_chunks > 0 && (
                        <span className="text-sm text-gray-500">{doc.total_chunks}チャンク</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">出典: {doc.source}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm">
                    <Search className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}

"use client";

import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input, Badge } from "@/components/ui";
import { Save, RefreshCw, CheckCircle, XCircle } from "lucide-react";

const services = [
  {
    id: "gemini",
    name: "Gemini API",
    description: "LLMによるBPS構造化・サマリー生成",
    status: "not_configured" as const,
    category: "ai",
    fields: [{ key: "api_key", label: "API Key", type: "password" }],
  },
  {
    id: "slack",
    name: "Slack",
    description: "多職種コミュニケーションプラットフォーム",
    status: "not_configured" as const,
    category: "integration",
    fields: [
      { key: "bot_token", label: "Bot User OAuth Token", type: "password" },
      { key: "signing_secret", label: "Signing Secret", type: "password" },
    ],
  },
  {
    id: "vertex",
    name: "Vertex AI",
    description: "RAGナレッジベースのベクトル検索",
    status: "connected" as const,
    category: "ai",
    fields: [
      { key: "project_id", label: "Project ID", type: "text" },
      { key: "region", label: "Region", type: "text" },
    ],
  },
];

const statusConfig: Record<string, { variant: "success" | "danger" | "default"; label: string; icon: typeof CheckCircle }> = {
  connected: { variant: "success", label: "接続済み", icon: CheckCircle },
  error: { variant: "danger", label: "エラー", icon: XCircle },
  not_configured: { variant: "default", label: "未設定", icon: XCircle },
};

export default function ApiSettingsPage() {
  return (
    <AdminLayout title="API設定">
      <p className="text-gray-600 mb-6">
        外部サービスとの連携設定。APIキーはSecret Managerに暗号化保存されます。
      </p>

      <div className="space-y-6">
        {services.map((service) => {
          const status = statusConfig[service.status];
          const StatusIcon = status.icon;

          return (
            <Card key={service.id}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                    <Badge variant={status.variant} size="sm">
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{service.description}</p>
                </div>
                <Button variant="ghost" size="sm">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {service.fields.map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    type={field.type}
                    placeholder={field.type === "password" ? "••••••••" : `${field.label}を入力`}
                  />
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  保存
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </AdminLayout>
  );
}

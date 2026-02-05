"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input, Badge } from "@/components/ui";
import { Save, RefreshCw, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { settingsApi, setupApi } from "@/lib/api";

interface ServiceConfig {
  id: string;
  name: string;
  description: string;
  status: "connected" | "error" | "not_configured";
  category: string;
  fields: { key: string; label: string; type: string; value?: string }[];
}

const statusConfig: Record<
  string,
  { variant: "success" | "danger" | "default"; label: string; icon: typeof CheckCircle }
> = {
  connected: { variant: "success", label: "接続済み", icon: CheckCircle },
  error: { variant: "danger", label: "エラー", icon: XCircle },
  not_configured: { variant: "default", label: "未設定", icon: XCircle },
};

export default function ApiSettingsPage() {
  const [services, setServices] = useState<ServiceConfig[]>([
    {
      id: "gemini",
      name: "Gemini API",
      description: "LLMによるBPS構造化・サマリー生成",
      status: "not_configured",
      category: "ai",
      fields: [{ key: "api_key", label: "API Key", type: "password", value: "" }],
    },
    {
      id: "slack",
      name: "Slack",
      description: "多職種コミュニケーションプラットフォーム",
      status: "not_configured",
      category: "integration",
      fields: [
        { key: "bot_token", label: "Bot User OAuth Token", type: "password", value: "" },
        { key: "signing_secret", label: "Signing Secret", type: "password", value: "" },
      ],
    },
    {
      id: "vertex",
      name: "Vertex AI",
      description: "RAGナレッジベースのベクトル検索",
      status: "not_configured",
      category: "ai",
      fields: [
        { key: "project_id", label: "Project ID", type: "text", value: "" },
        { key: "region", label: "Region", type: "text", value: "" },
      ],
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch configuration status
  useEffect(() => {
    async function fetchConfigs() {
      try {
        setLoading(true);
        setError(null);

        const [geminiConfig, slackConfig, vertexConfig] = await Promise.all([
          settingsApi.getGeminiConfig().catch(() => null),
          settingsApi.getSlackConfig().catch(() => null),
          settingsApi.getVertexConfig().catch(() => null),
        ]);

        setServices((prev) =>
          prev.map((service) => {
            if (service.id === "gemini" && geminiConfig) {
              return {
                ...service,
                status: geminiConfig.configured ? "connected" : "not_configured",
                fields: service.fields.map((f) => ({
                  ...f,
                  value: f.key === "api_key" && geminiConfig.configured ? "••••••••" : "",
                })),
              };
            }
            if (service.id === "slack" && slackConfig) {
              return {
                ...service,
                status: slackConfig.configured ? "connected" : "not_configured",
                fields: service.fields.map((f) => ({
                  ...f,
                  value: slackConfig.configured ? "••••••••" : "",
                })),
              };
            }
            if (service.id === "vertex" && vertexConfig) {
              return {
                ...service,
                status: vertexConfig.configured ? "connected" : "not_configured",
                fields: service.fields.map((f) => ({
                  ...f,
                  value:
                    f.key === "project_id"
                      ? vertexConfig.project_id || ""
                      : f.key === "region"
                      ? vertexConfig.region || ""
                      : "",
                })),
              };
            }
            return service;
          })
        );
      } catch (err) {
        console.error("Config fetch error:", err);
        setError(err instanceof Error ? err.message : "設定の取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchConfigs();
  }, []);

  // Update field value
  const handleFieldChange = (serviceId: string, fieldKey: string, value: string) => {
    setServices((prev) =>
      prev.map((service) => {
        if (service.id === serviceId) {
          return {
            ...service,
            fields: service.fields.map((f) =>
              f.key === fieldKey ? { ...f, value } : f
            ),
          };
        }
        return service;
      })
    );
  };

  // Save configuration
  const handleSave = async (serviceId: string) => {
    const service = services.find((s) => s.id === serviceId);
    if (!service) return;

    try {
      setSaving(serviceId);
      setError(null);

      if (serviceId === "gemini") {
        const apiKey = service.fields.find((f) => f.key === "api_key")?.value;
        if (apiKey && apiKey !== "••••••••") {
          await settingsApi.configureGemini({ apiKey });
        }
      } else if (serviceId === "slack") {
        const botToken = service.fields.find((f) => f.key === "bot_token")?.value;
        const signingSecret = service.fields.find((f) => f.key === "signing_secret")?.value;
        if (botToken && botToken !== "••••••••" && signingSecret && signingSecret !== "••••••••") {
          await setupApi.configureSlack({ botToken, signingSecret });
        }
      }

      // Refresh config after save
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId ? { ...s, status: "connected" } : s
        )
      );
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(null);
    }
  };

  // Test connection
  const handleTest = async (serviceId: string) => {
    try {
      setTesting(serviceId);
      setError(null);

      if (serviceId === "slack") {
        const service = services.find((s) => s.id === "slack");
        const botToken = service?.fields.find((f) => f.key === "bot_token")?.value || "";
        const result = await setupApi.testSlackConnection(botToken);
        if (result.success) {
          setServices((prev) =>
            prev.map((s) =>
              s.id === serviceId ? { ...s, status: "connected" } : s
            )
          );
        } else {
          setServices((prev) =>
            prev.map((s) =>
              s.id === serviceId ? { ...s, status: "error" } : s
            )
          );
          setError("Slack接続テストに失敗しました");
        }
      }
    } catch (err) {
      console.error("Test error:", err);
      setError(err instanceof Error ? err.message : "接続テストに失敗しました");
      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId ? { ...s, status: "error" } : s
        )
      );
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="API設定">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="API設定">
      <p className="text-gray-600 mb-6">
        外部サービスとの連携設定。APIキーはSecret Managerに暗号化保存されます。
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleTest(service.id)}
                  disabled={testing === service.id || service.status === "not_configured"}
                >
                  {testing === service.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {service.fields.map((field) => (
                  <Input
                    key={field.key}
                    label={field.label}
                    type={field.type}
                    value={field.value || ""}
                    onChange={(e) => handleFieldChange(service.id, field.key, e.target.value)}
                    placeholder={field.type === "password" ? "••••••••" : `${field.label}を入力`}
                  />
                ))}
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={() => handleSave(service.id)}
                  disabled={saving === service.id}
                >
                  {saving === service.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
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

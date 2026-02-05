"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Badge } from "@/components/ui";
import { RefreshCw, CheckCircle, XCircle, Loader2, Info } from "lucide-react";
import { setupApi } from "@/lib/api";

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  detail?: string;
  error?: string;
}

export default function ApiSettingsPage() {
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      id: "firestore",
      name: "Firestore",
      description: "患者データ・レポートの保存",
      connected: false,
    },
    {
      id: "slack",
      name: "Slack",
      description: "多職種コミュニケーションプラットフォーム",
      connected: false,
    },
    {
      id: "gemini",
      name: "Gemini API",
      description: "LLMによるBPS構造化・サマリー生成",
      connected: false,
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch configuration status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await setupApi.testBackend();

      setServices([
        {
          id: "firestore",
          name: "Firestore",
          description: "患者データ・レポートの保存",
          connected: result.services.firestore.connected,
          error: result.services.firestore.error,
        },
        {
          id: "slack",
          name: "Slack",
          description: "多職種コミュニケーションプラットフォーム",
          connected: result.services.slack.connected,
          detail: result.services.slack.team_name,
          error: result.services.slack.error,
        },
        {
          id: "gemini",
          name: "Gemini API",
          description: "LLMによるBPS構造化・サマリー生成",
          connected: result.services.gemini.connected,
          detail: result.services.gemini.model,
          error: result.services.gemini.error,
        },
      ]);
    } catch (err) {
      console.error("Status fetch error:", err);
      setError(err instanceof Error ? err.message : "接続状態の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // Re-test connections
  const handleRefresh = async () => {
    setTesting(true);
    await fetchStatus();
    setTesting(false);
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
      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-medium mb-1">API Keyはバックエンドで管理されています</p>
          <p>
            Slack Bot Token、Signing Secret、Gemini API Key は
            バックエンドデプロイ時に Secret Manager で設定されています。
            変更が必要な場合は、Google Cloud Console の Secret Manager から更新してください。
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <p className="text-gray-600">
          外部サービスとの接続状態
        </p>
        <Button
          variant="secondary"
          onClick={handleRefresh}
          disabled={testing}
        >
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          再テスト
        </Button>
      </div>

      <div className="space-y-4">
        {services.map((service) => (
          <Card key={service.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {service.connected ? (
                  <div className="p-2 bg-green-100 rounded-lg">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                ) : (
                  <div className="p-2 bg-red-100 rounded-lg">
                    <XCircle className="w-6 h-6 text-red-600" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500">{service.description}</p>
                  {service.detail && (
                    <p className="text-xs text-gray-400 mt-1">{service.detail}</p>
                  )}
                  {service.error && (
                    <p className="text-xs text-red-500 mt-1">{service.error}</p>
                  )}
                </div>
              </div>
              <Badge variant={service.connected ? "success" : "danger"}>
                {service.connected ? "接続済み" : "未接続"}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Secret Manager Link */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">API Keyの変更方法</h4>
        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
          <li>Google Cloud Console にアクセス</li>
          <li>セキュリティ → Secret Manager を開く</li>
          <li>該当のシークレット（slack-bot-token, gemini-api-key など）を選択</li>
          <li>「新しいバージョン」で新しい値を追加</li>
          <li>Cloud Run サービスを再起動（必要に応じて）</li>
        </ol>
      </div>
    </AdminLayout>
  );
}

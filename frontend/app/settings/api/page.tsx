"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input, Badge, Alert } from "@/components/ui";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  Save,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { setupApi, settingsApi, getOrgId } from "@/lib/api";

interface ServiceStatus {
  id: string;
  name: string;
  description: string;
  connected: boolean;
  detail?: string;
  error?: string;
}

export default function ServiceSettingsPage() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Slack form
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackSuccess, setSlackSuccess] = useState<string | null>(null);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackOpen, setSlackOpen] = useState(false);

  // Gemini form
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [geminiSaving, setGeminiSaving] = useState(false);
  const [geminiSuccess, setGeminiSuccess] = useState<string | null>(null);
  const [geminiError, setGeminiError] = useState<string | null>(null);
  const [geminiOpen, setGeminiOpen] = useState(false);

  // Fetch status using org-specific endpoint for consistency
  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let orgId: string;
      try {
        orgId = getOrgId();
      } catch {
        // org_id not set yet - use non-org endpoint as fallback
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
        return;
      }

      const result = await setupApi.testBackendWithOrg(orgId);

      const newServices: ServiceStatus[] = [
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
      ];

      setServices(newServices);

      // Auto-open config sections for disconnected services
      if (!result.services.slack.connected) setSlackOpen(true);
      if (!result.services.gemini.connected) setGeminiOpen(true);
    } catch (err) {
      console.error("Status fetch error:", err);
      setError(
        err instanceof Error ? err.message : "接続状態の取得に失敗しました"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleRefresh = async () => {
    setTesting(true);
    await fetchStatus();
    setTesting(false);
  };

  // Slack save
  const handleSlackSave = async () => {
    if (!slackBotToken.trim() || !slackSigningSecret.trim()) {
      setSlackError("Bot TokenとSigning Secretの両方を入力してください");
      return;
    }

    try {
      setSlackSaving(true);
      setSlackError(null);
      setSlackSuccess(null);

      const orgId = getOrgId();
      const result = await setupApi.configureApiKeys({
        orgId,
        slackBotToken,
        slackSigningSecret,
      });

      if (result.success) {
        setSlackSuccess("Slack設定を保存しました");
        setSlackBotToken("");
        setSlackSigningSecret("");
        await fetchStatus();
      } else {
        setSlackError(result.error || "保存に失敗しました");
      }
    } catch (err) {
      setSlackError(
        err instanceof Error ? err.message : "保存に失敗しました"
      );
    } finally {
      setSlackSaving(false);
    }
  };

  // Gemini save
  const handleGeminiSave = async () => {
    if (!geminiApiKey.trim()) {
      setGeminiError("API Keyを入力してください");
      return;
    }

    try {
      setGeminiSaving(true);
      setGeminiError(null);
      setGeminiSuccess(null);

      const result = await settingsApi.configureGemini({
        apiKey: geminiApiKey,
      });

      if (result.success) {
        setGeminiSuccess("Gemini API設定を保存しました");
        setGeminiApiKey("");
        await fetchStatus();
      } else {
        setGeminiError("保存に失敗しました");
      }
    } catch (err) {
      setGeminiError(
        err instanceof Error ? err.message : "保存に失敗しました"
      );
    } finally {
      setGeminiSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="サービス接続">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
        </div>
      </AdminLayout>
    );
  }

  const slackService = services.find((s) => s.id === "slack");
  const geminiService = services.find((s) => s.id === "gemini");

  return (
    <AdminLayout title="サービス接続">
      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError(null)} className="mb-6">
          {error}
        </Alert>
      )}

      <div className="flex justify-between items-center mb-6">
        <p className="text-text-secondary">
          外部サービスとの接続状態の確認・設定変更
        </p>
        <Button variant="secondary" onClick={handleRefresh} disabled={testing}>
          {testing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          全て再テスト
        </Button>
      </div>

      <div className="space-y-4">
        {/* Firestore - status only, no config needed */}
        {services
          .filter((s) => s.id === "firestore")
          .map((service) => (
            <Card key={service.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <StatusIcon connected={service.connected} />
                  <div>
                    <h3 className="font-semibold text-text-primary">
                      {service.name}
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {service.description}
                    </p>
                    {service.error && (
                      <p className="text-xs text-danger mt-1">
                        {service.error}
                      </p>
                    )}
                  </div>
                </div>
                <Badge
                  variant={service.connected ? "success" : "danger"}
                >
                  {service.connected ? "接続済み" : "未接続"}
                </Badge>
              </div>
            </Card>
          ))}

        {/* Slack - status + config */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusIcon connected={slackService?.connected ?? false} />
              <div>
                <h3 className="font-semibold text-text-primary">Slack</h3>
                <p className="text-sm text-text-secondary">
                  多職種コミュニケーションプラットフォーム
                </p>
                {slackService?.detail && (
                  <p className="text-xs text-text-tertiary mt-1">
                    ワークスペース: {slackService.detail}
                  </p>
                )}
                {slackService?.error && (
                  <p className="text-xs text-danger mt-1">
                    {slackService.error}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant={slackService?.connected ? "success" : "danger"}
              >
                {slackService?.connected ? "接続済み" : "未接続"}
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSlackOpen(!slackOpen)}
              >
                {slackOpen ? (
                  <ChevronUp className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 mr-1" />
                )}
                設定
              </Button>
            </div>
          </div>

          {slackOpen && (
            <div className="mt-4 pt-4 border-t border-border">
              {slackError && (
                <Alert variant="error">{slackError}</Alert>
              )}
              {slackSuccess && (
                <Alert variant="success">{slackSuccess}</Alert>
              )}

              <div className="space-y-4">
                <Input
                  label="Bot User OAuth Token"
                  type="password"
                  value={slackBotToken}
                  onChange={(e) => setSlackBotToken(e.target.value)}
                  placeholder="xoxb-..."
                />
                <Input
                  label="Signing Secret"
                  type="password"
                  value={slackSigningSecret}
                  onChange={(e) => setSlackSigningSecret(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={handleSlackSave}
                  disabled={
                    slackSaving ||
                    !slackBotToken.trim() ||
                    !slackSigningSecret.trim()
                  }
                >
                  {slackSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  保存して接続テスト
                </Button>
              </div>

              {/* Slack help */}
              <div className="mt-4 p-3 bg-bg-secondary rounded-lg text-sm text-text-secondary">
                <p className="font-medium mb-2">Slack Appの作成手順:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>
                    <a
                      href="https://api.slack.com/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-600 hover:underline inline-flex items-center"
                    >
                      Slack API <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                    で新しいアプリを作成
                  </li>
                  <li>OAuth & Permissions で Bot Token Scopes を設定</li>
                  <li>ワークスペースにインストール</li>
                  <li>Bot User OAuth Token と Signing Secret をコピー</li>
                </ol>
                <div className="mt-3">
                  <p className="font-medium mb-1">必要なBot Token Scopes（15個）：</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div><code className="bg-bg-hover px-1 rounded">channels:manage</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">channels:read</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">channels:join</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">channels:history</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">chat:write</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">groups:write</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">groups:read</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">groups:history</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">users:read</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">users:read.email</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">files:read</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">app_mentions:read</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">im:history</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">im:read</code></div>
                    <div><code className="bg-bg-hover px-1 rounded">im:write</code></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Gemini - status + config */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <StatusIcon connected={geminiService?.connected ?? false} />
              <div>
                <h3 className="font-semibold text-text-primary">Gemini API</h3>
                <p className="text-sm text-text-secondary">
                  LLMによるBPS構造化・サマリー生成
                </p>
                {geminiService?.detail && (
                  <p className="text-xs text-text-tertiary mt-1">
                    モデル: {geminiService.detail}
                  </p>
                )}
                {geminiService?.error && (
                  <p className="text-xs text-danger mt-1">
                    {geminiService.error}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant={geminiService?.connected ? "success" : "danger"}
              >
                {geminiService?.connected ? "接続済み" : "未接続"}
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setGeminiOpen(!geminiOpen)}
              >
                {geminiOpen ? (
                  <ChevronUp className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronDown className="w-4 h-4 mr-1" />
                )}
                設定
              </Button>
            </div>
          </div>

          {geminiOpen && (
            <div className="mt-4 pt-4 border-t border-border">
              {geminiError && (
                <Alert variant="error">{geminiError}</Alert>
              )}
              {geminiSuccess && (
                <Alert variant="success">{geminiSuccess}</Alert>
              )}

              <div className="space-y-4">
                <Input
                  label="Gemini API Key"
                  type="password"
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIza..."
                />
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  onClick={handleGeminiSave}
                  disabled={geminiSaving || !geminiApiKey.trim()}
                >
                  {geminiSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  保存して接続テスト
                </Button>
              </div>

              {/* Gemini help */}
              <div className="mt-4 p-3 bg-bg-secondary rounded-lg text-sm text-text-secondary">
                <p className="font-medium mb-2">Gemini API Keyの取得手順:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-600 hover:underline inline-flex items-center"
                    >
                      Google AI Studio <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                    にアクセス
                  </li>
                  <li>Googleアカウントでログイン</li>
                  <li>「Create API Key」をクリック</li>
                  <li>生成されたAPI Keyをコピー</li>
                </ol>
                <div className="mt-2 p-2 bg-warning-light rounded text-xs text-warning">
                  API Keyは安全に保管し、他人と共有しないでください。
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}

function StatusIcon({ connected }: { connected: boolean }) {
  return connected ? (
    <div className="p-2 bg-bg-tertiary rounded-md">
      <CheckCircle className="w-5 h-5 text-success" />
    </div>
  ) : (
    <div className="p-2 bg-bg-tertiary rounded-md">
      <XCircle className="w-5 h-5 text-danger" />
    </div>
  );
}

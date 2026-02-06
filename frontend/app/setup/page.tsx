"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, Badge } from "@/components/ui";
import { Check, ChevronRight, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { setupApi, setOrgId, setUserData } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  {
    id: 1,
    title: "組織情報",
    description: "組織名と管理者情報を入力",
  },
  {
    id: 2,
    title: "API設定",
    description: "SlackとGemini APIの設定",
  },
  {
    id: 3,
    title: "接続確認",
    description: "サービスとの接続を確認",
  },
  {
    id: 4,
    title: "完了",
    description: "セットアップ完了",
  },
];

export default function SetupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Organization info
  const [orgName, setOrgName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  // Step 2: API Keys
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState("");

  // Step 3: Backend test result
  const [backendTestResult, setBackendTestResult] = useState<{
    success: boolean;
    services: {
      firestore: { connected: boolean; error?: string };
      slack: { connected: boolean; team_name?: string; error?: string };
      gemini: { connected: boolean; model?: string; error?: string };
    };
  } | null>(null);

  // Pre-fill admin email from logged-in user
  useEffect(() => {
    if (user?.email && !adminEmail) {
      setAdminEmail(user.email);
    }
  }, [user, adminEmail]);

  // Step 1: Initialize organization
  const handleInitOrganization = async () => {
    if (!orgName.trim()) {
      setError("組織名を入力してください");
      return;
    }
    if (!adminEmail.trim()) {
      setError("管理者メールアドレスを入力してください");
      return;
    }
    if (!user?.uid) {
      setError("ログインが必要です");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await setupApi.initOrganization({
        uid: user.uid,
        name: orgName,
        adminEmail,
      });

      if (result.success && result.org_id) {
        // Save org ID for future API calls
        setOrgId(result.org_id);
        setCurrentStep(2);
      } else {
        setError("組織の作成に失敗しました");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "組織の作成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Configure API Keys
  const handleConfigureApiKeys = async () => {
    if (!slackBotToken.trim()) {
      setError("Slack Bot Tokenを入力してください");
      return;
    }
    if (!slackSigningSecret.trim()) {
      setError("Slack Signing Secretを入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await setupApi.configureApiKeys({
        orgId: localStorage.getItem("org_id") || "",
        slackBotToken,
        slackSigningSecret,
        geminiApiKey: geminiApiKey || undefined,
      });

      if (result.success) {
        setCurrentStep(3);
      } else {
        setError(result.error || "API設定の保存に失敗しました");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "API設定の保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Test backend connectivity
  const handleTestBackend = async () => {
    setLoading(true);
    setError(null);

    try {
      const orgId = localStorage.getItem("org_id") || "";
      const result = await setupApi.testBackendWithOrg(orgId);
      setBackendTestResult(result);

      if (!result.success) {
        const errors: string[] = [];
        if (!result.services.firestore.connected) {
          errors.push(`Firestore: ${result.services.firestore.error || "接続失敗"}`);
        }
        if (!result.services.slack.connected) {
          errors.push(`Slack: ${result.services.slack.error || "接続失敗"}`);
        }
        if (!result.services.gemini.connected) {
          errors.push(`Gemini: ${result.services.gemini.error || "接続失敗"}`);
        }
        setError(errors.join("\n"));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "接続テストに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Step 3 → 4: Complete setup
  const handleProceedToComplete = () => {
    setCurrentStep(4);
  };

  // Step 3: Complete setup and go to dashboard
  const handleCompleteSetup = async () => {
    // Refresh user data to get the updated organizationId
    if (user?.uid) {
      try {
        const userData = await setupApi.getOrCreateUser({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || undefined,
        });
        setUserData(userData);
      } catch (err) {
        console.error("Failed to refresh user data:", err);
      }
    }
    router.push("/");
  };

  return (
    <AdminLayout title="初期セットアップ">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step.id < currentStep
                      ? "bg-green-500 text-white"
                      : step.id === currentStep
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step.id < currentStep ? <Check className="w-5 h-5" /> : step.id}
                </div>
                <p className="text-sm font-medium mt-2">{step.title}</p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-32 h-1 mx-4 ${
                    step.id < currentStep ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <pre className="whitespace-pre-wrap text-sm">{error}</pre>
        </div>
      )}

      {/* Step 1: Organization Info */}
      {currentStep === 1 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 1: 組織情報の入力</h2>
          <p className="text-gray-600 mb-6">
            組織名と管理者のメールアドレスを入力してください。
          </p>
          <div className="space-y-4">
            <Input
              label="組織名"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="例：〇〇在宅クリニック"
              required
            />
            <Input
              label="管理者メールアドレス"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={handleInitOrganization} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              次へ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2: API Configuration */}
      {currentStep === 2 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 2: API設定</h2>
          <p className="text-gray-600 mb-6">
            SlackとGemini APIの認証情報を入力してください。
          </p>

          <div className="space-y-6">
            {/* Slack Settings */}
            <div className="border-b pb-4">
              <h3 className="font-medium text-gray-900 mb-3">Slack Bot 設定</h3>
              <div className="space-y-4">
                <Input
                  label="Bot User OAuth Token"
                  type="password"
                  value={slackBotToken}
                  onChange={(e) => setSlackBotToken(e.target.value)}
                  placeholder="xoxb-..."
                  required
                />
                <Input
                  label="Signing Secret"
                  type="password"
                  value={slackSigningSecret}
                  onChange={(e) => setSlackSigningSecret(e.target.value)}
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxx"
                  required
                />
              </div>
              <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
                <p className="font-medium mb-1">Slack App の作成方法：</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li><a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Slack API</a> で新しいアプリを作成</li>
                  <li>OAuth & Permissions で Bot Token Scopes を設定</li>
                  <li>ワークスペースにインストール</li>
                  <li>Bot User OAuth Token と Signing Secret をコピー</li>
                </ol>
                <p className="font-medium mt-3 mb-1">必要な Bot Token Scopes：</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li><code className="bg-gray-200 px-1 rounded">channels:manage</code> - チャンネル作成</li>
                  <li><code className="bg-gray-200 px-1 rounded">channels:read</code> - チャンネル情報取得</li>
                  <li><code className="bg-gray-200 px-1 rounded">channels:join</code> - Botのチャンネル参加</li>
                  <li><code className="bg-gray-200 px-1 rounded">chat:write</code> - メッセージ投稿</li>
                  <li><code className="bg-gray-200 px-1 rounded">groups:write</code> - プライベートチャンネル操作</li>
                  <li><code className="bg-gray-200 px-1 rounded">groups:read</code> - プライベートチャンネル情報取得</li>
                  <li><code className="bg-gray-200 px-1 rounded">users:read</code> - メンバー情報取得</li>
                  <li><code className="bg-gray-200 px-1 rounded">files:read</code> - 添付ファイル読み取り</li>
                  <li><code className="bg-gray-200 px-1 rounded">app_mentions:read</code> - @bot メンション検知</li>
                </ul>
              </div>
            </div>

            {/* Gemini Settings */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Gemini API 設定（任意）</h3>
              <Input
                label="Gemini API Key"
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza..."
              />
              <p className="mt-2 text-sm text-gray-500">
                未入力の場合はシステムデフォルトのAPIキーが使用されます。
              </p>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setCurrentStep(1)}>
              戻る
            </Button>
            <Button onClick={handleConfigureApiKeys} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              次へ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3: Backend Connection Test */}
      {currentStep === 3 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 3: 接続確認</h2>
          <p className="text-gray-600 mb-6">
            設定したAPI Keyでサービスへの接続を確認します。
          </p>

          {/* Service Status */}
          <div className="space-y-3 mb-6">
            <ServiceStatusItem
              name="Firestore"
              status={backendTestResult?.services.firestore}
            />
            <ServiceStatusItem
              name="Slack"
              status={backendTestResult?.services.slack}
              detail={backendTestResult?.services.slack?.team_name}
            />
            <ServiceStatusItem
              name="Gemini API"
              status={backendTestResult?.services.gemini}
              detail={backendTestResult?.services.gemini?.model}
            />
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setCurrentStep(2)}>
              戻る
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleTestBackend}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                接続テスト実行
              </Button>
              <Button
                onClick={handleProceedToComplete}
                disabled={!backendTestResult?.success}
              >
                次へ
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 4: Complete */}
      {currentStep === 4 && (
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">セットアップ完了！</h2>
            <p className="text-gray-600 mb-6">
              HomeCare AIの初期設定が完了しました。<br />
              ダッシュボードから患者の登録を開始できます。
            </p>
            <Button onClick={handleCompleteSetup} className="mx-auto">
              ダッシュボードへ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}

// Service status display component
function ServiceStatusItem({
  name,
  status,
  detail,
}: {
  name: string;
  status?: { connected: boolean; error?: string };
  detail?: string;
}) {
  const isConnected = status?.connected ?? false;
  const isTested = status !== undefined;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        {isTested ? (
          isConnected ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-500" />
          )
        ) : (
          <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
        )}
        <div>
          <span className="font-medium">{name}</span>
          {detail && <p className="text-xs text-gray-500">{detail}</p>}
          {status?.error && (
            <p className="text-xs text-red-500">{status.error}</p>
          )}
        </div>
      </div>
      <Badge
        variant={
          !isTested ? "default" : isConnected ? "success" : "danger"
        }
      >
        {!isTested ? "未テスト" : isConnected ? "接続成功" : "接続失敗"}
      </Badge>
    </div>
  );
}

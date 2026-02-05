"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, Badge } from "@/components/ui";
import { Check, ChevronRight, ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { setupApi, setOrgId } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  {
    id: 1,
    title: "組織情報",
    description: "組織名と管理者情報を入力",
  },
  {
    id: 2,
    title: "Slack連携",
    description: "Slack Appを作成してトークンを入力",
  },
  {
    id: 3,
    title: "接続テスト",
    description: "Slackとの接続を確認",
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

  // Step 2: Slack tokens
  const [botToken, setBotToken] = useState("");
  const [signingSecret, setSigningSecret] = useState("");

  // Step 3: Connection test result
  const [slackTestResult, setSlackTestResult] = useState<{
    success: boolean;
    teamName?: string;
    botName?: string;
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

    setLoading(true);
    setError(null);

    try {
      // Generate org ID from name or use a simple ID
      const orgId = "org-" + Date.now();

      const result = await setupApi.initOrganization({
        orgId,
        name: orgName,
        adminEmail,
      });

      if (result.success) {
        // Save org ID for future API calls
        setOrgId(result.org_id || orgId);
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

  // Step 3: Test Slack connection
  const handleTestSlackConnection = async () => {
    if (!botToken.trim()) {
      setError("Bot Tokenを入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await setupApi.testSlackConnection(botToken);

      if (result.success) {
        setSlackTestResult({
          success: true,
          teamName: result.team?.name,
          botName: result.bot?.name,
        });
      } else {
        setSlackTestResult({ success: false });
        setError(result.error || "Slack接続テストに失敗しました");
      }
    } catch (err) {
      setSlackTestResult({ success: false });
      setError(err instanceof Error ? err.message : "Slack接続テストに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Configure Slack
  const handleConfigureSlack = async () => {
    if (!slackTestResult?.success) {
      setError("先に接続テストを実行してください");
      return;
    }
    if (!signingSecret.trim()) {
      setError("Signing Secretを入力してください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await setupApi.configureSlack({
        botToken,
        signingSecret,
      });

      if (result.success) {
        setCurrentStep(4);
      } else {
        setError("Slack設定の保存に失敗しました");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Slack設定の保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Complete setup and go to dashboard
  const handleCompleteSetup = () => {
    router.push("/");
  };

  // Skip Slack setup (optional)
  const handleSkipSlack = () => {
    setCurrentStep(4);
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
                  className={`w-24 h-1 mx-2 ${
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
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          {error}
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

      {/* Step 2: Slack App Creation Guide */}
      {currentStep === 2 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 2: Slack Appの作成</h2>
          <div className="space-y-4 text-gray-600">
            <p>以下の手順でSlack Appを作成してください：</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Slack API管理画面にアクセス</li>
              <li>「Create New App」をクリック</li>
              <li>「From scratch」を選択</li>
              <li>App名を「HomeCare AI」に設定</li>
              <li>対象のワークスペースを選択</li>
            </ol>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>権限設定：</strong>OAuth & Permissions で以下のBot Token Scopesを追加してください：
                <br />
                <code className="text-xs">channels:manage, channels:read, channels:history, chat:write, users:read, groups:read, groups:write</code>
              </p>
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="font-semibold mb-3">トークン入力</h3>
              <p className="text-sm text-gray-500 mb-4">
                Slack Appから取得したトークンを入力してください。
              </p>
              <div className="space-y-4">
                <Input
                  label="Bot User OAuth Token"
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder="xoxb-..."
                />
                <Input
                  label="Signing Secret"
                  type="password"
                  value={signingSecret}
                  onChange={(e) => setSigningSecret(e.target.value)}
                  placeholder="Basic Information → App Credentials から取得"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setCurrentStep(1)}>
                戻る
              </Button>
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg"
              >
                Slack API管理画面
                <ExternalLink className="w-4 h-4 ml-1" />
              </a>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleSkipSlack}>
                スキップ
              </Button>
              <Button onClick={() => setCurrentStep(3)} disabled={!botToken}>
                次へ
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Step 3: Connection Test */}
      {currentStep === 3 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 3: 接続テスト</h2>
          <p className="text-gray-600 mb-4">
            入力したトークンでSlackに接続できるか確認します。
          </p>

          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <span>接続状態</span>
              {slackTestResult === null ? (
                <Badge variant="default">未テスト</Badge>
              ) : slackTestResult.success ? (
                <Badge variant="success">接続成功</Badge>
              ) : (
                <Badge variant="danger">接続失敗</Badge>
              )}
            </div>
            {slackTestResult?.success && (
              <div className="mt-2 text-sm text-gray-600">
                <p>ワークスペース: {slackTestResult.teamName}</p>
                <p>Bot名: {slackTestResult.botName}</p>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setCurrentStep(2)}>
              戻る
            </Button>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleTestSlackConnection}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                接続テスト実行
              </Button>
              <Button
                onClick={handleConfigureSlack}
                disabled={!slackTestResult?.success || loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                設定を保存
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

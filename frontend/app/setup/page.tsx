"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, Badge, Alert } from "@/components/ui";
import { Check, ChevronRight, Loader2 } from "lucide-react";
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

  // Step 2: Complete setup and go to dashboard
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
                      ? "bg-success text-white"
                      : step.id === currentStep
                      ? "bg-accent-600 text-white"
                      : "bg-bg-hover text-text-tertiary"
                  }`}
                >
                  {step.id < currentStep ? <Check className="w-5 h-5" /> : step.id}
                </div>
                <p className="text-sm font-medium mt-2">{step.title}</p>
                <p className="text-xs text-text-tertiary">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-32 h-1 mx-4 ${
                    step.id < currentStep ? "bg-accent-500" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError(null)} className="mb-4">
          {error}
        </Alert>
      )}

      {/* Step 1: Organization Info */}
      {currentStep === 1 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 1: 組織情報の入力</h2>
          <p className="text-text-secondary mb-6">
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

      {/* Step 2: Complete */}
      {currentStep === 2 && (
        <Card>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-success-light rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-semibold mb-2">セットアップ完了！</h2>
            <p className="text-text-secondary mb-6">
              組織の登録が完了しました。<br />
              次に設定画面からSlackとGemini APIを設定してください。
            </p>
            <div className="text-sm text-text-secondary mb-6 space-y-1">
              <p>設定 → <strong>Slack設定</strong>: Bot TokenとSigning Secretを入力</p>
              <p>設定 → <strong>Gemini設定</strong>: API Keyを入力</p>
            </div>
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

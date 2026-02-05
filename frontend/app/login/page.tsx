"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card, Badge } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, loading: authLoading, isDemoMode, login } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);

    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push("/");
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4">
            <span className="text-white font-bold text-2xl">HC</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HomeCare AI</h1>
          <p className="text-gray-500 mt-1">在宅医療支援システム</p>
          {isDemoMode && (
            <Badge variant="warning" size="md">
              デモモード
            </Badge>
          )}
        </div>

        {/* Login Card */}
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">ログイン</h2>
              <p className="text-sm text-gray-500">管理画面にアクセスするにはログインしてください</p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Input
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoComplete="email"
            />

            <Input
              label="パスワード"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />

            <Button type="submit" className="w-full" loading={loading}>
              ログイン
            </Button>
          </form>
        </Card>

        {/* Demo Credentials */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700 font-medium mb-2">デモ用アカウント</p>
          <p className="text-sm text-blue-600">
            メール: demo@homecare.ai
            <br />
            パスワード: demo1234
          </p>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          © 2026 HomeCare AI - GCP AI Hackathon Vol.4
        </p>
      </div>
    </div>
  );
}

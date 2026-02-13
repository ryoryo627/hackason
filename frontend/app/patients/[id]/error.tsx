"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

export default function PatientDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Patient detail error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-danger" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            患者情報の読み込みに失敗しました
          </h2>
          <p className="text-text-secondary">
            データの取得中にエラーが発生しました。もう一度お試しください。
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-600 text-white hover:bg-accent-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            もう一度試す
          </button>
          <Link
            href="/patients"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-text-secondary hover:bg-bg-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            患者一覧に戻る
          </Link>
        </div>
      </div>
    </div>
  );
}

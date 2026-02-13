"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-danger/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-danger" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">
            エラーが発生しました
          </h2>
          <p className="text-text-secondary">
            予期しないエラーが発生しました。もう一度お試しください。
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-600 text-white hover:bg-accent-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          もう一度試す
        </button>
      </div>
    </div>
  );
}

"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import clsx from "clsx";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

function ToastEntry({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const autoTimer = setTimeout(() => {
      setExiting(true);
    }, 3000);
    return () => clearTimeout(autoTimer);
  }, []);

  useEffect(() => {
    if (!exiting) return;
    const removeTimer = setTimeout(() => {
      onDismiss(item.id);
    }, 300);
    return () => clearTimeout(removeTimer);
  }, [exiting, item.id, onDismiss]);

  const handleClose = () => {
    setExiting(true);
  };

  const icons: Record<ToastVariant, ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-success shrink-0" />,
    error: <XCircle className="h-5 w-5 text-danger shrink-0" />,
    info: <Info className="h-5 w-5 text-accent-500 shrink-0" />,
  };

  const borderColors: Record<ToastVariant, string> = {
    success: "border-l-success",
    error: "border-l-danger",
    info: "border-l-accent-500",
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={clsx(
        "pointer-events-auto flex w-80 items-start gap-3 rounded-md border border-border border-l-[3px] bg-white p-4 shadow-lg",
        borderColors[item.variant],
        exiting ? "animate-toast-out" : "animate-toast-in"
      )}
    >
      {icons[item.variant]}
      <p className="flex-1 text-sm text-text-primary">{item.message}</p>
      <button
        onClick={handleClose}
        className="shrink-0 rounded p-0.5 text-text-tertiary transition-colors duration-200 hover:bg-bg-tertiary hover:text-text-secondary"
        aria-label="閉じる"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = `toast-${++toastIdCounter}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-label="通知"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2"
      >
        {toasts.map((item) => (
          <ToastEntry key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

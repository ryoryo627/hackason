"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import clsx from "clsx";

export interface AlertProps {
  variant?: "error" | "success" | "warning" | "info";
  children: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

const variantConfig = {
  error: {
    container: "border-l-[3px] border-danger bg-danger-light text-text-primary shadow-xs",
    icon: AlertTriangle,
    iconClass: "text-danger",
    dismissClass: "text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary",
  },
  success: {
    container: "border-l-[3px] border-success bg-success-light text-text-primary shadow-xs",
    icon: CheckCircle,
    iconClass: "text-success",
    dismissClass: "text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary",
  },
  warning: {
    container: "border-l-[3px] border-warning bg-warning-light text-text-primary shadow-xs",
    icon: AlertTriangle,
    iconClass: "text-warning",
    dismissClass: "text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary",
  },
  info: {
    container: "border-l-[3px] border-accent-500 bg-accent-50 text-text-primary shadow-xs",
    icon: Info,
    iconClass: "text-accent-500",
    dismissClass: "text-text-tertiary hover:text-text-secondary hover:bg-bg-tertiary",
  },
} as const;

export function Alert({
  variant = "info",
  children,
  dismissible = false,
  onDismiss,
  className,
}: AlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={clsx(
        "flex items-start gap-3 rounded-md px-4 py-3 text-sm",
        config.container,
        className
      )}
    >
      <Icon className={clsx("h-5 w-5 shrink-0 mt-0.5", config.iconClass)} aria-hidden="true" />
      <div className="flex-1 min-w-0">{children}</div>
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={clsx(
            "shrink-0 rounded-md p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1",
            config.dismissClass
          )}
          aria-label="閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

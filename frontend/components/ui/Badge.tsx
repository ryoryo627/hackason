import clsx from "clsx";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  size?: "sm" | "md";
  dot?: boolean;
}

export function Badge({ children, variant = "default", size = "sm", dot = false }: BadgeProps) {
  const variants = {
    default: "bg-bg-secondary text-text-primary",
    success: "bg-success-subtle text-success",
    warning: "bg-warning-subtle text-warning",
    danger: "bg-danger-subtle text-danger",
    info: "bg-info-subtle text-accent-700",
  };

  const dotColors = {
    default: "bg-text-tertiary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    info: "bg-accent-500",
  };

  const sizes = {
    sm: "px-2.5 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span className={clsx(
      "inline-flex items-center gap-1.5 font-medium rounded-full tracking-[0.01em]",
      variants[variant],
      sizes[size]
    )}>
      {dot && (
        <span className={clsx("h-2 w-2 rounded-full", dotColors[variant])} aria-hidden="true" />
      )}
      {children}
    </span>
  );
}

// Risk level badge helper
export function RiskBadge({ level, source }: { level: "HIGH" | "MEDIUM" | "LOW"; source?: "auto" | "manual" }) {
  const config = {
    HIGH: { variant: "danger" as const, label: "高リスク" },
    MEDIUM: { variant: "warning" as const, label: "中リスク" },
    LOW: { variant: "success" as const, label: "低リスク" },
  };

  const { variant, label } = config[level];
  return (
    <Badge variant={variant} dot>
      {source === "auto" && (
        <span className="text-[10px] font-bold opacity-70 mr-0.5" title="AI自動判定">AI</span>
      )}
      {label}
    </Badge>
  );
}

// Alert severity badge helper
export function SeverityBadge({ severity }: { severity: "HIGH" | "MEDIUM" | "LOW" }) {
  const config = {
    HIGH: { variant: "danger" as const, label: "緊急" },
    MEDIUM: { variant: "warning" as const, label: "注意" },
    LOW: { variant: "info" as const, label: "情報" },
  };

  const { variant, label } = config[severity];
  return <Badge variant={variant} dot>{label}</Badge>;
}

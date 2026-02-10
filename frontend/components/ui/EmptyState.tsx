import type { ComponentType } from "react";
import { Inbox } from "lucide-react";
import { Button } from "./Button";
import clsx from "clsx";

export interface EmptyStateProps {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="w-14 h-14 rounded-full bg-bg-tertiary flex items-center justify-center">
        <Icon className="h-7 w-7 text-text-tertiary" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-medium text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          <Button variant="primary" size="sm" onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}

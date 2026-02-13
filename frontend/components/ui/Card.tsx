import { type ReactNode } from "react";
import clsx from "clsx";

export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  interactive?: boolean;
}

export function Card({ children, className, padding = "md", interactive = false }: CardProps) {
  const paddingStyles = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div className={clsx(
      "bg-white rounded-md border border-border transition-all duration-120 ease-in-out",
      interactive && "cursor-pointer hover:border-border-strong hover:shadow-sm active:bg-bg-secondary",
      !interactive && "hover:border-border-strong",
      paddingStyles[padding],
      className
    )}>
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3 className="text-lg font-semibold text-text-primary leading-tight">{title}</h3>
        {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

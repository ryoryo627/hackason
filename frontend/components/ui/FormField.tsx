import type { ReactNode } from "react";
import clsx from "clsx";

export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  required,
  error,
  description,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={clsx("w-full", className)}>
      <label className="mb-1 block text-sm font-medium text-text-primary">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-label="必須">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {!error && description && (
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      )}
    </div>
  );
}

"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import clsx from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium tracking-[-0.01em] text-text-primary mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "block w-full rounded-md border px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary",
            "focus:outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-500/15",
            "disabled:bg-bg-secondary disabled:text-text-secondary disabled:cursor-not-allowed",
            "transition-all duration-200 ease-in-out",
            error ? "border-danger" : "border-border hover:border-border-strong",
            className
          )}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-danger">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

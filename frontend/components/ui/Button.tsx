"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "danger-fill" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium rounded-md tracking-[-0.01em] transition-colors duration-120 focus:outline-none focus-visible:shadow-focus disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary:
        "bg-accent-600 text-white shadow-xs hover:bg-accent-700 active:bg-accent-800",
      secondary:
        "bg-transparent text-text-primary border border-border hover:bg-bg-tertiary active:bg-bg-active",
      danger:
        "bg-transparent text-danger hover:bg-danger-subtle active:bg-danger-subtle",
      "danger-fill":
        "bg-danger text-white hover:bg-danger/90 active:bg-danger/80",
      ghost:
        "bg-transparent text-text-secondary hover:bg-bg-hover hover:text-text-primary active:bg-bg-active",
    };

    const sizes = {
      sm: "px-2.5 py-1 text-xs h-7",
      md: "px-3 py-1.5 text-sm h-8",
      lg: "px-4 py-2 text-sm h-9",
      icon: "p-1.5",
    };

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

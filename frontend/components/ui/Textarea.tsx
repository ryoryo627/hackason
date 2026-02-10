"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";
import clsx from "clsx";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  charCount?: boolean;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, charCount = false, maxLength, id, value, defaultValue, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
    const currentLength = typeof value === "string" ? value.length : 0;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium tracking-[-0.01em] text-text-primary mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          value={value}
          defaultValue={defaultValue}
          maxLength={maxLength}
          className={clsx(
            "block w-full rounded-md border px-3 py-2 text-text-primary placeholder:text-text-tertiary",
            "focus:outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-500/15",
            "disabled:bg-bg-secondary disabled:text-text-secondary disabled:cursor-not-allowed",
            "resize-y min-h-[80px]",
            "transition-all duration-200 ease-in-out",
            error ? "border-danger" : "border-border hover:border-border-strong",
            className
          )}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={
            [error && `${textareaId}-error`, charCount && `${textareaId}-count`]
              .filter(Boolean)
              .join(" ") || undefined
          }
          {...props}
        />
        <div className="flex items-center justify-between mt-1">
          <div>
            {error && (
              <p id={`${textareaId}-error`} className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </div>
          {charCount && (
            <p id={`${textareaId}-count`} className="text-xs text-text-tertiary ml-auto">
              {maxLength ? `${currentLength} / ${maxLength}` : `${currentLength}`}文字
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

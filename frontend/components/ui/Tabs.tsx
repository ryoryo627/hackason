"use client";

import type { ComponentType } from "react";
import clsx from "clsx";

interface TabItem {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  return (
    <div
      className={clsx("border-b border-border", className)}
      role="tablist"
      aria-orientation="horizontal"
    >
      <nav className="-mb-px flex gap-6" aria-label="タブ">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => onChange(tab.id)}
              className={clsx(
                "relative inline-flex items-center gap-2 px-1 pb-3 text-sm tracking-[-0.01em] transition-all duration-200",
                isActive
                  ? "font-semibold text-text-primary"
                  : "font-medium text-text-secondary hover:text-text-primary hover:bg-bg-tertiary/50 rounded-t-md"
              )}
            >
              {Icon && (
                <Icon
                  className={clsx(
                    "h-4 w-4",
                    isActive ? "text-text-primary" : "text-text-tertiary"
                  )}
                />
              )}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  className={clsx(
                    "inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-accent-50 text-accent-700"
                      : "bg-bg-tertiary text-text-secondary"
                  )}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <span
                  className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-accent-600 transition-all duration-200"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

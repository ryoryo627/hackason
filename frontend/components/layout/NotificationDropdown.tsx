"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { type Alert } from "@/lib/api";
import { SeverityBadge } from "@/components/ui/Badge";
import { useAlerts } from "@/hooks/useApi";

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onCountChange: (count: number) => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  return `${days}日前`;
}

export function NotificationDropdown({
  isOpen,
  onClose,
  anchorRef,
  onCountChange,
}: NotificationDropdownProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // SWR with auto-refresh every 60s (pauses when tab is hidden)
  const { data, isLoading: loading } = useAlerts({ acknowledged: false, limit: 5 });
  const alerts = data?.alerts ?? [];

  // Update badge count when data changes
  useEffect(() => {
    if (data?.total !== undefined) {
      onCountChange(data.total);
    }
  }, [data?.total, onCountChange]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen, onClose, anchorRef]);

  const handleAlertClick = (alert: Alert) => {
    onClose();
    if (alert.patient_id) {
      router.push(`/patients/${alert.patient_id}`);
    } else {
      router.push("/alerts");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-border shadow-dropdown z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text-primary">通知</h3>
      </div>

      {/* Alert List */}
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-border-strong border-t-text-secondary rounded-full animate-spin" />
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-text-secondary text-center py-8">
            未確認のアラートはありません
          </p>
        ) : (
          <ul>
            {alerts.map((alert) => (
              <li key={alert.id}>
                <button
                  onClick={() => handleAlertClick(alert)}
                  className="w-full px-4 py-3 text-left hover:bg-bg-secondary transition-colors border-b border-border-light last:border-b-0"
                >
                  <div className="flex items-start gap-2">
                    <SeverityBadge
                      severity={
                        (alert.severity?.toUpperCase() as "HIGH" | "MEDIUM" | "LOW") ||
                        "LOW"
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {alert.patient_name || "不明な患者"}
                      </p>
                      <p className="text-xs text-text-secondary truncate">{alert.title}</p>
                      <p className="text-xs text-text-tertiary mt-0.5">
                        {alert.created_at ? timeAgo(alert.created_at) : ""}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border">
        <button
          onClick={() => {
            onClose();
            router.push("/alerts");
          }}
          className="w-full px-4 py-2.5 text-sm text-accent-600 hover:bg-accent-50 transition-colors text-center font-medium"
        >
          すべてのアラートを見る →
        </button>
      </div>
    </div>
  );
}

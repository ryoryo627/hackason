"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Search, User, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "./SidebarContext";
import { SearchModal } from "./SearchModal";
import { NotificationDropdown } from "./NotificationDropdown";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth();
  const { openMobile } = useSidebar();
  const [showSearch, setShowSearch] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleAlertCountChange = useCallback((count: number) => {
    setAlertCount(count);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-border">
        <div className="flex h-14 items-center justify-between px-4 md:px-6">
          {/* Left: mobile menu + title */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              onClick={openMobile}
              className="md:hidden p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
              aria-label="メニューを開く"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Search */}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                ref={bellRef}
                onClick={() => setShowNotifications((prev) => !prev)}
                className="relative p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-md transition-colors"
              >
                <Bell className="w-4 h-4" />
                {alertCount > 0 && (
                  <span
                    className={`absolute top-0.5 right-0.5 flex items-center justify-center rounded-full bg-danger text-white text-[10px] font-bold leading-none ${
                      alertCount >= 10 ? "w-5 h-5" : "w-4 h-4"
                    }`}
                  >
                    {alertCount > 99 ? "99+" : alertCount}
                  </span>
                )}
              </button>
              <NotificationDropdown
                isOpen={showNotifications}
                onClose={() => setShowNotifications(false)}
                anchorRef={bellRef}
                onCountChange={handleAlertCountChange}
              />
            </div>

            {/* User */}
            <div className="flex items-center gap-3 pl-3 md:pl-4 border-l border-border">
              <div className="w-8 h-8 bg-bg-tertiary rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-text-secondary" />
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-text-primary">
                  {user?.email?.split("@")[0] || "ユーザー"}
                </p>
                <p className="text-xs text-text-secondary">管理者</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Search Modal */}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </>
  );
}

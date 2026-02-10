"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Building2,
  Cable,
  Database,
  Bot,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSidebar } from "./SidebarContext";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    name: "メイン",
    items: [
      { name: "ダッシュボード", href: "/", icon: LayoutDashboard },
      { name: "患者一覧", href: "/patients", icon: Users },
      { name: "アラート", href: "/alerts", icon: AlertTriangle },
    ],
  },
  {
    name: "設定",
    items: [
      { name: "サービス接続", href: "/settings/api", icon: Cable },
      { name: "AI設定・ナレッジ", href: "/settings/agents", icon: Bot },
      { name: "マスタ管理", href: "/settings/master", icon: Database },
      { name: "組織設定", href: "/settings/organization", icon: Building2 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const { collapsed, mobileOpen, toggle, closeMobile } = useSidebar();

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border-light">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-7 h-7 bg-accent-600 rounded-md flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-xs">HC</span>
          </div>
          <span className={clsx(
            "text-text-primary font-semibold whitespace-nowrap transition-opacity duration-200",
            collapsed ? "opacity-0 w-0" : "opacity-100"
          )}>
            HomeCare AI
          </span>
        </div>
        {/* Desktop collapse toggle */}
        <button
          onClick={toggle}
          className="hidden md:flex p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-sidebar-hover transition-colors"
          aria-label={collapsed ? "サイドバーを展開" : "サイドバーを折りたたむ"}
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
        {/* Mobile close button */}
        <button
          onClick={closeMobile}
          className="md:hidden p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-sidebar-hover transition-colors"
          aria-label="メニューを閉じる"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navigation.map((group) => (
          <div key={group.name} className="mb-6">
            {!collapsed && (
              <p className="px-3 mb-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                {group.name}
              </p>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                const Icon = item.icon;

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={closeMobile}
                      title={collapsed ? item.name : undefined}
                      className={clsx(
                        "flex items-center gap-3 rounded-md text-sm transition-colors",
                        collapsed ? "justify-center px-2 py-2" : "px-3 py-1.5",
                        isActive
                          ? "bg-sidebar-active text-text-primary font-medium"
                          : "text-text-secondary hover:bg-sidebar-hover hover:text-text-primary"
                      )}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.name}</span>
                          {item.badge !== undefined && item.badge > 0 && (
                            <span className="ml-auto bg-danger text-white text-xs font-bold px-2 py-0.5 rounded-full">
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User / Logout */}
      <div className="p-3 border-t border-border-light">
        <button
          onClick={handleSignOut}
          title={collapsed ? "ログアウト" : undefined}
          className={clsx(
            "flex items-center gap-3 w-full text-sm text-text-secondary hover:text-text-primary hover:bg-sidebar-hover rounded-md transition-colors",
            collapsed ? "justify-center px-2 py-2" : "px-3 py-1.5"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && "ログアウト"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "fixed left-0 top-0 z-40 h-screen bg-sidebar-bg border-r border-border transition-all duration-300 hidden md:block",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeMobile} />
          <aside className="relative w-56 h-full bg-sidebar-bg border-r border-border animate-slide-in-left">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

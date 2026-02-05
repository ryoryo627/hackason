"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  BookOpen,
  Building2,
  Key,
  Database,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
      { name: "ナレッジベース", href: "/knowledge", icon: BookOpen },
    ],
  },
  {
    name: "設定",
    items: [
      { name: "API設定", href: "/settings/api", icon: Key },
      { name: "マスタ管理", href: "/settings/master", icon: Database },
      { name: "組織設定", href: "/settings/organization", icon: Building2 },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleSignOut = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-gray-900">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center px-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">HC</span>
            </div>
            <span className="text-white font-semibold">HomeCare AI</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {navigation.map((group) => (
            <div key={group.name} className="mb-6">
              <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {group.name}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive =
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  const Icon = item.icon;

                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={clsx(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isActive
                            ? "bg-gray-800 text-white"
                            : "text-gray-400 hover:bg-gray-800 hover:text-white"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        {item.name}
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {item.badge}
                          </span>
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
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
            ログアウト
          </button>
        </div>
      </div>
    </aside>
  );
}

"use client";

import { Bell, Search, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Page Title */}
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

        {/* Right Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications */}
          <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          {/* User */}
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-600" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.email?.split("@")[0] || "ユーザー"}
              </p>
              <p className="text-xs text-gray-500">管理者</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

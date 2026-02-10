"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { ToastProvider } from "@/components/ui";
import { useAuth } from "@/hooks/useAuth";
import clsx from "clsx";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

function AdminLayoutInner({ children, title }: AdminLayoutProps) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { collapsed } = useSidebar();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, loading, router]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Don't render content if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Sidebar />
      <div className={clsx(
        "transition-all duration-300",
        collapsed ? "md:pl-14" : "md:pl-56"
      )}>
        <Header title={title} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  return (
    <SidebarProvider>
      <ToastProvider>
        <AdminLayoutInner title={title}>{children}</AdminLayoutInner>
      </ToastProvider>
    </SidebarProvider>
  );
}

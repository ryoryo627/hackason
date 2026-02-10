"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Alert as AlertUI } from "@/components/ui";
import {
  setupApi,
  setUserData,
  setOrgId,
  UserData,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardStats } from "@/hooks/useApi";
import {
  PriorityAlertBanner,
  EnhancedStatCards,
  NightEventsSummary,
  AlertActivityTabs,
  PatientRiskPanel,
  CompactConnectionStatus,
} from "./dashboard-sections";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [checkingSetup, setCheckingSetup] = useState(true);

  // SWR hooks - fetch only when orgId is set (after setup check)
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();

  // Check if user has organization, redirect to setup if not
  useEffect(() => {
    async function checkUserOrganization() {
      // Wait for auth to complete
      if (authLoading) return;

      // If not logged in, redirect to login
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        // Get or create user document from Firestore
        const userData: UserData = await setupApi.getOrCreateUser({
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || undefined,
        });

        // Cache user data for use throughout the app
        setUserData(userData);

        // Check if user has an organization
        if (!userData.organizationId) {
          // No organization - redirect to setup
          console.log("User has no organization, redirecting to setup...");
          router.push("/setup");
          return;
        }

        // Save org ID for API calls
        setOrgId(userData.organizationId);

        // Organization exists, continue to dashboard
        setCheckingSetup(false);
      } catch (err) {
        console.error("Error checking user organization:", err);
        // On error, redirect to setup as a fallback
        router.push("/setup");
      }
    }

    checkUserOrganization();
  }, [user, authLoading, router]);

  // Show loading while checking setup or auth
  if (authLoading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-secondary">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-accent-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-secondary">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout title="ダッシュボード">
      {statsError && (
        <AlertUI variant="error" className="mb-6">
          {statsError.message || "データの取得に失敗しました"}
        </AlertUI>
      )}

      {/* Priority Alert Banner - only shows when HIGH severity alerts exist */}
      <PriorityAlertBanner />

      {/* Enhanced Stats Grid */}
      <EnhancedStatCards stats={stats} loading={statsLoading} />

      {/* Night Events Summary - morning shift overview */}
      <NightEventsSummary />

      {/* Main Content: Alert/Activity Tabs + Patient Risk Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3">
          <AlertActivityTabs />
        </div>
        <div className="lg:col-span-2">
          <PatientRiskPanel />
        </div>
      </div>

      {/* Compact Connection Status */}
      <CompactConnectionStatus />
    </AdminLayout>
  );
}

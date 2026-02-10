"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Tabs } from "@/components/ui";
import { MessageSquareText, BookOpen, Loader2 } from "lucide-react";
import { InstructionsTab } from "./InstructionsTab";
import { KnowledgeTab } from "./KnowledgeTab";

const TABS = [
  { id: "instructions", label: "AIへの指示", icon: MessageSquareText },
  { id: "knowledge", label: "参考資料", icon: BookOpen },
];

function AgentSettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = searchParams.get("tab") || "instructions";

  const handleTabChange = (tabId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "instructions") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    const qs = params.toString();
    router.replace(`/settings/agents${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  return (
    <AdminLayout title="AI設定・ナレッジ">
      <p className="text-text-secondary mb-6">
        AIの動作方針と参考資料をまとめて管理できます。変更はコードデプロイなしで即時反映されます。
      </p>

      <Tabs tabs={TABS} activeTab={activeTab} onChange={handleTabChange} className="mb-6" />

      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === "instructions" && <InstructionsTab />}
        {activeTab === "knowledge" && <KnowledgeTab />}
      </div>
    </AdminLayout>
  );
}

export default function AgentSettingsPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout title="AI設定・ナレッジ">
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
          </div>
        </AdminLayout>
      }
    >
      <AgentSettingsContent />
    </Suspense>
  );
}

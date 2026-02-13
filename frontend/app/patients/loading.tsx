import { SkeletonTable } from "@/components/ui";
import { AdminLayout } from "@/components/layout";

export default function PatientsLoading() {
  return (
    <AdminLayout title="患者一覧">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-10 w-64 bg-bg-hover rounded-lg animate-skeleton" />
          <div className="h-10 w-32 bg-bg-hover rounded-lg animate-skeleton" />
        </div>
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <SkeletonTable rows={8} cols={6} />
        </div>
      </div>
    </AdminLayout>
  );
}

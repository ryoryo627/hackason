import { SkeletonCard } from "@/components/ui";
import { AdminLayout } from "@/components/layout";

export default function PatientDetailLoading() {
  return (
    <AdminLayout title="患者詳細">
      <div className="space-y-6">
        <SkeletonCard />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonCard />
      </div>
    </AdminLayout>
  );
}

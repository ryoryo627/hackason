"use client";

import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input } from "@/components/ui";
import { Plus, Trash2, Building2, MapPin } from "lucide-react";

// Demo data
const facilities = [
  { id: "1", name: "本院", address: "東京都渋谷区代々木1-1-1" },
  { id: "2", name: "城南サテライト", address: "東京都品川区大崎2-2-2" },
  { id: "3", name: "城北サテライト", address: "東京都北区王子3-3-3" },
];

const areas = [
  { id: "1", name: "渋谷区" },
  { id: "2", name: "品川区" },
  { id: "3", name: "北区" },
  { id: "4", name: "世田谷区" },
  { id: "5", name: "新宿区" },
];

export default function MasterSettingsPage() {
  return (
    <AdminLayout title="マスタ管理">
      <p className="text-gray-600 mb-6">
        事業所・地区などのマスタデータを管理します。
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facilities */}
        <Card>
          <CardHeader
            title="事業所"
            description="在宅医療を提供する事業所"
            action={
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Button>
            }
          />
          <div className="space-y-3">
            {facilities.map((facility) => (
              <div
                key={facility.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900">{facility.name}</p>
                    <p className="text-sm text-gray-500">{facility.address}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        {/* Areas */}
        <Card>
          <CardHeader
            title="地区"
            description="担当地区の区分"
            action={
              <Button size="sm">
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Button>
            }
          />
          <div className="space-y-3">
            {areas.map((area) => (
              <div
                key={area.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <p className="font-medium text-gray-900">{area.name}</p>
                </div>
                <Button variant="ghost" size="sm">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}

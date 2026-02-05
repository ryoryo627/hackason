"use client";

import Link from "next/link";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, RiskBadge, Badge } from "@/components/ui";
import { Search, Plus, Filter } from "lucide-react";

// Demo patient data
const demoPatients = [
  {
    id: "1",
    name: "田中太郎",
    age: 85,
    sex: "M" as const,
    facility: "本院",
    area: "渋谷区",
    risk_level: "HIGH" as const,
    tags: ["要注意", "独居"],
    updated_at: "2026-02-05T10:30:00",
  },
  {
    id: "2",
    name: "山田花子",
    age: 78,
    sex: "F" as const,
    facility: "城南サテライト",
    area: "品川区",
    risk_level: "MEDIUM" as const,
    tags: [],
    updated_at: "2026-02-04T14:20:00",
  },
  {
    id: "3",
    name: "佐藤一郎",
    age: 92,
    sex: "M" as const,
    facility: "本院",
    area: "新宿区",
    risk_level: "HIGH" as const,
    tags: ["看取り期"],
    updated_at: "2026-02-04T09:15:00",
  },
  {
    id: "4",
    name: "鈴木美智子",
    age: 81,
    sex: "F" as const,
    facility: "城北サテライト",
    area: "北区",
    risk_level: "LOW" as const,
    tags: [],
    updated_at: "2026-02-03T16:45:00",
  },
  {
    id: "5",
    name: "高橋健二",
    age: 76,
    sex: "M" as const,
    facility: "本院",
    area: "世田谷区",
    risk_level: "MEDIUM" as const,
    tags: ["難病"],
    updated_at: "2026-02-03T11:00:00",
  },
];

export default function PatientsPage() {
  return (
    <AdminLayout title="患者一覧">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="患者名、条件で検索..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="secondary">
            <Filter className="w-4 h-4 mr-2" />
            フィルタ
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            患者登録
          </Button>
        </div>
      </div>

      {/* Patient List */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">患者名</th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">年齢/性別</th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">事業所</th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">地区</th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">リスク</th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">タグ</th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">最終更新</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {demoPatients.map((patient) => (
                <tr key={patient.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4">
                    <Link
                      href={`/patients/${patient.id}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {patient.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {patient.age}歳 / {patient.sex === "M" ? "男" : "女"}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{patient.facility}</td>
                  <td className="py-3 px-4 text-gray-600">{patient.area}</td>
                  <td className="py-3 px-4">
                    <RiskBadge level={patient.risk_level} />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {patient.tags.map((tag) => (
                        <Badge key={tag} variant="default" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {new Date(patient.updated_at).toLocaleDateString("ja-JP")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminLayout>
  );
}

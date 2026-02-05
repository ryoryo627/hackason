"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, RiskBadge, Badge } from "@/components/ui";
import { Search, Plus, Filter, Loader2, X, ChevronDown } from "lucide-react";
import { patientsApi, Patient } from "@/lib/api";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

interface FilterState {
  risk_level: "high" | "medium" | "low" | "";
  facility: string;
  area: string;
  status: string;
}

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    risk_level: "",
    facility: "",
    area: "",
    status: "",
  });

  // Fetch patients
  useEffect(() => {
    async function fetchPatients() {
      try {
        setLoading(true);
        setError(null);
        const data = await patientsApi.list({
          ...(filters.risk_level && { risk_level: filters.risk_level }),
          ...(filters.facility && { facility: filters.facility }),
          ...(filters.area && { area: filters.area }),
          ...(filters.status && { status: filters.status }),
        });
        setPatients(data.patients);
      } catch (err) {
        console.error("Patients fetch error:", err);
        setError(err instanceof Error ? err.message : "患者データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchPatients();
  }, [filters]);

  // Filter and search patients locally
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;

    const query = searchQuery.toLowerCase();
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.name_kana?.toLowerCase().includes(query) ||
        p.primary_diagnosis?.toLowerCase().includes(query) ||
        p.address?.toLowerCase().includes(query)
    );
  }, [patients, searchQuery]);

  // Extract unique facilities and areas for filter options
  const facilities = useMemo(
    () => [...new Set(patients.map((p) => p.facility).filter(Boolean))],
    [patients]
  );
  const areas = useMemo(
    () => [...new Set(patients.map((p) => p.area).filter(Boolean))],
    [patients]
  );

  const hasActiveFilters =
    filters.risk_level || filters.facility || filters.area || filters.status;

  const clearFilters = () => {
    setFilters({ risk_level: "", facility: "", area: "", status: "" });
  };

  const getRiskLevel = (level: string): RiskLevel => {
    const normalizedLevel = level.toUpperCase();
    if (normalizedLevel === "HIGH") return "HIGH";
    if (normalizedLevel === "MEDIUM") return "MEDIUM";
    return "LOW";
  };

  return (
    <AdminLayout title="患者一覧">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            placeholder="患者名、診断名、住所で検索..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={showFilters || hasActiveFilters ? "primary" : "secondary"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            フィルタ
            {hasActiveFilters && (
              <span className="ml-1 bg-white text-blue-600 rounded-full px-1.5 text-xs">
                !
              </span>
            )}
          </Button>
          <Button onClick={() => router.push("/patients/new")}>
            <Plus className="w-4 h-4 mr-2" />
            患者登録
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">フィルタ条件</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                クリア
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Risk Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                リスクレベル
              </label>
              <div className="relative">
                <select
                  value={filters.risk_level}
                  onChange={(e) =>
                    setFilters({ ...filters, risk_level: e.target.value as "high" | "medium" | "low" | "" })
                  }
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">すべて</option>
                  <option value="high">高リスク</option>
                  <option value="medium">中リスク</option>
                  <option value="low">低リスク</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Facility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                事業所
              </label>
              <div className="relative">
                <select
                  value={filters.facility}
                  onChange={(e) => setFilters({ ...filters, facility: e.target.value })}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">すべて</option>
                  {facilities.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Area */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                地区
              </label>
              <div className="relative">
                <select
                  value={filters.area}
                  onChange={(e) => setFilters({ ...filters, area: e.target.value })}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">すべて</option>
                  {areas.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ステータス
              </label>
              <div className="relative">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">すべて</option>
                  <option value="active">アクティブ</option>
                  <option value="inactive">非アクティブ</option>
                  <option value="discharged">退院</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Patient List */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">
                  患者名
                </th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">
                  年齢/性別
                </th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">
                  事業所
                </th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">
                  地区
                </th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">
                  リスク
                </th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">
                  主病名
                </th>
                <th className="text-left text-sm font-medium text-gray-500 py-3 px-4">
                  最終更新
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    {searchQuery ? "検索条件に一致する患者がいません" : "患者が登録されていません"}
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/patients/${patient.id}`)}
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium text-blue-600 hover:text-blue-800"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {patient.name}
                      </Link>
                      {patient.name_kana && (
                        <p className="text-xs text-gray-400">{patient.name_kana}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {patient.age ? `${patient.age}歳` : "-"} /{" "}
                      {patient.gender === "male"
                        ? "男"
                        : patient.gender === "female"
                        ? "女"
                        : "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-600">{patient.facility || "-"}</td>
                    <td className="py-3 px-4 text-gray-600">{patient.area || "-"}</td>
                    <td className="py-3 px-4">
                      <RiskBadge level={getRiskLevel(patient.risk_level)} />
                    </td>
                    <td className="py-3 px-4">
                      {patient.primary_diagnosis ? (
                        <Badge variant="default" size="sm">
                          {patient.primary_diagnosis}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {patient.updated_at
                        ? new Date(patient.updated_at).toLocaleDateString("ja-JP")
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Result count */}
        {!loading && (
          <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm text-gray-500">
            {filteredPatients.length} 件の患者
            {searchQuery && ` (「${searchQuery}」で検索)`}
          </div>
        )}
      </Card>
    </AdminLayout>
  );
}

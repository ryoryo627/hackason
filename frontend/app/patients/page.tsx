"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, RiskBadge, Badge, Alert, Select, SkeletonTable, EmptyState } from "@/components/ui";
import { Search, Plus, Filter, Loader2, X, ChevronDown, ChevronUp, Upload, Users, ArrowUpDown } from "lucide-react";
import { Patient } from "@/lib/api";
import { usePatients } from "@/hooks/useApi";
import { getRiskLevel } from "@/lib/utils";
import { BulkAssignMembersModal } from "./BulkAssignMembersModal";

type RiskLevel = "HIGH" | "MEDIUM" | "LOW";

type SortKey = "name" | "age" | "facility" | "area" | "risk_level" | "primary_diagnosis" | "updated_at";
type SortOrder = "asc" | "desc";

const RISK_ORDER: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

interface FilterState {
  risk_level: "high" | "medium" | "low" | "";
  facility: string;
  area: string;
  status: string;
}

export default function PatientsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    risk_level: "",
    facility: "",
    area: "",
    status: "",
  });

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  // SWR data fetching with filters
  const { data: patientsData, isLoading: loading, error: swrError, mutate } = usePatients({
    ...(filters.risk_level && { risk_level: filters.risk_level }),
    ...(filters.facility && { facility: filters.facility }),
    ...(filters.area && { area: filters.area }),
    ...(filters.status && { status: filters.status }),
  });
  const patients = patientsData?.patients ?? [];
  const error = swrError?.message ?? null;

  // Filter, search, and sort patients locally
  const filteredPatients = useMemo(() => {
    let result = patients;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.name_kana?.toLowerCase().includes(query) ||
          p.primary_diagnosis?.toLowerCase().includes(query) ||
          p.address?.toLowerCase().includes(query)
      );
    }

    if (sortKey) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        switch (sortKey) {
          case "name":
            cmp = (a.name_kana || a.name).localeCompare(b.name_kana || b.name, "ja");
            break;
          case "age":
            cmp = (a.age ?? 0) - (b.age ?? 0);
            break;
          case "facility":
            cmp = (a.facility || "").localeCompare(b.facility || "", "ja");
            break;
          case "area":
            cmp = (a.area || "").localeCompare(b.area || "", "ja");
            break;
          case "risk_level":
            cmp = (RISK_ORDER[a.risk_level?.toUpperCase()] ?? 0) - (RISK_ORDER[b.risk_level?.toUpperCase()] ?? 0);
            break;
          case "primary_diagnosis":
            cmp = (a.primary_diagnosis || "").localeCompare(b.primary_diagnosis || "", "ja");
            break;
          case "updated_at":
            cmp = new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime();
            break;
        }
        return sortOrder === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [patients, searchQuery, sortKey, sortOrder]);

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


  // Selection handlers
  const allFilteredSelected =
    filteredPatients.length > 0 &&
    filteredPatients.every((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectedPatients = useMemo(
    () => patients.filter((p) => selectedIds.has(p.id)),
    [patients, selectedIds]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        // 3rd click: reset sort
        setSortKey(null);
        setSortOrder("asc");
      }
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-text-placeholder" />;
    }
    return sortOrder === "asc" ? (
      <ChevronUp className="w-3.5 h-3.5 text-accent-600" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5 text-accent-600" />
    );
  };

  const handleBulkAssignComplete = () => {
    setSelectedIds(new Set());
    mutate();
  };

  const colSpan = 8; // 7 data columns + 1 checkbox column

  return (
    <AdminLayout title="患者一覧">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
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
              <span className="ml-1 bg-white text-accent-600 rounded-full px-1.5 text-xs">
                !
              </span>
            )}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/patients/import")}>
            <Upload className="w-4 h-4 mr-2" />
            CSVインポート
          </Button>
          <Button onClick={() => router.push("/patients/new")}>
            <Plus className="w-4 h-4 mr-2" />
            患者登録
          </Button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-accent-50 border border-accent-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-accent-700">
            {selectedIds.size}件選択中
          </span>
          <Button
            size="sm"
            onClick={() => setBulkAssignOpen(true)}
          >
            <Users className="w-4 h-4 mr-1" />
            メンバー一括割当
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
          >
            選択解除
          </Button>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <Card className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-text-primary">フィルタ条件</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4 mr-1" />
                クリア
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Select
              label="リスクレベル"
              value={filters.risk_level}
              onChange={(val) => setFilters({ ...filters, risk_level: val as "high" | "medium" | "low" | "" })}
              options={[
                { value: "", label: "すべて" },
                { value: "high", label: "高リスク" },
                { value: "medium", label: "中リスク" },
                { value: "low", label: "低リスク" },
              ]}
            />
            <Select
              label="事業所"
              value={filters.facility}
              onChange={(val) => setFilters({ ...filters, facility: val })}
              options={[
                { value: "", label: "すべて" },
                ...facilities.map((f) => ({ value: f as string, label: f as string })),
              ]}
            />
            <Select
              label="地区"
              value={filters.area}
              onChange={(val) => setFilters({ ...filters, area: val })}
              options={[
                { value: "", label: "すべて" },
                ...areas.map((a) => ({ value: a as string, label: a as string })),
              ]}
            />
            <Select
              label="ステータス"
              value={filters.status}
              onChange={(val) => setFilters({ ...filters, status: val })}
              options={[
                { value: "", label: "すべて" },
                { value: "active", label: "アクティブ" },
                { value: "inactive", label: "非アクティブ" },
                { value: "discharged", label: "退院" },
              ]}
            />
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="error" className="mb-6">{error}</Alert>
      )}

      {/* Patient List */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-bg-secondary border-b border-border sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected && filteredPatients.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border-strong text-accent-600 focus:ring-accent-500"
                  />
                </th>
                <th
                  className="text-left text-sm font-medium text-text-secondary py-3 px-4 cursor-pointer hover:text-text-primary select-none"
                  onClick={() => handleSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    患者名 <SortIcon column="name" />
                  </span>
                </th>
                <th
                  className="text-left text-sm font-medium text-text-secondary py-3 px-4 cursor-pointer hover:text-text-primary select-none"
                  onClick={() => handleSort("age")}
                >
                  <span className="inline-flex items-center gap-1">
                    年齢/性別 <SortIcon column="age" />
                  </span>
                </th>
                <th
                  className="text-left text-sm font-medium text-text-secondary py-3 px-4 cursor-pointer hover:text-text-primary select-none"
                  onClick={() => handleSort("facility")}
                >
                  <span className="inline-flex items-center gap-1">
                    事業所 <SortIcon column="facility" />
                  </span>
                </th>
                <th
                  className="text-left text-sm font-medium text-text-secondary py-3 px-4 cursor-pointer hover:text-text-primary select-none"
                  onClick={() => handleSort("area")}
                >
                  <span className="inline-flex items-center gap-1">
                    地区 <SortIcon column="area" />
                  </span>
                </th>
                <th
                  className="text-left text-sm font-medium text-text-secondary py-3 px-4 cursor-pointer hover:text-text-primary select-none"
                  onClick={() => handleSort("risk_level")}
                >
                  <span className="inline-flex items-center gap-1">
                    リスク <SortIcon column="risk_level" />
                  </span>
                </th>
                <th
                  className="text-left text-sm font-medium text-text-secondary py-3 px-4 cursor-pointer hover:text-text-primary select-none"
                  onClick={() => handleSort("primary_diagnosis")}
                >
                  <span className="inline-flex items-center gap-1">
                    主病名 <SortIcon column="primary_diagnosis" />
                  </span>
                </th>
                <th
                  className="text-left text-sm font-medium text-text-secondary py-3 px-4 cursor-pointer hover:text-text-primary select-none"
                  onClick={() => handleSort("updated_at")}
                >
                  <span className="inline-flex items-center gap-1">
                    最終更新 <SortIcon column="updated_at" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center">
                    <SkeletonTable rows={5} cols={colSpan} />
                  </td>
                </tr>
              ) : filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center">
                    <EmptyState
                      title={searchQuery ? "検索結果なし" : "患者未登録"}
                      description={searchQuery ? "検索条件に一致する患者がいません" : "患者が登録されていません"}
                      action={searchQuery ? undefined : { label: "患者を登録", onClick: () => router.push("/patients/new") }}
                    />
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    className={`hover:bg-bg-secondary transition-colors duration-120 cursor-pointer ${
                      selectedIds.has(patient.id) ? "bg-accent-50" : ""
                    }`}
                    onClick={() => router.push(`/patients/${patient.id}`)}
                  >
                    <td className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(patient.id)}
                        onChange={() => toggleSelect(patient.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-border-strong text-accent-600 focus:ring-accent-500"
                      />
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-medium text-accent-600 hover:text-accent-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {patient.name}
                      </Link>
                      {patient.name_kana && (
                        <p className="text-xs text-text-tertiary">{patient.name_kana}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">
                      {patient.age ? `${patient.age}歳` : "-"} /{" "}
                      {patient.gender === "male"
                        ? "男"
                        : patient.gender === "female"
                        ? "女"
                        : "-"}
                    </td>
                    <td className="py-3 px-4 text-text-secondary">{patient.facility || "-"}</td>
                    <td className="py-3 px-4 text-text-secondary">{patient.area || "-"}</td>
                    <td className="py-3 px-4">
                      <RiskBadge level={getRiskLevel(patient.risk_level)} source={patient.risk_level_source} />
                    </td>
                    <td className="py-3 px-4">
                      {patient.primary_diagnosis ? (
                        <Badge variant="default" size="sm">
                          {patient.primary_diagnosis}
                        </Badge>
                      ) : (
                        <span className="text-text-tertiary">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-text-secondary">
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
          <div className="px-4 py-3 border-t border-border bg-bg-secondary text-sm text-text-secondary">
            {filteredPatients.length} 件の患者
            {searchQuery && ` (「${searchQuery}」で検索)`}
          </div>
        )}
      </Card>

      {/* Bulk Assign Modal */}
      <BulkAssignMembersModal
        isOpen={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        selectedPatients={selectedPatients}
        onComplete={handleBulkAssignComplete}
      />
    </AdminLayout>
  );
}

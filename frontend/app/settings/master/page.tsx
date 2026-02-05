"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input } from "@/components/ui";
import { Plus, Trash2, Building2, MapPin, Loader2, X } from "lucide-react";
import { settingsApi, Facility, Area } from "@/lib/api";

export default function MasterSettingsPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add facility modal
  const [showAddFacility, setShowAddFacility] = useState(false);
  const [newFacility, setNewFacility] = useState({ name: "", address: "" });
  const [addingFacility, setAddingFacility] = useState(false);

  // Add area modal
  const [showAddArea, setShowAddArea] = useState(false);
  const [newArea, setNewArea] = useState({ name: "" });
  const [addingArea, setAddingArea] = useState(false);

  // Deleting state
  const [deletingFacility, setDeletingFacility] = useState<string | null>(null);
  const [deletingArea, setDeletingArea] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [facilitiesData, areasData] = await Promise.all([
          settingsApi.listFacilities(),
          settingsApi.listAreas(),
        ]);

        setFacilities(facilitiesData.facilities);
        setAreas(areasData.areas);
      } catch (err) {
        console.error("Master data fetch error:", err);
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Add facility
  const handleAddFacility = async () => {
    if (!newFacility.name) return;

    try {
      setAddingFacility(true);
      setError(null);

      await settingsApi.createFacility({ name: newFacility.name, address: newFacility.address });

      // Refresh list
      const data = await settingsApi.listFacilities();
      setFacilities(data.facilities);

      setShowAddFacility(false);
      setNewFacility({ name: "", address: "" });
    } catch (err) {
      console.error("Add facility error:", err);
      setError(err instanceof Error ? err.message : "事業所の追加に失敗しました");
    } finally {
      setAddingFacility(false);
    }
  };

  // Delete facility
  const handleDeleteFacility = async (facilityId: string) => {
    if (!confirm("この事業所を削除しますか？")) return;

    try {
      setDeletingFacility(facilityId);
      setError(null);

      await settingsApi.deleteFacility(facilityId);
      setFacilities((prev) => prev.filter((f) => f.id !== facilityId));
    } catch (err) {
      console.error("Delete facility error:", err);
      setError(err instanceof Error ? err.message : "事業所の削除に失敗しました");
    } finally {
      setDeletingFacility(null);
    }
  };

  // Add area
  const handleAddArea = async () => {
    if (!newArea.name) return;

    try {
      setAddingArea(true);
      setError(null);

      await settingsApi.createArea({ name: newArea.name });

      // Refresh list
      const data = await settingsApi.listAreas();
      setAreas(data.areas);

      setShowAddArea(false);
      setNewArea({ name: "" });
    } catch (err) {
      console.error("Add area error:", err);
      setError(err instanceof Error ? err.message : "地区の追加に失敗しました");
    } finally {
      setAddingArea(false);
    }
  };

  // Delete area
  const handleDeleteArea = async (areaId: string) => {
    if (!confirm("この地区を削除しますか？")) return;

    try {
      setDeletingArea(areaId);
      setError(null);

      await settingsApi.deleteArea(areaId);
      setAreas((prev) => prev.filter((a) => a.id !== areaId));
    } catch (err) {
      console.error("Delete area error:", err);
      setError(err instanceof Error ? err.message : "地区の削除に失敗しました");
    } finally {
      setDeletingArea(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="マスタ管理">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="マスタ管理">
      <p className="text-gray-600 mb-6">
        事業所・地区などのマスタデータを管理します。
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4 inline" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Facilities */}
        <Card>
          <CardHeader
            title="事業所"
            description="在宅医療を提供する事業所"
            action={
              <Button size="sm" onClick={() => setShowAddFacility(true)}>
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Button>
            }
          />
          {facilities.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              事業所が登録されていません
            </p>
          ) : (
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
                      {facility.address && (
                        <p className="text-sm text-gray-500">{facility.address}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFacility(facility.id)}
                    disabled={deletingFacility === facility.id}
                  >
                    {deletingFacility === facility.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-500" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Areas */}
        <Card>
          <CardHeader
            title="地区"
            description="担当地区の区分"
            action={
              <Button size="sm" onClick={() => setShowAddArea(true)}>
                <Plus className="w-4 h-4 mr-1" />
                追加
              </Button>
            }
          />
          {areas.length === 0 ? (
            <p className="text-gray-500 text-center py-4">
              地区が登録されていません
            </p>
          ) : (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteArea(area.id)}
                    disabled={deletingArea === area.id}
                  >
                    {deletingArea === area.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 text-red-500" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Add Facility Modal */}
      {showAddFacility && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">事業所を追加</h2>
              <button
                onClick={() => setShowAddFacility(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                label="事業所名 *"
                value={newFacility.name}
                onChange={(e) =>
                  setNewFacility({ ...newFacility, name: e.target.value })
                }
                placeholder="例：本院"
              />
              <Input
                label="住所"
                value={newFacility.address}
                onChange={(e) =>
                  setNewFacility({ ...newFacility, address: e.target.value })
                }
                placeholder="例：東京都渋谷区代々木1-1-1"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="secondary"
                onClick={() => setShowAddFacility(false)}
              >
                キャンセル
              </Button>
              <Button
                onClick={handleAddFacility}
                disabled={addingFacility || !newFacility.name}
              >
                {addingFacility ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                追加
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Add Area Modal */}
      {showAddArea && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">地区を追加</h2>
              <button
                onClick={() => setShowAddArea(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <Input
                label="地区名 *"
                value={newArea.name}
                onChange={(e) => setNewArea({ name: e.target.value })}
                placeholder="例：渋谷区"
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowAddArea(false)}>
                キャンセル
              </Button>
              <Button
                onClick={handleAddArea}
                disabled={addingArea || !newArea.name}
              >
                {addingArea ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                追加
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}

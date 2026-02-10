"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input, Modal, Select, Badge } from "@/components/ui";
import { Plus, Trash2, Shield, User, Loader2, X } from "lucide-react";
import { usersApi, getUserData, OrgMember } from "@/lib/api";

const roleOptions = [
  { value: "admin", label: "管理者" },
  { value: "user", label: "一般" },
];

export default function UsersSettingsPage() {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add user modal
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    displayName: "",
    role: "user",
  });
  const [addingUser, setAddingUser] = useState(false);

  // Deleting / updating state
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [updatingRoleUid, setUpdatingRoleUid] = useState<string | null>(null);

  const currentUser = getUserData();
  const isAdmin = currentUser?.role === "admin";

  // Fetch members
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const data = await usersApi.list();
        setMembers(data.users);
      } catch (err) {
        console.error("Users fetch error:", err);
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    if (isAdmin) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  // Add user
  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password) return;

    try {
      setAddingUser(true);
      setError(null);

      await usersApi.create({
        email: newUser.email,
        password: newUser.password,
        displayName: newUser.displayName,
        role: newUser.role,
      });

      // Refresh list
      const data = await usersApi.list();
      setMembers(data.users);

      setShowAddUser(false);
      setNewUser({ email: "", password: "", displayName: "", role: "user" });
    } catch (err) {
      console.error("Add user error:", err);
      setError(err instanceof Error ? err.message : "ユーザーの追加に失敗しました");
    } finally {
      setAddingUser(false);
    }
  };

  // Update role
  const handleRoleChange = async (uid: string, newRole: string) => {
    try {
      setUpdatingRoleUid(uid);
      setError(null);

      await usersApi.updateRole(uid, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.uid === uid ? { ...m, role: newRole } : m))
      );
    } catch (err) {
      console.error("Update role error:", err);
      setError(err instanceof Error ? err.message : "ロールの変更に失敗しました");
    } finally {
      setUpdatingRoleUid(null);
    }
  };

  // Delete user
  const handleDeleteUser = async (uid: string) => {
    if (!confirm("このユーザーを削除しますか？")) return;

    try {
      setDeletingUid(uid);
      setError(null);

      await usersApi.delete(uid);
      setMembers((prev) => prev.filter((m) => m.uid !== uid));
    } catch (err) {
      console.error("Delete user error:", err);
      setError(err instanceof Error ? err.message : "ユーザーの削除に失敗しました");
    } finally {
      setDeletingUid(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="ユーザー管理">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout title="ユーザー管理">
        <div className="flex flex-col items-center justify-center py-16">
          <Shield className="w-12 h-12 text-text-tertiary mb-4" />
          <p className="text-text-secondary text-lg">
            管理者のみアクセスできます
          </p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="ユーザー管理">
      <p className="text-text-secondary mb-6">
        組織のメンバーを管理します。
      </p>

      {error && (
        <div className="mb-6 p-4 bg-danger-light border border-danger/20 rounded-lg text-danger">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-danger hover:text-danger"
          >
            <X className="w-4 h-4 inline" />
          </button>
        </div>
      )}

      <Card>
        <CardHeader
          title="メンバー一覧"
          description="組織に所属するユーザー"
          action={
            <Button size="sm" onClick={() => setShowAddUser(true)}>
              <Plus className="w-4 h-4 mr-1" />
              追加
            </Button>
          }
        />
        {members.length === 0 ? (
          <p className="text-text-secondary text-center py-4">
            メンバーがいません
          </p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => {
              const isSelf = member.uid === currentUser?.uid;
              const RoleIcon = member.role === "admin" ? Shield : User;

              return (
                <div
                  key={member.uid}
                  className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <RoleIcon className="w-5 h-5 text-text-tertiary shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-text-primary truncate">
                          {member.display_name || member.email.split("@")[0]}
                        </p>
                        {isSelf && <Badge variant="info">自分</Badge>}
                      </div>
                      <p className="text-sm text-text-secondary truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSelf ? (
                      <Badge variant={member.role === "admin" ? "success" : "default"}>
                        {member.role === "admin" ? "管理者" : "一般"}
                      </Badge>
                    ) : (
                      <>
                        <Select
                          options={roleOptions}
                          value={member.role}
                          onChange={(value) => handleRoleChange(member.uid, value)}
                          disabled={updatingRoleUid === member.uid}
                          className="w-24"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteUser(member.uid)}
                          disabled={deletingUid === member.uid}
                        >
                          {deletingUid === member.uid ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-danger" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Add User Modal */}
      <Modal
        isOpen={showAddUser}
        onClose={() => setShowAddUser(false)}
        title="ユーザーを追加"
        size="sm"
      >
        <div className="space-y-4">
          <Input
            label="メールアドレス *"
            type="email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            placeholder="user@example.com"
          />
          <Input
            label="パスワード *"
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="6文字以上"
          />
          <Input
            label="表示名"
            value={newUser.displayName}
            onChange={(e) =>
              setNewUser({ ...newUser, displayName: e.target.value })
            }
            placeholder="例：山田太郎"
          />
          <Select
            label="ロール"
            options={roleOptions}
            value={newUser.role}
            onChange={(value) => setNewUser({ ...newUser, role: value })}
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setShowAddUser(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleAddUser}
            disabled={addingUser || !newUser.email || !newUser.password || newUser.password.length < 6}
          >
            {addingUser ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            追加
          </Button>
        </div>
      </Modal>
    </AdminLayout>
  );
}

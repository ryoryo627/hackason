"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input, Badge } from "@/components/ui";
import { Save, Loader2, CheckCircle, XCircle } from "lucide-react";
import { settingsApi } from "@/lib/api";

interface Organization {
  id: string;
  name: string;
}

export default function OrganizationSettingsPage() {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [slackStatus, setSlackStatus] = useState<{
    connected: boolean;
    team_name?: string;
    bot_user_id?: string;
    oncall_channel?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [orgName, setOrgName] = useState("");

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [orgData, slackConfig] = await Promise.all([
          settingsApi.getOrganization().catch(() => null),
          settingsApi.getSlackConfig().catch(() => null),
        ]);

        if (orgData) {
          setOrganization({ id: orgData.id, name: orgData.name });
          setOrgName(orgData.name || "");
        }

        if (slackConfig) {
          setSlackStatus({
            connected: slackConfig.configured,
            team_name: slackConfig.team_name,
            bot_user_id: slackConfig.bot_id,
            oncall_channel: slackConfig.default_channel,
          });
        }
      } catch (err) {
        console.error("Organization fetch error:", err);
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Save organization
  const handleSave = async () => {
    if (!orgName.trim()) return;

    try {
      setSaving(true);
      setError(null);

      await settingsApi.updateOrganization({ name: orgName });

      setOrganization((prev) =>
        prev ? { ...prev, name: orgName } : null
      );
    } catch (err) {
      console.error("Save error:", err);
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="組織設定">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="組織設定">
      <p className="text-gray-600 mb-6">
        組織の基本情報とSlack連携の設定を管理します。
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Organization Info */}
      <Card className="mb-6">
        <CardHeader title="組織情報" description="基本的な組織情報" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="組織名"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
          />
          <Input
            label="組織ID"
            value={organization?.id || "未設定"}
            disabled
          />
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={handleSave} disabled={saving || !orgName.trim()}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存
          </Button>
        </div>
      </Card>

      {/* Slack Integration */}
      <Card>
        <CardHeader title="Slack連携" description="Slackワークスペースとの連携状態" />
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">ワークスペース</p>
              <p className="text-sm text-gray-500">
                {slackStatus?.connected && slackStatus.team_name
                  ? slackStatus.team_name
                  : "未接続"}
              </p>
            </div>
            <Badge variant={slackStatus?.connected ? "success" : "default"}>
              {slackStatus?.connected ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  接続済み
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  未設定
                </>
              )}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Bot User ID</p>
              <p className="text-sm text-gray-500">
                {slackStatus?.connected && slackStatus.bot_user_id
                  ? slackStatus.bot_user_id
                  : "-"}
              </p>
            </div>
            <Badge variant={slackStatus?.bot_user_id ? "success" : "default"}>
              {slackStatus?.bot_user_id ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  設定済み
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  未設定
                </>
              )}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">#oncall-night チャンネル</p>
              <p className="text-sm text-gray-500">
                {slackStatus?.oncall_channel
                  ? `#${slackStatus.oncall_channel}`
                  : "朝8時の定時レポート配信先"}
              </p>
            </div>
            <Badge variant={slackStatus?.oncall_channel ? "success" : "default"}>
              {slackStatus?.oncall_channel ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  設定済み
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  未設定
                </>
              )}
            </Badge>
          </div>

          {!slackStatus?.connected && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                Slack連携を開始するには、まず<strong>API設定</strong>でSlackのトークンを設定してください。
                設定後、初期セットアップウィザードでワークスペースとの連携を完了できます。
              </p>
            </div>
          )}

          {slackStatus?.connected && !slackStatus.oncall_channel && (
            <div className="p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-yellow-700">
                Slackは接続されていますが、#oncall-nightチャンネルが設定されていません。
                <strong>初期セットアップウィザード</strong>からチャンネルを設定してください。
              </p>
            </div>
          )}
        </div>
      </Card>
    </AdminLayout>
  );
}

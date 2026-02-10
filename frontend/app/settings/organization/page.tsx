"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input, Badge, Alert } from "@/components/ui";
import { Save, Loader2, CheckCircle, XCircle, Plus, Clock, X } from "lucide-react";
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
    oncall_channel_name?: string;
    morning_scan_time?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [orgName, setOrgName] = useState("");

  // Channel creation state
  const [creatingChannel, setCreatingChannel] = useState(false);

  // Scan time state
  const [scanTime, setScanTime] = useState("08:00");
  const [savingScanTime, setSavingScanTime] = useState(false);

  // Alert schedule state
  const [alertTimes, setAlertTimes] = useState<string[]>(["08:00"]);
  const [savedAlertTimes, setSavedAlertTimes] = useState<string[]>(["08:00"]);
  const [savingAlertTimes, setSavingAlertTimes] = useState(false);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [orgData, slackConfig, alertSchedule] = await Promise.all([
          settingsApi.getOrganization().catch(() => null),
          settingsApi.getSlackConfig().catch(() => null),
          settingsApi.getAlertSchedule().catch(() => null),
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
            oncall_channel_name: slackConfig.oncall_channel_name,
            morning_scan_time: slackConfig.morning_scan_time,
          });
          if (slackConfig.morning_scan_time) {
            setScanTime(slackConfig.morning_scan_time);
          }
        }

        if (alertSchedule?.alert_scan_times) {
          setAlertTimes(alertSchedule.alert_scan_times);
          setSavedAlertTimes(alertSchedule.alert_scan_times);
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

  // Create oncall-night channel
  const handleCreateOncallChannel = async () => {
    try {
      setCreatingChannel(true);
      setError(null);

      console.log("Creating oncall channel...");
      const result = await settingsApi.createOncallChannel();
      console.log("Oncall channel result:", result);

      if (result.channel_id) {
        setSlackStatus((prev) =>
          prev
            ? {
                ...prev,
                oncall_channel: result.channel_id,
                oncall_channel_name: result.channel_name,
              }
            : null
        );
      }
    } catch (err) {
      console.error("Channel creation error:", err);
      const message = err instanceof Error ? err.message : "チャンネル作成に失敗しました";
      setError(`チャンネル作成エラー: ${message}`);
    } finally {
      setCreatingChannel(false);
    }
  };

  // Save morning scan time
  const handleSaveScanTime = async () => {
    try {
      setSavingScanTime(true);
      setError(null);

      await settingsApi.updateMorningScanTime(scanTime);

      setSlackStatus((prev) =>
        prev ? { ...prev, morning_scan_time: scanTime } : null
      );
    } catch (err) {
      console.error("Scan time save error:", err);
      setError(err instanceof Error ? err.message : "配信時刻の保存に失敗しました");
    } finally {
      setSavingScanTime(false);
    }
  };

  // Alert schedule handlers
  const handleAddAlertTime = () => {
    setAlertTimes((prev) => [...prev, "12:00"]);
  };

  const handleRemoveAlertTime = (index: number) => {
    setAlertTimes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAlertTimeChange = (index: number, value: string) => {
    setAlertTimes((prev) => prev.map((t, i) => (i === index ? value : t)));
  };

  const handleSaveAlertTimes = async () => {
    try {
      setSavingAlertTimes(true);
      setError(null);

      const result = await settingsApi.updateAlertSchedule(alertTimes);
      if (result.alert_scan_times) {
        setAlertTimes(result.alert_scan_times);
        setSavedAlertTimes(result.alert_scan_times);
      }
    } catch (err) {
      console.error("Alert schedule save error:", err);
      setError(err instanceof Error ? err.message : "アラート時刻の保存に失敗しました");
    } finally {
      setSavingAlertTimes(false);
    }
  };

  const alertTimesChanged = JSON.stringify(alertTimes.slice().sort()) !== JSON.stringify(savedAlertTimes.slice().sort());

  if (loading) {
    return (
      <AdminLayout title="組織設定">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-text-tertiary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="組織設定">
      <p className="text-text-secondary mb-6">
        組織の基本情報とSlack連携の設定を管理します。
      </p>

      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError(null)} className="mb-6">
          {error}
        </Alert>
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
          <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg">
            <div>
              <p className="font-medium text-text-primary">ワークスペース</p>
              <p className="text-sm text-text-secondary">
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

          <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg">
            <div>
              <p className="font-medium text-text-primary">Bot User ID</p>
              <p className="text-sm text-text-secondary">
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

          <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg">
            <div>
              <p className="font-medium text-text-primary">#oncall-night チャンネル</p>
              <p className="text-sm text-text-secondary">
                {slackStatus?.oncall_channel_name
                  ? `#${slackStatus.oncall_channel_name}`
                  : slackStatus?.oncall_channel
                    ? `ID: ${slackStatus.oncall_channel}`
                    : "定時レポート配信先"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {slackStatus?.connected && !slackStatus.oncall_channel && (
                <Button
                  onClick={handleCreateOncallChannel}
                  disabled={creatingChannel}
                  variant="primary"
                  size="sm"
                >
                  {creatingChannel ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Plus className="w-4 h-4 mr-1" />
                  )}
                  チャンネル作成
                </Button>
              )}
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
          </div>

          {/* Alert scan schedule - only show when oncall channel exists */}
          {slackStatus?.oncall_channel && (
            <div className="p-4 bg-bg-secondary rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-text-secondary" />
                <div>
                  <p className="font-medium text-text-primary">アラートスキャン時刻</p>
                  <p className="text-sm text-text-secondary">
                    毎日この時刻にアラートスキャンを実行し、#oncall-night へレポートを配信します
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {alertTimes.map((time, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => handleAlertTimeChange(index, e.target.value)}
                      className="px-3 py-1.5 border border-border-strong rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-accent-500"
                    />
                    {alertTimes.length > 1 && (
                      <button
                        onClick={() => handleRemoveAlertTime(index)}
                        className="p-1 text-text-tertiary hover:text-danger transition-colors"
                        title="削除"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <Button
                  onClick={handleAddAlertTime}
                  variant="secondary"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  時刻を追加
                </Button>
                <Button
                  onClick={handleSaveAlertTimes}
                  disabled={savingAlertTimes || !alertTimesChanged}
                  size="sm"
                >
                  {savingAlertTimes ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  保存
                </Button>
              </div>
            </div>
          )}

          {!slackStatus?.connected && (
            <Alert variant="info">
              Slackワークスペースが接続されていません。
              <a href="/settings/api" className="font-semibold underline hover:text-accent-700 ml-1">
                サービス接続画面
              </a>
              からBot TokenとSigning Secretを設定してください。
            </Alert>
          )}

          {slackStatus?.connected && !slackStatus.oncall_channel && (
            <Alert variant="warning">
              Slackは接続されていますが、#oncall-nightチャンネルが設定されていません。上の「チャンネル作成」ボタンをクリックして作成してください。
            </Alert>
          )}
        </div>
      </Card>
    </AdminLayout>
  );
}

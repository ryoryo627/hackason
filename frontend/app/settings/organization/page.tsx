"use client";

import { AdminLayout } from "@/components/layout";
import { Card, CardHeader, Button, Input, Badge } from "@/components/ui";
import { Save, Building } from "lucide-react";

export default function OrganizationSettingsPage() {
  return (
    <AdminLayout title="組織設定">
      <p className="text-gray-600 mb-6">
        組織の基本情報とSlack連携の設定を管理します。
      </p>

      {/* Organization Info */}
      <Card className="mb-6">
        <CardHeader title="組織情報" description="基本的な組織情報" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="組織名" defaultValue="デモ在宅医療クリニック" />
          <Input label="組織ID" defaultValue="demo-org-001" disabled />
        </div>
        <div className="flex justify-end mt-4">
          <Button>
            <Save className="w-4 h-4 mr-2" />
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
              <p className="text-sm text-gray-500">未接続</p>
            </div>
            <Badge variant="default">未設定</Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Bot User ID</p>
              <p className="text-sm text-gray-500">-</p>
            </div>
            <Badge variant="default">未設定</Badge>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">#oncall-night チャンネル</p>
              <p className="text-sm text-gray-500">朝8時の定時レポート配信先</p>
            </div>
            <Badge variant="default">未設定</Badge>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              Slack連携を開始するには、まず<strong>API設定</strong>でSlackのトークンを設定してください。
              設定後、初期セットアップウィザードでワークスペースとの連携を完了できます。
            </p>
          </div>
        </div>
      </Card>
    </AdminLayout>
  );
}

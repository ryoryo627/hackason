"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/layout";
import { Card, Button, Input, Badge } from "@/components/ui";
import { Check, ChevronRight, ExternalLink } from "lucide-react";

const steps = [
  {
    id: 1,
    title: "Slack App作成",
    description: "Slack管理画面でAppを作成",
  },
  {
    id: 2,
    title: "トークン入力",
    description: "Bot TokenとSigning Secretを入力",
  },
  {
    id: 3,
    title: "接続テスト",
    description: "Slackとの接続を確認",
  },
  {
    id: 4,
    title: "初期設定",
    description: "チャンネル作成と設定完了",
  },
];

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <AdminLayout title="初期セットアップ">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    step.id < currentStep
                      ? "bg-green-500 text-white"
                      : step.id === currentStep
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {step.id < currentStep ? <Check className="w-5 h-5" /> : step.id}
                </div>
                <p className="text-sm font-medium mt-2">{step.title}</p>
                <p className="text-xs text-gray-500">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-24 h-1 mx-2 ${
                    step.id < currentStep ? "bg-green-500" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 1: Slack Appの作成</h2>
          <div className="space-y-4 text-gray-600">
            <p>以下の手順でSlack Appを作成してください：</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Slack API管理画面にアクセス</li>
              <li>「Create New App」をクリック</li>
              <li>「From scratch」を選択</li>
              <li>App名を「HomeCare AI」に設定</li>
              <li>対象のワークスペースを選択</li>
            </ol>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>権限設定：</strong>OAuth & Permissions で以下のBot Token Scopesを追加してください：
                <br />
                <code className="text-xs">channels:manage, channels:read, chat:write, users:read</code>
              </p>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              Slack API管理画面を開く
              <ExternalLink className="w-4 h-4 ml-1" />
            </a>
            <Button onClick={() => setCurrentStep(2)}>
              次へ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 2 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 2: トークン入力</h2>
          <p className="text-gray-600 mb-4">
            Slack Appから取得したトークンを入力してください。これらの情報はSecret Managerに暗号化保存されます。
          </p>
          <div className="space-y-4">
            <Input
              label="Bot User OAuth Token"
              type="password"
              placeholder="xoxb-..."
            />
            <Input
              label="Signing Secret"
              type="password"
              placeholder="xxxxxxxx..."
            />
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setCurrentStep(1)}>
              戻る
            </Button>
            <Button onClick={() => setCurrentStep(3)}>
              次へ
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}

      {currentStep === 3 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 3: 接続テスト</h2>
          <p className="text-gray-600 mb-4">
            入力したトークンでSlackに接続できるか確認します。
          </p>
          <div className="p-4 bg-gray-50 rounded-lg mb-4">
            <div className="flex items-center justify-between">
              <span>接続状態</span>
              <Badge variant="default">未テスト</Badge>
            </div>
          </div>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setCurrentStep(2)}>
              戻る
            </Button>
            <div className="flex gap-2">
              <Button variant="secondary">接続テスト実行</Button>
              <Button onClick={() => setCurrentStep(4)}>
                次へ
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <h2 className="text-xl font-semibold mb-4">Step 4: 初期設定完了</h2>
          <p className="text-gray-600 mb-4">
            以下の初期設定を自動で行います：
          </p>
          <ul className="space-y-2 text-gray-600 mb-4">
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
              組織情報の登録
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
              #oncall-night チャンネルの作成
            </li>
            <li className="flex items-center gap-2">
              <div className="w-2 h-2 bg-gray-300 rounded-full" />
              Botのチャンネル参加
            </li>
          </ul>
          <div className="flex justify-between mt-6">
            <Button variant="secondary" onClick={() => setCurrentStep(3)}>
              戻る
            </Button>
            <Button>
              セットアップを完了
              <Check className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </Card>
      )}
    </AdminLayout>
  );
}

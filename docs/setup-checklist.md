# HomeCare AI Agent セットアップチェックリスト

**このシートを印刷して、各ステップ完了時にチェックを入れてください**

---

## 準備するもの

- [ ] Google アカウント（Gmail）
- [ ] Slack ワークスペース管理者権限
- [ ] クレジットカード（Google Cloud 請求用）

---

## Step 1: Google Cloud (15分)

| # | 作業 | 完了 | メモ欄 |
|---|------|:----:|--------|
| 1-1 | https://console.cloud.google.com にアクセス | ☐ | |
| 1-2 | 新規プロジェクト作成（名前: `homecare-ai`） | ☐ | |
| 1-3 | プロジェクトIDをメモ | ☐ | ID: __________________ |
| 1-4 | Cloud Run API を有効化 | ☐ | |
| 1-5 | Cloud Build API を有効化 | ☐ | |
| 1-6 | Artifact Registry API を有効化 | ☐ | |
| 1-7 | Secret Manager API を有効化 | ☐ | |
| 1-8 | Vertex AI API を有効化 | ☐ | |
| 1-9 | 請求先アカウントをリンク | ☐ | |

---

## Step 2: Firebase (10分)

| # | 作業 | 完了 | メモ欄 |
|---|------|:----:|--------|
| 2-1 | https://console.firebase.google.com にアクセス | ☐ | |
| 2-2 | 既存GCPプロジェクトにFirebaseを追加 | ☐ | |
| 2-3 | Firestore データベースを作成（Tokyo） | ☐ | |
| 2-4 | Authentication を有効化 | ☐ | |
| 2-5 | ウェブアプリを登録 | ☐ | |
| 2-6 | Firebase設定をメモ | ☐ | apiKey: __________________ |

---

## Step 3: Slack アプリ (15分)

| # | 作業 | 完了 | メモ欄 |
|---|------|:----:|--------|
| 3-1 | https://api.slack.com/apps にアクセス | ☐ | |
| 3-2 | 新規アプリ作成（名前: `HomeCare AI`） | ☐ | |
| 3-3 | Bot Token Scopes を追加（12個） | ☐ | |
| 3-4 | ワークスペースにインストール | ☐ | |
| 3-5 | Bot Token をメモ | ☐ | xoxb-__________________ |
| 3-6 | Signing Secret をメモ | ☐ | __________________ |

**追加するBot Token Scopes:**
```
channels:history, channels:join, channels:manage, channels:read,
chat:write, groups:history, groups:read, groups:write,
im:history, im:read, im:write, users:read, users:read.email
```

---

## Step 4: Gemini API (5分)

| # | 作業 | 完了 | メモ欄 |
|---|------|:----:|--------|
| 4-1 | https://aistudio.google.com にアクセス | ☐ | |
| 4-2 | API Key を作成 | ☐ | |
| 4-3 | API Key をメモ | ☐ | AIzaSy__________________ |

---

## Step 5: デプロイ (20分)

| # | 作業 | 完了 | メモ欄 |
|---|------|:----:|--------|
| 5-1 | Cloud Shell を起動 | ☐ | |
| 5-2 | ソースコードを取得 | ☐ | |
| 5-3 | シークレットを登録（3個） | ☐ | |
| 5-4 | バックエンドをデプロイ | ☐ | |
| 5-5 | バックエンドURLをメモ | ☐ | https://__________________ |
| 5-6 | Slack Event URL を設定 | ☐ | Verified確認 |
| 5-7 | フロントエンドをデプロイ | ☐ | |
| 5-8 | フロントエンドURLをメモ | ☐ | https://__________________ |

---

## Step 6: 初期設定 (10分)

| # | 作業 | 完了 | メモ欄 |
|---|------|:----:|--------|
| 6-1 | 管理画面にアクセス | ☐ | |
| 6-2 | ログイン（デモモード） | ☐ | |
| 6-3 | 組織情報を入力 | ☐ | |
| 6-4 | Slack接続テスト成功 | ☐ | |
| 6-5 | 事業所を登録 | ☐ | |
| 6-6 | 地区を登録 | ☐ | |

---

## Step 7: 動作確認 (10分)

| # | 作業 | 完了 | メモ欄 |
|---|------|:----:|--------|
| 7-1 | テスト患者を登録 | ☐ | |
| 7-2 | Slackチャンネル作成を確認 | ☐ | |
| 7-3 | テスト報告を送信 | ☐ | |
| 7-4 | Bot応答を確認 | ☐ | |
| 7-5 | アラート表示を確認 | ☐ | |

---

## 重要情報の保管

**以下の情報を安全な場所に保管してください（紛失注意）**

| 項目 | 値 |
|------|-----|
| Google Cloud プロジェクトID | |
| Firebase API Key | |
| Slack Bot Token | |
| Slack Signing Secret | |
| Gemini API Key | |
| バックエンドURL | |
| フロントエンドURL | |

---

## 困ったときは

1. **セットアップガイド** (setup-guide.md) を確認
2. **Cloud Run ログ** を確認
   ```
   gcloud run logs read homecare-bot --region asia-northeast1 --limit 50
   ```
3. サポートへ連絡（エラー画面のスクリーンショットを添付）

---

**作業日**: ____年____月____日
**作業者**: ____________________
**確認者**: ____________________

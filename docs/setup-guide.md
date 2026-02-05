# HomeCare AI Agent セットアップガイド

**バージョン**: 2.0
**対象読者**: IT管理者・事務職員
**所要時間**: 約60〜90分
**最終更新**: 2026年2月

---

## 重要な注意事項（最初に必ず読む）

### デプロイ環境について

**ローカルMacからデプロイします（Cloud Shellは使いません）**

理由：
- ローカル環境の方が安定している
- ファイル編集が容易
- セッション切れの心配がない

### 環境変数について

**Next.jsの`NEXT_PUBLIC_*`環境変数はビルド時に埋め込まれます**

- `gcloud run deploy --source`では環境変数が反映されない
- 必ず`gcloud builds submit --config=cloudbuild.yaml`を使用する
- Firebase設定値は`cloudbuild.yaml`にハードコードする（セキュリティ上問題なし）

---

## 目次

1. [事前準備](#1-事前準備)
2. [Google Cloud プロジェクトの作成](#2-google-cloud-プロジェクトの作成)
3. [Firebase の設定](#3-firebase-の設定)
4. [Slack アプリの作成](#4-slack-アプリの作成)
5. [Gemini API の設定](#5-gemini-api-の設定)
6. [ローカル環境の準備](#6-ローカル環境の準備)
7. [バックエンドのデプロイ](#7-バックエンドのデプロイ)
8. [フロントエンドのデプロイ](#8-フロントエンドのデプロイ)
9. [初期設定の実行](#9-初期設定の実行)
10. [動作確認](#10-動作確認)
11. [トラブルシューティング](#11-トラブルシューティング)

---

## 1. 事前準備

### 1.1 必要なアカウント

| サービス | 用途 | 取得URL |
|---------|------|---------|
| Google アカウント | Google Cloud、Firebase の利用 | https://accounts.google.com |
| Slack ワークスペース | チーム連携（管理者権限が必要） | https://slack.com |
| GitHub アカウント | ソースコード取得 | https://github.com |

### 1.2 収集する情報チェックリスト

セットアップ中に以下の情報をメモしてください：

```
□ Google Cloud プロジェクトID: _______________________
□ Google Cloud プロジェクト番号: _______________________
□ Firebase API Key: _______________________
□ Firebase Auth Domain: _______________________
□ Firebase Messaging Sender ID: _______________________
□ Firebase App ID: _______________________
□ Slack Bot Token (xoxb-...): _______________________
□ Slack Signing Secret: _______________________
□ Gemini API Key: _______________________
□ バックエンドURL: _______________________
□ フロントエンドURL: _______________________
```

---

## 2. Google Cloud プロジェクトの作成

### 2.1 Google Cloud Console にアクセス

1. https://console.cloud.google.com を開く
2. Google アカウントでログイン

### 2.2 新規プロジェクトの作成

1. 画面上部の **プロジェクト選択** → **新しいプロジェクト**
2. プロジェクト名を入力（例：`homecare-ai`）
3. **作成** をクリック
4. 作成完了まで30秒〜1分待つ

### 2.3 プロジェクトIDとプロジェクト番号の確認

1. 作成したプロジェクトを選択
2. **ダッシュボード** で以下を確認してメモ：
   - **プロジェクトID**（例：`homecare-ai-123456`）
   - **プロジェクト番号**（例：`900198832085`）

> ⚠️ プロジェクトIDとプロジェクト番号は別物です。両方メモしてください。

### 2.4 必要なAPIの有効化

左側メニュー **APIとサービス** > **ライブラリ** で以下を有効化：

| API名 | 検索キーワード |
|-------|---------------|
| Cloud Run Admin API | cloud run |
| Cloud Build API | cloud build |
| Artifact Registry API | artifact registry |
| Secret Manager API | secret manager |
| Firestore API | firestore |

### 2.5 請求先アカウントの設定

1. 左側メニュー **お支払い** を選択
2. 請求先アカウントをプロジェクトにリンク

---

## 3. Firebase の設定

### 3.1 Firebase プロジェクトの追加

1. https://console.firebase.google.com を開く
2. **プロジェクトを追加** → **既存の Google Cloud プロジェクトに Firebase を追加する**
3. Step 2で作成したプロジェクトを選択
4. **Firebase を追加** をクリック

### 3.2 Firestore データベースの作成

1. 左側メニュー **Firestore Database** を選択
2. **データベースを作成** をクリック
3. **本番環境モードで開始** を選択
4. ロケーション: **asia-northeast1 (Tokyo)** を選択
5. **有効にする** をクリック

### 3.3 Firebase Authentication の設定

1. 左側メニュー **Authentication** → **始める**
2. **Sign-in method** タブ
3. **Google** をクリック → **有効にする** → サポートメール選択 → **保存**

### 3.4 Firebase 設定情報の取得

1. 左側メニュー **プロジェクトの概要** の歯車 → **プロジェクトの設定**
2. **全般** タブを下にスクロール
3. **マイアプリ** で **</>** (ウェブ) をクリック
4. アプリ名を入力（例：`homecare-admin`）→ **アプリを登録**
5. 表示される設定情報をすべてメモ：

```javascript
apiKey: "AIzaSy..."           // ← メモ
authDomain: "xxx.firebaseapp.com"  // ← メモ
projectId: "xxx"              // ← メモ
storageBucket: "xxx.appspot.com"
messagingSenderId: "123456789"     // ← メモ
appId: "1:123456789:web:abc123"    // ← メモ
```

---

## 4. Slack アプリの作成

### 4.1 新規アプリの作成

1. https://api.slack.com/apps を開く
2. **Create New App** → **From scratch**
3. App Name: `HomeCare AI`
4. ワークスペースを選択 → **Create App**

### 4.2 Bot Token Scopes の設定

1. **OAuth & Permissions** を選択
2. **Bot Token Scopes** で以下を追加：

```
channels:history, channels:join, channels:manage, channels:read,
chat:write, groups:history, groups:read, groups:write,
im:history, im:read, im:write, users:read, users:read.email
```

### 4.3 アプリのインストール

1. **OAuth & Permissions** 上部の **Install to Workspace**
2. **許可する** をクリック
3. **Bot User OAuth Token** をメモ（`xoxb-...`で始まる）

### 4.4 Signing Secret の取得

1. **Basic Information** を選択
2. **App Credentials** → **Signing Secret** の **Show** をクリック
3. 表示された値をメモ

### 4.5 Event Subscriptions（後で設定）

Request URLはバックエンドデプロイ後に設定します。

---

## 5. Gemini API の設定

1. https://aistudio.google.com を開く
2. **Get API key** → **Create API key**
3. Step 2のプロジェクトを選択
4. 生成されたAPIキーをメモ（`AIzaSy...`）

---

## 6. ローカル環境の準備

### 6.1 gcloud CLIのインストール

**まだインストールしていない場合：**

1. https://cloud.google.com/sdk/docs/install からダウンロード
2. インストール後、ターミナルで：

```bash
gcloud init
```

3. Google アカウントでログイン
4. Step 2で作成したプロジェクトを選択

**既にインストール済みの場合：**

```bash
# プロジェクトを設定
gcloud config set project 《プロジェクトID》
```

### 6.2 ソースコードの取得

```bash
# 任意のディレクトリで実行
git clone https://github.com/ryoryo627/hackason.git
cd hackason
```

---

## 7. バックエンドのデプロイ

### 7.1 シークレットの作成

```bash
# Slack Bot Token
echo -n "《Bot Token（xoxb-...）》" | gcloud secrets create slack-bot-token --data-file=-

# Slack Signing Secret
echo -n "《Signing Secret》" | gcloud secrets create slack-signing-secret --data-file=-

# Gemini API Key
echo -n "《Gemini API Key》" | gcloud secrets create gemini-api-key --data-file=-
```

> **エラー「already exists」が出た場合**：
> ```bash
> echo -n "《新しい値》" | gcloud secrets versions add slack-bot-token --data-file=-
> ```

### 7.2 サービスアカウント権限の付与

```bash
# プロジェクト番号を取得（メモしたものと照合）
gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)'

# 権限を付与（プロジェクト番号を置き換え）
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:《プロジェクト番号》-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 7.3 バックエンドのデプロイ

```bash
cd backend

gcloud run deploy homecare-bot \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=《プロジェクトID》" \
  --set-env-vars "GCP_REGION=asia-northeast1" \
  --set-env-vars "GEMINI_MODEL=gemini-2.0-flash" \
  --set-secrets "SLACK_BOT_TOKEN=slack-bot-token:latest" \
  --set-secrets "SLACK_SIGNING_SECRET=slack-signing-secret:latest" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest"
```

> ⚠️ **重要**: `GOOGLE_CLOUD_PROJECT`を必ず設定してください。これがないとFirestoreにアクセスできません。

デプロイ完了後、表示されるURLをメモ：
```
Service URL: https://homecare-bot-xxxxxx.asia-northeast1.run.app
```

### 7.4 Slack Event URL の設定

1. https://api.slack.com/apps でアプリを選択
2. **Event Subscriptions** → **Enable Events** を On
3. **Request URL** に入力：
   ```
   《バックエンドURL》/slack/events
   ```
4. **Verified** と表示されることを確認
5. **Subscribe to bot events** で以下を追加：
   - `message.channels`
   - `message.groups`
   - `message.im`
   - `app_mention`
6. **Save Changes**

---

## 8. フロントエンドのデプロイ

### 8.1 cloudbuild.yaml の編集

`frontend/cloudbuild.yaml`を開き、`substitutions`セクションを編集：

```yaml
substitutions:
  _FIREBASE_API_KEY: '《Firebase API Key》'
  _FIREBASE_AUTH_DOMAIN: '《プロジェクトID》.firebaseapp.com'
  _FIREBASE_PROJECT_ID: '《プロジェクトID》'
  _FIREBASE_STORAGE_BUCKET: '《プロジェクトID》.firebasestorage.app'
  _FIREBASE_MESSAGING_SENDER_ID: '《Messaging Sender ID》'
  _FIREBASE_APP_ID: '《App ID》'
  _API_URL: '《バックエンドURL》'
```

> ⚠️ **重要**: 値に`:`が含まれる場合（App IDなど）、コマンドラインの`--substitutions`フラグでエラーになります。**必ずファイルに直接記載**してください。

### 8.2 Artifact Registry の作成（初回のみ）

```bash
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=asia-northeast1 \
  --description="Cloud Run source deployments"
```

> 「already exists」エラーは無視してOK

### 8.3 フロントエンドのデプロイ

```bash
cd frontend
gcloud builds submit --config=cloudbuild.yaml
```

デプロイ完了後、表示されるURLをメモ：
```
Service URL: https://homecare-admin-xxxxxx.asia-northeast1.run.app
```

### 8.4 CORS設定の更新

```bash
gcloud run services update homecare-bot \
  --region asia-northeast1 \
  --update-env-vars "ADMIN_UI_URL=《フロントエンドURL》"
```

### 8.5 Firebase 認証ドメインの追加

1. Firebase Console → **Authentication** → **Settings**
2. **承認済みドメイン** → **ドメインを追加**
3. フロントエンドのドメイン（`https://`なし）を入力：
   ```
   homecare-admin-xxxxxx.asia-northeast1.run.app
   ```

---

## 9. 初期設定の実行

### 9.1 管理画面にアクセス

1. ブラウザでフロントエンドURLを開く
2. **Googleでログイン** をクリック

### 9.2 セットアップウィザード

ログイン後、自動的にセットアップウィザードが表示されます：

1. **Step 1: 組織情報**
   - 組織名を入力
   - 管理者メールアドレスを確認
   - **次へ** をクリック

2. **Step 2: Slack連携**
   - Bot Tokenを入力（`xoxb-...`）
   - Signing Secretを入力
   - **次へ** をクリック

3. **Step 3: 接続テスト**
   - **接続テスト実行** をクリック
   - 「接続成功」を確認
   - **設定を保存** をクリック

4. **Step 4: 完了**
   - **ダッシュボードへ** をクリック

> すべての設定はこのUIから行います。ターミナルでcurlコマンドを実行する必要はありません。

---

## 10. 動作確認

### 10.1 患者登録テスト

1. 管理画面 → **患者一覧** → **患者を登録**
2. テスト患者を登録
3. Slackで新しいチャンネルが作成されることを確認

### 10.2 Slack連携テスト

1. 作成されたチャンネルを開く
2. Botのアンカーメッセージにリプライを送信
3. Botからの応答を確認

---

## 11. トラブルシューティング

### 「Failed to fetch」エラー

**原因1: CORS設定**
```bash
# 確認
gcloud run services describe homecare-bot --region asia-northeast1 \
  --format='value(spec.template.spec.containers[0].env)'

# 修正
gcloud run services update homecare-bot \
  --region asia-northeast1 \
  --update-env-vars "ADMIN_UI_URL=《フロントエンドURL》"
```

**原因2: GOOGLE_CLOUD_PROJECT未設定**
```bash
# 確認（GOOGLE_CLOUD_PROJECTが表示されるか）
gcloud run services describe homecare-bot --region asia-northeast1 \
  --format='value(spec.template.spec.containers[0].env)'

# 修正
gcloud run services update homecare-bot \
  --region asia-northeast1 \
  --update-env-vars "GOOGLE_CLOUD_PROJECT=《プロジェクトID》"
```

### デモモードになる / Google認証が動かない

**原因**: `NEXT_PUBLIC_*`環境変数がビルド時に埋め込まれていない

**解決**:
1. `frontend/cloudbuild.yaml`の`substitutions`セクションを確認
2. 再デプロイ：
   ```bash
   cd frontend
   gcloud builds submit --config=cloudbuild.yaml
   ```

### Google認証で「このドメインは承認されていません」

**解決**: Firebase Console → Authentication → Settings → 承認済みドメインにCloud Runドメインを追加（Step 8.5参照）

### Firestore権限エラー

**症状**: ログに「Permission denied」

**解決**:
```bash
# 環境変数を確認・設定
gcloud run services update homecare-bot \
  --region asia-northeast1 \
  --update-env-vars "GOOGLE_CLOUD_PROJECT=《プロジェクトID》"
```

### ログの確認方法

```bash
# バックエンドログ（正しいコマンド）
gcloud run services logs read homecare-bot --region asia-northeast1 --limit 50

# フロントエンドログ
gcloud run services logs read homecare-admin --region asia-northeast1 --limit 50
```

> ⚠️ `gcloud run logs read`ではなく`gcloud run services logs read`です

### セットアップウィザードが表示されない

**原因**: 組織が既に作成されている

**解決**: Firestore Consoleで`organizations`コレクションを確認・削除して再試行

---

## 付録: コマンド早見表

### デプロイコマンド

```bash
# バックエンド
cd backend
gcloud run deploy homecare-bot --source . --region asia-northeast1 ...

# フロントエンド（必ずCloud Buildを使用）
cd frontend
gcloud builds submit --config=cloudbuild.yaml
```

### 環境変数の更新

```bash
gcloud run services update homecare-bot \
  --region asia-northeast1 \
  --update-env-vars "KEY=VALUE"
```

### ログ確認

```bash
gcloud run services logs read homecare-bot --region asia-northeast1 --limit 50
```

---

**ドキュメント作成**: HomeCare AI 開発チーム

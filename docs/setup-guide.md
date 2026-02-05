# HomeCare AI Agent セットアップガイド

**バージョン**: 1.0
**対象読者**: IT管理者・事務職員
**所要時間**: 約60〜90分
**最終更新**: 2026年2月

---

## 目次

1. [はじめに](#1-はじめに)
2. [事前準備](#2-事前準備)
3. [Google Cloud プロジェクトの作成](#3-google-cloud-プロジェクトの作成)
4. [Firebase の設定](#4-firebase-の設定)
5. [Slack アプリの作成](#5-slack-アプリの作成)
6. [Gemini API の設定](#6-gemini-api-の設定)
7. [バックエンドのデプロイ](#7-バックエンドのデプロイ)
8. [フロントエンドのデプロイ](#8-フロントエンドのデプロイ)
9. [初期設定の実行](#9-初期設定の実行)
10. [動作確認](#10-動作確認)
11. [トラブルシューティング](#11-トラブルシューティング)

---

## 1. はじめに

### 1.1 このガイドについて

本ガイドでは、HomeCare AI Agent（在宅医療支援AIシステム）を新規にセットアップする手順を説明します。このシステムは以下の機能を提供します：

- **Slack連携**: 多職種間のコミュニケーションを患者ごとに集約
- **AI分析**: 報告内容をBio-Psycho-Social（BPS）フレームワークで構造化
- **アラート機能**: 異変を自動検知して関係者に通知
- **管理画面**: 患者一覧、アラート管理、ナレッジベース管理

### 1.2 システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                      ユーザー                                │
│   (医師・看護師・薬剤師・ケアマネ・事務スタッフ)              │
└─────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────┐          ┌─────────────────────┐
│      Slack          │          │    管理画面          │
│   (多職種連携)       │          │  (ブラウザ)          │
└─────────────────────┘          └─────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Google Cloud                              │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │  homecare-bot   │    │ homecare-admin  │                │
│  │  (AIエージェント) │    │   (管理API)     │                │
│  └─────────────────┘    └─────────────────┘                │
│              │                    │                         │
│              ▼                    ▼                         │
│  ┌─────────────────────────────────────────┐               │
│  │          Cloud Firestore                │               │
│  │         (データベース)                   │               │
│  └─────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 事前準備

### 2.1 必要なアカウント

以下のアカウントを事前に準備してください：

| サービス | 用途 | 取得URL |
|---------|------|---------|
| Google アカウント | Google Cloud、Firebase の利用 | https://accounts.google.com |
| Slack ワークスペース | チーム連携（管理者権限が必要） | https://slack.com |

### 2.2 必要な情報

セットアップ前に以下の情報を確認してください：

- [ ] 組織名（例：〇〇在宅クリニック）
- [ ] 管理者のメールアドレス
- [ ] Slack ワークスペースのURL（例：yourteam.slack.com）
- [ ] クレジットカード情報（Google Cloud の無料枠を超えた場合の課金用）

### 2.3 推奨ブラウザ

- Google Chrome（最新版）
- Microsoft Edge（最新版）

> **注意**: Safari や Firefox では一部の画面表示が異なる場合があります。

---

## 3. Google Cloud プロジェクトの作成

### 3.1 Google Cloud Console にアクセス

1. ブラウザで https://console.cloud.google.com を開きます
2. Google アカウントでログインします
3. 利用規約に同意します（初回のみ）

### 3.2 新規プロジェクトの作成

1. 画面上部の **プロジェクト選択** ドロップダウンをクリック

   ![プロジェクト選択](images/gcp-project-select.png)

2. **新しいプロジェクト** をクリック

3. 以下の情報を入力：
   - **プロジェクト名**: `homecare-ai`（任意の名前）
   - **請求先アカウント**: 既存のアカウントを選択、または新規作成
   - **組織**: 該当する場合は選択

4. **作成** をクリック

5. プロジェクトの作成完了まで30秒〜1分程度待ちます

### 3.3 プロジェクトIDの確認

1. 作成したプロジェクトを選択
2. 画面上部に表示される **プロジェクトID** をメモします

   ```
   例: homecare-ai-123456
   ```

   > **重要**: このプロジェクトIDは後の手順で何度も使用します。

### 3.4 必要なAPIの有効化

1. 左側メニューから **APIとサービス** > **ライブラリ** を選択

2. 以下のAPIを検索して、それぞれ **有効にする** をクリック：

   | API名 | 検索キーワード |
   |-------|---------------|
   | Cloud Run Admin API | cloud run |
   | Cloud Build API | cloud build |
   | Artifact Registry API | artifact registry |
   | Secret Manager API | secret manager |
   | Vertex AI API | vertex ai |
   | Generative Language API | generative language |

3. 各APIの有効化には数秒〜数十秒かかります

### 3.5 請求先アカウントの設定

1. 左側メニューから **お支払い** を選択
2. 請求先アカウントがプロジェクトにリンクされていることを確認
3. リンクされていない場合は **アカウントをリンク** をクリック

> **費用について**:
> - 無料枠の範囲内であれば課金されません
> - 通常の利用であれば月額 $50〜100 程度を見込んでください
> - 予算アラートの設定を推奨します

---

## 4. Firebase の設定

### 4.1 Firebase Console にアクセス

1. https://console.firebase.google.com を開きます
2. Google アカウントでログイン

### 4.2 Firebase プロジェクトの追加

1. **プロジェクトを追加** をクリック

2. **既存の Google Cloud プロジェクトに Firebase を追加する** を選択

3. 先ほど作成した `homecare-ai` プロジェクトを選択

4. **続行** をクリック

5. Google アナリティクスの設定：
   - 本番環境では **有効** を推奨
   - テスト目的であれば **無効** でも可

6. **Firebase を追加** をクリック

### 4.3 Firestore データベースの作成

1. 左側メニューから **Firestore Database** を選択

2. **データベースを作成** をクリック

3. セキュリティルールの設定：
   - **本番環境モードで開始** を選択
   - **次へ** をクリック

4. ロケーションの選択：
   - **asia-northeast1 (Tokyo)** を選択
   - **有効にする** をクリック

5. データベースの作成完了まで1〜2分待ちます

### 4.4 Firebase Authentication の設定

1. 左側メニューから **Authentication** を選択

2. **始める** をクリック

3. **Sign-in method** タブを選択

4. **メール/パスワード** をクリック：
   - **有効にする** をオン
   - **保存** をクリック

5. （オプション）**Google** をクリック：
   - **有効にする** をオン
   - プロジェクトのサポートメールを選択
   - **保存** をクリック

### 4.5 Firebase 設定情報の取得

1. 左側メニューの **プロジェクトの概要** の横にある歯車アイコンをクリック
2. **プロジェクトの設定** を選択
3. **全般** タブを下にスクロール
4. **マイアプリ** セクションで **</>** (ウェブ) アイコンをクリック
5. アプリのニックネームを入力（例：`homecare-admin`）
6. **アプリを登録** をクリック
7. 表示される設定情報をメモ：

```javascript
const firebaseConfig = {
  apiKey: "AIza...",           // ← この値をメモ
  authDomain: "homecare-ai-123456.firebaseapp.com",
  projectId: "homecare-ai-123456",
  storageBucket: "homecare-ai-123456.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## 5. Slack アプリの作成

### 5.1 Slack API にアクセス

1. https://api.slack.com/apps を開きます
2. Slack アカウントでログイン

### 5.2 新規アプリの作成

1. **Create New App** をクリック

2. **From scratch** を選択

3. 以下の情報を入力：
   - **App Name**: `HomeCare AI`
   - **Pick a workspace**: 使用するワークスペースを選択

4. **Create App** をクリック

### 5.3 Bot Token Scopes の設定

1. 左側メニューから **OAuth & Permissions** を選択

2. **Scopes** セクションまでスクロール

3. **Bot Token Scopes** の **Add an OAuth Scope** をクリック

4. 以下のスコープを追加：

   | Scope | 用途 |
   |-------|------|
   | `channels:history` | チャンネルのメッセージ履歴を読む |
   | `channels:join` | パブリックチャンネルに参加 |
   | `channels:manage` | チャンネルの作成・管理 |
   | `channels:read` | チャンネル情報を読む |
   | `chat:write` | メッセージを送信 |
   | `groups:history` | プライベートチャンネルの履歴を読む |
   | `groups:read` | プライベートチャンネル情報を読む |
   | `groups:write` | プライベートチャンネルを管理 |
   | `im:history` | DMの履歴を読む |
   | `im:read` | DM情報を読む |
   | `im:write` | DMを送信 |
   | `users:read` | ユーザー情報を読む |
   | `users:read.email` | ユーザーのメールアドレスを読む |

### 5.4 アプリのインストール

1. **OAuth & Permissions** ページの上部にある **Install to Workspace** をクリック

2. 権限の確認画面で **許可する** をクリック

3. **Bot User OAuth Token** が表示されます：
   ```
   xoxb-1234567890-1234567890123-abcdefghijklmnop
   ```
   > **重要**: このトークンを安全な場所にメモしてください

### 5.5 Event Subscriptions の設定

1. 左側メニューから **Event Subscriptions** を選択

2. **Enable Events** を **On** に切り替え

3. **Request URL** には後で入力します（デプロイ後）

4. **Subscribe to bot events** セクションを展開

5. **Add Bot User Event** をクリックして以下を追加：

   | Event | 用途 |
   |-------|------|
   | `message.channels` | パブリックチャンネルのメッセージ |
   | `message.groups` | プライベートチャンネルのメッセージ |
   | `message.im` | ダイレクトメッセージ |
   | `app_mention` | @bot でのメンション |

6. **Save Changes** をクリック

### 5.6 Signing Secret の取得

1. 左側メニューから **Basic Information** を選択

2. **App Credentials** セクションを展開

3. **Signing Secret** の **Show** をクリック

4. 表示された値をメモ：
   ```
   abc123def456...
   ```

### 5.7 設定情報のまとめ

以下の情報がすべて揃っていることを確認：

| 項目 | 値 |
|------|-----|
| Bot User OAuth Token | `xoxb-...` |
| Signing Secret | `abc123...` |

---

## 6. Gemini API の設定

### 6.1 Google AI Studio にアクセス

1. https://aistudio.google.com を開きます
2. Google アカウントでログイン

### 6.2 API キーの作成

1. 左側メニューから **Get API key** を選択

2. **Create API key** をクリック

3. プロジェクトを選択：
   - 先ほど作成した `homecare-ai` を選択
   - **Create API key in existing project** をクリック

4. 生成された API キーをメモ：
   ```
   AIzaSy...
   ```

   > **警告**: この API キーは外部に漏らさないでください

---

## 7. バックエンドのデプロイ

> **📋 この作業で使用する値（事前に確認）**
>
> | 参照元 | 必要な値 | 確認欄 |
> |--------|---------|:------:|
> | Step 1-3 | Google Cloud プロジェクトID | ☐ |
> | Step 4 | Firebase API Key | ☐ |
> | Step 5 | Slack Bot Token (`xoxb-...`) | ☐ |
> | Step 5 | Slack Signing Secret | ☐ |
> | Step 6 | Gemini API Key (`AIzaSy...`) | ☐ |
>
> **⚠️ すべての値が手元にあることを確認してから進めてください**

### 7.1 Cloud Shell の起動

1. Google Cloud Console (https://console.cloud.google.com) を開く

2. 画面右上の **Cloud Shell をアクティブにする** アイコン（ `>_` ）をクリック

3. Cloud Shell が画面下部に表示されるまで待機（初回は1〜2分）

### 7.2 プロジェクトの設定

Cloud Shell で以下のコマンドを実行：

> **📝 凡例**
> - `《ここを変更》` → あなたの値に置き換えてください
> - それ以外 → そのままコピペでOK

```bash
# プロジェクトIDを設定
gcloud config set project 《Step1-3でメモしたプロジェクトID》
```

**例**: プロジェクトIDが `homecare-ai-prod-12345` の場合：
```bash
gcloud config set project homecare-ai-prod-12345
```

### 7.3 ソースコードの取得

```bash
# ソースコードをダウンロード（このままコピペOK）
git clone https://github.com/ryoryo627/hackason.git

# ディレクトリに移動（このままコピペOK）
cd hackason/backend
```

### 7.4 シークレットの設定

⚠️ **重要**: 各コマンドの `《》` 部分を、前のステップでメモした実際の値に置き換えてから実行してください。

**コマンド1: Slack Bot Token**
```bash
echo -n "《Step5でメモしたBot Token（xoxb-で始まる）》" | gcloud secrets create slack-bot-token --data-file=-
```

**コマンド2: Slack Signing Secret**
```bash
echo -n "《Step5でメモしたSigning Secret》" | gcloud secrets create slack-signing-secret --data-file=-
```

**コマンド3: Gemini API Key**
```bash
echo -n "《Step6でメモしたAPI Key（AIzaSyで始まる）》" | gcloud secrets create gemini-api-key --data-file=-
```

**入力例**:
| コマンド | 置き換え前 | 形式の説明 |
|---------|-----------|-----------|
| 1 | `《Step5でメモしたBot Token》` | `xoxb-` で始まる長い文字列 |
| 2 | `《Step5でメモしたSigning Secret》` | 32文字の英数字 |
| 3 | `《Step6でメモしたAPI Key》` | `AIzaSy` で始まる文字列 |

### 7.5 バックエンドのデプロイ

⚠️ **1箇所だけ変更が必要です**（それ以外はそのままコピペOK）

```bash
# Cloud Run にデプロイ
gcloud run deploy homecare-bot \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=《Step1-3でメモしたプロジェクトID》" \
  --set-env-vars "GCP_REGION=asia-northeast1" \
  --set-env-vars "GEMINI_MODEL=gemini-2.0-flash" \
  --set-secrets "SLACK_BOT_TOKEN=slack-bot-token:latest" \
  --set-secrets "SLACK_SIGNING_SECRET=slack-signing-secret:latest" \
  --set-secrets "GEMINI_API_KEY=gemini-api-key:latest"
```

**変更箇所の確認**:
| 行 | 内容 | 変更? |
|----|------|:-----:|
| `--source .` | カレントディレクトリ | そのまま |
| `--region asia-northeast1` | 東京リージョン | そのまま |
| `--allow-unauthenticated` | 公開設定 | そのまま |
| `GOOGLE_CLOUD_PROJECT=《...》` | プロジェクトID | **⚠️ 変更** |
| `GCP_REGION=asia-northeast1` | リージョン | そのまま |
| `GEMINI_MODEL=gemini-2.0-flash` | AIモデル | そのまま |
| `--set-secrets` の3行 | シークレット参照 | そのまま |

デプロイが完了すると、以下のようなURLが表示されます：

```
Service URL: https://homecare-bot-xxxxxx-an.a.run.app
```

📝 **このURLをメモしてください**（次のステップで使います）

### 7.6 Slack Event URL の設定

1. Slack API (https://api.slack.com/apps) に戻る

2. 作成したアプリを選択

3. **Event Subscriptions** を選択

4. **Request URL** に以下を入力：
   ```
   《7.5でメモしたURL》/slack/events
   ```

   **例**: URLが `https://homecare-bot-abc123-an.a.run.app` の場合：
   ```
   https://homecare-bot-abc123-an.a.run.app/slack/events
   ```

5. **Verified** と表示されることを確認（緑のチェックマーク）

6. **Save Changes** をクリック

---

## 8. フロントエンドのデプロイ

### 8.1 環境変数ファイルの作成

Cloud Shell で以下を実行します。⚠️ **4箇所の変更が必要です**。

```bash
# フロントエンドディレクトリに移動（このままコピペOK）
cd ../frontend
```

次に、環境変数ファイルを作成します。下の枠内を**すべてコピーして**、`《》`の部分を置き換えてから貼り付けてください：

```bash
cat > .env.production << 'EOF'
NEXT_PUBLIC_API_URL=《7.5でメモしたバックエンドURL》
NEXT_PUBLIC_FIREBASE_API_KEY=《Step4でメモしたFirebase API Key》
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=《Step1-3のプロジェクトID》.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=《Step1-3のプロジェクトID》
EOF
```

**入力例**:
| 変数 | 置き換え後の例 |
|------|--------------|
| `NEXT_PUBLIC_API_URL` | `https://homecare-bot-abc123-an.a.run.app` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyBcDeFgHiJkLmNoPqRsTuVwXyZ` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `homecare-ai-prod-12345.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `homecare-ai-prod-12345` |

### 8.2 フロントエンドのデプロイ

```bash
# Cloud Run にデプロイ（このままコピペOK、変更不要）
gcloud run deploy homecare-admin \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated
```

デプロイが完了すると、管理画面のURLが表示されます：

```
Service URL: https://homecare-admin-xxxxxx-an.a.run.app
```

📝 **このURLをメモしてください**（管理画面へのアクセスに使用）

### 8.3 CORS設定の更新

1. Cloud Shell に戻る

2. バックエンドの環境変数を更新（⚠️ **1箇所変更が必要**）：

```bash
gcloud run services update homecare-bot \
  --region asia-northeast1 \
  --set-env-vars "ADMIN_UI_URL=《8.2でメモしたフロントエンドURL》"
```

**例**: フロントエンドURLが `https://homecare-admin-abc123-an.a.run.app` の場合：
```bash
gcloud run services update homecare-bot \
  --region asia-northeast1 \
  --set-env-vars "ADMIN_UI_URL=https://homecare-admin-abc123-an.a.run.app"
```

---

## 9. 初期設定の実行

### 9.1 管理画面へのアクセス

1. ブラウザで **8.2でメモしたフロントエンドURL** を開く

   **例**: `https://homecare-admin-abc123-an.a.run.app`

2. ログイン画面が表示されます

### 9.2 初回ログイン

1. **デモモードで開始** をクリック（初回セットアップ時）

   または

2. Firebase Authentication で設定した方法でログイン

### 9.3 セットアップウィザードの実行

1. ログイン後、**セットアップ** 画面が表示されます

2. **Step 1: 組織情報**
   - 組織名を入力
   - 管理者メールアドレスを入力
   - **次へ** をクリック

3. **Step 2: Slack連携**
   - Bot Token を入力（`xoxb-...`）
   - **接続テスト** をクリック
   - 「接続成功」と表示されることを確認
   - **次へ** をクリック

4. **Step 3: API設定**
   - Gemini API Key を入力
   - **保存** をクリック

5. **セットアップ完了** と表示されれば成功

### 9.4 事業所・地区の登録

1. 左側メニューから **設定** > **マスタ管理** を選択

2. **事業所** セクション：
   - **追加** をクリック
   - 事業所名と住所を入力
   - **追加** をクリック

3. **地区** セクション：
   - **追加** をクリック
   - 地区名を入力
   - **追加** をクリック

---

## 10. 動作確認

### 10.1 患者登録テスト

1. 管理画面で **患者一覧** を選択

2. **患者を登録** をクリック

3. テスト患者の情報を入力：
   - 患者ID: `TEST001`
   - 氏名: `テスト 太郎`
   - 事業所: 登録した事業所を選択
   - 地区: 登録した地区を選択

4. **登録** をクリック

5. Slack で新しいチャンネル（例：`#patient-test001`）が作成されることを確認

### 10.2 Slack連携テスト

1. Slack で作成された患者チャンネルを開く

2. Bot のアンカーメッセージ（📋 患者情報）を確認

3. アンカーメッセージにリプライを送信：
   ```
   今日の訪問で血圧 140/90、食欲あり。
   ご家族から「最近眠れていない様子」との報告あり。
   ```

4. Bot からの応答を確認：
   - BPS構造化された確認メッセージが返ってくることを確認

### 10.3 アラート確認

1. 管理画面で **アラート** を選択

2. テスト報告に基づくアラートが表示されていることを確認

---

## 11. トラブルシューティング

### 11.1 よくある問題と解決方法

#### Slack接続テストが失敗する

**症状**: 「接続に失敗しました」エラー

**解決方法**:
1. Bot Token が正しいか確認（`xoxb-` で始まる）
2. Slack アプリがワークスペースにインストールされているか確認
3. 必要なスコープがすべて追加されているか確認

#### 管理画面が表示されない

**症状**: 「このサイトにアクセスできません」エラー

**解決方法**:
1. Cloud Run サービスのステータスを確認
   ```bash
   gcloud run services describe homecare-admin --region asia-northeast1
   ```
2. サービスが Running 状態か確認
3. URLが正しいか確認

#### Bot が Slack メッセージに反応しない

**症状**: Slack でメッセージを送ってもBotが応答しない

**解決方法**:
1. Event Subscriptions の Request URL が正しいか確認
2. Request URL が「Verified」になっているか確認
3. Cloud Run のログを確認：
   ```bash
   gcloud run logs read homecare-bot --region asia-northeast1 --limit 50
   ```

#### Firestore のデータが保存されない

**症状**: 患者登録してもデータが見つからない

**解決方法**:
1. Firebase Console で Firestore を確認
2. セキュリティルールを確認
3. Cloud Run サービスアカウントに Firestore アクセス権限があるか確認

### 11.2 ログの確認方法

#### Cloud Run ログ

```bash
# バックエンドのログ
gcloud run logs read homecare-bot --region asia-northeast1 --limit 100

# フロントエンドのログ
gcloud run logs read homecare-admin --region asia-northeast1 --limit 100
```

#### ブラウザの開発者ツール

1. 管理画面で右クリック > **検証** を選択
2. **Console** タブでエラーを確認
3. **Network** タブでAPI通信を確認

### 11.3 サポートへの連絡

問題が解決しない場合は、以下の情報を添えてサポートにご連絡ください：

- エラーメッセージのスクリーンショット
- 発生日時
- 実行した操作の手順
- Cloud Run のログ（上記コマンドで取得）

---

## 付録

### A. 用語集

| 用語 | 説明 |
|------|------|
| Cloud Run | Google Cloud のサーバーレス実行環境 |
| Firestore | Google Cloud の NoSQL データベース |
| Bot Token | Slack Bot がAPIを使うための認証トークン |
| Signing Secret | Slack からのリクエストを検証するための秘密鍵 |
| BPS | Bio-Psycho-Social（生物心理社会モデル） |

### B. 設定情報チェックリスト

セットアップ完了後、以下の情報を安全な場所に保管してください：

- [ ] Google Cloud プロジェクトID
- [ ] Firebase 設定情報（apiKey, authDomain, projectId）
- [ ] Slack Bot Token
- [ ] Slack Signing Secret
- [ ] Gemini API Key
- [ ] バックエンドURL (homecare-bot)
- [ ] フロントエンドURL (homecare-admin)

### C. 定期メンテナンス

#### 月次確認項目

- [ ] Google Cloud の請求額を確認
- [ ] Cloud Run のエラー率を確認
- [ ] Slack アプリの動作確認
- [ ] Firestore のデータ容量を確認

#### セキュリティ更新

- API キーの定期ローテーション（6ヶ月ごと推奨）
- Slack Bot Token の更新（必要に応じて）
- Firebase セキュリティルールの見直し

---

**ドキュメント作成**: HomeCare AI 開発チーム
**お問い合わせ**: support@example.com

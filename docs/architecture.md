# アーキテクチャ設計書

## 1. 全体構成

```
┌─────────────────────────────────────────────────────────────────────┐
│  エンドユーザー層                                                    │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐ │
│  │  Slack Workspace  │  │  Web Admin UI (React on Cloud Run)      │ │
│  │  - #oncall-night  │  │  - ログイン (Firebase Auth)              │ │
│  │  - #pt-{患者名}   │  │  - ダッシュボード・患者管理               │ │
│  │  - Bot対話        │  │  - ナレッジベース・API設定                │ │
│  └───────┬──────────┘  └────────────────┬─────────────────────────┘ │
│          │ Events API                    │ REST API                  │
├──────────┼───────────────────────────────┼──────────────────────────┤
│  処理層  │                               │                          │
│  ┌───────▼───────────────────────────────▼────────────────────────┐ │
│  │  Cloud Run: homecare-bot              Cloud Run: homecare-admin │ │
│  │  ┌─────────────────────┐              ┌──────────────────────┐ │ │
│  │  │ ADK Root Agent      │              │ FastAPI REST API     │ │ │
│  │  │ ├ Intake Agent      │              │ ├ /api/patients      │ │ │
│  │  │ ├ Context Agent ◄───┼── RAG ───────┤ ├ /api/setup         │ │ │
│  │  │ ├ Alert Agent       │              │ ├ /api/knowledge     │ │ │
│  │  │ └ Summary Agent     │              │ ├ /api/settings      │ │ │
│  │  └─────────┬───────────┘              │ └ /api/export        │ │ │
│  │            │                          └──────────┬───────────┘ │ │
│  └────────────┼─────────────────────────────────────┼─────────────┘ │
│               │                                     │               │
├───────────────┼─────────────────────────────────────┼───────────────┤
│  データ層     │                                     │               │
│  ┌────────────▼─────────────────────────────────────▼─────────────┐ │
│  │  Cloud Firestore           │  Vertex AI Vector Search          │ │
│  │  - organizations/          │  - RAGナレッジベースIndex          │ │
│  │  - patients/               │  - text-embedding-005             │ │
│  │  - reports/                │                                   │ │
│  │  - alerts/                 │  Cloud Storage (GCS)              │ │
│  │  - knowledge_documents/    │  - PDF/画像/音声 生データ          │ │
│  │                            │  - ナレッジPDFファイル              │ │
│  │  Secret Manager            │                                   │ │
│  │  - Slack Token             │  Cloud Scheduler                  │ │
│  │  - Gemini API Key          │  - 朝8時定時タスク                 │ │
│  │  - Service Account Key     │                                   │ │
│  └────────────────────────────┴───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 技術スタック

| レイヤー | 技術 | 用途 | バージョン |
|---------|------|------|-----------|
| AIエージェント | ADK | マルチエージェントオーケストレーション | latest |
| LLM | Gemini API | BPS構造化・臨床推論・サマリー生成 | **gemini-3.0-flash** |
| Embedding | text-embedding-005 | RAGナレッジベースのベクトル化 | - |
| ベクトル検索 | Vertex AI Vector Search | RAG検索 | - |
| データベース | Cloud Firestore | 患者・報告・アラート・設定の永続化 | - |
| ファイルストレージ | Cloud Storage | PDF/画像/音声/ナレッジファイル | - |
| アプリ実行 | Cloud Run | Bot + Admin UIのホスティング | gen2 |
| 定時タスク | Cloud Scheduler | 朝8時スキャン | - |
| 認証 | Firebase Authentication | Admin UIアクセス制御 | - |
| シークレット | Secret Manager | APIキー暗号化保存 | - |
| バックエンド | Python + FastAPI | REST API + Slack Events | 3.12 |
| フロントエンド | **Next.js + TypeScript + Tailwind** | Admin UI（App Router, Server Components） | **Next.js 16, React 19** |
| 外部連携 | Slack Web API + Events API | 多職種インターフェース | - |

> **技術選定の詳細**:
> - Gemini 3.0 Flash: [gemini-3-flash-best-practices.md](./gemini-3-flash-best-practices.md)
> - Next.js 16: [nextjs-16-best-practices.md](./nextjs-16-best-practices.md)

## 3. Cloud Run サービス設計

### 3.1 homecare-bot

Slack Events APIの受信とADKエージェントの実行を担当。

| 項目 | 設定 |
|------|------|
| ランタイム | Python 3.12 |
| フレームワーク | FastAPI |
| メモリ | 1GiB |
| CPU | 1 |
| 最大インスタンス | 10 |
| 最小インスタンス | 0（MVP）/ 1（本番推奨） |
| リージョン | asia-northeast1 |
| 認証 | なし（Slack署名検証で保護） |

**エンドポイント:**

| パス | メソッド | 用途 |
|------|---------|------|
| `/slack/events` | POST | Slack Events API受信 |
| `/cron/morning-scan` | POST | Cloud Scheduler朝8時トリガー |
| `/health` | GET | ヘルスチェック |

### 3.2 homecare-admin

Admin UI（Next.js 16 App Router）の配信を担当。Server ComponentsとServer Actionsを活用。

| 項目 | 設定 |
|------|------|
| ランタイム | Node.js 20（Next.js standalone） |
| フレームワーク | Next.js 16（App Router, Server Components） |
| メモリ | 1GiB |
| CPU | 1 |
| 最大インスタンス | 5 |
| リージョン | asia-northeast1 |
| 認証 | Firebase Authentication |

**エンドポイント:**
- `/` — Admin UI（SSR + クライアントナビゲーション）
- Server Actionsによるバックエンド連携（homecare-bot APIを呼び出し）

**Next.js 16の主要機能:**
- Cache Components（`"use cache"`ディレクティブ）
- Partial Pre-Rendering（PPR）
- Server Actions（フォーム処理）
- Turbopack（高速ビルド）

## 4. セキュリティ設計

### 4.1 認証・認可

| 対象 | 方式 |
|------|------|
| Admin UI | Firebase Authentication（メール+パスワード / Google Sign-In） |
| REST API | Firebase ID Token検証（Authorizationヘッダー） |
| Slack Bot | Slack Signing Secret署名検証 |
| Cloud Scheduler → Bot | OIDC Token検証 |
| GCPサービス間 | サービスアカウント + IAM |

### 4.2 シークレット管理

全APIキー・トークンはSecret Managerに保存。

| シークレット名 | 内容 | アクセス元 |
|--------------|------|-----------|
| `slack-bot-token` | Slack Bot User OAuth Token | homecare-bot |
| `slack-signing-secret` | Slack Signing Secret | homecare-bot |
| `gemini-api-key` | Gemini API Key | homecare-bot |
| `vertex-sa-key` | Vertex AIサービスアカウントキー | homecare-bot, homecare-admin |

- Firestoreにはシークレットのリソース参照ID（`projects/xxx/secrets/yyy/versions/latest`）のみ保持
- ブラウザ側（localStorage/sessionStorage）には一切保持しない
- リクエストごとにSecret Managerから取得、使用後に即破棄

### 4.3 データアクセス制御

- Firestoreセキュリティルール: ユーザーは自組織の`org_id`に紐づくデータのみアクセス可能
- GCSバケット: 公開アクセス無効、サービスアカウント経由のみ
- Cloud Audit Logs: 全データアクセスを記録

## 5. デプロイ構成

```
GitHub (main branch)
  │
  ├─ backend/ ──→ Cloud Build ──→ Cloud Run: homecare-bot
  │
  ├─ frontend/ ─→ Cloud Build ──→ Cloud Run: homecare-admin
  │                (npm build → 静的ファイル + FastAPI)
  │
  └─ terraform/ ─→ GCPリソースプロビジョニング（任意）
```

### 5.1 GCPリソース一覧

| リソース | 名前 | 用途 |
|---------|------|------|
| Cloud Run | homecare-bot | Slack Bot + ADKエージェント |
| Cloud Run | homecare-admin | Admin UI + REST API |
| Firestore | (default) | アプリケーションデータ |
| GCS Bucket | homecare-ai-files | 生ファイルストレージ |
| GCS Bucket | homecare-ai-knowledge | ナレッジベースファイル |
| Vertex AI Vector Search Index | homecare-rag-index | RAGベクトルインデックス |
| Vertex AI Vector Search Endpoint | homecare-rag-endpoint | RAG検索エンドポイント |
| Cloud Scheduler Job | morning-scan | 朝8時定時タスク |
| Secret Manager | slack-bot-token, etc. | シークレット |
| Firebase Auth | - | ユーザー認証 |

## 6. データフロー定義

### 6.1 初期セットアップフロー

```
事務スタッフ → Admin UI セットアップウィザード
  ├─ Step 1: Slack App作成（手動・ガイド付き）
  ├─ Step 2: トークン入力 → POST /api/setup/tokens → Secret Manager保存
  ├─ Step 3: 接続テスト → POST /api/setup/test → Slack auth.test API
  └─ Step 4: 自動初期設定 → POST /api/setup/initialize
      ├→ Firestore organizations/{org_id} 作成
      ├→ Slack conversations.create (#oncall-night)
      └→ Slack conversations.join
```

### 6.2 患者登録フロー

```
事務スタッフ → Admin UI 患者登録フォーム → POST /api/patients
  ├─ 1. Firestore patients/{id} 作成
  ├─ 2. Slack conversations.create (#pt-{患者名})
  ├─ 3. Firestore patients/{id}.slack_channel_id 更新
  ├─ 4. Slack conversations.join
  ├─ 5. Slack chat.postMessage (アンカーメッセージ)
  ├─ 6. Firestore patients/{id}.slack_anchor_message_ts 更新
  ├─ 7. Slack conversations.invite × N
  └─ 8. Slack conversations.setTopic
```

### 6.3 報告入力フロー

```
多職種 → Slack #pt-{患者名} Botリプライ
  → POST /slack/events (Events API)
  → 署名検証
  → ADK Root Agent → Intake Agent
    ├─ テキスト → Gemini BPS構造化
    ├─ PDF → テキスト抽出 → BPS構造化
    └─ 画像 → Gemini Vision → BPS構造化
      ├→ Firestore reports/{id} 保存
      ├→ Context更新 (patients/{id}/context)
      ├→ Alert Agent → 過去7日間比較
      │   └─ [閾値超過] → Slack アラート投稿 + Firestore alerts/ 保存
      └→ Slack スレッドに確認応答
```

### 6.4 RAG検索フロー

```
エージェント処理中 → RAG検索要求
  ├─ クエリをtext-embedding-005でベクトル化
  ├─ Vertex AI Vector Searchで類似チャンク検索
  ├─ エージェントのカテゴリバインドでフィルタ
  ├─ Top-Kチャンクを取得
  └→ Geminiプロンプトのコンテキストとして注入
```

### 6.5 定時スキャンフロー

```
Cloud Scheduler (毎朝8:00 JST) → POST /cron/morning-scan
  → Alert Agent
    ├─ Firestore 全patients スキャン
    ├─ 各患者の過去24h reports 分析
    ├─ 緊急度スコアリング (HIGH/MEDIUM/LOW)
    └→ Slack #oncall-night にレポート投稿
```

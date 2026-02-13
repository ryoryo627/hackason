# アーキテクチャ設計書

> 関連: [データモデル設計書](data-model.md)（Firestoreスキーマ詳細）| [AIエージェント設計書](agent-design.md)（エージェント構成・RAG設計）| [API設計書](api-design.md)（エンドポイント仕様）

## 1. 全体構成

```
┌─────────────────────────────────────────────────────────────────────┐
│  エンドユーザー層                                                    │
│  ┌──────────────────┐  ┌──────────────────────────────────────────┐ │
│  │  Slack Workspace  │  │  Web Admin UI (Next.js on Cloud Run)    │ │
│  │  - #oncall-night  │  │  - ログイン (Firebase Auth)              │ │
│  │  - #pt-{患者名}   │  │  - ダッシュボード・患者管理               │ │
│  │  - Bot対話        │  │  - ナレッジベース・API設定                │ │
│  └───────┬──────────┘  └────────────────┬─────────────────────────┘ │
│          │ Events API                    │ REST API (SWR)           │
├──────────┼───────────────────────────────┼──────────────────────────┤
│  処理層  │                               │                          │
│  ┌───────▼───────────────────────────────▼────────────────────────┐ │
│  │  Cloud Run: homecare-bot（FastAPI + google-genai SDK）            │ │
│  │  ┌─────────────────────┐  ┌──────────────────────────────────┐ │ │
│  │  │ Root Agent           │  │ FastAPI REST API                 │ │ │
│  │  │ ├ Intake Agent      │  │ ├ /api/dashboard  (統計・フィード)│ │ │
│  │  │ ├ Context Agent ◄───┤  │ ├ /api/patients   (CRUD+Slack)  │ │ │
│  │  │ ├ Alert Agent       │  │ ├ /api/alerts     (管理・統計)   │ │ │
│  │  │ └ Summary Agent     │  │ ├ /api/setup      (初期設定)     │ │ │
│  │  │ (BaseAgent共通基底) │  │ ├ /api/settings   (設定・マスタ) │ │ │
│  │  └─────────┬───────────┘  │ └ /api/knowledge  (RAG CRUD)    │ │ │
│  │            │              └──────────────────────┬───────────┘ │ │
│  └────────────┼─────────────────────────────────────┼─────────────┘ │
│               │                                     │               │
│  ┌────────────┴─────────────────────────────────────┘               │
│  │  Cloud Run: homecare-admin（Next.js 16.1.6 SSR）                 │
│  │  └ Admin UI配信のみ（API呼び出しはhomecare-botへ）               │
│  └──────────────────────────────────────────────────────────────────│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│  データ層                                                           │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Cloud Firestore           │  RAG Knowledge Base              │   │
│  │  - organizations/          │  - gemini-embedding-001 (768次元)  │   │
│  │  - patients/               │  - Firestore + cosine similarity │   │
│  │  - reports/ (sub)          │                                 │   │
│  │  - alerts/ (sub)           │                                 │   │
│  │  - knowledge_documents/    │  Cloud Storage (GCS)            │   │
│  │  - service_configs/        │  - PDF/画像/音声 生データ        │   │
│  │    (APIキー・トークン一元管理)│  - ナレッジPDFファイル          │   │
│  │  - users/                  │                                 │   │
│  │                            │  Cloud Scheduler                │   │
│  │                            │  - 朝8時定時タスク               │   │
│  └────────────────────────────┴─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. 技術スタック

| レイヤー | 技術 | 用途 | バージョン |
|---------|------|------|-----------|
| AIエージェント | google-genai SDK | カスタムマルチエージェント | latest |
| LLM | Gemini API | BPS構造化・臨床推論・サマリー生成 | **gemini-3-flash-preview** |
| Embedding | gemini-embedding-001 | RAGナレッジベースのベクトル化 | - |
| ベクトル検索 | Firestore + cosine similarity | RAG Embedding検索 | — |
| データベース | Cloud Firestore | 患者・報告・アラート・設定の永続化 | - |
| 設定管理 | Firestore service_configs | APIキー・トークンの一元管理 | - |
| ファイルストレージ | Cloud Storage | PDF/画像/音声/ナレッジファイル | - |
| アプリ実行 | Cloud Run | Bot + Admin UIのホスティング | gen2 |
| 定時タスク | Cloud Scheduler | 朝8時スキャン | - |
| 認証 | Firebase Authentication | Admin UIアクセス制御 | v11.0 |
| バックエンド | Python + FastAPI | REST API + Slack Events + google-genai SDK | 3.12 |
| フロントエンド | **Next.js + TypeScript + Tailwind CSS** | Admin UI | **Next.js 16.1.6, React 19.2.3, Tailwind 4** |
| データフェッチ | SWR | クライアントサイドデータキャッシュ | 2.4.0 |
| 外部連携 | Slack Web API + Events API | 多職種インターフェース | - |

> **技術選定の詳細**: Gemini 3 Flash Preview（エージェント用LLM）、Next.js 16（Admin UIフレームワーク）

## 3. Cloud Run サービス設計

### 3.1 homecare-bot

Slack Events APIの受信、AIエージェントの実行、REST APIの配信を担当。

| 項目 | 設定 |
|------|------|
| ランタイム | Python 3.12 |
| フレームワーク | FastAPI |
| メモリ | 1GiB |
| CPU | 1 |
| 最大インスタンス | 10 |
| 最小インスタンス | 0 / 1 |
| リージョン | asia-northeast1 |
| 認証 | Firebase ID Token + Slack署名検証 |

**エンドポイント:**

| パス | メソッド | 用途 |
|------|---------|------|
| `/slack/events` | POST | Slack Events API受信 |
| `/cron/morning-scan` | POST | Cloud Scheduler朝8時トリガー |
| `/health` | GET | ヘルスチェック |
| `/api/dashboard/*` | GET | ダッシュボード統計・フィード |
| `/api/patients/*` | GET/POST/PUT/DELETE | 患者CRUD・Slack連携・バルク操作 |
| `/api/alerts/*` | GET/POST | アラート管理・統計 |
| `/api/setup/*` | GET/POST | セットアップ・ユーザー・設定保存 |
| `/api/settings/*` | GET/POST/PUT/DELETE | サービス設定・マスタ管理・エージェント設定 |
| `/api/knowledge/*` | GET/POST/PUT/DELETE | ナレッジベースCRUD・検索 |
| `/api/users/*` | GET/POST/PUT/DELETE | ユーザー管理・ロール設定 |

### 3.2 homecare-admin

Admin UIの配信を担当。SWRでhomecare-botのREST APIからデータ取得。

| 項目 | 設定 |
|------|------|
| ランタイム | Node.js 20（Next.js standalone） |
| フレームワーク | Next.js 16.1.6 |
| メモリ | 1GiB |
| CPU | 1 |
| 最大インスタンス | 5 |
| リージョン | asia-northeast1 |
| 認証 | Firebase Authentication |

**エンドポイント:**
- `/` — Admin UI（SSR + クライアントナビゲーション）
- SWR + REST APIクライアントでhomecare-botのAPIを呼び出し

**フロントエンド技術:**
- Next.js 16.1.6 App Router + React 19.2.3 + Tailwind CSS 4
- SWR 2.4.0 — SWRConfig Providerでグローバル設定を一元化、全データフェッチフックをSWR統一
- useDebounceフック — 検索入力のデバウンス処理
- App Router `error.tsx` / `loading.tsx` — エラーバウンダリとスケルトンUI
- Firebase Auth 11.0
- Turbopack

## 4. セキュリティ設計

### 4.1 認証・認可

| 対象 | 方式 |
|------|------|
| Admin UI | Firebase Authentication |
| REST API | Firebase ID Token検証（Authorizationヘッダー） |
| Slack Bot | Slack Signing Secret署名検証 |
| Cloud Scheduler → Bot | OIDC Token検証 |
| GCPサービス間 | サービスアカウント + IAM |

### 4.2 設定管理（Firestore service_configs）

全APIキー・トークンはFirestoreの`service_configs`コレクションに組織単位で保存。

| ドキュメントID | 内容 | アクセス元 |
|---------------|------|-----------|
| `{org_id}_slack` | Bot Token, Signing Secret, ワークスペース情報 | homecare-bot |
| `{org_id}_gemini` | Gemini API Key, モデル名 | homecare-bot |
| `{org_id}_vertex` | Project ID, Region, Embedding Model | homecare-bot |
| `{org_id}_agent_prompts` | 共通/エージェント別カスタムプロンプト | homecare-bot |

- ブラウザ側（localStorage/sessionStorage）には一切保持しない
- 各APIリクエスト処理時にFirestoreから取得して使用

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
| Cloud Run | homecare-bot | Slack Bot + AIエージェント |
| Cloud Run | homecare-admin | Admin UI |
| Firestore | (default) | アプリケーションデータ |
| GCS Bucket | (バケット名) | 生ファイルストレージ |
| GCS Bucket | (バケット名) | ナレッジベースファイル |
| — | — | ※ベクトル検索はFirestore + numpy cosine similarityで実装（将来Vertex AI Vector Search移行予定） |
| Cloud Scheduler Job | morning-scan | 朝8時定時タスク |
| Firestore service_configs | {org_id}_slack, etc. | APIキー・トークン管理 |
| Firebase Auth | - | ユーザー認証 |

## 5.2 ランタイム最適化

| 最適化 | 設定 | 用途 |
|--------|------|------|
| エージェントキャッシュ | TTL 600秒 | 同一組織の連続リクエストでエージェント再初期化を回避 |
| イベント重複排除 | LRU 5000件 | Slack Events APIのリトライによる重複処理を防止 |
| 同時処理制限 | セマフォ = 3 | Gemini APIへの同時リクエスト数を制限し、レート制限を回避 |

## 6. データフロー定義

### 6.1 初期セットアップフロー

```
事務スタッフ → Admin UI セットアップウィザード
  ├─ Step 1: Slack App作成（手動・ガイド付き）
  ├─ Step 2: トークン入力 → POST /api/setup/configure → Firestore service_configs保存
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
  → Root Agent → Intake Agent
    ├─ テキスト → Gemini BPS構造化
    ├─ PDF → テキスト抽出 → BPS構造化
    └─ 画像 → Gemini Vision → BPS構造化
      ├→ Firestore reports/{id} 保存
      ├→ Context更新 (patients/{id}/context)
      ├→ Alert Agent → 過去7日間比較
      │   └─ [閾値超過] → Slack アラート投稿 + Firestore alerts/ 保存
      ├→ [アラート生成時] → RiskService.recalculate() → リスクレベル自動更新 + risk_history記録
      └→ Slack スレッドに確認応答
```

### 6.4 RAG検索フロー

```
エージェント処理中 → RAG検索要求
  ├─ クエリをgemini-embedding-001でベクトル化
  ├─ Firestoreから対象チャンクを取得（カテゴリバインドでフィルタ）
  ├─ numpy cosine similarityで類似度計算
  ├─ Top-Kチャンクを返却
  └→ Geminiプロンプトのコンテキストとして注入
```

### 6.5 定時スキャンフロー

```
Cloud Scheduler (毎朝8:00 JST) → POST /cron/morning-scan
  → Alert Agent
    ├─ Firestore 全patients スキャン
    ├─ 各患者の過去24h reports 分析
    ├─ 緊急度スコアリング (HIGH/MEDIUM/LOW)
    ├─ RiskService.recalculate() → 各患者のリスクレベル自動再計算
    └→ Slack #oncall-night にレポート投稿
```

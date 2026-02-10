# CLAUDE.md — Claude Code 開発引き継ぎ指示書

> ⚠️ **自動メモリ（MEMORY.md）に作業前チェックリストあり。システムプロンプトに含まれているので確認済みのはず。**

## Claude Code 作業ルール（必須・違反厳禁）

**作業開始前に必ず実行（スキップ禁止）：**

1. ✅ **このCLAUDE.mdを読んだ**
2. ✅ **Serenaメモリを確認した**: `mcp__serena__list_memories()` → 関連メモリを `read_memory()`
3. ✅ **過去の決定事項を把握した**

**作業中のルール：**
- 仕様変更・設計決定は **即座に** CLAUDE.md または Serenaメモリに保存
- 「後で保存」は禁止（忘れるため）

## デプロイ方法

**ローカルMacから直接デプロイ（Cloud Shell不使用）**

> **gcloud CLIパス**: `/Users/kyoku/google-cloud-sdk/bin/gcloud`（PATHに入っていないため絶対パスを使用すること）

```bash
GCLOUD=/Users/kyoku/google-cloud-sdk/bin/gcloud

# フロントエンド
cd frontend && $GCLOUD builds submit --config=cloudbuild.yaml --project=aihomecare-486506

# バックエンド
cd backend && $GCLOUD run deploy homecare-bot --source=. --region=asia-northeast1 --project=aihomecare-486506

# Cloud Scheduler 朝8時定時スキャン（初回のみ）
$GCLOUD scheduler jobs create http morning-scan \
  --location=asia-northeast1 \
  --schedule="0 8 * * *" \
  --time-zone="Asia/Tokyo" \
  --uri="https://homecare-bot-xxx.run.app/cron/morning-scan" \
  --http-method=POST \
  --headers="Content-Type=application/json,X-Cron-Secret=YOUR_SECRET" \
  --body='{"org_id":"demo-org-001"}' \
  --project=aihomecare-486506
```

**GCPプロジェクト情報:**
- Project ID: `aihomecare-486506`
- Region: `asia-northeast1`
- Frontend Service: `homecare-admin`
- Backend Service: `homecare-bot`

## プロジェクト概要

**HomeCare AI Agent** — 在宅医療支援AIエージェントシステム

Slackを患者ごとの情報集約ハブとし、Google Cloud上のAIエージェント群（ADK）が多職種からの報告をBio-Psycho-Social（BPS）フレームワークで構造化・蓄積・分析するシステム。GCP AI Hackathon Vol.4 提出用。

## ドキュメント一覧

| ファイル | 内容 | 読む順序 |
|---------|------|---------|
| `docs/requirements.md` | 要件定義書v3（全体像・ユースケース・スコープ） | 1 |
| `docs/architecture.md` | アーキテクチャ設計書（技術スタック・サービス構成・データフロー） | 2 |
| `docs/data-model.md` | Firestoreデータモデル設計書（コレクション・スキーマ・インデックス） | 3 |
| `docs/api-design.md` | REST API設計書（全エンドポイント定義） | 4 |
| `docs/agent-design.md` | AIエージェント＋RAGナレッジベース設計書 | 5 |
| `docs/slack-bot-design.md` | Slack Bot仕様書（Events API・インタラクション・メッセージフォーマット） | 6 |
| `docs/ui-ux-design.md` | UI/UX設計書（画面遷移・全14画面仕様・レイアウトパターン） | 7 |

## 技術スタック

- **言語**: Python 3.12（バックエンド）、TypeScript（フロントエンド）
- **AIフレームワーク**: ADK (Agent Development Kit)
- **LLM**: Gemini API (**gemini-3-flash-preview**)
- **データベース**: Cloud Firestore
- **ベクトル検索**: Firestore + text-embedding-005 + cosine similarity（✅ RAG全パイプライン実装済み）
- **ファイルストレージ**: Cloud Storage (GCS)
- **実行環境**: Cloud Run（2サービス）
- **定時タスク**: Cloud Scheduler
- **設定管理**: Firestore `service_configs`コレクション（APIキー・トークンをFirestoreに一元管理）
- **認証**: Firebase Authentication
- **外部連携**: Slack Bot (Events API + Web API)
- **フロントエンド**: **Next.js 16.1.6** + Tailwind CSS 4（App Router, Client Components中心, React 19.2.3）
- **データフェッチ**: SWR 2.4.0（クライアントサイドデータキャッシュ）

> **ベストプラクティス参照**:
> - `docs/gemini-3-flash-best-practices.md` — Gemini 3.0 Flash API実装ガイド
> - `docs/nextjs-16-best-practices.md` — Next.js 16実装ガイド

## Cloud Run サービス構成

| サービス名 | 役割 | 主要エンドポイント |
|-----------|------|-------------------|
| `homecare-bot` | Slack Events受信 + ADKエージェント実行 + REST API + Cronハンドラ | `/slack/events`, `/api/*`, `/cron/morning-scan` |
| `homecare-admin` | Admin UI配信（Next.js SSR） | `/` (SPA) |

## ディレクトリ構成（実装済み）

```
homecare-ai/
├── CLAUDE.md                    # この文書
├── README.md                    # プロジェクトREADME
├── docs/                        # 設計ドキュメント
│   ├── requirements.md
│   ├── architecture.md
│   ├── data-model.md
│   ├── api-design.md
│   ├── agent-design.md
│   ├── slack-bot-design.md
│   ├── ui-ux-design.md
│   ├── gemini-3-flash-best-practices.md
│   └── nextjs-16-best-practices.md
│
├── backend/                     # Python バックエンド（Cloud Run: homecare-bot）
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── main.py                  # FastAPI エントリポイント + Slack Events + Cronハンドラ
│   ├── config.py                # 環境変数・Firestore設定読み込み
│   ├── agents/                  # ADK エージェント群
│   │   ├── base_agent.py        # 共通基底クラス（Gemini連携・プロンプト管理）
│   │   ├── root_agent.py        # オーケストレーター
│   │   ├── intake_agent.py      # テキスト→BPS構造化
│   │   ├── context_agent.py     # コンテキスト参照・BPS分析回答
│   │   ├── alert_agent.py       # 横断分析・異変パターン検知
│   │   └── summary_agent.py     # BPS経過サマリー生成
│   ├── slack/                   # Slack Bot処理
│   │   └── verify.py            # 署名検証
│   ├── api/                     # REST APIルーター（6ファイル）
│   │   ├── dashboard.py         # ダッシュボード統計・フィード
│   │   ├── patients.py          # 患者CRUD・Slack連携・バルク操作
│   │   ├── alerts.py            # アラート管理・統計
│   │   ├── setup.py             # セットアップ・ユーザー・設定保存
│   │   ├── settings.py          # サービス設定・マスタ管理・エージェント設定
│   │   └── knowledge.py         # ナレッジベースCRUD・検索
│   ├── services/                # ビジネスロジック（3ファイル）
│   │   ├── firestore_service.py # Firestore CRUD操作
│   │   ├── slack_service.py     # Slack API操作
│   │   └── rag_service.py       # RAGパイプライン（抽出・チャンク・Embedding・検索）
│   └── models/                  # Pydanticモデル
│       ├── patient.py
│       ├── report.py
│       ├── alert.py
│       └── organization.py
│
├── frontend/                    # Next.js 16.1.6 フロントエンド（Cloud Run: homecare-admin）
│   ├── package.json
│   ├── next.config.ts
│   ├── cloudbuild.yaml
│   ├── Dockerfile
│   ├── app/                     # App Router（14ルート）
│   │   ├── layout.tsx           # ルートレイアウト
│   │   ├── page.tsx             # ダッシュボード
│   │   ├── dashboard-sections.tsx  # ダッシュボード各セクション
│   │   ├── login/
│   │   │   └── page.tsx         # ログイン画面
│   │   ├── setup/
│   │   │   └── page.tsx         # セットアップウィザード
│   │   ├── patients/
│   │   │   ├── page.tsx         # 患者一覧
│   │   │   ├── BulkAssignMembersModal.tsx  # 一括メンバー割当
│   │   │   ├── new/
│   │   │   │   └── page.tsx     # 患者新規登録（フルページ）
│   │   │   ├── import/
│   │   │   │   └── page.tsx     # CSVインポート
│   │   │   └── [id]/
│   │   │       ├── page.tsx     # 患者詳細
│   │   │       ├── GomonCard.tsx       # 御門カード
│   │   │       ├── ReferralCard.tsx    # 診療情報提供書
│   │   │       ├── ExportModal.tsx     # エクスポートモーダル
│   │   │       ├── DeletePatientModal.tsx  # 患者削除確認
│   │   │       └── edit/
│   │   │           └── page.tsx # 患者情報編集（フルページ）
│   │   ├── alerts/
│   │   │   └── page.tsx         # アラート一覧
│   │   ├── knowledge/
│   │   │   └── page.tsx         # ナレッジベース
│   │   └── settings/
│   │       ├── api/page.tsx     # API設定
│   │       ├── master/page.tsx  # マスタ管理
│   │       ├── organization/page.tsx  # 組織設定
│   │       └── agents/
│   │           └── page.tsx     # AIエージェント設定
│   ├── components/              # 共通コンポーネント
│   │   ├── ui/                  # 基本UI（15個）
│   │   │   ├── Alert.tsx, Badge.tsx, Button.tsx, Card.tsx
│   │   │   ├── EmptyState.tsx, FormField.tsx, Input.tsx
│   │   │   ├── Modal.tsx, Select.tsx, Skeleton.tsx
│   │   │   ├── Tabs.tsx, TagInput.tsx, Textarea.tsx, Toast.tsx
│   │   │   └── index.ts
│   │   └── layout/              # レイアウト（7個）
│   │       ├── AdminLayout.tsx, Header.tsx, Sidebar.tsx
│   │       ├── SidebarContext.tsx, NotificationDropdown.tsx
│   │       ├── SearchModal.tsx
│   │       └── index.ts
│   ├── hooks/                   # カスタムフック
│   │   ├── useAuth.ts           # Firebase認証フック
│   │   └── useApi.ts            # SWRベースAPIフック
│   └── lib/                     # ユーティリティ
│       ├── firebase.ts          # Firebase初期化
│       ├── api.ts               # REST APIクライアント（認証付き）
│       └── utils.ts             # ユーティリティ関数
│
└── scripts/                     # ユーティリティ
    ├── seed_demo_data.py        # デモデータ投入スクリプト
    ├── post_dummy_reports.py    # ダミー報告投稿スクリプト
    └── seed_knowledge_data.py   # デモ用ナレッジデータ投入
```

## 開発の優先順位

### Phase 1: 基盤構築 ✅ 完了
1. ✅ Firestoreデータモデル構築 + デモデータ投入（24名患者）
2. ✅ FastAPIバックエンド基本構造 + Cloud Run設定
3. ✅ Firebase Authentication + ログイン画面
4. ✅ Admin UIフレームワーク（サイドバー + ルーティング）

### Phase 2: 初期セットアップ＋患者登録 ✅ 完了
5. ✅ 初期セットアップウィザード（Slack App連携）
6. ✅ 患者登録フォーム + バックエンドAPI（Firestore書込→Slack自動チャンネル作成→Bot設定→招待）
7. ✅ API & サービス設定画面（Gemini API Key等の管理）

### Phase 3: Slack Bot＋AIエージェント ✅ 完了
8. ✅ Slack Events API受信 + 署名検証
9. ✅ Intake Agent（テキスト→BPS構造化→Firestore保存→確認応答）
10. ✅ Context Agent（@bot質問→コンテキスト参照→BPS分析回答）
11. ✅ Alert Agent（新規報告時の即時異変検知→Slack投稿）
12. ✅ Summary Agent（@botサマリー→BPS経過サマリー生成）

### Phase 4: ダッシュボード＋一覧＋詳細 ✅ 完了
13. ✅ ダッシュボード（統計・アラート・接続状態・最近の報告）
14. ✅ 患者一覧（検索・フィルタ・ソート・グループ表示）
15. ✅ 患者詳細（BPSサマリー・タイムライン・推奨事項・エクスポート）
16. ✅ アラート一覧・詳細

### Phase 5: RAG＋定時タスク＋仕上げ ✅ 完了
17. ✅ RAGナレッジベース（CRUD + Embedding検索完了 — Firestore + text-embedding-005 + cosine similarity）
18. ✅ Cloud Scheduler + 朝8時定時スキャン（エンドポイント + cron認証実装済み）
19. ✅ マスタ管理・組織設定画面
20. ✅ デモデータ整備 + デモ動画用シナリオ確認

## 重要な設計判断

### Slack連携の自動化
- **初期セットアップ**: Admin UIでSlack App作成ガイド→トークン入力→接続テスト→自動初期設定。Slackの管理画面を開くのは初回の1回だけ。
- **患者登録**: Admin UIで登録ボタン1つ押すだけで、Firestoreに書込→Slackチャンネル作成→Bot参加→アンカーメッセージ投稿→メンバー招待まで全自動。事務スタッフはSlackを一切開かない。

### Slackチャンネルの3モードインタラクション
1. **コンテキスト蓄積**: Botのアンカーメッセージにリプライ → Intake Agentが構造化 → Firestoreに保存
2. **カジュアルチャット**: チャンネルに直接投稿 → Botは無反応 → 保存しない
3. **AI相談**: `@bot`で質問 → Context/Summary Agentが回答 → 保存しない

### BPSフレームワーク
全エージェントがBio-Psycho-Socialの3軸で患者を評価。構造化データのJSON schemaは `docs/agent-design.md` を参照。

### RAGナレッジベース
- 8カテゴリ（BPSモデル、臨床推論、診療ガイドライン、在宅医療制度、緩和ケア、老年医学、薬剤管理、院内プロトコル）
- 各エージェントにどのカテゴリをバインドするかをAdmin UIで設定可能
- Embedding: text-embedding-005（768次元）、Vector Store: Firestore + cosine similarity（numpy）

### 設定管理（Firestore service_configs）
全APIキー・トークンはFirestoreの`service_configs`コレクションに組織単位で保存。ブラウザのlocalStorage/sessionStorageには一切保持しない。
- `{org_id}_slack` — Bot Token, Signing Secret, ワークスペース情報
- `{org_id}_gemini` — API Key, モデル名
- `{org_id}_vertex` — Project ID, Region, Embedding Model
- `{org_id}_agent_prompts` — 共通/エージェント別カスタムプロンプト

### フロントエンドデータフェッチ
SWR 2.4.0 + REST APIクライアントパターン。Server Actions不使用。
- `lib/api.ts` — Firebase ID Token付きfetchラッパー
- `hooks/useApi.ts` — SWRベースのカスタムフック群
- `hooks/useAuth.ts` — Firebase認証状態管理

## デモシナリオ（3分動画）

| シーン | 時間 | 内容 |
|--------|------|------|
| 1 | 0:00-0:25 | 課題提示（FAX/連絡ノートの問題） |
| 2 | 0:25-0:45 | セットアップウィザード + 患者登録1クリック |
| 3 | 0:45-1:15 | 看護師がSlackでリプライ → BPS構造化 |
| 4 | 1:15-1:45 | 薬剤師報告 → Alert Agent自動検知 |
| 5 | 1:45-2:10 | @bot サマリー → BPS経過サマリー |
| 6 | 2:10-2:40 | Admin UI（一覧フィルタ→詳細→エクスポート） |
| 7 | 2:40-3:00 | まとめ（差別化3点） |

## コマンド

```bash
# バックエンド開発
cd backend
pip install -e ".[dev]"
uvicorn main:app --reload --port 8080

# フロントエンド開発（Next.js 16）
cd frontend
npm install
npm run dev              # Turbopack（デフォルト）
npm run dev -- --webpack # Webpack使用時

# ビルド
npm run build            # 本番ビルド
npm run start            # 本番サーバー起動

# デモデータ投入
python scripts/seed_demo_data.py

# デプロイ
gcloud run deploy homecare-bot --source=backend/ --region=asia-northeast1
gcloud run deploy homecare-admin --source=frontend/ --region=asia-northeast1
```

## 環境変数

```bash
# backend（環境変数 — APIキーはFirestore service_configsから取得）
GOOGLE_CLOUD_PROJECT=aihomecare-486506
FIRESTORE_DATABASE_ID=(default)
GCS_BUCKET_NAME=homecare-ai-files
GCS_KNOWLEDGE_BUCKET=homecare-ai-knowledge
VERTEX_AI_REGION=asia-northeast1
ADMIN_UI_URL=https://homecare-admin-xxx.run.app
# ※ SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, GEMINI_API_KEY は
#   Firestore service_configs コレクションから組織単位で取得
```

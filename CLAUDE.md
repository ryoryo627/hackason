# CLAUDE.md — Claude Code 開発引き継ぎ指示書

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
- **LLM**: Gemini API (**gemini-3.0-flash**)
- **データベース**: Cloud Firestore
- **ベクトル検索**: Vertex AI Vector Search + text-embedding-005
- **ファイルストレージ**: Cloud Storage (GCS)
- **実行環境**: Cloud Run（2サービス）
- **定時タスク**: Cloud Scheduler
- **シークレット管理**: Secret Manager
- **認証**: Firebase Authentication
- **外部連携**: Slack Bot (Events API + Web API)
- **フロントエンド**: **Next.js 16** + Tailwind CSS（App Router, Server Components, React 19）

> **ベストプラクティス参照**:
> - `docs/gemini-3-flash-best-practices.md` — Gemini 3.0 Flash API実装ガイド
> - `docs/nextjs-16-best-practices.md` — Next.js 16実装ガイド

## Cloud Run サービス構成

| サービス名 | 役割 | 主要エンドポイント |
|-----------|------|-------------------|
| `homecare-bot` | Slack Events受信 + ADKエージェント実行 + Cronハンドラ | `/slack/events`, `/cron/morning-scan` |
| `homecare-admin` | Admin UI配信 + REST API | `/api/*`, `/` (SPA) |

## 推奨ディレクトリ構成

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
│   └── ui-ux-design.md
│
├── backend/                     # Python バックエンド（Cloud Run）
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── main.py                  # FastAPI エントリポイント
│   ├── config.py                # 環境変数・Secret Manager読み込み
│   ├── agents/                  # ADK エージェント群
│   │   ├── root_agent.py
│   │   ├── intake_agent.py
│   │   ├── context_agent.py
│   │   ├── alert_agent.py
│   │   └── summary_agent.py
│   ├── slack/                   # Slack Bot処理
│   │   ├── events.py            # Events APIハンドラ
│   │   ├── messages.py          # メッセージフォーマッタ
│   │   └── verify.py            # 署名検証
│   ├── api/                     # REST APIルーター
│   │   ├── patients.py
│   │   ├── setup.py
│   │   ├── knowledge.py
│   │   ├── settings.py
│   │   └── export.py
│   ├── services/                # ビジネスロジック
│   │   ├── patient_service.py
│   │   ├── slack_service.py
│   │   ├── firestore_service.py
│   │   └── rag_service.py
│   ├── models/                  # Pydanticモデル
│   │   ├── patient.py
│   │   ├── report.py
│   │   ├── alert.py
│   │   └── organization.py
│   └── cron/                    # 定時タスク
│       └── morning_scan.py
│
├── frontend/                    # Next.js 16 フロントエンド
│   ├── package.json
│   ├── next.config.ts
│   ├── proxy.ts                 # 認証ミドルウェア（旧middleware.ts）
│   ├── Dockerfile
│   ├── app/                     # App Router
│   │   ├── layout.tsx           # ルートレイアウト
│   │   ├── page.tsx             # ダッシュボード
│   │   ├── login/
│   │   │   └── page.tsx         # ログイン画面
│   │   ├── setup/
│   │   │   └── page.tsx         # セットアップウィザード
│   │   ├── patients/
│   │   │   ├── page.tsx         # 患者一覧
│   │   │   └── [id]/
│   │   │       └── page.tsx     # 患者詳細
│   │   ├── alerts/
│   │   │   └── page.tsx         # アラート一覧
│   │   ├── knowledge/
│   │   │   └── page.tsx         # ナレッジベース
│   │   ├── settings/
│   │   │   ├── api/page.tsx     # API設定
│   │   │   ├── master/page.tsx  # マスタ管理
│   │   │   └── organization/page.tsx  # 組織設定
│   │   └── actions/             # Server Actions
│   │       ├── auth.ts
│   │       ├── patients.ts
│   │       ├── alerts.ts
│   │       └── knowledge.ts
│   ├── components/              # 共通コンポーネント
│   │   ├── ui/                  # 基本UI（Button, Card, Modal等）
│   │   ├── layout/              # Sidebar, Header
│   │   └── features/            # 機能別コンポーネント
│   ├── lib/                     # ユーティリティ
│   │   ├── firebase.ts
│   │   ├── api.ts
│   │   └── utils.ts
│   ├── hooks/
│   └── types/
│
├── scripts/                     # ユーティリティ
│   ├── seed_demo_data.py        # デモデータ投入スクリプト
│   └── deploy.sh                # デプロイスクリプト
│
└── terraform/                   # GCPインフラ定義（任意）
    └── main.tf
```

## 開発の優先順位

### Phase 1: 基盤構築（最優先）
1. Firestoreデータモデル構築 + デモデータ投入（24名患者）
2. FastAPIバックエンド基本構造 + Cloud Run設定
3. Firebase Authentication + ログイン画面
4. Admin UIフレームワーク（サイドバー + ルーティング）

### Phase 2: 初期セットアップ＋患者登録
5. 初期セットアップウィザード（Slack App連携）
6. 患者登録フォーム + バックエンドAPI（Firestore書込→Slack自動チャンネル作成→Bot設定→招待）
7. API & サービス設定画面（Gemini API Key等の管理）

### Phase 3: Slack Bot＋AIエージェント
8. Slack Events API受信 + 署名検証
9. Intake Agent（テキスト→BPS構造化→Firestore保存→確認応答）
10. Context Agent（@bot質問→コンテキスト参照→BPS分析回答）
11. Alert Agent（新規報告時の即時異変検知→Slack投稿）
12. Summary Agent（@botサマリー→BPS経過サマリー生成）

### Phase 4: ダッシュボード＋一覧＋詳細
13. ダッシュボード（統計・アラート・接続状態・最近の報告）
14. 患者一覧（検索・フィルタ・ソート・グループ表示）
15. 患者詳細（BPSサマリー・タイムライン・推奨事項・エクスポート）
16. アラート一覧・詳細

### Phase 5: RAG＋定時タスク＋仕上げ
17. RAGナレッジベース（ドキュメント管理・チャンク・Embedding・検索テスト・エージェント連携）
18. Cloud Scheduler + 朝8時定時スキャン → #oncall-night投稿
19. マスタ管理・組織設定画面
20. デモデータ整備 + デモ動画用シナリオ確認

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
- Embedding: text-embedding-005、Vector Store: Vertex AI Vector Search

### Secret Manager
全APIキー・トークンはSecret Managerに暗号化保存。ブラウザのlocalStorage/sessionStorageには一切保持しない。Firestoreにはリソース参照IDのみ保持。

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
# backend
GOOGLE_CLOUD_PROJECT=homecare-ai-prod
GEMINI_API_KEY=             # or Secret Manager reference
SLACK_BOT_TOKEN=            # Secret Manager reference
SLACK_SIGNING_SECRET=       # Secret Manager reference
FIRESTORE_DATABASE_ID=(default)
GCS_BUCKET_NAME=homecare-ai-files
VERTEX_AI_REGION=asia-northeast1
ADMIN_UI_URL=https://homecare-admin-xxx.run.app
```

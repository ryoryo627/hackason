# DEVELOPMENT.md — 開発ガイド

## プロジェクト概要

**HomeCare AI Agent** — 在宅医療支援AIエージェントシステム

Slackを患者ごとの情報集約ハブとし、Google Cloud上のAIエージェント群（ADK）が多職種からの報告をBio-Psycho-Social（BPS）フレームワークで構造化・蓄積・分析するシステム。

## 技術スタック

- **言語**: Python 3.12（バックエンド）、TypeScript（フロントエンド）
- **AIフレームワーク**: ADK (Agent Development Kit)
- **LLM**: Gemini API (gemini-3-flash-preview)
- **データベース**: Cloud Firestore
- **ベクトル検索**: Firestore + gemini-embedding-001 + cosine similarity
- **ファイルストレージ**: Cloud Storage (GCS)
- **実行環境**: Cloud Run（2サービス）
- **定時タスク**: Cloud Scheduler
- **設定管理**: Firestore `service_configs` コレクション
- **認証**: Firebase Authentication
- **外部連携**: Slack Bot (Events API + Web API)
- **フロントエンド**: Next.js 16 + Tailwind CSS 4
- **データフェッチ**: SWR 2.4.0
- **エラー・ローディング**: App Router error.tsx + loading.tsx

## Cloud Run サービス構成

| サービス名 | 役割 | 主要エンドポイント |
|-----------|------|-------------------|
| `homecare-bot` | Slack Events受信 + ADKエージェント実行 + REST API + Cronハンドラ | `/slack/events`, `/api/*`, `/cron/morning-scan` |
| `homecare-admin` | Admin UI配信 | `/` (SPA) |

## ディレクトリ構成

```
hackason/
├── README.md                    # プロジェクトREADME
├── docs/                        # 設計ドキュメント
│   ├── requirements.md          # 要件定義書
│   ├── architecture.md          # アーキテクチャ設計書
│   ├── data-model.md            # Firestoreデータモデル
│   ├── api-design.md            # REST API設計書
│   ├── agent-design.md          # AIエージェント＋RAG設計書
│   ├── slack-bot-design.md      # Slack Bot仕様書
│   └── ui-ux-design.md          # UI/UX設計書
│
├── backend/                     # Python バックエンド（Cloud Run: homecare-bot）
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── main.py                  # FastAPI エントリポイント
│   ├── config.py                # 環境変数・Firestore設定読み込み
│   ├── agents/                  # ADK エージェント群
│   │   ├── base_agent.py        # 共通基底クラス
│   │   ├── root_agent.py        # オーケストレーター
│   │   ├── intake_agent.py      # テキスト→BPS構造化
│   │   ├── context_agent.py     # コンテキスト参照・BPS分析回答
│   │   ├── alert_agent.py       # 横断分析・異変パターン検知
│   │   └── summary_agent.py     # BPS経過サマリー生成
│   ├── slack/                   # Slack Bot処理
│   │   └── verify.py            # 署名検証
│   ├── api/                     # REST APIルーター
│   │   ├── dashboard.py         # ダッシュボード統計・フィード
│   │   ├── patients.py          # 患者CRUD・Slack連携
│   │   ├── alerts.py            # アラート管理・統計
│   │   ├── setup.py             # セットアップ・ユーザー・設定
│   │   ├── settings.py          # サービス設定・マスタ管理
│   │   └── knowledge.py         # ナレッジベースCRUD・検索
│   ├── services/                # ビジネスロジック
│   │   ├── firestore_service.py # Firestore CRUD操作
│   │   ├── slack_service.py     # Slack API操作
│   │   └── rag_service.py       # RAGパイプライン
│   └── models/                  # Pydanticモデル
│       ├── patient.py
│       ├── report.py
│       ├── alert.py
│       └── organization.py
│
└── frontend/                    # Next.js フロントエンド（Cloud Run: homecare-admin）
    ├── package.json
    ├── next.config.ts
    ├── Dockerfile
    ├── app/                     # App Router
    │   ├── layout.tsx           # ルートレイアウト（Providers含む）
    │   ├── providers.tsx        # SWRConfig グローバルプロバイダ
    │   ├── error.tsx            # ルートレベル エラーバウンダリ
    │   ├── page.tsx             # ダッシュボード
    │   ├── login/page.tsx       # ログイン画面
    │   ├── setup/page.tsx       # セットアップウィザード
    │   ├── patients/            # 患者管理
    │   │   ├── loading.tsx      # 患者一覧 スケルトンUI
    │   │   └── [id]/
    │   │       ├── loading.tsx  # 患者詳細 スケルトンUI
    │   │       └── error.tsx    # 患者詳細 エラーバウンダリ
    │   ├── alerts/page.tsx      # アラート一覧
    │   ├── knowledge/page.tsx   # ナレッジベース
    │   └── settings/            # 設定画面群
    ├── components/              # 共通コンポーネント
    │   ├── ui/                  # 基本UIコンポーネント（Skeleton含む）
    │   └── layout/              # レイアウトコンポーネント
    ├── hooks/                   # カスタムフック
    │   ├── useAuth.ts           # Firebase認証フック
    │   ├── useApi.ts            # SWR APIフック
    │   └── useDebounce.ts       # 汎用デバウンスフック
    └── lib/                     # ユーティリティ
        ├── firebase.ts          # Firebase初期化
        ├── api.ts               # REST APIクライアント
        └── utils.ts             # ユーティリティ関数
```

## ローカル開発

### バックエンド

```bash
cd backend
pip install -e ".[dev]"
uvicorn main:app --reload --port 8080
```

### フロントエンド

```bash
cd frontend
npm install
npm run dev       # 開発サーバー起動（Turbopack）
npm run build     # 本番ビルド
npm run start     # 本番サーバー起動
```

## 設計判断

### Slack連携の自動化
- **初期セットアップ**: Admin UIでSlack App作成ガイド → トークン入力 → 接続テスト → 自動初期設定
- **患者登録**: 登録ボタン1つで Firestore書込 → Slackチャンネル作成 → Bot参加 → メンバー招待まで全自動

### Slackチャンネルの3モードインタラクション
1. **コンテキスト蓄積**: Botのアンカーメッセージにリプライ → Intake Agentが構造化 → Firestoreに保存
2. **カジュアルチャット**: チャンネルに直接投稿 → Botは無反応 → 保存しない
3. **AI相談**: `@bot` で質問 → Context/Summary Agentが回答

### BPSフレームワーク
全エージェントがBio-Psycho-Socialの3軸で患者を評価。構造化データのJSON schemaは `docs/agent-design.md` を参照。

### RAGナレッジベース
- 8カテゴリ（BPSモデル、臨床推論、診療ガイドライン、在宅医療制度、緩和ケア、老年医学、薬剤管理、院内プロトコル）
- 各エージェントにどのカテゴリをバインドするかをAdmin UIで設定可能
- Embedding: gemini-embedding-001（768次元）、Vector Store: Firestore + cosine similarity

### 設定管理（Firestore service_configs）
全APIキー・トークンはFirestoreの `service_configs` コレクションに組織単位で保存。ブラウザのlocalStorage/sessionStorageには一切保持しない。

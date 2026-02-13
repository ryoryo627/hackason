# HomeCare Bot Backend

在宅医療支援AIエージェントシステムのバックエンドサービス。

## 概要

SlackをインターフェースとしてGemini APIベースのマルチエージェント群が多職種からの報告をBio-Psycho-Social（BPS）フレームワークで構造化・蓄積・分析します。

## 技術スタック

- **Python 3.12**
- **FastAPI** - Web フレームワーク
- **独自マルチエージェントフレームワーク (google-genai)** - マルチエージェント オーケストレーション
- **Gemini 3 Flash Preview** - LLM
- **Cloud Firestore** - データベース
- **Firestore + Embedding** - RAG ベクトル検索
- **Slack SDK** - Slack Bot 連携

## セットアップ

```bash
# 依存関係のインストール
pip install -e ".[dev]"

# 開発サーバーの起動
uvicorn main:app --reload --port 8080
```

## 環境変数

`.env.example` を `.env` にコピーして値を設定:

```bash
# GCP
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GCP_REGION=asia-northeast1
FIRESTORE_DATABASE_ID=(default)

# Cloud Storage
GCS_BUCKET_NAME=your-bucket-name
GCS_KNOWLEDGE_BUCKET=your-knowledge-bucket-name

# AI
EMBEDDING_MODEL=gemini-embedding-001
GEMINI_MODEL=gemini-3-flash-preview

# CORS
ADMIN_UI_URL=http://localhost:3000

# Server
HOST=0.0.0.0
PORT=8080
DEBUG=true
```

> **Note**: Slack Bot Token、Signing Secret、Gemini API KeyはFirestoreの `service_configs` コレクションに保存され、Admin UIのセットアップウィザードから設定します。

## API エンドポイント

### Slack Events
- `POST /slack/events` - Slack Events API ハンドラ

### Cron Jobs
- `POST /cron/morning-scan` - 朝8時定時スキャン

### Admin API（7ルーター）

全エンドポイントの詳細仕様は [docs/api-design.md](../docs/api-design.md) を参照。

- `/api/setup/*` - セットアップ・初期化
- `/api/dashboard/*` - ダッシュボード統計・フィード
- `/api/patients/*` - 患者CRUD・Slack連携・ファイル
- `/api/alerts/*` - アラート管理・統計・スキャン
- `/api/settings/*` - サービス設定・マスタ管理・エージェント設定
- `/api/knowledge/*` - ナレッジベースCRUD・検索・シード
- `/api/users/*` - ユーザー管理・ロール設定

## ディレクトリ構成

```
backend/
├── main.py              # FastAPI エントリポイント
├── config.py            # 環境変数・設定
├── agents/              # マルチエージェント群（6クラス）
│   ├── base_agent.py    # 共通基底クラス（Gemini連携・プロンプト管理）
│   ├── root_agent.py    # オーケストレーター
│   ├── intake_agent.py  # BPS構造化
│   ├── context_agent.py # コンテキスト参照（SaveAgent含む）
│   ├── alert_agent.py   # 異変検知
│   └── summary_agent.py # 経過サマリー
├── api/                 # REST API ルーター（7ルーター）
│   ├── dashboard.py     # ダッシュボード統計
│   ├── patients.py      # 患者CRUD・Slack連携
│   ├── alerts.py        # アラート管理
│   ├── setup.py         # セットアップ
│   ├── settings.py      # サービス設定・マスタ
│   ├── knowledge.py     # ナレッジベースCRUD
│   └── users.py         # ユーザー管理
├── services/            # ビジネスロジック（5サービス）
│   ├── firestore_service.py
│   ├── slack_service.py
│   ├── rag_service.py
│   ├── risk_service.py
│   └── storage_service.py
├── auth/                # Firebase認証
├── models/              # Pydantic モデル
├── slack/               # Slack Bot 処理
└── cron/                # 定時タスク
```

## デプロイ

```bash
gcloud run deploy homecare-bot \
  --source=. \
  --region=asia-northeast1 \
  --allow-unauthenticated
```

## ライセンス

GCP AI Hackathon Vol.4 提出用プロジェクト

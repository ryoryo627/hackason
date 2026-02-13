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

```bash
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GCP_REGION=asia-northeast1
FIRESTORE_DATABASE_ID=(default)
GCS_BUCKET_NAME=your-bucket-name
GCS_KNOWLEDGE_BUCKET=your-knowledge-bucket-name
EMBEDDING_MODEL=gemini-embedding-001
GEMINI_MODEL=gemini-3-flash-preview
ADMIN_UI_URL=http://localhost:3000
```

## API エンドポイント

### Slack Events
- `POST /slack/events` - Slack Events API ハンドラ

### Cron Jobs
- `POST /cron/morning-scan` - 朝8時定時スキャン

### Admin API
- `GET /api/health` - ヘルスチェック
- `GET /api/patients` - 患者一覧
- `POST /api/patients` - 患者登録
- `GET /api/patients/{id}` - 患者詳細
- `GET /api/alerts` - アラート一覧
- `GET /api/knowledge` - ナレッジベース

## ディレクトリ構成

```
backend/
├── main.py              # FastAPI エントリポイント
├── config.py            # 環境変数・設定
├── agents/              # マルチエージェント群
│   ├── root_agent.py
│   ├── intake_agent.py
│   ├── context_agent.py
│   ├── alert_agent.py
│   └── summary_agent.py
├── api/                 # REST API ルーター
├── services/            # ビジネスロジック
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

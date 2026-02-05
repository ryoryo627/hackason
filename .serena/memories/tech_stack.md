# 技術スタック

## Backend (Python 3.12)
- **フレームワーク**: FastAPI
- **AIフレームワーク**: ADK (Agent Development Kit)
- **LLM**: Gemini 3.0 Flash (gemini-3-flash-preview)
- **データベース**: Cloud Firestore
- **ベクトル検索**: Vertex AI Vector Search + text-embedding-005
- **ストレージ**: Cloud Storage (GCS)
- **Slack連携**: slack-sdk
- **バリデーション**: Pydantic v2
- **実行環境**: Cloud Run

## Frontend (TypeScript)
- **フレームワーク**: Next.js 16 (App Router, Server Components, React 19)
- **スタイリング**: Tailwind CSS
- **認証**: Firebase Authentication
- **ビルドツール**: Turbopack (default)

## インフラ
- **実行環境**: Cloud Run
- **定時タスク**: Cloud Scheduler
- **シークレット**: Secret Manager
- **リージョン**: asia-northeast1

## 主要依存関係

### Backend (pyproject.toml)
```
fastapi>=0.115.0
google-cloud-firestore>=2.19.0
google-genai>=1.0.0
firebase-admin>=6.6.0
slack-sdk>=3.33.0
pydantic>=2.9.0
```

### Frontend (package.json)
```
next: ^15.3.3
react: ^19.0.0
tailwindcss: ^4
firebase: ^11
```

## ベストプラクティスドキュメント
- docs/gemini-3-flash-best-practices.md
- docs/nextjs-16-best-practices.md

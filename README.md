# 🏥 HomeCare AI Agent — 在宅医療支援AIエージェント

[![GCP](https://img.shields.io/badge/Google%20Cloud-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/)
[![ADK](https://img.shields.io/badge/ADK-Agent%20Development%20Kit-blue)](https://google.github.io/adk-docs/)
[![Gemini](https://img.shields.io/badge/Gemini-API-8E75B2)](https://ai.google.dev/)

> GCP AI Hackathon Vol.4 提出作品

## 課題

在宅医療では医師・看護師・薬剤師・ケアマネなど多職種が1人の患者に関わりますが、情報共有はFAX・連絡ノート・電話が主流です。夜間オンコール医が患者の最近の状態を把握できない、複数職種の報告を横断分析して異変を検知する仕組みがない、という課題があります。

## ソリューション

Slackを患者ごとの情報集約ハブとし、**ADKマルチエージェント**が多職種からの報告を**Bio-Psycho-Social（BPS）フレームワーク**で構造化・蓄積・分析します。

### 3つの差別化ポイント

1. **能動的AI臨床推論** — Alert Agentが複数職種×時系列データを横断分析し、異変パターンを自動検知
2. **ゼロコンフィグ運用** — Admin UIから患者登録するだけでSlackチャンネル作成・Bot設定・メンバー招待まで全自動
3. **GCPネイティブ設計** — ADK + Gemini API + Cloud Run + Firestore + Vertex AI Vector Search

## アーキテクチャ

```
Slack ←→ Cloud Run (homecare-bot) ←→ ADK Agents ←→ Gemini API
                                          ↕              ↕
Admin UI ←→ Cloud Run (homecare-admin) ←→ Firestore ←→ Vertex AI Vector Search
```

### AIエージェント構成

| エージェント | 役割 |
|-------------|------|
| **Intake Agent** | テキスト/PDF/画像 → BPS構造化 → Firestore保存 |
| **Context Agent** | 蓄積コンテキスト参照 → BPS分析回答 |
| **Alert Agent** | 横断分析 → 異変パターン検知 → Slackアラート |
| **Summary Agent** | BPS経過サマリー → オンコール引き継ぎ |

### RAGナレッジベース

診療ガイドライン・BPSモデル理論・院内プロトコル等をベクトル化し、エージェントの臨床推論を強化。Admin UIからドキュメント管理・検索テスト・エージェント別のカテゴリバインドが可能。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| AIエージェント | ADK (Agent Development Kit) |
| LLM | **Gemini 3.0 Flash** (Vertex AI) |
| RAG Embedding | text-embedding-005 |
| ベクトル検索 | Vertex AI Vector Search |
| データベース | Cloud Firestore |
| ファイルストレージ | Cloud Storage |
| 実行環境 | Cloud Run |
| 定時タスク | Cloud Scheduler |
| 認証 | Firebase Authentication |
| 設定管理 | Firestore service_configs |
| フロントエンド | **Next.js 16.1.6** + Tailwind CSS 4 + SWR 2.4 |
| エンドユーザーIF | Slack (Bot + Events API) |

## セットアップ

```bash
# 1. リポジトリクローン
git clone https://github.com/xxx/homecare-ai.git
cd homecare-ai

# 2. バックエンド
cd backend
pip install -e ".[dev]"
cp .env.example .env  # 環境変数を設定
uvicorn main:app --reload --port 8080

# 3. フロントエンド
cd frontend
npm install
npm run dev

# 4. デモデータ投入
python scripts/seed_demo_data.py
```

## ドキュメント

詳細な設計ドキュメントは `docs/` ディレクトリを参照してください。

- [要件定義書](docs/requirements.md)
- [アーキテクチャ設計書](docs/architecture.md)
- [データモデル設計書](docs/data-model.md)
- [API設計書](docs/api-design.md)
- [AIエージェント+RAG設計書](docs/agent-design.md)
- [Slack Bot仕様書](docs/slack-bot-design.md)
- [UI/UX設計書](docs/ui-ux-design.md)
- [Gemini 3.0 Flash ベストプラクティス](docs/gemini-3-flash-best-practices.md) ⭐ NEW
- [Next.js 16 ベストプラクティス](docs/nextjs-16-best-practices.md) ⭐ NEW

## ライセンス

MIT

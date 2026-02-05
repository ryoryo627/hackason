# HomeCare AI Agent - プロジェクト概要

## 目的
在宅医療支援AIエージェントシステム。Slackを患者ごとの情報集約ハブとし、Google Cloud上のAIエージェント群（ADK）が多職種からの報告をBio-Psycho-Social（BPS）フレームワークで構造化・蓄積・分析する。

## GCP AI Hackathon Vol.4 提出用

## 主要機能
1. **Slack連携**: 患者ごとにチャンネル作成、報告をスレッドで集約
2. **BPS構造化**: 看護師・薬剤師等の報告をBio-Psycho-Socialで分類
3. **AIエージェント**: Intake/Context/Alert/Summary Agentによる分析
4. **Admin UI**: 患者管理、アラート確認、ナレッジベース管理

## Cloud Runサービス構成
| サービス | 役割 |
|---------|------|
| homecare-bot | Slack Events受信 + ADKエージェント + Cron |
| homecare-admin | Admin UI配信 + REST API |

## ディレクトリ構成
```
hackason/
├── backend/      # Python FastAPI バックエンド
├── frontend/     # Next.js 16 フロントエンド
├── docs/         # 設計ドキュメント
├── scripts/      # ユーティリティスクリプト
└── CLAUDE.md     # 開発引き継ぎ指示書
```

## 設計ドキュメント（docs/）
- requirements.md - 要件定義書
- architecture.md - アーキテクチャ設計
- data-model.md - Firestoreデータモデル
- api-design.md - REST API設計
- agent-design.md - AIエージェント設計
- slack-bot-design.md - Slack Bot仕様
- ui-ux-design.md - UI/UX設計

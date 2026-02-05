# Phase 3 完了: Slack Bot + AIエージェント

## 実装したエージェント

### Base Agent (`agents/base_agent.py`)
- Gemini API統合（google-genai）
- Thinking Level設定（low/medium/high）
- Thought Signatures循環対応
- 共通システムプロンプト
- BPS構造化ヘルパー

### Intake Agent (`agents/intake_agent.py`)
- Thinking Level: `low`
- スレッド返信 → BPS構造化 → Firestore保存
- 確認応答生成
- コンテキスト更新

### Context Agent (`agents/context_agent.py`)
- Thinking Level: `medium`
- @bot質問 → 患者コンテキスト参照 → 回答生成
- 直近レポート統合

### Alert Agent (`agents/alert_agent.py`)
- Thinking Level: `high`
- 6パターンの異変検知（A-1〜A-6）
- 即時アラート生成
- 朝スキャン（全患者横断）
- 朝レポートフォーマット

### Summary Agent (`agents/summary_agent.py`)
- Thinking Level: `medium`
- BPS経過サマリー生成
- 引き継ぎ用フォーマット

### Root Agent (`agents/root_agent.py`)
- イベントルーティング
- 患者ID解決（channel_id → patient）
- キーワード検知（サマリー/保存/質問）
- 朝スキャン実行

## Slack連携

### 署名検証 (`slack/verify.py`)
- HMAC-SHA256署名検証
- タイムスタンプリプレイ攻撃防止
- デモモード対応

### イベントフロー
```
Slack Events API
    ↓
POST /slack/events
    ↓
署名検証
    ↓
Root Agent
    ├→ message (アンカー返信) → Intake Agent → Alert Agent
    └→ app_mention
        ├→ サマリー/経過 → Summary Agent
        ├→ 保存 → Save Agent
        └→ その他 → Context Agent
```

## エンドポイント

| エンドポイント | 機能 |
|---------------|------|
| `POST /slack/events` | Slack Events API受信 + エージェントルーティング |
| `POST /cron/morning-scan` | 朝8時定時スキャン |

## BPSアラートパターン

| ID | パターン | 緊急度 |
|----|----------|--------|
| A-1 | バイタル低下トレンド | HIGH |
| A-2 | 複合Bio悪化 | HIGH |
| A-3 | Bio+Psycho複合 | MEDIUM |
| A-4 | Bio+Social複合 | MEDIUM |
| A-5 | 全軸複合 | HIGH |
| A-6 | 認知変化 | MEDIUM |

## 次のフェーズ

Phase 4: ダッシュボード＋一覧＋詳細
- ダッシュボード（統計・アラート・接続状態）
- 患者一覧（検索・フィルタ・ソート）
- 患者詳細（BPSサマリー・タイムライン）
- アラート一覧・詳細

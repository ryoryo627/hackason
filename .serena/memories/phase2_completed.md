# Phase 2 完了: 初期セットアップ＋患者登録

## 実装したAPIエンドポイント

### Setup API (`/api/setup`)
- `POST /api/setup/slack/test` - Slack接続テスト
- `POST /api/setup/slack/configure` - Slack設定保存
- `POST /api/setup/init` - 組織初期化
- `GET /api/setup/status/{org_id}` - セットアップ状態取得
- `GET /api/setup/slack/users/{org_id}` - Slackユーザー一覧

### Patients API (`/api/patients`)
- `GET /api/patients` - 患者一覧（フィルタ対応）
- `POST /api/patients` - 患者登録（Slackチャンネル自動作成）
- `GET /api/patients/{id}` - 患者詳細
- `PUT /api/patients/{id}` - 患者更新
- `GET /api/patients/{id}/reports` - レポート一覧
- `GET /api/patients/{id}/alerts` - アラート一覧
- `POST /api/patients/{id}/alerts/{alert_id}/acknowledge` - アラート確認

### Settings API (`/api/settings`)
- `GET/POST /api/settings/gemini` - Gemini設定
- `GET/POST /api/settings/vertex` - Vertex AI設定
- `GET/PUT /api/settings/organization` - 組織設定
- `GET/POST /api/settings/master/facilities` - 施設マスタ
- `GET/POST /api/settings/master/areas` - エリアマスタ

### Alerts API (`/api/alerts`)
- `GET /api/alerts` - アラート一覧
- `GET /api/alerts/stats/summary` - アラート統計
- `POST /api/alerts/{id}/acknowledge` - アラート確認

## 実装したサービス

### SlackService (`backend/services/slack_service.py`)
- `test_connection()` - 接続テスト
- `create_channel()` - チャンネル作成
- `post_anchor_message()` - アンカーメッセージ投稿
- `invite_users_to_channel()` - ユーザー招待
- `list_workspace_users()` - ユーザー一覧
- `post_alert_message()` - アラート投稿

## Frontend API Client

`frontend/lib/api.ts` にAPIクライアントを実装:
- `setupApi` - セットアップ関連
- `patientsApi` - 患者関連
- `alertsApi` - アラート関連
- `settingsApi` - 設定関連

## 患者登録フロー

1. フォームで患者情報入力
2. `POST /api/patients` 呼び出し
3. Firestoreに患者レコード作成
4. Slackチャンネル作成（pt-{name}形式）
5. アンカーメッセージ投稿
6. チームメンバー招待
7. 患者レコードにSlack情報を更新

## 次のフェーズ

Phase 3: Slack Bot + AIエージェント
- Slack Events API受信 + 署名検証
- Intake Agent（テキスト→BPS構造化）
- Context Agent（@bot質問→回答）
- Alert Agent（異変検知）
- Summary Agent（BPSサマリー生成）

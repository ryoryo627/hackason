# API設計書

> ✅ **実装状況**: 全エンドポイント実装済み（7ルーター + 直接ルート）

ベースURL: `https://homecare-bot-xxx.run.app`（homecare-botサービスで配信）

全REST APIエンドポイントに Firebase ID Token による認証が必要（`Authorization: Bearer {token}`）。
Slack Events APIは Slack Signing Secret による署名検証で保護。

---

## 1. セットアップ API（/api/setup）

### POST /api/setup/user
ログイン後のユーザー取得/作成。

```
Request:
{
  "uid": "firebase-uid",
  "email": "admin@clinic.jp",
  "display_name": "管理者"
}

Response 200:
{
  "uid": "firebase-uid",
  "email": "admin@clinic.jp",
  "display_name": "管理者",
  "org_id": "org_xxx" | null
}
```

### GET /api/setup/user/{uid}
ユーザー情報取得。

### POST /api/setup/init
組織初期化（ユーザーとの紐付け）。

```
Request:
{
  "uid": "firebase-uid",
  "org_name": "一条通病院"
}

Response 200:
{
  "org_id": "org_xxx",
  "org_name": "一条通病院"
}
```

### POST /api/setup/configure
APIキー・トークンをFirestore service_configsに保存。

```
Request:
{
  "org_id": "org_xxx",
  "slack_bot_token": "xoxb-...",
  "slack_signing_secret": "abc123...",
  "gemini_api_key": "AIza..."
}

Response 200:
{
  "ok": true,
  "configured_services": ["slack", "gemini"]
}
```

### POST /api/setup/test-backend
バックエンド接続テスト（Firestore・Slack・Gemini）。

```
Request:
{
  "org_id": "org_xxx"
}

Response 200:
{
  "firestore": { "ok": true },
  "slack": { "ok": true, "workspace_name": "asahikawa-homecare", "bot_user_id": "U0XXXXX" },
  "gemini": { "ok": true, "model": "gemini-3-flash-preview" }
}
```

### GET /api/setup/status/{org_id}
組織セットアップ状況取得。

### GET /api/setup/slack/users
Slackワークスペースのユーザー一覧取得（患者チャンネルへの招待用）。

---

## 2. 患者 API（/api/patients）

### GET /api/patients
患者一覧取得。

```
Query Parameters:
  org_id: string (required)
  status: "active" | "archived" (default: "active")
  risk_level: "HIGH" | "MEDIUM" | "LOW" (optional, comma-separated)
  facility: string (optional)
  area: string (optional)
  tags: string (optional, comma-separated)
  search: string (optional, 名前・疾患で部分一致)
  sort_by: "risk_level" | "updated_at" | "name" | "age" (default: "updated_at")
  sort_order: "asc" | "desc" (default: "desc")
  limit: number (default: 100)
  offset: number (default: 0)

Response 200:
{
  "patients": [ ... ],
  "total": 24,
  "limit": 100,
  "offset": 0
}
```

### POST /api/patients
患者登録（Slack自動連携含む）。

```
Request:
{
  "org_id": "org_xxx",
  "name": "田中太郎",
  "name_kana": "タナカタロウ",
  "age": 85,
  "sex": "M",
  "conditions": ["COPD", "高血圧"],
  "facility": "さくら訪問看護ST",
  "area": "末広地区",
  "tags": ["要注意"],
  "memo": "妻と二人暮らし",
  "invite_members": ["nurse-a@example.com"]
}

Response 201:
{
  "patient_id": "pat_xxx",
  "slack_channel_id": "C0XXXXX",
  "slack_channel_name": "pt-田中太郎",
  "slack_anchor_message_ts": "1234567890.123456",
  "steps": [ ... ]
}
```

### POST /api/patients/bulk
CSVインポートによる一括患者登録。

### POST /api/patients/bulk-assign-members
一括メンバー割当（バックグラウンドタスク）。

### GET /api/patients/bulk-assign-members/{task_id}
一括メンバー割当の進捗取得。

### GET /api/patients/{patient_id}
患者詳細取得（報告・アラート・コンテキスト含む）。レスポンスに `risk_history`（直近5件）を含む。

### GET /api/patients/{patient_id}/reports
報告一覧取得（タイムライン用、acknowledgedフィルタ付き）。

### GET /api/patients/{patient_id}/alerts
患者別アラート一覧取得。

### GET /api/patients/{patient_id}/context
BPSサマリー・トレンド・推奨事項取得。

### PUT /api/patients/{patient_id}
患者情報更新（Slackチャンネル同期含む）。

### DELETE /api/patients/{patient_id}
患者アーカイブ（ソフトデリート + Slackチャンネルアーカイブ）。

### GET /api/patients/{patient_id}/risk-history
リスクレベル変更履歴の取得。

```
Query Parameters:
  limit: number (default: 20)

Response 200:
{
  "patient_id": "pat_xxx",
  "current_risk_level": "high",
  "risk_level_source": "auto",
  "history": [
    {
      "id": "rh_xxx",
      "previous_level": "medium",
      "new_level": "high",
      "source": "auto",
      "reason": "未確認の緊急アラートが1件あります",
      "trigger": "alert_created",
      "alert_snapshot": { "high": 1, "medium": 0, "low": 0 },
      "created_by": "system",
      "created_at": "2026-02-05T14:30:00Z"
    }
  ]
}
```

### POST /api/patients/{patient_id}/alerts/{alert_id}/acknowledge
アラート確認。

### POST /api/patients/{patient_id}/reports/{report_id}/acknowledge
報告確認（Slackリアクション追加）。

### GET /api/patients/{patient_id}/files
患者に紐づくファイル一覧取得（GCS参照）。

### GET /api/patients/{patient_id}/files/{file_id}/url
ファイルのダウンロードURL取得（Signed URL）。

---

## 3. ダッシュボード API（/api/dashboard）

### GET /api/dashboard/stats
ダッシュボード統計データ。

```
Query Parameters:
  org_id: string (required)

Response 200:
{
  "total_patients": 24,
  "high_risk_count": 4,
  "unacknowledged_alerts": 3,
  "recent_reports_count": 8
}
```

### GET /api/dashboard/recent-alerts
未確認アラート一覧（患者情報付き）。

### GET /api/dashboard/connection-status
サービス接続状況（Slack・Gemini・Vertex・Firestore）。

### GET /api/dashboard/night-summary
夜間イベントサマリー（過去N時間の全患者集約）。

### GET /api/dashboard/activity-feed
全患者横断のアクティビティフィード（直近の報告一覧）。

---

## 4. アラート API（/api/alerts）

### GET /api/alerts
全患者のアラート一覧。

```
Query Parameters:
  org_id: string (required)
  severity: "HIGH" | "MEDIUM" | "LOW" (optional)
  acknowledged: boolean (optional)
  limit: number (default: 20)

Response 200:
{
  "alerts": [ ... ],
  "total": 5
}
```

### GET /api/alerts/{alert_id}
アラート詳細取得。

### POST /api/alerts/{alert_id}/acknowledge
アラート確認。

### GET /api/alerts/stats/summary
アラート統計（緊急度別カウント）。

### POST /api/alerts/scan/{patient_id}
指定患者のアラートスキャン実行（即時検知）。

### POST /api/alerts/scan
全患者のアラートスキャン実行（朝8時定時トリガーと同等）。

---

## 5. 設定 API（/api/settings）

### Slack設定

#### GET /api/settings/slack
Slack接続状況取得。

#### POST /api/settings/slack/oncall-channel
#oncall-nightチャンネル作成。

#### PUT /api/settings/slack/morning-scan-time
朝レポート配信時刻更新。

### Gemini設定

#### GET /api/settings/gemini
Gemini設定状況取得。

#### POST /api/settings/gemini
Gemini APIキー・モデル設定保存。

### Vertex AI設定

#### GET /api/settings/vertex
Vertex AI設定状況取得。

#### POST /api/settings/vertex
Vertex AI設定保存。

### アラートスケジュール

#### GET /api/settings/alert-schedule
アラートスキャンスケジュール取得。

#### PUT /api/settings/alert-schedule
アラートスキャンスケジュール更新。

### 組織設定

#### GET /api/settings/organization
組織設定取得。

#### PUT /api/settings/organization
組織設定更新（名前・管理者メール）。

### マスタデータ

#### GET /api/settings/master/facilities
事業所一覧取得。

#### POST /api/settings/master/facilities
事業所追加。

#### DELETE /api/settings/master/facilities/{facility_id}
事業所削除。

#### GET /api/settings/master/areas
地区一覧取得。

#### POST /api/settings/master/areas
地区追加。

#### DELETE /api/settings/master/areas/{area_id}
地区削除。

### AIエージェント設定

#### GET /api/settings/agents
エージェントプロンプト設定取得（共通 + エージェント別）。

#### PUT /api/settings/agents
エージェントプロンプト更新。

#### DELETE /api/settings/agents
エージェントプロンプトをデフォルトにリセット。

---

## 6. ナレッジベース API（/api/knowledge）

### GET /api/knowledge/documents
ドキュメント一覧（カテゴリ・ステータスフィルタ付き）。

### POST /api/knowledge/documents
ドキュメント追加。

### GET /api/knowledge/documents/{document_id}
ドキュメント詳細取得。

### PUT /api/knowledge/documents/{document_id}
ドキュメントメタデータ更新。

### DELETE /api/knowledge/documents/{document_id}
ドキュメント削除（チャンク含む）。

### POST /api/knowledge/documents/{document_id}/upload
ドキュメントファイルアップロード → RAGパイプライン自動実行（テキスト抽出→チャンキング→Embedding生成→Firestore保存）。
対応フォーマット: PDF, TXT, MD, DOCX

### GET /api/knowledge/documents/{document_id}/chunks
ドキュメントのチャンク一覧取得（Embeddingデータは除外）。

Response:
{
  "chunks": [{ "id": "...", "chunk_index": 0, "text": "...", "token_count": 120 }],
  "total": 19
}

### PUT /api/knowledge/documents/{document_id}/bindings
エージェントバインド設定更新。

### POST /api/knowledge/search
ナレッジ検索（✅ gemini-embedding-001 + cosine similarity実装済み。APIキー未設定時はテキストマッチにフォールバック）。

### GET /api/knowledge/documents/{document_id}/download
ドキュメントファイルのダウンロードURL取得（Signed URL）。

### POST /api/knowledge/seed
デモ用ナレッジデータの一括登録。

### GET /api/knowledge/categories
利用可能なナレッジカテゴリ一覧取得。

---

## 7. ユーザー管理 API（/api/users）

### GET /api/users
ユーザー一覧取得。

```
Query Parameters:
  org_id: string (required)

Response 200:
{
  "users": [
    {
      "uid": "firebase-uid",
      "email": "admin@clinic.jp",
      "display_name": "管理者",
      "role": "admin",
      "org_id": "org_xxx",
      "created_at": "2026-02-01T00:00:00Z"
    }
  ]
}
```

### POST /api/users
ユーザー招待・追加。

```
Request:
{
  "email": "nurse@clinic.jp",
  "display_name": "看護師A",
  "role": "viewer",
  "org_id": "org_xxx"
}

Response 201:
{
  "uid": "firebase-uid",
  "email": "nurse@clinic.jp",
  "display_name": "看護師A",
  "role": "viewer"
}
```

### PUT /api/users/{uid}/role
ユーザーロール変更。

```
Request:
{
  "role": "doctor"
}

Response 200:
{
  "uid": "firebase-uid",
  "role": "doctor"
}
```

### DELETE /api/users/{uid}
ユーザー削除（組織からの除外）。

---

## 8. Slack Bot エンドポイント（直接ルート）

### POST /slack/events
Slack Events API受信。Slack署名検証で保護。

処理フロー:
1. `X-Slack-Signature` ヘッダーで署名検証
2. `url_verification` チャレンジ応答
3. イベントタイプ判定 → ADK Root Agentにディスパッチ

### POST /cron/morning-scan
Cloud Schedulerからの朝8時トリガー。

処理: Alert Agentが全患者スキャン → #oncall-night投稿

### GET /health
ヘルスチェック。

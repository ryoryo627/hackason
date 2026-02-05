# API設計書

ベースURL: `https://homecare-admin-xxx.run.app`

全APIエンドポイントに Firebase ID Token による認証が必要（`Authorization: Bearer {token}`）。

---

## 1. セットアップ API

### POST /api/setup/tokens
Slackトークンを保存。

```
Request:
{
  "bot_token": "xoxb-...",
  "signing_secret": "abc123...",
  "org_name": "一条通病院"
}

Response 200:
{
  "org_id": "org_xxx",
  "token_stored": true,
  "secret_stored": true
}
```

### POST /api/setup/test
Slack接続テスト。

```
Request:
{
  "org_id": "org_xxx"
}

Response 200:
{
  "ok": true,
  "workspace_name": "asahikawa-homecare",
  "bot_name": "HomeCare AI",
  "bot_user_id": "U0XXXXX",
  "channel_count": 12,
  "member_count": 45
}
```

### POST /api/setup/initialize
自動初期設定（#oncall-night作成等）。

```
Request:
{
  "org_id": "org_xxx"
}

Response 200:
{
  "ok": true,
  "oncall_channel_id": "C0XXXXX",
  "oncall_channel_name": "oncall-night",
  "setup_completed_at": "2026-02-05T14:30:00+09:00"
}
```

---

## 2. 患者 API

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
  "patients": [
    {
      "id": "pat_xxx",
      "name": "田中太郎",
      "name_kana": "タナカタロウ",
      "age": 85,
      "sex": "M",
      "conditions": ["COPD", "高血圧", "2型糖尿病"],
      "facility": "さくら訪問看護ST",
      "area": "末広地区",
      "tags": ["要注意"],
      "risk_level": "HIGH",
      "status": "active",
      "slack_channel_id": "C0XXXXX",
      "slack_channel_name": "pt-田中太郎",
      "updated_at": "2026-02-05T14:30:00+09:00"
    }
  ],
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
  "invite_members": ["nurse-a@example.com", "pharmacist-b@example.com"]
}

Response 201:
{
  "patient_id": "pat_xxx",
  "slack_channel_id": "C0XXXXX",
  "slack_channel_name": "pt-田中太郎",
  "slack_anchor_message_ts": "1234567890.123456",
  "invited_count": 2,
  "steps": [
    { "step": "firestore_create", "status": "ok" },
    { "step": "slack_channel_create", "status": "ok" },
    { "step": "slack_channel_id_link", "status": "ok" },
    { "step": "slack_bot_join", "status": "ok" },
    { "step": "slack_anchor_message", "status": "ok" },
    { "step": "slack_invite_members", "status": "ok", "detail": "2/2 invited" },
    { "step": "slack_set_topic", "status": "ok" }
  ]
}
```

### GET /api/patients/{patient_id}
患者詳細取得。

```
Response 200:
{
  "patient": { ... },  // 患者基本情報
  "context": { ... },  // BPSサマリー・トレンド・推奨事項
  "recent_reports": [ ... ],  // 直近10件の報告
  "recent_alerts": [ ... ],   // 直近5件のアラート
  "stats": {
    "total_reports": 42,
    "total_alerts": 3,
    "last_report_at": "2026-02-05T10:30:00+09:00"
  }
}
```

### PUT /api/patients/{patient_id}
患者情報更新（Slackトピック自動更新含む）。

```
Request:
{
  "name": "田中太郎",
  "age": 86,
  "conditions": ["COPD", "高血圧", "心不全"],
  "tags": ["要注意", "独居"]
}

Response 200:
{
  "ok": true,
  "slack_topic_updated": true
}
```

### POST /api/patients/{patient_id}/archive
患者アーカイブ。

```
Response 200:
{
  "ok": true,
  "slack_channel_archived": true
}
```

---

## 3. 報告 API

### GET /api/patients/{patient_id}/reports
報告一覧取得（タイムライン用）。

```
Query Parameters:
  limit: number (default: 20)
  offset: number (default: 0)
  reporter: string (optional)

Response 200:
{
  "reports": [ ... ],
  "total": 42
}
```

### GET /api/patients/{patient_id}/context
BPSサマリー・トレンド・推奨事項取得。

```
Response 200:
{
  "current_summary": "...",
  "bio_trends": [ ... ],
  "psycho_trends": [ ... ],
  "social_trends": [ ... ],
  "risk_factors": [ ... ],
  "recommendations": [ ... ],
  "last_updated": "2026-02-05T14:30:00+09:00"
}
```

---

## 4. アラート API

### GET /api/alerts
全患者のアラート一覧。

```
Query Parameters:
  org_id: string (required)
  severity: "HIGH" | "MEDIUM" | "LOW" (optional, comma-separated)
  acknowledged: boolean (optional)
  limit: number (default: 20)
  offset: number (default: 0)

Response 200:
{
  "alerts": [
    {
      "id": "alert_xxx",
      "patient_id": "pat_xxx",
      "patient_name": "田中太郎",
      "severity": "HIGH",
      "pattern_type": "A-2",
      "pattern_name": "複合Bio悪化",
      "message": "...",
      "acknowledged": false,
      "created_at": "2026-02-05T10:30:00+09:00"
    }
  ],
  "total": 5
}
```

### PUT /api/alerts/{patient_id}/{alert_id}/acknowledge
アラート確認。

```
Request:
{
  "acknowledged_by": "Dr. 佐藤"
}

Response 200:
{
  "ok": true,
  "acknowledged_at": "2026-02-05T15:00:00+09:00"
}
```

---

## 5. エクスポート API

### POST /api/patients/{patient_id}/export

```
Request:
{
  "format": "bps_summary" | "referral_letter" | "full_record",
  "output": "text" | "markdown" | "csv"
}

Response 200:
{
  "content": "...",         // フォーマット済みテキスト
  "filename": "田中太郎_BPSサマリー_20260205.md",
  "format": "bps_summary",
  "generated_at": "2026-02-05T15:00:00+09:00"
}
```

---

## 6. ナレッジベース API

### GET /api/knowledge/documents
ドキュメント一覧。

```
Query Parameters:
  org_id: string (required)
  category: string (optional)
  status: string (optional)

Response 200:
{
  "documents": [ ... ],
  "stats": {
    "total_documents": 12,
    "total_chunks": 222,
    "total_tokens": 77230,
    "indexed_count": 11,
    "processing_count": 1
  }
}
```

### POST /api/knowledge/documents
ドキュメント追加（PDF/Markdown/URL）。

```
Request (multipart/form-data):
  file: File (PDF) | null
  title: string
  category: string
  source: string
  file_type: "pdf" | "markdown" | "url"
  raw_text: string | null        // markdown直接入力時
  url: string | null             // URL取込時
  chunk_size: number (default: 500)
  chunk_overlap: number (default: 50)

Response 202:
{
  "doc_id": "doc_xxx",
  "status": "processing",
  "message": "アップロード完了。バックグラウンドでインデックス処理を開始します。"
}
```

バックグラウンド処理: テキスト抽出 → チャンキング → Embedding生成 → Vector Search登録

### DELETE /api/knowledge/documents/{doc_id}
ドキュメント削除（Vector Searchからも削除）。

### POST /api/knowledge/documents/{doc_id}/reindex
再インデックス。

### GET /api/knowledge/documents/{doc_id}/chunks
チャンクプレビュー。

```
Response 200:
{
  "chunks": [
    {
      "chunk_id": "chunk_xxx",
      "chunk_index": 0,
      "text": "BPSモデルでは...",
      "token_count": 156,
      "embedding_status": "done"
    }
  ],
  "total": 24
}
```

### POST /api/knowledge/search
RAG検索テスト。

```
Request:
{
  "query": "SpO2が低下傾向にあるCOPD患者で食欲も落ちている場合の対応",
  "top_k": 5,
  "categories": ["guidelines", "bps", "geriatric"] | null  // null=全カテゴリ
}

Response 200:
{
  "results": [
    {
      "score": 0.94,
      "doc_id": "doc_xxx",
      "doc_title": "在宅COPD患者の急性増悪予防と管理",
      "category": "guidelines",
      "chunk_index": 12,
      "text": "SpO2の経時的モニタリングにおいて..."
    }
  ],
  "query_embedding_time_ms": 45,
  "search_time_ms": 120
}
```

### GET /api/knowledge/bindings
エージェント別カテゴリバインド取得。

```
Response 200:
{
  "bindings": {
    "intake": ["bps", "clinical", "custom"],
    "context": ["bps", "clinical", "guidelines", "homecare", "geriatric", "medication", "custom"],
    "alert": ["guidelines", "clinical", "medication", "custom"],
    "summary": ["bps", "guidelines", "homecare", "palliative"]
  }
}
```

### PUT /api/knowledge/bindings/{agent_id}
エージェントのカテゴリバインド更新。

```
Request:
{
  "bound_categories": ["bps", "clinical", "guidelines", "custom"]
}

Response 200:
{
  "ok": true,
  "agent_id": "alert",
  "bound_categories": ["bps", "clinical", "guidelines", "custom"]
}
```

---

## 7. サービス設定 API

### GET /api/settings/services
全サービスの接続状態取得。

```
Response 200:
{
  "services": [
    {
      "service_id": "gemini",
      "display_name": "Gemini API",
      "category": "ai",
      "required": true,
      "status": "connected",
      "config": { "model": "gemini-3-flash-preview", "thinking_level": "medium" },
      "has_secrets": true,
      "last_checked_at": "2026-02-05T14:32:00+09:00"
    }
  ]
}
```

### PUT /api/settings/services/{service_id}
サービス設定の更新。

```
Request:
{
  "config": { "model": "gemini-3-flash-preview", "thinking_level": "high" },
  "secrets": { "api_key": "AIzaXXX..." }  // Secret Managerに保存される
}

Response 200:
{
  "ok": true,
  "status": "connected"
}
```

### POST /api/settings/services/{service_id}/test
個別サービスの接続テスト。

```
Response 200:
{
  "ok": true,
  "latency_ms": 120,
  "details": {
    "workspace_name": "asahikawa-homecare"  // Slackの場合
  }
}
```

### POST /api/settings/services/test-all
全サービスの接続テスト。

```
Response 200:
{
  "results": [
    { "service_id": "gemini", "ok": true, "latency_ms": 95 },
    { "service_id": "slack", "ok": true, "latency_ms": 120 },
    { "service_id": "stt", "ok": false, "error": "not_configured" }
  ],
  "connected": 5,
  "total": 6
}
```

### GET /api/settings/usage
使用量取得。

```
Query Parameters:
  period: "current_month" | "last_month" | "last_3_months"

Response 200:
{
  "period": "2026-02",
  "services": [
    {
      "service_id": "gemini",
      "api_calls": 1847,
      "tokens_used": 892400,
      "estimated_cost_usd": 2.14
    }
  ],
  "total_cost_usd": 3.50
}
```

---

## 8. ダッシュボード API

### GET /api/dashboard
ダッシュボード統計データ。

```
Query Parameters:
  org_id: string (required)

Response 200:
{
  "stats": {
    "total_patients": 24,
    "high_risk_count": 4,
    "today_reports": 8,
    "unacknowledged_alerts": 3
  },
  "unacknowledged_alerts": [ ... ],  // 未確認アラート上位5件
  "service_status": [
    { "service_id": "gemini", "status": "connected" },
    { "service_id": "slack", "status": "connected" }
  ],
  "recent_reports": [ ... ],         // 直近10件
  "morning_report_preview": "..."    // 本日の朝レポート内容
}
```

---

## 9. マスタ管理 API

### GET /api/master/facilities
### POST /api/master/facilities
### PUT /api/master/facilities/{id}
### DELETE /api/master/facilities/{id}

### GET /api/master/areas
### POST /api/master/areas
### PUT /api/master/areas/{id}
### DELETE /api/master/areas/{id}

### GET /api/master/tags
### POST /api/master/tags
### DELETE /api/master/tags/{id}

（標準的なCRUD。スキーマは `data-model.md` 参照）

---

## 10. Slack Bot エンドポイント（homecare-bot）

### POST /slack/events
Slack Events API受信。Slack署名検証で保護。

処理フロー:
1. `X-Slack-Signature` ヘッダーで署名検証
2. `url_verification` チャレンジ応答
3. イベントタイプ判定 → ADK Root Agentにディスパッチ

### POST /cron/morning-scan
Cloud Schedulerからの朝8時トリガー。OIDC Token検証で保護。

処理: Alert Agentが全患者スキャン → #oncall-night投稿

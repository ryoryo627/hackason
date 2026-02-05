# データモデル設計書

## 1. Firestoreコレクション全体像

```
organizations/{org_id}/
  ├── facilities/{facility_id}       # 事業所マスタ
  └── areas/{area_id}                # 地区マスタ

patients/{patient_id}/
  ├── reports/{report_id}            # BPS構造化報告
  ├── context/current                # AI抽出コンテキスト（単一Doc）
  ├── alerts/{alert_id}              # アラート履歴
  └── raw_files/{file_id}            # 生ファイルGCS参照

knowledge_documents/{doc_id}/
  └── chunks/{chunk_id}              # チャンク（Embedding付き）

knowledge_agent_bindings/{agent_id}  # エージェント別カテゴリバインド

service_configs/{service_id}         # API設定（Secret Manager参照）
```

## 2. organizations コレクション

```typescript
// organizations/{org_id}
{
  name: string,                      // 組織名
  slack_workspace_id: string,        // ワークスペースID
  slack_workspace_name: string,      // ワークスペース名
  slack_bot_user_id: string,         // BotのユーザーID
  slack_token_ref: string,           // Secret Managerリソース参照
  signing_secret_ref: string,        // Secret Managerリソース参照
  oncall_channel_id: string,         // #oncall-nightのチャンネルID
  setup_completed_at: Timestamp,
  created_at: Timestamp,
  updated_at: Timestamp,
}

// organizations/{org_id}/facilities/{facility_id}
{
  name: string,                      // 事業所名
  address: string | null,
  created_at: Timestamp,
}

// organizations/{org_id}/areas/{area_id}
{
  name: string,                      // 地区名
  created_at: Timestamp,
}
```

## 3. patients コレクション

```typescript
// patients/{patient_id}
{
  org_id: string,                    // 所属組織ID
  name: string,                      // 患者名（必須）
  name_kana: string | null,          // フリガナ
  age: number,                       // 年齢（必須）
  sex: "M" | "F",                    // 性別（必須）
  conditions: string[],              // 基礎疾患リスト
  facility: string | null,           // 事業所名
  area: string | null,               // 地区名
  tags: string[],                    // カスタムタグ ["要注意","独居","看取り期","難病"]
  memo: string | null,               // 備考
  slack_channel_id: string | null,   // 自動紐付けされたチャンネルID
  slack_channel_name: string | null, // チャンネル名 "pt-田中太郎"
  slack_anchor_message_ts: string | null, // アンカーメッセージのts
  risk_level: "HIGH" | "MEDIUM" | "LOW", // 現在のリスクレベル
  status: "active" | "archived",
  created_at: Timestamp,
  updated_at: Timestamp,
}
```

## 4. reports サブコレクション

```typescript
// patients/{patient_id}/reports/{report_id}
{
  // BPS構造化データ
  bio: {
    vitals: Array<{
      type: string,           // "SpO2", "BP_systolic", "BP_diastolic", "HR", "BT", "weight"
      value: number,
      unit: string,           // "%", "mmHg", "bpm", "°C", "kg"
      trend: "↑" | "↓" | "→" | null,
      delta: number | null,   // 前回比
      period: string | null,  // "1w", "1d", "1m"
    }>,
    symptoms: string[],       // ["食欲低下", "倦怠感", "咳嗽"]
    medications: Array<{
      name: string,           // "アムロジピン5mg"
      adherence: "良好" | "低下" | "中断" | null,
      note: string | null,    // "週2回忘れ"
    }>,
    adl: string | null,       // "入浴に介助必要"
  },
  psycho: {
    mood: string | null,      // "暗い", "安定", "興奮"
    cognition: string | null, // "変化の可能性"
    concerns: string[],       // ["意欲低下の可能性"]
  },
  social: {
    family: string | null,    // "妻の介護疲労"
    services: string | null,  // "訪看週2回→3回に変更"
    concerns: string[],       // ["介護負担増加傾向"]
  },

  // メタデータ
  reporter: "nurse" | "pharmacist" | "care_manager" | "doctor" | "family",
  reporter_name: string,
  source_type: "text" | "pdf" | "image" | "voice",
  raw_text: string,           // 元テキスト全文
  confidence: number,         // 0.0-1.0 構造化の確信度
  alert_triggered: boolean,   // この報告でアラートが発火したか

  timestamp: Timestamp,       // 報告日時
  created_at: Timestamp,
}
```

## 5. context サブコレクション

```typescript
// patients/{patient_id}/context/current （単一ドキュメント）
{
  current_summary: string,           // 現在のBPSサマリーテキスト（ナラティブ）

  bio_trends: Array<{
    indicator: string,               // "SpO2", "食欲" etc.
    direction: "improving" | "stable" | "worsening",
    detail: string,
  }>,
  psycho_trends: Array<{
    indicator: string,
    direction: "improving" | "stable" | "worsening",
    detail: string,
  }>,
  social_trends: Array<{
    indicator: string,
    direction: "improving" | "stable" | "worsening",
    detail: string,
  }>,

  risk_factors: string[],            // ["SpO2低下トレンド", "服薬アドヒアランス低下"]
  recommendations: Array<{
    priority: "HIGH" | "MEDIUM" | "LOW",
    bps_axis: "bio" | "psycho" | "social" | "cross",
    text: string,
  }>,

  last_updated: Timestamp,
}
```

## 6. alerts サブコレクション

```typescript
// patients/{patient_id}/alerts/{alert_id}
{
  severity: "HIGH" | "MEDIUM" | "LOW",
  pattern_type: string,              // "A-1"〜"A-6"（agent-design.md参照）
  pattern_name: string,              // "バイタル低下トレンド"
  message: string,                   // アラート本文（Slack投稿内容）
  evidence: Array<{
    report_id: string,
    reporter_name: string,
    timestamp: Timestamp,
    summary: string,
  }>,
  recommended_actions: string[],
  slack_message_ts: string | null,   // Slack投稿のts
  acknowledged: boolean,
  acknowledged_by: string | null,
  acknowledged_at: Timestamp | null,
  created_at: Timestamp,
}
```

## 7. raw_files サブコレクション

```typescript
// patients/{patient_id}/raw_files/{file_id}
{
  gcs_uri: string,                   // "gs://homecare-ai-files/patients/{id}/xxx.pdf"
  file_type: "pdf" | "image" | "voice",
  original_name: string,
  size_bytes: number,
  uploaded_by: string,               // reporter_name
  linked_report_id: string | null,   // 関連するreportのID
  timestamp: Timestamp,
}
```

## 8. knowledge_documents コレクション

```typescript
// knowledge_documents/{doc_id}
{
  org_id: string,
  title: string,                     // ドキュメントタイトル
  category: string,                  // "bps" | "clinical" | "guidelines" | "homecare" |
                                     // "palliative" | "geriatric" | "medication" | "custom"
  source: string,                    // 出典 "日本呼吸器学会 COPD診療ガイドライン 2022"
  file_type: "pdf" | "markdown" | "url",
  gcs_uri: string | null,           // PDFファイルのGCS URI
  url: string | null,                // URL取り込みの場合
  raw_text: string | null,           // Markdown直接入力の場合

  // チャンク設定
  chunk_size: number,                // デフォルト 500 tokens
  chunk_overlap: number,             // デフォルト 50 tokens

  // ステータス
  status: "uploading" | "processing" | "indexed" | "error",
  total_chunks: number,
  total_tokens: number,
  error_message: string | null,

  created_at: Timestamp,
  updated_at: Timestamp,
}

// knowledge_documents/{doc_id}/chunks/{chunk_id}
{
  chunk_index: number,               // 0-indexed
  text: string,                      // チャンクテキスト
  token_count: number,
  embedding_id: string | null,       // Vertex AI Vector SearchのID
  embedding_status: "pending" | "done" | "error",
  created_at: Timestamp,
}
```

## 9. knowledge_agent_bindings コレクション

```typescript
// knowledge_agent_bindings/{agent_id}
// agent_id: "intake" | "context" | "alert" | "summary"
{
  org_id: string,
  agent_id: string,
  bound_categories: string[],        // ["bps", "clinical", "custom"]
  updated_at: Timestamp,
}
```

デフォルトバインド:
| エージェント | デフォルトカテゴリ |
|-------------|-------------------|
| intake | bps, clinical, custom |
| context | bps, clinical, guidelines, homecare, geriatric, medication, custom |
| alert | guidelines, clinical, medication, custom |
| summary | bps, guidelines, homecare, palliative |

## 10. service_configs コレクション

```typescript
// service_configs/{service_id}
// service_id: "gemini" | "vertex" | "slack" | "firestore" | "gcs" | "stt"
{
  org_id: string,
  service_id: string,
  display_name: string,              // "Gemini API"
  category: "ai" | "integration" | "infrastructure",
  required: boolean,

  // 設定値（機密でないもの）
  config: {
    model?: string,                  // "gemini-3.0-flash"
    project_id?: string,
    region?: string,
    bucket_name?: string,
    database_id?: string,
    language?: string,
  },

  // Secret Manager参照（機密情報）
  secrets: {
    [key: string]: string,           // key: field名, value: Secret Managerリソース参照
    // 例: { "api_key": "projects/xxx/secrets/gemini-api-key/versions/latest" }
  },

  // ステータス
  status: "connected" | "error" | "not_configured",
  last_checked_at: Timestamp | null,
  last_error: string | null,

  updated_at: Timestamp,
}
```

## 11. インデックス設計

| コレクション | インデックスフィールド | 用途 |
|-------------|---------------------|------|
| `patients` | `org_id` + `status` + `risk_level` + `updated_at DESC` | ダッシュボード一覧 |
| `patients` | `org_id` + `status` + `facility` + `updated_at DESC` | 事業所フィルタ |
| `patients` | `org_id` + `status` + `area` + `updated_at DESC` | 地区フィルタ |
| `reports` | `timestamp DESC` | 時系列取得 |
| `alerts` | `severity` + `created_at DESC` | 緊急度順 |
| `alerts` | `acknowledged` + `created_at DESC` | 未確認アラート |
| `knowledge_documents` | `org_id` + `category` + `status` | カテゴリフィルタ |
| `knowledge_documents` | `org_id` + `updated_at DESC` | 最近の更新 |

## 12. デモデータ仕様

24名以上の模擬患者。以下の分布:

| 属性 | 分布 |
|------|------|
| リスクレベル | HIGH: 4名, MEDIUM: 8名, LOW: 12名 |
| 事業所 | 3事業所に均等分配 |
| 地区 | 5地区に分配 |
| タグ | 要注意: 6名, 独居: 4名, 看取り期: 2名, 難病: 2名 |
| 基礎疾患 | COPD, 高血圧, 糖尿病, 心不全, 認知症 等を組み合わせ |

詳細デモ患者（田中太郎 85歳男性）:
- 報告数: 10件以上（複数職種から時系列データ）
- アラート: 2件（A-2複合Bio悪化、A-5全軸複合）
- context: BPSサマリー・トレンド・推奨事項が充実
- Slackチャンネルにアンカーメッセージ + 報告スレッド

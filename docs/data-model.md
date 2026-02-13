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
  ├── risk_history/{history_id}      # リスクレベル変更履歴
  └── raw_files/{file_id}            # 生ファイルGCS参照

knowledge_documents/{doc_id}/
  └── chunks/{chunk_id}              # チャンク（Embedding付き）

knowledge_agent_bindings/{agent_id}  # エージェント別カテゴリバインド

users/{uid}                          # ユーザー情報（Firebase Auth連携）

service_configs/{service_id}         # API設定（APIキー・トークン直接保存）
```

## 2. organizations コレクション

```typescript
// organizations/{org_id}
{
  name: string,                      // 組織名
  slack_workspace_id: string,        // ワークスペースID
  slack_workspace_name: string,      // ワークスペース名
  slack_bot_user_id: string,         // BotのユーザーID
  oncall_channel_id: string,         // #oncall-nightのチャンネルID
  // ※ Slack Bot Token, Signing Secret は service_configs/{org_id}_slack に保存
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
  risk_level_source: "auto" | "manual",  // リスクレベル設定元（デフォルト "auto"）
  risk_level_reason: string | null,      // リスクレベルの判定理由
  risk_level_updated_at: Timestamp | null, // リスクレベル最終更新日時
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

## 6.5 risk_history サブコレクション

```typescript
// patients/{patient_id}/risk_history/{history_id}
{
  previous_level: "high" | "medium" | "low",  // 変更前レベル
  new_level: "high" | "medium" | "low",       // 変更後レベル
  source: "auto" | "manual",                  // 変更元
  reason: string,                             // 変更理由（日本語）
  trigger: string,                            // "alert_created" | "alert_acknowledged" | "alert_scan" | "manual_update"
  alert_snapshot: {                            // 変更時点の未確認アラート数
    high: number,
    medium: number,
    low: number,
  },
  created_by: string,                         // "system" | ユーザー名
  created_at: Timestamp,
}
```

## 7. raw_files サブコレクション

```typescript
// patients/{patient_id}/raw_files/{file_id}
{
  gcs_uri: string,                   // "gs://{bucket}/patients/{id}/xxx.pdf"
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
  chunk_size: number,                // デフォルト 500文字（characters）— len()による文字数カウント
  chunk_overlap: number,             // デフォルト 50文字 overlap

  // ステータス
  status: "uploading" | "processing" | "indexed" | "error",
  total_chunks: number,
  total_tokens: number,
  error_message: string | null,

  created_at: Timestamp,
  updated_at: Timestamp,
}

// organizations/{org_id}/knowledge/{doc_id}/chunks/{chunk_id}
{
  chunk_index: number,               // 0-indexed
  text: string,                      // チャンクテキスト
  token_count: number,
  embedding: number[],               // gemini-embedding-001 Embedding (768次元 float配列)
  category: string,                  // 非正規化: 親ドキュメントのカテゴリ
  source: string,                    // 非正規化: 親ドキュメントのタイトル
  org_id: string,                    // 非正規化: 組織ID
  doc_id: string,                    // 非正規化: 親ドキュメントID
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

## 10. users コレクション

```typescript
// users/{uid}  (Firebase Auth UIDをドキュメントIDとして使用)
{
  uid: string,                       // Firebase Auth UID
  email: string,                     // メールアドレス
  display_name: string,              // 表示名
  org_id: string | null,             // 所属組織ID
  created_at: Timestamp,
  updated_at: Timestamp,
}
```

## 11. service_configs コレクション

APIキー・トークン・設定値をFirestoreに直接保存する。組織単位で管理。

```typescript
// service_configs/{org_id}_slack
{
  bot_token: string,                 // "xoxb-..."
  signing_secret: string,            // Slack Signing Secret
  team_id: string,                   // ワークスペースID
  team_name: string,                 // ワークスペース名
  bot_user_id: string,               // BotのユーザーID
  updated_at: Timestamp,
}

// service_configs/{org_id}_gemini
{
  api_key: string,                   // Gemini API Key
  model: string,                     // "gemini-3-flash-preview"
  updated_at: Timestamp,
}

// service_configs/{org_id}_vertex
{
  project_id: string,                // GCPプロジェクトID
  region: string,                    // "asia-northeast1"
  embedding_model: string,           // "gemini-embedding-001"
  updated_at: Timestamp,
}

// service_configs/{org_id}_agent_prompts
{
  shared_system_prompt: string | null,  // 全エージェント共通の追加プロンプト
  intake_prompt: string | null,         // Intake Agent カスタムプロンプト
  context_prompt: string | null,        // Context Agent カスタムプロンプト
  alert_prompt: string | null,          // Alert Agent カスタムプロンプト
  summary_prompt: string | null,        // Summary Agent カスタムプロンプト
  updated_at: Timestamp,
}
```

## 12. インデックス設計

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

## 13. デモデータ仕様

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

# AIエージェント + RAGナレッジベース設計書

> Bio-Psycho-Social（BPS）フレームワークに基づくマルチエージェントシステムとRAGナレッジベースの設計仕様。

## 0. Gemini 3 Flash Preview 設定

本システムは **Gemini 3 Flash Preview** を使用。

### エージェント別 Thinking Level 設定

| エージェント | Thinking Level | 理由 |
|-------------|----------------|------|
| Intake Agent | `low` | BPS構造化は比較的定型的な処理 |
| Context Agent | `medium` | 質問応答は中程度の推論が必要 |
| Alert Agent | `high` | 複数報告の横断分析・異変検知には深い推論が必要 |
| Summary Agent | `medium` | サマリー生成は中程度の推論 |

### Thought Signatures

Gemini 3 Flash PreviewではThought Signaturesの循環が**必須**。各エージェントは受け取ったsignaturesを保持し、次のリクエストで返す必要がある。

```python
class BaseAgent:
    def __init__(self, thinking_level: str):
        self.thinking_level = thinking_level
        self.thought_signatures = None

    async def generate(self, prompt: str):
        config = {"thinking_level": self.thinking_level}
        if self.thought_signatures:
            config["thought_signatures"] = self.thought_signatures

        response = await self.model.generate_content_async(prompt, config)

        if hasattr(response, 'thought_signatures'):
            self.thought_signatures = response.thought_signatures

        return response
```

### Temperature設定

**全エージェントでデフォルト値 `1.0` を維持**。Gemini 3 Flash Previewでは低いtemperatureを設定するとループや性能低下の原因になる。

---

## 1. エージェント構成（カスタムマルチエージェント）

```
BaseAgent (共通基底クラス — Gemini連携・プロンプト管理)
  │
Root Agent (オーケストレーター)
├── Intake Agent    : テキスト/ファイル → BPS構造化 → Firestore保存
├── Context Agent   : コンテキスト参照 → BPS分析回答
│   └── SaveAgent   : 直近メッセージ取得・保存（Context Agent内に定義）
├── Alert Agent     : 横断分析 → 異変パターン検知
└── Summary Agent   : BPS経過サマリー → オンコール引き継ぎ
         ↕
  RAG Knowledge Base (✅ Firestore + gemini-embedding-001 + cosine similarity 実装済み)
```

### BaseAgent（共通基底クラス）

`agents/base_agent.py` に実装。全エージェントが継承。

**主要機能:**
- Gemini API連携（gemini-3-flash-preview、JSON mode対応）
- Thinking Level設定（low=1024, medium=8192, high=24576トークン）
- Firestore `service_configs`からのAPIキー取得
- カスタムプロンプト管理（Admin UIから設定可能）
- 患者コンテキスト構築（`build_patient_context()`）
- RAGナレッジブロック構築（`build_knowledge_block()`）

### カスタムプロンプト管理

Admin UI（`/settings/agents`）からエージェント別にプロンプトをカスタマイズ可能。

- **共通システムプロンプト**: 全エージェントに適用される追加プロンプト
- **エージェント別プロンプト**: Intake/Context/Alert/Summaryそれぞれに個別の追加プロンプト
- **マージロジック**: デフォルトプロンプト + 共通カスタムプロンプト + エージェント別カスタムプロンプト
- **保存先**: Firestore `service_configs/{org_id}_agent_prompts`

## 2. 共通AIペルソナ

全エージェントが共有する基本ペルソナ（システムプロンプト）:

```
あなたは家庭医療に精通したAIアシスタントです。
Bio-Psycho-Socialフレームワークに基づいて患者を全人的に評価します。

原則:
- 看護・薬学・社会福祉の視点も含めたBPS統合評価を行う
- エビデンスベースの臨床推論を提供する
- 日本の在宅医療制度・介護保険制度の知識を持つ
- 患者の経時変化の文脈を理解した回答を生成する
- 不確実な情報には確信度を付与する
- 判断に迷う場合は「主治医への相談を推奨」と明示する

RAGナレッジベースから取得した知識は [KNOWLEDGE] タグで参照可能。
患者のFirestoreデータは [PATIENT_CONTEXT] タグで参照可能。
```

## 3. Root Agent

**役割**: Slackイベントの解析とサブエージェントへのルーティング。

**ルーティングロジック**:

| イベント | 条件 | ルーティング先 |
|---------|------|--------------|
| `message` | アンカーメッセージへのリプライ（thread_ts一致）| Intake Agent |
| `app_mention` | テキストに「サマリー」「経過」「引き継ぎ」を含む | Summary Agent |
| `app_mention` | テキストに「保存」を含む | Intake Agent（直近メッセージ取得モード） |
| `app_mention` | その他の質問 | Context Agent |
| `/cron/morning-scan` | 定時トリガー | Alert Agent（全患者スキャン） |

**患者IDの解決**: Slackチャンネルの `channel_id` からFirestoreの `patients` コレクションを逆引き（`slack_channel_id` フィールド）。

## 4. Intake Agent

### 4.1 処理パイプライン

```
入力テキスト/ファイル
  │
  ├─ [テキスト] → そのまま
  ├─ [PDF] → pdftotext or Gemini PDF理解 → テキスト抽出
  ├─ [画像] → Gemini Vision API → テキスト抽出
  └─ [音声] → Cloud Speech-to-Text → テキスト（将来）
      │
      ▼
  RAG検索（bound_categories: ["bps", "clinical", "custom"]）
  → BPS分類基準・臨床用語の正規化知識を取得
      │
      ▼
  Gemini API（BPS構造化プロンプト）
      │
      ▼
  BPS構造化JSON出力
      │
      ├→ Firestore patients/{id}/reports/{report_id} 保存
      ├→ patients/{id}/context/current 更新トリガー
      ├→ Alert Agent 即時検知トリガー
      └→ Slack スレッドに確認応答
```

### 4.2 BPS構造化プロンプト

```
[KNOWLEDGE]
{RAGから取得したBPSモデル・臨床用語の知識チャンク}
[/KNOWLEDGE]

[PATIENT_CONTEXT]
患者名: {name}, 年齢: {age}, 性別: {sex}
基礎疾患: {conditions}
直近のBPSサマリー: {current_summary}
[/PATIENT_CONTEXT]

以下の報告テキストをBio-Psycho-Socialフレームワークで構造化してください。

報告者: {reporter_name} ({reporter_type})
報告テキスト:
{raw_text}

以下のJSON形式で出力してください:
{BPS JSON schema}

注意:
- 報告にない情報はnullとする（推測で埋めない）
- バイタルのtrendは過去のコンテキストと比較して判断
- confidenceは構造化の確信度（0.0-1.0）
```

### 4.3 BPS構造化JSON出力スキーマ

```json
{
  "bio": {
    "vitals": [
      { "type": "SpO2", "value": 94, "unit": "%", "trend": "↓", "delta": -2, "period": "1w" }
    ],
    "symptoms": ["食欲低下", "倦怠感"],
    "medications": [
      { "name": "アムロジピン5mg", "adherence": "低下", "note": "週2回忘れ" }
    ],
    "adl": "入浴に介助必要"
  },
  "psycho": {
    "mood": "暗い",
    "cognition": "変化の可能性（家族報告）",
    "concerns": ["意欲低下の可能性"]
  },
  "social": {
    "family": "妻の介護疲労",
    "services": null,
    "concerns": ["介護負担増加傾向"]
  },
  "reporter": "nurse",
  "reporter_name": "看護師A",
  "source_type": "text",
  "raw_text": "本日訪問。SpO2 94%（先週96%）、食欲低下あり。表情やや暗い。",
  "confidence": 0.92,
  "timestamp": "2026-02-03T14:30:00+09:00"
}
```

### 4.4 確認応答フォーマット

```
✅ 保存しました

Bio: SpO2 94%(↓2pt/1w), 食欲低下
Psycho: 表情暗い、意欲低下の可能性
Social: -

📊 確信度: 0.92 | 報告者: 看護師A | ソース: テキスト
```

## 5. Context Agent

### 5.1 処理フロー

```
ユーザー質問 (@bot xxx)
  │
  ├→ Firestore patients/{id}/context/current 取得
  ├→ Firestore patients/{id}/reports (直近10件) 取得
  ├→ RAG検索（bound_categories: 全カテゴリ推奨）
  │   → 質問に関連するナレッジチャンクを取得
  │
  ▼
  Gemini API（分析回答プロンプト）
  │
  ▼
  BPS分析回答テキスト → Slack投稿
```

### 5.2 プロンプト構成

```
[システムプロンプト: 家庭医AIペルソナ]

[KNOWLEDGE]
{RAGから取得した関連ナレッジチャンク}
[/KNOWLEDGE]

[PATIENT_CONTEXT]
患者プロファイル: {基本情報・基礎疾患}
現在のBPSサマリー: {current_summary}
トレンド: {bio_trends, psycho_trends, social_trends}
リスク因子: {risk_factors}
[/PATIENT_CONTEXT]

[RECENT_REPORTS]
{直近10件の構造化報告データ（時系列順）}
[/RECENT_REPORTS]

ユーザーの質問:
{question}

BPSフレームワークに基づいて回答してください。
根拠となった報告は日時と報告者を明示してください。
```

## 6. Alert Agent

### 6.1 検知トリガー

| トリガー | タイミング | 対象 |
|---------|----------|------|
| 即時トリガー | 新規報告Firestore保存時 | 当該患者の過去7日間と比較 |
| 定時トリガー | 朝8時（Cloud Scheduler） | 全患者の過去24時間を横断スキャン |

#### リスクレベル自動再計算

> 実装詳細: `backend/services/risk_service.py`（エスカレーションルール）

Alert Agentがアラートを生成した後、`RiskService.recalculate()` が呼び出され、未確認アラートの件数と重大度に基づいてリスクレベルを自動的に再計算する。AI推論ではなく、決定論的なルールベースのロジックで動作する。

| トリガー | 呼び出し元 |
|---------|-----------|
| アラート生成後 | `alert_agent.py` — 新規アラート保存後 |
| アラート確認後 | `patients.py`, `alerts.py` — acknowledge処理後 |
| 定時スキャン後 | `alerts.py` — morning-scan処理後 |

**エスカレーションルール（優先度順）:**

| 条件 | 結果レベル |
|------|----------|
| 未確認HIGH ≥ 1件 | HIGH |
| 未確認MEDIUM ≥ 2件 | HIGH |
| 未確認MEDIUM = 1件 | MEDIUM |
| 未確認LOW ≥ 3件 | MEDIUM |
| 未確認LOW ≥ 1件 | LOW |
| 全確認済み + 14日以上経過 | LOW |
| 全確認済み + 7〜13日経過 | 1段階下げ |
| 手動設定中 | 自動ディエスカレーション停止 |

### 6.2 BPS異変検知パターン

| ID | パターン名 | 検知条件 | 緊急度 | 推奨アクション |
|----|-----------|---------|--------|--------------|
| A-1 | バイタル低下トレンド | SpO2/BP等が連続2回以上低下 | HIGH | 主治医への早期相談 |
| A-2 | 複合Bio悪化 | 2項目以上のBio指標が同時悪化 | HIGH | 診察・検査の推奨 |
| A-3 | Bio+Psycho複合 | 食欲低下 + 意欲低下 | MEDIUM | うつ病スクリーニング推奨 |
| A-4 | Bio+Social複合 | 服薬低下 + 介護負担増加 | MEDIUM | 服薬管理方法の見直し |
| A-5 | 全軸複合 | Bio + Psycho + Social同時変化 | HIGH | 緊急カンファレンス推奨 |
| A-6 | 認知変化 | 家族からの認知変化報告 | MEDIUM | 認知機能評価の実施推奨 |

### 6.3 検知プロンプト

```
[KNOWLEDGE]
{RAGから取得したガイドライン・閾値・プロトコル}
[/KNOWLEDGE]

[PATIENT_CONTEXT]
{患者基本情報・現在のコンテキスト}
[/PATIENT_CONTEXT]

[NEW_REPORT]
{新規報告の構造化データ}
[/NEW_REPORT]

[HISTORICAL_REPORTS]
{過去7日間の報告データ}
[/HISTORICAL_REPORTS]

以下のアラートパターンと照合し、該当するものがあれば報告してください:
{パターンA-1〜A-6の定義}

出力JSON:
{
  "alerts": [
    {
      "pattern_type": "A-2",
      "pattern_name": "複合Bio悪化",
      "severity": "HIGH",
      "message": "...",
      "evidence": [...],
      "recommended_actions": [...]
    }
  ]
}

該当なしの場合は空配列を返してください。
```

### 6.4 アラート投稿フォーマット

```
⚠️ 複合的悪化徴候を検知しました

🫀 Bio: SpO2低下トレンド(96%→94%/1w) + 食欲低下
🧠 Psycho: 意欲低下の可能性
💊 服薬: 降圧薬アドヒアランス低下(週2回忘れ)

📋 推奨アクション:
• 呼吸器感染症・心不全増悪の除外検査を検討
• 主治医への早期相談を推奨

📎 根拠: 看護師A(2/3 14:30), 薬剤師B(2/4 10:15)
```

### 6.5 朝8時定時レポートフォーマット

```
📊 朝レポート | 2026-02-05（水）

状態変化: 5名 / 全24名

🔴 HIGH (2名)
• 田中太郎(85歳) - SpO2低下+食欲低下+服薬低下+認知変化 → #pt-田中太郎
• 村上トメ(96歳) - 褥瘡悪化+心不全増悪徴候 → #pt-村上トメ

🟡 MED (3名)
• 佐藤美智子(78歳) - 血糖コントロール悪化 → #pt-佐藤美智子
• ...

🟢 変化なし: 19名
```

## 7. Summary Agent

### 7.1 処理フロー

```
@bot サマリー / 定時タスク
  │
  ├→ Firestore patients/{id}/context/current 取得
  ├→ Firestore patients/{id}/reports (直近20件) 取得
  ├→ RAG検索（bound_categories: ["bps","guidelines","homecare","palliative"]）
  │
  ▼
  Gemini API（サマリー生成プロンプト）
  │
  ▼
  BPS経過サマリー → Slack投稿
```

### 7.2 サマリー出力フォーマット

```
📋 田中太郎さん BPSサマリー（2026-02-05時点）

🫀 Biological
• SpO2: 94%(↓2pt/1w) — 要経過観察
• 食欲: 低下（2/3〜）
• 服薬: 降圧薬アドヒアランス低下（週2回忘れ）
• BP 148/92 安定、HbA1c 7.2%(↑0.3/3m)

🧠 Psychological
• 表情暗い、意欲低下傾向
• 認知変化の可能性（家族報告あり）
• GDS・MMSE未実施

👥 Social
• 妻(82歳)と二人暮らし。介護負担増加傾向
• 訪看週2回、デイサービス週1回
• 来週担当者会議予定

⚠️ 注意点
• SpO2低下+食欲低下 → 呼吸器感染症/心不全増悪の除外を推奨
• 認知変化+服薬低下 → 認知機能評価・服薬管理方法見直しを検討
```

---

## 8. RAGナレッジベース設計

### 8.1 アーキテクチャ

> ✅ **実装状況**: RAG全パイプライン実装完了（テキスト抽出→チャンキング→Embedding生成→Firestore保存→cosine similarity検索）

```
ドキュメント (PDF/TXT/MD/DOCX)
  │
  ▼
テキスト抽出 (PyPDF2/python-docx) + アップロード (POST /api/knowledge/documents/{id}/upload)
  │
  ▼
チャンキング (段落境界優先, 500文字, 50 overlap, max 100チャンク)
  │
  ▼
Embedding生成 (google-genai gemini-embedding-001, 768次元, バッチ20件)
  │
  ▼
Firestore保存 (organizations/{org_id}/knowledge/{doc_id}/chunks/{chunk_id})
  │
  ▼
検索時: クエリEmbed → 全チャンク取得(カテゴリフィルタ) → cosine similarity → Top-K返却
```

### 8.2 ナレッジカテゴリ

| ID | カテゴリ名 | 内容例 |
|----|-----------|-------|
| `bps` | BPSモデル | Engelの理論、PCCM、家族システム理論 |
| `clinical` | 臨床推論 | 仮説演繹法、パターン認識、鑑別診断フレームワーク |
| `guidelines` | 診療ガイドライン | COPD、心不全、糖尿病等の管理ガイドライン |
| `homecare` | 在宅医療制度 | 多職種連携モデル、介護保険制度、訪問診療報酬 |
| `palliative` | 緩和ケア | 在宅看取り、症状緩和、ACP |
| `geriatric` | 老年医学 | フレイル、認知症BPSD、ポリファーマシー、栄養管理 |
| `medication` | 薬剤管理 | 薬物相互作用、腎機能別用量調整、服薬アドヒアランス |
| `custom` | 院内プロトコル | オンコール対応手順、急変時フロー、カンファレンス書式 |

### 8.3 チャンキング設定

| パラメータ | デフォルト値 | 説明 |
|-----------|-----------|------|
| chunk_size | 500文字（characters） | チャンクの最大文字数（`len()`による文字数カウント） |
| chunk_overlap | 50文字 | 隣接チャンク間のオーバーラップ（文字数） |
| separator | 段落・セクション区切り優先 | 意味的な境界を尊重 |

### 8.4 エージェント別カテゴリバインド

| エージェント | バインドカテゴリ | 理由 |
|-------------|----------------|------|
| Intake | bps, clinical, custom | BPS分類基準の正確性、臨床用語の正規化 |
| Context | 全カテゴリ推奨 | 幅広い質問に包括的に対応 |
| Alert | guidelines, clinical, medication, custom | ガイドライン閾値、プロトコルとの照合 |
| Summary | bps, guidelines, homecare, palliative | BPSフレームワーク準拠、制度的文脈 |

### 8.5 検索パラメータ

| パラメータ | 値 | 説明 |
|-----------|-----|------|
| top_k | 5 | 取得チャンク数 |
| similarity_threshold | 0.7 | 最低類似度スコア |
| distance_metric | cosine | 類似度計算方式 |
| filter | bound_categories | エージェントバインドでフィルタ |

### 8.6 Geminiへの注入方式

```
[KNOWLEDGE]
以下は関連するナレッジベースからの情報です。回答の根拠として活用してください。

Source: 在宅COPD患者の急性増悪予防と管理 (guidelines)
---
SpO2の経時的モニタリングにおいて、安定期のベースラインから2%以上の低下が
3日以上持続する場合、急性増悪の初期段階である可能性を考慮する...

Source: Bio-Psycho-Socialモデルの理論的基盤 (bps)
---
Biological面の変化は、しばしばPsychological面の変化と並行して生じる...
[/KNOWLEDGE]
```

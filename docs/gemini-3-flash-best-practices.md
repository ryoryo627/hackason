# Gemini 3.0 Flash API ベストプラクティス

本プロジェクトで使用するGemini 3.0 Flash APIの実装ガイドライン。

## 1. モデル概要

| 項目 | 値 |
|------|-----|
| モデルID | `gemini-3.0-flash` |
| コンテキストウィンドウ | 1M tokens (入力) |
| 最大出力トークン | 64K tokens |
| 料金（入力） | $0.50 / 1M tokens |
| 料金（出力） | $3.00 / 1M tokens |
| 知識カットオフ | 2025年1月 |

## 2. Thinking Level（推論レベル）

Gemini 3.0ではデフォルトで動的推論が有効。`thinking_level`パラメータで制御可能。

| レベル | 用途 | 本プロジェクトでの使用場面 |
|--------|------|--------------------------|
| `minimal` | 最低レイテンシ、単純タスク | 確認応答、シンプルな質問 |
| `low` | 軽量な推論 | Intake Agentの構造化（軽量報告） |
| `medium` | バランス重視 | Context Agent、Summary Agent |
| `high` | 最大深度（デフォルト） | Alert Agentの異変検知、複雑な臨床推論 |

### エージェント別推奨設定

```python
AGENT_THINKING_LEVELS = {
    "intake": "low",      # BPS構造化は比較的シンプル
    "context": "medium",  # 質問応答は中程度の推論
    "alert": "high",      # 異変検知は深い分析が必要
    "summary": "medium",  # サマリー生成は中程度
}
```

## 3. Thought Signatures（思考署名）— 重要

Gemini 3.0では**Thought Signatures**が必須。これはモデルの内部思考プロセスの暗号化表現であり、APIコール間で推論コンテキストを維持するために使用される。

### 基本ルール

1. **受け取ったsignaturesは必ず次のリクエストに返す**
2. **`minimal`レベルでもsignaturesの循環は必須**
3. **欠落すると400エラー（Function Calling時）または品質低下**

### 実装パターン

```python
from google.generativeai import GenerativeModel

class GeminiAgent:
    def __init__(self, model_name="gemini-3.0-flash"):
        self.model = GenerativeModel(model_name)
        self.thought_signatures = None

    async def generate(self, prompt: str, thinking_level: str = "medium"):
        config = {
            "thinking_level": thinking_level,
        }

        # 前回のsignaturesを含める
        if self.thought_signatures:
            config["thought_signatures"] = self.thought_signatures

        response = await self.model.generate_content_async(
            prompt,
            generation_config=config
        )

        # signaturesを保存（次回のリクエストで使用）
        if hasattr(response, 'thought_signatures'):
            self.thought_signatures = response.thought_signatures

        return response.text
```

### 非Gemini Function Callの注入

外部ツールの結果をGemini 3.0に渡す場合、ダミーsignatureを使用：

```python
DUMMY_SIGNATURE = "context_engineering_is_the_way_to_go"
```

## 4. Temperature設定

**推奨: デフォルト値 `1.0` をそのまま使用**

- 低いtemperatureを設定するとループや性能低下の原因に
- 複雑なタスクでは特に問題が発生しやすい
- 決定論的な出力が必要な場合も1.0を維持し、プロンプトで制御

```python
# ❌ 非推奨
config = {"temperature": 0.2}

# ✅ 推奨（デフォルトのまま）
config = {}  # temperatureは指定しない
```

## 5. マルチモーダル入力

### Media Resolution設定

| レベル | トークン数/画像 | 用途 |
|--------|----------------|------|
| `low` | 280 | サムネイル、簡易確認 |
| `medium` | 560 | 一般的なドキュメント |
| `high` | 1,120 | 医療画像、詳細分析（推奨） |
| `ultra_high` | 可変 | 極めて詳細な画像分析 |

### 本プロジェクトでの設定

```python
MEDIA_RESOLUTION_CONFIG = {
    "pdf_documents": "medium",      # 看護記録PDFなど
    "medical_images": "high",       # 褥瘡写真、バイタルモニタ画像
    "general_photos": "medium",     # 一般的な写真
}
```

## 6. プロンプト設計のベストプラクティス

### 基本原則

1. **簡潔で直接的な指示**
   - Gemini 3.0は直接的で効率的な回答を好む
   - 会話的なトーンが必要な場合は明示的に要求

2. **コンテキストの配置**
   - 大量のデータがある場合、**データを先に、指示を後に**

```python
# ✅ 推奨パターン
prompt = f"""
[PATIENT_CONTEXT]
{patient_data}
[/PATIENT_CONTEXT]

[RECENT_REPORTS]
{reports_json}
[/RECENT_REPORTS]

上記の患者データを分析し、BPSフレームワークで構造化してください。
出力は以下のJSON形式で:
{json_schema}
"""
```

3. **構造化出力**
   - Function CallingやStructured Outputを活用
   - JSON Schemaを明示的に指定

## 7. コスト最適化

### Context Caching

繰り返し使用するトークンがある場合、**90%のコスト削減**が可能。

```python
# RAGのナレッジチャンクなど、頻繁に使うコンテキストをキャッシュ
cached_context = {
    "bps_framework": "...",  # BPSモデルの説明
    "alert_patterns": "...",  # アラートパターン定義
}
```

### Batch API

非同期処理が許容される場合、**50%のコスト削減**。

- 朝8時定時レポート生成
- 大量の過去データ分析

## 8. エラーハンドリング

### Thought Signatures関連エラー

```python
try:
    response = await model.generate_content_async(prompt, config)
except google.api_core.exceptions.InvalidArgument as e:
    if "thought_signatures" in str(e):
        # signaturesをリセットして再試行
        self.thought_signatures = None
        response = await model.generate_content_async(prompt, config)
```

### レート制限

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=60)
)
async def call_gemini(prompt: str):
    return await model.generate_content_async(prompt)
```

## 9. セキュリティ考慮事項

### APIキー管理

- **Secret Manager**に保存（Firestoreには参照IDのみ）
- リクエストごとに取得、使用後は即破棄
- ローカル環境変数は開発時のみ

### 入力検証

- ユーザー入力は必ずサニタイズ
- プロンプトインジェクション対策

```python
def sanitize_input(text: str) -> str:
    # 制御文字の除去
    text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    # 長さ制限
    return text[:10000]
```

## 10. 本プロジェクトでの実装例

### Intake Agent

```python
async def intake_agent(report_text: str, patient_context: dict):
    prompt = f"""
[KNOWLEDGE]
{await get_rag_chunks(["bps", "clinical"])}
[/KNOWLEDGE]

[PATIENT_CONTEXT]
患者名: {patient_context['name']}, 年齢: {patient_context['age']}
基礎疾患: {', '.join(patient_context['conditions'])}
[/PATIENT_CONTEXT]

以下の報告テキストをBio-Psycho-Socialフレームワークで構造化してください。

報告テキスト:
{report_text}

JSON形式で出力:
{BPS_SCHEMA}
"""

    response = await gemini_agent.generate(
        prompt,
        thinking_level="low"
    )
    return parse_bps_json(response)
```

## 参考リンク

- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Gemini 3 Flash on Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-flash)
- [Google Blog: Build with Gemini 3 Flash](https://blog.google/technology/developers/build-with-gemini-3-flash/)

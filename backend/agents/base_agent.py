"""
Base Agent - Foundation for all AI agents in HomeCare AI.

Provides common functionality for Gemini API integration and BPS processing.
"""

import re
from abc import ABC, abstractmethod
from typing import Any

from google import genai
from google.genai import types

from config import get_settings


# Shared system prompt for all agents
SHARED_SYSTEM_PROMPT = """あなたは家庭医療に精通したAIアシスタントです。
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
"""


DEFAULT_AGENT_PROMPTS = {
    "intake": "あなたは報告テキストをBPS形式に構造化するエキスパートです。正確かつ客観的に情報を抽出してください。",
    "context": (
        "あなたは患者に関する質問に答える医療AIアシスタントです。\n"
        "患者の経過データとナレッジベースを参照し、"
        "エビデンスに基づいた回答を提供してください。"
    ),
    "alert": (
        "あなたは患者の状態変化を監視する医療AIです。\n"
        "異変パターンを検知し、適切なアラートを生成してください。\n"
        "誤検知を避けつつ、重要な変化を見逃さないよう注意してください。"
    ),
    "summary": (
        "あなたは患者のBPS経過サマリーを作成する医療AIです。\n"
        "報告データを統合し、ケア連携に役立つサマリーを生成してください。\n"
        "重要な変化や注意点を明確に示してください。"
    ),
}


class BaseAgent(ABC):
    """Base class for all HomeCare AI agents."""

    def __init__(
        self,
        thinking_level: str = "medium",
        system_prompt: str | None = None,
        api_key: str | None = None,
        shared_prompt: str | None = None,
    ):
        """
        Initialize the base agent.

        Args:
            thinking_level: Thinking level for Gemini (low, medium, high)
            system_prompt: Custom system prompt (extends shared prompt)
            api_key: Gemini API key (from Firestore service_configs)
            shared_prompt: Custom shared prompt (overrides SHARED_SYSTEM_PROMPT)
        """
        self.thinking_level = thinking_level
        base = shared_prompt if shared_prompt is not None else SHARED_SYSTEM_PROMPT
        self.system_prompt = (base + "\n\n" + (system_prompt or "")).strip()
        self._api_key = api_key
        self._client: genai.Client | None = None
        self._thought_signatures: Any = None

    @property
    def client(self) -> genai.Client:
        """Get or create Gemini client using the provided API key."""
        if self._client is None:
            if self._api_key:
                self._client = genai.Client(api_key=self._api_key)
            else:
                # Use default credentials (for Cloud Run with service account)
                self._client = genai.Client()
        return self._client

    @classmethod
    async def get_gemini_api_key(cls, org_id: str) -> str | None:
        """
        Get Gemini API key from Firestore service_configs.

        Args:
            org_id: Organization ID

        Returns:
            API key string or None if not configured
        """
        from services.firestore_service import FirestoreService
        config = await FirestoreService.get_service_config(org_id, "gemini")
        if config:
            return config.get("gemini_api_key")
        return None

    @classmethod
    async def get_agent_prompts(cls, org_id: str) -> dict:
        """
        Get custom agent prompts from Firestore service_configs.

        Args:
            org_id: Organization ID

        Returns:
            Dict with shared_prompt and agent_prompts, or empty dict
        """
        from services.firestore_service import FirestoreService
        return await FirestoreService.get_service_config(org_id, "agent_prompts") or {}

    async def generate(
        self,
        prompt: str,
        json_mode: bool = False,
        temperature: float = 1.0,
    ) -> str:
        """
        Generate content using Gemini API.

        Args:
            prompt: The prompt to send to Gemini
            json_mode: Whether to request JSON output
            temperature: Temperature for generation (default 1.0 for Gemini 3.0)

        Returns:
            Generated text response
        """
        settings = get_settings()

        # Build generation config
        config_dict: dict[str, Any] = {
            "temperature": temperature,
        }

        # Add thinking config for Gemini 3.0
        if self.thinking_level:
            thinking_config = types.ThinkingConfig(
                thinking_budget=self._get_thinking_budget()
            )
            config_dict["thinking_config"] = thinking_config

        # Add thought signatures if we have them (for continuity)
        if self._thought_signatures:
            config_dict["thought_signatures"] = self._thought_signatures

        # Add JSON mode if requested
        if json_mode:
            config_dict["response_mime_type"] = "application/json"

        # Pass system prompt as system_instruction
        if self.system_prompt:
            config_dict["system_instruction"] = self.system_prompt

        config = types.GenerateContentConfig(**config_dict)

        # Build the full prompt with user content
        full_contents = [
            types.Content(
                role="user",
                parts=[types.Part(text=prompt)],
            )
        ]

        response = await self.client.aio.models.generate_content(
            model=settings.gemini_model,
            contents=full_contents,
            config=config,
        )

        # Store thought signatures for future requests
        if hasattr(response, "thought_signatures"):
            self._thought_signatures = response.thought_signatures

        text = response.text or ""
        if json_mode:
            text = self._extract_json_text(text)
        return text

    @staticmethod
    def _extract_json_text(text: str) -> str:
        """Extract JSON from response that may be wrapped in markdown code fences."""
        stripped = text.strip()
        # Remove markdown code fences (```json ... ``` or ``` ... ```)
        fence_match = re.search(r"```(?:json)?\s*\n?(.*?)```", stripped, re.DOTALL)
        if fence_match:
            stripped = fence_match.group(1).strip()
        # Find first JSON object or array
        for i, ch in enumerate(stripped):
            if ch in ("{", "["):
                return stripped[i:]
        return stripped

    def _get_thinking_budget(self) -> int:
        """Get thinking budget based on thinking level."""
        budgets = {
            "low": 1024,
            "medium": 8192,
            "high": 24576,
        }
        return budgets.get(self.thinking_level, 8192)

    @abstractmethod
    async def process(self, **kwargs: Any) -> Any:
        """
        Process the agent's main task.

        Must be implemented by subclasses.
        """
        pass

    def build_patient_context(
        self,
        patient: dict[str, Any],
        context: dict[str, Any] | None = None,
    ) -> str:
        """
        Build the patient context block for prompts.

        Args:
            patient: Patient data from Firestore
            context: Current BPS context (optional)

        Returns:
            Formatted patient context string
        """
        parts = [
            "[PATIENT_CONTEXT]",
            f"患者名: {patient.get('name', '不明')}",
            f"年齢: {patient.get('age', '不明')}歳",
            f"性別: {patient.get('gender', '不明')}",
            f"主病名: {patient.get('primary_diagnosis', '未設定')}",
        ]

        if context:
            bio = context.get("bio", {})
            psycho = context.get("psycho", {})
            social = context.get("social", {})

            if bio:
                parts.append(f"Bio概要: {self._summarize_bps_section(bio)}")
            if psycho:
                parts.append(f"Psycho概要: {self._summarize_bps_section(psycho)}")
            if social:
                parts.append(f"Social概要: {self._summarize_bps_section(social)}")

        parts.append("[/PATIENT_CONTEXT]")
        return "\n".join(parts)

    def _summarize_bps_section(self, section: dict[str, Any]) -> str:
        """Summarize a BPS section into a brief string."""
        items = []
        for key, value in section.items():
            if value:
                if isinstance(value, list):
                    items.append(f"{key}: {', '.join(str(v) for v in value)}")
                else:
                    items.append(f"{key}: {value}")
        return "; ".join(items) if items else "特記なし"

    def build_knowledge_block(self, chunks: list[dict[str, Any]]) -> str:
        """
        Build the knowledge block from RAG chunks.

        Args:
            chunks: List of knowledge chunks from RAG

        Returns:
            Formatted knowledge block string
        """
        if not chunks:
            return ""

        parts = ["[KNOWLEDGE]"]
        for chunk in chunks:
            source = chunk.get("source", "不明")
            category = chunk.get("category", "")
            text = chunk.get("text", "")
            parts.append(f"Source: {source} ({category})")
            parts.append("---")
            parts.append(text)
            parts.append("")
        parts.append("[/KNOWLEDGE]")
        return "\n".join(parts)

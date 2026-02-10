"""
Configuration management for HomeCare AI Agent.
Loads settings from environment variables and Secret Manager.
"""

from functools import lru_cache
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # GCP Project
    google_cloud_project: str = Field(default="aihomecare-486506")
    gcp_region: str = Field(default="asia-northeast1")

    # Firestore
    firestore_database_id: str = Field(default="(default)")

    # Cloud Storage
    gcs_bucket_name: str = Field(default="homecare-ai-files")
    gcs_knowledge_bucket: str = Field(default="homecare-ai-knowledge")

    # Vertex AI
    vertex_ai_region: str = Field(default="asia-northeast1")
    embedding_model: str = Field(default="text-embedding-005")

    # Gemini
    gemini_model: str = Field(default="gemini-3-flash-preview")
    gemini_api_key: str | None = Field(default=None)

    # Slack (direct values for development, use Secret Manager in production)
    slack_bot_token: str | None = Field(default=None)
    slack_signing_secret: str | None = Field(default=None)

    # Admin UI URL (for CORS)
    admin_ui_url: str = Field(default="http://localhost:3000")

    # Server
    host: str = Field(default="0.0.0.0")
    port: int = Field(default=8080)
    debug: bool = Field(default=False)

    # Secret Manager references (resolved at runtime)
    slack_bot_token_secret: str = Field(default="slack-bot-token")
    slack_signing_secret_secret: str = Field(default="slack-signing-secret")
    gemini_api_key_secret: str = Field(default="gemini-api-key")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


class SecretManager:
    """Utility for fetching secrets from Google Cloud Secret Manager."""

    _client: Any = None

    @classmethod
    def _get_client(cls) -> Any:
        """Get or create Secret Manager client."""
        if cls._client is None:
            from google.cloud import secretmanager

            cls._client = secretmanager.SecretManagerServiceClient()
        return cls._client

    @classmethod
    def get_secret(cls, secret_id: str, version: str = "latest") -> str:
        """
        Fetch a secret value from Secret Manager.

        Args:
            secret_id: The secret ID (e.g., "slack-bot-token")
            version: The version to fetch (default: "latest")

        Returns:
            The secret value as a string
        """
        settings = get_settings()
        client = cls._get_client()

        name = f"projects/{settings.google_cloud_project}/secrets/{secret_id}/versions/{version}"
        response = client.access_secret_version(request={"name": name})

        return response.payload.data.decode("UTF-8")

    @classmethod
    def get_secret_from_ref(cls, secret_ref: str) -> str:
        """
        Fetch a secret value from a full Secret Manager reference.

        Args:
            secret_ref: Full reference (e.g., "projects/xxx/secrets/yyy/versions/latest")

        Returns:
            The secret value as a string
        """
        client = cls._get_client()
        response = client.access_secret_version(request={"name": secret_ref})
        return response.payload.data.decode("UTF-8")

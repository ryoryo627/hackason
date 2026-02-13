"""
Cloud Storage Service - GCS operations for file storage.

Provides upload, signed URL generation, and deletion for
knowledge documents and Slack attachments.
"""

import asyncio
import logging
import re
from datetime import timedelta
from typing import Any

import google.auth
from google.auth.transport import requests as auth_requests
from google.cloud import storage

logger = logging.getLogger(__name__)

from config import get_settings


class StorageService:
    """Service class for Google Cloud Storage operations."""

    _client: storage.Client | None = None

    @classmethod
    def get_client(cls) -> storage.Client:
        """Get or create GCS client (lazy init)."""
        if cls._client is None:
            settings = get_settings()
            cls._client = storage.Client(project=settings.google_cloud_project)
        return cls._client

    @classmethod
    def _parse_gcs_uri(cls, gcs_uri: str) -> tuple[str, str]:
        """
        Parse a gs:// URI into (bucket_name, blob_path).

        Args:
            gcs_uri: URI like "gs://bucket-name/path/to/file"

        Returns:
            Tuple of (bucket_name, blob_path)
        """
        match = re.match(r"^gs://([^/]+)/(.+)$", gcs_uri)
        if not match:
            raise ValueError(f"Invalid GCS URI: {gcs_uri}")
        return match.group(1), match.group(2)

    @classmethod
    async def upload_file(
        cls,
        bucket_name: str,
        destination_path: str,
        file_bytes: bytes,
        content_type: str = "application/octet-stream",
    ) -> str:
        """
        Upload a file to GCS.

        Args:
            bucket_name: GCS bucket name
            destination_path: Object path in bucket
            file_bytes: File content as bytes
            content_type: MIME type of the file

        Returns:
            GCS URI (gs://bucket/path)
        """

        def _upload() -> str:
            client = cls.get_client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(destination_path)
            blob.upload_from_string(file_bytes, content_type=content_type)
            return f"gs://{bucket_name}/{destination_path}"

        return await asyncio.to_thread(_upload)

    @classmethod
    async def generate_signed_url(
        cls,
        gcs_uri: str,
        expiration_minutes: int = 15,
    ) -> str:
        """
        Generate a v4 signed URL for a GCS object.

        Args:
            gcs_uri: GCS URI (gs://bucket/path)
            expiration_minutes: URL expiration in minutes

        Returns:
            Signed URL string
        """
        bucket_name, blob_path = cls._parse_gcs_uri(gcs_uri)

        def _sign() -> str:
            credentials, _project = google.auth.default()
            sa_email = getattr(credentials, "service_account_email", None)
            if not sa_email or "@" not in sa_email:
                import requests as req

                sa_email = req.get(
                    "http://metadata.google.internal/computeMetadata/v1/"
                    "instance/service-accounts/default/email",
                    headers={"Metadata-Flavor": "Google"},
                ).text
            credentials.refresh(auth_requests.Request())

            client = cls.get_client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(minutes=expiration_minutes),
                method="GET",
                response_disposition="inline",
                service_account_email=sa_email,
                access_token=credentials.token,
            )
            return url

        return await asyncio.to_thread(_sign)

    @classmethod
    async def delete_file(cls, gcs_uri: str) -> bool:
        """
        Delete a file from GCS.

        Args:
            gcs_uri: GCS URI (gs://bucket/path)

        Returns:
            True if deleted, False if not found
        """
        bucket_name, blob_path = cls._parse_gcs_uri(gcs_uri)

        def _delete() -> bool:
            client = cls.get_client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(blob_path)
            if blob.exists():
                blob.delete()
                return True
            return False

        return await asyncio.to_thread(_delete)

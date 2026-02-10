"""
Slack request signature verification.

Implements HMAC-SHA256 signature verification for Slack Events API.
Signing secrets are stored in Firestore service_configs, not in environment variables.
"""

import hashlib
import hmac
import time
from typing import Callable

from fastapi import HTTPException, Request

from services.firestore_service import FirestoreService


async def verify_slack_signature(request: Request) -> tuple[bytes, str]:
    """
    Verify the Slack request signature.

    Slack signs requests using HMAC-SHA256 with the signing secret.
    The signing secret is fetched from Firestore service_configs.

    For multi-tenant support, all org signing secrets are checked until
    one matches (since we don't know the org before verifying the signature).

    Args:
        request: FastAPI Request object

    Returns:
        Tuple of (request body bytes, org_id) if valid

    Raises:
        HTTPException: If signature verification fails
    """
    # Get the signature and timestamp from headers
    slack_signature = request.headers.get("X-Slack-Signature", "")
    slack_timestamp = request.headers.get("X-Slack-Request-Timestamp", "")

    if not slack_signature or not slack_timestamp:
        raise HTTPException(
            status_code=400,
            detail="Missing Slack signature headers",
        )

    # Check timestamp to prevent replay attacks (5 minute window)
    try:
        timestamp = int(slack_timestamp)
        current_time = int(time.time())
        if abs(current_time - timestamp) > 60 * 5:
            raise HTTPException(
                status_code=400,
                detail="Request timestamp is too old",
            )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid timestamp",
        )

    # Get the request body
    body = await request.body()

    # Create the signature base string
    sig_basestring = f"v0:{slack_timestamp}:{body.decode('utf-8')}"

    # Get all Slack configs from Firestore to find the matching signing secret
    slack_configs = await FirestoreService.list_service_configs("slack")

    for config in slack_configs:
        signing_secret = config.get("slack_signing_secret")
        if not signing_secret:
            continue

        # Calculate the expected signature
        expected_signature = (
            "v0="
            + hmac.new(
                signing_secret.encode("utf-8"),
                sig_basestring.encode("utf-8"),
                hashlib.sha256,
            ).hexdigest()
        )

        # Compare signatures using constant-time comparison
        if hmac.compare_digest(expected_signature, slack_signature):
            org_id = config.get("org_id", "")
            return body, org_id

    # No matching signing secret found
    raise HTTPException(
        status_code=400,
        detail="Invalid Slack signature. Signing Secretが正しく設定されているか確認してください。",
    )


def get_signature_verifier() -> Callable:
    """
    Get the signature verification dependency.

    Returns a dependency that can be used with FastAPI's Depends.
    """
    return verify_slack_signature

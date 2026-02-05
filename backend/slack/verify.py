"""
Slack request signature verification.

Implements HMAC-SHA256 signature verification for Slack Events API.
"""

import hashlib
import hmac
import time
from typing import Callable

from fastapi import HTTPException, Request

from config import get_settings


async def verify_slack_signature(request: Request) -> bytes:
    """
    Verify the Slack request signature.
    
    Slack signs requests using HMAC-SHA256 with the signing secret.
    This function validates the signature to ensure the request is from Slack.
    
    Args:
        request: FastAPI Request object
        
    Returns:
        The request body bytes if valid
        
    Raises:
        HTTPException: If signature verification fails
    """
    settings = get_settings()
    signing_secret = settings.slack_signing_secret
    
    if not signing_secret:
        # In demo mode without signing secret, skip verification
        return await request.body()
    
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
    if not hmac.compare_digest(expected_signature, slack_signature):
        raise HTTPException(
            status_code=400,
            detail="Invalid Slack signature",
        )
    
    return body


def get_signature_verifier() -> Callable:
    """
    Get the signature verification dependency.
    
    Returns a dependency that can be used with FastAPI's Depends.
    """
    return verify_slack_signature

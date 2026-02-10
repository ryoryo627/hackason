"""
FastAPI authentication dependencies using Firebase Admin SDK.

Provides get_current_user and require_admin for endpoint protection.
"""

from dataclasses import dataclass

import firebase_admin
from firebase_admin import auth as firebase_auth, credentials
from fastapi import Depends, HTTPException, Request

from services.firestore_service import FirestoreService

# Lazy-initialize Firebase Admin SDK (Cloud Run auto-detects service account)
_firebase_app: firebase_admin.App | None = None


def _ensure_firebase_app() -> firebase_admin.App:
    """Initialize Firebase Admin SDK if not already done."""
    global _firebase_app
    if _firebase_app is None:
        try:
            _firebase_app = firebase_admin.get_app()
        except ValueError:
            _firebase_app = firebase_admin.initialize_app()
    return _firebase_app


@dataclass
class UserContext:
    """Authenticated user context extracted from Firebase token + Firestore."""

    uid: str
    email: str
    role: str
    organization_id: str | None


async def get_current_user(request: Request) -> UserContext:
    """
    FastAPI dependency: verify Firebase ID token and return UserContext.

    Extracts Bearer token from Authorization header, verifies with Firebase Admin SDK,
    then fetches user data from Firestore for role and organization info.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="認証トークンが必要です")

    token = auth_header.split("Bearer ", 1)[1]

    try:
        _ensure_firebase_app()
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="無効な認証トークンです")

    uid = decoded.get("uid", "")
    email = decoded.get("email", "")

    # Fetch user data from Firestore for role and org info
    user = await FirestoreService.get_user(uid)
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    return UserContext(
        uid=uid,
        email=email,
        role=user.get("role", "user"),
        organization_id=user.get("organization_id"),
    )


async def require_admin(user: UserContext = Depends(get_current_user)) -> UserContext:
    """
    FastAPI dependency: require admin role.

    Depends on get_current_user, then checks role == "admin".
    """
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="管理者権限が必要です")
    return user

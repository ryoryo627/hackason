"""
Users API - User management endpoints for admin users.
"""

from typing import Any, Literal

import firebase_admin
from firebase_admin import auth as firebase_auth
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth.dependencies import UserContext, require_admin, _ensure_firebase_app
from services.firestore_service import FirestoreService

router = APIRouter()


class CreateUserRequest(BaseModel):
    email: str
    password: str = Field(min_length=6)
    display_name: str = ""
    role: Literal["admin", "user"] = "user"


class UpdateRoleRequest(BaseModel):
    role: Literal["admin", "user"]


@router.get("")
async def list_users(admin: UserContext = Depends(require_admin)) -> dict[str, Any]:
    """List all users in the admin's organization."""
    if not admin.organization_id:
        raise HTTPException(status_code=400, detail="組織が設定されていません")

    users = await FirestoreService.list_users_by_org(admin.organization_id)
    return {"users": users, "total": len(users)}


@router.post("")
async def create_user(
    body: CreateUserRequest,
    admin: UserContext = Depends(require_admin),
) -> dict[str, Any]:
    """Create a new user in Firebase Auth and Firestore."""
    if not admin.organization_id:
        raise HTTPException(status_code=400, detail="組織が設定されていません")

    _ensure_firebase_app()

    # Create Firebase Auth user
    try:
        fb_user = firebase_auth.create_user(
            email=body.email,
            password=body.password,
            display_name=body.display_name or body.email.split("@")[0],
        )
    except firebase_admin.exceptions.AlreadyExistsError:
        raise HTTPException(status_code=409, detail="このメールアドレスは既に登録されています")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ユーザー作成に失敗しました: {e}")

    # Create Firestore user document
    user_data = {
        "email": body.email,
        "display_name": body.display_name or body.email.split("@")[0],
        "organization_id": admin.organization_id,
        "role": body.role,
    }
    await FirestoreService.create_user(fb_user.uid, user_data)

    return {"success": True, "uid": fb_user.uid}


@router.put("/{uid}/role")
async def update_user_role(
    uid: str,
    body: UpdateRoleRequest,
    admin: UserContext = Depends(require_admin),
) -> dict[str, Any]:
    """Update a user's role."""
    # Prevent self-demotion
    if uid == admin.uid:
        raise HTTPException(status_code=400, detail="自分自身のロールは変更できません")

    # Verify target user exists and belongs to same org
    target = await FirestoreService.get_user(uid)
    if not target:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    if target.get("organization_id") != admin.organization_id:
        raise HTTPException(status_code=403, detail="他の組織のユーザーは変更できません")

    await FirestoreService.update_user(uid, {"role": body.role})
    return {"success": True, "uid": uid, "role": body.role}


@router.delete("/{uid}")
async def delete_user(
    uid: str,
    admin: UserContext = Depends(require_admin),
) -> dict[str, Any]:
    """Delete a user from Firebase Auth and Firestore."""
    # Prevent self-deletion
    if uid == admin.uid:
        raise HTTPException(status_code=400, detail="自分自身は削除できません")

    # Verify target user exists and belongs to same org
    target = await FirestoreService.get_user(uid)
    if not target:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    if target.get("organization_id") != admin.organization_id:
        raise HTTPException(status_code=403, detail="他の組織のユーザーは削除できません")

    # Delete from Firebase Auth
    _ensure_firebase_app()
    try:
        firebase_auth.delete_user(uid)
    except Exception as e:
        print(f"[WARN] Firebase Auth user deletion failed for {uid}: {e}")

    # Delete from Firestore
    await FirestoreService.delete_user(uid)

    return {"success": True, "uid": uid}

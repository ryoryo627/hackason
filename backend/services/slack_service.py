"""
Slack Service - Slack API operations for HomeCare AI Agent.

Handles channel creation, bot configuration, and message posting.
"""

from typing import Any

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError


class SlackService:
    """Service class for Slack API operations."""

    _bot_user_ids: dict[str, str] = {}  # token -> bot_user_id

    @classmethod
    def get_client(cls, token: str | None = None) -> WebClient:
        """
        Get Slack WebClient with the given token.

        A token must always be provided. Credentials are stored in
        Firestore service_configs, not in environment variables.
        """
        if not token:
            raise ValueError(
                "Slack Bot Tokenが指定されていません。"
                "Firestoreのservice_configsからトークンを取得して渡してください。"
            )
        return WebClient(token=token)

    @classmethod
    async def get_bot_token(cls, org_id: str) -> str | None:
        """
        Get Slack Bot Token from Firestore service_configs.

        Args:
            org_id: Organization ID

        Returns:
            Bot token string or None if not configured
        """
        from services.firestore_service import FirestoreService
        config = await FirestoreService.get_service_config(org_id, "slack")
        if config:
            return config.get("slack_bot_token")
        return None

    @classmethod
    async def get_signing_secret(cls, org_id: str) -> str | None:
        """
        Get Slack Signing Secret from Firestore service_configs.

        Args:
            org_id: Organization ID

        Returns:
            Signing secret string or None if not configured
        """
        from services.firestore_service import FirestoreService
        config = await FirestoreService.get_service_config(org_id, "slack")
        if config:
            return config.get("slack_signing_secret")
        return None

    @classmethod
    async def test_connection(cls, token: str) -> dict[str, Any]:
        """
        Test Slack connection with the given token.

        Returns:
            dict with success status, team info, and bot info
        """
        try:
            client = cls.get_client(token)

            # Test auth
            auth_response = client.auth_test()
            if not auth_response["ok"]:
                return {
                    "success": False,
                    "error": "認証に失敗しました。トークンを確認してください。",
                }

            # Build result with auth info (always available)
            result = {
                "success": True,
                "team": {
                    "id": auth_response["team_id"],
                    "name": auth_response["team"],
                    "domain": "",  # Will try to get from team_info
                },
                "bot": {
                    "id": auth_response["user_id"],
                    "name": auth_response["user"],
                },
            }

            # Try to get team info (requires team:read scope, optional)
            try:
                team_info = client.team_info()
                result["team"]["domain"] = team_info["team"].get("domain", "")
            except SlackApiError as e:
                # team:read scope not available, but connection is still valid
                if e.response.get("error") == "missing_scope":
                    result["warning"] = "team:read スコープがないため一部情報を取得できません"
                # Don't fail the whole test for this

            return result

        except SlackApiError as e:
            error_code = e.response.get("error", "unknown")
            error_messages = {
                "invalid_auth": "無効なトークンです。Bot User OAuth Tokenを確認してください。",
                "token_revoked": "トークンが無効化されています。新しいトークンを発行してください。",
                "missing_scope": "必要な権限がありません。OAuth & Permissions で以下のスコープを追加してください: chat:write, channels:manage, users:read",
                "not_authed": "認証されていません。トークンを確認してください。",
            }
            error_msg = error_messages.get(error_code, f"Slack APIエラー: {error_code}")
            return {
                "success": False,
                "error": error_msg,
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"接続エラー: {str(e)}",
            }

    @classmethod
    async def test_connection_with_token(cls, token: str) -> dict[str, Any]:
        """
        Test Slack connection with a user-provided token.

        This is an alias for test_connection() for clarity in API calls.

        Args:
            token: Slack Bot User OAuth Token

        Returns:
            dict with success status, team info, and bot info
        """
        if not token:
            return {
                "success": False,
                "error": "Slack Bot Tokenが指定されていません",
            }
        return await cls.test_connection(token)

    @classmethod
    async def get_bot_user_id(cls, token: str | None = None) -> str | None:
        """Get the bot user ID, cached per token."""
        if not token:
            return None

        if token in cls._bot_user_ids:
            return cls._bot_user_ids[token]

        try:
            client = cls.get_client(token)
            response = client.auth_test()
            if response["ok"]:
                bot_user_id = response["user_id"]
                cls._bot_user_ids[token] = bot_user_id
                return bot_user_id
        except SlackApiError:
            pass
        return None

    @classmethod
    async def create_channel(
        cls,
        name: str,
        token: str | None = None,
        is_private: bool = False,
    ) -> dict[str, Any]:
        """
        Create a new Slack channel for a patient.
        
        Args:
            name: Channel name (will be prefixed with 'pt-')
            token: Optional bot token (uses configured token if not provided)
            is_private: Whether to create a private channel
            
        Returns:
            dict with channel info or error
        """
        try:
            client = cls.get_client(token)

            channel_name = cls._sanitize_channel_name(name)
            
            if is_private:
                response = client.conversations_create(
                    name=channel_name,
                    is_private=True,
                )
            else:
                response = client.conversations_create(
                    name=channel_name,
                    is_private=False,
                )
            
            if response["ok"]:
                return {
                    "success": True,
                    "channel": {
                        "id": response["channel"]["id"],
                        "name": response["channel"]["name"],
                    },
                }
            else:
                return {
                    "success": False,
                    "error": response.get("error", "チャンネル作成に失敗しました"),
                }
                
        except SlackApiError as e:
            error = e.response.get("error", "")
            if error == "name_taken":
                return {
                    "success": False,
                    "error": "同名のチャンネルが既に存在します",
                }
            return {
                "success": False,
                "error": f"Slack APIエラー: {error}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"チャンネル作成エラー: {str(e)}",
            }

    @classmethod
    def _find_channel_by_name(
        cls,
        client: WebClient,
        name: str,
    ) -> dict[str, Any] | None:
        """
        Find a Slack channel by exact name (including archived channels).

        Args:
            client: Slack WebClient instance
            name: Channel name to search for

        Returns:
            Channel dict if found, None otherwise
        """
        cursor = None
        while True:
            kwargs: dict[str, Any] = {
                "types": "public_channel,private_channel",
                "exclude_archived": False,
                "limit": 200,
            }
            if cursor:
                kwargs["cursor"] = cursor

            response = client.conversations_list(**kwargs)
            for channel in response.get("channels", []):
                if channel["name"] == name:
                    return channel

            cursor = response.get("response_metadata", {}).get("next_cursor")
            if not cursor:
                break
        return None

    @classmethod
    async def create_raw_channel(
        cls,
        channel_name: str,
        token: str | None = None,
        is_private: bool = False,
    ) -> dict[str, Any]:
        """
        Create a Slack channel with the exact name provided (no pt- prefix).

        Used for system channels like oncall-night.
        If the channel already exists (including archived), it will be
        found and reused (unarchived if necessary).

        Args:
            channel_name: Exact channel name to create
            token: Bot token
            is_private: Whether to create a private channel

        Returns:
            dict with channel info or error
        """
        try:
            client = cls.get_client(token)

            response = client.conversations_create(
                name=channel_name,
                is_private=is_private,
            )

            if response["ok"]:
                print(f"[SlackService] Channel '{channel_name}' created: {response['channel']['id']}")
                return {
                    "success": True,
                    "channel": {
                        "id": response["channel"]["id"],
                        "name": response["channel"]["name"],
                    },
                }
            else:
                return {
                    "success": False,
                    "error": response.get("error", "チャンネル作成に失敗しました"),
                }

        except SlackApiError as e:
            error = e.response.get("error", "")
            print(f"[SlackService] conversations_create error: {error}")

            if error == "name_taken":
                # Channel already exists - find and reuse it
                try:
                    existing = cls._find_channel_by_name(client, channel_name)
                    if existing:
                        # Unarchive if archived
                        if existing.get("is_archived"):
                            print(f"[SlackService] Unarchiving existing channel '{channel_name}'")
                            try:
                                client.conversations_unarchive(channel=existing["id"])
                            except SlackApiError as unarchive_err:
                                unarchive_error = unarchive_err.response.get("error", "")
                                if unarchive_error != "not_archived":
                                    return {
                                        "success": False,
                                        "error": f"既存チャンネルのアーカイブ解除に失敗しました: {unarchive_error}",
                                    }

                        print(f"[SlackService] Reusing existing channel '{channel_name}': {existing['id']}")
                        return {
                            "success": True,
                            "channel": {
                                "id": existing["id"],
                                "name": existing["name"],
                            },
                        }
                except Exception as find_err:
                    print(f"[SlackService] Error finding existing channel: {find_err}")

                return {
                    "success": False,
                    "error": "同名のチャンネルが既に存在しますが、検索できませんでした。Slackで確認してください。",
                }

            # Descriptive error messages for common Slack API errors
            error_messages = {
                "missing_scope": "Slack Botに channels:manage 権限が不足しています。Slack App設定の OAuth & Permissions で追加してください。",
                "invalid_auth": "Slack Bot Tokenが無効です。トークンを再設定してください。",
                "token_revoked": "Slack Bot Tokenが無効化されています。新しいトークンを発行してください。",
                "not_authed": "Slack認証に失敗しました。Bot Tokenを確認してください。",
                "restricted_action": "Slack管理者によりチャンネル作成が制限されています。Slackワークスペースの管理者にBot権限を確認してください。",
            }
            error_msg = error_messages.get(error, f"Slack APIエラー: {error}")
            return {
                "success": False,
                "error": error_msg,
            }
        except Exception as e:
            print(f"[SlackService] Unexpected error in create_raw_channel: {e}")
            return {
                "success": False,
                "error": f"チャンネル作成エラー: {str(e)}",
            }

    @classmethod
    def _build_anchor_blocks(
        cls,
        patient_name: str,
        patient_info: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Build anchor message blocks for a patient channel."""
        return [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"📋 {patient_name} さんの情報共有スレッド",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        "*このメッセージへの返信で報告を投稿してください*\n\n"
                        "AIが自動でBPS（身体・心理・社会）の観点で構造化し、保存します。\n"
                        "通常の会話はチャンネルに直接投稿してください（保存されません）。"
                    ),
                },
            },
            {"type": "divider"},
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": (
                            f"*基本情報*\n"
                            f"年齢: {patient_info.get('age', '未設定')}歳 | "
                            f"主病名: {patient_info.get('primary_diagnosis', '未設定')} | "
                            f"担当エリア: {patient_info.get('area', '未設定')}"
                        ),
                    },
                ],
            },
        ]

    @classmethod
    def _sanitize_channel_name(cls, name: str) -> str:
        """Sanitize a patient name into a valid Slack channel name."""
        channel_name = f"pt-{name}".lower().replace(" ", "-").replace("　", "-")
        channel_name = "".join(c for c in channel_name if c.isalnum() or c in "-_")
        return channel_name[:80]

    @classmethod
    async def post_anchor_message(
        cls,
        channel_id: str,
        patient_name: str,
        patient_info: dict[str, Any],
        token: str | None = None,
    ) -> dict[str, Any]:
        """
        Post the anchor message to a patient channel.

        This message serves as the thread parent for all reports.

        Args:
            channel_id: Slack channel ID
            patient_name: Patient name for display
            patient_info: Additional patient information
            token: Optional bot token

        Returns:
            dict with message timestamp or error
        """
        try:
            client = cls.get_client(token)
            blocks = cls._build_anchor_blocks(patient_name, patient_info)

            response = client.chat_postMessage(
                channel=channel_id,
                text=f"{patient_name} さんの情報共有スレッド",
                blocks=blocks,
            )

            if response["ok"]:
                return {
                    "success": True,
                    "message_ts": response["ts"],
                }
            else:
                return {
                    "success": False,
                    "error": "アンカーメッセージの投稿に失敗しました",
                }

        except SlackApiError as e:
            return {
                "success": False,
                "error": f"Slack APIエラー: {e.response['error']}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"メッセージ投稿エラー: {str(e)}",
            }

    @classmethod
    async def update_anchor_message(
        cls,
        channel_id: str,
        message_ts: str,
        patient_name: str,
        patient_info: dict[str, Any],
        token: str | None = None,
    ) -> dict[str, Any]:
        """
        Update an existing anchor message in a patient channel.

        Args:
            channel_id: Slack channel ID
            message_ts: Timestamp of the anchor message to update
            patient_name: Updated patient name
            patient_info: Updated patient information
            token: Optional bot token

        Returns:
            dict with success status or error
        """
        try:
            client = cls.get_client(token)
            blocks = cls._build_anchor_blocks(patient_name, patient_info)

            response = client.chat_update(
                channel=channel_id,
                ts=message_ts,
                text=f"{patient_name} さんの情報共有スレッド",
                blocks=blocks,
            )

            if response["ok"]:
                return {"success": True}
            else:
                return {
                    "success": False,
                    "error": "アンカーメッセージの更新に失敗しました",
                }

        except SlackApiError as e:
            return {
                "success": False,
                "error": f"Slack APIエラー: {e.response['error']}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"アンカーメッセージ更新エラー: {str(e)}",
            }

    @classmethod
    async def rename_channel(
        cls,
        channel_id: str,
        new_name: str,
        token: str | None = None,
    ) -> dict[str, Any]:
        """
        Rename a Slack channel.

        Args:
            channel_id: Slack channel ID
            new_name: New patient name (will be sanitized to channel name)
            token: Optional bot token

        Returns:
            dict with success status and new channel name or error
        """
        try:
            client = cls.get_client(token)
            channel_name = cls._sanitize_channel_name(new_name)

            response = client.conversations_rename(
                channel=channel_id,
                name=channel_name,
            )

            if response["ok"]:
                return {
                    "success": True,
                    "channel_name": response["channel"]["name"],
                }
            else:
                return {
                    "success": False,
                    "error": "チャンネル名の変更に失敗しました",
                }

        except SlackApiError as e:
            error = e.response.get("error", "")
            if error == "name_taken":
                return {
                    "success": False,
                    "error": "同名のチャンネルが既に存在します",
                }
            return {
                "success": False,
                "error": f"Slack APIエラー: {error}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"チャンネル名変更エラー: {str(e)}",
            }

    @classmethod
    async def archive_channel(
        cls,
        channel_id: str,
        token: str | None = None,
    ) -> dict[str, Any]:
        """
        Archive a Slack channel.

        Args:
            channel_id: Slack channel ID
            token: Optional bot token

        Returns:
            dict with success status or error
        """
        try:
            client = cls.get_client(token)

            response = client.conversations_archive(channel=channel_id)

            if response["ok"]:
                return {"success": True}
            else:
                return {
                    "success": False,
                    "error": "チャンネルのアーカイブに失敗しました",
                }

        except SlackApiError as e:
            error = e.response.get("error", "")
            if error == "already_archived":
                return {"success": True}
            return {
                "success": False,
                "error": f"Slack APIエラー: {error}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"チャンネルアーカイブエラー: {str(e)}",
            }

    @classmethod
    async def invite_users_to_channel(
        cls,
        channel_id: str,
        user_ids: list[str],
        token: str | None = None,
    ) -> dict[str, Any]:
        """
        Invite users to a channel.
        
        Args:
            channel_id: Slack channel ID
            user_ids: List of Slack user IDs to invite
            token: Optional bot token
            
        Returns:
            dict with success status
        """
        if not user_ids:
            return {"success": True, "invited": 0}
            
        try:
            client = cls.get_client(token)
            
            response = client.conversations_invite(
                channel=channel_id,
                users=",".join(user_ids),
            )
            
            if response["ok"]:
                return {
                    "success": True,
                    "invited": len(user_ids),
                }
            else:
                return {
                    "success": False,
                    "error": response.get("error", "招待に失敗しました"),
                }
                
        except SlackApiError as e:
            error = e.response.get("error", "")
            if error == "already_in_channel":
                return {"success": True, "invited": 0, "note": "既にチャンネルに参加済み"}
            return {
                "success": False,
                "error": f"Slack APIエラー: {error}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"招待エラー: {str(e)}",
            }

    @classmethod
    async def list_workspace_users(
        cls,
        token: str | None = None,
        limit: int = 200,
    ) -> dict[str, Any]:
        """
        List users in the workspace.
        
        Args:
            token: Optional bot token
            limit: Maximum number of users to return
            
        Returns:
            dict with list of users
        """
        try:
            client = cls.get_client(token)
            
            response = client.users_list(limit=limit)
            
            if response["ok"]:
                users = []
                for member in response["members"]:
                    if member.get("deleted") or member.get("is_bot"):
                        continue
                    users.append({
                        "id": member["id"],
                        "name": member.get("real_name") or member.get("name", ""),
                        "email": member.get("profile", {}).get("email", ""),
                        "display_name": member.get("profile", {}).get("display_name", ""),
                    })
                return {
                    "success": True,
                    "users": users,
                }
            else:
                return {
                    "success": False,
                    "error": "ユーザー一覧の取得に失敗しました",
                }
                
        except SlackApiError as e:
            return {
                "success": False,
                "error": f"Slack APIエラー: {e.response['error']}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"ユーザー取得エラー: {str(e)}",
            }

    @classmethod
    async def invite_users_to_channel_safe(
        cls,
        channel_id: str,
        user_ids: list[str],
        token: str | None = None,
    ) -> dict[str, Any]:
        """
        Invite users to a channel, safely handling already-in-channel errors.

        If some users are already members, filters them out and retries
        with only the non-member users.

        Args:
            channel_id: Slack channel ID
            user_ids: List of Slack user IDs to invite
            token: Optional bot token

        Returns:
            dict with success status, invited count, and optional note
        """
        if not user_ids:
            return {"success": True, "invited": 0, "note": "招待対象なし"}

        try:
            client = cls.get_client(token)

            response = client.conversations_invite(
                channel=channel_id,
                users=",".join(user_ids),
            )

            if response["ok"]:
                return {"success": True, "invited": len(user_ids)}
            else:
                return {
                    "success": False,
                    "error": response.get("error", "招待に失敗しました"),
                }

        except SlackApiError as e:
            error = e.response.get("error", "")

            if error == "already_in_channel":
                # Some/all users already in channel — filter and retry
                try:
                    members_resp = client.conversations_members(channel=channel_id)
                    current_members = set(members_resp.get("members", []))
                    new_users = [u for u in user_ids if u not in current_members]

                    if not new_users:
                        return {
                            "success": True,
                            "invited": 0,
                            "note": "全員既にチャンネルに参加済み",
                        }

                    retry_resp = client.conversations_invite(
                        channel=channel_id,
                        users=",".join(new_users),
                    )
                    if retry_resp["ok"]:
                        return {
                            "success": True,
                            "invited": len(new_users),
                            "note": f"{len(user_ids) - len(new_users)}名は既に参加済み",
                        }
                    else:
                        return {
                            "success": False,
                            "error": retry_resp.get("error", "再招待に失敗しました"),
                        }
                except SlackApiError as retry_err:
                    return {
                        "success": False,
                        "error": f"再招待エラー: {retry_err.response.get('error', '')}",
                    }

            return {
                "success": False,
                "error": f"Slack APIエラー: {error}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"招待エラー: {str(e)}",
            }

    @classmethod
    async def post_alert_message(
        cls,
        channel_id: str,
        alert_data: dict[str, Any],
        token: str | None = None,
    ) -> dict[str, Any]:
        """
        Post an alert message to a channel.
        
        Args:
            channel_id: Slack channel ID
            alert_data: Alert information
            token: Optional bot token
            
        Returns:
            dict with message timestamp or error
        """
        try:
            client = cls.get_client(token)
            
            severity = alert_data.get("severity", "medium")
            severity_emoji = {
                "high": "🔴",
                "medium": "🟡",
                "low": "🟢",
            }.get(severity, "⚪")
            
            blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{severity_emoji} アラート: {alert_data.get('title', '要確認')}",
                        "emoji": True,
                    },
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": alert_data.get("message", ""),
                    },
                },
            ]
            
            if alert_data.get("recommendations"):
                blocks.append({
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": "*推奨アクション*\n" + "\n".join(
                            f"• {rec}" for rec in alert_data["recommendations"]
                        ),
                    },
                })
            
            response = client.chat_postMessage(
                channel=channel_id,
                text=f"アラート: {alert_data.get('title', '要確認')}",
                blocks=blocks,
            )
            
            if response["ok"]:
                return {
                    "success": True,
                    "message_ts": response["ts"],
                }
            else:
                return {
                    "success": False,
                    "error": "アラートの投稿に失敗しました",
                }
                
        except SlackApiError as e:
            return {
                "success": False,
                "error": f"Slack APIエラー: {e.response['error']}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"アラート投稿エラー: {str(e)}",
            }

"""
Slack Service - Slack API operations for HomeCare AI Agent.

Handles channel creation, bot configuration, and message posting.
"""

from typing import Any

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from config import get_settings


class SlackService:
    """Service class for Slack API operations."""

    _client: WebClient | None = None
    _bot_user_id: str | None = None

    @classmethod
    def get_client(cls, token: str | None = None) -> WebClient:
        """Get Slack WebClient with the given or configured token."""
        if token:
            return WebClient(token=token)
        if cls._client is None:
            settings = get_settings()
            cls._client = WebClient(token=settings.slack_bot_token)
        return cls._client

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
                    "error": "認証に失敗しました",
                }

            # Get team info
            team_info = client.team_info()

            return {
                "success": True,
                "team": {
                    "id": auth_response["team_id"],
                    "name": auth_response["team"],
                    "domain": team_info["team"].get("domain", ""),
                },
                "bot": {
                    "id": auth_response["user_id"],
                    "name": auth_response["user"],
                },
            }
        except SlackApiError as e:
            return {
                "success": False,
                "error": f"Slack APIエラー: {e.response['error']}",
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"接続エラー: {str(e)}",
            }

    @classmethod
    async def test_connection_with_secret_manager(cls) -> dict[str, Any]:
        """
        Test Slack connection using the token from Secret Manager (via settings).

        This is used during setup to verify the backend is properly configured.
        No user input required.

        Returns:
            dict with success status, team info, and bot info
        """
        try:
            settings = get_settings()
            if not settings.slack_bot_token:
                return {
                    "success": False,
                    "error": "Slack Bot Tokenが設定されていません。バックエンドのデプロイ時にSecret Managerで設定してください。",
                }
            return await cls.test_connection(settings.slack_bot_token)
        except Exception as e:
            return {
                "success": False,
                "error": f"設定読み込みエラー: {str(e)}",
            }

    @classmethod
    async def get_bot_user_id(cls, token: str | None = None) -> str | None:
        """Get the bot user ID."""
        if cls._bot_user_id and not token:
            return cls._bot_user_id
        
        try:
            client = cls.get_client(token)
            response = client.auth_test()
            if response["ok"]:
                bot_user_id = response["user_id"]
                if not token:
                    cls._bot_user_id = bot_user_id
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
            
            # Slack channel names must be lowercase, no spaces
            channel_name = f"pt-{name}".lower().replace(" ", "-").replace("　", "-")
            # Remove invalid characters
            channel_name = "".join(c for c in channel_name if c.isalnum() or c in "-_")
            # Truncate to 80 chars (Slack limit)
            channel_name = channel_name[:80]
            
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
            
            # Build anchor message blocks
            blocks = [
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

"""
API module - REST API routers for HomeCare AI Agent.
"""

from .alerts import router as alerts_router
from .dashboard import router as dashboard_router
from .knowledge import router as knowledge_router
from .patients import router as patients_router
from .settings import router as settings_router
from .setup import router as setup_router
from .users import router as users_router

__all__ = [
    "alerts_router",
    "dashboard_router",
    "knowledge_router",
    "patients_router",
    "settings_router",
    "setup_router",
    "users_router",
]

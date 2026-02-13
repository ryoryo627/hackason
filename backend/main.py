"""
HomeCare AI Agent - FastAPI Application Entry Point.

This is the main entry point for the homecare-bot Cloud Run service.
Handles Slack Events API and Cron triggers for AI agents.
"""

import asyncio
import os
from collections import OrderedDict
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings

settings = get_settings()

# Semaphore to limit concurrent agent processing (prevent Gemini/Slack rate limits)
_agent_semaphore = asyncio.Semaphore(3)

# LRU-based dedup cache for Slack event IDs (prevents duplicate processing)
_processed_event_ids: OrderedDict[str, None] = OrderedDict()
_MAX_DEDUP_SIZE = 5000

# RootAgent instance cache (keyed by org_id, TTL 600s)
_agent_cache: dict[str, tuple[Any, float]] = {}
_AGENT_CACHE_TTL = 600


def _get_cached_agent(org_id: str | None) -> Any:
    """Get or create a cached RootAgent for the given org."""
    import time as _time
    from agents import RootAgent

    key = org_id or "__default__"
    if key in _agent_cache:
        agent, ts = _agent_cache[key]
        if _time.monotonic() - ts < _AGENT_CACHE_TTL:
            return agent

    agent = RootAgent()
    _agent_cache[key] = (agent, _time.monotonic())
    return agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown events."""
    # Startup
    print(f"Starting HomeCare Bot service...")
    print(f"Project: {settings.google_cloud_project}")
    print(f"Region: {settings.gcp_region}")
    print(f"Gemini Model: {settings.gemini_model}")
    yield
    # Shutdown
    print("Shutting down HomeCare Bot service...")


app = FastAPI(
    title="HomeCare AI Agent",
    description="Slack Bot and AI Agents (google-genai) for Home Care Support",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration - from environment variable or defaults
_cors_env = os.environ.get("CORS_ORIGINS", "")
cors_origins = [o.strip() for o in _cors_env.split(",") if o.strip()] if _cors_env else [
    settings.admin_ui_url,
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for Cloud Run."""
    return {"status": "healthy", "service": "homecare-bot"}


@app.post("/slack/events")
async def slack_events(request: Request) -> dict[str, Any]:
    """
    Slack Events API endpoint.

    Handles:
    - URL verification challenge
    - Message events (thread replies to anchor messages)
    - App mention events (@bot queries)
    """
    import sys

    # Reject Slack retries (we already accepted the event on first delivery)
    retry_num = request.headers.get("X-Slack-Retry-Num")
    if retry_num:
        return {"ok": True}

    # Verify signature (skip in development with SKIP_SLACK_VERIFY=true)
    import json
    from slack.verify import verify_slack_signature

    org_id = None
    skip_verify = os.environ.get("SKIP_SLACK_VERIFY", "").lower() == "true"

    if skip_verify:
        body = await request.json()
    else:
        try:
            body_bytes, org_id = await verify_slack_signature(request)
            body = json.loads(body_bytes)
        except Exception as e:
            print(f"[WARN] Slack signature verification failed: {e}")
            return JSONResponse(
                status_code=401,
                content={"error": "Invalid Slack signature"},
            )

    # URL verification for Slack app setup
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    # Early dedup: reject events we've already seen (by event_id or event ts)
    event = body.get("event", {})
    event_id = body.get("event_id") or event.get("client_msg_id") or event.get("ts", "")
    if event_id and event_id in _processed_event_ids:
        return {"ok": True}
    if event_id:
        _processed_event_ids[event_id] = None
        # Evict oldest entries to prevent unbounded growth
        while len(_processed_event_ids) > _MAX_DEDUP_SIZE:
            _processed_event_ids.popitem(last=False)

    event_type = event.get("type")
    channel = event.get("channel", "?")

    # Skip bot messages to prevent loops
    # Allow dummy_report metadata messages through for testing
    is_dummy_report = (
        event.get("metadata", {}).get("event_type") == "dummy_report"
    )
    is_bot = event.get("bot_id") or event.get("subtype") == "bot_message"
    if is_bot and not is_dummy_report:
        print(f"[SKIP] Bot message in {channel} (bot_id={event.get('bot_id')}, meta={event.get('metadata')})")
        return {"ok": True}

    # Route to Root Agent (fire-and-forget to respond within Slack's 3s timeout)
    if event_type in ("message", "app_mention"):
        root_agent = _get_cached_agent(org_id)

        async def _process():
            try:
                async with _agent_semaphore:
                    result = await root_agent.route_event(event, org_id=org_id)
                    print(f"[DONE] {channel}: {result.get('action', '?')} success={result.get('success')}")
                    sys.stdout.flush()
            except Exception as e:
                import traceback
                print(f"[ERROR] Agent error in {channel}: {e}")
                traceback.print_exc()
                sys.stdout.flush()

        asyncio.ensure_future(_process())
        return {"ok": True}

    return {"ok": True}


@app.post("/cron/morning-scan")
async def morning_scan(request: Request) -> dict[str, Any]:
    """
    Cloud Scheduler morning scan trigger.

    Runs Alert Agent to scan all patients and generate morning report
    for #oncall-night channel.
    """
    # Verify cron secret if configured
    expected_secret = os.environ.get("CRON_SECRET", "")
    if expected_secret:
        cron_secret = request.headers.get("X-Cron-Secret", "")
        if cron_secret != expected_secret:
            return JSONResponse(status_code=403, content={"error": "Forbidden"})

    # Get organization ID from request or default
    try:
        body = await request.json()
        org_id = body.get("org_id", "demo-org")
    except Exception:
        org_id = "demo-org"

    # Run morning scan with Root Agent
    from services.firestore_service import FirestoreService
    from services.slack_service import SlackService

    root_agent = _get_cached_agent(org_id)
    try:
        result = await root_agent.run_morning_scan(org_id)
        report = result.get("report", "")
        scan_results = result.get("scan_results", {})

        # Post to #oncall-night channel
        slack_posted = False
        try:
            token = await SlackService.get_bot_token(org_id)
            slack_config = await FirestoreService.get_service_config(org_id, "slack")
            oncall_channel = slack_config.get("default_channel") if slack_config else None

            if token and oncall_channel and report:
                client = SlackService.get_client(token)
                client.chat_postMessage(channel=oncall_channel, text=report)
                slack_posted = True

                # Post individual alerts to patient channels
                for severity in ["high", "medium"]:
                    for alert in scan_results.get(severity, []):
                        try:
                            patient_id = alert.get("patient_id")
                            if not patient_id:
                                continue
                            patient = await FirestoreService.get_patient(patient_id)
                            ch = patient.get("slack_channel_id") if patient else None
                            if ch:
                                msg = root_agent.alert_agent.format_alert_message(alert)
                                client.chat_postMessage(channel=ch, text=msg)
                        except Exception as e:
                            print(f"Patient channel alert post failed: {e}")
        except Exception as e:
            print(f"Slack posting failed (non-fatal): {e}")

        return {
            "ok": True,
            "message": "Morning scan completed",
            "report": report,
            "slack_posted": slack_posted,
            "high_alerts": len(scan_results.get("high", [])),
            "medium_alerts": len(scan_results.get("medium", [])),
        }
    except Exception as e:
        print(f"Morning scan error: {e}")
        return {
            "ok": False,
            "error": str(e),
        }


# Import and include API routers
from api import (
    alerts_router,
    dashboard_router,
    knowledge_router,
    patients_router,
    settings_router,
    setup_router,
    users_router,
)

app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(patients_router, prefix="/api/patients", tags=["patients"])
app.include_router(setup_router, prefix="/api/setup", tags=["setup"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["alerts"])
app.include_router(knowledge_router, prefix="/api/knowledge", tags=["knowledge"])
app.include_router(users_router, prefix="/api/users", tags=["users"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global exception handler."""
    print(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )

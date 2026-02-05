"""
HomeCare AI Agent - FastAPI Application Entry Point.

This is the main entry point for the homecare-bot Cloud Run service.
Handles Slack Events API and Cron triggers for ADK agents.
"""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings

settings = get_settings()


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
    description="Slack Bot and ADK Agents for Home Care Support",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.admin_ui_url, "http://localhost:3000"],
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
    # Verify signature (in production)
    from slack.verify import verify_slack_signature
    
    try:
        body_bytes = await verify_slack_signature(request)
        import json
        body = json.loads(body_bytes)
    except Exception:
        # Fallback for development/testing
        body = await request.json()

    # URL verification for Slack app setup
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    event = body.get("event", {})
    event_type = event.get("type")

    # Skip bot messages to prevent loops
    if event.get("bot_id") or event.get("subtype") == "bot_message":
        return {"ok": True}

    # Route to Root Agent
    if event_type in ("message", "app_mention"):
        from agents import RootAgent
        
        root_agent = RootAgent()
        try:
            result = await root_agent.route_event(event)
            return {"ok": True, "result": result}
        except Exception as e:
            print(f"Agent error: {e}")
            return {"ok": False, "error": str(e)}

    return {"ok": True}


@app.post("/cron/morning-scan")
async def morning_scan(request: Request) -> dict[str, Any]:
    """
    Cloud Scheduler morning scan trigger.

    Runs Alert Agent to scan all patients and generate morning report
    for #oncall-night channel.
    """
    # Get organization ID from request or default
    try:
        body = await request.json()
        org_id = body.get("org_id", "demo-org")
    except Exception:
        org_id = "demo-org"

    # Run morning scan with Root Agent
    from agents import RootAgent
    
    root_agent = RootAgent()
    try:
        result = await root_agent.run_morning_scan(org_id)
        return {
            "ok": True,
            "message": "Morning scan completed",
            "report": result.get("report"),
            "high_alerts": len(result.get("scan_results", {}).get("high", [])),
            "medium_alerts": len(result.get("scan_results", {}).get("medium", [])),
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
)

app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(patients_router, prefix="/api/patients", tags=["patients"])
app.include_router(setup_router, prefix="/api/setup", tags=["setup"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(alerts_router, prefix="/api/alerts", tags=["alerts"])
app.include_router(knowledge_router, prefix="/api/knowledge", tags=["knowledge"])


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

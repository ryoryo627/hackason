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
    body = await request.json()

    # URL verification for Slack app setup
    if body.get("type") == "url_verification":
        return {"challenge": body.get("challenge")}

    # TODO: Implement signature verification
    # TODO: Route to appropriate ADK agent based on event type

    event = body.get("event", {})
    event_type = event.get("type")

    if event_type == "message":
        # Thread reply handling - route to Intake Agent
        # TODO: Implement Intake Agent routing
        pass
    elif event_type == "app_mention":
        # @bot mention handling - route to Context/Summary Agent
        # TODO: Implement Context/Summary Agent routing
        pass

    return {"ok": True}


@app.post("/cron/morning-scan")
async def morning_scan(request: Request) -> dict[str, Any]:
    """
    Cloud Scheduler morning scan trigger.

    Runs Alert Agent to scan all patients and generate morning report
    for #oncall-night channel.
    """
    # TODO: Verify OIDC token from Cloud Scheduler
    # TODO: Implement Alert Agent morning scan

    return {
        "ok": True,
        "message": "Morning scan initiated",
    }


# Import and include API routers
# from api import patients, setup, knowledge, settings as settings_api, export

# app.include_router(patients.router, prefix="/api/patients", tags=["patients"])
# app.include_router(setup.router, prefix="/api/setup", tags=["setup"])
# app.include_router(knowledge.router, prefix="/api/knowledge", tags=["knowledge"])
# app.include_router(settings_api.router, prefix="/api/settings", tags=["settings"])
# app.include_router(export.router, prefix="/api/export", tags=["export"])


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

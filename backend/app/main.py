"""FastAPI application — Emergency Readiness Platform."""
import json
import logging
import uuid
from datetime import datetime, timezone
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from app.config import settings
from app.api import shifts
from app.api import readiness
from app.api import operations
from app.api import security
from app.websocket.manager import websocket_manager
from app.websocket.unit_readiness_manager import unit_readiness_manager
from app.services.demo_service import seed_demo
from app.stores import personnel_store, units_store
from app.security.middleware import AccessPolicyMiddleware, SecurityHeadersMiddleware
from app.security.tickets import realtime_ticket_broker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Emergency Readiness Platform API",
    description="Real-time emergency staffing, readiness, and certification risk with Kafka and Snowflake.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts_list)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(AccessPolicyMiddleware)

app.include_router(shifts.router)
app.include_router(readiness.router)
app.include_router(operations.router)
app.include_router(security.router)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": f"HTTP_{exc.status_code}",
            "message": str(exc.detail),
            "field_errors": {},
            "request_id": getattr(request.state, "request_id", "unknown"),
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    field_errors = {
        ".".join(str(part) for part in error["loc"] if part != "body"): error["msg"]
        for error in exc.errors()
    }
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "message": "The request contains invalid fields.",
            "field_errors": field_errors,
            "request_id": getattr(request.state, "request_id", "unknown"),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.exception("Unhandled request error %s", request_id)
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": "The service could not complete the request.",
            "field_errors": {},
            "request_id": request_id,
        },
    )


@app.on_event("startup")
async def startup():
    settings.validate_runtime()
    if settings.seed_demo_on_empty and (not personnel_store or not units_store):
        counts = seed_demo()
        logger.info(f"Demo data seeded: {counts}")
    else:
        logger.info("Loaded durable local operational state")


@app.get("/")
async def root():
    return {
        "service": "Emergency Readiness Platform API",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "storage": "sqlite",
        "personnel": len(personnel_store),
        "units": len(units_store),
    }


@app.websocket("/ws/shifts")
async def websocket_shifts(websocket: WebSocket, ticket: str | None = None):
    if settings.auth_required and (not ticket or not realtime_ticket_broker.consume(ticket)):
        await websocket.close(code=4401, reason="A valid realtime ticket is required")
        return
    await websocket_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f"WS /shifts message: {data}")
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)


@app.websocket("/ws/unit-readiness/{unit_id}")
async def websocket_unit_readiness(websocket: WebSocket, unit_id: str, ticket: str | None = None):
    if settings.auth_required and (not ticket or not realtime_ticket_broker.consume(ticket)):
        await websocket.close(code=4401, reason="A valid realtime ticket is required")
        return
    await unit_readiness_manager.connect(websocket, unit_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        unit_readiness_manager.disconnect(websocket)


@app.websocket("/ws/operations")
async def websocket_operations(websocket: WebSocket, ticket: str | None = None):
    """Aggregated operations channel for dashboard summaries, alerts, and incidents."""
    if settings.auth_required and (not ticket or not realtime_ticket_broker.consume(ticket)):
        await websocket.close(code=4401, reason="A valid realtime ticket is required")
        return
    from app.stores import alerts_store, incidents_store
    from app.models import AlertState
    from app.services.readiness_service import ReadinessService
    import asyncio

    await websocket.accept()
    try:
        while True:
            unit_readiness = ReadinessService.check_all_units()
            total = len(unit_readiness)
            ready = sum(1 for u in unit_readiness if u["readiness_score"] >= 85)
            open_alerts = [
                {"alert_id": a.alert_id, "alert_type": a.alert_type, "message": a.message, "state": a.state}
                for a in alerts_store.values()
                if a.state == AlertState.OPEN
            ]
            active_incidents = [
                {"incident_id": i.incident_id, "title": i.title, "priority": i.priority, "station_id": i.station_id}
                for i in incidents_store.values()
                if i.is_active
            ]
            payload = {
                "type": "operations.snapshot",
                "version": 1,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "total_units": total,
                    "ready_units": ready,
                    "open_alerts": len(open_alerts),
                    "active_incidents": len(active_incidents),
                    "units": unit_readiness,
                    "alerts": open_alerts,
                    "incidents": active_incidents,
                },
            }
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning(f"WS /operations error: {exc}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)

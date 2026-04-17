"""FastAPI application — Emergency Readiness Platform."""
import json
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import shifts
from app.api import readiness
from app.api import operations
from app.websocket.manager import websocket_manager
from app.websocket.unit_readiness_manager import unit_readiness_manager
from app.services.demo_service import seed_demo

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

app.include_router(shifts.router)
app.include_router(readiness.router)
app.include_router(operations.router)


@app.on_event("startup")
async def startup():
    counts = seed_demo()
    logger.info(f"Demo data seeded: {counts}")


@app.get("/")
async def root():
    return {
        "service": "Emergency Readiness Platform API",
        "version": "2.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.websocket("/ws/shifts")
async def websocket_shifts(websocket: WebSocket):
    await websocket_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            logger.debug(f"WS /shifts message: {data}")
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)


@app.websocket("/ws/unit-readiness/{unit_id}")
async def websocket_unit_readiness(websocket: WebSocket, unit_id: str):
    await unit_readiness_manager.connect(websocket, unit_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        unit_readiness_manager.disconnect(websocket)


@app.websocket("/ws/operations")
async def websocket_operations(websocket: WebSocket):
    """Aggregated operations channel for dashboard summaries, alerts, and incidents."""
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
                "type": "dashboard_summary",
                "data": {
                    "total_units": total,
                    "ready_units": ready,
                    "open_alerts": len(open_alerts),
                    "active_incidents": len(active_incidents),
                    "alerts": open_alerts,
                    "incidents": active_incidents,
                },
            }
            await websocket.send_text(json.dumps(payload))
            await asyncio.sleep(10)
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning(f"WS /operations error: {exc}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)

"""FastAPI application entry point."""
import logging
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api import shifts
from app.api import readiness
from app.websocket.manager import websocket_manager
from app.websocket.unit_readiness_manager import unit_readiness_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Workforce & Shift Management API",
    description="Real-time workforce and shift management with Kafka and Snowflake integration",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(shifts.router)
app.include_router(readiness.router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "message": "Workforce & Shift Management API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.websocket("/ws/shifts")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time shift events."""
    await websocket_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            data = await websocket.receive_text()
            logger.debug(f"Received WebSocket message: {data}")
            # Echo back or handle commands if needed
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket)
        logger.info("WebSocket client disconnected")


@app.websocket("/ws/unit-readiness/{unit_id}")
async def unit_readiness_websocket(websocket: WebSocket, unit_id: str):
    """WebSocket endpoint for real-time unit readiness updates."""
    await unit_readiness_manager.connect(websocket, unit_id)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            logger.debug(f"Received unit readiness WebSocket message: {data}")
            # Could handle commands here (e.g., request refresh)
    except WebSocketDisconnect:
        unit_readiness_manager.disconnect(websocket)
        logger.info(f"Unit readiness WebSocket disconnected for unit {unit_id}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )


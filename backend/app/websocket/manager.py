"""WebSocket manager for real-time shift event broadcasting."""
import json
import logging
from typing import Set
from fastapi import WebSocket
from app.models import ShiftEvent

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections and broadcasts events."""
    
    def __init__(self):
        """Initialize WebSocket manager."""
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast_event(self, event: ShiftEvent):
        """
        Broadcast a shift event to all connected clients.
        
        Args:
            event: ShiftEvent to broadcast
        """
        if not self.active_connections:
            return
        
        # Serialize event
        message = {
            "type": "shift_event",
            "data": {
                "event_id": event.event_id,
                "shift_id": event.shift_id,
                "employee_id": event.employee_id,
                "event_type": event.event_type.value,
                "event_time": event.event_time.isoformat(),
                "payload": event.payload or {},
            }
        }
        
        message_json = json.dumps(message)
        
        # Broadcast to all connections
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error(f"Error sending to WebSocket: {e}")
                disconnected.add(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
        
        logger.debug(f"Broadcasted event to {len(self.active_connections)} clients")


# Global WebSocket manager instance
websocket_manager = WebSocketManager()


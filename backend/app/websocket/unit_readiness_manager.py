"""WebSocket manager for unit readiness real-time updates."""
import json
import logging
from typing import Set, Dict
from fastapi import WebSocket
from app.services.readiness_service import ReadinessService

logger = logging.getLogger(__name__)


class UnitReadinessManager:
    """Manages WebSocket connections for unit readiness broadcasts."""
    
    def __init__(self):
        """Initialize unit readiness WebSocket manager."""
        # Map of unit_id -> set of WebSocket connections
        self.unit_connections: Dict[str, Set[WebSocket]] = {}
        # Map of WebSocket -> unit_id (for cleanup)
        self.connection_units: Dict[WebSocket, str] = {}
    
    async def connect(self, websocket: WebSocket, unit_id: str):
        """Accept a new WebSocket connection for a specific unit."""
        await websocket.accept()
        
        if unit_id not in self.unit_connections:
            self.unit_connections[unit_id] = set()
        
        self.unit_connections[unit_id].add(websocket)
        self.connection_units[websocket] = unit_id
        
        logger.info(f"Unit readiness WebSocket connected for unit {unit_id}. Total: {len(self.unit_connections[unit_id])}")
        
        # Send initial readiness status
        readiness = ReadinessService.get_unit_readiness(unit_id)
        if readiness:
            await self.send_readiness_update(websocket, readiness)
    
    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection."""
        unit_id = self.connection_units.get(websocket)
        if unit_id and unit_id in self.unit_connections:
            self.unit_connections[unit_id].discard(websocket)
            if not self.unit_connections[unit_id]:
                del self.unit_connections[unit_id]
        
        self.connection_units.pop(websocket, None)
        logger.info(f"Unit readiness WebSocket disconnected for unit {unit_id}")
    
    async def send_readiness_update(self, websocket: WebSocket, readiness_data: Dict):
        """Send readiness update to a specific WebSocket."""
        message = {
            "type": "unit_readiness",
            "data": readiness_data
        }
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending readiness update: {e}")
    
    async def broadcast_unit_readiness(self, unit_id: str):
        """
        Broadcast readiness update to all connections for a unit.
        
        Args:
            unit_id: Unit ID to broadcast for
        """
        if unit_id not in self.unit_connections:
            return
        
        readiness = ReadinessService.get_unit_readiness(unit_id)
        if not readiness:
            return
        
        message = {
            "type": "unit_readiness",
            "data": readiness
        }
        message_json = json.dumps(message)
        
        disconnected = set()
        for connection in self.unit_connections[unit_id]:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error(f"Error broadcasting to WebSocket: {e}")
                disconnected.add(connection)
        
        # Remove disconnected connections
        for connection in disconnected:
            self.disconnect(connection)
        
        logger.debug(f"Broadcasted readiness update for unit {unit_id} to {len(self.unit_connections.get(unit_id, []))} clients")


# Global unit readiness manager instance
unit_readiness_manager = UnitReadinessManager()


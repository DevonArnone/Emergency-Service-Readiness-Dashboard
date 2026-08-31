"""Tenant-aware WebSocket hub and Redis subscription."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket

try:
    from redis.asyncio import Redis
except ImportError:  # pragma: no cover
    Redis = None

from app.config import settings
from app.models import EventEnvelope


logger = logging.getLogger(__name__)


class OperationsHub:
    def __init__(self) -> None:
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)
        self.sequences: dict[str, int] = defaultdict(int)

    async def connect(self, websocket: WebSocket, organization_id: str) -> None:
        await websocket.accept()
        self.connections[organization_id].add(websocket)

    def disconnect(self, websocket: WebSocket, organization_id: str) -> None:
        self.connections[organization_id].discard(websocket)
        if not self.connections[organization_id]:
            self.connections.pop(organization_id, None)

    async def broadcast(self, envelope: EventEnvelope) -> None:
        self.sequences[envelope.organization_id] += 1
        message = {
            "id": envelope.event_id,
            "type": "operations.event",
            "schema_version": envelope.schema_version,
            "sequence": self.sequences[envelope.organization_id],
            "occurred_at": envelope.occurred_at.isoformat(),
            "payload": envelope.model_dump(mode="json"),
        }
        disconnected = []
        for websocket in tuple(self.connections.get(envelope.organization_id, ())):
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(websocket, envelope.organization_id)


class RedisFanoutSubscriber:
    def __init__(self, hub: OperationsHub) -> None:
        self.hub = hub
        self.redis = None
        self.task: asyncio.Task | None = None

    async def start(self) -> None:
        if not settings.redis_fanout_enabled or Redis is None or self.task:
            return
        self.redis = Redis.from_url(settings.redis_url, decode_responses=True)
        self.task = asyncio.create_task(self._listen(), name="redis-operations-fanout")

    async def _listen(self) -> None:
        pubsub = self.redis.pubsub()
        await pubsub.psubscribe("aegis:*:operations")
        try:
            async for message in pubsub.listen():
                if message.get("type") != "pmessage":
                    continue
                try:
                    envelope = EventEnvelope.model_validate_json(message["data"])
                    await self.hub.broadcast(envelope)
                except Exception as exc:
                    logger.warning("Rejected Redis fan-out message: %s", exc)
        finally:
            await pubsub.close()

    async def stop(self) -> None:
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None
        if self.redis:
            await self.redis.close()
            self.redis = None


operations_hub = OperationsHub()
redis_fanout_subscriber = RedisFanoutSubscriber(operations_hub)

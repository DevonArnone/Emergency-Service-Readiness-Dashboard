"""Short-lived, single-use authorization for WebSocket upgrades."""

from __future__ import annotations

import hashlib
import json
import secrets
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.security.identity import Principal


@dataclass(frozen=True, slots=True)
class TicketGrant:
    principal: Principal
    expires_at: datetime


class RealtimeTicketBroker:
    """Atomic Redis GETDEL in distributed mode, bounded memory in local mode."""

    def __init__(self) -> None:
        self._tickets: dict[str, TicketGrant] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _redis():
        from redis import Redis
        return Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2)

    @staticmethod
    def _digest(ticket: str) -> str:
        return hashlib.sha256(ticket.encode("utf-8")).hexdigest()

    def issue(self, principal: Principal) -> tuple[str, datetime]:
        ticket = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.realtime_ticket_ttl_seconds)
        if settings.redis_fanout_enabled:
            payload = json.dumps({
                "subject_id": principal.subject_id, "organization_id": principal.organization_id,
                "roles": sorted(principal.roles), "display_name": principal.display_name,
                "email": principal.email, "is_public_demo": principal.is_public_demo,
            })
            with self._redis() as client:
                client.set(f"aegis:ticket:{self._digest(ticket)}", payload, ex=settings.realtime_ticket_ttl_seconds)
            return ticket, expires_at
        with self._lock:
            now = datetime.now(timezone.utc)
            self._tickets = {key: grant for key, grant in self._tickets.items() if grant.expires_at > now}
            if len(self._tickets) >= 10_000:
                from fastapi import HTTPException
                raise HTTPException(status_code=429, detail="Too many pending realtime tickets")
            self._tickets[self._digest(ticket)] = TicketGrant(principal=principal, expires_at=expires_at)
        return ticket, expires_at

    def consume(self, ticket: str) -> Principal | None:
        digest = self._digest(ticket)
        if settings.redis_fanout_enabled:
            with self._redis() as client:
                payload = client.getdel(f"aegis:ticket:{digest}")
            if payload is None:
                return None
            claims = json.loads(payload)
            claims["roles"] = frozenset(claims["roles"])
            return Principal(**claims)
        with self._lock:
            grant = self._tickets.pop(digest, None)
        if not grant or grant.expires_at <= datetime.now(timezone.utc):
            return None
        return grant.principal


realtime_ticket_broker = RealtimeTicketBroker()

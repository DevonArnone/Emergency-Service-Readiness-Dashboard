"""Short-lived, single-use authorization for WebSocket upgrades."""

from __future__ import annotations

import hashlib
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
    """In-memory development broker; Redis replaces this in the distributed profile."""

    def __init__(self) -> None:
        self._tickets: dict[str, TicketGrant] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _digest(ticket: str) -> str:
        return hashlib.sha256(ticket.encode("utf-8")).hexdigest()

    def issue(self, principal: Principal) -> tuple[str, datetime]:
        ticket = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.realtime_ticket_ttl_seconds)
        with self._lock:
            self._tickets[self._digest(ticket)] = TicketGrant(principal=principal, expires_at=expires_at)
        return ticket, expires_at

    def consume(self, ticket: str) -> Principal | None:
        digest = self._digest(ticket)
        with self._lock:
            grant = self._tickets.pop(digest, None)
        if not grant or grant.expires_at <= datetime.now(timezone.utc):
            return None
        return grant.principal


realtime_ticket_broker = RealtimeTicketBroker()

"""Tenant context shared by request handling and database transactions."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator


_organization_id: ContextVar[str | None] = ContextVar("organization_id", default=None)


def current_organization_id() -> str | None:
    return _organization_id.get()


@contextmanager
def organization_scope(organization_id: str) -> Iterator[None]:
    token = _organization_id.set(organization_id)
    try:
        yield
    finally:
        _organization_id.reset(token)

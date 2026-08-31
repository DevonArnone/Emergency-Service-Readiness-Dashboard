"""Database engine and transaction helpers."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.db.base import Base
from app.security.tenant import current_organization_id, organization_scope


def build_engine(database_url: str | None = None) -> Engine:
    url = database_url or settings.database_url
    # Older local checkouts used an async SQLite URL before the runtime became synchronous.
    url = url.replace("sqlite+aiosqlite://", "sqlite+pysqlite://")
    connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
    return create_engine(
        url,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, class_=Session)


@event.listens_for(engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:
    if engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


@event.listens_for(Session, "after_begin")
def apply_tenant_context(session: Session, transaction, connection) -> None:
    organization_id = current_organization_id()
    if organization_id and connection.dialect.name == "postgresql":
        connection.execute(
            text("SELECT set_config('app.organization_id', :organization_id, true)"),
            {"organization_id": organization_id},
        )


def create_schema(target_engine: Engine | None = None) -> None:
    from app.db import models as _models  # noqa: F401

    Base.metadata.create_all(bind=target_engine or engine)


@contextmanager
def session_scope(organization_id: str | None = None) -> Iterator[Session]:
    scope = organization_scope(organization_id) if organization_id else None
    if scope:
        scope.__enter__()
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
        if scope:
            scope.__exit__(None, None, None)

"""Small SQLite-backed mapping used by the local operational runtime."""
from __future__ import annotations

import sqlite3
import threading
from collections.abc import Iterator, MutableMapping
from pathlib import Path
from typing import Generic, TypeVar

from pydantic import BaseModel

from app.config import settings


ModelT = TypeVar("ModelT", bound=BaseModel)


class StateDatabase:
    def __init__(self, path: str):
        self.path = Path(path).resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS entity_store (
                    kind TEXT NOT NULL,
                    entity_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (kind, entity_id)
                )
                """
            )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=NORMAL")
        return connection

    def load(self, kind: str) -> dict[str, str]:
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                "SELECT entity_id, payload FROM entity_store WHERE kind = ?",
                (kind,),
            ).fetchall()
        return {entity_id: payload for entity_id, payload in rows}

    def upsert(self, kind: str, entity_id: str, payload: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                """
                INSERT INTO entity_store (kind, entity_id, payload)
                VALUES (?, ?, ?)
                ON CONFLICT(kind, entity_id) DO UPDATE SET
                    payload = excluded.payload,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (kind, entity_id, payload),
            )

    def delete(self, kind: str, entity_id: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                "DELETE FROM entity_store WHERE kind = ? AND entity_id = ?",
                (kind, entity_id),
            )

    def clear(self, kind: str) -> None:
        with self._lock, self._connect() as connection:
            connection.execute("DELETE FROM entity_store WHERE kind = ?", (kind,))


state_database = StateDatabase(settings.state_database_path)


class PersistentStore(MutableMapping[str, ModelT], Generic[ModelT]):
    def __init__(self, kind: str, model: type[ModelT]):
        self.kind = kind
        self.model = model
        self._data: dict[str, ModelT] = {
            entity_id: model.model_validate_json(payload)
            for entity_id, payload in state_database.load(kind).items()
        }

    def __getitem__(self, key: str) -> ModelT:
        return self._data[key]

    def __setitem__(self, key: str, value: ModelT) -> None:
        validated = self.model.model_validate(value)
        self._data[key] = validated
        state_database.upsert(self.kind, key, validated.model_dump_json())

    def __delitem__(self, key: str) -> None:
        del self._data[key]
        state_database.delete(self.kind, key)

    def __iter__(self) -> Iterator[str]:
        return iter(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def clear(self) -> None:
        self._data.clear()
        state_database.clear(self.kind)

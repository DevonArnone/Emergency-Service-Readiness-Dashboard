"""Regression coverage for durable operations and scoped analytics."""
from __future__ import annotations

import os
import tempfile
import unittest

from fastapi import HTTPException


_test_directory = tempfile.TemporaryDirectory()
os.environ["STATE_DATABASE_PATH"] = os.path.join(_test_directory.name, "operations.db")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{os.path.join(_test_directory.name, 'relational.db')}"
os.environ["SNOWFLAKE_ACCOUNT"] = "placeholder"
os.environ["SNOWFLAKE_USER"] = "placeholder"
os.environ["SNOWFLAKE_PASSWORD"] = "placeholder"

from app.config import settings  # noqa: E402

settings.state_database_path = os.environ["STATE_DATABASE_PATH"]
settings.database_url = os.environ["DATABASE_URL"]

from app.api.operations import (  # noqa: E402
    certification_risk,
    operations_snapshot,
    readiness_trends,
    staffing_gaps,
)
from app.api.readiness import _validate_assignment  # noqa: E402
from app.models import Personnel  # noqa: E402
from app.persistence import PersistentStore  # noqa: E402
from app.services.demo_service import seed_demo  # noqa: E402
from app.stores import unit_assignments_store, units_store  # noqa: E402


def tearDownModule() -> None:
    _test_directory.cleanup()


class PersistentStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.store = PersistentStore("test_personnel", Personnel)
        self.store.clear()

    def test_round_trip_survives_new_store_instance(self) -> None:
        person = Personnel(
            personnel_id="person-test",
            name="Test Operator",
            role="Duty Officer",
        )
        self.store[person.personnel_id] = person

        reloaded = PersistentStore("test_personnel", Personnel)

        self.assertEqual(reloaded[person.personnel_id].name, "Test Operator")
        del reloaded[person.personnel_id]
        self.assertNotIn(person.personnel_id, PersistentStore("test_personnel", Personnel))


class OperationsApiTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        seed_demo()
        self.station_id = "fs-01"

    async def test_snapshot_respects_station_scope(self) -> None:
        snapshot = await operations_snapshot(self.station_id)

        self.assertTrue(snapshot["units"])
        self.assertTrue(all(
            units_store[row["unit_id"]].station_id == self.station_id
            for row in snapshot["units"]
        ))
        self.assertTrue(all(alert.station_id == self.station_id for alert in snapshot["alerts"]))

    async def test_analytics_filters_apply_at_source(self) -> None:
        trends = await readiness_trends(days=30, station_id=self.station_id)
        risks = await certification_risk(days_ahead=30, station_id=self.station_id)
        gaps = await staffing_gaps(station_id=self.station_id)

        self.assertEqual(len(trends), 30)
        self.assertTrue(all(set(row) == {"date", self.station_id, "overall"} for row in trends))
        self.assertTrue(all(
            row["station_id"] == self.station_id and row["days_left"] <= 30
            for row in risks
        ))
        self.assertTrue(all(row["station_id"] == self.station_id for row in gaps))

    def test_seed_matches_fairfax_scale_contract(self) -> None:
        from app.stores import personnel_store, stations_store

        self.assertEqual(len(stations_store), 39)
        self.assertEqual(len(units_store), 131)
        self.assertEqual(len(personnel_store), 1450)
        self.assertEqual(len(unit_assignments_store), 363)

    async def test_overlapping_assignment_is_rejected(self) -> None:
        existing = next(iter(unit_assignments_store.values()))
        overlapping = existing.model_copy(update={"assignment_id": None})

        with self.assertRaises(HTTPException) as raised:
            _validate_assignment(overlapping)

        self.assertEqual(raised.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()

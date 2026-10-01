"""Regression coverage for durable operations and scoped analytics."""
from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone

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
    create_incident,
    operations_snapshot,
    readiness_trends,
    resolve_incident,
    staffing_gaps,
    update_incident,
)
from app.api.readiness import _validate_assignment  # noqa: E402
from app.models import (  # noqa: E402
    IncidentStatus, IncidentType, OperationalIncident, OperationsSnapshot, Personnel,
)
from app.persistence import PersistentStore  # noqa: E402
from app.services.demo_service import seed_demo  # noqa: E402
from app.stores import incidents_store, unit_assignments_store, units_store  # noqa: E402


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
        self.assertEqual(snapshot['summary'].total_units, len(snapshot['units']))
        self.assertTrue(all(item.unit_id in {row['unit_id'] for row in snapshot['units']} for item in snapshot['recommendations']))
        self.assertEqual(snapshot["command_board"].station_network.total, 1)
        self.assertEqual(
            sum(group.total for group in snapshot["command_board"].apparatus),
            len(snapshot["units"]),
        )

    async def test_snapshot_includes_truthful_command_board_aggregates(self) -> None:
        snapshot = await operations_snapshot(None)
        OperationsSnapshot.model_validate(snapshot)
        board = snapshot["command_board"]

        self.assertEqual(board.personnel.authorized, 363)
        self.assertEqual(board.personnel.on_duty, 351)
        self.assertEqual(board.incident_types, {"FIRE": 1, "EMS": 3, "HAZMAT": 0, "OTHER": 1})
        self.assertEqual(board.station_network.total, 39)
        self.assertEqual(
            board.station_network.online
            + board.station_network.staffing_attention
            + board.station_network.offline,
            39,
        )
        self.assertEqual(sum(group.total for group in board.apparatus), 131)
        self.assertEqual(board.duty_brief.active_incidents, 5)
        self.assertTrue(board.duty_brief.high_priority_incidents)

    async def test_incident_dispatch_fields_round_trip_and_old_updates_preserve_them(self) -> None:
        created = await create_incident(OperationalIncident(
            title="Synthetic hazmat investigation",
            incident_type=IncidentType.HAZMAT,
            display_location="100 Test Plaza, Fairfax, VA",
            station_id="fs-01",
            unit_id="unit-engine-01",
            assigned_unit_ids=["unit-engine-01"],
            latitude=38.85,
            longitude=-77.31,
            source="SYNTHETIC_TEST",
            source_reference="QA-001",
            status=IncidentStatus.INVESTIGATING,
        ))
        stored = incidents_store[created.incident_id]
        self.assertEqual(stored.incident_type, IncidentType.HAZMAT)
        self.assertEqual(stored.display_location, "100 Test Plaza, Fairfax, VA")
        self.assertEqual(stored.latitude, 38.85)
        self.assertEqual(stored.source_reference, "QA-001")
        self.assertEqual(stored.status, IncidentStatus.INVESTIGATING)

        legacy_update = OperationalIncident(title="Synthetic hazmat investigation updated")
        updated = await update_incident(created.incident_id, legacy_update)
        self.assertEqual(updated.incident_type, IncidentType.HAZMAT)
        self.assertEqual(updated.display_location, "100 Test Plaza, Fairfax, VA")
        self.assertEqual(updated.status, IncidentStatus.INVESTIGATING)
        self.assertEqual(updated.source, "SYNTHETIC_TEST")

        resolved = await resolve_incident(created.incident_id)
        self.assertEqual(resolved.status, IncidentStatus.RESOLVED)
        self.assertFalse(resolved.is_active)
        self.assertIsNotNone(resolved.resolved_at)

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

    async def test_roster_clock_and_cancellation_lifecycle(self) -> None:
        from app.api.shifts import create_shift, assign_employee_to_shift, clock_in, clock_out, get_live_shifts, cancel_shift
        from app.models import Unit, Shift, ClockInRequest, ClockOutRequest, AvailabilityStatus
        from app.stores import personnel_store
        now = datetime.now(timezone.utc)
        units_store['qa-unit'] = Unit(unit_id='qa-unit', unit_name='QA unit', type='ENGINE', minimum_staff=1, station_id=self.station_id)
        personnel_store['qa-person'] = Personnel(personnel_id='qa-person', name='QA synthetic operator', role='Firefighter', station_id=self.station_id)
        shift = await create_shift(Shift(location='QA shift', unit_id='qa-unit', station_id=self.station_id, start_time=now-timedelta(hours=1), end_time=now+timedelta(hours=1), required_headcount=1))
        await assign_employee_to_shift(shift.shift_id, 'qa-person')
        with self.assertRaises(HTTPException) as conflict:
            await assign_employee_to_shift(shift.shift_id, 'qa-person')
        self.assertEqual(conflict.exception.status_code, 409)
        await clock_in(shift.shift_id, ClockInRequest(employee_id='qa-person'))
        live = next(item for item in await get_live_shifts(now.date(), 0) if item.shift_id == shift.shift_id)
        self.assertEqual(live.clocked_in_count, 1)
        await clock_out(shift.shift_id, ClockOutRequest(employee_id='qa-person'))
        live = next(item for item in await get_live_shifts(now.date(), 0) if item.shift_id == shift.shift_id)
        self.assertEqual(live.clocked_in_count, 0)
        self.assertIsNotNone(live.assigned_personnel[0]['clocked_out_at'])
        await clock_in(shift.shift_id, ClockInRequest(employee_id='qa-person'))
        await cancel_shift(shift.shift_id)
        self.assertEqual(personnel_store['qa-person'].availability_status, AvailabilityStatus.AVAILABLE)
        self.assertFalse(any(item.shift_id == shift.shift_id for item in await get_live_shifts(now.date(), 0)))
        with self.assertRaises(HTTPException):
            await clock_in(shift.shift_id, ClockInRequest(employee_id='qa-person'))

    async def test_overnight_watch_is_visible_on_both_dates(self) -> None:
        from app.api.shifts import create_shift, get_live_shifts
        from app.models import Shift
        start = datetime.now(timezone.utc).replace(hour=20, minute=0, second=0, microsecond=0)
        shift = await create_shift(Shift(location='Overnight watch', start_time=start, end_time=start+timedelta(hours=12), required_headcount=1))
        tomorrow = (start+timedelta(days=1)).date()
        self.assertTrue(any(item.shift_id == shift.shift_id for item in await get_live_shifts(tomorrow, 0)))

    def test_future_assignments_do_not_count_as_present(self) -> None:
        from app.models import Unit, UnitAssignment
        from app.services.readiness_service import ReadinessService
        from app.stores import personnel_store
        now = datetime.now(timezone.utc)
        units_store['future-unit'] = Unit(unit_id='future-unit', unit_name='Future unit', type='ENGINE', minimum_staff=1)
        personnel_store['future-person'] = Personnel(personnel_id='future-person', name='Future person', role='Test')
        unit_assignments_store['future-assignment'] = UnitAssignment(assignment_id='future-assignment', unit_id='future-unit', personnel_id='future-person', shift_start=now+timedelta(minutes=10), shift_end=now+timedelta(hours=2), assignment_status='ON_SHIFT')
        self.assertEqual(ReadinessService.get_unit_readiness('future-unit')['staff_present'], 0)
        self.assertEqual(next(row for row in ReadinessService.check_all_units() if row['unit_id']=='future-unit')['staff_present'], 0)


if __name__ == "__main__":
    unittest.main()


class LifecycleHistoryTests(unittest.IsolatedAsyncioTestCase):
    """Audit details carry enough recorded facts to rebuild unit and incident timelines."""

    def setUp(self) -> None:
        seed_demo()

    async def test_seed_records_coherent_incident_and_service_histories(self) -> None:
        from app.stores import audit_events_store

        incidents = list(incidents_store.values())
        self.assertEqual(sum(incident.is_active for incident in incidents), 5)
        self.assertEqual(sum(not incident.is_active for incident in incidents), 7)
        events = [event for event in audit_events_store.values() if event.details.get("lifecycle")]
        for incident in incidents:
            stages = sorted((event for event in events if event.entity_id == incident.incident_id), key=lambda event: event.created_at)
            self.assertGreaterEqual(len(stages), 2, incident.incident_id)
            self.assertIsNone(stages[0].details["before_status"])
            final = stages[-1].details["after_status"]
            self.assertEqual(final, "RESOLVED" if not incident.is_active else incident.status.value)
        service = [event for event in audit_events_store.values() if event.details.get("service_state")]
        down = {unit.unit_id for unit in units_store.values() if unit.operational_status.value in {"OUT_OF_SERVICE", "MAINTENANCE"}}
        self.assertEqual(len(down), 4)
        committed = {unit_id for incident in incidents if incident.is_active for unit_id in incident.assigned_unit_ids}
        self.assertFalse(down & committed, "service exceptions must stay away from active incident assignments")
        self.assertTrue(all(any(event.entity_id == unit_id for event in service) for unit_id in down))
        baseline = next(event for event in audit_events_store.values() if event.action == "WATCH_OPENED")
        self.assertEqual(len(baseline.details["unit_service_states"]), 131)

    async def test_incident_and_unit_mutations_record_before_after_details(self) -> None:
        from app.api.readiness import update_unit
        from app.stores import audit_events_store

        incident = incidents_store["inc-01"]
        update = incident.model_copy(update={"status": IncidentStatus.ON_SCENE, "assigned_unit_ids": [*incident.assigned_unit_ids, "unit-truck-01"]})
        await update_incident("inc-01", update)
        event = max((item for item in audit_events_store.values() if item.entity_id == "inc-01"), key=lambda item: item.created_at)
        self.assertEqual((event.details["before_status"], event.details["after_status"]), ("ENROUTE", "ON_SCENE"))
        self.assertEqual(event.details["units_added"], ["unit-truck-01"])
        self.assertIn("recorded_at", event.details)

        unit = units_store["unit-engine-01"]
        await update_unit(unit.unit_id, unit.model_copy(update={"operational_status": "MAINTENANCE"}))
        event = max((item for item in audit_events_store.values() if item.entity_id == "unit-engine-01"), key=lambda item: item.created_at)
        self.assertEqual((event.details["before_status"], event.details["after_status"]), ("AVAILABLE", "MAINTENANCE"))
        self.assertTrue(event.details["service_state"])

        await resolve_incident("inc-01")
        event = max((item for item in audit_events_store.values() if item.entity_id == "inc-01"), key=lambda item: item.created_at)
        self.assertEqual(event.details["after_status"], "RESOLVED")

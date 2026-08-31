"""Relational schema contract tests."""

import unittest

from sqlalchemy import create_engine, inspect

from app.db.base import Base
from app.db import models as db_models


class DatabaseSchemaTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_operational_tables_are_normalized(self) -> None:
        tables = set(inspect(self.engine).get_table_names())
        self.assertTrue({
            "organizations",
            "memberships",
            "battalions",
            "stations",
            "personnel",
            "personnel_certifications",
            "units",
            "shifts",
            "unit_assignments",
            "incidents",
            "incident_units",
            "alerts",
            "renewal_tasks",
            "audit_events",
            "outbox_events",
            "realtime_tickets",
        }.issubset(tables))

    def test_every_tenant_table_has_organization_scope(self) -> None:
        inspector = inspect(self.engine)
        for table_name in db_models.TENANT_TABLE_NAMES:
            columns = {column["name"] for column in inspector.get_columns(table_name)}
            self.assertIn("organization_id", columns, table_name)

    def test_high_volume_paths_have_indexes(self) -> None:
        inspector = inspect(self.engine)
        indexed_tables = {
            "alerts": "ix_alerts_org_state_created",
            "incidents": "ix_incidents_org_active_priority",
            "outbox_events": "ix_outbox_pending",
            "unit_assignments": "ix_assignments_org_window",
        }
        for table_name, expected_index in indexed_tables.items():
            indexes = {index["name"] for index in inspector.get_indexes(table_name)}
            self.assertIn(expected_index, indexes)


if __name__ == "__main__":
    unittest.main()

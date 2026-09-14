"""Static contracts for the deployable tenant-scoped Snowflake plane."""

from pathlib import Path
import unittest


SNOWFLAKE_ROOT = Path(__file__).parents[2] / "data-pipeline" / "snowflake"


class SnowflakeContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scripts = {
            path.name: path.read_text(encoding="utf-8").upper()
            for path in SNOWFLAKE_ROOT.glob("*.sql")
        }

    def test_deployment_has_one_ordered_path(self) -> None:
        self.assertEqual(
            sorted(self.scripts),
            [
                "00_security.sql",
                "01_schema.sql",
                "02_kafka_ingestion.sql",
                "03_streams_and_tasks.sql",
                "04_secure_views.sql",
                "05_validation.sql",
            ],
        )

    def test_tenant_boundary_is_present_across_layers(self) -> None:
        self.assertIn("ROW ACCESS POLICY", self.scripts["01_schema.sql"])
        self.assertGreaterEqual(self.scripts["01_schema.sql"].count("ORGANIZATION_ID"), 20)
        self.assertIn("ORGANIZATION_ID", self.scripts["02_kafka_ingestion.sql"])
        self.assertIn("ORGANIZATION_ID", self.scripts["03_streams_and_tasks.sql"])
        self.assertIn("SECURE VIEW", self.scripts["04_secure_views.sql"])

    def test_analytical_consumers_have_independent_streams(self) -> None:
        task_script = self.scripts["03_streams_and_tasks.sql"]
        self.assertIn("UNIT_READINESS_EVENT_STREAM", task_script)
        self.assertIn("INCIDENT_ACTIVITY_EVENT_STREAM", task_script)
        self.assertEqual(task_script.count("ON TABLE RAW.OPERATIONAL_EVENTS"), 2)

    def test_standard_tables_do_not_use_legacy_indexes(self) -> None:
        all_sql = "\n".join(self.scripts.values())
        self.assertNotIn("CREATE INDEX", all_sql)
        self.assertIn("CLUSTER BY", self.scripts["01_schema.sql"])


if __name__ == "__main__":
    unittest.main()

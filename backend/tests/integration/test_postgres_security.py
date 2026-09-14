"""Opt-in checks against the migrated local database, without changing records."""
import os
import unittest
from sqlalchemy import create_engine, text


@unittest.skipUnless(os.getenv('INTEGRATION_DATABASE_URL'), 'Requires an explicit migrated PostgreSQL runtime URL')
class PostgresSecurityTests(unittest.TestCase):
    def test_runtime_role_and_row_security(self):
        engine = create_engine(os.environ['INTEGRATION_DATABASE_URL'])
        try:
            with engine.connect() as connection, connection.begin():
                role = connection.execute(text('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user')).one()
                self.assertEqual(tuple(role), (False, False))
                self.assertEqual(connection.scalar(text('SELECT count(*) FROM units')), 0)
                connection.execute(text("SELECT set_config('app.organization_id', 'fcfrd-demo', true)"))
                self.assertEqual(connection.scalar(text('SELECT count(*) FROM units')), 131)
                connection.execute(text("SELECT set_config('app.organization_id', 'different-tenant', true)"))
                self.assertEqual(connection.scalar(text('SELECT count(*) FROM units')), 0)
                self.assertEqual(connection.scalar(text('SELECT count(*) FROM personnel')), 0)
                policies = connection.execute(text("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = 'units'")).one()
                self.assertEqual(tuple(policies), (True, True))
        finally:
            engine.dispose()


if __name__ == '__main__':
    unittest.main()

"""Enforce PostgreSQL tenant row policies.

Revision ID: 20260831_0002
Revises: 20260831_0001
"""

from alembic import op

from app.db.models import TENANT_TABLE_NAMES


revision = "20260831_0002"
down_revision = "20260831_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table_name in TENANT_TABLE_NAMES:
        op.execute(f'ALTER TABLE "{table_name}" ENABLE ROW LEVEL SECURITY')
        op.execute(f'ALTER TABLE "{table_name}" FORCE ROW LEVEL SECURITY')
        op.execute(
            f'CREATE POLICY "tenant_isolation" ON "{table_name}" '
            "USING (organization_id = current_setting('app.organization_id', true)) "
            "WITH CHECK (organization_id = current_setting('app.organization_id', true))"
        )


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table_name in reversed(TENANT_TABLE_NAMES):
        op.execute(f'DROP POLICY IF EXISTS "tenant_isolation" ON "{table_name}"')
        op.execute(f'ALTER TABLE "{table_name}" DISABLE ROW LEVEL SECURITY')

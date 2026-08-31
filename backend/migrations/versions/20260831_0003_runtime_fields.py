"""Add compatibility fields for the operational runtime.

Revision ID: 20260831_0003
Revises: 20260831_0002
"""

from alembic import op
import sqlalchemy as sa


revision = "20260831_0003"
down_revision = "20260831_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    station_columns = {column["name"] for column in inspector.get_columns("stations")}
    personnel_columns = {column["name"] for column in inspector.get_columns("personnel")}
    incident_columns = {column["name"] for column in inspector.get_columns("incidents")}
    if "district" not in station_columns:
        op.add_column("stations", sa.Column("district", sa.String(length=100), nullable=True))
    if "current_unit_id" not in personnel_columns:
        op.add_column("personnel", sa.Column("current_unit_id", sa.String(length=64), nullable=True))
    if "primary_unit_id" not in incident_columns:
        op.add_column("incidents", sa.Column("primary_unit_id", sa.String(length=64), nullable=True))
        if op.get_bind().dialect.name == "postgresql":
            op.create_foreign_key(
                "fk_incidents_primary_unit_id_units",
                "incidents",
                "units",
                ["primary_unit_id"],
                ["unit_id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    bind = op.get_bind()
    # SQLite development databases are created from the current 0001 metadata, so
    # these columns belong to the base schema rather than this compatibility step.
    if bind.dialect.name != "postgresql":
        return
    inspector = sa.inspect(bind)
    foreign_keys = {key.get("name") for key in inspector.get_foreign_keys("incidents")}
    if "fk_incidents_primary_unit_id_units" not in foreign_keys:
        return
    op.drop_constraint("fk_incidents_primary_unit_id_units", "incidents", type_="foreignkey")
    incident_columns = {column["name"] for column in inspector.get_columns("incidents")}
    personnel_columns = {column["name"] for column in inspector.get_columns("personnel")}
    station_columns = {column["name"] for column in inspector.get_columns("stations")}
    if "primary_unit_id" in incident_columns:
        op.drop_column("incidents", "primary_unit_id")
    if "current_unit_id" in personnel_columns:
        op.drop_column("personnel", "current_unit_id")
    if "district" in station_columns:
        op.drop_column("stations", "district")

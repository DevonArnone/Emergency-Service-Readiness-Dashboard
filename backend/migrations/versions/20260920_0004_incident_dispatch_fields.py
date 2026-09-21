"""Add typed incident dispatch fields.

Revision ID: 20260920_0004
Revises: 20260831_0003
"""

from alembic import op
import sqlalchemy as sa


revision = "20260920_0004"
down_revision = "20260831_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("incidents")}

    if "incident_type" not in columns:
        op.add_column(
            "incidents",
            sa.Column("incident_type", sa.String(length=30), nullable=False, server_default="OTHER"),
        )
    if "display_location" not in columns:
        op.add_column(
            "incidents",
            sa.Column(
                "display_location",
                sa.String(length=240),
                nullable=False,
                server_default="Location pending",
            ),
        )

    # Existing records are classified only from durable text already in the row.
    # This keeps upgrades deterministic and does not invent external dispatch data.
    op.execute(sa.text("""
        UPDATE incidents
        SET incident_type = CASE
            WHEN lower(title) LIKE '%hazard%' OR lower(title) LIKE '%hazmat%' THEN 'HAZMAT'
            WHEN lower(title) LIKE '%medical%' OR lower(title) LIKE '%ems%' THEN 'EMS'
            WHEN lower(title) LIKE '%fire%' OR lower(title) LIKE '%alarm%' THEN 'FIRE'
            ELSE 'OTHER'
        END
    """))
    op.execute(sa.text("""
        UPDATE incidents
        SET display_location = COALESCE(
            (SELECT stations.address
             FROM stations
             WHERE stations.station_id = incidents.station_id
               AND stations.organization_id = incidents.organization_id),
            NULLIF(title, ''),
            'Location pending'
        )
        WHERE display_location IS NULL OR display_location = 'Location pending'
    """))


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("incidents")}
    with op.batch_alter_table("incidents") as batch_op:
        if "display_location" in columns:
            batch_op.drop_column("display_location")
        if "incident_type" in columns:
            batch_op.drop_column("incident_type")

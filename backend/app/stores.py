"""Centralized normalized relational stores for operational services."""
from app.models import (
    Personnel, Unit, UnitAssignment, Certification,
    Station, ReadinessAlert, OperationalIncident,
    Shift, RenewalTask, AuditEvent,
)
from app.db.session import create_schema
from app.db.store import RelationalStore
from app.config import settings


if settings.auto_create_schema:
    create_schema()

personnel_store = RelationalStore("personnel", Personnel)
units_store = RelationalStore("units", Unit)
unit_assignments_store = RelationalStore("unit_assignments", UnitAssignment)
certifications_store = RelationalStore("certifications", Certification)
stations_store = RelationalStore("stations", Station)
alerts_store = RelationalStore("alerts", ReadinessAlert)
incidents_store = RelationalStore("incidents", OperationalIncident)
shifts_store = RelationalStore("shifts", Shift)
renewal_tasks_store = RelationalStore("renewal_tasks", RenewalTask)
audit_events_store = RelationalStore("audit_events", AuditEvent)

"""Centralized durable stores for local operations."""
from app.models import (
    Personnel, Unit, UnitAssignment, Certification,
    Station, ReadinessAlert, OperationalIncident,
    Shift, RenewalTask, AuditEvent,
)
from app.persistence import PersistentStore

personnel_store = PersistentStore("personnel", Personnel)
units_store = PersistentStore("units", Unit)
unit_assignments_store = PersistentStore("unit_assignments", UnitAssignment)
certifications_store = PersistentStore("certifications", Certification)
stations_store = PersistentStore("stations", Station)
alerts_store = PersistentStore("alerts", ReadinessAlert)
incidents_store = PersistentStore("incidents", OperationalIncident)
shifts_store = PersistentStore("shifts", Shift)
renewal_tasks_store = PersistentStore("renewal_tasks", RenewalTask)
audit_events_store = PersistentStore("audit_events", AuditEvent)

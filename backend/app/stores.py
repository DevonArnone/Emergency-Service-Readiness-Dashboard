"""Centralized in-memory data stores."""
from typing import Dict
from app.models import (
    Personnel, Unit, UnitAssignment, Certification,
    Station, ReadinessAlert, OperationalIncident,
)

personnel_store: Dict[str, Personnel] = {}
units_store: Dict[str, Unit] = {}
unit_assignments_store: Dict[str, UnitAssignment] = {}
certifications_store: Dict[str, Certification] = {}
stations_store: Dict[str, Station] = {}
alerts_store: Dict[str, ReadinessAlert] = {}
incidents_store: Dict[str, OperationalIncident] = {}

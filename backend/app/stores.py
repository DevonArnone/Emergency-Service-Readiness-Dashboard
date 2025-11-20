"""Centralized data stores for emergency services data models."""
from typing import Dict
from app.models import Personnel, Unit, UnitAssignment, Certification

# In-memory stores for MVP (to be replaced with persistent storage later)
personnel_store: Dict[str, Personnel] = {}
units_store: Dict[str, Unit] = {}
unit_assignments_store: Dict[str, UnitAssignment] = {}
certifications_store: Dict[str, Certification] = {}


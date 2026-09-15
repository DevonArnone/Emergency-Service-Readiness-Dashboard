"""Service for calculating unit readiness and detecting understaffing."""
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from app.models import (
    Personnel, Unit, UnitAssignment, AssignmentStatus, AvailabilityStatus
)
from app.stores import (
    personnel_store, units_store, unit_assignments_store
)

logger = logging.getLogger(__name__)


class ReadinessService:
    """Service for calculating unit readiness scores and detecting issues."""
    
    @staticmethod
    def calculate_readiness_score(
        unit: Unit,
        assigned_personnel: List[Personnel],
        assignments: List[UnitAssignment]
    ) -> Dict:
        """
        Calculate readiness score for a unit (0-100).
        
        Returns dict with:
        - readiness_score: int (0-100)
        - staff_required: int
        - staff_present: int
        - certifications_missing: List[str]
        - is_understaffed: bool
        - issues: List[str]
        """
        staff_required = unit.minimum_staff
        staff_present = len([a for a in assignments if a.assignment_status == AssignmentStatus.ON_SHIFT])
        
        # Check for missing certifications
        certifications_missing = []
        for req_cert in unit.required_certifications:
            has_cert = any(
                req_cert in person.certifications 
                for person in assigned_personnel
            )
            if not has_cert:
                certifications_missing.append(req_cert)
        
        # Check for expired certifications
        expired_certs = []
        for person in assigned_personnel:
            for cert_name, exp_date in person.cert_expirations.items():
                if isinstance(exp_date, str):
                    try:
                        exp_date = datetime.fromisoformat(exp_date.replace('Z', '+00:00'))
                    except:
                        continue
                if isinstance(exp_date, datetime) and exp_date < datetime.now(timezone.utc):
                    expired_certs.append(f"{person.name}: {cert_name}")
        
        # Calculate base score (staffing)
        if staff_required == 0:
            staffing_score = 100
        else:
            staffing_score = min(100, (staff_present / staff_required) * 100)
        
        # Penalties
        cert_penalty = len(certifications_missing) * 15
        expired_penalty = len(expired_certs) * 20
        
        readiness_score = max(0, staffing_score - cert_penalty - expired_penalty)
        
        # Determine if understaffed
        is_understaffed = (
            staff_present < staff_required or
            len(certifications_missing) > 0 or
            len(expired_certs) > 0
        )
        
        # Collect issues
        issues = []
        if staff_present < staff_required:
            issues.append(f"Understaffed: {staff_present}/{staff_required}")
        if certifications_missing:
            issues.append(f"Missing certifications: {', '.join(certifications_missing)}")
        if expired_certs:
            issues.append(f"Expired certifications: {', '.join(expired_certs)}")
        
        return {
            "readiness_score": int(readiness_score),
            "staff_required": staff_required,
            "staff_present": staff_present,
            "certifications_missing": certifications_missing,
            "expired_certifications": expired_certs,
            "is_understaffed": is_understaffed,
            "issues": issues,
        }
    
    @staticmethod
    def get_unit_readiness(unit_id: str) -> Optional[Dict]:
        """Get current readiness status for a unit."""
        unit = units_store.get(unit_id)
        if not unit or unit.is_archived:
            return None
        
        # Get active assignments for this unit
        # Future assignments must not inflate current operational readiness.
        now = datetime.now(timezone.utc)
        
        active_assignments = [
            a for a in unit_assignments_store.values()
            if a.unit_id == unit_id
            and a.assignment_status == AssignmentStatus.ON_SHIFT
            and a.shift_start <= now < a.shift_end
            and not a.clocked_out_at
        ]
        
        # Get personnel for these assignments
        assigned_personnel = []
        for assignment in active_assignments:
            person = personnel_store.get(assignment.personnel_id)
            if person and not person.is_archived:
                assigned_personnel.append(person)
        
        # Calculate readiness
        readiness = ReadinessService.calculate_readiness_score(
            unit, assigned_personnel, active_assignments
        )
        
        return {
            "unit_id": unit_id,
            "unit_name": unit.unit_name,
            "unit_type": unit.type.value,
            **readiness,
            "assigned_personnel": [
                {
                    "personnel_id": p.personnel_id,
                    "name": p.name,
                    "role": p.role,
                    "certifications": p.certifications,
                }
                for p in assigned_personnel
            ],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    
    @staticmethod
    def check_all_units() -> List[Dict]:
        """Check readiness in one relational snapshot instead of querying per unit."""
        now = datetime.now(timezone.utc)
        assignments_by_unit: Dict[str, List[UnitAssignment]] = {}
        for assignment in unit_assignments_store.values():
            if (
                assignment.assignment_status == AssignmentStatus.ON_SHIFT
                and assignment.shift_start <= now < assignment.shift_end
                and not assignment.clocked_out_at
            ):
                assignments_by_unit.setdefault(assignment.unit_id, []).append(assignment)
        personnel_by_id = {
            person.personnel_id: person
            for person in personnel_store.values()
            if not person.is_archived
        }

        results = []
        for unit_id, unit in units_store.items():
            if unit.is_archived:
                continue
            assignments = assignments_by_unit.get(unit_id, [])
            assigned_personnel = [
                personnel_by_id[assignment.personnel_id]
                for assignment in assignments
                if assignment.personnel_id in personnel_by_id
            ]
            readiness = ReadinessService.calculate_readiness_score(
                unit, assigned_personnel, assignments
            )
            results.append({
                "unit_id": unit_id,
                "unit_name": unit.unit_name,
                "unit_type": unit.type.value,
                **readiness,
                "assigned_personnel": [
                    {
                        "personnel_id": person.personnel_id,
                        "name": person.name,
                        "role": person.role,
                        "certifications": person.certifications,
                    }
                    for person in assigned_personnel
                ],
                "timestamp": now.isoformat(),
            })
        return results

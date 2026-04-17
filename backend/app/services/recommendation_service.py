"""Rules-based readiness recommendation engine."""
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict
from app.models import ReadinessRecommendation, AvailabilityStatus
from app.stores import personnel_store, units_store, unit_assignments_store
from app.services.readiness_service import ReadinessService

logger = logging.getLogger(__name__)

_COUNTER = 0


def _rec_id() -> str:
    global _COUNTER
    _COUNTER += 1
    return f"rec-{_COUNTER:04d}"


class RecommendationService:

    @staticmethod
    def generate_recommendations() -> List[ReadinessRecommendation]:
        now = datetime.now(timezone.utc)
        recs: List[ReadinessRecommendation] = []

        for unit_id in units_store:
            status = ReadinessService.get_unit_readiness(unit_id)
            if not status:
                continue

            unit = units_store[unit_id]

            # ── Understaffing ────────────────────────────────────────────────
            if status["staff_present"] < status["staff_required"]:
                gap = status["staff_required"] - status["staff_present"]

                # Find available qualified personnel not already assigned
                candidates = RecommendationService._find_candidates(unit_id, unit)

                if candidates:
                    names = ", ".join(p.name for p in candidates[:gap])
                    recs.append(ReadinessRecommendation(
                        recommendation_id=_rec_id(),
                        unit_id=unit_id,
                        action_type="REASSIGN",
                        message=f"Reassign {names} to {unit.unit_name} to cover {gap} staffing gap.",
                        details={"candidates": [p.personnel_id for p in candidates[:gap]]},
                        priority="HIGH",
                        created_at=now,
                    ))
                else:
                    recs.append(ReadinessRecommendation(
                        recommendation_id=_rec_id(),
                        unit_id=unit_id,
                        action_type="ESCALATE",
                        message=f"{unit.unit_name} is understaffed by {gap} and no qualified replacements are available. Escalate to mutual aid.",
                        details={"gap": gap},
                        priority="CRITICAL",
                        created_at=now,
                    ))

            # ── Missing certifications ────────────────────────────────────────
            for cert in status["certifications_missing"]:
                candidates = [
                    p for p in personnel_store.values()
                    if cert in p.certifications
                    and p.availability_status == AvailabilityStatus.AVAILABLE
                ]
                if candidates:
                    recs.append(ReadinessRecommendation(
                        recommendation_id=_rec_id(),
                        unit_id=unit_id,
                        action_type="REASSIGN",
                        message=f"{unit.unit_name} is missing {cert}. {candidates[0].name} is available and holds that credential.",
                        details={"cert": cert, "candidate": candidates[0].personnel_id},
                        priority="HIGH",
                        created_at=now,
                    ))
                else:
                    recs.append(ReadinessRecommendation(
                        recommendation_id=_rec_id(),
                        unit_id=unit_id,
                        action_type="ESCALATE",
                        message=f"{unit.unit_name} requires {cert} but no certified personnel are available. Escalate to mutual aid.",
                        details={"cert": cert},
                        priority="CRITICAL",
                        created_at=now,
                    ))

            # ── Expiring certifications ───────────────────────────────────────
            soon = now + timedelta(days=30)
            for person_cert_str in status.get("expired_certifications", []):
                # already expired
                recs.append(ReadinessRecommendation(
                    recommendation_id=_rec_id(),
                    unit_id=unit_id,
                    action_type="RENEW_CERT",
                    message=f"Expired certification on {unit.unit_name}: {person_cert_str}. Schedule renewal immediately.",
                    details={"expired_entry": person_cert_str},
                    priority="HIGH",
                    created_at=now,
                ))

            for person in personnel_store.values():
                if person.current_unit_id != unit_id:
                    continue
                for cert_name, exp in person.cert_expirations.items():
                    if isinstance(exp, str):
                        try:
                            exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
                        except Exception:
                            continue
                    if isinstance(exp, datetime) and now < exp <= soon:
                        days_left = (exp - now).days
                        recs.append(ReadinessRecommendation(
                            recommendation_id=_rec_id(),
                            unit_id=unit_id,
                            action_type="RENEW_CERT",
                            message=f"{person.name}'s {cert_name} expires in {days_left} days. Schedule renewal before it lapses.",
                            details={"personnel_id": person.personnel_id, "cert": cert_name, "days_left": days_left},
                            priority="MEDIUM",
                            created_at=now,
                        ))

        return recs

    @staticmethod
    def _find_candidates(unit_id: str, unit):
        """Find available personnel who meet the unit's cert requirements but are not assigned."""
        assigned_ids = {
            a.personnel_id
            for a in unit_assignments_store.values()
            if a.unit_id == unit_id
        }
        candidates = []
        for p in personnel_store.values():
            if p.personnel_id in assigned_ids:
                continue
            if p.availability_status != AvailabilityStatus.AVAILABLE:
                continue
            if all(c in p.certifications for c in unit.required_certifications):
                candidates.append(p)
        return candidates

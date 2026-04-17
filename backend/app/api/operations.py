"""Operations API — alerts, stations, incidents, dashboard summary, simulation, demo reset."""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.models import (
    ReadinessAlert, AlertState, AcknowledgeAlertRequest,
    Station, OperationalIncident, DashboardSummary,
    SimulationRequest, SimulationResult,
    Personnel, UnitAssignment, AssignmentStatus,
)
from app.stores import (
    alerts_store, stations_store, incidents_store,
    units_store, personnel_store, unit_assignments_store,
    certifications_store,
)
from app.services.readiness_service import ReadinessService
from app.services.recommendation_service import RecommendationService
from app.services.demo_service import seed_demo

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Dashboard summary ─────────────────────────────────────────────────────────

@router.get("/api/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary():
    unit_readiness = ReadinessService.check_all_units()
    total = len(unit_readiness)
    ready = sum(1 for u in unit_readiness if u["readiness_score"] >= 85)
    degraded = sum(1 for u in unit_readiness if 60 <= u["readiness_score"] < 85)
    critical = sum(1 for u in unit_readiness if u["readiness_score"] < 60)
    overall = (sum(u["readiness_score"] for u in unit_readiness) / total) if total else 0.0

    open_alerts = sum(1 for a in alerts_store.values() if a.state == AlertState.OPEN)
    active_inc = sum(1 for i in incidents_store.values() if i.is_active)

    station_summaries = []
    for st in stations_store.values():
        st_units = [u for u in unit_readiness if units_store.get(u["unit_id"]) and units_store[u["unit_id"]].station_id == st.station_id]
        avg_score = (sum(u["readiness_score"] for u in st_units) / len(st_units)) if st_units else 0
        station_summaries.append({
            "station_id": st.station_id,
            "station_name": st.name,
            "unit_count": len(st_units),
            "avg_readiness": round(avg_score, 1),
            "critical_units": sum(1 for u in st_units if u["readiness_score"] < 60),
        })

    return DashboardSummary(
        total_units=total,
        ready_units=ready,
        degraded_units=degraded,
        critical_units=critical,
        open_alerts=open_alerts,
        active_incidents=active_inc,
        overall_readiness_pct=round(overall, 1),
        station_summaries=station_summaries,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


# ── Stations ─────────────────────────────────────────────────────────────────

@router.get("/api/stations")
async def list_stations():
    return list(stations_store.values())


@router.get("/api/stations/{station_id}")
async def get_station(station_id: str):
    s = stations_store.get(station_id)
    if not s:
        raise HTTPException(404, "Station not found")
    return s


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("/api/alerts")
async def list_alerts(state: str | None = None):
    alerts = list(alerts_store.values())
    if state:
        alerts = [a for a in alerts if a.state.value == state.upper()]
    alerts.sort(key=lambda a: a.created_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return alerts


@router.post("/api/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, body: AcknowledgeAlertRequest):
    alert = alerts_store.get(alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    if alert.state == AlertState.RESOLVED:
        raise HTTPException(400, "Cannot acknowledge a resolved alert")
    alert.state = AlertState.ACKNOWLEDGED
    alert.acknowledged_at = datetime.now(timezone.utc)
    alert.acknowledged_by = body.acknowledged_by
    alert.acknowledged_note = body.note
    return alert


@router.post("/api/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    alert = alerts_store.get(alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.state = AlertState.RESOLVED
    alert.resolved_at = datetime.now(timezone.utc)
    return alert


# ── Incidents ─────────────────────────────────────────────────────────────────

@router.get("/api/incidents")
async def list_incidents(active_only: bool = True):
    incidents = list(incidents_store.values())
    if active_only:
        incidents = [i for i in incidents if i.is_active]
    return incidents


@router.post("/api/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    inc = incidents_store.get(incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    inc.is_active = False
    inc.resolved_at = datetime.now(timezone.utc)
    return inc


# ── Recommendations ───────────────────────────────────────────────────────────

@router.get("/api/recommendations")
async def get_recommendations(unit_id: str | None = None):
    recs = RecommendationService.generate_recommendations()
    if unit_id:
        recs = [r for r in recs if r.unit_id == unit_id]
    return recs


# ── Analytics extensions ──────────────────────────────────────────────────────

@router.get("/api/analytics/readiness-trends")
async def readiness_trends():
    """Return 14-day readiness trend (deterministic demo data)."""
    from datetime import timedelta
    import random

    random.seed(42)
    now = datetime.now(timezone.utc)
    stations = list(stations_store.values())
    if not stations:
        return []

    result = []
    for day_offset in range(13, -1, -1):
        day = (now - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        entry: dict = {"date": day}
        total_score = 0
        count = 0
        for st in stations:
            st_units = [u for u in units_store.values() if u.station_id == st.station_id]
            n = len(st_units)
            base = 72 + random.randint(-8, 12) if day_offset > 0 else None
            score = base if base else None
            if day_offset == 0:
                readiness = ReadinessService.check_all_units()
                st_scores = [
                    r["readiness_score"]
                    for r in readiness
                    if units_store.get(r["unit_id"]) and units_store[r["unit_id"]].station_id == st.station_id
                ]
                score = round(sum(st_scores) / len(st_scores), 1) if st_scores else 0
            entry[st.station_id] = score
            if score is not None:
                total_score += score
                count += 1
        entry["overall"] = round(total_score / count, 1) if count else 0
        result.append(entry)
    return result


@router.get("/api/analytics/certification-risk")
async def certification_risk():
    """Return per-personnel certification risk forecast for next 90 days."""
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    rows = []
    for p in personnel_store.values():
        for cert_name, exp in p.cert_expirations.items():
            if isinstance(exp, str):
                try:
                    exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
                except Exception:
                    continue
            if not isinstance(exp, datetime):
                continue
            days_left = (exp - now).days
            if days_left <= 90:
                rows.append({
                    "personnel_id": p.personnel_id,
                    "personnel_name": p.name,
                    "station_id": p.station_id,
                    "cert": cert_name,
                    "expires_on": exp.strftime("%Y-%m-%d"),
                    "days_left": days_left,
                    "status": "EXPIRED" if days_left < 0 else ("CRITICAL" if days_left <= 14 else "WARNING"),
                })
    rows.sort(key=lambda r: r["days_left"])
    return rows


@router.get("/api/analytics/staffing-gaps")
async def staffing_gaps():
    """Return staffing gap hours by unit and station."""
    readiness = ReadinessService.check_all_units()
    rows = []
    for r in readiness:
        unit = units_store.get(r["unit_id"])
        if not unit:
            continue
        gap = max(0, r["staff_required"] - r["staff_present"])
        rows.append({
            "unit_id": r["unit_id"],
            "unit_name": r["unit_name"],
            "unit_type": r["unit_type"],
            "station_id": unit.station_id,
            "staff_present": r["staff_present"],
            "staff_required": r["staff_required"],
            "gap": gap,
            "readiness_score": r["readiness_score"],
        })
    rows.sort(key=lambda x: x["gap"], reverse=True)
    return rows


# ── What-if simulation ────────────────────────────────────────────────────────

@router.post("/api/simulations/staffing-gap", response_model=SimulationResult)
async def simulate_staffing_gap(body: SimulationRequest):
    now = datetime.now(timezone.utc)

    # Collect units in scope
    if body.unit_id:
        target_unit_ids = [body.unit_id]
    elif body.station_id:
        target_unit_ids = [
            u.unit_id for u in units_store.values()
            if u.station_id == body.station_id
        ]
    else:
        target_unit_ids = list(units_store.keys())

    original: list[dict] = []
    degraded: list[dict] = []
    impacted: list[str] = []
    recovery: list[str] = []

    for uid in target_unit_ids:
        orig = ReadinessService.get_unit_readiness(uid)
        if not orig:
            continue
        original.append(orig)

        # Simulate by temporarily removing personnel
        if body.personnel_to_remove:
            # Build a fake assignment set minus the removed people
            unit_obj = units_store[uid]
            fake_assignments = [
                a for a in unit_assignments_store.values()
                if a.unit_id == uid and a.personnel_id not in body.personnel_to_remove
                and a.assignment_status == AssignmentStatus.ON_SHIFT
            ]
            fake_personnel = [
                personnel_store[a.personnel_id]
                for a in fake_assignments
                if a.personnel_id in personnel_store
            ]
            sim = ReadinessService.calculate_readiness_score(unit_obj, fake_personnel, fake_assignments)
            sim_result = {**orig, **sim, "simulated": True}
        elif body.scenario == "unit_offline":
            sim_result = {**orig, "readiness_score": 0, "simulated": True, "issues": ["Unit offline"]}
        else:
            sim_result = orig

        degraded.append(sim_result)

        if sim_result["readiness_score"] < orig["readiness_score"]:
            impacted.append(uid)
            candidates = RecommendationService._find_candidates(uid, units_store[uid])
            if candidates:
                recovery.append(
                    f"Reassign {candidates[0].name} to {orig['unit_name']} to recover readiness."
                )
            else:
                recovery.append(
                    f"No available replacements for {orig['unit_name']}. Request mutual aid."
                )

    return SimulationResult(
        scenario=body.scenario,
        original_readiness=original,
        degraded_readiness=degraded,
        impacted_units=impacted,
        recovery_actions=recovery,
        timestamp=now.isoformat(),
    )


# ── Demo reset ────────────────────────────────────────────────────────────────

@router.post("/api/demo/reset")
async def demo_reset():
    counts = seed_demo()
    return {"status": "ok", "seeded": counts}

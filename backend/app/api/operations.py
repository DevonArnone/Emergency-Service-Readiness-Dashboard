"""Operations API — alerts, stations, incidents, dashboard summary, simulation, demo reset."""
import asyncio
import logging
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from app.models import (
    ReadinessAlert, AlertState, AcknowledgeAlertRequest,
    Station, OperationalIncident, IncidentStatus, DashboardSummary,
    SimulationRequest, SimulationResult,
    Personnel, UnitAssignment, AssignmentStatus,
    AuditEvent, RenewalTask,
    CommandBoard, CommandBoardPersonnel, CommandBoardStationNetwork,
    CommandBoardApparatusGroup, CommandBoardDutyBrief,
    OperationsSnapshot, FairfaxWeatherResponse,
)
from app.stores import (
    alerts_store, stations_store, incidents_store,
    units_store, personnel_store, unit_assignments_store,
    certifications_store,
    audit_events_store, renewal_tasks_store,
)
from app.services.readiness_service import ReadinessService
from app.services.recommendation_service import RecommendationService
from app.services.demo_service import seed_demo
from app.services.audit_service import incident_lifecycle_details, record_audit
from app.services.weather_service import weather_service

logger = logging.getLogger(__name__)
router = APIRouter()


APPARATUS_GROUPS = (
    ("engines", "Engines", {"ENGINE"}),
    ("trucks", "Trucks", {"TRUCK", "LADDER"}),
    ("rescues", "Rescues", {"RESCUE"}),
    ("als", "ALS Units", {"MEDIC", "AMBULANCE"}),
    ("command", "BC / Command", {"COMMAND"}),
    ("hazmat", "HazMat", {"HAZMAT"}),
    ("special_operations", "Special Operations", {"SAFETY", "SAR_TEAM", "TANKER"}),
)


def _enum_value(value) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _build_command_board(
    *, station_id: str | None, readiness: list[dict], alerts: list,
    incidents: list, recommendations: list,
) -> CommandBoard:
    scoped_units = [
        unit for unit in units_store.values()
        if not station_id or unit.station_id == station_id
    ]
    scoped_people = [
        person for person in personnel_store.values()
        if not person.is_archived and (not station_id or person.station_id == station_id)
    ]
    availability = {
        key: sum(_enum_value(person.availability_status) == key for person in scoped_people)
        for key in ("AVAILABLE", "DEPLOYED", "OFF", "IN_TRAINING", "ON_CALL")
    }

    readiness_by_unit = {item["unit_id"]: item for item in readiness}
    station_network = {"online": 0, "staffing_attention": 0, "offline": 0}
    scoped_stations = [
        station for station in stations_store.values()
        if not station_id or station.station_id == station_id
    ]
    for station in scoped_stations:
        station_units = [unit for unit in scoped_units if unit.station_id == station.station_id]
        if not station_units or all(
            _enum_value(unit.operational_status) in {"OUT_OF_SERVICE", "MAINTENANCE"}
            for unit in station_units
        ):
            station_network["offline"] += 1
        elif any(
            readiness_by_unit.get(unit.unit_id, {}).get("readiness_score", 0) < 85
            for unit in station_units
        ):
            station_network["staffing_attention"] += 1
        else:
            station_network["online"] += 1

    apparatus = []
    for key, label, unit_types in APPARATUS_GROUPS:
        group = [unit for unit in scoped_units if _enum_value(unit.type) in unit_types]
        in_service = sum(
            _enum_value(unit.operational_status) not in {"OUT_OF_SERVICE", "MAINTENANCE"}
            for unit in group
        )
        apparatus.append(CommandBoardApparatusGroup(
            key=key,
            label=label,
            total=len(group),
            in_service=in_service,
            out_of_service=len(group) - in_service,
            availability_pct=round((in_service / len(group) * 100) if group else 0.0, 1),
        ))

    incident_types = {
        incident_type: sum(
            _enum_value(incident.incident_type) == incident_type for incident in incidents
        )
        for incident_type in ("FIRE", "EMS", "HAZMAT", "OTHER")
    }
    high_priority = sorted(
        (incident for incident in incidents if _enum_value(incident.priority) in {"HIGH", "CRITICAL"}),
        key=lambda incident: incident.created_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    recent_alerts = sorted(
        alerts,
        key=lambda alert: alert.created_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )

    return CommandBoard(
        personnel=CommandBoardPersonnel(
            authorized=sum(item["staff_required"] for item in readiness),
            on_duty=sum(item["staff_present"] for item in readiness),
            available=availability["AVAILABLE"],
            deployed=availability["DEPLOYED"],
            off=availability["OFF"],
            in_training=availability["IN_TRAINING"],
            on_call=availability["ON_CALL"],
        ),
        incident_types=incident_types,
        station_network=CommandBoardStationNetwork(
            total=len(scoped_stations),
            online=station_network["online"],
            staffing_attention=station_network["staffing_attention"],
            offline=station_network["offline"],
        ),
        apparatus=apparatus,
        duty_brief=CommandBoardDutyBrief(
            active_incidents=len(incidents),
            open_alerts=sum(alert.state == AlertState.OPEN for alert in alerts),
            staffing_attention_stations=station_network["staffing_attention"],
            critical_units=sum(item["readiness_score"] < 60 for item in readiness),
            high_priority_incidents=[
                f"{incident.title} — {incident.display_location or 'Location pending'}"
                for incident in high_priority[:3]
            ],
            alert_messages=[alert.message for alert in recent_alerts[:3]],
            recommendations=[item.message for item in recommendations[:3]],
        ),
    )


# ── Dashboard summary ─────────────────────────────────────────────────────────

@router.get("/api/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary():
    unit_readiness = ReadinessService.check_all_units()
    unit_records = dict(units_store.items())
    total = len(unit_readiness)
    ready = sum(1 for u in unit_readiness if u["readiness_score"] >= 85)
    degraded = sum(1 for u in unit_readiness if 60 <= u["readiness_score"] < 85)
    critical = sum(1 for u in unit_readiness if u["readiness_score"] < 60)
    overall = (sum(u["readiness_score"] for u in unit_readiness) / total) if total else 0.0

    open_alerts = sum(1 for a in alerts_store.values() if a.state == AlertState.OPEN)
    active_inc = sum(1 for i in incidents_store.values() if i.is_active)

    station_summaries = []
    for st in stations_store.values():
        st_units = [
            unit for unit in unit_readiness
            if unit_records.get(unit["unit_id"])
            and unit_records[unit["unit_id"]].station_id == st.station_id
        ]
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


@router.get("/api/operations/snapshot", response_model=OperationsSnapshot)
async def operations_snapshot(station_id: str | None = Query(None)):
    readiness = ReadinessService.check_all_units()
    if station_id:
        unit_records = dict(units_store.items())
        readiness = [
            item for item in readiness
            if unit_records.get(item["unit_id"])
            and unit_records[item["unit_id"]].station_id == station_id
        ]
    alerts = [
        alert for alert in alerts_store.values()
        if alert.state != AlertState.RESOLVED
        and (not station_id or alert.station_id == station_id)
    ]
    incidents = [
        incident for incident in incidents_store.values()
        if incident.is_active and (not station_id or incident.station_id == station_id)
    ]
    renewals = [
        task for task in renewal_tasks_store.values()
        if task.status.value not in {"COMPLETED", "CANCELLED"}
    ]
    summary = await get_dashboard_summary()
    recommendations = RecommendationService.generate_recommendations()
    if station_id:
        unit_ids = {item['unit_id'] for item in readiness}
        people = dict(personnel_store.items())
        renewals = [task for task in renewals if task.personnel_id in people and people[task.personnel_id].station_id == station_id]
        recommendations = [item for item in recommendations if item.unit_id in unit_ids]
        summary = summary.model_copy(update={
            'total_units': len(readiness),
            'ready_units': sum(item['readiness_score'] >= 85 for item in readiness),
            'degraded_units': sum(60 <= item['readiness_score'] < 85 for item in readiness),
            'critical_units': sum(item['readiness_score'] < 60 for item in readiness),
            'overall_readiness_pct': round(sum(item['readiness_score'] for item in readiness) / len(readiness), 1) if readiness else 0,
            'open_alerts': sum(alert.state == AlertState.OPEN for alert in alerts),
            'active_incidents': len(incidents),
            'station_summaries': [item for item in summary.station_summaries if item['station_id'] == station_id],
        })
    activity = sorted(
        audit_events_store.values(),
        key=lambda event: event.created_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )[:12]
    command_board = _build_command_board(
        station_id=station_id,
        readiness=readiness,
        alerts=alerts,
        incidents=incidents,
        recommendations=recommendations,
    )
    return {
        "summary": summary,
        "command_board": command_board,
        "units": readiness,
        "alerts": alerts,
        "incidents": incidents,
        "recommendations": recommendations[:8],
        "renewals": renewals,
        "activity": activity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


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


@router.get("/api/weather/fairfax", response_model=FairfaxWeatherResponse)
async def fairfax_weather():
    """Return a cached NWS forecast with explicit stale/unavailable state."""
    return await asyncio.to_thread(weather_service.get_weather)


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
    alerts_store[alert_id] = alert
    record_audit(
        "ACKNOWLEDGED",
        "alert",
        alert_id,
        f"Acknowledged {alert.alert_type.value.replace('_', ' ').title()}",
        actor=body.acknowledged_by,
        details={"note": body.note},
    )
    return alert


@router.post("/api/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str):
    alert = alerts_store.get(alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    alert.state = AlertState.RESOLVED
    alert.resolved_at = datetime.now(timezone.utc)
    alerts_store[alert_id] = alert
    record_audit("RESOLVED", "alert", alert_id, f"Resolved {alert.alert_type.value.replace('_', ' ').title()}")
    return alert


# ── Incidents ─────────────────────────────────────────────────────────────────

@router.get("/api/incidents")
async def list_incidents(active_only: bool = True):
    incidents = list(incidents_store.values())
    if active_only:
        incidents = [i for i in incidents if i.is_active]
    return incidents


@router.post("/api/incidents", response_model=OperationalIncident)
async def create_incident(incident: OperationalIncident):
    incident.incident_id = f"inc-{uuid.uuid4().hex[:12]}"
    incident.created_at = datetime.now(timezone.utc)
    incident.is_active = True
    if incident.status == IncidentStatus.RESOLVED:
        incident.status = IncidentStatus.ACTIVE
    incidents_store[incident.incident_id] = incident
    record_audit(
        "CREATED", "incident", incident.incident_id, f"Opened incident: {incident.title}",
        details=incident_lifecycle_details(None, incident, recorded_at=incident.created_at),
    )
    return incident


@router.put("/api/incidents/{incident_id}", response_model=OperationalIncident)
async def update_incident(incident_id: str, incident: OperationalIncident):
    existing = incidents_store.get(incident_id)
    if not existing:
        raise HTTPException(404, "Incident not found")
    incident.incident_id = incident_id
    incident.created_at = incident.created_at or existing.created_at
    additive_fields = {
        "incident_type", "display_location", "status", "latitude", "longitude",
        "source", "source_reference",
    }
    incident = incident.model_copy(update={
        field: getattr(existing, field)
        for field in additive_fields
        if field not in incident.model_fields_set
    })
    if _enum_value(incident.status) == "RESOLVED":
        incident.is_active = False
        incident.resolved_at = incident.resolved_at or datetime.now(timezone.utc)
    incidents_store[incident_id] = incident
    record_audit(
        "UPDATED", "incident", incident_id, f"Updated incident: {incident.title}",
        details=incident_lifecycle_details(existing, incident),
    )
    return incident


@router.post("/api/incidents/{incident_id}/resolve")
async def resolve_incident(incident_id: str):
    inc = incidents_store.get(incident_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    before = inc.model_copy()
    inc.is_active = False
    inc.status = IncidentStatus.RESOLVED
    inc.resolved_at = datetime.now(timezone.utc)
    incidents_store[incident_id] = inc
    record_audit(
        "RESOLVED", "incident", incident_id, f"Resolved incident: {inc.title}",
        details=incident_lifecycle_details(before, inc, recorded_at=inc.resolved_at),
    )
    return inc


@router.get("/api/audit-events", response_model=list[AuditEvent])
async def list_audit_events(
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
):
    events = list(audit_events_store.values())
    if entity_type:
        events = [event for event in events if event.entity_type == entity_type]
    if entity_id:
        events = [event for event in events if event.entity_id == entity_id]
    events.sort(
        key=lambda event: event.created_at or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    return events[:limit]


# ── Recommendations ───────────────────────────────────────────────────────────

@router.get("/api/recommendations")
async def get_recommendations(unit_id: str | None = None):
    recs = RecommendationService.generate_recommendations()
    if unit_id:
        recs = [r for r in recs if r.unit_id == unit_id]
    return recs


# ── Analytics extensions ──────────────────────────────────────────────────────

@router.get("/api/analytics/readiness-trends")
async def readiness_trends(
    days: int = Query(14, ge=7, le=90),
    station_id: str | None = Query(None),
):
    """Return a scoped readiness trend for the requested analysis window."""
    from datetime import timedelta
    import random

    random.seed(42)
    now = datetime.now(timezone.utc)
    stations = [
        station for station in stations_store.values()
        if not station_id or station.station_id == station_id
    ]
    if not stations:
        return []

    result = []
    current_readiness = ReadinessService.check_all_units()
    unit_records = dict(units_store.items())
    for day_offset in range(days - 1, -1, -1):
        day = (now - timedelta(days=day_offset)).strftime("%Y-%m-%d")
        entry: dict = {"date": day}
        total_score = 0
        count = 0
        for st in stations:
            base = 72 + random.randint(-8, 12) if day_offset > 0 else None
            score = base if base else None
            if day_offset == 0:
                st_scores = [
                    r["readiness_score"]
                    for r in current_readiness
                    if unit_records.get(r["unit_id"]) and unit_records[r["unit_id"]].station_id == st.station_id
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
async def certification_risk(
    days_ahead: int = Query(90, ge=1, le=365),
    station_id: str | None = Query(None),
):
    """Return a scoped personnel certification risk forecast."""
    now = datetime.now(timezone.utc)
    rows = []
    for p in personnel_store.values():
        if station_id and p.station_id != station_id:
            continue
        for cert_name, exp in p.cert_expirations.items():
            if isinstance(exp, str):
                try:
                    exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
                except Exception:
                    continue
            if not isinstance(exp, datetime):
                continue
            days_left = (exp - now).days
            if days_left <= days_ahead:
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
async def staffing_gaps(station_id: str | None = Query(None)):
    """Return staffing gaps by unit for the selected station scope."""
    readiness = ReadinessService.check_all_units()
    unit_records = dict(units_store.items())
    rows = []
    for r in readiness:
        unit = unit_records.get(r["unit_id"])
        if not unit:
            continue
        if station_id and unit.station_id != station_id:
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
    record_audit("RESET", "demo", "fcfrd-demo", "Reset synthetic Fairfax concept data")
    return {"status": "ok", "seeded": counts}

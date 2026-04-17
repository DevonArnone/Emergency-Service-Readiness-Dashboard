"""Deterministic demo seed for Ridgecrest Emergency Services District."""
import uuid
import logging
from datetime import datetime, timezone, timedelta
from app.models import (
    Personnel, Unit, UnitAssignment, Certification, Station,
    ReadinessAlert, OperationalIncident,
    AvailabilityStatus, UnitType, AssignmentStatus,
    AlertType, AlertState, IncidentPriority,
)
from app.stores import (
    personnel_store, units_store, unit_assignments_store,
    certifications_store, stations_store, alerts_store, incidents_store,
)

logger = logging.getLogger(__name__)

NOW = datetime.now(timezone.utc)
TODAY_START = NOW.replace(hour=6, minute=0, second=0, microsecond=0)
TODAY_END = NOW.replace(hour=18, minute=0, second=0, microsecond=0)


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def seed_demo() -> dict:
    """Reset all stores and load deterministic Ridgecrest district data."""
    for store in (
        personnel_store, units_store, unit_assignments_store,
        certifications_store, stations_store, alerts_store, incidents_store,
    ):
        store.clear()

    # ── Certifications ────────────────────────────────────────────────────────
    certs = [
        ("FF1",              "Firefighter Level I",                 "Fire",   365),
        ("FF2",              "Firefighter Level II",                "Fire",   730),
        ("HazMat-Ops",       "HazMat Operations",                  "Fire",   365),
        ("HazMat-Tech",      "HazMat Technician",                  "Fire",   365),
        ("EMT-B",            "Emergency Medical Technician Basic",  "EMS",    365),
        ("EMT-P",            "Paramedic",                          "EMS",    730),
        ("NREMT",            "National Registry EMT",               "EMS",    730),
        ("ACLS",             "Advanced Cardiac Life Support",       "EMS",    365),
        ("CPR-Pro",          "CPR Professional",                   "EMS",    365),
        ("Rescue-Tech",      "Rescue Technician",                  "Rescue", 365),
        ("Swift-Water",      "Swift Water Rescue",                 "Rescue", 365),
        ("Confined-Space",   "Confined Space Rescue",              "Rescue", 365),
    ]
    cert_ids: dict[str, str] = {}
    for name, desc, category, days in certs:
        c = Certification(
            certification_id=_uid("cert"),
            name=name,
            description=desc,
            category=category,
            typical_validity_days=days,
            created_at=NOW,
        )
        certifications_store[c.certification_id] = c
        cert_ids[name] = c.certification_id

    # ── Units ─────────────────────────────────────────────────────────────────
    unit_defs = [
        # (id_key, name, type, min_staff, required_certs, station)
        ("u-eng1",  "Engine 1",   UnitType.ENGINE,   4, ["FF1", "FF2", "HazMat-Ops"],  "s1"),
        ("u-lad1",  "Ladder 1",   UnitType.LADDER,   3, ["FF1", "FF2"],                "s1"),
        ("u-med1",  "Medic 1",    UnitType.MEDIC,    2, ["EMT-P", "ACLS"],             "s1"),
        ("u-eng2",  "Engine 2",   UnitType.ENGINE,   4, ["FF1", "FF2"],                "s2"),
        ("u-res2",  "Rescue 2",   UnitType.RESCUE,   3, ["Rescue-Tech", "FF1"],        "s2"),
        ("u-med2",  "Medic 2",    UnitType.MEDIC,    2, ["EMT-P", "ACLS"],             "s2"),
        ("u-eng3",  "Engine 3",   UnitType.ENGINE,   3, ["FF1", "FF2", "HazMat-Tech"], "s3"),
        ("u-sar3",  "SAR Team 3", UnitType.SAR_TEAM, 4, ["Rescue-Tech", "Swift-Water", "HazMat-Ops"], "s3"),
    ]
    unit_ids: dict[str, str] = {}
    for key, name, utype, min_staff, req_certs, st_key in unit_defs:
        u = Unit(
            unit_id=_uid("unit"),
            unit_name=name,
            type=utype,
            minimum_staff=min_staff,
            required_certifications=req_certs,
            station_id=st_key,
        )
        units_store[u.unit_id] = u
        unit_ids[key] = u.unit_id

    # ── Stations ─────────────────────────────────────────────────────────────
    station_defs = [
        ("s1", "Station 1 — Ridgecrest HQ",  "Downtown District",   "100 Main St, Ridgecrest",
         ["u-eng1", "u-lad1", "u-med1"]),
        ("s2", "Station 2 — Northside",       "Residential District", "800 Maple Ave, Ridgecrest",
         ["u-eng2", "u-res2", "u-med2"]),
        ("s3", "Station 3 — Industrial Zone", "Harbor District",     "2200 Port Rd, Ridgecrest",
         ["u-eng3", "u-sar3"]),
    ]
    for st_key, name, district, address, unit_keys in station_defs:
        s = Station(
            station_id=st_key,
            name=name,
            district=district,
            address=address,
            unit_ids=[unit_ids[k] for k in unit_keys],
        )
        stations_store[st_key] = s

    # ── Personnel ─────────────────────────────────────────────────────────────
    # (name, rank, role, certs, cert_expirations_offset_days, status, station, unit_key)
    # cert_expirations_offset_days: positive = expires in N days, negative = expired N days ago
    far = 300
    expired_days = -15
    expiring_soon = 7

    personnel_defs = [
        # Station 1 — fully staffed except Medic 1 has an expired ACLS
        ("Capt. James Ortega",  "Captain",    "Fire Captain",
         ["FF1","FF2","HazMat-Ops","EMT-B"],
         {"FF1": far, "FF2": far, "HazMat-Ops": far, "EMT-B": far},
         AvailabilityStatus.AVAILABLE, "s1", "u-eng1"),

        ("Lt. Dana Reyes",     "Lieutenant", "Firefighter/EMT",
         ["FF1","FF2","EMT-B"],
         {"FF1": far, "FF2": far, "EMT-B": far},
         AvailabilityStatus.AVAILABLE, "s1", "u-eng1"),

        ("FF Marcus Webb",     None,          "Firefighter",
         ["FF1","HazMat-Ops"],
         {"FF1": far, "HazMat-Ops": far},
         AvailabilityStatus.AVAILABLE, "s1", "u-eng1"),

        ("FF Priya Mehta",     None,          "Firefighter",
         ["FF1","FF2"],
         {"FF1": far, "FF2": far},
         AvailabilityStatus.AVAILABLE, "s1", "u-eng1"),

        ("Lt. Sam Bricker",    "Lieutenant", "Firefighter",
         ["FF1","FF2"],
         {"FF1": far, "FF2": far},
         AvailabilityStatus.AVAILABLE, "s1", "u-lad1"),

        ("FF Keisha Noel",     None,          "Firefighter",
         ["FF1"],
         {"FF1": far},
         AvailabilityStatus.AVAILABLE, "s1", "u-lad1"),

        ("FF Omar Hassan",     None,          "Firefighter",
         ["FF1","FF2"],
         {"FF1": far, "FF2": far},
         AvailabilityStatus.IN_TRAINING, "s1", None),  # in training, not assigned

        # Medic 1 — one crew member has expired ACLS (intentional problem)
        ("Paramedic Alicia Torres", "Senior Paramedic", "Paramedic",
         ["EMT-P","ACLS","NREMT","CPR-Pro"],
         {"EMT-P": far, "ACLS": expired_days, "NREMT": far, "CPR-Pro": far},
         AvailabilityStatus.AVAILABLE, "s1", "u-med1"),

        ("EMT-B Carlos Diaz",  None,          "EMT-Basic",
         ["EMT-B","CPR-Pro"],
         {"EMT-B": far, "CPR-Pro": far},
         AvailabilityStatus.AVAILABLE, "s1", "u-med1"),

        # Station 2 — Engine 2 understaffed (only 2/4 on shift today, callout)
        ("Capt. Helen Park",   "Captain",    "Fire Captain",
         ["FF1","FF2","HazMat-Ops","EMT-B"],
         {"FF1": far, "FF2": far, "HazMat-Ops": far, "EMT-B": far},
         AvailabilityStatus.AVAILABLE, "s2", "u-eng2"),

        ("Lt. Devon Chan",     "Lieutenant", "Firefighter",
         ["FF1","FF2"],
         {"FF1": far, "FF2": far},
         AvailabilityStatus.AVAILABLE, "s2", "u-eng2"),

        ("FF Terrell Grant",   None,          "Firefighter",
         ["FF1"],
         {"FF1": far},
         AvailabilityStatus.OFF, "s2", None),   # called out

        ("FF Isabelle Vega",   None,          "Firefighter",
         ["FF1","FF2"],
         {"FF1": far, "FF2": far},
         AvailabilityStatus.OFF, "s2", None),   # called out

        # Rescue 2 — cert expiring soon
        ("Lt. Ryan Cho",       "Lieutenant", "Rescue Technician",
         ["Rescue-Tech","FF1","Swift-Water"],
         {"Rescue-Tech": expiring_soon, "FF1": far, "Swift-Water": far},
         AvailabilityStatus.AVAILABLE, "s2", "u-res2"),

        ("FF Naomi Watts",     None,          "Rescue Firefighter",
         ["Rescue-Tech","FF1"],
         {"Rescue-Tech": far, "FF1": far},
         AvailabilityStatus.AVAILABLE, "s2", "u-res2"),

        ("FF Leo Santos",      None,          "Rescue Firefighter",
         ["FF1"],
         {"FF1": far},
         AvailabilityStatus.AVAILABLE, "s2", "u-res2"),

        ("Paramedic Janet Wu",  None,         "Paramedic",
         ["EMT-P","ACLS","NREMT","CPR-Pro"],
         {"EMT-P": far, "ACLS": far, "NREMT": far, "CPR-Pro": far},
         AvailabilityStatus.AVAILABLE, "s2", "u-med2"),

        ("EMT-P Kevin Moore",  None,          "Paramedic",
         ["EMT-P","ACLS","CPR-Pro"],
         {"EMT-P": far, "ACLS": far, "CPR-Pro": far},
         AvailabilityStatus.AVAILABLE, "s2", "u-med2"),

        # Station 3 — SAR missing HazMat-Ops (intentional)
        ("Capt. Tara Singh",   "Captain",    "Fire Captain",
         ["FF1","FF2","HazMat-Tech","EMT-B"],
         {"FF1": far, "FF2": far, "HazMat-Tech": far, "EMT-B": far},
         AvailabilityStatus.AVAILABLE, "s3", "u-eng3"),

        ("FF Bruno Costa",     None,          "Firefighter",
         ["FF1","FF2","HazMat-Tech"],
         {"FF1": far, "FF2": far, "HazMat-Tech": far},
         AvailabilityStatus.AVAILABLE, "s3", "u-eng3"),

        ("FF Mei Lin",         None,          "Firefighter",
         ["FF1","HazMat-Tech"],
         {"FF1": far, "HazMat-Tech": far},
         AvailabilityStatus.AVAILABLE, "s3", "u-eng3"),

        ("Sgt. Alan Kroft",    "Sergeant",   "SAR Team Leader",
         ["Rescue-Tech","Swift-Water","Confined-Space"],
         {"Rescue-Tech": far, "Swift-Water": far, "Confined-Space": far},
         AvailabilityStatus.AVAILABLE, "s3", "u-sar3"),

        ("Spec. Rosa Delgado", None,          "SAR Specialist",
         ["Rescue-Tech","Swift-Water"],
         {"Rescue-Tech": far, "Swift-Water": far},
         AvailabilityStatus.AVAILABLE, "s3", "u-sar3"),

        ("Spec. Finn Brady",   None,          "SAR Specialist",
         ["Rescue-Tech","Confined-Space"],
         {"Rescue-Tech": far, "Confined-Space": far},
         AvailabilityStatus.AVAILABLE, "s3", "u-sar3"),

        ("Spec. Chloe Evans",  None,          "SAR Specialist",
         ["Rescue-Tech"],
         {"Rescue-Tech": far},
         AvailabilityStatus.AVAILABLE, "s3", "u-sar3"),
    ]

    person_ids: dict[str, str] = {}
    for (name, rank, role, certs, cert_exp_offsets,
         status, st_key, unit_key) in personnel_defs:
        cert_expirations = {
            cert: (NOW + timedelta(days=offset)).isoformat()
            for cert, offset in cert_exp_offsets.items()
        }
        p = Personnel(
            personnel_id=_uid("person"),
            name=name,
            rank=rank,
            role=role,
            certifications=certs,
            cert_expirations=cert_expirations,
            availability_status=status,
            station_id=st_key,
            current_unit_id=unit_ids.get(unit_key) if unit_key else None,
        )
        personnel_store[p.personnel_id] = p
        person_ids[name] = p.personnel_id

    # ── Unit Assignments ──────────────────────────────────────────────────────
    # Map unit_key → list of personnel names that should be assigned today
    assignments_map = {
        "u-eng1": [
            "Capt. James Ortega", "Lt. Dana Reyes",
            "FF Marcus Webb",     "FF Priya Mehta",
        ],
        "u-lad1": ["Lt. Sam Bricker", "FF Keisha Noel"],
        "u-med1": ["Paramedic Alicia Torres", "EMT-B Carlos Diaz"],
        # Engine 2: only 2 show up (Grant & Vega called out)
        "u-eng2": ["Capt. Helen Park", "Lt. Devon Chan"],
        "u-res2": ["Lt. Ryan Cho", "FF Naomi Watts", "FF Leo Santos"],
        "u-med2": ["Paramedic Janet Wu", "EMT-P Kevin Moore"],
        "u-eng3": ["Capt. Tara Singh", "FF Bruno Costa", "FF Mei Lin"],
        "u-sar3": [
            "Sgt. Alan Kroft", "Spec. Rosa Delgado",
            "Spec. Finn Brady", "Spec. Chloe Evans",
        ],
    }
    for unit_key, names in assignments_map.items():
        uid = unit_ids[unit_key]
        for name in names:
            pid = person_ids.get(name)
            if not pid:
                continue
            a = UnitAssignment(
                assignment_id=_uid("asgn"),
                unit_id=uid,
                personnel_id=pid,
                shift_start=TODAY_START,
                shift_end=TODAY_END,
                assignment_status=AssignmentStatus.ON_SHIFT,
            )
            unit_assignments_store[a.assignment_id] = a

    # ── Alerts ────────────────────────────────────────────────────────────────
    alert_defs = [
        dict(
            alert_type=AlertType.UNDERSTAFFED_UNIT,
            state=AlertState.OPEN,
            unit_id=unit_ids["u-eng2"],
            station_id="s2",
            message="Engine 2 is understaffed: 2 of 4 required personnel on shift.",
            details={"staff_present": 2, "staff_required": 4, "callouts": ["FF Terrell Grant", "FF Isabelle Vega"]},
        ),
        dict(
            alert_type=AlertType.EXPIRED_CERTIFICATION,
            state=AlertState.OPEN,
            unit_id=unit_ids["u-med1"],
            station_id="s1",
            personnel_id=person_ids["Paramedic Alicia Torres"],
            message="Paramedic Alicia Torres: ACLS certification expired 15 days ago.",
            details={"cert": "ACLS", "expired_days_ago": 15},
        ),
        dict(
            alert_type=AlertType.EXPIRING_CERTIFICATION,
            state=AlertState.ACKNOWLEDGED,
            unit_id=unit_ids["u-res2"],
            station_id="s2",
            personnel_id=person_ids["Lt. Ryan Cho"],
            message="Lt. Ryan Cho: Rescue-Tech certification expires in 7 days.",
            details={"cert": "Rescue-Tech", "expires_in_days": 7},
            acknowledged_by="Admin",
            acknowledged_note="Renewal class scheduled for next Tuesday.",
        ),
        dict(
            alert_type=AlertType.UNDERSTAFFED_UNIT,
            state=AlertState.OPEN,
            unit_id=unit_ids["u-lad1"],
            station_id="s1",
            message="Ladder 1 is understaffed: 2 of 3 required personnel on shift.",
            details={"staff_present": 2, "staff_required": 3},
        ),
    ]
    for ad in alert_defs:
        ack_by = ad.pop("acknowledged_by", None)
        ack_note = ad.pop("acknowledged_note", None)
        alert = ReadinessAlert(
            alert_id=_uid("alert"),
            created_at=NOW - timedelta(minutes=45),
            acknowledged_at=(NOW - timedelta(minutes=20)) if ack_by else None,
            acknowledged_by=ack_by,
            acknowledged_note=ack_note,
            **ad,
        )
        alerts_store[alert.alert_id] = alert

    # ── Incidents ─────────────────────────────────────────────────────────────
    incident_defs = [
        dict(
            title="Structure Fire — 4th & Main",
            description="Two-story commercial structure, possible occupants. Engine 1 and Ladder 1 dispatched.",
            priority=IncidentPriority.HIGH,
            station_id="s1",
            unit_id=unit_ids["u-eng1"],
            is_active=True,
        ),
        dict(
            title="Vehicle Extrication — I-77 MP 42",
            description="Multi-vehicle collision, one entrapment. Rescue 2 and Medic 2 en route.",
            priority=IncidentPriority.MEDIUM,
            station_id="s2",
            unit_id=unit_ids["u-res2"],
            is_active=True,
        ),
        dict(
            title="HazMat Spill — Port Rd Tank Farm",
            description="Chemical leak at industrial storage site. SAR Team 3 on standby.",
            priority=IncidentPriority.CRITICAL,
            station_id="s3",
            unit_id=unit_ids["u-sar3"],
            is_active=True,
        ),
    ]
    for inc_def in incident_defs:
        inc = OperationalIncident(
            incident_id=_uid("inc"),
            created_at=NOW - timedelta(minutes=30),
            **inc_def,
        )
        incidents_store[inc.incident_id] = inc

    return {
        "stations": len(stations_store),
        "units": len(units_store),
        "personnel": len(personnel_store),
        "certifications": len(certifications_store),
        "assignments": len(unit_assignments_store),
        "alerts": len(alerts_store),
        "incidents": len(incidents_store),
    }

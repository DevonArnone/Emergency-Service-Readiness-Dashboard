"""Deterministic Fairfax County–scale concept data for Aegis Command."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.config import settings
from app.db.models import (
    Alert,
    AuditEvent,
    Battalion,
    CertificationType,
    Incident,
    IncidentUnit,
    Organization,
    Personnel,
    PersonnelCertification,
    RenewalTask,
    Shift,
    Station,
    Unit,
    UnitAssignment,
)
from app.db.session import session_scope
from app.db.store import clear_operational_data


STATION_DATA = Path(__file__).parents[2] / "data" / "fairfax_fire_stations.geojson"
ORGANIZATION_NAME = "Fairfax County Fire and Rescue Department — Unofficial Concept"
DATASET_DISCLAIMER = (
    "Synthetic operational data for a portfolio concept. Not affiliated with or endorsed by Fairfax County."
)


CERTIFICATIONS = (
    ("FF1", "Firefighter I", "Fire", 730),
    ("FF2", "Firefighter II", "Fire", 730),
    ("EMT", "Emergency Medical Technician", "EMS", 730),
    ("PARAMEDIC", "Nationally Registered Paramedic", "EMS", 730),
    ("ACLS", "Advanced Cardiac Life Support", "EMS", 365),
    ("HAZMAT-OPS", "Hazardous Materials Operations", "Special Operations", 365),
    ("HAZMAT-TECH", "Hazardous Materials Technician", "Special Operations", 365),
    ("TECH-RESCUE", "Technical Rescue Technician", "Special Operations", 365),
    ("DRIVER", "Emergency Vehicle Driver/Operator", "Operations", 730),
    ("AERIAL", "Aerial Apparatus Operator", "Operations", 730),
    ("ICS-300", "Intermediate Incident Command", "Command", 1095),
    ("SAFETY", "Incident Safety Officer", "Command", 730),
)


FIRST_NAMES = (
    "Alex", "Avery", "Blake", "Cameron", "Casey", "Dakota", "Drew", "Elliot", "Emerson", "Finley",
    "Harper", "Hayden", "Jordan", "Kai", "Kendall", "Lane", "Logan", "Morgan", "Parker", "Quinn",
    "Reese", "Riley", "River", "Robin", "Rowan", "Sage", "Sam", "Sawyer", "Shawn", "Skyler",
    "Sydney", "Taylor", "Terry", "Val", "Winter", "Arden", "Bailey", "Corey", "Devon", "Jamie",
)
LAST_NAMES = (
    "Adams", "Bennett", "Brooks", "Campbell", "Chen", "Clark", "Collins", "Cooper", "Diaz", "Edwards",
    "Evans", "Foster", "Garcia", "Grant", "Green", "Hall", "Harris", "Hayes", "Hughes", "Jackson",
    "James", "Johnson", "Kim", "Lee", "Lewis", "Martin", "Martinez", "Miller", "Mitchell", "Moore",
    "Morgan", "Nguyen", "Ortiz", "Patel", "Price", "Reed", "Rivera", "Robinson", "Ross", "Scott",
)


def _watch_window(now: datetime) -> tuple[datetime, datetime]:
    start = now.replace(hour=7, minute=0, second=0, microsecond=0)
    if now < start:
        start -= timedelta(days=1)
    return start, start + timedelta(hours=24)


def _load_station_features() -> list[dict]:
    payload = json.loads(STATION_DATA.read_text(encoding="utf-8"))
    features = payload["features"]
    if len(features) != 39:
        raise RuntimeError(f"Expected 39 Fairfax County stations, found {len(features)}")
    return features


def _unit_plan(stations: list[dict]) -> list[dict]:
    plan: list[dict] = []

    def add(kind: str, label: str, minimum_staff: int, certs: list[str], station_index: int) -> None:
        station = stations[station_index % len(stations)]
        number = int(station["properties"]["station_number"])
        sequence = sum(1 for item in plan if item["kind"] == kind) + 1
        plan.append({
            "unit_id": f"unit-{kind.lower()}-{sequence:02d}",
            "call_sign": f"{label}{400 + number}",
            "kind": kind,
            "minimum_staff": minimum_staff,
            "certs": certs,
            "station_id": station["properties"]["station_id"],
        })

    for index in range(39):
        add("ENGINE", "E", 4, ["FF2", "HAZMAT-OPS", "DRIVER"], index)
    for index in range(23):
        add("MEDIC", "M", 2, ["PARAMEDIC", "ACLS"], index)
    for index in list(range(23, 39)) + list(range(4)):
        add("AMBULANCE", "A", 2, ["EMT"], index)
    for index in range(14):
        add("TRUCK", "T", 4, ["FF2", "AERIAL"], index)
    for index in (1, 6, 11, 16, 21, 26, 31, 36):
        add("RESCUE", "R", 4, ["FF2", "TECH-RESCUE"], index)
    for index in (2, 12, 15, 18, 30, 37):
        add("TANKER", "TN", 1, ["DRIVER"], index)

    command_definitions = (
        ("unit-deputy-01", "DC-Alpha", 2, 0),
        ("unit-deputy-02", "DC-Bravo", 2, 0),
        ("unit-staffing-01", "Staffing-1", 1, 0),
        *((f"unit-battalion-{index:02d}", f"BC-{index}", 1, (index - 1) * 5) for index in range(1, 9)),
        *((f"unit-ems-{index:02d}", f"EMS-{index}", 1, (index - 1) * 8) for index in range(1, 6)),
    )
    for unit_id, call_sign, minimum_staff, station_index in command_definitions:
        plan.append({
            "unit_id": unit_id, "call_sign": call_sign, "kind": "COMMAND",
            "minimum_staff": minimum_staff, "certs": ["ICS-300"],
            "station_id": stations[station_index % 39]["properties"]["station_id"],
        })
    plan.extend((
        {"unit_id": "unit-hazmat-01", "call_sign": "HazMat-440", "kind": "HAZMAT", "minimum_staff": 4,
         "certs": ["FF2", "HAZMAT-TECH"], "station_id": "fs-40"},
        {"unit_id": "unit-hazmat-02", "call_sign": "HazMat-Support-440", "kind": "HAZMAT", "minimum_staff": 2,
         "certs": ["HAZMAT-OPS", "DRIVER"], "station_id": "fs-40"},
    ))
    for index, station_id in enumerate(("fs-01", "fs-22", "fs-40"), start=1):
        plan.append({
            "unit_id": f"unit-safety-{index:02d}", "call_sign": f"Safety-{index}", "kind": "SAFETY",
            "minimum_staff": 1, "certs": ["ICS-300", "SAFETY"], "station_id": station_id,
        })

    if len(plan) != 131 or sum(item["minimum_staff"] for item in plan) != 363:
        raise RuntimeError("The Fairfax concept apparatus plan must remain 131 units / 363 minimum staffing")
    return plan


def _person_name(index: int) -> str:
    first = FIRST_NAMES[(index - 1) % len(FIRST_NAMES)]
    last = LAST_NAMES[((index - 1) // len(FIRST_NAMES)) % len(LAST_NAMES)]
    return f"{first} {last}"


def _role_for_unit(unit: dict, slot: int) -> tuple[str, str | None]:
    kind = unit["kind"]
    if kind == "COMMAND":
        return ("Command Officer", "Battalion Chief" if unit["call_sign"].startswith("BC") else "Deputy Chief")
    if kind == "MEDIC":
        return ("Paramedic", "Lieutenant" if slot == 0 else None)
    if kind == "AMBULANCE":
        return ("Emergency Medical Technician", None)
    if kind in {"ENGINE", "TRUCK", "RESCUE", "HAZMAT"}:
        return ("Company Officer" if slot == 0 else "Firefighter/EMT", "Captain" if slot == 0 else None)
    if kind == "SAFETY":
        return ("Incident Safety Officer", "Captain")
    return ("Driver/Operator", None)


def _certifications_for(unit: dict, slot: int) -> list[str]:
    required = list(unit["certs"])
    if unit["kind"] in {"ENGINE", "TRUCK", "RESCUE", "HAZMAT"}:
        required.extend(["FF1", "EMT"])
    if slot > 0 and "DRIVER" in required:
        required.remove("DRIVER")
    return list(dict.fromkeys(required))


def seed_demo() -> dict:
    """Reset one tenant and load a deterministic, explicitly synthetic agency-scale dataset."""
    organization_id = settings.default_organization_id
    now = datetime.now(timezone.utc)
    watch_start, watch_end = _watch_window(now)
    station_features = _load_station_features()
    unit_plan = _unit_plan(station_features)
    clear_operational_data(organization_id)

    with session_scope(organization_id) as session:
        organization = session.get(Organization, organization_id)
        if organization is None:
            organization = Organization(
                organization_id=organization_id, slug="fairfax-concept",
                name=ORGANIZATION_NAME, is_public_demo=True,
            )
            session.add(organization)
        else:
            organization.name = ORGANIZATION_NAME
            organization.is_public_demo = True
        session.flush()

        session.add_all([
            Battalion(
                battalion_id=f"battalion-{index}", organization_id=organization_id,
                code=f"B{index}", name=f"Battalion {index}", division="Synthetic concept assignment",
            )
            for index in range(1, 9)
        ])
        session.flush()

        stations: list[Station] = []
        for index, feature in enumerate(station_features):
            properties = feature["properties"]
            longitude, latitude = feature["geometry"]["coordinates"]
            battalion_number = (index % 8) + 1
            stations.append(Station(
                station_id=properties["station_id"], organization_id=organization_id,
                battalion_id=f"battalion-{battalion_number}", station_number=properties["station_number"],
                name=f"Station {properties['station_number']} — {properties['name']}",
                district=f"Battalion {battalion_number} · synthetic assignment",
                address=properties["address"], latitude=latitude, longitude=longitude,
            ))
        session.add_all(stations)
        session.flush()

        session.add_all([
            CertificationType(
                certification_type_id=f"cert-{code.lower()}", organization_id=organization_id,
                code=code, name=name, category=category, validity_days=days,
            )
            for code, name, category, days in CERTIFICATIONS
        ])
        session.flush()

        units = [
            Unit(
                unit_id=item["unit_id"], organization_id=organization_id, station_id=item["station_id"],
                call_sign=item["call_sign"], unit_type=item["kind"], minimum_staff=item["minimum_staff"],
                operational_status="AVAILABLE", required_certification_codes=item["certs"],
            )
            for item in unit_plan
        ]
        session.add_all(units)
        session.flush()

        session.add_all([
            Shift(
                shift_id="shift-a", organization_id=organization_id, watch="A", location="Fairfax County",
                start_time=watch_start, end_time=watch_end, required_headcount=363, status="ACTIVE",
                notes=DATASET_DISCLAIMER,
            ),
            Shift(
                shift_id="shift-b", organization_id=organization_id, watch="B", location="Fairfax County",
                start_time=watch_end, end_time=watch_end + timedelta(hours=24), required_headcount=363,
                status="SCHEDULED", notes=DATASET_DISCLAIMER,
            ),
            Shift(
                shift_id="shift-c", organization_id=organization_id, watch="C", location="Fairfax County",
                start_time=watch_end + timedelta(hours=24), end_time=watch_end + timedelta(hours=48),
                required_headcount=363, status="SCHEDULED", notes=DATASET_DISCLAIMER,
            ),
        ])
        session.flush()

        eligible_gap_units = [item for item in unit_plan if item["minimum_staff"] >= 2]
        gap_unit_ids = {eligible_gap_units[index * 7]["unit_id"] for index in range(12)}
        people: list[Personnel] = []
        associations: list[PersonnelCertification] = []
        assignments: list[UnitAssignment] = []
        person_index = 0
        for unit in unit_plan:
            for slot in range(unit["minimum_staff"]):
                person_index += 1
                person_id = f"person-{person_index:04d}"
                absent = unit["unit_id"] in gap_unit_ids and slot == unit["minimum_staff"] - 1
                role, rank = _role_for_unit(unit, slot)
                people.append(Personnel(
                    personnel_id=person_id, organization_id=organization_id, station_id=unit["station_id"],
                    current_unit_id=None if absent else unit["unit_id"], name=_person_name(person_index),
                    rank=rank, role=role, availability_status="OFF" if absent else "DEPLOYED",
                    last_check_in=None if absent else watch_start + timedelta(minutes=person_index % 20),
                    notes=DATASET_DISCLAIMER,
                ))
                for code in _certifications_for(unit, slot):
                    associations.append(PersonnelCertification(
                        personnel_certification_id=f"pc-{person_index:04d}-{code.lower()}"[:64],
                        organization_id=organization_id, personnel_id=person_id,
                        certification_type_id=f"cert-{code.lower()}", issued_at=now - timedelta(days=180),
                        expires_at=now + timedelta(days=365), status="ACTIVE",
                    ))
                assignments.append(UnitAssignment(
                    assignment_id=f"assignment-{person_index:04d}", organization_id=organization_id,
                    unit_id=unit["unit_id"], personnel_id=person_id, shift_id="shift-a",
                    shift_start=watch_start, shift_end=watch_end,
                    assignment_status="ABSENT" if absent else "ON_SHIFT",
                    clocked_in_at=None if absent else watch_start + timedelta(minutes=person_index % 20),
                    notes="Synthetic staffing gap" if absent else DATASET_DISCLAIMER,
                ))

        station_ids = [feature["properties"]["station_id"] for feature in station_features]
        while person_index < 1450:
            person_index += 1
            person_id = f"person-{person_index:04d}"
            station_id = station_ids[(person_index - 1) % len(station_ids)]
            profile = person_index % 5
            profiles = (
                ("Paramedic", ["PARAMEDIC", "ACLS"]),
                ("Firefighter/EMT", ["FF1", "FF2", "EMT", "HAZMAT-OPS"]),
                ("Driver/Operator", ["FF1", "EMT", "DRIVER"]),
                ("Technical Rescue Specialist", ["FF1", "EMT", "TECH-RESCUE"]),
                ("Emergency Medical Technician", ["EMT"]),
            )
            role, codes = profiles[profile]
            status = ("AVAILABLE", "OFF", "IN_TRAINING", "ON_CALL")[person_index % 4]
            people.append(Personnel(
                personnel_id=person_id, organization_id=organization_id, station_id=station_id,
                name=_person_name(person_index), role=role, availability_status=status,
                last_check_in=now - timedelta(minutes=person_index % 240), notes=DATASET_DISCLAIMER,
            ))
            for code in codes:
                associations.append(PersonnelCertification(
                    personnel_certification_id=f"pc-{person_index:04d}-{code.lower()}"[:64],
                    organization_id=organization_id, personnel_id=person_id,
                    certification_type_id=f"cert-{code.lower()}", issued_at=now - timedelta(days=180),
                    expires_at=now + timedelta(days=14 if person_index in {500, 750, 1000} else 365),
                    status="ACTIVE",
                ))

        session.add_all(people)
        session.flush()
        session.add_all(associations)
        session.add_all(assignments)
        session.flush()

        station_by_id = {station.station_id: station for station in stations}
        unit_by_id = {unit.unit_id: unit for unit in units}
        gap_units = [unit_by_id[unit_id] for unit_id in sorted(gap_unit_ids)]
        alerts = [
            Alert(
                alert_id=f"alert-gap-{index:02d}", organization_id=organization_id,
                unit_id=unit.unit_id, station_id=unit.station_id, alert_type="UNDERSTAFFED_UNIT",
                priority="HIGH", state="OPEN", message=f"{unit.call_sign} is one member below minimum staffing.",
                details={"staff_present": unit.minimum_staff - 1, "staff_required": unit.minimum_staff,
                         "dataset": "synthetic"}, created_at=now - timedelta(minutes=index * 3),
            )
            for index, unit in enumerate(gap_units, start=1)
        ]
        expiring_people = (500, 750, 1000)
        for offset, index in enumerate(expiring_people, start=1):
            person = people[index - 1]
            alerts.append(Alert(
                alert_id=f"alert-cert-{offset:02d}", organization_id=organization_id,
                station_id=person.station_id, personnel_id=person.personnel_id,
                alert_type="EXPIRING_CERTIFICATION", priority="NORMAL", state="OPEN",
                message=f"{person.name} has a credential due within 14 days.",
                details={"expires_in_days": 14, "dataset": "synthetic"},
                created_at=now - timedelta(hours=offset),
            ))
        session.add_all(alerts)
        session.flush()

        incident_specs = (
            ("inc-01", "Medical emergency", "EMS", "12000 Fair Oaks Mall, Fairfax, VA", "HIGH", "ENROUTE", "fs-21", ["unit-engine-21", "unit-medic-21"]),
            ("inc-02", "Structure fire", "FIRE", "4500 Stringfellow Rd, Chantilly, VA", "CRITICAL", "ON_SCENE", "fs-15", ["unit-engine-15", "unit-truck-01"]),
            ("inc-03", "Medical emergency", "EMS", "8100 Boone Blvd, Tysons, VA", "HIGH", "ON_SCENE", "fs-29", ["unit-medic-02", "unit-engine-26"]),
            ("inc-04", "Medical transport", "EMS", "6001 Burke Centre Pkwy, Burke, VA", "MEDIUM", "TRANSPORT", "fs-14", ["unit-medic-14"]),
            ("inc-05", "Roadway investigation", "OTHER", "I-495 NB at Braddock Rd, Springfield, VA", "LOW", "INVESTIGATING", "fs-22", ["unit-rescue-01"]),
        )
        incidents: list[Incident] = []
        incident_links: list[IncidentUnit] = []
        for offset, (
            incident_id, title, incident_type, display_location, priority, status, station_id, unit_ids,
        ) in enumerate(incident_specs, start=1):
            station = station_by_id[station_id]
            valid_unit_ids = [unit_id for unit_id in unit_ids if unit_id in unit_by_id]
            if not valid_unit_ids:
                valid_unit_ids = [next(unit.unit_id for unit in units if unit.station_id == station_id)]
            incidents.append(Incident(
                incident_id=incident_id, organization_id=organization_id, station_id=station_id,
                primary_unit_id=valid_unit_ids[0], title=title,
                description=f"Synthetic active incident for interface demonstration. {DATASET_DISCLAIMER}",
                priority=priority, incident_type=incident_type, display_location=display_location,
                status=status, commander="Duty Command (synthetic)",
                latitude=station.latitude, longitude=station.longitude, source="SYNTHETIC_DEMO",
                source_reference=f"DEMO-{offset:03d}", created_at=now - timedelta(minutes=offset * 11),
                is_active=True,
            ))
            for unit_id in valid_unit_ids:
                incident_links.append(IncidentUnit(
                    incident_unit_id=f"iu-{incident_id}-{unit_id}"[:64], organization_id=organization_id,
                    incident_id=incident_id, unit_id=unit_id, status="ASSIGNED",
                    assigned_at=now - timedelta(minutes=offset * 9),
                ))
        session.add_all(incidents)
        session.flush()
        session.add_all(incident_links)
        session.flush()

        session.add_all([
            RenewalTask(
                renewal_id=f"renewal-{offset:02d}", organization_id=organization_id,
                personnel_id=f"person-{index:04d}", certification_code="ACLS" if index == 500 else "EMT",
                due_date=now + timedelta(days=14), status="SCHEDULED",
                owner="Training Division (synthetic)", scheduled_for=now + timedelta(days=7 + offset),
                notes=DATASET_DISCLAIMER,
            )
            for offset, index in enumerate(expiring_people, start=1)
        ])
        session.flush()

        previous_hash = None
        audit_events: list[AuditEvent] = []
        audit_specs = (
            ("DATASET_LOADED", "organization", organization_id, "Loaded Fairfax-scale synthetic concept data"),
            ("WATCH_OPENED", "shift", "shift-a", "Opened synthetic A Watch operational period"),
            ("READINESS_EVALUATED", "unit", gap_units[0].unit_id, "Detected synthetic minimum-staffing gap"),
            ("INCIDENT_CREATED", "incident", "inc-01", "Opened synthetic commercial fire incident"),
            ("UNIT_ASSIGNED", "incident", "inc-02", "Assigned synthetic technical rescue resources"),
            ("ALERT_CREATED", "alert", "alert-cert-01", "Created synthetic credential renewal alert"),
        )
        for offset, (action, entity_type, entity_id, summary) in enumerate(audit_specs, start=1):
            created_at = now - timedelta(minutes=(len(audit_specs) - offset + 1) * 4)
            event_hash = hashlib.sha256(
                f"{previous_hash}:{action}:{entity_id}:{created_at.isoformat()}".encode("utf-8")
            ).hexdigest()
            audit_events.append(AuditEvent(
                audit_id=f"audit-{offset:02d}", organization_id=organization_id,
                action=action, entity_type=entity_type, entity_id=entity_id,
                actor_subject="synthetic-demo-seeder", actor_display="Aegis Demo Controller",
                summary=summary, details={"dataset": "synthetic"}, previous_hash=previous_hash,
                event_hash=event_hash, created_at=created_at,
            ))
            previous_hash = event_hash
        session.add_all(audit_events)

    return {
        "organization": ORGANIZATION_NAME, "stations": 39, "battalions": 8, "units": 131,
        "minimum_staffing": 363, "personnel": 1450, "assignments": 363,
        "readiness_gaps": 12, "alerts": 15, "incidents": 5, "synthetic": True,
    }

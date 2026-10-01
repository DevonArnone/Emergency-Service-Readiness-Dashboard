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


# Synthetic incident histories. Minutes are measured back from the seed time; each stage is a
# recorded lifecycle transition. Unit call signs resolve to the seeded unit records.
INCIDENT_HISTORY = (
    {"incident_id": "inc-01", "title": "Medical emergency", "type": "EMS", "priority": "HIGH",
     "location": "12000 Fair Oaks Mall, Fairfax, VA", "station_id": "fs-21", "reference": "DEMO-001",
     "units": ["E421", "M421"], "opened": 9, "stages": [(8, "ENROUTE")],
     "note": "Synthetic medical response at a commercial centre."},
    {"incident_id": "inc-02", "title": "Structure fire", "type": "FIRE", "priority": "CRITICAL",
     "location": "4500 Stringfellow Rd, Chantilly, VA", "station_id": "fs-15", "reference": "DEMO-002",
     "units": ["E415", "T415", "R415", "BC-3"], "added": {"BC-3": 38}, "opened": 48,
     "stages": [(47, "ENROUTE"), (41, "ON_SCENE")], "commander": "BC-3 (synthetic)",
     "note": "Synthetic commercial structure fire; command established.", "offset": (-0.008, 0.005)},
    {"incident_id": "inc-03", "title": "Medical emergency", "type": "EMS", "priority": "HIGH",
     "location": "8100 Boone Blvd, Tysons, VA", "station_id": "fs-29", "reference": "DEMO-003",
     "units": ["A429", "E429"], "opened": 24, "stages": [(23, "ENROUTE"), (17, "ON_SCENE")],
     "note": "Synthetic medical response in an office tower."},
    {"incident_id": "inc-04", "title": "Medical transport", "type": "EMS", "priority": "MEDIUM",
     "location": "6001 Burke Centre Pkwy, Burke, VA", "station_id": "fs-14", "reference": "DEMO-004",
     "units": ["M414"], "opened": 71, "stages": [(70, "ENROUTE"), (62, "ON_SCENE"), (38, "TRANSPORT")],
     "note": "Synthetic transport to a receiving facility.", "offset": (0.004, -0.006)},
    {"incident_id": "inc-05", "title": "Roadway investigation", "type": "OTHER", "priority": "LOW",
     "location": "I-495 NB at Braddock Rd, Springfield, VA", "station_id": "fs-22", "reference": "DEMO-005",
     "units": ["E422"], "opened": 96, "stages": [(95, "ENROUTE"), (86, "ON_SCENE"), (80, "INVESTIGATING")],
     "note": "Synthetic roadway hazard investigation.", "offset": (0.009, 0.007)},
    {"incident_id": "inc-06", "title": "Fall with injury", "type": "EMS", "priority": "MEDIUM",
     "location": "11900 Lee Jackson Memorial Hwy, Fairfax, VA", "station_id": "fs-21", "reference": "DEMO-006",
     "units": ["M421"], "opened": 300,
     "stages": [(299, "ENROUTE"), (291, "ON_SCENE"), (262, "TRANSPORT"), (205, "RESOLVED")],
     "note": "Synthetic resolved medical response.", "offset": (-0.006, -0.003)},
    {"incident_id": "inc-07", "title": "Vehicle fire", "type": "FIRE", "priority": "HIGH",
     "location": "I-66 EB at Route 28, Centreville, VA", "station_id": "fs-17", "reference": "DEMO-007",
     "units": ["E417"], "opened": 310, "stages": [(309, "ENROUTE"), (302, "ON_SCENE"), (270, "RESOLVED")],
     "note": "Synthetic resolved vehicle fire.", "offset": (-0.006, -0.004)},
    {"incident_id": "inc-08", "title": "Fire alarm activation", "type": "OTHER", "priority": "MEDIUM",
     "location": "1750 Tysons Blvd, Tysons, VA", "station_id": "fs-29", "reference": "DEMO-008",
     "units": ["E429"], "opened": 360,
     "stages": [(359, "ENROUTE"), (353, "ON_SCENE"), (348, "INVESTIGATING"), (325, "RESOLVED")],
     "note": "Synthetic resolved alarm investigation.", "offset": (-0.005, 0.006)},
    {"incident_id": "inc-09", "title": "Natural gas odor", "type": "HAZMAT", "priority": "HIGH",
     "location": "4100 Monument Corner Dr, Fairfax, VA", "station_id": "fs-40", "reference": "DEMO-009",
     "units": ["E440", "HazMat-440"], "added": {"HazMat-440": 436}, "opened": 450,
     "stages": [(449, "ENROUTE"), (441, "ON_SCENE"), (430, "INVESTIGATING"), (370, "RESOLVED")],
     "note": "Synthetic resolved hazardous-materials investigation."},
    {"incident_id": "inc-10", "title": "Cardiac arrest", "type": "EMS", "priority": "CRITICAL",
     "location": "2700 Gallows Rd, Dunn Loring, VA", "station_id": "fs-13", "reference": "DEMO-010",
     "units": ["M413", "E413"], "opened": 160,
     "stages": [(159, "ENROUTE"), (152, "ON_SCENE"), (130, "TRANSPORT"), (105, "RESOLVED")],
     "note": "Synthetic resolved cardiac response.", "offset": (0.005, 0.005)},
    {"incident_id": "inc-11", "title": "Lift assist", "type": "OTHER", "priority": "LOW",
     "location": "4100 Legato Rd, Fairfax, VA", "station_id": "fs-21", "reference": "DEMO-011",
     "units": ["E421"], "opened": 250, "stages": [(249, "ENROUTE"), (241, "ON_SCENE"), (178, "RESOLVED")],
     "note": "Synthetic resolved public assist.", "offset": (0.007, 0.004)},
    {"incident_id": "inc-12", "title": "Brush fire", "type": "FIRE", "priority": "MEDIUM",
     "location": "12700 Popes Head Rd, Clifton, VA", "station_id": "fs-16", "reference": "DEMO-012",
     "units": ["E416", "TN416"], "opened": 540,
     "stages": [(538, "ENROUTE"), (528, "ON_SCENE"), (460, "RESOLVED")],
     "note": "Synthetic resolved brush fire.", "offset": (-0.007, -0.006)},
)

# Recorded service-state exceptions, kept away from active incident assignments.
SERVICE_EXCEPTIONS = (
    ("E425", "MAINTENANCE", 205, "Scheduled preventive maintenance (synthetic)"),
    ("A436", "MAINTENANCE", 140, "Equipment inspection (synthetic)"),
    ("T409", "OUT_OF_SERVICE", 320, "Mechanical defect reported (synthetic)"),
    ("R430", "OUT_OF_SERVICE", 65, "Apparatus fault reported (synthetic)"),
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
    # Stride the surname so consecutive crew members on one unit do not share a family name.
    first = FIRST_NAMES[(index - 1) % len(FIRST_NAMES)]
    last = LAST_NAMES[((index - 1) * 17 + (index - 1) // len(FIRST_NAMES)) % len(LAST_NAMES)]
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

        call_sign_ids = {unit.call_sign: unit.unit_id for unit in units}
        incidents: list[Incident] = []
        incident_links: list[IncidentUnit] = []
        lifecycle_events: list[tuple[datetime, str, str, str, str, dict]] = []
        for spec in INCIDENT_HISTORY:
            station = station_by_id[spec["station_id"]]
            created_at = now - timedelta(minutes=spec["opened"])
            stages = [(created_at, "ACTIVE")] + [
                (now - timedelta(minutes=minutes), status) for minutes, status in spec["stages"]
            ]
            final_status = stages[-1][1]
            resolved = final_status == "RESOLVED"
            unit_ids = [call_sign_ids[call_sign] for call_sign in spec["units"]]
            late = {call_sign_ids[call_sign]: minutes for call_sign, minutes in spec.get("added", {}).items()}
            initial_units = [unit_id for unit_id in unit_ids if unit_id not in late]
            # Plot incidents clear of their station marker; positions remain synthetic and approximate.
            longitude_offset, latitude_offset = (value * 2.2 for value in spec.get("offset", (0.006, 0.004)))
            incidents.append(Incident(
                incident_id=spec["incident_id"], organization_id=organization_id, station_id=station.station_id,
                primary_unit_id=unit_ids[0], title=spec["title"],
                description=f"{spec['note']} {DATASET_DISCLAIMER}",
                priority=spec["priority"], incident_type=spec["type"], display_location=spec["location"],
                status=final_status, commander=spec.get("commander", "Duty Command (synthetic)"),
                latitude=(station.latitude or 0) + latitude_offset, longitude=(station.longitude or 0) + longitude_offset,
                source="SYNTHETIC_DEMO", source_reference=spec["reference"], created_at=created_at,
                resolved_at=stages[-1][0] if resolved else None, is_active=not resolved,
            ))
            if not resolved:
                for unit_id in unit_ids:
                    incident_links.append(IncidentUnit(
                        incident_unit_id=f"iu-{spec['incident_id']}-{unit_id}"[:64], organization_id=organization_id,
                        incident_id=spec["incident_id"], unit_id=unit_id, status="ASSIGNED",
                        assigned_at=now - timedelta(minutes=late.get(unit_id, spec["opened"])),
                    ))

            def lifecycle(at: datetime, before: str | None, after: str, before_units: list[str], after_units: list[str]) -> dict:
                return {
                    "dataset": "synthetic", "lifecycle": True, "recorded_at": at.isoformat(),
                    "before_status": before, "after_status": after,
                    "assigned_unit_ids_before": before_units, "assigned_unit_ids": after_units,
                    "units_added": [unit_id for unit_id in after_units if unit_id not in before_units],
                    "units_released": [unit_id for unit_id in before_units if unit_id not in after_units],
                }

            lifecycle_events.append((created_at, "CREATED", "incident", spec["incident_id"],
                                     f"Opened incident: {spec['title']}",
                                     lifecycle(created_at, None, "ACTIVE", [], initial_units)))
            current_units = list(initial_units)
            timeline = [(at, "STATUS", status) for at, status in stages[1:]]
            timeline += [(now - timedelta(minutes=minutes), "UNIT", unit_id) for unit_id, minutes in late.items()]
            previous = "ACTIVE"
            for at, kind, value in sorted(timeline, key=lambda item: item[0]):
                if kind == "UNIT":
                    after_units = current_units + [value]
                    lifecycle_events.append((at, "UPDATED", "incident", spec["incident_id"],
                                             f"Assigned additional unit to incident: {spec['title']}",
                                             lifecycle(at, previous, previous, current_units, after_units)))
                    current_units = after_units
                    continue
                released = value == "RESOLVED"
                lifecycle_events.append((at, "RESOLVED" if released else "UPDATED", "incident", spec["incident_id"],
                                         f"{'Resolved' if released else 'Updated'} incident: {spec['title']}",
                                         lifecycle(at, previous, value, current_units, [] if released else current_units)))
                previous = value
            for unit_id in unit_ids:
                unit = unit_by_id[unit_id]
                dispatched_at = now - timedelta(minutes=late.get(unit_id, spec["opened"]))
                lifecycle_events.append((dispatched_at, "UPDATED", "unit", unit_id, f"Updated {unit.call_sign}", {
                    "dataset": "synthetic", "service_state": True, "recorded_at": dispatched_at.isoformat(),
                    "before_status": "AVAILABLE", "after_status": "DEPLOYED", "incident_id": spec["incident_id"],
                }))
                if resolved:
                    cleared_at = stages[-1][0]
                    lifecycle_events.append((cleared_at, "UPDATED", "unit", unit_id, f"Updated {unit.call_sign}", {
                        "dataset": "synthetic", "service_state": True, "recorded_at": cleared_at.isoformat(),
                        "before_status": "DEPLOYED", "after_status": "AVAILABLE", "incident_id": spec["incident_id"],
                    }))
                else:
                    unit.operational_status = "DEPLOYED"

        for call_sign, status, minutes, reason in SERVICE_EXCEPTIONS:
            unit = unit_by_id[call_sign_ids[call_sign]]
            unit.operational_status = status
            at = now - timedelta(minutes=minutes)
            lifecycle_events.append((at, "UPDATED", "unit", unit.unit_id, f"Updated {unit.call_sign}", {
                "dataset": "synthetic", "service_state": True, "recorded_at": at.isoformat(),
                "before_status": "AVAILABLE", "after_status": status, "reason": reason,
            }))
        session.flush()
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

        watch_baseline = {
            "dataset": "synthetic", "recorded_at": watch_start.isoformat(),
            "unit_service_states": {item["unit_id"]: "AVAILABLE" for item in unit_plan},
        }
        for created_at, _action, entity_type, entity_id, _summary, details in sorted(lifecycle_events, key=lambda item: item[0]):
            if entity_type == "unit" and created_at <= watch_start:
                watch_baseline["unit_service_states"][entity_id] = details["after_status"]
        audit_specs = (
            ("DATASET_LOADED", "organization", organization_id, "Loaded Fairfax-scale synthetic concept data",
             now - timedelta(minutes=24), {"dataset": "synthetic"}),
            ("WATCH_OPENED", "shift", "shift-a", "Opened synthetic A Watch operational period",
             watch_start, watch_baseline),
            ("READINESS_EVALUATED", "unit", gap_units[0].unit_id, "Detected synthetic minimum-staffing gap",
             now - timedelta(minutes=16), {"dataset": "synthetic"}),
            ("INCIDENT_CREATED", "incident", "inc-01", "Opened synthetic medical emergency incident",
             now - timedelta(minutes=9), {"dataset": "synthetic"}),
            ("UNIT_ASSIGNED", "incident", "inc-02", "Assigned synthetic battalion command to structure fire",
             now - timedelta(minutes=38), {"dataset": "synthetic"}),
            ("ALERT_CREATED", "alert", "alert-cert-01", "Created synthetic credential renewal alert",
             now - timedelta(minutes=4), {"dataset": "synthetic"}),
        )
        records = [
            (f"audit-{offset:02d}", created_at, action, entity_type, entity_id, summary, details)
            for offset, (action, entity_type, entity_id, summary, created_at, details) in enumerate(audit_specs, start=1)
        ]
        records += [
            (f"audit-h{offset:03d}", created_at, action, entity_type, entity_id, summary, details)
            for offset, (created_at, action, entity_type, entity_id, summary, details) in enumerate(
                sorted(lifecycle_events, key=lambda item: item[0]), start=1,
            )
        ]
        previous_hash = None
        audit_events: list[AuditEvent] = []
        for audit_id, created_at, action, entity_type, entity_id, summary, details in sorted(records, key=lambda item: item[1]):
            event_hash = hashlib.sha256(
                f"{previous_hash}:{action}:{entity_id}:{created_at.isoformat()}".encode("utf-8")
            ).hexdigest()
            audit_events.append(AuditEvent(
                audit_id=audit_id, organization_id=organization_id,
                action=action, entity_type=entity_type, entity_id=entity_id,
                actor_subject="synthetic-demo-seeder", actor_display="Aegis Demo Controller",
                summary=summary, details=details, previous_hash=previous_hash,
                event_hash=event_hash, created_at=created_at,
            ))
            previous_hash = event_hash
        session.add_all(audit_events)

    return {
        "organization": ORGANIZATION_NAME, "stations": 39, "battalions": 8, "units": 131,
        "minimum_staffing": 363, "personnel": 1450, "assignments": 363,
        "readiness_gaps": 12, "alerts": 15, "incidents": len(INCIDENT_HISTORY),
        "active_incidents": sum(spec["stages"][-1][1] != "RESOLVED" for spec in INCIDENT_HISTORY), "synthetic": True,
    }

"""Tenant-scoped Snowflake analytics with a relational local fallback."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

try:
    import snowflake.connector as snowflake_connector
except ImportError:  # The core local profile intentionally omits the warehouse client.
    snowflake_connector = None

from app.config import settings
from app.models import AssignmentStatus, CoverageSummary, Personnel, ShiftEvent, Unit, UnitAssignment
from app.security.tenant import current_organization_id


logger = logging.getLogger(__name__)


def _tenant_id() -> str:
    return current_organization_id() or settings.default_organization_id


def _configured() -> bool:
    has_identity = settings.snowflake_account != "placeholder" and settings.snowflake_user != "placeholder"
    has_credential = (
        settings.snowflake_password != "placeholder"
        or bool(settings.snowflake_private_key_path)
    )
    return has_identity and has_credential


def _normalize_datetime(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _build_local_coverage_summary(target_date: date, include_demo: bool = False) -> list[CoverageSummary]:
    """Aggregate the normalized local runtime when Snowflake is not configured."""
    from app.stores import personnel_store, unit_assignments_store, units_store

    units = dict(units_store.items())
    personnel = dict(personnel_store.items())
    day_start = datetime.combine(target_date, time.min)
    day_end = day_start + timedelta(days=1)
    coverage: dict[tuple[str, int], dict] = {}
    for assignment in unit_assignments_store.values():
        if assignment.assignment_status != AssignmentStatus.ON_SHIFT:
            continue
        unit = units.get(assignment.unit_id)
        person = personnel.get(assignment.personnel_id)
        if unit is None:
            continue
        start = _normalize_datetime(assignment.shift_start)
        end = _normalize_datetime(assignment.shift_end)
        if end <= day_start or start >= day_end:
            continue
        location = unit.station_id or (person.station_id if person else None) or unit.unit_name
        slot = max(start, day_start).replace(minute=0, second=0, microsecond=0)
        overlap_end = min(end, day_end)
        while slot < overlap_end:
            bucket = coverage.setdefault(
                (location, slot.hour),
                {"unit_requirements": {}, "personnel_ids": set(), "long_shift": False},
            )
            bucket["unit_requirements"][unit.unit_id] = unit.minimum_staff
            bucket["personnel_ids"].add(assignment.personnel_id)
            bucket["long_shift"] = bucket["long_shift"] or (end - start) >= timedelta(hours=24)
            slot += timedelta(hours=1)

    rows = [
        CoverageSummary(
            location=location,
            hour=hour,
            scheduled_headcount=sum(bucket["unit_requirements"].values()),
            actual_headcount=len(bucket["personnel_ids"]),
            understaffed_flag=(
                len(bucket["personnel_ids"]) < sum(bucket["unit_requirements"].values())
            ),
            overtime_risk_flag=bucket["long_shift"],
            date=datetime.combine(target_date, time.min),
        )
        for (location, hour), bucket in sorted(coverage.items())
    ]
    if rows or not include_demo:
        return rows
    return [
        CoverageSummary(
            location="Synthetic command reserve",
            hour=hour,
            scheduled_headcount=12,
            actual_headcount=11 if hour in {7, 8, 18} else 12,
            understaffed_flag=hour in {7, 8, 18},
            overtime_risk_flag=False,
            date=datetime.combine(target_date, time.min),
        )
        for hour in range(6, 21)
    ]


def _build_mock_readiness_history(unit_id: str, days: int) -> list[dict]:
    from app.services.readiness_service import ReadinessService

    current = ReadinessService.get_unit_readiness(unit_id)
    if current is None:
        return []
    return [
        {
            "date": (date.today() - timedelta(days=offset)).isoformat(),
            "calculated_at": datetime.combine(
                date.today() - timedelta(days=offset), time(hour=8)
            ).isoformat(),
            "current_staff": current["staff_present"],
            "available_staff": current["staff_present"],
            "readiness_score": max(current["readiness_score"] - (offset % 3) * 4, 0),
            "understaffed_flag": current["is_understaffed"],
            "missing_certifications": current["certifications_missing"],
        }
        for offset in range(days)
    ]


class SnowflakeService:
    """Small warehouse client whose every read and write includes the tenant key."""

    def __init__(self) -> None:
        self.conn = None
        self._connect()

    def _connect(self) -> None:
        if not _configured():
            return
        if snowflake_connector is None:
            raise RuntimeError('Install full backend requirements to enable Snowflake')
        credential: dict[str, str] = {}
        if settings.snowflake_private_key_path:
            credential = {
                "authenticator": "SNOWFLAKE_JWT",
                "private_key_file": settings.snowflake_private_key_path,
            }
            if settings.snowflake_private_key_file_pwd:
                credential["private_key_file_pwd"] = settings.snowflake_private_key_file_pwd
        else:
            credential = {"password": settings.snowflake_password}
        try:
            self.conn = snowflake_connector.connect(
                account=settings.snowflake_account,
                user=settings.snowflake_user,
                role=settings.snowflake_role,
                warehouse=settings.snowflake_warehouse,
                database=settings.snowflake_database,
                schema=settings.snowflake_schema,
                login_timeout=10,
                network_timeout=10,
                **credential,
            )
        except Exception as exc:
            logger.warning("Snowflake unavailable; relational fallback remains active: %s", exc)
            self.conn = None

    def insert_shift_event(self, event: ShiftEvent) -> bool:
        if self.conn is None:
            return False
        query = """
            INSERT INTO RAW.OPERATIONAL_EVENTS (
                organization_id, event_id, event_type, priority, topic_class, source,
                schema_version, aggregate_type, aggregate_id, occurred_at, payload
            ) SELECT
                %s, %s, %s, 'NORMAL', 'bulk', 'fastapi', 1, 'shift', %s, %s, PARSE_JSON(%s)
        """
        return self._execute(query, (
            _tenant_id(), event.event_id, event.event_type.value, event.shift_id,
            event.event_time, json.dumps(event.payload or {}),
        ))

    def get_shift_coverage_summary(self, target_date: date) -> list[CoverageSummary]:
        if self.conn is None:
            return _build_local_coverage_summary(target_date)
        query = """
            SELECT
                COALESCE(station_id, 'UNKNOWN') AS location,
                HOUR(hour_start) AS hour,
                SUM(minimum_staff) AS scheduled_headcount,
                SUM(staff_present) AS actual_headcount,
                BOOLOR_AGG(understaffed_flag) AS understaffed_flag,
                FALSE AS overtime_risk_flag,
                TO_DATE(hour_start) AS date
            FROM ANALYTICS.UNIT_READINESS_HOURLY
            WHERE organization_id = %s AND TO_DATE(hour_start) = %s
            GROUP BY organization_id, COALESCE(station_id, 'UNKNOWN'), HOUR(hour_start), TO_DATE(hour_start)
            ORDER BY location, hour
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute(query, (_tenant_id(), target_date.isoformat()))
            rows = [
                CoverageSummary(
                    location=row[0] or "UNKNOWN", hour=row[1] or 0,
                    scheduled_headcount=row[2] or 0, actual_headcount=row[3] or 0,
                    understaffed_flag=bool(row[4]), overtime_risk_flag=bool(row[5]),
                    date=row[6] or target_date,
                )
                for row in cursor.fetchall()
            ]
            cursor.close()
            return rows or _build_local_coverage_summary(target_date)
        except Exception as exc:
            logger.warning("Snowflake coverage query failed: %s", exc)
            return _build_local_coverage_summary(target_date)

    def insert_personnel(self, personnel: Personnel) -> bool:
        if self.conn is None:
            return False
        query = """
            MERGE INTO RAW.PERSONNEL target USING (
                SELECT %s organization_id, %s personnel_id, %s station_id, %s current_unit_id,
                    %s name, %s rank, %s role, %s availability_status, %s last_check_in,
                    PARSE_JSON(%s)::ARRAY certifications, PARSE_JSON(%s)::OBJECT cert_expirations,
                    %s notes
            ) source
            ON target.organization_id = source.organization_id
               AND target.personnel_id = source.personnel_id
            WHEN MATCHED THEN UPDATE SET
                station_id=source.station_id, current_unit_id=source.current_unit_id,
                name=source.name, rank=source.rank, role=source.role,
                availability_status=source.availability_status, last_check_in=source.last_check_in,
                certifications=source.certifications, cert_expirations=source.cert_expirations,
                notes=source.notes, updated_at=CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT (
                organization_id, personnel_id, station_id, current_unit_id, name, rank, role,
                availability_status, last_check_in, certifications, cert_expirations, notes
            ) VALUES (
                source.organization_id, source.personnel_id, source.station_id, source.current_unit_id,
                source.name, source.rank, source.role, source.availability_status, source.last_check_in,
                source.certifications, source.cert_expirations, source.notes
            )
        """
        expirations = {
            key: value.isoformat() if isinstance(value, datetime) else str(value)
            for key, value in personnel.cert_expirations.items()
        }
        return self._execute(query, (
            _tenant_id(), personnel.personnel_id, personnel.station_id, personnel.current_unit_id,
            personnel.name, personnel.rank, personnel.role, personnel.availability_status.value,
            personnel.last_check_in, json.dumps(personnel.certifications), json.dumps(expirations),
            personnel.notes,
        ))

    def insert_unit(self, unit: Unit) -> bool:
        if self.conn is None:
            return False
        query = """
            MERGE INTO RAW.UNITS target USING (
                SELECT %s organization_id, %s unit_id, %s station_id, %s call_sign,
                    %s unit_type, %s minimum_staff, PARSE_JSON(%s)::ARRAY required_certifications,
                    %s operational_status
            ) source
            ON target.organization_id = source.organization_id AND target.unit_id = source.unit_id
            WHEN MATCHED THEN UPDATE SET
                station_id=source.station_id, call_sign=source.call_sign, unit_type=source.unit_type,
                minimum_staff=source.minimum_staff,
                required_certifications=source.required_certifications,
                operational_status=source.operational_status, updated_at=CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT (
                organization_id, unit_id, station_id, call_sign, unit_type, minimum_staff,
                required_certifications, operational_status
            ) VALUES (
                source.organization_id, source.unit_id, source.station_id, source.call_sign,
                source.unit_type, source.minimum_staff, source.required_certifications,
                source.operational_status
            )
        """
        return self._execute(query, (
            _tenant_id(), unit.unit_id, unit.station_id, unit.unit_name, unit.type.value,
            unit.minimum_staff, json.dumps(unit.required_certifications), unit.operational_status.value,
        ))

    def insert_unit_assignment(self, assignment: UnitAssignment) -> bool:
        if self.conn is None:
            return False
        query = """
            MERGE INTO RAW.UNIT_ASSIGNMENTS target USING (
                SELECT %s organization_id, %s assignment_id, %s unit_id, %s personnel_id,
                    %s shift_start, %s shift_end, %s assignment_status
            ) source
            ON target.organization_id = source.organization_id
               AND target.assignment_id = source.assignment_id
            WHEN MATCHED THEN UPDATE SET
                unit_id=source.unit_id, personnel_id=source.personnel_id,
                shift_start=source.shift_start, shift_end=source.shift_end,
                assignment_status=source.assignment_status, updated_at=CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT (
                organization_id, assignment_id, unit_id, personnel_id,
                shift_start, shift_end, assignment_status
            ) VALUES (
                source.organization_id, source.assignment_id, source.unit_id, source.personnel_id,
                source.shift_start, source.shift_end, source.assignment_status
            )
        """
        return self._execute(query, (
            _tenant_id(), assignment.assignment_id, assignment.unit_id, assignment.personnel_id,
            assignment.shift_start, assignment.shift_end, assignment.assignment_status.value,
        ))

    def get_unit_readiness_history(self, unit_id: str, days: int = 7) -> list[dict]:
        if self.conn is None:
            return _build_mock_readiness_history(unit_id, days)
        query = """
            SELECT TO_DATE(hour_start), hour_start, staff_present, staff_present,
                readiness_score, understaffed_flag, missing_certifications
            FROM ANALYTICS.UNIT_READINESS_HOURLY
            WHERE organization_id = %s AND unit_id = %s
              AND hour_start >= DATEADD('DAY', -%s, CURRENT_TIMESTAMP())
            ORDER BY hour_start DESC
        """
        try:
            cursor = self.conn.cursor()
            cursor.execute(query, (_tenant_id(), unit_id, days))
            history = []
            for row in cursor.fetchall():
                missing = row[6] or []
                if isinstance(missing, str):
                    missing = json.loads(missing)
                history.append({
                    "date": row[0], "calculated_at": row[1], "current_staff": row[2],
                    "available_staff": row[3], "readiness_score": row[4],
                    "understaffed_flag": row[5], "missing_certifications": missing,
                })
            cursor.close()
            return history or _build_mock_readiness_history(unit_id, days)
        except Exception as exc:
            logger.warning("Snowflake history query failed: %s", exc)
            return _build_mock_readiness_history(unit_id, days)

    def populate_coverage_from_assignments(self) -> bool:
        """Materialize a manual recovery snapshot; normal operation uses Kafka tasks."""
        if self.conn is None:
            return False
        from app.services.readiness_service import ReadinessService
        from app.stores import units_store

        units = dict(units_store.items())
        query = """
            MERGE INTO ANALYTICS.UNIT_READINESS_HOURLY target USING (
                SELECT %s organization_id, DATE_TRUNC('HOUR', CURRENT_TIMESTAMP()) hour_start,
                    %s unit_id, %s station_id, %s unit_type, %s minimum_staff,
                    %s staff_present, %s readiness_score, %s understaffed_flag,
                    PARSE_JSON(%s)::ARRAY missing_certifications, %s source_event_id
            ) source
            ON target.organization_id=source.organization_id
               AND target.hour_start=source.hour_start AND target.unit_id=source.unit_id
            WHEN MATCHED THEN UPDATE SET
                station_id=source.station_id, unit_type=source.unit_type,
                minimum_staff=source.minimum_staff, staff_present=source.staff_present,
                readiness_score=source.readiness_score, understaffed_flag=source.understaffed_flag,
                missing_certifications=source.missing_certifications,
                source_event_id=source.source_event_id, updated_at=CURRENT_TIMESTAMP()
            WHEN NOT MATCHED THEN INSERT (
                organization_id, hour_start, unit_id, station_id, unit_type, minimum_staff,
                staff_present, readiness_score, understaffed_flag, missing_certifications, source_event_id
            ) VALUES (
                source.organization_id, source.hour_start, source.unit_id, source.station_id,
                source.unit_type, source.minimum_staff, source.staff_present, source.readiness_score,
                source.understaffed_flag, source.missing_certifications, source.source_event_id
            )
        """
        try:
            cursor = self.conn.cursor()
            batch_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
            for status in ReadinessService.check_all_units():
                unit = units[status["unit_id"]]
                cursor.execute(query, (
                    _tenant_id(), status["unit_id"], unit.station_id, status["unit_type"],
                    status["staff_required"], status["staff_present"], status["readiness_score"],
                    status["is_understaffed"], json.dumps(status["certifications_missing"]),
                    f"manual-{batch_id}-{status['unit_id']}",
                ))
            self.conn.commit()
            cursor.close()
            return True
        except Exception as exc:
            logger.error("Snowflake recovery snapshot failed: %s", exc, exc_info=True)
            return False

    def _execute(self, query: str, parameters: tuple) -> bool:
        try:
            cursor = self.conn.cursor()
            cursor.execute(query, parameters)
            self.conn.commit()
            cursor.close()
            return True
        except Exception as exc:
            logger.error("Snowflake write failed: %s", exc)
            return False

    def close(self) -> None:
        if self.conn is not None:
            self.conn.close()
            self.conn = None


class MockSnowflakeService:
    """Deterministic local behavior when warehouse credentials are absent."""

    conn = None

    def insert_shift_event(self, event: ShiftEvent) -> bool:
        return True

    def get_shift_coverage_summary(self, target_date: date) -> list[CoverageSummary]:
        return _build_local_coverage_summary(target_date, include_demo=True)

    def insert_personnel(self, personnel: Personnel) -> bool:
        return True

    def insert_unit(self, unit: Unit) -> bool:
        return True

    def insert_unit_assignment(self, assignment: UnitAssignment) -> bool:
        return True

    def get_unit_readiness_history(self, unit_id: str, days: int = 7) -> list[dict]:
        return _build_mock_readiness_history(unit_id, days)

    def close(self) -> None:
        return None


snowflake_service: Optional[SnowflakeService | MockSnowflakeService] = None


def get_snowflake_service() -> SnowflakeService | MockSnowflakeService:
    global snowflake_service
    if snowflake_service is None:
        snowflake_service = SnowflakeService() if _configured() else MockSnowflakeService()
        if isinstance(snowflake_service, SnowflakeService) and snowflake_service.conn is None:
            snowflake_service = MockSnowflakeService()
    return snowflake_service

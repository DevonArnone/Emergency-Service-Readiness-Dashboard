"""Security boundary contract tests."""

import unittest
import json
import time
import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from unittest.mock import patch
from fastapi import HTTPException
from starlette.websockets import WebSocketDisconnect
from sqlalchemy import create_engine
from sqlalchemy import select, func
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from fastapi.testclient import TestClient

from app.main import app
from app.config import settings
from app.db.base import Base
from app.db.models import Organization, OutboxEvent
from app.models import Station, Unit, Personnel
from app.stores import stations_store, units_store, personnel_store
from app.security.identity import OidcVerifier, Principal, principal_from_claims
from app.security.tenant import current_organization_id, organization_scope
from app.security.tickets import RealtimeTicketBroker, realtime_ticket_broker


class IdentityTests(unittest.TestCase):
    def test_signed_tokens_enforce_expiry_issuer_and_audience(self) -> None:
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        public = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()))
        public['kid'] = 'test-key'
        verifier = OidcVerifier()
        claims = {'sub': 'reader', 'organization_id': 'org-1', 'iss': 'https://issuer.invalid', 'aud': 'aegis-api', 'exp': time.time() + 60}
        with patch.object(verifier, '_load_keys', return_value={'test-key': public}), patch.object(settings, 'oidc_issuer', 'https://issuer.invalid'):
            token = jwt.encode(claims, key, algorithm='RS256', headers={'kid': 'test-key'})
            self.assertEqual(verifier.verify(token)['sub'], 'reader')
            for changes in [{'exp': time.time() - 60}, {'aud': 'other-api'}, {'iss': 'https://other.invalid'}]:
                invalid = jwt.encode({**claims, **changes}, key, algorithm='RS256', headers={'kid': 'test-key'})
                with self.assertRaises(jwt.PyJWTError):
                    verifier.verify(invalid)
            missing_expiry = dict(claims)
            del missing_expiry['exp']
            with self.assertRaises(jwt.PyJWTError):
                verifier.verify(jwt.encode(missing_expiry, key, algorithm='RS256', headers={'kid': 'test-key'}))

    def test_missing_tenant_claim_is_rejected(self) -> None:
        with self.assertRaises(HTTPException):
            principal_from_claims({"sub": "user-1", "roles": ["admin"]})

    def test_demo_tenant_cannot_hide_behind_omitted_demo_claim(self) -> None:
        self.assertTrue(principal_from_claims({"sub": "user-1", "organization_id": settings.default_organization_id}).is_public_demo)

    def test_claims_create_tenant_scoped_principal(self) -> None:
        principal = principal_from_claims({
            "sub": "user-1",
            "organization_id": "org-2",
            "realm_access": {"roles": ["battalion_chief"]},
            "name": "Battalion Chief",
        })
        self.assertEqual(principal.organization_id, "org-2")
        self.assertTrue(principal.has_any_role({"battalion_chief"}))

    def test_organization_scope_is_restored(self) -> None:
        self.assertIsNone(current_organization_id())
        with organization_scope("org-1"):
            self.assertEqual(current_organization_id(), "org-1")
        self.assertIsNone(current_organization_id())

    def test_realtime_ticket_is_single_use(self) -> None:
        broker = RealtimeTicketBroker()
        principal = Principal("user-1", "org-1", frozenset({"viewer"}))
        ticket, _ = broker.issue(principal)
        self.assertEqual(broker.consume(ticket), principal)
        self.assertIsNone(broker.consume(ticket))


class SecurityMiddlewareTests(unittest.TestCase):
    def test_api_exposes_more_than_thirty_operations(self) -> None:
        paths = app.openapi()['paths']
        operations = [(path, method) for path, methods in paths.items() for method in methods
                      if path.startswith('/api/') and method in {'get', 'post', 'put', 'patch', 'delete'}]
        self.assertGreaterEqual(len(operations), 30)

    def test_protected_reads_require_authentication(self) -> None:
        with patch.object(settings, "auth_required", True):
            response = TestClient(app).get("/api/stations")
        self.assertEqual(response.status_code, 401)

    def test_anonymous_demo_reset_is_denied(self) -> None:
        self.assertEqual(TestClient(app).post("/api/demo/reset").status_code, 401)

    def test_viewer_can_issue_ticket_but_cannot_mutate(self) -> None:
        claims = {"sub": "reader", "organization_id": "org-1", "roles": ["viewer"]}
        with patch("app.security.identity.oidc_verifier.verify", return_value=claims):
            client = TestClient(app, headers={"Authorization": "Bearer test"})
            self.assertEqual(client.post("/api/v1/realtime-tickets").status_code, 201)
            self.assertEqual(client.post("/api/incidents", json={}).status_code, 403)

    def test_unprivileged_identity_cannot_read(self) -> None:
        with patch("app.security.identity.oidc_verifier.verify", return_value={"sub": "nobody", "organization_id": "org-1"}):
            self.assertEqual(TestClient(app).get("/api/stations", headers={"Authorization": "Bearer test"}).status_code, 403)

    def test_websocket_rejects_untrusted_origin_and_invalid_ticket(self) -> None:
        for url, headers, code in [
            ("/ws/operations", {"origin": "https://untrusted.invalid"}, 4403),
            ("/ws/operations?ticket=invalid", {}, 4401),
        ]:
            with self.assertRaises(WebSocketDisconnect) as result:
                with TestClient(app).websocket_connect(url, headers=headers):
                    pass
            self.assertEqual(result.exception.code, code)

    def test_security_headers_are_present(self) -> None:
        with TestClient(app) as client:
            response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertEqual(response.headers["x-frame-options"], "DENY")
        self.assertIn("frame-ancestors 'none'", response.headers["content-security-policy"])

    def test_public_demo_mutation_is_denied(self) -> None:
        with TestClient(app) as client:
            response = client.post("/api/incidents", json={"title": "Synthetic incident"})
        self.assertEqual(response.status_code, 401)


class TenantStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite+pysqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
        Base.metadata.create_all(self.engine)
        factory = sessionmaker(bind=self.engine, expire_on_commit=False)
        self.sessions = patch("app.db.session.SessionLocal", factory)
        self.sessions.start()
        with factory() as session:
            session.add_all([Organization(organization_id=org, slug=org, name=org) for org in ["org-a", "org-b"]])
            session.commit()
        for org in ["org-a", "org-b"]:
            with organization_scope(org):
                stations_store[f"station-{org}"] = Station(station_id=f"station-{org}", name=org)

    def tearDown(self) -> None:
        self.sessions.stop()
        self.engine.dispose()

    def test_other_tenant_cannot_read_or_overwrite_primary_key(self) -> None:
        with organization_scope("org-b"):
            self.assertIsNone(stations_store.get("station-org-a"))
            with self.assertRaises(HTTPException) as result:
                stations_store["station-org-a"] = Station(station_id="station-org-a", name="Overwrite")
            self.assertEqual(result.exception.status_code, 409)
        with organization_scope("org-a"):
            self.assertEqual(stations_store["station-org-a"].name, "org-a")

    def test_cross_tenant_foreign_reference_is_rejected(self) -> None:
        with organization_scope("org-b"):
            with self.assertRaises(HTTPException) as result:
                personnel_store["person-b"] = Personnel(personnel_id="person-b", name="Synthetic", role="Officer", station_id="station-org-a")
            self.assertEqual(result.exception.status_code, 422)
            self.assertIsNone(personnel_store.get("person-b"))

    def test_operational_change_and_outbox_commit_together(self) -> None:
        from app.db.session import session_scope
        with organization_scope('org-a'):
            personnel_store['new-person'] = Personnel(personnel_id='new-person', name='Private synthetic name', role='Officer')
            with session_scope('org-a') as session:
                event = session.scalar(select(OutboxEvent).where(OutboxEvent.aggregate_id == 'new-person'))
                self.assertEqual(event.organization_id, 'org-a')
                self.assertNotIn('Private synthetic name', str(event.payload))
            with self.assertRaises(HTTPException):
                personnel_store.bulk_set([
                    ('rolled-back', Personnel(personnel_id='rolled-back', name='Rollback', role='Officer')),
                    ('invalid-reference', Personnel(personnel_id='invalid-reference', name='Invalid', role='Officer', station_id='station-org-b')),
                ])
            self.assertIsNone(personnel_store.get('rolled-back'))
            with session_scope('org-a') as session:
                self.assertEqual(session.scalar(select(func.count()).select_from(OutboxEvent).where(OutboxEvent.aggregate_id == 'rolled-back')), 0)

    def test_same_certification_code_is_independent_between_tenants(self) -> None:
        for org in ["org-a", "org-b"]:
            with organization_scope(org):
                personnel_store[org] = Personnel(personnel_id=org, name="Synthetic", role="Officer", certifications=["EMT"])
                self.assertEqual(personnel_store[org].certifications, ["EMT"])
        with organization_scope("org-a"):
            self.assertEqual(personnel_store["org-a"].certifications, ["EMT"])

    def test_admin_ingest_cannot_choose_another_tenant(self) -> None:
        claims = {"sub": "admin-a", "organization_id": "org-a", "roles": ["admin"]}
        with patch("app.security.identity.oidc_verifier.verify", return_value=claims):
            response = TestClient(app).post("/api/v1/ingest/events", headers={"Authorization": "Bearer test"}, json={
                "organization_id": "org-b", "source": "test", "event_type": "incident.created",
                "aggregate_type": "incident", "aggregate_id": "one", "payload": {},
            })
        self.assertEqual(response.status_code, 403)

    def test_operations_socket_does_not_fall_back_to_default_tenant(self) -> None:
        with organization_scope("org-b"):
            units_store["unit-b"] = Unit(unit_id="unit-b", unit_name="B1", type="ENGINE", minimum_staff=4, station_id="station-org-b")
        ticket, _ = realtime_ticket_broker.issue(Principal("reader", "org-b", frozenset({"viewer"})))
        with TestClient(app).websocket_connect(f"/ws/operations?ticket={ticket}") as websocket:
            data = websocket.receive_json()["data"]
            self.assertEqual(data["total_units"], 1)
            self.assertEqual(data["units"][0]["unit_id"], "unit-b")


if __name__ == "__main__":
    unittest.main()

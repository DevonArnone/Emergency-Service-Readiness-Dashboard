"""Security boundary contract tests."""

import unittest

from fastapi.testclient import TestClient

from app.main import app
from app.security.identity import Principal, principal_from_claims
from app.security.tenant import current_organization_id, organization_scope
from app.security.tickets import RealtimeTicketBroker


class IdentityTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()

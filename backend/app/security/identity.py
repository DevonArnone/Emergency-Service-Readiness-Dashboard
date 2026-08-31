"""OIDC identity validation and application role policy."""

from __future__ import annotations

import asyncio
import json
import threading
import time
from dataclasses import dataclass
from typing import Any
from urllib.request import Request as UrlRequest, urlopen

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt

from app.config import settings


OPERATOR_ROLES = frozenset({"admin", "duty_officer", "battalion_chief"})
READ_ROLES = OPERATOR_ROLES | {"analyst", "viewer"}
SERVICE_ROLES = frozenset({"integration_service"})


@dataclass(frozen=True, slots=True)
class Principal:
    subject_id: str
    organization_id: str
    roles: frozenset[str]
    display_name: str | None = None
    email: str | None = None
    is_public_demo: bool = False

    def has_any_role(self, allowed: set[str] | frozenset[str]) -> bool:
        return bool(self.roles.intersection(allowed))


class OidcVerifier:
    """Small cached JWKS verifier with no provider-specific adapter."""

    def __init__(self) -> None:
        self._keys: dict[str, dict[str, Any]] = {}
        self._expires_at = 0.0
        self._lock = threading.Lock()

    def _load_keys(self) -> dict[str, dict[str, Any]]:
        now = time.monotonic()
        with self._lock:
            if self._keys and now < self._expires_at:
                return self._keys
            if not settings.oidc_issuer:
                raise JWTError("OIDC issuer is not configured")
            discovery_url = f"{settings.oidc_issuer.rstrip('/')}/.well-known/openid-configuration"
            discovery_request = UrlRequest(discovery_url, headers={"Accept": "application/json"})
            with urlopen(discovery_request, timeout=5) as response:  # noqa: S310 - trusted configured issuer
                discovery = json.load(response)
            jwks_request = UrlRequest(discovery["jwks_uri"], headers={"Accept": "application/json"})
            with urlopen(jwks_request, timeout=5) as response:  # noqa: S310 - URI comes from trusted issuer
                payload = json.load(response)
            self._keys = {key["kid"]: key for key in payload.get("keys", []) if key.get("kid")}
            self._expires_at = now + settings.jwks_cache_seconds
            return self._keys

    def verify(self, token: str) -> dict[str, Any]:
        header = jwt.get_unverified_header(token)
        key_id = header.get("kid")
        key = self._load_keys().get(key_id)
        if not key:
            self._expires_at = 0
            key = self._load_keys().get(key_id)
        if not key:
            raise JWTError("Token signing key is not trusted")
        return jwt.decode(
            token,
            key,
            algorithms=settings.oidc_algorithms_list,
            audience=settings.oidc_audience,
            issuer=settings.oidc_issuer,
            options={"verify_at_hash": False},
        )


oidc_verifier = OidcVerifier()


def principal_from_claims(claims: dict[str, Any]) -> Principal:
    subject_id = str(claims.get("sub") or "").strip()
    if not subject_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token subject is missing")
    realm_roles = claims.get("realm_access", {}).get("roles", [])
    direct_roles = claims.get("roles", [])
    roles = frozenset(str(role) for role in [*realm_roles, *direct_roles])
    organization_id = str(
        claims.get("organization_id") or claims.get("tenant_id") or settings.default_organization_id
    )
    return Principal(
        subject_id=subject_id,
        organization_id=organization_id,
        roles=roles,
        display_name=claims.get("name") or claims.get("preferred_username"),
        email=claims.get("email"),
        is_public_demo=bool(claims.get("is_public_demo", organization_id == settings.default_organization_id)),
    )


def demo_principal() -> Principal:
    return Principal(
        subject_id="public-demo",
        organization_id=settings.default_organization_id,
        roles=frozenset({"viewer"}),
        display_name="Public demo viewer",
        is_public_demo=True,
    )


async def authenticate_http(request: Request, *, required: bool | None = None) -> Principal:
    existing = getattr(request.state, "principal", None)
    if existing:
        return existing
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            claims = await asyncio.to_thread(oidc_verifier.verify, token)
            principal = principal_from_claims(claims)
            request.state.principal = principal
            return principal
        except (JWTError, KeyError, ValueError, OSError) as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Access token is invalid or expired",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc
    must_authenticate = settings.auth_required if required is None else required
    if must_authenticate:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication is required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    principal = demo_principal()
    request.state.principal = principal
    return principal


async def current_principal(request: Request) -> Principal:
    return await authenticate_http(request)


def require_roles(*allowed_roles: str):
    allowed = frozenset(allowed_roles)

    async def dependency(principal: Principal = Depends(current_principal)) -> Principal:
        if not principal.has_any_role(allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role does not permit this action")
        return principal

    return dependency

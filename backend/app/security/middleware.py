"""Central security policy for browser and API traffic."""

from __future__ import annotations

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.config import settings
from app.security.identity import OPERATOR_ROLES, SERVICE_ROLES, authenticate_http


SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def error_response(request: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        headers=exc.headers,
        content={
            "code": f"HTTP_{exc.status_code}",
            "message": str(exc.detail),
            "field_errors": {},
            "request_id": getattr(request.state, "request_id", "unknown"),
        },
    )


class AccessPolicyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not request.url.path.startswith("/api"):
            return await call_next(request)
        mutation = request.method.upper() not in SAFE_METHODS
        demo_reset = request.url.path == "/api/demo/reset" and settings.app_env == "development"
        try:
            principal = await authenticate_http(request, required=mutation and not demo_reset)
        except HTTPException as exc:
            return error_response(request, exc)
        request.state.organization_id = principal.organization_id
        if mutation and not demo_reset:
            allowed = OPERATOR_ROLES | (SERVICE_ROLES if request.url.path.startswith("/api/v1/ingest") else set())
            if not principal.has_any_role(allowed):
                return error_response(
                    request,
                    HTTPException(status_code=403, detail="Role does not permit this action"),
                )
            if principal.is_public_demo and not settings.public_demo_write_enabled:
                return error_response(
                    request,
                    HTTPException(status_code=403, detail="The public concept environment is read-only"),
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; "
            "img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; "
            "script-src 'self'; connect-src 'self' http: https: ws: wss:"
        )
        if settings.app_env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response

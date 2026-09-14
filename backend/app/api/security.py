"""Authenticated session and realtime-ticket endpoints."""

import asyncio
from fastapi import APIRouter, Depends
from app.config import settings
from app.security.identity import OPERATOR_ROLES

from app.security.identity import Principal, current_principal
from app.security.tickets import realtime_ticket_broker


router = APIRouter(prefix="/api/v1", tags=["security"])


@router.get("/session")
async def session_profile(principal: Principal = Depends(current_principal)) -> dict:
    return {
        "subject_id": principal.subject_id,
        "organization_id": principal.organization_id,
        "roles": sorted(principal.roles),
        "display_name": principal.display_name,
        "email": principal.email,
        "is_public_demo": principal.is_public_demo,
        "can_write": principal.has_any_role(OPERATOR_ROLES) and (
            not principal.is_public_demo or settings.public_demo_write_enabled
        ),
        "can_reset_demo": settings.app_env == "development" and settings.public_demo_write_enabled
            and principal.organization_id == settings.default_organization_id and principal.has_any_role(OPERATOR_ROLES),
    }


@router.post("/realtime-tickets", status_code=201)
async def create_realtime_ticket(principal: Principal = Depends(current_principal)) -> dict:
    ticket, expires_at = await asyncio.to_thread(realtime_ticket_broker.issue, principal)
    return {"ticket": ticket, "expires_at": expires_at.isoformat()}

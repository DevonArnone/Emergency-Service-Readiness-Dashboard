"""Authenticated session and realtime-ticket endpoints."""

from fastapi import APIRouter, Depends

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
    }


@router.post("/realtime-tickets", status_code=201)
async def create_realtime_ticket(principal: Principal = Depends(current_principal)) -> dict:
    ticket, expires_at = realtime_ticket_broker.issue(principal)
    return {"ticket": ticket, "expires_at": expires_at.isoformat()}

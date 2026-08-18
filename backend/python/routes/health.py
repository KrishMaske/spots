"""Health route for the reco service."""

from __future__ import annotations

from fastapi import APIRouter

from config.settings import APP_NAME, VERSION

router = APIRouter()


@router.get("/health")
async def health() -> dict[str, str]:
    """Liveness check — always 200 when the process is up."""
    return {
        "status": "ok",
        "service": APP_NAME,
        "version": VERSION,
    }

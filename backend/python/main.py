"""FastAPI application entry point for the Spots recommendation engine.

Run from backend/py/ with:
    python main.py

The app is assembled here (the composition root): configuration is read from
config/, and routers are mounted from routes/.
"""

from __future__ import annotations

import logging
import time

import uvicorn

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config.settings import APP_NAME, RECO_PORT, VERSION
from routes.health import router as health_router

app = FastAPI(
    title=APP_NAME,
    version=VERSION,
    # Explicit server so "Try it out" targets reco directly (:8081), even when
    # this spec is loaded from the combined Swagger UI hosted by the Go service.
    servers=[{"url": f"http://localhost:{RECO_PORT}", "description": "Local dev (reco)"}],
)

# Allow the combined Swagger UI page (served by the Go service on :8080) to load
# this spec and issue "Try it out" requests cross-origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8080", "http://127.0.0.1:8080"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    elapsed_ms = (time.perf_counter() - started_at) * 1000

    logging.getLogger("spots.reco.request").info(
        "%s %s -> %s (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )

    return response

app.include_router(health_router)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=RECO_PORT, access_log=True, log_level="info")

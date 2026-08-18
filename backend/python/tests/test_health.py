"""Smoke test for the /health endpoint.

Run with:
    python -m pytest       # from backend/py/
    python -m pytest -v    # verbose
"""

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_ok() -> None:
    """GET /health returns 200 with the expected payload fields."""
    response = client.get("/health")

    assert response.status_code == 200

    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "spots-reco"
    assert "version" in body
    assert body["version"] != ""

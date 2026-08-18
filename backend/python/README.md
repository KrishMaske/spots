# Spots Reco

Python FastAPI process for the recommendation boundary.

Current endpoint:

- `GET /health`

## Requirements

| Tool | Version |
|---|---:|
| Python | 3.12+ |
| pip | latest |

The current local venv was verified with Python 3.13.7.

## Setup

```powershell
cd backend\python
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

## Running

```powershell
cd backend\python
.\.venv\Scripts\python main.py
```

The service listens on `0.0.0.0:8081` by default. Override with `RECO_PORT`.

## Verifying

```powershell
Invoke-RestMethod http://localhost:8081/health
curl.exe -s http://localhost:8081/health
```

Expected JSON:

```json
{"status":"ok","service":"spots-reco","version":"0.1.0"}
```

FastAPI also serves:

- `http://localhost:8081/openapi.json`
- `http://localhost:8081/docs`

## Tests

```powershell
cd backend\python
.\.venv\Scripts\python -m pytest -v
```

Verified on 2026-06-29: `1 passed, 1 warning`. The warning is Starlette's
`httpx2` deprecation warning. Do not install `httpx2` without an explicit supply
chain review.

## Layout

```text
backend/python/
├── main.py
├── pyproject.toml
├── requirements.txt
├── config/
│   └── settings.py
├── database/
├── gen/
├── infra/
├── routes/
│   └── health.py
├── services/
└── tests/
    └── test_health.py
```

# Backend

Current backend scaffold verified on 2026-06-29.

The backend area contains:

- Go monolith scaffold under `backend/golang/`
- Python/FastAPI reco process under `backend/python/`
- Local Postgres/MinIO compose under `backend/deploy/local/`
- Shared Go module file at `backend/go.mod`

There is currently no `backend/Taskfile.yml`, no `backend/dev.ps1`, no
`backend/cmd`, no `backend/internal`, and no `backend/reco`.

## Requirements

| Tool | Version | Purpose |
|---|---:|---|
| Go | 1.23+ | Go backend scaffold |
| Python | 3.12+ | Reco service |
| pip | latest | Python dependencies |
| Docker Desktop | current | Local Postgres/MinIO |

## Current Go Status

```powershell
cd backend
go run ./golang   # loads backend/.env automatically via godotenv
go test ./...
```

The import-path mismatch (`backend/go/...` vs `backend/golang/...`) was resolved
in the `user-auth-and-identity` change. All files now import
`github.com/krishm/spots/backend/golang/...` and both `go build ./...` and
`go test ./...` pass from `backend/`.

## Python Reco Setup

```powershell
cd backend\python
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
```

Run:

```powershell
cd backend\python
.\.venv\Scripts\python main.py
```

Verify:

```powershell
Invoke-RestMethod http://localhost:8081/health
```

Run tests:

```powershell
cd backend\python
.\.venv\Scripts\python -m pytest -v
```

Verified result on 2026-06-29: `1 passed, 1 warning`. The warning comes from
Starlette recommending `httpx2`; do not install `httpx2` unless it is explicitly
reviewed and accepted.

## Local Infra

Start Postgres + MinIO:

```powershell
docker compose -f backend/deploy/local/docker-compose.yml up -d
docker compose -f backend/deploy/local/docker-compose.yml ps
```

Stop while keeping data:

```powershell
docker compose -f backend/deploy/local/docker-compose.yml down
```

The compose file currently provides:

- `spots-postgres`: `pgvector/pgvector:pg16`, database/user/password `spots`
- `spots-minio`: MinIO API on `9000`, console on `9001`
- `spots-minio-init`: one-shot bucket bootstrap for `spots-media`

Redis is not present yet.

## Environment

See `backend/.env.example`.

Current app-read variables:

| Variable | Default | Used by |
|---|---|---|
| `SPOTS_HTTP_ADDR` | `:8080` | Go monolith |
| `SPOTS_RECO_URL` | `http://localhost:8081` | Go readiness probe |
| `SPOTS_COGNITO_ISSUER_URL` | `""` | Cognito token verifier (required for auth) |
| `SPOTS_COGNITO_JWKS_URL` | `""` | Cognito JWKS verifier (required for auth) |
| `SPOTS_COGNITO_APP_CLIENT_ID` | `""` | Cognito verifier + provider (required for auth) |
| `SPOTS_COGNITO_REGION` | `""` | Cognito auth provider / `/v1/auth/*` endpoints |
| `RECO_PORT` | `8081` | Python `main.py` |

Place these in `backend/.env` (gitignored) for local dev. The Go monolith auto-loads
`backend/.env` at startup via `godotenv` — no launcher script needed. In
ECS/production, environment variables are injected by the task definition and the
dotenv file is ignored.

The Postgres/S3 variables in `.env.example` are documented seams only. They are
not consumed by app code yet.

## Layout

```text
backend/
├── .env.example
├── go.mod
├── golang/
│   ├── main.go
│   ├── config/
│   ├── database/
│   ├── infra/
│   ├── routes/
│   │   ├── health.go
│   │   ├── health_test.go
│   │   ├── logging.go
│   │   ├── server.go
│   │   └── openapi/
│   └── services/
│       ├── collab/
│       ├── feed/
│       ├── identity/
│       ├── media/
│       ├── playlist/
│       ├── reco/
│       └── trip/
├── python/
│   ├── main.py
│   ├── pyproject.toml
│   ├── requirements.txt
│   ├── config/
│   ├── database/
│   ├── gen/
│   ├── infra/
│   ├── routes/
│   ├── services/
│   └── tests/
├── proto/
└── deploy/
    ├── aws/
    ├── ci/
    ├── k8s/
    └── local/
        ├── docker-compose.yml
        └── initdb/01-extensions.sql
```

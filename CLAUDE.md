# CLAUDE.md

Orientation for agents working on Spots. Read this first, then read
`docs/current-scaffold.md`.

For a full narrative walkthrough of the project — architecture, how to run every
piece, testing, and the honest gap list — read `docs/onboarding.md`. For the auth
system specifically (the one finished vertical slice), read
`docs/auth-deep-dive.md`.

## What Spots Is

Spots is a mobile-first collaborative trip planner. Groups plan trips together,
get recommendations tailored to everyone invited, and turn completed trips into
shared photo albums, collaborative playlists, and a social travel feed.

The central domain concept is the Trip: one object that moves through planning,
active travel, completion, and publication.

## Current Repo Reality

Verified on 2026-07-01:

- Go code lives in `backend/golang/`.
- Python reco code lives in `backend/python/`.
- Local dev infra lives in `backend/deploy/local/docker-compose.yml`.
- Mobile is a **runnable Expo SDK 54 app** under `mobile/` — navigation, theming,
  SecureStore session handling, and the full auth surface (Landing, Login,
  Register, Confirm, ForgotPassword, ResetPassword, Home). An earlier version of
  this bullet claimed placeholder folders only; that has been wrong since
  2026-07-03.
- As of 2026-08-17 the app has a **signed-in tab shell**: the `home-screen` Figma
  frame (node `4:164`) as a scrolling feed of trip cards under a floating
  five-destination bottom nav, plus four placeholder destinations (Map, Spots AI,
  Groups, Profile). **There is no feed API and no trip model** — the cards are
  empty image slots — and **the AI chatbot is a wired route, not a design.** The
  onboarding frame was revised in the same change (v2: 60pt full-pill CTAs and a
  dot-**ring** brandmark replacing the dot cluster). See
  `docs/plans/home-screen-and-onboarding-v2.md`. The bottom nav's motion was
  rebuilt on **`react-native-reanimated` + `react-native-gesture-handler`** on
  2026-08-17 (`docs/plans/tabbar-instant-feel.md`): one shared value holds the
  indicator's position, one `GestureDetector` runs `Gesture.Race(Pan, Tap)`, and
  **every gesture callback is a worklet**, so the bar does zero JS-thread work per
  gesture frame. `theme/home.ts` carries the motion numbers as `navMotion`. The
  app is now **explicitly on the New Architecture** (`app.json`
  `newArchEnabled: true`), which reanimated 4 requires; `react-native-worklets` is
  a direct dependency **pinned to 0.5.1** and there is deliberately **no
  `babel.config.js`** (`babel-preset-expo` injects the worklets plugin for Metro
  and jest alike). The active indicator's colour is per-mode from this change on:
  dark moves the accent onto the active glyph, light is unchanged. The app is
  **dark-mode aware end to end** as of 2026-08-17
  (`theme.brand`'s chrome is per-mode while its control ramp is not), and the
  five auth form screens carry a decorative seeded "spotty" backdrop. As of 2026-08-16 all seven screens share one brand design system
  (`docs/plans/brand-rollout.md`): `theme.colors.accent` is the Spots yellow
  `#FFC203` — there is no second yellow — and `BrandButton`/`TextLink`/
  `AuthHeader`/`SpotsWordmark` replaced the retired `Button`/`BrandMark`.
- Frontend is an empty placeholder.
- There is no `Taskfile.yml`, no `backend/dev.ps1`, no `backend/cmd`, no
  `backend/internal`, and no `backend/reco` in the current scaffold.
- The import-path blocker (`backend/go/...`) is **resolved**. All files import
  `github.com/krishm/spots/backend/golang/...` and `go test ./...` passes.
- `backend/golang/services/identity/` now has `provider.go` (AuthProvider interface,
  DTOs, sentinel errors) and `cognito_provider.go` (Cognito implementation behind
  `CognitoClientAPI` seam interface; all SDK types confined here). `AuthProvider`
  also carries `ForgotPassword` and `ConfirmForgotPassword` for self-service
  password reset, with `ErrTooManyRequests` (→ 429) and `ErrRecoveryUnavailable`
  sentinels.
- `backend/golang/routes/auth_endpoints.go` provides `POST /v1/auth/register`,
  `/confirm`, `/login`, `/refresh`, `/logout`, `/forgot-password`,
  `/reset-password`; registered only when `AuthProvider != nil`.
  `/forgot-password` **always answers 204** (except 400/429) and swallows provider
  errors on purpose — that is the account-enumeration contract, not a bug.
- `main.go` calls `godotenv.Load()` before `config.Load()` for dev `.env` loading.
  Direct deps added: `aws-sdk-go-v2`, `aws-sdk-go-v2/config`,
  `aws-sdk-go-v2/service/cognitoidentityprovider`, `joho/godotenv`.
- Cognito app client must have `ALLOW_USER_PASSWORD_AUTH` enabled (added to
  `backend/deploy/aws/cognito-user-pool.yml`; redeploy required for live testing).
- Password reset needed **no CloudFormation change and no redeploy** — the live
  pool already has `AccountRecoverySetting: verified_email` and
  `AutoVerifiedAttributes: [email]` (verified 2026-08-16 with
  `aws cognito-idp describe-user-pool`).

## Goals

- Let a group co-plan a trip together in real time.
- Recommend destinations and activities based on combined group preferences.
- Connect trip planning, active travel, and reliving the trip into one object.
- Give travel a social layer through a followable feed of real trips.
- Keep the project portfolio-grade: correctness, observability, and
  explainability matter more than clever shortcuts.

## Non-Goals For Now

- Not a booking engine.
- No in-app music playback.
- No live location tracking.
- No web client yet.

## Tech Stack

- Go: public backend edge and domain service scaffolding.
- Python/FastAPI: recommendation process boundary.
- PostgreSQL + pgvector: local compose dependency; not wired into app code yet.
- MinIO: local S3-compatible storage; not wired into app code yet.
- Redis and NATS: target-state tools, not present in the current compose.
- OpenAPI: Go spec is hand-authored JSON in
  `backend/golang/routes/openapi/openapi.json`; Python spec is generated by
  FastAPI.

## Architecture Philosophy

Build as a modular monolith today, with service boundaries kept clear enough to
extract later.

Current package boundaries are simple:

- `backend/golang/routes/` is the public HTTP surface.
- `backend/golang/services/<name>/` contains domain/service stubs.
- `backend/golang/config/` loads env config and build metadata.
- `backend/golang/database/` and `backend/golang/infra/` are placeholder
  adapter areas.
- `backend/python/` is the separate reco process.

When adding code, prefer the current layout unless the task is explicitly to
migrate the scaffold. Do not introduce old planned paths like `backend/cmd`,
`backend/internal/modules`, or `backend/reco` unless you also update the docs and
move code intentionally.

## Working Principles

- Keep docs and implementation paths in sync in the same change.
- Add or update tests with behavior changes.
- Make behavior observable with structured logs/traces as the code matures.
- Keep secrets out of code; configuration comes from environment variables.
- Public REST and WebSockets belong at the Go edge.
- The reco process should remain separate from the Go binary.
- If a task depends on a service, contract, or package that does not exist yet,
  say so instead of silently inventing it.

# AWS Infrastructure — Spots

IaC format: **AWS CloudFormation (YAML)**.

CloudFormation was chosen because:
- It is AWS-native, requires no extra CLI tooling beyond the AWS CLI.
- It produces stack outputs that map cleanly to the `SPOTS_COGNITO_*` env vars consumed by the Go edge.
- It avoids a Terraform state-backend decision that can be deferred.

## Deployed Templates

| File | What it provisions |
|---|---|
| `cognito-user-pool.yml` | Cognito user pool + app client (Essentials tier, free ≤10,000 MAU) |

ECS Fargate, ALB, and RDS are tracked separately in `docs/AWS-TODO.md`.

---

## Cognito User Pool

### Auth flows

The app client (`SpotsAppClient`) has three explicit auth flows enabled:

| Flow | Purpose |
|---|---|
| `ALLOW_USER_SRP_AUTH` | Future mobile client (Amplify SDK); avoids sending the raw password |
| `ALLOW_USER_PASSWORD_AUTH` | Server-proxied login via `POST /v1/auth/login`; password transits the Go edge, acceptable for a public no-secret client over TLS |
| `ALLOW_REFRESH_TOKEN_AUTH` | Token refresh via `POST /v1/auth/refresh` |

`ADMIN_USER_PASSWORD_AUTH` is intentionally omitted — it requires IAM admin credentials and is not needed for the public server-proxied flow.

### Server-proxied auth endpoints

The Go monolith exposes `POST /v1/auth/{register,confirm,login,refresh,logout}` endpoints backed by Cognito's unauthenticated APIs (`SignUp`, `ConfirmSignUp`, `InitiateAuth`, `GlobalSignOut`). These require only the app client ID and region — no IAM credentials. After logging in with `POST /v1/auth/login`, use the returned `access_token` as a Bearer token on `GET /v1/users/me`.

### Tier and Cost

The template creates a pool on the **Essentials** tier:
- **10,000 MAU/month free** — covers demos, interviews, and early users at $0.
- Costs begin only if MAU exceeds 10,000 (then $0.015/MAU on Essentials).
- Advanced threat protection (Plus tier) is **not enabled** — no cost.
- SAML/OIDC external federation is **not configured** — no cost.

See the plan at `docs/plans/user-auth-and-identity.md` for full cost analysis.

### Prerequisites

- AWS CLI installed and authenticated (`aws sts get-caller-identity` should work).
- An AWS account with permissions to create Cognito user pools and CloudFormation stacks.

### Deploy

```bash
# Deploy (create or update) the dev user pool.
aws cloudformation deploy \
  --stack-name spots-cognito-dev \
  --template-file backend/deploy/aws/cognito-user-pool.yml \
  --parameter-overrides SpotsEnv=dev \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

Change `SpotsEnv` to `staging` or `prod` and `--stack-name` accordingly for other environments.

### Read back the env vars

After the stack creates/updates, read the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name spots-cognito-dev \
  --region us-east-1 \
  --query "Stacks[0].Outputs"
```

Map the outputs to `backend/.env` (copy from `backend/.env.example`):

| CloudFormation Output | .env variable |
|---|---|
| `IssuerURL` | `SPOTS_COGNITO_ISSUER_URL` |
| `JWKSURL` | `SPOTS_COGNITO_JWKS_URL` |
| `AppClientId` | `SPOTS_COGNITO_APP_CLIENT_ID` |
| `Region` | `SPOTS_COGNITO_REGION` |

Or use the AWS CLI to export them directly:

```bash
aws cloudformation describe-stacks \
  --stack-name spots-cognito-dev \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?OutputKey=='IssuerURL'].OutputValue" \
  --output text
```

### Tear down

```bash
aws cloudformation delete-stack --stack-name spots-cognito-dev --region us-east-1
```

Note: prod stacks have `DeletionProtection: ACTIVE` — disable it first in the console or via the API.

### Callback URL update

Before going to production, update `CallbackURLs` and `LogoutURLs` in the template to use real domain names. The placeholder `http://localhost:8080/auth/callback` is only safe for local development.

// Package config provides a minimal env-based configuration loader.
// It uses stdlib os.Getenv only — no third-party envconfig dependency.
// A richer config package (with struct-tag binding) arrives in a later
// milestone; this is the health-harness equivalent.
package config

import "os"

// Config holds the runtime configuration for the spotsd process.
type Config struct {
	// HTTPAddr is the TCP address the Go monolith listens on.
	// Env: SPOTS_HTTP_ADDR  Default: :8080
	HTTPAddr string

	// RecoURL is the base URL of the Python reco service.
	// Env: SPOTS_RECO_URL  Default: http://localhost:8081
	RecoURL string

	// ── Postgres ─────────────────────────────────────────────────────────────

	// PostgresURL is the DSN for the Postgres database used by the identity
	// and profile services. Env: SPOTS_POSTGRES_URL  Default: "" (disabled)
	// Example: postgres://spots:spots@localhost:5432/spots?sslmode=disable
	PostgresURL string

	// ── AWS Cognito ───────────────────────────────────────────────────────────
	// These fields are required to enable JWT verification at the edge.
	// All three must be set for auth routes to be registered.
	// The values are read back from the CloudFormation stack outputs after
	// deploying backend/deploy/aws/cognito-user-pool.yml.
	// Client IDs are not secret; client secrets (if any) must NOT be committed.

	// CognitoIssuerURL is the Cognito user pool issuer URL, e.g.
	// https://cognito-idp.{region}.amazonaws.com/{userPoolId}
	// Env: SPOTS_COGNITO_ISSUER_URL  Default: "" (auth disabled)
	CognitoIssuerURL string

	// CognitoJWKSURL is the JWKS endpoint for the user pool, conventionally
	// IssuerURL + "/.well-known/jwks.json".
	// Env: SPOTS_COGNITO_JWKS_URL  Default: "" (auth disabled)
	CognitoJWKSURL string

	// CognitoAppClientID is the Cognito app client ID. Used to validate the
	// client_id claim on access tokens. Not a secret.
	// Env: SPOTS_COGNITO_APP_CLIENT_ID  Default: "" (auth disabled)
	CognitoAppClientID string

	// CognitoRegion is the AWS region where the user pool lives, e.g. us-east-1.
	// Env: SPOTS_COGNITO_REGION  Default: "" (auth disabled)
	CognitoRegion string
}

// Load reads configuration from the environment, applying defaults for any
// variable that is not set.
func Load() Config {
	return Config{
		HTTPAddr:           getEnv("SPOTS_HTTP_ADDR", ":8080"),
		RecoURL:            getEnv("SPOTS_RECO_URL", "http://localhost:8081"),
		PostgresURL:        getEnv("SPOTS_POSTGRES_URL", ""),
		CognitoIssuerURL:   getEnv("SPOTS_COGNITO_ISSUER_URL", ""),
		CognitoJWKSURL:     getEnv("SPOTS_COGNITO_JWKS_URL", ""),
		CognitoAppClientID: getEnv("SPOTS_COGNITO_APP_CLIENT_ID", ""),
		CognitoRegion:      getEnv("SPOTS_COGNITO_REGION", ""),
	}
}

// getEnv returns the value of the named environment variable, or fallback if
// the variable is unset or empty.
func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

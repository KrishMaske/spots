package config_test

import (
	"testing"

	"github.com/krishm/spots/backend/golang/config"
)

func TestLoad_Defaults(t *testing.T) {
	// Ensure vars are unset so we exercise the default path.
	t.Setenv("SPOTS_HTTP_ADDR", "")
	t.Setenv("SPOTS_RECO_URL", "")
	t.Setenv("SPOTS_POSTGRES_URL", "")
	t.Setenv("SPOTS_COGNITO_ISSUER_URL", "")
	t.Setenv("SPOTS_COGNITO_JWKS_URL", "")
	t.Setenv("SPOTS_COGNITO_APP_CLIENT_ID", "")
	t.Setenv("SPOTS_COGNITO_REGION", "")

	cfg := config.Load()

	if cfg.HTTPAddr != ":8080" {
		t.Errorf("HTTPAddr default: got %q, want %q", cfg.HTTPAddr, ":8080")
	}
	if cfg.RecoURL != "http://localhost:8081" {
		t.Errorf("RecoURL default: got %q, want %q", cfg.RecoURL, "http://localhost:8081")
	}
	// New fields default to empty (auth and DB disabled when not set).
	if cfg.PostgresURL != "" {
		t.Errorf("PostgresURL default: got %q, want empty", cfg.PostgresURL)
	}
	if cfg.CognitoIssuerURL != "" {
		t.Errorf("CognitoIssuerURL default: got %q, want empty", cfg.CognitoIssuerURL)
	}
	if cfg.CognitoJWKSURL != "" {
		t.Errorf("CognitoJWKSURL default: got %q, want empty", cfg.CognitoJWKSURL)
	}
	if cfg.CognitoAppClientID != "" {
		t.Errorf("CognitoAppClientID default: got %q, want empty", cfg.CognitoAppClientID)
	}
	if cfg.CognitoRegion != "" {
		t.Errorf("CognitoRegion default: got %q, want empty", cfg.CognitoRegion)
	}
}

func TestLoad_Overrides(t *testing.T) {
	t.Setenv("SPOTS_HTTP_ADDR", ":9090")
	t.Setenv("SPOTS_RECO_URL", "http://reco-svc:8081")
	t.Setenv("SPOTS_POSTGRES_URL", "postgres://spots:spots@db:5432/spots?sslmode=disable")
	t.Setenv("SPOTS_COGNITO_ISSUER_URL", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE")
	t.Setenv("SPOTS_COGNITO_JWKS_URL", "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE/.well-known/jwks.json")
	t.Setenv("SPOTS_COGNITO_APP_CLIENT_ID", "abc123clientid")
	t.Setenv("SPOTS_COGNITO_REGION", "us-east-1")

	cfg := config.Load()

	if cfg.HTTPAddr != ":9090" {
		t.Errorf("HTTPAddr override: got %q, want %q", cfg.HTTPAddr, ":9090")
	}
	if cfg.RecoURL != "http://reco-svc:8081" {
		t.Errorf("RecoURL override: got %q, want %q", cfg.RecoURL, "http://reco-svc:8081")
	}
	if cfg.PostgresURL != "postgres://spots:spots@db:5432/spots?sslmode=disable" {
		t.Errorf("PostgresURL override: got %q", cfg.PostgresURL)
	}
	if cfg.CognitoIssuerURL != "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE" {
		t.Errorf("CognitoIssuerURL override: got %q", cfg.CognitoIssuerURL)
	}
	if cfg.CognitoJWKSURL != "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_EXAMPLE/.well-known/jwks.json" {
		t.Errorf("CognitoJWKSURL override: got %q", cfg.CognitoJWKSURL)
	}
	if cfg.CognitoAppClientID != "abc123clientid" {
		t.Errorf("CognitoAppClientID override: got %q", cfg.CognitoAppClientID)
	}
	if cfg.CognitoRegion != "us-east-1" {
		t.Errorf("CognitoRegion override: got %q", cfg.CognitoRegion)
	}
}

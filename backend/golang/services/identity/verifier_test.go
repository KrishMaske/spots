package identity_test

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jws"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"github.com/krishm/spots/backend/golang/services/identity"
)

// newTestRSAKey generates a 2048-bit RSA key pair and returns the private
// key plus a JWK Set containing only the public key (for JWKS endpoint use).
func newTestRSAKey(t *testing.T) (*rsa.PrivateKey, jwk.Set) {
	t.Helper()
	privKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}

	privJWK, err := jwk.Import(privKey)
	if err != nil {
		t.Fatalf("import private key as JWK: %v", err)
	}
	if err := privJWK.Set(jwk.KeyIDKey, "test-key-1"); err != nil {
		t.Fatalf("set kid: %v", err)
	}
	if err := privJWK.Set(jwk.AlgorithmKey, jwa.RS256().String()); err != nil {
		t.Fatalf("set alg: %v", err)
	}

	pubJWK, err := privJWK.PublicKey()
	if err != nil {
		t.Fatalf("get public JWK: %v", err)
	}

	set := jwk.NewSet()
	if err := set.AddKey(pubJWK); err != nil {
		t.Fatalf("add key to set: %v", err)
	}

	return privKey, set
}

// jwksServer starts an httptest.Server that serves set as JSON at /jwks.
func jwksServer(t *testing.T, set jwk.Set) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		b, err := json.Marshal(set)
		if err != nil {
			http.Error(w, "marshal error", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(b)
	}))
}

// signToken signs a jwt.Token with privKey using RS256 and includes kid in
// the JWS protected header. Cognito always includes kid in the header so that
// the JWKS verifier can select the right key; test tokens must do the same.
func signToken(t *testing.T, tok jwt.Token, privKey *rsa.PrivateKey) string {
	t.Helper()
	// Set kid="test-key-1" in the JWS protected header to match the JWKS key.
	hdr := jws.NewHeaders()
	if err := hdr.Set(jws.KeyIDKey, "test-key-1"); err != nil {
		t.Fatalf("set kid header: %v", err)
	}
	signed, err := jwt.Sign(tok, jwt.WithKey(jwa.RS256(), privKey, jws.WithProtectedHeaders(hdr)))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return string(signed)
}

// buildAccessToken builds a valid Cognito-shaped access token for the given
// issuer and app client ID. It sets token_use=access and client_id.
func buildAccessToken(t *testing.T, issuer, clientID, sub string, exp time.Time) jwt.Token {
	t.Helper()
	tok, err := jwt.NewBuilder().
		Issuer(issuer).
		Subject(sub).
		IssuedAt(time.Now()).
		Expiration(exp).
		Claim("token_use", "access").
		Claim("client_id", clientID).
		Build()
	if err != nil {
		t.Fatalf("build token: %v", err)
	}
	return tok
}

func TestCognitoTokenVerifier_Valid(t *testing.T) {
	t.Parallel()

	privKey, pubSet := newTestRSAKey(t)
	srv := jwksServer(t, pubSet)
	defer srv.Close()

	const clientID = "test-client-id"
	const sub = "user-sub-123"
	issuerURL := srv.URL // use test server URL as issuer so iss claim matches

	verifier, err := identity.NewCognitoTokenVerifier(context.Background(), identity.CognitoVerifierConfig{
		IssuerURL:   issuerURL,
		JWKSURL:     srv.URL,
		AppClientID: clientID,
		KeySetTTL:   5 * time.Second,
	})
	if err != nil {
		t.Fatalf("new verifier: %v", err)
	}

	tok := buildAccessToken(t, issuerURL, clientID, sub, time.Now().Add(time.Hour))
	raw := signToken(t, tok, privKey)

	claims, err := verifier.Verify(context.Background(), raw)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}

	if claims.Subject != sub {
		t.Errorf("subject: got %q, want %q", claims.Subject, sub)
	}
	if claims.TokenUse != "access" {
		t.Errorf("token_use: got %q, want access", claims.TokenUse)
	}
	if claims.Issuer != issuerURL {
		t.Errorf("issuer: got %q, want %q", claims.Issuer, issuerURL)
	}
}

func TestCognitoTokenVerifier_ExpiredToken(t *testing.T) {
	t.Parallel()

	privKey, pubSet := newTestRSAKey(t)
	srv := jwksServer(t, pubSet)
	defer srv.Close()

	const clientID = "test-client-id"
	verifier, err := identity.NewCognitoTokenVerifier(context.Background(), identity.CognitoVerifierConfig{
		IssuerURL:   srv.URL,
		JWKSURL:     srv.URL,
		AppClientID: clientID,
		KeySetTTL:   5 * time.Second,
	})
	if err != nil {
		t.Fatalf("new verifier: %v", err)
	}

	tok := buildAccessToken(t, srv.URL, clientID, "any-sub", time.Now().Add(-time.Hour))
	raw := signToken(t, tok, privKey)

	_, err = verifier.Verify(context.Background(), raw)
	if err == nil {
		t.Fatal("expected error for expired token, got nil")
	}
}

func TestCognitoTokenVerifier_WrongIssuer(t *testing.T) {
	t.Parallel()

	privKey, pubSet := newTestRSAKey(t)
	srv := jwksServer(t, pubSet)
	defer srv.Close()

	const clientID = "test-client-id"
	verifier, err := identity.NewCognitoTokenVerifier(context.Background(), identity.CognitoVerifierConfig{
		IssuerURL:   "https://expected-issuer.example.com",
		JWKSURL:     srv.URL,
		AppClientID: clientID,
		KeySetTTL:   5 * time.Second,
	})
	if err != nil {
		t.Fatalf("new verifier: %v", err)
	}

	// Token has a different issuer than what the verifier expects.
	tok := buildAccessToken(t, "https://wrong-issuer.example.com", clientID, "sub", time.Now().Add(time.Hour))
	raw := signToken(t, tok, privKey)

	_, err = verifier.Verify(context.Background(), raw)
	if err == nil {
		t.Fatal("expected error for wrong issuer, got nil")
	}
}

func TestCognitoTokenVerifier_WrongClientID(t *testing.T) {
	t.Parallel()

	privKey, pubSet := newTestRSAKey(t)
	srv := jwksServer(t, pubSet)
	defer srv.Close()

	verifier, err := identity.NewCognitoTokenVerifier(context.Background(), identity.CognitoVerifierConfig{
		IssuerURL:   srv.URL,
		JWKSURL:     srv.URL,
		AppClientID: "expected-client-id",
		KeySetTTL:   5 * time.Second,
	})
	if err != nil {
		t.Fatalf("new verifier: %v", err)
	}

	// Token carries a different client_id than the verifier expects.
	tok := buildAccessToken(t, srv.URL, "wrong-client-id", "sub", time.Now().Add(time.Hour))
	raw := signToken(t, tok, privKey)

	_, err = verifier.Verify(context.Background(), raw)
	if err == nil {
		t.Fatal("expected error for wrong client_id, got nil")
	}
}

func TestCognitoTokenVerifier_WrongTokenUse(t *testing.T) {
	t.Parallel()

	privKey, pubSet := newTestRSAKey(t)
	srv := jwksServer(t, pubSet)
	defer srv.Close()

	const clientID = "test-client-id"
	verifier, err := identity.NewCognitoTokenVerifier(context.Background(), identity.CognitoVerifierConfig{
		IssuerURL:   srv.URL,
		JWKSURL:     srv.URL,
		AppClientID: clientID,
		KeySetTTL:   5 * time.Second,
	})
	if err != nil {
		t.Fatalf("new verifier: %v", err)
	}

	// Build an ID token (token_use=id) — these must be rejected at the API boundary.
	tok, err := jwt.NewBuilder().
		Issuer(srv.URL).
		Subject("sub").
		Expiration(time.Now().Add(time.Hour)).
		Claim("token_use", "id").
		Claim("aud", clientID).
		Build()
	if err != nil {
		t.Fatalf("build token: %v", err)
	}
	raw := signToken(t, tok, privKey)

	_, err = verifier.Verify(context.Background(), raw)
	if err == nil {
		t.Fatal("expected error for token_use=id, got nil")
	}
}

func TestCognitoTokenVerifier_MissingClientID(t *testing.T) {
	t.Parallel()

	privKey, pubSet := newTestRSAKey(t)
	srv := jwksServer(t, pubSet)
	defer srv.Close()

	verifier, err := identity.NewCognitoTokenVerifier(context.Background(), identity.CognitoVerifierConfig{
		IssuerURL:   srv.URL,
		JWKSURL:     srv.URL,
		AppClientID: "test-client-id",
		KeySetTTL:   5 * time.Second,
	})
	if err != nil {
		t.Fatalf("new verifier: %v", err)
	}

	// Token has no client_id claim.
	tok, err := jwt.NewBuilder().
		Issuer(srv.URL).
		Subject("sub").
		Expiration(time.Now().Add(time.Hour)).
		Claim("token_use", "access").
		Build()
	if err != nil {
		t.Fatalf("build token: %v", err)
	}
	raw := signToken(t, tok, privKey)

	_, err = verifier.Verify(context.Background(), raw)
	if err == nil {
		t.Fatal("expected error for missing client_id, got nil")
	}
}

func TestCognitoTokenVerifier_BadSignature(t *testing.T) {
	t.Parallel()

	_, pubSet := newTestRSAKey(t) // correct public key
	srv := jwksServer(t, pubSet)
	defer srv.Close()

	// Token signed by a DIFFERENT private key — signature check must fail.
	otherPrivKey, _ := rsa.GenerateKey(rand.Reader, 2048)

	verifier, err := identity.NewCognitoTokenVerifier(context.Background(), identity.CognitoVerifierConfig{
		IssuerURL:   srv.URL,
		JWKSURL:     srv.URL,
		AppClientID: "test-client-id",
		KeySetTTL:   5 * time.Second,
	})
	if err != nil {
		t.Fatalf("new verifier: %v", err)
	}

	tok := buildAccessToken(t, srv.URL, "test-client-id", "sub", time.Now().Add(time.Hour))
	raw := signToken(t, tok, otherPrivKey) // signed with wrong key

	_, err = verifier.Verify(context.Background(), raw)
	if err == nil {
		t.Fatal("expected error for bad signature, got nil")
	}
}

func TestCognitoTokenVerifier_Config_Validation(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		cfg  identity.CognitoVerifierConfig
	}{
		{"missing IssuerURL", identity.CognitoVerifierConfig{JWKSURL: "http://x", AppClientID: "c"}},
		{"missing JWKSURL", identity.CognitoVerifierConfig{IssuerURL: "http://x", AppClientID: "c"}},
		{"missing AppClientID", identity.CognitoVerifierConfig{IssuerURL: "http://x", JWKSURL: "http://x"}},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, err := identity.NewCognitoTokenVerifier(context.Background(), tc.cfg)
			if err == nil {
				t.Fatal("expected error for invalid config, got nil")
			}
		})
	}
}

func TestJWKSCaching(t *testing.T) {
	t.Parallel()

	privKey, pubSet := newTestRSAKey(t)
	fetchCount := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		fetchCount++
		b, _ := json.Marshal(pubSet)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(b)
	}))
	defer srv.Close()

	const clientID = "test-client-id"
	verifier, err := identity.NewCognitoTokenVerifier(context.Background(), identity.CognitoVerifierConfig{
		IssuerURL:   srv.URL,
		JWKSURL:     srv.URL,
		AppClientID: clientID,
		KeySetTTL:   5 * time.Second, // long TTL so second call hits cache
	})
	if err != nil {
		t.Fatalf("new verifier: %v", err)
	}

	tok := buildAccessToken(t, srv.URL, clientID, "sub", time.Now().Add(time.Hour))
	raw := signToken(t, tok, privKey)

	// First call: cache miss, triggers a fetch.
	if _, err := verifier.Verify(context.Background(), raw); err != nil {
		t.Fatalf("first verify: %v", err)
	}
	// Second call: cache hit, no fetch.
	if _, err := verifier.Verify(context.Background(), raw); err != nil {
		t.Fatalf("second verify: %v", err)
	}

	if fetchCount != 1 {
		t.Errorf("JWKS fetch count: got %d, want 1 (second call should use cache)", fetchCount)
	}
}

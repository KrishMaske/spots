package identity

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
)

// TokenVerifier validates a raw JWT string and returns the claims needed by
// the authentication layer. Implementations must validate signature, issuer,
// expiry, and token_use before returning any claims. No claim from an
// unverified token should be trusted.
type TokenVerifier interface {
	Verify(ctx context.Context, rawToken string) (Claims, error)
}

// CognitoVerifierConfig holds the Cognito-specific configuration needed to
// validate access tokens.
type CognitoVerifierConfig struct {
	// IssuerURL is the Cognito user pool issuer URL, e.g.
	// https://cognito-idp.{region}.amazonaws.com/{userPoolId}
	IssuerURL string

	// JWKSURL is the public JWKS endpoint for the user pool. Conventionally
	// IssuerURL + "/.well-known/jwks.json".
	JWKSURL string

	// AppClientID is the Cognito app client ID, used to validate the
	// client_id claim on access tokens. Not a secret.
	AppClientID string

	// KeySetTTL controls how long a fetched JWKS is cached before re-fetching.
	// Defaults to 1 hour when zero. Cognito rotates keys rarely; 1h is safe.
	KeySetTTL time.Duration
}

// CognitoTokenVerifier validates Cognito-issued access tokens (token_use=access).
// It caches the JWKS locally and re-fetches when the TTL expires.
// Serve-stale-on-error is used: if a refresh fails but a cached keyset exists
// it is served to avoid authentication outages during transient Cognito issues.
//
// Only access tokens are accepted. ID tokens (token_use=id) are rejected so
// that resource servers do not accidentally trust audience claims meant for
// a client application.
type CognitoTokenVerifier struct {
	cfg    CognitoVerifierConfig
	ttl    time.Duration
	mu     sync.RWMutex
	keyset jwk.Set
	gotAt  time.Time
}

// NewCognitoTokenVerifier creates a CognitoTokenVerifier ready to use.
// It performs no network calls; the first Verify call fetches the JWKS.
// If cfg.KeySetTTL is zero it defaults to 1 hour.
func NewCognitoTokenVerifier(_ context.Context, cfg CognitoVerifierConfig) (*CognitoTokenVerifier, error) {
	if cfg.IssuerURL == "" {
		return nil, fmt.Errorf("cognito verifier: IssuerURL is required")
	}
	if cfg.JWKSURL == "" {
		return nil, fmt.Errorf("cognito verifier: JWKSURL is required")
	}
	if cfg.AppClientID == "" {
		return nil, fmt.Errorf("cognito verifier: AppClientID is required")
	}
	ttl := cfg.KeySetTTL
	if ttl <= 0 {
		ttl = time.Hour
	}
	return &CognitoTokenVerifier{cfg: cfg, ttl: ttl}, nil
}

// keySet returns the cached JWKS, fetching it if the cache is cold or stale.
// On a fetch error it serves a stale keyset when one exists.
func (v *CognitoTokenVerifier) keySet(ctx context.Context) (jwk.Set, error) {
	// Fast path: cached and fresh.
	v.mu.RLock()
	if v.keyset != nil && time.Since(v.gotAt) < v.ttl {
		ks := v.keyset
		v.mu.RUnlock()
		return ks, nil
	}
	v.mu.RUnlock()

	// Slow path: acquire write lock and refresh.
	v.mu.Lock()
	defer v.mu.Unlock()
	// Double-checked lock: another goroutine may have refreshed while we waited.
	if v.keyset != nil && time.Since(v.gotAt) < v.ttl {
		return v.keyset, nil
	}

	ks, err := jwk.Fetch(ctx, v.cfg.JWKSURL)
	if err != nil {
		// Serve stale keyset to tolerate transient Cognito connectivity issues.
		if v.keyset != nil {
			return v.keyset, nil
		}
		return nil, fmt.Errorf("cognito verifier: fetch JWKS from %q: %w", v.cfg.JWKSURL, err)
	}

	v.keyset = ks
	v.gotAt = time.Now()
	return ks, nil
}

// Verify validates rawToken and returns the claims on success.
// It validates: JWKS signature, issuer, expiry, token_use=access, client_id.
// Never logs the raw token.
func (v *CognitoTokenVerifier) Verify(ctx context.Context, rawToken string) (Claims, error) {
	ks, err := v.keySet(ctx)
	if err != nil {
		return Claims{}, err
	}

	tok, err := jwt.Parse([]byte(rawToken),
		jwt.WithKeySet(ks),
		jwt.WithValidate(true),
		jwt.WithIssuer(v.cfg.IssuerURL),
	)
	if err != nil {
		return Claims{}, fmt.Errorf("cognito verifier: token validation failed: %w", err)
	}

	// Validate token_use — only access tokens are accepted at the API boundary.
	// In jwx/v3, tok.Get(name, &dst) sets dst and returns an error when absent.
	var tokenUse string
	if err := tok.Get("token_use", &tokenUse); err != nil {
		return Claims{}, fmt.Errorf("cognito verifier: missing or invalid token_use claim: %w", err)
	}
	if tokenUse != "access" {
		return Claims{}, fmt.Errorf("cognito verifier: invalid token_use %q, want access", tokenUse)
	}

	// Validate client_id — Cognito access tokens carry client_id instead of aud.
	var clientID string
	if err := tok.Get("client_id", &clientID); err != nil {
		return Claims{}, fmt.Errorf("cognito verifier: missing or invalid client_id claim: %w", err)
	}
	if clientID != v.cfg.AppClientID {
		return Claims{}, fmt.Errorf("cognito verifier: client_id mismatch")
	}

	// In jwx/v3, standard claim accessors return (T, bool).
	sub, _ := tok.Subject()
	issuer, _ := tok.Issuer()

	var email string
	// email is a non-standard claim on Cognito access tokens — ignore the error.
	_ = tok.Get("email", &email)

	return Claims{
		Subject:  sub,
		Email:    email,
		Issuer:   issuer,
		TokenUse: tokenUse,
	}, nil
}

// Command spotsd is the composition root for the Spots Go monolith.
// It loads configuration, wires the route layer, and starts listening.
//
// Build-time metadata can be injected with -ldflags, for example:
//
//	go build -ldflags "\
//	  -X github.com/krishm/spots/backend/golang/config.Version=v0.1.0 \
//	  -X github.com/krishm/spots/backend/golang/config.Commit=$(git rev-parse --short HEAD)" \
//	  ./golang
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/joho/godotenv"

	"github.com/krishm/spots/backend/golang/config"
	"github.com/krishm/spots/backend/golang/routes"
	"github.com/krishm/spots/backend/golang/services/identity"
	"github.com/krishm/spots/backend/golang/services/profile"
	"github.com/krishm/spots/backend/golang/services/reco"
)

func main() {
	// Local dev convenience: load backend/.env if present. A missing file is a
	// no-op; on ECS/prod the real environment is already populated, so this does
	// nothing. Never fatal — never overrides vars already set in the environment.
	_ = godotenv.Load() // godotenv does NOT overwrite existing env vars

	cfg := config.Load()

	checker := reco.NewChecker(cfg.RecoURL)

	deps := routes.Deps{RecoChecker: checker}

	// Wire auth when all Cognito env vars are present.
	// If any var is missing the server starts without auth routes (dev mode).
	if cfg.CognitoIssuerURL != "" && cfg.CognitoJWKSURL != "" && cfg.CognitoAppClientID != "" {
		ctx := context.Background()
		verifier, err := identity.NewCognitoTokenVerifier(ctx, identity.CognitoVerifierConfig{
			IssuerURL:   cfg.CognitoIssuerURL,
			JWKSURL:     cfg.CognitoJWKSURL,
			AppClientID: cfg.CognitoAppClientID,
		})
		if err != nil {
			log.Printf("warn: auth disabled: cognito verifier setup failed: %v", err)
		} else {
			// NOTE: replace identity.NewMemStore() with a Postgres-backed store
			// once the DB layer is wired (schema design is Krish's to own).
			store := identity.NewMemStore()
			authr := identity.NewCognitoAuthenticator(store, nil)
			profileStore := profile.NewMemStore()
			profileSvc := profile.NewService(profileStore)
			deps.TokenVerifier = verifier
			deps.Authenticator = authr
			deps.ProfileSvc = profileSvc
			deps.UserStore = store
			log.Printf("auth: cognito verifier active (issuer=%s)", cfg.CognitoIssuerURL)

			// Wire the auth provider when region is set.
			// The provider enables /v1/auth/* endpoints for server-proxied login.
			if cfg.CognitoRegion != "" {
				provider, provErr := identity.NewCognitoAuthProvider(ctx, cfg.CognitoRegion, cfg.CognitoAppClientID)
				if provErr != nil {
					log.Printf("warn: auth provider disabled: %v", provErr)
				} else {
					deps.AuthProvider = provider
					log.Printf("auth: cognito provider active (region=%s)", cfg.CognitoRegion)
				}
			} else {
				log.Println("warn: auth provider disabled: SPOTS_COGNITO_REGION not set")
			}
		}
	} else {
		log.Println("warn: auth disabled: SPOTS_COGNITO_ISSUER_URL / _JWKS_URL / _APP_CLIENT_ID not set")
	}

	srv := routes.NewServer(cfg.HTTPAddr, deps)

	log.Printf("spots listening on %s (reco=%s)", localHTTPURL(cfg.HTTPAddr), cfg.RecoURL)

	if err := srv.HTTP.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("spotsd: %v", err)
	}
}

func localHTTPURL(addr string) string {
	if strings.HasPrefix(addr, ":") {
		return "http://localhost" + addr
	}

	return fmt.Sprintf("http://%s", addr)
}

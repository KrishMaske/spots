// Package reco is the Go-side client for the Python reco service. For now it
// exposes a liveness Ping used by the /readyz route; richer RPC methods arrive
// once the reco gRPC contract (backend/proto/reco/v1) is wired.
package reco

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Checker pings the Python reco service's /health endpoint to determine
// whether reco is reachable. It is injected into the /readyz handler so the
// readiness check can report reco's status without coupling the route layer
// to reco's transport details.
type Checker struct {
	baseURL string
	client  *http.Client
}

// NewChecker constructs a Checker that targets baseURL (e.g.
// "http://localhost:8081"). It creates a dedicated http.Client with a short
// timeout so the /readyz handler never hangs.
func NewChecker(baseURL string) *Checker {
	return &Checker{
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 2 * time.Second,
		},
	}
}

// Ping issues GET {baseURL}/health and returns nil on a 2xx response.
// Any non-2xx status code or transport error is returned as an error.
func (c *Checker) Ping(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return fmt.Errorf("reco ping: build request: %w", err)
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("reco ping: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("reco ping: unexpected status %d", resp.StatusCode)
	}
	return nil
}

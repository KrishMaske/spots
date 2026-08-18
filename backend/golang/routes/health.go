package routes

import (
	"encoding/json"
	"net/http"

	"github.com/krishm/spots/backend/golang/config"
	"github.com/krishm/spots/backend/golang/services/reco"
)

// healthzResponse is the JSON body returned by GET /healthz.
type healthzResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
	Version string `json:"version"`
	Commit  string `json:"commit"`
}

// readyzResponse is the JSON body returned by GET /readyz.
type readyzResponse struct {
	Status string            `json:"status"`
	Checks map[string]string `json:"checks"`
}

// handleHealthz handles GET /healthz.
// Liveness: always 200 if the process is up. No outbound calls.
func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, healthzResponse{
		Status:  "ok",
		Service: "spotsd",
		Version: config.Version,
		Commit:  config.Commit,
	})
}

// handleReadyz returns a handler for GET /readyz.
// Readiness: 200 only when reco is reachable; 503 otherwise.
// Intentionally does NOT check Postgres/Redis/MinIO — no infra required.
func handleReadyz(checker *reco.Checker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := checker.Ping(r.Context()); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, readyzResponse{
				Status: "degraded",
				Checks: map[string]string{"reco": "unreachable"},
			})
			return
		}

		writeJSON(w, http.StatusOK, readyzResponse{
			Status: "ok",
			Checks: map[string]string{"reco": "ok"},
		})
	}
}

// writeJSON encodes v as JSON and writes it with the given status code.
// Sets Content-Type to application/json.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

package routes_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/krishm/spots/backend/golang/routes"
	"github.com/krishm/spots/backend/golang/services/reco"
)

// TestHealthz asserts that GET /healthz returns 200 with the expected fields.
func TestHealthz(t *testing.T) {
	t.Parallel()

	srv := routes.NewServer(":0", routes.Deps{RecoChecker: reco.NewChecker("http://localhost:0")})
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()

	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if got := body["status"]; got != "ok" {
		t.Errorf("status: got %v, want ok", got)
	}
	if got := body["service"]; got != "spotsd" {
		t.Errorf("service: got %v, want spotsd", got)
	}
	if _, ok := body["version"]; !ok {
		t.Error("missing version field")
	}
	if _, ok := body["commit"]; !ok {
		t.Error("missing commit field")
	}
}

// TestReadyz_RecoUp asserts that GET /readyz returns 200 when reco is healthy.
// A stub httptest server stands in for the Python reco process.
func TestReadyz_RecoUp(t *testing.T) {
	t.Parallel()

	// Spin up a stub reco server that returns 200 on /health.
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			w.WriteHeader(http.StatusOK)
			return
		}
		http.NotFound(w, r)
	}))
	defer stub.Close()

	srv := routes.NewServer(":0", routes.Deps{RecoChecker: reco.NewChecker(stub.URL)})

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status: got %d, want 200", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if got := body["status"]; got != "ok" {
		t.Errorf("status: got %v, want ok", got)
	}

	checks, _ := body["checks"].(map[string]any)
	if got := checks["reco"]; got != "ok" {
		t.Errorf("checks.reco: got %v, want ok", got)
	}
}

// TestReadyz_RecoDown asserts that GET /readyz returns 503 when reco is
// unreachable (stub returns 500) and the body signals degraded state.
func TestReadyz_RecoDown(t *testing.T) {
	t.Parallel()

	// Stub reco that always returns 500.
	stub := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer stub.Close()

	srv := routes.NewServer(":0", routes.Deps{RecoChecker: reco.NewChecker(stub.URL)})

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status: got %d, want 503", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if got := body["status"]; got != "degraded" {
		t.Errorf("status: got %v, want degraded", got)
	}

	checks, _ := body["checks"].(map[string]any)
	if got := checks["reco"]; got != "unreachable" {
		t.Errorf("checks.reco: got %v, want unreachable", got)
	}
}

// TestReadyz_RecoUnreachable asserts that /readyz returns 503 when reco's
// URL is completely unreachable (no server listening).
func TestReadyz_RecoUnreachable(t *testing.T) {
	t.Parallel()

	// Use a port that nothing is listening on.
	srv := routes.NewServer(":0", routes.Deps{RecoChecker: reco.NewChecker("http://127.0.0.1:19999")})

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()

	srv.HTTP.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status: got %d, want 503", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("decode body: %v", err)
	}

	if got := body["status"]; got != "degraded" {
		t.Errorf("status: got %v, want degraded", got)
	}
}

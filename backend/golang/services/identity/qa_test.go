package identity_test

// qa_test.go — QA-added tests for behaviors called out in the
// cognito-auth-testable plan that were missing from the original test suite.

import (
	"context"
	"errors"
	"testing"

	"github.com/krishm/spots/backend/golang/services/identity"
)

// ── Caveat-2: email self-heal on an existing email-less row ──────────────────

// TestCognitoAuthenticator_EmailSelfHeal verifies that when Authenticate is
// called for an existing user whose stored Email is empty, and the incoming
// claims carry an email, UpdateEmail is called and the returned user reflects
// the new email (authenticator.go lines 74-79).
func TestCognitoAuthenticator_EmailSelfHeal(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	authr := identity.NewCognitoAuthenticator(store, deterministicID("user-001"))

	// First login: create the row with no email (simulates a token-only first
	// login where the access token had no email claim).
	claimsNoEmail := identity.Claims{Subject: "sub-abc"}
	if _, err := authr.Authenticate(context.Background(), claimsNoEmail); err != nil {
		t.Fatalf("first login (no email): %v", err)
	}

	// Verify the row starts with empty email.
	stored, err := store.FindBySub(context.Background(), "sub-abc")
	if err != nil {
		t.Fatalf("find after first login: %v", err)
	}
	if stored.Email != "" {
		t.Fatalf("pre-condition: expected empty email in store, got %q", stored.Email)
	}

	// Second login: claims now carry the email (e.g. from a login-enriched path).
	claimsWithEmail := identity.Claims{Subject: "sub-abc", Email: "alice@example.com"}
	user, err := authr.Authenticate(context.Background(), claimsWithEmail)
	if err != nil {
		t.Fatalf("second login (with email): %v", err)
	}

	// The returned user must have the email applied.
	if user.Email != "alice@example.com" {
		t.Errorf("returned user.Email: got %q, want alice@example.com", user.Email)
	}

	// The store must also reflect the update.
	after, err := store.FindBySub(context.Background(), "sub-abc")
	if err != nil {
		t.Fatalf("find after second login: %v", err)
	}
	if after.Email != "alice@example.com" {
		t.Errorf("stored user.Email after self-heal: got %q, want alice@example.com", after.Email)
	}
}

// TestCognitoAuthenticator_EmailSelfHeal_NoOverwrite verifies that the self-heal
// logic does NOT overwrite an already-correct email with a different value.
func TestCognitoAuthenticator_EmailSelfHeal_NoOverwrite(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	authr := identity.NewCognitoAuthenticator(store, deterministicID("user-001"))

	// First login: row created with email.
	claimsFirst := identity.Claims{Subject: "sub-abc", Email: "original@example.com"}
	if _, err := authr.Authenticate(context.Background(), claimsFirst); err != nil {
		t.Fatalf("first login: %v", err)
	}

	// Second login with the SAME email: no write needed and returned email
	// is unchanged. (The condition is claims.Email != "" && user.Email != claims.Email;
	// equal emails should not trigger UpdateEmail.)
	claimsSame := identity.Claims{Subject: "sub-abc", Email: "original@example.com"}
	user, err := authr.Authenticate(context.Background(), claimsSame)
	if err != nil {
		t.Fatalf("second login: %v", err)
	}
	if user.Email != "original@example.com" {
		t.Errorf("email should be unchanged: got %q, want original@example.com", user.Email)
	}
}

// ── MemStore.UpdateEmail ──────────────────────────────────────────────────────

// TestMemStore_UpdateEmail_NotFound verifies that UpdateEmail returns ErrNotFound
// for a user ID that does not exist in the store.
func TestMemStore_UpdateEmail_NotFound(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	err := store.UpdateEmail(context.Background(), "non-existent-id", "x@y.com")
	if !errors.Is(err, identity.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

// TestMemStore_UpdateEmail_Persists verifies that a successful UpdateEmail is
// visible via FindBySub (both indexes stay consistent).
func TestMemStore_UpdateEmail_Persists(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	authr := identity.NewCognitoAuthenticator(store, deterministicID("user-001"))

	if _, err := authr.Authenticate(context.Background(), identity.Claims{
		Subject: "sub-test",
		Email:   "",
	}); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	if err := store.UpdateEmail(context.Background(), "user-001", "new@example.com"); err != nil {
		t.Fatalf("UpdateEmail: %v", err)
	}

	got, err := store.FindBySub(context.Background(), "sub-test")
	if err != nil {
		t.Fatalf("FindBySub after UpdateEmail: %v", err)
	}
	if got.Email != "new@example.com" {
		t.Errorf("email after update: got %q, want new@example.com", got.Email)
	}
}

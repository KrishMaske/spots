package identity_test

import (
	"context"
	"errors"
	"testing"

	"github.com/krishm/spots/backend/golang/services/identity"
)

// deterministicID returns an ID function that returns successive values from
// the ids slice; panics if called more times than there are values.
func deterministicID(ids ...string) func() string {
	i := 0
	return func() string {
		if i >= len(ids) {
			panic("ran out of predetermined IDs")
		}
		id := ids[i]
		i++
		return id
	}
}

func TestCognitoAuthenticator_FirstLogin(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	authr := identity.NewCognitoAuthenticator(store, deterministicID("user-001"))

	claims := identity.Claims{
		Subject:  "cognito-sub-abc",
		Email:    "alice@example.com",
		Issuer:   "https://cognito-idp.us-east-1.amazonaws.com/pool-1",
		TokenUse: "access",
	}

	user, err := authr.Authenticate(context.Background(), claims)
	if err != nil {
		t.Fatalf("authenticate first login: %v", err)
	}

	if user.ID != "user-001" {
		t.Errorf("user.ID: got %q, want %q", user.ID, "user-001")
	}
	if user.CognitoSub != "cognito-sub-abc" {
		t.Errorf("user.CognitoSub: got %q, want %q", user.CognitoSub, "cognito-sub-abc")
	}
	if user.Email != "alice@example.com" {
		t.Errorf("user.Email: got %q, want alice@example.com", user.Email)
	}
	if user.Status != "active" {
		t.Errorf("user.Status: got %q, want active", user.Status)
	}
	if user.CreatedAt.IsZero() {
		t.Error("user.CreatedAt should not be zero on first login")
	}
}

func TestCognitoAuthenticator_FirstLogin_PersistedInStore(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	authr := identity.NewCognitoAuthenticator(store, deterministicID("user-001"))

	claims := identity.Claims{
		Subject: "cognito-sub-abc",
		Email:   "alice@example.com",
	}

	if _, err := authr.Authenticate(context.Background(), claims); err != nil {
		t.Fatalf("first login: %v", err)
	}

	// Verify the user was actually written to the store.
	stored, err := store.FindBySub(context.Background(), "cognito-sub-abc")
	if err != nil {
		t.Fatalf("find after first login: %v", err)
	}
	if stored.ID != "user-001" {
		t.Errorf("stored user ID: got %q, want user-001", stored.ID)
	}
}

func TestCognitoAuthenticator_SubsequentLogin(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	authr := identity.NewCognitoAuthenticator(store, deterministicID("user-001"))

	claims := identity.Claims{
		Subject: "cognito-sub-abc",
		Email:   "alice@example.com",
	}

	// First login creates the user.
	user1, err := authr.Authenticate(context.Background(), claims)
	if err != nil {
		t.Fatalf("first login: %v", err)
	}

	// Second login returns the same user (same ID, no duplicate creation).
	user2, err := authr.Authenticate(context.Background(), claims)
	if err != nil {
		t.Fatalf("second login: %v", err)
	}

	if user1.ID != user2.ID {
		t.Errorf("subsequent login should return same user: got %q, first was %q", user2.ID, user1.ID)
	}
}

func TestCognitoAuthenticator_StoreCreateError(t *testing.T) {
	t.Parallel()

	// Use a broken store that always fails on Create.
	store := &failingStore{err: errors.New("db write error")}
	authr := identity.NewCognitoAuthenticator(store, deterministicID("user-001"))

	claims := identity.Claims{
		Subject: "new-sub",
	}

	_, err := authr.Authenticate(context.Background(), claims)
	if err == nil {
		t.Fatal("expected error when store.Create fails, got nil")
	}
}

func TestMemStore_FindBySub_NotFound(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	_, err := store.FindBySub(context.Background(), "non-existent-sub")
	if !errors.Is(err, identity.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestMemStore_UpdateLastLogin_NotFound(t *testing.T) {
	t.Parallel()

	store := identity.NewMemStore()
	err := store.UpdateLastLogin(context.Background(), "non-existent-id")
	if !errors.Is(err, identity.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestContextWithUser_RoundTrip(t *testing.T) {
	t.Parallel()

	user := &identity.User{ID: "abc", CognitoSub: "sub", Email: "u@x.com", Status: "active"}
	ctx := identity.ContextWithUser(context.Background(), user)

	got, ok := identity.UserFromContext(ctx)
	if !ok {
		t.Fatal("UserFromContext returned false after ContextWithUser")
	}
	if got.ID != user.ID {
		t.Errorf("ID: got %q, want %q", got.ID, user.ID)
	}
}

func TestUserFromContext_EmptyContext(t *testing.T) {
	t.Parallel()

	_, ok := identity.UserFromContext(context.Background())
	if ok {
		t.Error("expected false for empty context, got true")
	}
}

// failingStore is a stub UserStore that returns a pre-configured error on Create.
type failingStore struct {
	err error
}

func (s *failingStore) FindBySub(_ context.Context, _ string) (*identity.User, error) {
	return nil, identity.ErrNotFound
}

func (s *failingStore) Create(_ context.Context, _ *identity.User) error {
	return s.err
}

func (s *failingStore) UpdateLastLogin(_ context.Context, _ string) error {
	return nil
}

func (s *failingStore) UpdateEmail(_ context.Context, _, _ string) error {
	return nil
}

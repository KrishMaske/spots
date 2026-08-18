package profile_test

import (
	"context"
	"errors"
	"testing"

	"github.com/krishm/spots/backend/golang/services/profile"
)

func TestService_Get_NoProfile_ReturnsStub(t *testing.T) {
	t.Parallel()

	svc := profile.NewService(profile.NewMemStore())
	p, err := svc.Get(context.Background(), "user-123")
	if err != nil {
		t.Fatalf("Get with no profile: %v", err)
	}
	if p == nil {
		t.Fatal("expected non-nil stub profile, got nil")
	}
	if p.UserID != "user-123" {
		t.Errorf("stub UserID: got %q, want user-123", p.UserID)
	}
	// Stub fields should be zero-value strings, not error state.
	if p.DisplayName != "" || p.AvatarURL != "" || p.HomeBase != "" {
		t.Error("stub profile should have zero-value string fields")
	}
}

func TestService_UpsertAndGet(t *testing.T) {
	t.Parallel()

	store := profile.NewMemStore()
	svc := profile.NewService(store)

	p := &profile.Profile{
		UserID:      "user-456",
		DisplayName: "Alice",
		AvatarURL:   "https://example.com/avatar.jpg",
		HomeBase:    "London",
	}

	if err := svc.Upsert(context.Background(), p); err != nil {
		t.Fatalf("Upsert: %v", err)
	}

	got, err := svc.Get(context.Background(), "user-456")
	if err != nil {
		t.Fatalf("Get after Upsert: %v", err)
	}
	if got.DisplayName != "Alice" {
		t.Errorf("DisplayName: got %q, want Alice", got.DisplayName)
	}
	if got.HomeBase != "London" {
		t.Errorf("HomeBase: got %q, want London", got.HomeBase)
	}
}

func TestMemStore_FindByUserID_NotFound(t *testing.T) {
	t.Parallel()

	store := profile.NewMemStore()
	_, err := store.FindByUserID(context.Background(), "non-existent")
	if !errors.Is(err, profile.ErrNotFound) {
		t.Errorf("expected ErrNotFound, got %v", err)
	}
}

func TestMemStore_CreateOrUpdate_Overwrites(t *testing.T) {
	t.Parallel()

	store := profile.NewMemStore()
	ctx := context.Background()

	original := &profile.Profile{UserID: "u1", DisplayName: "Bob"}
	if err := store.CreateOrUpdate(ctx, original); err != nil {
		t.Fatalf("first upsert: %v", err)
	}

	updated := &profile.Profile{UserID: "u1", DisplayName: "Robert"}
	if err := store.CreateOrUpdate(ctx, updated); err != nil {
		t.Fatalf("second upsert: %v", err)
	}

	got, err := store.FindByUserID(ctx, "u1")
	if err != nil {
		t.Fatalf("find: %v", err)
	}
	if got.DisplayName != "Robert" {
		t.Errorf("DisplayName after update: got %q, want Robert", got.DisplayName)
	}
}

func TestMemStore_IsolatesCallerMutations(t *testing.T) {
	t.Parallel()

	store := profile.NewMemStore()
	ctx := context.Background()

	p := &profile.Profile{UserID: "u2", DisplayName: "Charlie"}
	if err := store.CreateOrUpdate(ctx, p); err != nil {
		t.Fatalf("upsert: %v", err)
	}

	got, _ := store.FindByUserID(ctx, "u2")
	got.DisplayName = "Mutated" // mutate the returned copy

	// Store's internal copy should not be affected.
	got2, _ := store.FindByUserID(ctx, "u2")
	if got2.DisplayName != "Charlie" {
		t.Errorf("store was mutated by caller: got %q, want Charlie", got2.DisplayName)
	}
}

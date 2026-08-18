// Package profile manages Spots-owned user profile data (display name, avatar,
// home base, travel preferences, etc.). This data is entirely separate from
// the identity mapping (see backend/golang/services/identity) and from Cognito.
//
// Cognito owns: credentials, email verification, session lifecycle.
// Identity service owns: Cognito-sub → Spots-user-ID mapping.
// This service owns: everything a user can configure about themselves in Spots.
//
// NOTE: The final DB schema (profiles, preferences, travel_history tables) is
// for Krish to design. ProfileStore is the interface the DB adapter must satisfy.
// MemStore is the only implementation until the DB layer is wired; it is NOT
// safe for production use.
package profile

import (
	"context"
	"errors"
	"sync"
)

// ErrNotFound is returned by ProfileStore when no profile exists for the given user.
var ErrNotFound = errors.New("profile: not found")

// Profile holds Spots-owned display and preference data for a user.
// Fields are intentionally minimal for v1; richer preference data (taste tags,
// accessibility, pgvector embeddings) is added when the reco service is wired.
//
// NOTE: Schema ownership: Krish will design the final Postgres columns,
// indexes, and normalization. This struct reflects the minimum the routes layer
// needs for GET /v1/users/me.
type Profile struct {
	// UserID is the Spots-internal user ID (matches identity.User.ID).
	UserID string

	// DisplayName is the user's chosen display name.
	DisplayName string

	// AvatarURL is the URL of the user's avatar image.
	AvatarURL string

	// HomeBase is a free-text home city/region.
	HomeBase string
}

// ProfileStore is the minimal persistence interface for profile data.
// The production implementation will use Postgres.
type ProfileStore interface {
	// FindByUserID returns the profile for userID, or ErrNotFound.
	FindByUserID(ctx context.Context, userID string) (*Profile, error)

	// CreateOrUpdate upserts the given profile.
	CreateOrUpdate(ctx context.Context, p *Profile) error
}

// Service provides profile operations for the routes layer.
type Service struct {
	store ProfileStore
}

// NewService constructs a Service backed by store.
func NewService(store ProfileStore) *Service {
	return &Service{store: store}
}

// Get returns the profile for userID. If no profile exists yet it returns a
// zero-value stub so the caller always gets a well-formed response.
func (s *Service) Get(ctx context.Context, userID string) (*Profile, error) {
	p, err := s.store.FindByUserID(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		// Lazy-bootstrap: return a stub profile for users who haven't set one up.
		return &Profile{UserID: userID}, nil
	}
	return p, err
}

// Upsert creates or updates the profile for userID.
func (s *Service) Upsert(ctx context.Context, p *Profile) error {
	return s.store.CreateOrUpdate(ctx, p)
}

// MemStore is an in-memory ProfileStore for tests and dev runs.
// Not safe for production use.
type MemStore struct {
	mu   sync.RWMutex
	data map[string]*Profile
}

// NewMemStore returns an empty MemStore.
func NewMemStore() *MemStore {
	return &MemStore{data: make(map[string]*Profile)}
}

// FindByUserID looks up the profile by user ID.
func (s *MemStore) FindByUserID(_ context.Context, userID string) (*Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.data[userID]
	if !ok {
		return nil, ErrNotFound
	}
	cp := *p
	return &cp, nil
}

// CreateOrUpdate upserts the profile.
func (s *MemStore) CreateOrUpdate(_ context.Context, p *Profile) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := *p
	s.data[p.UserID] = &cp
	return nil
}

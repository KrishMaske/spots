package identity

import (
	"context"
	"errors"
	"sync"
	"time"
)

// ErrNotFound is returned by UserStore when a user record does not exist.
var ErrNotFound = errors.New("identity: user not found")

// UserStore is the persistence interface for Spots identity records.
// The production implementation will use Postgres; MemStore is provided
// for unit tests and early development without a live database.
//
// NOTE: The DB schema (table name, column types, indexes) is for Krish to
// design and migrate. This interface defines only what the service layer
// needs at the application boundary. Prefer adding methods here when the
// feature requires it, not speculatively.
type UserStore interface {
	// FindBySub returns the Spots user whose CognitoSub matches sub,
	// or ErrNotFound if no such record exists.
	FindBySub(ctx context.Context, sub string) (*User, error)

	// Create persists a new user record. The caller is responsible for
	// setting all fields including ID and CreatedAt.
	Create(ctx context.Context, user *User) error

	// UpdateLastLogin sets LastLoginAt to the current time for the given user.
	// Returns ErrNotFound if the user does not exist.
	UpdateLastLogin(ctx context.Context, userID string) error

	// UpdateEmail sets the Email field for the given user ID.
	// Used to backfill email on rows created before login-time enrichment was
	// wired, and to self-correct rows created via non-login token paths.
	// Returns ErrNotFound if the user does not exist.
	UpdateEmail(ctx context.Context, userID, email string) error
}

// MemStore is an in-memory UserStore for tests and dev-mode runs.
// It is NOT safe for production use: no persistence, no ACID guarantees.
type MemStore struct {
	mu    sync.RWMutex
	byID  map[string]*User
	bySub map[string]*User
}

// NewMemStore returns an empty MemStore.
func NewMemStore() *MemStore {
	return &MemStore{
		byID:  make(map[string]*User),
		bySub: make(map[string]*User),
	}
}

// FindBySub looks up a user by Cognito subject. Returns ErrNotFound if absent.
func (s *MemStore) FindBySub(_ context.Context, sub string) (*User, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	u, ok := s.bySub[sub]
	if !ok {
		return nil, ErrNotFound
	}
	// Return a copy so callers cannot mutate the store's internal record.
	cp := *u
	return &cp, nil
}

// Create stores a new user. Overwrites silently if a record with the same
// ID or sub already exists (MemStore is for tests; real store uses UPSERT/INSERT).
func (s *MemStore) Create(_ context.Context, user *User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := *user
	s.byID[cp.ID] = &cp
	s.bySub[cp.CognitoSub] = &cp
	return nil
}

// UpdateLastLogin sets LastLoginAt for the given user ID.
func (s *MemStore) UpdateLastLogin(_ context.Context, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.byID[userID]
	if !ok {
		return ErrNotFound
	}
	u.LastLoginAt = time.Now()
	// Keep the bySub index consistent.
	if sub := u.CognitoSub; sub != "" {
		s.bySub[sub] = u
	}
	return nil
}

// UpdateEmail sets the Email field for the given user ID.
func (s *MemStore) UpdateEmail(_ context.Context, userID, email string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.byID[userID]
	if !ok {
		return ErrNotFound
	}
	u.Email = email
	// Keep the bySub index consistent.
	if sub := u.CognitoSub; sub != "" {
		s.bySub[sub] = u
	}
	return nil
}

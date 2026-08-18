package identity

import "time"

// User is a Spots identity record: the minimal mapping between a Cognito
// identity (cognito_sub) and a Spots-internal user ID. Rich preference and
// profile data lives in the profile service, not here.
//
// NOTE: The final DB schema for the users table is for Krish to design.
// See UserStore in store.go for the interface the persistence layer must
// satisfy. The in-memory MemStore is the only implementation until the DB
// layer is wired.
type User struct {
	// ID is the Spots-internal user identifier (UUID v4).
	ID string

	// CognitoSub is the Cognito subject claim ("sub"), unique per user pool.
	// This is the stable, non-reassignable external identifier for the user.
	CognitoSub string

	// Email is a normalized copy of the user's email, mirrored from Cognito
	// claims for display and quick lookups.
	// Cognito is the authoritative source; this field should be kept in sync
	// on login but never treated as the identity key (use CognitoSub for that).
	Email string

	// Status is the Spots-side account state.
	// Valid values: "active", "disabled", "deleted".
	Status string

	// CreatedAt is when the Spots user row was first created (first login).
	CreatedAt time.Time

	// LastLoginAt is updated on each successful authentication.
	LastLoginAt time.Time
}

// Claims holds the verified fields extracted from a Cognito JWT.
// Only fields the edge auth layer actually needs are surfaced here; callers
// must not depend on Cognito-specific claim names beyond this struct.
type Claims struct {
	// Subject is the provider's unique, stable user identifier ("sub").
	Subject string

	// Email is the user's email address from the token, if present.
	// May be empty for access tokens that do not include email.
	Email string

	// Issuer is the token issuer URL ("iss"), e.g.
	// https://cognito-idp.us-east-1.amazonaws.com/<userPoolId>.
	Issuer string

	// TokenUse is the Cognito token type. The verifier only accepts "access".
	TokenUse string
}

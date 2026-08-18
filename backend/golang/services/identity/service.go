// Package identity manages user accounts and authentication for Spots.
//
// Division of responsibility:
//
//   - Cognito owns credential storage, password hashing, email verification,
//     token issuance, JWKS, and token signing keys.
//   - This package owns: JWKS-based token verification (TokenVerifier /
//     CognitoTokenVerifier), mapping of the Cognito subject claim to a Spots
//     user row (Authenticator / CognitoAuthenticator), and the UserStore
//     persistence interface for that mapping table.
//   - The profile service (backend/golang/services/profile) owns display
//     name, avatar, preferences, and travel-history data.
//
// The Authenticator interface is kept provider-agnostic so the Cognito
// implementation can be replaced later without rewriting route handlers.
package identity

package config

// Build-time metadata injected via -ldflags. Defaults are used when building
// from source without explicit flags.

// Version is the application version string. Override with:
//
//	go build -ldflags "-X github.com/krishm/spots/backend/golang/config.Version=v1.2.3"
var Version = "dev"

// Commit is the git commit SHA. Override with:
//
//	go build -ldflags "-X github.com/krishm/spots/backend/golang/config.Commit=<sha>"
var Commit = "none"

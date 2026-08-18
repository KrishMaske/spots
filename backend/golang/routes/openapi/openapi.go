// Package openapi serves the spotsd OpenAPI spec and a combined Swagger UI
// page that lists both the Go service and the Python reco service, so all
// backend endpoints can be browsed and exercised from one place.
package openapi

import (
	_ "embed"
	"net/http"
)

// spec is the hand-authored OpenAPI document for the Go service, embedded at
// build time. As Go routes are added, update openapi.json alongside them.
//
//go:embed openapi.json
var spec []byte

// SpecHandler serves the Go OpenAPI document as application/json.
func SpecHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	// Allow the spec to be fetched cross-origin (e.g. from the Python /docs
	// page) — it is public, non-sensitive API metadata.
	w.Header().Set("Access-Control-Allow-Origin", "*")
	_, _ = w.Write(spec)
}

// recoSpecURL is the Python reco service's OpenAPI document. FastAPI serves it
// automatically at /openapi.json. Kept here so the combined page lists both.
const recoSpecURL = "http://localhost:8081/openapi.json"

// docsHTML is the combined Swagger UI page. It uses Swagger UI's `urls`
// dropdown so both specs are selectable from one page. Assets are loaded from
// a CDN (requires internet to view the page).
const docsHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Spots — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        urls: [
          { url: "/openapi.json", name: "Spots API (Go)" },
          { url: "` + recoSpecURL + `", name: "Spots Reco (Python)" }
        ],
        "urls.primaryName": "Spots API (Go)",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
      });
    };
  </script>
</body>
</html>`

// DocsHandler serves the combined Swagger UI page.
func DocsHandler(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write([]byte(docsHTML))
}

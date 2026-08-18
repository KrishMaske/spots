"""Environment-based settings for the reco service.

Uses stdlib os.environ only — no third-party settings dependency yet.
A richer settings loader (pydantic-settings) can replace this later without
changing import sites.
"""

from __future__ import annotations

import os

APP_NAME = "spots-reco"
VERSION = "0.1.0"

# Informational: the reco process reads this when launched directly via
# `python main.py`. Exposed here so other modules can read it.
RECO_PORT = int(os.environ.get("RECO_PORT", "8081"))

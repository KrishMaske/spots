-- 01-extensions.sql
-- Runs once, on first cluster initialisation (empty data dir).
-- To re-run after a schema change: task backend:nuke && task backend:up

CREATE EXTENSION IF NOT EXISTS vector;

-- Database-per-service (DEFERRED).
-- When a service first needs its own tables, create its database here, e.g.:
--   CREATE DATABASE identity;
--   CREATE DATABASE trip;
--   CREATE DATABASE feed;
--   CREATE DATABASE collab;
--   CREATE DATABASE media;
--   CREATE DATABASE playlist;
-- Then enable pgvector inside each that needs it:
--   \c trip
--   CREATE EXTENSION IF NOT EXISTS vector;
-- Left commented until a service actually owns tables — no speculative schema.

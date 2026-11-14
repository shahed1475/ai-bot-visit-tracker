-- Pre-release rebuild: visits become per-site, sites belong to users.
-- Safe because no production data existed before this migration (verified by owner/deploy log).
DROP TABLE IF EXISTS visit_hourly;
DROP TABLE IF EXISTS visits;

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, hostname)
);

CREATE TABLE visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  ip TEXT,
  bot_id TEXT NOT NULL,
  bot_name TEXT NOT NULL,
  operator TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ai','search','social','other')),
  purpose TEXT NOT NULL CHECK (purpose IN ('training','indexing','retrieval','unknown')),
  verified TEXT NOT NULL DEFAULT 'unknown' CHECK (verified IN ('verified','unverified','unknown')),
  path TEXT NOT NULL,
  method TEXT,
  status INTEGER,
  ua TEXT,
  referer TEXT,
  country TEXT,
  asn INTEGER,
  as_org TEXT,
  source TEXT NOT NULL DEFAULT 'ingest'
);
CREATE INDEX idx_visits_site_ts ON visits(site_id, ts);
CREATE INDEX idx_visits_ts ON visits(ts);

CREATE TABLE visit_hourly (
  hour INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  bot_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  purpose TEXT NOT NULL,
  verified TEXT NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (hour, site_id, bot_id, purpose, verified)
) WITHOUT ROWID;

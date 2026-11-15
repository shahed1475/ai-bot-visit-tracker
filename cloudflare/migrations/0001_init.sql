-- Raw bot visits. ts = unix seconds (UTC). Only two indexes: every index costs a D1 row write.
CREATE TABLE visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  site TEXT NOT NULL,
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
CREATE INDEX idx_visits_ts ON visits(ts);
CREATE INDEX idx_visits_bot_ts ON visits(bot_id, ts);

-- Hourly rollup the dashboard reads (cheap, bounded). hour = unix seconds floored to the hour.
CREATE TABLE visit_hourly (
  hour INTEGER NOT NULL,
  site TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  purpose TEXT NOT NULL,
  verified TEXT NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (hour, site, bot_id, purpose, verified)
) WITHOUT ROWID;

-- Vendor-published crawler IP ranges, refreshed daily by cron.
CREATE TABLE ip_ranges (
  bot_id TEXT NOT NULL,
  cidr TEXT NOT NULL,
  PRIMARY KEY (bot_id, cidr)
) WITHOUT ROWID;

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

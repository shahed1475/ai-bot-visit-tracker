-- API keys: many named keys per site (kind 'ingest') plus read-only keys (kind 'read') for /api/v1.
-- sites stops carrying its single built-in key; each existing key becomes that site's "Default" ingest key,
-- so no deployed key stops working. Order matters: nothing may reference the old `sites` table when it is dropped.
CREATE TABLE sites_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, hostname)
);
INSERT INTO sites_new (id, user_id, hostname, created_at) SELECT id, user_id, hostname, created_at FROM sites;

-- Visits and rollups whose site no longer exists (left behind by an interrupted delete) belong to nobody. The rebuilt
-- table only remembers the highest id still in use, so such an id could be handed to a brand-new site, which would then
-- inherit another account's orphaned data. Remove them now.
DELETE FROM visits WHERE site_id NOT IN (SELECT id FROM sites_new);
DELETE FROM visit_hourly WHERE site_id NOT IN (SELECT id FROM sites_new);

CREATE TABLE api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Ingest keys always belong to one site. A read key with NULL site_id sees all of its owner's sites.
  site_id INTEGER REFERENCES sites_new(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ingest','read')),
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  -- The key created with the site and replaced by "Rotate key". At most one per site.
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  CHECK (kind = 'read' OR site_id IS NOT NULL)
);
INSERT INTO api_keys (user_id, site_id, name, kind, key_hash, key_prefix, is_default, created_at)
  SELECT user_id, id, 'Default', 'ingest', key_hash, key_prefix, 1, created_at FROM sites ORDER BY id;
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_site ON api_keys(site_id);
CREATE UNIQUE INDEX idx_api_keys_default ON api_keys(site_id) WHERE is_default = 1;

DROP TABLE sites;
ALTER TABLE sites_new RENAME TO sites;

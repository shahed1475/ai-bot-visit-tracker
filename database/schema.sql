-- AI Bot Visit Tracker: local SQLite schema (Node). The Cloudflare tracker has its own D1 schema in cloudflare/migrations.
CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address VARCHAR(45),
    bot_id VARCHAR(60),
    bot_name VARCHAR(100),
    bot_kind VARCHAR(10),
    page_url TEXT NOT NULL,
    headers TEXT,
    classification VARCHAR(20) DEFAULT 'unknown' CHECK (classification IN ('training', 'indexing', 'retrieval', 'unknown')),
    verified VARCHAR(12) DEFAULT 'unknown' CHECK (verified IN ('verified', 'unverified', 'unknown')),
    user_agent TEXT,
    referer TEXT,
    request_method VARCHAR(10) DEFAULT 'GET',
    response_status INTEGER,
    processing_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp);
CREATE INDEX IF NOT EXISTS idx_visits_bot_name ON visits(bot_name);
CREATE INDEX IF NOT EXISTS idx_visits_classification ON visits(classification);

CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO config (key, value, description) VALUES
('db_version', '2.0', 'Database schema version'),
('retention_days', '90', 'Number of days to retain visit logs');

CREATE VIEW IF NOT EXISTS recent_bot_activity AS
SELECT timestamp, bot_name, ip_address, page_url, classification, verified, user_agent
FROM visits WHERE timestamp >= datetime('now', '-7 days') ORDER BY timestamp DESC;

CREATE VIEW IF NOT EXISTS classification_summary AS
SELECT bot_name, classification, COUNT(*) AS count, MIN(timestamp) AS first_seen, MAX(timestamp) AS last_seen
FROM visits WHERE bot_name IS NOT NULL GROUP BY bot_name, classification ORDER BY bot_name, classification;

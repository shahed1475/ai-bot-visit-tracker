-- AI Bot Visit Tracking Database Schema
-- SQLite version with PostgreSQL compatibility comments

-- Main visits table to store all bot visit logs
CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Use SERIAL for PostgreSQL
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address VARCHAR(45) NOT NULL,  -- Supports both IPv4 and IPv6
    bot_name VARCHAR(100),
    page_url TEXT NOT NULL,
    headers TEXT,  -- JSON string of request headers
    classification VARCHAR(20) DEFAULT 'unknown' CHECK (classification IN ('indexing', 'retrieval', 'unknown')),
    user_agent TEXT,
    referer TEXT,
    request_method VARCHAR(10) DEFAULT 'GET',
    response_status INTEGER,
    processing_time_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance optimization
CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp);
CREATE INDEX IF NOT EXISTS idx_visits_bot_name ON visits(bot_name);
CREATE INDEX IF NOT EXISTS idx_visits_ip_address ON visits(ip_address);
CREATE INDEX IF NOT EXISTS idx_visits_classification ON visits(classification);
CREATE INDEX IF NOT EXISTS idx_visits_page_url ON visits(page_url);

-- Bot statistics summary table (optional, for performance)
CREATE TABLE IF NOT EXISTS bot_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_name VARCHAR(100) NOT NULL,
    total_visits INTEGER DEFAULT 0,
    indexing_visits INTEGER DEFAULT 0,
    retrieval_visits INTEGER DEFAULT 0,
    last_visit DATETIME,
    first_visit DATETIME,
    unique_pages INTEGER DEFAULT 0,
    unique_ips INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bot_name)
);

-- Trigger to update bot statistics (SQLite version)
CREATE TRIGGER IF NOT EXISTS update_bot_stats_after_insert
AFTER INSERT ON visits
BEGIN
    INSERT OR REPLACE INTO bot_stats (
        bot_name, 
        total_visits, 
        indexing_visits, 
        retrieval_visits,
        last_visit,
        first_visit,
        updated_at
    )
    VALUES (
        NEW.bot_name,
        COALESCE((SELECT total_visits FROM bot_stats WHERE bot_name = NEW.bot_name), 0) + 1,
        COALESCE((SELECT indexing_visits FROM bot_stats WHERE bot_name = NEW.bot_name), 0) + 
            CASE WHEN NEW.classification = 'indexing' THEN 1 ELSE 0 END,
        COALESCE((SELECT retrieval_visits FROM bot_stats WHERE bot_name = NEW.bot_name), 0) + 
            CASE WHEN NEW.classification = 'retrieval' THEN 1 ELSE 0 END,
        NEW.timestamp,
        COALESCE((SELECT first_visit FROM bot_stats WHERE bot_name = NEW.bot_name), NEW.timestamp),
        CURRENT_TIMESTAMP
    );
END;

-- Configuration table for system settings
CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default configuration values
INSERT OR IGNORE INTO config (key, value, description) VALUES
('db_version', '1.0', 'Database schema version'),
('classification_enabled', 'true', 'Enable automatic request classification'),
('ip_logging_enabled', 'true', 'Enable IP address logging'),
('header_logging_enabled', 'true', 'Enable request header logging'),
('retention_days', '365', 'Number of days to retain visit logs');

-- View for easy querying of recent bot activity
CREATE VIEW IF NOT EXISTS recent_bot_activity AS
SELECT 
    v.timestamp,
    v.bot_name,
    v.ip_address,
    v.page_url,
    v.classification,
    v.user_agent
FROM visits v
WHERE v.timestamp >= datetime('now', '-7 days')
ORDER BY v.timestamp DESC;

-- View for bot classification summary
CREATE VIEW IF NOT EXISTS classification_summary AS
SELECT 
    bot_name,
    classification,
    COUNT(*) as count,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_seen
FROM visits
WHERE bot_name IS NOT NULL
GROUP BY bot_name, classification
ORDER BY bot_name, classification;
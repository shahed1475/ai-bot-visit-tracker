<?php

namespace AiBotTracker;

use PDO;
use PDOException;

/**
 * DatabaseManager - Handles database operations for bot visit tracking
 */
class DatabaseManager
{
    /**
     * @var PDO Database connection
     */
    private $pdo;

    /**
     * @var array Database configuration
     */
    private $config;

    /**
     * @var bool Whether database is initialized
     */
    private $initialized = false;

    /**
     * Constructor
     * 
     * @param array $config Database configuration
     */
    public function __construct(array $config = [])
    {
        $this->config = array_merge([
            'type' => 'sqlite',
            'host' => 'localhost',
            'port' => null,
            'database' => 'ai_bot_tracker.db',
            'username' => '',
            'password' => '',
            'charset' => 'utf8mb4',
            'options' => [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        ], $config);
    }

    /**
     * Connect to database
     * 
     * @throws PDOException If connection fails
     */
    public function connect(): void
    {
        if ($this->pdo !== null) {
            return;
        }

        try {
            $dsn = $this->buildDsn();
            $this->pdo = new PDO(
                $dsn,
                $this->config['username'],
                $this->config['password'],
                $this->config['options']
            );
        } catch (PDOException $e) {
            throw new PDOException("Database connection failed: " . $e->getMessage());
        }
    }

    /**
     * Build DSN string
     * 
     * @return string DSN string
     */
    private function buildDsn(): string
    {
        switch ($this->config['type']) {
            case 'sqlite':
                return "sqlite:" . $this->config['database'];
            
            case 'mysql':
                $dsn = "mysql:host={$this->config['host']};dbname={$this->config['database']};charset={$this->config['charset']}";
                if ($this->config['port']) {
                    $dsn .= ";port={$this->config['port']}";
                }
                return $dsn;
            
            case 'postgresql':
                $dsn = "pgsql:host={$this->config['host']};dbname={$this->config['database']}";
                if ($this->config['port']) {
                    $dsn .= ";port={$this->config['port']}";
                }
                return $dsn;
            
            default:
                throw new \InvalidArgumentException("Unsupported database type: {$this->config['type']}");
        }
    }

    /**
     * Initialize database schema
     * 
     * @throws PDOException If initialization fails
     */
    public function initializeSchema(): void
    {
        if ($this->initialized) {
            return;
        }

        $this->connect();

        try {
            $this->pdo->beginTransaction();

            // Create visits table
            $this->createVisitsTable();

            // Create bot_stats table
            $this->createBotStatsTable();

            // Create config table
            $this->createConfigTable();

            // Create indexes
            $this->createIndexes();

            // Create triggers (for SQLite)
            if ($this->config['type'] === 'sqlite') {
                $this->createTriggers();
            }

            $this->pdo->commit();
            $this->initialized = true;
        } catch (PDOException $e) {
            $this->pdo->rollBack();
            throw new PDOException("Schema initialization failed: " . $e->getMessage());
        }
    }

    /**
     * Create visits table
     */
    private function createVisitsTable(): void
    {
        $sql = "CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY " . ($this->config['type'] === 'sqlite' ? 'AUTOINCREMENT' : 'AUTO_INCREMENT') . ",
            timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(45) NOT NULL,
            bot_name VARCHAR(100) NOT NULL,
            page_url TEXT NOT NULL,
            headers TEXT,
            classification VARCHAR(20) NOT NULL DEFAULT 'indexing',
            user_agent TEXT,
            referer TEXT,
            request_method VARCHAR(10) NOT NULL DEFAULT 'GET',
            response_status INTEGER,
            response_time REAL,
            confidence REAL DEFAULT 0.5,
            detection_method VARCHAR(20),
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )";

        $this->pdo->exec($sql);
    }

    /**
     * Create bot_stats table
     */
    private function createBotStatsTable(): void
    {
        $sql = "CREATE TABLE IF NOT EXISTS bot_stats (
            id INTEGER PRIMARY KEY " . ($this->config['type'] === 'sqlite' ? 'AUTOINCREMENT' : 'AUTO_INCREMENT') . ",
            date DATE NOT NULL,
            bot_name VARCHAR(100) NOT NULL,
            total_visits INTEGER NOT NULL DEFAULT 0,
            indexing_visits INTEGER NOT NULL DEFAULT 0,
            retrieval_visits INTEGER NOT NULL DEFAULT 0,
            unique_ips INTEGER NOT NULL DEFAULT 0,
            unique_pages INTEGER NOT NULL DEFAULT 0,
            avg_response_time REAL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(date, bot_name)
        )";

        $this->pdo->exec($sql);
    }

    /**
     * Create config table
     */
    private function createConfigTable(): void
    {
        $sql = "CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY " . ($this->config['type'] === 'sqlite' ? 'AUTOINCREMENT' : 'AUTO_INCREMENT') . ",
            key_name VARCHAR(100) NOT NULL UNIQUE,
            key_value TEXT,
            description TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )";

        $this->pdo->exec($sql);
    }

    /**
     * Create database indexes
     */
    private function createIndexes(): void
    {
        $indexes = [
            "CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp)",
            "CREATE INDEX IF NOT EXISTS idx_visits_bot_name ON visits(bot_name)",
            "CREATE INDEX IF NOT EXISTS idx_visits_classification ON visits(classification)",
            "CREATE INDEX IF NOT EXISTS idx_visits_ip_address ON visits(ip_address)",
            "CREATE INDEX IF NOT EXISTS idx_bot_stats_date ON bot_stats(date)",
            "CREATE INDEX IF NOT EXISTS idx_bot_stats_bot_name ON bot_stats(bot_name)",
            "CREATE INDEX IF NOT EXISTS idx_config_key_name ON config(key_name)"
        ];

        foreach ($indexes as $sql) {
            $this->pdo->exec($sql);
        }
    }

    /**
     * Create triggers for SQLite
     */
    private function createTriggers(): void
    {
        // Trigger to update bot_stats when a visit is inserted
        $sql = "CREATE TRIGGER IF NOT EXISTS update_bot_stats_on_insert
                AFTER INSERT ON visits
                BEGIN
                    INSERT OR REPLACE INTO bot_stats (
                        date, bot_name, total_visits, indexing_visits, retrieval_visits,
                        unique_ips, unique_pages, avg_response_time, updated_at
                    )
                    SELECT 
                        DATE(NEW.timestamp) as date,
                        NEW.bot_name,
                        COUNT(*) as total_visits,
                        SUM(CASE WHEN classification = 'indexing' THEN 1 ELSE 0 END) as indexing_visits,
                        SUM(CASE WHEN classification = 'retrieval' THEN 1 ELSE 0 END) as retrieval_visits,
                        COUNT(DISTINCT ip_address) as unique_ips,
                        COUNT(DISTINCT page_url) as unique_pages,
                        AVG(response_time) as avg_response_time,
                        CURRENT_TIMESTAMP
                    FROM visits 
                    WHERE DATE(timestamp) = DATE(NEW.timestamp) 
                    AND bot_name = NEW.bot_name;
                END";

        $this->pdo->exec($sql);
    }

    /**
     * Log a bot visit
     * 
     * @param array $visitData Visit data
     * @return int Visit ID
     */
    public function logVisit(array $visitData): int
    {
        $this->connect();

        $sql = "INSERT INTO visits (
            timestamp, ip_address, bot_name, page_url, headers, classification,
            user_agent, referer, request_method, response_status, response_time,
            confidence, detection_method
        ) VALUES (
            :timestamp, :ip_address, :bot_name, :page_url, :headers, :classification,
            :user_agent, :referer, :request_method, :response_status, :response_time,
            :confidence, :detection_method
        )";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':timestamp' => $visitData['timestamp'] ?? date('Y-m-d H:i:s'),
            ':ip_address' => $visitData['ip_address'] ?? '',
            ':bot_name' => $visitData['bot_name'] ?? 'Unknown',
            ':page_url' => $visitData['page_url'] ?? '',
            ':headers' => is_array($visitData['headers'] ?? null) ? json_encode($visitData['headers']) : ($visitData['headers'] ?? ''),
            ':classification' => $visitData['classification'] ?? 'indexing',
            ':user_agent' => $visitData['user_agent'] ?? '',
            ':referer' => $visitData['referer'] ?? '',
            ':request_method' => $visitData['request_method'] ?? 'GET',
            ':response_status' => $visitData['response_status'] ?? null,
            ':response_time' => $visitData['response_time'] ?? null,
            ':confidence' => $visitData['confidence'] ?? 0.5,
            ':detection_method' => $visitData['detection_method'] ?? 'user_agent'
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    /**
     * Get visit statistics
     * 
     * @param string $timeRange Time range (24h, 7d, 30d, all)
     * @param string|null $botName Filter by bot name
     * @return array Statistics
     */
    public function getStats(string $timeRange = '24h', ?string $botName = null): array
    {
        $this->connect();

        $whereClause = $this->buildTimeWhereClause($timeRange);
        $params = [];

        if ($botName) {
            $whereClause .= " AND bot_name = :bot_name";
            $params[':bot_name'] = $botName;
        }

        // Total visits
        $sql = "SELECT COUNT(*) as total FROM visits WHERE {$whereClause}";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $total = $stmt->fetchColumn();

        // Classification breakdown
        $sql = "SELECT classification, COUNT(*) as count 
                FROM visits 
                WHERE {$whereClause} 
                GROUP BY classification";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $classifications = $stmt->fetchAll();

        // Bot breakdown
        $sql = "SELECT bot_name, COUNT(*) as count 
                FROM visits 
                WHERE {$whereClause} 
                GROUP BY bot_name 
                ORDER BY count DESC";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $bots = $stmt->fetchAll();

        // Top pages
        $sql = "SELECT page_url, COUNT(*) as count 
                FROM visits 
                WHERE {$whereClause} 
                GROUP BY page_url 
                ORDER BY count DESC 
                LIMIT 10";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $topPages = $stmt->fetchAll();

        return [
            'total_visits' => (int)$total,
            'time_range' => $timeRange,
            'bot_name_filter' => $botName,
            'classifications' => $classifications,
            'bots' => $bots,
            'top_pages' => $topPages,
            'generated_at' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Build time-based WHERE clause
     * 
     * @param string $timeRange Time range
     * @return string WHERE clause
     */
    private function buildTimeWhereClause(string $timeRange): string
    {
        switch ($timeRange) {
            case '24h':
                return "timestamp >= datetime('now', '-1 day')";
            case '7d':
                return "timestamp >= datetime('now', '-7 days')";
            case '30d':
                return "timestamp >= datetime('now', '-30 days')";
            case 'all':
            default:
                return "1=1";
        }
    }

    /**
     * Export visits to CSV
     * 
     * @param string $filePath Output file path
     * @param string $timeRange Time range
     * @param string|null $botName Filter by bot name
     * @param string|null $classification Filter by classification
     * @return int Number of exported records
     */
    public function exportToCsv(string $filePath, string $timeRange = '24h', ?string $botName = null, ?string $classification = null): int
    {
        $this->connect();

        $whereClause = $this->buildTimeWhereClause($timeRange);
        $params = [];

        if ($botName) {
            $whereClause .= " AND bot_name = :bot_name";
            $params[':bot_name'] = $botName;
        }

        if ($classification) {
            $whereClause .= " AND classification = :classification";
            $params[':classification'] = $classification;
        }

        $sql = "SELECT timestamp, ip_address, bot_name, page_url, classification,
                       user_agent, referer, request_method, response_status, response_time,
                       confidence, detection_method
                FROM visits 
                WHERE {$whereClause} 
                ORDER BY timestamp DESC";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $file = fopen($filePath, 'w');
        if (!$file) {
            throw new \RuntimeException("Cannot open file for writing: {$filePath}");
        }

        // Write CSV header
        fputcsv($file, [
            'timestamp', 'ip_address', 'bot_name', 'page_url', 'classification',
            'user_agent', 'referer', 'request_method', 'response_status', 'response_time',
            'confidence', 'detection_method'
        ]);

        $count = 0;
        while ($row = $stmt->fetch()) {
            fputcsv($file, $row);
            $count++;
        }

        fclose($file);
        return $count;
    }

    /**
     * Export visits to JSON
     * 
     * @param string $filePath Output file path
     * @param string $timeRange Time range
     * @param string|null $botName Filter by bot name
     * @param string|null $classification Filter by classification
     * @return int Number of exported records
     */
    public function exportToJson(string $filePath, string $timeRange = '24h', ?string $botName = null, ?string $classification = null): int
    {
        $this->connect();

        $whereClause = $this->buildTimeWhereClause($timeRange);
        $params = [];

        if ($botName) {
            $whereClause .= " AND bot_name = :bot_name";
            $params[':bot_name'] = $botName;
        }

        if ($classification) {
            $whereClause .= " AND classification = :classification";
            $params[':classification'] = $classification;
        }

        $sql = "SELECT * FROM visits WHERE {$whereClause} ORDER BY timestamp DESC";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $visits = $stmt->fetchAll();

        // Parse JSON headers
        foreach ($visits as &$visit) {
            if (!empty($visit['headers'])) {
                $visit['headers'] = json_decode($visit['headers'], true);
            }
        }

        $data = [
            'export_info' => [
                'generated_at' => date('Y-m-d H:i:s'),
                'time_range' => $timeRange,
                'bot_name_filter' => $botName,
                'classification_filter' => $classification,
                'total_records' => count($visits)
            ],
            'visits' => $visits
        ];

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (file_put_contents($filePath, $json) === false) {
            throw new \RuntimeException("Cannot write to file: {$filePath}");
        }

        return count($visits);
    }

    /**
     * Clean up old visits
     * 
     * @param int $daysToKeep Number of days to keep
     * @return int Number of deleted records
     */
    public function cleanupOldVisits(int $daysToKeep = 30): int
    {
        $this->connect();

        $sql = "DELETE FROM visits WHERE timestamp < datetime('now', '-{$daysToKeep} days')";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute();

        return $stmt->rowCount();
    }

    /**
     * Get or set configuration value
     * 
     * @param string $key Configuration key
     * @param mixed $value Configuration value (null to get)
     * @return mixed Configuration value
     */
    public function config(string $key, $value = null)
    {
        $this->connect();

        if ($value === null) {
            // Get configuration
            $sql = "SELECT key_value FROM config WHERE key_name = :key";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':key' => $key]);
            $result = $stmt->fetchColumn();
            
            return $result ? json_decode($result, true) : null;
        } else {
            // Set configuration
            $sql = "INSERT OR REPLACE INTO config (key_name, key_value, updated_at) 
                    VALUES (:key, :value, CURRENT_TIMESTAMP)";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                ':key' => $key,
                ':value' => json_encode($value)
            ]);
            
            return $value;
        }
    }

    /**
     * Close database connection
     */
    public function close(): void
    {
        $this->pdo = null;
    }

    /**
     * Get PDO instance
     * 
     * @return PDO PDO instance
     */
    public function getPdo(): PDO
    {
        $this->connect();
        return $this->pdo;
    }
}
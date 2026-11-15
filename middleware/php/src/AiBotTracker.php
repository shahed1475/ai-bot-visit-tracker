<?php

namespace AiBotTracker;

use AiBotTracker\BotDetector;
use AiBotTracker\RequestClassifier;
use AiBotTracker\DatabaseManager;
use AiBotTracker\Reporter;

/**
 * AiBotTracker - Main class for AI bot visit tracking
 */
class AiBotTracker
{
    /**
     * @var BotDetector Bot detection instance
     */
    private $botDetector;

    /**
     * @var RequestClassifier Request classification instance
     */
    private $requestClassifier;

    /**
     * @var DatabaseManager Database manager instance
     */
    private $databaseManager;

    /**
     * @var Reporter|null Sends bot visits to the Cloudflare tracker (config 'report')
     */
    private $reporter;

    /**
     * @var array Configuration
     */
    private $config;

    /**
     * @var bool Whether tracking is enabled
     */
    private $enabled = true;

    /**
     * @var float Request start time for response time calculation
     */
    private $requestStartTime;

    /**
     * @var int|null Response status code
     */
    private $responseStatus;

    /**
     * Constructor
     * 
     * @param array $config Configuration options
     */
    public function __construct(array $config = [])
    {
        // A deep merge: passing only some keys of a section (for example logging.enabled) keeps the defaults of the rest.
        $this->config = array_replace_recursive([
            // Database configuration. Use 'database' => false to only report to the tracker and store nothing locally.
            'database' => [
                'type' => 'sqlite',
                'database' => 'ai_bot_tracker.db'
            ],
            
            // Report visits to the Cloudflare tracker: ['endpoint' => 'https://...workers.dev', 'key' => 'abt_...', 'site' => 'example.com']
            'report' => null,

            // Bot detection configuration
            'bot_detection' => [
                'custom_patterns' => [],
                'ip_ranges' => [],          // bot id => CIDR list, enables verified/unverified
                'registry_path' => null,    // default: ../../../signatures/ai-bots.json or env AI_BOT_REGISTRY
                'trust_proxy_headers' => false,      // true: believe X-Forwarded-For & co (only behind your own proxy)
                'trust_cloudflare_headers' => false  // true: believe CF-Connecting-IP (only behind Cloudflare)
            ],
            
            // Classification configuration
            'classification' => [
                'indexing_patterns' => [],
                'retrieval_patterns' => [],
                'custom_rules' => []
            ],
            
            // Logging configuration
            'logging' => [
                'enabled' => true,
                'async' => false,
                'log_headers' => true,
                'log_response_time' => true
            ],
            
            // Performance configuration
            'performance' => [
                'cleanup_interval' => 86400, // 24 hours
                'max_visits_per_cleanup' => 10000,
                'days_to_keep' => 30
            ],
            
            // Feature flags
            'features' => [
                'statistics' => true,
                'export' => true,
                'cleanup' => true
            ]
        ], $config);

        $this->initialize();
    }

    /**
     * Initialize components
     */
    private function initialize(): void
    {
        // Initialize database manager (skipped in report-only mode)
        if (is_array($this->config['database'])) {
            $this->databaseManager = new DatabaseManager($this->config['database']);
            $this->databaseManager->initializeSchema();
        }

        // PHP builds this object on every request, so a mistake in the report settings (for example an unset environment
        // variable) must not take the page down: reporting is switched off and the mistake is logged as a warning.
        if (!empty($this->config['report'])) {
            try {
                $this->reporter = new Reporter($this->config['report']);
            } catch (\InvalidArgumentException $e) {
                trigger_error('AiBotTracker: reporting disabled: ' . $e->getMessage(), E_USER_WARNING);
            }
        }

        // Initialize bot detector
        $this->botDetector = new BotDetector(
            $this->config['bot_detection']['custom_patterns'] ?? [],
            $this->config['bot_detection']['ip_ranges'] ?? [],
            $this->config['bot_detection']['registry_path'] ?? null
        );

        // Initialize request classifier
        $this->requestClassifier = new RequestClassifier(
            $this->config['classification']['indexing_patterns'] ?? [],
            $this->config['classification']['retrieval_patterns'] ?? [],
            $this->config['classification']['custom_rules'] ?? []
        );

        // Initialize request start time (will be updated per request)
        $this->requestStartTime = microtime(true);
    }

    /**
     * Process incoming request
     * 
     * @param array $requestData Request data
     * @return array|null Bot information if detected, null otherwise
     */
    public function processRequest(array $requestData = []): ?array
    {
        if (!$this->enabled) {
            return null;
        }

        // Set request start time for response time calculation
        $this->requestStartTime = microtime(true);

        // Extract request data from globals if not provided
        if (empty($requestData)) {
            $requestData = $this->extractRequestData();
        }

        // Detect bot
        $botInfo = $this->botDetector->detectBot(
            $requestData['user_agent'] ?? '',
            $requestData['ip_address'] ?? ''
        );

        if (empty($botInfo['is_bot'])) {
            return null;
        }

        // Vendors declare why they crawl in the user agent; trust that over heuristics.
        if (in_array($botInfo['purpose'], ['training', 'indexing', 'retrieval'], true)) {
            $classification = ['type' => $botInfo['purpose'], 'confidence' => 0.95,
                'reasons' => ['Declared purpose of ' . $botInfo['bot_name']]];
        } else {
            $classification = $this->requestClassifier->classifyRequest(array_merge($requestData, ['bot_name' => $botInfo['bot_name']]));
        }

        // Prepare visit data
        $visitData = array_merge($requestData, [
            'bot_name' => $botInfo['bot_name'],
            'classification' => $classification['type'],
            'confidence' => $classification['confidence'],
            'detection_method' => $botInfo['detection_method'],
            'timestamp' => date('Y-m-d H:i:s')
        ]);

        // Report to the Cloudflare tracker (independent of local logging; sent after the response, never throws)
        if ($this->reporter) {
            $this->reportVisit($requestData);
        }

        // Log visit
        if ($this->config['logging']['enabled'] && $this->databaseManager) {
            if ($this->config['logging']['async']) {
                $this->logVisitAsync($visitData);
            } else {
                $this->logVisit($visitData);
            }
        }

        return array_merge($botInfo, [
            'classification' => $classification,
            'visit_data' => $visitData
        ]);
    }

    /** Queue the visit for the tracker: path and referer without query strings, no headers, no cookies. */
    private function reportVisit(array $requestData): void
    {
        try {
            $path = parse_url((string) ($requestData['url'] ?? '/'), PHP_URL_PATH);
            $event = [
                'ip' => (string) ($requestData['ip_address'] ?? ''),
                'ua' => (string) ($requestData['user_agent'] ?? ''),
                'path' => is_string($path) && $path !== '' ? $path : '/',
                'method' => (string) ($requestData['method'] ?? 'GET'),
            ];
            $referer = preg_split('/[?#]/', (string) ($requestData['referer'] ?? ''))[0];
            if ($referer !== '') {
                $event['referer'] = $referer;
            }
            $this->reporter->add($event);
        } catch (\Throwable $e) {
            // reporting must never break a page
        }
    }

    /** Send queued reports now. They are also sent automatically when the script ends. @return bool true if accepted */
    public function flushReports(): bool
    {
        return $this->reporter ? $this->reporter->flush() : true;
    }

    /**
     * Extract request data from PHP globals
     * 
     * @return array Request data
     */
    private function extractRequestData(): array
    {
        return [
            'ip_address' => $this->getClientIp(),
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'url' => $this->getCurrentUrl(),
            'referer' => $_SERVER['HTTP_REFERER'] ?? '',
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            'headers' => $this->config['logging']['log_headers'] ? $this->getAllHeaders() : [],
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    /**
     * Get client IP address
     * 
     * @return string Client IP address
     */
    private function getClientIp(): string
    {
        $headers = [
            'HTTP_CF_CONNECTING_IP',     // Cloudflare
            'HTTP_CLIENT_IP',            // Proxy
            'HTTP_X_FORWARDED_FOR',      // Load balancer/proxy
            'HTTP_X_FORWARDED',          // Proxy
            'HTTP_X_CLUSTER_CLIENT_IP',  // Cluster
            'HTTP_FORWARDED_FOR',        // Proxy
            'HTTP_FORWARDED',            // Proxy
            'REMOTE_ADDR'                // Standard
        ];

        // Forwarded headers are client-controlled unless they come from your own proxy: trust only when configured.
        $trust = $this->config['bot_detection'];
        if (!empty($trust['trust_proxy_headers'])) {
            $trusted = $headers;
        } elseif (!empty($trust['trust_cloudflare_headers'])) {
            $trusted = ['HTTP_CF_CONNECTING_IP', 'REMOTE_ADDR'];
        } else {
            $trusted = ['REMOTE_ADDR'];
        }
        $headers = $trusted;

        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ips = explode(',', $_SERVER[$header]);
                $ip = trim($ips[0]);
                
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }

        return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    }

    /**
     * Get current URL
     * 
     * @return string Current URL
     */
    private function getCurrentUrl(): string
    {
        $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $uri = $_SERVER['REQUEST_URI'] ?? '/';
        
        return $protocol . $host . $uri;
    }

    /**
     * Get all HTTP headers
     * 
     * @return array HTTP headers
     */
    private function getAllHeaders(): array
    {
        if (function_exists('getallheaders')) {
            return getallheaders();
        }

        $headers = [];
        foreach ($_SERVER as $key => $value) {
            if (strpos($key, 'HTTP_') === 0) {
                $header = str_replace('_', '-', substr($key, 5));
                $headers[$header] = $value;
            }
        }

        return $headers;
    }

    /**
     * Log visit to database
     * 
     * @param array $visitData Visit data
     * @return int Visit ID
     */
    public function logVisit(array $visitData): int
    {
        // Add response time if enabled
        if (($this->config['logging']['log_response_time'] ?? true)) {
            $visitData['response_time'] = microtime(true) - $this->requestStartTime;
        }

        return $this->databaseManager ? $this->databaseManager->logVisit($visitData) : 0;
    }

    /**
     * Log visit asynchronously (simplified version)
     * 
     * @param array $visitData Visit data
     */
    private function logVisitAsync(array $visitData): void
    {
        // In a real implementation, you might use a queue system
        // For now, we'll just log synchronously
        $this->logVisit($visitData);
    }

    /**
     * Set response status for current request
     * 
     * @param int $status HTTP status code
     */
    public function setResponseStatus(int $status): void
    {
        // This would be called after processing the request
        // Store for potential logging
        $this->responseStatus = $status;
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
        if (!$this->config['features']['statistics']) {
            throw new \RuntimeException('Statistics feature is disabled');
        }

        return $this->databaseManager ? $this->databaseManager->getStats($timeRange, $botName) : [];
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
        if (!$this->config['features']['export']) {
            throw new \RuntimeException('Export feature is disabled');
        }

        return $this->databaseManager ? $this->databaseManager->exportToCsv($filePath, $timeRange, $botName, $classification) : 0;
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
        if (!$this->config['features']['export']) {
            throw new \RuntimeException('Export feature is disabled');
        }

        return $this->databaseManager ? $this->databaseManager->exportToJson($filePath, $timeRange, $botName, $classification) : 0;
    }

    /**
     * Clean up old visits
     * 
     * @param int|null $daysToKeep Number of days to keep (null to use config)
     * @return int Number of deleted records
     */
    public function cleanup(?int $daysToKeep = null): int
    {
        if (!$this->config['features']['cleanup']) {
            throw new \RuntimeException('Cleanup feature is disabled');
        }

        $daysToKeep = $daysToKeep ?? $this->config['performance']['days_to_keep'];
        return $this->databaseManager ? $this->databaseManager->cleanupOldVisits($daysToKeep) : 0;
    }

    /**
     * Enable or disable tracking
     * 
     * @param bool $enabled Whether to enable tracking
     */
    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    /**
     * Check if tracking is enabled
     * 
     * @return bool Whether tracking is enabled
     */
    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    /**
     * Get configuration
     * 
     * @param string|null $key Configuration key (null for all)
     * @return mixed Configuration value
     */
    public function getConfig(?string $key = null)
    {
        if ($key === null) {
            return $this->config;
        }

        return $this->config[$key] ?? null;
    }

    /**
     * Update configuration
     * 
     * @param string $key Configuration key
     * @param mixed $value Configuration value
     */
    public function setConfig(string $key, $value): void
    {
        $this->config[$key] = $value;
    }

    /**
     * Get bot detector instance
     * 
     * @return BotDetector Bot detector instance
     */
    public function getBotDetector(): BotDetector
    {
        return $this->botDetector;
    }

    /**
     * Get request classifier instance
     * 
     * @return RequestClassifier Request classifier instance
     */
    public function getRequestClassifier(): RequestClassifier
    {
        return $this->requestClassifier;
    }

    /**
     * Get database manager instance
     * 
     * @return DatabaseManager|null Database manager instance (null in report-only mode)
     */
    public function getDatabaseManager(): ?DatabaseManager
    {
        return $this->databaseManager;
    }

    /**
     * Create middleware function for various PHP frameworks
     * 
     * @return callable Middleware function
     */
    public function createMiddleware(): callable
    {
        return function ($request = null, $response = null, $next = null) {
            // Process the request
            $botInfo = $this->processRequest();

            // Add bot information to request if detected
            if ($botInfo && $request && method_exists($request, 'withAttribute')) {
                $request = $request->withAttribute('bot_info', $botInfo);
            }

            // Call next middleware if available
            if ($next && is_callable($next)) {
                return $next($request, $response);
            }

            return $response;
        };
    }

    /**
     * Static factory method for quick setup
     * 
     * @param array $config Configuration
     * @return AiBotTracker Instance
     */
    public static function create(array $config = []): self
    {
        return new self($config);
    }

    /**
     * Destructor - cleanup resources
     */
    public function __destruct()
    {
        if ($this->databaseManager) {
            $this->databaseManager->close();
        }
    }
}
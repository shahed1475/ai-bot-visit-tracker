<?php

require_once __DIR__ . '/../vendor/autoload.php';

use AiBotTracker\AiBotTracker;

/**
 * Advanced Usage Example for AI Bot Tracker PHP Middleware
 * 
 * This example demonstrates advanced configuration and usage patterns
 * including custom bot patterns, database configurations, and integration
 * with various PHP frameworks.
 */

// Load environment variables
if (file_exists(__DIR__ . '/.env')) {
    $lines = file(__DIR__ . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos($line, '=') !== false && strpos($line, '#') !== 0) {
            list($key, $value) = explode('=', $line, 2);
            $_ENV[trim($key)] = trim($value);
        }
    }
}

// Advanced configuration
$config = [
    // Database configuration - PostgreSQL example
    'database' => [
        'type' => $_ENV['DB_TYPE'] ?? 'sqlite',
        'host' => $_ENV['DB_HOST'] ?? 'localhost',
        'port' => $_ENV['DB_PORT'] ?? 5432,
        'database' => $_ENV['DB_NAME'] ?? __DIR__ . '/ai_bot_tracker_advanced.db',
        'username' => $_ENV['DB_USER'] ?? '',
        'password' => $_ENV['DB_PASS'] ?? '',
        'charset' => 'utf8mb4',
        'options' => [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => true, // Use persistent connections
        ]
    ],
    
    // Custom bot detection patterns
    'bot_detection' => [
        'custom_patterns' => [
            'CustomBot' => '/CustomBot\/[\d\.]+/i',
            'MyAI' => '/MyAI-Crawler\/[\d\.]+/i',
            'DataMiner' => '/DataMiner|WebScraper/i',
        ],
        'custom_ip_ranges' => [
            '192.168.1.0/24',    // Local network
            '10.0.0.0/8',        // Private network
            '203.0.113.0/24',    // Example range
        ],
        'detection_methods' => ['user_agent', 'ip_range', 'behavior']
    ],
    
    // Advanced classification rules
    'classification' => [
        'indexing_patterns' => [
            'urls' => [
                '/\/sitemap\.xml$/i',
                '/\/robots\.txt$/i',
                '/\/feed\.xml$/i',
                '/\/rss\.xml$/i',
                '/\/api\/search/i',
            ],
            'headers' => [
                'Accept' => '/application\/xml|text\/xml/i',
            ],
            'user_agents' => [
                '/crawler|spider|indexer/i',
            ]
        ],
        'retrieval_patterns' => [
            'urls' => [
                '/\/api\/content/i',
                '/\/download/i',
                '/\/export/i',
            ],
            'headers' => [
                'Accept' => '/application\/json|text\/plain/i',
            ]
        ],
        'custom_rules' => [
            [
                'name' => 'High Frequency Requests',
                'condition' => function($data) {
                    // Custom logic for high-frequency detection
                    return isset($data['request_count']) && $data['request_count'] > 10;
                },
                'classification' => 'retrieval',
                'confidence' => 0.8
            ]
        ]
    ],
    
    // Logging configuration
    'logging' => [
        'enabled' => true,
        'async' => true,
        'log_headers' => true,
        'log_response_time' => true,
        'log_level' => 'info', // debug, info, warning, error
        'log_file' => __DIR__ . '/logs/bot_tracker.log'
    ],
    
    // Performance optimization
    'performance' => [
        'cleanup_interval' => 3600, // 1 hour
        'max_visits_per_cleanup' => 5000,
        'days_to_keep' => 90, // Keep data for 90 days
        'cache_enabled' => true,
        'cache_ttl' => 300 // 5 minutes
    ],
    
    // Feature flags
    'features' => [
        'statistics' => true,
        'export' => true,
        'cleanup' => true,
        'rate_limiting' => true,
        'geolocation' => false // Requires additional setup
    ],
    
    // Rate limiting (for retrieval bots)
    'rate_limiting' => [
        'enabled' => true,
        'max_requests_per_minute' => 60,
        'max_requests_per_hour' => 1000,
        'block_duration' => 3600 // 1 hour
    ]
];

// Initialize tracker with advanced configuration
$tracker = new AiBotTracker($config);

// Custom middleware for framework integration
class BotTrackingMiddleware
{
    private $tracker;
    
    public function __construct(AiBotTracker $tracker)
    {
        $this->tracker = $tracker;
    }
    
    public function handle($request, $next)
    {
        $startTime = microtime(true);
        
        // Extract request data
        $requestData = [
            'ip_address' => $this->getClientIp($request),
            'user_agent' => $request->headers['User-Agent'] ?? '',
            'url' => $request->getUri(),
            'referer' => $request->headers['Referer'] ?? '',
            'method' => $request->getMethod(),
            'headers' => $request->headers ?? []
        ];
        
        // Process request
        $botInfo = $this->tracker->processRequest($requestData);
        
        // Add bot info to request
        if ($botInfo) {
            $request->attributes['bot_info'] = $botInfo;
            
            // Apply rate limiting for retrieval bots
            if ($botInfo['classification']['type'] === 'retrieval') {
                $this->applyRateLimit($botInfo, $request);
            }
        }
        
        // Process response
        $response = $next($request);
        
        // Log response details
        if ($botInfo) {
            $this->tracker->setResponseStatus($response->getStatusCode());
        }
        
        return $response;
    }
    
    private function getClientIp($request)
    {
        $headers = [
            'CF-Connecting-IP',
            'Client-IP',
            'X-Forwarded-For',
            'X-Forwarded',
            'X-Cluster-Client-IP',
            'Forwarded-For',
            'Forwarded'
        ];
        
        foreach ($headers as $header) {
            if (!empty($request->headers[$header])) {
                $ips = explode(',', $request->headers[$header]);
                return trim($ips[0]);
            }
        }
        
        return $request->server['REMOTE_ADDR'] ?? '127.0.0.1';
    }
    
    private function applyRateLimit($botInfo, $request)
    {
        // Implement rate limiting logic
        $config = $this->tracker->getConfig('rate_limiting');
        if (!$config['enabled']) {
            return;
        }
        
        // Check rate limits (simplified implementation)
        $ip = $request->attributes['client_ip'] ?? '';
        $cacheKey = "rate_limit_{$ip}";
        
        // In a real implementation, you'd use Redis or similar
        // For demo purposes, we'll use session storage
        session_start();
        $requests = $_SESSION[$cacheKey] ?? [];
        $now = time();
        
        // Clean old requests
        $requests = array_filter($requests, function($timestamp) use ($now) {
            return ($now - $timestamp) < 3600; // Last hour
        });
        
        if (count($requests) >= $config['max_requests_per_hour']) {
            http_response_code(429);
            header('Retry-After: 3600');
            echo json_encode(['error' => 'Rate limit exceeded']);
            exit;
        }
        
        $requests[] = $now;
        $_SESSION[$cacheKey] = $requests;
    }
}

// Simulate request processing
$botInfo = $tracker->processRequest();

// Advanced routing with bot-specific handling
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// Route handler
function handleRoute($path, $method, $tracker, $botInfo) {
    switch ($path) {
        case '/':
            return handleHomePage($botInfo);
            
        case '/api/content':
            return handleApiContent($botInfo, $tracker);
            
        case '/api/search':
            return handleApiSearch($botInfo, $tracker);
            
        case '/articles':
            return handleArticles($botInfo);
            
        case '/sitemap.xml':
            return handleSitemap($botInfo);
            
        case '/admin/stats':
            return handleAdminStats($tracker);
            
        case '/admin/export':
            return handleAdminExport($tracker, $_GET);
            
        case '/admin/cleanup':
            return handleAdminCleanup($tracker);
            
        case '/health':
            return handleHealthCheck($tracker);
            
        case '/metrics':
            return handleMetrics($tracker);
            
        default:
            http_response_code(404);
            return ['error' => 'Not found'];
    }
}

function handleHomePage($botInfo) {
    if ($botInfo) {
        // Serve optimized content for bots
        return [
            'title' => 'AI Bot Tracker - Advanced Demo',
            'description' => 'Advanced demonstration of AI bot tracking capabilities',
            'content' => 'This is bot-optimized content',
            'bot_detected' => true,
            'bot_info' => $botInfo
        ];
    }
    
    return [
        'title' => 'Welcome to Advanced AI Bot Tracker',
        'content' => 'This is the advanced demo with custom configurations'
    ];
}

function handleApiContent($botInfo, $tracker) {
    header('Content-Type: application/json');
    
    if ($botInfo && $botInfo['classification']['type'] === 'retrieval') {
        // Provide structured data for retrieval bots
        return [
            'data' => [
                'articles' => [
                    ['id' => 1, 'title' => 'Article 1', 'summary' => 'Summary 1'],
                    ['id' => 2, 'title' => 'Article 2', 'summary' => 'Summary 2']
                ]
            ],
            'meta' => [
                'total' => 2,
                'bot_optimized' => true
            ]
        ];
    }
    
    return [
        'message' => 'API content endpoint',
        'timestamp' => date('Y-m-d H:i:s')
    ];
}

function handleApiSearch($botInfo, $tracker) {
    header('Content-Type: application/json');
    
    $query = $_GET['q'] ?? '';
    
    if ($botInfo && $botInfo['classification']['type'] === 'indexing') {
        // Provide comprehensive search results for indexing
        return [
            'query' => $query,
            'results' => [
                ['url' => '/article/1', 'title' => 'Article 1', 'relevance' => 0.9],
                ['url' => '/article/2', 'title' => 'Article 2', 'relevance' => 0.8]
            ],
            'total' => 2,
            'indexing_optimized' => true
        ];
    }
    
    return [
        'query' => $query,
        'results' => [],
        'message' => 'Search functionality'
    ];
}

function handleArticles($botInfo) {
    $articles = [
        ['id' => 1, 'title' => 'Understanding AI Bots', 'content' => 'Content about AI bots...'],
        ['id' => 2, 'title' => 'Web Scraping Ethics', 'content' => 'Content about ethics...']
    ];
    
    if ($botInfo) {
        // Add structured data for bots
        foreach ($articles as &$article) {
            $article['structured_data'] = [
                '@type' => 'Article',
                'headline' => $article['title'],
                'datePublished' => date('Y-m-d')
            ];
        }
    }
    
    return ['articles' => $articles];
}

function handleSitemap($botInfo) {
    header('Content-Type: application/xml');
    
    $urls = [
        ['loc' => 'http://localhost/', 'changefreq' => 'daily'],
        ['loc' => 'http://localhost/articles', 'changefreq' => 'weekly'],
        ['loc' => 'http://localhost/api/content', 'changefreq' => 'hourly']
    ];
    
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    
    foreach ($urls as $url) {
        $xml .= "  <url>\n";
        $xml .= "    <loc>{$url['loc']}</loc>\n";
        $xml .= "    <changefreq>{$url['changefreq']}</changefreq>\n";
        $xml .= "  </url>\n";
    }
    
    $xml .= '</urlset>';
    
    echo $xml;
    exit;
}

function handleAdminStats($tracker) {
    try {
        $timeRange = $_GET['range'] ?? '24h';
        $botName = $_GET['bot'] ?? null;
        
        $stats = $tracker->getStats($timeRange, $botName);
        
        header('Content-Type: application/json');
        return $stats;
    } catch (Exception $e) {
        http_response_code(500);
        return ['error' => $e->getMessage()];
    }
}

function handleAdminExport($tracker, $params) {
    try {
        $format = $params['format'] ?? 'json';
        $timeRange = $params['range'] ?? '24h';
        $botName = $params['bot'] ?? null;
        $classification = $params['classification'] ?? null;
        
        $filename = 'bot_visits_' . date('Y-m-d_H-i-s') . '.' . $format;
        $filepath = __DIR__ . '/exports/' . $filename;
        
        // Ensure export directory exists
        if (!is_dir(dirname($filepath))) {
            mkdir(dirname($filepath), 0755, true);
        }
        
        if ($format === 'csv') {
            $count = $tracker->exportToCsv($filepath, $timeRange, $botName, $classification);
        } else {
            $count = $tracker->exportToJson($filepath, $timeRange, $botName, $classification);
        }
        
        if (file_exists($filepath)) {
            $mimeType = $format === 'csv' ? 'text/csv' : 'application/json';
            header("Content-Type: {$mimeType}");
            header("Content-Disposition: attachment; filename=\"{$filename}\"");
            header('Content-Length: ' . filesize($filepath));
            readfile($filepath);
            unlink($filepath);
            exit;
        }
        
        return ['error' => 'Export failed'];
    } catch (Exception $e) {
        http_response_code(500);
        return ['error' => $e->getMessage()];
    }
}

function handleAdminCleanup($tracker) {
    try {
        $daysToKeep = (int)($_GET['days'] ?? 30);
        $deletedCount = $tracker->cleanup($daysToKeep);
        
        return [
            'message' => 'Cleanup completed',
            'deleted_records' => $deletedCount,
            'days_kept' => $daysToKeep
        ];
    } catch (Exception $e) {
        http_response_code(500);
        return ['error' => $e->getMessage()];
    }
}

function handleHealthCheck($tracker) {
    return [
        'status' => 'healthy',
        'tracker_enabled' => $tracker->isEnabled(),
        'timestamp' => date('Y-m-d H:i:s'),
        'version' => '1.0.0'
    ];
}

function handleMetrics($tracker) {
    try {
        $stats = $tracker->getStats('24h');
        
        // Prometheus-style metrics
        $metrics = [
            "# HELP bot_visits_total Total number of bot visits\n",
            "# TYPE bot_visits_total counter\n",
            "bot_visits_total {$stats['total_visits']}\n",
            "\n",
            "# HELP bot_visits_by_classification Bot visits by classification\n",
            "# TYPE bot_visits_by_classification counter\n"
        ];
        
        foreach ($stats['classifications'] as $classification) {
            $metrics[] = "bot_visits_by_classification{classification=\"{$classification['classification']}\"} {$classification['count']}\n";
        }
        
        header('Content-Type: text/plain');
        echo implode('', $metrics);
        exit;
    } catch (Exception $e) {
        http_response_code(500);
        return ['error' => $e->getMessage()];
    }
}

// Process the request
$result = handleRoute($requestUri, $method, $tracker, $botInfo);

// Output result
if (is_array($result)) {
    if (!headers_sent()) {
        header('Content-Type: application/json');
    }
    echo json_encode($result, JSON_PRETTY_PRINT);
} else {
    echo $result;
}

// Cleanup and logging
if ($botInfo) {
    $tracker->setResponseStatus(http_response_code());
    
    // Log to file if configured
    if (!empty($config['logging']['log_file'])) {
        $logDir = dirname($config['logging']['log_file']);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0755, true);
        }
        
        $logEntry = [
            'timestamp' => date('Y-m-d H:i:s'),
            'bot_name' => $botInfo['name'],
            'classification' => $botInfo['classification']['type'],
            'url' => $requestUri,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
        ];
        
        file_put_contents(
            $config['logging']['log_file'],
            json_encode($logEntry) . "\n",
            FILE_APPEND | LOCK_EX
        );
    }
}

?>
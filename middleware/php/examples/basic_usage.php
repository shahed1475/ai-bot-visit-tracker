<?php

require_once __DIR__ . '/../vendor/autoload.php';

use AiBotTracker\AiBotTracker;

/**
 * Basic Usage Example for AI Bot Tracker PHP Middleware
 * 
 * This example demonstrates the basic setup and usage of the AI Bot Tracker
 * for tracking AI bot visits to your PHP application.
 */

// Initialize the tracker with basic configuration
$tracker = new AiBotTracker([
    'database' => [
        'type' => 'sqlite',
        'database' => __DIR__ . '/ai_bot_tracker.db'
    ],
    'logging' => [
        'enabled' => true,
        'log_headers' => true,
        'log_response_time' => true
    ]
]);

// Process the current request
$botInfo = $tracker->processRequest();

if ($botInfo) {
    echo "<h2>AI Bot Detected!</h2>\n";
    echo "<p><strong>Bot Name:</strong> {$botInfo['name']}</p>\n";
    echo "<p><strong>Classification:</strong> {$botInfo['classification']['type']} (confidence: {$botInfo['classification']['confidence']})</p>\n";
    echo "<p><strong>Detection Method:</strong> {$botInfo['detection_method']}</p>\n";
    
    // You can add custom logic here for bot-specific handling
    if ($botInfo['classification']['type'] === 'indexing') {
        // Handle indexing bots (e.g., provide full content)
        echo "<p>Serving full content for indexing bot...</p>\n";
    } else {
        // Handle retrieval bots (e.g., rate limiting, special responses)
        echo "<p>Handling retrieval bot request...</p>\n";
    }
} else {
    echo "<h2>Regular User Request</h2>\n";
    echo "<p>No AI bot detected in this request.</p>\n";
}

// Example routes for testing
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';

switch ($requestUri) {
    case '/':
        echo "<h1>Welcome to AI Bot Tracker Demo</h1>\n";
        echo "<p>This is the home page. Try visiting different URLs to test bot detection.</p>\n";
        echo "<ul>\n";
        echo "<li><a href='/api/data'>API Endpoint</a></li>\n";
        echo "<li><a href='/blog/post-1'>Blog Post</a></li>\n";
        echo "<li><a href='/sitemap.xml'>Sitemap</a></li>\n";
        echo "<li><a href='/stats'>View Statistics</a></li>\n";
        echo "<li><a href='/export/csv'>Export CSV</a></li>\n";
        echo "<li><a href='/export/json'>Export JSON</a></li>\n";
        echo "</ul>\n";
        break;

    case '/api/data':
        header('Content-Type: application/json');
        echo json_encode([
            'message' => 'API data response',
            'timestamp' => date('Y-m-d H:i:s'),
            'bot_detected' => $botInfo !== null,
            'bot_info' => $botInfo
        ]);
        break;

    case '/blog/post-1':
        echo "<h1>Sample Blog Post</h1>\n";
        echo "<p>This is a sample blog post content that bots might want to index or retrieve.</p>\n";
        echo "<p>Published: " . date('Y-m-d') . "</p>\n";
        break;

    case '/sitemap.xml':
        header('Content-Type: application/xml');
        echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        echo '  <url><loc>http://localhost/</loc><changefreq>daily</changefreq></url>' . "\n";
        echo '  <url><loc>http://localhost/api/data</loc><changefreq>hourly</changefreq></url>' . "\n";
        echo '  <url><loc>http://localhost/blog/post-1</loc><changefreq>weekly</changefreq></url>' . "\n";
        echo '</urlset>' . "\n";
        break;

    case '/stats':
        try {
            $stats = $tracker->getStats('24h');
            echo "<h1>Bot Visit Statistics (Last 24 Hours)</h1>\n";
            echo "<p><strong>Total Visits:</strong> {$stats['total_visits']}</p>\n";
            
            echo "<h3>Classification Breakdown:</h3>\n";
            echo "<ul>\n";
            foreach ($stats['classifications'] as $classification) {
                echo "<li>{$classification['classification']}: {$classification['count']} visits</li>\n";
            }
            echo "</ul>\n";
            
            echo "<h3>Bot Breakdown:</h3>\n";
            echo "<ul>\n";
            foreach ($stats['bots'] as $bot) {
                echo "<li>{$bot['bot_name']}: {$bot['count']} visits</li>\n";
            }
            echo "</ul>\n";
            
            echo "<h3>Top Pages:</h3>\n";
            echo "<ul>\n";
            foreach ($stats['top_pages'] as $page) {
                echo "<li>{$page['page_url']}: {$page['count']} visits</li>\n";
            }
            echo "</ul>\n";
            
        } catch (Exception $e) {
            echo "<p>Error retrieving statistics: " . htmlspecialchars($e->getMessage()) . "</p>\n";
        }
        break;

    case '/export/csv':
        try {
            $filename = 'bot_visits_' . date('Y-m-d_H-i-s') . '.csv';
            $filepath = __DIR__ . '/' . $filename;
            
            $count = $tracker->exportToCsv($filepath, '24h');
            
            if (file_exists($filepath)) {
                header('Content-Type: application/csv');
                header('Content-Disposition: attachment; filename="' . $filename . '"');
                header('Content-Length: ' . filesize($filepath));
                readfile($filepath);
                unlink($filepath); // Clean up temporary file
                exit;
            } else {
                echo "<p>Error: Could not create CSV file</p>\n";
            }
        } catch (Exception $e) {
            echo "<p>Error exporting CSV: " . htmlspecialchars($e->getMessage()) . "</p>\n";
        }
        break;

    case '/export/json':
        try {
            $filename = 'bot_visits_' . date('Y-m-d_H-i-s') . '.json';
            $filepath = __DIR__ . '/' . $filename;
            
            $count = $tracker->exportToJson($filepath, '24h');
            
            if (file_exists($filepath)) {
                header('Content-Type: application/json');
                header('Content-Disposition: attachment; filename="' . $filename . '"');
                header('Content-Length: ' . filesize($filepath));
                readfile($filepath);
                unlink($filepath); // Clean up temporary file
                exit;
            } else {
                echo "<p>Error: Could not create JSON file</p>\n";
            }
        } catch (Exception $e) {
            echo "<p>Error exporting JSON: " . htmlspecialchars($e->getMessage()) . "</p>\n";
        }
        break;

    case '/health':
        header('Content-Type: application/json');
        echo json_encode([
            'status' => 'healthy',
            'tracker_enabled' => $tracker->isEnabled(),
            'timestamp' => date('Y-m-d H:i:s')
        ]);
        break;

    default:
        http_response_code(404);
        echo "<h1>404 - Page Not Found</h1>\n";
        echo "<p>The requested page was not found.</p>\n";
        break;
}

// Set response status for tracking
if ($botInfo) {
    $tracker->setResponseStatus(http_response_code());
}

?>

<!DOCTYPE html>
<html>
<head>
    <title>AI Bot Tracker - Basic Usage</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .bot-info { background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .no-bot { background: #f0f0f0; padding: 15px; border-radius: 5px; margin: 20px 0; }
        ul { margin: 10px 0; }
        li { margin: 5px 0; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>

<div style="margin-top: 30px; padding: 20px; background: #f9f9f9; border-radius: 5px;">
    <h3>Testing Instructions:</h3>
    <p>To test bot detection, try accessing this page with different User-Agent strings:</p>
    <ul>
        <li><strong>GPT Bot:</strong> <code>curl -H "User-Agent: GPTBot/1.0" http://localhost/</code></li>
        <li><strong>Claude Bot:</strong> <code>curl -H "User-Agent: Claude-Web/1.0" http://localhost/</code></li>
        <li><strong>Bard Bot:</strong> <code>curl -H "User-Agent: Google-Extended/1.0" http://localhost/</code></li>
        <li><strong>Regular Browser:</strong> <code>curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" http://localhost/</code></li>
    </ul>
    
    <h4>Environment Variables (Optional):</h4>
    <ul>
        <li><code>AI_BOT_TRACKER_DB_PATH</code> - Custom database path</li>
        <li><code>AI_BOT_TRACKER_ENABLED</code> - Enable/disable tracking (true/false)</li>
        <li><code>AI_BOT_TRACKER_LOG_HEADERS</code> - Log request headers (true/false)</li>
    </ul>
</div>

</body>
</html>
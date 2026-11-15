# PHP middleware

```php
spl_autoload_register(fn ($c) => require __DIR__ . '/middleware/php/src/' . str_replace('AiBotTracker\\', '', $c) . '.php');
$tracker = new AiBotTracker\AiBotTracker([
    'database' => ['type' => 'sqlite', 'database' => __DIR__ . '/bot_visits.db'],
    'logging'  => ['enabled' => true, 'async' => false],
    'bot_detection' => ['trust_cloudflare_headers' => false],   // true only behind Cloudflare
]);
$tracker->processRequest();   // returns null for humans, a result array for bots
```

### Send visits to your Cloudflare tracker

```php
$tracker = new AiBotTracker\AiBotTracker([
    'database' => false,   // report only; or keep the SQLite config above to also store locally
    'report'   => ['endpoint' => 'https://your-tracker.example', 'key' => getenv('TRACKER_KEY'), 'site' => 'example.com'],
]);
$tracker->processRequest();
```

Only bots are reported. The path and referer are sent without query strings, and never any headers or cookies. Reports go out when the script ends (on PHP-FPM after the visitor has their page; on other setups the request ends once the report is sent, at most `'timeout'` seconds, default 2). A tracker that is down or slow never breaks your page, and a mistake in the `report` settings (such as an unset environment variable) switches reporting off with a warning in your error log instead of throwing. The response status is read when the reports are sent, at the end of the request; `$tracker->flushReports()` sends immediately, with whatever status is set at that moment. Set `'database' => false` for report-only use; every local-storage method then does nothing.

Needs PHP 7.4+ with PDO sqlite (the `curl` extension is used when present, otherwise streams). The bot registry is read from `signatures/ai-bots.json` (default path `../../../signatures`, or env `AI_BOT_REGISTRY`, or `bot_detection.registry_path`). Copy `signatures/` with the middleware.

Forwarded-IP headers are ignored unless you set `trust_proxy_headers` or `trust_cloudflare_headers`; otherwise anyone could spoof a verified bot. Pass `bot_detection.ip_ranges` (`botId => [cidr]`) to get `verified|unverified|unknown`.

Tests: `php ../../tests/test_php_detector.php && php ../../tests/test_php_tracker.php && php ../../tests/test_php_reporter.php`.

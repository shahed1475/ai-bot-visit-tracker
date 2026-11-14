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

Needs PHP 7.4+ with PDO sqlite. The bot registry is read from `signatures/ai-bots.json` (default path `../../../signatures`, or env `AI_BOT_REGISTRY`, or `bot_detection.registry_path`). Copy `signatures/` with the middleware.

Forwarded-IP headers are ignored unless you set `trust_proxy_headers` or `trust_cloudflare_headers`; otherwise anyone could spoof a verified bot. Pass `bot_detection.ip_ranges` (`botId => [cidr]`) to get `verified|unverified|unknown`.

Tests: `php ../../tests/test_php_detector.php && php ../../tests/test_php_tracker.php`.

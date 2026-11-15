<?php
// PHP built-in server router with the PHP middleware (report-only). Env: TRACKER_URL, TRACKER_KEY, SITE.
spl_autoload_register(function ($class) {
    $file = __DIR__ . '/../../../middleware/php/src/' . str_replace('AiBotTracker\\', '', $class) . '.php';
    if (is_file($file)) require $file;
});

$tracker = new AiBotTracker\AiBotTracker([
    'database' => false,
    'report' => ['endpoint' => getenv('TRACKER_URL'), 'key' => getenv('TRACKER_KEY'), 'site' => getenv('SITE')],
]);
$tracker->processRequest();

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (substr($path, -7) === 'missing') {
    http_response_code(404);
    echo 'not found';
} else {
    echo "ok $path";
}

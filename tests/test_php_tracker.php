<?php
/** End-to-end PHP check: humans ignored, bots stored with the declared purpose, forwarded IPs not trusted. Run: php tests/test_php_tracker.php */
spl_autoload_register(function ($class) {
    $path = __DIR__ . '/../middleware/php/src/' . str_replace('AiBotTracker\\', '', $class) . '.php';
    if (is_file($path)) require $path;
});

use AiBotTracker\AiBotTracker;

$failures = 0;
function check(bool $ok, string $label): void { global $failures; if (!$ok) { $failures++; fwrite(STDERR, "FAIL: $label\n"); } }

$db = sys_get_temp_dir() . '/abt_' . uniqid() . '.db';
$t = new AiBotTracker(['database' => ['type' => 'sqlite', 'database' => $db], 'logging' => ['enabled' => true, 'async' => false]]);
$req = fn (string $ua) => ['user_agent' => $ua, 'ip_address' => '203.0.113.5', 'url' => '/blog/x', 'headers' => [], 'method' => 'GET'];

check($t->processRequest($req('Mozilla/5.0 (Windows NT 10.0) Chrome/126 Safari/537.36')) === null, 'human returns null');
$bot = $t->processRequest($req('compatible; ClaudeBot/1.0'));
check(($bot['bot_name'] ?? null) === 'ClaudeBot', 'bot name');
check(($bot['classification']['type'] ?? null) === 'training', 'declared purpose is used');

$rows = (new PDO("sqlite:$db"))->query('select bot_name, classification from visits')->fetchAll(PDO::FETCH_NUM);
check($rows === [['ClaudeBot', 'training']], 'exactly one stored row: ' . json_encode($rows));

$_SERVER['REMOTE_ADDR'] = '198.51.100.7';
$_SERVER['HTTP_X_FORWARDED_FOR'] = '20.15.240.70'; // attacker-controlled
$m = new ReflectionMethod($t, 'getClientIp');
$m->setAccessible(true);
check($m->invoke($t) === '198.51.100.7', 'X-Forwarded-For must not be trusted by default');

@unlink($db);
echo $failures === 0 ? "php tracker: all checks passed\n" : "$failures failure(s)\n";
exit($failures === 0 ? 0 : 1);

<?php
/**
 * PHP reporting to the Cloudflare tracker, against a real local HTTP receiver.
 * Checks: bots are reported with the right shape and key, humans are not, query strings and secrets are not sent,
 * a dead tracker never breaks the request, the README config raises no warnings, and report-only mode works.
 * Run: php tests/test_php_reporter.php
 */
error_reporting(E_ALL);
spl_autoload_register(function ($class) {
    $path = __DIR__ . '/../middleware/php/src/' . str_replace('AiBotTracker\\', '', $class) . '.php';
    if (is_file($path)) require $path;
});

use AiBotTracker\AiBotTracker;

$failures = 0;
function check(bool $ok, string $label): void { global $failures; if (!$ok) { $failures++; fwrite(STDERR, "FAIL: $label\n"); } }

// Any PHP warning or notice raised by the middleware is a failure (it would leak into a visitor's page).
$warnings = [];
$allWarnings = []; // every warning, notice or deprecation of the whole run (PHP 8.5 deprecations included)
set_error_handler(function ($no, $msg, $file, $line) use (&$warnings, &$allWarnings) {
    if (!(error_reporting() & $no)) return false; // respect the @ operator
    $warnings[] = "$msg ($line)"; $allWarnings[] = "$msg ($line)"; return true;
});

function freePort(): int { $s = stream_socket_server('tcp://127.0.0.1:0'); $n = (int) substr(strrchr(stream_socket_get_name($s, false), ':'), 1); fclose($s); return $n; }

// A tiny receiver that records every request it gets.
$dir = sys_get_temp_dir() . '/abt_rep_' . uniqid();
mkdir($dir);
$log = "$dir/received.jsonl";
file_put_contents("$dir/router.php", '<?php file_put_contents(getenv("ABT_LOG"), json_encode(["auth" => $_SERVER["HTTP_AUTHORIZATION"] ?? "", "type" => $_SERVER["CONTENT_TYPE"] ?? "", "path" => $_SERVER["REQUEST_URI"], "body" => file_get_contents("php://input")]) . "\n", FILE_APPEND); header("Content-Type: application/json"); echo "{\"stored\":1}";');
$port = freePort();
$proc = proc_open(['php', '-S', "127.0.0.1:$port", "$dir/router.php"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes, $dir, ['ABT_LOG' => $log, 'PATH' => getenv('PATH')]);
for ($i = 0; $i < 50 && !@fsockopen('127.0.0.1', $port); $i++) usleep(100000);
$received = fn () => is_file($log) ? array_map(fn ($l) => json_decode($l, true), array_filter(explode("\n", (string) file_get_contents($log)))) : [];

$tracker = fn (array $extra = []) => new AiBotTracker(array_merge([
    'database' => false,
    'report' => ['endpoint' => "http://127.0.0.1:$port/", 'key' => 'abt_testkey', 'site' => 'example.com'],
], $extra));
$serverFor = fn (string $ua, string $uri = '/pricing?utm=x&token=secret') => $_SERVER = [
    'REMOTE_ADDR' => '203.0.113.9', 'HTTP_USER_AGENT' => $ua, 'REQUEST_URI' => $uri, 'REQUEST_METHOD' => 'GET', 'HTTP_HOST' => 'example.com',
    'HTTP_COOKIE' => 'session=abc', 'HTTP_AUTHORIZATION' => 'Bearer secret', 'HTTP_REFERER' => 'https://news.example/post?id=7',
];

// 1. a bad report configuration never takes the page down: PHP builds the tracker on every request, so reporting is
//    switched off with one clear warning instead of throwing
foreach ([['endpoint' => 'http://x'], ['key' => 'k', 'site' => 's'], ['endpoint' => '', 'key' => 'k', 'site' => 's']] as $bad) {
    $warnings = [];
    $before = count($received());
    try {
        $t = new AiBotTracker(['database' => false, 'report' => $bad]);
        $serverFor('compatible; GPTBot/1.4');
        check(($t->processRequest()['bot_name'] ?? null) === 'GPTBot', 'bad report config: the page still works: ' . json_encode($bad));
        check($t->flushReports() === true, 'bad report config: flushing is a harmless no-op');
    } catch (Throwable $e) {
        check(false, 'a bad report config must not throw: ' . json_encode($bad) . ' -> ' . $e->getMessage());
    }
    check(count($warnings) === 1 && str_contains($warnings[0], 'reporting disabled'), 'bad report config: exactly one clear warning: ' . implode('; ', $warnings));
    check(count($received()) === $before, 'bad report config: nothing is sent');
}
try { new \AiBotTracker\Reporter(['endpoint' => 'http://x']); check(false, 'the Reporter class itself still validates its input'); }
catch (InvalidArgumentException $e) { check(true, 'Reporter validates'); }
$warnings = [];

// 2. a bot is reported, with the right shape, and nothing secret
$t = $tracker();
$serverFor('Mozilla/5.0; compatible; GPTBot/1.4');
$result = $t->processRequest();
check(($result['bot_name'] ?? null) === 'GPTBot', 'bot still detected and returned');
check($received() === [], 'nothing is sent before the flush (the visitor is not made to wait)');
check($t->flushReports() === true, 'flushReports reports success');
$got = $received();
check(count($got) === 1, 'one request reached the tracker: ' . count($got));
$req = $got[0] ?? [];
check(($req['path'] ?? '') === '/api/ingest', 'posted to /api/ingest');
check(($req['auth'] ?? '') === 'Bearer abt_testkey', 'bearer key sent');
check(str_contains($req['type'] ?? '', 'application/json'), 'json content type');
$event = (json_decode($req['body'] ?? '{}', true)['events'][0] ?? []);
check(($event['ip'] ?? null) === '203.0.113.9', 'ip: ' . json_encode($event));
check(($event['ua'] ?? null) === 'Mozilla/5.0; compatible; GPTBot/1.4', 'user agent');
check(($event['path'] ?? null) === '/pricing', 'query string stripped from path: ' . ($event['path'] ?? 'none'));
check(($event['method'] ?? null) === 'GET' && ($event['status'] ?? null) === 200, 'method and status');
check(($event['referer'] ?? null) === 'https://news.example/post', 'referer kept without its query');
check(($event['site'] ?? null) === 'example.com', 'site');
check(!str_contains($req['body'] ?? '', 'secret') && !str_contains($req['body'] ?? '', 'session=abc'), 'no cookie, token or authorization value is ever sent');

// 3. humans are not reported
$t = $tracker();
$serverFor('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/126 Safari/537.36');
check($t->processRequest() === null, 'human returns null');
$before = count($received());
$t->flushReports();
check(count($received()) === $before, 'humans are never reported');

// 4. several bots in one request cycle go out as one batch
$t = $tracker();
$before = count($received());
foreach (['compatible; ClaudeBot/1.0', 'compatible; PerplexityBot/1.0', 'compatible; Claude-User/1.0'] as $ua) { $serverFor($ua, '/a'); $t->processRequest(); }
$t->flushReports();
$batch = array_slice($received(), $before);
check(count($batch) === 1 && count(json_decode($batch[0]['body'], true)['events']) === 3, 'three bots, one batched request');

// 5. a dead tracker never breaks the request and does not hang it
$dead = freePort();
$t = new AiBotTracker(['database' => false, 'report' => ['endpoint' => "http://127.0.0.1:$dead", 'key' => 'k', 'site' => 's', 'timeout' => 1]]);
$serverFor('compatible; GPTBot/1.4');
$started = microtime(true);
$r = $t->processRequest();
$ok = $t->flushReports();
check(($r['bot_name'] ?? null) === 'GPTBot', 'dead tracker: request still processed');
check($ok === false, 'dead tracker: flush returns false instead of throwing');
check(microtime(true) - $started < 3, 'dead tracker: fails fast');

// 6. the README configuration raises no warnings or notices
$warnings = [];
$t = new AiBotTracker([
    'database' => ['type' => 'sqlite', 'database' => "$dir/readme.db"],
    'logging' => ['enabled' => true, 'async' => false],
    'bot_detection' => ['trust_cloudflare_headers' => false],
]);
$serverFor('compatible; GPTBot/1.4');
$t->processRequest();
check($warnings === [], 'README config raises no warnings: ' . implode('; ', $warnings));
$rows = (new PDO("sqlite:$dir/readme.db"))->query('select bot_name from visits')->fetchAll(PDO::FETCH_COLUMN);
check($rows === ['GPTBot'], 'README config still stores the visit locally');

// 7. report-only mode (database => false) works and the local-storage methods are safe no-ops
$warnings = [];
$t = $tracker();
check($t->getStats() === [] && $t->cleanup() === 0, 'database => false: stats and cleanup are safe no-ops');
check($warnings === [], 'report-only mode raises no warnings: ' . implode('; ', $warnings));

// 8b. malformed bytes in one user agent must not cost the other events in the batch (scrapers send them all the time)
$t = $tracker();
$before = count($received());
$serverFor("compatible; GPTBot/1.4 \xB1\xFF\xFE", '/bad-bytes');
$t->processRequest();
$serverFor('compatible; ClaudeBot/1.0', '/clean');
$t->processRequest();
$t->flushReports();
$batch = array_slice($received(), $before);
check(count($batch) === 1, 'invalid UTF-8 in a user agent does not stop the batch from being sent: ' . count($batch) . ' request(s)');
$paths = array_map(fn ($e) => $e['path'], json_decode($batch[0]['body'] ?? '{}', true)['events'] ?? []);
check($paths === ['/bad-bytes', '/clean'], 'both events arrive: ' . json_encode($paths));

// 8c. both transports (curl and plain streams) behave the same, including against a dead tracker
foreach (['curl', 'stream'] as $transport) {
    $t = $tracker(['report' => ['endpoint' => "http://127.0.0.1:$port", 'key' => 'abt_testkey', 'site' => 'example.com', 'transport' => $transport]]);
    $before = count($received());
    $serverFor('compatible; GPTBot/1.4', "/via-$transport");
    $t->processRequest();
    check($t->flushReports() === true, "$transport transport: flush reports success");
    $got = array_slice($received(), $before);
    check(count($got) === 1 && ($got[0]['auth'] ?? '') === 'Bearer abt_testkey' && (json_decode($got[0]['body'], true)['events'][0]['path'] ?? '') === "/via-$transport", "$transport transport: the event arrives with the key");
    $t = new AiBotTracker(['database' => false, 'report' => ['endpoint' => "http://127.0.0.1:$dead", 'key' => 'k', 'site' => 's', 'timeout' => 1, 'transport' => $transport]]);
    $serverFor('compatible; GPTBot/1.4');
    $t->processRequest();
    check($t->flushReports() === false, "$transport transport: a dead tracker returns false without throwing");
}

// 8. nothing reached the tracker for requests that must not report
check(count(array_filter($received(), fn ($r) => str_contains($r['body'], 'Chrome'))) === 0, 'no human traffic reached the tracker');

$unexpected = array_values(array_filter($allWarnings, fn ($w) => !str_contains($w, 'reporting disabled')));
check($unexpected === [], 'no unexpected warning, notice or deprecation anywhere in the run: ' . implode('; ', $unexpected));

proc_terminate($proc);
@array_map('unlink', glob("$dir/*"));
@rmdir($dir);
echo $failures === 0 ? "php reporter: all checks passed\n" : "$failures failure(s)\n";
exit($failures === 0 ? 0 : 1);

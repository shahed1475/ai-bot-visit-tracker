<?php
/** PHP detector tests (no framework needed). Run: php tests/test_php_detector.php */
require_once __DIR__ . '/../middleware/php/src/BotDetector.php';

use AiBotTracker\BotDetector;

$failures = 0;
function check(bool $ok, string $label): void {
    global $failures;
    if (!$ok) { $failures++; fwrite(STDERR, "FAIL: $label\n"); }
}

$fixtures = json_decode(file_get_contents(__DIR__ . '/../signatures/fixtures.json'), true)['cases'];
$d = new BotDetector();
foreach ($fixtures as $c) {
    $r = $d->detectBot($c['ua'], '203.0.113.9');
    if ($c['expect'] === null) { check($r['is_bot'] === false, 'human: ' . $c['ua']); continue; }
    check($r['is_bot'] === true, 'bot: ' . $c['ua']);
    check(($r['bot_id'] ?? null) === $c['expect']['id'], 'id ' . $c['expect']['id'] . ' got ' . ($r['bot_id'] ?? 'null'));
    check(($r['kind'] ?? null) === $c['expect']['kind'], 'kind ' . $c['expect']['id']);
    check(($r['purpose'] ?? null) === $c['expect']['purpose'], 'purpose ' . $c['expect']['id']);
}

$gpt = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot';
$v = new BotDetector([], ['gptbot' => ['20.15.240.64/26']]);
check($v->detectBot($gpt, '20.15.240.70')['verified'] === 'verified', 'verified');
check($v->detectBot($gpt, '8.8.8.8')['verified'] === 'unverified', 'unverified');
check($v->detectBot('compatible; ClaudeBot/1.0', '8.8.8.8')['verified'] === 'unknown', 'unknown');

check(BotDetector::inRanges('20.15.240.127', ['20.15.240.64/26']), 'cidr upper bound');
check(!BotDetector::inRanges('20.15.240.128', ['20.15.240.64/26']), 'cidr outside');
check(BotDetector::inRanges('::ffff:20.15.240.70', ['20.15.240.64/26']), 'mapped v6');
check(BotDetector::inRanges('2001:4860:4801:10::5', ['2001:4860:4801:10::/64']), 'v6');
foreach (['', 'nope', '999.1.1.1'] as $bad) { check(!BotDetector::inRanges($bad, ['1.2.3.0/24']), "garbage $bad"); }
check($d->detectBot('', '1.1.1.1')['is_bot'] === false, 'empty ua');
check($d->detectBot(str_repeat('x', 100000), '1.1.1.1')['is_bot'] === false, 'huge ua');

echo $failures === 0 ? "php detector: all checks passed\n" : "$failures failure(s)\n";
exit($failures === 0 ? 0 : 1);

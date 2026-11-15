<?php
// Run: php -S localhost:8000 basic_usage.php   then: curl -A "GPTBot/1.4" localhost:8000/
spl_autoload_register(function ($class) {
    require __DIR__ . '/../src/' . str_replace('AiBotTracker\\', '', $class) . '.php';
});

$tracker = new AiBotTracker\AiBotTracker([
    'database' => ['type' => 'sqlite', 'database' => __DIR__ . '/bot_visits.db'],
    'logging' => ['enabled' => true, 'async' => false],
]);
$result = $tracker->processRequest();   // null for humans

header('Content-Type: text/plain');
echo $result ? "Bot: {$result['bot_name']} ({$result['purpose']})\n" : "Human\n";

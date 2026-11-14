<?php

namespace AiBotTracker;

/**
 * BotDetector: identifies AI bots from the shared registry (signatures/ai-bots.json).
 *
 * Matching contract (identical in every language): the first registry entry whose case-insensitive
 * `ua` regex matches wins; unknown crawlers fall back to "generic-bot". IP ranges are used only to
 * VERIFY a claimed bot, never to detect one (cloud IPs are shared with ordinary customers).
 */
class BotDetector
{
    private const MAX_UA = 512;
    private const GENERIC = '/[a-z]bot\b|\bbot\b|\b(crawler|spider|scraper|fetcher|indexer)\b/i';

    /** @var array<int,array> */
    private $entries = [];

    /** @var array<int,array> custom bots, checked before the registry */
    private $custom = [];

    /** @var array<string,string[]> bot id => CIDR list (vendor-published ranges) */
    private $ipRanges;

    /**
     * @param array       $customPatterns name => list of PCRE patterns (e.g. ['MyBot' => ['/MyBot\/\d+/']])
     * @param array       $ipRanges       bot id => CIDR list, enables verified/unverified results
     * @param string|null $registryPath   path to ai-bots.json (default: repo copy, or env AI_BOT_REGISTRY)
     */
    public function __construct(array $customPatterns = [], array $ipRanges = [], ?string $registryPath = null)
    {
        $path = $registryPath ?? (getenv('AI_BOT_REGISTRY') ?: __DIR__ . '/../../../signatures/ai-bots.json');
        $json = is_readable($path) ? json_decode((string) file_get_contents($path), true) : null;
        if (!is_array($json) || empty($json['bots'])) {
            throw new \RuntimeException("Bot registry not found at $path (set AI_BOT_REGISTRY or pass \$registryPath)");
        }
        foreach ($json['bots'] as $bot) {
            $bot['re'] = '#' . str_replace('#', '\#', $bot['ua']) . '#i';
            $this->entries[] = $bot;
        }
        $this->ipRanges = $ipRanges;
        foreach ($customPatterns as $name => $patterns) {
            $this->addBotPattern((string) $name, (array) $patterns);
        }
    }

    public function addBotPattern(string $botName, array $patterns): void
    {
        $this->custom[] = [
            'id' => strtolower(preg_replace('/[^a-z0-9]+/i', '-', $botName)), 'name' => $botName, 'operator' => 'Custom',
            'kind' => 'ai', 'purpose' => 'unknown', 'ipSources' => [], 'patterns' => $patterns,
        ];
    }

    public function setIpRanges(array $ranges): void
    {
        $this->ipRanges = $ranges;
    }

    public function getIpRanges(): array
    {
        return $this->ipRanges;
    }

    /**
     * @return array{is_bot:bool,bot_id:?string,bot_name:?string,operator:?string,kind:?string,purpose:?string,verified:string,confidence:float,detection_method:?string}
     */
    public function detectBot(string $userAgent, string $ipAddress): array
    {
        $none = ['is_bot' => false, 'bot_id' => null, 'bot_name' => null, 'operator' => null, 'kind' => null,
            'purpose' => null, 'verified' => 'unknown', 'confidence' => 0.0, 'detection_method' => null];
        if ($userAgent === '') {
            return $none;
        }
        $ua = substr($userAgent, 0, self::MAX_UA);

        foreach ($this->custom as $bot) {
            foreach ($bot['patterns'] as $pattern) {
                if (@preg_match($pattern, $ua)) {
                    return $this->result($bot, $ipAddress, 0.95, 'user_agent');
                }
            }
        }
        foreach ($this->entries as $bot) {
            if (preg_match($bot['re'], $ua)) {
                return $this->result($bot, $ipAddress, 0.95, 'user_agent');
            }
        }
        if (preg_match(self::GENERIC, $ua)) {
            $generic = ['id' => 'generic-bot', 'name' => 'Other crawler', 'operator' => 'Unknown', 'kind' => 'other',
                'purpose' => 'unknown', 'ipSources' => []];
            return $this->result($generic, $ipAddress, 0.5, 'generic_pattern');
        }
        return $none;
    }

    private function result(array $bot, string $ip, float $confidence, string $method): array
    {
        $ranges = $this->ipRanges[$bot['id']] ?? [];
        $verified = ($ip === '' || empty($bot['ipSources']) || !$ranges)
            ? 'unknown' : (self::inRanges($ip, $ranges) ? 'verified' : 'unverified');
        return ['is_bot' => true, 'bot_id' => $bot['id'], 'bot_name' => $bot['name'], 'operator' => $bot['operator'],
            'kind' => $bot['kind'], 'purpose' => $bot['purpose'], 'verified' => $verified,
            'confidence' => $confidence, 'detection_method' => $method];
    }

    /** True when $ip is inside any CIDR. IPv4, IPv6 and IPv4-mapped IPv6; garbage input is false. */
    public static function inRanges(string $ip, array $cidrs): bool
    {
        $bin = @inet_pton(trim($ip));
        if ($bin === false) {
            return false;
        }
        if (strlen($bin) === 16 && substr($bin, 0, 12) === "\0\0\0\0\0\0\0\0\0\0\xff\xff") {
            $bin = substr($bin, 12);
        }
        foreach ($cidrs as $cidr) {
            $parts = explode('/', (string) $cidr);
            if (count($parts) !== 2 || !ctype_digit($parts[1])) {
                continue;
            }
            $net = @inet_pton($parts[0]);
            $bits = (int) $parts[1];
            if ($net === false || strlen($net) !== strlen($bin) || $bits > strlen($net) * 8) {
                continue;
            }
            $bytes = intdiv($bits, 8);
            $rem = $bits % 8;
            if ($bytes > 0 && substr($bin, 0, $bytes) !== substr($net, 0, $bytes)) {
                continue;
            }
            if ($rem === 0) {
                return true;
            }
            $mask = (0xFF << (8 - $rem)) & 0xFF;
            if ((ord($bin[$bytes]) & $mask) === (ord($net[$bytes]) & $mask)) {
                return true;
            }
        }
        return false;
    }
}

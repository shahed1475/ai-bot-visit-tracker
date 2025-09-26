<?php

namespace AiBotTracker;

/**
 * BotDetector - Detects AI bots based on user-agent patterns and IP ranges
 */
class BotDetector
{
    /**
     * @var array Default bot patterns
     */
    private $botPatterns = [
        'GPTBot' => [
            '/GPTBot\/[\d\.]+/',
            '/OpenAI-GPT/',
            '/ChatGPT-User/'
        ],
        'ClaudeBot' => [
            '/ClaudeBot\/[\d\.]+/',
            '/Claude-Web/',
            '/anthropic-ai/',
            '/Anthropic/'
        ],
        'PerplexityBot' => [
            '/PerplexityBot\/[\d\.]+/',
            '/Perplexity/',
            '/PerplexityBot/'
        ],
        'Google-Extended' => [
            '/Google-Extended/',
            '/GoogleOther/',
            '/Bard/'
        ],
        'CCBot' => [
            '/CCBot\/[\d\.]+/',
            '/CommonCrawl/'
        ],
        'Bytespider' => [
            '/Bytespider/',
            '/ByteDance/'
        ],
        'Applebot-Extended' => [
            '/Applebot-Extended/',
            '/Applebot\/[\d\.]+/'
        ],
        'Meta-ExternalAgent' => [
            '/Meta-ExternalAgent/',
            '/facebookexternalhit/'
        ]
    ];

    /**
     * @var array IP ranges for known AI services
     */
    private $ipRanges = [
        '66.249.64.0/19',    // Google
        '40.77.167.0/24',    // Microsoft/OpenAI
        '52.167.144.0/20',   // Azure/OpenAI
        '13.107.42.14/32',   // Microsoft
    ];

    /**
     * @var array Custom bot patterns
     */
    private $customPatterns = [];

    /**
     * Constructor
     * 
     * @param array $customPatterns Custom bot patterns
     * @param array $customIpRanges Custom IP ranges
     */
    public function __construct(array $customPatterns = [], array $customIpRanges = [])
    {
        $this->customPatterns = $customPatterns;
        $this->ipRanges = array_merge($this->ipRanges, $customIpRanges);
    }

    /**
     * Detect if the request is from an AI bot
     * 
     * @param string $userAgent User agent string
     * @param string $ipAddress IP address
     * @return array Bot detection result
     */
    public function detectBot(string $userAgent, string $ipAddress): array
    {
        $result = [
            'is_bot' => false,
            'bot_name' => null,
            'confidence' => 0.0,
            'detection_method' => null
        ];

        // Check user agent patterns
        $botName = $this->checkUserAgent($userAgent);
        if ($botName) {
            $result['is_bot'] = true;
            $result['bot_name'] = $botName;
            $result['confidence'] = 0.9;
            $result['detection_method'] = 'user_agent';
            return $result;
        }

        // Check IP ranges
        if ($this->checkIpRange($ipAddress)) {
            $result['is_bot'] = true;
            $result['bot_name'] = 'Unknown-AI-Bot';
            $result['confidence'] = 0.7;
            $result['detection_method'] = 'ip_range';
            return $result;
        }

        return $result;
    }

    /**
     * Check user agent against bot patterns
     * 
     * @param string $userAgent User agent string
     * @return string|null Bot name if detected
     */
    private function checkUserAgent(string $userAgent): ?string
    {
        // Check default patterns
        foreach ($this->botPatterns as $botName => $patterns) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $userAgent)) {
                    return $botName;
                }
            }
        }

        // Check custom patterns
        foreach ($this->customPatterns as $botName => $patterns) {
            foreach ($patterns as $pattern) {
                if (preg_match($pattern, $userAgent)) {
                    return $botName;
                }
            }
        }

        return null;
    }

    /**
     * Check if IP address is in known AI service ranges
     * 
     * @param string $ipAddress IP address to check
     * @return bool True if IP is in known range
     */
    private function checkIpRange(string $ipAddress): bool
    {
        foreach ($this->ipRanges as $range) {
            if ($this->ipInRange($ipAddress, $range)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check if IP address is within a CIDR range
     * 
     * @param string $ip IP address
     * @param string $range CIDR range
     * @return bool True if IP is in range
     */
    private function ipInRange(string $ip, string $range): bool
    {
        if (strpos($range, '/') === false) {
            return $ip === $range;
        }

        list($subnet, $bits) = explode('/', $range);
        
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return $this->ipv4InRange($ip, $subnet, (int)$bits);
        } elseif (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            return $this->ipv6InRange($ip, $subnet, (int)$bits);
        }

        return false;
    }

    /**
     * Check if IPv4 address is in range
     * 
     * @param string $ip IPv4 address
     * @param string $subnet Subnet
     * @param int $bits Subnet bits
     * @return bool True if in range
     */
    private function ipv4InRange(string $ip, string $subnet, int $bits): bool
    {
        $ip = ip2long($ip);
        $subnet = ip2long($subnet);
        $mask = -1 << (32 - $bits);
        
        return ($ip & $mask) === ($subnet & $mask);
    }

    /**
     * Check if IPv6 address is in range
     * 
     * @param string $ip IPv6 address
     * @param string $subnet Subnet
     * @param int $bits Subnet bits
     * @return bool True if in range
     */
    private function ipv6InRange(string $ip, string $subnet, int $bits): bool
    {
        $ip = inet_pton($ip);
        $subnet = inet_pton($subnet);
        
        if ($ip === false || $subnet === false) {
            return false;
        }

        $bytesToCheck = intval($bits / 8);
        $bitsToCheck = $bits % 8;

        for ($i = 0; $i < $bytesToCheck; $i++) {
            if ($ip[$i] !== $subnet[$i]) {
                return false;
            }
        }

        if ($bitsToCheck > 0) {
            $mask = 0xFF << (8 - $bitsToCheck);
            return (ord($ip[$bytesToCheck]) & $mask) === (ord($subnet[$bytesToCheck]) & $mask);
        }

        return true;
    }

    /**
     * Add custom bot pattern
     * 
     * @param string $botName Bot name
     * @param array $patterns Array of regex patterns
     */
    public function addBotPattern(string $botName, array $patterns): void
    {
        $this->customPatterns[$botName] = $patterns;
    }

    /**
     * Add IP range
     * 
     * @param string $range CIDR range
     */
    public function addIpRange(string $range): void
    {
        $this->ipRanges[] = $range;
    }

    /**
     * Get all bot patterns
     * 
     * @return array All bot patterns
     */
    public function getBotPatterns(): array
    {
        return array_merge($this->botPatterns, $this->customPatterns);
    }

    /**
     * Get all IP ranges
     * 
     * @return array All IP ranges
     */
    public function getIpRanges(): array
    {
        return $this->ipRanges;
    }
}
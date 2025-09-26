<?php

namespace AiBotTracker;

/**
 * RequestClassifier - Classifies bot requests as indexing or retrieval
 */
class RequestClassifier
{
    /**
     * @var array URL patterns for indexing requests
     */
    private $indexingPatterns = [
        '/\/sitemap.*\.xml$/i',
        '/\/robots\.txt$/i',
        '/\/feed\/?$/i',
        '/\/rss\/?$/i',
        '/\/atom\/?$/i',
        '/\/archive\//i',
        '/\/category\//i',
        '/\/tag\//i',
        '/\/page\/\d+/i',
        '/\/\d{4}\/\d{2}\//i',  // Date-based URLs
        '/\/blog\//i',
        '/\/news\//i',
        '/\/articles\//i'
    ];

    /**
     * @var array URL patterns for retrieval requests
     */
    private $retrievalPatterns = [
        '/\/api\//i',
        '/\/search/i',
        '/\/query/i',
        '/\/ask/i',
        '/\/chat/i',
        '/\/assistant/i',
        '/\/completion/i',
        '/\/generate/i',
        '/\/v\d+\//i',  // API versioning
        '/\.json$/i',
        '/\.xml$/i'
    ];

    /**
     * @var array Headers that indicate retrieval requests
     */
    private $retrievalHeaders = [
        'x-openai-assistant-id',
        'x-openai-thread-id',
        'x-claude-conversation-id',
        'x-perplexity-session-id',
        'x-custom-ai-session',
        'authorization',
        'x-api-key',
        'x-requested-with'
    ];

    /**
     * @var array User agent patterns for retrieval
     */
    private $retrievalUserAgents = [
        '/ChatGPT-User/i',
        '/Claude-Web/i',
        '/Perplexity/i',
        '/Assistant/i',
        '/API/i'
    ];

    /**
     * @var array Referer patterns for retrieval
     */
    private $retrievalReferers = [
        '/chat\.openai\.com/i',
        '/claude\.ai/i',
        '/perplexity\.ai/i',
        '/bard\.google\.com/i',
        '/copilot\.microsoft\.com/i'
    ];

    /**
     * @var array Request frequency tracking
     */
    private $requestFrequency = [];

    /**
     * @var array Custom classification rules
     */
    private $customRules = [];

    /**
     * Constructor
     * 
     * @param array $customRules Custom classification rules
     */
    public function __construct(array $customRules = [])
    {
        $this->customRules = $customRules;
        
        // Merge custom patterns if provided
        if (isset($customRules['indexing_patterns'])) {
            $this->indexingPatterns = array_merge(
                $this->indexingPatterns,
                $customRules['indexing_patterns']
            );
        }
        
        if (isset($customRules['retrieval_patterns'])) {
            $this->retrievalPatterns = array_merge(
                $this->retrievalPatterns,
                $customRules['retrieval_patterns']
            );
        }
        
        if (isset($customRules['retrieval_headers'])) {
            $this->retrievalHeaders = array_merge(
                $this->retrievalHeaders,
                $customRules['retrieval_headers']
            );
        }
    }

    /**
     * Classify a bot request
     * 
     * @param array $requestData Request data
     * @return array Classification result
     */
    public function classifyRequest(array $requestData): array
    {
        $url = $requestData['url'] ?? '';
        $headers = $requestData['headers'] ?? [];
        $userAgent = $requestData['user_agent'] ?? '';
        $referer = $requestData['referer'] ?? '';
        $method = $requestData['method'] ?? 'GET';
        $ipAddress = $requestData['ip_address'] ?? '';
        $botName = $requestData['bot_name'] ?? '';

        $scores = [
            'indexing' => 0,
            'retrieval' => 0
        ];

        $reasons = [];

        // URL pattern analysis
        $urlScore = $this->analyzeUrl($url);
        $scores['indexing'] += $urlScore['indexing'];
        $scores['retrieval'] += $urlScore['retrieval'];
        $reasons = array_merge($reasons, $urlScore['reasons']);

        // Header analysis
        $headerScore = $this->analyzeHeaders($headers);
        $scores['indexing'] += $headerScore['indexing'];
        $scores['retrieval'] += $headerScore['retrieval'];
        $reasons = array_merge($reasons, $headerScore['reasons']);

        // User agent analysis
        $uaScore = $this->analyzeUserAgent($userAgent);
        $scores['indexing'] += $uaScore['indexing'];
        $scores['retrieval'] += $uaScore['retrieval'];
        $reasons = array_merge($reasons, $uaScore['reasons']);

        // Referer analysis
        $refererScore = $this->analyzeReferer($referer);
        $scores['indexing'] += $refererScore['indexing'];
        $scores['retrieval'] += $refererScore['retrieval'];
        $reasons = array_merge($reasons, $refererScore['reasons']);

        // Request frequency analysis
        $frequencyScore = $this->analyzeRequestFrequency($ipAddress, $botName);
        $scores['indexing'] += $frequencyScore['indexing'];
        $scores['retrieval'] += $frequencyScore['retrieval'];
        $reasons = array_merge($reasons, $frequencyScore['reasons']);

        // HTTP method analysis
        $methodScore = $this->analyzeMethod($method);
        $scores['indexing'] += $methodScore['indexing'];
        $scores['retrieval'] += $methodScore['retrieval'];
        $reasons = array_merge($reasons, $methodScore['reasons']);

        // Determine classification
        $classification = $scores['retrieval'] > $scores['indexing'] ? 'retrieval' : 'indexing';
        $confidence = $this->calculateConfidence($scores);

        return [
            'classification' => $classification,
            'confidence' => $confidence,
            'scores' => $scores,
            'reasons' => $reasons
        ];
    }

    /**
     * Analyze URL patterns
     * 
     * @param string $url URL to analyze
     * @return array Analysis result
     */
    private function analyzeUrl(string $url): array
    {
        $scores = ['indexing' => 0, 'retrieval' => 0];
        $reasons = [];

        // Check indexing patterns
        foreach ($this->indexingPatterns as $pattern) {
            if (preg_match($pattern, $url)) {
                $scores['indexing'] += 3;
                $reasons[] = "URL matches indexing pattern: {$pattern}";
                break;
            }
        }

        // Check retrieval patterns
        foreach ($this->retrievalPatterns as $pattern) {
            if (preg_match($pattern, $url)) {
                $scores['retrieval'] += 3;
                $reasons[] = "URL matches retrieval pattern: {$pattern}";
                break;
            }
        }

        return ['indexing' => $scores['indexing'], 'retrieval' => $scores['retrieval'], 'reasons' => $reasons];
    }

    /**
     * Analyze request headers
     * 
     * @param array $headers Request headers
     * @return array Analysis result
     */
    private function analyzeHeaders(array $headers): array
    {
        $scores = ['indexing' => 0, 'retrieval' => 0];
        $reasons = [];

        // Convert headers to lowercase for case-insensitive comparison
        $lowerHeaders = array_change_key_case($headers, CASE_LOWER);

        // Check for retrieval headers
        foreach ($this->retrievalHeaders as $header) {
            if (isset($lowerHeaders[strtolower($header)])) {
                $scores['retrieval'] += 2;
                $reasons[] = "Has retrieval header: {$header}";
            }
        }

        // Check for common indexing headers
        if (isset($lowerHeaders['accept']) && 
            strpos($lowerHeaders['accept'], 'text/html') !== false) {
            $scores['indexing'] += 1;
            $reasons[] = "Accepts HTML content (indexing behavior)";
        }

        // Check for API-related headers
        if (isset($lowerHeaders['content-type']) && 
            strpos($lowerHeaders['content-type'], 'application/json') !== false) {
            $scores['retrieval'] += 1;
            $reasons[] = "JSON content type (API behavior)";
        }

        return ['indexing' => $scores['indexing'], 'retrieval' => $scores['retrieval'], 'reasons' => $reasons];
    }

    /**
     * Analyze user agent
     * 
     * @param string $userAgent User agent string
     * @return array Analysis result
     */
    private function analyzeUserAgent(string $userAgent): array
    {
        $scores = ['indexing' => 0, 'retrieval' => 0];
        $reasons = [];

        // Check retrieval user agent patterns
        foreach ($this->retrievalUserAgents as $pattern) {
            if (preg_match($pattern, $userAgent)) {
                $scores['retrieval'] += 2;
                $reasons[] = "User agent matches retrieval pattern: {$pattern}";
                break;
            }
        }

        // Default indexing behavior for standard bot user agents
        if (preg_match('/bot|crawler|spider/i', $userAgent) && 
            !preg_match('/ChatGPT-User|Claude-Web|Assistant/i', $userAgent)) {
            $scores['indexing'] += 1;
            $reasons[] = "Standard bot user agent (indexing behavior)";
        }

        return ['indexing' => $scores['indexing'], 'retrieval' => $scores['retrieval'], 'reasons' => $reasons];
    }

    /**
     * Analyze referer
     * 
     * @param string $referer Referer header
     * @return array Analysis result
     */
    private function analyzeReferer(string $referer): array
    {
        $scores = ['indexing' => 0, 'retrieval' => 0];
        $reasons = [];

        if (empty($referer)) {
            $scores['indexing'] += 1;
            $reasons[] = "No referer (typical indexing behavior)";
            return ['indexing' => $scores['indexing'], 'retrieval' => $scores['retrieval'], 'reasons' => $reasons];
        }

        // Check retrieval referer patterns
        foreach ($this->retrievalReferers as $pattern) {
            if (preg_match($pattern, $referer)) {
                $scores['retrieval'] += 3;
                $reasons[] = "Referer matches retrieval pattern: {$pattern}";
                break;
            }
        }

        return ['indexing' => $scores['indexing'], 'retrieval' => $scores['retrieval'], 'reasons' => $reasons];
    }

    /**
     * Analyze request frequency
     * 
     * @param string $ipAddress IP address
     * @param string $botName Bot name
     * @return array Analysis result
     */
    private function analyzeRequestFrequency(string $ipAddress, string $botName): array
    {
        $scores = ['indexing' => 0, 'retrieval' => 0];
        $reasons = [];

        $key = $ipAddress . ':' . $botName;
        $now = time();

        // Initialize tracking if not exists
        if (!isset($this->requestFrequency[$key])) {
            $this->requestFrequency[$key] = [];
        }

        // Add current request
        $this->requestFrequency[$key][] = $now;

        // Clean old requests (older than 1 hour)
        $this->requestFrequency[$key] = array_filter(
            $this->requestFrequency[$key],
            function($timestamp) use ($now) {
                return ($now - $timestamp) <= 3600;
            }
        );

        $requestCount = count($this->requestFrequency[$key]);

        // High frequency suggests indexing
        if ($requestCount > 10) {
            $scores['indexing'] += 2;
            $reasons[] = "High request frequency ({$requestCount} requests/hour) suggests indexing";
        } elseif ($requestCount <= 3) {
            $scores['retrieval'] += 1;
            $reasons[] = "Low request frequency ({$requestCount} requests/hour) suggests retrieval";
        }

        return ['indexing' => $scores['indexing'], 'retrieval' => $scores['retrieval'], 'reasons' => $reasons];
    }

    /**
     * Analyze HTTP method
     * 
     * @param string $method HTTP method
     * @return array Analysis result
     */
    private function analyzeMethod(string $method): array
    {
        $scores = ['indexing' => 0, 'retrieval' => 0];
        $reasons = [];

        switch (strtoupper($method)) {
            case 'GET':
                // GET can be both, slight preference for indexing
                $scores['indexing'] += 0.5;
                break;
            case 'POST':
            case 'PUT':
            case 'PATCH':
                $scores['retrieval'] += 2;
                $reasons[] = "HTTP {$method} method suggests retrieval/API usage";
                break;
            case 'HEAD':
                $scores['indexing'] += 1;
                $reasons[] = "HTTP HEAD method suggests indexing behavior";
                break;
        }

        return ['indexing' => $scores['indexing'], 'retrieval' => $scores['retrieval'], 'reasons' => $reasons];
    }

    /**
     * Calculate confidence score
     * 
     * @param array $scores Classification scores
     * @return float Confidence score (0-1)
     */
    private function calculateConfidence(array $scores): float
    {
        $total = $scores['indexing'] + $scores['retrieval'];
        
        if ($total === 0) {
            return 0.5; // Neutral confidence
        }

        $maxScore = max($scores['indexing'], $scores['retrieval']);
        $confidence = $maxScore / $total;

        // Ensure confidence is between 0.5 and 1.0
        return max(0.5, min(1.0, $confidence));
    }

    /**
     * Add custom indexing pattern
     * 
     * @param string $pattern Regex pattern
     */
    public function addIndexingPattern(string $pattern): void
    {
        $this->indexingPatterns[] = $pattern;
    }

    /**
     * Add custom retrieval pattern
     * 
     * @param string $pattern Regex pattern
     */
    public function addRetrievalPattern(string $pattern): void
    {
        $this->retrievalPatterns[] = $pattern;
    }

    /**
     * Add custom retrieval header
     * 
     * @param string $header Header name
     */
    public function addRetrievalHeader(string $header): void
    {
        $this->retrievalHeaders[] = strtolower($header);
    }

    /**
     * Get classification patterns
     * 
     * @return array All classification patterns
     */
    public function getPatterns(): array
    {
        return [
            'indexing_patterns' => $this->indexingPatterns,
            'retrieval_patterns' => $this->retrievalPatterns,
            'retrieval_headers' => $this->retrievalHeaders,
            'retrieval_user_agents' => $this->retrievalUserAgents,
            'retrieval_referers' => $this->retrievalReferers
        ];
    }
}
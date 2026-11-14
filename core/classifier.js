/**
 * Request Classification System
 * Classifies bot requests as 'indexing' or 'retrieval' based on heuristics
 */

class RequestClassifier {
    constructor() {
        // Patterns that indicate indexing behavior
        this.indexingIndicators = {
            userAgentPatterns: [
                /crawler/i,
                /spider/i,
                /indexer/i,
                /scraper/i,
                /bot.*crawl/i
            ],
            urlPatterns: [
                /robots\.txt$/,
                /sitemap.*\.xml$/,
                /\.rss$/,
                /\.atom$/
            ],
            headerPatterns: {
                // Headers that suggest automated crawling
                'accept': [
                    /text\/html.*application\/xhtml/,  // Broad HTML acceptance
                    /\*\/\*/  // Accept all content types
                ],
                'user-agent': [
                    /curl/i,
                    /wget/i,
                    /python-requests/i
                ]
            }
        };

        // Patterns that indicate retrieval behavior
        this.retrievalIndicators = {
            headerPatterns: {
                'x-openai-assistant-app-id': /.+/,
                'x-openai-request-id': /.+/,
                'x-claude-request-id': /.+/,
                'x-perplexity-request-id': /.+/,
                'openai-conversation-id': /.+/,
                'openai-ephemeral-user-id': /.+/
            },
            refererPatterns: [
                /chat\.openai\.com/i,
                /claude\.ai/i,
                /perplexity\.ai/i,
                /copilot\.microsoft\.com/i,
                /bard\.google\.com/i,
                /you\.com/i
            ],
            queryParams: [
                'conversation_id',
                'chat_id',
                'query_id',
                'search_id'
            ]
        };

        // Request frequency tracking for pattern analysis
        this.requestHistory = new Map();
        this.maxHistorySize = 10000;
        this.cleanupInterval = 60 * 60 * 1000; // 1 hour

        // Start cleanup interval
        this.startCleanupInterval();
    }

    /**
     * Classify a request as indexing or retrieval
     * @param {Object} requestData - Request information
     * @returns {Object} Classification result
     */
    classifyRequest(requestData) {
        const {
            userAgent,
            headers = {},
            url,
            ipAddress,
            referer,
            timestamp = new Date()
        } = requestData;

        // Vendors declare why they crawl in the user agent; trust that over heuristics.
        if (['training', 'indexing', 'retrieval'].includes(requestData.purpose)) {
            return {
                classification: requestData.purpose,
                confidence: 0.95,
                reasons: [`Declared purpose of ${requestData.botName || 'this bot'}`],
                scores: { indexing: 0, retrieval: 0 }
            };
        }

        // Track request for frequency analysis
        this.trackRequest(ipAddress, userAgent, timestamp);

        // Calculate scores for each classification
        const indexingScore = this.calculateIndexingScore(requestData);
        const retrievalScore = this.calculateRetrievalScore(requestData);

        // Determine classification based on scores
        let classification = 'unknown';
        let confidence = 0;
        let reasons = [];

        if (indexingScore > retrievalScore && indexingScore > 0.3) {
            classification = 'indexing';
            confidence = Math.min(indexingScore, 1.0);
            reasons = this.getIndexingReasons(requestData);
        } else if (retrievalScore > indexingScore && retrievalScore > 0.3) {
            classification = 'retrieval';
            confidence = Math.min(retrievalScore, 1.0);
            reasons = this.getRetrievalReasons(requestData);
        }

        return {
            classification,
            confidence,
            reasons,
            scores: {
                indexing: indexingScore,
                retrieval: retrievalScore
            }
        };
    }

    /**
     * Calculate indexing behavior score
     * @param {Object} requestData - Request information
     * @returns {number} Indexing score (0-1)
     */
    calculateIndexingScore(requestData) {
        const { userAgent, headers, url, ipAddress, referer } = requestData;
        let score = 0;

        // Check user agent patterns
        for (const pattern of this.indexingIndicators.userAgentPatterns) {
            if (userAgent && pattern.test(userAgent)) {
                score += 0.4;
                break;
            }
        }

        // Check URL patterns
        for (const pattern of this.indexingIndicators.urlPatterns) {
            if (url && pattern.test(url)) {
                score += 0.3;
                break;
            }
        }

        // Check header patterns
        for (const [headerName, patterns] of Object.entries(this.indexingIndicators.headerPatterns)) {
            const headerValue = headers[headerName] || headers[headerName.toLowerCase()];
            if (headerValue) {
                for (const pattern of patterns) {
                    if (pattern.test(headerValue)) {
                        score += 0.2;
                        break;
                    }
                }
            }
        }

        // Check request frequency (high frequency suggests indexing)
        const frequency = this.getRequestFrequency(ipAddress, userAgent);
        if (frequency > 10) { // More than 10 requests in tracking window
            score += 0.3;
        } else if (frequency > 5) {
            score += 0.2;
        }

        // No referer often indicates automated crawling
        if (!referer || referer === '-') {
            score += 0.2;
        }

        // Sequential URL patterns (simplified check)
        if (this.hasSequentialPattern(ipAddress, url)) {
            score += 0.3;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Calculate retrieval behavior score
     * @param {Object} requestData - Request information
     * @returns {number} Retrieval score (0-1)
     */
    calculateRetrievalScore(requestData) {
        const { userAgent, headers, url, referer } = requestData;
        let score = 0;

        // Check for AI service specific headers
        for (const [headerName, pattern] of Object.entries(this.retrievalIndicators.headerPatterns)) {
            const headerValue = headers[headerName] || headers[headerName.toLowerCase()];
            if (headerValue && pattern.test(headerValue)) {
                score += 0.5;
            }
        }

        // Check referer patterns
        if (referer) {
            for (const pattern of this.retrievalIndicators.refererPatterns) {
                if (pattern.test(referer)) {
                    score += 0.4;
                    break;
                }
            }
        }

        // Check for query parameters that suggest user-driven requests
        if (url) {
            let urlObj = null;
            try { urlObj = new URL(url, 'http://example.com'); } catch { /* malformed URL */ }
            for (const param of urlObj ? this.retrievalIndicators.queryParams : []) {
                if (urlObj.searchParams.has(param)) {
                    score += 0.3;
                    break;
                }
            }
        }

        // Check for human-like user agents
        if (userAgent) {
            if (/Mozilla.*Chrome|Mozilla.*Firefox|Mozilla.*Safari/i.test(userAgent)) {
                score += 0.2;
            }
        }

        // Presence of referer suggests user-driven request
        if (referer && referer !== '-') {
            score += 0.2;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Track request for frequency analysis
     * @param {string} ipAddress - Client IP
     * @param {string} userAgent - User agent
     * @param {Date} timestamp - Request timestamp
     */
    trackRequest(ipAddress, userAgent, timestamp) {
        const key = `${ipAddress}:${userAgent}`;
        
        if (!this.requestHistory.has(key)) {
            this.requestHistory.set(key, []);
        }

        const requests = this.requestHistory.get(key);
        requests.push(timestamp);

        // Keep only recent requests (last hour)
        const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);
        const recentRequests = requests.filter(t => t > oneHourAgo);
        this.requestHistory.set(key, recentRequests);

        // Cleanup if history gets too large
        if (this.requestHistory.size > this.maxHistorySize) {
            this.cleanupOldEntries();
        }
    }

    /**
     * Get request frequency for IP/User-Agent combination
     * @param {string} ipAddress - Client IP
     * @param {string} userAgent - User agent
     * @returns {number} Number of requests in the last hour
     */
    getRequestFrequency(ipAddress, userAgent) {
        const key = `${ipAddress}:${userAgent}`;
        const requests = this.requestHistory.get(key) || [];
        return requests.length;
    }

    /**
     * Check for sequential URL patterns (simplified)
     * @param {string} ipAddress - Client IP
     * @param {string} url - Current URL
     * @returns {boolean} Whether sequential pattern is detected
     */
    hasSequentialPattern(ipAddress, url) {
        // This is a simplified implementation
        // In practice, you'd analyze URL patterns more thoroughly
        const key = `${ipAddress}:urls`;
        
        if (!this.requestHistory.has(key)) {
            this.requestHistory.set(key, []);
        }

        const urls = this.requestHistory.get(key);
        urls.push(url);

        // Keep only last 10 URLs
        if (urls.length > 10) {
            urls.shift();
        }

        // Simple check for numeric sequences in URLs
        const numericUrls = urls.filter(u => /\/\d+/.test(u));
        return numericUrls.length > 3;
    }

    /**
     * Get reasons for indexing classification
     * @param {Object} requestData - Request information
     * @returns {Array} Array of reason strings
     */
    getIndexingReasons(requestData) {
        const reasons = [];
        const { userAgent, headers, url, referer } = requestData;

        if (userAgent) {
            for (const pattern of this.indexingIndicators.userAgentPatterns) {
                if (pattern.test(userAgent)) {
                    reasons.push('Bot/crawler user agent detected');
                    break;
                }
            }
        }

        if (url) {
            for (const pattern of this.indexingIndicators.urlPatterns) {
                if (pattern.test(url)) {
                    reasons.push('Accessing indexing-related resources');
                    break;
                }
            }
        }

        if (!referer || referer === '-') {
            reasons.push('No referer (typical of automated requests)');
        }

        return reasons;
    }

    /**
     * Get reasons for retrieval classification
     * @param {Object} requestData - Request information
     * @returns {Array} Array of reason strings
     */
    getRetrievalReasons(requestData) {
        const reasons = [];
        const { headers, referer } = requestData;

        for (const headerName of Object.keys(this.retrievalIndicators.headerPatterns)) {
            if (headers[headerName] || headers[headerName.toLowerCase()]) {
                reasons.push(`AI service header detected: ${headerName}`);
            }
        }

        if (referer) {
            for (const pattern of this.retrievalIndicators.refererPatterns) {
                if (pattern.test(referer)) {
                    reasons.push('Referer from AI chat interface');
                    break;
                }
            }
        }

        return reasons;
    }

    /**
     * Start cleanup interval for request history
     */
    startCleanupInterval() {
        this.cleanupTimer = setInterval(() => {
            this.cleanupOldEntries();
        }, this.cleanupInterval);
        this.cleanupTimer.unref(); // never keep the process alive
    }

    /**
     * Clean up old entries from request history
     */
    cleanupOldEntries() {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        for (const [key, requests] of this.requestHistory.entries()) {
            if (Array.isArray(requests)) {
                const recentRequests = requests.filter(t => t > oneHourAgo);
                if (recentRequests.length === 0) {
                    this.requestHistory.delete(key);
                } else {
                    this.requestHistory.set(key, recentRequests);
                }
            }
        }
    }

    /**
     * Get classification statistics
     * @returns {Object} Statistics about classifications
     */
    getStats() {
        return {
            trackedEntries: this.requestHistory.size,
            maxHistorySize: this.maxHistorySize
        };
    }
}

module.exports = RequestClassifier;
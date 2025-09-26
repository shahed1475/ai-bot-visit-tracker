/**
 * AI Bot Detection System
 * Identifies AI bots based on user-agent patterns and IP ranges
 */

class BotDetector {
    constructor() {
        this.botPatterns = {
            'GPTBot': [
                /GPTBot/i,
                /ChatGPT-User/i,
                /OpenAI/i
            ],
            'ClaudeBot': [
                /ClaudeBot/i,
                /Claude-Web/i,
                /Anthropic/i
            ],
            'PerplexityBot': [
                /PerplexityBot/i,
                /Perplexity/i
            ],
            'Google-Extended': [
                /Google-Extended/i,
                /GoogleOther/i
            ],
            'CCBot': [
                /CCBot/i,
                /CommonCrawl/i
            ],
            'BingBot': [
                /bingbot/i,
                /BingPreview/i
            ],
            'FacebookBot': [
                /facebookexternalhit/i,
                /FacebookBot/i
            ],
            'TwitterBot': [
                /Twitterbot/i,
                /TwitterAPI/i
            ],
            'LinkedInBot': [
                /LinkedInBot/i,
                /LinkedIn/i
            ],
            'SlackBot': [
                /Slackbot/i,
                /Slack-ImgProxy/i
            ],
            'DiscordBot': [
                /Discordbot/i,
                /Discord/i
            ],
            'TelegramBot': [
                /TelegramBot/i,
                /Telegram/i
            ],
            'WhatsAppBot': [
                /WhatsApp/i,
                /WhatsAppBot/i
            ],
            'AppleBot': [
                /Applebot/i,
                /AppleNewsBot/i
            ],
            'YandexBot': [
                /YandexBot/i,
                /YandexImages/i
            ],
            'BaiduSpider': [
                /Baiduspider/i,
                /BaiduBot/i
            ],
            'DuckDuckBot': [
                /DuckDuckBot/i,
                /DuckDuckGo/i
            ]
        };

        // Known IP ranges for major AI services (examples - should be updated regularly)
        this.botIPRanges = {
            'OpenAI': [
                '20.15.240.64/26',
                '20.15.240.128/25',
                '20.15.241.0/24'
            ],
            'Anthropic': [
                // Add known Anthropic IP ranges
            ],
            'Google': [
                '66.249.64.0/19',
                '64.233.160.0/19',
                '72.14.192.0/18'
            ]
        };
    }

    /**
     * Detect if a request is from an AI bot
     * @param {string} userAgent - Request user agent
     * @param {string} ipAddress - Client IP address
     * @returns {Object} Detection result with bot name and confidence
     */
    detectBot(userAgent, ipAddress) {
        if (!userAgent) {
            return { isBot: false, botName: null, confidence: 0 };
        }

        // Check user-agent patterns
        for (const [botName, patterns] of Object.entries(this.botPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(userAgent)) {
                    return {
                        isBot: true,
                        botName: botName,
                        confidence: 0.9,
                        detectionMethod: 'user-agent'
                    };
                }
            }
        }

        // Check IP ranges (if IP checking is enabled)
        const ipResult = this.checkIPRanges(ipAddress);
        if (ipResult.isBot) {
            return ipResult;
        }

        // Check for generic bot indicators
        const genericBotPatterns = [
            /bot/i,
            /crawler/i,
            /spider/i,
            /scraper/i,
            /fetcher/i,
            /indexer/i
        ];

        for (const pattern of genericBotPatterns) {
            if (pattern.test(userAgent)) {
                return {
                    isBot: true,
                    botName: 'Generic Bot',
                    confidence: 0.6,
                    detectionMethod: 'generic-pattern'
                };
            }
        }

        return { isBot: false, botName: null, confidence: 0 };
    }

    /**
     * Check if IP address belongs to known bot ranges
     * @param {string} ipAddress - Client IP address
     * @returns {Object} Detection result
     */
    checkIPRanges(ipAddress) {
        // This is a simplified implementation
        // In production, use a proper IP range checking library
        for (const [service, ranges] of Object.entries(this.botIPRanges)) {
            // Simplified check - in real implementation, use proper CIDR matching
            if (this.isIPInRanges(ipAddress, ranges)) {
                return {
                    isBot: true,
                    botName: `${service} Bot`,
                    confidence: 0.8,
                    detectionMethod: 'ip-range'
                };
            }
        }
        return { isBot: false, botName: null, confidence: 0 };
    }

    /**
     * Simplified IP range checking (use proper library in production)
     * @param {string} ip - IP address to check
     * @param {Array} ranges - Array of CIDR ranges
     * @returns {boolean} Whether IP is in any of the ranges
     */
    isIPInRanges(ip, ranges) {
        // This is a placeholder - implement proper CIDR matching
        // For production, use libraries like 'ip-range-check' or 'netmask'
        return false;
    }

    /**
     * Get all supported bot names
     * @returns {Array} Array of bot names
     */
    getSupportedBots() {
        return Object.keys(this.botPatterns);
    }

    /**
     * Add custom bot pattern
     * @param {string} botName - Name of the bot
     * @param {RegExp} pattern - Regular expression pattern
     */
    addBotPattern(botName, pattern) {
        if (!this.botPatterns[botName]) {
            this.botPatterns[botName] = [];
        }
        this.botPatterns[botName].push(pattern);
    }
}

module.exports = BotDetector;
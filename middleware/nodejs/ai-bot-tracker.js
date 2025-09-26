const path = require('path');
const fs = require('fs');

// Import core modules from the main project
const BotDetector = require('../../core/bot-detector');
const Classifier = require('../../core/classifier');
const Database = require('../../core/database');

/**
 * AI Bot Visit Tracker - Node.js Express Middleware
 * 
 * This middleware intercepts incoming requests, detects AI bots,
 * classifies their behavior, and logs visit data to the database.
 */
class AiBotTracker {
    constructor(options = {}) {
        this.options = {
            // Database configuration
            database: {
                type: options.database?.type || 'sqlite',
                path: options.database?.path || path.join(__dirname, '../../data/bot_visits.db'),
                host: options.database?.host || 'localhost',
                port: options.database?.port || 5432,
                name: options.database?.name || 'bot_tracker',
                user: options.database?.user || 'postgres',
                password: options.database?.password || ''
            },
            
            // Logging configuration
            enableLogging: options.enableLogging !== false,
            logLevel: options.logLevel || 'info',
            
            // Bot detection configuration
            customBots: options.customBots || [],
            
            // Classification configuration
            classificationRules: options.classificationRules || {},
            
            // Performance configuration
            enableAsync: options.enableAsync !== false,
            
            // Response configuration
            addHeaders: options.addHeaders !== false,
            headerPrefix: options.headerPrefix || 'X-Bot-Tracker-'
        };

        this.database = null;
        this.botDetector = null;
        this.classifier = null;
        this.initialized = false;
        this.requestStartTime = null;
    }

    /**
     * Initialize the middleware components
     */
    async initialize() {
        try {
            // Initialize database
            this.database = new Database(this.options.database);
            await this.database.connect();

            // Initialize bot detector
            this.botDetector = new BotDetector();
            if (this.options.customBots.length > 0) {
                this.botDetector.addCustomBots(this.options.customBots);
            }

            // Initialize classifier
            this.classifier = new Classifier(this.options.classificationRules);

            this.initialized = true;
            
            if (this.options.enableLogging) {
                console.log('[AI Bot Tracker] Middleware initialized successfully');
            }
        } catch (error) {
            console.error('[AI Bot Tracker] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Express middleware function
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Express next function
     */
    middleware() {
        return async (req, res, next) => {
            // Initialize if not already done
            if (!this.initialized) {
                try {
                    await this.initialize();
                } catch (error) {
                    console.error('[AI Bot Tracker] Failed to initialize middleware:', error);
                    return next();
                }
            }

            // Record request start time
            this.requestStartTime = Date.now();

            // Extract request data
            const requestData = this.extractRequestData(req);

            // Detect if this is a bot
            const botInfo = this.botDetector.detectBot(requestData.userAgent, requestData.ipAddress);

            if (botInfo) {
                // Override res.end to capture response data
                const originalEnd = res.end;
                const self = this;

                res.end = function(chunk, encoding) {
                    // Call original end method
                    originalEnd.call(this, chunk, encoding);

                    // Process bot visit asynchronously
                    if (self.options.enableAsync) {
                        setImmediate(() => self.processBotVisit(requestData, botInfo, res));
                    } else {
                        self.processBotVisit(requestData, botInfo, res);
                    }
                };

                // Add tracking headers if enabled
                if (this.options.addHeaders) {
                    res.setHeader(`${this.options.headerPrefix}Detected`, 'true');
                    res.setHeader(`${this.options.headerPrefix}Bot-Name`, botInfo.name);
                    res.setHeader(`${this.options.headerPrefix}Bot-Type`, botInfo.type);
                }
            }

            next();
        };
    }

    /**
     * Extract relevant data from the request
     * @param {Object} req - Express request object
     * @returns {Object} Extracted request data
     */
    extractRequestData(req) {
        return {
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent') || '',
            pageUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
            referer: req.get('Referer') || '',
            requestMethod: req.method,
            headers: req.headers,
            timestamp: new Date()
        };
    }

    /**
     * Get the real client IP address
     * @param {Object} req - Express request object
     * @returns {string} Client IP address
     */
    getClientIP(req) {
        return req.ip ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               req.headers['x-forwarded-for']?.split(',')[0] ||
               req.headers['x-real-ip'] ||
               '127.0.0.1';
    }

    /**
     * Process bot visit and log to database
     * @param {Object} requestData - Request information
     * @param {Object} botInfo - Bot detection result
     * @param {Object} res - Express response object
     */
    async processBotVisit(requestData, botInfo, res) {
        try {
            // Classify the request
            const classification = this.classifier.classifyRequest({
                url: requestData.pageUrl,
                headers: requestData.headers,
                userAgent: requestData.userAgent,
                referer: requestData.referer,
                ipAddress: requestData.ipAddress,
                timestamp: requestData.timestamp
            });

            // Calculate processing time
            const processingTime = Date.now() - this.requestStartTime;

            // Prepare visit data
            const visitData = {
                ipAddress: requestData.ipAddress,
                botName: botInfo.name,
                pageUrl: requestData.pageUrl,
                headers: JSON.stringify(requestData.headers),
                classification: classification.classification,
                responseStatus: res.statusCode,
                processingTime: processingTime,
                timestamp: requestData.timestamp,
                userAgent: requestData.userAgent,
                referer: requestData.referer,
                requestMethod: requestData.requestMethod,
                botType: botInfo.type,
                confidence: classification.confidence || 0,
                reasons: JSON.stringify(classification.reasons || [])
            };

            // Log to database
            await this.database.logVisit(visitData);

            if (this.options.enableLogging && this.options.logLevel === 'debug') {
                console.log('[AI Bot Tracker] Bot visit logged:', {
                    bot: botInfo.name,
                    url: requestData.pageUrl,
                    classification: classification.classification,
                    ip: requestData.ipAddress
                });
            }

        } catch (error) {
            console.error('[AI Bot Tracker] Error processing bot visit:', error);
        }
    }

    /**
     * Get visit statistics
     * @returns {Promise<Array>} Visit statistics
     */
    async getStats() {
        if (!this.database) {
            throw new Error('Database not initialized');
        }
        return await this.database.getStats();
    }

    /**
     * Get recent visits
     * @param {number} limit - Number of visits to retrieve
     * @returns {Promise<Array>} Recent visits
     */
    async getRecentVisits(limit = 50) {
        if (!this.database) {
            throw new Error('Database not initialized');
        }
        return await this.database.getRecentVisits(limit);
    }

    /**
     * Close database connection
     */
    async close() {
        if (this.database) {
            await this.database.close();
        }
    }
}

/**
 * Factory function to create middleware instance
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware function
 */
function createAiBotTracker(options = {}) {
    const tracker = new AiBotTracker(options);
    return tracker.middleware();
}

/**
 * Create middleware with custom configuration
 * @param {Object} options - Configuration options
 * @returns {AiBotTracker} Tracker instance
 */
function createTrackerInstance(options = {}) {
    return new AiBotTracker(options);
}

module.exports = {
    AiBotTracker,
    createAiBotTracker,
    createTrackerInstance
};
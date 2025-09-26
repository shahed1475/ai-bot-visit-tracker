/**
 * Request Logging System
 * Integrates bot detection, classification, and database logging
 */

const BotDetector = require('./bot-detector');
const RequestClassifier = require('./classifier');
const Database = require('./database');

class RequestLogger {
    constructor(config = {}) {
        this.config = {
            enableClassification: config.enableClassification !== false,
            enableIPLogging: config.enableIPLogging !== false,
            enableHeaderLogging: config.enableHeaderLogging !== false,
            logOnlyBots: config.logOnlyBots || false,
            excludeHeaders: config.excludeHeaders || [
                'authorization',
                'cookie',
                'x-api-key',
                'x-auth-token'
            ],
            ...config
        };

        this.botDetector = new BotDetector();
        this.classifier = new RequestClassifier();
        this.database = new Database(config.database);
        this.isInitialized = false;
    }

    /**
     * Initialize the logging system
     */
    async initialize() {
        try {
            await this.database.connect();
            this.isInitialized = true;
            console.log('Request Logger initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Request Logger:', error);
            throw error;
        }
    }

    /**
     * Log a request with bot detection and classification
     * @param {Object} requestData - Request information
     * @returns {Object} Logging result
     */
    async logRequest(requestData) {
        if (!this.isInitialized) {
            throw new Error('Request Logger not initialized. Call initialize() first.');
        }

        const startTime = Date.now();

        try {
            // Extract request information
            const {
                req,
                ipAddress,
                userAgent,
                url,
                headers = {},
                method = 'GET',
                responseStatus,
                timestamp = new Date()
            } = requestData;

            // If req object is provided, extract information from it
            let extractedData = requestData;
            if (req) {
                extractedData = this.extractRequestData(req);
            }

            // Detect if request is from a bot
            const botDetection = this.botDetector.detectBot(
                extractedData.userAgent,
                extractedData.ipAddress
            );

            // If configured to log only bots and this isn't a bot, skip logging
            if (this.config.logOnlyBots && !botDetection.isBot) {
                return {
                    success: true,
                    skipped: true,
                    reason: 'Not a bot request'
                };
            }

            // Classify the request if it's from a bot and classification is enabled
            let classification = { classification: 'unknown', confidence: 0, reasons: [] };
            if (botDetection.isBot && this.config.enableClassification) {
                classification = this.classifier.classifyRequest({
                    userAgent: extractedData.userAgent,
                    headers: extractedData.headers,
                    url: extractedData.url,
                    ipAddress: extractedData.ipAddress,
                    referer: extractedData.referer,
                    timestamp
                });
            }

            // Prepare data for database logging
            const visitData = {
                ipAddress: this.config.enableIPLogging ? extractedData.ipAddress : null,
                botName: botDetection.isBot ? botDetection.botName : null,
                pageUrl: extractedData.url,
                headers: this.config.enableHeaderLogging ? 
                    this.sanitizeHeaders(extractedData.headers) : {},
                classification: classification.classification,
                userAgent: extractedData.userAgent,
                referer: extractedData.referer,
                requestMethod: extractedData.method,
                responseStatus: extractedData.responseStatus,
                processingTimeMs: Date.now() - startTime
            };

            // Log to database
            const dbResult = await this.database.logVisit(visitData);

            return {
                success: dbResult.success,
                visitId: dbResult.visitId,
                botDetection,
                classification,
                processingTime: Date.now() - startTime,
                error: dbResult.error
            };

        } catch (error) {
            console.error('Error logging request:', error);
            return {
                success: false,
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Extract request data from Express/HTTP request object
     * @param {Object} req - Request object
     * @returns {Object} Extracted request data
     */
    extractRequestData(req) {
        return {
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent') || req.headers['user-agent'] || '',
            url: req.originalUrl || req.url || '',
            headers: req.headers || {},
            method: req.method || 'GET',
            referer: req.get('Referer') || req.get('Referrer') || req.headers.referer || req.headers.referrer || '',
            responseStatus: null // Will be set later if available
        };
    }

    /**
     * Get client IP address from request
     * @param {Object} req - Request object
     * @returns {string} Client IP address
     */
    getClientIP(req) {
        return req.ip ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               req.headers['x-real-ip'] ||
               req.headers['x-client-ip'] ||
               req.headers['cf-connecting-ip'] ||
               '127.0.0.1';
    }

    /**
     * Sanitize headers by removing sensitive information
     * @param {Object} headers - Request headers
     * @returns {Object} Sanitized headers
     */
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        
        // Remove sensitive headers
        for (const header of this.config.excludeHeaders) {
            delete sanitized[header];
            delete sanitized[header.toLowerCase()];
        }

        return sanitized;
    }

    /**
     * Create middleware function for Express
     * @param {Object} options - Middleware options
     * @returns {Function} Express middleware function
     */
    createExpressMiddleware(options = {}) {
        // Store reference to this logger instance
        const logger = this;
        
        return async (req, res, next) => {
            const startTime = Date.now();

            // Store original end function
            const originalEnd = res.end;

            // Override res.end to capture response status
            res.end = function(...args) {
                // Log the request using the correct logger context
                setImmediate(async () => {
                    try {
                        // Fixed: Use logger reference instead of incorrect 'this' binding
                        await logger.logRequest({
                            req,
                            responseStatus: res.statusCode,
                            processingTimeMs: Date.now() - startTime
                        });
                    } catch (error) {
                        console.error('Error in logging middleware:', error);
                    }
                });

                // Call original end function
                originalEnd.apply(res, args);
            };

            next();
        };
    }

    /**
     * Get logging statistics
     * @returns {Object} Statistics about logged requests
     */
    async getStats() {
        if (!this.isInitialized) {
            return { error: 'Logger not initialized' };
        }

        try {
            const botStats = await this.database.getBotStats();
            const classifierStats = this.classifier.getStats();
            
            return {
                botStats,
                classifierStats,
                supportedBots: this.botDetector.getSupportedBots(),
                config: {
                    enableClassification: this.config.enableClassification,
                    enableIPLogging: this.config.enableIPLogging,
                    enableHeaderLogging: this.config.enableHeaderLogging,
                    logOnlyBots: this.config.logOnlyBots
                }
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Export logged data
     * @param {Object} filters - Export filters
     * @param {string} format - Export format ('json' or 'csv')
     * @returns {Object} Export result
     */
    async exportData(filters = {}, format = 'json') {
        if (!this.isInitialized) {
            throw new Error('Logger not initialized');
        }

        try {
            const data = await this.database.exportToJSON(filters);
            
            if (format === 'csv') {
                return this.convertToCSV(data);
            }
            
            return {
                format: 'json',
                data,
                count: data.length
            };
        } catch (error) {
            throw new Error(`Export failed: ${error.message}`);
        }
    }

    /**
     * Convert data to CSV format
     * @param {Array} data - Data to convert
     * @returns {Object} CSV export result
     */
    convertToCSV(data) {
        if (data.length === 0) {
            return { format: 'csv', data: '', count: 0 };
        }

        // Get headers from first record
        const headers = Object.keys(data[0]).filter(key => key !== 'headers');
        
        // Create CSV content
        let csv = headers.join(',') + '\n';
        
        for (const record of data) {
            const row = headers.map(header => {
                let value = record[header];
                if (value === null || value === undefined) {
                    value = '';
                } else if (typeof value === 'string' && value.includes(',')) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csv += row.join(',') + '\n';
        }

        return {
            format: 'csv',
            data: csv,
            count: data.length
        };
    }

    /**
     * Clean up old logs
     * @param {number} retentionDays - Number of days to retain logs
     * @returns {Object} Cleanup result
     */
    async cleanup(retentionDays = 365) {
        if (!this.isInitialized) {
            throw new Error('Logger not initialized');
        }

        try {
            const deletedCount = await this.database.cleanupOldVisits(retentionDays);
            return {
                success: true,
                deletedCount,
                retentionDays
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Close the logger and database connection
     */
    async close() {
        if (this.database) {
            await this.database.close();
        }
        this.isInitialized = false;
    }
}

module.exports = RequestLogger;
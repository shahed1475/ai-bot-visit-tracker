const path = require('path');
const BotDetector = require('../../core/bot-detector');
const Logger = require('../../core/logger');
const Database = require('../../core/database');

/**
 * AI Bot Visit Tracker Middleware for Express.js
 * 
 * This middleware detects AI bot visits, logs them to a database,
 * and classifies them as indexing or retrieval requests.
 */
class AiBotTracker {
    constructor(options = {}) {
        this.options = {
            // Database configuration
            database: {
                type: options.database?.type || 'sqlite',
                path: options.database?.path || path.join(__dirname, '../../data/bot_visits.db'),
                host: options.database?.host,
                port: options.database?.port,
                username: options.database?.username,
                password: options.database?.password,
                database: options.database?.database
            },
            
            // Logging configuration
            enableLogging: options.enableLogging !== false,
            logLevel: options.logLevel || 'info',
            
            // Bot detection configuration
            customBotPatterns: options.customBotPatterns || [],
            ipRanges: options.ipRanges || [],
            
            // Classification configuration
            classificationRules: options.classificationRules || {},
            
            // Performance options
            skipNonBots: options.skipNonBots !== false,
            asyncLogging: options.asyncLogging !== false
        };
        
        this.botDetector = new BotDetector({
            customPatterns: this.options.customBotPatterns,
            ipRanges: this.options.ipRanges
        });
        
        this.database = new Database(this.options.database);
        this.logger = new Logger(this.database, this.botDetector, this.options);
        
        this.initialized = false;
    }
    
    /**
     * Initialize the tracker (connect to database, setup schema)
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            await this.database.connect();
            await this.database.initialize();
            await this.logger.initialize();
            this.initialized = true;
            
            if (this.options.enableLogging) {
                console.log('[AiBotTracker] Initialized successfully');
            }
        } catch (error) {
            console.error('[AiBotTracker] Initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Express middleware function
     */
    middleware() {
        return async (req, res, next) => {
            try {
                // Initialize if not already done
                if (!this.initialized) {
                    await this.initialize();
                }
                
                // Quick bot detection check
                const botInfo = this.botDetector.detectBot(req.get('User-Agent'), req.ip);
                
                // Skip non-bots if configured to do so
                if (this.options.skipNonBots && !botInfo.isBot) {
                    return next();
                }
                
                // Log the request (async or sync based on configuration)
                if (this.options.asyncLogging) {
                    // Don't wait for logging to complete
                    this.logger.logRequest(req, botInfo).catch(error => {
                        if (this.options.enableLogging) {
                            console.error('[AiBotTracker] Async logging error:', error);
                        }
                    });
                } else {
                    // Wait for logging to complete
                    await this.logger.logRequest(req, botInfo);
                }
                
                // Add bot info to request object for downstream use
                req.botInfo = botInfo;
                
            } catch (error) {
                if (this.options.enableLogging) {
                    console.error('[AiBotTracker] Middleware error:', error);
                }
                // Don't block the request on errors
            }
            
            next();
        };
    }
    
    /**
     * Get statistics about bot visits
     */
    async getStats(options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        return await this.logger.getStats(options);
    }
    
    /**
     * Export data to CSV
     */
    async exportToCsv(filePath, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        return await this.logger.exportToCsv(filePath, options);
    }
    
    /**
     * Export data to JSON
     */
    async exportToJson(filePath, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        return await this.logger.exportToJson(filePath, options);
    }
    
    /**
     * Clean up old logs
     */
    async cleanup(daysToKeep = 30) {
        if (!this.initialized) {
            await this.initialize();
        }
        return await this.logger.cleanup(daysToKeep);
    }
    
    /**
     * Close database connections
     */
    async close() {
        if (this.database) {
            await this.database.close();
        }
        this.initialized = false;
    }
}

/**
 * Factory function to create middleware instance
 */
function createAiBotTracker(options = {}) {
    return new AiBotTracker(options);
}

/**
 * Quick setup function for basic usage
 */
function quickSetup(app, options = {}) {
    const tracker = createAiBotTracker(options);
    app.use(tracker.middleware());
    return tracker;
}

module.exports = {
    AiBotTracker,
    createAiBotTracker,
    quickSetup
};
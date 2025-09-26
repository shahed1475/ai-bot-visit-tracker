#!/usr/bin/env node
/**
 * Test Script for Node.js AI Bot Tracker Middleware
 * 
 * This script tests the Node.js Express middleware by simulating
 * various bot requests and validating the logging functionality.
 * 
 * Usage: node tests/test_nodejs_middleware.js
 */

const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Import the AI Bot Tracker middleware
const AiBotTracker = require('../middleware/nodejs/ai-bot-tracker');

// Test configuration
const TEST_CONFIG = {
    port: 3001,
    database: {
        type: 'sqlite',
        path: path.join(__dirname, 'test_nodejs.sqlite')
    },
    testDuration: 10000, // 10 seconds
    requestInterval: 500 // 500ms between requests
};

// Test bot user agents
const TEST_BOTS = [
    {
        name: 'GPTBot Test',
        userAgent: 'GPTBot/1.0 (+https://openai.com/gptbot)',
        expectedBot: 'gptbot',
        expectedClassification: 'retrieval'
    },
    {
        name: 'GoogleBot Test',
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        expectedBot: 'googlebot',
        expectedClassification: 'indexing'
    },
    {
        name: 'ClaudeBot Test',
        userAgent: 'ClaudeBot/1.0 (+https://www.anthropic.com/claudebot)',
        expectedBot: 'claudebot',
        expectedClassification: 'retrieval'
    },
    {
        name: 'BingBot Test',
        userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        expectedBot: 'bingbot',
        expectedClassification: 'indexing'
    },
    {
        name: 'PerplexityBot Test',
        userAgent: 'PerplexityBot/1.0 (+https://www.perplexity.ai/bot)',
        expectedBot: 'perplexitybot',
        expectedClassification: 'retrieval'
    },
    {
        name: 'FacebookBot Test',
        userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        expectedBot: 'facebookbot',
        expectedClassification: 'social_preview'
    },
    {
        name: 'Regular User Test',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        expectedBot: null,
        expectedClassification: null
    }
];

// Test URLs with different classifications
const TEST_URLS = [
    { path: '/', expectedClassification: 'indexing' },
    { path: '/article/ai-trends-2024', expectedClassification: 'retrieval' },
    { path: '/blog/machine-learning-guide', expectedClassification: 'retrieval' },
    { path: '/api/v1/posts', expectedClassification: 'api_access' },
    { path: '/sitemap.xml', expectedClassification: 'indexing' },
    { path: '/robots.txt', expectedClassification: 'indexing' },
    { path: '/health', expectedClassification: 'monitoring' },
    { path: '/feed.rss', expectedClassification: 'feed_consumption' },
    { path: '/images/logo.png', expectedClassification: 'media_indexing' }
];

class NodeJSMiddlewareTest {
    constructor() {
        this.app = null;
        this.server = null;
        this.botTracker = null;
        this.testResults = {
            totalRequests: 0,
            botDetections: 0,
            classifications: {},
            errors: [],
            startTime: null,
            endTime: null
        };
    }

    async initialize() {
        console.log('🚀 Initializing Node.js Middleware Test');
        console.log('=' * 50);

        // Clean up previous test database
        if (fs.existsSync(TEST_CONFIG.database.path)) {
            fs.unlinkSync(TEST_CONFIG.database.path);
            console.log('🗑️  Cleaned up previous test database');
        }

        // Create Express app
        this.app = express();

        // Initialize AI Bot Tracker
        this.botTracker = new AiBotTracker(TEST_CONFIG.database);

        // Add middleware
        this.app.use(this.botTracker.middleware());

        // Add test routes
        this.setupRoutes();

        // Start server
        await this.startServer();

        console.log(`✅ Test server started on port ${TEST_CONFIG.port}`);
    }

    setupRoutes() {
        // Home page
        this.app.get('/', (req, res) => {
            res.json({ message: 'AI Bot Tracker Test - Home Page', timestamp: new Date().toISOString() });
        });

        // Article pages
        this.app.get('/article/:slug', (req, res) => {
            res.json({ 
                message: `Article: ${req.params.slug}`, 
                type: 'article',
                timestamp: new Date().toISOString() 
            });
        });

        // Blog pages
        this.app.get('/blog/:slug', (req, res) => {
            res.json({ 
                message: `Blog Post: ${req.params.slug}`, 
                type: 'blog',
                timestamp: new Date().toISOString() 
            });
        });

        // API endpoints
        this.app.get('/api/v1/:resource', (req, res) => {
            res.json({ 
                resource: req.params.resource,
                data: [],
                timestamp: new Date().toISOString() 
            });
        });

        // Sitemap
        this.app.get('/sitemap.xml', (req, res) => {
            res.set('Content-Type', 'application/xml');
            res.send(`<?xml version="1.0" encoding="UTF-8"?>
                <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                    <url><loc>http://localhost:${TEST_CONFIG.port}/</loc></url>
                </urlset>`);
        });

        // Robots.txt
        this.app.get('/robots.txt', (req, res) => {
            res.set('Content-Type', 'text/plain');
            res.send('User-agent: *\nAllow: /');
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // RSS feed
        this.app.get('/feed.rss', (req, res) => {
            res.set('Content-Type', 'application/rss+xml');
            res.send(`<?xml version="1.0" encoding="UTF-8"?>
                <rss version="2.0">
                    <channel>
                        <title>Test Feed</title>
                        <description>Test RSS Feed</description>
                    </channel>
                </rss>`);
        });

        // Images
        this.app.get('/images/:filename', (req, res) => {
            res.json({ 
                message: `Image: ${req.params.filename}`, 
                type: 'image',
                timestamp: new Date().toISOString() 
            });
        });

        // Statistics endpoint
        this.app.get('/test/stats', async (req, res) => {
            try {
                const stats = await this.botTracker.getStats();
                const recentVisits = await this.botTracker.getRecentVisits(10);
                
                res.json({
                    stats,
                    recentVisits,
                    testResults: this.testResults
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async startServer() {
        return new Promise((resolve) => {
            this.server = this.app.listen(TEST_CONFIG.port, () => {
                resolve();
            });
        });
    }

    async runTests() {
        console.log('\n🧪 Starting Bot Request Tests');
        console.log('-' * 30);

        this.testResults.startTime = new Date();

        // Run tests for specified duration
        const testPromises = [];

        // Test each bot with each URL
        for (const bot of TEST_BOTS) {
            for (const url of TEST_URLS) {
                testPromises.push(this.testBotRequest(bot, url));
                
                // Add delay between requests
                await this.delay(TEST_CONFIG.requestInterval);
            }
        }

        // Wait for all tests to complete
        await Promise.all(testPromises);

        this.testResults.endTime = new Date();

        console.log('\n✅ All bot request tests completed');
    }

    async testBotRequest(bot, urlInfo) {
        try {
            const url = `http://localhost:${TEST_CONFIG.port}${urlInfo.path}`;
            
            console.log(`🤖 Testing: ${bot.name} -> ${urlInfo.path}`);

            const response = await axios.get(url, {
                headers: {
                    'User-Agent': bot.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive'
                },
                timeout: 5000
            });

            this.testResults.totalRequests++;

            if (bot.expectedBot) {
                this.testResults.botDetections++;
                
                const expectedClassification = bot.expectedClassification || urlInfo.expectedClassification;
                if (expectedClassification) {
                    this.testResults.classifications[expectedClassification] = 
                        (this.testResults.classifications[expectedClassification] || 0) + 1;
                }
            }

            console.log(`   ✅ Status: ${response.status} | Bot: ${bot.expectedBot || 'none'} | Classification: ${bot.expectedClassification || urlInfo.expectedClassification || 'none'}`);

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
            this.testResults.errors.push({
                bot: bot.name,
                url: urlInfo.path,
                error: error.message
            });
        }
    }

    async validateResults() {
        console.log('\n📊 Validating Test Results');
        console.log('-' * 30);

        try {
            // Get statistics from the bot tracker
            const stats = await this.botTracker.getStats();
            const recentVisits = await this.botTracker.getRecentVisits(100);

            console.log(`📈 Database Statistics:`);
            console.log(`   Total Visits Logged: ${stats.totalVisits || 0}`);
            console.log(`   Unique Bots: ${stats.uniqueBots || 0}`);
            console.log(`   Recent Visits Retrieved: ${recentVisits.length}`);

            // Validate bot detection
            const botVisits = recentVisits.filter(visit => visit.bot_name && visit.bot_name !== 'unknown');
            console.log(`   Bot Visits Detected: ${botVisits.length}`);

            // Validate classifications
            const classifications = {};
            recentVisits.forEach(visit => {
                if (visit.classification) {
                    classifications[visit.classification] = (classifications[visit.classification] || 0) + 1;
                }
            });

            console.log(`   Classifications:`);
            Object.entries(classifications).forEach(([classification, count]) => {
                console.log(`     ${classification}: ${count}`);
            });

            // Check for expected bots
            const detectedBots = [...new Set(botVisits.map(visit => visit.bot_name))];
            console.log(`   Detected Bot Types: ${detectedBots.join(', ')}`);

            // Validation checks
            const validationResults = {
                totalRequestsMatch: this.testResults.totalRequests > 0,
                botsDetected: botVisits.length > 0,
                classificationsPresent: Object.keys(classifications).length > 0,
                databaseWorking: stats.totalVisits > 0,
                noErrors: this.testResults.errors.length === 0
            };

            console.log(`\n🔍 Validation Results:`);
            Object.entries(validationResults).forEach(([check, passed]) => {
                console.log(`   ${passed ? '✅' : '❌'} ${check}: ${passed ? 'PASS' : 'FAIL'}`);
            });

            const allPassed = Object.values(validationResults).every(result => result);
            
            return {
                success: allPassed,
                stats,
                recentVisits,
                validationResults,
                testResults: this.testResults
            };

        } catch (error) {
            console.log(`❌ Validation Error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                testResults: this.testResults
            };
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up test environment');

        if (this.server) {
            this.server.close();
            console.log('   ✅ Test server stopped');
        }

        if (this.botTracker) {
            await this.botTracker.close();
            console.log('   ✅ Database connection closed');
        }

        // Optionally keep test database for inspection
        // if (fs.existsSync(TEST_CONFIG.database.path)) {
        //     fs.unlinkSync(TEST_CONFIG.database.path);
        //     console.log('   ✅ Test database cleaned up');
        // }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async run() {
        try {
            await this.initialize();
            await this.runTests();
            const results = await this.validateResults();
            
            console.log('\n' + '=' * 50);
            console.log(`🎯 Test Summary:`);
            console.log(`   Duration: ${(this.testResults.endTime - this.testResults.startTime) / 1000}s`);
            console.log(`   Total Requests: ${this.testResults.totalRequests}`);
            console.log(`   Bot Detections: ${this.testResults.botDetections}`);
            console.log(`   Errors: ${this.testResults.errors.length}`);
            console.log(`   Overall Result: ${results.success ? '✅ PASS' : '❌ FAIL'}`);

            if (this.testResults.errors.length > 0) {
                console.log(`\n❌ Errors encountered:`);
                this.testResults.errors.forEach(error => {
                    console.log(`   ${error.bot} -> ${error.url}: ${error.error}`);
                });
            }

            console.log(`\n📄 Test database saved at: ${TEST_CONFIG.database.path}`);
            console.log(`   You can inspect the logged data using SQLite tools.`);

            return results;

        } catch (error) {
            console.error(`💥 Test failed with error: ${error.message}`);
            console.error(error.stack);
            return { success: false, error: error.message };
        } finally {
            await this.cleanup();
        }
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    const test = new NodeJSMiddlewareTest();
    
    test.run().then(results => {
        process.exit(results.success ? 0 : 1);
    }).catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
    });
}

module.exports = NodeJSMiddlewareTest;
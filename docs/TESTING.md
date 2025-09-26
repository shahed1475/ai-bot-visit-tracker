# Testing Guide - AI Bot Visit Tracking Tool

This comprehensive testing guide covers all aspects of testing the AI Bot Visit Tracking Tool across Node.js, Python, and PHP implementations.

## 📋 Table of Contents

- [Overview](#overview)
- [Test Environment Setup](#test-environment-setup)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Performance Testing](#performance-testing)
- [Security Testing](#security-testing)
- [Manual Testing](#manual-testing)
- [Automated Testing](#automated-testing)
- [CI/CD Integration](#cicd-integration)

## 🎯 Overview

The testing strategy covers multiple layers:

- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **E2E Tests**: Full workflow testing
- **Performance Tests**: Load and stress testing
- **Security Tests**: Vulnerability assessment
- **Manual Tests**: User acceptance testing

## 🛠️ Test Environment Setup

### Prerequisites

```bash
# Node.js testing dependencies
npm install --save-dev jest supertest

# Python testing dependencies
pip install pytest pytest-asyncio requests

# PHP testing dependencies
composer require --dev phpunit/phpunit
```

### Database Setup for Testing

#### SQLite (Recommended for testing)
```bash
# Create test database
mkdir -p test/data
sqlite3 test/data/test.db < database/schema.sql
```

#### Docker Test Environment
```yaml
# docker-compose.test.yml
version: '3.8'
services:
  test-db:
    image: postgres:13
    environment:
      POSTGRES_DB: ai_bot_tracker_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    
  redis-test:
    image: redis:6-alpine
    ports:
      - "6380:6379"
```

## 🧪 Unit Testing

### Node.js Unit Tests

#### Bot Detector Tests
```javascript
// test/unit/bot-detector.test.js
const BotDetector = require('../../core/bot-detector');

describe('BotDetector', () => {
    let detector;
    
    beforeEach(() => {
        detector = new BotDetector({
            customPatterns: ['TestBot/1.0']
        });
    });
    
    describe('detectBot', () => {
        test('should detect GPTBot', () => {
            const request = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'
                }
            };
            
            const result = detector.detectBot(request);
            
            expect(result.isBot).toBe(true);
            expect(result.botName).toBe('GPTBot');
            expect(result.confidence).toBeGreaterThan(0.8);
        });
        
        test('should not detect regular browser', () => {
            const request = {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            };
            
            const result = detector.detectBot(request);
            
            expect(result.isBot).toBe(false);
            expect(result.botName).toBeNull();
        });
        
        test('should detect custom bot pattern', () => {
            const request = {
                headers: {
                    'user-agent': 'TestBot/1.0'
                }
            };
            
            const result = detector.detectBot(request);
            
            expect(result.isBot).toBe(true);
            expect(result.botName).toBe('TestBot');
        });
    });
    
    describe('checkIPRange', () => {
        test('should detect bot by IP range', () => {
            const result = detector.checkIPRange('192.168.1.100', ['192.168.1.0/24']);
            expect(result).toBe(true);
        });
        
        test('should handle IPv6 ranges', () => {
            const result = detector.checkIPRange('2001:db8::1', ['2001:db8::/32']);
            expect(result).toBe(true);
        });
    });
});
```

#### Request Classifier Tests
```javascript
// test/unit/classifier.test.js
const RequestClassifier = require('../../core/classifier');

describe('RequestClassifier', () => {
    let classifier;
    
    beforeEach(() => {
        classifier = new RequestClassifier();
    });
    
    describe('classify', () => {
        test('should classify sitemap as indexing', () => {
            const request = {
                url: '/sitemap.xml',
                method: 'GET',
                headers: {}
            };
            
            const result = classifier.classify(request);
            
            expect(result.classification).toBe('indexing');
            expect(result.confidence).toBeGreaterThan(0.7);
        });
        
        test('should classify API call as retrieval', () => {
            const request = {
                url: '/api/data',
                method: 'GET',
                headers: {
                    'accept': 'application/json'
                }
            };
            
            const result = classifier.classify(request);
            
            expect(result.classification).toBe('retrieval');
            expect(result.confidence).toBeGreaterThan(0.6);
        });
        
        test('should handle POST requests', () => {
            const request = {
                url: '/search',
                method: 'POST',
                headers: {
                    'content-type': 'application/json'
                }
            };
            
            const result = classifier.classify(request);
            
            expect(result.classification).toBe('retrieval');
        });
    });
});
```

### Python Unit Tests

#### Bot Detector Tests (Flask)
```python
# test/unit/test_bot_detector.py
import pytest
from middleware.python.flask.bot_detector import BotDetector

class TestBotDetector:
    def setup_method(self):
        self.detector = BotDetector({
            'custom_patterns': ['TestBot/1.0']
        })
    
    def test_detect_gptbot(self):
        request_data = {
            'user_agent': 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
            'ip': '192.168.1.1'
        }
        
        result = self.detector.detect_bot(request_data)
        
        assert result['is_bot'] is True
        assert result['bot_name'] == 'GPTBot'
        assert result['confidence'] > 0.8
    
    def test_detect_regular_browser(self):
        request_data = {
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'ip': '192.168.1.1'
        }
        
        result = self.detector.detect_bot(request_data)
        
        assert result['is_bot'] is False
        assert result['bot_name'] is None
    
    def test_custom_pattern(self):
        request_data = {
            'user_agent': 'TestBot/1.0',
            'ip': '192.168.1.1'
        }
        
        result = self.detector.detect_bot(request_data)
        
        assert result['is_bot'] is True
        assert result['bot_name'] == 'TestBot'
    
    def test_ip_range_detection(self):
        result = self.detector.check_ip_range('192.168.1.100', ['192.168.1.0/24'])
        assert result is True
        
        result = self.detector.check_ip_range('10.0.0.1', ['192.168.1.0/24'])
        assert result is False

# Run tests
# pytest test/unit/test_bot_detector.py -v
```

#### Django Model Tests
```python
# test/unit/test_models.py
import pytest
from django.test import TestCase
from django.utils import timezone
from middleware.python.django.ai_bot_tracker.models import BotVisit, BotStats

class TestBotVisit(TestCase):
    def test_create_bot_visit(self):
        visit = BotVisit.objects.create(
            ip_address='192.168.1.1',
            bot_name='GPTBot',
            page_url='/test',
            classification='indexing',
            user_agent='GPTBot/1.0'
        )
        
        assert visit.id is not None
        assert visit.timestamp is not None
        assert visit.bot_name == 'GPTBot'
        assert visit.classification == 'indexing'
    
    def test_bot_visit_str(self):
        visit = BotVisit(
            bot_name='GPTBot',
            page_url='/test',
            timestamp=timezone.now()
        )
        
        expected = f"GPTBot - /test - {visit.timestamp}"
        assert str(visit) == expected

class TestBotStats(TestCase):
    def test_create_bot_stats(self):
        stats = BotStats.objects.create(
            date=timezone.now().date(),
            bot_name='GPTBot',
            total_visits=10,
            indexing_visits=6,
            retrieval_visits=4,
            unique_ips=3,
            unique_pages=5
        )
        
        assert stats.id is not None
        assert stats.total_visits == 10
        assert stats.indexing_visits == 6
        assert stats.retrieval_visits == 4
```

### PHP Unit Tests

#### Bot Detector Tests
```php
<?php
// test/unit/BotDetectorTest.php
use PHPUnit\Framework\TestCase;
use AiBotTracker\BotDetector;

class BotDetectorTest extends TestCase
{
    private $detector;
    
    protected function setUp(): void
    {
        $this->detector = new BotDetector([
            'custom_patterns' => ['TestBot/1.0']
        ]);
    }
    
    public function testDetectGPTBot()
    {
        $request = [
            'user_agent' => 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
            'ip' => '192.168.1.1'
        ];
        
        $result = $this->detector->detectBot($request);
        
        $this->assertTrue($result['is_bot']);
        $this->assertEquals('GPTBot', $result['bot_name']);
        $this->assertGreaterThan(0.8, $result['confidence']);
    }
    
    public function testDetectRegularBrowser()
    {
        $request = [
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'ip' => '192.168.1.1'
        ];
        
        $result = $this->detector->detectBot($request);
        
        $this->assertFalse($result['is_bot']);
        $this->assertNull($result['bot_name']);
    }
    
    public function testCustomPattern()
    {
        $request = [
            'user_agent' => 'TestBot/1.0',
            'ip' => '192.168.1.1'
        ];
        
        $result = $this->detector->detectBot($request);
        
        $this->assertTrue($result['is_bot']);
        $this->assertEquals('TestBot', $result['bot_name']);
    }
    
    public function testIPRangeDetection()
    {
        $result = $this->detector->checkIPRange('192.168.1.100', ['192.168.1.0/24']);
        $this->assertTrue($result);
        
        $result = $this->detector->checkIPRange('10.0.0.1', ['192.168.1.0/24']);
        $this->assertFalse($result);
    }
}

// Run tests
// ./vendor/bin/phpunit test/unit/BotDetectorTest.php
```

## 🔗 Integration Testing

### Node.js Integration Tests

#### Express.js Middleware Integration
```javascript
// test/integration/express-middleware.test.js
const request = require('supertest');
const express = require('express');
const AiBotTracker = require('../../middleware/nodejs/express');

describe('Express Middleware Integration', () => {
    let app;
    let tracker;
    
    beforeEach(async () => {
        app = express();
        
        tracker = new AiBotTracker({
            database: {
                type: 'sqlite',
                filename: ':memory:'
            }
        });
        
        await tracker.initialize();
        
        app.use(tracker.middleware());
        app.get('/test', (req, res) => {
            res.json({ 
                message: 'Test endpoint',
                botDetected: req.botInfo ? req.botInfo.isBot : false
            });
        });
    });
    
    afterEach(async () => {
        await tracker.close();
    });
    
    test('should detect bot and add bot info to request', async () => {
        const response = await request(app)
            .get('/test')
            .set('User-Agent', 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)')
            .expect(200);
        
        expect(response.body.botDetected).toBe(true);
    });
    
    test('should not detect regular browser', async () => {
        const response = await request(app)
            .get('/test')
            .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
            .expect(200);
        
        expect(response.body.botDetected).toBe(false);
    });
    
    test('should log bot visit to database', async () => {
        await request(app)
            .get('/test')
            .set('User-Agent', 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)')
            .expect(200);
        
        // Wait for async logging
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const stats = await tracker.getStats();
        expect(stats.totalVisits).toBe(1);
        expect(stats.botVisits.GPTBot).toBe(1);
    });
});
```

### Python Integration Tests

#### Flask Integration
```python
# test/integration/test_flask_integration.py
import pytest
import json
from flask import Flask
from middleware.python.flask import AiBotTracker

@pytest.fixture
def app():
    app = Flask(__name__)
    
    tracker = AiBotTracker({
        'database': {
            'type': 'sqlite',
            'filename': ':memory:'
        }
    })
    
    app.wsgi_app = tracker.middleware(app.wsgi_app)
    
    @app.route('/test')
    def test_endpoint():
        from flask import request
        bot_info = getattr(request, 'bot_info', None)
        return json.dumps({
            'message': 'Test endpoint',
            'bot_detected': bot_info['is_bot'] if bot_info else False
        })
    
    return app

def test_bot_detection(app):
    client = app.test_client()
    
    response = client.get('/test', headers={
        'User-Agent': 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'
    })
    
    data = json.loads(response.data)
    assert data['bot_detected'] is True

def test_regular_browser(app):
    client = app.test_client()
    
    response = client.get('/test', headers={
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    })
    
    data = json.loads(response.data)
    assert data['bot_detected'] is False
```

#### Django Integration
```python
# test/integration/test_django_integration.py
import pytest
from django.test import TestCase, Client
from django.conf import settings
from django.urls import path
from django.http import JsonResponse

def test_view(request):
    bot_info = getattr(request, 'bot_info', None)
    return JsonResponse({
        'message': 'Test endpoint',
        'bot_detected': bot_info['is_bot'] if bot_info else False
    })

urlpatterns = [
    path('test/', test_view, name='test'),
]

class DjangoIntegrationTest(TestCase):
    def setUp(self):
        self.client = Client()
    
    def test_bot_detection(self):
        response = self.client.get('/test/', HTTP_USER_AGENT='Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)')
        
        data = response.json()
        self.assertTrue(data['bot_detected'])
    
    def test_regular_browser(self):
        response = self.client.get('/test/', HTTP_USER_AGENT='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        data = response.json()
        self.assertFalse(data['bot_detected'])
```

### PHP Integration Tests

#### Laravel Integration
```php
<?php
// test/integration/LaravelIntegrationTest.php
use Tests\TestCase;
use AiBotTracker\AiBotTracker;

class LaravelIntegrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        
        // Configure test database
        config(['ai_bot_tracker.database.type' => 'sqlite']);
        config(['ai_bot_tracker.database.filename' => ':memory:']);
    }
    
    public function testBotDetection()
    {
        $response = $this->get('/test', [
            'User-Agent' => 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'
        ]);
        
        $response->assertStatus(200);
        $response->assertJson(['bot_detected' => true]);
    }
    
    public function testRegularBrowser()
    {
        $response = $this->get('/test', [
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        ]);
        
        $response->assertStatus(200);
        $response->assertJson(['bot_detected' => false]);
    }
}
```

## 🎭 End-to-End Testing

### Automated E2E Tests

#### Playwright Tests (Node.js)
```javascript
// test/e2e/bot-tracking.spec.js
const { test, expect } = require('@playwright/test');

test.describe('AI Bot Tracking E2E', () => {
    test('should track bot visits through complete workflow', async ({ page }) => {
        // Start the application
        const app = await startTestApp();
        
        // Simulate bot request
        await page.setExtraHTTPHeaders({
            'User-Agent': 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'
        });
        
        // Visit pages
        await page.goto('http://localhost:3000/');
        await page.goto('http://localhost:3000/api/data');
        await page.goto('http://localhost:3000/sitemap.xml');
        
        // Check statistics
        await page.goto('http://localhost:3000/admin/stats');
        
        const stats = await page.locator('[data-testid="bot-stats"]').textContent();
        expect(stats).toContain('GPTBot: 3 visits');
        
        await app.close();
    });
    
    test('should export data correctly', async ({ page }) => {
        const app = await startTestApp();
        
        // Generate some bot visits
        await simulateBotVisits(page, 'GPTBot', 5);
        await simulateBotVisits(page, 'ClaudeBot', 3);
        
        // Export CSV
        const [download] = await Promise.all([
            page.waitForEvent('download'),
            page.click('[data-testid="export-csv"]')
        ]);
        
        const path = await download.path();
        const content = await fs.readFile(path, 'utf8');
        
        expect(content).toContain('GPTBot');
        expect(content).toContain('ClaudeBot');
        
        await app.close();
    });
});
```

### Manual E2E Testing Scripts

#### Comprehensive Test Script
```bash
#!/bin/bash
# test/e2e/manual-test.sh

echo "🤖 AI Bot Visit Tracking Tool - Manual E2E Test"
echo "=============================================="

# Test configuration
BASE_URL="http://localhost:3000"
TEST_BOTS=(
    "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"
    "Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com)"
    "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)"
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"
)

REGULAR_BROWSERS=(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
)

TEST_URLS=(
    "/"
    "/api/data"
    "/blog/post-1"
    "/sitemap.xml"
    "/robots.txt"
)

echo "📊 Testing Bot Detection..."

# Test bot detection
for bot in "${TEST_BOTS[@]}"; do
    echo "Testing: $bot"
    for url in "${TEST_URLS[@]}"; do
        curl -s -H "User-Agent: $bot" "$BASE_URL$url" > /dev/null
        echo "  ✓ Visited: $url"
    done
    sleep 1
done

echo ""
echo "🌐 Testing Regular Browsers..."

# Test regular browsers (should not be tracked)
for browser in "${REGULAR_BROWSERS[@]}"; do
    echo "Testing: $browser"
    curl -s -H "User-Agent: $browser" "$BASE_URL/" > /dev/null
    echo "  ✓ Visited: /"
done

echo ""
echo "📈 Checking Statistics..."

# Check statistics
stats_response=$(curl -s "$BASE_URL/admin/stats")
echo "Statistics Response:"
echo "$stats_response" | jq '.' 2>/dev/null || echo "$stats_response"

echo ""
echo "📁 Testing Data Export..."

# Test CSV export
curl -s "$BASE_URL/admin/export/csv" -o "test_export.csv"
if [ -f "test_export.csv" ]; then
    echo "✓ CSV export successful"
    echo "CSV content preview:"
    head -5 "test_export.csv"
    rm "test_export.csv"
else
    echo "✗ CSV export failed"
fi

# Test JSON export
curl -s "$BASE_URL/admin/export/json" -o "test_export.json"
if [ -f "test_export.json" ]; then
    echo "✓ JSON export successful"
    echo "JSON content preview:"
    head -5 "test_export.json"
    rm "test_export.json"
else
    echo "✗ JSON export failed"
fi

echo ""
echo "🏥 Testing Health Check..."

# Test health check
health_response=$(curl -s "$BASE_URL/health")
echo "Health Check Response:"
echo "$health_response" | jq '.' 2>/dev/null || echo "$health_response"

echo ""
echo "✅ Manual E2E Test Complete!"
echo "Check the statistics endpoint to verify bot visits were tracked correctly."
```

## ⚡ Performance Testing

### Load Testing with Artillery

#### Artillery Configuration
```yaml
# test/performance/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120
      arrivalRate: 50
      name: "Ramp up load"
    - duration: 300
      arrivalRate: 100
      name: "Sustained load"
  variables:
    botUserAgents:
      - "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"
      - "Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com)"
      - "facebookexternalhit/1.1"
    regularUserAgents:
      - "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      - "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

scenarios:
  - name: "Bot requests"
    weight: 30
    flow:
      - get:
          url: "/"
          headers:
            User-Agent: "{{ $randomString(botUserAgents) }}"
      - get:
          url: "/api/data"
          headers:
            User-Agent: "{{ $randomString(botUserAgents) }}"
      - get:
          url: "/sitemap.xml"
          headers:
            User-Agent: "{{ $randomString(botUserAgents) }}"
  
  - name: "Regular requests"
    weight: 70
    flow:
      - get:
          url: "/"
          headers:
            User-Agent: "{{ $randomString(regularUserAgents) }}"
      - get:
          url: "/blog/post-{{ $randomInt(1, 100) }}"
          headers:
            User-Agent: "{{ $randomString(regularUserAgents) }}"

# Run: artillery run test/performance/load-test.yml
```

### Stress Testing Script

```javascript
// test/performance/stress-test.js
const axios = require('axios');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const TEST_CONFIG = {
    baseURL: 'http://localhost:3000',
    duration: 300000, // 5 minutes
    concurrency: 100,
    botRatio: 0.3 // 30% bot traffic
};

const BOT_USER_AGENTS = [
    'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)',
    'Mozilla/5.0 (compatible; ClaudeBot/1.0; +https://anthropic.com)',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
];

const REGULAR_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
];

const TEST_URLS = ['/', '/api/data', '/blog/post-1', '/sitemap.xml'];

if (cluster.isMaster) {
    console.log(`🚀 Starting stress test with ${numCPUs} workers`);
    
    const workers = [];
    const results = [];
    
    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();
        workers.push(worker);
        
        worker.on('message', (result) => {
            results.push(result);
        });
    }
    
    setTimeout(() => {
        console.log('⏰ Test duration reached, stopping workers...');
        workers.forEach(worker => worker.kill());
        
        // Aggregate results
        const totalRequests = results.reduce((sum, r) => sum + r.requests, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
        const avgResponseTime = results.reduce((sum, r) => sum + r.avgResponseTime, 0) / results.length;
        
        console.log('\n📊 Stress Test Results:');
        console.log(`Total Requests: ${totalRequests}`);
        console.log(`Total Errors: ${totalErrors}`);
        console.log(`Error Rate: ${(totalErrors / totalRequests * 100).toFixed(2)}%`);
        console.log(`Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`Requests per Second: ${(totalRequests / (TEST_CONFIG.duration / 1000)).toFixed(2)}`);
        
        process.exit(0);
    }, TEST_CONFIG.duration);
    
} else {
    // Worker process
    let requests = 0;
    let errors = 0;
    let totalResponseTime = 0;
    
    const makeRequest = async () => {
        const isBot = Math.random() < TEST_CONFIG.botRatio;
        const userAgent = isBot 
            ? BOT_USER_AGENTS[Math.floor(Math.random() * BOT_USER_AGENTS.length)]
            : REGULAR_USER_AGENTS[Math.floor(Math.random() * REGULAR_USER_AGENTS.length)];
        
        const url = TEST_URLS[Math.floor(Math.random() * TEST_URLS.length)];
        
        const startTime = Date.now();
        
        try {
            await axios.get(`${TEST_CONFIG.baseURL}${url}`, {
                headers: { 'User-Agent': userAgent },
                timeout: 5000
            });
            
            requests++;
            totalResponseTime += Date.now() - startTime;
        } catch (error) {
            errors++;
        }
    };
    
    // Start concurrent requests
    const interval = setInterval(() => {
        for (let i = 0; i < TEST_CONFIG.concurrency; i++) {
            makeRequest();
        }
    }, 1000);
    
    process.on('SIGTERM', () => {
        clearInterval(interval);
        
        process.send({
            requests,
            errors,
            avgResponseTime: totalResponseTime / requests || 0
        });
        
        process.exit(0);
    });
}
```

## 🔒 Security Testing

### Security Test Suite

```javascript
// test/security/security-tests.js
const axios = require('axios');

class SecurityTester {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.results = [];
    }
    
    async runAllTests() {
        console.log('🔒 Running Security Tests...\n');
        
        await this.testSQLInjection();
        await this.testXSSPrevention();
        await this.testCSRFProtection();
        await this.testRateLimiting();
        await this.testInputValidation();
        
        this.printResults();
    }
    
    async testSQLInjection() {
        console.log('Testing SQL Injection Prevention...');
        
        const maliciousInputs = [
            "'; DROP TABLE bot_visits; --",
            "' OR '1'='1",
            "'; INSERT INTO bot_visits (bot_name) VALUES ('hacked'); --"
        ];
        
        for (const input of maliciousInputs) {
            try {
                const response = await axios.get(`${this.baseURL}/admin/stats`, {
                    params: { bot_name: input },
                    headers: { 'User-Agent': input }
                });
                
                // Should not return error or unexpected data
                if (response.status === 200 && !response.data.error) {
                    this.results.push({
                        test: 'SQL Injection',
                        status: 'PASS',
                        message: 'Input properly sanitized'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    this.results.push({
                        test: 'SQL Injection',
                        status: 'PASS',
                        message: 'Malicious input rejected'
                    });
                } else {
                    this.results.push({
                        test: 'SQL Injection',
                        status: 'FAIL',
                        message: `Unexpected error: ${error.message}`
                    });
                }
            }
        }
    }
    
    async testXSSPrevention() {
        console.log('Testing XSS Prevention...');
        
        const xssPayloads = [
            '<script>alert("XSS")</script>',
            'javascript:alert("XSS")',
            '<img src="x" onerror="alert(\'XSS\')">'
        ];
        
        for (const payload of xssPayloads) {
            try {
                const response = await axios.get(`${this.baseURL}/admin/stats`, {
                    headers: { 'User-Agent': payload }
                });
                
                // Check if payload is properly escaped in response
                if (typeof response.data === 'string' && 
                    !response.data.includes('<script>') &&
                    !response.data.includes('javascript:')) {
                    this.results.push({
                        test: 'XSS Prevention',
                        status: 'PASS',
                        message: 'XSS payload properly escaped'
                    });
                }
            } catch (error) {
                this.results.push({
                    test: 'XSS Prevention',
                    status: 'FAIL',
                    message: `Error testing XSS: ${error.message}`
                });
            }
        }
    }
    
    async testRateLimiting() {
        console.log('Testing Rate Limiting...');
        
        const requests = [];
        const startTime = Date.now();
        
        // Send 100 requests rapidly
        for (let i = 0; i < 100; i++) {
            requests.push(
                axios.get(`${this.baseURL}/`, {
                    headers: { 'User-Agent': 'TestBot/1.0' }
                }).catch(error => error.response)
            );
        }
        
        const responses = await Promise.all(requests);
        const rateLimited = responses.filter(r => r && r.status === 429);
        
        if (rateLimited.length > 0) {
            this.results.push({
                test: 'Rate Limiting',
                status: 'PASS',
                message: `${rateLimited.length} requests rate limited`
            });
        } else {
            this.results.push({
                test: 'Rate Limiting',
                status: 'WARNING',
                message: 'No rate limiting detected'
            });
        }
    }
    
    async testInputValidation() {
        console.log('Testing Input Validation...');
        
        const invalidInputs = [
            { userAgent: 'A'.repeat(10000) }, // Very long user agent
            { userAgent: null },
            { userAgent: undefined },
            { userAgent: '' }
        ];
        
        for (const input of invalidInputs) {
            try {
                const response = await axios.get(`${this.baseURL}/`, {
                    headers: { 'User-Agent': input.userAgent }
                });
                
                // Should handle gracefully
                if (response.status === 200) {
                    this.results.push({
                        test: 'Input Validation',
                        status: 'PASS',
                        message: 'Invalid input handled gracefully'
                    });
                }
            } catch (error) {
                if (error.response && error.response.status === 400) {
                    this.results.push({
                        test: 'Input Validation',
                        status: 'PASS',
                        message: 'Invalid input properly rejected'
                    });
                }
            }
        }
    }
    
    printResults() {
        console.log('\n🔒 Security Test Results:');
        console.log('========================');
        
        this.results.forEach(result => {
            const icon = result.status === 'PASS' ? '✅' : 
                        result.status === 'WARNING' ? '⚠️' : '❌';
            console.log(`${icon} ${result.test}: ${result.status} - ${result.message}`);
        });
        
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const total = this.results.length;
        
        console.log(`\nOverall: ${passed}/${total} tests passed`);
    }
}

// Run security tests
const tester = new SecurityTester('http://localhost:3000');
tester.runAllTests();
```

## 🤖 Automated Testing

### GitHub Actions CI/CD

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test-nodejs:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3

  test-python:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.8, 3.9, '3.10', '3.11']
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python ${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: ${{ matrix.python-version }}
    
    - name: Install dependencies
      run: |
        python -m pip install --upgrade pip
        pip install -r middleware/python/requirements.txt
        pip install -r middleware/python/requirements-dev.txt
    
    - name: Run Flask tests
      run: |
        cd middleware/python/flask
        python -m pytest test/ -v --cov=.
    
    - name: Run Django tests
      run: |
        cd middleware/python/django
        python manage.py test

  test-php:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        php-version: [7.4, 8.0, 8.1, 8.2]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup PHP ${{ matrix.php-version }}
      uses: shivammathur/setup-php@v2
      with:
        php-version: ${{ matrix.php-version }}
        extensions: pdo, pdo_sqlite, json
    
    - name: Install dependencies
      run: |
        cd middleware/php
        composer install --no-dev --optimize-autoloader
    
    - name: Run PHPUnit tests
      run: |
        cd middleware/php
        ./vendor/bin/phpunit test/

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security scan
      run: |
        npm audit --audit-level moderate
        pip install safety
        safety check -r middleware/python/requirements.txt
```

### Test Automation Scripts

```bash
#!/bin/bash
# scripts/run-all-tests.sh

echo "🧪 Running Complete Test Suite"
echo "=============================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
NODEJS_RESULT=0
PYTHON_RESULT=0
PHP_RESULT=0

echo -e "${YELLOW}📦 Testing Node.js Implementation...${NC}"
cd middleware/nodejs
npm test
NODEJS_RESULT=$?

echo -e "${YELLOW}🐍 Testing Python Implementation...${NC}"
cd ../python/flask
python -m pytest test/ -v
FLASK_RESULT=$?

cd ../django
python manage.py test
DJANGO_RESULT=$?

PYTHON_RESULT=$((FLASK_RESULT + DJANGO_RESULT))

echo -e "${YELLOW}🐘 Testing PHP Implementation...${NC}"
cd ../../php
./vendor/bin/phpunit test/
PHP_RESULT=$?

# Summary
echo ""
echo "📊 Test Results Summary:"
echo "======================="

if [ $NODEJS_RESULT -eq 0 ]; then
    echo -e "Node.js: ${GREEN}✅ PASSED${NC}"
else
    echo -e "Node.js: ${RED}❌ FAILED${NC}"
fi

if [ $PYTHON_RESULT -eq 0 ]; then
    echo -e "Python:  ${GREEN}✅ PASSED${NC}"
else
    echo -e "Python:  ${RED}❌ FAILED${NC}"
fi

if [ $PHP_RESULT -eq 0 ]; then
    echo -e "PHP:     ${GREEN}✅ PASSED${NC}"
else
    echo -e "PHP:     ${RED}❌ FAILED${NC}"
fi

TOTAL_RESULT=$((NODEJS_RESULT + PYTHON_RESULT + PHP_RESULT))

if [ $TOTAL_RESULT -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Some tests failed!${NC}"
    exit 1
fi
```

This comprehensive testing guide provides everything needed to thoroughly test the AI Bot Visit Tracking Tool across all implementations and scenarios. The tests cover functionality, performance, security, and integration aspects to ensure a robust and reliable system.
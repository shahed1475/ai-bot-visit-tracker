# API Documentation - AI Bot Visit Tracking Tool

This comprehensive API documentation covers all endpoints available across the Node.js, Python (Flask/Django), and PHP implementations of the AI Bot Visit Tracking Tool.

## 📋 Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Common Response Formats](#common-response-formats)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Core Endpoints](#core-endpoints)
- [Statistics Endpoints](#statistics-endpoints)
- [Export Endpoints](#export-endpoints)
- [Admin Endpoints](#admin-endpoints)
- [Health & Monitoring](#health--monitoring)
- [WebSocket API](#websocket-api)
- [SDK Examples](#sdk-examples)

## 🎯 Overview

The AI Bot Visit Tracking Tool provides RESTful APIs for:

- **Bot Detection**: Identify AI bots from user agents and IP addresses
- **Request Classification**: Classify bot requests as indexing or retrieval
- **Visit Logging**: Record and store bot visit data
- **Analytics**: Retrieve statistics and insights
- **Data Export**: Export visit data in various formats
- **Configuration**: Manage system settings and bot patterns

### Base URLs

```
Node.js:    http://localhost:3000
Python:     http://localhost:5000 (Flask) / http://localhost:8000 (Django)
PHP:        http://localhost:8080
```

### API Versioning

All APIs support versioning through URL path or headers:

```
URL Path:    /api/v1/endpoint
Header:      Accept: application/vnd.api+json;version=1
```

## 🔐 Authentication

### API Key Authentication

```http
GET /api/v1/stats
Authorization: Bearer your-api-key-here
```

### Basic Authentication

```http
GET /api/v1/admin/config
Authorization: Basic base64(username:password)
```

### JWT Authentication

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

## 📊 Common Response Formats

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "request_id": "req_123456789"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "start_date",
      "reason": "Invalid date format"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456789"
  }
}
```

### Pagination

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 1250,
    "total_pages": 25,
    "has_next": true,
    "has_prev": false,
    "next_url": "/api/v1/visits?page=2",
    "prev_url": null
  }
}
```

## ❌ Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200  | OK - Request successful |
| 201  | Created - Resource created successfully |
| 400  | Bad Request - Invalid request parameters |
| 401  | Unauthorized - Authentication required |
| 403  | Forbidden - Insufficient permissions |
| 404  | Not Found - Resource not found |
| 409  | Conflict - Resource already exists |
| 422  | Unprocessable Entity - Validation failed |
| 429  | Too Many Requests - Rate limit exceeded |
| 500  | Internal Server Error - Server error |
| 503  | Service Unavailable - Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `AUTHENTICATION_ERROR` | Authentication failed |
| `AUTHORIZATION_ERROR` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Requested resource not found |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded |
| `DATABASE_ERROR` | Database operation failed |
| `INTERNAL_ERROR` | Internal server error |

## 🚦 Rate Limiting

### Default Limits

- **General API**: 1000 requests per hour per IP
- **Analytics API**: 100 requests per hour per IP
- **Export API**: 10 requests per hour per IP
- **Admin API**: 50 requests per hour per authenticated user

### Rate Limit Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642248000
X-RateLimit-Window: 3600
```

## 🤖 Core Endpoints

### Bot Detection

#### Detect Bot from Request

```http
POST /api/v1/detect
Content-Type: application/json

{
  "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "ip_address": "66.249.66.1",
  "headers": {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.5"
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "is_bot": true,
    "bot_name": "Googlebot",
    "bot_type": "search_engine",
    "confidence": 0.95,
    "detection_method": "user_agent",
    "classification": {
      "type": "indexing",
      "confidence": 0.87,
      "factors": [
        "search_engine_bot",
        "html_accept_header",
        "no_javascript_support"
      ]
    }
  }
}
```

#### Get Bot Patterns

```http
GET /api/v1/bots/patterns
```

Response:
```json
{
  "success": true,
  "data": {
    "user_agent_patterns": [
      {
        "pattern": "Googlebot",
        "bot_name": "Googlebot",
        "bot_type": "search_engine",
        "regex": "Googlebot/\\d+\\.\\d+"
      }
    ],
    "ip_ranges": [
      {
        "range": "66.249.64.0/19",
        "bot_name": "Googlebot",
        "description": "Google crawler IP range"
      }
    ]
  }
}
```

#### Add Custom Bot Pattern

```http
POST /api/v1/bots/patterns
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "type": "user_agent",
  "pattern": "CustomBot/1.0",
  "bot_name": "CustomBot",
  "bot_type": "custom",
  "regex": "CustomBot/\\d+\\.\\d+",
  "enabled": true
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "pattern_123",
    "pattern": "CustomBot/1.0",
    "bot_name": "CustomBot",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Visit Logging

#### Log Bot Visit

```http
POST /api/v1/visits
Content-Type: application/json

{
  "ip_address": "66.249.66.1",
  "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "url": "https://example.com/page",
  "method": "GET",
  "headers": {
    "Accept": "text/html,application/xhtml+xml",
    "Referer": "https://google.com"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "visit_id": "visit_123456",
    "bot_detected": true,
    "bot_name": "Googlebot",
    "classification": "indexing",
    "logged_at": "2024-01-15T10:30:00Z"
  }
}
```

#### Get Visit Details

```http
GET /api/v1/visits/{visit_id}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "visit_123456",
    "timestamp": "2024-01-15T10:30:00Z",
    "ip_address": "66.249.66.1",
    "bot_name": "Googlebot",
    "url": "https://example.com/page",
    "method": "GET",
    "headers": {
      "Accept": "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
    },
    "classification": {
      "type": "indexing",
      "confidence": 0.87
    }
  }
}
```

#### List Recent Visits

```http
GET /api/v1/visits?page=1&per_page=50&bot_name=Googlebot&start_date=2024-01-01&end_date=2024-01-31
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "visit_123456",
      "timestamp": "2024-01-15T10:30:00Z",
      "ip_address": "66.249.66.1",
      "bot_name": "Googlebot",
      "url": "https://example.com/page",
      "classification": "indexing"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 1250,
    "total_pages": 25
  }
}
```

## 📈 Statistics Endpoints

### Overall Statistics

```http
GET /api/v1/stats
```

Response:
```json
{
  "success": true,
  "data": {
    "total_visits": 15420,
    "unique_bots": 25,
    "unique_ips": 1250,
    "time_range": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    },
    "top_bots": [
      {
        "bot_name": "Googlebot",
        "visit_count": 8500,
        "percentage": 55.1
      },
      {
        "bot_name": "Bingbot",
        "visit_count": 3200,
        "percentage": 20.8
      }
    ],
    "classification_breakdown": {
      "indexing": {
        "count": 12336,
        "percentage": 80.0
      },
      "retrieval": {
        "count": 3084,
        "percentage": 20.0
      }
    }
  }
}
```

### Bot-Specific Statistics

```http
GET /api/v1/stats/bots/{bot_name}?start_date=2024-01-01&end_date=2024-01-31
```

Response:
```json
{
  "success": true,
  "data": {
    "bot_name": "Googlebot",
    "total_visits": 8500,
    "unique_ips": 45,
    "unique_pages": 1250,
    "avg_visits_per_day": 274.2,
    "peak_hour": 14,
    "classification_breakdown": {
      "indexing": 7650,
      "retrieval": 850
    },
    "hourly_distribution": [
      {"hour": 0, "visits": 180},
      {"hour": 1, "visits": 165},
      // ... 24 hours
    ],
    "top_pages": [
      {
        "url": "/sitemap.xml",
        "visits": 450,
        "percentage": 5.3
      },
      {
        "url": "/robots.txt",
        "visits": 425,
        "percentage": 5.0
      }
    ]
  }
}
```

### Time Series Data

```http
GET /api/v1/stats/timeseries?interval=hour&start_date=2024-01-15&end_date=2024-01-16
```

Response:
```json
{
  "success": true,
  "data": {
    "interval": "hour",
    "series": [
      {
        "timestamp": "2024-01-15T00:00:00Z",
        "total_visits": 45,
        "bots": {
          "Googlebot": 25,
          "Bingbot": 12,
          "Others": 8
        }
      },
      {
        "timestamp": "2024-01-15T01:00:00Z",
        "total_visits": 52,
        "bots": {
          "Googlebot": 30,
          "Bingbot": 15,
          "Others": 7
        }
      }
    ]
  }
}
```

### Geographic Statistics

```http
GET /api/v1/stats/geographic
```

Response:
```json
{
  "success": true,
  "data": {
    "by_country": [
      {
        "country": "United States",
        "country_code": "US",
        "visits": 8500,
        "percentage": 55.1
      },
      {
        "country": "Germany",
        "country_code": "DE",
        "visits": 2100,
        "percentage": 13.6
      }
    ],
    "by_region": [
      {
        "region": "North America",
        "visits": 9200,
        "percentage": 59.7
      },
      {
        "region": "Europe",
        "visits": 4800,
        "percentage": 31.1
      }
    ]
  }
}
```

## 📤 Export Endpoints

### Export to CSV

```http
GET /api/v1/export/csv?start_date=2024-01-01&end_date=2024-01-31&bot_name=Googlebot
Authorization: Bearer your-api-key
```

Response:
```csv
timestamp,ip_address,bot_name,url,method,classification,confidence
2024-01-15T10:30:00Z,66.249.66.1,Googlebot,https://example.com/page,GET,indexing,0.87
2024-01-15T10:31:00Z,66.249.66.2,Googlebot,https://example.com/about,GET,indexing,0.92
```

### Export to JSON

```http
GET /api/v1/export/json?start_date=2024-01-01&end_date=2024-01-31&format=detailed
Authorization: Bearer your-api-key
```

Response:
```json
{
  "success": true,
  "data": {
    "export_info": {
      "generated_at": "2024-01-15T10:30:00Z",
      "total_records": 1250,
      "filters": {
        "start_date": "2024-01-01",
        "end_date": "2024-01-31"
      }
    },
    "visits": [
      {
        "id": "visit_123456",
        "timestamp": "2024-01-15T10:30:00Z",
        "ip_address": "66.249.66.1",
        "bot_name": "Googlebot",
        "url": "https://example.com/page",
        "method": "GET",
        "headers": {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
        },
        "classification": {
          "type": "indexing",
          "confidence": 0.87
        }
      }
    ]
  }
}
```

### Export to XML

```http
GET /api/v1/export/xml?start_date=2024-01-01&end_date=2024-01-31
Authorization: Bearer your-api-key
Accept: application/xml
```

Response:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<export>
  <info>
    <generated_at>2024-01-15T10:30:00Z</generated_at>
    <total_records>1250</total_records>
  </info>
  <visits>
    <visit>
      <id>visit_123456</id>
      <timestamp>2024-01-15T10:30:00Z</timestamp>
      <ip_address>66.249.66.1</ip_address>
      <bot_name>Googlebot</bot_name>
      <url>https://example.com/page</url>
      <classification>indexing</classification>
    </visit>
  </visits>
</export>
```

### Schedule Export

```http
POST /api/v1/export/schedule
Content-Type: application/json
Authorization: Bearer your-api-key

{
  "format": "csv",
  "schedule": "daily",
  "time": "02:00",
  "timezone": "UTC",
  "filters": {
    "bot_names": ["Googlebot", "Bingbot"],
    "classification": "indexing"
  },
  "delivery": {
    "method": "email",
    "recipients": ["admin@example.com"],
    "subject": "Daily Bot Visit Report"
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "schedule_id": "schedule_123",
    "status": "active",
    "next_run": "2024-01-16T02:00:00Z",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

## 🔧 Admin Endpoints

### Configuration Management

#### Get Configuration

```http
GET /api/v1/admin/config
Authorization: Bearer admin-api-key
```

Response:
```json
{
  "success": true,
  "data": {
    "database": {
      "type": "postgresql",
      "host": "localhost",
      "port": 5432,
      "name": "ai_bot_tracker"
    },
    "features": {
      "bot_detection": true,
      "request_classification": true,
      "data_export": true,
      "cleanup": {
        "enabled": true,
        "retention_days": 30
      }
    },
    "performance": {
      "async_batch_size": 100,
      "async_flush_interval": 5000,
      "cache_ttl": 300
    },
    "rate_limiting": {
      "enabled": true,
      "window_ms": 3600000,
      "max_requests": 1000
    }
  }
}
```

#### Update Configuration

```http
PUT /api/v1/admin/config
Content-Type: application/json
Authorization: Bearer admin-api-key

{
  "features": {
    "cleanup": {
      "retention_days": 60
    }
  },
  "performance": {
    "cache_ttl": 600
  }
}
```

Response:
```json
{
  "success": true,
  "data": {
    "updated_fields": ["features.cleanup.retention_days", "performance.cache_ttl"],
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### System Management

#### Cleanup Old Data

```http
POST /api/v1/admin/cleanup
Content-Type: application/json
Authorization: Bearer admin-api-key

{
  "retention_days": 30,
  "dry_run": false
}
```

Response:
```json
{
  "success": true,
  "data": {
    "deleted_visits": 5420,
    "deleted_stats": 180,
    "cleanup_date": "2024-01-15T10:30:00Z",
    "retention_cutoff": "2023-12-16T10:30:00Z"
  }
}
```

#### Rebuild Statistics

```http
POST /api/v1/admin/rebuild-stats
Authorization: Bearer admin-api-key
```

Response:
```json
{
  "success": true,
  "data": {
    "job_id": "rebuild_123",
    "status": "started",
    "estimated_duration": "5 minutes",
    "started_at": "2024-01-15T10:30:00Z"
  }
}
```

#### System Information

```http
GET /api/v1/admin/system
Authorization: Bearer admin-api-key
```

Response:
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "uptime": 86400,
    "memory_usage": {
      "used": "256MB",
      "total": "512MB",
      "percentage": 50.0
    },
    "database": {
      "status": "connected",
      "connections": 5,
      "max_connections": 20
    },
    "cache": {
      "status": "connected",
      "hit_rate": 0.85,
      "memory_usage": "64MB"
    }
  }
}
```

## 🏥 Health & Monitoring

### Health Check

```http
GET /api/v1/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "uptime": 86400,
    "checks": {
      "database": {
        "status": "healthy",
        "response_time": "2ms"
      },
      "cache": {
        "status": "healthy",
        "response_time": "1ms"
      },
      "disk_space": {
        "status": "healthy",
        "available": "15GB",
        "usage": "75%"
      }
    }
  }
}
```

### Metrics (Prometheus Format)

```http
GET /api/v1/metrics
Accept: text/plain
```

Response:
```
# HELP bot_visits_total Total number of bot visits
# TYPE bot_visits_total counter
bot_visits_total{bot_name="Googlebot"} 8500
bot_visits_total{bot_name="Bingbot"} 3200

# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 15420
http_requests_total{method="POST",status="201"} 850

# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 12500
http_request_duration_seconds_bucket{le="0.5"} 15000
http_request_duration_seconds_bucket{le="1.0"} 15400
http_request_duration_seconds_bucket{le="+Inf"} 15420
```

### Live Activity

```http
GET /api/v1/activity/live
```

Response:
```json
{
  "success": true,
  "data": {
    "current_visitors": 25,
    "active_bots": [
      {
        "bot_name": "Googlebot",
        "last_seen": "2024-01-15T10:29:45Z",
        "current_page": "/sitemap.xml"
      },
      {
        "bot_name": "Bingbot",
        "last_seen": "2024-01-15T10:29:30Z",
        "current_page": "/robots.txt"
      }
    ],
    "recent_visits": [
      {
        "timestamp": "2024-01-15T10:29:45Z",
        "bot_name": "Googlebot",
        "url": "/sitemap.xml",
        "classification": "indexing"
      }
    ]
  }
}
```

## 🔌 WebSocket API

### Real-time Visit Stream

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000/api/v1/ws/visits');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: 'your-api-key'
}));

// Subscribe to events
ws.send(JSON.stringify({
  type: 'subscribe',
  events: ['visit', 'bot_detected', 'classification']
}));

// Handle messages
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'visit':
      console.log('New visit:', data.payload);
      break;
    case 'bot_detected':
      console.log('Bot detected:', data.payload);
      break;
    case 'classification':
      console.log('Request classified:', data.payload);
      break;
  }
};
```

### WebSocket Message Formats

#### Visit Event
```json
{
  "type": "visit",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "visit_id": "visit_123456",
    "ip_address": "66.249.66.1",
    "bot_name": "Googlebot",
    "url": "https://example.com/page",
    "classification": "indexing"
  }
}
```

#### Bot Detection Event
```json
{
  "type": "bot_detected",
  "timestamp": "2024-01-15T10:30:00Z",
  "payload": {
    "bot_name": "Googlebot",
    "confidence": 0.95,
    "detection_method": "user_agent",
    "ip_address": "66.249.66.1"
  }
}
```

## 🛠️ SDK Examples

### JavaScript/Node.js SDK

```javascript
const AiBotTracker = require('ai-bot-tracker-sdk');

const client = new AiBotTracker({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Detect bot
const detection = await client.detect({
  userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ipAddress: '66.249.66.1'
});

// Log visit
const visit = await client.logVisit({
  ipAddress: '66.249.66.1',
  userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  url: 'https://example.com/page',
  method: 'GET'
});

// Get statistics
const stats = await client.getStats({
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

// Export data
const csvData = await client.export('csv', {
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  botName: 'Googlebot'
});
```

### Python SDK

```python
from ai_bot_tracker import AiBotTrackerClient

client = AiBotTrackerClient(
    base_url='http://localhost:5000',
    api_key='your-api-key'
)

# Detect bot
detection = client.detect(
    user_agent='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ip_address='66.249.66.1'
)

# Log visit
visit = client.log_visit(
    ip_address='66.249.66.1',
    user_agent='Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    url='https://example.com/page',
    method='GET'
)

# Get statistics
stats = client.get_stats(
    start_date='2024-01-01',
    end_date='2024-01-31'
)

# Export data
csv_data = client.export(
    format='csv',
    start_date='2024-01-01',
    end_date='2024-01-31',
    bot_name='Googlebot'
)
```

### PHP SDK

```php
<?php
use AiBotTracker\Client;

$client = new Client([
    'base_url' => 'http://localhost:8080',
    'api_key' => 'your-api-key'
]);

// Detect bot
$detection = $client->detect([
    'user_agent' => 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'ip_address' => '66.249.66.1'
]);

// Log visit
$visit = $client->logVisit([
    'ip_address' => '66.249.66.1',
    'user_agent' => 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'url' => 'https://example.com/page',
    'method' => 'GET'
]);

// Get statistics
$stats = $client->getStats([
    'start_date' => '2024-01-01',
    'end_date' => '2024-01-31'
]);

// Export data
$csvData = $client->export('csv', [
    'start_date' => '2024-01-01',
    'end_date' => '2024-01-31',
    'bot_name' => 'Googlebot'
]);
?>
```

### cURL Examples

#### Detect Bot
```bash
curl -X POST http://localhost:3000/api/v1/detect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "ip_address": "66.249.66.1"
  }'
```

#### Get Statistics
```bash
curl -X GET "http://localhost:3000/api/v1/stats?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer your-api-key"
```

#### Export Data
```bash
curl -X GET "http://localhost:3000/api/v1/export/csv?start_date=2024-01-01&end_date=2024-01-31" \
  -H "Authorization: Bearer your-api-key" \
  -o bot_visits.csv
```

This comprehensive API documentation provides detailed information about all available endpoints, request/response formats, authentication methods, and usage examples across all supported programming languages and frameworks.
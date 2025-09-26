# Troubleshooting Guide - AI Bot Visit Tracking Tool

This comprehensive troubleshooting guide helps you diagnose and resolve common issues with the AI Bot Visit Tracking Tool across Node.js, Python, and PHP implementations.

## 📋 Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Database Problems](#database-problems)
- [Performance Issues](#performance-issues)
- [Bot Detection Problems](#bot-detection-problems)
- [API Errors](#api-errors)
- [Configuration Issues](#configuration-issues)
- [Logging and Monitoring](#logging-and-monitoring)
- [Docker Issues](#docker-issues)
- [Framework-Specific Issues](#framework-specific-issues)
- [Debug Mode](#debug-mode)
- [Common Error Codes](#common-error-codes)
- [Getting Help](#getting-help)

## 🔍 Quick Diagnostics

### Health Check Commands

#### Node.js
```bash
# Check application health
curl http://localhost:3000/health

# Check dependencies
npm list --depth=0

# Check Node.js version
node --version
npm --version
```

#### Python (Flask)
```bash
# Check application health
curl http://localhost:5000/health

# Check dependencies
pip list

# Check Python version
python --version
pip --version
```

#### Python (Django)
```bash
# Check application health
curl http://localhost:8000/health

# Django system check
python manage.py check

# Check migrations
python manage.py showmigrations
```

#### PHP
```bash
# Check application health
curl http://localhost:8080/health

# Check PHP version and extensions
php --version
php -m | grep -E "(pdo|json|curl)"

# Check Composer dependencies
composer show
```

### System Requirements Check

```bash
# Check system resources
free -h                    # Memory usage
df -h                      # Disk space
top                        # CPU usage
netstat -tlnp | grep :3000 # Port availability
```

## 🚀 Installation Issues

### Node.js Installation Problems

#### Issue: `npm install` fails with permission errors
```bash
# Solution 1: Use npm with --unsafe-perm
npm install --unsafe-perm

# Solution 2: Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Solution 3: Use Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

#### Issue: Module not found errors
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check for missing peer dependencies
npm ls
```

### Python Installation Problems

#### Issue: `pip install` fails with compilation errors
```bash
# Install build tools (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install build-essential python3-dev

# Install build tools (CentOS/RHEL)
sudo yum groupinstall "Development Tools"
sudo yum install python3-devel

# Use pre-compiled wheels
pip install --only-binary=all -r requirements.txt
```

#### Issue: Virtual environment problems
```bash
# Create new virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

# Upgrade pip
pip install --upgrade pip

# Install requirements
pip install -r requirements.txt
```

### PHP Installation Problems

#### Issue: Missing PHP extensions
```bash
# Ubuntu/Debian
sudo apt-get install php-pdo php-pgsql php-mysql php-sqlite3 php-json php-curl

# CentOS/RHEL
sudo yum install php-pdo php-pgsql php-mysqlnd php-json php-curl

# Check installed extensions
php -m | grep -E "(pdo|json|curl)"
```

#### Issue: Composer installation fails
```bash
# Install Composer globally
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Update Composer
composer self-update

# Clear Composer cache
composer clear-cache
```

## 🗄️ Database Problems

### Connection Issues

#### Issue: Database connection refused
```bash
# Check database service status
sudo systemctl status postgresql  # PostgreSQL
sudo systemctl status mysql       # MySQL

# Check if database is listening
netstat -tlnp | grep :5432       # PostgreSQL
netstat -tlnp | grep :3306       # MySQL

# Test connection manually
psql -h localhost -U username -d database_name  # PostgreSQL
mysql -h localhost -u username -p database_name # MySQL
```

#### Issue: Authentication failed
```bash
# PostgreSQL: Check pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf

# MySQL: Reset password
sudo mysql
ALTER USER 'username'@'localhost' IDENTIFIED BY 'new_password';
FLUSH PRIVILEGES;
```

### Schema Issues

#### Issue: Tables not created
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';  -- PostgreSQL

SHOW TABLES;  -- MySQL

-- Manually create schema
\i database/schema.sql  -- PostgreSQL
source database/schema.sql;  -- MySQL
```

#### Issue: Migration errors (Django)
```bash
# Check migration status
python manage.py showmigrations

# Create new migration
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Reset migrations (if needed)
python manage.py migrate --fake-initial
```

### Performance Issues

#### Issue: Slow database queries
```sql
-- PostgreSQL: Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- MySQL: Enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;

-- Check slow queries
SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10;
```

#### Issue: Database locks
```sql
-- PostgreSQL: Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Kill blocking queries
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';

-- MySQL: Check for locks
SHOW PROCESSLIST;
SHOW ENGINE INNODB STATUS;

-- Kill blocking queries
KILL QUERY process_id;
```

## ⚡ Performance Issues

### High Memory Usage

#### Issue: Memory leaks in Node.js
```javascript
// Add memory monitoring
const v8 = require('v8');
const heapStats = v8.getHeapStatistics();
console.log('Heap used:', heapStats.used_heap_size / 1024 / 1024, 'MB');

// Use --max-old-space-size flag
node --max-old-space-size=4096 app.js

// Enable garbage collection logging
node --trace-gc app.js
```

#### Issue: High CPU usage
```bash
# Profile Node.js application
node --prof app.js
node --prof-process isolate-*.log > processed.txt

# Python profiling
pip install py-spy
py-spy top --pid $(pgrep -f "python.*app.py")

# PHP profiling with Xdebug
php -d xdebug.profiler_enable=1 -d xdebug.profiler_output_dir=/tmp app.php
```

### Slow Response Times

#### Issue: Database connection pool exhaustion
```javascript
// Node.js: Increase pool size
const pool = new Pool({
  max: 20,        // Increase from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Monitor pool usage
pool.on('connect', () => console.log('Connected to database'));
pool.on('error', (err) => console.error('Database error:', err));
```

```python
# Python: Configure connection pool
DATABASE_URL = "postgresql://user:pass@host:port/db?pool_size=20&max_overflow=30"

# Django: Configure database connections
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'CONN_MAX_AGE': 600,
        'OPTIONS': {
            'MAX_CONNS': 20
        }
    }
}
```

#### Issue: Inefficient queries
```sql
-- Add database indexes
CREATE INDEX idx_visits_timestamp ON visits(timestamp);
CREATE INDEX idx_visits_bot_name ON visits(bot_name);
CREATE INDEX idx_visits_ip_address ON visits(ip_address);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM visits WHERE timestamp > NOW() - INTERVAL '1 day';
```

## 🤖 Bot Detection Problems

### False Positives

#### Issue: Legitimate users detected as bots
```javascript
// Adjust detection sensitivity
const config = {
  botDetection: {
    strictMode: false,
    confidenceThreshold: 0.8,  // Increase threshold
    whitelistIPs: ['192.168.1.0/24'],
    whitelistUserAgents: ['MyLegitimateApp/1.0']
  }
};
```

#### Issue: Custom bots not detected
```javascript
// Add custom bot patterns
const customPatterns = [
  {
    pattern: 'MyCustomBot',
    botName: 'MyCustomBot',
    botType: 'custom',
    regex: 'MyCustomBot/\\d+\\.\\d+'
  }
];

// Update IP ranges
const customIPRanges = [
  {
    range: '203.0.113.0/24',
    botName: 'MyCustomBot',
    description: 'Custom bot IP range'
  }
];
```

### Classification Issues

#### Issue: Incorrect request classification
```javascript
// Debug classification
const classifier = new RequestClassifier({
  debug: true,
  logLevel: 'debug'
});

const result = classifier.classify(request);
console.log('Classification factors:', result.factors);
console.log('Confidence breakdown:', result.confidenceBreakdown);
```

#### Issue: Low classification confidence
```javascript
// Adjust classification weights
const classificationConfig = {
  weights: {
    urlPattern: 0.4,      // Increase URL pattern weight
    userAgent: 0.3,
    headers: 0.2,
    frequency: 0.1
  },
  thresholds: {
    indexing: 0.6,        // Lower threshold for indexing
    retrieval: 0.7
  }
};
```

## 🔌 API Errors

### HTTP Status Errors

#### Issue: 500 Internal Server Error
```bash
# Check application logs
tail -f /var/log/ai-bot-tracker/app.log

# Node.js: Enable detailed error logging
NODE_ENV=development node app.js

# Python: Enable debug mode
FLASK_DEBUG=1 python app.py
# or for Django
DEBUG=True python manage.py runserver

# PHP: Enable error reporting
php -d display_errors=1 -d error_reporting=E_ALL app.php
```

#### Issue: 429 Too Many Requests
```javascript
// Adjust rate limiting
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,                 // Increase limit
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false,
});
```

#### Issue: 401 Unauthorized
```bash
# Check API key configuration
echo $API_KEY

# Verify token format
curl -H "Authorization: Bearer your-api-key" http://localhost:3000/api/v1/stats

# Check token expiration
jwt-cli decode your-jwt-token
```

### Request/Response Issues

#### Issue: Large response payloads
```javascript
// Implement pagination
app.get('/api/v1/visits', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 1000);
  const offset = (page - 1) * limit;
  
  // Add LIMIT and OFFSET to query
  const query = `SELECT * FROM visits ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}`;
});

// Enable response compression
app.use(compression());
```

#### Issue: Timeout errors
```javascript
// Increase timeout values
const server = app.listen(3000);
server.timeout = 120000;  // 2 minutes

// For database queries
const query = await pool.query(sql, params, { timeout: 30000 });
```

## ⚙️ Configuration Issues

### Environment Variables

#### Issue: Environment variables not loaded
```bash
# Check if .env file exists and is readable
ls -la .env
cat .env

# Load environment variables manually
export $(cat .env | xargs)

# Verify variables are set
printenv | grep -E "(DB_|API_|LOG_)"
```

#### Issue: Configuration validation errors
```javascript
// Add configuration validation
const Joi = require('joi');

const configSchema = Joi.object({
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_NAME: Joi.string().required(),
  API_KEY: Joi.string().min(32).required()
});

const { error, value } = configSchema.validate(process.env);
if (error) {
  console.error('Configuration error:', error.details);
  process.exit(1);
}
```

### File Permissions

#### Issue: Permission denied errors
```bash
# Fix file permissions
chmod 644 .env
chmod 755 logs/
chmod 644 logs/*.log

# Fix ownership
sudo chown -R www-data:www-data /var/www/ai-bot-tracker  # Apache
sudo chown -R nginx:nginx /var/www/ai-bot-tracker        # Nginx
```

## 📊 Logging and Monitoring

### Log Analysis

#### Issue: Missing or incomplete logs
```bash
# Check log file permissions
ls -la /var/log/ai-bot-tracker/

# Increase log level
export LOG_LEVEL=debug

# Rotate large log files
logrotate -f /etc/logrotate.d/ai-bot-tracker
```

#### Issue: Log parsing errors
```bash
# Validate JSON logs
tail -n 100 app.log | jq '.'

# Search for specific errors
grep -i "error" app.log | tail -20
grep -i "database" app.log | tail -10

# Monitor logs in real-time
tail -f app.log | grep -E "(ERROR|WARN)"
```

### Monitoring Setup

#### Issue: Metrics not collected
```javascript
// Verify Prometheus metrics endpoint
curl http://localhost:3000/metrics

// Check metric registration
const prometheus = require('prom-client');
console.log(prometheus.register.getMetricsAsJSON());
```

#### Issue: Health check failures
```bash
# Test health endpoint
curl -v http://localhost:3000/health

# Check individual components
curl http://localhost:3000/health/database
curl http://localhost:3000/health/cache
```

## 🐳 Docker Issues

### Container Problems

#### Issue: Container won't start
```bash
# Check container logs
docker logs ai-bot-tracker-app

# Check container status
docker ps -a

# Inspect container configuration
docker inspect ai-bot-tracker-app

# Check resource usage
docker stats ai-bot-tracker-app
```

#### Issue: Database connection from container
```bash
# Test network connectivity
docker exec -it ai-bot-tracker-app ping postgres

# Check environment variables in container
docker exec -it ai-bot-tracker-app env | grep DB_

# Test database connection
docker exec -it ai-bot-tracker-app psql -h postgres -U app_user -d ai_bot_tracker
```

### Docker Compose Issues

#### Issue: Services not communicating
```bash
# Check network configuration
docker network ls
docker network inspect ai-bot-tracker_default

# Check service discovery
docker exec -it ai-bot-tracker-app nslookup postgres

# Restart services in order
docker-compose down
docker-compose up -d postgres
sleep 10
docker-compose up -d app
```

#### Issue: Volume mount problems
```bash
# Check volume mounts
docker inspect ai-bot-tracker-app | grep -A 10 "Mounts"

# Fix permissions
sudo chown -R 1001:1001 ./data
sudo chmod -R 755 ./data

# Recreate volumes
docker-compose down -v
docker-compose up -d
```

## 🔧 Framework-Specific Issues

### Express.js Issues

#### Issue: Middleware not executing
```javascript
// Check middleware order
app.use(cors());
app.use(express.json());
app.use('/api', aiBotTrackerMiddleware);  // Ensure correct order

// Debug middleware execution
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

### Flask Issues

#### Issue: Blueprint not registered
```python
# Check blueprint registration
from flask import current_app
print(current_app.blueprints)

# Register blueprint correctly
from ai_bot_tracker import create_app
app = create_app()
app.register_blueprint(api_bp, url_prefix='/api/v1')
```

### Django Issues

#### Issue: URL patterns not matching
```python
# Check URL configuration
python manage.py show_urls | grep bot

# Debug URL resolution
from django.urls import resolve
print(resolve('/api/v1/stats/'))

# Check middleware order in settings.py
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'ai_bot_tracker.middleware.AiBotTrackerMiddleware',  # Add here
    # ... other middleware
]
```

### Laravel Issues

#### Issue: Service provider not loaded
```php
// Check registered providers
php artisan config:cache
php artisan route:list | grep bot

// Publish configuration
php artisan vendor:publish --provider="AiBotTracker\ServiceProvider"
```

## 🐛 Debug Mode

### Enable Debug Mode

#### Node.js
```bash
# Enable debug logging
DEBUG=ai-bot-tracker:* node app.js

# Use Node.js inspector
node --inspect app.js
# Then open chrome://inspect in Chrome
```

#### Python
```bash
# Flask debug mode
FLASK_DEBUG=1 python app.py

# Django debug mode
DEBUG=True python manage.py runserver

# Python debugger
import pdb; pdb.set_trace()
```

#### PHP
```php
// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Xdebug configuration
xdebug.mode=debug
xdebug.start_with_request=yes
xdebug.client_host=127.0.0.1
xdebug.client_port=9003
```

### Debug Information Collection

```bash
# System information
uname -a
cat /etc/os-release

# Application versions
node --version
python --version
php --version

# Database version
psql --version
mysql --version

# Memory and disk usage
free -h
df -h

# Network configuration
netstat -tlnp
ss -tlnp
```

## ❌ Common Error Codes

### Application Errors

| Error Code | Description | Solution |
|------------|-------------|----------|
| `DB_CONNECTION_FAILED` | Database connection failed | Check database credentials and connectivity |
| `INVALID_CONFIG` | Configuration validation failed | Verify environment variables and config files |
| `BOT_DETECTION_ERROR` | Bot detection module failed | Check bot patterns and IP ranges |
| `CLASSIFICATION_ERROR` | Request classification failed | Verify classification rules and weights |
| `EXPORT_FAILED` | Data export operation failed | Check file permissions and disk space |
| `RATE_LIMIT_EXCEEDED` | API rate limit exceeded | Implement proper rate limiting or increase limits |
| `AUTH_TOKEN_INVALID` | Authentication token invalid | Verify API key or regenerate token |
| `SCHEMA_VERSION_MISMATCH` | Database schema version mismatch | Run database migrations |

### HTTP Error Responses

```json
{
  "success": false,
  "error": {
    "code": "DB_CONNECTION_FAILED",
    "message": "Unable to connect to database",
    "details": {
      "host": "localhost",
      "port": 5432,
      "database": "ai_bot_tracker"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456789"
  }
}
```

## 🆘 Getting Help

### Before Seeking Help

1. **Check the logs** for error messages
2. **Verify configuration** settings
3. **Test with minimal setup** to isolate the issue
4. **Check system resources** (memory, disk, CPU)
5. **Review recent changes** that might have caused the issue

### Information to Provide

When seeking help, please provide:

```bash
# System information
uname -a
cat /etc/os-release

# Application versions
node --version  # or python --version, php --version
npm --version   # or pip --version, composer --version

# Configuration (sanitized)
cat .env | sed 's/=.*/=***/'

# Error logs (last 50 lines)
tail -50 /var/log/ai-bot-tracker/app.log

# Resource usage
free -h
df -h
```

### Support Channels

- **GitHub Issues**: [https://github.com/your-org/ai-bot-tracker/issues](https://github.com/your-org/ai-bot-tracker/issues)
- **Documentation**: [https://docs.ai-bot-tracker.com](https://docs.ai-bot-tracker.com)
- **Community Forum**: [https://community.ai-bot-tracker.com](https://community.ai-bot-tracker.com)
- **Email Support**: support@ai-bot-tracker.com

### Creating Bug Reports

When creating a bug report, include:

1. **Clear description** of the issue
2. **Steps to reproduce** the problem
3. **Expected behavior** vs actual behavior
4. **Environment details** (OS, versions, configuration)
5. **Error logs** and stack traces
6. **Screenshots** if applicable

This troubleshooting guide should help you resolve most common issues with the AI Bot Visit Tracking Tool. If you encounter problems not covered here, please refer to the support channels listed above.
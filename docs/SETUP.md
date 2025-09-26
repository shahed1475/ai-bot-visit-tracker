# Setup Guide - AI Bot Visit Tracking Tool

This guide provides detailed setup instructions for all middleware implementations of the AI Bot Visit Tracking Tool across Node.js, Python (Flask/Django), and PHP frameworks.

## 📋 Prerequisites

### System Requirements

- **Operating System**: Windows, macOS, or Linux
- **Memory**: Minimum 512MB RAM (2GB+ recommended for production)
- **Storage**: 100MB+ free space for application and database

### Language-Specific Requirements

#### Node.js
- **Node.js**: Version 16.0 or higher
- **npm**: Version 8.0 or higher (comes with Node.js)

#### Python
- **Python**: Version 3.8 or higher
- **pip**: Latest version (comes with Python)

#### PHP
- **PHP**: Version 8.0 or higher
- **Composer**: Latest version
- **Extensions**: PDO, JSON, cURL

## 🚀 Quick Setup

### 1. Clone or Download the Project

```bash
# If using Git
git clone https://github.com/your-repo/ai-bot-visit-tracker.git
cd ai-bot-visit-tracker

# Or download and extract the ZIP file
```

### 2. Choose Your Implementation

Navigate to your preferred middleware directory:

```bash
# For Node.js
cd middleware/nodejs

# For Python Flask
cd middleware/python/flask

# For Python Django
cd middleware/python/django

# For PHP
cd middleware/php
```

### 3. Install Dependencies

#### Node.js
```bash
npm install
```

#### Python Flask/Django
```bash
# Install required Python packages
pip install sqlite3 requests

# For PostgreSQL support (optional)
pip install psycopg2-binary

# For MySQL support (optional)
pip install mysql-connector-python
```

#### PHP
```bash
composer install
```

### 4. Run Basic Example

#### Node.js
```bash
node examples/node_basic_usage.js
```

#### Python Flask
```bash
python examples/flask_basic_usage.py
```

#### Python Django
```bash
python examples/django_basic_usage.py
```

#### PHP
```bash
php examples/basic_usage.php
```

### 5. Test the Setup

Open your browser or use curl to test:

```bash
# Test with regular browser
curl http://localhost:3000/

# Test with AI bot user agent
curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/

# Check statistics
curl http://localhost:3000/ai-bot-tracker/stats
```

## 🗄️ Database Setup

### SQLite (Default - No Setup Required)

SQLite is the default database and requires no additional setup. The database file will be created automatically when the application starts.

### MySQL Setup

1. **Install MySQL Server**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install mysql-server
   
   # macOS (using Homebrew)
   brew install mysql
   
   # Windows: Download from https://dev.mysql.com/downloads/mysql/
   ```

2. **Create Database and User**
   ```sql
   CREATE DATABASE bot_tracker;
   CREATE USER 'bot_user'@'localhost' IDENTIFIED BY 'your_password';
   GRANT ALL PRIVILEGES ON bot_tracker.* TO 'bot_user'@'localhost';
   FLUSH PRIVILEGES;
   ```

3. **Update Configuration**
   ```json
   {
       "database": {
           "type": "mysql",
           "host": "localhost",
           "port": 3306,
           "database": "bot_tracker",
           "username": "bot_user",
           "password": "your_password"
       }
   }
   ```

### PostgreSQL Setup

1. **Install PostgreSQL**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   
   # macOS (using Homebrew)
   brew install postgresql
   
   # Windows: Download from https://www.postgresql.org/download/windows/
   ```

2. **Create Database and User**
   ```bash
   sudo -u postgres psql
   ```
   
   ```sql
   CREATE DATABASE bot_tracker;
   CREATE USER bot_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE bot_tracker TO bot_user;
   \q
   ```

3. **Update Configuration**
   ```json
   {
       "database": {
           "type": "postgresql",
           "host": "localhost",
           "port": 5432,
           "database": "bot_tracker",
           "username": "bot_user",
           "password": "your_password"
       }
   }
   ```

## 🔧 Framework Integration

### Express.js (Node.js)

```javascript
const express = require('express');
const AiBotTracker = require('./ai-bot-tracker');

const app = express();

// Initialize tracker
const tracker = new AiBotTracker({
    database: {
        type: 'sqlite',
        path: './bot_visits.db'
    }
});

// Add middleware
app.use(tracker.middleware());

// Your routes
app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
```

### Flask (Python)

```python
from flask import Flask
from ai_bot_tracker_flask import AiBotTrackerFlask

app = Flask(__name__)

# Initialize tracker
tracker = AiBotTrackerFlask(app, {
    'database': {
        'type': 'sqlite',
        'path': './bot_visits.db'
    }
})

@app.route('/')
def home():
    return 'Hello World!'

if __name__ == '__main__':
    app.run(debug=True, port=3000)
```

### Django (Python)

1. **Add to MIDDLEWARE** in `settings.py`:
   ```python
   MIDDLEWARE = [
       'ai_bot_tracker_django.AiBotTrackerMiddleware',
       # ... other middleware
   ]
   ```

2. **Configure settings** in `settings.py`:
   ```python
   AI_BOT_TRACKER = {
       'DATABASE_URL': 'sqlite:///bot_visits.db',
       'LOG_LEVEL': 'INFO',
       'ASYNC_LOGGING': True,
   }
   ```

3. **Create views** (optional):
   ```python
   from django.http import JsonResponse
   from ai_bot_tracker_django import AiBotTrackerView
   
   def home(request):
       return JsonResponse({'message': 'Hello World!'})
   
   # Use the built-in view for statistics
   bot_stats = AiBotTrackerView.as_view()
   ```

### Laravel (PHP)

1. **Create Middleware**:
   ```bash
   php artisan make:middleware AiBotTrackerMiddleware
   ```

2. **Implement Middleware**:
   ```php
   <?php
   namespace App\Http\Middleware;

   use Closure;
   use AiBotTracker\AiBotTracker;

   class AiBotTrackerMiddleware
   {
       private $tracker;

       public function __construct()
       {
           $this->tracker = new AiBotTracker([
               'database' => [
                   'type' => 'mysql',
                   'host' => env('DB_HOST'),
                   'database' => env('DB_DATABASE'),
                   'username' => env('DB_USERNAME'),
                   'password' => env('DB_PASSWORD'),
               ]
           ]);
       }

       public function handle($request, Closure $next)
       {
           $this->tracker->processRequest();
           return $next($request);
       }
   }
   ```

3. **Register Middleware** in `app/Http/Kernel.php`:
   ```php
   protected $middleware = [
       // ... other middleware
       \App\Http\Middleware\AiBotTrackerMiddleware::class,
   ];
   ```

### Symfony (PHP)

1. **Create Event Subscriber**:
   ```php
   <?php
   namespace App\EventSubscriber;

   use Symfony\Component\EventDispatcher\EventSubscriberInterface;
   use Symfony\Component\HttpKernel\Event\RequestEvent;
   use Symfony\Component\HttpKernel\KernelEvents;
   use AiBotTracker\AiBotTracker;

   class AiBotTrackerSubscriber implements EventSubscriberInterface
   {
       private $tracker;

       public function __construct()
       {
           $this->tracker = new AiBotTracker([
               'database' => [
                   'type' => 'postgresql',
                   'host' => $_ENV['DATABASE_HOST'],
                   'database' => $_ENV['DATABASE_NAME'],
                   'username' => $_ENV['DATABASE_USER'],
                   'password' => $_ENV['DATABASE_PASSWORD'],
               ]
           ]);
       }

       public function onKernelRequest(RequestEvent $event): void
       {
           if (!$event->isMainRequest()) {
               return;
           }

           $this->tracker->processRequest();
       }

       public static function getSubscribedEvents(): array
       {
           return [
               KernelEvents::REQUEST => 'onKernelRequest',
           ];
       }
   }
   ```

2. **Register Service** in `config/services.yaml`:
   ```yaml
   services:
       App\EventSubscriber\AiBotTrackerSubscriber:
           tags:
               - { name: kernel.event_subscriber }
   ```

## 🌍 Environment Variables

Create a `.env` file in your project root:

```bash
# Database Configuration
DB_TYPE=sqlite
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bot_tracker
DB_USER=your_user
DB_PASS=your_password

# Application Settings
LOG_LEVEL=info
LOG_FILE=./logs/bot_tracker.log
ASYNC_LOGGING=true

# Performance Settings
CLEANUP_INTERVAL=86400
MAX_VISITS_RETENTION=30
ENABLE_CACHING=true

# Security Settings
ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8
RATE_LIMIT_ENABLED=false
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=3600
```

## 🐳 Docker Setup

### Using Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_TYPE=postgresql
      - DB_HOST=db
      - DB_NAME=bot_tracker
      - DB_USER=bot_user
      - DB_PASS=bot_password
    depends_on:
      - db
    volumes:
      - ./logs:/app/logs

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=bot_tracker
      - POSTGRES_USER=bot_user
      - POSTGRES_PASSWORD=bot_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### Individual Dockerfiles

#### Node.js Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "examples/basic_usage.js"]
```

#### Python Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 3000

CMD ["python", "examples/basic_usage.py"]
```

#### PHP Dockerfile
```dockerfile
FROM php:8.2-apache

RUN docker-php-ext-install pdo pdo_mysql pdo_pgsql

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer*.json ./
RUN composer install --no-dev --optimize-autoloader

COPY . .

EXPOSE 80

CMD ["apache2-foreground"]
```

## 🔍 Verification

After setup, verify everything is working:

1. **Check Application Status**:
   ```bash
   curl http://localhost:3000/
   ```

2. **Test Bot Detection**:
   ```bash
   # Test with different AI bots
   curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/
   curl -H "User-Agent: Claude-Web/1.0" http://localhost:3000/
   curl -H "User-Agent: GoogleBot-AI/1.0" http://localhost:3000/
   ```

3. **View Statistics**:
   ```bash
   curl http://localhost:3000/ai-bot-tracker/stats
   ```

4. **Check Recent Visits**:
   ```bash
   curl http://localhost:3000/ai-bot-tracker/recent
   ```

5. **Run Automated Tests**:
   ```bash
   # Test all frameworks
   python tests/run_all_tests.py
   
   # Test individual frameworks
   node tests/test_nodejs_middleware.js
   python tests/test_flask_middleware.py
   python tests/test_django_middleware.py
   ```

6. **Check Database**:
   - SQLite: Check if `bot_visits.db` file exists and contains data
   - MySQL/PostgreSQL: Connect and verify tables exist with data

### Expected Output

After running tests, you should see:
- Bot visits logged in the database
- Statistics showing detected bots
- Classification of requests (indexing vs retrieval)
- Response times and status codes

## 🚨 Troubleshooting

### Common Setup Issues

**Port Already in Use**
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or use different port
```

**Database Connection Failed**
- Verify database server is running
- Check credentials and permissions
- Ensure firewall allows connections
- Test connection manually

**Module Not Found Errors**
- Ensure all dependencies are installed
- Check Node.js/Python/PHP versions
- Verify file paths and imports

**Permission Denied**
- Check file/directory permissions
- Ensure database directory is writable
- Run with appropriate user privileges

### Getting Help

If you encounter issues:

1. Check the logs for error messages
2. Enable debug mode for detailed information
3. Consult the framework-specific README files
4. Search existing GitHub issues
5. Create a new issue with detailed information

## 🎯 Next Steps

After successful setup:

1. **Customize Configuration**: Adjust bot patterns and classification rules
2. **Set Up Production Database**: Migrate from SQLite to PostgreSQL/MySQL for production
3. **Configure Monitoring**: Set up logging and alerting
4. **Optimize Performance**: Enable caching and async logging
5. **Deploy to Production**: Use Docker or cloud deployment
6. **Run Regular Tests**: Use the automated test scripts to validate functionality
7. **Monitor Bot Activity**: Use the analytics endpoints to track AI bot behavior

### Framework-Specific Next Steps

#### Node.js
- Integrate with your existing Express.js application
- Configure environment variables for production
- Set up PM2 or similar process manager

#### Python Flask
- Deploy using Gunicorn or uWSGI
- Configure Flask-specific logging
- Set up database migrations if needed

#### Python Django
- Add to existing Django project
- Configure Django settings for production
- Set up Django admin interface for bot management

#### PHP
- Integrate with Laravel, Symfony, or vanilla PHP
- Configure web server (Apache/Nginx)
- Set up proper error handling and logging

For detailed configuration options, see the individual middleware documentation and example files.
from flask import Flask, jsonify, g, request
import os
import sys
from datetime import datetime

# Add the middleware directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from ai_bot_tracker import init_bot_tracker

app = Flask(__name__)

# Advanced configuration with PostgreSQL and custom rules
tracker = init_bot_tracker(app,
    # Database configuration - PostgreSQL
    database={
        'type': 'postgresql',  # Change to 'sqlite' for SQLite
        'host': os.getenv('DB_HOST', 'localhost'),
        'port': int(os.getenv('DB_PORT', 5432)),
        'username': os.getenv('DB_USER', 'postgres'),
        'password': os.getenv('DB_PASS', 'password'),
        'database': os.getenv('DB_NAME', 'bot_tracker')
    },
    
    # Logging configuration
    enable_logging=True,
    
    # Bot detection configuration
    custom_bot_patterns={
        'CustomAIBot': [r'CustomAIBot', r'CompanyBot'],
        'InternalCrawler': [r'InternalCrawler/\d+\.\d+']
    },
    
    # IP ranges for known bot providers
    ip_ranges=[
        '66.249.64.0/19',    # Google
        '157.55.39.0/24',    # Bing
        '40.77.167.0/24'     # OpenAI (example)
    ],
    
    # Custom classification rules
    classification_rules={
        'indexing_patterns': [
            r'/sitemap',
            r'/feed',
            r'\.xml$',
            r'/robots\.txt'
        ],
        'retrieval_patterns': [
            r'/search',
            r'/query',
            r'/api/',
            r'\.json$'
        ],
        'retrieval_headers': [
            'x-openai-assistant-id',
            'x-claude-request-id',
            'x-perplexity-session'
        ]
    },
    
    # Performance options
    skip_non_bots=True,
    async_logging=False  # Synchronous for this example
)

# Middleware to add request timing
@app.before_request
def before_request():
    g.request_start_time = datetime.now()

@app.after_request
def after_request(response):
    if hasattr(g, 'request_start_time'):
        processing_time = (datetime.now() - g.request_start_time).total_seconds() * 1000
        response.headers['X-Processing-Time'] = f'{processing_time:.2f}ms'
    return response

# Routes with different characteristics
@app.route('/')
def home():
    """Home page"""
    bot_info = getattr(g, 'bot_info', {})
    classification_info = getattr(g, 'classification_info', {})
    
    return jsonify({
        'message': 'Advanced Flask Bot Tracker Demo',
        'bot_info': bot_info,
        'classification_info': classification_info,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/search')
def api_search():
    """Search API endpoint - likely retrieval"""
    query = request.args.get('q', '')
    
    return jsonify({
        'query': query,
        'results': [
            {'title': 'Result 1', 'url': '/page1'},
            {'title': 'Result 2', 'url': '/page2'}
        ],
        'bot_info': getattr(g, 'bot_info', {}),
        'classification_info': getattr(g, 'classification_info', {})
    })

@app.route('/articles/<int:article_id>')
def article(article_id):
    """Article pages - likely indexing"""
    return jsonify({
        'id': article_id,
        'title': f'Article {article_id}',
        'content': 'This is article content that bots might index',
        'published_date': '2024-01-01',
        'bot_info': getattr(g, 'bot_info', {}),
        'classification_info': getattr(g, 'classification_info', {})
    })

@app.route('/sitemap.xml')
def sitemap():
    """Sitemap - definitely indexing"""
    return '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>http://localhost:5000/</loc></url>
    <url><loc>http://localhost:5000/articles/1</loc></url>
    <url><loc>http://localhost:5000/articles/2</loc></url>
    <url><loc>http://localhost:5000/api/search</loc></url>
</urlset>''', 200, {'Content-Type': 'application/xml'}

@app.route('/robots.txt')
def robots():
    """Robots.txt - indexing"""
    return '''User-agent: *
Allow: /
Sitemap: http://localhost:5000/sitemap.xml''', 200, {'Content-Type': 'text/plain'}

@app.route('/feed.xml')
def rss_feed():
    """RSS feed - indexing"""
    return '''<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Bot Tracker Demo</title>
        <description>Demo RSS feed</description>
        <item>
            <title>Article 1</title>
            <link>http://localhost:5000/articles/1</link>
        </item>
    </channel>
</rss>''', 200, {'Content-Type': 'application/xml'}

# Admin endpoints
@app.route('/admin/dashboard')
def admin_dashboard():
    """Admin dashboard with comprehensive stats"""
    try:
        # Get stats for different time ranges
        stats_24h = tracker.get_stats(time_range='24h')
        stats_7d = tracker.get_stats(time_range='7d')
        
        return jsonify({
            'title': 'Bot Tracking Dashboard',
            'stats_24h': stats_24h,
            'stats_7d': stats_7d,
            'last_updated': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/stats')
def admin_stats():
    """Detailed statistics with filters"""
    try:
        # Get query parameters
        time_range = request.args.get('time_range', '7d')
        bot_name = request.args.get('bot')
        classification = request.args.get('classification')
        
        options = {'time_range': time_range}
        if bot_name:
            options['bot_name'] = bot_name
        if classification:
            options['classification'] = classification
        
        stats = tracker.get_stats(**options)
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/export', methods=['POST'])
def admin_export():
    """Bulk export with options"""
    try:
        data = request.get_json() or {}
        export_format = data.get('format', 'csv')
        time_range = data.get('time_range', '7d')
        bot_name = data.get('bot_name')
        classification = data.get('classification')
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'bot_visits_{timestamp}.{export_format}'
        file_path = f'./exports/{filename}'
        
        options = {'time_range': time_range}
        if bot_name:
            options['bot_name'] = bot_name
        if classification:
            options['classification'] = classification
        
        if export_format == 'csv':
            tracker.export_to_csv(file_path, **options)
        else:
            return jsonify({'error': 'Only CSV export is currently supported'}), 400
        
        return jsonify({
            'message': 'Export completed',
            'filename': filename,
            'file_path': file_path
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/bots')
def list_bots():
    """List all detected bots"""
    try:
        stats = tracker.get_stats()
        bot_breakdown = stats.get('bot_breakdown', [])
        
        return jsonify({
            'bots': bot_breakdown,
            'total_bots': len(bot_breakdown),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/classifications')
def classification_stats():
    """Get classification statistics"""
    try:
        stats = tracker.get_stats()
        classification_breakdown = stats.get('classification_breakdown', [])
        
        return jsonify({
            'classifications': classification_breakdown,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Health and monitoring endpoints
@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'tracker_initialized': tracker.initialized,
        'database_type': tracker.config['database']['type']
    })

@app.route('/metrics')
def metrics():
    """Basic metrics endpoint"""
    try:
        stats = tracker.get_stats(time_range='24h')
        basic_stats = stats.get('basic_stats', {})
        
        return jsonify({
            'total_visits_24h': basic_stats.get('total_visits', 0),
            'unique_ips_24h': basic_stats.get('unique_ips', 0),
            'unique_bots_24h': basic_stats.get('unique_bots', 0),
            'avg_confidence': basic_stats.get('avg_confidence', 0),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'error': 'Not found',
        'bot_info': getattr(g, 'bot_info', {}),
        'classification_info': getattr(g, 'classification_info', {})
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'error': 'Internal server error',
        'bot_info': getattr(g, 'bot_info', {})
    }), 500

if __name__ == '__main__':
    print("Starting Advanced Flask Bot Tracker Demo...")
    print("Available endpoints:")
    print("  GET  /                      - Home page")
    print("  GET  /api/search?q=term     - Search API (retrieval)")
    print("  GET  /articles/<id>         - Article pages (indexing)")
    print("  GET  /sitemap.xml           - Sitemap (indexing)")
    print("  GET  /robots.txt            - Robots.txt (indexing)")
    print("  GET  /feed.xml              - RSS feed (indexing)")
    print("  GET  /admin/dashboard       - Admin dashboard")
    print("  GET  /admin/stats           - Detailed statistics")
    print("  POST /admin/export          - Export data")
    print("  GET  /admin/bots            - List detected bots")
    print("  GET  /admin/classifications - Classification stats")
    print("  GET  /health                - Health check")
    print("  GET  /metrics               - Basic metrics")
    print("")
    print("Test with different bots:")
    print("  curl -H 'User-Agent: GPTBot/1.0' http://localhost:5000/")
    print("  curl -H 'User-Agent: ClaudeBot/1.0' -H 'Referer: https://claude.ai' http://localhost:5000/api/search?q=test")
    print("  curl -H 'User-Agent: CustomAIBot/1.0' http://localhost:5000/articles/1")
    print("")
    
    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    finally:
        # Clean up on shutdown
        tracker.close()
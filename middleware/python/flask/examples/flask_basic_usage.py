#!/usr/bin/env python3
"""
Flask Basic Usage Example for AI Bot Visit Tracker

This example demonstrates how to integrate the AI Bot Visit Tracker
into a Flask application with various configuration options.

Installation:
    pip install flask sqlite3

Usage:
    python flask_basic_usage.py
    
Then visit: http://localhost:5000
"""

import os
import sys
from flask import Flask, jsonify, request, render_template_string

# Add the middleware path
sys.path.append(os.path.join(os.path.dirname(__file__), '../'))

from ai_bot_tracker_flask import AiBotTrackerFlask, track_bots

# Create Flask application
app = Flask(__name__)

# Configure bot tracker settings
app.config.update({
    'BOT_TRACKER_DATABASE_TYPE': 'sqlite',
    'BOT_TRACKER_DATABASE_PATH': os.path.join(os.path.dirname(__file__), '../../../../data/bot_visits.db'),
    'BOT_TRACKER_ENABLE_LOGGING': True,
    'BOT_TRACKER_LOG_LEVEL': 'debug',
    'BOT_TRACKER_ADD_HEADERS': True,
    'BOT_TRACKER_HEADER_PREFIX': 'X-Bot-Tracker-',
    'BOT_TRACKER_CUSTOM_BOTS': [
        {
            'name': 'custom_crawler',
            'patterns': ['custombot', 'mycrawler'],
            'type': 'indexing'
        }
    ],
    'BOT_TRACKER_CLASSIFICATION_RULES': {
        'api_endpoints': {
            'patterns': ['/api/', '/search'],
            'classification': 'retrieval'
        },
        'content_pages': {
            'patterns': ['/', '.html'],
            'classification': 'indexing'
        }
    }
})

# Initialize bot tracker
bot_tracker = AiBotTrackerFlask(app)

# Basic HTML template for demo pages
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ title }}</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .content { line-height: 1.6; }
        .api-link { display: inline-block; margin: 10px; padding: 10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 3px; }
        .api-link:hover { background: #0056b3; }
        .bot-info { background: #e9ecef; padding: 15px; border-radius: 5px; margin: 10px 0; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
    </div>
    <div class="content">
        {{ content | safe }}
    </div>
</body>
</html>
"""

@app.route('/')
def home():
    """Home page - demonstrates basic bot tracking"""
    content = """
    <h2>Welcome to the AI Bot Visit Tracker Demo</h2>
    <p>This Flask application demonstrates AI bot detection and logging capabilities.</p>
    
    <div class="bot-info">
        <h3>🤖 Bot Detection Active</h3>
        <p>This page automatically detects and logs visits from AI bots including:</p>
        <ul>
            <li>GoogleBot (Google Search)</li>
            <li>BingBot (Microsoft Bing)</li>
            <li>GPTBot (OpenAI ChatGPT)</li>
            <li>ClaudeBot (Anthropic Claude)</li>
            <li>PerplexityBot (Perplexity AI)</li>
            <li>And many more...</li>
        </ul>
    </div>
    
    <h3>📊 Available Endpoints</h3>
    <a href="/api/stats" class="api-link">View Bot Statistics</a>
    <a href="/api/visits" class="api-link">Recent Bot Visits</a>
    <a href="/simulate/googlebot" class="api-link">Simulate GoogleBot</a>
    <a href="/content/article" class="api-link">Sample Article</a>
    <a href="/search?q=test" class="api-link">Search Page</a>
    """
    
    return render_template_string(HTML_TEMPLATE, 
                                title="AI Bot Visit Tracker - Flask Demo",
                                description="Demonstrating AI bot detection and logging in Flask",
                                content=content)

@app.route('/content/article')
def article():
    """Sample article page - typically indexed by bots"""
    content = """
    <h2>📄 Sample Article Page</h2>
    <p>This is a sample content page that would typically be indexed by search engine bots.</p>
    
    <article>
        <h3>Understanding AI Bot Behavior</h3>
        <p>AI bots visit websites for various purposes:</p>
        <ul>
            <li><strong>Indexing:</strong> Crawling content for search engines</li>
            <li><strong>Retrieval:</strong> Fetching specific information for AI responses</li>
            <li><strong>Monitoring:</strong> Checking for changes or updates</li>
        </ul>
        
        <p>Our bot tracker classifies these visits and provides insights into bot behavior patterns.</p>
    </article>
    
    <p><a href="/">← Back to Home</a></p>
    """
    
    return render_template_string(HTML_TEMPLATE,
                                title="Sample Article - AI Bot Tracker",
                                description="A sample article page for bot indexing demonstration",
                                content=content)

@app.route('/search')
def search():
    """Search page - typically used for retrieval by AI bots"""
    query = request.args.get('q', '')
    
    content = f"""
    <h2>🔍 Search Results</h2>
    <p>Search query: <strong>{query or 'No query provided'}</strong></p>
    
    <div class="bot-info">
        <h3>🎯 Retrieval Classification</h3>
        <p>Search pages are typically classified as "retrieval" requests when accessed by AI bots,
        as they're looking for specific information rather than indexing general content.</p>
    </div>
    
    <h3>Mock Search Results:</h3>
    <ul>
        <li>Result 1: Understanding AI Bot Detection</li>
        <li>Result 2: Web Scraping vs. Bot Crawling</li>
        <li>Result 3: Implementing Bot Tracking in Flask</li>
    </ul>
    
    <p><a href="/">← Back to Home</a></p>
    """
    
    return render_template_string(HTML_TEMPLATE,
                                title=f"Search: {query}" if query else "Search",
                                description="Search functionality demonstration",
                                content=content)

@app.route('/api/stats')
def api_stats():
    """API endpoint to get bot visit statistics"""
    try:
        stats = bot_tracker.get_stats()
        return jsonify({
            'success': True,
            'data': stats,
            'message': 'Bot statistics retrieved successfully'
        })
    except Exception as error:
        return jsonify({
            'success': False,
            'error': str(error),
            'message': 'Failed to retrieve bot statistics'
        }), 500

@app.route('/api/visits')
def api_visits():
    """API endpoint to get recent bot visits"""
    try:
        limit = request.args.get('limit', 50, type=int)
        visits = bot_tracker.get_recent_visits(limit)
        return jsonify({
            'success': True,
            'data': visits,
            'count': len(visits),
            'message': f'Retrieved {len(visits)} recent bot visits'
        })
    except Exception as error:
        return jsonify({
            'success': False,
            'error': str(error),
            'message': 'Failed to retrieve bot visits'
        }), 500

@app.route('/simulate/googlebot')
def simulate_googlebot():
    """Simulate a GoogleBot visit for testing"""
    content = """
    <h2>🤖 GoogleBot Simulation</h2>
    <p>This page simulates what a GoogleBot would see when crawling your site.</p>
    
    <div class="bot-info">
        <h3>🔍 Bot Detection</h3>
        <p>If you're accessing this page with a regular browser, it won't be detected as a bot.
        To simulate a real bot visit, you can use curl:</p>
        
        <pre>curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:5000/simulate/googlebot</pre>
    </div>
    
    <h3>📊 Current Request Headers</h3>
    <pre>{{ headers }}</pre>
    
    <p><a href="/">← Back to Home</a></p>
    """
    
    # Get current request headers for display
    headers_dict = dict(request.headers)
    headers_json = '\n'.join([f"{k}: {v}" for k, v in headers_dict.items()])
    
    return render_template_string(HTML_TEMPLATE,
                                title="GoogleBot Simulation",
                                description="Simulating a GoogleBot visit",
                                content=content.replace('{{ headers }}', headers_json))

@app.route('/admin/dashboard')
@track_bots()  # Example of using the decorator
def admin_dashboard():
    """Admin dashboard with bot tracking decorator"""
    try:
        stats = bot_tracker.get_stats()
        recent_visits = bot_tracker.get_recent_visits(10)
        
        content = f"""
        <h2>📊 Admin Dashboard</h2>
        <p>Bot tracking statistics and recent activity.</p>
        
        <h3>📈 Statistics</h3>
        <pre>{stats}</pre>
        
        <h3>🕒 Recent Visits (Last 10)</h3>
        <pre>{recent_visits}</pre>
        
        <p><a href="/">← Back to Home</a></p>
        """
        
        return render_template_string(HTML_TEMPLATE,
                                    title="Admin Dashboard",
                                    description="Bot tracking administration",
                                    content=content)
    except Exception as error:
        return jsonify({'error': str(error)}), 500

@app.errorhandler(404)
def not_found(error):
    """Custom 404 page"""
    content = """
    <h2>❌ Page Not Found</h2>
    <p>The requested page could not be found.</p>
    <p>Bot visits to non-existent pages are also tracked and logged.</p>
    <p><a href="/">← Back to Home</a></p>
    """
    
    return render_template_string(HTML_TEMPLATE,
                                title="404 - Page Not Found",
                                description="Page not found",
                                content=content), 404

@app.errorhandler(500)
def server_error(error):
    """Custom 500 page"""
    content = """
    <h2>⚠️ Server Error</h2>
    <p>An internal server error occurred.</p>
    <p>Bot tracking continues to work even when errors occur.</p>
    <p><a href="/">← Back to Home</a></p>
    """
    
    return render_template_string(HTML_TEMPLATE,
                                title="500 - Server Error",
                                description="Internal server error",
                                content=content), 500

if __name__ == '__main__':
    print("🚀 Starting Flask AI Bot Tracker Demo...")
    print("📊 Dashboard: http://localhost:5000")
    print("📈 API Stats: http://localhost:5000/api/stats")
    print("🤖 API Visits: http://localhost:5000/api/visits")
    print("\n🧪 Test with curl:")
    print('curl -H "User-Agent: Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" http://localhost:5000/')
    print("\n⏹️  Press Ctrl+C to stop the server")
    
    # Run the Flask development server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True,
        use_reloader=True
    )
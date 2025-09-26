from flask import Flask, jsonify, g
import os
import sys

# Add the middleware directory to Python path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from ai_bot_tracker import init_bot_tracker

app = Flask(__name__)

# Initialize bot tracker with basic configuration
tracker = init_bot_tracker(app,
    database={
        'type': 'sqlite',
        'path': './bot_visits.db'
    },
    enable_logging=True,
    skip_non_bots=True,
    async_logging=True
)

@app.route('/')
def home():
    """Home page"""
    bot_info = getattr(g, 'bot_info', {})
    classification_info = getattr(g, 'classification_info', {})
    
    return jsonify({
        'message': 'AI Bot Tracker Flask Demo',
        'bot_detected': bot_info.get('is_bot', False),
        'bot_name': bot_info.get('bot_name', 'Not a bot'),
        'classification': classification_info.get('classification'),
        'confidence': classification_info.get('confidence'),
        'timestamp': '2024-01-01T00:00:00Z'  # Would be actual timestamp
    })

@app.route('/api/data')
def api_data():
    """API endpoint - likely retrieval"""
    bot_info = getattr(g, 'bot_info', {})
    
    return jsonify({
        'data': 'This is some API data',
        'bot_info': bot_info,
        'classification_info': getattr(g, 'classification_info', {})
    })

@app.route('/blog/post-<int:post_id>')
def blog_post(post_id):
    """Blog post - likely indexing"""
    return jsonify({
        'id': post_id,
        'title': f'Blog Post {post_id}',
        'content': 'This is blog content that bots might index',
        'bot_info': getattr(g, 'bot_info', {}),
        'classification_info': getattr(g, 'classification_info', {})
    })

@app.route('/sitemap.xml')
def sitemap():
    """Sitemap - definitely indexing"""
    return '''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>http://localhost:5000/</loc></url>
    <url><loc>http://localhost:5000/blog/post-1</loc></url>
    <url><loc>http://localhost:5000/blog/post-2</loc></url>
</urlset>''', 200, {'Content-Type': 'application/xml'}

@app.route('/admin/stats')
def admin_stats():
    """Get bot statistics"""
    try:
        stats = tracker.get_stats()
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/export/csv')
def export_csv():
    """Export data to CSV"""
    try:
        file_path = './exports/bot_visits.csv'
        tracker.export_to_csv(file_path)
        return jsonify({
            'message': 'CSV export completed',
            'file_path': file_path
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'tracker_initialized': tracker.initialized
    })

if __name__ == '__main__':
    print("Starting Flask Bot Tracker Demo...")
    print("Available endpoints:")
    print("  GET  /                    - Home page")
    print("  GET  /api/data            - API data (retrieval)")
    print("  GET  /blog/post-<id>      - Blog posts (indexing)")
    print("  GET  /sitemap.xml         - Sitemap (indexing)")
    print("  GET  /admin/stats         - Bot statistics")
    print("  GET  /admin/export/csv    - Export to CSV")
    print("  GET  /health              - Health check")
    print("")
    print("Test with different user agents:")
    print("  curl -H 'User-Agent: GPTBot/1.0' http://localhost:5000/")
    print("  curl -H 'User-Agent: ClaudeBot/1.0' -H 'Referer: https://claude.ai' http://localhost:5000/api/data")
    print("  curl -H 'User-Agent: Mozilla/5.0' http://localhost:5000/")
    print("")
    
    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    finally:
        # Clean up on shutdown
        tracker.close()
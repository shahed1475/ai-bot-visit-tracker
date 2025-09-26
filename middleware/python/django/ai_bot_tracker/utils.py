"""
Utility classes for AI Bot Detection and Request Classification
"""

import re
import json
import ipaddress
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from user_agents import parse
from django.utils import timezone
from django.core.cache import cache


class BotDetector:
    """Detects AI bots based on user-agent patterns and IP ranges"""
    
    def __init__(self, custom_patterns: Dict[str, List[str]] = None, ip_ranges: List[str] = None):
        self.bot_patterns = {
            # OpenAI
            'GPTBot': [r'GPTBot', r'ChatGPT-User'],
            'OpenAI': [r'OpenAI', r'GPT-\d+'],
            
            # Anthropic
            'ClaudeBot': [r'ClaudeBot', r'Claude-Web'],
            'Anthropic': [r'anthropic', r'claude'],
            
            # Google
            'Google-Extended': [r'Google-Extended'],
            'GoogleBot': [r'Googlebot', r'Google'],
            'Bard': [r'Bard', r'Google-Bard'],
            
            # Microsoft
            'BingBot': [r'bingbot', r'BingPreview'],
            'EdgeBot': [r'Edge', r'Edg/'],
            
            # Perplexity
            'PerplexityBot': [r'PerplexityBot', r'Perplexity'],
            
            # Meta
            'FacebookBot': [r'facebookexternalhit', r'FacebookBot'],
            'Meta-ExternalAgent': [r'Meta-ExternalAgent'],
            
            # Other AI services
            'YouBot': [r'YouBot'],
            'CohereBotBot': [r'CohereBotBot'],
            'AI2Bot': [r'AI2Bot'],
            'SemanticScholarBot': [r'SemanticScholarBot'],
            'ResearchBot': [r'ResearchBot'],
            'DataForSeoBot': [r'DataForSeoBot'],
            'ImagesiftBot': [r'ImagesiftBot'],
            'CCBot': [r'CCBot'],
            'ChatGPT': [r'ChatGPT'],
            'GPT-4': [r'GPT-4'],
            'Claude': [r'Claude'],
        }
        
        # Add custom patterns
        if custom_patterns:
            self.bot_patterns.update(custom_patterns)
        
        # Compile regex patterns for better performance
        self.compiled_patterns = {}
        for bot_name, patterns in self.bot_patterns.items():
            self.compiled_patterns[bot_name] = [
                re.compile(pattern, re.IGNORECASE) for pattern in patterns
            ]
        
        # IP ranges for known AI services
        self.ip_ranges = ip_ranges or []
        self.compiled_ip_ranges = []
        for ip_range in self.ip_ranges:
            try:
                self.compiled_ip_ranges.append(ipaddress.ip_network(ip_range))
            except ValueError:
                continue
    
    def detect_bot(self, user_agent: str, ip_address: str = None) -> Tuple[bool, Optional[str], float]:
        """
        Detect if request is from an AI bot
        
        Returns:
            Tuple of (is_bot, bot_name, confidence)
        """
        if not user_agent:
            return False, None, 0.0
        
        # Check user agent patterns
        for bot_name, patterns in self.compiled_patterns.items():
            for pattern in patterns:
                if pattern.search(user_agent):
                    confidence = 0.95 if len(pattern.pattern) > 10 else 0.8
                    return True, bot_name, confidence
        
        # Check IP ranges
        if ip_address and self.compiled_ip_ranges:
            try:
                ip = ipaddress.ip_address(ip_address)
                for ip_range in self.compiled_ip_ranges:
                    if ip in ip_range:
                        return True, 'Unknown-Bot-IP', 0.7
            except ValueError:
                pass
        
        # Check for generic bot indicators
        bot_indicators = [
            r'bot', r'crawler', r'spider', r'scraper', r'fetch', r'agent'
        ]
        
        for indicator in bot_indicators:
            if re.search(indicator, user_agent, re.IGNORECASE):
                return True, 'Generic-Bot', 0.5
        
        return False, None, 0.0
    
    def is_known_ai_bot(self, user_agent: str) -> bool:
        """Check if user agent belongs to a known AI bot"""
        is_bot, bot_name, confidence = self.detect_bot(user_agent)
        return is_bot and confidence > 0.6
    
    def get_bot_info(self, user_agent: str, ip_address: str = None) -> Dict:
        """Get detailed bot information"""
        is_bot, bot_name, confidence = self.detect_bot(user_agent, ip_address)
        
        # Parse user agent for additional info
        parsed_ua = parse(user_agent)
        
        return {
            'is_bot': is_bot,
            'bot_name': bot_name,
            'confidence': confidence,
            'detection_method': 'user_agent' if bot_name else 'ip_range' if 'IP' in (bot_name or '') else 'none',
            'browser_family': parsed_ua.browser.family,
            'os_family': parsed_ua.os.family,
            'device_family': parsed_ua.device.family,
            'is_mobile': parsed_ua.is_mobile,
            'is_tablet': parsed_ua.is_tablet,
            'is_pc': parsed_ua.is_pc
        }


class RequestClassifier:
    """Classifies bot requests as indexing or retrieval"""
    
    def __init__(self, custom_rules: Dict = None):
        # Default classification rules
        self.indexing_patterns = [
            r'/sitemap.*\.xml',
            r'/robots\.txt',
            r'/feed',
            r'/rss',
            r'\.xml$',
            r'/page/\d+',
            r'/category/',
            r'/tag/',
            r'/archive/',
        ]
        
        self.retrieval_patterns = [
            r'/search',
            r'/api/',
            r'/query',
            r'/ask',
            r'/chat',
            r'/assistant',
            r'/completion',
        ]
        
        self.retrieval_headers = [
            'x-openai-assistant-id',
            'x-openai-thread-id',
            'x-claude-conversation-id',
            'x-perplexity-session-id',
            'authorization',
        ]
        
        self.indexing_user_agents = [
            r'crawler', r'spider', r'indexer', r'archive'
        ]
        
        self.retrieval_user_agents = [
            r'assistant', r'chat', r'query', r'search'
        ]
        
        # Apply custom rules
        if custom_rules:
            self.indexing_patterns.extend(custom_rules.get('indexing_patterns', []))
            self.retrieval_patterns.extend(custom_rules.get('retrieval_patterns', []))
            self.retrieval_headers.extend(custom_rules.get('retrieval_headers', []))
        
        # Compile patterns
        self.compiled_indexing = [re.compile(p, re.IGNORECASE) for p in self.indexing_patterns]
        self.compiled_retrieval = [re.compile(p, re.IGNORECASE) for p in self.retrieval_patterns]
        self.compiled_indexing_ua = [re.compile(p, re.IGNORECASE) for p in self.indexing_user_agents]
        self.compiled_retrieval_ua = [re.compile(p, re.IGNORECASE) for p in self.retrieval_user_agents]
    
    def classify_request(self, url: str, headers: Dict, user_agent: str, 
                        ip_address: str = None, method: str = 'GET') -> Dict:
        """
        Classify request as indexing or retrieval
        
        Returns:
            Dict with classification, confidence, and reasoning
        """
        indexing_score = 0.0
        retrieval_score = 0.0
        reasons = []
        
        # URL pattern analysis
        for pattern in self.compiled_indexing:
            if pattern.search(url):
                indexing_score += 0.3
                reasons.append(f"URL matches indexing pattern: {pattern.pattern}")
        
        for pattern in self.compiled_retrieval:
            if pattern.search(url):
                retrieval_score += 0.3
                reasons.append(f"URL matches retrieval pattern: {pattern.pattern}")
        
        # Header analysis
        headers_lower = {k.lower(): v for k, v in headers.items()}
        
        # Check for retrieval-specific headers
        for header in self.retrieval_headers:
            if header.lower() in headers_lower:
                retrieval_score += 0.4
                reasons.append(f"Has retrieval header: {header}")
        
        # Referer analysis
        referer = headers_lower.get('referer', '')
        if referer:
            # Has referer suggests retrieval (user-initiated)
            retrieval_score += 0.2
            reasons.append("Has referer header")
            
            # Check if referer is from AI platforms
            ai_platforms = [
                'openai.com', 'chat.openai.com', 'claude.ai', 'anthropic.com',
                'perplexity.ai', 'bard.google.com', 'bing.com/chat'
            ]
            
            for platform in ai_platforms:
                if platform in referer.lower():
                    retrieval_score += 0.3
                    reasons.append(f"Referer from AI platform: {platform}")
                    break
        else:
            # No referer suggests indexing (direct crawling)
            indexing_score += 0.2
            reasons.append("No referer header")
        
        # User agent analysis
        for pattern in self.compiled_indexing_ua:
            if pattern.search(user_agent):
                indexing_score += 0.2
                reasons.append(f"User agent suggests indexing: {pattern.pattern}")
        
        for pattern in self.compiled_retrieval_ua:
            if pattern.search(user_agent):
                retrieval_score += 0.2
                reasons.append(f"User agent suggests retrieval: {pattern.pattern}")
        
        # Request frequency analysis (using cache)
        if ip_address:
            cache_key = f"bot_requests_{ip_address}"
            recent_requests = cache.get(cache_key, [])
            current_time = timezone.now().timestamp()
            
            # Clean old requests (older than 1 hour)
            recent_requests = [req for req in recent_requests if current_time - req < 3600]
            
            # Add current request
            recent_requests.append(current_time)
            cache.set(cache_key, recent_requests, 3600)  # Cache for 1 hour
            
            # Analyze frequency
            if len(recent_requests) > 10:  # More than 10 requests in an hour
                indexing_score += 0.3
                reasons.append("High request frequency suggests indexing")
            elif len(recent_requests) <= 3:  # Few requests
                retrieval_score += 0.2
                reasons.append("Low request frequency suggests retrieval")
        
        # HTTP method analysis
        if method.upper() in ['POST', 'PUT', 'PATCH']:
            retrieval_score += 0.2
            reasons.append(f"HTTP method {method} suggests retrieval")
        
        # Determine classification
        if retrieval_score > indexing_score:
            classification = 'retrieval'
            confidence = min(retrieval_score, 1.0)
        elif indexing_score > retrieval_score:
            classification = 'indexing'
            confidence = min(indexing_score, 1.0)
        else:
            classification = 'unknown'
            confidence = 0.5
        
        return {
            'classification': classification,
            'confidence': confidence,
            'indexing_score': indexing_score,
            'retrieval_score': retrieval_score,
            'reasons': reasons
        }
    
    def is_likely_indexing(self, url: str, headers: Dict, user_agent: str) -> bool:
        """Quick check if request is likely indexing"""
        result = self.classify_request(url, headers, user_agent)
        return result['classification'] == 'indexing' and result['confidence'] > 0.6
    
    def is_likely_retrieval(self, url: str, headers: Dict, user_agent: str) -> bool:
        """Quick check if request is likely retrieval"""
        result = self.classify_request(url, headers, user_agent)
        return result['classification'] == 'retrieval' and result['confidence'] > 0.6


def get_client_ip(request):
    """Extract client IP address from Django request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def sanitize_headers(headers: Dict) -> Dict:
    """Sanitize headers by removing sensitive information"""
    sensitive_headers = [
        'authorization', 'cookie', 'x-api-key', 'x-auth-token',
        'x-csrf-token', 'x-session-id'
    ]
    
    sanitized = {}
    for key, value in headers.items():
        if key.lower() in sensitive_headers:
            sanitized[key] = '[REDACTED]'
        else:
            # Truncate very long header values
            sanitized[key] = str(value)[:500] if len(str(value)) > 500 else str(value)
    
    return sanitized


def export_to_csv(queryset, file_path: str):
    """Export Django queryset to CSV file"""
    import csv
    
    with open(file_path, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = [
            'timestamp', 'ip_address', 'bot_name', 'page_url', 'classification',
            'classification_confidence', 'user_agent', 'referer', 'request_method',
            'response_status', 'response_time'
        ]
        
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        for visit in queryset:
            writer.writerow({
                'timestamp': visit.timestamp.isoformat(),
                'ip_address': visit.ip_address,
                'bot_name': visit.bot_name or '',
                'page_url': visit.page_url,
                'classification': visit.classification,
                'classification_confidence': visit.classification_confidence,
                'user_agent': visit.user_agent,
                'referer': visit.referer or '',
                'request_method': visit.request_method,
                'response_status': visit.response_status or '',
                'response_time': visit.response_time or ''
            })


def export_to_json(queryset, file_path: str):
    """Export Django queryset to JSON file"""
    import json
    
    data = []
    for visit in queryset:
        data.append({
            'timestamp': visit.timestamp.isoformat(),
            'ip_address': visit.ip_address,
            'bot_name': visit.bot_name,
            'page_url': visit.page_url,
            'headers': visit.get_headers_dict(),
            'classification': visit.classification,
            'classification_confidence': visit.classification_confidence,
            'classification_reason': visit.classification_reason,
            'user_agent': visit.user_agent,
            'referer': visit.referer,
            'request_method': visit.request_method,
            'response_status': visit.response_status,
            'response_time': visit.response_time
        })
    
    with open(file_path, 'w', encoding='utf-8') as jsonfile:
        json.dump(data, jsonfile, indent=2, default=str)
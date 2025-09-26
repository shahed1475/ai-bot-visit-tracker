#!/usr/bin/env python3
"""
Request Classifier - Python Implementation

This module provides request classification capabilities for Python frameworks
(Flask, Django, FastAPI, etc.) with consistent logic across all implementations.

Author: AI Bot Visit Tracker
Version: 1.0.0
"""

import re
import json
import hashlib
from typing import Dict, List, Optional, Union, Any, Tuple
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urlparse, parse_qs


@dataclass
class ClassificationResult:
    """Data class for classification results"""
    classification: str
    confidence: float
    reasoning: List[str]
    metadata: Dict[str, Any] = None


class RequestClassifier:
    """
    Request Classifier for AI Bot visits
    
    Classifies bot requests into categories like 'indexing', 'retrieval', 
    'monitoring', etc. based on various request characteristics.
    """
    
    def __init__(self, custom_rules: Optional[List[Dict]] = None):
        """
        Initialize the request classifier
        
        Args:
            custom_rules: List of custom classification rules
        """
        self.classification_rules = self._initialize_classification_rules()
        self.custom_rules = custom_rules or []
        
        # Add custom rules
        for rule in self.custom_rules:
            self.add_custom_rule(rule)
    
    def _initialize_classification_rules(self) -> List[Dict[str, Any]]:
        """Initialize default classification rules"""
        return [
            # Indexing patterns
            {
                'name': 'search_engine_indexing',
                'classification': 'indexing',
                'confidence': 0.9,
                'conditions': {
                    'bot_types': ['indexing'],
                    'bot_names': ['googlebot', 'bingbot', 'yahoobot', 'baidubot', 'yandexbot'],
                    'url_patterns': [r'.*'],  # All URLs for search engines
                    'method': ['GET', 'HEAD']
                },
                'reasoning': 'Search engine bot performing indexing'
            },
            
            # AI/LLM Retrieval patterns
            {
                'name': 'ai_content_retrieval',
                'classification': 'retrieval',
                'confidence': 0.95,
                'conditions': {
                    'bot_names': ['gptbot', 'claudebot', 'perplexitybot', 'bardbot'],
                    'url_patterns': [
                        r'/article/',
                        r'/blog/',
                        r'/post/',
                        r'/content/',
                        r'/news/',
                        r'/docs?/',
                        r'/wiki/',
                        r'/faq',
                        r'/help'
                    ],
                    'method': ['GET']
                },
                'reasoning': 'AI bot retrieving content for training or answering queries'
            },
            
            # API Access patterns
            {
                'name': 'api_access',
                'classification': 'api_access',
                'confidence': 0.85,
                'conditions': {
                    'url_patterns': [
                        r'/api/',
                        r'/v\d+/',
                        r'\.json$',
                        r'\.xml$',
                        r'/rest/',
                        r'/graphql'
                    ],
                    'headers': {
                        'accept': [r'application/json', r'application/xml', r'text/xml']
                    }
                },
                'reasoning': 'Bot accessing API endpoints'
            },
            
            # Social Media Sharing
            {
                'name': 'social_media_preview',
                'classification': 'social_preview',
                'confidence': 0.8,
                'conditions': {
                    'bot_names': ['facebookbot', 'twitterbot', 'linkedinbot', 'discordbot', 'slackbot'],
                    'url_patterns': [r'.*'],  # Any URL for social media bots
                    'method': ['GET', 'HEAD']
                },
                'reasoning': 'Social media bot generating link previews'
            },
            
            # SEO Analysis
            {
                'name': 'seo_analysis',
                'classification': 'seo_analysis',
                'confidence': 0.8,
                'conditions': {
                    'bot_names': ['ahrefsbot', 'semrushbot', 'mozbot'],
                    'url_patterns': [r'.*'],
                    'method': ['GET', 'HEAD']
                },
                'reasoning': 'SEO tool analyzing website'
            },
            
            # Monitoring and Health Checks
            {
                'name': 'monitoring_health_check',
                'classification': 'monitoring',
                'confidence': 0.75,
                'conditions': {
                    'url_patterns': [
                        r'/health',
                        r'/status',
                        r'/ping',
                        r'/check',
                        r'/monitor',
                        r'/heartbeat'
                    ],
                    'method': ['GET', 'HEAD']
                },
                'reasoning': 'Bot performing health checks or monitoring'
            },
            
            # Sitemap and Robots
            {
                'name': 'sitemap_robots_access',
                'classification': 'indexing',
                'confidence': 0.9,
                'conditions': {
                    'url_patterns': [
                        r'/sitemap\.xml$',
                        r'/robots\.txt$',
                        r'/sitemap',
                        r'\.xml$'
                    ],
                    'method': ['GET']
                },
                'reasoning': 'Bot accessing sitemap or robots.txt for indexing'
            },
            
            # Feed Access
            {
                'name': 'feed_access',
                'classification': 'feed_consumption',
                'confidence': 0.8,
                'conditions': {
                    'url_patterns': [
                        r'/feed',
                        r'/rss',
                        r'/atom',
                        r'\.rss$',
                        r'\.atom$'
                    ],
                    'method': ['GET']
                },
                'reasoning': 'Bot accessing RSS/Atom feeds'
            },
            
            # Image and Media Access
            {
                'name': 'media_access',
                'classification': 'media_indexing',
                'confidence': 0.7,
                'conditions': {
                    'url_patterns': [
                        r'\.(jpg|jpeg|png|gif|webp|svg)$',
                        r'\.(mp4|avi|mov|webm)$',
                        r'\.(mp3|wav|ogg)$',
                        r'/images?/',
                        r'/media/',
                        r'/assets/'
                    ],
                    'method': ['GET', 'HEAD']
                },
                'reasoning': 'Bot accessing media files for indexing'
            },
            
            # Security Scanning
            {
                'name': 'security_scanning',
                'classification': 'security_scan',
                'confidence': 0.6,
                'conditions': {
                    'url_patterns': [
                        r'/admin',
                        r'/login',
                        r'/wp-admin',
                        r'/phpmyadmin',
                        r'\.php$',
                        r'/config',
                        r'/backup'
                    ],
                    'user_agent_patterns': [
                        r'scanner',
                        r'security',
                        r'vulnerability'
                    ]
                },
                'reasoning': 'Potential security scanning activity'
            }
        ]
    
    def classify_request(self, request_data: Dict[str, Any]) -> ClassificationResult:
        """
        Classify a bot request based on various characteristics
        
        Args:
            request_data: Dictionary containing request information
                         Required keys: url, method, user_agent
                         Optional keys: headers, bot_name, bot_type, ip_address, referer
        
        Returns:
            ClassificationResult object
        """
        url = request_data.get('url', '')
        method = request_data.get('method', 'GET').upper()
        user_agent = request_data.get('user_agent', '')
        headers = request_data.get('headers', {})
        bot_name = request_data.get('bot_name', '').lower()
        bot_type = request_data.get('bot_type', '')
        ip_address = request_data.get('ip_address', '')
        referer = request_data.get('referer', '')
        
        # Parse URL for analysis
        parsed_url = urlparse(url)
        path = parsed_url.path.lower()
        query_params = parse_qs(parsed_url.query)
        
        best_match = None
        best_confidence = 0.0
        
        # Check each classification rule
        for rule in self.classification_rules:
            confidence, reasoning = self._evaluate_rule(
                rule, path, method, user_agent, headers, 
                bot_name, bot_type, query_params, referer
            )
            
            if confidence > best_confidence:
                best_confidence = confidence
                best_match = rule
                best_reasoning = reasoning
        
        # If no rule matches well, provide default classification
        if best_confidence < 0.3:
            return ClassificationResult(
                classification='unknown',
                confidence=0.1,
                reasoning=['No classification rules matched with sufficient confidence'],
                metadata={
                    'url': url,
                    'method': method,
                    'bot_name': bot_name,
                    'bot_type': bot_type,
                    'path': path
                }
            )
        
        return ClassificationResult(
            classification=best_match['classification'],
            confidence=best_confidence,
            reasoning=best_reasoning,
            metadata={
                'rule_name': best_match['name'],
                'url': url,
                'method': method,
                'bot_name': bot_name,
                'bot_type': bot_type,
                'path': path,
                'query_params': list(query_params.keys()) if query_params else []
            }
        )
    
    def _evaluate_rule(self, rule: Dict[str, Any], path: str, method: str, 
                      user_agent: str, headers: Dict[str, str], bot_name: str, 
                      bot_type: str, query_params: Dict[str, List[str]], 
                      referer: str) -> Tuple[float, List[str]]:
        """
        Evaluate a single classification rule
        
        Returns:
            Tuple of (confidence_score, reasoning_list)
        """
        conditions = rule.get('conditions', {})
        base_confidence = rule.get('confidence', 0.5)
        reasoning = [rule.get('reasoning', 'Rule matched')]
        
        score = 0.0
        total_conditions = 0
        matched_conditions = 0
        
        # Check bot types
        if 'bot_types' in conditions and bot_type:
            total_conditions += 1
            if bot_type in conditions['bot_types']:
                matched_conditions += 1
                score += 0.3
                reasoning.append(f"Bot type '{bot_type}' matches rule")
        
        # Check bot names
        if 'bot_names' in conditions and bot_name:
            total_conditions += 1
            if bot_name in conditions['bot_names']:
                matched_conditions += 1
                score += 0.4
                reasoning.append(f"Bot name '{bot_name}' matches rule")
        
        # Check URL patterns
        if 'url_patterns' in conditions:
            total_conditions += 1
            for pattern in conditions['url_patterns']:
                if re.search(pattern, path, re.IGNORECASE):
                    matched_conditions += 1
                    score += 0.3
                    reasoning.append(f"URL path matches pattern '{pattern}'")
                    break
        
        # Check HTTP method
        if 'method' in conditions:
            total_conditions += 1
            if method in conditions['method']:
                matched_conditions += 1
                score += 0.1
                reasoning.append(f"HTTP method '{method}' matches rule")
        
        # Check user agent patterns
        if 'user_agent_patterns' in conditions and user_agent:
            total_conditions += 1
            user_agent_lower = user_agent.lower()
            for pattern in conditions['user_agent_patterns']:
                if re.search(pattern, user_agent_lower, re.IGNORECASE):
                    matched_conditions += 1
                    score += 0.2
                    reasoning.append(f"User agent matches pattern '{pattern}'")
                    break
        
        # Check headers
        if 'headers' in conditions and headers:
            for header_name, header_patterns in conditions['headers'].items():
                total_conditions += 1
                header_value = headers.get(header_name, '').lower()
                if header_value:
                    for pattern in header_patterns:
                        if re.search(pattern, header_value, re.IGNORECASE):
                            matched_conditions += 1
                            score += 0.2
                            reasoning.append(f"Header '{header_name}' matches pattern '{pattern}'")
                            break
        
        # Check query parameters
        if 'query_params' in conditions and query_params:
            for param_name in conditions['query_params']:
                total_conditions += 1
                if param_name in query_params:
                    matched_conditions += 1
                    score += 0.1
                    reasoning.append(f"Query parameter '{param_name}' present")
        
        # Calculate final confidence
        if total_conditions == 0:
            return 0.0, ['No conditions to evaluate']
        
        match_ratio = matched_conditions / total_conditions
        final_confidence = base_confidence * match_ratio * min(score, 1.0)
        
        return final_confidence, reasoning
    
    def add_custom_rule(self, rule: Dict[str, Any]) -> None:
        """
        Add a custom classification rule
        
        Args:
            rule: Dictionary containing rule configuration
                  Required keys: name, classification, conditions
                  Optional keys: confidence, reasoning
        """
        required_keys = ['name', 'classification', 'conditions']
        for key in required_keys:
            if key not in rule:
                raise ValueError(f"Rule must include '{key}'")
        
        # Set defaults
        rule.setdefault('confidence', 0.7)
        rule.setdefault('reasoning', f"Custom rule: {rule['name']}")
        
        self.classification_rules.append(rule)
    
    def get_classification_stats(self) -> Dict[str, Any]:
        """
        Get statistics about classification rules
        
        Returns:
            Dictionary with classification statistics
        """
        classifications = {}
        total_rules = len(self.classification_rules)
        
        for rule in self.classification_rules:
            classification = rule['classification']
            classifications[classification] = classifications.get(classification, 0) + 1
        
        return {
            'total_rules': total_rules,
            'classifications': classifications,
            'custom_rules': len(self.custom_rules)
        }
    
    def list_classifications(self) -> List[str]:
        """
        Get list of all possible classifications
        
        Returns:
            List of classification names
        """
        classifications = set()
        for rule in self.classification_rules:
            classifications.add(rule['classification'])
        return sorted(list(classifications))
    
    def get_rules_for_classification(self, classification: str) -> List[Dict[str, Any]]:
        """
        Get all rules for a specific classification
        
        Args:
            classification: Classification name
            
        Returns:
            List of rules for the classification
        """
        return [rule for rule in self.classification_rules 
                if rule['classification'] == classification]
    
    def export_rules(self) -> str:
        """
        Export classification rules as JSON
        
        Returns:
            JSON string of classification rules
        """
        return json.dumps({
            'classification_rules': self.classification_rules,
            'custom_rules': self.custom_rules
        }, indent=2)
    
    def import_rules(self, rules_json: str) -> None:
        """
        Import classification rules from JSON
        
        Args:
            rules_json: JSON string containing rules
        """
        try:
            rules_data = json.loads(rules_json)
            
            if 'classification_rules' in rules_data:
                self.classification_rules = rules_data['classification_rules']
            
            if 'custom_rules' in rules_data:
                self.custom_rules = rules_data['custom_rules']
                
        except (json.JSONDecodeError, ValueError) as error:
            raise ValueError(f"Invalid rules JSON: {error}")
    
    def test_classification(self, test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Test classification with multiple test cases
        
        Args:
            test_cases: List of request data dictionaries
            
        Returns:
            List of test results with classifications
        """
        results = []
        
        for i, test_case in enumerate(test_cases):
            try:
                classification_result = self.classify_request(test_case)
                results.append({
                    'test_case': i + 1,
                    'input': test_case,
                    'classification': classification_result.classification,
                    'confidence': classification_result.confidence,
                    'reasoning': classification_result.reasoning,
                    'success': True
                })
            except Exception as error:
                results.append({
                    'test_case': i + 1,
                    'input': test_case,
                    'error': str(error),
                    'success': False
                })
        
        return results


# Utility functions for common use cases
def classify_bot_request(url: str, method: str = 'GET', user_agent: str = '', 
                        bot_name: str = '', bot_type: str = '') -> str:
    """
    Quick classification of a bot request
    
    Args:
        url: Request URL
        method: HTTP method
        user_agent: User agent string
        bot_name: Detected bot name
        bot_type: Detected bot type
        
    Returns:
        Classification string
    """
    classifier = RequestClassifier()
    request_data = {
        'url': url,
        'method': method,
        'user_agent': user_agent,
        'bot_name': bot_name,
        'bot_type': bot_type
    }
    
    result = classifier.classify_request(request_data)
    return result.classification


def get_classification_confidence(url: str, method: str = 'GET', user_agent: str = '', 
                                bot_name: str = '', bot_type: str = '') -> float:
    """
    Get classification confidence for a bot request
    
    Args:
        url: Request URL
        method: HTTP method
        user_agent: User agent string
        bot_name: Detected bot name
        bot_type: Detected bot type
        
    Returns:
        Confidence score (0.0 to 1.0)
    """
    classifier = RequestClassifier()
    request_data = {
        'url': url,
        'method': method,
        'user_agent': user_agent,
        'bot_name': bot_name,
        'bot_type': bot_type
    }
    
    result = classifier.classify_request(request_data)
    return result.confidence


if __name__ == '__main__':
    # Example usage and testing
    classifier = RequestClassifier()
    
    # Test cases
    test_cases = [
        {
            'url': '/article/ai-trends-2024',
            'method': 'GET',
            'user_agent': 'GPTBot/1.0 (+https://openai.com/gptbot)',
            'bot_name': 'gptbot',
            'bot_type': 'retrieval'
        },
        {
            'url': '/sitemap.xml',
            'method': 'GET',
            'user_agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'bot_name': 'googlebot',
            'bot_type': 'indexing'
        },
        {
            'url': '/api/v1/posts',
            'method': 'GET',
            'user_agent': 'Custom Bot 1.0',
            'headers': {'accept': 'application/json'}
        },
        {
            'url': '/health',
            'method': 'GET',
            'user_agent': 'Monitoring Bot'
        }
    ]
    
    print("🔍 Request Classifier - Python Implementation")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases, 1):
        result = classifier.classify_request(test_case)
        print(f"Test Case {i}:")
        print(f"  URL: {test_case['url']}")
        print(f"  Classification: {result.classification}")
        print(f"  Confidence: {result.confidence:.2f}")
        print(f"  Reasoning: {', '.join(result.reasoning[:2])}")
        print()
    
    # Print statistics
    stats = classifier.get_classification_stats()
    print("📊 Classifier Statistics:")
    print(f"   Total rules: {stats['total_rules']}")
    print(f"   Classifications: {list(stats['classifications'].keys())}")
    print(f"   Custom rules: {stats['custom_rules']}")
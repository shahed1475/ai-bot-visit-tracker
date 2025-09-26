#!/usr/bin/env python3
"""
AI Bot Detector - Python Implementation

This module provides bot detection capabilities for Python frameworks
(Flask, Django, FastAPI, etc.) with consistent logic across all implementations.

Author: AI Bot Visit Tracker
Version: 1.0.0
"""

import re
import json
import ipaddress
from typing import Dict, List, Optional, Union, Any
from dataclasses import dataclass
from datetime import datetime


@dataclass
class BotInfo:
    """Data class for bot information"""
    name: str
    type: str  # 'indexing', 'retrieval', 'monitoring'
    confidence: float
    patterns_matched: List[str]
    additional_info: Dict[str, Any] = None


class BotDetector:
    """
    AI Bot Detector for Python applications
    
    Detects various AI bots and crawlers based on user agents, IP addresses,
    and other request characteristics.
    """
    
    def __init__(self, custom_bots: Optional[List[Dict]] = None):
        """
        Initialize the bot detector
        
        Args:
            custom_bots: List of custom bot definitions
        """
        self.bot_patterns = self._initialize_bot_patterns()
        self.ip_ranges = self._initialize_ip_ranges()
        self.custom_bots = custom_bots or []
        
        # Add custom bots to patterns
        for bot in self.custom_bots:
            self.add_custom_bot(bot)
    
    def _initialize_bot_patterns(self) -> Dict[str, Dict]:
        """Initialize known bot patterns"""
        return {
            # AI/LLM Bots
            'gptbot': {
                'patterns': [
                    r'gptbot',
                    r'chatgpt-user',
                    r'openai',
                    r'gpt-3',
                    r'gpt-4'
                ],
                'type': 'retrieval',
                'confidence': 0.95,
                'description': 'OpenAI GPT Bot'
            },
            'claudebot': {
                'patterns': [
                    r'claudebot',
                    r'claude-web',
                    r'anthropic'
                ],
                'type': 'retrieval',
                'confidence': 0.95,
                'description': 'Anthropic Claude Bot'
            },
            'perplexitybot': {
                'patterns': [
                    r'perplexitybot',
                    r'perplexity'
                ],
                'type': 'retrieval',
                'confidence': 0.95,
                'description': 'Perplexity AI Bot'
            },
            'bardbot': {
                'patterns': [
                    r'bardbot',
                    r'bard',
                    r'google-bard'
                ],
                'type': 'retrieval',
                'confidence': 0.95,
                'description': 'Google Bard Bot'
            },
            
            # Search Engine Bots
            'googlebot': {
                'patterns': [
                    r'googlebot',
                    r'google',
                    r'adsbot-google'
                ],
                'type': 'indexing',
                'confidence': 0.9,
                'description': 'Google Search Bot'
            },
            'bingbot': {
                'patterns': [
                    r'bingbot',
                    r'msnbot',
                    r'bing'
                ],
                'type': 'indexing',
                'confidence': 0.9,
                'description': 'Microsoft Bing Bot'
            },
            'yahoobot': {
                'patterns': [
                    r'slurp',
                    r'yahoo'
                ],
                'type': 'indexing',
                'confidence': 0.9,
                'description': 'Yahoo Search Bot'
            },
            'duckduckbot': {
                'patterns': [
                    r'duckduckbot',
                    r'duckduckgo'
                ],
                'type': 'indexing',
                'confidence': 0.9,
                'description': 'DuckDuckGo Bot'
            },
            'baidubot': {
                'patterns': [
                    r'baiduspider',
                    r'baidu'
                ],
                'type': 'indexing',
                'confidence': 0.9,
                'description': 'Baidu Search Bot'
            },
            'yandexbot': {
                'patterns': [
                    r'yandexbot',
                    r'yandex'
                ],
                'type': 'indexing',
                'confidence': 0.9,
                'description': 'Yandex Search Bot'
            },
            
            # Social Media Bots
            'facebookbot': {
                'patterns': [
                    r'facebookexternalhit',
                    r'facebook'
                ],
                'type': 'indexing',
                'confidence': 0.85,
                'description': 'Facebook Bot'
            },
            'twitterbot': {
                'patterns': [
                    r'twitterbot',
                    r'twitter'
                ],
                'type': 'indexing',
                'confidence': 0.85,
                'description': 'Twitter Bot'
            },
            'linkedinbot': {
                'patterns': [
                    r'linkedinbot',
                    r'linkedin'
                ],
                'type': 'indexing',
                'confidence': 0.85,
                'description': 'LinkedIn Bot'
            },
            'discordbot': {
                'patterns': [
                    r'discordbot',
                    r'discord'
                ],
                'type': 'indexing',
                'confidence': 0.85,
                'description': 'Discord Bot'
            },
            'slackbot': {
                'patterns': [
                    r'slackbot',
                    r'slack'
                ],
                'type': 'indexing',
                'confidence': 0.85,
                'description': 'Slack Bot'
            },
            
            # SEO and Analytics Bots
            'ahrefsbot': {
                'patterns': [
                    r'ahrefsbot',
                    r'ahrefs'
                ],
                'type': 'indexing',
                'confidence': 0.8,
                'description': 'Ahrefs SEO Bot'
            },
            'semrushbot': {
                'patterns': [
                    r'semrushbot',
                    r'semrush'
                ],
                'type': 'indexing',
                'confidence': 0.8,
                'description': 'SEMrush Bot'
            },
            'mozbot': {
                'patterns': [
                    r'rogerbot',
                    r'moz'
                ],
                'type': 'indexing',
                'confidence': 0.8,
                'description': 'Moz SEO Bot'
            },
            
            # Other Common Bots
            'applebot': {
                'patterns': [
                    r'applebot',
                    r'apple'
                ],
                'type': 'indexing',
                'confidence': 0.85,
                'description': 'Apple Bot'
            },
            'amazonbot': {
                'patterns': [
                    r'amazonbot',
                    r'amazon'
                ],
                'type': 'indexing',
                'confidence': 0.85,
                'description': 'Amazon Bot'
            }
        }
    
    def _initialize_ip_ranges(self) -> Dict[str, List[str]]:
        """Initialize known IP ranges for major bots"""
        return {
            'googlebot': [
                '66.249.64.0/19',
                '64.233.160.0/19',
                '72.14.192.0/18',
                '209.85.128.0/17',
                '216.239.32.0/19'
            ],
            'bingbot': [
                '40.77.167.0/24',
                '157.55.39.0/24',
                '207.46.13.0/24'
            ],
            'facebookbot': [
                '31.13.24.0/21',
                '31.13.64.0/18',
                '66.220.144.0/20',
                '69.63.176.0/20',
                '69.171.224.0/19',
                '74.119.76.0/22',
                '103.4.96.0/22',
                '173.252.64.0/18',
                '204.15.20.0/22'
            ]
        }
    
    def detect_bot(self, user_agent: str, ip_address: Optional[str] = None, 
                   headers: Optional[Dict[str, str]] = None) -> Optional[BotInfo]:
        """
        Detect if the request is from a bot
        
        Args:
            user_agent: User agent string
            ip_address: IP address of the request
            headers: Additional request headers
            
        Returns:
            BotInfo object if bot detected, None otherwise
        """
        if not user_agent:
            return None
        
        user_agent_lower = user_agent.lower()
        
        # Check against known bot patterns
        for bot_name, bot_config in self.bot_patterns.items():
            patterns_matched = []
            
            for pattern in bot_config['patterns']:
                if re.search(pattern, user_agent_lower, re.IGNORECASE):
                    patterns_matched.append(pattern)
            
            if patterns_matched:
                # Additional validation for IP ranges if available
                confidence = bot_config['confidence']
                if ip_address and bot_name in self.ip_ranges:
                    if self._validate_ip_range(ip_address, self.ip_ranges[bot_name]):
                        confidence = min(confidence + 0.05, 1.0)
                    else:
                        confidence = max(confidence - 0.1, 0.5)
                
                return BotInfo(
                    name=bot_name,
                    type=bot_config['type'],
                    confidence=confidence,
                    patterns_matched=patterns_matched,
                    additional_info={
                        'description': bot_config.get('description', ''),
                        'user_agent': user_agent,
                        'ip_address': ip_address,
                        'validated_ip': ip_address and bot_name in self.ip_ranges and 
                                     self._validate_ip_range(ip_address, self.ip_ranges[bot_name])
                    }
                )
        
        # Check for generic bot indicators
        generic_bot_patterns = [
            r'bot',
            r'crawler',
            r'spider',
            r'scraper',
            r'fetcher'
        ]
        
        for pattern in generic_bot_patterns:
            if re.search(pattern, user_agent_lower, re.IGNORECASE):
                return BotInfo(
                    name='generic_bot',
                    type='unknown',
                    confidence=0.6,
                    patterns_matched=[pattern],
                    additional_info={
                        'description': 'Generic bot detected',
                        'user_agent': user_agent,
                        'ip_address': ip_address
                    }
                )
        
        return None
    
    def _validate_ip_range(self, ip_address: str, ip_ranges: List[str]) -> bool:
        """
        Validate if IP address belongs to known ranges
        
        Args:
            ip_address: IP address to validate
            ip_ranges: List of IP ranges in CIDR notation
            
        Returns:
            True if IP is in any of the ranges
        """
        try:
            ip = ipaddress.ip_address(ip_address)
            for ip_range in ip_ranges:
                network = ipaddress.ip_network(ip_range, strict=False)
                if ip in network:
                    return True
        except (ipaddress.AddressValueError, ValueError):
            pass
        
        return False
    
    def add_custom_bot(self, bot_config: Dict[str, Any]) -> None:
        """
        Add a custom bot configuration
        
        Args:
            bot_config: Dictionary containing bot configuration
                       Required keys: name, patterns
                       Optional keys: type, confidence, description
        """
        if 'name' not in bot_config or 'patterns' not in bot_config:
            raise ValueError("Bot configuration must include 'name' and 'patterns'")
        
        bot_name = bot_config['name'].lower()
        patterns = bot_config['patterns']
        if isinstance(patterns, str):
            patterns = [patterns]
        
        self.bot_patterns[bot_name] = {
            'patterns': patterns,
            'type': bot_config.get('type', 'unknown'),
            'confidence': bot_config.get('confidence', 0.7),
            'description': bot_config.get('description', f'Custom bot: {bot_name}')
        }
    
    def get_bot_info(self, bot_name: str) -> Optional[Dict[str, Any]]:
        """
        Get information about a specific bot
        
        Args:
            bot_name: Name of the bot
            
        Returns:
            Bot configuration dictionary or None
        """
        return self.bot_patterns.get(bot_name.lower())
    
    def list_known_bots(self) -> List[str]:
        """
        Get list of all known bot names
        
        Returns:
            List of bot names
        """
        return list(self.bot_patterns.keys())
    
    def get_bot_stats(self) -> Dict[str, Any]:
        """
        Get statistics about known bots
        
        Returns:
            Dictionary with bot statistics
        """
        total_bots = len(self.bot_patterns)
        bot_types = {}
        
        for bot_config in self.bot_patterns.values():
            bot_type = bot_config['type']
            bot_types[bot_type] = bot_types.get(bot_type, 0) + 1
        
        return {
            'total_bots': total_bots,
            'bot_types': bot_types,
            'custom_bots': len(self.custom_bots),
            'ip_ranges_configured': len(self.ip_ranges)
        }
    
    def export_config(self) -> str:
        """
        Export bot configuration as JSON
        
        Returns:
            JSON string of bot configuration
        """
        config = {
            'bot_patterns': self.bot_patterns,
            'ip_ranges': self.ip_ranges,
            'custom_bots': self.custom_bots
        }
        return json.dumps(config, indent=2)
    
    def import_config(self, config_json: str) -> None:
        """
        Import bot configuration from JSON
        
        Args:
            config_json: JSON string containing bot configuration
        """
        try:
            config = json.loads(config_json)
            
            if 'bot_patterns' in config:
                self.bot_patterns.update(config['bot_patterns'])
            
            if 'ip_ranges' in config:
                self.ip_ranges.update(config['ip_ranges'])
            
            if 'custom_bots' in config:
                for bot in config['custom_bots']:
                    self.add_custom_bot(bot)
                    
        except (json.JSONDecodeError, ValueError) as error:
            raise ValueError(f"Invalid configuration JSON: {error}")


# Utility functions for common use cases
def is_bot(user_agent: str, ip_address: Optional[str] = None) -> bool:
    """
    Quick check if user agent indicates a bot
    
    Args:
        user_agent: User agent string
        ip_address: Optional IP address
        
    Returns:
        True if bot detected
    """
    detector = BotDetector()
    bot_info = detector.detect_bot(user_agent, ip_address)
    return bot_info is not None


def get_bot_name(user_agent: str, ip_address: Optional[str] = None) -> Optional[str]:
    """
    Get the name of the detected bot
    
    Args:
        user_agent: User agent string
        ip_address: Optional IP address
        
    Returns:
        Bot name if detected, None otherwise
    """
    detector = BotDetector()
    bot_info = detector.detect_bot(user_agent, ip_address)
    return bot_info.name if bot_info else None


def get_bot_type(user_agent: str, ip_address: Optional[str] = None) -> Optional[str]:
    """
    Get the type of the detected bot
    
    Args:
        user_agent: User agent string
        ip_address: Optional IP address
        
    Returns:
        Bot type if detected, None otherwise
    """
    detector = BotDetector()
    bot_info = detector.detect_bot(user_agent, ip_address)
    return bot_info.type if bot_info else None


if __name__ == '__main__':
    # Example usage and testing
    detector = BotDetector()
    
    # Test cases
    test_cases = [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'GPTBot/1.0 (+https://openai.com/gptbot)',
        'ClaudeBot/1.0 (+https://www.anthropic.com/claudebot)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    ]
    
    print("🤖 AI Bot Detector - Python Implementation")
    print("=" * 50)
    
    for user_agent in test_cases:
        bot_info = detector.detect_bot(user_agent)
        if bot_info:
            print(f"✅ Bot detected: {bot_info.name} ({bot_info.type}) - {bot_info.confidence:.2f}")
            print(f"   User Agent: {user_agent[:60]}...")
        else:
            print(f"❌ No bot detected")
            print(f"   User Agent: {user_agent[:60]}...")
        print()
    
    # Print statistics
    stats = detector.get_bot_stats()
    print("📊 Bot Detector Statistics:")
    print(f"   Total bots: {stats['total_bots']}")
    print(f"   Bot types: {stats['bot_types']}")
    print(f"   Custom bots: {stats['custom_bots']}")
    print(f"   IP ranges configured: {stats['ip_ranges_configured']}")
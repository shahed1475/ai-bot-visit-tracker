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

try:
    from core import signatures
except ImportError:  # imported without the project root on sys.path
    import signatures


@dataclass
class BotInfo:
    """Data class for bot information"""
    name: str
    type: str  # 'indexing', 'retrieval', 'monitoring'
    confidence: float
    patterns_matched: List[str]
    additional_info: Dict[str, Any] = None
    bot_id: Optional[str] = None
    kind: Optional[str] = None  # 'ai' | 'search' | 'social' | 'other'
    purpose: Optional[str] = None  # 'training' | 'indexing' | 'retrieval' | 'unknown'
    verified: str = 'unknown'  # 'verified' | 'unverified' | 'unknown'

    # The Flask/Django middleware read results like a dict (bot_info['name']).
    def __getitem__(self, key: str) -> Any:
        if key in self.__dataclass_fields__:
            return getattr(self, key)
        raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        return getattr(self, key, default) if key in self.__dataclass_fields__ else default


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
        """Built-in bots come from the shared registry; this dict only holds custom bots."""
        return {}

    def _initialize_ip_ranges(self) -> Dict[str, List[str]]:
        """bot id -> CIDR list. Fill from the vendor-published lists (see the Cloudflare cron) if you want IP verification."""
        return {}

    def detect_bot(self, user_agent: str, ip_address: Optional[str] = None,
                   headers: Optional[Dict[str, str]] = None) -> Optional[BotInfo]:
        """Return a BotInfo for bot traffic, None for humans/empty user agents."""
        if not user_agent or not isinstance(user_agent, str):
            return None
        ua = user_agent[:signatures.MAX_UA]

        for bot_name, cfg in self.bot_patterns.items():  # custom bots first
            hits = [p for p in cfg['patterns'] if re.search(p, ua, re.IGNORECASE)]
            if hits:
                return BotInfo(name=bot_name, type=cfg['type'], confidence=cfg['confidence'], patterns_matched=hits,
                               bot_id=bot_name, kind='ai', purpose=cfg['type'] if cfg['type'] in ('training', 'indexing', 'retrieval') else 'unknown',
                               additional_info={'description': cfg.get('description', ''), 'user_agent': user_agent, 'ip_address': ip_address})

        bot = signatures.match(ua)
        if not bot:
            return None
        verified = signatures.verify(bot, ip_address, self.ip_ranges)
        return BotInfo(
            name=bot['name'], type=bot['purpose'], confidence=0.5 if bot['id'] == 'generic-bot' else 0.95,
            patterns_matched=[bot['ua']] if bot['ua'] else [], bot_id=bot['id'], kind=bot['kind'], purpose=bot['purpose'], verified=verified,
            additional_info={'operator': bot['operator'], 'user_agent': user_agent, 'ip_address': ip_address, 'validated_ip': verified == 'verified'})

    def _validate_ip_range(self, ip_address: str, ip_ranges: List[str]) -> bool:
        return signatures.in_ranges(ip_address, ip_ranges)

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
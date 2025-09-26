#!/usr/bin/env python3
"""
Database Handler - Python Implementation

This module provides database operations for Python frameworks
(Flask, Django, FastAPI, etc.) with consistent schema across all implementations.

Author: AI Bot Visit Tracker
Version: 1.0.0
"""

import sqlite3
import json
import os
import time
from typing import Dict, List, Optional, Union, Any, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from contextlib import contextmanager


@dataclass
class VisitRecord:
    """Data class for visit records"""
    timestamp: str
    ip_address: str
    bot_name: str
    page_url: str
    headers: str
    classification: str
    user_agent: str
    referer: str = ''
    request_method: str = 'GET'
    response_status: int = 200
    processing_time_ms: int = 0
    id: Optional[int] = None


@dataclass
class BotStats:
    """Data class for bot statistics"""
    bot_name: str
    total_visits: int
    last_visit: str
    first_visit: str
    unique_pages: int
    avg_processing_time: float
    classification_breakdown: str
    id: Optional[int] = None


class DatabaseHandler:
    """
    Database Handler for AI Bot Visit Tracking
    
    Provides consistent database operations across all Python frameworks
    with support for SQLite (default) and PostgreSQL.
    """
    
    def __init__(self, database_config: Optional[Dict[str, Any]] = None):
        """
        Initialize the database handler
        
        Args:
            database_config: Database configuration dictionary
                           For SQLite: {'type': 'sqlite', 'path': 'path/to/db.sqlite'}
                           For PostgreSQL: {'type': 'postgresql', 'host': 'localhost', 
                                          'port': 5432, 'database': 'bottracker', 
                                          'username': 'user', 'password': 'pass'}
        """
        self.config = database_config or {
            'type': 'sqlite',
            'path': 'data/bot_visits.sqlite'
        }
        
        self.db_type = self.config.get('type', 'sqlite').lower()
        self.connection = None
        
        # Initialize database
        self._initialize_database()
    
    def _initialize_database(self) -> None:
        """Initialize database connection and create tables if needed"""
        try:
            if self.db_type == 'sqlite':
                self._initialize_sqlite()
            elif self.db_type == 'postgresql':
                self._initialize_postgresql()
            else:
                raise ValueError(f"Unsupported database type: {self.db_type}")
            
            self._create_tables()
            self._create_indexes()
            self._create_triggers()
            
        except Exception as error:
            print(f"Database initialization error: {error}")
            # Fallback to in-memory SQLite
            self._initialize_fallback()
    
    def _initialize_sqlite(self) -> None:
        """Initialize SQLite connection"""
        db_path = self.config.get('path', 'data/bot_visits.sqlite')
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        self.connection = sqlite3.connect(db_path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        
        # Enable WAL mode for better concurrency
        self.connection.execute('PRAGMA journal_mode=WAL')
        self.connection.execute('PRAGMA synchronous=NORMAL')
        self.connection.execute('PRAGMA cache_size=10000')
        self.connection.execute('PRAGMA temp_store=MEMORY')
    
    def _initialize_postgresql(self) -> None:
        """Initialize PostgreSQL connection"""
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            
            conn_params = {
                'host': self.config.get('host', 'localhost'),
                'port': self.config.get('port', 5432),
                'database': self.config.get('database', 'bottracker'),
                'user': self.config.get('username', 'postgres'),
                'password': self.config.get('password', '')
            }
            
            self.connection = psycopg2.connect(**conn_params)
            self.connection.cursor_factory = RealDictCursor
            
        except ImportError:
            raise ImportError("psycopg2 is required for PostgreSQL support. Install with: pip install psycopg2-binary")
    
    def _initialize_fallback(self) -> None:
        """Initialize fallback in-memory SQLite database"""
        print("Falling back to in-memory SQLite database")
        self.connection = sqlite3.connect(':memory:', check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.db_type = 'sqlite'
    
    def _create_tables(self) -> None:
        """Create database tables"""
        if self.db_type == 'sqlite':
            self._create_sqlite_tables()
        elif self.db_type == 'postgresql':
            self._create_postgresql_tables()
    
    def _create_sqlite_tables(self) -> None:
        """Create SQLite tables"""
        cursor = self.connection.cursor()
        
        # Visits table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS visits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                bot_name TEXT NOT NULL,
                page_url TEXT NOT NULL,
                headers TEXT,
                classification TEXT NOT NULL,
                user_agent TEXT,
                referer TEXT DEFAULT '',
                request_method TEXT DEFAULT 'GET',
                response_status INTEGER DEFAULT 200,
                processing_time_ms INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Bot stats table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bot_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                bot_name TEXT UNIQUE NOT NULL,
                total_visits INTEGER DEFAULT 0,
                last_visit TEXT,
                first_visit TEXT,
                unique_pages INTEGER DEFAULT 0,
                avg_processing_time REAL DEFAULT 0.0,
                classification_breakdown TEXT DEFAULT '{}',
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Config table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Insert default config values
        default_configs = [
            ('database_version', '1.0.0', 'Database schema version'),
            ('enable_classification', 'true', 'Enable request classification'),
            ('log_ip_addresses', 'true', 'Log IP addresses in visits'),
            ('log_headers', 'true', 'Log request headers'),
            ('data_retention_days', '90', 'Number of days to retain visit data'),
            ('enable_bot_stats', 'true', 'Enable bot statistics tracking')
        ]
        
        for key, value, description in default_configs:
            cursor.execute('''
                INSERT OR IGNORE INTO config (key, value, description) 
                VALUES (?, ?, ?)
            ''', (key, value, description))
        
        self.connection.commit()
    
    def _create_postgresql_tables(self) -> None:
        """Create PostgreSQL tables"""
        cursor = self.connection.cursor()
        
        # Visits table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS visits (
                id SERIAL PRIMARY KEY,
                timestamp TIMESTAMP NOT NULL,
                ip_address INET NOT NULL,
                bot_name VARCHAR(100) NOT NULL,
                page_url TEXT NOT NULL,
                headers JSONB,
                classification VARCHAR(50) NOT NULL,
                user_agent TEXT,
                referer TEXT DEFAULT '',
                request_method VARCHAR(10) DEFAULT 'GET',
                response_status INTEGER DEFAULT 200,
                processing_time_ms INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Bot stats table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS bot_stats (
                id SERIAL PRIMARY KEY,
                bot_name VARCHAR(100) UNIQUE NOT NULL,
                total_visits INTEGER DEFAULT 0,
                last_visit TIMESTAMP,
                first_visit TIMESTAMP,
                unique_pages INTEGER DEFAULT 0,
                avg_processing_time REAL DEFAULT 0.0,
                classification_breakdown JSONB DEFAULT '{}',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Config table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS config (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL,
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        self.connection.commit()
    
    def _create_indexes(self) -> None:
        """Create database indexes for performance"""
        cursor = self.connection.cursor()
        
        indexes = [
            'CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_visits_bot_name ON visits(bot_name)',
            'CREATE INDEX IF NOT EXISTS idx_visits_classification ON visits(classification)',
            'CREATE INDEX IF NOT EXISTS idx_visits_ip_address ON visits(ip_address)',
            'CREATE INDEX IF NOT EXISTS idx_bot_stats_bot_name ON bot_stats(bot_name)',
            'CREATE INDEX IF NOT EXISTS idx_bot_stats_last_visit ON bot_stats(last_visit)'
        ]
        
        for index_sql in indexes:
            try:
                cursor.execute(index_sql)
            except Exception as error:
                print(f"Index creation warning: {error}")
        
        self.connection.commit()
    
    def _create_triggers(self) -> None:
        """Create database triggers for automatic stats updates"""
        if self.db_type == 'sqlite':
            cursor = self.connection.cursor()
            
            # Trigger to update bot stats on new visit
            cursor.execute('''
                CREATE TRIGGER IF NOT EXISTS update_bot_stats_on_insert
                AFTER INSERT ON visits
                BEGIN
                    INSERT OR REPLACE INTO bot_stats (
                        bot_name, 
                        total_visits, 
                        last_visit, 
                        first_visit,
                        unique_pages,
                        avg_processing_time,
                        classification_breakdown,
                        updated_at
                    )
                    SELECT 
                        NEW.bot_name,
                        COUNT(*) as total_visits,
                        MAX(timestamp) as last_visit,
                        MIN(timestamp) as first_visit,
                        COUNT(DISTINCT page_url) as unique_pages,
                        AVG(processing_time_ms) as avg_processing_time,
                        '{}' as classification_breakdown,
                        CURRENT_TIMESTAMP as updated_at
                    FROM visits 
                    WHERE bot_name = NEW.bot_name;
                END
            ''')
            
            self.connection.commit()
    
    @contextmanager
    def get_cursor(self):
        """Context manager for database cursor"""
        cursor = self.connection.cursor()
        try:
            yield cursor
            self.connection.commit()
        except Exception as error:
            self.connection.rollback()
            raise error
        finally:
            cursor.close()
    
    def log_visit(self, visit_data: Dict[str, Any]) -> bool:
        """
        Log a bot visit to the database
        
        Args:
            visit_data: Dictionary containing visit information
                       Required keys: timestamp, ip_address, bot_name, page_url, 
                                    classification, user_agent
                       Optional keys: headers, referer, request_method, 
                                    response_status, processing_time_ms
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Prepare visit record
            visit_record = VisitRecord(
                timestamp=visit_data.get('timestamp', datetime.now().isoformat()),
                ip_address=visit_data.get('ip_address', ''),
                bot_name=visit_data.get('bot_name', ''),
                page_url=visit_data.get('page_url', ''),
                headers=json.dumps(visit_data.get('headers', {})) if isinstance(visit_data.get('headers'), dict) else str(visit_data.get('headers', '')),
                classification=visit_data.get('classification', 'unknown'),
                user_agent=visit_data.get('user_agent', ''),
                referer=visit_data.get('referer', ''),
                request_method=visit_data.get('request_method', 'GET'),
                response_status=visit_data.get('response_status', 200),
                processing_time_ms=visit_data.get('processing_time_ms', 0)
            )
            
            with self.get_cursor() as cursor:
                if self.db_type == 'sqlite':
                    cursor.execute('''
                        INSERT INTO visits (
                            timestamp, ip_address, bot_name, page_url, headers,
                            classification, user_agent, referer, request_method,
                            response_status, processing_time_ms
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        visit_record.timestamp, visit_record.ip_address, visit_record.bot_name,
                        visit_record.page_url, visit_record.headers, visit_record.classification,
                        visit_record.user_agent, visit_record.referer, visit_record.request_method,
                        visit_record.response_status, visit_record.processing_time_ms
                    ))
                
                elif self.db_type == 'postgresql':
                    cursor.execute('''
                        INSERT INTO visits (
                            timestamp, ip_address, bot_name, page_url, headers,
                            classification, user_agent, referer, request_method,
                            response_status, processing_time_ms
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        visit_record.timestamp, visit_record.ip_address, visit_record.bot_name,
                        visit_record.page_url, json.loads(visit_record.headers) if visit_record.headers else {},
                        visit_record.classification, visit_record.user_agent, visit_record.referer,
                        visit_record.request_method, visit_record.response_status, visit_record.processing_time_ms
                    ))
            
            # Update bot stats manually if triggers aren't working
            self._update_bot_stats(visit_record.bot_name)
            
            return True
            
        except Exception as error:
            print(f"Error logging visit: {error}")
            return False
    
    def _update_bot_stats(self, bot_name: str) -> None:
        """Update bot statistics for a specific bot"""
        try:
            with self.get_cursor() as cursor:
                # Get aggregated stats for the bot
                cursor.execute('''
                    SELECT 
                        COUNT(*) as total_visits,
                        MAX(timestamp) as last_visit,
                        MIN(timestamp) as first_visit,
                        COUNT(DISTINCT page_url) as unique_pages,
                        AVG(processing_time_ms) as avg_processing_time
                    FROM visits 
                    WHERE bot_name = ?
                ''', (bot_name,))
                
                stats = cursor.fetchone()
                
                if stats and stats['total_visits'] > 0:
                    # Get classification breakdown
                    cursor.execute('''
                        SELECT classification, COUNT(*) as count
                        FROM visits 
                        WHERE bot_name = ?
                        GROUP BY classification
                    ''', (bot_name,))
                    
                    classifications = dict(cursor.fetchall())
                    
                    # Update or insert bot stats
                    if self.db_type == 'sqlite':
                        cursor.execute('''
                            INSERT OR REPLACE INTO bot_stats (
                                bot_name, total_visits, last_visit, first_visit,
                                unique_pages, avg_processing_time, classification_breakdown,
                                updated_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            bot_name, stats['total_visits'], stats['last_visit'],
                            stats['first_visit'], stats['unique_pages'],
                            stats['avg_processing_time'], json.dumps(classifications),
                            datetime.now().isoformat()
                        ))
                    
                    elif self.db_type == 'postgresql':
                        cursor.execute('''
                            INSERT INTO bot_stats (
                                bot_name, total_visits, last_visit, first_visit,
                                unique_pages, avg_processing_time, classification_breakdown,
                                updated_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (bot_name) DO UPDATE SET
                                total_visits = EXCLUDED.total_visits,
                                last_visit = EXCLUDED.last_visit,
                                first_visit = EXCLUDED.first_visit,
                                unique_pages = EXCLUDED.unique_pages,
                                avg_processing_time = EXCLUDED.avg_processing_time,
                                classification_breakdown = EXCLUDED.classification_breakdown,
                                updated_at = EXCLUDED.updated_at
                        ''', (
                            bot_name, stats['total_visits'], stats['last_visit'],
                            stats['first_visit'], stats['unique_pages'],
                            stats['avg_processing_time'], classifications,
                            datetime.now().isoformat()
                        ))
        
        except Exception as error:
            print(f"Error updating bot stats: {error}")
    
    def get_recent_visits(self, limit: int = 50, bot_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get recent bot visits
        
        Args:
            limit: Maximum number of visits to return
            bot_name: Filter by specific bot name
            
        Returns:
            List of visit dictionaries
        """
        try:
            with self.get_cursor() as cursor:
                if bot_name:
                    cursor.execute('''
                        SELECT * FROM visits 
                        WHERE bot_name = ?
                        ORDER BY timestamp DESC 
                        LIMIT ?
                    ''', (bot_name, limit))
                else:
                    cursor.execute('''
                        SELECT * FROM visits 
                        ORDER BY timestamp DESC 
                        LIMIT ?
                    ''', (limit,))
                
                visits = []
                for row in cursor.fetchall():
                    visit = dict(row)
                    # Parse headers if it's a JSON string
                    if visit.get('headers'):
                        try:
                            visit['headers'] = json.loads(visit['headers'])
                        except (json.JSONDecodeError, TypeError):
                            pass
                    visits.append(visit)
                
                return visits
                
        except Exception as error:
            print(f"Error getting recent visits: {error}")
            return []
    
    def get_bot_stats(self, bot_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get bot statistics
        
        Args:
            bot_name: Filter by specific bot name
            
        Returns:
            List of bot statistics dictionaries
        """
        try:
            with self.get_cursor() as cursor:
                if bot_name:
                    cursor.execute('''
                        SELECT * FROM bot_stats 
                        WHERE bot_name = ?
                        ORDER BY total_visits DESC
                    ''', (bot_name,))
                else:
                    cursor.execute('''
                        SELECT * FROM bot_stats 
                        ORDER BY total_visits DESC
                    ''')
                
                stats = []
                for row in cursor.fetchall():
                    stat = dict(row)
                    # Parse classification breakdown if it's a JSON string
                    if stat.get('classification_breakdown'):
                        try:
                            stat['classification_breakdown'] = json.loads(stat['classification_breakdown'])
                        except (json.JSONDecodeError, TypeError):
                            stat['classification_breakdown'] = {}
                    stats.append(stat)
                
                return stats
                
        except Exception as error:
            print(f"Error getting bot stats: {error}")
            return []
    
    def get_visit_count(self, bot_name: Optional[str] = None, 
                       classification: Optional[str] = None,
                       since: Optional[str] = None) -> int:
        """
        Get total visit count with optional filters
        
        Args:
            bot_name: Filter by bot name
            classification: Filter by classification
            since: Filter by timestamp (ISO format)
            
        Returns:
            Total visit count
        """
        try:
            with self.get_cursor() as cursor:
                conditions = []
                params = []
                
                if bot_name:
                    conditions.append('bot_name = ?')
                    params.append(bot_name)
                
                if classification:
                    conditions.append('classification = ?')
                    params.append(classification)
                
                if since:
                    conditions.append('timestamp >= ?')
                    params.append(since)
                
                where_clause = ' WHERE ' + ' AND '.join(conditions) if conditions else ''
                
                cursor.execute(f'SELECT COUNT(*) as count FROM visits{where_clause}', params)
                result = cursor.fetchone()
                
                return result['count'] if result else 0
                
        except Exception as error:
            print(f"Error getting visit count: {error}")
            return 0
    
    def cleanup_old_visits(self, days: int = 90) -> int:
        """
        Clean up old visit records
        
        Args:
            days: Number of days to retain
            
        Returns:
            Number of records deleted
        """
        try:
            cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
            
            with self.get_cursor() as cursor:
                cursor.execute('DELETE FROM visits WHERE timestamp < ?', (cutoff_date,))
                deleted_count = cursor.rowcount
                
                # Update bot stats after cleanup
                cursor.execute('SELECT DISTINCT bot_name FROM visits')
                bot_names = [row['bot_name'] for row in cursor.fetchall()]
                
                for bot_name in bot_names:
                    self._update_bot_stats(bot_name)
                
                return deleted_count
                
        except Exception as error:
            print(f"Error cleaning up old visits: {error}")
            return 0
    
    def get_config(self, key: str, default: Any = None) -> Any:
        """
        Get configuration value
        
        Args:
            key: Configuration key
            default: Default value if key not found
            
        Returns:
            Configuration value
        """
        try:
            with self.get_cursor() as cursor:
                cursor.execute('SELECT value FROM config WHERE key = ?', (key,))
                result = cursor.fetchone()
                
                if result:
                    value = result['value']
                    # Try to parse as JSON for complex values
                    try:
                        return json.loads(value)
                    except (json.JSONDecodeError, TypeError):
                        return value
                
                return default
                
        except Exception as error:
            print(f"Error getting config: {error}")
            return default
    
    def set_config(self, key: str, value: Any, description: str = '') -> bool:
        """
        Set configuration value
        
        Args:
            key: Configuration key
            value: Configuration value
            description: Optional description
            
        Returns:
            True if successful
        """
        try:
            # Convert complex values to JSON
            if isinstance(value, (dict, list)):
                value_str = json.dumps(value)
            else:
                value_str = str(value)
            
            with self.get_cursor() as cursor:
                cursor.execute('''
                    INSERT OR REPLACE INTO config (key, value, description, updated_at)
                    VALUES (?, ?, ?, ?)
                ''', (key, value_str, description, datetime.now().isoformat()))
            
            return True
            
        except Exception as error:
            print(f"Error setting config: {error}")
            return False
    
    def close(self) -> None:
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.close()


# Utility functions for common use cases
def create_database_handler(config: Optional[Dict[str, Any]] = None) -> DatabaseHandler:
    """
    Create a database handler instance
    
    Args:
        config: Database configuration
        
    Returns:
        DatabaseHandler instance
    """
    return DatabaseHandler(config)


def log_bot_visit(visit_data: Dict[str, Any], db_config: Optional[Dict[str, Any]] = None) -> bool:
    """
    Quick function to log a bot visit
    
    Args:
        visit_data: Visit data dictionary
        db_config: Database configuration
        
    Returns:
        True if successful
    """
    with DatabaseHandler(db_config) as db:
        return db.log_visit(visit_data)


if __name__ == '__main__':
    # Example usage and testing
    print("🗄️ Database Handler - Python Implementation")
    print("=" * 50)
    
    # Test database operations
    with DatabaseHandler() as db:
        # Test logging a visit
        visit_data = {
            'timestamp': datetime.now().isoformat(),
            'ip_address': '192.168.1.100',
            'bot_name': 'gptbot',
            'page_url': '/test-article',
            'headers': {'User-Agent': 'GPTBot/1.0', 'Accept': 'text/html'},
            'classification': 'retrieval',
            'user_agent': 'GPTBot/1.0 (+https://openai.com/gptbot)',
            'request_method': 'GET',
            'response_status': 200,
            'processing_time_ms': 150
        }
        
        success = db.log_visit(visit_data)
        print(f"✅ Visit logged: {success}")
        
        # Test getting recent visits
        recent_visits = db.get_recent_visits(limit=5)
        print(f"📋 Recent visits: {len(recent_visits)}")
        
        # Test getting bot stats
        bot_stats = db.get_bot_stats()
        print(f"📊 Bot stats: {len(bot_stats)}")
        
        # Test visit count
        total_visits = db.get_visit_count()
        print(f"🔢 Total visits: {total_visits}")
        
        # Test configuration
        db.set_config('test_setting', 'test_value', 'Test configuration')
        config_value = db.get_config('test_setting')
        print(f"⚙️ Config test: {config_value}")
    
    print("\n✅ Database handler test completed successfully!")
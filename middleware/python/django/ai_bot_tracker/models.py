"""
Django models for AI Bot Visit Tracking
"""

from django.db import models
from django.utils import timezone
import json


class BotVisit(models.Model):
    """Model to store bot visit information"""
    
    CLASSIFICATION_CHOICES = [
        ('indexing', 'Indexing'),
        ('retrieval', 'Retrieval'),
        ('unknown', 'Unknown'),
    ]
    
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)
    ip_address = models.GenericIPAddressField()
    bot_name = models.CharField(max_length=100, null=True, blank=True, db_index=True)
    page_url = models.URLField(max_length=2000)
    headers = models.TextField(help_text="JSON string of request headers")
    classification = models.CharField(
        max_length=20, 
        choices=CLASSIFICATION_CHOICES, 
        default='unknown',
        db_index=True
    )
    classification_confidence = models.FloatField(default=0.0)
    classification_reason = models.TextField(blank=True)
    user_agent = models.TextField()
    referer = models.URLField(max_length=2000, null=True, blank=True)
    request_method = models.CharField(max_length=10, default='GET')
    response_status = models.IntegerField(null=True, blank=True)
    response_time = models.IntegerField(null=True, blank=True, help_text="Response time in milliseconds")
    
    class Meta:
        db_table = 'ai_bot_visits'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['timestamp', 'bot_name']),
            models.Index(fields=['ip_address', 'timestamp']),
            models.Index(fields=['classification', 'timestamp']),
        ]
    
    def __str__(self):
        return f"{self.bot_name or 'Unknown Bot'} - {self.page_url} ({self.timestamp})"
    
    def get_headers_dict(self):
        """Return headers as dictionary"""
        try:
            return json.loads(self.headers) if self.headers else {}
        except json.JSONDecodeError:
            return {}
    
    def set_headers_dict(self, headers_dict):
        """Set headers from dictionary"""
        self.headers = json.dumps(headers_dict, default=str)
    
    @classmethod
    def get_stats(cls, time_range='24h', bot_name=None, classification=None):
        """Get statistics for bot visits"""
        from django.db.models import Count, Q
        from datetime import datetime, timedelta
        
        # Calculate time filter
        now = timezone.now()
        if time_range == '1h':
            time_filter = now - timedelta(hours=1)
        elif time_range == '24h':
            time_filter = now - timedelta(hours=24)
        elif time_range == '7d':
            time_filter = now - timedelta(days=7)
        elif time_range == '30d':
            time_filter = now - timedelta(days=30)
        else:
            time_filter = now - timedelta(hours=24)
        
        queryset = cls.objects.filter(timestamp__gte=time_filter)
        
        # Apply filters
        if bot_name:
            queryset = queryset.filter(bot_name=bot_name)
        if classification:
            queryset = queryset.filter(classification=classification)
        
        # Get basic stats
        total_visits = queryset.count()
        unique_ips = queryset.values('ip_address').distinct().count()
        
        # Get bot breakdown
        bot_stats = queryset.values('bot_name').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Get classification breakdown
        classification_stats = queryset.values('classification').annotate(
            count=Count('id')
        ).order_by('-count')
        
        # Get recent visits
        recent_visits = queryset.order_by('-timestamp')[:10].values(
            'timestamp', 'bot_name', 'page_url', 'classification', 'ip_address'
        )
        
        return {
            'total_visits': total_visits,
            'unique_ips': unique_ips,
            'time_range': time_range,
            'bot_breakdown': list(bot_stats),
            'classification_breakdown': list(classification_stats),
            'recent_visits': list(recent_visits)
        }


class BotStats(models.Model):
    """Model to store aggregated bot statistics"""
    
    bot_name = models.CharField(max_length=100, db_index=True)
    date = models.DateField(default=timezone.now, db_index=True)
    total_visits = models.IntegerField(default=0)
    indexing_visits = models.IntegerField(default=0)
    retrieval_visits = models.IntegerField(default=0)
    unique_ips = models.IntegerField(default=0)
    unique_pages = models.IntegerField(default=0)
    
    class Meta:
        db_table = 'ai_bot_stats'
        unique_together = ['bot_name', 'date']
        ordering = ['-date', 'bot_name']
    
    def __str__(self):
        return f"{self.bot_name} - {self.date} ({self.total_visits} visits)"


class BotConfig(models.Model):
    """Model to store bot detection configuration"""
    
    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.TextField()
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'ai_bot_config'
        ordering = ['key']
    
    def __str__(self):
        return f"{self.key}: {self.value[:50]}..."
    
    def get_value_as_json(self):
        """Return value as JSON object"""
        try:
            return json.loads(self.value)
        except json.JSONDecodeError:
            return self.value
    
    def set_value_from_json(self, data):
        """Set value from JSON object"""
        self.value = json.dumps(data, default=str)
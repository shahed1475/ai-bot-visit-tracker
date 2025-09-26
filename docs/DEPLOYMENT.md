# Deployment Guide - AI Bot Visit Tracking Tool

This comprehensive deployment guide covers production deployment strategies, Docker configurations, cloud deployment options, and best practices for the AI Bot Visit Tracking Tool.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Docker Deployment](#docker-deployment)
- [Cloud Deployment](#cloud-deployment)
- [Production Configuration](#production-configuration)
- [Database Setup](#database-setup)
- [Load Balancing](#load-balancing)
- [Monitoring & Logging](#monitoring--logging)
- [Security Considerations](#security-considerations)
- [Backup & Recovery](#backup--recovery)
- [Scaling Strategies](#scaling-strategies)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The AI Bot Visit Tracking Tool can be deployed in various environments:

- **Single Server**: Simple deployment for small to medium applications
- **Containerized**: Docker-based deployment for consistency and scalability
- **Cloud Native**: Kubernetes deployment for enterprise-scale applications
- **Serverless**: Function-based deployment for event-driven architectures

## 📋 Prerequisites

### System Requirements

#### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: 100 Mbps

#### Recommended Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **Network**: 1 Gbps

### Software Dependencies

```bash
# Node.js Environment
Node.js >= 16.0.0
npm >= 8.0.0

# Python Environment
Python >= 3.8
pip >= 21.0

# PHP Environment
PHP >= 7.4
Composer >= 2.0

# Database
PostgreSQL >= 12 (recommended)
MySQL >= 8.0
SQLite >= 3.35

# Optional
Redis >= 6.0 (for caching)
Docker >= 20.10
Docker Compose >= 2.0
```

## 🐳 Docker Deployment

### Single Container Deployment

#### Node.js Dockerfile
```dockerfile
# Dockerfile.nodejs
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY middleware/nodejs/package*.json ./
RUN npm ci --only=production

# Copy application code
COPY middleware/nodejs/ ./
COPY core/ ./core/
COPY database/ ./database/

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set permissions
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

#### Python Dockerfile (Flask)
```dockerfile
# Dockerfile.python-flask
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY middleware/python/flask/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY middleware/python/flask/ ./
COPY core/ ./core/
COPY database/ ./database/

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
```

#### Python Dockerfile (Django)
```dockerfile
# Dockerfile.python-django
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY middleware/python/django/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY middleware/python/django/ ./

# Create non-root user
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Collect static files
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "ai_bot_tracker_project.wsgi:application"]
```

#### PHP Dockerfile
```dockerfile
# Dockerfile.php
FROM php:8.1-fpm-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    postgresql-dev \
    && docker-php-ext-install pdo pdo_pgsql

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy application code
COPY middleware/php/ ./
RUN composer install --no-dev --optimize-autoloader

# Copy configuration files
COPY docker/php/nginx.conf /etc/nginx/nginx.conf
COPY docker/php/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create non-root user
RUN adduser -D -s /bin/sh app
RUN chown -R app:app /app

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
```

### Multi-Container Deployment with Docker Compose

#### Production Docker Compose
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Node.js Application
  nodejs-app:
    build:
      context: .
      dockerfile: Dockerfile.nodejs
    environment:
      - NODE_ENV=production
      - DB_TYPE=postgresql
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=ai_bot_tracker
      - DB_USER=app_user
      - DB_PASS=secure_password
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M

  # Python Flask Application
  python-flask-app:
    build:
      context: .
      dockerfile: Dockerfile.python-flask
    environment:
      - FLASK_ENV=production
      - DATABASE_URL=postgresql://app_user:secure_password@postgres:5432/ai_bot_tracker
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '1.0'
          memory: 512M

  # Python Django Application
  python-django-app:
    build:
      context: .
      dockerfile: Dockerfile.python-django
    environment:
      - DJANGO_SETTINGS_MODULE=ai_bot_tracker_project.settings.production
      - DATABASE_URL=postgresql://app_user:secure_password@postgres:5432/ai_bot_tracker
      - REDIS_URL=redis://redis:6379
      - SECRET_KEY=${DJANGO_SECRET_KEY}
    depends_on:
      - postgres
      - redis
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      replicas: 2

  # PHP Application
  php-app:
    build:
      context: .
      dockerfile: Dockerfile.php
    environment:
      - DB_TYPE=postgresql
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=ai_bot_tracker
      - DB_USER=app_user
      - DB_PASS=secure_password
    depends_on:
      - postgres
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      replicas: 2

  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=ai_bot_tracker
      - POSTGRES_USER=app_user
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G

  # Redis Cache
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - app-network
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  # Nginx Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - nodejs-app
      - python-flask-app
      - python-django-app
      - php-app
    networks:
      - app-network
    restart: unless-stopped

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./docker/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - app-network
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./docker/grafana/dashboards:/etc/grafana/provisioning/dashboards
    networks:
      - app-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  app-network:
    driver: bridge
```

#### Nginx Configuration
```nginx
# docker/nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream nodejs_backend {
        least_conn;
        server nodejs-app:3000 max_fails=3 fail_timeout=30s;
    }
    
    upstream python_flask_backend {
        least_conn;
        server python-flask-app:5000 max_fails=3 fail_timeout=30s;
    }
    
    upstream python_django_backend {
        least_conn;
        server python-django-app:8000 max_fails=3 fail_timeout=30s;
    }
    
    upstream php_backend {
        least_conn;
        server php-app:80 max_fails=3 fail_timeout=30s;
    }

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=100r/s;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Node.js Application
    server {
        listen 80;
        server_name nodejs.example.com;
        
        location / {
            limit_req zone=general burst=20 nodelay;
            proxy_pass http://nodejs_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /api/ {
            limit_req zone=api burst=5 nodelay;
            proxy_pass http://nodejs_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # Python Flask Application
    server {
        listen 80;
        server_name flask.example.com;
        
        location / {
            limit_req zone=general burst=20 nodelay;
            proxy_pass http://python_flask_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }

    # Python Django Application
    server {
        listen 80;
        server_name django.example.com;
        
        location / {
            limit_req zone=general burst=20 nodelay;
            proxy_pass http://python_django_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /static/ {
            alias /app/staticfiles/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # PHP Application
    server {
        listen 80;
        server_name php.example.com;
        
        location / {
            limit_req zone=general burst=20 nodelay;
            proxy_pass http://php_backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### Kubernetes Deployment

#### Kubernetes Manifests
```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ai-bot-tracker

---
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ai-bot-tracker-config
  namespace: ai-bot-tracker
data:
  DB_TYPE: "postgresql"
  DB_HOST: "postgres-service"
  DB_PORT: "5432"
  DB_NAME: "ai_bot_tracker"
  REDIS_URL: "redis://redis-service:6379"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: ai-bot-tracker-secrets
  namespace: ai-bot-tracker
type: Opaque
data:
  DB_USER: YXBwX3VzZXI=  # base64 encoded 'app_user'
  DB_PASS: c2VjdXJlX3Bhc3N3b3Jk  # base64 encoded 'secure_password'
  REDIS_PASSWORD: cmVkaXNfcGFzcw==  # base64 encoded 'redis_pass'

---
# k8s/nodejs-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-app
  namespace: ai-bot-tracker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nodejs-app
  template:
    metadata:
      labels:
        app: nodejs-app
    spec:
      containers:
      - name: nodejs-app
        image: ai-bot-tracker/nodejs:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        envFrom:
        - configMapRef:
            name: ai-bot-tracker-config
        - secretRef:
            name: ai-bot-tracker-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
# k8s/nodejs-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: nodejs-service
  namespace: ai-bot-tracker
spec:
  selector:
    app: nodejs-app
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
# k8s/postgres-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: ai-bot-tracker
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          valueFrom:
            configMapKeyRef:
              name: ai-bot-tracker-config
              key: DB_NAME
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: ai-bot-tracker-secrets
              key: DB_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: ai-bot-tracker-secrets
              key: DB_PASS
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc

---
# k8s/postgres-pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: ai-bot-tracker
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 20Gi

---
# k8s/postgres-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: ai-bot-tracker
spec:
  selector:
    app: postgres
  ports:
  - protocol: TCP
    port: 5432
    targetPort: 5432
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ai-bot-tracker-ingress
  namespace: ai-bot-tracker
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.example.com
    secretName: ai-bot-tracker-tls
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: nodejs-service
            port:
              number: 80
```

## ☁️ Cloud Deployment

### AWS Deployment

#### ECS with Fargate
```yaml
# aws/ecs-task-definition.json
{
  "family": "ai-bot-tracker",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "nodejs-app",
      "image": "ACCOUNT.dkr.ecr.REGION.amazonaws.com/ai-bot-tracker/nodejs:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "DB_TYPE",
          "value": "postgresql"
        }
      ],
      "secrets": [
        {
          "name": "DB_HOST",
          "valueFrom": "arn:aws:ssm:REGION:ACCOUNT:parameter/ai-bot-tracker/db-host"
        },
        {
          "name": "DB_USER",
          "valueFrom": "arn:aws:ssm:REGION:ACCOUNT:parameter/ai-bot-tracker/db-user"
        },
        {
          "name": "DB_PASS",
          "valueFrom": "arn:aws:ssm:REGION:ACCOUNT:parameter/ai-bot-tracker/db-pass"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/ai-bot-tracker",
          "awslogs-region": "us-west-2",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### CloudFormation Template
```yaml
# aws/cloudformation-template.yml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'AI Bot Tracker Infrastructure'

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues: [development, staging, production]
  
  DBInstanceClass:
    Type: String
    Default: db.t3.micro
    Description: RDS instance class

Resources:
  # VPC
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsHostnames: true
      EnableDnsSupport: true
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-vpc

  # Subnets
  PrivateSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-private-subnet-1

  PrivateSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-private-subnet-2

  PublicSubnet1:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.101.0/24
      AvailabilityZone: !Select [0, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-public-subnet-1

  PublicSubnet2:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.102.0/24
      AvailabilityZone: !Select [1, !GetAZs '']
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-public-subnet-2

  # RDS Database
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: Subnet group for RDS database
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-db-subnet-group

  DBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: Security group for RDS database
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 5432
          ToPort: 5432
          SourceSecurityGroupId: !Ref ECSSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-db-sg

  Database:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub ${AWS::StackName}-db
      DBInstanceClass: !Ref DBInstanceClass
      Engine: postgres
      EngineVersion: '15.4'
      AllocatedStorage: 20
      StorageType: gp2
      StorageEncrypted: true
      DBName: ai_bot_tracker
      MasterUsername: app_user
      MasterUserPassword: !Ref DBPassword
      VPCSecurityGroups:
        - !Ref DBSecurityGroup
      DBSubnetGroupName: !Ref DBSubnetGroup
      BackupRetentionPeriod: 7
      MultiAZ: !If [IsProduction, true, false]
      DeletionProtection: !If [IsProduction, true, false]
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-database

  # ECS Cluster
  ECSCluster:
    Type: AWS::ECS::Cluster
    Properties:
      ClusterName: !Sub ${AWS::StackName}-cluster
      CapacityProviders:
        - FARGATE
        - FARGATE_SPOT
      DefaultCapacityProviderStrategy:
        - CapacityProvider: FARGATE
          Weight: 1
        - CapacityProvider: FARGATE_SPOT
          Weight: 4

  # Application Load Balancer
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub ${AWS::StackName}-alb
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnet1
        - !Ref PublicSubnet2
      SecurityGroups:
        - !Ref ALBSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub ${AWS::StackName}-alb

Conditions:
  IsProduction: !Equals [!Ref Environment, production]

Outputs:
  DatabaseEndpoint:
    Description: RDS instance endpoint
    Value: !GetAtt Database.Endpoint.Address
    Export:
      Name: !Sub ${AWS::StackName}-db-endpoint

  LoadBalancerDNS:
    Description: Application Load Balancer DNS name
    Value: !GetAtt ALB.DNSName
    Export:
      Name: !Sub ${AWS::StackName}-alb-dns
```

### Google Cloud Platform Deployment

#### Cloud Run Deployment
```yaml
# gcp/cloud-run-service.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ai-bot-tracker-nodejs
  annotations:
    run.googleapis.com/ingress: all
    run.googleapis.com/execution-environment: gen2
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/maxScale: "100"
        autoscaling.knative.dev/minScale: "1"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "512Mi"
        run.googleapis.com/cpu: "1000m"
    spec:
      containerConcurrency: 80
      timeoutSeconds: 300
      containers:
      - image: gcr.io/PROJECT_ID/ai-bot-tracker-nodejs:latest
        ports:
        - name: http1
          containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DB_TYPE
          value: "postgresql"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: DB_PASS
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        resources:
          limits:
            cpu: 1000m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        startupProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
          failureThreshold: 30
```

### Azure Deployment

#### Container Instances
```yaml
# azure/container-group.yaml
apiVersion: 2021-03-01
location: East US
name: ai-bot-tracker-group
properties:
  containers:
  - name: nodejs-app
    properties:
      image: aibottracker.azurecr.io/nodejs:latest
      resources:
        requests:
          cpu: 1.0
          memoryInGB: 1.5
      ports:
      - port: 3000
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: DB_TYPE
        value: postgresql
      - name: DB_HOST
        secureValue: your-postgres-server.postgres.database.azure.com
      - name: DB_USER
        secureValue: app_user@your-postgres-server
      - name: DB_PASS
        secureValue: secure_password
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 80
    - protocol: TCP
      port: 443
    dnsNameLabel: ai-bot-tracker
tags:
  Environment: Production
  Application: AI Bot Tracker
```

## 🔧 Production Configuration

### Environment Variables

```bash
# .env.production
# Application
NODE_ENV=production
FLASK_ENV=production
DJANGO_SETTINGS_MODULE=ai_bot_tracker_project.settings.production

# Database
DB_TYPE=postgresql
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=ai_bot_tracker
DB_USER=app_user
DB_PASS=secure_password
DB_SSL=true
DB_POOL_MIN=5
DB_POOL_MAX=20

# Redis Cache
REDIS_URL=redis://your-redis-host.com:6379
REDIS_PASSWORD=redis_password
REDIS_DB=0

# Security
SECRET_KEY=your-very-long-secret-key-here
JWT_SECRET=your-jwt-secret-key
ENCRYPTION_KEY=your-encryption-key

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/ai-bot-tracker/app.log
LOG_MAX_SIZE=100MB
LOG_MAX_FILES=10

# Performance
ASYNC_BATCH_SIZE=100
ASYNC_FLUSH_INTERVAL=5000
CACHE_TTL=300

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_ENABLED=true
PROMETHEUS_PORT=9090

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW=3600
RATE_LIMIT_MAX_REQUESTS=1000

# Features
BOT_DETECTION_ENABLED=true
REQUEST_CLASSIFICATION_ENABLED=true
DATA_EXPORT_ENABLED=true
CLEANUP_ENABLED=true
CLEANUP_RETENTION_DAYS=30
```

### Production Settings Files

#### Node.js Production Config
```javascript
// config/production.js
module.exports = {
  database: {
    type: process.env.DB_TYPE || 'postgresql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    ssl: process.env.DB_SSL === 'true',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 5,
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idle: 10000,
      acquire: 60000,
    },
    logging: false
  },
  
  redis: {
    url: process.env.REDIS_URL,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB) || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE,
    maxSize: process.env.LOG_MAX_SIZE || '100MB',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 10,
    format: 'json'
  },
  
  performance: {
    asyncBatchSize: parseInt(process.env.ASYNC_BATCH_SIZE) || 100,
    asyncFlushInterval: parseInt(process.env.ASYNC_FLUSH_INTERVAL) || 5000,
    cacheTTL: parseInt(process.env.CACHE_TTL) || 300
  },
  
  security: {
    secretKey: process.env.SECRET_KEY,
    jwtSecret: process.env.JWT_SECRET,
    rateLimiting: {
      enabled: process.env.RATE_LIMIT_ENABLED === 'true',
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 1000 || 3600000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000
    }
  },
  
  features: {
    botDetection: process.env.BOT_DETECTION_ENABLED !== 'false',
    requestClassification: process.env.REQUEST_CLASSIFICATION_ENABLED !== 'false',
    dataExport: process.env.DATA_EXPORT_ENABLED !== 'false',
    cleanup: {
      enabled: process.env.CLEANUP_ENABLED !== 'false',
      retentionDays: parseInt(process.env.CLEANUP_RETENTION_DAYS) || 30
    }
  },
  
  monitoring: {
    metrics: process.env.METRICS_ENABLED === 'true',
    healthCheck: process.env.HEALTH_CHECK_ENABLED !== 'false',
    prometheusPort: parseInt(process.env.PROMETHEUS_PORT) || 9090
  }
};
```

#### Django Production Settings
```python
# ai_bot_tracker_project/settings/production.py
import os
from .base import *

DEBUG = False
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASS'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'OPTIONS': {
            'sslmode': 'require' if os.environ.get('DB_SSL') == 'true' else 'prefer',
        },
        'CONN_MAX_AGE': 600,
    }
}

# Cache
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            'PASSWORD': os.environ.get('REDIS_PASSWORD'),
        },
        'TIMEOUT': int(os.environ.get('CACHE_TTL', '300')),
    }
}

# Security
SECRET_KEY = os.environ.get('SECRET_KEY')
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            'format': '{"time": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}',
            'datefmt': '%Y-%m-%d %H:%M:%S'
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': os.environ.get('LOG_FILE', '/var/log/ai-bot-tracker/django.log'),
            'maxBytes': 100 * 1024 * 1024,  # 100MB
            'backupCount': 10,
            'formatter': 'json',
        },
    },
    'root': {
        'handlers': ['file'],
        'level': os.environ.get('LOG_LEVEL', 'INFO').upper(),
    },
}

# AI Bot Tracker Settings
AI_BOT_TRACKER = {
    'DATABASE': {
        'TYPE': os.environ.get('DB_TYPE', 'postgresql'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': int(os.environ.get('DB_PORT', '5432')),
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASS'),
    },
    'PERFORMANCE': {
        'ASYNC_BATCH_SIZE': int(os.environ.get('ASYNC_BATCH_SIZE', '100')),
        'ASYNC_FLUSH_INTERVAL': int(os.environ.get('ASYNC_FLUSH_INTERVAL', '5000')),
        'CACHE_TTL': int(os.environ.get('CACHE_TTL', '300')),
    },
    'FEATURES': {
        'BOT_DETECTION': os.environ.get('BOT_DETECTION_ENABLED', 'true').lower() == 'true',
        'REQUEST_CLASSIFICATION': os.environ.get('REQUEST_CLASSIFICATION_ENABLED', 'true').lower() == 'true',
        'DATA_EXPORT': os.environ.get('DATA_EXPORT_ENABLED', 'true').lower() == 'true',
        'CLEANUP': {
            'ENABLED': os.environ.get('CLEANUP_ENABLED', 'true').lower() == 'true',
            'RETENTION_DAYS': int(os.environ.get('CLEANUP_RETENTION_DAYS', '30')),
        },
    },
}
```

## 📊 Monitoring & Logging

### Prometheus Configuration
```yaml
# docker/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'ai-bot-tracker-nodejs'
    static_configs:
      - targets: ['nodejs-app:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'ai-bot-tracker-python'
    static_configs:
      - targets: ['python-flask-app:5000', 'python-django-app:8000']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'ai-bot-tracker-php'
    static_configs:
      - targets: ['php-app:80']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Dashboard
```json
{
  "dashboard": {
    "id": null,
    "title": "AI Bot Tracker Dashboard",
    "tags": ["ai-bot-tracker"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Bot Visits per Hour",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(bot_visits_total[1h])",
            "legendFormat": "{{bot_name}}"
          }
        ],
        "yAxes": [
          {
            "label": "Visits/hour"
          }
        ]
      },
      {
        "id": 2,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "id": 3,
        "title": "Database Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"ai_bot_tracker\"}"
          }
        ]
      }
    ],
    "time": {
      "from": "now-6h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
```

This deployment guide provides comprehensive instructions for deploying the AI Bot Visit Tracking Tool in various production environments, ensuring scalability, reliability, and security.
/**
 * Database Connection and Management System
 * Supports SQLite (default) and PostgreSQL
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class Database {
    constructor(config = {}) {
        this.config = {
            type: config.type || 'sqlite',
            sqlite: {
                path: config.sqlitePath || path.join(__dirname, '..', 'data', 'bot_visits.db'),
                ...config.sqlite
            },
            postgresql: {
                host: config.host || 'localhost',
                port: config.port || 5432,
                database: config.database || 'bot_tracker',
                user: config.user || 'postgres',
                password: config.password || '',
                ...config.postgresql
            }
        };
        
        this.db = null;
        this.isConnected = false;
    }

    /**
     * Initialize database connection
     */
    async connect() {
        try {
            if (this.config.type === 'sqlite') {
                await this.connectSQLite();
            } else if (this.config.type === 'postgresql') {
                await this.connectPostgreSQL();
            } else {
                throw new Error(`Unsupported database type: ${this.config.type}`);
            }
            
            await this.initializeSchema();
            this.isConnected = true;
            console.log(`Connected to ${this.config.type} database successfully`);
        } catch (error) {
            console.error('Database connection failed:', error);
            throw error;
        }
    }

    /**
     * Connect to SQLite database
     */
    async connectSQLite() {
        return new Promise((resolve, reject) => {
            // Ensure data directory exists
            const dataDir = path.dirname(this.config.sqlite.path);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.config.sqlite.path, (err) => {
                if (err) {
                    reject(err);
                } else {
                    // Enable foreign keys and WAL mode for better performance
                    this.db.run('PRAGMA foreign_keys = ON');
                    this.db.run('PRAGMA journal_mode = WAL');
                    resolve();
                }
            });
        });
    }

    /**
     * Connect to PostgreSQL database
     */
    async connectPostgreSQL() {
        // This would require pg module
        // const { Client } = require('pg');
        // Implementation for PostgreSQL connection
        throw new Error('PostgreSQL support not implemented yet. Use SQLite for now.');
    }

    /**
     * Initialize database schema
     */
    async initializeSchema() {
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Split schema into individual statements and filter out empty ones
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
            try {
                await this.run(statement + ';');
            } catch (error) {
                // Log but don't fail on view creation errors (they might already exist)
                if (!error.message.includes('already exists')) {
                    console.warn('Schema statement failed:', statement.substring(0, 50) + '...', error.message);
                }
            }
        }
    }

    /**
     * Execute a SQL query
     */
    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    /**
     * Execute a SELECT query and return all results
     */
    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    /**
     * Execute a SELECT query and return first result
     */
    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Log a bot visit to the database
     */
    async logVisit(visitData) {
        const {
            ipAddress,
            botName,
            pageUrl,
            headers,
            classification = 'unknown',
            userAgent,
            referer,
            requestMethod = 'GET',
            responseStatus,
            processingTimeMs
        } = visitData;

        const sql = `
            INSERT INTO visits (
                ip_address, bot_name, page_url, headers, classification,
                user_agent, referer, request_method, response_status, processing_time_ms
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            ipAddress,
            botName,
            pageUrl,
            JSON.stringify(headers),
            classification,
            userAgent,
            referer,
            requestMethod,
            responseStatus,
            processingTimeMs
        ];

        try {
            const result = await this.run(sql, params);
            return { success: true, visitId: result.lastID };
        } catch (error) {
            console.error('Failed to log visit:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get bot statistics
     */
    async getBotStats(botName = null) {
        let sql = 'SELECT * FROM bot_stats';
        let params = [];

        if (botName) {
            sql += ' WHERE bot_name = ?';
            params = [botName];
        }

        sql += ' ORDER BY total_visits DESC';

        return await this.all(sql, params);
    }

    /**
     * Get recent visits
     */
    async getRecentVisits(limit = 100, offset = 0) {
        const sql = `
            SELECT * FROM visits 
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
        `;
        return await this.all(sql, [limit, offset]);
    }

    /**
     * Get visits by classification
     */
    async getVisitsByClassification(classification, limit = 100) {
        const sql = `
            SELECT * FROM visits 
            WHERE classification = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;
        return await this.all(sql, [classification, limit]);
    }

    /**
     * Get visit statistics for a date range
     */
    async getVisitStats(startDate, endDate) {
        const sql = `
            SELECT 
                bot_name,
                classification,
                COUNT(*) as count,
                COUNT(DISTINCT ip_address) as unique_ips,
                COUNT(DISTINCT page_url) as unique_pages
            FROM visits 
            WHERE timestamp BETWEEN ? AND ?
            GROUP BY bot_name, classification
            ORDER BY count DESC
        `;
        return await this.all(sql, [startDate, endDate]);
    }

    /**
     * Export visits to JSON
     */
    async exportToJSON(filters = {}) {
        let sql = 'SELECT * FROM visits WHERE 1=1';
        let params = [];

        if (filters.botName) {
            sql += ' AND bot_name = ?';
            params.push(filters.botName);
        }

        if (filters.classification) {
            sql += ' AND classification = ?';
            params.push(filters.classification);
        }

        if (filters.startDate) {
            sql += ' AND timestamp >= ?';
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            sql += ' AND timestamp <= ?';
            params.push(filters.endDate);
        }

        sql += ' ORDER BY timestamp DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        const visits = await this.all(sql, params);
        return visits.map(visit => ({
            ...visit,
            headers: JSON.parse(visit.headers || '{}')
        }));
    }

    /**
     * Clean up old visits based on retention policy
     */
    async cleanupOldVisits(retentionDays = 365) {
        const sql = `
            DELETE FROM visits 
            WHERE timestamp < datetime('now', '-${retentionDays} days')
        `;
        const result = await this.run(sql);
        return result.changes;
    }

    /**
     * Close database connection
     */
    async close() {
        return new Promise((resolve) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    }
                    this.isConnected = false;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Check if database is connected
     */
    isReady() {
        return this.isConnected;
    }
}

module.exports = Database;
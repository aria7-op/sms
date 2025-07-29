import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import logger from '../config/logger.js';

class CredentialManager {
    constructor() {
        this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateDefaultKey();
        this.credentialsFile = path.join(process.cwd(), 'credentials.enc');
        this.credentials = null;
    }

    /**
     * Generate a default encryption key if none is provided
     */
    generateDefaultKey() {
        const defaultKey = crypto.randomBytes(32).toString('hex');
        logger.warn(`No ENCRYPTION_KEY found. Generated default key: ${defaultKey}`);
        logger.warn('Please set ENCRYPTION_KEY in your .env file for production use.');
        return defaultKey;
    }

    /**
     * Encrypt data
     */
    encrypt(data) {
        try {
            const iv = crypto.randomBytes(16);
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
            
            let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return {
                iv: iv.toString('hex'),
                encrypted: encrypted
            };
        } catch (error) {
            logger.error(`Encryption error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Decrypt data
     */
    decrypt(encryptedData) {
        try {
            const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(encryptedData.iv, 'hex'));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            logger.error(`Decryption error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Save credentials to encrypted file
     */
    saveCredentials(credentials) {
        try {
            const encrypted = this.encrypt(credentials);
            const data = JSON.stringify(encrypted);
            
            fs.writeFileSync(this.credentialsFile, data, 'utf8');
            logger.info('Credentials saved to encrypted file');
            
            return true;
        } catch (error) {
            logger.error(`Error saving credentials: ${error.message}`);
            return false;
        }
    }

    /**
     * Load credentials from encrypted file
     */
    loadCredentials() {
        try {
            if (!fs.existsSync(this.credentialsFile)) {
                logger.warn('Credentials file not found. Creating default credentials...');
                return this.createDefaultCredentials();
            }

            const data = fs.readFileSync(this.credentialsFile, 'utf8');
            const encrypted = JSON.parse(data);
            const credentials = this.decrypt(encrypted);
            
            logger.info('Credentials loaded from encrypted file');
            this.credentials = credentials;
            
            return credentials;
        } catch (error) {
            logger.error(`Error loading credentials: ${error.message}`);
            return this.createDefaultCredentials();
        }
    }

    /**
     * Create default credentials
     */
    createDefaultCredentials() {
        const defaultCredentials = {
            database: {
                url: process.env.DATABASE_URL || "postgresql://username:password@localhost:5432/school_management"
            },
            redis: {
                url: process.env.REDIS_URL || "redis://localhost:6379"
            },
            jwt: {
                secret: process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production",
                expiresIn: process.env.JWT_EXPIRES_IN || "24h"
            },
            ai: {
                openai: {
                    apiKey: process.env.OPENAI_API_KEY || ""
                },
                huggingface: {
                    apiKey: process.env.HUGGINGFACE_API_KEY || ""
                },
                cohere: {
                    apiKey: process.env.COHERE_API_KEY || ""
                }
            },
            websocket: {
                port: process.env.WEBSOCKET_PORT || 3001,
                corsOrigin: process.env.WEBSOCKET_CORS_ORIGIN || "http://localhost:3000"
            },
            encryption: {
                key: process.env.ENCRYPTION_KEY || this.generateDefaultKey(),
                algorithm: process.env.ENCRYPTION_ALGORITHM || "aes-256-gcm"
            },
            rateLimit: {
                window: process.env.RATE_LIMIT_WINDOW || 900000,
                maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS || 100
            },
            email: {
                host: process.env.SMTP_HOST || "",
                port: process.env.SMTP_PORT || 587,
                user: process.env.SMTP_USER || "",
                pass: process.env.SMTP_PASS || ""
            },
            sms: {
                accountSid: process.env.TWILIO_ACCOUNT_SID || "",
                authToken: process.env.TWILIO_AUTH_TOKEN || "",
                phoneNumber: process.env.TWILIO_PHONE_NUMBER || ""
            },
            notifications: {
                pushKey: process.env.PUSH_NOTIFICATION_KEY || "",
                pushSecret: process.env.PUSH_NOTIFICATION_SECRET || ""
            },
            monitoring: {
                enabled: process.env.ENABLE_METRICS === 'true',
                port: process.env.METRICS_PORT || 9090
            }
        };

        // Save default credentials
        this.saveCredentials(defaultCredentials);
        this.credentials = defaultCredentials;
        
        return defaultCredentials;
    }

    /**
     * Get specific credential
     */
    getCredential(path) {
        if (!this.credentials) {
            this.loadCredentials();
        }

        const keys = path.split('.');
        let value = this.credentials;

        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return null;
            }
        }

        return value;
    }

    /**
     * Update specific credential
     */
    updateCredential(path, value) {
        if (!this.credentials) {
            this.loadCredentials();
        }

        const keys = path.split('.');
        let current = this.credentials;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i];
            if (!(key in current) || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        current[keys[keys.length - 1]] = value;
        
        return this.saveCredentials(this.credentials);
    }

    /**
     * Get all credentials
     */
    getAllCredentials() {
        if (!this.credentials) {
            this.loadCredentials();
        }
        return this.credentials;
    }

    /**
     * Export credentials to environment variables
     */
    exportToEnv() {
        if (!this.credentials) {
            this.loadCredentials();
        }

        const envVars = {};

        // Database
        if (this.credentials.database?.url) {
            envVars.DATABASE_URL = this.credentials.database.url;
        }

        // Redis
        if (this.credentials.redis?.url) {
            envVars.REDIS_URL = this.credentials.redis.url;
        }

        // JWT
        if (this.credentials.jwt?.secret) {
            envVars.JWT_SECRET = this.credentials.jwt.secret;
        }
        if (this.credentials.jwt?.expiresIn) {
            envVars.JWT_EXPIRES_IN = this.credentials.jwt.expiresIn;
        }

        // AI Services
        if (this.credentials.ai?.openai?.apiKey) {
            envVars.OPENAI_API_KEY = this.credentials.ai.openai.apiKey;
        }
        if (this.credentials.ai?.huggingface?.apiKey) {
            envVars.HUGGINGFACE_API_KEY = this.credentials.ai.huggingface.apiKey;
        }
        if (this.credentials.ai?.cohere?.apiKey) {
            envVars.COHERE_API_KEY = this.credentials.ai.cohere.apiKey;
        }

        // WebSocket
        if (this.credentials.websocket?.port) {
            envVars.WEBSOCKET_PORT = this.credentials.websocket.port;
        }
        if (this.credentials.websocket?.corsOrigin) {
            envVars.WEBSOCKET_CORS_ORIGIN = this.credentials.websocket.corsOrigin;
        }

        // Encryption
        if (this.credentials.encryption?.key) {
            envVars.ENCRYPTION_KEY = this.credentials.encryption.key;
        }
        if (this.credentials.encryption?.algorithm) {
            envVars.ENCRYPTION_ALGORITHM = this.credentials.encryption.algorithm;
        }

        // Rate Limiting
        if (this.credentials.rateLimit?.window) {
            envVars.RATE_LIMIT_WINDOW = this.credentials.rateLimit.window;
        }
        if (this.credentials.rateLimit?.maxRequests) {
            envVars.RATE_LIMIT_MAX_REQUESTS = this.credentials.rateLimit.maxRequests;
        }

        // Email
        if (this.credentials.email?.host) {
            envVars.SMTP_HOST = this.credentials.email.host;
        }
        if (this.credentials.email?.port) {
            envVars.SMTP_PORT = this.credentials.email.port;
        }
        if (this.credentials.email?.user) {
            envVars.SMTP_USER = this.credentials.email.user;
        }
        if (this.credentials.email?.pass) {
            envVars.SMTP_PASS = this.credentials.email.pass;
        }

        // SMS
        if (this.credentials.sms?.accountSid) {
            envVars.TWILIO_ACCOUNT_SID = this.credentials.sms.accountSid;
        }
        if (this.credentials.sms?.authToken) {
            envVars.TWILIO_AUTH_TOKEN = this.credentials.sms.authToken;
        }
        if (this.credentials.sms?.phoneNumber) {
            envVars.TWILIO_PHONE_NUMBER = this.credentials.sms.phoneNumber;
        }

        // Notifications
        if (this.credentials.notifications?.pushKey) {
            envVars.PUSH_NOTIFICATION_KEY = this.credentials.notifications.pushKey;
        }
        if (this.credentials.notifications?.pushSecret) {
            envVars.PUSH_NOTIFICATION_SECRET = this.credentials.notifications.pushSecret;
        }

        // Monitoring
        if (this.credentials.monitoring?.enabled !== undefined) {
            envVars.ENABLE_METRICS = this.credentials.monitoring.enabled.toString();
        }
        if (this.credentials.monitoring?.port) {
            envVars.METRICS_PORT = this.credentials.monitoring.port;
        }

        // Set environment variables
        Object.keys(envVars).forEach(key => {
            process.env[key] = envVars[key];
        });

        logger.info('Credentials exported to environment variables');
        return envVars;
    }

    /**
     * Initialize credentials on startup
     */
    initialize() {
        logger.info('Initializing credential manager...');
        const credentials = this.loadCredentials();
        this.exportToEnv();
        return credentials;
    }
}

export default new CredentialManager(); 
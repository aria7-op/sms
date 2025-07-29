import crypto from 'crypto';
import { promisify } from 'util';
import { Buffer } from 'buffer';

class AdvancedEncryption {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
        this.saltLength = 64;
        this.iterations = 100000;
    }

    /**
     * Generate a secure random key
     * @param {number} length - Key length in bytes
     * @returns {Buffer} - Random key
     */
    generateKey(length = this.keyLength) {
        return crypto.randomBytes(length);
    }

    /**
     * Generate a secure random IV
     * @returns {Buffer} - Random IV
     */
    generateIV() {
        return crypto.randomBytes(this.ivLength);
    }

    /**
     * Derive key from password using PBKDF2
     * @param {string} password - Password to derive key from
     * @param {Buffer} salt - Salt for key derivation
     * @returns {Buffer} - Derived key
     */
    async deriveKey(password, salt) {
        return promisify(crypto.pbkdf2)(password, salt, this.iterations, this.keyLength, 'sha512');
    }

    /**
     * Encrypt data with AES-256-GCM
     * @param {string|Buffer} data - Data to encrypt
     * @param {Buffer} key - Encryption key
     * @param {Buffer} iv - Initialization vector
     * @returns {Object} - Encrypted data with metadata
     */
    encrypt(data, key, iv = null) {
        try {
            const cipher = crypto.createCipher(this.algorithm, key);
            if (iv) cipher.setAAD(iv);
            
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            return {
                encrypted,
                iv: iv || this.generateIV(),
                tag: cipher.getAuthTag(),
                algorithm: this.algorithm
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt data with AES-256-GCM
     * @param {string} encryptedData - Encrypted data
     * @param {Buffer} key - Decryption key
     * @param {Buffer} iv - Initialization vector
     * @param {Buffer} tag - Authentication tag
     * @returns {string} - Decrypted data
     */
    decrypt(encryptedData, key, iv, tag) {
        try {
            const decipher = crypto.createDecipher(this.algorithm, key);
            decipher.setAuthTag(tag);
            if (iv) decipher.setAAD(iv);
            
            let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Encrypt message with metadata
     * @param {Object} message - Message object
     * @param {string} key - Encryption key
     * @returns {Object} - Encrypted message
     */
    encryptMessage(message, key) {
        const messageStr = JSON.stringify(message);
        const keyBuffer = Buffer.from(key, 'hex');
        const iv = this.generateIV();
        
        const encrypted = this.encrypt(messageStr, keyBuffer, iv);
        
        return {
            encrypted: encrypted.encrypted,
            iv: encrypted.iv.toString('hex'),
            tag: encrypted.tag.toString('hex'),
            algorithm: encrypted.algorithm,
            timestamp: Date.now(),
            version: '1.0'
        };
    }

    /**
     * Decrypt message with metadata
     * @param {Object} encryptedMessage - Encrypted message object
     * @param {string} key - Decryption key
     * @returns {Object} - Decrypted message
     */
    decryptMessage(encryptedMessage, key) {
        const keyBuffer = Buffer.from(key, 'hex');
        const iv = Buffer.from(encryptedMessage.iv, 'hex');
        const tag = Buffer.from(encryptedMessage.tag, 'hex');
        
        const decrypted = this.decrypt(encryptedMessage.encrypted, keyBuffer, iv, tag);
        return JSON.parse(decrypted);
    }

    /**
     * Generate a secure conversation key
     * @param {string} conversationId - Conversation ID
     * @param {Array} participantIds - Array of participant IDs
     * @returns {string} - Generated key
     */
    generateConversationKey(conversationId, participantIds) {
        const participants = participantIds.sort().join(',');
        const data = `${conversationId}:${participants}:${Date.now()}`;
        const hash = crypto.createHash('sha256').update(data).digest('hex');
        return hash.substring(0, 64); // 32 bytes
    }

    /**
     * Encrypt file data
     * @param {Buffer} fileData - File data to encrypt
     * @param {string} key - Encryption key
     * @returns {Object} - Encrypted file data
     */
    encryptFile(fileData, key) {
        const keyBuffer = Buffer.from(key, 'hex');
        const iv = this.generateIV();
        
        const encrypted = this.encrypt(fileData, keyBuffer, iv);
        
        return {
            encrypted: encrypted.encrypted,
            iv: encrypted.iv.toString('hex'),
            tag: encrypted.tag.toString('hex'),
            algorithm: encrypted.algorithm,
            originalSize: fileData.length
        };
    }

    /**
     * Decrypt file data
     * @param {Object} encryptedFile - Encrypted file object
     * @param {string} key - Decryption key
     * @returns {Buffer} - Decrypted file data
     */
    decryptFile(encryptedFile, key) {
        const keyBuffer = Buffer.from(key, 'hex');
        const iv = Buffer.from(encryptedFile.iv, 'hex');
        const tag = Buffer.from(encryptedFile.tag, 'hex');
        
        return this.decrypt(encryptedFile.encrypted, keyBuffer, iv, tag);
    }

    /**
     * Create a digital signature
     * @param {string} data - Data to sign
     * @param {string} privateKey - Private key in PEM format
     * @returns {Object} - Signature object
     */
    sign(data, privateKey) {
        try {
            const sign = crypto.createSign('SHA256');
            sign.update(data);
            const signature = sign.sign(privateKey, 'base64');
            
            return {
                signature,
                algorithm: 'SHA256',
                timestamp: Date.now()
            };
        } catch (error) {
            throw new Error(`Signing failed: ${error.message}`);
        }
    }

    /**
     * Verify a digital signature
     * @param {string} data - Original data
     * @param {string} signature - Signature to verify
     * @param {string} publicKey - Public key in PEM format
     * @returns {boolean} - Verification result
     */
    verify(data, signature, publicKey) {
        try {
            const verify = crypto.createVerify('SHA256');
            verify.update(data);
            return verify.verify(publicKey, signature, 'base64');
        } catch (error) {
            throw new Error(`Verification failed: ${error.message}`);
        }
    }

    /**
     * Generate RSA key pair
     * @returns {Object} - Key pair object
     */
    generateKeyPair() {
        return crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });
    }

    /**
     * Hash data with salt
     * @param {string} data - Data to hash
     * @param {string} salt - Salt for hashing
     * @returns {string} - Hashed data
     */
    hash(data, salt = null) {
        const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(this.saltLength);
        const hash = crypto.pbkdf2Sync(data, saltBuffer, this.iterations, 64, 'sha512');
        
        return {
            hash: hash.toString('hex'),
            salt: saltBuffer.toString('hex')
        };
    }

    /**
     * Verify hash
     * @param {string} data - Original data
     * @param {string} hash - Hash to verify
     * @param {string} salt - Salt used for hashing
     * @returns {boolean} - Verification result
     */
    verifyHash(data, hash, salt) {
        const result = this.hash(data, salt);
        return result.hash === hash;
    }

    /**
     * Generate secure random string
     * @param {number} length - Length of string
     * @returns {string} - Random string
     */
    generateRandomString(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Encrypt sensitive data for storage
     * @param {Object} data - Data to encrypt
     * @param {string} masterKey - Master encryption key
     * @returns {Object} - Encrypted data for storage
     */
    encryptForStorage(data, masterKey) {
        const dataStr = JSON.stringify(data);
        const keyBuffer = Buffer.from(masterKey, 'hex');
        const iv = this.generateIV();
        
        const encrypted = this.encrypt(dataStr, keyBuffer, iv);
        
        return {
            encrypted: encrypted.encrypted,
            iv: encrypted.iv.toString('hex'),
            tag: encrypted.tag.toString('hex'),
            algorithm: encrypted.algorithm,
            createdAt: new Date().toISOString(),
            version: '1.0'
        };
    }

    /**
     * Decrypt data from storage
     * @param {Object} encryptedData - Encrypted data from storage
     * @param {string} masterKey - Master decryption key
     * @returns {Object} - Decrypted data
     */
    decryptFromStorage(encryptedData, masterKey) {
        const keyBuffer = Buffer.from(masterKey, 'hex');
        const iv = Buffer.from(encryptedData.iv, 'hex');
        const tag = Buffer.from(encryptedData.tag, 'hex');
        
        const decrypted = this.decrypt(encryptedData.encrypted, keyBuffer, iv, tag);
        return JSON.parse(decrypted);
    }
}

export default new AdvancedEncryption(); 
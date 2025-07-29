import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import NodeRSA from 'node-rsa';

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 16;
        this.tagLength = 16;
    }

    /**
     * Generate encryption key
     */
    generateKey() {
        return crypto.randomBytes(this.keyLength).toString('hex');
    }

    /**
     * Generate RSA key pair
     */
    generateRSAKeyPair(bits = 2048) {
        const key = new NodeRSA({ b: bits });
        return {
            publicKey: key.exportKey('public'),
            privateKey: key.exportKey('private')
        };
    }

    /**
     * Encrypt message with AES-256-GCM
     */
    encryptMessage(content, key) {
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipher(this.algorithm, key);
            
            let encrypted = cipher.update(content, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const tag = cipher.getAuthTag();
            
            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                tag: tag.toString('hex'),
                algorithm: this.algorithm
            };
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt message with AES-256-GCM
     */
    decryptMessage(encryptedData, key) {
        try {
            const decipher = crypto.createDecipher(this.algorithm, key);
            
            decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
            decipher.setAAD(Buffer.from(''));
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    /**
     * Encrypt with RSA
     */
    encryptWithRSA(content, publicKey) {
        try {
            const key = new NodeRSA(publicKey);
            return key.encrypt(content, 'base64');
        } catch (error) {
            throw new Error(`RSA encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt with RSA
     */
    decryptWithRSA(encryptedContent, privateKey) {
        try {
            const key = new NodeRSA(privateKey);
            return key.decrypt(encryptedContent, 'utf8');
        } catch (error) {
            throw new Error(`RSA decryption failed: ${error.message}`);
        }
    }

    /**
     * Encrypt with CryptoJS (for compatibility)
     */
    encryptWithCryptoJS(content, key) {
        try {
            const encrypted = CryptoJS.AES.encrypt(content, key).toString();
            return encrypted;
        } catch (error) {
            throw new Error(`CryptoJS encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt with CryptoJS (for compatibility)
     */
    decryptWithCryptoJS(encryptedContent, key) {
        try {
            const decrypted = CryptoJS.AES.decrypt(encryptedContent, key);
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (error) {
            throw new Error(`CryptoJS decryption failed: ${error.message}`);
        }
    }

    /**
     * Hash content for integrity checking
     */
    hashContent(content) {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Verify content integrity
     */
    verifyIntegrity(content, expectedHash) {
        const actualHash = this.hashContent(content);
        return actualHash === expectedHash;
    }

    /**
     * Generate message signature
     */
    signMessage(content, privateKey) {
        try {
            const key = new NodeRSA(privateKey);
            const hash = this.hashContent(content);
            return key.sign(hash, 'base64');
        } catch (error) {
            throw new Error(`Message signing failed: ${error.message}`);
        }
    }

    /**
     * Verify message signature
     */
    verifySignature(content, signature, publicKey) {
        try {
            const key = new NodeRSA(publicKey);
            const hash = this.hashContent(content);
            return key.verify(hash, signature, 'base64');
        } catch (error) {
            throw new Error(`Signature verification failed: ${error.message}`);
        }
    }

    /**
     * Encrypt file content
     */
    encryptFile(fileBuffer, key) {
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipher(this.algorithm, key);
            
            let encrypted = cipher.update(fileBuffer);
            encrypted = Buffer.concat([encrypted, cipher.final()]);
            
            const tag = cipher.getAuthTag();
            
            return {
                encrypted: encrypted.toString('base64'),
                iv: iv.toString('hex'),
                tag: tag.toString('hex'),
                algorithm: this.algorithm
            };
        } catch (error) {
            throw new Error(`File encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt file content
     */
    decryptFile(encryptedData, key) {
        try {
            const decipher = crypto.createDecipher(this.algorithm, key);
            
            decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
            decipher.setAAD(Buffer.from(''));
            
            let decrypted = decipher.update(Buffer.from(encryptedData.encrypted, 'base64'));
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            
            return decrypted;
        } catch (error) {
            throw new Error(`File decryption failed: ${error.message}`);
        }
    }

    /**
     * Generate secure random string
     */
    generateSecureRandom(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Generate password hash
     */
    hashPassword(password, salt = null) {
        if (!salt) {
            salt = crypto.randomBytes(16).toString('hex');
        }
        
        const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512');
        return {
            hash: hash.toString('hex'),
            salt: salt
        };
    }

    /**
     * Verify password
     */
    verifyPassword(password, hash, salt) {
        const newHash = this.hashPassword(password, salt);
        return newHash.hash === hash;
    }
}

export default new EncryptionService();

// Export individual functions for direct use
export const encryptMessage = (content, key) => {
    const encryptionService = new EncryptionService();
    return encryptionService.encryptMessage(content, key);
};

export const decryptMessage = (encryptedData, key) => {
    const encryptionService = new EncryptionService();
    return encryptionService.decryptMessage(encryptedData, key);
};

export const generateKey = () => {
    const encryptionService = new EncryptionService();
    return encryptionService.generateKey();
};

export const generateRSAKeyPair = (bits = 2048) => {
    const encryptionService = new EncryptionService();
    return encryptionService.generateRSAKeyPair(bits);
}; 
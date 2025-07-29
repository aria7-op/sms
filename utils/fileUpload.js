// utils/fileUpload.js
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../config/logger.js';
import { createAuditLog } from './auditLogger.js';
import mime from 'mime-types';
import { PrismaClient } from '../generated/prisma/client.js';

class FileUpload {
    constructor() {
        this.prisma = new PrismaClient();
        this.allowedMimeTypes = {
            image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
            document: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                'text/plain'
            ],
            video: ['video/mp4', 'video/webm', 'video/ogg'],
            audio: ['audio/mpeg', 'audio/ogg', 'audio/wav']
        };
        this.maxFileSize = 50 * 1024 * 1024; // 50MB
    }

    /**
     * Upload a file to the specified directory
     * @param {Object} file - The file object from multer or similar
     * @param {String} directory - The directory to store the file (e.g., 'assignments', 'submissions')
     * @returns {Promise<Object>} - Returns { success: Boolean, path: String, filename: String, mimeType: String, size: Number }
     */
    async uploadFile(file, directory) {
        try {
            // Validate file exists
            if (!file || !file.buffer) {
                throw new Error('No file provided or file is empty');
            }

            // Validate file size
            if (file.size > this.maxFileSize) {
                throw new Error(`File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`);
            }

            // Validate mime type
            const isValidType = this.validateMimeType(file.mimetype);
            if (!isValidType) {
                throw new Error(`File type ${file.mimetype} is not allowed`);
            }

            // Create directory if it doesn't exist
            const uploadDir = path.join(process.cwd(), 'uploads', directory);
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            // Generate unique filename
            const fileExt = path.extname(file.originalname) || mime.extension(file.mimetype) || '.bin';
            const filename = `${uuidv4()}${fileExt}`;
            const filePath = path.join(uploadDir, filename);
            const relativePath = path.join('uploads', directory, filename).replace(/\\/g, '/');

            // Write file to disk
            await fs.promises.writeFile(filePath, file.buffer);

            logger.info(`File uploaded successfully: ${relativePath}`);

            return {
                success: true,
                path: relativePath,
                filename: filename,
                mimeType: file.mimetype,
                size: file.size
            };
        } catch (error) {
            logger.error(`Error uploading file: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete a file from storage
     * @param {String} filePath - Relative path to the file
     * @returns {Promise<Object>} - Returns { success: Boolean, message: String }
     */
    async deleteFile(filePath) {
        try {
            const absolutePath = path.join(process.cwd(), filePath);

            // Check if file exists
            if (!fs.existsSync(absolutePath)) {
                logger.warn(`File not found for deletion: ${filePath}`);
                return { success: false, message: 'File not found' };
            }

            // Delete file
            await fs.promises.unlink(absolutePath);

            logger.info(`File deleted successfully: ${filePath}`);

            return { success: true, message: 'File deleted successfully' };
        } catch (error) {
            logger.error(`Error deleting file: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate file mime type against allowed types
     * @param {String} mimeType - The mime type to validate
     * @returns {Boolean} - Returns true if valid, false otherwise
     */
    validateMimeType(mimeType) {
        return Object.values(this.allowedMimeTypes)
            .flat()
            .includes(mimeType);
    }

    /**
     * Clean up orphaned files (files in database but not in storage and vice versa)
     * @param {String} resourceType - The resource type (e.g., 'ASSIGNMENT', 'SUBMISSION')
     * @returns {Promise<Object>} - Returns cleanup results
     */
    async cleanupOrphanedFiles(resourceType) {
        try {
            let model;
            let directory;

            switch (resourceType.toUpperCase()) {
                case 'ASSIGNMENT':
                    model = this.prisma.assignmentAttachment;
                    directory = 'assignments';
                    break;
                case 'SUBMISSION':
                    model = this.prisma.assignmentSubmissionAttachment;
                    directory = 'submissions';
                    break;
                default:
                    throw new Error('Invalid resource type for cleanup');
            }

            // Get all files in database
            const dbFiles = await model.findMany({
                select: { path: true }
            });

            // Get all files in storage
            const storageDir = path.join(process.cwd(), 'uploads', directory);
            let storageFiles = [];
            if (fs.existsSync(storageDir)) {
                storageFiles = fs.readdirSync(storageDir).map(file => 
                    path.join('uploads', directory, file).replace(/\\/g, '/')
                );
            }

            // Find files in storage not in database
            const dbFilePaths = dbFiles.map(f => f.path);
            const orphanedStorageFiles = storageFiles.filter(file => !dbFilePaths.includes(file));

            // Find files in database not in storage
            const orphanedDbFiles = dbFiles.filter(dbFile => 
                !fs.existsSync(path.join(process.cwd(), dbFile.path))
            );

            // Delete orphaned storage files
            let storageCleanupResults = [];
            for (const filePath of orphanedStorageFiles) {
                try {
                    await this.deleteFile(filePath);
                    storageCleanupResults.push({
                        path: filePath,
                        status: 'DELETED',
                        type: 'STORAGE'
                    });
                } catch (error) {
                    storageCleanupResults.push({
                        path: filePath,
                        status: 'FAILED',
                        type: 'STORAGE',
                        error: error.message
                    });
                }
            }

            // Delete orphaned database records
            let dbCleanupResults = [];
            for (const dbFile of orphanedDbFiles) {
                try {
                    await model.deleteMany({
                        where: { path: dbFile.path }
                    });
                    dbCleanupResults.push({
                        path: dbFile.path,
                        status: 'DELETED',
                        type: 'DATABASE'
                    });
                } catch (error) {
                    dbCleanupResults.push({
                        path: dbFile.path,
                        status: 'FAILED',
                        type: 'DATABASE',
                        error: error.message
                    });
                }
            }

            // Create audit log
            await createAuditLog({
                action: 'CLEANUP',
                entityType: 'FILE_UPLOAD',
                entityId: null,
                details: {
                    resourceType,
                    storageFilesCleaned: orphanedStorageFiles.length,
                    dbRecordsCleaned: orphanedDbFiles.length,
                    totalOrphansFound: orphanedStorageFiles.length + orphanedDbFiles.length
                }
            });

            logger.info(`Cleanup completed for ${resourceType}: ${orphanedStorageFiles.length} storage files and ${orphanedDbFiles.length} database records processed`);

            return {
                success: true,
                storageCleanup: storageCleanupResults,
                databaseCleanup: dbCleanupResults,
                stats: {
                    orphanedStorageFiles: orphanedStorageFiles.length,
                    orphanedDbFiles: orphanedDbFiles.length
                }
            };
        } catch (error) {
            logger.error(`Error during file cleanup: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get file information and stream for download
     * @param {String} filePath - Relative path to the file
     * @returns {Promise<Object>} - Returns file stream and info
     */
    async getFileStream(filePath) {
        try {
            const absolutePath = path.join(process.cwd(), filePath);

            // Check if file exists
            if (!fs.existsSync(absolutePath)) {
                throw new Error('File not found');
            }

            // Get file stats
            const stats = await fs.promises.stat(absolutePath);
            const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';

            // Create read stream
            const stream = fs.createReadStream(absolutePath);

            return {
                stream,
                stats,
                mimeType,
                filename: path.basename(absolutePath)
            };
        } catch (error) {
            logger.error(`Error getting file stream: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate and sanitize file upload
     * @param {Object} file - The file object
     * @returns {Object} - Validated and sanitized file data
     */
    validateFileUpload(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        if (file.size > this.maxFileSize) {
            throw new Error(`File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`);
        }

        if (!this.validateMimeType(file.mimetype)) {
            throw new Error(`File type ${file.mimetype} is not allowed`);
        }

        // Sanitize filename
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');

        return {
            originalname: sanitizedFilename,
            mimetype: file.mimetype,
            size: file.size,
            buffer: file.buffer
        };
    }

    /**
     * Generate a signed URL for temporary file access
     * @param {String} filePath - Relative path to the file
     * @param {Number} expiresIn - Time in seconds until URL expires (default 3600 - 1 hour)
     * @returns {Promise<String>} - Signed URL
     */
    async generateSignedUrl(filePath, expiresIn = 3600) {
        // In a production environment, you would integrate with a cloud storage service
        // like AWS S3, Google Cloud Storage, or Azure Blob Storage for signed URLs
        // This is a simplified version for local filesystem
        
        const baseUrl = process.env.FILE_BASE_URL || 'http://localhost:3000';
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        
        // Store the token in database for validation
        await this.prisma.fileAccessToken.create({
            data: {
                token,
                filePath,
                expiresAt,
                createdAt: new Date()
            }
        });

        return `${baseUrl}/api/files/download?token=${token}`;
    }

    /**
     * Verify a signed URL token
     * @param {String} token - The access token
     * @returns {Promise<Object>} - File information if valid
     */
    async verifySignedUrl(token) {
        const accessRecord = await this.prisma.fileAccessToken.findUnique({
            where: { token },
            include: { file: true }
        });

        if (!accessRecord) {
            throw new Error('Invalid access token');
        }

        if (new Date() > accessRecord.expiresAt) {
            await this.prisma.fileAccessToken.delete({ where: { token } });
            throw new Error('Access token has expired');
        }

        return {
            filePath: accessRecord.filePath,
            expiresAt: accessRecord.expiresAt
        };
    }
}

// Create a singleton instance
const fileUpload = new FileUpload();

// Export the instance as default
export default fileUpload;

// Export individual methods as named exports
export const uploadFile = fileUpload.uploadFile.bind(fileUpload);
export const deleteFile = fileUpload.deleteFile.bind(fileUpload);
export const validateFileUpload = fileUpload.validateFileUpload.bind(fileUpload);
export const getFileStream = fileUpload.getFileStream.bind(fileUpload);
export const cleanupOrphanedFiles = fileUpload.cleanupOrphanedFiles.bind(fileUpload);
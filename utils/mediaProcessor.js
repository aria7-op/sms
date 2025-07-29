import Jimp from 'jimp';
import path from 'path';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';

class MediaProcessor {
    constructor() {
        this.uploadDir = 'uploads/';
        this.maxFileSize = 100 * 1024 * 1024; // 100MB
        this.allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        this.allowedVideoTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/mov'];
        this.allowedAudioTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
        this.allowedDocumentTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain'
        ];
    }

    /**
     * Process uploaded media file
     */
    async processMessageMedia(fileData) {
        try {
            const {
                originalName,
                buffer,
                mimetype,
                size,
                conversationId,
                uploadedBy
            } = fileData;

            // Validate file size
            if (size > this.maxFileSize) {
                throw new Error('File size exceeds maximum limit');
            }

            // Generate unique filename
            const fileId = uuidv4();
            const extension = path.extname(originalName);
            const filename = `${fileId}${extension}`;
            const filePath = path.join(this.uploadDir, filename);

            // Ensure upload directory exists
            await fs.ensureDir(this.uploadDir);

            // Save original file
            await fs.writeFile(filePath, buffer);

            let processedData = {
                name: filename,
                originalName,
                type: this.getFileType(mimetype),
                mimeType: mimetype,
                size,
                path: filePath,
                url: `/uploads/${filename}`,
                metadata: {
                    uploadedBy,
                    conversationId,
                    uploadedAt: new Date()
                }
            };

            // Process based on file type
            if (this.allowedImageTypes.includes(mimetype)) {
                processedData = await this.processImage(filePath, processedData);
            } else if (this.allowedVideoTypes.includes(mimetype)) {
                processedData = await this.processVideo(filePath, processedData);
            } else if (this.allowedAudioTypes.includes(mimetype)) {
                processedData = await this.processAudio(filePath, processedData);
            } else if (this.allowedDocumentTypes.includes(mimetype)) {
                processedData = await this.processDocument(filePath, processedData);
            }

            return processedData;

        } catch (error) {
            throw new Error(`Media processing failed: ${error.message}`);
        }
    }

    /**
     * Process image files
     */
    async processImage(filePath, fileData) {
        try {
            const image = await Jimp.read(filePath);
            const metadata = {
                width: image.getWidth(),
                height: image.getHeight(),
                format: 'jpeg'
            };

            // Generate thumbnail
            const thumbnailName = `thumb_${fileData.name}`;
            const thumbnailPath = path.join(this.uploadDir, thumbnailName);
            
            // Create thumbnail using Jimp
            const thumbnail = image.clone().resize(150, 150);
            await thumbnail.writeAsync(thumbnailPath);

            // Generate medium size for preview
            const mediumName = `medium_${fileData.name}`;
            const mediumPath = path.join(this.uploadDir, mediumName);
            
            // Create medium size using Jimp
            const medium = image.clone().resize(800, 800);
            await medium.writeAsync(mediumPath);

            return {
                ...fileData,
                thumbnail: `/uploads/${thumbnailName}`,
                medium: `/uploads/${mediumName}`,
                metadata: {
                    ...fileData.metadata,
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format
                }
            };

        } catch (error) {
            throw new Error(`Image processing failed: ${error.message}`);
        }
    }

    /**
     * Process video files
     */
    async processVideo(filePath, fileData) {
        try {
            return new Promise((resolve, reject) => {
                // Generate thumbnail
                const thumbnailName = `thumb_${fileData.name}.jpg`;
                const thumbnailPath = path.join(this.uploadDir, thumbnailName);

                ffmpeg(filePath)
                    .screenshots({
                        timestamps: ['50%'],
                        filename: thumbnailName,
                        folder: this.uploadDir,
                        size: '320x240'
                    })
                    .on('end', async () => {
                        try {
                            // Get video metadata
                            const metadata = await this.getVideoMetadata(filePath);

                            resolve({
                                ...fileData,
                                thumbnail: `/uploads/${thumbnailName}`,
                                metadata: {
                                    ...fileData.metadata,
                                    duration: metadata.duration,
                                    width: metadata.width,
                                    height: metadata.height,
                                    format: metadata.format,
                                    bitrate: metadata.bitrate
                                }
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(new Error(`Video processing failed: ${error.message}`));
                    });
            });

        } catch (error) {
            throw new Error(`Video processing failed: ${error.message}`);
        }
    }

    /**
     * Process audio files
     */
    async processAudio(filePath, fileData) {
        try {
            return new Promise((resolve, reject) => {
                // Generate waveform data
                const waveformName = `waveform_${fileData.name}.json`;
                const waveformPath = path.join(this.uploadDir, waveformName);

                ffmpeg(filePath)
                    .outputOptions([
                        '-af', 'aresample=8000',
                        '-ac', '1',
                        '-f', 'data'
                    ])
                    .on('end', async () => {
                        try {
                            // Get audio metadata
                            const metadata = await this.getAudioMetadata(filePath);

                            resolve({
                                ...fileData,
                                waveform: `/uploads/${waveformName}`,
                                metadata: {
                                    ...fileData.metadata,
                                    duration: metadata.duration,
                                    sampleRate: metadata.sampleRate,
                                    channels: metadata.channels,
                                    format: metadata.format
                                }
                            });
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', (error) => {
                        reject(new Error(`Audio processing failed: ${error.message}`));
                    });
            });

        } catch (error) {
            throw new Error(`Audio processing failed: ${error.message}`);
        }
    }

    /**
     * Process document files
     */
    async processDocument(filePath, fileData) {
        try {
            // For documents, we mainly extract metadata
            const stats = await fs.stat(filePath);
            
            return {
                ...fileData,
                metadata: {
                    ...fileData.metadata,
                    pages: await this.getDocumentPages(filePath, fileData.mimeType),
                    fileSize: stats.size,
                    createdAt: stats.birthtime,
                    modifiedAt: stats.mtime
                }
            };

        } catch (error) {
            throw new Error(`Document processing failed: ${error.message}`);
        }
    }

    /**
     * Get video metadata
     */
    async getVideoMetadata(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
                    resolve({
                        duration: metadata.format.duration,
                        width: videoStream?.width,
                        height: videoStream?.height,
                        format: metadata.format.format_name,
                        bitrate: metadata.format.bit_rate
                    });
                }
            });
        });
    }

    /**
     * Get audio metadata
     */
    async getAudioMetadata(filePath) {
        return new Promise((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) {
                    reject(err);
                } else {
                    const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
                    resolve({
                        duration: metadata.format.duration,
                        sampleRate: audioStream?.sample_rate,
                        channels: audioStream?.channels,
                        format: metadata.format.format_name
                    });
                }
            });
        });
    }

    /**
     * Get document page count (basic implementation)
     */
    async getDocumentPages(filePath, mimeType) {
        // This is a basic implementation
        // For production, you'd want to use libraries like pdf-lib for PDFs
        // or other document processing libraries
        if (mimeType === 'application/pdf') {
            // Basic PDF page count (you'd want to use a proper PDF library)
            return 1; // Placeholder
        }
        return 1;
    }

    /**
     * Get file type category
     */
    getFileType(mimeType) {
        if (this.allowedImageTypes.includes(mimeType)) {
            return 'IMAGE';
        } else if (this.allowedVideoTypes.includes(mimeType)) {
            return 'VIDEO';
        } else if (this.allowedAudioTypes.includes(mimeType)) {
            return 'AUDIO';
        } else if (this.allowedDocumentTypes.includes(mimeType)) {
            return 'DOCUMENT';
        } else {
            return 'OTHER';
        }
    }

    /**
     * Compress image
     */
    async compressImage(inputPath, outputPath, quality = 80) {
        try {
            const image = await Jimp.read(inputPath);
            await image.quality(quality).writeAsync(outputPath);
            
            return outputPath;
        } catch (error) {
            throw new Error(`Image compression failed: ${error.message}`);
        }
    }

    /**
     * Convert video format
     */
    async convertVideo(inputPath, outputPath, format = 'mp4') {
        return new Promise((resolve, reject) => {
            ffmpeg(inputPath)
                .output(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', (error) => reject(new Error(`Video conversion failed: ${error.message}`)))
                .run();
        });
    }

    /**
     * Extract audio from video
     */
    async extractAudio(videoPath, audioPath) {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .outputOptions(['-vn', '-acodec', 'libmp3lame'])
                .output(audioPath)
                .on('end', () => resolve(audioPath))
                .on('error', (error) => reject(new Error(`Audio extraction failed: ${error.message}`)))
                .run();
        });
    }

    /**
     * Generate video thumbnail
     */
    async generateVideoThumbnail(videoPath, thumbnailPath, time = '00:00:05') {
        return new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .screenshots({
                    timestamps: [time],
                    filename: path.basename(thumbnailPath),
                    folder: path.dirname(thumbnailPath),
                    size: '320x240'
                })
                .on('end', () => resolve(thumbnailPath))
                .on('error', (error) => reject(new Error(`Thumbnail generation failed: ${error.message}`)));
        });
    }

    /**
     * Validate file type
     */
    validateFileType(mimeType) {
        const allowedTypes = [
            ...this.allowedImageTypes,
            ...this.allowedVideoTypes,
            ...this.allowedAudioTypes,
            ...this.allowedDocumentTypes
        ];
        
        return allowedTypes.includes(mimeType);
    }

    /**
     * Get file size in human readable format
     */
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Clean up temporary files
     */
    async cleanupTempFiles(filePaths) {
        try {
            for (const filePath of filePaths) {
                if (await fs.pathExists(filePath)) {
                    await fs.unlink(filePath);
                }
            }
        } catch (error) {
            console.error('Error cleaning up temp files:', error);
        }
    }
}

export default new MediaProcessor();

// Export individual functions for direct use
export const processMessageMedia = (fileData) => {
    const mediaProcessor = new MediaProcessor();
    return mediaProcessor.processMessageMedia(fileData);
};

export const compressImage = (inputPath, outputPath, quality = 80) => {
    const mediaProcessor = new MediaProcessor();
    return mediaProcessor.compressImage(inputPath, outputPath, quality);
};

export const convertVideo = (inputPath, outputPath, format = 'mp4') => {
    const mediaProcessor = new MediaProcessor();
    return mediaProcessor.convertVideo(inputPath, outputPath, format);
}; 
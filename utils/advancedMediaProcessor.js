import Jimp from 'jimp';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import advancedEncryption from './advancedEncryption.js';

class AdvancedMediaProcessor {
    constructor() {
        this.supportedImageFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'];
        this.supportedVideoFormats = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
        this.supportedAudioFormats = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'];
        this.maxFileSize = 100 * 1024 * 1024; // 100MB
        this.tempDir = './temp';
        this.ensureTempDir();
    }

    /**
     * Ensure temp directory exists
     */
    ensureTempDir() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    /**
     * Process image with advanced features using Jimp
     * @param {Buffer} imageBuffer - Image buffer
     * @param {Object} options - Processing options
     * @returns {Object} - Processed image data
     */
    async processImage(imageBuffer, options = {}) {
        try {
            const {
                width,
                height,
                quality = 80,
                format = 'jpeg',
                blur = 0,
                brightness = 0,
                contrast = 0,
                saturation = 0,
                watermark = null,
                encryption = false,
                encryptionKey = null
            } = options;

            // Load image with Jimp
            let image = await Jimp.read(imageBuffer);

            // Resize if dimensions provided
            if (width || height) {
                image = image.resize(width || Jimp.AUTO, height || Jimp.AUTO);
            }

            // Apply filters
            if (blur > 0) {
                image = image.blur(blur);
            }

            // Apply color adjustments
            if (brightness !== 0) {
                image = image.brightness(brightness / 100);
            }

            if (contrast !== 0) {
                image = image.contrast(contrast / 100);
            }

            // Add watermark if provided
            if (watermark) {
                image = await this.addWatermark(image, watermark);
            }

            // Convert to buffer with specified quality
            const outputBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

            // Encrypt if requested
            let finalBuffer = outputBuffer;
            let encryptionData = null;

            if (encryption && encryptionKey) {
                const encrypted = advancedEncryption.encryptFile(outputBuffer, encryptionKey);
                finalBuffer = Buffer.from(encrypted.encrypted, 'hex');
                encryptionData = {
                    iv: encrypted.iv,
                    tag: encrypted.tag,
                    algorithm: encrypted.algorithm
                };
            }

            return {
                success: true,
                buffer: finalBuffer,
                metadata: {
                    width: image.getWidth(),
                    height: image.getHeight(),
                    format: format,
                size: finalBuffer.length,
                    quality: quality
                },
                encryption: encryptionData
            };

        } catch (error) {
            console.error('Image processing error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Process video with advanced features
     * @param {Buffer} videoBuffer - Video buffer
     * @param {Object} options - Processing options
     * @returns {Object} - Processed video data
     */
    async processVideo(videoBuffer, options = {}) {
        try {
            const {
                width,
                height,
                bitrate = '1000k',
                format = 'mp4',
                fps = 30,
                audioCodec = 'aac',
                videoCodec = 'libx264',
                watermark = null,
                encryption = false,
                encryptionKey = null
            } = options;

            const tempInputPath = path.join(this.tempDir, `input_${uuidv4()}.mp4`);
            const tempOutputPath = path.join(this.tempDir, `output_${uuidv4()}.${format}`);

            // Write input buffer to temp file
            await fs.writeFile(tempInputPath, videoBuffer);

            return new Promise((resolve, reject) => {
                let command = `ffmpeg -i ${tempInputPath} -c:v ${videoCodec} -c:a ${audioCodec} -b:v ${bitrate} -r ${fps} -s ${width}x${height} -y ${tempOutputPath}`;

                // Add watermark if provided
                if (watermark) {
                    command += ` -vf "movie=${watermark}:w=100:h=50:enable='between(t,0,999)'[watermark];[0][watermark]overlay=10:10"`;
                }

                // Set output path
                command += ` -y ${tempOutputPath}`;

                const ffmpegProcess = require('child_process').exec(command, (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Video processing failed: ${error.message}`));
                    } else {
                        try {
                            const outputBuffer = fs.readFileSync(tempOutputPath);
                            
                            // Encrypt if requested
                            let finalBuffer = outputBuffer;
                            let encryptionData = null;

                            if (encryption && encryptionKey) {
                                const encrypted = advancedEncryption.encryptFile(outputBuffer, encryptionKey);
                                finalBuffer = Buffer.from(encrypted.encrypted, 'hex');
                                encryptionData = {
                                    iv: encrypted.iv,
                                    tag: encrypted.tag,
                                    algorithm: encrypted.algorithm
                                };
                            }

                            // Clean up temp files
                            fs.removeSync(tempInputPath);
                            fs.removeSync(tempOutputPath);

                            resolve({
                                buffer: finalBuffer,
                                format,
                                size: finalBuffer.length,
                                originalSize: videoBuffer.length,
                                compressionRatio: (1 - finalBuffer.length / videoBuffer.length) * 100,
                                encryption: encryptionData
                            });
                        } catch (error) {
                            reject(error);
                        }
                    }
                });

                ffmpegProcess.on('error', (error) => {
                    reject(new Error(`Video processing failed: ${error.message}`));
                });
            });
        } catch (error) {
            throw new Error(`Video processing failed: ${error.message}`);
        }
    }

    /**
     * Process audio with advanced features
     * @param {Buffer} audioBuffer - Audio buffer
     * @param {Object} options - Processing options
     * @returns {Object} - Processed audio data
     */
    async processAudio(audioBuffer, options = {}) {
        try {
            const {
                format = 'mp3',
                bitrate = '128k',
                sampleRate = 44100,
                channels = 2,
                encryption = false,
                encryptionKey = null
            } = options;

            const tempInputPath = path.join(this.tempDir, `input_${uuidv4()}.wav`);
            const tempOutputPath = path.join(this.tempDir, `output_${uuidv4()}.${format}`);

            // Write input buffer to temp file
            await fs.writeFile(tempInputPath, audioBuffer);

            return new Promise((resolve, reject) => {
                let command = `ffmpeg -i ${tempInputPath} -c:a ${format} -b:a ${bitrate} -ar ${sampleRate} -ac ${channels} -y ${tempOutputPath}`;

                // Set output path
                command += ` -y ${tempOutputPath}`;

                const ffmpegProcess = require('child_process').exec(command, (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Audio processing failed: ${error.message}`));
                    } else {
                        try {
                            const outputBuffer = fs.readFileSync(tempOutputPath);
                            
                            // Encrypt if requested
                            let finalBuffer = outputBuffer;
                            let encryptionData = null;

                            if (encryption && encryptionKey) {
                                const encrypted = advancedEncryption.encryptFile(outputBuffer, encryptionKey);
                                finalBuffer = Buffer.from(encrypted.encrypted, 'hex');
                                encryptionData = {
                                    iv: encrypted.iv,
                                    tag: encrypted.tag,
                                    algorithm: encrypted.algorithm
                                };
                            }

                            // Clean up temp files
                            fs.removeSync(tempInputPath);
                            fs.removeSync(tempOutputPath);

                            resolve({
                                buffer: finalBuffer,
                                format,
                                size: finalBuffer.length,
                                originalSize: audioBuffer.length,
                                compressionRatio: (1 - finalBuffer.length / audioBuffer.length) * 100,
                                encryption: encryptionData
                            });
                        } catch (error) {
                            reject(error);
                        }
                    }
                });

                ffmpegProcess.on('error', (error) => {
                    reject(new Error(`Audio processing failed: ${error.message}`));
                });
            });
        } catch (error) {
            throw new Error(`Audio processing failed: ${error.message}`);
        }
    }

    /**
     * Add watermark to image
     * @param {Jimp} image - Jimp image instance
     * @param {Object} watermark - Watermark options
     * @returns {Jimp} - Image with watermark
     */
    async addWatermark(image, watermark) {
        const {
            text,
            position = 'bottom-right',
            opacity = 0.7,
            fontSize = 24,
            color = '#ffffff'
        } = watermark;

        if (text) {
            // Create a simple text watermark using Jimp
            const font = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
            
            // Create watermark text
            const watermarkText = new Jimp(200, 50, 0x00000000); // Transparent background
            watermarkText.print(font, 10, 10, text);
            
            // Apply opacity
            watermarkText.opacity(opacity);
            
            // Composite watermark onto image
            const imageWidth = image.getWidth();
            const imageHeight = image.getHeight();
            const watermarkWidth = watermarkText.getWidth();
            const watermarkHeight = watermarkText.getHeight();
            
            let x, y;
            switch (position) {
                case 'top-left':
                    x = 10; y = 10;
                    break;
                case 'top-right':
                    x = imageWidth - watermarkWidth - 10; y = 10;
                    break;
                case 'bottom-left':
                    x = 10; y = imageHeight - watermarkHeight - 10;
                    break;
                case 'bottom-right':
                default:
                    x = imageWidth - watermarkWidth - 10; y = imageHeight - watermarkHeight - 10;
                    break;
                case 'center':
                    x = (imageWidth - watermarkWidth) / 2; y = (imageHeight - watermarkHeight) / 2;
                    break;
            }
            
            return image.composite(watermarkText, x, y);
        }

        return image;
    }

    /**
     * Generate thumbnail from video
     * @param {Buffer} videoBuffer - Video buffer
     * @param {Object} options - Thumbnail options
     * @returns {Object} - Thumbnail data
     */
    async generateVideoThumbnail(videoBuffer, options = {}) {
        try {
            const {
                width = 320,
                height = 240,
                time = '00:00:01',
                format = 'jpg',
                quality = 80
            } = options;

            const tempInputPath = path.join(this.tempDir, `video_${uuidv4()}.mp4`);
            const tempOutputPath = path.join(this.tempDir, `thumb_${uuidv4()}.${format}`);

            // Write input buffer to temp file
            await fs.writeFile(tempInputPath, videoBuffer);

            return new Promise((resolve, reject) => {
                const command = `ffmpeg -i ${tempInputPath} -ss ${time} -vframes 1 -s ${width}x${height} -y ${tempOutputPath}`;

                const ffmpegProcess = require('child_process').exec(command, (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Thumbnail generation failed: ${error.message}`));
                    } else {
                        try {
                            const thumbnailBuffer = fs.readFileSync(tempOutputPath);
                            
                            // Clean up temp files
                            fs.removeSync(tempInputPath);
                            fs.removeSync(tempOutputPath);

                            resolve({
                                buffer: thumbnailBuffer,
                                format,
                                size: thumbnailBuffer.length,
                                dimensions: { width, height }
                            });
                        } catch (error) {
                            reject(error);
                        }
                    }
                });

                ffmpegProcess.on('error', (error) => {
                    reject(new Error(`Thumbnail generation failed: ${error.message}`));
                });
            });
        } catch (error) {
            throw new Error(`Thumbnail generation failed: ${error.message}`);
        }
    }

    /**
     * Extract audio from video
     * @param {Buffer} videoBuffer - Video buffer
     * @param {Object} options - Audio extraction options
     * @returns {Object} - Extracted audio data
     */
    async extractAudioFromVideo(videoBuffer, options = {}) {
        try {
            const {
                format = 'mp3',
                bitrate = '128k',
                startTime = null,
                duration = null
            } = options;

            const tempInputPath = path.join(this.tempDir, `video_${uuidv4()}.mp4`);
            const tempOutputPath = path.join(this.tempDir, `audio_${uuidv4()}.${format}`);

            // Write input buffer to temp file
            await fs.writeFile(tempInputPath, videoBuffer);

            return new Promise((resolve, reject) => {
                let command = `ffmpeg -i ${tempInputPath} -c:a ${format} -b:a ${bitrate} -ss ${startTime} -t ${duration} -y ${tempOutputPath}`;

                // Set output path
                command += ` -y ${tempOutputPath}`;

                const ffmpegProcess = require('child_process').exec(command, (error, stdout, stderr) => {
                    if (error) {
                        reject(new Error(`Audio extraction failed: ${error.message}`));
                    } else {
                        try {
                            const audioBuffer = fs.readFileSync(tempOutputPath);
                            
                            // Clean up temp files
                            fs.removeSync(tempInputPath);
                            fs.removeSync(tempOutputPath);

                            resolve({
                                buffer: audioBuffer,
                                format,
                                size: audioBuffer.length,
                                originalVideoSize: videoBuffer.length
                            });
                        } catch (error) {
                            reject(error);
                        }
                    }
                });

                ffmpegProcess.on('error', (error) => {
                    reject(new Error(`Audio extraction failed: ${error.message}`));
                });
            });
        } catch (error) {
            throw new Error(`Audio extraction failed: ${error.message}`);
        }
    }

    /**
     * Get media metadata
     * @param {Buffer} mediaBuffer - Media buffer
     * @param {string} type - Media type ('image', 'video', 'audio')
     * @returns {Object} - Media metadata
     */
    async getMediaMetadata(mediaBuffer, type) {
        try {
            switch (type) {
                case 'image':
                    return await Jimp.read(mediaBuffer).then(image => ({
                        width: image.getWidth(),
                        height: image.getHeight(),
                        format: 'jpeg', // Assuming JPEG for metadata
                        size: mediaBuffer.length,
                        quality: 100 // No direct quality in metadata for JPEG
                    }));
                
                case 'video':
                case 'audio':
                    const tempPath = path.join(this.tempDir, `temp_${uuidv4()}.mp4`);
                    await fs.writeFile(tempPath, mediaBuffer);
                    
                    return new Promise((resolve, reject) => {
                        const command = `ffprobe -v quiet -print_format json -show_format -show_streams ${tempPath}`;
                        const ffprobeProcess = require('child_process').exec(command, (error, stdout, stderr) => {
                            fs.removeSync(tempPath);
                            if (error) {
                                reject(error);
                            } else {
                                try {
                                    const metadata = JSON.parse(stdout);
                                    resolve(metadata);
                                } catch (parseError) {
                                    reject(parseError);
                                }
                            }
                        });
                        ffprobeProcess.on('error', (error) => {
                            reject(error);
                        });
                    });
                
                default:
                    throw new Error(`Unsupported media type: ${type}`);
            }
        } catch (error) {
            throw new Error(`Metadata extraction failed: ${error.message}`);
        }
    }

    /**
     * Validate media file
     * @param {Buffer} mediaBuffer - Media buffer
     * @param {string} type - Media type
     * @returns {Object} - Validation result
     */
    async validateMedia(mediaBuffer, type) {
        try {
            const maxSizes = {
                image: 10 * 1024 * 1024, // 10MB
                video: 100 * 1024 * 1024, // 100MB
                audio: 50 * 1024 * 1024 // 50MB
            };

            const validation = {
                isValid: true,
                errors: [],
                warnings: []
            };

            // Check file size
            if (mediaBuffer.length > maxSizes[type]) {
                validation.isValid = false;
                validation.errors.push(`File size exceeds maximum allowed size for ${type}`);
            }

            // Check file format
            const metadata = await this.getMediaMetadata(mediaBuffer, type);
            
            if (!metadata) {
                validation.isValid = false;
                validation.errors.push('Unable to read file metadata');
            }

            return {
                ...validation,
                metadata,
                size: mediaBuffer.length
            };
        } catch (error) {
            return {
                isValid: false,
                errors: [error.message],
                warnings: [],
                size: mediaBuffer.length
            };
        }
    }

    /**
     * Clean up temporary files
     */
    async cleanup() {
        try {
            await fs.emptyDir(this.tempDir);
        } catch (error) {
            console.error('Cleanup failed:', error);
        }
    }
}

export default new AdvancedMediaProcessor(); 
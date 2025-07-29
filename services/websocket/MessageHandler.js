import { PrismaClient } from '../../generated/prisma/client.js';
import logger from '../../config/logger.js';
import advancedEncryption from '../../utils/advancedEncryption.js';
import advancedMediaProcessor from '../../utils/advancedMediaProcessor.js';
import { createAuditLog } from '../../utils/auditLogger.js';
import AIService from '../aiService.js';

class MessageHandler {
    constructor(websocketManager) {
        this.wsManager = websocketManager;
        this.prisma = websocketManager.getPrisma();
        this.redis = websocketManager.getRedis();
        this.io = websocketManager.getServer();
        this.aiService = AIService;
    }

    /**
     * Handle message sending
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Message data
     */
    async handleMessageSend(socket, data) {
        try {
            const {
                conversationId,
                content,
                type = 'DIRECT',
                priority = 'NORMAL',
                replyToId,
                attachments = [],
                metadata = {},
                isEncrypted = false,
                encryptionKey
            } = data;

            // Validate and normalize message type
            const validMessageTypes = ['DIRECT', 'GROUP', 'BROADCAST', 'ANNOUNCEMENT', 'SYSTEM', 'NOTIFICATION', 'ALERT', 'REMINDER', 'SCHEDULED', 'ENCRYPTED', 'VOICE', 'VIDEO', 'FILE', 'LOCATION', 'POLL', 'REACTION', 'THREAD', 'REPLY', 'FORWARD', 'ARCHIVE'];
            const normalizedType = validMessageTypes.includes(type) ? type : 'DIRECT';

            // Validate and normalize priority
            const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];
            const normalizedPriority = validPriorities.includes(priority) ? priority : 'NORMAL';

            // Validate conversation access
            const participant = await this.prisma.conversationParticipant.findFirst({
                where: {
                    conversationId: BigInt(conversationId),
                    userId: BigInt(socket.userId),
                    isActive: true
                }
            });

            if (!participant) {
                socket.emit('error', { message: 'Access denied to conversation' });
                return;
            }

            // Process message content
            let processedContent = content;
            let processedAttachments = attachments;

            // Encrypt content if requested
            if (isEncrypted && encryptionKey) {
                processedContent = this.encryptMessageContent(content, encryptionKey);
            }

            // Process attachments
            if (attachments.length > 0) {
                processedAttachments = await this.processAttachments(attachments, encryptionKey);
            }

            // Create message in database
            const message = await this.prisma.message.create({
                data: {
                    conversation: { connect: { id: BigInt(conversationId) } },
                    sender: { connect: { id: BigInt(socket.userId) } },
                    content: processedContent,
                    type: normalizedType,
                    priority: normalizedPriority,
                    replyTo: replyToId ? { connect: { id: BigInt(replyToId) } } : undefined,
                    isEncrypted,
                    encryptionKey: isEncrypted ? encryptionKey : null,
                    metadata,
                    createdByUser: { connect: { id: BigInt(socket.userId) } },
                    status: 'SENT',
                    deliveredAt: new Date()
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            avatar: true
                        }
                    },
                    replyTo: {
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    role: true,
                                    avatar: true
                                }
                            }
                        }
                    },
                    attachments: true
                }
            });

            // Add attachments to message
            if (processedAttachments.length > 0) {
                await this.prisma.messageAttachment.createMany({
                    data: processedAttachments.map(attachment => ({
                        messageId: message.id,
                        fileName: attachment.fileName,
                        fileType: attachment.fileType,
                        fileSize: attachment.fileSize,
                        fileUrl: attachment.fileUrl,
                        isEncrypted: attachment.isEncrypted,
                        encryptionData: attachment.encryptionData ? JSON.stringify(attachment.encryptionData) : null
                    }))
                });
            }

            // Prepare message for broadcasting
            const messageData = {
                id: message.id.toString(),
                conversationId: message.conversationId.toString(),
                senderId: message.senderId.toString(),
                content: message.content,
                type: message.type,
                priority: message.priority,
                replyToId: message.replyToId?.toString(),
                isEncrypted: message.isEncrypted,
                metadata: message.metadata,
                status: message.status,
                deliveredAt: message.deliveredAt,
                createdAt: message.createdAt,
                sender: message.sender,
                replyTo: message.replyTo,
                attachments: processedAttachments
            };

            // Broadcast message to conversation room using conversation handler
            await this.wsManager.getConversationHandler().broadcastNewMessage(message, conversationId);

            // Send delivery confirmation to sender
            socket.emit('message:delivered', {
                messageId: message.id.toString(),
                timestamp: Date.now()
            });

            // Process AI features if enabled
            if (metadata.aiEnabled) {
                await this.processAIFeatures(message, conversationId);
            }

            // Create audit log
            await createAuditLog({
                action: 'MESSAGE_SENT',
                userId: socket.userId,
                details: {
                    conversationId,
                    messageType: type,
                    isEncrypted,
                    hasAttachments: attachments.length > 0
                },
                ip: socket.handshake.address
            });

            logger.info(`Message sent by user ${socket.userId} in conversation ${conversationId}`);

        } catch (error) {
            logger.error(`Message sending error: ${error.message}`);
            socket.emit('error', { message: 'Failed to send message' });
        }
    }

    /**
     * Encrypt message content
     * @param {string} content - Message content
     * @param {string} key - Encryption key
     * @returns {string} - Encrypted content
     */
    encryptMessageContent(content, key) {
        try {
            const encrypted = advancedEncryption.encryptMessage({ content }, key);
            return JSON.stringify(encrypted);
        } catch (error) {
            throw new Error(`Message encryption failed: ${error.message}`);
        }
    }

    /**
     * Decrypt message content
     * @param {string} encryptedContent - Encrypted content
     * @param {string} key - Decryption key
     * @returns {string} - Decrypted content
     */
    decryptMessageContent(encryptedContent, key) {
        try {
            const encrypted = JSON.parse(encryptedContent);
            const decrypted = advancedEncryption.decryptMessage(encrypted, key);
            return decrypted.content;
        } catch (error) {
            throw new Error(`Message decryption failed: ${error.message}`);
        }
    }

    /**
     * Process attachments
     * @param {Array} attachments - Array of attachments
     * @param {string} encryptionKey - Encryption key (optional)
     * @returns {Array} - Processed attachments
     */
    async processAttachments(attachments, encryptionKey = null) {
        const processedAttachments = [];

        for (const attachment of attachments) {
            try {
                const {
                    fileName,
                    fileType,
                    fileData,
                    fileSize,
                    processingOptions = {}
                } = attachment;

                let processedFile = null;
                let encryptionData = null;

                // Convert base64 to buffer
                const fileBuffer = Buffer.from(fileData, 'base64');

                // Process based on file type
                if (this.isImageFile(fileType)) {
                    processedFile = await advancedMediaProcessor.processImage(fileBuffer, {
                        ...processingOptions,
                        encryption: !!encryptionKey,
                        encryptionKey
                    });
                } else if (this.isVideoFile(fileType)) {
                    processedFile = await advancedMediaProcessor.processVideo(fileBuffer, {
                        ...processingOptions,
                        encryption: !!encryptionKey,
                        encryptionKey
                    });
                } else if (this.isAudioFile(fileType)) {
                    processedFile = await advancedMediaProcessor.processAudio(fileBuffer, {
                        ...processingOptions,
                        encryption: !!encryptionKey,
                        encryptionKey
                    });
                } else {
                    // Handle other file types
                    processedFile = {
                        buffer: fileBuffer,
                        format: fileType,
                        size: fileBuffer.length,
                        originalSize: fileSize
                    };
                }

                // Encrypt if requested
                if (encryptionKey && processedFile.buffer) {
                    const encrypted = advancedEncryption.encryptFile(processedFile.buffer, encryptionKey);
                    processedFile.buffer = Buffer.from(encrypted.encrypted, 'hex');
                    encryptionData = {
                        iv: encrypted.iv,
                        tag: encrypted.tag,
                        algorithm: encrypted.algorithm
                    };
                }

                // Generate file URL (in real implementation, upload to cloud storage)
                const fileUrl = await this.uploadFile(processedFile.buffer, fileName);

                processedAttachments.push({
                    fileName,
                    fileType,
                    fileSize: processedFile.size,
                    fileUrl,
                    isEncrypted: !!encryptionKey,
                    encryptionData,
                    metadata: processedFile.metadata || {}
                });

            } catch (error) {
                logger.error(`Attachment processing error: ${error.message}`);
                // Continue with other attachments
            }
        }

        return processedAttachments;
    }

    /**
     * Check if file is image
     * @param {string} fileType - File type
     * @returns {boolean} - True if image
     */
    isImageFile(fileType) {
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff'];
        return imageTypes.includes(fileType.toLowerCase());
    }

    /**
     * Check if file is video
     * @param {string} fileType - File type
     * @returns {boolean} - True if video
     */
    isVideoFile(fileType) {
        const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'];
        return videoTypes.includes(fileType.toLowerCase());
    }

    /**
     * Check if file is audio
     * @param {string} fileType - File type
     * @returns {boolean} - True if audio
     */
    isAudioFile(fileType) {
        const audioTypes = ['mp3', 'wav', 'aac', 'ogg', 'flac', 'm4a'];
        return audioTypes.includes(fileType.toLowerCase());
    }

    /**
     * Upload file to storage
     * @param {Buffer} fileBuffer - File buffer
     * @param {string} fileName - File name
     * @returns {string} - File URL
     */
    async uploadFile(fileBuffer, fileName) {
        // In a real implementation, upload to cloud storage (AWS S3, Google Cloud Storage, etc.)
        // For now, return a placeholder URL
        const fileId = Math.random().toString(36).substring(7);
        return `https://storage.example.com/files/${fileId}/${fileName}`;
    }

    /**
     * Process AI features for message
     * @param {Object} message - Message object
     * @param {string} conversationId - Conversation ID
     */
    async processAIFeatures(message, conversationId) {
        try {
            // Get conversation context
            const recentMessages = await this.prisma.message.findMany({
                where: {
                    conversationId: BigInt(conversationId)
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 10,
                include: {
                    sender: {
                        select: {
                            name: true,
                            role: true
                        }
                    }
                }
            });

            const context = {
                conversationId,
                recentMessages: recentMessages.reverse(),
                currentMessage: message
            };

            // Generate AI suggestions
            const suggestions = await this.generateAIFeatures(context, message.type);
            
            if (suggestions.length > 0) {
                // Send suggestions to conversation
                this.io.to(`conversation_${conversationId}`).emit('ai:suggestions', {
                    messageId: message.id.toString(),
                    suggestions,
                    timestamp: Date.now()
                });
            }

            // Process message with AI for insights
            const insights = await this.aiService.processMessageAI(message, 'SENTIMENT');
            
            if (insights) {
                // Store insights in database (if model exists)
                try {
                    await this.prisma.messageInsight.create({
                        data: {
                            messageId: message.id,
                            insightType: insights.type,
                            insightData: JSON.stringify(insights),
                            confidence: insights.confidence || 0.5
                        }
                    });
                } catch (error) {
                    // If messageInsight model doesn't exist, just log the insights
                    logger.info(`AI insights for message ${message.id}: ${JSON.stringify(insights)}`);
                }
            }

        } catch (error) {
            logger.error(`AI processing error: ${error.message}`);
        }
    }

    /**
     * Generate AI suggestions
     * @param {Object} context - Conversation context
     * @param {string} messageType - Message type
     * @returns {Array} - AI suggestions
     */
    async generateAIFeatures(context, messageType) {
        try {
            const suggestions = [];

            // Generate quick replies
            if (messageType === 'TEXT') {
                const quickReplies = await this.generateQuickReplies(context);
                suggestions.push(...quickReplies);
            }

            // Generate smart responses
            const smartResponses = await this.generateSmartResponses(context);
            suggestions.push(...smartResponses);

            // Generate follow-up questions
            const followUpQuestions = await this.generateFollowUpQuestions(context);
            suggestions.push(...followUpQuestions);

            return suggestions;

        } catch (error) {
            logger.error(`AI suggestions generation error: ${error.message}`);
            return [];
        }
    }

    /**
     * Generate quick replies
     * @param {Object} context - Conversation context
     * @returns {Array} - Quick replies
     */
    async generateQuickReplies(context) {
        // This would integrate with your AI service
        return [
            { type: 'quick_reply', text: 'Thank you!', confidence: 0.8 },
            { type: 'quick_reply', text: 'I understand', confidence: 0.7 },
            { type: 'quick_reply', text: 'Let me check', confidence: 0.6 }
        ];
    }

    /**
     * Generate smart responses
     * @param {Object} context - Conversation context
     * @returns {Array} - Smart responses
     */
    async generateSmartResponses(context) {
        // This would integrate with your AI service
        return [
            { type: 'smart_response', text: 'Based on your message, here\'s what I found...', confidence: 0.9 },
            { type: 'smart_response', text: 'I can help you with that. Let me provide some information...', confidence: 0.8 }
        ];
    }

    /**
     * Generate follow-up questions
     * @param {Object} context - Conversation context
     * @returns {Array} - Follow-up questions
     */
    async generateFollowUpQuestions(context) {
        // This would integrate with your AI service
        return [
            { type: 'follow_up', text: 'Would you like me to explain this further?', confidence: 0.7 },
            { type: 'follow_up', text: 'Is there anything else you\'d like to know?', confidence: 0.6 }
        ];
    }

    /**
     * Handle message reactions
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Reaction data
     */
    async handleMessageReaction(socket, data) {
        try {
            const { messageId, reaction, userId } = data;

            // Validate message access
            const message = await this.prisma.message.findFirst({
                where: {
                    id: BigInt(messageId),
                    conversation: {
                        participants: {
                            some: {
                                userId: BigInt(socket.userId),
                                isActive: true
                            }
                        }
                    }
                }
            });

            if (!message) {
                socket.emit('error', { message: 'Message not found or access denied' });
                return;
            }

            // Add or update reaction
            try {
                const existingReaction = await this.prisma.messageReaction.findFirst({
                    where: {
                        messageId: BigInt(messageId),
                        userId: BigInt(socket.userId)
                    }
                });

                if (existingReaction) {
                    await this.prisma.messageReaction.update({
                        where: { id: existingReaction.id },
                        data: { reaction }
                    });
                } else {
                    await this.prisma.messageReaction.create({
                        data: {
                            messageId: BigInt(messageId),
                            userId: BigInt(socket.userId),
                            reaction
                        }
                    });
                }
            } catch (error) {
                // If messageReaction model doesn't exist, just log the reaction
                logger.info(`Reaction ${reaction} for message ${messageId} by user ${socket.userId}`);
            }

            // Broadcast reaction to conversation
            const conversationId = message.conversationId.toString();
            this.io.to(`conversation_${conversationId}`).emit('message:reaction', {
                messageId,
                userId: socket.userId,
                reaction,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Message reaction error: ${error.message}`);
            socket.emit('error', { message: 'Failed to add reaction' });
        }
    }

    /**
     * Handle message read receipts
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Read receipt data
     */
    async handleMessageRead(socket, data) {
        try {
            const { messageId, conversationId } = data;

            // Update message read status
            await this.prisma.messageReadReceipt.upsert({
                where: {
                    messageId_userId: {
                        messageId: BigInt(messageId),
                        userId: BigInt(socket.userId)
                    }
                },
                update: {
                    readAt: new Date()
                },
                create: {
                    messageId: BigInt(messageId),
                    userId: BigInt(socket.userId),
                    readAt: new Date()
                }
            });

            // Broadcast read receipt to conversation
            this.io.to(`conversation_${conversationId}`).emit('message:read', {
                messageId,
                userId: socket.userId,
                readAt: new Date(),
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Message read receipt error: ${error.message}`);
            socket.emit('error', { message: 'Failed to mark message as read' });
        }
    }
}

export default MessageHandler; 
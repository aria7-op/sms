import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import aiService from './aiService.js';
import { encryptMessage, decryptMessage } from '../utils/encryption.js';
import { processMessageMedia } from '../utils/mediaProcessor.js';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Disable Redis for now - use memory cache only
console.log('WebSocket Service: Redis disabled - using memory cache only');
const redis = {
    incr: async () => 1,
    expire: async () => true,
    setex: async () => true,
    del: async () => true,
    keys: async () => [],
    info: async () => 'memory',
    memory: async () => ({ used_memory: 0 }),
    dbsize: async () => 0,
    ping: async () => 'PONG'
};

class WebSocketService {
    constructor() {
        this.io = null;
        this.connectedUsers = new Map();
        this.userRooms = new Map();
        this.typingUsers = new Map();
    }

    initialize(server) {
        this.io = new Server(server, {
            cors: {
                origin: process.env.FRONTEND_URL || "*",
                methods: ["GET", "POST"],
                credentials: true
            },
            transports: ['websocket', 'polling'],
            pingTimeout: 60000,
            pingInterval: 25000,
            maxHttpBufferSize: 1e8
        });

        this.setupMiddleware();
        this.setupEventHandlers();
        this.startBackgroundTasks();

        logger.info('WebSocket server initialized');
        return this.io;
    }

    setupMiddleware() {
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.query.token;
                
                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                socket.userId = decoded.userId;
                socket.schoolId = decoded.schoolId;
                socket.userRole = decoded.role;

                const user = await prisma.user.findUnique({
                    where: { id: BigInt(decoded.userId) }
                });

                if (!user || !user.isActive) {
                    return next(new Error('User not found or inactive'));
                }

                socket.user = user;
                next();
            } catch (error) {
                logger.error(`WebSocket authentication error: ${error.message}`);
                next(new Error('Invalid authentication token'));
            }
        });
    }

    setupEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`User ${socket.userId} connected to WebSocket`);

            this.connectedUsers.set(socket.userId, socket);
            this.userRooms.set(socket.userId, new Set());

            this.joinUserConversations(socket);
            this.handleMessageEvents(socket);
            this.handleTypingEvents(socket);
            this.handleReactionEvents(socket);
            this.handleReadReceiptEvents(socket);
            this.handlePollEvents(socket);
            this.handleAIEvents(socket);
            this.handleConversationEvents(socket); // Add conversation event handlers

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });

            socket.on('error', (error) => {
                logger.error(`WebSocket error for user ${socket.userId}: ${error.message}`);
            });
        });
    }

    // Add conversation event handlers
    handleConversationEvents(socket) {
        // Handle conversation:join event
        socket.on('conversation:join', async (data) => {
            try {
                const { conversationId } = data;
                
                if (!conversationId) {
                    socket.emit('error', { message: 'Conversation ID is required' });
                    return;
                }

                // Verify user has access to this conversation
                const participant = await prisma.conversationParticipant.findFirst({
                    where: {
                        conversationId: BigInt(conversationId),
                        userId: BigInt(socket.userId),
                        isActive: true
                    },
                    include: {
                        conversation: {
                            include: {
                                participants: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                name: true,
                                                email: true,
                                                role: true,
                                                avatar: true
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                if (!participant) {
                    socket.emit('error', { message: 'Access denied to conversation' });
                    return;
                }

                // Join the conversation room
                const roomName = `conversation_${conversationId}`;
                socket.join(roomName);
                
                // Track user's rooms
                if (!this.userRooms.has(socket.userId)) {
                    this.userRooms.set(socket.userId, new Set());
                }
                this.userRooms.get(socket.userId).add(roomName);

                // Emit conversation joined event
                socket.emit('conversation:joined', {
                    conversationId,
                    participants: participant.conversation.participants.map(p => ({
                        id: p.user.id.toString(),
                        name: p.user.name,
                        email: p.user.email,
                        role: p.user.role,
                        avatar: p.user.avatar,
                        isActive: p.isActive
                    })),
                    timestamp: Date.now()
                });

                // Notify other participants that user joined
                socket.to(roomName).emit('conversation:user_joined', {
                    userId: socket.userId,
                    conversationId,
                    timestamp: Date.now()
                });

                logger.info(`User ${socket.userId} joined conversation ${conversationId}`);

            } catch (error) {
                logger.error(`Error joining conversation: ${error.message}`);
                socket.emit('error', { message: 'Failed to join conversation' });
            }
        });

        // Handle conversation:leave event
        socket.on('conversation:leave', async (data) => {
            try {
                const { conversationId } = data;
                
                if (!conversationId) {
                    socket.emit('error', { message: 'Conversation ID is required' });
                    return;
                }

                const roomName = `conversation_${conversationId}`;
                socket.leave(roomName);

                // Remove from user's rooms
                if (this.userRooms.has(socket.userId)) {
                    this.userRooms.get(socket.userId).delete(roomName);
                }

                // Notify other participants
                socket.to(roomName).emit('conversation:user_left', {
                    userId: socket.userId,
                    conversationId,
                    timestamp: Date.now()
                });

                logger.info(`User ${socket.userId} left conversation ${conversationId}`);

            } catch (error) {
                logger.error(`Error leaving conversation: ${error.message}`);
                socket.emit('error', { message: 'Failed to leave conversation' });
            }
        });
    }

    async joinUserConversations(socket) {
        try {
            const conversations = await prisma.conversationParticipant.findMany({
                where: {
                    userId: BigInt(socket.userId),
                    isActive: true
                },
                include: {
                    conversation: true
                }
            });

            conversations.forEach(participant => {
                const roomName = `conversation_${participant.conversationId}`;
                socket.join(roomName);
                this.userRooms.get(socket.userId).add(roomName);
                socket.join(`user_${socket.userId}`);
            });

            socket.emit('conversations:joined', {
                conversations: conversations.map(p => ({
                    id: p.conversationId,
                    name: p.conversation.name,
                    type: p.conversation.type,
                    role: p.role
                }))
            });

        } catch (error) {
            logger.error(`Error joining conversations: ${error.message}`);
        }
    }

    handleMessageEvents(socket) {
        // Handle message:send event (as requested by frontend developer)
        socket.on('message:send', async (data) => {
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

                const participant = await prisma.conversationParticipant.findFirst({
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

                let processedContent = content;
                let processedAttachments = attachments;

                if (isEncrypted && encryptionKey) {
                    processedContent = encryptMessage(content, encryptionKey);
                }

                if (attachments.length > 0) {
                    processedAttachments = await Promise.all(
                        attachments.map(attachment => processMessageMedia(attachment))
                    );
                }

                const message = await prisma.message.create({
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
                                        role: true
                                    }
                                }
                            }
                        },
                        attachments: true
                    }
                });

                await prisma.conversation.update({
                    where: { id: BigInt(conversationId) },
                    data: {
                        lastMessageAt: new Date(),
                        lastMessageId: message.id
                    }
                });

                if (processedAttachments.length > 0) {
                    await prisma.messageAttachment.createMany({
                        data: processedAttachments.map(attachment => ({
                            messageId: message.id,
                            name: attachment.name,
                            originalName: attachment.originalName,
                            type: attachment.type,
                            mimeType: attachment.mimeType,
                            size: attachment.size,
                            path: attachment.path,
                            url: attachment.url,
                            thumbnail: attachment.thumbnail,
                            metadata: attachment.metadata,
                            schoolId: BigInt(socket.schoolId),
                            createdBy: BigInt(socket.userId)
                        }))
                    });
                }

                const roomName = `conversation_${conversationId}`;
                
                // Prepare message data for broadcasting
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
                    attachments: message.attachments || []
                };

                // Broadcast to conversation room with the correct event name
                this.io.to(roomName).emit('conversation:new_message', messageData);

                socket.emit('message:sent', {
                    messageId: message.id,
                    conversationId,
                    timestamp: new Date()
                });

                this.processMessageAI(message);

                await createAuditLog({
                    action: 'CREATE',
                    entityType: 'MESSAGE',
                    entityId: message.id,
                    newData: message,
                    userId: socket.userId,
                    schoolId: socket.schoolId,
                    ipAddress: socket.handshake.address,
                    userAgent: socket.handshake.headers['user-agent']
                });

            } catch (error) {
                logger.error(`Error sending message: ${error.message}`);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('message:edit', async (data) => {
            try {
                const { messageId, content, contentHtml, contentMarkdown } = data;

                const message = await prisma.message.findFirst({
                    where: {
                        id: BigInt(messageId),
                        senderId: BigInt(socket.userId)
                    }
                });

                if (!message) {
                    socket.emit('error', { message: 'Message not found or access denied' });
                    return;
                }

                const updatedMessage = await prisma.message.update({
                    where: { id: BigInt(messageId) },
                    data: {
                        content,
                        contentHtml,
                        contentMarkdown,
                        isEdited: true,
                        editedAt: new Date()
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
                        }
                    }
                });

                const roomName = `conversation_${message.conversationId}`;
                this.io.to(roomName).emit('message:edited', {
                    message: updatedMessage,
                    conversationId: message.conversationId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error editing message: ${error.message}`);
                socket.emit('error', { message: 'Failed to edit message' });
            }
        });

        socket.on('message:delete', async (data) => {
            try {
                const { messageId } = data;

                const message = await prisma.message.findFirst({
                    where: {
                        id: BigInt(messageId),
                        senderId: BigInt(socket.userId)
                    }
                });

                if (!message) {
                    socket.emit('error', { message: 'Message not found or access denied' });
                    return;
                }

                await prisma.message.update({
                    where: { id: BigInt(messageId) },
                    data: {
                        isDeleted: true,
                        deletedAt: new Date()
                    }
                });

                const roomName = `conversation_${message.conversationId}`;
                this.io.to(roomName).emit('message:deleted', {
                    messageId,
                    conversationId: message.conversationId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error deleting message: ${error.message}`);
                socket.emit('error', { message: 'Failed to delete message' });
            }
        });
    }

    handleTypingEvents(socket) {
        socket.on('typing:start', async (data) => {
            try {
                const { conversationId } = data;
                const roomName = `conversation_${conversationId}`;

                if (!this.typingUsers.has(conversationId)) {
                    this.typingUsers.set(conversationId, new Set());
                }
                this.typingUsers.get(conversationId).add(socket.userId);

                socket.to(roomName).emit('typing:started', {
                    userId: socket.userId,
                    userName: socket.user.name,
                    conversationId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error handling typing start: ${error.message}`);
            }
        });

        socket.on('typing:stop', async (data) => {
            try {
                const { conversationId } = data;
                const roomName = `conversation_${conversationId}`;

                if (this.typingUsers.has(conversationId)) {
                    this.typingUsers.get(conversationId).delete(socket.userId);
                }

                socket.to(roomName).emit('typing:stopped', {
                    userId: socket.userId,
                    conversationId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error handling typing stop: ${error.message}`);
            }
        });
    }

    handleReactionEvents(socket) {
        socket.on('reaction:add', async (data) => {
            try {
                const { messageId, reaction, emoji, customText } = data;

                const message = await prisma.message.findUnique({
                    where: { id: BigInt(messageId) }
                });

                if (!message) {
                    socket.emit('error', { message: 'Message not found' });
                    return;
                }

                const messageReaction = await prisma.messageReaction.upsert({
                    where: {
                        messageId_userId_reaction: {
                            messageId: BigInt(messageId),
                            userId: BigInt(socket.userId),
                            reaction
                        }
                    },
                    update: {
                        emoji,
                        customText,
                        updatedAt: new Date()
                    },
                    create: {
                        messageId: BigInt(messageId),
                        userId: BigInt(socket.userId),
                        reaction,
                        emoji,
                        customText,
                        schoolId: socket.schoolId
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        }
                    }
                });

                const roomName = `conversation_${message.conversationId}`;
                this.io.to(roomName).emit('reaction:added', {
                    reaction: messageReaction,
                    messageId,
                    conversationId: message.conversationId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error adding reaction: ${error.message}`);
                socket.emit('error', { message: 'Failed to add reaction' });
            }
        });

        socket.on('reaction:remove', async (data) => {
            try {
                const { messageId, reaction } = data;

                const message = await prisma.message.findUnique({
                    where: { id: BigInt(messageId) }
                });

                if (!message) {
                    socket.emit('error', { message: 'Message not found' });
                    return;
                }

                await prisma.messageReaction.delete({
                    where: {
                        messageId_userId_reaction: {
                            messageId: BigInt(messageId),
                            userId: BigInt(socket.userId),
                            reaction
                        }
                    }
                });

                const roomName = `conversation_${message.conversationId}`;
                this.io.to(roomName).emit('reaction:removed', {
                    messageId,
                    userId: socket.userId,
                    reaction,
                    conversationId: message.conversationId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error removing reaction: ${error.message}`);
                socket.emit('error', { message: 'Failed to remove reaction' });
            }
        });
    }

    handleReadReceiptEvents(socket) {
        socket.on('message:read', async (data) => {
            try {
                const { messageId, conversationId } = data;

                await prisma.message.update({
                    where: { id: BigInt(messageId) },
                    data: {
                        isRead: true,
                        readAt: new Date()
                    }
                });

                await prisma.conversationParticipant.update({
                    where: {
                        conversationId_userId: {
                            conversationId: BigInt(conversationId),
                            userId: BigInt(socket.userId)
                        }
                    },
                    data: {
                        lastReadAt: new Date(),
                        lastReadMessageId: BigInt(messageId)
                    }
                });

                const roomName = `conversation_${conversationId}`;
                socket.to(roomName).emit('message:read', {
                    messageId,
                    userId: socket.userId,
                    conversationId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error handling read receipt: ${error.message}`);
            }
        });
    }

    handlePollEvents(socket) {
        socket.on('poll:create', async (data) => {
            try {
                const { conversationId, question, options, allowMultiple, isAnonymous, expiresAt } = data;

                const poll = await prisma.messagePoll.create({
                    data: {
                        conversationId: BigInt(conversationId),
                        question,
                        options,
                        allowMultiple,
                        isAnonymous,
                        expiresAt: expiresAt ? new Date(expiresAt) : null,
                        schoolId: socket.schoolId,
                        createdBy: socket.userId
                    }
                });

                const roomName = `conversation_${conversationId}`;
                this.io.to(roomName).emit('poll:created', {
                    poll,
                    conversationId,
                    createdBy: socket.userId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error creating poll: ${error.message}`);
                socket.emit('error', { message: 'Failed to create poll' });
            }
        });

        socket.on('poll:vote', async (data) => {
            try {
                const { pollId, selectedOptions } = data;

                const poll = await prisma.messagePoll.findUnique({
                    where: { id: BigInt(pollId) }
                });

                if (!poll) {
                    socket.emit('error', { message: 'Poll not found' });
                    return;
                }

                await prisma.pollVote.create({
                    data: {
                        pollId: BigInt(pollId),
                        userId: BigInt(socket.userId),
                        selectedOptions,
                        schoolId: socket.schoolId
                    }
                });

                const votes = await prisma.pollVote.findMany({
                    where: { pollId: BigInt(pollId) }
                });

                const results = this.calculatePollResults(poll.options, votes);

                await prisma.messagePoll.update({
                    where: { id: BigInt(pollId) },
                    data: {
                        totalVotes: votes.length,
                        results
                    }
                });

                const roomName = `conversation_${poll.conversationId}`;
                this.io.to(roomName).emit('poll:voted', {
                    pollId,
                    userId: socket.userId,
                    selectedOptions,
                    results,
                    conversationId: poll.conversationId,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error voting on poll: ${error.message}`);
                socket.emit('error', { message: 'Failed to vote on poll' });
            }
        });
    }

    handleAIEvents(socket) {
        socket.on('ai:analyze', async (data) => {
            try {
                const { messageId, analysisType } = data;

                const message = await prisma.message.findUnique({
                    where: { id: BigInt(messageId) }
                });

                if (!message) {
                    socket.emit('error', { message: 'Message not found' });
                    return;
                }

                const aiResult = await aiService.processMessageAI(message, analysisType);

                await prisma.messageAI.create({
                    data: {
                        messageId: BigInt(messageId),
                        type: analysisType,
                        input: message.content,
                        output: JSON.stringify(aiResult),
                        confidence: aiResult.confidence,
                        model: aiResult.model,
                        version: aiResult.version,
                        processingTime: aiResult.processingTime,
                        schoolId: socket.schoolId,
                        createdBy: socket.userId
                    }
                });

                socket.emit('ai:analyzed', {
                    messageId,
                    analysisType,
                    result: aiResult,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error in AI analysis: ${error.message}`);
                socket.emit('error', { message: 'Failed to analyze message' });
            }
        });

        socket.on('ai:suggest', async (data) => {
            try {
                const { conversationId, context, messageType } = data;

                const suggestions = await this.generateAISuggestions(context, messageType);

                socket.emit('ai:suggestions', {
                    conversationId,
                    suggestions,
                    timestamp: new Date()
                });

            } catch (error) {
                logger.error(`Error generating AI suggestions: ${error.message}`);
                socket.emit('error', { message: 'Failed to generate suggestions' });
            }
        });
    }

    handleDisconnect(socket) {
        logger.info(`User ${socket.userId} disconnected from WebSocket`);

        this.connectedUsers.delete(socket.userId);

        this.typingUsers.forEach((users, conversationId) => {
            users.delete(socket.userId);
        });

        this.updateUserStatus(socket.userId, 'offline');
    }

    async processMessageAI(message) {
        try {
            const sentiment = await aiService.processMessageAI(message, 'SENTIMENT');
            const moderation = await aiService.processMessageAI(message, 'MODERATION');

            await prisma.message.update({
                where: { id: message.id },
                data: {
                    aiAnalysis: {
                        sentiment: sentiment.result,
                        moderation: moderation.result,
                        processedAt: new Date()
                    },
                    sentiment: sentiment.result.sentiment
                }
            });

        } catch (error) {
            logger.error(`Error processing message AI: ${error.message}`);
        }
    }

    async updateUserStatus(userId, status) {
        try {
            await prisma.user.update({
                where: { id: BigInt(userId) },
                data: {
                    lastSeenAt: new Date(),
                    status
                }
            });

            this.io.emit('user:status', {
                userId,
                status,
                timestamp: new Date()
            });

        } catch (error) {
            logger.error(`Error updating user status: ${error.message}`);
        }
    }

    calculatePollResults(options, votes) {
        const results = {};
        const voteCounts = {};

        options.forEach(option => {
            voteCounts[option] = 0;
        });

        votes.forEach(vote => {
            vote.selectedOptions.forEach(option => {
                voteCounts[option] = (voteCounts[option] || 0) + 1;
            });
        });

        const totalVotes = votes.length;
        options.forEach(option => {
            results[option] = {
                count: voteCounts[option] || 0,
                percentage: totalVotes > 0 ? ((voteCounts[option] || 0) / totalVotes) * 100 : 0
            };
        });

        return results;
    }

    async generateAISuggestions(context, messageType) {
        try {
            const suggestions = [
                "How can I help you today?",
                "Is there anything specific you'd like to discuss?",
                "Let me know if you need any clarification."
            ];

            return suggestions;
        } catch (error) {
            logger.error(`Error generating AI suggestions: ${error.message}`);
            return [];
        }
    }

    startBackgroundTasks() {
        setInterval(() => {
            this.typingUsers.forEach((users, conversationId) => {
                const now = Date.now();
                users.forEach(userId => {
                    if (now - (this.lastTypingTime.get(userId) || 0) > 10000) {
                        users.delete(userId);
                    }
                });
            });
        }, 30000);
    }

    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }

    isServiceInitialized() {
        return this.io !== null;
    }

    async broadcastSystemMessage(message, targetUsers = null) {
        try {
            const systemMessage = {
                id: Date.now(),
                type: 'SYSTEM',
                content: message,
                sender: {
                    id: 'system',
                    name: 'System',
                    role: 'SYSTEM'
                },
                timestamp: new Date()
            };

            if (targetUsers) {
                targetUsers.forEach(userId => {
                    const socket = this.connectedUsers.get(userId);
                    if (socket) {
                        socket.emit('message:system', systemMessage);
                    }
                });
            } else {
                this.io.emit('message:system', systemMessage);
            }

        } catch (error) {
            logger.error(`Error broadcasting system message: ${error.message}`);
        }
    }
}

export default new WebSocketService(); 
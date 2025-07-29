import { PrismaClient } from '../../generated/prisma/client.js';
import logger from '../../config/logger.js';
import { createAuditLog } from '../../utils/auditLogger.js';

class ConversationHandler {
    constructor(websocketManager) {
        this.wsManager = websocketManager;
        this.prisma = websocketManager.getPrisma();
        this.io = websocketManager.getServer();
        this.activeConversations = new Map(); // Track active conversation subscriptions
    }

    /**
     * Join user to a conversation room for real-time updates
     * @param {string} userId - User ID
     * @param {string} conversationId - Conversation ID
     * @param {Socket} socket - Socket instance
     */
    async joinConversation(userId, conversationId, socket) {
        try {
            // Verify user has access to this conversation
            const participant = await this.prisma.conversationParticipant.findFirst({
                where: {
                    conversationId: BigInt(conversationId),
                    userId: BigInt(userId),
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
                return false;
            }

            // Join the conversation room
            const roomName = `conversation_${conversationId}`;
            socket.join(roomName);

            // Track active conversation subscription
            if (!this.activeConversations.has(userId)) {
                this.activeConversations.set(userId, new Set());
            }
            this.activeConversations.get(userId).add(conversationId);

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
                userId,
                conversationId,
                timestamp: Date.now()
            });

            logger.info(`User ${userId} joined conversation ${conversationId}`);
            return true;

        } catch (error) {
            logger.error(`Error joining conversation: ${error.message}`);
            socket.emit('error', { message: 'Failed to join conversation' });
            return false;
        }
    }

    /**
     * Leave a conversation room
     * @param {string} userId - User ID
     * @param {string} conversationId - Conversation ID
     * @param {Socket} socket - Socket instance
     */
    async leaveConversation(userId, conversationId, socket) {
        try {
            const roomName = `conversation_${conversationId}`;
            socket.leave(roomName);

            // Remove from active conversations
            if (this.activeConversations.has(userId)) {
                this.activeConversations.get(userId).delete(conversationId);
                if (this.activeConversations.get(userId).size === 0) {
                    this.activeConversations.delete(userId);
                }
            }

            // Notify other participants
            socket.to(roomName).emit('conversation:user_left', {
                userId,
                conversationId,
                timestamp: Date.now()
            });

            logger.info(`User ${userId} left conversation ${conversationId}`);

        } catch (error) {
            logger.error(`Error leaving conversation: ${error.message}`);
        }
    }

    /**
     * Broadcast new message to conversation participants
     * @param {Object} message - Message object
     * @param {string} conversationId - Conversation ID
     */
    async broadcastNewMessage(message, conversationId) {
        try {
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

            // Broadcast to conversation room
            this.io.to(roomName).emit('conversation:new_message', messageData);

            // Update conversation last activity
            await this.prisma.conversation.update({
                where: { id: BigInt(conversationId) },
                data: { lastActivityAt: new Date() }
            });

            logger.info(`New message broadcasted to conversation ${conversationId}`);

        } catch (error) {
            logger.error(`Error broadcasting new message: ${error.message}`);
        }
    }

    /**
     * Broadcast message read status
     * @param {string} messageId - Message ID
     * @param {string} userId - User ID who read the message
     * @param {string} conversationId - Conversation ID
     */
    async broadcastMessageRead(messageId, userId, conversationId) {
        try {
            const roomName = `conversation_${conversationId}`;
            
            this.io.to(roomName).emit('conversation:message_read', {
                messageId,
                userId,
                conversationId,
                timestamp: Date.now()
            });

            logger.info(`Message read status broadcasted for message ${messageId}`);

        } catch (error) {
            logger.error(`Error broadcasting message read: ${error.message}`);
        }
    }

    /**
     * Broadcast typing indicator
     * @param {string} userId - User ID
     * @param {string} conversationId - Conversation ID
     * @param {boolean} isTyping - Whether user is typing
     */
    async broadcastTypingIndicator(userId, conversationId, isTyping) {
        try {
            const roomName = `conversation_${conversationId}`;
            
            if (isTyping) {
                this.io.to(roomName).emit('conversation:typing_start', {
                    userId,
                    conversationId,
                    timestamp: Date.now()
                });
            } else {
                this.io.to(roomName).emit('conversation:typing_stop', {
                    userId,
                    conversationId,
                    timestamp: Date.now()
                });
            }

        } catch (error) {
            logger.error(`Error broadcasting typing indicator: ${error.message}`);
        }
    }

    /**
     * Get conversation participants
     * @param {string} conversationId - Conversation ID
     * @returns {Array} - Array of participant objects
     */
    async getConversationParticipants(conversationId) {
        try {
            const participants = await this.prisma.conversationParticipant.findMany({
                where: {
                    conversationId: BigInt(conversationId),
                    isActive: true
                },
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
            });

            return participants.map(p => ({
                id: p.user.id.toString(),
                name: p.user.name,
                email: p.user.email,
                role: p.user.role,
                avatar: p.user.avatar,
                isActive: p.isActive
            }));

        } catch (error) {
            logger.error(`Error getting conversation participants: ${error.message}`);
            return [];
        }
    }

    /**
     * Check if user is in conversation room
     * @param {string} userId - User ID
     * @param {string} conversationId - Conversation ID
     * @returns {boolean} - Whether user is in conversation room
     */
    isUserInConversation(userId, conversationId) {
        return this.activeConversations.has(userId) && 
               this.activeConversations.get(userId).has(conversationId);
    }

    /**
     * Get active conversations for user
     * @param {string} userId - User ID
     * @returns {Set} - Set of active conversation IDs
     */
    getActiveConversations(userId) {
        return this.activeConversations.get(userId) || new Set();
    }

    /**
     * Cleanup user's conversation subscriptions on disconnect
     * @param {string} userId - User ID
     */
    cleanupUserConversations(userId) {
        this.activeConversations.delete(userId);
        logger.info(`Cleaned up conversation subscriptions for user ${userId}`);
    }
}

export default ConversationHandler; 
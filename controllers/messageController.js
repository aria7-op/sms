import Message from '../models/Message.js';
import {
  validateMessage,
  validateGroupMessage,
  validateRoleBroadcast,
  validateMessageFilters,
  validateMessageSearch,
  validateConversationParams,
  validateBulkOperations
} from '../validators/messageValidator.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { safeResponse } from '../utils/jsonHelpers.js';
import WebSocketService from '../services/websocket/WebSocketService.js';

class MessageController {
    constructor() {
        this.messageModel = new Message();
        this.websocketService = null;
    }

    /**
     * Set WebSocket service instance
     * @param {WebSocketService} websocketService - WebSocket service instance
     */
    setWebSocketService(websocketService) {
        this.websocketService = websocketService;
    }

    /**
     * Create new message with advanced role-based permissions
     */
    async createMessage(req, res) {
        try {
            const { schoolId } = req.user;
            const messageData = {
                ...req.body,
                senderId: req.user.id,
                schoolId
            };

            const result = await this.messageModel.create(messageData);

            // Create audit log
            await createAuditLog({
                action: 'CREATE',
                entityType: 'MESSAGE',
                entityId: result.data.id,
                newData: result.data,
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Broadcast real-time message to conversation participants
            if (this.websocketService && result.data.conversationId) {
                try {
                    const conversationRoom = `conversation_${result.data.conversationId}`;
                    
                    // Emit to conversation room
                    this.websocketService.manager.getServer().to(conversationRoom).emit('message:received', {
                        message: safeResponse(result.data),
                        sender: {
                            id: req.user.id,
                            name: req.user.name,
                            role: req.user.role
                        },
                        timestamp: new Date().toISOString()
                    });

                    // Also emit to sender for confirmation
                    this.websocketService.manager.getServer().to(`user_${req.user.id}`).emit('message:sent', {
                        message: safeResponse(result.data),
                        timestamp: new Date().toISOString()
                    });

                    logger.info(`Real-time message broadcasted to conversation ${result.data.conversationId}`);
                } catch (wsError) {
                    logger.error(`WebSocket broadcast error: ${wsError.message}`);
                }
            }

            res.status(201).json({
                success: true,
                message: 'Message sent successfully',
                data: safeResponse(result.data)
            });

        } catch (error) {
            logger.error(`Error in createMessage: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Create group message (broadcast to multiple users)
     */
    async createGroupMessage(req, res) {
        try {
            const { schoolId } = req.user;
            const messageData = {
                ...req.body,
                senderId: req.user.id,
                schoolId
            };

            // Validate group message data
            const validation = validateGroupMessage(messageData);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Validation failed: ${validation.errors.join(', ')}`
                });
            }

            const result = await this.messageModel.createGroupMessage(messageData);

            // Create audit log
            await createAuditLog({
                action: 'CREATE_GROUP',
                entityType: 'MESSAGE',
                entityId: null,
                newData: { messageData, count: result.count },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(201).json({
                success: true,
                message: `Group message sent successfully to ${result.count} recipients`,
                data: safeResponse(result.data),
                count: result.count
            });

        } catch (error) {
            logger.error(`Error in createGroupMessage: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Create role-based broadcast message
     */
    async createRoleBroadcast(req, res) {
        try {
            const { schoolId } = req.user;
            const messageData = {
                ...req.body,
                senderId: req.user.id,
                schoolId
            };

            // Validate role broadcast data
            const validation = validateRoleBroadcast(messageData);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Validation failed: ${validation.errors.join(', ')}`
                });
            }

            const result = await this.messageModel.createRoleBroadcast(messageData);

            // Create audit log
            await createAuditLog({
                action: 'CREATE_BROADCAST',
                entityType: 'MESSAGE',
                entityId: null,
                newData: { messageData, count: result.count, targetRoles: messageData.targetRoles },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(201).json({
                success: true,
                message: `Role broadcast sent successfully to ${result.count} recipients`,
                data: safeResponse(result.data),
                count: result.count,
                targetRoles: messageData.targetRoles
            });

        } catch (error) {
            logger.error(`Error in createRoleBroadcast: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get message by ID
     */
    async getMessageById(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.messageModel.getById(id, req.user.id, schoolId);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getMessageById: ${error.message}`);
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get all messages with filtering and pagination
     */
    async getAllMessages(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                schoolId
            };

            // Validate filters
            const filterValidation = validateMessageFilters(filters);
            if (!filterValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Filter validation failed: ${filterValidation.errors.join(', ')}`
                });
            }

            const result = await this.messageModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getAllMessages: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages'
            });
        }
    }

    /**
     * Get messages by role-based filters
     */
    async getMessagesByRole(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                schoolId
            };

            const result = await this.messageModel.getMessagesByRole(req.user.id, schoolId, filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMessagesByRole: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages by role'
            });
        }
    }

    /**
     * Get messages by category
     */
    async getMessagesByCategory(req, res) {
        try {
            const { category } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getMessagesByCategory(req.user.id, schoolId, category, filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMessagesByCategory: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages by category'
            });
        }
    }

    /**
     * Get messages by priority
     */
    async getMessagesByPriority(req, res) {
        try {
            const { priority } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getMessagesByPriority(req.user.id, schoolId, priority, filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMessagesByPriority: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages by priority'
            });
        }
    }

    /**
     * Get messages by type
     */
    async getMessagesByType(req, res) {
        try {
            const { type } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getMessagesByType(req.user.id, schoolId, type, filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMessagesByType: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages by type'
            });
        }
    }

    /**
     * Get messages from specific role to current user
     */
    async getMessagesFromRole(req, res) {
        try {
            const { role } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getMessagesFromRole(req.user.id, schoolId, role, filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMessagesFromRole: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages from role'
            });
        }
    }

    /**
     * Get messages to specific role from current user
     */
    async getMessagesToRole(req, res) {
        try {
            const { role } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getMessagesToRole(req.user.id, schoolId, role, filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMessagesToRole: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages to role'
            });
        }
    }

    /**
     * Get inbox messages
     */
    async getInbox(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getInbox(req.user.id, schoolId, filters);

            res.status(200).json({
                success: true,
                data: safeResponse(result.data),
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getInbox: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving inbox'
            });
        }
    }

    /**
     * Get sent messages
     */
    async getSent(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getSent(req.user.id, schoolId, filters);

            res.status(200).json({
                success: true,
                data: safeResponse(result.data),
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getSent: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving sent messages'
            });
        }
    }

    /**
     * Update message
     */
    async updateMessage(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;
            const updateData = req.body;

            const result = await this.messageModel.update(id, updateData, req.user.id, schoolId);

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entityType: 'MESSAGE',
                entityId: parseInt(id),
                newData: result.data,
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: 'Message updated successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in updateMessage: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Mark message as read
     */
    async markAsRead(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.messageModel.markAsRead(id, req.user.id, schoolId);

            res.status(200).json({
                success: true,
                message: 'Message marked as read',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in markAsRead: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Mark message as unread
     */
    async markAsUnread(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.messageModel.markAsUnread(id, req.user.id, schoolId);

            res.status(200).json({
                success: true,
                message: 'Message marked as unread',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in markAsUnread: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Delete message
     */
    async deleteMessage(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.messageModel.delete(id, req.user.id, schoolId);

            // Create audit log
            await createAuditLog({
                action: 'DELETE',
                entityType: 'MESSAGE',
                entityId: parseInt(id),
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: result.message
            });

        } catch (error) {
            logger.error(`Error in deleteMessage: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Bulk mark messages as read
     */
    async bulkMarkAsRead(req, res) {
        try {
            const { messageIds } = req.body;
            const { schoolId } = req.user;

            // Validate bulk operation
            const validation = validateBulkOperations(messageIds, req.user.id);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Validation failed: ${validation.errors.join(', ')}`
                });
            }

            const result = await this.messageModel.bulkMarkAsRead(messageIds, req.user.id, schoolId);

            // Create audit log for bulk operation
            await createAuditLog({
                action: 'BULK_UPDATE',
                entityType: 'MESSAGE',
                entityId: null,
                newData: { messageIds, action: 'mark_as_read', count: result.count },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: result.message,
                count: result.count
            });

        } catch (error) {
            logger.error(`Error in bulkMarkAsRead: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get message statistics
     */
    async getMessageStatistics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getStatistics(req.user.id, schoolId, filters);

            res.status(200).json({
                success: true,
                data: safeResponse(result.data)
            });

        } catch (error) {
            logger.error(`Error in getMessageStatistics: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving message statistics'
            });
        }
    }

    /**
     * Get message analytics
     */
    async getMessageAnalytics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.messageModel.getAnalytics(schoolId, filters);

            res.status(200).json({
                success: true,
                data: safeResponse(result.data)
            });

        } catch (error) {
            logger.error(`Error in getMessageAnalytics: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving message analytics'
            });
        }
    }

    /**
     * Search messages
     */
    async searchMessages(req, res) {
        try {
            const { schoolId } = req.user;
            const { q: searchTerm, ...filters } = req.query;

            // Validate search parameters
            const searchValidation = validateMessageSearch(searchTerm, filters);
            if (!searchValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Search validation failed: ${searchValidation.errors.join(', ')}`
                });
            }

            const result = await this.messageModel.searchMessages(req.user.id, schoolId, searchTerm, filters);

            res.status(200).json({
                success: true,
                data: safeResponse(result.data)
            });

        } catch (error) {
            logger.error(`Error in searchMessages: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error searching messages'
            });
        }
    }

    /**
     * Get conversation between two users with real-time WebSocket integration
     */
    async getConversation(req, res) {
        try {
            const { userId } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            // Validate conversation parameters
            const validation = validateConversationParams(req.user.id, userId, filters);
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Validation failed: ${validation.errors.join(', ')}`
                });
            }

            const result = await this.messageModel.getConversation(req.user.id, userId, schoolId, filters);

            // Get conversation ID from the first message or create a new conversation
            let conversationId = null;
            if (result.data && result.data.length > 0) {
                conversationId = result.data[0].conversationId;
            } else {
                // Create a new conversation if none exists
                const conversation = await this.messageModel.createConversation(req.user.id, userId, schoolId);
                conversationId = conversation.id;
            }

            // WebSocket integration for real-time updates
            if (this.websocketService && this.websocketService.isServiceInitialized()) {
                const conversationHandler = this.websocketService.getConversationHandler();
                
                // Get conversation participants
                const participants = await conversationHandler.getConversationParticipants(conversationId);
                
                // Include WebSocket connection info in response
                const websocketInfo = {
                    enabled: true,
                    conversationId,
                    participants,
                    events: [
                        'conversation:new_message',
                        'conversation:message_read',
                        'conversation:typing_start',
                        'conversation:typing_stop',
                        'conversation:user_joined',
                        'conversation:user_left'
                    ],
                    instructions: {
                        join: `Emit 'conversation:join' with { conversationId: '${conversationId}' }`,
                        leave: `Emit 'conversation:leave' with { conversationId: '${conversationId}' }`,
                        typing: `Emit 'conversation:typing_start' or 'conversation:typing_stop' with { conversationId: '${conversationId}' }`
                    }
                };

                res.status(200).json({
                    success: true,
                    data: result.data,
                    pagination: result.pagination,
                    websocket: websocketInfo
                });
            } else {
                // Fallback without WebSocket
                res.status(200).json({
                    success: true,
                    data: result.data,
                    pagination: result.pagination,
                    websocket: { enabled: false }
                });
            }

        } catch (error) {
            logger.error(`Error in getConversation: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving conversation'
            });
        }
    }

    /**
     * Get unread message count
     */
    async getUnreadCount(req, res) {
        try {
            const { schoolId } = req.user;

            const result = await this.messageModel.getUnreadCount(req.user.id, schoolId);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getUnreadCount: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving unread count'
            });
        }
    }

    /**
     * Get messages by sender
     */
    async getMessagesBySender(req, res) {
        try {
            const { senderId } = req.params;
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                schoolId,
                senderId
            };

            const result = await this.messageModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMessagesBySender: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages by sender'
            });
        }
    }

    /**
     * Get messages by receiver
     */
    async getMessagesByReceiver(req, res) {
        try {
            const { receiverId } = req.params;
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                schoolId,
                receiverId
            };

            const result = await this.messageModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMessagesByReceiver: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving messages by receiver'
            });
        }
    }

    /**
     * Get unread messages
     */
    async getUnreadMessages(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                schoolId,
                isRead: false
            };

            const result = await this.messageModel.getInbox(req.user.id, schoolId, filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getUnreadMessages: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving unread messages'
            });
        }
    }
}

export default MessageController;
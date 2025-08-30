import WebSocketManager from './WebSocketManager.js';
import MessageHandler from './MessageHandler.js';
import RealTimeHandler from './RealTimeHandler.js';
import ConversationHandler from './ConversationHandler.js';
import NotificationHandler from './NotificationHandler.js';
import logger from '../../config/logger.js';

class WebSocketService {
    constructor() {
        this.manager = new WebSocketManager();
        this.messageHandler = null;
        this.realTimeHandler = null;
        this.conversationHandler = null;
        this.notificationHandler = null;
        this.isInitialized = false;
    }

    /**
     * Initialize WebSocket service
     * @param {Object} server - HTTP server instance
     * @returns {Object} - WebSocket service instance
     */
    initialize(server) {
        try {
            // Initialize WebSocket manager
            this.manager.initialize(server);

            // Initialize handlers
            this.messageHandler = new MessageHandler(this.manager);
            this.realTimeHandler = new RealTimeHandler(this.manager);
            this.conversationHandler = new ConversationHandler(this.manager);
            this.notificationHandler = new NotificationHandler(this.manager);

            // Setup event handlers
            this.setupEventHandlers();

            this.isInitialized = true;
            logger.info('WebSocket service initialized successfully');

            return this;
        } catch (error) {
            logger.error(`WebSocket service initialization failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Setup all event handlers
     */
    setupEventHandlers() {
        const io = this.manager.getServer();

        io.on('connection', (socket) => {
            // Setup message handlers
            socket.on('message:send', (data) => {
                this.messageHandler.handleMessageSend(socket, data);
            });

            socket.on('message:react', (data) => {
                this.messageHandler.handleMessageReaction(socket, data);
            });

            socket.on('message:read', (data) => {
                this.messageHandler.handleMessageRead(socket, data);
            });

            // Setup conversation handlers
            socket.on('conversation:join', (data) => {
                this.conversationHandler.joinConversation(socket.userId, data.conversationId, socket);
            });

            socket.on('conversation:leave', (data) => {
                this.conversationHandler.leaveConversation(socket.userId, data.conversationId, socket);
            });

            socket.on('conversation:typing_start', (data) => {
                this.conversationHandler.broadcastTypingIndicator(socket.userId, data.conversationId, true);
            });

            socket.on('conversation:typing_stop', (data) => {
                this.conversationHandler.broadcastTypingIndicator(socket.userId, data.conversationId, false);
            });

            // Setup real-time handlers
            socket.on('typing:start', (data) => {
                this.realTimeHandler.handleTypingStart(socket, data);
            });

            socket.on('typing:stop', (data) => {
                this.realTimeHandler.handleTypingStop(socket, data);
            });

            socket.on('poll:create', (data) => {
                this.realTimeHandler.handlePollCreate(socket, data);
            });

            socket.on('poll:vote', (data) => {
                this.realTimeHandler.handlePollVote(socket, data);
            });

            socket.on('user:status', (data) => {
                this.realTimeHandler.handleUserStatusUpdate(socket, data);
            });

            // Setup notification handlers
            socket.on('notification:join', (data) => {
                this.notificationHandler.handleUserConnection(socket, data);
            });

            socket.on('notification:read', (data) => {
                this.notificationHandler.handleNotificationRead(socket, data);
            });

            socket.on('notification:delete', (data) => {
                this.notificationHandler.handleNotificationDelete(socket, data);
            });

            socket.on('notification:mark_read', (data) => {
                this.notificationHandler.handleNotificationRead(socket, data);
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                this.notificationHandler.handleUserDisconnection(socket);
            });

            // Handle authentication
            socket.on('auth:login', (data) => {
                this.handleUserLogin(socket, data);
            });

            socket.on('auth:logout', () => {
                this.handleUserLogout(socket);
            });
        });
    }

    /**
     * Handle user login
     */
    handleUserLogin(socket, userData) {
        try {
            // Validate user data
            if (!userData.userId || !userData.schoolId) {
                socket.emit('auth:error', { message: 'Invalid user data' });
                return;
            }

            // Handle user connection for notifications
            this.notificationHandler.handleUserConnection(socket, userData);

            // Send confirmation
            socket.emit('auth:success', { 
                message: 'Authentication successful',
                userData 
            });

            logger.info(`User ${userData.userId} authenticated via WebSocket`);
        } catch (error) {
            logger.error(`Error handling user login: ${error.message}`);
            socket.emit('auth:error', { message: 'Authentication failed' });
        }
    }

    /**
     * Handle user logout
     */
    handleUserLogout(socket) {
        try {
            this.notificationHandler.handleUserDisconnection(socket);
            socket.emit('auth:logout_success', { message: 'Logged out successfully' });
            
            if (socket.userData) {
                logger.info(`User ${socket.userData.userId} logged out via WebSocket`);
            }
        } catch (error) {
            logger.error(`Error handling user logout: ${error.message}`);
        }
    }

    /**
     * Send notification to user
     */
    sendNotificationToUser(userId, notification) {
        if (this.notificationHandler) {
            this.notificationHandler.sendNotificationToUser(userId, notification);
        }
    }

    /**
     * Send notification to school
     */
    sendNotificationToSchool(schoolId, notification) {
        if (this.notificationHandler) {
            this.notificationHandler.sendNotificationToSchool(schoolId, notification);
        }
    }

    /**
     * Send notification to owner
     */
    sendNotificationToOwner(ownerId, notification) {
        if (this.notificationHandler) {
            this.notificationHandler.sendNotificationToOwner(ownerId, notification);
        }
    }

    /**
     * Send notification to role
     */
    sendNotificationToRole(role, notification) {
        if (this.notificationHandler) {
            this.notificationHandler.sendNotificationToRole(role, notification);
        }
    }

    /**
     * Broadcast notification to all users
     */
    broadcastNotification(notification) {
        if (this.notificationHandler) {
            this.notificationHandler.broadcastNotification(notification);
        }
    }

    /**
     * Send notification count update
     */
    sendNotificationCountUpdate(userId, count) {
        if (this.notificationHandler) {
            this.notificationHandler.sendNotificationCountUpdate(userId, count);
        }
    }

    /**
     * Get notification handler
     */
    getNotificationHandler() {
        return this.notificationHandler;
    }

    /**
     * Get message handler
     */
    getMessageHandler() {
        return this.messageHandler;
    }

    /**
     * Get conversation handler
     */
    getConversationHandler() {
        return this.conversationHandler;
    }

    /**
     * Get real-time handler
     */
    getRealTimeHandler() {
        return this.realTimeHandler;
    }

    /**
     * Check if service is initialized
     */
    isServiceInitialized() {
        return this.isInitialized;
    }

    /**
     * Get WebSocket manager
     */
    getManager() {
        return this.manager;
    }

    /**
     * Get WebSocket server
     */
    getServer() {
        return this.manager.getServer();
    }

    /**
     * Get online users count for a room
     */
    getOnlineUsersCount(room) {
        if (this.notificationHandler) {
            return this.notificationHandler.getOnlineUsersCount(room);
        }
        return 0;
    }

    /**
     * Get online users for a room
     */
    getOnlineUsers(room) {
        if (this.notificationHandler) {
            return this.notificationHandler.getOnlineUsers(room);
        }
        return [];
    }
}

export default WebSocketService; 

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { PrismaClient } from '../../generated/prisma/client.js';
import logger from '../../config/logger.js';
import advancedEncryption from '../../utils/advancedEncryption.js';
import { createAuditLog } from '../../utils/auditLogger.js';

class WebSocketManager {
    constructor() {
        this.io = null;
        
        // Disable Redis for now - use memory cache only
        console.log('Redis disabled - using memory cache only');
        this.redis = {
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
        
        this.prisma = new PrismaClient();
        this.connectedUsers = new Map();
        this.userRooms = new Map();
        this.typingUsers = new Map();
        this.messageHandlers = new Map();
        this.eventHandlers = new Map();
        this.middleware = [];
    }

    /**
     * Initialize WebSocket server
     * @param {Object} server - HTTP server instance
     * @returns {Server} - Socket.IO server instance
     */
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
            maxHttpBufferSize: 1e8,
            allowEIO3: true
        });

        this.setupMiddleware();
        this.setupCoreEventHandlers();
        this.startBackgroundTasks();

        logger.info('WebSocket server initialized');
        return this.io;
    }

    /**
     * Setup authentication and other middleware
     */
    setupMiddleware() {
        // Authentication middleware
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

                const user = await this.prisma.user.findUnique({
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

        // Rate limiting middleware
        this.io.use(async (socket, next) => {
            const key = `ws_rate_limit:${socket.userId}`;
            const limit = await this.redis.incr(key);
            
            if (limit === 1) {
                await this.redis.expire(key, 60); // 1 minute window
            }
            
            if (limit > 100) { // 100 events per minute
                return next(new Error('Rate limit exceeded'));
            }
            
            next();
        });

        // Encryption middleware
        this.io.use(async (socket, next) => {
            socket.encryptionKey = advancedEncryption.generateRandomString(32);
            next();
        });
    }

    /**
     * Setup core event handlers
     */
    setupCoreEventHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`User ${socket.userId} connected to WebSocket`);

            this.handleConnection(socket);
            this.setupSocketEventHandlers(socket);

            socket.on('disconnect', () => {
                this.handleDisconnect(socket);
            });

            socket.on('error', (error) => {
                logger.error(`WebSocket error for user ${socket.userId}: ${error.message}`);
            });
        });
    }

    /**
     * Handle new connection
     * @param {Socket} socket - Socket instance
     */
    async handleConnection(socket) {
        try {
            // Store connected user
            this.connectedUsers.set(socket.userId, socket);
            this.userRooms.set(socket.userId, new Set());

            // Update user status
            await this.updateUserStatus(socket.userId, 'ONLINE');

            // Join user to their personal room
            socket.join(`user_${socket.userId}`);

            // Join user to school room
            if (socket.schoolId) {
                socket.join(`school_${socket.schoolId}`);
            }

            // Join user to role-based room
            socket.join(`role_${socket.userRole}`);

            // Load user conversations
            await this.joinUserConversations(socket);

            // Emit connection success
            socket.emit('connection:established', {
                userId: socket.userId,
                schoolId: socket.schoolId,
                userRole: socket.userRole,
                encryptionKey: socket.encryptionKey,
                timestamp: Date.now()
            });

            // Broadcast user online status
            socket.broadcast.to(`school_${socket.schoolId}`).emit('user:status', {
                userId: socket.userId,
                status: 'ONLINE',
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Connection handling error: ${error.message}`);
            socket.emit('error', { message: 'Connection setup failed' });
        }
    }

    /**
     * Handle disconnection
     * @param {Socket} socket - Socket instance
     */
    async handleDisconnect(socket) {
        try {
            logger.info(`User ${socket.userId} disconnected from WebSocket`);

            // Remove from connected users
            this.connectedUsers.delete(socket.userId);
            this.userRooms.delete(socket.userId);
            this.typingUsers.delete(socket.userId);

            // Update user status
            await this.updateUserStatus(socket.userId, 'OFFLINE');

            // Broadcast user offline status
            socket.broadcast.to(`school_${socket.schoolId}`).emit('user:status', {
                userId: socket.userId,
                status: 'OFFLINE',
                timestamp: Date.now()
            });

            // Clean up user rooms
            const userRooms = this.userRooms.get(socket.userId) || new Set();
            userRooms.forEach(room => {
                socket.leave(room);
            });

        } catch (error) {
            logger.error(`Disconnect handling error: ${error.message}`);
        }
    }

    /**
     * Join user to their conversations
     * @param {Socket} socket - Socket instance
     */
    async joinUserConversations(socket) {
        try {
            const conversations = await this.prisma.conversationParticipant.findMany({
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

    /**
     * Setup socket event handlers
     * @param {Socket} socket - Socket instance
     */
    setupSocketEventHandlers(socket) {
        // Register event handlers
        this.registerEventHandler(socket, 'message:send', this.handleMessageSend.bind(this));
        this.registerEventHandler(socket, 'typing:start', this.handleTypingStart.bind(this));
        this.registerEventHandler(socket, 'typing:stop', this.handleTypingStop.bind(this));
        this.registerEventHandler(socket, 'message:read', this.handleMessageRead.bind(this));
        this.registerEventHandler(socket, 'message:react', this.handleMessageReaction.bind(this));
        this.registerEventHandler(socket, 'poll:vote', this.handlePollVote.bind(this));
        this.registerEventHandler(socket, 'ai:request', this.handleAIRequest.bind(this));
        this.registerEventHandler(socket, 'file:upload', this.handleFileUpload.bind(this));
        this.registerEventHandler(socket, 'call:start', this.handleCallStart.bind(this));
        this.registerEventHandler(socket, 'call:end', this.handleCallEnd.bind(this));
        this.registerEventHandler(socket, 'call:signal', this.handleCallSignal.bind(this));
    }

    /**
     * Register event handler with error handling
     * @param {Socket} socket - Socket instance
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     */
    registerEventHandler(socket, event, handler) {
        socket.on(event, async (data) => {
            try {
                await handler(socket, data);
            } catch (error) {
                logger.error(`Event handler error for ${event}: ${error.message}`);
                socket.emit('error', {
                    event,
                    message: error.message,
                    timestamp: Date.now()
                });
            }
        });
    }

    /**
     * Update user status
     * @param {string} userId - User ID
     * @param {string} status - User status
     */
    async updateUserStatus(userId, status) {
        try {
            await this.prisma.user.update({
                where: { id: BigInt(userId) },
                data: {
                    status,
                    lastSeen: new Date()
                }
            });

            // Cache user status in Redis
            await this.redis.setex(`user_status:${userId}`, 300, status); // 5 minutes TTL
        } catch (error) {
            logger.error(`Error updating user status: ${error.message}`);
        }
    }

    /**
     * Get connected users count
     * @returns {number} - Number of connected users
     */
    getConnectedUsersCount() {
        return this.connectedUsers.size;
    }

    /**
     * Get connected users for a school
     * @param {string} schoolId - School ID
     * @returns {Array} - Array of connected user IDs
     */
    getConnectedUsersForSchool(schoolId) {
        const users = [];
        this.connectedUsers.forEach((socket, userId) => {
            if (socket.schoolId === schoolId) {
                users.push(userId);
            }
        });
        return users;
    }

    /**
     * Broadcast system message
     * @param {Object} message - Message object
     * @param {Array} targetUsers - Target user IDs (optional)
     */
    async broadcastSystemMessage(message, targetUsers = null) {
        try {
            const room = targetUsers ? 
                targetUsers.map(id => `user_${id}`) : 
                ['system_broadcast'];

            this.io.to(room).emit('system:message', {
                ...message,
                timestamp: Date.now(),
                type: 'SYSTEM'
            });

            // Log system message
            await createAuditLog({
                action: 'SYSTEM_MESSAGE',
                userId: 'SYSTEM',
                details: message,
                ip: 'SYSTEM'
            });

        } catch (error) {
            logger.error(`Error broadcasting system message: ${error.message}`);
        }
    }

    /**
     * Start background tasks
     */
    startBackgroundTasks() {
        // Clean up disconnected users every 5 minutes
        setInterval(() => {
            this.cleanupDisconnectedUsers();
        }, 5 * 60 * 1000);

        // Update server stats every minute
        setInterval(() => {
            this.updateServerStats();
        }, 60 * 1000);

        // Clean up expired data every 10 minutes
        setInterval(() => {
            this.cleanupExpiredData();
        }, 10 * 60 * 1000);
    }

    /**
     * Clean up disconnected users
     */
    async cleanupDisconnectedUsers() {
        try {
            const disconnectedUsers = [];
            
            this.connectedUsers.forEach((socket, userId) => {
                if (!socket.connected) {
                    disconnectedUsers.push(userId);
                }
            });

            for (const userId of disconnectedUsers) {
                await this.updateUserStatus(userId, 'OFFLINE');
                this.connectedUsers.delete(userId);
                this.userRooms.delete(userId);
                this.typingUsers.delete(userId);
            }

            if (disconnectedUsers.length > 0) {
                logger.info(`Cleaned up ${disconnectedUsers.length} disconnected users`);
            }
        } catch (error) {
            logger.error(`Error cleaning up disconnected users: ${error.message}`);
        }
    }

    /**
     * Update server stats
     */
    async updateServerStats() {
        try {
            const stats = {
                connectedUsers: this.getConnectedUsersCount(),
                timestamp: Date.now(),
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            };

            await this.redis.setex('websocket:stats', 300, JSON.stringify(stats));
        } catch (error) {
            logger.error(`Error updating server stats: ${error.message}`);
        }
    }

    /**
     * Clean up expired data
     */
    async cleanupExpiredData() {
        try {
            // Clean up expired typing indicators
            const now = Date.now();
            this.typingUsers.forEach((timestamp, userId) => {
                if (now - timestamp > 30000) { // 30 seconds
                    this.typingUsers.delete(userId);
                }
            });

            // Clean up Redis expired keys
            await this.redis.eval(`
                local keys = redis.call('keys', 'typing:*')
                for i=1,#keys do
                    local ttl = redis.call('ttl', keys[i])
                    if ttl == -1 then
                        redis.call('expire', keys[i], 30)
                    end
                end
            `, 0);

        } catch (error) {
            logger.error(`Error cleaning up expired data: ${error.message}`);
        }
    }

    /**
     * Get server instance
     * @returns {Server} - Socket.IO server instance
     */
    getServer() {
        return this.io;
    }

    /**
     * Get Redis instance
     * @returns {Redis} - Redis instance
     */
    getRedis() {
        return this.redis;
    }

    /**
     * Get Prisma instance
     * @returns {PrismaClient} - Prisma client instance
     */
    getPrisma() {
        return this.prisma;
    }
}

export default WebSocketManager; 
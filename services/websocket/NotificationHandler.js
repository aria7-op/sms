import logger from '../../config/logger.js';

class NotificationHandler {
    constructor(manager) {
        this.manager = manager;
        this.io = manager.getServer();
    }

    /**
     * Handle user connection and join appropriate rooms
     */
    handleUserConnection(socket, userData) {
        try {
            const { userId, schoolId, ownerId, role } = userData;
            
            // Join user-specific room
            socket.join(`user_${userId}`);
            
            // Join school room if user belongs to a school
            if (schoolId) {
                socket.join(`school_${schoolId}`);
                logger.info(`User ${userId} joined school room ${schoolId}`);
            }
            
            // Join owner room if user belongs to an owner
            if (ownerId) {
                socket.join(`owner_${ownerId}`);
                logger.info(`User ${userId} joined owner room ${ownerId}`);
            }
            
            // Join role-based room
            if (role) {
                socket.join(`role_${role}`);
                logger.info(`User ${userId} joined role room ${role}`);
            }
            
            // Store user data in socket for later use
            socket.userData = userData;
            
            logger.info(`User ${userId} connected and joined rooms successfully`);
        } catch (error) {
            logger.error(`Error handling user connection: ${error.message}`);
        }
    }

    /**
     * Handle user disconnection
     */
    handleUserDisconnection(socket) {
        try {
            if (socket.userData) {
                const { userId } = socket.userData;
                logger.info(`User ${userId} disconnected`);
                
                // Leave all rooms
                socket.leaveAll();
            }
        } catch (error) {
            logger.error(`Error handling user disconnection: ${error.message}`);
        }
    }

    /**
     * Send notification to specific user
     */
    sendNotificationToUser(userId, notification) {
        try {
            this.io.to(`user_${userId}`).emit('notification:new', notification);
            logger.info(`Notification sent to user ${userId}: ${notification.title}`);
        } catch (error) {
            logger.error(`Error sending notification to user ${userId}: ${error.message}`);
        }
    }

    /**
     * Send notification to school
     */
    sendNotificationToSchool(schoolId, notification) {
        try {
            this.io.to(`school_${schoolId}`).emit('notification:new', notification);
            logger.info(`Notification sent to school ${schoolId}: ${notification.title}`);
        } catch (error) {
            logger.error(`Error sending notification to school ${schoolId}: ${error.message}`);
        }
    }

    /**
     * Send notification to owner
     */
    sendNotificationToOwner(ownerId, notification) {
        try {
            this.io.to(`owner_${ownerId}`).emit('notification:new', notification);
            logger.info(`Notification sent to owner ${ownerId}: ${notification.title}`);
        } catch (error) {
            logger.error(`Error sending notification to owner ${ownerId}: ${error.message}`);
        }
    }

    /**
     * Send notification to role
     */
    sendNotificationToRole(role, notification) {
        try {
            this.io.to(`role_${role}`).emit('notification:new', notification);
            logger.info(`Notification sent to role ${role}: ${notification.title}`);
        } catch (error) {
            logger.error(`Error sending notification to role ${role}: ${error.message}`);
        }
    }

    /**
     * Broadcast notification to all connected users
     */
    broadcastNotification(notification) {
        try {
            this.io.emit('notification:new', notification);
            logger.info(`Notification broadcasted to all users: ${notification.title}`);
        } catch (error) {
            logger.error(`Error broadcasting notification: ${error.message}`);
        }
    }

    /**
     * Send notification count update to user
     */
    sendNotificationCountUpdate(userId, count) {
        try {
            this.io.to(`user_${userId}`).emit('notification:count', { count });
            logger.info(`Notification count update sent to user ${userId}: ${count}`);
        } catch (error) {
            logger.error(`Error sending notification count to user ${userId}: ${error.message}`);
        }
    }

    /**
     * Handle notification read event
     */
    handleNotificationRead(socket, data) {
        try {
            const { notificationId, userId } = data;
            
            // Broadcast read status to other users in the same room
            socket.broadcast.emit('notification:read', {
                notificationId,
                userId,
                readAt: new Date()
            });
            
            logger.info(`User ${userId} marked notification ${notificationId} as read`);
        } catch (error) {
            logger.error(`Error handling notification read: ${error.message}`);
        }
    }

    /**
     * Handle notification delete event
     */
    handleNotificationDelete(socket, data) {
        try {
            const { notificationId, userId } = data;
            
            // Broadcast delete status to other users in the same room
            socket.broadcast.emit('notification:deleted', {
                notificationId,
                userId,
                deletedAt: new Date()
            });
            
            logger.info(`User ${userId} deleted notification ${notificationId}`);
        } catch (error) {
            logger.error(`Error handling notification delete: ${error.message}`);
        }
    }

    /**
     * Get online users count for a room
     */
    getOnlineUsersCount(room) {
        try {
            const roomSockets = this.io.sockets.adapter.rooms.get(room);
            return roomSockets ? roomSockets.size : 0;
        } catch (error) {
            logger.error(`Error getting online users count for room ${room}: ${error.message}`);
            return 0;
        }
    }

    /**
     * Get all online users for a room
     */
    getOnlineUsers(room) {
        try {
            const roomSockets = this.io.sockets.adapter.rooms.get(room);
            if (!roomSockets) return [];
            
            const users = [];
            roomSockets.forEach(socketId => {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket && socket.userData) {
                    users.push(socket.userData);
                }
            });
            
            return users;
        } catch (error) {
            logger.error(`Error getting online users for room ${room}: ${error.message}`);
            return [];
        }
    }

    /**
     * Send typing indicator
     */
    sendTypingIndicator(room, userData, isTyping) {
        try {
            this.io.to(room).emit('typing:indicator', {
                userId: userData.userId,
                userName: `${userData.firstName} ${userData.lastName}`,
                isTyping,
                timestamp: new Date()
            });
        } catch (error) {
            logger.error(`Error sending typing indicator: ${error.message}`);
        }
    }

    /**
     * Send user status update
     */
    sendUserStatusUpdate(userId, status) {
        try {
            this.io.emit('user:status', {
                userId,
                status,
                timestamp: new Date()
            });
            logger.info(`User status update sent for user ${userId}: ${status}`);
        } catch (error) {
            logger.error(`Error sending user status update: ${error.message}`);
        }
    }
}

export default NotificationHandler; 

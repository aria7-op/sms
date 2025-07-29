import express from 'express';
const router = express.Router();
import MessageController from '../controllers/messageController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import { validateRequest } from '../middleware/validation.js';

const messageController = new MessageController();

// Function to set WebSocket service in message controller
export const setWebSocketService = (websocketService) => {
    messageController.setWebSocketService(websocketService);
};

// Apply rate limiting to all message routes
router.use(rateLimiter);

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/messages
 * @desc    Create new message with role-based permissions
 * @access  Private (All authenticated users with role-based restrictions)
 */
router.post('/', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.createMessage(req, res);
    }
);

/**
 * @route   POST /api/messages/group
 * @desc    Create group message (broadcast to multiple users)
 * @access  Private (OWNER, ADMIN, TEACHER)
 */
router.post('/group', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
    async (req, res) => {
        await messageController.createGroupMessage(req, res);
    }
);

/**
 * @route   POST /api/messages/broadcast
 * @desc    Create role-based broadcast message
 * @access  Private (OWNER, ADMIN)
 */
router.post('/broadcast', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
    async (req, res) => {
        await messageController.createRoleBroadcast(req, res);
    }
);

/**
 * @route   GET /api/messages
 * @desc    Get all messages with filtering and pagination
 * @access  Private (ADMIN, OWNER)
 */
router.get('/', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
    async (req, res) => {
        await messageController.getAllMessages(req, res);
    }
);

/**
 * @route   GET /api/messages/role-based
 * @desc    Get messages by role-based filters
 * @access  Private (All authenticated users)
 */
router.get('/role-based', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getMessagesByRole(req, res);
    }
);

/**
 * @route   GET /api/messages/category/:category
 * @desc    Get messages by category
 * @access  Private (All authenticated users)
 */
router.get('/category/:category', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getMessagesByCategory(req, res);
    }
);

/**
 * @route   GET /api/messages/priority/:priority
 * @desc    Get messages by priority
 * @access  Private (All authenticated users)
 */
router.get('/priority/:priority', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getMessagesByPriority(req, res);
    }
);

/**
 * @route   GET /api/messages/type/:type
 * @desc    Get messages by type
 * @access  Private (All authenticated users)
 */
router.get('/type/:type', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getMessagesByType(req, res);
    }
);

/**
 * @route   GET /api/messages/from-role/:role
 * @desc    Get messages from specific role to current user
 * @access  Private (All authenticated users)
 */
router.get('/from-role/:role', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getMessagesFromRole(req, res);
    }
);

/**
 * @route   GET /api/messages/to-role/:role
 * @desc    Get messages to specific role from current user
 * @access  Private (All authenticated users)
 */
router.get('/to-role/:role', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getMessagesToRole(req, res);
    }
);

/**
 * @route   GET /api/messages/inbox
 * @desc    Get inbox messages for current user
 * @access  Private (All authenticated users)
 */
router.get('/inbox', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getInbox(req, res);
    }
);

/**
 * @route   GET /api/messages/sent
 * @desc    Get sent messages for current user
 * @access  Private (All authenticated users)
 */
router.get('/sent', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getSent(req, res);
    }
);

/**
 * @route   GET /api/messages/unread
 * @desc    Get unread messages for current user
 * @access  Private (All authenticated users)
 */
router.get('/unread', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getUnreadMessages(req, res);
    }
);

/**
 * @route   GET /api/messages/unread/count
 * @desc    Get unread message count for current user
 * @access  Private (All authenticated users)
 */
router.get('/unread/count', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getUnreadCount(req, res);
    }
);

/**
 * @route   GET /api/messages/search
 * @desc    Search messages
 * @access  Private (All authenticated users)
 */
router.get('/search', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.searchMessages(req, res);
    }
);

/**
 * @route   GET /api/messages/conversation/:userId
 * @desc    Get conversation between current user and another user
 * @access  Private (All authenticated users)
 */
router.get('/conversation/:userId', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getConversation(req, res);
    }
);

/**
 * @route   GET /api/messages/sender/:senderId
 * @desc    Get messages by sender
 * @access  Private (ADMIN, OWNER)
 */
router.get('/sender/:senderId', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
    async (req, res) => {
        await messageController.getMessagesBySender(req, res);
    }
);

/**
 * @route   GET /api/messages/receiver/:receiverId
 * @desc    Get messages by receiver
 * @access  Private (ADMIN, OWNER)
 */
router.get('/receiver/:receiverId', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
    async (req, res) => {
        await messageController.getMessagesByReceiver(req, res);
    }
);

/**
 * @route   GET /api/messages/statistics
 * @desc    Get message statistics for current user
 * @access  Private (All authenticated users)
 */
router.get('/statistics', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getMessageStatistics(req, res);
    }
);

/**
 * @route   GET /api/messages/analytics
 * @desc    Get message analytics for school
 * @access  Private (ADMIN, OWNER)
 */
router.get('/analytics', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
    async (req, res) => {
        await messageController.getMessageAnalytics(req, res);
    }
);

/**
 * @route   GET /api/messages/:id
 * @desc    Get message by ID
 * @access  Private (Message sender/receiver, ADMIN, OWNER)
 */
router.get('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.getMessageById(req, res);
    }
);

/**
 * @route   PUT /api/messages/:id
 * @desc    Update message
 * @access  Private (Message sender only)
 */
router.put('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.updateMessage(req, res);
    }
);

/**
 * @route   PATCH /api/messages/:id/read
 * @desc    Mark message as read
 * @access  Private (Message receiver only)
 */
router.patch('/:id/read', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.markAsRead(req, res);
    }
);

/**
 * @route   PATCH /api/messages/:id/unread
 * @desc    Mark message as unread
 * @access  Private (Message receiver only)
 */
router.patch('/:id/unread', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.markAsUnread(req, res);
    }
);

/**
 * @route   DELETE /api/messages/:id
 * @desc    Delete message
 * @access  Private (Message sender/receiver, ADMIN, OWNER)
 */
router.delete('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.deleteMessage(req, res);
    }
);

/**
 * @route   POST /api/messages/bulk/read
 * @desc    Bulk mark messages as read
 * @access  Private (All authenticated users)
 */
router.post('/bulk/read', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await messageController.bulkMarkAsRead(req, res);
    }
);

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Message route error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error in message routes'
    });
});

export default router;
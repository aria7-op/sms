import express from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import conversationController from '../controllers/conversationController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ======================
// CONVERSATION MANAGEMENT
// ======================

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation
 * @access  Private (All authenticated users)
 */
router.post('/', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.createConversation(req, res);
    }
);

/**
 * @route   GET /api/conversations/:id
 * @desc    Get conversation by ID
 * @access  Private (Conversation participants)
 */
router.get('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.getConversationById(req, res);
    }
);

/**
 * @route   GET /api/conversations
 * @desc    Get user's conversations
 * @access  Private (All authenticated users)
 */
router.get('/', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.getUserConversations(req, res);
    }
);

/**
 * @route   PUT /api/conversations/:id
 * @desc    Update conversation
 * @access  Private (Conversation admin/moderator)
 */
router.put('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.updateConversation(req, res);
    }
);

/**
 * @route   POST /api/conversations/:id/participants
 * @desc    Add participants to conversation
 * @access  Private (Conversation admin/moderator)
 */
router.post('/:id/participants', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.addParticipants(req, res);
    }
);

/**
 * @route   DELETE /api/conversations/:id/participants/:userId
 * @desc    Remove participant from conversation
 * @access  Private (Conversation admin/moderator)
 */
router.delete('/:id/participants/:userId', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.removeParticipant(req, res);
    }
);

/**
 * @route   POST /api/conversations/:id/leave
 * @desc    Leave conversation
 * @access  Private (Conversation participants)
 */
router.post('/:id/leave', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.leaveConversation(req, res);
    }
);

/**
 * @route   POST /api/conversations/:id/archive
 * @desc    Archive conversation
 * @access  Private (Conversation participants)
 */
router.post('/:id/archive', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.archiveConversation(req, res);
    }
);

/**
 * @route   POST /api/conversations/:id/unarchive
 * @desc    Unarchive conversation
 * @access  Private (Conversation participants)
 */
router.post('/:id/unarchive', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.unarchiveConversation(req, res);
    }
);

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Delete conversation
 * @access  Private (Conversation admin/moderator)
 */
router.delete('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.deleteConversation(req, res);
    }
);

// ======================
// MESSAGE MANAGEMENT
// ======================

/**
 * @route   POST /api/conversations/:id/messages
 * @desc    Send message to conversation
 * @access  Private (Conversation participants)
 */
router.post('/:id/messages', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.sendMessage(req, res);
    }
);

/**
 * @route   GET /api/conversations/:id/messages
 * @desc    Get conversation messages
 * @access  Private (Conversation participants)
 */
router.get('/:id/messages', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.getConversationMessages(req, res);
    }
);

// ======================
// MESSAGE REACTIONS
// ======================

/**
 * @route   POST /api/conversations/:id/messages/:messageId/reactions
 * @desc    Add reaction to message
 * @access  Private (Conversation participants)
 */
router.post('/:id/messages/:messageId/reactions', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.addReaction(req, res);
    }
);

/**
 * @route   DELETE /api/conversations/:id/messages/:messageId/reactions/:reaction
 * @desc    Remove reaction from message
 * @access  Private (Conversation participants)
 */
router.delete('/:id/messages/:messageId/reactions/:reaction', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.removeReaction(req, res);
    }
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   POST /api/conversations/:id/websocket-token
 * @desc    Generate WebSocket token for real-time messaging
 * @access  Private (Conversation participants)
 */
router.post('/:id/websocket-token', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.generateWebSocketToken(req, res);
    }
);

/**
 * @route   GET /api/conversations/:id/analytics
 * @desc    Get conversation analytics
 * @access  Private (Conversation admin/moderator)
 */
router.get('/:id/analytics', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF']),
    async (req, res) => {
        await conversationController.getConversationAnalytics(req, res);
    }
);

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Conversation route error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error in conversation routes'
    });
});

export default router; 
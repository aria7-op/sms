import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ======================
// NOTIFICATION ROUTES
// ======================

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications with advanced filtering and pagination
 * @access  Private
 */
router.get('/', authenticateToken, notificationController.getAllNotifications);

/**
 * @route   GET /api/notifications/:id
 * @desc    Get notification by ID with full details
 * @access  Private
 */
router.get('/:id', authenticateToken, notificationController.getNotificationById);

/**
 * @route   POST /api/notifications
 * @desc    Create a new notification
 * @access  Private
 */
router.post('/', authenticateToken, notificationController.createNotificationHandler);

/**
 * @route   PUT /api/notifications/:id
 * @desc    Update notification
 * @access  Private
 */
router.put('/:id', authenticateToken, notificationController.updateNotification);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete notification
 * @access  Private
 */
router.delete('/:id', authenticateToken, notificationController.deleteNotificationHandler);

// ======================
// USER NOTIFICATION ROUTES
// ======================

/**
 * @route   GET /api/notifications/user/me
 * @desc    Get current user's notifications
 * @access  Private
 */
router.get('/user/me', authenticateToken, notificationController.getUserNotificationsHandler);

/**
 * @route   POST /api/notifications/mark-read
 * @desc    Mark notifications as read
 * @access  Private
 */
router.post('/mark-read', authenticateToken, notificationController.markNotificationAsReadHandler);

/**
 * @route   PUT /api/notifications/:id/status
 * @desc    Update notification status
 * @access  Private
 */
router.put('/:id/status', authenticateToken, notificationController.updateNotificationStatus);

// ======================
// BULK NOTIFICATION ROUTES
// ======================

/**
 * @route   POST /api/notifications/bulk
 * @desc    Send notification to multiple recipients
 * @access  Private
 */
router.post('/bulk', authenticateToken, notificationController.sendBulkNotification);

// ======================
// STATISTICS ROUTES
// ======================

/**
 * @route   GET /api/notifications/stats
 * @desc    Get notification statistics
 * @access  Private
 */
router.get('/stats', authenticateToken, notificationController.getNotificationStatsHandler);

// ======================
// TEMPLATE ROUTES
// ======================

/**
 * @route   GET /api/notifications/templates
 * @desc    Get notification templates
 * @access  Private
 */
router.get('/templates', authenticateToken, notificationController.getNotificationTemplatesHandler);

// ======================
// REAL-TIME NOTIFICATION ROUTES
// ======================

/**
 * @route   GET /api/notifications/unread/count
 * @desc    Get unread notification count for current user
 * @access  Private
 */
router.get('/unread/count', authenticateToken, notificationController.getUnreadCount);

/**
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark single notification as read
 * @access  Private
 */
router.put('/:id/read', authenticateToken, notificationController.markSingleNotificationAsRead);

/**
 * @route   GET /api/notifications/realtime
 * @desc    Get notifications for real-time updates
 * @access  Private
 */
router.get('/realtime', authenticateToken, notificationController.getRealtimeNotifications);

// ======================
// SYSTEM OPERATION NOTIFICATION ROUTES
// ======================

/**
 * @route   POST /api/notifications/student
 * @desc    Create student operation notification
 * @access  Private
 */
router.post('/student', authenticateToken, notificationController.createStudentNotificationHandler);

/**
 * @route   POST /api/notifications/attendance
 * @desc    Create attendance operation notification
 * @access  Private
 */
router.post('/attendance', authenticateToken, notificationController.createAttendanceNotificationHandler);

/**
 * @route   POST /api/notifications/payment
 * @desc    Create payment operation notification
 * @access  Private
 */
router.post('/payment', authenticateToken, notificationController.createPaymentNotificationHandler);

/**
 * @route   POST /api/notifications/user
 * @desc    Create user operation notification
 * @access  Private
 */
router.post('/user', authenticateToken, notificationController.createUserNotificationHandler);

/**
 * @route   POST /api/notifications/system
 * @desc    Create system notification
 * @access  Private
 */
router.post('/system', authenticateToken, notificationController.createSystemNotificationHandler);

/**
 * @route   POST /api/notifications/customer
 * @desc    Create customer operation notification
 * @access  Private
 */
router.post('/customer', authenticateToken, notificationController.createCustomerNotificationHandler);

/**
 * @route   POST /api/notifications/inventory
 * @desc    Create inventory operation notification
 * @access  Private
 */
router.post('/inventory', authenticateToken, notificationController.createInventoryNotificationHandler);

export default router; 

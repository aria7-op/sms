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

/**
 * @route   POST /api/notifications/templates/process
 * @desc    Process notification template with data
 * @access  Private
 */
router.post('/templates/process', authenticateToken, notificationController.processNotificationTemplateHandler);

// ======================
// DELIVERY CHANNEL ROUTES
// ======================

/**
 * @route   POST /api/notifications/email
 * @desc    Send email notification
 * @access  Private
 */
router.post('/email', authenticateToken, notificationController.sendEmailNotificationHandler);

/**
 * @route   POST /api/notifications/push
 * @desc    Send push notification
 * @access  Private
 */
router.post('/push', authenticateToken, notificationController.sendPushNotificationHandler);

/**
 * @route   POST /api/notifications/sms
 * @desc    Send SMS notification
 * @access  Private
 */
router.post('/sms', authenticateToken, notificationController.sendSMSNotificationHandler);

// ======================
// PREFERENCES ROUTES
// ======================

/**
 * @route   GET /api/notifications/preferences
 * @desc    Get user notification preferences
 * @access  Private
 */
router.get('/preferences', authenticateToken, notificationController.getNotificationPreferences);

/**
 * @route   PUT /api/notifications/preferences
 * @desc    Update user notification preferences
 * @access  Private
 */
router.put('/preferences', authenticateToken, notificationController.updateNotificationPreferences);

// ======================
// RULES ROUTES
// ======================

/**
 * @route   GET /api/notifications/rules
 * @desc    Get notification rules
 * @access  Private
 */
router.get('/rules', authenticateToken, notificationController.getNotificationRules);

/**
 * @route   POST /api/notifications/rules
 * @desc    Create notification rule
 * @access  Private
 */
router.post('/rules', authenticateToken, notificationController.createNotificationRule);

// ======================
// SCHEDULES ROUTES
// ======================

/**
 * @route   GET /api/notifications/schedules
 * @desc    Get notification schedules
 * @access  Private
 */
router.get('/schedules', authenticateToken, notificationController.getNotificationSchedules);

/**
 * @route   POST /api/notifications/schedules
 * @desc    Create notification schedule
 * @access  Private
 */
router.post('/schedules', authenticateToken, notificationController.createNotificationSchedule);

// ======================
// MAINTENANCE ROUTES
// ======================

/**
 * @route   POST /api/notifications/cleanup
 * @desc    Clean up old notifications
 * @access  Private (Admin only)
 */

export default router; 
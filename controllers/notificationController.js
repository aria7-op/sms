import { PrismaClient } from '../generated/prisma/index.js';
import { 
  createNotification, 
  getUserNotifications, 
  markNotificationAsRead, 
  deleteNotification, 
  sendEmailNotification, 
  sendBulkEmailNotifications, 
  sendPushNotification, 
  sendSMSNotification, 
  getNotificationTemplates, 
  processNotificationTemplate, 
  getNotificationStats,
  getUnreadNotificationCount,
  createStudentNotification,
  createAttendanceNotification,
  createPaymentNotification,
  createUserNotification,
  createSystemNotification,
  createCustomerNotification,
  createInventoryNotification
} from '../services/notificationService.js';
import { createAuditLog } from '../services/notificationService.js';
import { formatNotificationResponse, buildNotificationIncludeQuery, buildNotificationSearchQuery, validateNotificationData } from '../utils/notifications.js';

const prisma = new PrismaClient();

// ======================
// NOTIFICATION CONTROLLER
// ======================

/**
 * Get all notifications with advanced filtering and pagination
 */
export const getAllNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      priority,
      status,
      schoolId,
      ownerId,
      senderId,
      entityType,
      entityId,
      startDate,
      endDate,
      search,
      include,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const userId = req.user?.id;
    const userSchoolId = req.user?.schoolId;
    const userOwnerId = req.user?.createdByOwnerId;

    // Build search query
    const searchQuery = buildNotificationSearchQuery({
      type,
      priority,
      status,
      schoolId: schoolId || userSchoolId,
      ownerId: ownerId || userOwnerId,
      senderId,
      entityType,
      entityId,
      startDate,
      endDate,
      search
    }, userId, userSchoolId);

    // Build include query
    const includeQuery = buildNotificationIncludeQuery(include);

    // Get total count
    const totalCount = await prisma.notification.count({
      where: searchQuery
    });

    // Get notifications with pagination
    const notifications = await prisma.notification.findMany({
      where: searchQuery,
      include: includeQuery,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    });

    // Format responses
    const formattedNotifications = notifications.map(notification => 
      formatNotificationResponse(notification, { minimal: false })
    );

    res.json({
      success: true,
      data: formattedNotifications,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications',
      message: error.message
    });
  }
};

/**
 * Get notification by ID with full details
 */
export const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const notification = await prisma.notification.findUnique({
      where: { id: BigInt(id) },
      include: {
        recipients: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true
              }
            }
          }
        },
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        attachments: true
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Check if user has access to this notification
    const hasAccess = notification.recipients.some(recipient => 
      recipient.userId.toString() === userId
    ) || notification.senderId?.toString() === userId;

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this notification'
      });
    }

    const formattedNotification = formatNotificationResponse(notification, { minimal: false });

    res.json({
      success: true,
      data: formattedNotification
    });
  } catch (error) {
    console.error('Error getting notification by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification',
      message: error.message
    });
  }
};

/**
 * Create a new notification
 */
export const createNotificationHandler = async (req, res) => {
  try {
    const notificationData = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    // Validate notification data
    const validation = validateNotificationData(notificationData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid notification data',
        details: validation.errors
      });
    }

    // Add sender and school/owner information
    const enrichedData = {
      ...notificationData,
      senderId: userId,
      schoolId: schoolId || notificationData.schoolId,
      ownerId: ownerId || notificationData.ownerId
    };

    const notification = await createNotification(enrichedData);

    // Create audit log
    await createAuditLog({
      action: 'CREATE',
      entity: 'Notification',
      entityId: notification.id,
      userId,
      schoolId,
      ownerId,
      newData: JSON.stringify(notification),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: formatNotificationResponse(notification, { minimal: true })
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification',
      message: error.message
    });
  }
};

/**
 * Update notification
 */
export const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user?.id;

    // Check if notification exists and user has permission
    const existingNotification = await prisma.notification.findUnique({
      where: { id: BigInt(id) },
      include: { recipients: true }
    });

    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Check permissions
    const hasPermission = existingNotification.senderId?.toString() === userId ||
                         req.user?.role === 'SCHOOL_ADMIN' ||
                         req.user?.role === 'SUPER_ADMIN';

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied to update this notification'
      });
    }

    // Update notification
    const updatedNotification = await prisma.notification.update({
      where: { id: BigInt(id) },
      data: updateData
    });

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entity: 'Notification',
      entityId: id,
      userId,
      schoolId: req.user?.schoolId,
      ownerId: req.user?.createdByOwnerId,
      oldData: JSON.stringify(existingNotification),
      newData: JSON.stringify(updatedNotification),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Notification updated successfully',
      data: formatNotificationResponse(updatedNotification, { minimal: true })
    });
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification',
      message: error.message
    });
  }
};

/**
 * Delete notification
 */
export const deleteNotificationHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Check if notification exists and user has permission
    const existingNotification = await prisma.notification.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Check permissions
    const hasPermission = existingNotification.senderId?.toString() === userId ||
                         req.user?.role === 'SCHOOL_ADMIN' ||
                         req.user?.role === 'SUPER_ADMIN';

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Permission denied to delete this notification'
      });
    }

    // Soft delete notification
    await prisma.notification.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() }
    });

    // Create audit log
    await createAuditLog({
      action: 'DELETE',
      entity: 'Notification',
      entityId: id,
      userId,
      schoolId: req.user?.schoolId,
      ownerId: req.user?.createdByOwnerId,
      oldData: JSON.stringify(existingNotification),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification',
      message: error.message
    });
  }
};

// ======================
// USER NOTIFICATION ROUTES
// ======================

/**
 * Get current user's notifications
 */
export const getUserNotificationsHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      page = 1,
      limit = 20,
      type,
      priority,
      status,
      include
    } = req.query;

    const filters = {
      type,
      priority,
      status,
      page: parseInt(page),
      limit: parseInt(limit),
      include
    };

    const result = await getUserNotifications(userId, filters);

    res.json({
      success: true,
      data: result.data.map(notification => 
        formatNotificationResponse(notification, { minimal: true })
      ),
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error getting user notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user notifications',
      message: error.message
    });
  }
};

/**
 * Mark notifications as read
 */
export const markNotificationAsReadHandler = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user?.id;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        error: 'Notification IDs array is required'
      });
    }

    const result = await markNotificationAsRead(notificationIds, userId);

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notifications as read',
      message: error.message
    });
  }
};

/**
 * Update notification status
 */
export const updateNotificationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user?.id;

    // Check if notification exists
    const existingNotification = await prisma.notification.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Update status
    const updatedNotification = await prisma.notification.update({
      where: { id: BigInt(id) },
      data: { status }
    });

    res.json({
      success: true,
      message: 'Notification status updated successfully',
      data: formatNotificationResponse(updatedNotification, { minimal: true })
    });
  } catch (error) {
    console.error('Error updating notification status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification status',
      message: error.message
    });
  }
};

// ======================
// BULK NOTIFICATION ROUTES
// ======================

/**
 * Send notification to multiple recipients
 */
export const sendBulkNotification = async (req, res) => {
  try {
    const { recipients, notificationData } = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients array is required and must not be empty'
      });
    }

    if (!notificationData || !notificationData.title || !notificationData.message) {
      return res.status(400).json({
        success: false,
        error: 'Notification title and message are required'
      });
    }

    const notifications = [];
    const errors = [];

    // Create notifications for each recipient
    for (const recipientId of recipients) {
      try {
        const notification = await createNotification({
          ...notificationData,
          recipients: [recipientId],
          senderId: userId,
          schoolId: schoolId || notificationData.schoolId,
          ownerId: ownerId || notificationData.ownerId
        });
        notifications.push(notification);
      } catch (error) {
        errors.push({
          recipientId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk notification sent: ${notifications.length} successful, ${errors.length} failed`,
      data: {
        successful: notifications.length,
        failed: errors.length,
        notifications: notifications.map(n => formatNotificationResponse(n, { minimal: true })),
        errors
      }
    });
  } catch (error) {
    console.error('Error sending bulk notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send bulk notification',
      message: error.message
    });
  }
};

// ======================
// STATISTICS ROUTES
// ======================

/**
 * Get notification statistics
 */
export const getNotificationStatsHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const period = req.query.period || '30d';

    const stats = await getNotificationStats(schoolId, userId, period);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting notification stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification statistics',
      message: error.message
    });
  }
};

// ======================
// TEMPLATE ROUTES
// ======================

/**
 * Get notification templates
 */
export const getNotificationTemplatesHandler = async (req, res) => {
  try {
    const templates = await getNotificationTemplates();

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error getting notification templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification templates',
      message: error.message
    });
  }
};

// ======================
// REAL-TIME NOTIFICATION ROUTES
// ======================

/**
 * Get unread notification count for current user
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user?.id;
    const count = await getUnreadNotificationCount(userId);

    res.json({
      success: true,
      data: { count }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count',
      message: error.message
    });
  }
};

/**
 * Mark single notification as read
 */
export const markSingleNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const result = await markNotificationAsRead([id], userId);

    res.json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read',
      message: error.message
    });
  }
};

/**
 * Get notifications for real-time updates
 */
export const getRealtimeNotifications = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 10 } = req.query;

    const result = await getUserNotifications(userId, {
      page: 1,
      limit: parseInt(limit),
      include: 'minimal'
    });

    res.json({
      success: true,
      data: result.data.map(notification => 
        formatNotificationResponse(notification, { minimal: true })
      ),
      hasMore: result.pagination.total > result.data.length
    });
  } catch (error) {
    console.error('Error getting realtime notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get realtime notifications',
      message: error.message
    });
  }
};

// ======================
// SYSTEM OPERATION NOTIFICATION ROUTES
// ======================

/**
 * Create student operation notification
 */
export const createStudentNotificationHandler = async (req, res) => {
  try {
    const { operation, studentData, additionalData } = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!operation || !studentData) {
      return res.status(400).json({
        success: false,
        error: 'Operation and student data are required'
      });
    }

    const notification = await createStudentNotification(
      operation,
      studentData,
      userId,
      schoolId,
      ownerId,
      additionalData
    );

    if (!notification) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create student notification'
      });
    }

    res.json({
      success: true,
      message: 'Student notification created successfully',
      data: formatNotificationResponse(notification, { minimal: true })
    });
  } catch (error) {
    console.error('Error creating student notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create student notification',
      message: error.message
    });
  }
};

/**
 * Create attendance operation notification
 */
export const createAttendanceNotificationHandler = async (req, res) => {
  try {
    const { operation, attendanceData } = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!operation || !attendanceData) {
      return res.status(400).json({
        success: false,
        error: 'Operation and attendance data are required'
      });
    }

    const notification = await createAttendanceNotification(
      operation,
      attendanceData,
      userId,
      schoolId,
      ownerId
    );

    if (!notification) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create attendance notification'
      });
    }

    res.json({
      success: true,
      message: 'Attendance notification created successfully',
      data: formatNotificationResponse(notification, { minimal: true })
    });
  } catch (error) {
    console.error('Error creating attendance notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create attendance notification',
      message: error.message
    });
  }
};

/**
 * Create payment operation notification
 */
export const createPaymentNotificationHandler = async (req, res) => {
  try {
    const { operation, paymentData } = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!operation || !paymentData) {
      return res.status(400).json({
        success: false,
        error: 'Operation and payment data are required'
      });
    }

    const notification = await createPaymentNotification(
      operation,
      paymentData,
      userId,
      schoolId,
      ownerId
    );

    if (!notification) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create payment notification'
      });
    }

    res.json({
      success: true,
      message: 'Payment notification created successfully',
      data: formatNotificationResponse(notification, { minimal: true })
    });
  } catch (error) {
    console.error('Error creating payment notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create payment notification',
      message: error.message
    });
  }
};

/**
 * Create user operation notification
 */
export const createUserNotificationHandler = async (req, res) => {
  try {
    const { operation, userData } = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!operation || !userData) {
      return res.status(400).json({
        success: false,
        error: 'Operation and user data are required'
      });
    }

    const notification = await createUserNotification(
      operation,
      userData,
      userId,
      schoolId,
      ownerId
    );

    if (!notification) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create user notification'
      });
    }

    res.json({
      success: true,
      message: 'User notification created successfully',
      data: formatNotificationResponse(notification, { minimal: true })
    });
  } catch (error) {
    console.error('Error creating user notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user notification',
      message: error.message
    });
  }
};

/**
 * Create system notification
 */
export const createSystemNotificationHandler = async (req, res) => {
  try {
    const { type, title, message, priority, recipients } = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        error: 'Type, title, and message are required'
      });
    }

    const notification = await createSystemNotification(
      type,
      title,
      message,
      priority,
      schoolId,
      ownerId,
      recipients
    );

    if (!notification) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create system notification'
      });
    }

    res.json({
      success: true,
      message: 'System notification created successfully',
      data: formatNotificationResponse(notification, { minimal: true })
    });
  } catch (error) {
    console.error('Error creating system notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create system notification',
      message: error.message
    });
  }
};

/**
 * Create customer operation notification
 */
export const createCustomerNotificationHandler = async (req, res) => {
  try {
    const { operation, customerData } = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!operation || !customerData) {
      return res.status(400).json({
        success: false,
        error: 'Operation and customer data are required'
      });
    }

    const notification = await createCustomerNotification(
      operation,
      customerData,
      userId,
      schoolId,
      ownerId
    );

    if (!notification) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create customer notification'
      });
    }

    res.json({
      success: true,
      message: 'Customer notification created successfully',
      data: formatNotificationResponse(notification, { minimal: true })
    });
  } catch (error) {
    console.error('Error creating customer notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create customer notification',
      message: error.message
    });
  }
};

/**
 * Create inventory operation notification
 */
export const createInventoryNotificationHandler = async (req, res) => {
  try {
    const { operation, inventoryData } = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!operation || !inventoryData) {
      return res.status(400).json({
        success: false,
        error: 'Operation and inventory data are required'
      });
    }

    const notification = await createInventoryNotification(
      operation,
      inventoryData,
      userId,
      schoolId,
      ownerId
    );

    if (!notification) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create inventory notification'
      });
    }

    res.json({
      success: true,
      message: 'Inventory notification created successfully',
      data: formatNotificationResponse(notification, { minimal: true })
    });
  } catch (error) {
    console.error('Error creating inventory notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create inventory notification',
      message: error.message
    });
  }
}; 

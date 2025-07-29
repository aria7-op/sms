import { PrismaClient } from '../generated/prisma/client.js';
import { createNotification, getUserNotifications, markNotificationAsRead, deleteNotification, sendEmailNotification, sendBulkEmailNotifications, sendPushNotification, sendSMSNotification, getNotificationTemplates, processNotificationTemplate, getNotificationStats } from '../services/notificationService.js';
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
    const { include } = req.query;

    const includeQuery = buildNotificationIncludeQuery(include);

    const notification = await prisma.notification.findUnique({
      where: { id: BigInt(id) },
      include: includeQuery
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
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

    // Create notification using service
    const result = await createNotification({
      ...notificationData,
      schoolId: notificationData.schoolId || schoolId,
      ownerId: notificationData.ownerId || ownerId,
      senderId: notificationData.senderId || userId
    });

    // Create audit log
    await createAuditLog({
      action: 'CREATE',
      entity: 'Notification',
      entityId: result.id,
      userId,
      schoolId,
      ownerId,
      newData: result,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      data: formatNotificationResponse(result, { minimal: false }),
      message: 'Notification created successfully'
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

    // Get existing notification
    const existingNotification = await prisma.notification.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Update notification
    const updatedNotification = await prisma.notification.update({
      where: { id: BigInt(id) },
      data: {
        ...updateData,
        updatedBy: userId
      },
      include: buildNotificationIncludeQuery()
    });

    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entity: 'Notification',
      entityId: id,
      userId,
      schoolId: existingNotification.schoolId,
      ownerId: existingNotification.ownerId,
      oldData: existingNotification,
      newData: updatedNotification,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: formatNotificationResponse(updatedNotification, { minimal: false }),
      message: 'Notification updated successfully'
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

    // Get existing notification
    const existingNotification = await prisma.notification.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingNotification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Delete notification
    await prisma.notification.delete({
      where: { id: BigInt(id) }
    });

    // Create audit log
    await createAuditLog({
      action: 'DELETE',
      entity: 'Notification',
      entityId: id,
      userId,
      schoolId: existingNotification.schoolId,
      ownerId: existingNotification.ownerId,
      oldData: existingNotification,
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

/**
 * Get user's notifications
 */
export const getUserNotificationsHandler = async (req, res) => {
  try {
    const userId = req.user?.id;
    const {
      page = 1,
      limit = 20,
      status,
      type,
      priority,
      include,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filters = {
      status,
      type,
      priority
    };

    const result = await getUserNotifications(userId, filters);

    // Format responses
    const formattedNotifications = result.data.map(notification => 
      formatNotificationResponse(notification, { minimal: false })
    );

    res.json({
      success: true,
      data: formattedNotifications,
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
 * Mark notification as read
 */
export const markNotificationAsReadHandler = async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user?.id;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({
        success: false,
        error: 'Notification IDs are required'
      });
    }

    const result = await markNotificationAsRead(notificationIds, userId);

    res.json({
      success: true,
      data: result,
      message: 'Notifications marked as read successfully'
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

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required'
      });
    }

    // Get existing notification
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
      data: {
        status,
        updatedBy: userId,
        ...(status === 'READ' && { readAt: new Date() }),
        ...(status === 'ARCHIVED' && { archivedAt: new Date() })
      }
    });

    // Create audit log
    await createAuditLog({
      action: 'STATUS_UPDATE',
      entity: 'Notification',
      entityId: id,
      userId,
      schoolId: existingNotification.schoolId,
      ownerId: existingNotification.ownerId,
      oldData: { status: existingNotification.status },
      newData: { status },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: formatNotificationResponse(updatedNotification, { minimal: false }),
      message: 'Notification status updated successfully'
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

/**
 * Send notification to multiple recipients
 */
export const sendBulkNotification = async (req, res) => {
  try {
    const {
      recipients,
      type,
      title,
      message,
      priority = 'NORMAL',
      channels = ['IN_APP'],
      scheduledAt,
      expiresAt,
      metadata
    } = req.body;

    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients are required'
      });
    }

    const notifications = [];

    // Create notifications for each recipient
    for (const recipientId of recipients) {
      const notification = await createNotification({
        type,
        title,
        message,
        priority,
        channels,
        recipients: [recipientId],
        schoolId,
        ownerId,
        senderId: userId,
        scheduledAt,
        expiresAt,
        metadata
      });

      notifications.push(notification);
    }

    res.status(201).json({
      success: true,
      data: notifications.map(n => formatNotificationResponse(n, { minimal: false })),
      message: `Notifications sent to ${recipients.length} recipients successfully`
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

/**
 * Get notification statistics
 */
export const getNotificationStatsHandler = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const schoolId = req.user?.schoolId;
    const userId = req.user?.id;

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

/**
 * Process notification template
 */
export const processNotificationTemplateHandler = async (req, res) => {
  try {
    const { templateKey, data } = req.body;

    if (!templateKey) {
      return res.status(400).json({
        success: false,
        error: 'Template key is required'
      });
    }

    const processedTemplate = await processNotificationTemplate(templateKey, data);

    res.json({
      success: true,
      data: processedTemplate
    });
  } catch (error) {
    console.error('Error processing notification template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process notification template',
      message: error.message
    });
  }
};

/**
 * Send email notification
 */
export const sendEmailNotificationHandler = async (req, res) => {
  try {
    const emailData = req.body;

    const result = await sendEmailNotification(emailData);

    res.json({
      success: true,
      data: result,
      message: 'Email notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending email notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email notification',
      message: error.message
    });
  }
};

/**
 * Send push notification
 */
export const sendPushNotificationHandler = async (req, res) => {
  try {
    const pushData = req.body;
    const result = await sendPushNotification(pushData);
    res.json({
      success: true,
      data: result,
      message: 'Push notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send push notification',
      message: error.message
    });
  }
};

/**
 * Send SMS notification
 */
export const sendSMSNotificationHandler = async (req, res) => {
  try {
    const smsData = req.body;
    const result = await sendSMSNotification(smsData);
    res.json({
      success: true,
      data: result,
      message: 'SMS notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending SMS notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send SMS notification',
      message: error.message
    });
  }
};

/**
 * Get notification preferences
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    const preferences = await prisma.notificationPreference.findMany({
      where: {
        userId: BigInt(userId),
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null
      }
    });

    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification preferences',
      message: error.message
    });
  }
};

/**
 * Update notification preferences
 */
export const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;
    const preferences = req.body;

    const updatedPreferences = [];

    for (const preference of preferences) {
      const { type, channel, isEnabled, frequency, quietHoursStart, quietHoursEnd, timezone } = preference;

      const updatedPreference = await prisma.notificationPreference.upsert({
        where: {
          userId_type_channel: {
            userId: BigInt(userId),
            type,
            channel
          }
        },
        update: {
          isEnabled,
          frequency,
          quietHoursStart,
          quietHoursEnd,
          timezone
        },
        create: {
          userId: BigInt(userId),
          schoolId: schoolId ? BigInt(schoolId) : null,
          ownerId: ownerId ? BigInt(ownerId) : null,
          type,
          channel,
          isEnabled,
          frequency,
          quietHoursStart,
          quietHoursEnd,
          timezone
        }
      });

      updatedPreferences.push(updatedPreference);
    }

    res.json({
      success: true,
      data: updatedPreferences,
      message: 'Notification preferences updated successfully'
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification preferences',
      message: error.message
    });
  }
};

/**
 * Get notification rules
 */
export const getNotificationRules = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    const rules = await prisma.notificationRule.findMany({
      where: {
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null,
        isActive: true
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error getting notification rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification rules',
      message: error.message
    });
  }
};

/**
 * Create notification rule
 */
export const createNotificationRule = async (req, res) => {
  try {
    const ruleData = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    const rule = await prisma.notificationRule.create({
      data: {
        ...ruleData,
        schoolId: ruleData.schoolId || schoolId,
        ownerId: ruleData.ownerId || ownerId,
        createdBy: userId
      }
    });

    res.status(201).json({
      success: true,
      data: rule,
      message: 'Notification rule created successfully'
    });
  } catch (error) {
    console.error('Error creating notification rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification rule',
      message: error.message
    });
  }
};

/**
 * Get notification schedules
 */
export const getNotificationSchedules = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    const schedules = await prisma.notificationSchedule.findMany({
      where: {
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null,
        isActive: true
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: schedules
    });
  } catch (error) {
    console.error('Error getting notification schedules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification schedules',
      message: error.message
    });
  }
};

/**
 * Create notification schedule
 */
export const createNotificationSchedule = async (req, res) => {
  try {
    const scheduleData = req.body;
    const userId = req.user?.id;
    const schoolId = req.user?.schoolId;
    const ownerId = req.user?.createdByOwnerId;

    const schedule = await prisma.notificationSchedule.create({
      data: {
        ...scheduleData,
        schoolId: scheduleData.schoolId || schoolId,
        ownerId: scheduleData.ownerId || ownerId,
        createdBy: userId
      }
    });

    res.status(201).json({
      success: true,
      data: schedule,
      message: 'Notification schedule created successfully'
    });
  } catch (error) {
    console.error('Error creating notification schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification schedule',
      message: error.message
    });
  }
}; 
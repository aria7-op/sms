// utils/notificationUtils.js
import { PrismaClient } from '../generated/prisma/client.js';
import { formatResponse } from './responseUtils.js';

const prisma = new PrismaClient();

// ======================
// NOTIFICATION UTILITIES
// ======================

/**
 * Builds the include query for notification relations
 * @param {string} include - Comma-separated list of relations to include
 * @returns {Object} Prisma include object
 */
export const buildNotificationIncludeQuery = (include) => {
  const includeObj = {
    sender: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        role: true
      }
    },
    recipients: {
      select: {
        id: true,
        notificationId: true,
        userId: true,
        channel: true,
        status: true,
        sentAt: true,
        deliveredAt: true,
        readAt: true,
        failedAt: true,
        errorMessage: true,
        deliveryAttempts: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
            role: true
          }
        }
      }
    },
    school: {
      select: {
        id: true,
        name: true,
        shortName: true
      }
    }
  };

  if (!include) return includeObj;

  const includes = include.split(',').map(i => i.trim());

  if (includes.includes('metadata')) {
    includeObj.metadata = true;
  }

  if (includes.includes('attachments')) {
    includeObj.attachments = {
      select: {
        id: true,
        name: true,
        url: true,
        size: true,
        type: true
      }
    };
  }

  if (includes.includes('deliveryStatus')) {
    includeObj.deliveryStatus = {
      select: {
        id: true,
        channel: true,
        status: true,
        deliveredAt: true,
        readAt: true,
        error: true
      }
    };
  }

  return includeObj;
};

/**
 * Formats notification data for consistent API responses
 * @param {Object} notification - Raw notification data from Prisma
 * @param {Object} options - Formatting options
 * @param {boolean} [options.minimal=false] - Return only essential fields
 * @returns {Object} Formatted notification response
 */
export const formatNotificationResponse = (notification, options = {}) => {
  const { minimal = false } = options;
  
  // Base response structure
  const response = {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    priority: notification.priority,
    status: notification.status,
    createdAt: notification.createdAt,
    expiresAt: notification.expiresAt
  };

  // Include additional fields unless minimal
  if (!minimal) {
    response.metadata = notification.metadata || {};
    response.actions = notification.actions || [];
    
    if (notification.sender) {
      response.sender = {
        id: notification.sender.id,
        name: `${notification.sender.firstName} ${notification.sender.lastName}`,
        email: notification.sender.email,
        role: notification.sender.role
      };
    }

    if (notification.recipients) {
      response.recipients = notification.recipients.map(recipient => ({
        id: recipient.id,
        notificationId: recipient.notificationId,
        userId: recipient.userId,
        channel: recipient.channel,
        status: recipient.status,
        sentAt: recipient.sentAt,
        deliveredAt: recipient.deliveredAt,
        readAt: recipient.readAt,
        failedAt: recipient.failedAt,
        errorMessage: recipient.errorMessage,
        deliveryAttempts: recipient.deliveryAttempts,
        metadata: recipient.metadata,
        createdAt: recipient.createdAt,
        updatedAt: recipient.updatedAt,
        user: recipient.user ? {
          id: recipient.user.id,
          name: `${recipient.user.firstName} ${recipient.user.lastName}`,
          email: recipient.user.email,
          role: recipient.user.role
        } : null
      }));
    }

    if (notification.school) {
      response.school = {
        id: notification.school.id,
        name: notification.school.name,
        shortName: notification.school.shortName
      };
    }

    if (notification.attachments) {
      response.attachments = notification.attachments.map(attachment => ({
        id: attachment.id,
        name: attachment.name,
        url: attachment.url,
        type: attachment.type
      }));
    }

    if (notification.deliveryStatus) {
      response.deliveryStatus = notification.deliveryStatus.map(status => ({
        channel: status.channel,
        status: status.status,
        deliveredAt: status.deliveredAt,
        readAt: status.readAt
      }));
    }
  }

  return response;
};

/**
 * Processes notification templates with data
 * @param {string} templateKey - Template identifier
 * @param {Object} data - Data to interpolate into template
 * @returns {Object} Processed template with title and message
 */
export const processNotificationTemplate = (templateKey, data) => {
  const templates = getNotificationTemplates();
  const template = templates[templateKey];
  
  if (!template) {
    throw new Error(`Template not found for key: ${templateKey}`);
  }

  const processed = {
    title: interpolateTemplate(template.title, data),
    message: interpolateTemplate(template.message, data)
  };

  if (template.email) {
    processed.email = {
      subject: interpolateTemplate(template.email.subject, data),
      body: template.email.template ? 
        interpolateTemplate(template.email.template, data) : 
        processed.message
    };
  }

  if (template.sms) {
    processed.sms = {
      body: template.sms.template ?
        interpolateTemplate(template.sms.template, data) :
        processed.message.substring(0, 160) // Truncate for SMS
    };
  }

  return processed;
};

/**
 * Interpolates placeholders in template strings
 * @param {string} template - Template string with placeholders
 * @param {Object} data - Data to interpolate
 * @returns {string} Interpolated string
 */
const interpolateTemplate = (template, data) => {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    return data[key.trim()] || match;
  });
};

/**
 * Gets all available notification templates
 * @returns {Object} Dictionary of notification templates
 */
export const getNotificationTemplates = () => {
  return {
    TEACHER_CREATED: {
      title: 'New Teacher Added',
      message: 'Teacher {firstName} {lastName} has been added to {schoolName}',
      email: {
        subject: 'New Teacher Registration - {schoolName}',
        template: 'teacher-created'
      },
      sms: {
        template: 'teacher-created-sms'
      }
    },
    TEACHER_UPDATED: {
      title: 'Teacher Profile Updated',
      message: 'Teacher {firstName} {lastName} profile has been updated',
      email: {
        subject: 'Teacher Profile Updated - {schoolName}',
        template: 'teacher-updated'
      }
    },
    TEACHER_DELETED: {
      title: 'Teacher Removed',
      message: 'Teacher {firstName} {lastName} has been removed from {schoolName}',
      email: {
        subject: 'Teacher Account Deactivated - {schoolName}',
        template: 'teacher-deleted'
      }
    },
    BULK_OPERATION: {
      title: 'Bulk Operation Completed',
      message: 'Bulk {operation} operation completed. {successful} successful, {failed} failed',
      email: {
        subject: 'Bulk Operation Report - {schoolName}',
        template: 'bulk-operation'
      }
    },
    PASSWORD_RESET: {
      title: 'Password Reset Request',
      message: 'You requested a password reset. Use code {code} to reset your password.',
      email: {
        subject: 'Password Reset - {schoolName}',
        template: 'password-reset'
      },
      sms: {
        template: 'Your password reset code is {code}'
      }
    },
    ACCOUNT_ACTIVATION: {
      title: 'Account Activation',
      message: 'Welcome to {schoolName}! Click the link to activate your account: {activationLink}',
      email: {
        subject: 'Activate Your Account - {schoolName}',
        template: 'account-activation'
      }
    }
  };
};

/**
 * Validates notification data before creation
 * @param {Object} data - Notification data to validate
 * @returns {Object} Validation result { isValid, errors }
 */
export const validateNotificationData = (data) => {
  const errors = [];
  
  if (!data.type) errors.push('Notification type is required');
  if (!data.title) errors.push('Title is required');
  if (!data.message) errors.push('Message is required');
  if (!data.recipients || data.recipients.length === 0) {
    errors.push('At least one recipient is required');
  }

  // Validate priority if provided
  if (data.priority && !['low', 'normal', 'high', 'urgent'].includes(data.priority)) {
    errors.push('Invalid priority value');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Builds search query for notifications with filters
 * @param {Object} filters - Search filters
 * @param {number} userId - Current user ID for permission checks
 * @param {number} schoolId - School ID for scoping
 * @returns {Object} Prisma where clause
 */
export const buildNotificationSearchQuery = (filters, userId, schoolId) => {
  const where = {
    schoolId,
    OR: [
      { senderId: userId }, // Notifications sent by this user
      { recipients: { some: { userId: userId } }} // Notifications received by this user
    ]
  };

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  
  if (filters.read) {
    where.deliveryStatus = {
      some: {
        userId,
        readAt: filters.read === 'true' ? { not: null } : null
      }
    };
  }

  if (filters.search) {
    where.OR = [
      ...where.OR,
      { title: { contains: filters.search, mode: 'insensitive' } },
      { message: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
    if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
  }

  return where;
};

/**
 * Gets notification statistics for a user or school
 * @param {number} schoolId - School ID
 * @param {number} [userId] - Optional user ID for user-specific stats
 * @param {string} [period='30d'] - Time period for stats
 * @returns {Promise<Object>} Notification statistics
 */
export const getNotificationStats = async (schoolId, userId, period = '30d') => {
  const startDate = new Date();
  
  // Set start date based on period
  switch (period) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  const where = {
    schoolId,
    createdAt: { gte: startDate }
  };

  if (userId) {
    where.OR = [
      { senderId: userId },
      { recipients: { some: { userId: userId } }}
    ];
  }

  // Get all notifications in period
  const notifications = await prisma.notification.findMany({
    where,
    include: {
      deliveryStatus: {
        where: userId ? { userId } : undefined
      }
    }
  });

  // Calculate statistics
  const stats = {
    total: notifications.length,
    byType: {},
    byStatus: {},
    byPriority: {
      low: 0,
      normal: 0,
      high: 0,
      urgent: 0
    },
    readRate: 0,
    deliveryChannels: {
      email: 0,
      sms: 0,
      push: 0,
      inApp: 0
    }
  };

  let totalRead = 0;

  notifications.forEach(notification => {
    // Count by type
    stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
    
    // Count by status
    stats.byStatus[notification.status] = (stats.byStatus[notification.status] || 0) + 1;
    
    // Count by priority
    if (notification.priority) {
      stats.byPriority[notification.priority]++;
    }

    // Process delivery status
    notification.deliveryStatus.forEach(status => {
      // Count delivery channels
      if (status.channel) {
        stats.deliveryChannels[status.channel]++;
      }
      
      // Count read status
      if (status.readAt) {
        totalRead++;
      }
    });
  });

  // Calculate read rate
  if (notifications.length > 0) {
    stats.readRate = Math.round((totalRead / notifications.length) * 100);
  }

  return stats;
};

/**
 * Marks notifications as read for a user
 * @param {number|number[]} notificationIds - Notification ID or array of IDs
 * @param {number} userId - User ID marking as read
 * @returns {Promise<Object>} Update result
 */
export const markNotificationsAsRead = async (notificationIds, userId) => {
  const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
  
  try {
    const updated = await prisma.notificationDeliveryStatus.updateMany({
      where: {
        notificationId: { in: ids },
        userId,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    return {
      success: true,
      count: updated.count
    };
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

/**
 * Cleans up old notifications
 * @param {number} daysOld - Number of days to consider as "old"
 * @returns {Promise<Object>} Cleanup result
 */
export const cleanupOldNotifications = async (daysOld = 90) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  try {
    // Delete notifications older than cutoff date
    const deleted = await prisma.notification.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { not: 'PENDING' } // Don't delete pending notifications
      }
    });

    return {
      success: true,
      deletedCount: deleted.count,
      cutoffDate
    };
  } catch (error) {
    console.error('Error cleaning up old notifications:', error);
    throw error;
  }
};

/**
 * Sends a notification through specified channels
 * @param {Object} notificationData - Notification data
 * @param {string[]} channels - Channels to send through ('email', 'sms', 'push', 'inApp')
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result of the notification sending operation
 */
export const sendNotification = async (notificationData, channels = ['inApp'], options = {}) => {
  // Validate the notification data
  const validation = validateNotificationData(notificationData);
  if (!validation.isValid) {
    throw new Error(`Invalid notification data: ${validation.errors.join(', ')}`);
  }

  // Default values
  const defaultData = {
    status: 'PENDING',
    priority: 'normal',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default: expires in 7 days
    metadata: {},
    actions: []
  };

  // Merge provided data with defaults
  const completeData = {
    ...defaultData,
    ...notificationData,
    schoolId: notificationData.schoolId || options.schoolId,
    senderId: notificationData.senderId || options.userId
  };

  try {
    // Create the notification in database
    const notification = await prisma.notification.create({
      data: {
        ...completeData,
        recipients: {
          connect: completeData.recipients.map(id => ({ id }))
        },
        deliveryStatus: {
          create: channels.map(channel => ({
            channel,
            status: 'PENDING',
            userId: completeData.recipients[0] // Initial status for first recipient
          }))
        }
      },
      include: buildNotificationIncludeQuery('deliveryStatus,attachments')
    });

    // Process delivery through each channel
    const deliveryResults = await Promise.allSettled(
      channels.map(channel => deliverNotification(notification, channel, options))
    );

    // Update delivery statuses based on results
    const updates = [];
    const now = new Date();

    deliveryResults.forEach((result, index) => {
      const channel = channels[index];
      const status = result.status === 'fulfilled' ? 'DELIVERED' : 'FAILED';

      updates.push(
        prisma.notificationDeliveryStatus.updateMany({
          where: {
            notificationId: notification.id,
            channel
          },
          data: {
            status,
            deliveredAt: status === 'DELIVERED' ? now : null,
            error: status === 'FAILED' ? result.reason.message : null
          }
        })
      );
    });

    await Promise.all(updates);

    // Update overall notification status
    const finalStatus = deliveryResults.every(r => r.status === 'fulfilled') 
      ? 'DELIVERED' 
      : deliveryResults.some(r => r.status === 'fulfilled') 
        ? 'PARTIALLY_DELIVERED' 
        : 'FAILED';

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: finalStatus }
    });

    return {
      success: true,
      notificationId: notification.id,
      status: finalStatus,
      channelResults: deliveryResults.map((result, index) => ({
        channel: channels[index],
        status: result.status,
        ...(result.status === 'rejected' && { error: result.reason.message })
      }))
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

/**
 * Handles delivery of a notification through a specific channel
 * @param {Object} notification - Notification data
 * @param {string} channel - Delivery channel
 * @param {Object} options - Additional options
 * @returns {Promise} Channel-specific delivery result
 */
const deliverNotification = async (notification, channel, options) => {
  switch (channel) {
    case 'email':
      return sendEmailNotification(notification, options);
    case 'sms':
      return sendSmsNotification(notification, options);
    case 'push':
      return sendPushNotification(notification, options);
    case 'inApp':
      return createInAppNotification(notification, options);
    default:
      throw new Error(`Unsupported notification channel: ${channel}`);
  }
};

/**
 * Sends an email notification (mock implementation)
 */
const sendEmailNotification = async (notification, options) => {
  // In a real implementation, this would integrate with an email service
  console.log(`Sending email notification to ${notification.recipients.length} recipients`);
  return { success: true };
};

/**
 * Sends an SMS notification (mock implementation)
 */
const sendSmsNotification = async (notification, options) => {
  // In a real implementation, this would integrate with an SMS service
  console.log(`Sending SMS notification to ${notification.recipients.length} recipients`);
  return { success: true };
};

/**
 * Sends a push notification (mock implementation)
 */
const sendPushNotification = async (notification, options) => {
  // In a real implementation, this would integrate with a push notification service
  console.log(`Sending push notification to ${notification.recipients.length} recipients`);
  return { success: true };
};

/**
 * Creates an in-app notification
 */
const createInAppNotification = async (notification, options) => {
  // For in-app notifications, we just need to ensure they're in the database
  // The actual delivery is handled by the client polling or via websockets
  return { success: true };
};

export default {
  buildNotificationIncludeQuery,
  formatNotificationResponse,
  processNotificationTemplate,
  getNotificationTemplates,
  validateNotificationData,
  buildNotificationSearchQuery,
  getNotificationStats,
  markNotificationsAsRead,
  cleanupOldNotifications
};
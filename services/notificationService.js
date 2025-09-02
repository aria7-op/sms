import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

// WebSocket service removed - no longer needed

// ======================
// NOTIFICATION TYPES & PRIORITIES
// ======================

export const NOTIFICATION_TYPES = {
  // System notifications
  SYSTEM_UPDATE: 'SYSTEM_UPDATE',
  MAINTENANCE: 'MAINTENANCE',
  SECURITY_ALERT: 'SECURITY_ALERT',
  
  // User management
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  
  // Student operations
  STUDENT_CREATED: 'STUDENT_CREATED',
  STUDENT_UPDATED: 'STUDENT_UPDATED',
  STUDENT_DELETED: 'STUDENT_DELETED',
  STUDENT_ENROLLED: 'STUDENT_ENROLLED',
  STUDENT_GRADUATED: 'STUDENT_GRADUATED',
  STUDENT_TRANSFERRED: 'STUDENT_TRANSFERRED',
  
  // Attendance
  ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
  ATTENDANCE_UPDATED: 'ATTENDANCE_UPDATED',
  ABSENT_NOTIFICATION: 'ABSENT_NOTIFICATION',
  LATE_ARRIVAL: 'LATE_ARRIVAL',
  
  // Academic
  GRADE_POSTED: 'GRADE_POSTED',
  ASSIGNMENT_CREATED: 'ASSIGNMENT_CREATED',
  ASSIGNMENT_SUBMITTED: 'ASSIGNMENT_SUBMITTED',
  EXAM_SCHEDULED: 'EXAM_SCHEDULED',
  EXAM_RESULT: 'EXAM_RESULT',
  
  // Financial
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_DUE: 'PAYMENT_DUE',
  PAYMENT_OVERDUE: 'PAYMENT_OVERDUE',
  FEE_STRUCTURE_UPDATED: 'FEE_STRUCTURE_UPDATED',
  
  // Communication
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  NOTICE_POSTED: 'NOTICE_POSTED',
  EVENT_CREATED: 'EVENT_CREATED',
  EVENT_REMINDER: 'EVENT_REMINDER',
  
  // Inventory
  LOW_STOCK: 'LOW_STOCK',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  INVENTORY_UPDATED: 'INVENTORY_UPDATED',
  
  // Customer operations
  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  CUSTOMER_DELETED: 'CUSTOMER_DELETED',
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_CONVERTED: 'LEAD_CONVERTED',
  
  // General
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR'
};

export const NOTIFICATION_PRIORITIES = {
  LOW: 'LOW',
  NORMAL: 'NORMAL',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

export const NOTIFICATION_CHANNELS = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH'
};

// ======================
// AUDIT LOG SERVICE
// ======================

/**
 * Create audit log entry
 */
export const createAuditLog = async (auditData) => {
  try {
    const {
      action,
      entity,
      entityId,
      userId,
      schoolId,
      ownerId,
      oldData,
      newData,
      details = {},
      ipAddress,
      userAgent
    } = auditData;

    const auditLog = await prisma.auditLog.create({
      data: {
        action,
        entityType: entity,
        entityId: BigInt(entityId),
        userId: userId ? BigInt(userId) : null,
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null,
        oldData,
        newData,
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown'
      }
    });

    console.log(`Audit log created: ${action} on ${entity} ${entityId} by user ${userId}`);
    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
};

/**
 * Get audit logs with filters
 */
export const getAuditLogs = async (filters = {}) => {
  try {
    const {
      entityType,
      entityId,
      userId,
      schoolId,
      action,
      startDate,
      endDate,
      page = 1,
      limit = 50
    } = filters;

    const where = {};

    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = BigInt(entityId);
    if (userId) where.userId = BigInt(userId);
    if (schoolId) where.schoolId = BigInt(schoolId);
    if (action) where.action = action;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const totalCount = await prisma.auditLog.count({ where });

    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        school: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    return {
      data: auditLogs,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Error getting audit logs:', error);
    throw error;
  }
};

/**
 * Get audit log by ID
 */
export const getAuditLogById = async (auditLogId) => {
  try {
    const auditLog = await prisma.auditLog.findUnique({
      where: { id: BigInt(auditLogId) },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true
          }
        },
        school: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    return auditLog;
  } catch (error) {
    console.error('Error getting audit log by ID:', error);
    throw error;
  }
};

// ======================
// CORE NOTIFICATION FUNCTIONS
// ======================

/**
 * Create a new notification with WebSocket broadcast
 */
export const createNotification = async (notificationData) => {
  try {
    let {
      type = 'INFO',
      title,
      message,
      summary,
      priority = 'NORMAL',
      status = 'PENDING',
      metadata = {},
      expiresAt,
      scheduledAt,
      entityType,
      entityId,
      entityAction,
      senderId,
      schoolId,
      ownerId,
      templateKey,
      templateData = {},
      recipients = [],
      channels = ['IN_APP'],
      attachments = []
    } = notificationData;

    // Validate required fields
    if (!title || !message) {
      throw new Error('Title and message are required');
    }

    // Convert metadata object to JSON string if it's an object
    if (metadata && typeof metadata === 'object') {
      // Convert BigInt values to strings before JSON serialization
      const convertBigInts = (obj) => {
        if (Array.isArray(obj)) {
          return obj.map(convertBigInts);
        } else if (obj && typeof obj === 'object') {
          const newObj = {};
          for (const key in obj) {
            if (typeof obj[key] === 'bigint') {
              newObj[key] = obj[key].toString();
            } else {
              newObj[key] = convertBigInts(obj[key]);
            }
          }
          return newObj;
        }
        return obj;
      };
      
      metadata = JSON.stringify(convertBigInts(metadata));
    }

    // Convert templateData object to JSON string if it's an object
    if (templateData && typeof templateData === 'object') {
      // Convert BigInt values to strings before JSON serialization
      const convertBigInts = (obj) => {
        if (Array.isArray(obj)) {
          return obj.map(convertBigInts);
        } else if (obj && typeof obj === 'object') {
          const newObj = {};
          for (const key in obj) {
            if (typeof obj[key] === 'bigint') {
              newObj[key] = obj[key].toString();
            } else {
              newObj[key] = convertBigInts(obj[key]);
            }
          }
          return newObj;
        }
        return obj;
      };
      
      templateData = JSON.stringify(convertBigInts(templateData));
    }

    // Create the notification
    const notification = await prisma.notification.create({
      data: {
        type,
        title,
        message,
        summary,
        priority,
        status,
        metadata,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        entityType,
        entityId: entityId ? BigInt(entityId) : null,
        entityAction,
        senderId: senderId ? BigInt(senderId) : null,
        schoolId: BigInt(schoolId),
        ownerId: ownerId ? BigInt(ownerId) : null,
        templateKey,
        templateData
      }
    });

    // Create recipients if provided
    if (recipients.length > 0) {
      const recipientData = recipients.map(recipientId => ({
        notificationId: notification.id,
        userId: BigInt(recipientId),
        channel: 'IN_APP',
        status: 'PENDING'
      }));

      await prisma.notificationRecipient.createMany({
        data: recipientData
      });
    }

    // Create attachments if provided
    if (attachments.length > 0) {
      const attachmentData = attachments.map(attachment => ({
        notificationId: notification.id,
        name: attachment.name,
        url: attachment.url,
        type: attachment.type,
        size: attachment.size,
        mimeType: attachment.mimeType,
        description: attachment.description
      }));

      await prisma.notificationAttachment.createMany({
        data: attachmentData
      });
    }

    // WebSocket broadcasting removed - notifications will be delivered via polling

    // Send via other channels if specified
    if (channels.includes('EMAIL')) {
      try {
        await sendEmailNotification(notification, recipients);
      } catch (emailError) {
        console.error('❌ Email notification failed:', emailError.message);
      }
    }

    if (channels.includes('SMS')) {
      try {
        await sendSMSNotification(notification, recipients);
      } catch (smsError) {
        console.error('❌ SMS notification failed:', smsError.message);
      }
    }

    if (channels.includes('PUSH')) {
      try {
        await sendPushNotification(notification, recipients);
      } catch (pushError) {
        console.error('❌ Push notification failed:', pushError.message);
      }
    }

    console.log(`✅ Notification created: ${type} - ${title}`);
    return notification;
  } catch (error) {
    console.error('❌ Error creating notification:', error);
    throw error;
  }
};

/**
 * Process notification delivery through multiple channels
 */
export const processNotificationDelivery = async (notification, channels = ['IN_APP']) => {
  try {
    const deliveryPromises = channels.map(channel => 
      deliverNotification(notification, channel)
    );

    const results = await Promise.allSettled(deliveryPromises);
    
    // Log delivery results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Notification delivered via ${channels[index]}: ${result.value}`);
      } else {
        console.error(`Failed to deliver notification via ${channels[index]}:`, result.reason);
      }
    });

    return results;
  } catch (error) {
    console.error('Error processing notification delivery:', error);
    throw error;
  }
};

/**
 * Deliver notification through a specific channel
 */
export const deliverNotification = async (notification, channel) => {
  try {
    let deliveryResult;

    switch (channel) {
      case 'EMAIL':
        deliveryResult = await sendEmailNotification({
          to: notification.recipients?.map(r => r.user?.email).filter(Boolean),
          subject: notification.title,
          body: notification.message,
          notificationId: notification.id
        });
        break;

      case 'SMS':
        deliveryResult = await sendSMSNotification({
          to: notification.recipients?.map(r => r.user?.phone).filter(Boolean),
          message: notification.message,
          notificationId: notification.id
        });
        break;

      case 'PUSH':
        deliveryResult = await sendPushNotification({
          to: notification.recipients?.map(r => r.user?.id).filter(Boolean),
          title: notification.title,
          body: notification.message,
          notificationId: notification.id
        });
        break;

      case 'IN_APP':
      default:
        deliveryResult = { success: true, message: 'In-app notification created' };
        break;
    }

    return deliveryResult;
  } catch (error) {
    console.error(`Error delivering notification via ${channel}:`, error);
    throw error;
  }
};

/**
 * Get notifications for a user with filters
 */
export const getUserNotifications = async (userId, filters = {}) => {
  try {
    const {
      status,
      type,
      priority,
      page = 1,
      limit = 20,
      include
    } = filters;

    const where = {
      recipients: {
        some: {
          userId: BigInt(userId)
        }
      }
    };

    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const totalCount = await prisma.notification.count({ where });

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        recipients: {
          where: { userId: BigInt(userId) },
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
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    });

    return {
      data: notifications,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationIds, userId) => {
  try {
    const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];

    const updated = await prisma.notificationRecipient.updateMany({
      where: {
        notificationId: { in: ids.map(id => BigInt(id)) },
        userId: BigInt(userId)
      },
      data: {
        status: 'READ',
        readAt: new Date()
      }
    });

    // Also update the main notification if all recipients have read it
    for (const notificationId of ids) {
      const unreadRecipients = await prisma.notificationRecipient.count({
        where: {
          notificationId: BigInt(notificationId),
          status: { not: 'READ' }
        }
      });

      if (unreadRecipients === 0) {
        await prisma.notification.update({
          where: { id: BigInt(notificationId) },
          data: {
            status: 'READ'
          }
        });
      }
    }

    return {
      success: true,
      updatedCount: updated.count,
      message: 'Notifications marked as read'
    };
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

/**
 * Delete notification
 */
export const deleteNotification = async (notificationId, userId) => {
  try {
    // Check if user has permission to delete this notification
    const notification = await prisma.notification.findFirst({
      where: {
        id: BigInt(notificationId),
        OR: [
          { senderId: BigInt(userId) },
          { createdBy: BigInt(userId) }
        ]
      }
    });

    if (!notification) {
      throw new Error('Notification not found or permission denied');
    }

    await prisma.notification.delete({
      where: { id: BigInt(notificationId) }
    });

    return {
      success: true,
      message: 'Notification deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting notification:', error);
    throw error;
  }
};

// ======================
// EMAIL NOTIFICATION SERVICE
// ======================

/**
 * Send email notification
 */
export const sendEmailNotification = async (emailData) => {
  try {
    const {
      to,
      subject,
      body,
      html,
      from,
      replyTo,
      cc,
      bcc,
      attachments,
      notificationId
    } = emailData;

    // Validate email data
    if (!to || !subject || !body) {
      throw new Error('Missing required email fields: to, subject, body');
    }

    // For now, we'll just log the email notification
    // In a real implementation, this would integrate with an email service like SendGrid, AWS SES, etc.
    console.log('Email notification:', {
      to,
      subject,
      body,
      html,
      from,
      replyTo,
      cc,
      bcc,
      attachments,
      notificationId,
      timestamp: new Date().toISOString()
    });

    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      success: true,
      message: 'Email notification sent successfully',
      data: {
        messageId: `email_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error sending email notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Send bulk email notifications
 */
export const sendBulkEmailNotifications = async (emails) => {
  try {
    const results = [];

    for (const emailData of emails) {
      try {
        const result = await sendEmailNotification(emailData);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          error: error.message,
          emailData
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return {
      success: true,
      message: `Bulk email notifications sent: ${successCount} successful, ${failureCount} failed`,
      data: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        results
      }
    };
  } catch (error) {
    console.error('Error sending bulk email notifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ======================
// PUSH NOTIFICATION SERVICE
// ======================

/**
 * Send push notification
 */
export const sendPushNotification = async (pushData) => {
  try {
    const {
      to,
      title,
      body,
      data,
      badge,
      sound,
      priority,
      notificationId
    } = pushData;

    // Validate push notification data
    if (!to || !title || !body) {
      throw new Error('Missing required push notification fields: to, title, body');
    }

    // For now, we'll just log the push notification
    // In a real implementation, this would integrate with Firebase Cloud Messaging, OneSignal, etc.
    console.log('Push notification:', {
      to,
      title,
      body,
      data,
      badge,
      sound,
      priority,
      notificationId,
      timestamp: new Date().toISOString()
    });

    // Simulate push notification sending delay
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      success: true,
      message: 'Push notification sent successfully',
      data: {
        messageId: `push_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ======================
// SMS NOTIFICATION SERVICE
// ======================

/**
 * Send SMS notification
 */
export const sendSMSNotification = async (smsData) => {
  try {
    const {
      to,
      message,
      from,
      notificationId
    } = smsData;

    // Validate SMS data
    if (!to || !message) {
      throw new Error('Missing required SMS fields: to, message');
    }

    // For now, we'll just log the SMS notification
    // In a real implementation, this would integrate with Twilio, AWS SNS, etc.
    console.log('SMS notification:', {
      to,
      message,
      from,
      notificationId,
      timestamp: new Date().toISOString()
    });

    // Simulate SMS sending delay
    await new Promise(resolve => setTimeout(resolve, 150));

    return {
      success: true,
      message: 'SMS notification sent successfully',
      data: {
        messageId: `sms_${Date.now()}`,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error sending SMS notification:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// ======================
// NOTIFICATION TEMPLATES
// ======================

/**
 * Get notification templates
 */
export const getNotificationTemplates = async () => {
  try {
    const templates = await prisma.notificationTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    return templates;
  } catch (error) {
    console.error('Error getting notification templates:', error);
    throw error;
  }
};

/**
 * Process notification template with data
 */
export const processNotificationTemplate = async (templateKey, data) => {
  try {
    const template = await prisma.notificationTemplate.findUnique({
      where: { key: templateKey }
    });

    if (!template) {
      throw new Error(`Template not found: ${templateKey}`);
    }

    // Process template variables
    const processedTitle = processTemplateString(template.title, data);
    const processedMessage = processTemplateString(template.message, data);
    const processedEmailSubject = template.emailSubject ? processTemplateString(template.emailSubject, data) : null;
    const processedEmailBody = template.emailBody ? processTemplateString(template.emailBody, data) : null;
    const processedSmsBody = template.smsBody ? processTemplateString(template.smsBody, data) : null;
    const processedPushTitle = template.pushTitle ? processTemplateString(template.pushTitle, data) : null;
    const processedPushBody = template.pushBody ? processTemplateString(template.pushBody, data) : null;

    return {
      title: processedTitle,
      message: processedMessage,
      email: {
        subject: processedEmailSubject,
        body: processedEmailBody
      },
      sms: {
        body: processedSmsBody
      },
      push: {
        title: processedPushTitle,
        body: processedPushBody
      }
    };
  } catch (error) {
    console.error('Error processing notification template:', error);
    throw error;
  }
};

/**
 * Process template string with variables
 */
export const processTemplateString = (template, data) => {
  if (!template) return '';
  
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
};

// ======================
// NOTIFICATION UTILITIES
// ======================

/**
 * Get notification statistics
 */
export const getNotificationStats = async (schoolId, userId, period = '30d') => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const where = {
      createdAt: { gte: startDate }
    };

    if (schoolId) where.schoolId = BigInt(schoolId);
    if (userId) {
      where.recipients = {
        some: { userId: BigInt(userId) }
      };
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        recipients: true,
        deliveryStatus: true
      }
    });

    const stats = {
      total: notifications.length,
      byType: {},
      byStatus: {},
      byPriority: {},
      byChannel: {},
      readRate: 0,
      deliveryRate: 0
    };

    let totalRead = 0;
    let totalDelivered = 0;

    notifications.forEach(notification => {
      // Count by type
      stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;

      // Count by status
      stats.byStatus[notification.status] = (stats.byStatus[notification.status] || 0) + 1;

      // Count by priority
      if (notification.priority) {
        stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;
      }

      // Count by channel and delivery status
      notification.deliveryStatus.forEach(status => {
        stats.byChannel[status.channel] = (stats.byChannel[status.channel] || 0) + 1;
        if (status.status === 'DELIVERED') totalDelivered++;
      });

      // Count read notifications
      notification.recipients.forEach(recipient => {
        if (recipient.status === 'READ') totalRead++;
      });
    });

    if (notifications.length > 0) {
      stats.readRate = Math.round((totalRead / notifications.length) * 100);
      stats.deliveryRate = Math.round((totalDelivered / notifications.length) * 100);
    }

    return stats;
  } catch (error) {
    console.error('Error getting notification stats:', error);
    throw error;
  }
};

// ======================
// AUTOMATIC NOTIFICATION TRIGGERS
// ======================

/**
 * Trigger automatic notifications for entity creation
 */
export const triggerEntityCreatedNotification = async (entityType, entityId, entityData, userId, schoolId, ownerId) => {
  try {
    // Get notification rules for this entity type
    const rules = await prisma.notificationRule.findMany({
      where: {
        eventType: 'entity_created',
        entityType,
        isActive: true,
        schoolId: schoolId ? BigInt(schoolId) : null
      }
    });

    for (const rule of rules) {
      // Check if conditions are met
      if (await checkRuleConditions(rule, entityData)) {
                // Process template
        let template;
        try {
          template = await processNotificationTemplate(rule.templateKey, {
            ...entityData,
            entityType,
            entityId,
            userId
          });
        } catch (templateError) {
          console.error('Error processing notification template:', templateError);
          // Use fallback template
          template = {
            title: 'Student Information Updated',
            message: 'Student information has been updated successfully'
          };
        }

        // Get recipients based on rule configuration
        const recipients = await getRuleRecipients(rule, entityData);

                // Create notification
        await createNotification({
          type: 'SYSTEM', // Default type since NotificationRule doesn't have a type field
          title: template.title,
          message: template.message,
          priority: 'NORMAL', // Default priority since NotificationRule doesn't have a priority field
          channels: rule.channels ? (() => {
            try {
              return JSON.parse(rule.channels);
            } catch (parseError) {
              console.error('Error parsing rule channels:', parseError);
              return ['IN_APP'];
            }
          })() : ['IN_APP'],
          entityType,
          entityId,
          entityAction: 'created',
          senderId: userId,
          schoolId,
          ownerId,
          templateKey: rule.templateKey,
          templateData: entityData,
          recipients
        });
      }
    }
  } catch (error) {
    console.error('Error triggering entity created notification:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Trigger automatic notifications for entity updates
 */
export const triggerEntityUpdatedNotification = async (entityType, entityId, entityData, oldData, userId, schoolId, ownerId) => {
  try {
    // Get notification rules for this entity type
    const rules = await prisma.notificationRule.findMany({
      where: {
        eventType: 'entity_updated',
        entityType,
        isActive: true,
        schoolId: schoolId ? BigInt(schoolId) : null
      }
    });

    for (const rule of rules) {
      // Check if conditions are met
      if (await checkRuleConditions(rule, entityData, oldData)) {
                // Process template
        let template;
        try {
          template = await processNotificationTemplate(rule.templateKey, {
            ...entityData,
            oldData,
            entityType,
            entityId,
            userId
          });
        } catch (templateError) {
          console.error('Error processing notification template:', templateError);
          // Use fallback template
          template = {
            title: 'Student Information Updated',
            message: 'Student information has been updated successfully'
          };
        }

        // Get recipients based on rule configuration
        const recipients = await getRuleRecipients(rule, entityData);

                // Create notification
        await createNotification({
          type: 'SYSTEM', // Default type since NotificationRule doesn't have a type field
          title: template.title,
          message: template.message,
          priority: 'NORMAL', // Default priority since NotificationRule doesn't have a priority field
          channels: rule.channels ? (() => {
            try {
              return JSON.parse(rule.channels);
            } catch (parseError) {
              console.error('Error parsing rule channels:', parseError);
              return ['IN_APP'];
            }
          })() : ['IN_APP'],
          entityType,
          entityId,
          entityAction: 'updated',
          senderId: userId,
          schoolId,
          ownerId,
          templateKey: rule.templateKey,
          templateData: { ...entityData, oldData },
          recipients
        });
      }
    }
  } catch (error) {
    console.error('Error triggering entity updated notification:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Check if rule conditions are met
 */
export const checkRuleConditions = async (rule, entityData, oldData = null) => {
  try {
    if (!rule.conditions) return true;

    // Parse conditions from JSON string
    let conditions;
    try {
      conditions = JSON.parse(rule.conditions);
    } catch (parseError) {
      console.error('Error parsing rule conditions:', parseError);
      return false;
    }
    
    for (const [field, condition] of Object.entries(conditions)) {
      const value = entityData[field];
      
      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'not_equals':
          if (value === condition.value) return false;
          break;
        case 'contains':
          if (!value || !value.includes(condition.value)) return false;
          break;
        case 'greater_than':
          if (!value || value <= condition.value) return false;
          break;
        case 'less_than':
          if (!value || value >= condition.value) return false;
          break;
        case 'changed':
          if (!oldData || value === oldData[field]) return false;
          break;
        case 'not_changed':
          if (oldData && value !== oldData[field]) return false;
          break;
      }
    }

    return true;
  } catch (error) {
    console.error('Error checking rule conditions:', error);
    return false;
  }
};

/**
 * Get recipients for a notification rule
 */
export const getRuleRecipients = async (rule, entityData) => {
  try {
    if (!rule.recipients) return [];

    // Parse recipients from JSON string
    let recipientConfig;
    try {
      recipientConfig = JSON.parse(rule.recipients);
    } catch (parseError) {
      console.error('Error parsing rule recipients:', parseError);
      return [];
    }

    const recipients = [];

    // Get users by role
    if (recipientConfig.roles) {
      const roleUsers = await prisma.user.findMany({
        where: {
          role: { in: recipientConfig.roles },
          schoolId: entityData.schoolId ? BigInt(entityData.schoolId) : undefined
        },
        select: { id: true }
      });
      recipients.push(...roleUsers.map(u => u.id));
    }

    // Get specific users
    if (recipientConfig.userIds) {
      recipients.push(...recipientConfig.userIds);
    }

    // Get entity-related users
    if (recipientConfig.entityUsers) {
      const entityUserIds = await getEntityUserIds(entityData);
      recipients.push(...entityUserIds);
    }

    // Remove duplicates
    return [...new Set(recipients)];
  } catch (error) {
    console.error('Error getting rule recipients:', error);
    return [];
  }
};

/**
 * Get user IDs related to an entity
 */
export const getEntityUserIds = async (entityData) => {
  try {
    const userIds = [];

    // Add entity owner/creator
    if (entityData.createdBy) {
      userIds.push(entityData.createdBy);
    }

    // Add entity-specific users based on entity type
    switch (entityData.entityType) {
      case 'student':
        if (entityData.parentId) {
          const parent = await prisma.parent.findUnique({
            where: { id: BigInt(entityData.parentId) },
            select: { userId: true }
          });
          if (parent) userIds.push(parent.userId);
        }
        break;
      case 'payment':
        if (entityData.studentId) {
          const student = await prisma.student.findUnique({
            where: { id: BigInt(entityData.studentId) },
            select: { userId: true, parentId: true }
          });
          if (student) {
            userIds.push(student.userId);
            if (student.parentId) {
              const parent = await prisma.parent.findUnique({
                where: { id: student.parentId },
                select: { userId: true }
              });
              if (parent) userIds.push(parent.userId);
            }
          }
        }
        break;
      case 'assignment':
        if (entityData.classId) {
          const students = await prisma.student.findMany({
            where: { classId: BigInt(entityData.classId) },
            select: { userId: true }
          });
          userIds.push(...students.map(s => s.userId));
        }
        break;
    }

    return userIds;
  } catch (error) {
    console.error('Error getting entity user IDs:', error);
    return [];
  }
};

// ======================
// SYSTEM OPERATION NOTIFICATIONS
// ======================

/**
 * Create student operation notifications
 */
export const createStudentNotification = async (operation, studentData, userId, schoolId, ownerId, additionalData = {}) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES[`STUDENT_${operation.toUpperCase()}`] || NOTIFICATION_TYPES.INFO,
      title: `Student ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      message: `Student ${studentData.user?.firstName || 'Unknown'} ${studentData.user?.lastName || 'Student'} has been ${operation}`,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      entityType: 'student',
      entityId: studentData.id,
      entityAction: operation,
      senderId: userId,
      schoolId,
      ownerId,
      channels: ['IN_APP'],
      metadata: {
        studentId: studentData.id,
        studentName: `${studentData.user?.firstName || 'Unknown'} ${studentData.user?.lastName || 'Student'}`,
        operation,
        ...additionalData
      }
    };

    // Determine recipients based on operation
    let recipients = [];
    
    if (operation === 'created' || operation === 'updated') {
      // Notify teachers in the same class
      if (studentData.classId) {
        const teachers = await prisma.user.findMany({
          where: {
            role: 'TEACHER',
            schoolId: BigInt(schoolId),
            classes: {
              some: { id: BigInt(studentData.classId) }
            }
          },
          select: { id: true }
        });
        recipients.push(...teachers.map(t => t.id));
      }
      
      // Notify school admin
      const schoolAdmins = await prisma.user.findMany({
        where: {
          role: 'SCHOOL_ADMIN',
          schoolId: BigInt(schoolId)
        },
        select: { id: true }
      });
      recipients.push(...schoolAdmins.map(a => a.id));
    }

    if (recipients.length > 0) {
      notificationData.recipients = recipients;
    }

    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating student notification:', error);
    return null;
  }
};

/**
 * Create attendance operation notifications
 */
export const createAttendanceNotification = async (operation, attendanceData, userId, schoolId, ownerId) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES[`ATTENDANCE_${operation.toUpperCase()}`] || NOTIFICATION_TYPES.INFO,
      title: `Attendance ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      message: `Attendance has been ${operation} for ${attendanceData.student?.user?.firstName || 'Unknown'} ${attendanceData.student?.user?.lastName || 'Student'}`,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      entityType: 'attendance',
      entityId: attendanceData.id,
      entityAction: operation,
      senderId: userId,
      schoolId,
      ownerId,
      channels: ['IN_APP'],
      metadata: {
        attendanceId: attendanceData.id,
        studentId: attendanceData.studentId,
        studentName: `${attendanceData.student?.user?.firstName || 'Unknown'} ${attendanceData.student?.user?.lastName || 'Student'}`,
        status: attendanceData.status,
        date: attendanceData.date,
        operation
      }
    };

    // Determine recipients
    let recipients = [];
    
    // Notify the student's parent
    if (attendanceData.student?.parentId) {
      const parent = await prisma.parent.findUnique({
        where: { id: BigInt(attendanceData.student.parentId) },
        select: { userId: true }
      });
      if (parent) {
        recipients.push(parent.userId);
      }
    }
    
    // Notify class teacher
    if (attendanceData.classId) {
      const classTeacher = await prisma.user.findFirst({
        where: {
          role: 'TEACHER',
          schoolId: BigInt(schoolId),
          classes: {
            some: { id: BigInt(attendanceData.classId) }
          }
        },
        select: { id: true }
      });
      if (classTeacher) {
        recipients.push(classTeacher.id);
      }
    }

    if (recipients.length > 0) {
      notificationData.recipients = recipients;
    }

    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating attendance notification:', error);
    return null;
  }
};

/**
 * Create payment operation notifications
 */
export const createPaymentNotification = async (operation, paymentData, userId, schoolId, ownerId) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES[`PAYMENT_${operation.toUpperCase()}`] || NOTIFICATION_TYPES.INFO,
      title: `Payment ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      message: `Payment of ${paymentData.amount} has been ${operation}`,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      entityType: 'payment',
      entityId: paymentData.id,
      entityAction: operation,
      senderId: userId,
      schoolId,
      ownerId,
      channels: ['IN_APP', 'EMAIL'],
      metadata: {
        paymentId: paymentData.id,
        amount: paymentData.amount,
        studentId: paymentData.studentId,
        studentName: paymentData.student?.user?.firstName + ' ' + paymentData.student?.user?.lastName,
        operation,
        dueDate: paymentData.dueDate
      }
    };

    // Determine recipients
    let recipients = [];
    
    // Notify the student's parent
    if (paymentData.student?.parentId) {
      const parent = await prisma.parent.findUnique({
        where: { id: BigInt(paymentData.student.parentId) },
        select: { userId: true }
      });
      if (parent) {
        recipients.push(parent.userId);
      }
    }
    
    // Notify finance staff
    const financeStaff = await prisma.user.findMany({
      where: {
        role: { in: ['FINANCE_OFFICER', 'SCHOOL_ADMIN'] },
        schoolId: BigInt(schoolId)
      },
      select: { id: true }
    });
    recipients.push(...financeStaff.map(s => s.id));

    if (recipients.length > 0) {
      notificationData.recipients = recipients;
    }

    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating payment notification:', error);
    return null;
  }
};

/**
 * Create user operation notifications
 */
export const createUserNotification = async (operation, userData, userId, schoolId, ownerId) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES[`USER_${operation.toUpperCase()}`] || NOTIFICATION_TYPES.INFO,
      title: `User ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      message: `User ${userData.firstName} ${userData.lastName} has been ${operation}`,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      entityType: 'user',
      entityId: userData.id,
      entityAction: operation,
      senderId: userId,
      schoolId,
      ownerId,
      channels: ['IN_APP'],
      metadata: {
        userId: userData.id,
        userName: `${userData.firstName} ${userData.lastName}`,
        userRole: userData.role,
        operation
      }
    };

    // Determine recipients
    let recipients = [];
    
    // Notify school admin
    if (schoolId) {
      const schoolAdmins = await prisma.user.findMany({
        where: {
          role: 'SCHOOL_ADMIN',
          schoolId: BigInt(schoolId)
        },
        select: { id: true }
      });
      recipients.push(...schoolAdmins.map(a => a.id));
    }
    
    // Notify owner
    if (ownerId) {
      recipients.push(ownerId);
    }

    if (recipients.length > 0) {
      notificationData.recipients = recipients;
    }

    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating user notification:', error);
    return null;
  }
};

/**
 * Create system-wide notifications
 */
export const createSystemNotification = async (type, title, message, priority = 'NORMAL', schoolId = null, ownerId = null, recipients = []) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.INFO,
      title,
      message,
      priority: NOTIFICATION_PRIORITIES[priority] || NOTIFICATION_PRIORITIES.NORMAL,
      entityType: 'system',
      entityAction: type.toLowerCase(),
      schoolId: schoolId || 1,
      ownerId,
      channels: ['IN_APP'],
      metadata: {
        systemEvent: type,
        timestamp: new Date().toISOString()
      }
    };

    if (recipients.length > 0) {
      notificationData.recipients = recipients;
    }

    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating system notification:', error);
    return null;
  }
};

/**
 * Create customer operation notifications
 */
export const createCustomerNotification = async (operation, customerData, userId, schoolId, ownerId) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES[`CUSTOMER_${operation.toUpperCase()}`] || NOTIFICATION_TYPES.INFO,
      title: `Customer ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      message: `Customer ${customerData.name} has been ${operation}`,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      entityType: 'customer',
      entityId: customerData.id,
      entityAction: operation,
      senderId: userId,
      schoolId,
      ownerId,
      channels: ['IN_APP'],
      metadata: {
        customerId: customerData.id,
        customerName: customerData.name,
        customerEmail: customerData.email,
        operation
      }
    };

    // Determine recipients
    let recipients = [];
    
    // Notify sales staff
    const salesStaff = await prisma.user.findMany({
      where: {
        role: { in: ['SALES_OFFICER', 'SCHOOL_ADMIN'] },
        schoolId: BigInt(schoolId)
      },
      select: { id: true }
    });
    recipients.push(...salesStaff.map(s => s.id));

    if (recipients.length > 0) {
      notificationData.recipients = recipients;
    }

    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating customer notification:', error);
    return null;
  }
};

/**
 * Create inventory operation notifications
 */
export const createInventoryNotification = async (operation, inventoryData, userId, schoolId, ownerId) => {
  try {
    const notificationData = {
      type: NOTIFICATION_TYPES[`INVENTORY_${operation.toUpperCase()}`] || NOTIFICATION_TYPES.INFO,
      title: `Inventory ${operation.charAt(0).toUpperCase() + operation.slice(1)}`,
      message: `Inventory item ${inventoryData.name} has been ${operation}`,
      priority: operation === 'low_stock' ? NOTIFICATION_PRIORITIES.HIGH : NOTIFICATION_PRIORITIES.NORMAL,
      entityType: 'inventory',
      entityId: inventoryData.id,
      entityAction: operation,
      senderId: userId,
      schoolId,
      ownerId,
      channels: ['IN_APP'],
      metadata: {
        inventoryId: inventoryData.id,
        itemName: inventoryData.name,
        currentQuantity: inventoryData.quantity,
        minQuantity: inventoryData.minQuantity,
        operation
      }
    };

    // Determine recipients
    let recipients = [];
    
    // Notify inventory staff
    const inventoryStaff = await prisma.user.findMany({
      where: {
        role: { in: ['INVENTORY_OFFICER', 'SCHOOL_ADMIN'] },
        schoolId: BigInt(schoolId)
      },
      select: { id: true }
    });
    recipients.push(...inventoryStaff.map(s => s.id));

    if (recipients.length > 0) {
      notificationData.recipients = recipients;
    }

    return await createNotification(notificationData);
  } catch (error) {
    console.error('Error creating inventory notification:', error);
    return null;
  }
};

/**
 * Get unread notification count for a user
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    const count = await prisma.notificationRecipient.count({
      where: {
        userId: BigInt(userId),
        status: { not: 'READ' }
      }
    });
    
    return count;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
};





// ======================
// EXPORTS
// ======================

// All functions are already exported as named exports above
// No need for duplicate exports here 

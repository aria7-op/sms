import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

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
// NOTIFICATION SERVICE
// ======================

/**
 * Create notification with comprehensive functionality
 */
export const createNotification = async (notificationData) => {
  try {
    let {
      type,
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

    // Convert metadata object to JSON string if it's an object (temporary fix until DB column is JSON)
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

    // Convert templateData object to JSON string if it's an object (temporary fix until DB column is JSON)
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
        channel: channels[0] || 'IN_APP',
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

    // Process delivery if not scheduled
    if (!scheduledAt) {
      await processNotificationDelivery(notification, channels);
    }

    console.log(`Notification created: ${type} - ${title}`);
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
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
            status: 'READ',
            readAt: new Date()
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
        sentAt: new Date().toISOString()
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
        sentAt: new Date().toISOString()
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
        sentAt: new Date().toISOString()
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
        trigger: 'entity_created',
        entityType,
        isActive: true,
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null
      }
    });

    for (const rule of rules) {
      // Check if conditions are met
      if (await checkRuleConditions(rule, entityData)) {
        // Process template
        const template = await processNotificationTemplate(rule.templateKey, {
          ...entityData,
          entityType,
          entityId,
          userId
        });

        // Get recipients based on rule configuration
        const recipients = await getRuleRecipients(rule, entityData);

        // Create notification
        await createNotification({
          type: rule.type,
          title: template.title,
          message: template.message,
          priority: rule.priority,
          channels: rule.channels,
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
        trigger: 'entity_updated',
        entityType,
        isActive: true,
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null
      }
    });

    for (const rule of rules) {
      // Check if conditions are met
      if (await checkRuleConditions(rule, entityData, oldData)) {
        // Process template
        const template = await processNotificationTemplate(rule.templateKey, {
          ...entityData,
          oldData,
          entityType,
          entityId,
          userId
        });

        // Get recipients based on rule configuration
        const recipients = await getRuleRecipients(rule, entityData);

        // Create notification
        await createNotification({
          type: rule.type,
          title: template.title,
          message: template.message,
          priority: rule.priority,
          channels: rule.channels,
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

    const conditions = rule.conditions;
    
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

    const recipients = [];
    const recipientConfig = rule.recipients;

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
// EXPORTS
// ======================

// All functions are already exported as named exports above
// No need for duplicate exports here 
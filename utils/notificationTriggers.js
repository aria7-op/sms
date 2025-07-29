import { 
  triggerEntityCreatedNotification,
  triggerEntityUpdatedNotification,
  createNotification,
  createAuditLog
} from '../services/notificationService.js';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

/**
 * Get user IDs by roles for notifications
 */
export const getUserIdsByRoles = async (roles, schoolId) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: roles },
        schoolId: BigInt(schoolId)
      },
      select: { id: true }
    });
    return users.map(user => user.id.toString());
  } catch (error) {
    console.error('Error getting user IDs by roles:', error);
    return [];
  }
};

/**
 * Automatic notification trigger utilities for entity operations
 * This file provides helper functions to automatically trigger notifications
 * when entities are created, updated, or deleted across the application.
 */

/**
 * Trigger notifications for entity creation
 * @param {string} entityType - Type of entity (student, customer, teacher, etc.)
 * @param {string|number} entityId - ID of the created entity
 * @param {Object} entityData - Full entity data
 * @param {Object} user - Current user performing the action
 * @param {Object} options - Additional options
 */
export const triggerEntityCreatedNotifications = async (
  entityType,
  entityId,
  entityData,
  user,
  options = {}
) => {
  try {
    // Create audit log
    await createAuditLog({
      action: 'CREATE',
      entity: entityType.charAt(0).toUpperCase() + entityType.slice(1),
      entityId: entityId.toString(),
      userId: user.id,
      schoolId: user.schoolId,
      details: {
        [`${entityType}Id`]: entityId.toString(),
        ...options.auditDetails
      }
    });

    // Trigger automatic notification
    await triggerEntityCreatedNotification(
      entityType,
      entityId.toString(),
      {
        ...entityData,
        entityType,
        entityId: entityId.toString(),
        schoolId: user.schoolId,
        createdBy: user.id
      },
      user.id,
      user.schoolId,
      user.createdByOwnerId
    );

    // Get recipient user IDs
    const recipientUserIds = await getUserIdsByRoles(['SCHOOL_ADMIN', 'TEACHER'], user.schoolId);

    // Map entity type to valid notification type
    const getNotificationType = (entityType) => {
      const typeMap = {
        'student': 'ACADEMIC',
        'teacher': 'ACADEMIC',
        'class': 'ACADEMIC',
        'section': 'ACADEMIC',
        'exam': 'EXAM',
        'assignment': 'ASSIGNMENT',
        'payment': 'PAYMENT',
        'customer': 'CUSTOMER',
        'book': 'LIBRARY',
        'inventory': 'INVENTORY',
        'transport': 'TRANSPORT',
        'event': 'EVENT',
        'notice': 'NOTICE'
      };
      return typeMap[entityType.toLowerCase()] || 'CREATION';
    };

    // Create fallback notification if no rules are configured
    await createNotification({
      type: getNotificationType(entityType),
      title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Created`,
      message: `A new ${entityType} has been created successfully`,
      priority: 'NORMAL',
      status: 'PENDING',
      entityType,
      entityId: entityId.toString(),
      entityAction: 'created',
      senderId: user.id,
      schoolId: user.schoolId,
      metadata: {
        entityType,
        entityId: entityId.toString(),
        createdBy: user.id,
        ...options.auditDetails
      },
      recipients: recipientUserIds
    });

    console.log(`✅ Automatic notifications triggered for ${entityType} creation: ${entityId}`);
  } catch (error) {
    console.error(`❌ Error triggering notifications for ${entityType} creation:`, error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Trigger notifications for entity updates
 * @param {string} entityType - Type of entity
 * @param {string|number} entityId - ID of the updated entity
 * @param {Object} entityData - Updated entity data
 * @param {Object} previousData - Previous entity data
 * @param {Object} user - Current user performing the action
 * @param {Object} options - Additional options
 */
export const triggerEntityUpdatedNotifications = async (
  entityType,
  entityId,
  entityData,
  previousData,
  user,
  options = {}
) => {
  try {
    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entity: entityType.charAt(0).toUpperCase() + entityType.slice(1),
      entityId: entityId.toString(),
      userId: user.id,
      schoolId: user.schoolId,
      details: {
        [`${entityType}Id`]: entityId.toString(),
        updatedFields: Object.keys(entityData).filter(key => 
          entityData[key] !== previousData[key]
        ),
        ...options.auditDetails
      }
    });

    // Trigger automatic notification
    await triggerEntityUpdatedNotification(
      entityType,
      entityId.toString(),
      {
        ...entityData,
        entityType,
        entityId: entityId.toString(),
        schoolId: user.schoolId,
        updatedBy: user.id,
        previousData
      },
      user.id,
      user.schoolId,
      user.createdByOwnerId
    );

    // Get recipient user IDs
    const recipientUserIds = await getUserIdsByRoles(['SCHOOL_ADMIN', 'TEACHER'], user.schoolId);

    // Create fallback notification if no rules are configured
    await createNotification({
      type: getNotificationType(entityType),
      title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Updated`,
      message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} has been updated successfully`,
      priority: 'NORMAL',
      status: 'PENDING',
      entityType,
      entityId: entityId.toString(),
      entityAction: 'updated',
      senderId: user.id,
      schoolId: user.schoolId,
      metadata: {
        entityType,
        entityId: entityId.toString(),
        updatedBy: user.id,
        updatedFields: Object.keys(entityData).filter(key => 
          entityData[key] !== previousData[key]
        ),
        ...options.auditDetails
      },
      recipients: recipientUserIds
    });

    console.log(`✅ Automatic notifications triggered for ${entityType} update: ${entityId}`);
  } catch (error) {
    console.error(`❌ Error triggering notifications for ${entityType} update:`, error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Trigger notifications for entity deletion
 * @param {string} entityType - Type of entity
 * @param {string|number} entityId - ID of the deleted entity
 * @param {Object} entityData - Deleted entity data
 * @param {Object} user - Current user performing the action
 * @param {Object} options - Additional options
 */
export const triggerEntityDeletedNotifications = async (
  entityType,
  entityId,
  entityData,
  user,
  options = {}
) => {
  try {
    // Create audit log
    await createAuditLog({
      action: 'DELETE',
      entity: entityType.charAt(0).toUpperCase() + entityType.slice(1),
      entityId: entityId.toString(),
      userId: user.id,
      schoolId: user.schoolId,
      details: {
        [`${entityType}Id`]: entityId.toString(),
        ...options.auditDetails
      }
    });

    // Trigger automatic notification (direct call to createNotification)
    const recipientUserIds = await getUserIdsByRoles(['SCHOOL_ADMIN', 'TEACHER'], user.schoolId);

    await createNotification({
      type: getNotificationType(entityType),
      title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Deleted`,
      message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} has been deleted`,
      recipients: recipientUserIds,
      schoolId: user.schoolId,
      metadata: {
        entityType,
        entityId: entityId.toString(),
        deletedBy: user.id
      }
    });

    console.log(`✅ Automatic notifications triggered for ${entityType} deletion: ${entityId}`);
  } catch (error) {
    console.error(`❌ Error triggering notifications for ${entityType} deletion:`, error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Trigger notifications for bulk operations
 * @param {string} entityType - Type of entity
 * @param {Array} entityIds - Array of entity IDs
 * @param {string} operation - Type of operation (CREATE, UPDATE, DELETE)
 * @param {Object} user - Current user performing the action
 * @param {Object} options - Additional options
 */
export const triggerBulkOperationNotifications = async (
  entityType,
  entityIds,
  operation,
  user,
  options = {}
) => {
  try {
    // Create audit log for bulk operation
    await createAuditLog({
      action: operation,
      entity: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)}_BULK`,
      entityId: entityIds.join(','),
      userId: user.id,
      schoolId: user.schoolId,
      details: {
        entityIds: entityIds,
        count: entityIds.length,
        operation,
        ...options.auditDetails
      }
    });

    // Get recipient user IDs
    const recipientUserIds = await getUserIdsByRoles(['SCHOOL_ADMIN', 'TEACHER'], user.schoolId);

    // Trigger bulk notification
    await createNotification({
      type: 'CREATION', // Use valid notification type
      title: `${operation} ${entityIds.length} ${entityType}s`,
      message: `Bulk ${operation.toLowerCase()} operation completed for ${entityIds.length} ${entityType}s`,
      recipients: recipientUserIds,
      schoolId: user.schoolId,
      metadata: {
        entityType,
        entityIds,
        operation,
        count: entityIds.length
      }
    });

    console.log(`✅ Bulk operation notifications triggered for ${entityIds.length} ${entityType}s`);
  } catch (error) {
    console.error(`❌ Error triggering bulk operation notifications:`, error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Trigger notifications for status changes
 * @param {string} entityType - Type of entity
 * @param {string|number} entityId - ID of the entity
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {Object} entityData - Entity data
 * @param {Object} user - Current user performing the action
 * @param {Object} options - Additional options
 */
export const triggerStatusChangeNotifications = async (
  entityType,
  entityId,
  oldStatus,
  newStatus,
  entityData,
  user,
  options = {}
) => {
  try {
    // Create audit log
    await createAuditLog({
      action: 'STATUS_CHANGE',
      entity: entityType.charAt(0).toUpperCase() + entityType.slice(1),
      entityId: entityId.toString(),
      userId: user.id,
      schoolId: user.schoolId,
      details: {
        [`${entityType}Id`]: entityId.toString(),
        oldStatus,
        newStatus,
        ...options.auditDetails
      }
    });

    // Get recipient user IDs
    const recipientUserIds = await getUserIdsByRoles(['SCHOOL_ADMIN', 'TEACHER'], user.schoolId);

    // Trigger status change notification
    await createNotification({
      type: 'UPDATE', // Use valid notification type
      title: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} Status Updated`,
      message: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} status changed from ${oldStatus} to ${newStatus}`,
      recipients: recipientUserIds,
      schoolId: user.schoolId,
      metadata: {
        entityType,
        entityId: entityId.toString(),
        oldStatus,
        newStatus
      }
    });

    console.log(`✅ Status change notifications triggered for ${entityType}: ${entityId}`);
  } catch (error) {
    console.error(`❌ Error triggering status change notifications:`, error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Trigger notifications for payment events
 * @param {string} paymentType - Type of payment (fee, refund, etc.)
 * @param {string|number} paymentId - Payment ID
 * @param {Object} paymentData - Payment data
 * @param {Object} user - Current user performing the action
 * @param {Object} options - Additional options
 */
export const triggerPaymentNotifications = async (
  paymentType,
  paymentId,
  paymentData,
  user,
  options = {}
) => {
  try {
    // Create audit log
    await createAuditLog({
      action: 'PAYMENT',
      entity: 'Payment',
      entityId: paymentId.toString(),
      userId: user.id,
      schoolId: user.schoolId,
      details: {
        paymentId: paymentId.toString(),
        paymentType,
        amount: paymentData.amount,
        ...options.auditDetails
      }
    });

    // Get recipient user IDs
    const recipientUserIds = await getUserIdsByRoles(['SCHOOL_ADMIN', 'FINANCE'], user.schoolId);

    // Trigger payment notification
    await createNotification({
      type: 'PAYMENT', // Use valid notification type
      title: `${paymentType.charAt(0).toUpperCase() + paymentType.slice(1)} Payment`,
      message: `${paymentType.charAt(0).toUpperCase() + paymentType.slice(1)} payment of ${paymentData.amount} has been processed`,
      recipients: recipientUserIds,
      schoolId: user.schoolId,
      metadata: {
        paymentType,
        paymentId: paymentId.toString(),
        amount: paymentData.amount
      }
    });

    console.log(`✅ Payment notifications triggered for ${paymentType}: ${paymentId}`);
  } catch (error) {
    console.error(`❌ Error triggering payment notifications:`, error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Trigger notifications for exam events
 * @param {string} examEvent - Type of exam event (created, updated, results)
 * @param {string|number} examId - Exam ID
 * @param {Object} examData - Exam data
 * @param {Object} user - Current user performing the action
 * @param {Object} options - Additional options
 */
export const triggerExamNotifications = async (
  examEvent,
  examId,
  examData,
  user,
  options = {}
) => {
  try {
    // Create audit log
    await createAuditLog({
      action: examEvent.toUpperCase(),
      entity: 'Exam',
      entityId: examId.toString(),
      userId: user.id,
      schoolId: user.schoolId,
      details: {
        examId: examId.toString(),
        examEvent,
        ...options.auditDetails
      }
    });

    // Get recipient user IDs
    const recipientUserIds = await getUserIdsByRoles(['SCHOOL_ADMIN', 'TEACHER', 'STUDENT'], user.schoolId);

    // Trigger exam notification
    await createNotification({
      type: 'EXAM', // Use valid notification type
      title: `Exam ${examEvent.charAt(0).toUpperCase() + examEvent.slice(1)}`,
      message: `Exam "${examData.name}" has been ${examEvent}`,
      recipients: recipientUserIds,
      schoolId: user.schoolId,
      metadata: {
        examId: examId.toString(),
        examEvent,
        examName: examData.name
      }
    });

    console.log(`✅ Exam notifications triggered for ${examEvent}: ${examId}`);
  } catch (error) {
    console.error(`❌ Error triggering exam notifications:`, error);
    // Don't throw error to avoid breaking the main operation
  }
};

export default {
  triggerEntityCreatedNotifications,
  triggerEntityUpdatedNotifications,
  triggerEntityDeletedNotifications,
  triggerBulkOperationNotifications,
  triggerStatusChangeNotifications,
  triggerPaymentNotifications,
  triggerExamNotifications,
  getUserIdsByRoles
}; 
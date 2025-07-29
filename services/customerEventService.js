import CustomerEvent from '../models/CustomerEvent.js';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createNotification } from './notificationService.js';

const prisma = new PrismaClient();

class CustomerEventService {
  constructor() {
    this.customerEventModel = new CustomerEvent();
  }

  /**
   * Create customer creation event
   */
  async createCustomerCreatedEvent(customerData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerData.id,
        eventType: 'CUSTOMER_CREATED',
        title: 'New Customer Created',
        description: `Customer ${customerData.name} has been created`,
        metadata: {
          customerName: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          serialNumber: customerData.serialNumber,
          referredBy: customerData.referredById,
          pipelineStage: customerData.pipelineStageId,
          totalSpent: customerData.totalSpent,
          orderCount: customerData.orderCount,
          type: customerData.type
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.customerEventModel.create(eventData);

      // Create notification
      await createNotification({
        title: 'New Customer Created',
        message: `Customer ${customerData.name} has been added to the system`,
        type: 'CUSTOMER_CREATED',
        userId: userId,
        schoolId: schoolId,
        metadata: {
          customerId: customerData.id,
          customerName: customerData.name
        }
      });

      return result;
    } catch (error) {
      logger.error('Error creating customer created event:', error);
      throw error;
    }
  }

  /**
   * Create customer update event
   */
  async createCustomerUpdatedEvent(customerData, updateData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerData.id,
        eventType: 'CUSTOMER_UPDATED',
        title: 'Customer Updated',
        description: `Customer ${customerData.name} has been updated`,
        metadata: {
          customerName: customerData.name,
          email: customerData.email,
          phone: customerData.phone,
          updatedFields: Object.keys(updateData),
          updateData: updateData,
          previousData: customerData
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.customerEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating customer updated event:', error);
      throw error;
    }
  }

  /**
   * Create customer conversion event
   */
  async createCustomerConversionEvent(customerId, studentId, conversionData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerId,
        eventType: 'CUSTOMER_CONVERTED_TO_STUDENT',
        title: 'Customer Converted to Student',
        description: `Customer has been successfully converted to student`,
        metadata: {
          studentId: studentId,
          conversionDate: new Date().toISOString(),
          conversionReason: conversionData.reason,
          conversionMethod: conversionData.method,
          classId: conversionData.classId,
          sectionId: conversionData.sectionId,
          admissionNo: conversionData.admissionNo,
          rollNo: conversionData.rollNo,
          previousCustomerData: conversionData.previousCustomerData
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'SUCCESS'
      };

      const result = await this.customerEventModel.create(eventData);

      // Create notification
      await createNotification({
        title: 'Customer Converted to Student',
        message: `Customer has been successfully converted to student with admission number ${conversionData.admissionNo}`,
        type: 'CUSTOMER_CONVERTED',
        userId: userId,
        schoolId: schoolId,
        metadata: {
          customerId: customerId,
          studentId: studentId,
          admissionNo: conversionData.admissionNo
        }
      });

      return result;
    } catch (error) {
      logger.error('Error creating customer conversion event:', error);
      throw error;
    }
  }

  /**
   * Create customer conversion failed event
   */
  async createCustomerConversionFailedEvent(customerId, failureData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerId,
        eventType: 'CUSTOMER_CONVERSION_FAILED',
        title: 'Customer Conversion Failed',
        description: `Failed to convert customer to student: ${failureData.reason}`,
        metadata: {
          failureReason: failureData.reason,
          failureDetails: failureData.details,
          attemptedAt: new Date().toISOString(),
          retryCount: failureData.retryCount || 0
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'WARNING'
      };

      const result = await this.customerEventModel.create(eventData);

      // Create notification
      await createNotification({
        title: 'Customer Conversion Failed',
        message: `Failed to convert customer to student: ${failureData.reason}`,
        type: 'CUSTOMER_CONVERSION_FAILED',
        userId: userId,
        schoolId: schoolId,
        metadata: {
          customerId: customerId,
          failureReason: failureData.reason
        }
      });

      return result;
    } catch (error) {
      logger.error('Error creating customer conversion failed event:', error);
      throw error;
    }
  }

  /**
   * Create customer interaction event
   */
  async createCustomerInteractionEvent(customerId, interactionData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerId,
        eventType: `CUSTOMER_${interactionData.type.toUpperCase()}`,
        title: `Customer ${interactionData.type}`,
        description: interactionData.description,
        metadata: {
          interactionType: interactionData.type,
          interactionMethod: interactionData.method,
          duration: interactionData.duration,
          outcome: interactionData.outcome,
          notes: interactionData.notes,
          followUpRequired: interactionData.followUpRequired,
          followUpDate: interactionData.followUpDate
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.customerEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating customer interaction event:', error);
      throw error;
    }
  }

  /**
   * Create customer payment event
   */
  async createCustomerPaymentEvent(customerId, paymentData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerId,
        eventType: 'CUSTOMER_PAYMENT',
        title: 'Customer Payment',
        description: `Payment of ${paymentData.amount} received`,
        metadata: {
          paymentId: paymentData.paymentId,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: paymentData.paymentStatus,
          transactionId: paymentData.transactionId,
          gatewayResponse: paymentData.gatewayResponse,
          items: paymentData.items
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'SUCCESS'
      };

      const result = await this.customerEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating customer payment event:', error);
      throw error;
    }
  }

  /**
   * Create customer refund event
   */
  async createCustomerRefundEvent(customerId, refundData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerId,
        eventType: 'CUSTOMER_REFUND',
        title: 'Customer Refund',
        description: `Refund of ${refundData.amount} processed`,
        metadata: {
          refundId: refundData.refundId,
          paymentId: refundData.paymentId,
          amount: refundData.amount,
          reason: refundData.reason,
          refundStatus: refundData.refundStatus,
          processedDate: refundData.processedDate,
          gatewayRefundId: refundData.gatewayRefundId
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.customerEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating customer refund event:', error);
      throw error;
    }
  }

  /**
   * Create customer status change event
   */
  async createCustomerStatusChangeEvent(customerId, statusData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerId,
        eventType: 'CUSTOMER_STATUS_CHANGED',
        title: 'Customer Status Changed',
        description: `Customer status changed from ${statusData.oldStatus} to ${statusData.newStatus}`,
        metadata: {
          oldStatus: statusData.oldStatus,
          newStatus: statusData.newStatus,
          reason: statusData.reason,
          changedBy: userId,
          effectiveDate: new Date().toISOString()
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.customerEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating customer status change event:', error);
      throw error;
    }
  }

  /**
   * Create customer pipeline stage change event
   */
  async createCustomerPipelineStageChangeEvent(customerId, pipelineData, userId, schoolId) {
    try {
      const eventData = {
        customerId: customerId,
        eventType: 'CUSTOMER_PIPELINE_STAGE_CHANGED',
        title: 'Customer Pipeline Stage Changed',
        description: `Customer moved from ${pipelineData.oldStage} to ${pipelineData.newStage}`,
        metadata: {
          oldStage: pipelineData.oldStage,
          newStage: pipelineData.newStage,
          oldStageId: pipelineData.oldStageId,
          newStageId: pipelineData.newStageId,
          reason: pipelineData.reason,
          movedBy: userId,
          movedAt: new Date().toISOString()
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.customerEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating customer pipeline stage change event:', error);
      throw error;
    }
  }

  /**
   * Get customer timeline with detailed events
   */
  async getCustomerTimeline(customerId, filters = {}) {
    try {
      const result = await this.customerEventModel.getCustomerTimeline(customerId, filters);
      return result;
    } catch (error) {
      logger.error('Error getting customer timeline:', error);
      throw error;
    }
  }

  /**
   * Get customer conversion history
   */
  async getCustomerConversionHistory(customerId) {
    try {
      const result = await this.customerEventModel.getConversionEvents(customerId);
      return result;
    } catch (error) {
      logger.error('Error getting customer conversion history:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(customerId) {
    try {
      const result = await this.customerEventModel.getCustomerAnalytics(customerId);
      return result;
    } catch (error) {
      logger.error('Error getting customer analytics:', error);
      throw error;
    }
  }

  /**
   * Get customer events with advanced filtering
   */
  async getCustomerEvents(customerId, filters = {}) {
    try {
      const result = await this.customerEventModel.getByCustomerId(customerId, filters);
      return result;
    } catch (error) {
      logger.error('Error getting customer events:', error);
      throw error;
    }
  }

  /**
   * Create bulk customer events
   */
  async createBulkCustomerEvents(events) {
    try {
      const createdEvents = [];
      
      for (const event of events) {
        const result = await this.customerEventModel.create(event);
        createdEvents.push(result.data);
      }

      logger.info(`Created ${createdEvents.length} customer events`);
      return { success: true, data: createdEvents };
    } catch (error) {
      logger.error('Error creating bulk customer events:', error);
      throw error;
    }
  }

  /**
   * Export customer events
   */
  async exportCustomerEvents(customerId, format = 'json') {
    try {
      const events = await this.customerEventModel.getByCustomerId(customerId);
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvData = events.data.map(event => ({
          Date: event.createdAt,
          Event_Type: event.eventType,
          Title: event.title,
          Description: event.description,
          Severity: event.severity,
          Created_By: event.createdByUser ? `${event.createdByUser.firstName} ${event.createdByUser.lastName}` : 'System'
        }));

        return { success: true, data: csvData, format: 'csv' };
      }

      return { success: true, data: events.data, format: 'json' };
    } catch (error) {
      logger.error('Error exporting customer events:', error);
      throw error;
    }
  }
}

export default CustomerEventService; 
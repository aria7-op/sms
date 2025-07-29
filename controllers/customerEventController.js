import CustomerEventService from '../services/customerEventService.js';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createSuccessResponse, createErrorResponse } from '../utils/responseUtils.js';

const prisma = new PrismaClient();
const customerEventService = new CustomerEventService();

class CustomerEventController {
  constructor() {
    this.customerEventService = customerEventService;
  }

  /**
   * Get customer timeline
   */
  async getCustomerTimeline(req, res) {
    try {
      const { customerId } = req.params;
      const { startDate, endDate, eventType } = req.query;
      const { schoolId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (eventType) filters.eventType = eventType;

      const result = await this.customerEventService.getCustomerTimeline(customerId, filters);

      return createSuccessResponse(res, 'Customer timeline retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting customer timeline:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve customer timeline');
    }
  }

  /**
   * Get customer conversion history
   */
  async getCustomerConversionHistory(req, res) {
    try {
      const { customerId } = req.params;
      const { schoolId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      const result = await this.customerEventService.getCustomerConversionHistory(customerId);

      return createSuccessResponse(res, 'Customer conversion history retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting customer conversion history:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve customer conversion history');
    }
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(req, res) {
    try {
      const { customerId } = req.params;
      const { schoolId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      const result = await this.customerEventService.getCustomerAnalytics(customerId);

      return createSuccessResponse(res, 'Customer analytics retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting customer analytics:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve customer analytics');
    }
  }

  /**
   * Get customer events with filtering
   */
  async getCustomerEvents(req, res) {
    try {
      const { customerId } = req.params;
      const { 
        eventType, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      const { schoolId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      const filters = {
        eventType,
        startDate,
        endDate,
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      };

      const result = await this.customerEventService.getCustomerEvents(customerId, filters);

      return createSuccessResponse(res, 'Customer events retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting customer events:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve customer events');
    }
  }

  /**
   * Create customer interaction event
   */
  async createCustomerInteraction(req, res) {
    try {
      const { customerId } = req.params;
      const interactionData = req.body;
      const { schoolId, id: userId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      const result = await this.customerEventService.createCustomerInteractionEvent(
        customerId,
        interactionData,
        userId,
        schoolId
      );

      return createSuccessResponse(res, 'Customer interaction event created successfully', result.data);
    } catch (error) {
      logger.error('Error creating customer interaction event:', error);
      return createErrorResponse(res, 500, 'Failed to create customer interaction event');
    }
  }

  /**
   * Create customer status change event
   */
  async createCustomerStatusChange(req, res) {
    try {
      const { customerId } = req.params;
      const statusData = req.body;
      const { schoolId, id: userId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      const result = await this.customerEventService.createCustomerStatusChangeEvent(
        customerId,
        statusData,
        userId,
        schoolId
      );

      return createSuccessResponse(res, 'Customer status change event created successfully', result.data);
    } catch (error) {
      logger.error('Error creating customer status change event:', error);
      return createErrorResponse(res, 500, 'Failed to create customer status change event');
    }
  }

  /**
   * Create customer pipeline stage change event
   */
  async createCustomerPipelineStageChange(req, res) {
    try {
      const { customerId } = req.params;
      const pipelineData = req.body;
      const { schoolId, id: userId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      const result = await this.customerEventService.createCustomerPipelineStageChangeEvent(
        customerId,
        pipelineData,
        userId,
        schoolId
      );

      return createSuccessResponse(res, 'Customer pipeline stage change event created successfully', result.data);
    } catch (error) {
      logger.error('Error creating customer pipeline stage change event:', error);
      return createErrorResponse(res, 500, 'Failed to create customer pipeline stage change event');
    }
  }

  /**
   * Export customer events
   */
  async exportCustomerEvents(req, res) {
    try {
      const { customerId } = req.params;
      const { format = 'json' } = req.query;
      const { schoolId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      const result = await this.customerEventService.exportCustomerEvents(customerId, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="customer_${customerId}_events.csv"`);
        
        // Convert to CSV string
        const headers = Object.keys(result.data[0] || {}).join(',');
        const rows = result.data.map(row => Object.values(row).join(','));
        const csvContent = [headers, ...rows].join('\n');
        
        return res.send(csvContent);
      }

      return createSuccessResponse(res, 'Customer events exported successfully', result.data);
    } catch (error) {
      logger.error('Error exporting customer events:', error);
      return createErrorResponse(res, 500, 'Failed to export customer events');
    }
  }

  /**
   * Get customer conversion analytics
   */
  async getCustomerConversionAnalytics(req, res) {
    try {
      const { customerId } = req.params;
      const { schoolId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      // Get conversion events
      const conversionEvents = await this.customerEventService.getCustomerConversionHistory(customerId);
      
      // Get all events for analytics
      const allEvents = await this.customerEventService.getCustomerEvents(customerId);
      
      // Calculate conversion metrics
      const conversionMetrics = {
        totalEvents: allEvents.data.length,
        conversionEvents: conversionEvents.data.length,
        conversionRate: allEvents.data.length > 0 ? 
          (conversionEvents.data.length / allEvents.data.length * 100).toFixed(2) : 0,
        lastConversionAttempt: conversionEvents.data[0]?.createdAt || null,
        conversionStatus: conversionEvents.data[0]?.eventType || 'NO_CONVERSION_ATTEMPT',
        conversionTimeline: conversionEvents.data.map(event => ({
          date: event.createdAt,
          type: event.eventType,
          description: event.description,
          metadata: event.metadata
        }))
      };

      return createSuccessResponse(res, 'Customer conversion analytics retrieved successfully', conversionMetrics);
    } catch (error) {
      logger.error('Error getting customer conversion analytics:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve customer conversion analytics');
    }
  }

  /**
   * Get customer interaction summary
   */
  async getCustomerInteractionSummary(req, res) {
    try {
      const { customerId } = req.params;
      const { schoolId } = req.user;

      // Verify customer exists and belongs to school
      const customer = await prisma.customer.findFirst({
        where: {
          id: BigInt(customerId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!customer) {
        return createErrorResponse(res, 404, 'Customer not found');
      }

      // Get all customer events
      const allEvents = await this.customerEventService.getCustomerEvents(customerId);
      
      // Filter interaction events
      const interactionEvents = allEvents.data.filter(event => 
        event.eventType.includes('CUSTOMER_CONTACTED') ||
        event.eventType.includes('CUSTOMER_MEETING') ||
        event.eventType.includes('CUSTOMER_CALL') ||
        event.eventType.includes('CUSTOMER_EMAIL')
      );

      // Calculate interaction summary
      const interactionSummary = {
        totalInteractions: interactionEvents.length,
        lastInteraction: interactionEvents[0]?.createdAt || null,
        interactionTypes: interactionEvents.reduce((acc, event) => {
          const type = event.eventType.replace('CUSTOMER_', '');
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {}),
        recentInteractions: interactionEvents.slice(0, 5).map(event => ({
          date: event.createdAt,
          type: event.eventType,
          description: event.description,
          createdBy: event.createdByUser
        }))
      };

      return createSuccessResponse(res, 'Customer interaction summary retrieved successfully', interactionSummary);
    } catch (error) {
      logger.error('Error getting customer interaction summary:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve customer interaction summary');
    }
  }
}

export default CustomerEventController; 
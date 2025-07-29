import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

class CustomerEvent {
  constructor() {
    this.prisma = prisma;
  }

  /**
   * Create a new customer event
   */
  async create(eventData) {
    try {
      const event = await this.prisma.customerEvent.create({
        data: {
          ...eventData,
          metadata: eventData.metadata ? JSON.stringify(eventData.metadata, (key, value) => typeof value === 'bigint' ? value.toString() : value) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info(`Customer event created: ${event.id} - ${event.eventType}`);
      return { success: true, data: event };
    } catch (error) {
      logger.error('Error creating customer event:', error);
      throw error;
    }
  }

  /**
   * Get customer events with filtering and pagination
   */
  async getAll(filters = {}) {
    try {
      const {
        customerId,
        eventType,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const whereClause = {};
      
      if (customerId) whereClause.customerId = BigInt(customerId);
      if (eventType) whereClause.eventType = eventType;
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = new Date(startDate);
        if (endDate) whereClause.createdAt.lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;
      
      const [events, total] = await Promise.all([
        this.prisma.customerEvent.findMany({
          where: whereClause,
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                serialNumber: true,
                email: true,
                phone: true
              }
            },
            createdByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        this.prisma.customerEvent.count({ where: whereClause })
      ]);

      return {
        success: true,
        data: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting customer events:', error);
      throw error;
    }
  }

  /**
   * Get customer events by customer ID
   */
  async getByCustomerId(customerId, filters = {}) {
    try {
      const events = await this.prisma.customerEvent.findMany({
        where: {
          customerId: BigInt(customerId),
          ...filters
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
        },
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, data: events };
    } catch (error) {
      logger.error('Error getting customer events by customer ID:', error);
      throw error;
    }
  }

  /**
   * Get customer conversion events
   */
  async getConversionEvents(customerId) {
    try {
      const events = await this.prisma.customerEvent.findMany({
        where: {
          customerId: BigInt(customerId),
          eventType: {
            in: ['CUSTOMER_CONVERTED_TO_STUDENT', 'CUSTOMER_CONVERSION_FAILED', 'CUSTOMER_CONVERSION_PENDING']
          }
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
        },
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, data: events };
    } catch (error) {
      logger.error('Error getting customer conversion events:', error);
      throw error;
    }
  }

  /**
   * Get customer timeline
   */
  async getCustomerTimeline(customerId, filters = {}) {
    try {
      const events = await this.prisma.customerEvent.findMany({
        where: {
          customerId: BigInt(customerId),
          ...filters
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
        },
        orderBy: { createdAt: 'desc' }
      });

      // Group events by date
      const timeline = events.reduce((acc, event) => {
        const date = event.createdAt.toISOString().split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
      }, {});

      return { success: true, data: timeline };
    } catch (error) {
      logger.error('Error getting customer timeline:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(customerId) {
    try {
      const [
        totalEvents,
        conversionEvents,
        interactionEvents,
        financialEvents,
        recentEvents
      ] = await Promise.all([
        this.prisma.customerEvent.count({
          where: { customerId: BigInt(customerId) }
        }),
        this.prisma.customerEvent.count({
          where: {
            customerId: BigInt(customerId),
            eventType: {
              in: ['CUSTOMER_CONVERTED_TO_STUDENT', 'CUSTOMER_CONVERSION_FAILED']
            }
          }
        }),
        this.prisma.customerEvent.count({
          where: {
            customerId: BigInt(customerId),
            eventType: {
              in: ['CUSTOMER_CONTACTED', 'CUSTOMER_MEETING', 'CUSTOMER_CALL', 'CUSTOMER_EMAIL']
            }
          }
        }),
        this.prisma.customerEvent.count({
          where: {
            customerId: BigInt(customerId),
            eventType: {
              in: ['CUSTOMER_PAYMENT', 'CUSTOMER_REFUND', 'CUSTOMER_INSTALLMENT']
            }
          }
        }),
        this.prisma.customerEvent.findMany({
          where: { customerId: BigInt(customerId) },
          take: 10,
          orderBy: { createdAt: 'desc' }
        })
      ]);

      return {
        success: true,
        data: {
          totalEvents,
          conversionEvents,
          interactionEvents,
          financialEvents,
          recentEvents
        }
      };
    } catch (error) {
      logger.error('Error getting customer analytics:', error);
      throw error;
    }
  }

  /**
   * Delete customer events
   */
  async deleteByCustomerId(customerId) {
    try {
      await this.prisma.customerEvent.deleteMany({
        where: { customerId: BigInt(customerId) }
      });

      logger.info(`Deleted all events for customer: ${customerId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting customer events:', error);
      throw error;
    }
  }
}

export default CustomerEvent; 
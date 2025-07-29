import { PrismaClient } from '../generated/prisma/client.js';
import { logger } from '../config/logger.js';
import { validateFeeItemCreate, validateFeeItemUpdate } from '../validators/feeItemValidator.js';

const prisma = new PrismaClient();

class FeeItemService {
  constructor() {
    // Initialize any dependencies here
  }

  /**
   * Create a new fee item
   */
  async createFeeItem(feeItemData) {
    try {
      // Validate input data
      const validation = validateFeeItemCreate(feeItemData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Verify fee structure exists and belongs to the same school
      await this.verifyFeeStructure(
        feeItemData.feeStructureId, 
        feeItemData.schoolId
      );

      // Create the fee item
      const newFeeItem = await prisma.feeItem.create({
        data: {
          feeStructureId: BigInt(feeItemData.feeStructureId),
          name: feeItemData.name,
          amount: parseFloat(feeItemData.amount),
          isOptional: feeItemData.isOptional || false,
          dueDate: feeItemData.dueDate ? new Date(feeItemData.dueDate) : null,
          schoolId: BigInt(feeItemData.schoolId),
          createdBy: BigInt(feeItemData.createdBy),
          updatedBy: feeItemData.updatedBy ? BigInt(feeItemData.updatedBy) : null
        },
        include: {
          feeStructure: true,
          school: true,
          createdByUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      logger.info(`Fee item created: ${newFeeItem.id}`);
      return {
        success: true,
        data: this.transformBigInt(newFeeItem)
      };

    } catch (error) {
      logger.error(`Error creating fee item: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get fee item by ID
   */
  async getFeeItemById(id, schoolId) {
    try {
      const feeItem = await prisma.feeItem.findUnique({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: {
          feeStructure: true,
          school: true,
          createdByUser: {
            select: {
              id: true,
              name: true
            }
          },
          updatedByUser: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!feeItem) {
        throw new Error('Fee item not found');
      }

      return {
        success: true,
        data: this.transformBigInt(feeItem)
      };
    } catch (error) {
      logger.error(`Error getting fee item: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update fee item
   */
  async updateFeeItem(id, feeItemData, schoolId) {
    try {
      // Validate input data
      const validation = validateFeeItemUpdate(feeItemData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if fee item exists
      const existingItem = await prisma.feeItem.findFirst({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!existingItem) {
        throw new Error('Fee item not found');
      }

      // Verify fee structure if being updated
      if (feeItemData.feeStructureId) {
        await this.verifyFeeStructure(
          feeItemData.feeStructureId, 
          schoolId
        );
      }

      // Update the fee item
      const updatedItem = await prisma.feeItem.update({
        where: { id: BigInt(id) },
        data: {
          name: feeItemData.name,
          amount: feeItemData.amount ? parseFloat(feeItemData.amount) : undefined,
          isOptional: feeItemData.isOptional,
          dueDate: feeItemData.dueDate ? new Date(feeItemData.dueDate) : null,
          feeStructureId: feeItemData.feeStructureId ? BigInt(feeItemData.feeStructureId) : undefined,
          updatedBy: BigInt(feeItemData.updatedBy),
          updatedAt: new Date()
        },
        include: {
          feeStructure: true,
          school: true
        }
      });

      logger.info(`Fee item updated: ${id}`);
      return {
        success: true,
        data: this.transformBigInt(updatedItem)
      };

    } catch (error) {
      logger.error(`Error updating fee item: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete fee item (soft delete)
   */
  async deleteFeeItem(id, schoolId, deletedBy) {
    try {
      // Check if fee item exists
      const existingItem = await prisma.feeItem.findFirst({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!existingItem) {
        throw new Error('Fee item not found');
      }

      // Check for associated payment items
      const paymentItemsCount = await prisma.paymentItem.count({
        where: {
          feeItemId: BigInt(id),
          deletedAt: null
        }
      });

      if (paymentItemsCount > 0) {
        throw new Error('Cannot delete fee item with associated payment items');
      }

      // Soft delete the fee item
      await prisma.feeItem.update({
        where: { id: BigInt(id) },
        data: {
          deletedAt: new Date(),
          updatedBy: BigInt(deletedBy)
        }
      });

      logger.info(`Fee item deleted: ${id}`);
      return { success: true, message: 'Fee item deleted successfully' };

    } catch (error) {
      logger.error(`Error deleting fee item: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all fee items with filtering and pagination
   */
  async getAllFeeItems(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        schoolId,
        feeStructureId,
        isOptional,
        search
      } = filters;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {
        deletedAt: null,
        ...(schoolId && { schoolId: BigInt(schoolId) }),
        ...(feeStructureId && { feeStructureId: BigInt(feeStructureId) }),
        ...(isOptional !== undefined && { isOptional }),
        ...(search && {
          name: { contains: search, mode: 'insensitive' }
        })
      };

      // Get total count
      const total = await prisma.feeItem.count({ where });

      // Get fee items
      const feeItems = await prisma.feeItem.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          feeStructure: true,
          school: true
        }
      });

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: this.transformBigInt(feeItems),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      };

    } catch (error) {
      logger.error(`Error getting fee items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get fee items by fee structure
   */
  async getFeeItemsByStructure(feeStructureId, schoolId) {
    try {
      const feeItems = await prisma.feeItem.findMany({
        where: {
          feeStructureId: BigInt(feeStructureId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        orderBy: { name: 'asc' },
        include: {
          feeStructure: true
        }
      });

      return {
        success: true,
        data: this.transformBigInt(feeItems)
      };

    } catch (error) {
      logger.error(`Error getting fee items by structure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get fee items by school with optional filters
   */
  async getFeeItemsBySchool(schoolId, filters = {}) {
    try {
      const { isOptional, dueDate } = filters;

      const feeItems = await prisma.feeItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          ...(isOptional !== undefined && { isOptional }),
          ...(dueDate && { dueDate: new Date(dueDate) })
        },
        orderBy: { name: 'asc' },
        include: {
          feeStructure: {
            include: {
              class: true
            }
          }
        }
      });

      return {
        success: true,
        data: this.transformBigInt(feeItems)
      };

    } catch (error) {
      logger.error(`Error getting fee items by school: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get upcoming due fee items
   */
  async getUpcomingDueItems(schoolId, days = 30) {
    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + days);

      const feeItems = await prisma.feeItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          dueDate: {
            gte: today,
            lte: endDate
          },
          deletedAt: null
        },
        orderBy: { dueDate: 'asc' },
        include: {
          feeStructure: {
            include: {
              class: true
            }
          }
        }
      });

      return {
        success: true,
        data: this.transformBigInt(feeItems)
      };

    } catch (error) {
      logger.error(`Error getting upcoming due fee items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get overdue fee items
   */
  async getOverdueItems(schoolId) {
    try {
      const today = new Date();

      const feeItems = await prisma.feeItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          dueDate: {
            lt: today,
            not: null
          },
          deletedAt: null
        },
        orderBy: { dueDate: 'asc' },
        include: {
          feeStructure: {
            include: {
              class: true
            }
          }
        }
      });

      return {
        success: true,
        data: this.transformBigInt(feeItems)
      };

    } catch (error) {
      logger.error(`Error getting overdue fee items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Verify fee structure exists and belongs to the same school
   */
  async verifyFeeStructure(feeStructureId, schoolId) {
    const feeStructure = await prisma.feeStructure.findFirst({
      where: {
        id: BigInt(feeStructureId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (!feeStructure) {
      throw new Error('Fee structure not found or does not belong to this school');
    }
  }

  /**
   * Transform BigInt values to strings for JSON serialization
   */
  transformBigInt(data) {
    if (Array.isArray(data)) {
      return data.map(item => this.transformBigInt(item));
    } else if (data !== null && typeof data === 'object') {
      return Object.fromEntries(
        Object.entries(data).map(([key, value]) => {
          if (typeof value === 'bigint') {
            return [key, value.toString()];
          } else if (value !== null && typeof value === 'object') {
            return [key, this.transformBigInt(value)];
          }
          return [key, value];
        })
      );
    }
    return data;
  }
}

// Export as a singleton instance
export default new FeeItemService();
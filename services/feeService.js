import { PrismaClient } from '../generated/prisma/client.js';
import { logger } from '../config/logger.js';
import { validateFeeStructure } from '../validators/feeValidator.js';

const prisma = new PrismaClient();

class FeeService {
  constructor() {
    // Initialize any dependencies here
  }

  /**
   * Create a new fee structure
   */
  async createFeeStructure(feeData) {
    try {
      // Validate input data
      const validation = validateFeeStructure(feeData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for existing default structure
      if (feeData.isDefault) {
        await this.checkExistingDefaultStructure(feeData.schoolId, feeData.classId);
      }

      // Create the fee structure
      const newFeeStructure = await prisma.feeStructure.create({
        data: {
          name: feeData.name,
          description: feeData.description,
          classId: feeData.classId ? BigInt(feeData.classId) : null,
          isDefault: feeData.isDefault || false,
          schoolId: BigInt(feeData.schoolId),
          createdBy: BigInt(feeData.createdBy),
          updatedBy: feeData.updatedBy ? BigInt(feeData.updatedBy) : null
        },
        include: {
          school: true,
          class: true,
          items: true
        }
      });

      logger.info(`Fee structure created: ${newFeeStructure.id}`);
      return {
        success: true,
        data: this.transformBigInt(newFeeStructure)
      };

    } catch (error) {
      logger.error(`Error creating fee structure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get fee structure by ID
   */
  async getFeeStructureById(id, schoolId) {
    try {
      const feeStructure = await prisma.feeStructure.findUnique({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: {
          school: true,
          class: true,
          items: {
            where: {
              deletedAt: null
            }
          }
        }
      });

      if (!feeStructure) {
        throw new Error('Fee structure not found');
      }

      return {
        success: true,
        data: this.transformBigInt(feeStructure)
      };
    } catch (error) {
      logger.error(`Error getting fee structure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update fee structure
   */
  async updateFeeStructure(id, feeData, schoolId) {
    try {
      // Validate input data
      const validation = validateFeeStructure(feeData, true);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check if fee structure exists
      const existingStructure = await prisma.feeStructure.findFirst({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!existingStructure) {
        throw new Error('Fee structure not found');
      }

      // Check for existing default structure if updating to default
      if (feeData.isDefault && feeData.isDefault !== existingStructure.isDefault) {
        await this.checkExistingDefaultStructure(schoolId, feeData.classId, id);
      }

      // Update the fee structure
      const updatedStructure = await prisma.feeStructure.update({
        where: { id: BigInt(id) },
        data: {
          name: feeData.name,
          description: feeData.description,
          classId: feeData.classId ? BigInt(feeData.classId) : null,
          isDefault: feeData.isDefault,
          updatedBy: BigInt(feeData.updatedBy),
          updatedAt: new Date()
        },
        include: {
          school: true,
          class: true,
          items: true
        }
      });

      logger.info(`Fee structure updated: ${id}`);
      return {
        success: true,
        data: this.transformBigInt(updatedStructure)
      };

    } catch (error) {
      logger.error(`Error updating fee structure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete fee structure (soft delete)
   */
  async deleteFeeStructure(id, schoolId, deletedBy) {
    try {
      // Check if fee structure exists
      const existingStructure = await prisma.feeStructure.findFirst({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!existingStructure) {
        throw new Error('Fee structure not found');
      }

      // Check for associated payments
      const paymentCount = await prisma.payment.count({
        where: {
          feeStructureId: BigInt(id),
          deletedAt: null
        }
      });

      if (paymentCount > 0) {
        throw new Error('Cannot delete fee structure with associated payments');
      }

      // Soft delete the fee structure
      await prisma.feeStructure.update({
        where: { id: BigInt(id) },
        data: {
          deletedAt: new Date(),
          updatedBy: BigInt(deletedBy)
        }
      });

      logger.info(`Fee structure deleted: ${id}`);
      return { success: true, message: 'Fee structure deleted successfully' };

    } catch (error) {
      logger.error(`Error deleting fee structure: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all fee structures with filtering and pagination
   */
  async getAllFeeStructures(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        schoolId,
        classId,
        isDefault,
        search
      } = filters;

      const skip = (page - 1) * limit;

      // Build where clause
      const where = {
        deletedAt: null,
        ...(schoolId && { schoolId: BigInt(schoolId) }),
        ...(classId && { classId: BigInt(classId) }),
        ...(isDefault !== undefined && { isDefault }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        })
      };

      // Get total count
      const total = await prisma.feeStructure.count({ where });

      // Get fee structures
      const feeStructures = await prisma.feeStructure.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          school: true,
          class: true
        }
      });

      const totalPages = Math.ceil(total / limit);

      return {
        success: true,
        data: this.transformBigInt(feeStructures),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages
        }
      };

    } catch (error) {
      logger.error(`Error getting fee structures: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get applicable fee structures for a class
   * (both class-specific and school-wide default structures)
   */
  async getApplicableFeeStructures(schoolId, classId) {
    try {
      const feeStructures = await prisma.feeStructure.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          OR: [
            { classId: BigInt(classId) },
            { isDefault: true, classId: null }
          ]
        },
        orderBy: [
          { isDefault: 'asc' }, // Class-specific first
          { name: 'asc' }
        ],
        include: {
          items: {
            where: {
              deletedAt: null
            }
          }
        }
      });

      return {
        success: true,
        data: this.transformBigInt(feeStructures)
      };

    } catch (error) {
      logger.error(`Error getting applicable fee structures: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check for existing default fee structure
   */
  async checkExistingDefaultStructure(schoolId, classId, excludeId = null) {
    const where = {
      schoolId: BigInt(schoolId),
      isDefault: true,
      deletedAt: null,
      ...(classId && { classId: BigInt(classId) }),
      ...(excludeId && { NOT: { id: BigInt(excludeId) } })
    };

    const existingDefault = await prisma.feeStructure.findFirst({ where });

    if (existingDefault) {
      throw new Error('A default fee structure already exists for this class/school');
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
export default new FeeService();
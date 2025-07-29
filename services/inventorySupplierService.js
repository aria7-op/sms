import {PrismaClient} from '../generated/prisma';
import RedisClient from '../cache/redisClient';
import {ValidationError, NotFoundError, BusinessLogicError} from '../utils/errors';
import {validateSupplierData, validateSupplierUpdate} from '../utils/validation/supplierValidation';
import {generateSupplierCode, calculateSupplierRating} from '../utils/supplierUtils';
import logger from '../utils/logger';
import {cacheKeys, CACHE_TTL} from '../utils/cacheKeys';

class InventorySupplierService {
  constructor(prisma, redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Create a new supplier with advanced validation and business logic
   */
  async createSupplier(data, schoolId, userId) {
    try {
      // Validate input data
      const validatedData = await validateSupplierData(data);
      
      // Check for duplicate supplier
      const existingSupplier = await this.prisma.inventorySupplier.findFirst({
        where: {
          OR: [
            { email: validatedData.email },
            { phone: validatedData.phone },
            { taxId: validatedData.taxId }
          ],
          schoolId,
          deletedAt: null
        }
      });

      if (existingSupplier) {
        throw new BusinessLogicError('Supplier with this email, phone, or tax ID already exists');
      }

      // Generate supplier code if not provided
      if (!validatedData.code) {
        validatedData.code = await generateSupplierCode(this.prisma, schoolId);
      }

      // Create supplier with audit trail
      const supplier = await this.prisma.inventorySupplier.create({
        data: {
          ...validatedData,
          schoolId,
          createdBy: userId,
          updatedBy: userId,
          rating: validatedData.rating || 3, // Default rating
          status: validatedData.status || 'ACTIVE'
        },
        include: {
          school: {
            select: { name: true, uuid: true }
          },
          createdByUser: {
            select: { name: true, email: true }
          }
        }
      });

      // Invalidate cache
      await this.invalidateSupplierCache(schoolId);

      // Log the creation
      logger.info(`Supplier created: ${supplier.name} (ID: ${supplier.id}) by user ${userId}`);

      return supplier;
    } catch (error) {
      logger.error('Error creating supplier:', error);
      throw error;
    }
  }

  /**
   * Get suppliers with advanced filtering, pagination, and caching
   */
  async getSuppliers(schoolId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        rating,
        categoryId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      // Build cache key
      const cacheKey = cacheKeys.suppliers.list(schoolId, filters);
      
      // Try to get from cache
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build where clause
      const where = {
        schoolId,
        deletedAt: null
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (status) {
        where.status = status;
      }

      if (rating) {
        where.rating = { gte: rating };
      }

      if (categoryId) {
        where.categories = {
          some: { id: categoryId }
        };
      }

      // Execute query with pagination
      const [suppliers, total] = await Promise.all([
        this.prisma.inventorySupplier.findMany({
          where,
          include: {
            school: {
              select: { name: true, uuid: true }
            },
            categories: {
              select: { id: true, name: true, code: true }
            },
            _count: {
              select: {
                items: true,
                purchaseOrders: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.inventorySupplier.count({ where })
      ]);

      const result = {
        suppliers,
        total,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };

      // Cache the result
      await this.redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error('Error getting suppliers:', error);
      throw error;
    }
  }

  /**
   * Get supplier by ID with detailed information and caching
   */
  async getSupplierById(id, schoolId) {
    try {
      // Try to get from cache
      const cacheKey = cacheKeys.suppliers.detail(id, schoolId);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const supplier = await this.prisma.inventorySupplier.findFirst({
        where: {
          id,
          schoolId,
          deletedAt: null
        },
        include: {
          school: {
            select: { name: true, uuid: true }
          },
          categories: {
            select: { id: true, name: true, code: true }
          },
          items: {
            select: {
              id: true,
              name: true,
              sku: true,
              quantity: true,
              status: true
            },
            take: 10
          },
          purchaseOrders: {
            select: {
              id: true,
              poNumber: true,
              status: true,
              totalAmount: true,
              orderDate: true
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          createdByUser: {
            select: { name: true, email: true }
          },
          updatedByUser: {
            select: { name: true, email: true }
          }
        }
      });

      if (!supplier) {
        throw new NotFoundError('Supplier not found');
      }

      // Cache the result
      await this.redis.setex(cacheKey, CACHE_TTL.MEDIUM, JSON.stringify(supplier));

      return supplier;
    } catch (error) {
      logger.error(`Error getting supplier ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update supplier with validation and audit trail
   */
  async updateSupplier(id, data, schoolId, userId) {
    try {
      // Validate input data
      const validatedData = await validateSupplierUpdate(data);

      // Check if supplier exists
      const existingSupplier = await this.prisma.inventorySupplier.findFirst({
        where: { id, schoolId, deletedAt: null }
      });

      if (!existingSupplier) {
        throw new NotFoundError('Supplier not found');
      }

      // Check for duplicate email/phone if being updated
      if (validatedData.email || validatedData.phone || validatedData.taxId) {
        const duplicate = await this.prisma.inventorySupplier.findFirst({
          where: {
            OR: [
              ...(validatedData.email ? [{ email: validatedData.email }] : []),
              ...(validatedData.phone ? [{ phone: validatedData.phone }] : []),
              ...(validatedData.taxId ? [{ taxId: validatedData.taxId }] : [])
            ],
            schoolId,
            id: { not: id },
            deletedAt: null
          }
        });

        if (duplicate) {
          throw new BusinessLogicError('Supplier with this email, phone, or tax ID already exists');
        }
      }

      // Update supplier
      const supplier = await this.prisma.inventorySupplier.update({
        where: { id },
        data: {
          ...validatedData,
          updatedBy: userId,
          updatedAt: new Date()
        },
        include: {
          school: {
            select: { name: true, uuid: true }
          },
          categories: {
            select: { id: true, name: true, code: true }
          },
          updatedByUser: {
            select: { name: true, email: true }
          }
        }
      });

      // Invalidate cache
      await this.invalidateSupplierCache(schoolId, id);

      // Log the update
      logger.info(`Supplier updated: ${supplier.name} (ID: ${supplier.id}) by user ${userId}`);

      return supplier;
    } catch (error) {
      logger.error(`Error updating supplier ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete supplier with soft delete and validation
   */
  async deleteSupplier(id, schoolId, userId) {
    try {
      // Check if supplier exists
      const supplier = await this.prisma.inventorySupplier.findFirst({
        where: { id, schoolId, deletedAt: null },
        include: {
          _count: {
            select: {
              items: true,
              purchaseOrders: true
            }
          }
        }
      });

      if (!supplier) {
        throw new NotFoundError('Supplier not found');
      }

      // Check if supplier has active items or purchase orders
      if (supplier._count.items > 0) {
        throw new BusinessLogicError('Cannot delete supplier with active inventory items');
      }

      if (supplier._count.purchaseOrders > 0) {
        throw new BusinessLogicError('Cannot delete supplier with active purchase orders');
      }

      // Soft delete
      await this.prisma.inventorySupplier.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedBy: userId
        }
      });

      // Invalidate cache
      await this.invalidateSupplierCache(schoolId, id);

      // Log the deletion
      logger.info(`Supplier deleted: ${supplier.name} (ID: ${supplier.id}) by user ${userId}`);
    } catch (error) {
      logger.error(`Error deleting supplier ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get supplier analytics and performance metrics
   */
  async getSupplierAnalytics(schoolId, filters = {}) {
    try {
      const { startDate, endDate, supplierId } = filters;

      // Build cache key
      const cacheKey = cacheKeys.suppliers.analytics(schoolId, filters);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const whereClause = {
        schoolId,
        deletedAt: null
      };

      if (supplierId) {
        whereClause.id = supplierId;
      }

      // Get supplier statistics
      const [
        totalSuppliers,
        activeSuppliers,
        suppliersByRating,
        topSuppliers,
        recentOrders,
        supplierPerformance
      ] = await Promise.all([
        // Total suppliers
        this.prisma.inventorySupplier.count({ where: whereClause }),
        
        // Active suppliers
        this.prisma.inventorySupplier.count({
          where: { ...whereClause, status: 'ACTIVE' }
        }),

        // Suppliers by rating
        this.prisma.inventorySupplier.groupBy({
          by: ['rating'],
          where: whereClause,
          _count: { rating: true }
        }),

        // Top suppliers by purchase orders
        this.prisma.inventorySupplier.findMany({
          where: whereClause,
          include: {
            _count: {
              select: { purchaseOrders: true }
            },
            purchaseOrders: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate
                }
              },
              select: { totalAmount: true }
            }
          },
          orderBy: {
            purchaseOrders: { _count: 'desc' }
          },
          take: 10
        }),

        // Recent purchase orders
        this.prisma.purchaseOrder.findMany({
          where: {
            supplier: whereClause,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            supplier: {
              select: { name: true, code: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),

        // Supplier performance metrics
        this.prisma.purchaseOrder.groupBy({
          by: ['supplierId'],
          where: {
            supplier: whereClause,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          _sum: {
            totalAmount: true
          },
          _count: {
            id: true
          }
        })
      ]);

      const analytics = {
        summary: {
          totalSuppliers,
          activeSuppliers,
          inactiveSuppliers: totalSuppliers - activeSuppliers,
          averageRating: await this.calculateAverageRating(schoolId)
        },
        ratingDistribution: suppliersByRating,
        topSuppliers: topSuppliers.map(s => ({
          ...s,
          totalSpent: s.purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount), 0)
        })),
        recentOrders,
        performance: supplierPerformance
      };

      // Cache the result
      await this.redis.setex(cacheKey, CACHE_TTL.SHORT, JSON.stringify(analytics));

      return analytics;
    } catch (error) {
      logger.error('Error getting supplier analytics:', error);
      throw error;
    }
  }

  /**
   * Bulk operations for suppliers
   */
  async bulkUpdateSuppliers(supplierIds, updates, schoolId, userId) {
    try {
      const errors = [];
      let updated = 0;
      let failed = 0;

      for (const supplierId of supplierIds) {
        try {
          await this.updateSupplier(supplierId, updates, schoolId, userId);
          updated++;
        } catch (error) {
          failed++;
          errors.push(`Supplier ${supplierId}: ${error.message}`);
        }
      }

      // Invalidate cache
      await this.invalidateSupplierCache(schoolId);

      return { updated, failed, errors };
    } catch (error) {
      logger.error('Error in bulk update suppliers:', error);
      throw error;
    }
  }

  /**
   * Import suppliers from CSV/Excel
   */
  async importSuppliers(suppliers, schoolId, userId) {
    try {
      const errors = [];
      let imported = 0;
      let failed = 0;

      for (const [index, supplierData] of suppliers.entries()) {
        try {
          await this.createSupplier(supplierData, schoolId, userId);
          imported++;
        } catch (error) {
          failed++;
          errors.push(`Row ${index + 1}: ${error.message}`);
        }
      }

      // Invalidate cache
      await this.invalidateSupplierCache(schoolId);

      return { imported, failed, errors };
    } catch (error) {
      logger.error('Error importing suppliers:', error);
      throw error;
    }
  }

  /**
   * Export suppliers to various formats
   */
  async exportSuppliers(schoolId, format = 'csv', filters = {}) {
    try {
      const suppliers = await this.getSuppliers(schoolId, { ...filters, limit: 10000 });

      switch (format) {
        case 'csv':
          return this.convertToCSV(suppliers.suppliers);
        case 'excel':
          return this.convertToExcel(suppliers.suppliers);
        case 'json':
          return JSON.stringify(suppliers.suppliers, null, 2);
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      logger.error('Error exporting suppliers:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  async invalidateSupplierCache(schoolId, supplierId) {
    const keys = [
      cacheKeys.suppliers.list(schoolId),
      cacheKeys.suppliers.analytics(schoolId)
    ];

    if (supplierId) {
      keys.push(cacheKeys.suppliers.detail(supplierId, schoolId));
    }

    await Promise.all(keys.map(key => this.redis.del(key)));
  }

  async calculateAverageRating(schoolId) {
    const result = await this.prisma.inventorySupplier.aggregate({
      where: { schoolId, deletedAt: null },
      _avg: { rating: true }
    });

    return result._avg.rating || 0;
  }

  convertToCSV(suppliers) {
    const headers = ['ID', 'Name', 'Code', 'Contact Person', 'Email', 'Phone', 'Status', 'Rating'];
    const rows = suppliers.map(s => [
      s.id,
      s.name,
      s.code,
      s.contactPerson,
      s.email,
      s.phone,
      s.status,
      s.rating
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  convertToExcel(suppliers) {
    // Implementation for Excel conversion
    // This would typically use a library like xlsx
    return JSON.stringify(suppliers);
  }
}

export default InventorySupplierService; 
import logger from '../utils/logger';

class InventoryLogService {
  constructor(prisma, redis) {
    this.prisma = prisma;
    this.redis = redis;
  }

  /**
   * Create a new inventory log entry with advanced validation and business logic
   */
  async createInventoryLog(data, schoolId, userId) {
    try {
      // Validate input data
      const validatedData = await this.validateInventoryLogData(data);
      
      // Get current item quantity
      const item = await this.prisma.inventoryItem.findFirst({
        where: { id: validatedData.itemId, schoolId, deletedAt: null }
      });

      if (!item) {
        throw new Error('Inventory item not found');
      }

      const previousQuantity = item.quantity;
      let newQuantity = previousQuantity;

      // Calculate new quantity based on transaction type
      switch (validatedData.type) {
        case 'PURCHASE':
        case 'ADJUSTMENT':
          newQuantity = previousQuantity + validatedData.quantity;
          break;
        case 'SALE':
        case 'TRANSFER_OUT':
          if (previousQuantity < validatedData.quantity) {
            throw new Error('Insufficient stock for this transaction');
          }
          newQuantity = previousQuantity - validatedData.quantity;
          break;
        case 'TRANSFER_IN':
          newQuantity = previousQuantity + validatedData.quantity;
          break;
        case 'RETURN':
          newQuantity = previousQuantity + validatedData.quantity;
          break;
        case 'DAMAGE':
        case 'LOSS':
          if (previousQuantity < validatedData.quantity) {
            throw new Error('Insufficient stock for this transaction');
          }
          newQuantity = previousQuantity - validatedData.quantity;
          break;
        default:
          throw new Error('Invalid transaction type');
      }

      // Calculate total amount if unit price is provided
      let totalAmount = null;
      if (validatedData.unitPrice) {
        totalAmount = Number(validatedData.unitPrice) * validatedData.quantity;
      }

      // Create inventory log entry
      const inventoryLog = await this.prisma.inventoryLog.create({
        data: {
          ...validatedData,
          previousQuantity,
          newQuantity,
          totalAmount,
          schoolId,
          createdBy: userId,
          updatedBy: userId
        },
        include: {
          item: {
            select: { name: true, sku: true, category: { select: { name: true } } }
          },
          school: {
            select: { name: true, uuid: true }
          },
          createdByUser: {
            select: { name: true, email: true }
          }
        }
      });

      // Update item quantity
      await this.prisma.inventoryItem.update({
        where: { id: validatedData.itemId },
        data: { quantity: newQuantity }
      });

      // Invalidate cache
      await this.invalidateInventoryLogCache(schoolId);

      // Log the transaction
      logger.info(`Inventory log created: ${validatedData.type} for item ${item.name} (ID: ${validatedData.itemId}) by user ${userId}`);

      return inventoryLog;
    } catch (error) {
      logger.error('Error creating inventory log:', error);
      throw error;
    }
  }

  /**
   * Get inventory logs with advanced filtering, pagination, and caching
   */
  async getInventoryLogs(schoolId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        itemId,
        type,
        startDate,
        endDate,
        location,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      // Build cache key
      const cacheKey = this.getCacheKey('inventory_logs_list', schoolId, filters);
      
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

      if (itemId) {
        where.itemId = itemId;
      }

      if (type) {
        where.type = type;
      }

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      if (location) {
        where.location = { contains: location, mode: 'insensitive' };
      }

      // Execute query with pagination
      const [logs, total] = await Promise.all([
        this.prisma.inventoryLog.findMany({
          where,
          include: {
            item: {
              select: { name: true, sku: true, category: { select: { name: true } } }
            },
            school: {
              select: { name: true, uuid: true }
            },
            createdByUser: {
              select: { name: true, email: true }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.inventoryLog.count({ where })
      ]);

      const result = {
        logs,
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
      await this.redis.setex(cacheKey, 300, JSON.stringify(result)); // 5 minutes cache

      return result;
    } catch (error) {
      logger.error('Error getting inventory logs:', error);
      throw error;
    }
  }

  /**
   * Get inventory log by ID with detailed information and caching
   */
  async getInventoryLogById(id, schoolId) {
    try {
      // Try to get from cache
      const cacheKey = this.getCacheKey('inventory_log_detail', schoolId, { id });
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const log = await this.prisma.inventoryLog.findFirst({
        where: {
          id,
          schoolId,
          deletedAt: null
        },
        include: {
          item: {
            select: { 
              name: true, 
              sku: true, 
              category: { select: { name: true } },
              supplier: { select: { name: true } }
            }
          },
          school: {
            select: { name: true, uuid: true }
          },
          createdByUser: {
            select: { name: true, email: true }
          },
          updatedByUser: {
            select: { name: true, email: true }
          }
        }
      });

      if (!log) {
        throw new Error('Inventory log not found');
      }

      // Cache the result
      await this.redis.setex(cacheKey, 600, JSON.stringify(log)); // 10 minutes cache

      return log;
    } catch (error) {
      logger.error(`Error getting inventory log ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get inventory logs by item ID
   */
  async getInventoryLogsByItem(itemId, schoolId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        type,
        startDate,
        endDate,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const where = {
        itemId,
        schoolId,
        deletedAt: null
      };

      if (type) {
        where.type = type;
      }

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const [logs, total] = await Promise.all([
        this.prisma.inventoryLog.findMany({
          where,
          include: {
            createdByUser: {
              select: { name: true, email: true }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.inventoryLog.count({ where })
      ]);

      return {
        logs,
        total,
        pagination: {
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      logger.error(`Error getting inventory logs for item ${itemId}:`, error);
      throw error;
    }
  }

  /**
   * Get inventory analytics and transaction summary
   */
  async getInventoryAnalytics(schoolId, filters = {}) {
    try {
      const { startDate, endDate, itemId, type } = filters;

      // Build cache key
      const cacheKey = this.getCacheKey('inventory_analytics', schoolId, filters);
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const whereClause = {
        schoolId,
        deletedAt: null
      };

      if (itemId) {
        whereClause.itemId = itemId;
      }

      if (type) {
        whereClause.type = type;
      }

      if (startDate && endDate) {
        whereClause.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      // Get analytics data
      const [
        totalTransactions,
        transactionsByType,
        totalValue,
        averageTransactionValue,
        topItems,
        recentTransactions,
        monthlyTrends
      ] = await Promise.all([
        // Total transactions
        this.prisma.inventoryLog.count({ where: whereClause }),
        
        // Transactions by type
        this.prisma.inventoryLog.groupBy({
          by: ['type'],
          where: whereClause,
          _count: { type: true },
          _sum: { totalAmount: true }
        }),

        // Total value
        this.prisma.inventoryLog.aggregate({
          where: whereClause,
          _sum: { totalAmount: true }
        }),

        // Average transaction value
        this.prisma.inventoryLog.aggregate({
          where: whereClause,
          _avg: { totalAmount: true }
        }),

        // Top items by transaction volume
        this.prisma.inventoryLog.groupBy({
          by: ['itemId'],
          where: whereClause,
          _count: { id: true },
          _sum: { quantity: true, totalAmount: true }
        }),

        // Recent transactions
        this.prisma.inventoryLog.findMany({
          where: whereClause,
          include: {
            item: {
              select: { name: true, sku: true }
            },
            createdByUser: {
              select: { name: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),

        // Monthly trends
        this.prisma.inventoryLog.groupBy({
          by: ['type'],
          where: whereClause,
          _count: { id: true },
          _sum: { quantity: true, totalAmount: true }
        })
      ]);

      const analytics = {
        summary: {
          totalTransactions,
          totalValue: totalValue._sum.totalAmount || 0,
          averageTransactionValue: averageTransactionValue._avg.totalAmount || 0
        },
        transactionsByType: transactionsByType.map(t => ({
          type: t.type,
          count: t._count.type,
          totalValue: t._sum.totalAmount || 0
        })),
        topItems: await this.enrichTopItems(topItems),
        recentTransactions,
        monthlyTrends: monthlyTrends.map(t => ({
          type: t.type,
          count: t._count.id,
          totalQuantity: t._sum.quantity || 0,
          totalValue: t._sum.totalAmount || 0
        }))
      };

      // Cache the result
      await this.redis.setex(cacheKey, 1800, JSON.stringify(analytics)); // 30 minutes cache

      return analytics;
    } catch (error) {
      logger.error('Error getting inventory analytics:', error);
      throw error;
    }
  }

  /**
   * Get inventory transaction history for reporting
   */
  async getTransactionHistory(schoolId, filters = {}) {
    try {
      const { startDate, endDate, itemId, type, format = 'json' } = filters;

      const whereClause = {
        schoolId,
        deletedAt: null
      };

      if (itemId) {
        whereClause.itemId = itemId;
      }

      if (type) {
        whereClause.type = type;
      }

      if (startDate && endDate) {
        whereClause.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const logs = await this.prisma.inventoryLog.findMany({
        where: whereClause,
        include: {
          item: {
            select: { name: true, sku: true, category: { select: { name: true } } }
          },
          createdByUser: {
            select: { name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      switch (format) {
        case 'csv':
          return this.convertToCSV(logs);
        case 'excel':
          return this.convertToExcel(logs);
        case 'json':
        default:
          return logs;
      }
    } catch (error) {
      logger.error('Error getting transaction history:', error);
      throw error;
    }
  }

  /**
   * Bulk import inventory logs
   */
  async bulkImportInventoryLogs(logs, schoolId, userId) {
    try {
      const errors = [];
      let imported = 0;
      let failed = 0;

      for (const [index, logData] of logs.entries()) {
        try {
          await this.createInventoryLog(logData, schoolId, userId);
          imported++;
        } catch (error) {
          failed++;
          errors.push(`Row ${index + 1}: ${error.message}`);
        }
      }

      // Invalidate cache
      await this.invalidateInventoryLogCache(schoolId);

      return { imported, failed, errors };
    } catch (error) {
      logger.error('Error importing inventory logs:', error);
      throw error;
    }
  }

  /**
   * Get low stock alerts based on inventory logs
   */
  async getLowStockAlerts(schoolId) {
    try {
      const items = await this.prisma.inventoryItem.findMany({
        where: {
          schoolId,
          deletedAt: null,
          quantity: {
            lte: { $ref: 'minQuantity' }
          }
        },
        include: {
          category: {
            select: { name: true }
          },
          supplier: {
            select: { name: true, contactPerson: true, email: true }
          }
        }
      });

      return items.map(item => ({
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        currentQuantity: item.quantity,
        minQuantity: item.minQuantity,
        category: item.category.name,
        supplier: item.supplier,
        alertLevel: item.quantity === 0 ? 'CRITICAL' : 'LOW'
      }));
    } catch (error) {
      logger.error('Error getting low stock alerts:', error);
      throw error;
    }
  }

  /**
   * Get inventory movement summary
   */
  async getInventoryMovementSummary(schoolId, filters = {}) {
    try {
      const { startDate, endDate, itemId } = filters;

      const whereClause = {
        schoolId,
        deletedAt: null
      };

      if (itemId) {
        whereClause.itemId = itemId;
      }

      if (startDate && endDate) {
        whereClause.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const movements = await this.prisma.inventoryLog.groupBy({
        by: ['type', 'itemId'],
        where: whereClause,
        _sum: { quantity: true, totalAmount: true },
        _count: { id: true }
      });

      return await this.enrichMovementData(movements);
    } catch (error) {
      logger.error('Error getting inventory movement summary:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  async validateInventoryLogData(data) {
    const requiredFields = ['itemId', 'quantity', 'type'];
    
    for (const field of requiredFields) {
      if (!data[field]) {
        throw new Error(`${field} is required`);
      }
    }

    if (data.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    const validTypes = ['PURCHASE', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'LOSS'];
    if (!validTypes.includes(data.type)) {
      throw new Error('Invalid transaction type');
    }

    return data;
  }

  async invalidateInventoryLogCache(schoolId) {
    const keys = [
      this.getCacheKey('inventory_logs_list', schoolId),
      this.getCacheKey('inventory_analytics', schoolId)
    ];

    await Promise.all(keys.map(key => this.redis.del(key)));
  }

  getCacheKey(prefix, schoolId, filters = {}) {
    return `${prefix}:${schoolId}:${JSON.stringify(filters)}`;
  }

  async enrichTopItems(topItems) {
    const itemIds = topItems.map(item => item.itemId);
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, sku: true }
    });

    return topItems.map(item => {
      const itemInfo = items.find(i => i.id === item.itemId);
      return {
        itemId: item.itemId,
        itemName: itemInfo?.name || 'Unknown',
        sku: itemInfo?.sku || 'Unknown',
        transactionCount: item._count.id,
        totalQuantity: item._sum.quantity || 0,
        totalValue: item._sum.totalAmount || 0
      };
    });
  }

  async enrichMovementData(movements) {
    const itemIds = movements.map(m => m.itemId);
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, name: true, sku: true }
    });

    return movements.map(movement => {
      const itemInfo = items.find(i => i.id === movement.itemId);
      return {
        itemId: movement.itemId,
        itemName: itemInfo?.name || 'Unknown',
        sku: itemInfo?.sku || 'Unknown',
        type: movement.type,
        totalQuantity: movement._sum.quantity || 0,
        totalValue: movement._sum.totalAmount || 0,
        transactionCount: movement._count.id
      };
    });
  }

  convertToCSV(logs) {
    const headers = ['ID', 'Item Name', 'SKU', 'Type', 'Quantity', 'Unit Price', 'Total Amount', 'Location', 'Created By', 'Created At'];
    const rows = logs.map(log => [
      log.id,
      log.item.name,
      log.item.sku,
      log.type,
      log.quantity,
      log.unitPrice,
      log.totalAmount,
      log.location,
      log.createdByUser.name,
      log.createdAt
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  convertToExcel(logs) {
    // Implementation for Excel conversion
    // This would typically use a library like xlsx
    return JSON.stringify(logs);
  }
}

export default InventoryLogService; 
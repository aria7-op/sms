import {PrismaClient} from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class InventoryService {
  constructor() {
    this.maxSearchResults = 100;
    this.defaultLimit = 10;
  }

  // Advanced inventory search
  async searchInventoryItems(schoolId, searchParams) {
    try {
      const {
        query,
        categoryId,
        supplierId,
        status,
        available,
        unit,
        minPrice,
        maxPrice,
        condition,
        brand,
        sortBy = 'name',
        sortOrder = 'asc',
        limit = this.maxSearchResults
      } = searchParams;

      const where = { schoolId: BigInt(schoolId), deletedAt: null };

      // Text search
      if (query) {
        where.OR = [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { brand: { contains: query, mode: 'insensitive' } },
          { model: { contains: query, mode: 'insensitive' } }
        ];
      }

      // Filter by category
      if (categoryId) where.categoryId = BigInt(categoryId);

      // Filter by supplier
      if (supplierId) where.supplierId = BigInt(supplierId);

      // Filter by status
      if (status) where.status = status;

      // Filter by availability
      if (available === 'true') where.quantity = { gt: 0 };

      // Filter by unit
      if (unit) where.unit = unit;

      // Filter by price range
      if (minPrice || maxPrice) {
        where.costPrice = {};
        if (minPrice) where.costPrice.gte = parseFloat(minPrice);
        if (maxPrice) where.costPrice.lte = parseFloat(maxPrice);
      }

      // Filter by condition
      if (condition) where.condition = condition;

      // Filter by brand
      if (brand) where.brand = { contains: brand, mode: 'insensitive' };

      const items = await prisma.inventoryItem.findMany({
        where,
        include: {
          category: { select: { id: true, uuid: true, name: true } },
          supplier: { select: { id: true, uuid: true, name: true } },
          _count: {
            select: {
              inventoryLogs: true,
              maintenanceLogs: true,
              alerts: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        take: parseInt(limit)
      });

      return items;
    } catch (error) {
      console.error('Search inventory items error:', error);
      throw error;
    }
  }

  // Get inventory analytics
  async getInventoryAnalytics(schoolId, params) {
    try {
      const { startDate, endDate } = params;

      const where = { schoolId: BigInt(schoolId), deletedAt: null };
      const transactionWhere = { schoolId: BigInt(schoolId), deletedAt: null };

      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        
        where.createdAt = dateFilter;
        transactionWhere.createdAt = dateFilter;
      }

      const [
        totalItems,
        totalValue,
        lowStockCount,
        outOfStockCount,
        categoryStats,
        transactionStats,
        topItems,
        recentTransactions,
        supplierStats
      ] = await Promise.all([
        prisma.inventoryItem.count({ where }),
        this.calculateTotalInventoryValue(schoolId),
        prisma.inventoryItem.count({ where: { ...where, status: 'LOW_STOCK' } }),
        prisma.inventoryItem.count({ where: { ...where, status: 'OUT_OF_STOCK' } }),
        prisma.inventoryItem.groupBy({
          by: ['categoryId'],
          where,
          _count: { categoryId: true },
          _sum: { quantity: true }
        }),
        prisma.inventoryLog.groupBy({
          by: ['type'],
          where: transactionWhere,
          _count: { type: true },
          _sum: { quantity: true, totalAmount: true }
        }),
        prisma.inventoryItem.findMany({
          where,
          include: {
            category: { select: { name: true } },
            _count: { select: { inventoryLogs: true } }
          },
          orderBy: { inventoryLogs: { _count: 'desc' } },
          take: 10
        }),
        prisma.inventoryLog.findMany({
          where: transactionWhere,
          include: {
            item: { select: { id: true, uuid: true, name: true, sku: true } },
            createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        prisma.inventoryItem.groupBy({
          by: ['supplierId'],
          where,
          _count: { supplierId: true },
          _sum: { quantity: true }
        })
      ]);

      return {
        totalItems,
        totalValue,
        lowStockCount,
        outOfStockCount,
        categoryStats,
        transactionStats,
        topItems,
        recentTransactions,
        supplierStats,
        availabilityRate: totalItems > 0 ? ((totalItems - outOfStockCount) / totalItems) * 100 : 0,
        turnoverRate: await this.calculateAverageTurnoverRate(schoolId)
      };
    } catch (error) {
      console.error('Get inventory analytics error:', error);
      throw error;
    }
  }

  // Calculate total inventory value
  async calculateTotalInventoryValue(schoolId) {
    try {
      const items = await prisma.inventoryItem.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        select: { quantity: true, costPrice: true }
      });

      return items.reduce((total, item) => {
        return total + (item.costPrice || 0) * item.quantity;
      }, 0);
    } catch (error) {
      console.error('Calculate total inventory value error:', error);
      return 0;
    }
  }

  // Calculate average turnover rate
  async calculateAverageTurnoverRate(schoolId) {
    try {
      const items = await prisma.inventoryItem.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        select: { id: true }
      });

      if (items.length === 0) return 0;

      const turnoverRates = await Promise.all(
        items.map(item => this.calculateItemTurnoverRate(item.id, schoolId))
      );

      const validRates = turnoverRates.filter(rate => rate > 0);
      return validRates.length > 0 ? validRates.reduce((sum, rate) => sum + rate, 0) / validRates.length : 0;
    } catch (error) {
      console.error('Calculate average turnover rate error:', error);
      return 0;
    }
  }

  // Calculate item turnover rate
  async calculateItemTurnoverRate(itemId, schoolId) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 365); // Last year

      const transactions = await prisma.inventoryLog.findMany({
        where: {
          itemId: BigInt(itemId),
          schoolId: BigInt(schoolId),
          type: { in: ['SALE', 'PURCHASE'] },
          createdAt: { gte: startDate },
          deletedAt: null
        },
        orderBy: { createdAt: 'asc' }
      });

      let totalSold = 0;
      let totalPurchased = 0;

      for (const transaction of transactions) {
        if (transaction.type === 'SALE') {
          totalSold += transaction.quantity;
        } else if (transaction.type === 'PURCHASE') {
          totalPurchased += transaction.quantity;
        }
      }

      const averageStock = (totalPurchased + totalSold) / 2;
      return averageStock > 0 ? totalSold / averageStock : 0;
    } catch (error) {
      console.error('Calculate item turnover rate error:', error);
      return 0;
    }
  }

  // Get low stock items
  async getLowStockItems(schoolId, limit = 50) {
    try {
      const items = await prisma.inventoryItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          quantity: {
            lte: { minQuantity: true }
          },
          status: { not: 'DISCONTINUED' }
        },
        include: {
          category: { select: { id: true, uuid: true, name: true } },
          supplier: { select: { id: true, uuid: true, name: true } }
        },
        orderBy: { quantity: 'asc' },
        take: parseInt(limit)
      });

      return items;
    } catch (error) {
      console.error('Get low stock items error:', error);
      throw error;
    }
  }

  // Get expiring items
  async getExpiringItems(schoolId, days = 30, limit = 50) {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);

      const items = await prisma.inventoryItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          expiryDate: {
            gte: new Date(),
            lte: expiryDate
          },
          isExpirable: true
        },
        include: {
          category: { select: { id: true, uuid: true, name: true } }
        },
        orderBy: { expiryDate: 'asc' },
        take: parseInt(limit)
      });

      return items;
    } catch (error) {
      console.error('Get expiring items error:', error);
      throw error;
    }
  }

  // Get overdue maintenance items
  async getOverdueMaintenanceItems(schoolId, limit = 50) {
    try {
      const items = await prisma.inventoryItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          nextMaintenanceDate: {
            lte: new Date()
          },
          isMaintainable: true,
          status: { not: 'DISCONTINUED' }
        },
        include: {
          category: { select: { id: true, uuid: true, name: true } }
        },
        orderBy: { nextMaintenanceDate: 'asc' },
        take: parseInt(limit)
      });

      return items;
    } catch (error) {
      console.error('Get overdue maintenance items error:', error);
      throw error;
    }
  }

  // Generate inventory trends
  async getInventoryTrends(schoolId, period = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const trends = await prisma.inventoryLog.groupBy({
        by: ['createdAt', 'type'],
        where: {
          schoolId: BigInt(schoolId),
          createdAt: { gte: startDate },
          deletedAt: null
        },
        _count: { type: true },
        _sum: { quantity: true, totalAmount: true }
      });

      return trends;
    } catch (error) {
      console.error('Get inventory trends error:', error);
      throw error;
    }
  }

  // Get inventory valuations
  async getInventoryValuations(schoolId) {
    try {
      const valuations = await prisma.inventoryItem.groupBy({
        by: ['categoryId'],
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        _sum: { quantity: true },
        _count: { categoryId: true }
      });

      return valuations;
    } catch (error) {
      console.error('Get inventory valuations error:', error);
      throw error;
    }
  }

  // Generate inventory report
  async generateInventoryReport(schoolId, startDate, endDate, format = 'json') {
    try {
      const where = { schoolId: BigInt(schoolId), deletedAt: null };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const items = await prisma.inventoryItem.findMany({
        where,
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
          _count: {
            select: {
              inventoryLogs: true,
              maintenanceLogs: true,
              alerts: true
            }
          }
        },
        orderBy: { name: 'asc' }
      });

      const totalValue = await this.calculateTotalInventoryValue(schoolId);

      if (format === 'csv') {
        // Generate CSV report
        const csvData = items.map(item => ({
          'Name': item.name,
          'SKU': item.sku || 'N/A',
          'Barcode': item.barcode || 'N/A',
          'Category': item.category?.name || 'N/A',
          'Supplier': item.supplier?.name || 'N/A',
          'Quantity': item.quantity,
          'Unit': item.unit,
          'Status': item.status,
          'Cost Price': item.costPrice || 0,
          'Selling Price': item.sellingPrice || 0,
          'Total Value': (item.costPrice || 0) * item.quantity,
          'Location': item.location || 'N/A',
          'Condition': item.condition || 'N/A',
          'Last Updated': item.updatedAt
        }));

        return { data: csvData, summary: { totalItems: items.length, totalValue } };
      }

      return { data: items, summary: { totalItems: items.length, totalValue } };
    } catch (error) {
      console.error('Generate inventory report error:', error);
      throw error;
    }
  }

  // Check item availability
  async checkItemAvailability(itemId, schoolId, requiredQuantity = 1) {
    try {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: BigInt(itemId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!item) {
        return { available: false, message: 'Item not found' };
      }

      if (item.status !== 'AVAILABLE' && item.status !== 'LOW_STOCK') {
        return { available: false, message: `Item is ${item.status.toLowerCase()}` };
      }

      if (item.quantity < requiredQuantity) {
        return { available: false, message: 'Insufficient stock' };
      }

      return { available: true, item };
    } catch (error) {
      console.error('Check item availability error:', error);
      throw error;
    }
  }

  // Reserve item stock
  async reserveItemStock(itemId, quantity, schoolId) {
    try {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: BigInt(itemId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!item) {
        throw new Error('Item not found');
      }

      if (item.quantity - item.reservedQuantity < quantity) {
        throw new Error('Insufficient available stock');
      }

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: BigInt(itemId) },
        data: { reservedQuantity: item.reservedQuantity + quantity }
      });

      return updatedItem;
    } catch (error) {
      console.error('Reserve item stock error:', error);
      throw error;
    }
  }

  // Release item stock
  async releaseItemStock(itemId, quantity, schoolId) {
    try {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: BigInt(itemId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!item) {
        throw new Error('Item not found');
      }

      const newReservedQuantity = Math.max(0, item.reservedQuantity - quantity);

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: BigInt(itemId) },
        data: { reservedQuantity: newReservedQuantity }
      });

      return updatedItem;
    } catch (error) {
      console.error('Release item stock error:', error);
      throw error;
    }
  }
}

export default new InventoryService(); 
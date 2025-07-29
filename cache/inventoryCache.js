import Redis from 'ioredis';
import { PrismaClient } from '../generated/prisma/client.js';

// Disable Redis for now - use memory cache only
console.log('Inventory Cache: Redis disabled - using memory cache only');
const redis = {
  setex: async () => true,
  get: async () => null,
  del: async () => true,
  keys: async () => [],
  info: async () => 'memory',
  memory: async () => ({ used_memory: 0 }),
  dbsize: async () => 0,
  ping: async () => 'PONG'
};

const prisma = new PrismaClient();

class InventoryCache {
  constructor() {
    this.defaultTTL = 3600; // 1 hour
    this.itemTTL = 1800; // 30 minutes
    this.searchTTL = 900; // 15 minutes
    this.analyticsTTL = 7200; // 2 hours
    this.reportTTL = 3600; // 1 hour
  }

  // Generate cache keys
  generateKey(prefix, identifier, schoolId) {
    return `inventory:${prefix}:${schoolId}:${identifier}`;
  }

  generateListKey(prefix, schoolId, filters = '') {
    return `inventory:${prefix}:${schoolId}:${filters}`;
  }

  // Cache inventory item
  async cacheInventoryItem(item) {
    try {
      const key = this.generateKey('item', item.id, item.schoolId);
      const itemData = JSON.stringify(item);
      
      await redis.setex(key, this.itemTTL, itemData);
      
      // Also cache in school items list
      await this.addToSchoolItemsList(item.schoolId, item.id);
      
      console.log(`Inventory item ${item.id} cached successfully`);
    } catch (error) {
      console.error('Error caching inventory item:', error);
    }
  }

  // Get inventory item from cache
  async getInventoryItem(itemId, schoolId) {
    try {
      const key = this.generateKey('item', itemId, schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting inventory item from cache:', error);
      return null;
    }
  }

  // Cache inventory item list
  async cacheInventoryItemList(schoolId, items, filters = '') {
    try {
      const key = this.generateListKey('items', schoolId, filters);
      const itemsData = JSON.stringify(items);
      
      await redis.setex(key, this.itemTTL, itemsData);
      
      // Cache individual items
      for (const item of items) {
        await this.cacheInventoryItem(item);
      }
      
      console.log(`Inventory item list cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching inventory item list:', error);
    }
  }

  // Get inventory item list from cache
  async getInventoryItemList(schoolId, filters = '') {
    try {
      const key = this.generateListKey('items', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting inventory item list from cache:', error);
      return null;
    }
  }

  // Cache category list
  async cacheCategoryList(schoolId, categories, filters = '') {
    try {
      const key = this.generateListKey('categories', schoolId, filters);
      const categoriesData = JSON.stringify(categories);
      
      await redis.setex(key, this.itemTTL, categoriesData);
      
      console.log(`Category list cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching category list:', error);
    }
  }

  // Get category list from cache
  async getCategoryList(schoolId, filters = '') {
    try {
      const key = this.generateListKey('categories', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting category list from cache:', error);
      return null;
    }
  }

  // Cache supplier list
  async cacheSupplierList(schoolId, suppliers, filters = '') {
    try {
      const key = this.generateListKey('suppliers', schoolId, filters);
      const suppliersData = JSON.stringify(suppliers);
      
      await redis.setex(key, this.itemTTL, suppliersData);
      
      console.log(`Supplier list cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching supplier list:', error);
    }
  }

  // Get supplier list from cache
  async getSupplierList(schoolId, filters = '') {
    try {
      const key = this.generateListKey('suppliers', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting supplier list from cache:', error);
      return null;
    }
  }

  // Cache search results
  async cacheSearchResults(schoolId, searchQuery, results) {
    try {
      const key = this.generateListKey('search', schoolId, searchQuery);
      const resultsData = JSON.stringify(results);
      
      await redis.setex(key, this.searchTTL, resultsData);
      
      console.log(`Search results cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching search results:', error);
    }
  }

  // Get search results from cache
  async getSearchResults(schoolId, searchQuery) {
    try {
      const key = this.generateListKey('search', schoolId, searchQuery);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting search results from cache:', error);
      return null;
    }
  }

  // Cache inventory analytics
  async cacheInventoryAnalytics(schoolId, analytics, filters = '') {
    try {
      const key = this.generateListKey('analytics', schoolId, filters);
      const analyticsData = JSON.stringify(analytics);
      
      await redis.setex(key, this.analyticsTTL, analyticsData);
      
      console.log(`Inventory analytics cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching inventory analytics:', error);
    }
  }

  // Get inventory analytics from cache
  async getInventoryAnalytics(schoolId, filters = '') {
    try {
      const key = this.generateListKey('analytics', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting inventory analytics from cache:', error);
      return null;
    }
  }

  // Cache inventory summary
  async cacheInventorySummary(schoolId, summary) {
    try {
      const key = this.generateKey('summary', 'dashboard', schoolId);
      const summaryData = JSON.stringify(summary);
      
      await redis.setex(key, this.analyticsTTL, summaryData);
      
      console.log(`Inventory summary cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching inventory summary:', error);
    }
  }

  // Get inventory summary from cache
  async getInventorySummary(schoolId) {
    try {
      const key = this.generateKey('summary', 'dashboard', schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting inventory summary from cache:', error);
      return null;
    }
  }

  // Cache low stock items
  async cacheLowStockItems(schoolId, items) {
    try {
      const key = this.generateKey('low-stock', 'list', schoolId);
      const itemsData = JSON.stringify(items);
      
      await redis.setex(key, this.itemTTL, itemsData);
      
      console.log(`Low stock items cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching low stock items:', error);
    }
  }

  // Get low stock items from cache
  async getLowStockItems(schoolId) {
    try {
      const key = this.generateKey('low-stock', 'list', schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting low stock items from cache:', error);
      return null;
    }
  }

  // Cache expiring items
  async cacheExpiringItems(schoolId, items) {
    try {
      const key = this.generateKey('expiring', 'list', schoolId);
      const itemsData = JSON.stringify(items);
      
      await redis.setex(key, this.itemTTL, itemsData);
      
      console.log(`Expiring items cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching expiring items:', error);
    }
  }

  // Get expiring items from cache
  async getExpiringItems(schoolId) {
    try {
      const key = this.generateKey('expiring', 'list', schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting expiring items from cache:', error);
      return null;
    }
  }

  // Cache purchase orders
  async cachePurchaseOrders(schoolId, orders, filters = '') {
    try {
      const key = this.generateListKey('purchase-orders', schoolId, filters);
      const ordersData = JSON.stringify(orders);
      
      await redis.setex(key, this.itemTTL, ordersData);
      
      console.log(`Purchase orders cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching purchase orders:', error);
    }
  }

  // Get purchase orders from cache
  async getPurchaseOrders(schoolId, filters = '') {
    try {
      const key = this.generateListKey('purchase-orders', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting purchase orders from cache:', error);
      return null;
    }
  }

  // Cache recent transactions
  async cacheRecentTransactions(schoolId, transactions) {
    try {
      const key = this.generateKey('recent', 'transactions', schoolId);
      const transactionsData = JSON.stringify(transactions);
      
      await redis.setex(key, this.itemTTL, transactionsData);
      
      console.log(`Recent transactions cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching recent transactions:', error);
    }
  }

  // Get recent transactions from cache
  async getRecentTransactions(schoolId) {
    try {
      const key = this.generateKey('recent', 'transactions', schoolId);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting recent transactions from cache:', error);
      return null;
    }
  }

  // Add item to school items list
  async addToSchoolItemsList(schoolId, itemId) {
    try {
      const key = this.generateKey('school', 'items', schoolId);
      await redis.sadd(key, itemId.toString());
      await redis.expire(key, this.itemTTL);
    } catch (error) {
      console.error('Error adding item to school list:', error);
    }
  }

  // Remove item from school items list
  async removeFromSchoolItemsList(schoolId, itemId) {
    try {
      const key = this.generateKey('school', 'items', schoolId);
      await redis.srem(key, itemId.toString());
    } catch (error) {
      console.error('Error removing item from school list:', error);
    }
  }

  // Invalidate inventory cache
  async invalidateInventoryCache(itemId, schoolId) {
    try {
      const keys = [
        this.generateKey('item', itemId, schoolId),
        this.generateKey('low-stock', 'list', schoolId),
        this.generateKey('expiring', 'list', schoolId),
        this.generateKey('summary', 'dashboard', schoolId),
        this.generateListKey('items', schoolId, '*'),
        this.generateListKey('search', schoolId, '*'),
        this.generateListKey('analytics', schoolId, '*')
      ];

      for (const key of keys) {
        await redis.del(key);
      }

      await this.removeFromSchoolItemsList(schoolId, itemId);
      
      console.log(`Inventory cache invalidated for item ${itemId}`);
    } catch (error) {
      console.error('Error invalidating inventory cache:', error);
    }
  }

  // Invalidate school inventory cache
  async invalidateSchoolInventoryCache(schoolId) {
    try {
      const pattern = `inventory:*:${schoolId}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      console.log(`School inventory cache invalidated for school ${schoolId}`);
    } catch (error) {
      console.error('Error invalidating school inventory cache:', error);
    }
  }

  // Cache inventory report
  async cacheInventoryReport(schoolId, report, filters = '') {
    try {
      const key = this.generateListKey('report', schoolId, filters);
      const reportData = JSON.stringify(report);
      
      await redis.setex(key, this.reportTTL, reportData);
      
      console.log(`Inventory report cached for school ${schoolId}`);
    } catch (error) {
      console.error('Error caching inventory report:', error);
    }
  }

  // Get inventory report from cache
  async getInventoryReport(schoolId, filters = '') {
    try {
      const key = this.generateListKey('report', schoolId, filters);
      const cachedData = await redis.get(key);
      
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      return null;
    } catch (error) {
      console.error('Error getting inventory report from cache:', error);
      return null;
    }
  }

  // Warm up cache with recent items
  async warmUpCache(schoolId) {
    try {
      const recentItems = await prisma.inventoryItem.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 100,
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
        }
      });

      await this.cacheInventoryItemList(schoolId, recentItems, 'recent');
      
      // Cache individual items
      for (const item of recentItems) {
        await this.cacheInventoryItem(item);
      }
      
      console.log(`Inventory cache warmed up for school ${schoolId}`);
    } catch (error) {
      console.error('Error warming up inventory cache:', error);
    }
  }

  // Get cache statistics
  async getCacheStats() {
    try {
      const info = await redis.info();
      const keys = await redis.dbsize();
      
      return {
        info,
        totalKeys: keys,
        memory: await redis.memory('USAGE')
      };
    } catch (error) {
      console.error('Error getting inventory cache stats:', error);
      return null;
    }
  }

  // Clear all inventory cache
  async clearAllInventoryCache() {
    try {
      const pattern = 'inventory:*';
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      
      console.log('All inventory cache cleared');
    } catch (error) {
      console.error('Error clearing inventory cache:', error);
    }
  }
}

const inventoryCache = new InventoryCache();

export const cacheInventoryItem = (item) => inventoryCache.cacheInventoryItem(item);
export const invalidateInventoryCache = (itemId, schoolId) => inventoryCache.invalidateInventoryCache(itemId, schoolId);
export default inventoryCache; 
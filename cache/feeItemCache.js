import Redis from 'ioredis';
import NodeCache from 'node-cache';

// Redis configuration (optional - falls back to memory store if not available)
let redisClient = null;
let useRedis = false;

// Disable Redis for now - only use memory cache
console.log('Redis disabled - using memory cache only');

// Memory cache fallback
const memoryCache = new Map();
const cacheTTL = new Map();

// Node-cache for complex data structures
const nodeCache = new NodeCache({
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every minute
  useClones: false,
  deleteOnExpire: true,
});

// Cache configuration specific to FeeItems
const FEE_ITEM_CACHE_CONFIG = {
  TTL: {
    FEE_ITEM: 3600,               // 1 hour for individual fee items
    FEE_ITEMS_BY_STRUCTURE: 1800, // 30 minutes for fee items by structure
    FEE_ITEMS_BY_SCHOOL: 1800,    // 30 minutes for fee items by school
    FEE_ITEMS_BY_DUE_DATE: 86400, // 24 hours for fee items by due date
    FEE_ITEMS_OPTIONAL: 3600,     // 1 hour for optional fee items
    FEE_ITEMS_SEARCH: 300,        // 5 minutes for search results
  },
  
  KEYS: {
    FEE_ITEM: 'fee:item:',                // fee:item:<id>
    FEE_ITEMS_BY_STRUCTURE: 'fee:items:structure:', // fee:items:structure:<feeStructureId>
    FEE_ITEMS_BY_SCHOOL: 'fee:items:school:',       // fee:items:school:<schoolId>
    FEE_ITEMS_BY_DUE_DATE: 'fee:items:due:',        // fee:items:due:<date>
    FEE_ITEMS_OPTIONAL: 'fee:items:optional:',      // fee:items:optional:<schoolId>
    FEE_ITEMS_SEARCH: 'fee:items:search:',          // fee:items:search:<hash>
  },
  
  PATTERNS: {
    FEE_ITEM_ALL: 'fee:item:*',
    FEE_ITEMS_BY_STRUCTURE_ALL: 'fee:items:structure:*',
    FEE_ITEMS_BY_SCHOOL_ALL: 'fee:items:school:*',
    FEE_ITEMS_BY_DUE_DATE_ALL: 'fee:items:due:*',
    FEE_ITEMS_OPTIONAL_ALL: 'fee:items:optional:*',
    FEE_ITEMS_SEARCH_ALL: 'fee:items:search:*',
  }
};

// ======================
// CORE CACHE UTILITIES
// ======================

const generateCacheKey = (prefix, identifier) => {
  return `${prefix}${identifier}`;
};

const generateSearchKey = (params) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join(':');
  return `search:${sortedParams}`;
};

const setCache = async (key, data, ttl = FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEM) => {
  try {
    if (useRedis && redisClient) {
      await redisClient.setex(key, ttl, JSON.stringify(data));
    } else {
      memoryCache.set(key, data);
      cacheTTL.set(key, Date.now() + (ttl * 1000));
    }
    return true;
  } catch (error) {
    console.error('FeeItem cache set error:', error);
    return false;
  }
};

const getCache = async (key) => {
  try {
    if (useRedis && redisClient) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } else {
      const ttl = cacheTTL.get(key);
      if (ttl && Date.now() > ttl) {
        memoryCache.delete(key);
        cacheTTL.delete(key);
        return null;
      }
      return memoryCache.get(key) || null;
    }
  } catch (error) {
    console.error('FeeItem cache get error:', error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    if (useRedis && redisClient) {
      await redisClient.del(key);
    } else {
      memoryCache.delete(key);
      cacheTTL.delete(key);
    }
    return true;
  } catch (error) {
    console.error('FeeItem cache delete error:', error);
    return false;
  }
};

const deleteCachePattern = async (pattern) => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          memoryCache.delete(key);
          cacheTTL.delete(key);
        }
      }
    }
    return true;
  } catch (error) {
    console.error('FeeItem cache pattern delete error:', error);
    return false;
  }
};

// ======================
// FEE ITEM CACHING
// ======================

export const getFeeItemFromCache = async (feeItemId) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEM, feeItemId);
  return await getCache(key);
};

export const setFeeItemInCache = async (feeItem) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEM, feeItem.id);
  return await setCache(key, feeItem);
};

export const deleteFeeItemFromCache = async (feeItemId) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEM, feeItemId);
  return await deleteCache(key);
};

// ======================
// FEE ITEMS BY STRUCTURE
// ======================

export const getFeeItemsByStructureFromCache = async (feeStructureId) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_STRUCTURE, feeStructureId);
  return await getCache(key);
};

export const setFeeItemsByStructureInCache = async (feeStructureId, items) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_STRUCTURE, feeStructureId);
  return await setCache(key, items, FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_BY_STRUCTURE);
};

export const deleteFeeItemsByStructureFromCache = async (feeStructureId) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_STRUCTURE, feeStructureId);
  return await deleteCache(key);
};

// ======================
// FEE ITEMS BY SCHOOL
// ======================

export const getFeeItemsBySchoolFromCache = async (schoolId, params = {}) => {
  const searchKey = generateSearchKey(params);
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_SCHOOL, `${schoolId}:${searchKey}`);
  return await getCache(key);
};

export const setFeeItemsBySchoolInCache = async (schoolId, params, items) => {
  const searchKey = generateSearchKey(params);
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_SCHOOL, `${schoolId}:${searchKey}`);
  return await setCache(key, items, FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_BY_SCHOOL);
};

export const deleteFeeItemsBySchoolFromCache = async (schoolId) => {
  const pattern = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_SCHOOL, `${schoolId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// FEE ITEMS BY DUE DATE
// ======================

export const getFeeItemsByDueDateFromCache = async (date) => {
  const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_DUE_DATE, dateString);
  return await getCache(key);
};

export const setFeeItemsByDueDateInCache = async (date, items) => {
  const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_DUE_DATE, dateString);
  return await setCache(key, items, FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_BY_DUE_DATE);
};

export const deleteFeeItemsByDueDateFromCache = async (date) => {
  const dateString = date instanceof Date ? date.toISOString().split('T')[0] : date;
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_DUE_DATE, dateString);
  return await deleteCache(key);
};

// ======================
// OPTIONAL FEE ITEMS
// ======================

export const getOptionalFeeItemsFromCache = async (schoolId) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_OPTIONAL, schoolId);
  return await getCache(key);
};

export const setOptionalFeeItemsInCache = async (schoolId, items) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_OPTIONAL, schoolId);
  return await setCache(key, items, FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_OPTIONAL);
};

export const deleteOptionalFeeItemsFromCache = async (schoolId) => {
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_OPTIONAL, schoolId);
  return await deleteCache(key);
};

// ======================
// FEE ITEMS SEARCH
// ======================

export const getFeeItemsSearchFromCache = async (params) => {
  const searchKey = generateSearchKey(params);
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_SEARCH, searchKey);
  return await getCache(key);
};

export const setFeeItemsSearchInCache = async (params, results) => {
  const searchKey = generateSearchKey(params);
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_SEARCH, searchKey);
  return await setCache(key, results, FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_SEARCH);
};

export const deleteFeeItemsSearchFromCache = async (params) => {
  const searchKey = generateSearchKey(params);
  const key = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_SEARCH, searchKey);
  return await deleteCache(key);
};

// ======================
// CACHE INVALIDATION
// ======================

export const invalidateFeeItemCacheOnCreate = async (feeItem) => {
  const promises = [
    deleteFeeItemsByStructureFromCache(feeItem.feeStructureId),
    deleteFeeItemsBySchoolFromCache(feeItem.schoolId),
    deleteOptionalFeeItemsFromCache(feeItem.schoolId),
    deleteCachePattern(FEE_ITEM_CACHE_CONFIG.PATTERNS.FEE_ITEMS_SEARCH_ALL),
  ];

  if (feeItem.dueDate) {
    promises.push(deleteFeeItemsByDueDateFromCache(feeItem.dueDate));
  }

  await Promise.all(promises);
};

export const invalidateFeeItemCacheOnUpdate = async (feeItem, oldData = null) => {
  const promises = [
    deleteFeeItemFromCache(feeItem.id),
    deleteFeeItemsByStructureFromCache(feeItem.feeStructureId),
    deleteFeeItemsBySchoolFromCache(feeItem.schoolId),
    deleteOptionalFeeItemsFromCache(feeItem.schoolId),
    deleteCachePattern(FEE_ITEM_CACHE_CONFIG.PATTERNS.FEE_ITEMS_SEARCH_ALL),
  ];

  if (feeItem.dueDate) {
    promises.push(deleteFeeItemsByDueDateFromCache(feeItem.dueDate));
  }

  if (oldData) {
    if (oldData.feeStructureId !== feeItem.feeStructureId) {
      promises.push(deleteFeeItemsByStructureFromCache(oldData.feeStructureId));
    }
    if (oldData.schoolId !== feeItem.schoolId) {
      promises.push(deleteFeeItemsBySchoolFromCache(oldData.schoolId));
      promises.push(deleteOptionalFeeItemsFromCache(oldData.schoolId));
    }
    if (oldData.dueDate !== feeItem.dueDate && oldData.dueDate) {
      promises.push(deleteFeeItemsByDueDateFromCache(oldData.dueDate));
    }
    if (oldData.isOptional !== feeItem.isOptional) {
      promises.push(deleteOptionalFeeItemsFromCache(feeItem.schoolId));
      if (oldData.schoolId !== feeItem.schoolId) {
        promises.push(deleteOptionalFeeItemsFromCache(oldData.schoolId));
      }
    }
  }

  await Promise.all(promises);
};

export const invalidateFeeItemCacheOnDelete = async (feeItem) => {
  const promises = [
    deleteFeeItemFromCache(feeItem.id),
    deleteFeeItemsByStructureFromCache(feeItem.feeStructureId),
    deleteFeeItemsBySchoolFromCache(feeItem.schoolId),
    deleteOptionalFeeItemsFromCache(feeItem.schoolId),
    deleteCachePattern(FEE_ITEM_CACHE_CONFIG.PATTERNS.FEE_ITEMS_SEARCH_ALL),
  ];

  if (feeItem.dueDate) {
    promises.push(deleteFeeItemsByDueDateFromCache(feeItem.dueDate));
  }

  await Promise.all(promises);
};

// ======================
// CACHE STATISTICS
// ======================

export const getFeeItemCacheStats = async () => {
  try {
    if (useRedis && redisClient) {
      const info = await redisClient.info('memory');
      const keys = await redisClient.keys(FEE_ITEM_CACHE_CONFIG.PATTERNS.FEE_ITEM_ALL);
      
      return {
        type: 'redis',
        totalKeys: keys.length,
        memoryInfo: info,
        patterns: FEE_ITEM_CACHE_CONFIG.PATTERNS,
      };
    } else {
      return {
        type: 'memory',
        totalKeys: memoryCache.size,
        memoryUsage: process.memoryUsage(),
        patterns: FEE_ITEM_CACHE_CONFIG.PATTERNS,
      };
    }
  } catch (error) {
    console.error('FeeItem cache stats error:', error);
    return null;
  }
};

export const clearFeeItemCache = async () => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys(FEE_ITEM_CACHE_CONFIG.PATTERNS.FEE_ITEM_ALL);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      memoryCache.clear();
      cacheTTL.clear();
    }
    return true;
  } catch (error) {
    console.error('FeeItem cache clear error:', error);
    return false;
  }
};

// ======================
// CACHE HEALTH CHECK
// ======================

export const checkFeeItemCacheHealth = async () => {
  try {
    const testKey = 'fee:item:health:test';
    const testData = { test: true, timestamp: Date.now() };
    
    const writeSuccess = await setCache(testKey, testData, 10);
    if (!writeSuccess) return { healthy: false, error: 'Write failed' };
    
    const readData = await getCache(testKey);
    if (!readData || readData.test !== true) return { healthy: false, error: 'Read failed' };
    
    const deleteSuccess = await deleteCache(testKey);
    if (!deleteSuccess) return { healthy: false, error: 'Delete failed' };
    
    return { healthy: true, type: useRedis ? 'redis' : 'memory' };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};

// ======================
// FEE ITEM CACHE MIDDLEWARE
// ======================

export const feeItemCacheMiddleware = (options = {}) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Determine cache key based on request
    let cacheKey;
    let ttl = FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEM;
    
    if (req.params.id) {
      // Single fee item request
      cacheKey = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEM, req.params.id);
    } else if (req.params.feeStructureId) {
      // Fee items by structure
      cacheKey = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_STRUCTURE, req.params.feeStructureId);
      ttl = FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_BY_STRUCTURE;
    } else if (req.params.schoolId) {
      // Fee items by school
      const searchKey = generateSearchKey(req.query);
      cacheKey = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_SCHOOL, `${req.params.schoolId}:${searchKey}`);
      ttl = FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_BY_SCHOOL;
    } else if (req.query.dueDate) {
      // Fee items by due date
      cacheKey = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_DUE_DATE, req.query.dueDate);
      ttl = FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_BY_DUE_DATE;
    } else if (req.query.isOptional && req.query.schoolId) {
      // Optional fee items
      cacheKey = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_OPTIONAL, req.query.schoolId);
      ttl = FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_OPTIONAL;
    } else {
      // Generic search
      const searchKey = generateSearchKey({ ...req.query, ...req.params });
      cacheKey = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_SEARCH, searchKey);
      ttl = FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_SEARCH;
    }

    try {
      // Try to get cached data
      const cachedData = await getCache(cacheKey);
      
      if (cachedData) {
        // Send cached response
        return res.status(200).json({
          success: true,
          fromCache: true,
          data: cachedData
        });
      }

      // Override res.json to cache the response before sending
      const originalJson = res.json;
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const dataToCache = body.data || body;
          
          setCache(cacheKey, dataToCache, ttl).catch(err => {
            console.error('Failed to cache fee item data:', err);
          });
        }
        
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Fee item cache middleware error:', error);
      next();
    }
  };
};

// Middleware for caching by fee item ID
export const feeItemByIdCacheMiddleware = async (req, res, next) => {
  const { id } = req.params;
  if (!id) return next();
  const cacheKey = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEM, id);
  try {
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json({ success: true, fromCache: true, data: cachedData });
    }
    // Override res.json to cache the response before sending
    const originalJson = res.json;
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const dataToCache = body.data || body;
        setCache(cacheKey, dataToCache, FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEM).catch(err => {
          console.error('Failed to cache fee item data:', err);
        });
      }
      return originalJson.call(res, body);
    };
    next();
  } catch (error) {
    console.error('feeItemByIdCacheMiddleware error:', error);
    next();
  }
};

// Middleware for caching by fee structure ID
export const feeItemByStructureCacheMiddleware = async (req, res, next) => {
  const { feeStructureId } = req.params;
  if (!feeStructureId) return next();
  const cacheKey = generateCacheKey(FEE_ITEM_CACHE_CONFIG.KEYS.FEE_ITEMS_BY_STRUCTURE, feeStructureId);
  try {
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json({ success: true, fromCache: true, data: cachedData });
    }
    // Override res.json to cache the response before sending
    const originalJson = res.json;
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const dataToCache = body.data || body;
        setCache(cacheKey, dataToCache, FEE_ITEM_CACHE_CONFIG.TTL.FEE_ITEMS_BY_STRUCTURE).catch(err => {
          console.error('Failed to cache fee items by structure:', err);
        });
      }
      return originalJson.call(res, body);
    };
    next();
  } catch (error) {
    console.error('feeItemByStructureCacheMiddleware error:', error);
    next();
  }
};

// ======================
// EXPORTS
// ======================

export {
  FEE_ITEM_CACHE_CONFIG,
  generateCacheKey,
  generateSearchKey,
  setCache as setFeeItemCache,
  getCache as getFeeItemCache,
  deleteCache as deleteFeeItemCache,
  deleteCachePattern as deleteFeeItemCachePattern,
};
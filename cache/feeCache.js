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

// Cache configuration
const FEE_CACHE_CONFIG = {
  TTL: {
    FEE_STRUCTURE: 3600, // 1 hour
    FEE_LIST: 300,       // 5 minutes
    FEE_ITEMS: 1800,     // 30 minutes
    FEE_BY_SCHOOL: 1800, // 30 minutes
    FEE_BY_CLASS: 1800,  // 30 minutes
    FEE_DEFAULTS: 86400, // 24 hours
  },
  
  KEYS: {
    FEE_STRUCTURE: 'fee:structure:',
    FEE_LIST: 'fee:list:',
    FEE_ITEMS: 'fee:items:',
    FEE_BY_SCHOOL: 'fee:school:',
    FEE_BY_CLASS: 'fee:class:',
    FEE_DEFAULTS: 'fee:defaults:',
  },
  
  PATTERNS: {
    FEE_ALL: 'fee:*',
    FEE_STRUCTURE_ALL: 'fee:structure:*',
    FEE_LIST_ALL: 'fee:list:*',
    FEE_ITEMS_ALL: 'fee:items:*',
    FEE_BY_SCHOOL_ALL: 'fee:school:*',
    FEE_BY_CLASS_ALL: 'fee:class:*',
    FEE_DEFAULTS_ALL: 'fee:defaults:*',
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

const setCache = async (key, data, ttl = FEE_CACHE_CONFIG.TTL.FEE_STRUCTURE) => {
  try {
    if (useRedis && redisClient) {
      await redisClient.setex(key, ttl, JSON.stringify(data));
    } else {
      memoryCache.set(key, data);
      cacheTTL.set(key, Date.now() + (ttl * 1000));
    }
    return true;
  } catch (error) {
    console.error('Fee cache set error:', error);
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
    console.error('Fee cache get error:', error);
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
    console.error('Fee cache delete error:', error);
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
    console.error('Fee cache pattern delete error:', error);
    return false;
  }
};

// ======================
// FEE STRUCTURE CACHING
// ======================

export const getFeeStructureFromCache = async (feeStructureId) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_STRUCTURE, feeStructureId);
  return await getCache(key);
};

export const setFeeStructureInCache = async (feeStructure) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_STRUCTURE, feeStructure.id);
  return await setCache(key, feeStructure);
};

export const deleteFeeStructureFromCache = async (feeStructureId) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_STRUCTURE, feeStructureId);
  return await deleteCache(key);
};

// ======================
// FEE LIST CACHING
// ======================

export const getFeeListFromCache = async (params = {}) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_LIST, generateSearchKey(params));
  return await getCache(key);
};

export const setFeeListInCache = async (params, data) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_LIST, generateSearchKey(params));
  return await setCache(key, data, FEE_CACHE_CONFIG.TTL.FEE_LIST);
};

export const deleteFeeListFromCache = async (params) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_LIST, generateSearchKey(params));
  return await deleteCache(key);
};

// ======================
// FEE ITEMS CACHING
// ======================

export const getFeeItemsFromCache = async (feeStructureId) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_ITEMS, feeStructureId);
  return await getCache(key);
};

export const setFeeItemsInCache = async (feeStructureId, items) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_ITEMS, feeStructureId);
  return await setCache(key, items, FEE_CACHE_CONFIG.TTL.FEE_ITEMS);
};

export const deleteFeeItemsFromCache = async (feeStructureId) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_ITEMS, feeStructureId);
  return await deleteCache(key);
};

// ======================
// SCHOOL-SPECIFIC CACHING
// ======================

export const getFeeStructuresBySchool = async (schoolId, params = {}) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_BY_SCHOOL, `${schoolId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setFeeStructuresBySchool = async (schoolId, params, data) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_BY_SCHOOL, `${schoolId}:${generateSearchKey(params)}`);
  return await setCache(key, data, FEE_CACHE_CONFIG.TTL.FEE_BY_SCHOOL);
};

export const deleteFeeStructuresBySchool = async (schoolId) => {
  const pattern = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_BY_SCHOOL, `${schoolId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// CLASS-SPECIFIC CACHING
// ======================

export const getFeeStructuresByClass = async (classId, params = {}) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_BY_CLASS, `${classId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setFeeStructuresByClass = async (classId, params, data) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_BY_CLASS, `${classId}:${generateSearchKey(params)}`);
  return await setCache(key, data, FEE_CACHE_CONFIG.TTL.FEE_BY_CLASS);
};

export const deleteFeeStructuresByClass = async (classId) => {
  const pattern = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_BY_CLASS, `${classId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// DEFAULT FEE STRUCTURES
// ======================

export const getDefaultFeeStructures = async (schoolId) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_DEFAULTS, schoolId);
  return await getCache(key);
};

export const setDefaultFeeStructures = async (schoolId, data) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_DEFAULTS, schoolId);
  return await setCache(key, data, FEE_CACHE_CONFIG.TTL.FEE_DEFAULTS);
};

export const deleteDefaultFeeStructures = async (schoolId) => {
  const key = generateCacheKey(FEE_CACHE_CONFIG.KEYS.FEE_DEFAULTS, schoolId);
  return await deleteCache(key);
};

// ======================
// CACHE INVALIDATION
// ======================

export const invalidateFeeCacheOnCreate = async (feeStructure) => {
  const promises = [
    deleteFeeListFromCache({}),
    deleteFeeStructuresBySchool(feeStructure.schoolId),
    deleteCachePattern(FEE_CACHE_CONFIG.PATTERNS.FEE_ITEMS_ALL),
  ];

  if (feeStructure.classId) {
    promises.push(deleteFeeStructuresByClass(feeStructure.classId));
  }

  if (feeStructure.isDefault) {
    promises.push(deleteDefaultFeeStructures(feeStructure.schoolId));
  }

  await Promise.all(promises);
};

export const invalidateFeeCacheOnUpdate = async (feeStructure, oldData = null) => {
  const promises = [
    deleteFeeStructureFromCache(feeStructure.id),
    deleteFeeItemsFromCache(feeStructure.id),
    deleteFeeListFromCache({}),
    deleteFeeStructuresBySchool(feeStructure.schoolId),
  ];

  if (feeStructure.classId) {
    promises.push(deleteFeeStructuresByClass(feeStructure.classId));
  }

  if (oldData?.classId && oldData.classId !== feeStructure.classId) {
    promises.push(deleteFeeStructuresByClass(oldData.classId));
  }

  if (feeStructure.isDefault) {
    promises.push(deleteDefaultFeeStructures(feeStructure.schoolId));
  }

  await Promise.all(promises);
};

export const invalidateFeeCacheOnDelete = async (feeStructure) => {
  const promises = [
    deleteFeeStructureFromCache(feeStructure.id),
    deleteFeeItemsFromCache(feeStructure.id),
    deleteFeeListFromCache({}),
    deleteFeeStructuresBySchool(feeStructure.schoolId),
  ];

  if (feeStructure.classId) {
    promises.push(deleteFeeStructuresByClass(feeStructure.classId));
  }

  if (feeStructure.isDefault) {
    promises.push(deleteDefaultFeeStructures(feeStructure.schoolId));
  }

  await Promise.all(promises);
};

// ======================
// CACHE STATISTICS
// ======================

export const getFeeCacheStats = async () => {
  try {
    if (useRedis && redisClient) {
      const info = await redisClient.info('memory');
      const keys = await redisClient.keys(FEE_CACHE_CONFIG.PATTERNS.FEE_ALL);
      
      return {
        type: 'redis',
        totalKeys: keys.length,
        memoryInfo: info,
        patterns: FEE_CACHE_CONFIG.PATTERNS,
      };
    } else {
      return {
        type: 'memory',
        totalKeys: memoryCache.size,
        memoryUsage: process.memoryUsage(),
        patterns: FEE_CACHE_CONFIG.PATTERNS,
      };
    }
  } catch (error) {
    console.error('Fee cache stats error:', error);
    return null;
  }
};

export const clearFeeCache = async () => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys(FEE_CACHE_CONFIG.PATTERNS.FEE_ALL);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      memoryCache.clear();
      cacheTTL.clear();
    }
    return true;
  } catch (error) {
    console.error('Fee cache clear error:', error);
    return false;
  }
};

// ======================
// CACHE HEALTH CHECK
// ======================

export const checkFeeCacheHealth = async () => {
  try {
    const testKey = 'fee:health:test';
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



// Analytics-specific cache configuration
const FEE_ANALYTICS_CACHE_CONFIG = {
  TTL: {
    SUMMARY: 3600,          // 1 hour
    TRENDS: 86400,          // 24 hours
    COMPARISON: 86400,      // 24 hours
    SCHOOL_STATS: 1800,     // 30 minutes
    CLASS_STATS: 1800,      // 30 minutes
    STUDENT_STATS: 600,     // 10 minutes
    PAYMENT_PATTERNS: 3600, // 1 hour
  },
  
  KEYS: {
    SUMMARY: 'fee:analytics:summary:',
    TRENDS: 'fee:analytics:trends:',
    COMPARISON: 'fee:analytics:comparison:',
    SCHOOL_STATS: 'fee:analytics:school:',
    CLASS_STATS: 'fee:analytics:class:',
    STUDENT_STATS: 'fee:analytics:student:',
    PAYMENT_PATTERNS: 'fee:analytics:payment:patterns:',
  }
};

const generateAnalyticsCacheKey = (prefix, params) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${prefix}${sortedParams}`;
};

export const feeAnalyticsCacheMiddleware = (cacheType, options = {}) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheConfig = FEE_ANALYTICS_CACHE_CONFIG[cacheType] 
      ? FEE_ANALYTICS_CACHE_CONFIG 
      : FEE_CACHE_CONFIG;
    
    const prefix = cacheConfig.KEYS[cacheType] || `fee:analytics:${cacheType}:`;
    const defaultTTL = cacheConfig.TTL[cacheType] || 300; // 5 minutes fallback
    
    // Generate cache key from request parameters
    const params = {
      ...req.query,
      ...req.params,
      ...(options.additionalParams || {})
    };
    
    const cacheKey = generateAnalyticsCacheKey(prefix, params);

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
          const ttl = options.ttl || defaultTTL;
          
          setCache(cacheKey, dataToCache, ttl).catch(err => {
            console.error('Failed to cache analytics data:', err);
          });
        }
        
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Analytics cache middleware error:', error);
      next();
    }
  };
};

// Helper functions to invalidate analytics cache
export const invalidateFeeAnalyticsCache = async (scope, identifier) => {
  try {
    const prefix = FEE_ANALYTICS_CACHE_CONFIG.KEYS[scope] || `fee:analytics:${scope}:`;
    const pattern = `${prefix}${identifier ? `${identifier}:` : ''}*`;
    
    return await deleteCachePattern(pattern);
  } catch (error) {
    console.error('Failed to invalidate analytics cache:', error);
    return false;
  }
};

export const clearAllFeeAnalyticsCache = async () => {
  try {
    return await deleteCachePattern('fee:analytics:*');
  } catch (error) {
    console.error('Failed to clear analytics cache:', error);
    return false;
  }
};


// Cache configuration specific to fee assignments
const FEE_ASSIGNMENTS_CACHE_CONFIG = {
  TTL: {
    ASSIGNMENTS: 1800,          // 30 minutes
    STUDENT_ASSIGNMENTS: 900,   // 15 minutes
    CLASS_ASSIGNMENTS: 1800,    // 30 minutes
    SCHOOL_ASSIGNMENTS: 3600,   // 1 hour
    UNPAID_ASSIGNMENTS: 600,    // 10 minutes
    OVERDUE_ASSIGNMENTS: 600,   // 10 minutes
  },
  
  KEYS: {
    ASSIGNMENTS: 'fee:assignments:',
    STUDENT_ASSIGNMENTS: 'fee:assignments:student:',
    CLASS_ASSIGNMENTS: 'fee:assignments:class:',
    SCHOOL_ASSIGNMENTS: 'fee:assignments:school:',
    UNPAID_ASSIGNMENTS: 'fee:assignments:unpaid:',
    OVERDUE_ASSIGNMENTS: 'fee:assignments:overdue:',
  }
};

const generateAssignmentsCacheKey = (prefix, identifier, params = {}) => {
  const queryString = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  return `${prefix}${identifier}${queryString ? `?${queryString}` : ''}`;
};

export const feeAssignmentsCacheMiddleware = (cacheType, options = {}) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheConfig = FEE_ASSIGNMENTS_CACHE_CONFIG;
    const prefix = cacheConfig.KEYS[cacheType] || `fee:assignments:${cacheType}:`;
    const defaultTTL = options.ttl || cacheConfig.TTL[cacheType] || 300; // 5 minutes fallback

    // Determine identifier from request (studentId, classId, schoolId, etc.)
    const identifier = req.params.studentId || 
                      req.params.classId || 
                      req.params.schoolId || 
                      (options.identifierKey && req.params[options.identifierKey]) || 
                      'all';

    const cacheKey = generateAssignmentsCacheKey(prefix, identifier, req.query);

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
          
          setCache(cacheKey, dataToCache, defaultTTL).catch(err => {
            console.error('Failed to cache fee assignments data:', err);
          });
        }
        
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Fee assignments cache middleware error:', error);
      next();
    }
  };
};

// Helper functions to invalidate assignments cache
export const invalidateFeeAssignmentsCache = async (scope, identifier) => {
  try {
    const prefix = FEE_ASSIGNMENTS_CACHE_CONFIG.KEYS[scope] || `fee:assignments:${scope}:`;
    const pattern = `${prefix}${identifier || ''}*`;
    
    return await deleteCachePattern(pattern);
  } catch (error) {
    console.error('Failed to invalidate fee assignments cache:', error);
    return false;
  }
};

export const clearAllFeeAssignmentsCache = async () => {
  try {
    return await deleteCachePattern('fee:assignments:*');
  } catch (error) {
    console.error('Failed to clear fee assignments cache:', error);
    return false;
  }
};

// Fee by ID cache configuration
const FEE_BY_ID_CACHE_CONFIG = {
  TTL: 3600, // 1 hour default
  KEY_PREFIX: 'fee:byid:'
};

export const feeByIdCacheMiddleware = (options = {}) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Get feeId from request params
    const feeId = req.params.feeId || req.params.id;
    if (!feeId) {
      return next();
    }

    const cacheKey = generateCacheKey(FEE_BY_ID_CACHE_CONFIG.KEY_PREFIX, feeId);
    const ttl = options.ttl || FEE_BY_ID_CACHE_CONFIG.TTL;

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
            console.error('Failed to cache fee by ID:', err);
          });
        }
        
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Fee by ID cache middleware error:', error);
      next();
    }
  };
};

// Helper function to invalidate fee by ID cache
export const invalidateFeeByIdCache = async (feeId) => {
  try {
    const cacheKey = generateCacheKey(FEE_BY_ID_CACHE_CONFIG.KEY_PREFIX, feeId);
    return await deleteCache(cacheKey);
  } catch (error) {
    console.error('Failed to invalidate fee by ID cache:', error);
    return false;
  }
};

// General fee cache configuration
const FEE_CACHE_MIDDLEWARE_CONFIG = {
  DEFAULT_TTL: 1800, // 30 minutes
  KEY_PREFIX: 'fee:cache:',
  METHODS_TO_CACHE: ['GET'] // Only cache GET requests by default
};

/**
 * Generic fee cache middleware that can be used for various fee endpoints
 * @param {object} options - Configuration options
 * @param {string} options.keyPrefix - Custom key prefix (default: 'fee:cache:')
 * @param {number} options.ttl - Time to live in seconds (default: 1800)
 * @param {string[]} options.methods - HTTP methods to cache (default: ['GET'])
 * @param {function} options.keyGenerator - Custom cache key generator function
 * @param {function} options.shouldCache - Function to determine if response should be cached
 */
export const feeCacheMiddleware = (options = {}) => {
  const config = {
    ...FEE_CACHE_MIDDLEWARE_CONFIG,
    ...options
  };

  return async (req, res, next) => {
    // Skip if method shouldn't be cached
    if (!config.methods.includes(req.method)) {
      return next();
    }

    // Generate cache key
    const cacheKey = config.keyGenerator 
      ? config.keyGenerator(req) 
      : generateCacheKey(
          config.KEY_PREFIX, 
          `${req.path}:${JSON.stringify(req.query)}:${JSON.stringify(req.params)}`
        );

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
        // Check if we should cache this response
        const shouldCache = config.shouldCache 
          ? config.shouldCache(req, res, body) 
          : res.statusCode >= 200 && res.statusCode < 300;

        if (shouldCache) {
          const dataToCache = body.data || body;
          setCache(cacheKey, dataToCache, config.ttl).catch(err => {
            console.error('Failed to cache fee data:', err);
          });
        }
        
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Fee cache middleware error:', error);
      next();
    }
  };
};

// Helper function to invalidate cache by pattern
export const invalidateFeeCache = async (pattern = 'fee:cache:*') => {
  try {
    return await deleteCachePattern(pattern);
  } catch (error) {
    console.error('Failed to invalidate fee cache:', error);
    return false;
  }
};

// Fee Items cache configuration
const FEE_ITEMS_CACHE_CONFIG = {
  TTL: 3600, // 1 hour default
  KEY_PREFIX: 'fee:items:',
  VERSION: 'v1' // Cache version for invalidation
};

/**
 * Cache middleware specifically for fee items
 * @param {object} options - Configuration options
 * @param {number} options.ttl - Time to live in seconds (default: 3600)
 * @param {string} options.keyPrefix - Custom key prefix (default: 'fee:items:')
 * @param {boolean} options.byStructure - Whether to cache by fee structure ID
 */
export const feeItemsCacheMiddleware = (options = {}) => {
  const config = {
    ...FEE_ITEMS_CACHE_CONFIG,
    ...options
  };

  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Determine cache key based on options
    let cacheKey;
    if (config.byStructure) {
      const structureId = req.params.structureId || req.params.id;
      if (!structureId) {
        return next();
      }
      cacheKey = generateCacheKey(config.KEY_PREFIX + 'structure:', structureId);
    } else {
      // Default key based on request path and query
      cacheKey = generateCacheKey(
        config.KEY_PREFIX, 
        `${req.path}:${JSON.stringify(req.query)}:${JSON.stringify(req.params)}:${config.VERSION}`
      );
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
        // Only cache successful responses with data
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const dataToCache = body.data || body;
          
          setCache(cacheKey, dataToCache, config.ttl).catch(err => {
            console.error('Failed to cache fee items:', err);
          });
        }
        
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Fee items cache middleware error:', error);
      next();
    }
  };
};

// Helper functions for fee items cache
export const invalidateFeeItemsCache = async (structureId = null) => {
  try {
    if (structureId) {
      // Invalidate cache for specific fee structure
      const key = generateCacheKey(FEE_ITEMS_CACHE_CONFIG.KEY_PREFIX + 'structure:', structureId);
      return await deleteCache(key);
    } else {
      // Invalidate all fee items cache
      return await deleteCachePattern(`${FEE_ITEMS_CACHE_CONFIG.KEY_PREFIX}*`);
    }
  } catch (error) {
    console.error('Failed to invalidate fee items cache:', error);
    return false;
  }
};

export const updateFeeItemsCache = async (structureId, data) => {
  try {
    const key = generateCacheKey(FEE_ITEMS_CACHE_CONFIG.KEY_PREFIX + 'structure:', structureId);
    return await setCache(key, data, FEE_ITEMS_CACHE_CONFIG.TTL);
  } catch (error) {
    console.error('Failed to update fee items cache:', error);
    return false;
  }
};

// Fee Statistics cache configuration
const FEE_STATS_CACHE_CONFIG = {
  TTL: {
    DAILY: 3600,          // 1 hour
    WEEKLY: 86400,        // 24 hours
    MONTHLY: 86400 * 7,   // 7 days
    YEARLY: 86400 * 30,   // 30 days
    CUSTOM: 1800          // 30 minutes
  },
  KEY_PREFIX: 'fee:stats:',
  VERSION: 'v1'
};

/**
 * Cache middleware specifically for fee statistics endpoints
 * @param {object} options - Configuration options
 * @param {string} options.period - Time period for stats (daily, weekly, monthly, yearly)
 * @param {number} options.customTTL - Custom TTL override
 * @param {string} options.keySuffix - Additional key suffix
 */
export const feeStatsCacheMiddleware = (options = {}) => {
  const period = options.period || 'custom';
  const ttl = options.customTTL || FEE_STATS_CACHE_CONFIG.TTL[period.toUpperCase()] || FEE_STATS_CACHE_CONFIG.TTL.CUSTOM;

  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key based on period and request parameters
    const dateParam = req.query.date || req.params.date || 'current';
    const keySuffix = options.keySuffix || '';
    const cacheKey = generateCacheKey(
      `${FEE_STATS_CACHE_CONFIG.KEY_PREFIX}${period}:`,
      `${dateParam}:${keySuffix}:${FEE_STATS_CACHE_CONFIG.VERSION}`
    );

    try {
      // Try to get cached data
      const cachedData = await getCache(cacheKey);
      
      if (cachedData) {
        // Send cached response
        return res.status(200).json({
          success: true,
          fromCache: true,
          data: cachedData,
          cacheInfo: {
            period,
            expiresIn: ttl - (Date.now() - (cachedData.cachedAt || Date.now())) / 1000
          }
        });
      }

      // Override res.json to cache the response before sending
      const originalJson = res.json;
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const dataToCache = {
            ...(body.data || body),
            cachedAt: Date.now()
          };
          
          setCache(cacheKey, dataToCache, ttl).catch(err => {
            console.error('Failed to cache fee stats:', err);
          });
        }
        
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Fee stats cache middleware error:', error);
      next();
    }
  };
};

// Helper functions for fee stats cache
export const invalidateFeeStatsCache = async (period = null, date = null) => {
  try {
    let pattern;
    if (period && date) {
      pattern = generateCacheKey(`${FEE_STATS_CACHE_CONFIG.KEY_PREFIX}${period}:`, `${date}:*`);
    } else if (period) {
      pattern = `${FEE_STATS_CACHE_CONFIG.KEY_PREFIX}${period}:*`;
    } else {
      pattern = `${FEE_STATS_CACHE_CONFIG.KEY_PREFIX}*`;
    }
    
    return await deleteCachePattern(pattern);
  } catch (error) {
    console.error('Failed to invalidate fee stats cache:', error);
    return false;
  }
};

export const updateFeeStatsCache = async (period, date, data) => {
  try {
    const cacheKey = generateCacheKey(
      `${FEE_STATS_CACHE_CONFIG.KEY_PREFIX}${period}:`,
      `${date || 'current'}:${FEE_STATS_CACHE_CONFIG.VERSION}`
    );
    const ttl = FEE_STATS_CACHE_CONFIG.TTL[period.toUpperCase()] || FEE_STATS_CACHE_CONFIG.TTL.CUSTOM;
    
    return await setCache(cacheKey, {
      ...data,
      cachedAt: Date.now()
    }, ttl);
  } catch (error) {
    console.error('Failed to update fee stats cache:', error);
    return false;
  }
};

// Fee Structure cache configuration
const FEE_STRUCTURE_CACHE_CONFIG = {
  TTL: {
    DEFAULT: 3600,          // 1 hour
    ACTIVE: 86400,          // 24 hours for active structures
    ARCHIVED: 604800,       // 1 week for archived structures
    DETAILED: 1800          // 30 minutes for detailed views
  },
  KEY_PREFIX: 'fee:structure:',
  VERSION: 'v2'
};

/**
 * Cache middleware specifically for fee structure endpoints
 * @param {object} options - Configuration options
 * @param {string} options.type - Cache type (default, active, archived, detailed)
 * @param {boolean} options.bySchool - Whether to cache by school ID
 * @param {boolean} options.byClass - Whether to cache by class ID
 */
export const feeStructureCacheMiddleware = (options = {}) => {
  const cacheType = options.type || 'default';
  const ttl = options.customTTL || FEE_STRUCTURE_CACHE_CONFIG.TTL[cacheType.toUpperCase()] || FEE_STRUCTURE_CACHE_CONFIG.TTL.DEFAULT;

  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate appropriate cache key
    let cacheKey;
    if (options.bySchool) {
      const schoolId = req.params.schoolId || req.query.schoolId;
      cacheKey = generateCacheKey(
        `${FEE_STRUCTURE_CACHE_CONFIG.KEY_PREFIX}school:`, 
        `${schoolId}:${cacheType}:${FEE_STRUCTURE_CACHE_CONFIG.VERSION}`
      );
    } else if (options.byClass) {
      const classId = req.params.classId || req.query.classId;
      cacheKey = generateCacheKey(
        `${FEE_STRUCTURE_CACHE_CONFIG.KEY_PREFIX}class:`, 
        `${classId}:${cacheType}:${FEE_STRUCTURE_CACHE_CONFIG.VERSION}`
      );
    } else {
      const structureId = req.params.structureId || req.params.id;
      cacheKey = generateCacheKey(
        `${FEE_STRUCTURE_CACHE_CONFIG.KEY_PREFIX}`, 
        `${structureId || 'list'}:${cacheType}:${FEE_STRUCTURE_CACHE_CONFIG.VERSION}`
      );
    }

    try {
      // Try to get cached data
      const cachedData = await getCache(cacheKey);
      
      if (cachedData) {
        // Send cached response
        return res.status(200).json({
          success: true,
          fromCache: true,
          data: cachedData,
          cacheInfo: {
            type: cacheType,
            expiresIn: ttl
          }
        });
      }

      // Override res.json to cache the response before sending
      const originalJson = res.json;
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const dataToCache = body.data || body;
          
          // Add metadata for active/archived status if not present
          if (options.type && !dataToCache.cacheType) {
            dataToCache.cacheType = options.type;
          }
          
          setCache(cacheKey, dataToCache, ttl).catch(err => {
            console.error('Failed to cache fee structure:', err);
          });
        }
        
        return originalJson.call(res, body);
      };

      next();
    } catch (error) {
      console.error('Fee structure cache middleware error:', error);
      next();
    }
  };
};

// Helper functions for fee structure cache
export const invalidateFeeStructureCache = async (structureId = null, options = {}) => {
  try {
    let pattern;
    if (structureId) {
      pattern = generateCacheKey(FEE_STRUCTURE_CACHE_CONFIG.KEY_PREFIX, `${structureId}:*`);
    } else if (options.schoolId) {
      pattern = generateCacheKey(`${FEE_STRUCTURE_CACHE_CONFIG.KEY_PREFIX}school:`, `${options.schoolId}:*`);
    } else if (options.classId) {
      pattern = generateCacheKey(`${FEE_STRUCTURE_CACHE_CONFIG.KEY_PREFIX}class:`, `${options.classId}:*`);
    } else {
      pattern = `${FEE_STRUCTURE_CACHE_CONFIG.KEY_PREFIX}*`;
    }
    
    return await deleteCachePattern(pattern);
  } catch (error) {
    console.error('Failed to invalidate fee structure cache:', error);
    return false;
  }
};

export const updateFeeStructureCache = async (structureId, data, options = {}) => {
  try {
    const cacheType = options.type || 'default';
    const ttl = options.customTTL || FEE_STRUCTURE_CACHE_CONFIG.TTL[cacheType.toUpperCase()];
    
    const cacheKey = generateCacheKey(
      FEE_STRUCTURE_CACHE_CONFIG.KEY_PREFIX, 
      `${structureId}:${cacheType}:${FEE_STRUCTURE_CACHE_CONFIG.VERSION}`
    );
    
    return await setCache(cacheKey, data, ttl);
  } catch (error) {
    console.error('Failed to update fee structure cache:', error);
    return false;
  }
};
// ======================
// EXPORTS
// ======================

export {
  FEE_CACHE_CONFIG,
  FEE_ANALYTICS_CACHE_CONFIG,
  FEE_ASSIGNMENTS_CACHE_CONFIG,
  generateCacheKey,
  generateSearchKey,
  setCache as setFeeCache,
  getCache as getFeeCache,
  deleteCache as deleteFeeCache,
  deleteCachePattern as deleteFeeCachePattern,

};
import Redis from 'ioredis';
import logger from '../config/logger.js';

// ======================
// CACHE CONFIGURATION
// ======================

// Redis configuration (optional - falls back to memory store if not available)
let redisClient = null;
let useRedis = false;

// Disable Redis for now - only use memory cache
console.log('Redis disabled - using memory cache only');

// Memory cache fallback
const memoryCache = new Map();
const cacheTTL = new Map();

const CACHE_PREFIX = 'staff';
const DEFAULT_TTL = 1800; // 30 minutes
const STATS_TTL = 900; // 15 minutes
const ANALYTICS_TTL = 1800; // 30 minutes
const PERFORMANCE_TTL = 3600; // 1 hour
const SEARCH_TTL = 900; // 15 minutes
const LIST_TTL = 1800; // 30 minutes
const BY_ID_TTL = 3600; // 1 hour

// ======================
// CACHE KEYS GENERATION
// ======================

export const generateCacheKey = (type, identifier, params = {}) => {
  const keyParts = [CACHE_PREFIX, type];
  
  if (identifier) {
    keyParts.push(identifier);
  }
  
  if (Object.keys(params).length > 0) {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join(':');
    keyParts.push(paramString);
  }
  
  return keyParts.join(':');
};

// ======================
// CACHE OPERATIONS
// ======================

export const getFromCache = async (key) => {
  try {
    if (useRedis && redisClient) {
      const cached = await redisClient.get(key);
      if (cached) {
        const data = JSON.parse(cached);
        logger.debug(`Cache hit for key: ${key}`);
        return data;
      }
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } else {
      // Memory cache fallback
      if (isExpired(key)) {
        memoryCache.delete(key);
        cacheTTL.delete(key);
        return null;
      }
      const data = memoryCache.get(key);
      if (data) {
        logger.debug(`Cache hit for key: ${key}`);
        return data;
      }
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    }
  } catch (error) {
    logger.error('Cache get error:', error);
    return null;
  }
};

export const setCache = async (key, data, ttl = DEFAULT_TTL) => {
  try {
    if (useRedis && redisClient) {
      await redisClient.setex(key, ttl, JSON.stringify(data));
    } else {
      // Memory cache fallback
      memoryCache.set(key, data);
      cacheTTL.set(key, Date.now() + (ttl * 1000));
    }
    logger.debug(`Cache set for key: ${key} with TTL: ${ttl}`);
  } catch (error) {
    logger.error('Cache set error:', error);
  }
};

export const deleteCache = async (pattern) => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
        logger.debug(`Cache deleted ${keys.length} keys matching pattern: ${pattern}`);
      }
    } else {
      // Memory cache fallback
      let deletedCount = 0;
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          memoryCache.delete(key);
          cacheTTL.delete(key);
          deletedCount++;
        }
      }
      logger.debug(`Cache deleted ${deletedCount} keys matching pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error('Cache delete error:', error);
  }
};

const isExpired = (key) => {
  const expiry = cacheTTL.get(key);
  return expiry && Date.now() > expiry;
};

export const invalidateStaffCache = async (staffId, schoolId) => {
  try {
    const patterns = [
      generateCacheKey('byId', staffId),
      generateCacheKey('stats', staffId),
      generateCacheKey('analytics', staffId, { period: '*' }),
      generateCacheKey('performance', staffId),
      generateCacheKey('search', '*'),
      generateCacheKey('list', '*'),
      generateCacheKey('bySchool', schoolId),
      generateCacheKey('countByDepartment', schoolId),
      generateCacheKey('countByDesignation', schoolId),
      generateCacheKey('report', schoolId)
    ];

    await Promise.all(patterns.map(pattern => deleteCache(pattern)));
    logger.info(`Invalidated cache for staff: ${staffId}, school: ${schoolId}`);
  } catch (error) {
    logger.error('Cache invalidation error:', error);
  }
};

// ======================
// CACHE MIDDLEWARE
// ======================

export const staffCacheMiddleware = (ttl = LIST_TTL) => {
  return async (req, res, next) => {
    console.log('staffCacheMiddleware: start');
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const include = req.query.include;
      
      const cacheKey = generateCacheKey('list', null, {
        schoolId,
        ...filters,
        include: include || 'default'
      });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Staff retrieved from cache',
          data: cached.staff,
          pagination: cached.pagination,
          meta: {
            ...cached.meta,
            cacheStatus: 'hit',
            cacheKey
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, {
            staff: data.data,
            pagination: data.pagination,
            meta: {
              ...data.meta,
              cacheStatus: 'miss',
              cachedAt: new Date().toISOString()
            }
          }, ttl);
        }
        
        // Call original send method
        return originalSend.call(this, {
          ...data,
          meta: {
            ...data.meta,
            cacheStatus: 'miss',
            cacheKey
          }
        });
      };

      next();
    } catch (error) {
      logger.error('Staff cache middleware error:', error);
      next();
    }
  };
};

export const staffByIdCacheMiddleware = (ttl = BY_ID_TTL) => {
  return async (req, res, next) => {
    console.log('staffByIdCacheMiddleware: start');
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const include = req.query.include;
      
      const cacheKey = generateCacheKey('byId', id, {
        schoolId,
        include: include || 'default'
      });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Staff retrieved from cache',
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            staffId: parseInt(id),
            cacheStatus: 'hit',
            cacheKey
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, data.data, ttl);
        }
        
        // Call original send method
        return originalSend.call(this, {
          ...data,
          meta: {
            ...data.meta,
            cacheStatus: 'miss',
            cacheKey
          }
        });
      };

      next();
    } catch (error) {
      logger.error('Staff by ID cache middleware error:', error);
      next();
    }
  };
};

export const staffStatsCacheMiddleware = (ttl = STATS_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      
      const cacheKey = generateCacheKey('stats', id, { schoolId });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Staff statistics retrieved from cache',
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            staffId: parseInt(id),
            cacheStatus: 'hit',
            cacheKey
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, data.data, ttl);
        }
        
        // Call original send method
        return originalSend.call(this, {
          ...data,
          meta: {
            ...data.meta,
            cacheStatus: 'miss',
            cacheKey
          }
        });
      };

      next();
    } catch (error) {
      logger.error('Staff stats cache middleware error:', error);
      next();
    }
  };
};

export const staffAnalyticsCacheMiddleware = (ttl = ANALYTICS_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { period = '30d' } = req.query;
      
      const cacheKey = generateCacheKey('analytics', id, { schoolId, period });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Staff analytics retrieved from cache',
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            staffId: parseInt(id),
            period,
            cacheStatus: 'hit',
            cacheKey
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, data.data, ttl);
        }
        
        // Call original send method
        return originalSend.call(this, {
          ...data,
          meta: {
            ...data.meta,
            cacheStatus: 'miss',
            cacheKey
          }
        });
      };

      next();
    } catch (error) {
      logger.error('Staff analytics cache middleware error:', error);
      next();
    }
  };
};

export const staffPerformanceCacheMiddleware = (ttl = PERFORMANCE_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      
      const cacheKey = generateCacheKey('performance', id, { schoolId });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Staff performance retrieved from cache',
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            staffId: parseInt(id),
            cacheStatus: 'hit',
            cacheKey
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, data.data, ttl);
        }
        
        // Call original send method
        return originalSend.call(this, {
          ...data,
          meta: {
            ...data.meta,
            cacheStatus: 'miss',
            cacheKey
          }
        });
      };

      next();
    } catch (error) {
      logger.error('Staff performance cache middleware error:', error);
      next();
    }
  };
};

export const staffSearchCacheMiddleware = (ttl = SEARCH_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { q: query } = req.query;
      const include = req.query.include;
      
      if (!query || query.trim().length < 2) {
        return next();
      }
      
      const cacheKey = generateCacheKey('search', null, {
        schoolId,
        query: query.trim(),
        include: include || 'default'
      });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Staff search results retrieved from cache',
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            query: query.trim(),
            total: cached.length,
            cacheStatus: 'hit',
            cacheKey
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, data.data, ttl);
        }
        
        // Call original send method
        return originalSend.call(this, {
          ...data,
          meta: {
            ...data.meta,
            cacheStatus: 'miss',
            cacheKey
          }
        });
      };

      next();
    } catch (error) {
      logger.error('Staff search cache middleware error:', error);
      next();
    }
  };
};

export const staffBySchoolCacheMiddleware = (ttl = LIST_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const include = req.query.include;
      
      const cacheKey = generateCacheKey('bySchool', schoolId, {
        include: include || 'default'
      });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Staff by school retrieved from cache',
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            schoolId,
            total: cached.length,
            cacheStatus: 'hit',
            cacheKey
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, data.data, ttl);
        }
        
        // Call original send method
        return originalSend.call(this, {
          ...data,
          meta: {
            ...data.meta,
            cacheStatus: 'miss',
            cacheKey
          }
        });
      };

      next();
    } catch (error) {
      logger.error('Staff by school cache middleware error:', error);
      next();
    }
  };
};

export const staffCountCacheMiddleware = (ttl = 3600) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { type } = req.params; // 'department' or 'designation'
      
      const cacheKey = generateCacheKey(`countBy${type.charAt(0).toUpperCase() + type.slice(1)}`, schoolId);

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: `Staff count by ${type} retrieved from cache`,
          data: cached,
          meta: {
            timestamp: new Date().toISOString(),
            cacheStatus: 'hit',
            cacheKey
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, data.data, ttl);
        }
        
        // Call original send method
        return originalSend.call(this, {
          ...data,
          meta: {
            ...data.meta,
            cacheStatus: 'miss',
            cacheKey
          }
        });
      };

      next();
    } catch (error) {
      logger.error('Staff count cache middleware error:', error);
      next();
    }
  };
};

// ======================
// CACHE UTILITIES
// ======================

export const getCacheStats = async () => {
  try {
    const keys = await redisClient.keys(`${CACHE_PREFIX}:*`);
    const stats = {
      totalKeys: keys.length,
      memoryUsage: await redisClient.memory('usage'),
      keyTypes: {
        byId: keys.filter(key => key.includes(':byId:')).length,
        list: keys.filter(key => key.includes(':list:')).length,
        stats: keys.filter(key => key.includes(':stats:')).length,
        analytics: keys.filter(key => key.includes(':analytics:')).length,
        performance: keys.filter(key => key.includes(':performance:')).length,
        search: keys.filter(key => key.includes(':search:')).length,
        bySchool: keys.filter(key => key.includes(':bySchool:')).length,
        countByDepartment: keys.filter(key => key.includes(':countByDepartment:')).length,
        countByDesignation: keys.filter(key => key.includes(':countByDesignation:')).length,
        report: keys.filter(key => key.includes(':report:')).length
      },
      keySizes: await Promise.all(
        keys.slice(0, 10).map(async key => ({
          key,
          size: await redisClient.memory('usage', key)
        }))
      )
    };

    return stats;
  } catch (error) {
    logger.error('Get cache stats error:', error);
    throw error;
  }
};

export const warmCache = async (schoolId, staffId = null) => {
  try {
    const warmedKeys = [];
    
    if (staffId) {
      // Warm specific staff cache
      const patterns = [
        generateCacheKey('byId', staffId),
        generateCacheKey('stats', staffId),
        generateCacheKey('analytics', staffId, { period: '30d' }),
        generateCacheKey('performance', staffId)
      ];
      
      for (const pattern of patterns) {
        const exists = await redisClient.exists(pattern);
        if (!exists) {
          warmedKeys.push(pattern);
        }
      }
    } else {
      // Warm school-level cache
      const patterns = [
        generateCacheKey('list', null, { schoolId, page: 1, limit: 50 }),
        generateCacheKey('countByDepartment', schoolId),
        generateCacheKey('countByDesignation', schoolId),
        generateCacheKey('bySchool', schoolId)
      ];
      
      for (const pattern of patterns) {
        const exists = await redisClient.exists(pattern);
        if (!exists) {
          warmedKeys.push(pattern);
        }
      }
    }

    return {
      success: true,
      message: `Cache warming initiated for ${warmedKeys.length} keys`,
      warmedKeys
    };
  } catch (error) {
    logger.error('Warm cache error:', error);
    throw error;
  }
};

export const clearCache = async (schoolId = null) => {
  try {
    let pattern;
    if (schoolId) {
      pattern = `${CACHE_PREFIX}:*:schoolId:${schoolId}`;
    } else {
      pattern = `${CACHE_PREFIX}:*`;
    }

    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    return {
      success: true,
      message: `Cleared ${keys.length} cache keys`,
      clearedKeys: keys.length,
      scope: schoolId ? 'school' : 'global'
    };
  } catch (error) {
    logger.error('Clear cache error:', error);
    throw error;
  }
};

export const getCacheHealth = async () => {
  try {
    const info = await redisClient.info('memory');
    const memoryLines = info.split('\r\n').filter(line => line.startsWith('used_memory'));
    const usedMemory = memoryLines[0]?.split(':')[1] || '0';
    
    const keys = await redisClient.keys(`${CACHE_PREFIX}:*`);
    const totalKeys = keys.length;
    
    const health = {
      status: 'healthy',
      usedMemory: parseInt(usedMemory),
      totalKeys,
      cachePrefix: CACHE_PREFIX,
      timestamp: new Date().toISOString()
    };

    // Check if cache is overloaded
    if (totalKeys > 10000) {
      health.status = 'warning';
      health.message = 'High number of cache keys';
    }

    if (parseInt(usedMemory) > 100 * 1024 * 1024) { // 100MB
      health.status = 'warning';
      health.message = 'High memory usage';
    }

    return health;
  } catch (error) {
    logger.error('Get cache health error:', error);
    return {
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}; 
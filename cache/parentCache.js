import Redis from 'ioredis';
import logger  from '../config/logger.js';

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

const CACHE_PREFIX = 'parent';
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

// ======================
// CACHE MIDDLEWARE FUNCTIONS
// ======================

export const parentCacheMiddleware = (ttl = LIST_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const include = req.query.include;
      
      const cacheKey = generateCacheKey('list', schoolId, {
        filters: JSON.stringify(filters),
        include: include || 'default'
      });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Parents retrieved from cache',
          data: cached.parents,
          pagination: cached.pagination,
          meta: {
            ...cached.meta,
            cacheStatus: 'hit',
            timestamp: new Date().toISOString()
          }
        });
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, {
            parents: data.data,
            pagination: data.pagination,
            meta: data.meta
          }, ttl);
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Parent cache middleware error:', error);
      next();
    }
  };
};

export const parentByIdCacheMiddleware = (ttl = DEFAULT_TTL) => {
  return async (req, res, next) => {
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
          message: 'Parent retrieved from cache',
          data: cached,
          meta: {
            cacheStatus: 'hit',
            timestamp: new Date().toISOString(),
            parentId: parseInt(id)
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
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Parent by ID cache middleware error:', error);
      next();
    }
  };
};

export const parentStatsCacheMiddleware = (ttl = STATS_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      
      const cacheKey = generateCacheKey('stats', id, { schoolId });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Parent statistics retrieved from cache',
          data: cached,
          meta: {
            cacheStatus: 'hit',
            timestamp: new Date().toISOString(),
            parentId: parseInt(id)
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
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Parent stats cache middleware error:', error);
      next();
    }
  };
};

export const parentAnalyticsCacheMiddleware = (ttl = ANALYTICS_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { period = '30d' } = req.query;
      
      const cacheKey = generateCacheKey('analytics', id, {
        schoolId,
        period
      });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Parent analytics retrieved from cache',
          data: cached,
          meta: {
            cacheStatus: 'hit',
            timestamp: new Date().toISOString(),
            parentId: parseInt(id),
            period
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
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Parent analytics cache middleware error:', error);
      next();
    }
  };
};

export const parentPerformanceCacheMiddleware = (ttl = PERFORMANCE_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      
      const cacheKey = generateCacheKey('performance', id, { schoolId });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Parent performance retrieved from cache',
          data: cached,
          meta: {
            cacheStatus: 'hit',
            timestamp: new Date().toISOString(),
            parentId: parseInt(id)
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
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Parent performance cache middleware error:', error);
      next();
    }
  };
};

export const parentSearchCacheMiddleware = (ttl = SEARCH_TTL) => {
  return async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { q: query } = req.query;
      const include = req.query.include;
      
      if (!query || query.trim().length < 2) {
        return next();
      }
      
      const cacheKey = generateCacheKey('search', schoolId, {
        query: query.trim(),
        include: include || 'default'
      });

      const cached = await getFromCache(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          message: 'Parent search results retrieved from cache',
          data: cached,
          meta: {
            cacheStatus: 'hit',
            timestamp: new Date().toISOString(),
            query: query.trim(),
            total: cached.length
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
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Parent search cache middleware error:', error);
      next();
    }
  };
};

export const parentBySchoolCacheMiddleware = (ttl = LIST_TTL) => {
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
          message: 'Parents by school retrieved from cache',
          data: cached,
          meta: {
            cacheStatus: 'hit',
            timestamp: new Date().toISOString(),
            schoolId,
            total: cached.length
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
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Parent by school cache middleware error:', error);
      next();
    }
  };
};

// ======================
// CACHE INVALIDATION FUNCTIONS
// ======================

export const invalidateParentCache = async (parentId, schoolId) => {
  const patterns = [
    `${CACHE_PREFIX}:byId:${parentId}:*`,
    `${CACHE_PREFIX}:stats:${parentId}:*`,
    `${CACHE_PREFIX}:analytics:${parentId}:*`,
    `${CACHE_PREFIX}:performance:${parentId}:*`,
    `${CACHE_PREFIX}:list:*:school:${schoolId}:*`,
    `${CACHE_PREFIX}:bySchool:${schoolId}:*`,
    `${CACHE_PREFIX}:search:*:school:${schoolId}:*`,
    `${CACHE_PREFIX}:countByIncome:${schoolId}`,
    `${CACHE_PREFIX}:countByEducation:${schoolId}`
  ];

  await deleteCache(patterns.join(','));
  logger.info(`Parent cache invalidated for parentId: ${parentId}, schoolId: ${schoolId}`);
};

export const invalidateParentListCache = async (schoolId) => {
  const patterns = [
    `${CACHE_PREFIX}:list:*:school:${schoolId}:*`,
    `${CACHE_PREFIX}:bySchool:${schoolId}:*`,
    `${CACHE_PREFIX}:search:*:school:${schoolId}:*`,
    `${CACHE_PREFIX}:countByIncome:${schoolId}`,
    `${CACHE_PREFIX}:countByEducation:${schoolId}`
  ];

  await deleteCache(patterns.join(','));
  logger.info(`Parent list cache invalidated for schoolId: ${schoolId}`);
};

export const invalidateAllParentCache = async (schoolId = null) => {
  const patterns = schoolId 
    ? [`${CACHE_PREFIX}:*:school:${schoolId}:*`, `${CACHE_PREFIX}:*:${schoolId}`]
    : [`${CACHE_PREFIX}:*`];

  await deleteCache(patterns.join(','));
  logger.info(`All parent cache invalidated for ${schoolId ? `schoolId: ${schoolId}` : 'all schools'}`);
};

// ======================
// CACHE UTILITY FUNCTIONS
// ======================

export const getParentCacheStats = async () => {
  try {
    const keys = await redisClient.keys(`${CACHE_PREFIX}:*`);
    const stats = {
      totalKeys: keys.length,
      memoryUsage: await redisClient.memory('usage'),
      hitRate: await redisClient.info('stats').then(info => {
        const lines = info.split('\r\n');
        const hits = lines.find(line => line.startsWith('keyspace_hits:'))?.split(':')[1] || 0;
        const misses = lines.find(line => line.startsWith('keyspace_misses:'))?.split(':')[1] || 0;
        const total = parseInt(hits) + parseInt(misses);
        return total > 0 ? (parseInt(hits) / total * 100).toFixed(2) : 0;
      }),
      keyTypes: {
        byId: keys.filter(key => key.includes(':byId:')).length,
        list: keys.filter(key => key.includes(':list:')).length,
        stats: keys.filter(key => key.includes(':stats:')).length,
        analytics: keys.filter(key => key.includes(':analytics:')).length,
        performance: keys.filter(key => key.includes(':performance:')).length,
        search: keys.filter(key => key.includes(':search:')).length,
        bySchool: keys.filter(key => key.includes(':bySchool:')).length,
        countByIncome: keys.filter(key => key.includes(':countByIncome:')).length,
        countByEducation: keys.filter(key => key.includes(':countByEducation:')).length
      }
    };

    return stats;
  } catch (error) {
    logger.error('Get parent cache stats error:', error);
    throw error;
  }
};

export const warmParentCache = async (schoolId, parentId = null) => {
  try {
    if (parentId) {
      // Warm specific parent cache
      const cacheKey = generateCacheKey('byId', parentId, { schoolId });
      const cached = await getFromCache(cacheKey);
      if (!cached) {
        logger.info(`Warming cache for parent: ${parentId}`);
        // This would typically trigger a cache miss and populate the cache
      }
    } else {
      // Warm school-level cache
      const patterns = [
        `${CACHE_PREFIX}:list:*:school:${schoolId}:*`,
        `${CACHE_PREFIX}:bySchool:${schoolId}:*`,
        `${CACHE_PREFIX}:countByIncome:${schoolId}`,
        `${CACHE_PREFIX}:countByEducation:${schoolId}`
      ];

      for (const pattern of patterns) {
        const keys = await redisClient.keys(pattern);
        if (keys.length === 0) {
          logger.info(`Warming cache for pattern: ${pattern}`);
          // This would typically trigger cache misses and populate the cache
        }
      }
    }

    return { success: true, message: 'Parent cache warmed successfully' };
  } catch (error) {
    logger.error('Warm parent cache error:', error);
    throw error;
  }
};

export const clearParentCache = async (schoolId = null) => {
  try {
    if (schoolId) {
      await invalidateParentListCache(schoolId);
    } else {
      await invalidateAllParentCache();
    }

    return { success: true, message: 'Parent cache cleared successfully' };
  } catch (error) {
    logger.error('Clear parent cache error:', error);
    throw error;
  }
};

// ======================
// CACHE MONITORING
// ======================

export const monitorParentCache = async () => {
  try {
    const stats = await getParentCacheStats();
    const health = {
      status: 'healthy',
      hitRate: parseFloat(stats.hitRate),
      memoryUsage: stats.memoryUsage,
      totalKeys: stats.totalKeys,
      timestamp: new Date().toISOString()
    };

    // Determine health status
    if (health.hitRate < 50) {
      health.status = 'warning';
      health.message = 'Low cache hit rate detected';
    }

    if (health.memoryUsage > 100 * 1024 * 1024) { // 100MB
      health.status = 'warning';
      health.message = 'High memory usage detected';
    }

    if (health.totalKeys > 10000) {
      health.status = 'warning';
      health.message = 'Large number of cache keys detected';
    }

    return health;
  } catch (error) {
    logger.error('Monitor parent cache error:', error);
    return {
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// ======================
// CACHE CONFIGURATION EXPORTS
// ======================

export const CACHE_CONFIG = {
  PREFIX: CACHE_PREFIX,
  TTL: {
    DEFAULT: DEFAULT_TTL,
    STATS: STATS_TTL,
    ANALYTICS: ANALYTICS_TTL,
    PERFORMANCE: PERFORMANCE_TTL,
    SEARCH: SEARCH_TTL,
    LIST: LIST_TTL
  }
};

export default {
  parentCacheMiddleware,
  parentByIdCacheMiddleware,
  parentStatsCacheMiddleware,
  parentAnalyticsCacheMiddleware,
  parentPerformanceCacheMiddleware,
  parentSearchCacheMiddleware,
  parentBySchoolCacheMiddleware,
  invalidateParentCache,
  invalidateParentListCache,
  invalidateAllParentCache,
  getParentCacheStats,
  warmParentCache,
  clearParentCache,
  monitorParentCache,
  CACHE_CONFIG
}; 
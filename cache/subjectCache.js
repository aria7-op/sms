import Redis from 'ioredis';
import { CACHE_CONFIG } from '../config/config.js';

// Disable Redis for now - only use memory cache
console.log('Redis disabled - using memory cache only');

// Create a mock Redis client that doesn't connect
const redis = {
  get: async (key) => null,
  set: async (key, value, ttl) => {},
  setex: async (key, ttl, value) => {},
  del: async (key) => {},
  keys: async (pattern) => [],
  flushall: async () => {},
  on: () => {},
  off: () => {},
  connect: async () => {},
  disconnect: async () => {},
  quit: async () => {},
  info: async () => 'memory',
  dbsize: async () => 0,
  ping: async () => 'PONG',
  memory: async () => 0
};

// ======================
// CACHE CONFIGURATION
// ======================

export const SUBJECT_CACHE_CONFIG = {
  ...CACHE_CONFIG,
  TTL: {
    SUBJECT: 3600, // 1 hour
    SUBJECT_LIST: 1800, // 30 minutes
    SUBJECT_SEARCH: 900, // 15 minutes
    SUBJECT_STATS: 7200, // 2 hours
    SUBJECT_ANALYTICS: 3600, // 1 hour
    SUBJECT_PERFORMANCE: 1800, // 30 minutes
    SUBJECT_EXPORT: 300, // 5 minutes
    SUBJECT_COUNTS: 3600, // 1 hour
  },
  PREFIXES: {
    SUBJECT: 'subject',
    SUBJECT_LIST: 'subject:list',
    SUBJECT_SEARCH: 'subject:search',
    SUBJECT_STATS: 'subject:stats',
    SUBJECT_ANALYTICS: 'subject:analytics',
    SUBJECT_PERFORMANCE: 'subject:performance',
    SUBJECT_EXPORT: 'subject:export',
    SUBJECT_COUNTS: 'subject:counts',
    SUBJECT_BY_SCHOOL: 'subject:school',
    SUBJECT_BY_DEPARTMENT: 'subject:dept',
    SUBJECT_BY_TYPE: 'subject:type',
  },
};

// ======================
// CACHE KEY GENERATORS
// ======================

export const generateCacheKey = (prefix, params = {}) => {
  const sortedParams = Object.keys(params)
    .sort()
    .filter(key => params[key] !== undefined && params[key] !== null)
    .map(key => `${key}:${params[key]}`)
    .join(':');
  return `${prefix}:${sortedParams}`;
};

export const generateSearchKey = (params) => {
  return generateCacheKey(SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_SEARCH, params);
};

export const generateStatsKey = (type, params) => {
  return generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_STATS}:${type}`, params);
};

export const generateAnalyticsKey = (type, params) => {
  return generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_ANALYTICS}:${type}`, params);
};

export const generatePerformanceKey = (subjectId, params) => {
  return generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_PERFORMANCE}:${subjectId}`, params);
};

export const generateExportKey = (params) => {
  return generateCacheKey(SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_EXPORT, params);
};

// ======================
// BASIC CACHE OPERATIONS
// ======================

export const setCache = async (key, data, ttl = SUBJECT_CACHE_CONFIG.TTL.SUBJECT) => {
  try {
    const serializedData = JSON.stringify(data);
    await redis.setex(key, ttl, serializedData);
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

export const getCache = async (key) => {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const deleteCache = async (key) => {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
};

export const deleteCachePattern = async (pattern) => {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  } catch (error) {
    console.error('Cache pattern delete error:', error);
    return 0;
  }
};

// ======================
// SUBJECT-SPECIFIC CACHE OPERATIONS
// ======================

export const setSubjectInCache = async (subject) => {
  const key = `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:${subject.id}`;
  return await setCache(key, subject, SUBJECT_CACHE_CONFIG.TTL.SUBJECT);
};

export const getSubjectFromCache = async (subjectId) => {
  const key = `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:${subjectId}`;
  return await getCache(key);
};

export const setSubjectListInCache = async (params, data) => {
  const key = generateSearchKey(params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_LIST);
};

export const getSubjectListFromCache = async (params) => {
  const key = generateSearchKey(params);
  return await getCache(key);
};

export const setSubjectSearchInCache = async (params, data) => {
  const key = generateSearchKey(params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_SEARCH);
};

export const getSubjectSearchFromCache = async (params) => {
  const key = generateSearchKey(params);
  return await getCache(key);
};

export const setSubjectStatsInCache = async (type, params, data) => {
  const key = generateStatsKey(type, params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_STATS);
};

export const getSubjectStatsFromCache = async (type, params) => {
  const key = generateStatsKey(type, params);
  return await getCache(key);
};

export const setSubjectAnalyticsInCache = async (type, params, data) => {
  const key = generateAnalyticsKey(type, params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_ANALYTICS);
};

export const getSubjectAnalyticsFromCache = async (type, params) => {
  const key = generateAnalyticsKey(type, params);
  return await getCache(key);
};

export const setSubjectPerformanceInCache = async (subjectId, params, data) => {
  const key = generatePerformanceKey(subjectId, params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_PERFORMANCE);
};

export const getSubjectPerformanceFromCache = async (subjectId, params) => {
  const key = generatePerformanceKey(subjectId, params);
  return await getCache(key);
};

export const setSubjectExportInCache = async (params, data) => {
  const key = generateExportKey(params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_EXPORT);
};

export const getSubjectExportFromCache = async (params) => {
  const key = generateExportKey(params);
  return await getCache(key);
};

export const setSubjectsBySchoolInCache = async (schoolId, params, data) => {
  const key = generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_SCHOOL}:${schoolId}`, params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_LIST);
};

export const getSubjectsBySchoolFromCache = async (schoolId, params) => {
  const key = generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_SCHOOL}:${schoolId}`, params);
  return await getCache(key);
};

export const setSubjectsByDepartmentInCache = async (departmentId, params, data) => {
  const key = generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_DEPARTMENT}:${departmentId}`, params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_LIST);
};

export const getSubjectsByDepartmentFromCache = async (departmentId, params) => {
  const key = generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_DEPARTMENT}:${departmentId}`, params);
  return await getCache(key);
};

export const setSubjectsByTypeInCache = async (isElective, params, data) => {
  const key = generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_TYPE}:${isElective}`, params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_LIST);
};

export const getSubjectsByTypeFromCache = async (isElective, params) => {
  const key = generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_TYPE}:${isElective}`, params);
  return await getCache(key);
};

export const setSubjectCountsInCache = async (type, params, data) => {
  const key = generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_COUNTS}:${type}`, params);
  return await setCache(key, data, SUBJECT_CACHE_CONFIG.TTL.SUBJECT_COUNTS);
};

export const getSubjectCountsFromCache = async (type, params) => {
  const key = generateCacheKey(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_COUNTS}:${type}`, params);
  return await getCache(key);
};

// ======================
// CACHE INVALIDATION
// ======================

export const invalidateSubjectCacheOnCreate = async (subject) => {
  try {
    const patterns = [
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:${subject.id}`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_LIST}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_SEARCH}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_STATS}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_SCHOOL}:${subject.schoolId}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_DEPARTMENT}:${subject.departmentId || 'null'}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_TYPE}:${subject.isElective}:*`,
    ];
    
    for (const pattern of patterns) {
      await deleteCachePattern(pattern);
    }
    
    return true;
  } catch (error) {
    console.error('Subject cache invalidation error (create):', error);
    return false;
  }
};

export const invalidateSubjectCacheOnUpdate = async (subject, oldSubject) => {
  try {
    const patterns = [
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:${subject.id}`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_LIST}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_SEARCH}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_STATS}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_SCHOOL}:${subject.schoolId}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_DEPARTMENT}:${subject.departmentId || 'null'}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_TYPE}:${subject.isElective}:*`,
    ];
    
    // If department changed, invalidate old department cache
    if (oldSubject && oldSubject.departmentId !== subject.departmentId) {
      patterns.push(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_DEPARTMENT}:${oldSubject.departmentId || 'null'}:*`);
    }
    
    // If elective status changed, invalidate old type cache
    if (oldSubject && oldSubject.isElective !== subject.isElective) {
      patterns.push(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_TYPE}:${oldSubject.isElective}:*`);
    }
    
    for (const pattern of patterns) {
      await deleteCachePattern(pattern);
    }
    
    return true;
  } catch (error) {
    console.error('Subject cache invalidation error (update):', error);
    return false;
  }
};

export const invalidateSubjectCacheOnDelete = async (subject) => {
  try {
    const patterns = [
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:${subject.id}`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_LIST}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_SEARCH}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_STATS}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_SCHOOL}:${subject.schoolId}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_DEPARTMENT}:${subject.departmentId || 'null'}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_TYPE}:${subject.isElective}:*`,
    ];
    
    for (const pattern of patterns) {
      await deleteCachePattern(pattern);
    }
    
    return true;
  } catch (error) {
    console.error('Subject cache invalidation error (delete):', error);
    return false;
  }
};

export const invalidateSubjectCacheOnBulkOperation = async (operation, subjectIds) => {
  try {
    const patterns = [
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_LIST}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_SEARCH}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_STATS}:*`,
    ];
    
    // Invalidate specific subject caches
    for (const subjectId of subjectIds) {
      patterns.push(`${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:${subjectId}`);
    }
    
    for (const pattern of patterns) {
      await deleteCachePattern(pattern);
    }
    
    return true;
  } catch (error) {
    console.error('Subject cache invalidation error (bulk):', error);
    return false;
  }
};

// ======================
// CACHE STATISTICS AND HEALTH
// ======================

export const getSubjectCacheStats = async () => {
  try {
    const patterns = [
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_LIST}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_SEARCH}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_STATS}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_ANALYTICS}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_PERFORMANCE}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_EXPORT}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_COUNTS}:*`,
    ];
    
    const stats = {};
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      const type = pattern.split(':')[1];
      stats[type] = keys.length;
    }
    
    const totalKeys = Object.values(stats).reduce((sum, count) => sum + count, 0);
    const memoryUsage = await redis.memory('usage');
    
    return {
      totalKeys,
      memoryUsage: memoryUsage || 0,
      byType: stats,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Subject cache stats error:', error);
    return null;
  }
};

export const clearSubjectCache = async () => {
  try {
    const patterns = [
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_LIST}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_SEARCH}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_STATS}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_ANALYTICS}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_PERFORMANCE}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_EXPORT}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_COUNTS}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_SCHOOL}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_DEPARTMENT}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_BY_TYPE}:*`,
    ];
    
    let totalDeleted = 0;
    
    for (const pattern of patterns) {
      const deleted = await deleteCachePattern(pattern);
      totalDeleted += deleted;
    }
    
    return {
      success: true,
      deletedKeys: totalDeleted,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Subject cache clear error:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

export const checkSubjectCacheHealth = async () => {
  try {
    const startTime = Date.now();
    const testKey = `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT}:health:${Date.now()}`;
    const testData = { test: true, timestamp: new Date().toISOString() };
    
    // Test write
    const writeSuccess = await setCache(testKey, testData, 60);
    if (!writeSuccess) {
      throw new Error('Cache write failed');
    }
    
    // Test read
    const readData = await getCache(testKey);
    if (!readData || readData.test !== true) {
      throw new Error('Cache read failed');
    }
    
    // Test delete
    const deleteSuccess = await deleteCache(testKey);
    if (!deleteSuccess) {
      throw new Error('Cache delete failed');
    }
    
    const responseTime = Date.now() - startTime;
    const stats = await getSubjectCacheStats();
    
    return {
      status: 'healthy',
      responseTime,
      stats,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Subject cache health check error:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// ======================
// CACHE OPTIMIZATION
// ======================

export const optimizeSubjectCache = async () => {
  try {
    const stats = await getSubjectCacheStats();
    const optimizations = [];
    
    // Check for expired keys
    const patterns = [
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_EXPORT}:*`,
      `${SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT_SEARCH}:*`,
    ];
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 100) {
        // Keep only the most recent 50 keys
        const sortedKeys = keys.sort().slice(-50);
        const keysToDelete = keys.filter(key => !sortedKeys.includes(key));
        
        if (keysToDelete.length > 0) {
          await redis.del(...keysToDelete);
          optimizations.push({
            type: 'cleanup',
            pattern,
            deleted: keysToDelete.length,
            kept: sortedKeys.length,
          });
        }
      }
    }
    
    return {
      success: true,
      optimizations,
      stats,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Subject cache optimization error:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// ======================
// CACHE MONITORING
// ======================

export const monitorSubjectCache = async () => {
  try {
    const stats = await getSubjectCacheStats();
    const health = await checkSubjectCacheHealth();
    const optimization = await optimizeSubjectCache();
    
    return {
      stats,
      health,
      optimization,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Subject cache monitoring error:', error);
    return {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * Subject cache middleware factory
 * @param {number} [ttl=SUBJECT_CACHE_CONFIG.TTL.SUBJECT] - Cache time-to-live in seconds
 * @returns {Function} Express middleware function
 */
export const subjectCacheMiddleware = (ttl = SUBJECT_CACHE_CONFIG.TTL.SUBJECT) => {
  return async (req, res, next) => {
    try {
      // Generate cache key based on request parameters
      const cacheKey = generateCacheKey(SUBJECT_CACHE_CONFIG.PREFIXES.SUBJECT, {
        id: req.params.id,
        schoolId: req.query.schoolId,
        departmentId: req.query.departmentId,
        ...req.query
      });

      // Check cache first
      const cachedData = await getCache(cacheKey, ttl);
      if (cachedData) {
        return res.json({
          success: true,
          message: 'Data retrieved from cache',
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      // Store original send method
      const originalJson = res.json;

      // Override send method to cache response
      res.json = function(data) {
        try {
          if (data && data.success && data.data) {
            setCache(cacheKey, data.data, ttl).catch(err => 
              console.error('Cache set error:', err)
            );
          }
        } catch (cacheError) {
          console.error('Cache middleware error:', cacheError);
        }
        // Always call the original method
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Subject cache middleware error:', error);
      next();
    }
  };
};

/**
 * Subject statistics cache middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const subjectStatsCacheMiddleware = (req, res, next) => {
  const asyncMiddleware = async (req, res, next) => {
    try {
      // Generate cache key based on request parameters
      const cacheKey = generateStatsKey('stats', {
        subjectId: req.params.id,
        schoolId: req.query.schoolId,
        departmentId: req.query.departmentId,
        ...req.query
      });

      // Check cache first
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        res.locals.cached = true;
        res.locals.data = cachedData;
        return next();
      }

      // If not cached, proceed to next middleware
      res.locals.cached = false;
      next();
    } catch (error) {
      console.error('Subject stats cache middleware error:', error);
      next();
    }
  };
  asyncMiddleware(req, res, next);
};

export {};
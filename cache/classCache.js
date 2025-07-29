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
const CACHE_CONFIG = {
  // TTL in seconds
  TTL: {
    CLASS_DATA: 300, // 5 minutes
    CLASS_LIST: 60, // 1 minute
    CLASS_SEARCH: 120, // 2 minutes
    CLASS_STATS: 600, // 10 minutes
    CLASS_ANALYTICS: 1800, // 30 minutes
    CLASS_PERFORMANCE: 3600, // 1 hour
    CLASS_EXPORT: 300, // 5 minutes
    CLASS_COUNTS: 300, // 5 minutes
  },
  
  // Cache keys
  KEYS: {
    CLASS_DATA: 'class:data:',
    CLASS_LIST: 'class:list:',
    CLASS_SEARCH: 'class:search:',
    CLASS_STATS: 'class:stats:',
    CLASS_ANALYTICS: 'class:analytics:',
    CLASS_PERFORMANCE: 'class:performance:',
    CLASS_EXPORT: 'class:export:',
    CLASS_COUNTS: 'class:counts:',
    CLASS_BY_SCHOOL: 'class:school:',
    CLASS_BY_LEVEL: 'class:level:',
    CLASS_BY_TEACHER: 'class:teacher:',
  },
  
  // Cache patterns for invalidation
  PATTERNS: {
    CLASS_ALL: 'class:*',
    CLASS_DATA_ALL: 'class:data:*',
    CLASS_LIST_ALL: 'class:list:*',
    CLASS_SEARCH_ALL: 'class:search:*',
    CLASS_STATS_ALL: 'class:stats:*',
    CLASS_ANALYTICS_ALL: 'class:analytics:*',
    CLASS_PERFORMANCE_ALL: 'class:performance:*',
    CLASS_EXPORT_ALL: 'class:export:*',
    CLASS_COUNTS_ALL: 'class:counts:*',
    CLASS_BY_SCHOOL_ALL: 'class:school:*',
    CLASS_BY_LEVEL_ALL: 'class:level:*',
    CLASS_BY_TEACHER_ALL: 'class:teacher:*',
  }
};

// ======================
// CACHE UTILITY FUNCTIONS
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

const setCache = async (key, data, ttl = CACHE_CONFIG.TTL.CLASS_DATA) => {
  try {
    if (useRedis && redisClient) {
      await redisClient.setex(key, ttl, JSON.stringify(data));
    } else {
      // Memory cache
      memoryCache.set(key, data);
      cacheTTL.set(key, Date.now() + (ttl * 1000));
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

const getCache = async (key) => {
  try {
    if (useRedis && redisClient) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } else {
      // Memory cache
      const ttl = cacheTTL.get(key);
      if (ttl && Date.now() > ttl) {
        memoryCache.delete(key);
        cacheTTL.delete(key);
        return null;
      }
      return memoryCache.get(key) || null;
    }
  } catch (error) {
    console.error('Cache get error:', error);
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
    console.error('Cache delete error:', error);
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
      // Memory cache pattern deletion
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          memoryCache.delete(key);
          cacheTTL.delete(key);
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Cache pattern delete error:', error);
    return false;
  }
};

// ======================
// CLASS DATA CACHING
// ======================

export const getClassFromCache = async (classId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_DATA, classId);
  return await getCache(key);
};

export const setClassInCache = async (classData) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_DATA, classData.id);
  return await setCache(key, classData, CACHE_CONFIG.TTL.CLASS_DATA);
};

export const deleteClassFromCache = async (classId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_DATA, classId);
  return await deleteCache(key);
};

// ======================
// CLASS LIST CACHING
// ======================

export const getClassListFromCache = async (params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_LIST, generateSearchKey(params));
  return await getCache(key);
};

export const setClassListInCache = async (params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_LIST, generateSearchKey(params));
  return await setCache(key, data, CACHE_CONFIG.TTL.CLASS_LIST);
};

export const deleteClassListFromCache = async (params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_LIST, generateSearchKey(params));
  return await deleteCache(key);
};

// ======================
// CLASS SEARCH CACHING
// ======================

export const getClassSearchFromCache = async (searchParams) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_SEARCH, generateSearchKey(searchParams));
  return await getCache(key);
};

export const setClassSearchInCache = async (searchParams, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_SEARCH, generateSearchKey(searchParams));
  return await setCache(key, data, CACHE_CONFIG.TTL.CLASS_SEARCH);
};

export const deleteClassSearchFromCache = async (searchParams) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_SEARCH, generateSearchKey(searchParams));
  return await deleteCache(key);
};

// ======================
// CLASS STATS CACHING
// ======================

export const getClassStatsFromCache = async (classId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_STATS, classId);
  return await getCache(key);
};

export const setClassStatsInCache = async (classId, stats) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_STATS, classId);
  return await setCache(key, stats, CACHE_CONFIG.TTL.CLASS_STATS);
};

export const deleteClassStatsFromCache = async (classId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_STATS, classId);
  return await deleteCache(key);
};

// ======================
// CLASS ANALYTICS CACHING
// ======================

export const getClassAnalyticsFromCache = async (classId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_ANALYTICS, `${classId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setClassAnalyticsInCache = async (classId, params, analytics) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_ANALYTICS, `${classId}:${generateSearchKey(params)}`);
  return await setCache(key, analytics, CACHE_CONFIG.TTL.CLASS_ANALYTICS);
};

export const deleteClassAnalyticsFromCache = async (classId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_ANALYTICS, `${classId}:${generateSearchKey(params)}`);
  return await deleteCache(key);
};

// ======================
// CLASS PERFORMANCE CACHING
// ======================

export const getClassPerformanceFromCache = async (classId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_PERFORMANCE, `${classId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setClassPerformanceInCache = async (classId, params, performance) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_PERFORMANCE, `${classId}:${generateSearchKey(params)}`);
  return await setCache(key, performance, CACHE_CONFIG.TTL.CLASS_PERFORMANCE);
};

export const deleteClassPerformanceFromCache = async (classId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_PERFORMANCE, `${classId}:${generateSearchKey(params)}`);
  return await deleteCache(key);
};

// ======================
// CLASS EXPORT CACHING
// ======================

export const getClassExportFromCache = async (params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_EXPORT, generateSearchKey(params));
  return await getCache(key);
};

export const setClassExportInCache = async (params, exportData) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_EXPORT, generateSearchKey(params));
  return await setCache(key, exportData, CACHE_CONFIG.TTL.CLASS_EXPORT);
};

export const deleteClassExportFromCache = async (params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_EXPORT, generateSearchKey(params));
  return await deleteCache(key);
};

// ======================
// CLASS COUNTS CACHING
// ======================

export const getClassCountsFromCache = async (type, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_COUNTS, `${type}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setClassCountsInCache = async (type, params, counts) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_COUNTS, `${type}:${generateSearchKey(params)}`);
  return await setCache(key, counts, CACHE_CONFIG.TTL.CLASS_COUNTS);
};

export const deleteClassCountsFromCache = async (type, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_COUNTS, `${type}:${generateSearchKey(params)}`);
  return await deleteCache(key);
};

// ======================
// SCHOOL-SPECIFIC CACHING
// ======================

export const getClassesBySchoolFromCache = async (schoolId, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_SCHOOL, `${schoolId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setClassesBySchoolInCache = async (schoolId, params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_SCHOOL, `${schoolId}:${generateSearchKey(params)}`);
  return await setCache(key, data, CACHE_CONFIG.TTL.CLASS_LIST);
};

export const deleteClassesBySchoolFromCache = async (schoolId) => {
  const pattern = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_SCHOOL, `${schoolId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// LEVEL-SPECIFIC CACHING
// ======================

export const getClassesByLevelFromCache = async (level, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_LEVEL, `${level}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setClassesByLevelInCache = async (level, params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_LEVEL, `${level}:${generateSearchKey(params)}`);
  return await setCache(key, data, CACHE_CONFIG.TTL.CLASS_LIST);
};

export const deleteClassesByLevelFromCache = async (level) => {
  const pattern = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_LEVEL, `${level}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// TEACHER-SPECIFIC CACHING
// ======================

export const getClassesByTeacherFromCache = async (teacherId, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_TEACHER, `${teacherId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setClassesByTeacherInCache = async (teacherId, params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_TEACHER, `${teacherId}:${generateSearchKey(params)}`);
  return await setCache(key, data, CACHE_CONFIG.TTL.CLASS_LIST);
};

export const deleteClassesByTeacherFromCache = async (teacherId) => {
  const pattern = generateCacheKey(CACHE_CONFIG.KEYS.CLASS_BY_TEACHER, `${teacherId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// CACHE INVALIDATION
// ======================

export const invalidateClassCacheOnCreate = async (classData) => {
  try {
    const promises = [
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_LIST_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_SEARCH_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_COUNTS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_EXPORT_ALL),
    ];

    if (classData.schoolId) {
      promises.push(deleteClassesBySchoolFromCache(classData.schoolId));
    }

    if (classData.level) {
      promises.push(deleteClassesByLevelFromCache(classData.level));
    }

    if (classData.classTeacherId) {
      promises.push(deleteClassesByTeacherFromCache(classData.classTeacherId));
    }

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on create:', error);
    return false;
  }
};

export const invalidateClassCacheOnUpdate = async (classData, oldData = null) => {
  try {
    const promises = [
      deleteClassFromCache(classData.id),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_LIST_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_SEARCH_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_COUNTS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_EXPORT_ALL),
      deleteClassStatsFromCache(classData.id),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_ANALYTICS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_PERFORMANCE_ALL),
    ];

    // Invalidate school-specific cache
    if (classData.schoolId) {
      promises.push(deleteClassesBySchoolFromCache(classData.schoolId));
    }

    // Invalidate level-specific cache
    if (classData.level) {
      promises.push(deleteClassesByLevelFromCache(classData.level));
    }

    // Invalidate teacher-specific cache
    if (classData.classTeacherId) {
      promises.push(deleteClassesByTeacherFromCache(classData.classTeacherId));
    }

    // If school, level, or teacher changed, invalidate old caches
    if (oldData) {
      if (oldData.schoolId && oldData.schoolId !== classData.schoolId) {
        promises.push(deleteClassesBySchoolFromCache(oldData.schoolId));
      }
      if (oldData.level && oldData.level !== classData.level) {
        promises.push(deleteClassesByLevelFromCache(oldData.level));
      }
      if (oldData.classTeacherId && oldData.classTeacherId !== classData.classTeacherId) {
        promises.push(deleteClassesByTeacherFromCache(oldData.classTeacherId));
      }
    }

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on update:', error);
    return false;
  }
};

export const invalidateClassCacheOnDelete = async (classData) => {
  try {
    const promises = [
      deleteClassFromCache(classData.id),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_LIST_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_SEARCH_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_COUNTS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_EXPORT_ALL),
      deleteClassStatsFromCache(classData.id),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_ANALYTICS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_PERFORMANCE_ALL),
    ];

    if (classData.schoolId) {
      promises.push(deleteClassesBySchoolFromCache(classData.schoolId));
    }

    if (classData.level) {
      promises.push(deleteClassesByLevelFromCache(classData.level));
    }

    if (classData.classTeacherId) {
      promises.push(deleteClassesByTeacherFromCache(classData.classTeacherId));
    }

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on delete:', error);
    return false;
  }
};

export const invalidateClassCacheOnBulkOperation = async (operation, affectedIds = []) => {
  try {
    const promises = [
      deleteCachePattern(CACHE_CONFIG.PATTERNS.CLASS_ALL),
    ];

    // Delete specific class data
    for (const id of affectedIds) {
      promises.push(deleteClassFromCache(id));
      promises.push(deleteClassStatsFromCache(id));
    }

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on bulk operation:', error);
    return false;
  }
};

// ======================
// CACHE STATISTICS
// ======================

export const getClassCacheStats = async () => {
  try {
    if (useRedis && redisClient) {
      const info = await redisClient.info('memory');
      const keys = await redisClient.keys(CACHE_CONFIG.PATTERNS.CLASS_ALL);
      
      return {
        type: 'redis',
        totalKeys: keys.length,
        memoryInfo: info,
        patterns: CACHE_CONFIG.PATTERNS,
      };
    } else {
      return {
        type: 'memory',
        totalKeys: memoryCache.size,
        memoryUsage: process.memoryUsage(),
        patterns: CACHE_CONFIG.PATTERNS,
      };
    }
  } catch (error) {
    console.error('Cache stats error:', error);
    return null;
  }
};

export const clearClassCache = async () => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys(CACHE_CONFIG.PATTERNS.CLASS_ALL);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      memoryCache.clear();
      cacheTTL.clear();
    }
    return true;
  } catch (error) {
    console.error('Cache clear error:', error);
    return false;
  }
};

// ======================
// CACHE HEALTH CHECK
// ======================

export const checkClassCacheHealth = async () => {
  try {
    const testKey = 'class:health:test';
    const testData = { test: true, timestamp: Date.now() };
    
    // Test write
    const writeSuccess = await setCache(testKey, testData, 10);
    if (!writeSuccess) return { healthy: false, error: 'Write failed' };
    
    // Test read
    const readData = await getCache(testKey);
    if (!readData || readData.test !== true) return { healthy: false, error: 'Read failed' };
    
    // Test delete
    const deleteSuccess = await deleteCache(testKey);
    if (!deleteSuccess) return { healthy: false, error: 'Delete failed' };
    
    return { healthy: true, type: useRedis ? 'redis' : 'memory' };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
};

// ======================
// EXPORTS
// ======================

export {
  CACHE_CONFIG,
  generateCacheKey,
  generateSearchKey,
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
}; 
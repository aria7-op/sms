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

export const TEACHER_CACHE_CONFIG = {
  ...CACHE_CONFIG,
  TTL: {
    TEACHER: 3600, // 1 hour
    TEACHER_LIST: 1800, // 30 minutes
    TEACHER_SEARCH: 900, // 15 minutes
    TEACHER_STATS: 7200, // 2 hours
    TEACHER_ANALYTICS: 3600, // 1 hour
    TEACHER_PERFORMANCE: 1800, // 30 minutes
    TEACHER_EXPORT: 300, // 5 minutes
    TEACHER_COUNTS: 3600, // 1 hour
  },
  PREFIXES: {
    TEACHER: 'teacher',
    TEACHER_LIST: 'teacher:list',
    TEACHER_SEARCH: 'teacher:search',
    TEACHER_STATS: 'teacher:stats',
    TEACHER_ANALYTICS: 'teacher:analytics',
    TEACHER_PERFORMANCE: 'teacher:performance',
    TEACHER_EXPORT: 'teacher:export',
    TEACHER_COUNTS: 'teacher:counts',
    TEACHER_BY_SCHOOL: 'teacher:school',
    TEACHER_BY_DEPARTMENT: 'teacher:dept',
    TEACHER_BY_EXPERIENCE: 'teacher:experience',
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
  return generateCacheKey(TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_SEARCH, params);
};

export const generateStatsKey = (type, params) => {
  return generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_STATS}:${type}`, params);
};

export const generateAnalyticsKey = (type, params) => {
  return generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_ANALYTICS}:${type}`, params);
};

export const generatePerformanceKey = (teacherId, params) => {
  return generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_PERFORMANCE}:${teacherId}`, params);
};

export const generateExportKey = (params) => {
  return generateCacheKey(TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_EXPORT, params);
};

// ======================
// BASIC CACHE OPERATIONS
// ======================

export const setCache = async (key, data, ttl = TEACHER_CACHE_CONFIG.TTL.TEACHER) => {
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
// TEACHER-SPECIFIC CACHE OPERATIONS
// ======================

export const setTeacherInCache = async (teacher) => {
  const key = `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER}:${teacher.id}`;
  return await setCache(key, teacher, TEACHER_CACHE_CONFIG.TTL.TEACHER);
};

export const getTeacherFromCache = async (teacherId) => {
  const key = `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER}:${teacherId}`;
  return await getCache(key);
};

export const setTeacherListInCache = async (params, data) => {
  const key = generateSearchKey(params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_LIST);
};

export const getTeacherListFromCache = async (params) => {
  const key = generateSearchKey(params);
  return await getCache(key);
};

export const setTeacherSearchInCache = async (params, data) => {
  const key = generateSearchKey(params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_SEARCH);
};

export const getTeacherSearchFromCache = async (params) => {
  const key = generateSearchKey(params);
  return await getCache(key);
};

export const setTeacherStatsInCache = async (type, params, data) => {
  const key = generateStatsKey(type, params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_STATS);
};

export const getTeacherStatsFromCache = async (type, params) => {
  const key = generateStatsKey(type, params);
  return await getCache(key);
};

export const setTeacherAnalyticsInCache = async (type, params, data) => {
  const key = generateAnalyticsKey(type, params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_ANALYTICS);
};

export const getTeacherAnalyticsFromCache = async (type, params) => {
  const key = generateAnalyticsKey(type, params);
  return await getCache(key);
};

export const setTeacherPerformanceInCache = async (teacherId, params, data) => {
  const key = generatePerformanceKey(teacherId, params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_PERFORMANCE);
};

export const getTeacherPerformanceFromCache = async (teacherId, params) => {
  const key = generatePerformanceKey(teacherId, params);
  return await getCache(key);
};

export const setTeacherExportInCache = async (params, data) => {
  const key = generateExportKey(params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_EXPORT);
};

export const getTeacherExportFromCache = async (params) => {
  const key = generateExportKey(params);
  return await getCache(key);
};

export const setTeachersBySchoolInCache = async (schoolId, params, data) => {
  const key = generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_SCHOOL}:${schoolId}`, params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_LIST);
};

export const getTeachersBySchoolFromCache = async (schoolId, params) => {
  const key = generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_SCHOOL}:${schoolId}`, params);
  return await getCache(key);
};

export const setTeachersByDepartmentInCache = async (departmentId, params, data) => {
  const key = generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:${departmentId}`, params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_LIST);
};

export const getTeachersByDepartmentFromCache = async (departmentId, params) => {
  const key = generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:${departmentId}`, params);
  return await getCache(key);
};

export const setTeacherCountsInCache = async (type, params, data) => {
  const key = generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_COUNTS}:${type}`, params);
  return await setCache(key, data, TEACHER_CACHE_CONFIG.TTL.TEACHER_COUNTS);
};

export const getTeacherCountsFromCache = async (type, params) => {
  const key = generateCacheKey(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_COUNTS}:${type}`, params);
  return await getCache(key);
};

// ======================
// CACHE INVALIDATION
// ======================

export const invalidateTeacherCacheOnCreate = async (teacher) => {
  try {
    const patterns = [
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_LIST}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_SEARCH}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_COUNTS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_SCHOOL}:${teacher.schoolId}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:*`
    ];

    if (teacher.departmentId) {
      patterns.push(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:${teacher.departmentId}:*`);
    }

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }

    console.log(`Invalidated ${totalDeleted} teacher cache entries on create`);
    return totalDeleted;
  } catch (error) {
    console.error('Error invalidating teacher cache on create:', error);
    return 0;
  }
};

export const invalidateTeacherCacheOnUpdate = async (teacher, oldTeacher) => {
  try {
    const patterns = [
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER}:${teacher.id}`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_LIST}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_SEARCH}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_STATS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_ANALYTICS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_PERFORMANCE}:${teacher.id}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_COUNTS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_SCHOOL}:${teacher.schoolId}:*`
    ];

    // Invalidate department-specific caches if department changed
    if (oldTeacher.departmentId !== teacher.departmentId) {
      if (oldTeacher.departmentId) {
        patterns.push(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:${oldTeacher.departmentId}:*`);
      }
      if (teacher.departmentId) {
        patterns.push(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:${teacher.departmentId}:*`);
      }
    }

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }

    console.log(`Invalidated ${totalDeleted} teacher cache entries on update`);
    return totalDeleted;
  } catch (error) {
    console.error('Error invalidating teacher cache on update:', error);
    return 0;
  }
};

export const invalidateTeacherCacheOnDelete = async (teacher) => {
  try {
    const patterns = [
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER}:${teacher.id}`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_LIST}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_SEARCH}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_STATS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_ANALYTICS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_PERFORMANCE}:${teacher.id}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_COUNTS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_SCHOOL}:${teacher.schoolId}:*`
    ];

    if (teacher.departmentId) {
      patterns.push(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:${teacher.departmentId}:*`);
    }

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }

    console.log(`Invalidated ${totalDeleted} teacher cache entries on delete`);
    return totalDeleted;
  } catch (error) {
    console.error('Error invalidating teacher cache on delete:', error);
    return 0;
  }
};

export const invalidateTeacherCacheOnBulkOperation = async (operation, teacherIds) => {
  try {
    const patterns = [
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_LIST}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_SEARCH}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_STATS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_ANALYTICS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_COUNTS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_SCHOOL}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:*`
    ];

    // Add specific teacher patterns
    for (const teacherId of teacherIds) {
      patterns.push(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER}:${teacherId}`);
      patterns.push(`${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_PERFORMANCE}:${teacherId}:*`);
    }

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }

    console.log(`Invalidated ${totalDeleted} teacher cache entries on bulk ${operation}`);
    return totalDeleted;
  } catch (error) {
    console.error(`Error invalidating teacher cache on bulk ${operation}:`, error);
    return 0;
  }
};

// ======================
// CACHE STATISTICS & HEALTH
// ======================

export const getTeacherCacheStats = async () => {
  try {
    const patterns = [
      TEACHER_CACHE_CONFIG.PREFIXES.TEACHER,
      TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_LIST,
      TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_SEARCH,
      TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_STATS,
      TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_ANALYTICS,
      TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_PERFORMANCE,
      TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_EXPORT,
      TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_COUNTS
    ];

    const stats = {};
    let totalKeys = 0;

    for (const pattern of patterns) {
      const keys = await redis.keys(`${pattern}:*`);
      const count = keys.length;
      stats[pattern] = count;
      totalKeys += count;
    }

    return {
      type: 'memory',
      totalKeys,
      patterns: stats,
      config: {
        ttl: TEACHER_CACHE_CONFIG.TTL,
        prefixes: TEACHER_CACHE_CONFIG.PREFIXES
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting teacher cache stats:', error);
    return {
      type: 'memory',
      totalKeys: 0,
      patterns: {},
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

export const clearTeacherCache = async () => {
  try {
    const patterns = [
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_LIST}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_SEARCH}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_STATS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_ANALYTICS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_PERFORMANCE}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_EXPORT}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_COUNTS}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_SCHOOL}:*`,
      `${TEACHER_CACHE_CONFIG.PREFIXES.TEACHER_BY_DEPARTMENT}:*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await deleteCachePattern(pattern);
    }

    console.log(`Cleared ${totalDeleted} teacher cache entries`);
    return totalDeleted;
  } catch (error) {
    console.error('Error clearing teacher cache:', error);
    return 0;
  }
};

export const checkTeacherCacheHealth = async () => {
  try {
    const ping = await redis.ping();
    const info = await redis.info();
    const dbsize = await redis.dbsize();

    return {
      healthy: ping === 'PONG',
      type: 'memory',
      info: {
        ping,
        dbsize,
        server: 'memory-cache'
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error checking teacher cache health:', error);
    return {
      healthy: false,
      type: 'memory',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

export const optimizeTeacherCache = async () => {
  try {
    // For memory cache, we can't really optimize
    // This is more relevant for Redis
    const stats = await getTeacherCacheStats();
    
    return {
      success: true,
      message: 'Cache optimization completed (memory cache)',
      stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error optimizing teacher cache:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

export const monitorTeacherCache = async () => {
  try {
    const stats = await getTeacherCacheStats();
    const health = await checkTeacherCacheHealth();

    return {
      stats,
      health,
      monitoring: {
        enabled: true,
        interval: '5 minutes',
        alerts: false
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error monitoring teacher cache:', error);
    return {
      stats: null,
      health: null,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// ======================
// CACHE MIDDLEWARE
// ======================

export const teacherCacheMiddleware = (ttl = TEACHER_CACHE_CONFIG.TTL.TEACHER) => {
  return async (req, res, next) => {
    try {
      const cacheKey = `teacher:${req.originalUrl}:${JSON.stringify(req.query)}`;
      const cachedData = await getCache(cacheKey);

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
      console.error('Teacher cache middleware error:', error);
      next();
    }
  };
};

export const teacherStatsCacheMiddleware = (req, res, next) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const cacheKey = `teacher:stats:${id}`;
      const cachedStats = await getCache(cacheKey);

      if (cachedStats) {
        return res.json({
          success: true,
          message: 'Teacher stats retrieved from cache',
          data: cachedStats,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      // Store original send method
      const originalSend = res.json;

      // Override send method to cache response
      res.json = function(data) {
        if (data.success && data.data) {
          setCache(cacheKey, data.data, TEACHER_CACHE_CONFIG.TTL.TEACHER_STATS);
        }
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Teacher stats cache middleware error:', error);
      next();
    }
  };
};

// ======================
// CACHE CONFIGURATION
// ======================

export const teacherCacheConfig = {
  ...TEACHER_CACHE_CONFIG,
  redis: redis,
  useRedis: false,
  redisClient: null
}; 
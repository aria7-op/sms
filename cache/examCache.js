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
    EXAM_DATA: 300, // 5 minutes
    EXAM_LIST: 60, // 1 minute
    EXAM_SEARCH: 120, // 2 minutes
    EXAM_STATS: 600, // 10 minutes
    EXAM_ANALYTICS: 1800, // 30 minutes
    EXAM_RESULTS: 3600, // 1 hour
    EXAM_EXPORT: 300, // 5 minutes
    EXAM_COUNTS: 300, // 5 minutes
    EXAM_GRADES: 3600, // 1 hour
    EXAM_TIMETABLE: 1800, // 30 minutes
  },
  
  // Cache keys
  KEYS: {
    EXAM_DATA: 'exam:data:',
    EXAM_LIST: 'exam:list:',
    EXAM_SEARCH: 'exam:search:',
    EXAM_STATS: 'exam:stats:',
    EXAM_ANALYTICS: 'exam:analytics:',
    EXAM_RESULTS: 'exam:results:',
    EXAM_EXPORT: 'exam:export:',
    EXAM_COUNTS: 'exam:counts:',
    EXAM_GRADES: 'exam:grades:',
    EXAM_TIMETABLE: 'exam:timetable:',
    EXAM_BY_SCHOOL: 'exam:school:',
    EXAM_BY_SUBJECT: 'exam:subject:',
    EXAM_BY_CLASS: 'exam:class:',
    EXAM_BY_TERM: 'exam:term:',
  },
  
  // Cache patterns for invalidation
  PATTERNS: {
    EXAM_ALL: 'exam:*',
    EXAM_DATA_ALL: 'exam:data:*',
    EXAM_LIST_ALL: 'exam:list:*',
    EXAM_SEARCH_ALL: 'exam:search:*',
    EXAM_STATS_ALL: 'exam:stats:*',
    EXAM_ANALYTICS_ALL: 'exam:analytics:*',
    EXAM_RESULTS_ALL: 'exam:results:*',
    EXAM_EXPORT_ALL: 'exam:export:*',
    EXAM_COUNTS_ALL: 'exam:counts:*',
    EXAM_GRADES_ALL: 'exam:grades:*',
    EXAM_TIMETABLE_ALL: 'exam:timetable:*',
    EXAM_BY_SCHOOL_ALL: 'exam:school:*',
    EXAM_BY_SUBJECT_ALL: 'exam:subject:*',
    EXAM_BY_CLASS_ALL: 'exam:class:*',
    EXAM_BY_TERM_ALL: 'exam:term:*',
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

const setCache = async (key, data, ttl = CACHE_CONFIG.TTL.EXAM_DATA) => {
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
// EXAM DATA CACHING
// ======================

export const getExamFromCache = async (examId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_DATA, examId);
  return await getCache(key);
};

export const setExamInCache = async (examData) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_DATA, examData.id);
  return await setCache(key, examData, CACHE_CONFIG.TTL.EXAM_DATA);
};

export const deleteExamFromCache = async (examId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_DATA, examId);
  return await deleteCache(key);
};

// ======================
// EXAM LIST CACHING
// ======================

export const getExamListFromCache = async (params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_LIST, generateSearchKey(params));
  return await getCache(key);
};

export const setExamListInCache = async (params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_LIST, generateSearchKey(params));
  return await setCache(key, data, CACHE_CONFIG.TTL.EXAM_LIST);
};

export const deleteExamListFromCache = async (params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_LIST, generateSearchKey(params));
  return await deleteCache(key);
};

// ======================
// EXAM SEARCH CACHING
// ======================

export const getExamSearchFromCache = async (searchParams) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_SEARCH, generateSearchKey(searchParams));
  return await getCache(key);
};

export const setExamSearchInCache = async (searchParams, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_SEARCH, generateSearchKey(searchParams));
  return await setCache(key, data, CACHE_CONFIG.TTL.EXAM_SEARCH);
};

export const deleteExamSearchFromCache = async (searchParams) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_SEARCH, generateSearchKey(searchParams));
  return await deleteCache(key);
};

// ======================
// EXAM STATS CACHING
// ======================

export const getExamStatsFromCache = async (examId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_STATS, examId);
  return await getCache(key);
};

export const setExamStatsInCache = async (examId, stats) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_STATS, examId);
  return await setCache(key, stats, CACHE_CONFIG.TTL.EXAM_STATS);
};

export const deleteExamStatsFromCache = async (examId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_STATS, examId);
  return await deleteCache(key);
};

// ======================
// EXAM ANALYTICS CACHING
// ======================

export const getExamAnalyticsFromCache = async (examId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_ANALYTICS, `${examId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setExamAnalyticsInCache = async (examId, params, analytics) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_ANALYTICS, `${examId}:${generateSearchKey(params)}`);
  return await setCache(key, analytics, CACHE_CONFIG.TTL.EXAM_ANALYTICS);
};

export const deleteExamAnalyticsFromCache = async (examId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_ANALYTICS, `${examId}:${generateSearchKey(params)}`);
  return await deleteCache(key);
};

// ======================
// EXAM RESULTS CACHING
// ======================

export const getExamResultsFromCache = async (examId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_RESULTS, `${examId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setExamResultsInCache = async (examId, params, results) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_RESULTS, `${examId}:${generateSearchKey(params)}`);
  return await setCache(key, results, CACHE_CONFIG.TTL.EXAM_RESULTS);
};

export const deleteExamResultsFromCache = async (examId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_RESULTS, `${examId}:${generateSearchKey(params)}`);
  return await deleteCache(key);
};

// ======================
// EXAM GRADES CACHING
// ======================

export const getExamGradesFromCache = async (examId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_GRADES, `${examId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setExamGradesInCache = async (examId, params, grades) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_GRADES, `${examId}:${generateSearchKey(params)}`);
  return await setCache(key, grades, CACHE_CONFIG.TTL.EXAM_GRADES);
};

export const deleteExamGradesFromCache = async (examId, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_GRADES, `${examId}:${generateSearchKey(params)}`);
  return await deleteCache(key);
};

// ======================
// EXAM TIMETABLE CACHING
// ======================

export const getExamTimetableFromCache = async (examId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_TIMETABLE, examId);
  return await getCache(key);
};

export const setExamTimetableInCache = async (examId, timetable) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_TIMETABLE, examId);
  return await setCache(key, timetable, CACHE_CONFIG.TTL.EXAM_TIMETABLE);
};

export const deleteExamTimetableFromCache = async (examId) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_TIMETABLE, examId);
  return await deleteCache(key);
};

// ======================
// EXAM EXPORT CACHING
// ======================

export const getExamExportFromCache = async (params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_EXPORT, generateSearchKey(params));
  return await getCache(key);
};

export const setExamExportInCache = async (params, exportData) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_EXPORT, generateSearchKey(params));
  return await setCache(key, exportData, CACHE_CONFIG.TTL.EXAM_EXPORT);
};

export const deleteExamExportFromCache = async (params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_EXPORT, generateSearchKey(params));
  return await deleteCache(key);
};

// ======================
// EXAM COUNTS CACHING
// ======================

export const getExamCountsFromCache = async (type, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_COUNTS, `${type}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setExamCountsInCache = async (type, params, counts) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_COUNTS, `${type}:${generateSearchKey(params)}`);
  return await setCache(key, counts, CACHE_CONFIG.TTL.EXAM_COUNTS);
};

export const deleteExamCountsFromCache = async (type, params) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_COUNTS, `${type}:${generateSearchKey(params)}`);
  return await deleteCache(key);
};

// ======================
// SCHOOL-SPECIFIC CACHING
// ======================

export const getExamsBySchoolFromCache = async (schoolId, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_SCHOOL, `${schoolId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setExamsBySchoolInCache = async (schoolId, params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_SCHOOL, `${schoolId}:${generateSearchKey(params)}`);
  return await setCache(key, data, CACHE_CONFIG.TTL.EXAM_LIST);
};

export const deleteExamsBySchoolFromCache = async (schoolId) => {
  const pattern = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_SCHOOL, `${schoolId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// SUBJECT-SPECIFIC CACHING
// ======================

export const getExamsBySubjectFromCache = async (subjectId, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_SUBJECT, `${subjectId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setExamsBySubjectInCache = async (subjectId, params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_SUBJECT, `${subjectId}:${generateSearchKey(params)}`);
  return await setCache(key, data, CACHE_CONFIG.TTL.EXAM_LIST);
};

export const deleteExamsBySubjectFromCache = async (subjectId) => {
  const pattern = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_SUBJECT, `${subjectId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// CLASS-SPECIFIC CACHING
// ======================

export const getExamsByClassFromCache = async (classId, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_CLASS, `${classId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setExamsByClassInCache = async (classId, params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_CLASS, `${classId}:${generateSearchKey(params)}`);
  return await setCache(key, data, CACHE_CONFIG.TTL.EXAM_LIST);
};

export const deleteExamsByClassFromCache = async (classId) => {
  const pattern = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_CLASS, `${classId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// TERM-SPECIFIC CACHING
// ======================

export const getExamsByTermFromCache = async (termId, params = {}) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_TERM, `${termId}:${generateSearchKey(params)}`);
  return await getCache(key);
};

export const setExamsByTermInCache = async (termId, params, data) => {
  const key = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_TERM, `${termId}:${generateSearchKey(params)}`);
  return await setCache(key, data, CACHE_CONFIG.TTL.EXAM_LIST);
};

export const deleteExamsByTermFromCache = async (termId) => {
  const pattern = generateCacheKey(CACHE_CONFIG.KEYS.EXAM_BY_TERM, `${termId}:*`);
  return await deleteCachePattern(pattern);
};

// ======================
// CACHE INVALIDATION
// ======================

export const invalidateExamCacheOnCreate = async (examData) => {
  try {
    const promises = [
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_LIST_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_SEARCH_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_COUNTS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_EXPORT_ALL),
    ];

    if (examData.schoolId) {
      promises.push(deleteExamsBySchoolFromCache(examData.schoolId));
    }

    if (examData.subjectId) {
      promises.push(deleteExamsBySubjectFromCache(examData.subjectId));
    }

    if (examData.classId) {
      promises.push(deleteExamsByClassFromCache(examData.classId));
    }

    if (examData.termId) {
      promises.push(deleteExamsByTermFromCache(examData.termId));
    }

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on create:', error);
    return false;
  }
};

export const invalidateExamCacheOnUpdate = async (examData, oldData = null) => {
  try {
    const promises = [
      deleteExamFromCache(examData.id),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_LIST_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_SEARCH_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_COUNTS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_EXPORT_ALL),
      deleteExamStatsFromCache(examData.id),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_ANALYTICS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_RESULTS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_GRADES_ALL),
      deleteExamTimetableFromCache(examData.id),
    ];

    // Invalidate school-specific cache
    if (examData.schoolId) {
      promises.push(deleteExamsBySchoolFromCache(examData.schoolId));
    }

    // Invalidate subject-specific cache
    if (examData.subjectId) {
      promises.push(deleteExamsBySubjectFromCache(examData.subjectId));
    }

    // Invalidate class-specific cache
    if (examData.classId) {
      promises.push(deleteExamsByClassFromCache(examData.classId));
    }

    // Invalidate term-specific cache
    if (examData.termId) {
      promises.push(deleteExamsByTermFromCache(examData.termId));
    }

    // If school, subject, class, or term changed, invalidate old caches
    if (oldData) {
      if (oldData.schoolId && oldData.schoolId !== examData.schoolId) {
        promises.push(deleteExamsBySchoolFromCache(oldData.schoolId));
      }
      if (oldData.subjectId && oldData.subjectId !== examData.subjectId) {
        promises.push(deleteExamsBySubjectFromCache(oldData.subjectId));
      }
      if (oldData.classId && oldData.classId !== examData.classId) {
        promises.push(deleteExamsByClassFromCache(oldData.classId));
      }
      if (oldData.termId && oldData.termId !== examData.termId) {
        promises.push(deleteExamsByTermFromCache(oldData.termId));
      }
    }

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on update:', error);
    return false;
  }
};

export const invalidateExamCacheOnDelete = async (examData) => {
  try {
    const promises = [
      deleteExamFromCache(examData.id),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_LIST_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_SEARCH_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_COUNTS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_EXPORT_ALL),
      deleteExamStatsFromCache(examData.id),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_ANALYTICS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_RESULTS_ALL),
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_GRADES_ALL),
      deleteExamTimetableFromCache(examData.id),
    ];

    if (examData.schoolId) {
      promises.push(deleteExamsBySchoolFromCache(examData.schoolId));
    }

    if (examData.subjectId) {
      promises.push(deleteExamsBySubjectFromCache(examData.subjectId));
    }

    if (examData.classId) {
      promises.push(deleteExamsByClassFromCache(examData.classId));
    }

    if (examData.termId) {
      promises.push(deleteExamsByTermFromCache(examData.termId));
    }

    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on delete:', error);
    return false;
  }
};

export const invalidateExamCacheOnBulkOperation = async (operation, affectedIds = []) => {
  try {
    const promises = [
      deleteCachePattern(CACHE_CONFIG.PATTERNS.EXAM_ALL),
    ];

    // Delete specific exam data
    for (const id of affectedIds) {
      promises.push(deleteExamFromCache(id));
      promises.push(deleteExamStatsFromCache(id));
      promises.push(deleteExamTimetableFromCache(id));
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

export const getExamCacheStats = async () => {
  try {
    if (useRedis && redisClient) {
      const info = await redisClient.info('memory');
      const keys = await redisClient.keys(CACHE_CONFIG.PATTERNS.EXAM_ALL);
      
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

export const clearExamCache = async () => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys(CACHE_CONFIG.PATTERNS.EXAM_ALL);
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

export const checkExamCacheHealth = async () => {
  try {
    const testKey = 'exam:health:test';
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
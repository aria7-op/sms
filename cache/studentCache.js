import Redis from 'ioredis';
import { promisify } from 'util';

// Initialize Redis client with error handling
let redis = null;
let redisConnected = false;

// Disable Redis for now - only use memory cache
console.log('Student Cache: Redis disabled - using memory cache only');

// Uncomment the following code to enable Redis when needed
/*
try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB || 0,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    family: 4,
    keyPrefix: 'student:',
    connectTimeout: 5000, // 5 second timeout
    commandTimeout: 3000  // 3 second timeout
  });

  redis.on('connect', () => {
    console.log('Redis connected successfully');
    redisConnected = true;
  });

  redis.on('error', (error) => {
    console.error('Redis connection error:', error.message);
    redisConnected = false;
  });

  redis.on('close', () => {
    console.log('Redis connection closed');
    redisConnected = false;
  });

} catch (error) {
  console.error('Failed to initialize Redis:', error.message);
  redisConnected = false;
}
*/

// Cache configuration
const CACHE_CONFIG = {
  // Individual student cache
  STUDENT_TTL: 1800, // 30 minutes
  STUDENT_LIST_TTL: 900, // 15 minutes
  STUDENT_SEARCH_TTL: 600, // 10 minutes
  STUDENT_STATS_TTL: 3600, // 1 hour
  STUDENT_ANALYTICS_TTL: 7200, // 2 hours
  STUDENT_PERFORMANCE_TTL: 3600, // 1 hour
  
  // Bulk operations
  BULK_OPERATION_TTL: 300, // 5 minutes
  
  // Cache keys
  KEYS: {
    STUDENT: 'student',
    STUDENT_LIST: 'student:list',
    STUDENT_SEARCH: 'student:search',
    STUDENT_STATS: 'student:stats',
    STUDENT_ANALYTICS: 'student:analytics',
    STUDENT_PERFORMANCE: 'student:performance',
    STUDENT_COUNT: 'student:count',
    STUDENT_BY_CLASS: 'student:by_class',
    STUDENT_BY_STATUS: 'student:by_status'
  }
};

// ======================
// INDIVIDUAL STUDENT CACHE
// ======================

/**
 * Set student in cache
 */
export const setStudentInCache = async (student, ttl = CACHE_CONFIG.STUDENT_TTL) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache set');
      return false;
    }

    if (!student || !student.id) {
      throw new Error('Invalid student data for caching');
    }

    const key = `${CACHE_CONFIG.KEYS.STUDENT}:${student.id}`;
    const data = JSON.stringify({
      ...student,
      cachedAt: new Date().toISOString()
    });

    await Promise.race([
      redis.setex(key, ttl, data),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000))
    ]);
    
    console.log(`Student ${student.id} cached successfully`);
    return true;
  } catch (error) {
    console.error('Error setting student in cache:', error);
    return false;
  }
};

/**
 * Get student from cache
 */
export const getStudentFromCache = async (studentId) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache get');
      return null;
    }

    const key = `${CACHE_CONFIG.KEYS.STUDENT}:${studentId}`;
    const data = await redis.get(key);
    
    if (!data) {
      return null;
    }

    const student = JSON.parse(data);
    console.log(`Student ${studentId} retrieved from cache`);
    return student;
  } catch (error) {
    console.error('Error getting student from cache:', error);
    return null;
  }
};

/**
 * Delete student from cache
 */
export const deleteStudentFromCache = async (studentId) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache delete');
      return false;
    }

    const key = `${CACHE_CONFIG.KEYS.STUDENT}:${studentId}`;
    await redis.del(key);
    
    console.log(`Student ${studentId} deleted from cache`);
    return true;
  } catch (error) {
    console.error('Error deleting student from cache:', error);
    return false;
  }
};

// ======================
// STUDENT LIST CACHE
// ======================

/**
 * Set student list in cache
 */
export const setStudentListInCache = async (params, data, ttl = CACHE_CONFIG.STUDENT_LIST_TTL) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache set');
      return false;
    }

    const key = generateListCacheKey(params);
    const cacheData = JSON.stringify({
      ...data,
      cachedAt: new Date().toISOString(),
      params
    });

    await redis.setex(key, ttl, cacheData);
    
    console.log(`Student list cached with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error setting student list in cache:', error);
    return false;
  }
};

/**
 * Get student list from cache
 */
export const getStudentListFromCache = async (params) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache get');
      return null;
    }

    const key = generateListCacheKey(params);
    const data = await redis.get(key);
    
    if (!data) {
      return null;
    }

    const cachedData = JSON.parse(data);
    console.log(`Student list retrieved from cache with key: ${key}`);
    return cachedData;
  } catch (error) {
    console.error('Error getting student list from cache:', error);
    return null;
  }
};

/**
 * Delete student list cache
 */
export const deleteStudentListCache = async (params) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache delete');
      return false;
    }

    const key = generateListCacheKey(params);
    await redis.del(key);
    
    console.log(`Student list cache deleted with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error deleting student list cache:', error);
    return false;
  }
};

// ======================
// STUDENT SEARCH CACHE
// ======================

/**
 * Set student search in cache
 */
export const setStudentSearchInCache = async (searchParams, results, ttl = CACHE_CONFIG.STUDENT_SEARCH_TTL) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache set');
      return false;
    }

    const key = generateSearchCacheKey(searchParams);
    const cacheData = JSON.stringify({
      results,
      cachedAt: new Date().toISOString(),
      searchParams
    });

    await redis.setex(key, ttl, cacheData);
    
    console.log(`Student search cached with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error setting student search in cache:', error);
    return false;
  }
};

/**
 * Get student search from cache
 */
export const getStudentSearchFromCache = async (searchParams) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache get');
      return null;
    }

    const key = generateSearchCacheKey(searchParams);
    const data = await redis.get(key);
    
    if (!data) {
      return null;
    }

    const cachedData = JSON.parse(data);
    console.log(`Student search retrieved from cache with key: ${key}`);
    return cachedData;
  } catch (error) {
    console.error('Error getting student search from cache:', error);
    return null;
  }
};

/**
 * Delete student search cache
 */
export const deleteStudentSearchCache = async (searchParams) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache delete');
      return false;
    }

    const key = generateSearchCacheKey(searchParams);
    await redis.del(key);
    
    console.log(`Student search cache deleted with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error deleting student search cache:', error);
    return false;
  }
};

// ======================
// STUDENT STATS CACHE
// ======================

/**
 * Set student stats in cache
 */
export const setStudentStatsInCache = async (type, params, stats, ttl = CACHE_CONFIG.STUDENT_STATS_TTL) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache set');
      return false;
    }

    const key = generateStatsCacheKey(type, params);
    const cacheData = JSON.stringify({
      stats,
      cachedAt: new Date().toISOString(),
      type,
      params
    });

    await redis.setex(key, ttl, cacheData);
    
    console.log(`Student stats cached with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error setting student stats in cache:', error);
    return false;
  }
};

/**
 * Get student stats from cache
 */
export const getStudentStatsFromCache = async (type, params) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache get');
      return null;
    }

    const key = generateStatsCacheKey(type, params);
    const data = await redis.get(key);
    
    if (!data) {
      return null;
    }

    const cachedData = JSON.parse(data);
    console.log(`Student stats retrieved from cache with key: ${key}`);
    return cachedData.stats;
  } catch (error) {
    console.error('Error getting student stats from cache:', error);
    return null;
  }
};

/**
 * Delete student stats cache
 */
export const deleteStudentStatsCache = async (type, params) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache delete');
      return false;
    }

    const key = generateStatsCacheKey(type, params);
    await redis.del(key);
    
    console.log(`Student stats cache deleted with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error deleting student stats cache:', error);
    return false;
  }
};

// ======================
// STUDENT ANALYTICS CACHE
// ======================

/**
 * Set student analytics in cache
 */
export const setStudentAnalyticsInCache = async (type, params, analytics, ttl = CACHE_CONFIG.STUDENT_ANALYTICS_TTL) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache set');
      return false;
    }

    const key = generateAnalyticsCacheKey(type, params);
    const cacheData = JSON.stringify({
      analytics,
      cachedAt: new Date().toISOString(),
      type,
      params
    });

    await redis.setex(key, ttl, cacheData);
    
    console.log(`Student analytics cached with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error setting student analytics in cache:', error);
    return false;
  }
};

/**
 * Get student analytics from cache
 */
export const getStudentAnalyticsFromCache = async (type, params) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache get');
      return null;
    }

    const key = generateAnalyticsCacheKey(type, params);
    const data = await redis.get(key);
    
    if (!data) {
      return null;
    }

    const cachedData = JSON.parse(data);
    console.log(`Student analytics retrieved from cache with key: ${key}`);
    return cachedData.analytics;
  } catch (error) {
    console.error('Error getting student analytics from cache:', error);
    return null;
  }
};

/**
 * Delete student analytics cache
 */
export const deleteStudentAnalyticsCache = async (type, params) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache delete');
      return false;
    }

    const key = generateAnalyticsCacheKey(type, params);
    await redis.del(key);
    
    console.log(`Student analytics cache deleted with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error deleting student analytics cache:', error);
    return false;
  }
};

// ======================
// STUDENT PERFORMANCE CACHE
// ======================

/**
 * Set student performance in cache
 */
export const setStudentPerformanceInCache = async (studentId, params, performance, ttl = CACHE_CONFIG.STUDENT_PERFORMANCE_TTL) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache set');
      return false;
    }

    const key = generatePerformanceCacheKey(studentId, params);
    const cacheData = JSON.stringify({
      performance,
      cachedAt: new Date().toISOString(),
      studentId,
      params
    });

    await redis.setex(key, ttl, cacheData);
    
    console.log(`Student performance cached with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error setting student performance in cache:', error);
    return false;
  }
};

/**
 * Get student performance from cache
 */
export const getStudentPerformanceFromCache = async (studentId, params) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache get');
      return null;
    }

    const key = generatePerformanceCacheKey(studentId, params);
    const data = await redis.get(key);
    
    if (!data) {
      return null;
    }

    const cachedData = JSON.parse(data);
    console.log(`Student performance retrieved from cache with key: ${key}`);
    return cachedData.performance;
  } catch (error) {
    console.error('Error getting student performance from cache:', error);
    return null;
  }
};

/**
 * Delete student performance cache
 */
export const deleteStudentPerformanceCache = async (studentId, params) => {
  try {
    if (!redisConnected || !redis) {
      console.log('Redis not available, skipping cache delete');
      return false;
    }

    const key = generatePerformanceCacheKey(studentId, params);
    await redis.del(key);
    
    console.log(`Student performance cache deleted with key: ${key}`);
    return true;
  } catch (error) {
    console.error('Error deleting student performance cache:', error);
    return false;
  }
};

// ======================
// CACHE INVALIDATION
// ======================

/**
 * Invalidate student cache on create
 */
export const invalidateStudentCacheOnCreate = async (student) => {
  try {
    const promises = [
      deleteStudentFromCache(student.id),
      deleteStudentListCache({}),
      deleteStudentSearchCache({}),
      deleteStudentStatsCache('individual', { studentId: student.id }),
      deleteStudentStatsCache('school', { schoolId: student.schoolId }),
      deleteStudentStatsCache('class', { classId: student.classId }),
      deleteStudentAnalyticsCache('individual', { studentId: student.id }),
      deleteStudentPerformanceCache(student.id, {})
    ];

    await Promise.all(promises);
    console.log(`Cache invalidated for new student ${student.id}`);
    return true;
  } catch (error) {
    console.error('Error invalidating student cache on create:', error);
    return false;
  }
};

/**
 * Invalidate student cache on update
 */
export const invalidateStudentCacheOnUpdate = async (updatedStudent, oldStudent) => {
  try {
    const promises = [
      deleteStudentFromCache(updatedStudent.id),
      deleteStudentListCache({}),
      deleteStudentSearchCache({}),
      deleteStudentStatsCache('individual', { studentId: updatedStudent.id }),
      deleteStudentAnalyticsCache('individual', { studentId: updatedStudent.id }),
      deleteStudentPerformanceCache(updatedStudent.id, {})
    ];

    // If class changed, invalidate class-specific caches
    if (oldStudent.classId !== updatedStudent.classId) {
      promises.push(
        deleteStudentStatsCache('class', { classId: oldStudent.classId }),
        deleteStudentStatsCache('class', { classId: updatedStudent.classId })
      );
    }

    await Promise.all(promises);
    console.log(`Cache invalidated for updated student ${updatedStudent.id}`);
    return true;
  } catch (error) {
    console.error('Error invalidating student cache on update:', error);
    return false;
  }
};

/**
 * Invalidate student cache on delete
 */
export const invalidateStudentCacheOnDelete = async (student) => {
  try {
    const promises = [
      deleteStudentFromCache(student.id),
      deleteStudentListCache({}),
      deleteStudentSearchCache({}),
      deleteStudentStatsCache('individual', { studentId: student.id }),
      deleteStudentStatsCache('school', { schoolId: student.schoolId }),
      deleteStudentStatsCache('class', { classId: student.classId }),
      deleteStudentAnalyticsCache('individual', { studentId: student.id }),
      deleteStudentPerformanceCache(student.id, {})
    ];

    await Promise.all(promises);
    console.log(`Cache invalidated for deleted student ${student.id}`);
    return true;
  } catch (error) {
    console.error('Error invalidating student cache on delete:', error);
    return false;
  }
};

/**
 * Invalidate student cache on bulk operation
 */
export const invalidateStudentCacheOnBulkOperation = async (operation, studentIds) => {
  try {
    const promises = [
      deleteStudentListCache({}),
      deleteStudentSearchCache({})
    ];

    // Delete individual student caches
    for (const studentId of studentIds) {
      promises.push(
        deleteStudentFromCache(studentId),
        deleteStudentStatsCache('individual', { studentId }),
        deleteStudentAnalyticsCache('individual', { studentId }),
        deleteStudentPerformanceCache(studentId, {})
      );
    }

    await Promise.all(promises);
    console.log(`Cache invalidated for bulk ${operation} operation on ${studentIds.length} students`);
    return true;
  } catch (error) {
    console.error('Error invalidating student cache on bulk operation:', error);
    return false;
  }
};

// ======================
// CACHE MIDDLEWARE
// ======================

/**
 * Student cache middleware
 */
export const studentCacheMiddleware = (ttl = CACHE_CONFIG.STUDENT_TTL) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return next();
      }

      const cachedStudent = await getStudentFromCache(id);
      
      if (cachedStudent) {
        return res.json({
          success: true,
          data: cachedStudent,
          message: 'Student fetched from cache',
          meta: {
            source: 'cache',
            cachedAt: cachedStudent.cachedAt
          }
        });
      }

      next();
    } catch (error) {
      console.error('Student cache middleware error:', error);
      next();
    }
  };
};

/**
 * Student list cache middleware
 */
export const studentListCacheMiddleware = (ttl = CACHE_CONFIG.STUDENT_LIST_TTL) => {
  return async (req, res, next) => {
    console.log('=== studentListCacheMiddleware START ===');
    console.log('Query params:', req.query);
    
    try {
      const params = {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        filters: {
          search: req.query.search,
          classId: req.query.classId,
          sectionId: req.query.sectionId,
          parentId: req.query.parentId,
          status: req.query.status,
          bloodGroup: req.query.bloodGroup,
          nationality: req.query.nationality,
          religion: req.query.religion,
          admissionDateFrom: req.query.admissionDateFrom,
          admissionDateTo: req.query.admissionDateTo
        },
        include: req.query.include,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };

      console.log('Cache params:', params);
      console.log('Checking cache...');
      const cachedData = await getStudentListFromCache(params);
      
      if (cachedData) {
        console.log('=== studentListCacheMiddleware END: Returning cached data ===');
        return res.json({
          success: true,
          data: cachedData.data,
          message: 'Students fetched from cache',
          meta: {
            source: 'cache',
            cachedAt: cachedData.cachedAt,
            pagination: cachedData.pagination
          }
        });
      }

      console.log('=== studentListCacheMiddleware END: No cache, proceeding ===');
      next();
    } catch (error) {
      console.error('=== studentListCacheMiddleware ERROR ===', error);
      console.log('=== studentListCacheMiddleware END: Error, proceeding ===');
      next();
    }
  };
};

/**
 * Student stats cache middleware
 */
export const studentStatsCacheMiddleware = (ttl = CACHE_CONFIG.STUDENT_STATS_TTL) => {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return next();
      }

      const cachedStats = await getStudentStatsFromCache('individual', { studentId: id });
      
      if (cachedStats) {
        return res.json({
          success: true,
          data: cachedStats,
          message: 'Student stats fetched from cache',
          meta: {
            source: 'cache'
          }
        });
      }

      next();
    } catch (error) {
      console.error('Student stats cache middleware error:', error);
      next();
    }
  };
};

// ======================
// CACHE UTILITIES
// ======================

/**
 * Generate list cache key
 */
function generateListCacheKey(params) {
  const { page, limit, filters, include, sortBy, sortOrder } = params;
  const filterString = JSON.stringify(filters || {});
  const includeString = Array.isArray(include) ? include.join(',') : include || '';
  
  return `${CACHE_CONFIG.KEYS.STUDENT_LIST}:${page}:${limit}:${filterString}:${includeString}:${sortBy}:${sortOrder}`;
}

/**
 * Generate search cache key
 */
function generateSearchCacheKey(searchParams) {
  const searchString = JSON.stringify(searchParams);
  return `${CACHE_CONFIG.KEYS.STUDENT_SEARCH}:${Buffer.from(searchString).toString('base64')}`;
}

/**
 * Generate stats cache key
 */
function generateStatsCacheKey(type, params) {
  const paramsString = JSON.stringify(params);
  return `${CACHE_CONFIG.KEYS.STUDENT_STATS}:${type}:${Buffer.from(paramsString).toString('base64')}`;
}

/**
 * Generate analytics cache key
 */
function generateAnalyticsCacheKey(type, params) {
  const paramsString = JSON.stringify(params);
  return `${CACHE_CONFIG.KEYS.STUDENT_ANALYTICS}:${type}:${Buffer.from(paramsString).toString('base64')}`;
}

/**
 * Generate performance cache key
 */
function generatePerformanceCacheKey(studentId, params) {
  const paramsString = JSON.stringify(params);
  return `${CACHE_CONFIG.KEYS.STUDENT_PERFORMANCE}:${studentId}:${Buffer.from(paramsString).toString('base64')}`;
}

/**
 * Get cache statistics
 */
export const getStudentCacheStats = async () => {
  try {
    const keys = await redis.keys('student:*');
    const stats = {
      totalKeys: keys.length,
      keyTypes: {},
      memoryUsage: await redis.memory('USAGE'),
      info: await redis.info('memory')
    };

    // Count key types
    keys.forEach(key => {
      const type = key.split(':')[1] || 'unknown';
      stats.keyTypes[type] = (stats.keyTypes[type] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error getting student cache stats:', error);
    return null;
  }
};

/**
 * Clear all student cache
 */
export const clearStudentCache = async () => {
  try {
    const keys = await redis.keys('student:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    
    console.log(`Cleared ${keys.length} student cache keys`);
    return keys.length;
  } catch (error) {
    console.error('Error clearing student cache:', error);
    return 0;
  }
};

/**
 * Warm student cache
 */
export const warmStudentCache = async (studentIds = []) => {
  try {
    const { PrismaClient } = await import('../generated/prisma/index.js');
    const prisma = new PrismaClient();

    let students;
    
    if (studentIds.length > 0) {
      students = await prisma.student.findMany({
        where: {
          id: { in: studentIds },
          deletedAt: null
        },
        include: {
          user: true,
          class: true,
          section: true,
          parent: {
            include: {
              user: true
            }
          }
        }
      });
    } else {
      // Get recent students
      students = await prisma.student.findMany({
        where: {
          deletedAt: null
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100,
        include: {
          user: true,
          class: true,
          section: true,
          parent: {
            include: {
              user: true
            }
          }
        }
      });
    }

    const cachePromises = students.map(student => setStudentInCache(student));
    await Promise.all(cachePromises);

    console.log(`Warmed cache for ${students.length} students`);
    return students.length;
  } catch (error) {
    console.error('Error warming student cache:', error);
    return 0;
  }
};

export default {
  setStudentInCache,
  getStudentFromCache,
  deleteStudentFromCache,
  setStudentListInCache,
  getStudentListFromCache,
  deleteStudentListCache,
  setStudentSearchInCache,
  getStudentSearchFromCache,
  deleteStudentSearchCache,
  setStudentStatsInCache,
  getStudentStatsFromCache,
  deleteStudentStatsCache,
  setStudentAnalyticsInCache,
  getStudentAnalyticsFromCache,
  deleteStudentAnalyticsCache,
  setStudentPerformanceInCache,
  getStudentPerformanceFromCache,
  deleteStudentPerformanceCache,
  invalidateStudentCacheOnCreate,
  invalidateStudentCacheOnUpdate,
  invalidateStudentCacheOnDelete,
  invalidateStudentCacheOnBulkOperation,
  studentCacheMiddleware,
  studentListCacheMiddleware,
  studentStatsCacheMiddleware,
  getStudentCacheStats,
  clearStudentCache,
  warmStudentCache
}; 
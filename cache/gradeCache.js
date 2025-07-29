import Redis from 'ioredis';
import logger from '../config/logger.js';

// Redis configuration (optional - falls back to memory store if not available)
let redisClient = null;
let useRedis = false;

// Disable Redis for now - only use memory cache
console.log('Grade Cache: Redis disabled - using memory cache only');

// Memory cache fallback
const memoryCache = new Map();
const cacheTTL = new Map();

// Cache configuration
const CACHE_PREFIX = 'grade';
const DEFAULT_TTL = 1800; // 30 minutes
const STATS_TTL = 900; // 15 minutes
const ANALYTICS_TTL = 3600; // 1 hour
const REPORT_TTL = 7200; // 2 hours

class GradeCache {
  constructor() {
    this.prefix = CACHE_PREFIX;
    this.defaultTTL = DEFAULT_TTL;
  }

  // ======================
  // CACHE OPERATIONS
  // ======================

  getCacheKey(key) {
    return `${this.prefix}:${key}`;
  }

  async get(key) {
    try {
      const cacheKey = this.getCacheKey(key);
      
      if (useRedis && redisClient) {
        const cached = await redisClient.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      } else {
        // Memory cache fallback
        if (this.isExpired(cacheKey)) {
          memoryCache.delete(cacheKey);
          cacheTTL.delete(cacheKey);
          return null;
        }
        return memoryCache.get(cacheKey) || null;
      }
    } catch (error) {
      logger.error('Grade cache get error:', error);
      return null;
    }
  }

  async set(key, data, ttl = this.defaultTTL) {
    try {
      const cacheKey = this.getCacheKey(key);
      
      if (useRedis && redisClient) {
        await redisClient.setex(cacheKey, ttl, JSON.stringify(data));
      } else {
        // Memory cache fallback
        memoryCache.set(cacheKey, data);
        cacheTTL.set(cacheKey, Date.now() + (ttl * 1000));
      }
    } catch (error) {
      logger.error('Grade cache set error:', error);
    }
  }

  async delete(pattern) {
    try {
      const cacheKey = this.getCacheKey(pattern);
      
      if (useRedis && redisClient) {
        const keys = await redisClient.keys(cacheKey);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } else {
        // Memory cache fallback
        for (const key of memoryCache.keys()) {
          if (key.includes(pattern.replace('*', ''))) {
            memoryCache.delete(key);
            cacheTTL.delete(key);
          }
        }
      }
    } catch (error) {
      logger.error('Grade cache delete error:', error);
    }
  }

  isExpired(key) {
    const expiry = cacheTTL.get(key);
    return expiry && Date.now() > expiry;
  }

  // ======================
  // CACHE MIDDLEWARE
  // ======================

  gradeCacheMiddleware(ttl = DEFAULT_TTL) {
    return async (req, res, next) => {
      try {
        const { schoolId } = req.user;
        const cacheKey = `grades:${schoolId}:${JSON.stringify(req.query)}`;
        
        const cached = await this.get(cacheKey);
        if (cached) {
          logger.info(`Grade cache hit for key: ${cacheKey}`);
          return res.json(cached);
        }

        // Store original send method
        const originalSend = res.json;
        
        // Override send method to cache response
        res.json = function(data) {
          if (data.success) {
            this.set(cacheKey, data, ttl);
          }
          return originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        logger.error('Grade cache middleware error:', error);
        next();
      }
    };
  }

  gradeStatsCacheMiddleware(ttl = STATS_TTL) {
    return async (req, res, next) => {
      try {
        const { schoolId } = req.user;
        const { id } = req.params;
        const cacheKey = `grade:stats:${id}:${schoolId}`;
        
        const cached = await this.get(cacheKey);
        if (cached) {
          logger.info(`Grade stats cache hit for key: ${cacheKey}`);
          return res.json(cached);
        }

        // Store original send method
        const originalSend = res.json;
        
        // Override send method to cache response
        res.json = function(data) {
          if (data.success) {
            this.set(cacheKey, data, ttl);
          }
          return originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        logger.error('Grade stats cache middleware error:', error);
        next();
      }
    };
  }

  gradeAnalyticsCacheMiddleware(ttl = ANALYTICS_TTL) {
    return async (req, res, next) => {
      try {
        const { schoolId } = req.user;
        const { id } = req.params;
        const { period = '30d' } = req.query;
        const cacheKey = `grade:analytics:${id}:${schoolId}:${period}`;
        
        const cached = await this.get(cacheKey);
        if (cached) {
          logger.info(`Grade analytics cache hit for key: ${cacheKey}`);
          return res.json(cached);
        }

        // Store original send method
        const originalSend = res.json;
        
        // Override send method to cache response
        res.json = function(data) {
          if (data.success) {
            this.set(cacheKey, data, ttl);
          }
          return originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        logger.error('Grade analytics cache middleware error:', error);
        next();
      }
    };
  }

  gradeReportCacheMiddleware(ttl = REPORT_TTL) {
    return async (req, res, next) => {
      try {
        const { schoolId } = req.user;
        const cacheKey = `grade:report:${schoolId}:${JSON.stringify(req.query)}`;
        
        const cached = await this.get(cacheKey);
        if (cached) {
          logger.info(`Grade report cache hit for key: ${cacheKey}`);
          return res.json(cached);
        }

        // Store original send method
        const originalSend = res.json;
        
        // Override send method to cache response
        res.json = function(data) {
          if (data.success) {
            this.set(cacheKey, data, ttl);
          }
          return originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        logger.error('Grade report cache middleware error:', error);
        next();
      }
    };
  }

  gradeDistributionCacheMiddleware(ttl = STATS_TTL) {
    return async (req, res, next) => {
      try {
        const { schoolId } = req.user;
        const { examId, subjectId } = req.query;
        const cacheKey = `grade:distribution:${schoolId}:${examId || 'all'}:${subjectId || 'all'}`;
        
        const cached = await this.get(cacheKey);
        if (cached) {
          logger.info(`Grade distribution cache hit for key: ${cacheKey}`);
          return res.json(cached);
        }

        // Store original send method
        const originalSend = res.json;
        
        // Override send method to cache response
        res.json = function(data) {
          if (data.success) {
            this.set(cacheKey, data, ttl);
          }
          return originalSend.call(this, data);
        }.bind(this);

        next();
      } catch (error) {
        logger.error('Grade distribution cache middleware error:', error);
        next();
      }
    };
  }

  // ======================
  // CACHE INVALIDATION
  // ======================

  async invalidateGradeCache(gradeId, schoolId) {
    try {
      await Promise.all([
        this.delete(`*:${gradeId}`),
        this.delete(`*:school:${schoolId}`),
        this.delete('*:stats*'),
        this.delete('*:analytics*'),
        this.delete('*:report*'),
        this.delete('*:distribution*')
      ]);
      
      logger.info(`Invalidated grade cache for gradeId: ${gradeId}, schoolId: ${schoolId}`);
    } catch (error) {
      logger.error('Grade cache invalidation error:', error);
    }
  }

  async invalidateStudentGradeCache(studentId, schoolId) {
    try {
      await Promise.all([
        this.delete(`*:student:${studentId}`),
        this.delete(`*:school:${schoolId}`),
        this.delete('*:stats*'),
        this.delete('*:analytics*'),
        this.delete('*:report*')
      ]);
      
      logger.info(`Invalidated student grade cache for studentId: ${studentId}, schoolId: ${schoolId}`);
    } catch (error) {
      logger.error('Student grade cache invalidation error:', error);
    }
  }

  async invalidateExamGradeCache(examId, schoolId) {
    try {
      await Promise.all([
        this.delete(`*:exam:${examId}`),
        this.delete(`*:school:${schoolId}`),
        this.delete('*:stats*'),
        this.delete('*:analytics*'),
        this.delete('*:report*'),
        this.delete('*:distribution*')
      ]);
      
      logger.info(`Invalidated exam grade cache for examId: ${examId}, schoolId: ${schoolId}`);
    } catch (error) {
      logger.error('Exam grade cache invalidation error:', error);
    }
  }

  async invalidateSubjectGradeCache(subjectId, schoolId) {
    try {
      await Promise.all([
        this.delete(`*:subject:${subjectId}`),
        this.delete(`*:school:${schoolId}`),
        this.delete('*:stats*'),
        this.delete('*:analytics*'),
        this.delete('*:report*'),
        this.delete('*:distribution*')
      ]);
      
      logger.info(`Invalidated subject grade cache for subjectId: ${subjectId}, schoolId: ${schoolId}`);
    } catch (error) {
      logger.error('Subject grade cache invalidation error:', error);
    }
  }

  async invalidateSchoolGradeCache(schoolId) {
    try {
      await Promise.all([
        this.delete(`*:school:${schoolId}`),
        this.delete('*:stats*'),
        this.delete('*:analytics*'),
        this.delete('*:report*'),
        this.delete('*:distribution*')
      ]);
      
      logger.info(`Invalidated school grade cache for schoolId: ${schoolId}`);
    } catch (error) {
      logger.error('School grade cache invalidation error:', error);
    }
  }

  // ======================
  // CACHE UTILITIES
  // ======================

  async getCacheStats() {
    try {
      if (useRedis && redisClient) {
        const info = await redisClient.info('memory');
        const keys = await redisClient.keys(`${this.prefix}:*`);
        return {
          type: 'redis',
          keys: keys.length,
          info
        };
      } else {
        const keys = Array.from(memoryCache.keys()).filter(key => key.startsWith(this.prefix));
        return {
          type: 'memory',
          keys: keys.length,
          size: memoryCache.size,
          keysList: keys
        };
      }
    } catch (error) {
      logger.error('Get grade cache stats error:', error);
      throw error;
    }
  }

  async warmCache(schoolId, gradeId = null) {
    try {
      if (gradeId) {
        // Warm specific grade cache
        const cacheKey = `grade:${gradeId}`;
        // This would typically fetch the grade data and cache it
        logger.info(`Warmed grade cache for gradeId: ${gradeId}`);
      } else {
        // Warm school grade cache
        const cacheKey = `grades:school:${schoolId}`;
        // This would typically fetch all grades for the school and cache them
        logger.info(`Warmed school grade cache for schoolId: ${schoolId}`);
      }
    } catch (error) {
      logger.error('Warm grade cache error:', error);
      throw error;
    }
  }

  async clearCache(schoolId = null) {
    try {
      if (schoolId) {
        await this.invalidateSchoolGradeCache(schoolId);
      } else {
        await this.delete('*');
      }
      
      logger.info(`Cleared grade cache for schoolId: ${schoolId || 'all'}`);
    } catch (error) {
      logger.error('Clear grade cache error:', error);
      throw error;
    }
  }
}

// Create singleton instance
const gradeCache = new GradeCache();

// Export middleware functions
export const gradeCacheMiddleware = (ttl) => gradeCache.gradeCacheMiddleware(ttl);
export const gradeStatsCacheMiddleware = (ttl) => gradeCache.gradeStatsCacheMiddleware(ttl);
export const gradeAnalyticsCacheMiddleware = (ttl) => gradeCache.gradeAnalyticsCacheMiddleware(ttl);
export const gradeReportCacheMiddleware = (ttl) => gradeCache.gradeReportCacheMiddleware(ttl);
export const gradeDistributionCacheMiddleware = (ttl) => gradeCache.gradeDistributionCacheMiddleware(ttl);

// Export cache utilities
export const invalidateGradeCache = (gradeId, schoolId) => gradeCache.invalidateGradeCache(gradeId, schoolId);
export const invalidateStudentGradeCache = (studentId, schoolId) => gradeCache.invalidateStudentGradeCache(studentId, schoolId);
export const invalidateExamGradeCache = (examId, schoolId) => gradeCache.invalidateExamGradeCache(examId, schoolId);
export const invalidateSubjectGradeCache = (subjectId, schoolId) => gradeCache.invalidateSubjectGradeCache(subjectId, schoolId);
export const invalidateSchoolGradeCache = (schoolId) => gradeCache.invalidateSchoolGradeCache(schoolId);
export const getGradeCacheStats = () => gradeCache.getCacheStats();
export const warmGradeCache = (schoolId, gradeId) => gradeCache.warmCache(schoolId, gradeId);
export const clearGradeCache = (schoolId) => gradeCache.clearCache(schoolId);

export default gradeCache; 
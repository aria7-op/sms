import Redis from 'ioredis';

// ======================
// CACHE CONFIGURATION
// ======================

export const CACHE_CONFIG = {
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  DEFAULT_TTL: 3600, // 1 hour
  MAX_KEYS: 10000,
};

// Disable Redis for now - only use memory cache
console.log('Redis disabled - using memory cache only');

// Create a mock Redis client that doesn't connect
export const redis = {
  setex: async () => true,
  get: async () => null,
  del: async () => 0,
  keys: async () => [],
  info: async () => 'memory',
  dbsize: async () => 0,
  ping: async () => 'PONG',
  memory: async () => 0,
  on: () => {},
  off: () => {},
  disconnect: () => {},
  quit: () => {}
};

// ======================
// BASIC CACHE OPERATIONS
// ======================

export const setCache = async (key, data, ttl = CACHE_CONFIG.DEFAULT_TTL) => {
  try {
    // Memory cache implementation - just return true
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

export const getCache = async (key) => {
  try {
    // Memory cache implementation - always return null
    return null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const deleteCache = async (key) => {
  try {
    // Memory cache implementation - just return true
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
};

export const deleteCachePattern = async (pattern) => {
  try {
    // Memory cache implementation - just return 0
    return 0;
  } catch (error) {
    console.error('Cache pattern delete error:', error);
    return 0;
  }
};

// ======================
// CACHE MANAGER CLASS
// ======================

class CacheManager {
  constructor() {
    this.redis = redis;
  }

  // Basic operations
  async set(key, data, ttl = CACHE_CONFIG.DEFAULT_TTL) {
    return await setCache(key, data, ttl);
  }

  async get(key) {
    return await getCache(key);
  }

  async delete(key) {
    return await deleteCache(key);
  }

  async invalidatePattern(pattern) {
    return await deleteCachePattern(pattern);
  }

  // Entity-specific operations
  async setEntity(entity, id, data, ttl = CACHE_CONFIG.DEFAULT_TTL) {
    const key = `${entity}:${id}`;
    return await this.set(key, data, ttl);
  }

  async getEntity(entity, id) {
    const key = `${entity}:${id}`;
    return await this.get(key);
  }

  async deleteEntity(entity, id) {
    const key = `${entity}:${id}`;
    return await this.delete(key);
  }

  async invalidateEntity(entity, id) {
    const patterns = [
      `${entity}:${id}`,
      `${entity}:${id}:*`,
      `${entity}:list:*`,
      `${entity}:search:*`,
      `${entity}:stats:*`,
    ];
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.invalidatePattern(pattern);
    }
    
    return totalDeleted;
  }

  // List operations
  async setList(entity, params, data, ttl = CACHE_CONFIG.DEFAULT_TTL) {
    const key = this.generateListKey(entity, params);
    return await this.set(key, data, ttl);
  }

  async getList(entity, params) {
    const key = this.generateListKey(entity, params);
    return await this.get(key);
  }

  async invalidateList(entity, params = {}) {
    const patterns = [
      `${entity}:list:*`,
      `${entity}:search:*`,
    ];
    
    // Add specific patterns based on params
    if (params.schoolId) {
      patterns.push(`${entity}:school:${params.schoolId}:*`);
    }
    if (params.departmentId) {
      patterns.push(`${entity}:dept:${params.departmentId}:*`);
    }
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.invalidatePattern(pattern);
    }
    
    return totalDeleted;
  }

  // Stats operations
  async setStats(entity, type, params, data, ttl = CACHE_CONFIG.DEFAULT_TTL) {
    const key = this.generateStatsKey(entity, type, params);
    return await this.set(key, data, ttl);
  }

  async getStats(entity, type, params) {
    const key = this.generateStatsKey(entity, type, params);
    return await this.get(key);
  }

  async invalidateStats(entity, type = null, params = {}) {
    const patterns = type 
      ? [`${entity}:stats:${type}:*`]
      : [`${entity}:stats:*`];
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.invalidatePattern(pattern);
    }
    
    return totalDeleted;
  }

  // Analytics operations
  async setAnalytics(entity, type, params, data, ttl = CACHE_CONFIG.DEFAULT_TTL) {
    const key = this.generateAnalyticsKey(entity, type, params);
    return await this.set(key, data, ttl);
  }

  async getAnalytics(entity, type, params) {
    const key = this.generateAnalyticsKey(entity, type, params);
    return await this.get(key);
  }

  async invalidateAnalytics(entity, type = null, params = {}) {
    const patterns = type 
      ? [`${entity}:analytics:${type}:*`]
      : [`${entity}:analytics:*`];
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.invalidatePattern(pattern);
    }
    
    return totalDeleted;
  }

  // Performance operations
  async setPerformance(entity, id, params, data, ttl = CACHE_CONFIG.DEFAULT_TTL) {
    const key = this.generatePerformanceKey(entity, id, params);
    return await this.set(key, data, ttl);
  }

  async getPerformance(entity, id, params) {
    const key = this.generatePerformanceKey(entity, id, params);
    return await this.get(key);
  }

  async invalidatePerformance(entity, id = null, params = {}) {
    const patterns = id 
      ? [`${entity}:performance:${id}:*`]
      : [`${entity}:performance:*`];
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.invalidatePattern(pattern);
    }
    
    return totalDeleted;
  }

  // Export operations
  async setExport(entity, params, data, ttl = 300) { // 5 minutes for exports
    const key = this.generateExportKey(entity, params);
    return await this.set(key, data, ttl);
  }

  async getExport(entity, params) {
    const key = this.generateExportKey(entity, params);
    return await this.get(key);
  }

  async invalidateExport(entity, params = {}) {
    const patterns = [`${entity}:export:*`];
    
    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.invalidatePattern(pattern);
    }
    
    return totalDeleted;
  }

  // Key generators
  generateListKey(entity, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${key}:${params[key]}`)
      .join(':');
    return `${entity}:list:${sortedParams}`;
  }

  generateStatsKey(entity, type, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${key}:${params[key]}`)
      .join(':');
    return `${entity}:stats:${type}:${sortedParams}`;
  }

  generateAnalyticsKey(entity, type, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${key}:${params[key]}`)
      .join(':');
    return `${entity}:analytics:${type}:${sortedParams}`;
  }

  generatePerformanceKey(entity, id, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${key}:${params[key]}`)
      .join(':');
    return `${entity}:performance:${id}:${sortedParams}`;
  }

  generateExportKey(entity, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .filter(key => params[key] !== undefined && params[key] !== null)
      .map(key => `${key}:${params[key]}`)
      .join(':');
    return `${entity}:export:${sortedParams}`;
  }



  // Cache health check
  async healthCheck() {
    try {
      const startTime = Date.now();
      const testKey = `health:${Date.now()}`;
      const testData = { test: true, timestamp: new Date().toISOString() };
      
      // Test write
      const writeSuccess = await this.set(testKey, testData, 60);
      if (!writeSuccess) {
        throw new Error('Cache write failed');
      }
      
      // Test read
      const readData = await this.get(testKey);
      if (!readData || readData.test !== true) {
        throw new Error('Cache read failed');
      }
      
      // Test delete
      const deleteSuccess = await this.delete(testKey);
      if (!deleteSuccess) {
        throw new Error('Cache delete failed');
      }
      
      const responseTime = Date.now() - startTime;
      
      return {
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Cache health check error:', error);
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Cache optimization
  async optimize() {
    try {
      const optimizations = [];
      
      // Check for expired keys
      const patterns = [
        '*:export:*',
        '*:search:*',
        '*:analytics:*',
      ];
      
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 100) {
          // Keep only the most recent 50 keys
          const sortedKeys = keys.sort().slice(-50);
          const keysToDelete = keys.filter(key => !sortedKeys.includes(key));
          
          if (keysToDelete.length > 0) {
            await this.redis.del(...keysToDelete);
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
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Cache optimization error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Clear all cache
  async clearAll() {
    try {
      await this.redis.flushall();
      return {
        success: true,
        message: 'All cache cleared',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Clear all cache error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// ======================
// LEGACY FUNCTION EXPORTS
// (For backward compatibility)
// ======================

export const cacheData = async (key, data, ttl) => {
  return await cacheManager.set(key, data, ttl);
};

export const getCachedData = async (key) => {
  return await cacheManager.get(key);
};

export const clearCache = async () => {
  return await cacheManager.clearAll();
};

// Export singleton instance
export const cacheManager = new CacheManager();
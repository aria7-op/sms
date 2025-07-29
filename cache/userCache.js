import Redis from 'ioredis';
import crypto from 'crypto';

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

// Cache TTL values (in seconds)
const TTL = {
  USER: 300, // 5 minutes
  USERS_LIST: 60, // 1 minute
  USER_STATS: 600, // 10 minutes
  USER_ANALYTICS: 1800, // 30 minutes
  USER_PERFORMANCE: 3600, // 1 hour
  USER_SEARCH: 120, // 2 minutes
  USER_EXPORT: 300, // 5 minutes
  USER_COUNT: 300, // 5 minutes
};

// ======================
// CACHE UTILITY FUNCTIONS
// ======================

/**
 * Generate cache key
 */
const generateCacheKey = (prefix, ...parts) => {
  const key = `${prefix}:${parts.join(':')}`;
  return crypto.createHash('md5').update(key).digest('hex');
};

/**
 * Check if cache entry is expired
 */
const isExpired = (key) => {
  const expiry = cacheTTL.get(key);
  return expiry && Date.now() > expiry;
};

/**
 * Set cache entry with TTL
 */
const setCacheEntry = async (key, data, ttl = TTL.USER) => {
  try {
    if (useRedis && redisClient) {
      await redisClient.setex(key, ttl, JSON.stringify(data));
    } else {
      memoryCache.set(key, data);
      cacheTTL.set(key, Date.now() + (ttl * 1000));
    }
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

/**
 * Get cache entry
 */
const getCacheEntry = async (key) => {
  try {
    if (useRedis && redisClient) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } else {
      if (isExpired(key)) {
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

/**
 * Delete cache entry
 */
const deleteCacheEntry = async (key) => {
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

/**
 * Clear cache by pattern
 */
const clearCacheByPattern = async (pattern) => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      // For memory cache, we need to iterate and check patterns
      for (const key of memoryCache.keys()) {
        if (key.includes(pattern.replace('*', ''))) {
          memoryCache.delete(key);
          cacheTTL.delete(key);
        }
      }
    }
    return true;
  } catch (error) {
    console.error('Cache clear pattern error:', error);
    return false;
  }
};

// ======================
// USER CACHE FUNCTIONS
// ======================

/**
 * Get user from cache
 */
export const getUserFromCache = async (userId) => {
  const key = generateCacheKey('user', userId);
  return await getCacheEntry(key);
};

/**
 * Set user in cache
 */
export const setUserInCache = async (userId, userData) => {
  const key = generateCacheKey('user', userId);
  return await setCacheEntry(key, userData, TTL.USER);
};

/**
 * Get users list from cache
 */
export const getUsersFromCache = async (filters) => {
  const key = generateCacheKey('users', 'list', JSON.stringify(filters));
  return await getCacheEntry(key);
};

/**
 * Set users list in cache
 */
export const setUsersInCache = async (filters, usersData) => {
  const key = generateCacheKey('users', 'list', JSON.stringify(filters));
  return await setCacheEntry(key, usersData, TTL.USERS_LIST);
};

/**
 * Get user count from cache
 */
export const getUserCountFromCache = async (filters) => {
  const key = generateCacheKey('users', 'count', JSON.stringify(filters));
  return await getCacheEntry(key);
};

/**
 * Set user count in cache
 */
export const setUserCountInCache = async (filters, count) => {
  const key = generateCacheKey('users', 'count', JSON.stringify(filters));
  return await setCacheEntry(key, count, TTL.USER_COUNT);
};

/**
 * Get user stats from cache
 */
export const getUserStatsFromCache = async (userId) => {
  const key = generateCacheKey('user', 'stats', userId);
  return await getCacheEntry(key);
};

/**
 * Set user stats in cache
 */
export const setUserStatsInCache = async (userId, stats) => {
  const key = generateCacheKey('user', 'stats', userId);
  return await setCacheEntry(key, stats, TTL.USER_STATS);
};

/**
 * Get user analytics from cache
 */
export const getUserAnalyticsFromCache = async (userId, period) => {
  const key = generateCacheKey('user', 'analytics', userId, period);
  return await getCacheEntry(key);
};

/**
 * Set user analytics in cache
 */
export const setUserAnalyticsInCache = async (userId, period, analytics) => {
  const key = generateCacheKey('user', 'analytics', userId, period);
  return await setCacheEntry(key, analytics, TTL.USER_ANALYTICS);
};

/**
 * Get user performance from cache
 */
export const getUserPerformanceFromCache = async (userId) => {
  const key = generateCacheKey('user', 'performance', userId);
  return await getCacheEntry(key);
};

/**
 * Set user performance in cache
 */
export const setUserPerformanceInCache = async (userId, performance) => {
  const key = generateCacheKey('user', 'performance', userId);
  return await setCacheEntry(key, performance, TTL.USER_PERFORMANCE);
};

/**
 * Get user search results from cache
 */
export const getUserSearchFromCache = async (searchParams) => {
  const key = generateCacheKey('users', 'search', JSON.stringify(searchParams));
  return await getCacheEntry(key);
};

/**
 * Set user search results in cache
 */
export const setUserSearchFromCache = async (searchParams, results) => {
  const key = generateCacheKey('users', 'search', JSON.stringify(searchParams));
  return await setCacheEntry(key, results, TTL.USER_SEARCH);
};

/**
 * Get user export data from cache
 */
export const getUserExportFromCache = async (filters, format) => {
  const key = generateCacheKey('users', 'export', JSON.stringify(filters), format);
  return await getCacheEntry(key);
};

/**
 * Set user export data in cache
 */
export const setUserExportFromCache = async (filters, format, data) => {
  const key = generateCacheKey('users', 'export', JSON.stringify(filters), format);
  return await setCacheEntry(key, data, TTL.USER_EXPORT);
};

// ======================
// CACHE INVALIDATION FUNCTIONS
// ======================

/**
 * Invalidate user cache on create
 */
export const invalidateUserCacheOnCreate = async (ownerId) => {
  try {
    // Clear user lists for this owner
    await clearCacheByPattern(`*users*list*`);
    await clearCacheByPattern(`*users*count*`);
    await clearCacheByPattern(`*users*search*`);
    await clearCacheByPattern(`*users*export*`);
    
    // Clear role and status counts
    await clearCacheByPattern(`*users*counts*`);
    
    console.log(`User cache invalidated for owner: ${ownerId}`);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on create:', error);
    return false;
  }
};

/**
 * Invalidate user cache on update
 */
export const invalidateUserCacheOnUpdate = async (userId, ownerId) => {
  try {
    // Clear specific user cache
    const userKey = generateCacheKey('user', userId);
    await deleteCacheEntry(userKey);
    
    // Clear user stats and analytics
    await clearCacheByPattern(`*user*stats*${userId}*`);
    await clearCacheByPattern(`*user*analytics*${userId}*`);
    await clearCacheByPattern(`*user*performance*${userId}*`);
    
    // Clear user lists that might include this user
    await clearCacheByPattern(`*users*list*`);
    await clearCacheByPattern(`*users*search*`);
    await clearCacheByPattern(`*users*export*`);
    
    console.log(`User cache invalidated for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on update:', error);
    return false;
  }
};

/**
 * Invalidate user cache on delete
 */
export const invalidateUserCacheOnDelete = async (userId, ownerId) => {
  try {
    // Clear specific user cache
    const userKey = generateCacheKey('user', userId);
    await deleteCacheEntry(userKey);
    
    // Clear user stats and analytics
    await clearCacheByPattern(`*user*stats*${userId}*`);
    await clearCacheByPattern(`*user*analytics*${userId}*`);
    await clearCacheByPattern(`*user*performance*${userId}*`);
    
    // Clear user lists that might include this user
    await clearCacheByPattern(`*users*list*`);
    await clearCacheByPattern(`*users*count*`);
    await clearCacheByPattern(`*users*search*`);
    await clearCacheByPattern(`*users*export*`);
    
    // Clear role and status counts
    await clearCacheByPattern(`*users*counts*`);
    
    console.log(`User cache invalidated for deleted user: ${userId}`);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on delete:', error);
    return false;
  }
};

/**
 * Invalidate user cache on bulk operation
 */
export const invalidateUserCacheOnBulkOperation = async (ownerIds) => {
  try {
    // Clear all user-related cache
    await clearCacheByPattern(`*user*`);
    await clearCacheByPattern(`*users*`);
    
    console.log(`User cache invalidated for bulk operation affecting owners: ${ownerIds.join(', ')}`);
    return true;
  } catch (error) {
    console.error('Cache invalidation error on bulk operation:', error);
    return false;
  }
};

// ======================
// CACHE MANAGEMENT FUNCTIONS
// ======================

/**
 * Get cache statistics
 */
export const getCacheStats = async () => {
  try {
    if (useRedis && redisClient) {
      const info = await redisClient.info();
      const keys = await redisClient.dbsize();
      
      return {
        type: 'redis',
        keys,
        info: info.split('\r\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) acc[key] = value;
          return acc;
        }, {}),
        connected: true
      };
    } else {
      return {
        type: 'memory',
        keys: memoryCache.size,
        ttlEntries: cacheTTL.size,
        connected: false
      };
    }
  } catch (error) {
    console.error('Cache stats error:', error);
    return {
      type: 'memory',
      keys: memoryCache.size,
      ttlEntries: cacheTTL.size,
      connected: false,
      error: error.message
    };
  }
};

/**
 * Clear all user cache
 */
export const clearAllUserCache = async () => {
  try {
    if (useRedis && redisClient) {
      const keys = await redisClient.keys('*user*');
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      memoryCache.clear();
      cacheTTL.clear();
    }
    
    console.log('All user cache cleared');
    return true;
  } catch (error) {
    console.error('Clear all cache error:', error);
    return false;
  }
};

/**
 * Clear expired cache entries (memory only)
 */
export const clearExpiredCache = () => {
  if (!useRedis) {
    const now = Date.now();
    for (const [key, expiry] of cacheTTL.entries()) {
      if (now > expiry) {
        memoryCache.delete(key);
        cacheTTL.delete(key);
      }
    }
  }
};

// ======================
// CACHE HEALTH CHECK
// ======================

/**
 * Check cache health
 */
export const checkCacheHealth = async () => {
  try {
    if (useRedis && redisClient) {
      const ping = await redisClient.ping();
      return {
        status: 'healthy',
        type: 'redis',
        ping: ping === 'PONG',
        connected: true
      };
    } else {
      return {
        status: 'healthy',
        type: 'memory',
        ping: true,
        connected: false
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      type: useRedis ? 'redis' : 'memory',
      ping: false,
      connected: false,
      error: error.message
    };
  }
};

// ======================
// CACHE INITIALIZATION
// ======================

// Clear expired entries every 5 minutes (memory cache only)
if (!useRedis) {
  setInterval(clearExpiredCache, 5 * 60 * 1000);
}

// Export cache configuration
export const cacheConfig = {
  useRedis,
  TTL,
  redisClient: useRedis ? redisClient : null
}; 
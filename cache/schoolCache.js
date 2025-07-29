    import NodeCache from 'node-cache';

// ======================
// CACHE CONFIGURATION
// ======================

const cacheConfig = {
  stdTTL: 300, // 5 minutes default TTL
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false, // Don't clone objects for better performance
  deleteOnExpire: true, // Automatically delete expired keys
};

// Create cache instances for different data types
const schoolCache = new NodeCache(cacheConfig);
const schoolStatsCache = new NodeCache({ ...cacheConfig, stdTTL: 1800 }); // 30 minutes for stats
const schoolAnalyticsCache = new NodeCache({ ...cacheConfig, stdTTL: 3600 }); // 1 hour for analytics
const schoolSearchCache = new NodeCache({ ...cacheConfig, stdTTL: 900 }); // 15 minutes for search

// ======================
// CACHE KEYS
// ======================

const CACHE_KEYS = {
  SCHOOL: 'school',
  SCHOOLS: 'schools',
  SCHOOL_STATS: 'school_stats',
  SCHOOL_ANALYTICS: 'school_analytics',
  SCHOOL_SEARCH: 'school_search',
  SCHOOL_PERFORMANCE: 'school_performance',
  SCHOOL_EXPORT: 'school_export',
  SCHOOL_COUNT: 'school_count',
  SCHOOL_BY_OWNER: 'school_by_owner',
  SCHOOL_BY_STATUS: 'school_by_status',
  SCHOOL_BY_LOCATION: 'school_by_location',
};

// ======================
// CACHE UTILITIES
// ======================

/**
 * Generate cache key with prefix
 */
function generateCacheKey(prefix, ...parts) {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * Generate search cache key
 */
function generateSearchCacheKey(filters) {
  const searchString = JSON.stringify(filters);
  const hash = require('crypto').createHash('md5').update(searchString).digest('hex');
  return generateCacheKey(CACHE_KEYS.SCHOOL_SEARCH, hash);
}

/**
 * Clear all school-related cache
 */
export function clearSchoolCache() {
  schoolCache.flushAll();
  schoolStatsCache.flushAll();
  schoolAnalyticsCache.flushAll();
  schoolSearchCache.flushAll();
}

/**
 * Clear cache for specific school
 */
export function clearSchoolCacheById(schoolId) {
  const patterns = [
    generateCacheKey(CACHE_KEYS.SCHOOL, schoolId),
    generateCacheKey(CACHE_KEYS.SCHOOL_STATS, schoolId),
    generateCacheKey(CACHE_KEYS.SCHOOL_ANALYTICS, schoolId),
    generateCacheKey(CACHE_KEYS.SCHOOL_PERFORMANCE, schoolId),
  ];
  
  patterns.forEach(pattern => {
    schoolCache.del(pattern);
    schoolStatsCache.del(pattern);
    schoolAnalyticsCache.del(pattern);
  });
}

/**
 * Clear cache for school owner
 */
export function clearSchoolCacheByOwner(ownerId) {
  const patterns = [
    generateCacheKey(CACHE_KEYS.SCHOOL_BY_OWNER, ownerId),
    generateCacheKey(CACHE_KEYS.SCHOOLS),
  ];
  
  patterns.forEach(pattern => {
    schoolCache.del(pattern);
  });
}

// ======================
// SCHOOL CACHE METHODS
// ======================

/**
 * Get school from cache
 */
export function getSchoolFromCache(schoolId) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL, schoolId);
  return schoolCache.get(key);
}

/**
 * Set school in cache
 */
export function setSchoolInCache(schoolId, schoolData, ttl = 300) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL, schoolId);
  schoolCache.set(key, schoolData, ttl);
}

/**
 * Get schools list from cache
 */
export function getSchoolsFromCache(filters = {}) {
  const key = generateSearchCacheKey(filters);
  return schoolCache.get(key);
}

/**
 * Set schools list in cache
 */
export function setSchoolsInCache(filters, schoolsData, ttl = 300) {
  const key = generateSearchCacheKey(filters);
  schoolCache.set(key, schoolsData, ttl);
}

/**
 * Get school count from cache
 */
export function getSchoolCountFromCache(filters = {}) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_COUNT, JSON.stringify(filters));
  return schoolCache.get(key);
}

/**
 * Set school count in cache
 */
export function setSchoolCountInCache(filters, count, ttl = 300) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_COUNT, JSON.stringify(filters));
  schoolCache.set(key, count, ttl);
}

// ======================
// SCHOOL STATS CACHE
// ======================

/**
 * Get school stats from cache
 */
export function getSchoolStatsFromCache(schoolId) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_STATS, schoolId);
  return schoolStatsCache.get(key);
}

/**
 * Set school stats in cache
 */
export function setSchoolStatsInCache(schoolId, statsData, ttl = 1800) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_STATS, schoolId);
  schoolStatsCache.set(key, statsData, ttl);
}

/**
 * Get school performance from cache
 */
export function getSchoolPerformanceFromCache(schoolId) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_PERFORMANCE, schoolId);
  return schoolStatsCache.get(key);
}

/**
 * Set school performance in cache
 */
export function setSchoolPerformanceInCache(schoolId, performanceData, ttl = 1800) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_PERFORMANCE, schoolId);
  schoolStatsCache.set(key, performanceData, ttl);
}

/**
 * Clear school performance cache
 */
export function clearSchoolPerformanceCache(schoolId = null) {
  if (schoolId) {
    const key = generateCacheKey(CACHE_KEYS.SCHOOL_PERFORMANCE, schoolId);
    schoolStatsCache.del(key);
  } else {
    // Clear all performance cache
    const keys = schoolStatsCache.keys();
    keys.forEach(key => {
      if (key.includes(CACHE_KEYS.SCHOOL_PERFORMANCE)) {
        schoolStatsCache.del(key);
      }
    });
  }
}

// ======================
// SCHOOL ANALYTICS CACHE
// ======================

/**
 * Get school analytics from cache
 */
export function getSchoolAnalyticsFromCache(schoolId, period = '30d') {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_ANALYTICS, schoolId, period);
  return schoolAnalyticsCache.get(key);
}

/**
 * Set school analytics in cache
 */
export function setSchoolAnalyticsInCache(schoolId, period, analyticsData, ttl = 3600) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_ANALYTICS, schoolId, period);
  schoolAnalyticsCache.set(key, analyticsData, ttl);
}

// ======================
// SCHOOL SEARCH CACHE
// ======================

/**
 * Get school search results from cache
 */
export function getSchoolSearchFromCache(searchParams) {
  const key = generateSearchCacheKey(searchParams);
  return schoolSearchCache.get(key);
}

/**
 * Set school search results in cache
 */
export function setSchoolSearchInCache(searchParams, searchResults, ttl = 900) {
  const key = generateSearchCacheKey(searchParams);
  schoolSearchCache.set(key, searchResults, ttl);
}

// ======================
// SCHOOL EXPORT CACHE
// ======================

/**
 * Get school export data from cache
 */
export function getSchoolExportFromCache(filters, format = 'json') {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_EXPORT, JSON.stringify(filters), format);
  return schoolCache.get(key);
}

/**
 * Set school export data in cache
 */
export function setSchoolExportInCache(filters, format, exportData, ttl = 1800) {
  const key = generateCacheKey(CACHE_KEYS.SCHOOL_EXPORT, JSON.stringify(filters), format);
  schoolCache.set(key, exportData, ttl);
}

// ======================
// CACHE INVALIDATION
// ======================

/**
 * Invalidate school cache on create
 */
export function invalidateSchoolCacheOnCreate(ownerId) {
  clearSchoolCacheByOwner(ownerId);
  schoolCache.del(generateCacheKey(CACHE_KEYS.SCHOOLS));
  schoolCache.del(generateCacheKey(CACHE_KEYS.SCHOOL_COUNT));
}

/**
 * Invalidate school cache on update
 */
export function invalidateSchoolCacheOnUpdate(schoolId, ownerId) {
  clearSchoolCacheById(schoolId);
  clearSchoolCacheByOwner(ownerId);
  schoolCache.del(generateCacheKey(CACHE_KEYS.SCHOOLS));
  schoolCache.del(generateCacheKey(CACHE_KEYS.SCHOOL_COUNT));
}

/**
 * Invalidate school cache on delete
 */
export function invalidateSchoolCacheOnDelete(schoolId, ownerId) {
  clearSchoolCacheById(schoolId);
  clearSchoolCacheByOwner(ownerId);
  schoolCache.del(generateCacheKey(CACHE_KEYS.SCHOOLS));
  schoolCache.del(generateCacheKey(CACHE_KEYS.SCHOOL_COUNT));
}

/**
 * Invalidate school cache on bulk operations
 */
export function invalidateSchoolCacheOnBulkOperation(ownerIds = []) {
  clearSchoolCache();
  ownerIds.forEach(ownerId => clearSchoolCacheByOwner(ownerId));
}

// ======================
// CACHE STATISTICS
// ======================

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    schoolCache: {
      keys: schoolCache.keys().length,
      hits: schoolCache.getStats().hits,
      misses: schoolCache.getStats().misses,
      hitRate: schoolCache.getStats().hits / (schoolCache.getStats().hits + schoolCache.getStats().misses) * 100,
    },
    schoolStatsCache: {
      keys: schoolStatsCache.keys().length,
      hits: schoolStatsCache.getStats().hits,
      misses: schoolStatsCache.getStats().misses,
      hitRate: schoolStatsCache.getStats().hits / (schoolStatsCache.getStats().hits + schoolStatsCache.getStats().misses) * 100,
    },
    schoolAnalyticsCache: {
      keys: schoolAnalyticsCache.keys().length,
      hits: schoolAnalyticsCache.getStats().hits,
      misses: schoolAnalyticsCache.getStats().misses,
      hitRate: schoolAnalyticsCache.getStats().hits / (schoolAnalyticsCache.getStats().hits + schoolAnalyticsCache.getStats().misses) * 100,
    },
    schoolSearchCache: {
      keys: schoolSearchCache.keys().length,
      hits: schoolSearchCache.getStats().hits,
      misses: schoolSearchCache.getStats().misses,
      hitRate: schoolSearchCache.getStats().hits / (schoolSearchCache.getStats().hits + schoolSearchCache.getStats().misses) * 100,
    },
  };
}

/**
 * Clear cache statistics
 */
export function clearCacheStats() {
  schoolCache.flushStats();
  schoolStatsCache.flushStats();
  schoolAnalyticsCache.flushStats();
  schoolSearchCache.flushStats();
}

// ======================
// CACHE MIDDLEWARE
// ======================

/**
 * Cache middleware for school endpoints
 */
export function schoolCacheMiddleware(ttl = 300) {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode === 200) {
        const cacheKey = generateCacheKey(CACHE_KEYS.SCHOOLS, req.originalUrl);
        schoolCache.set(cacheKey, data, ttl);
      }
      originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * Cache middleware for school stats endpoints
 */
export function schoolStatsCacheMiddleware(ttl = 1800) {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      if (res.statusCode === 200) {
        const schoolId = req.params.schoolId;
        const cacheKey = generateCacheKey(CACHE_KEYS.SCHOOL_STATS, schoolId);
        schoolStatsCache.set(cacheKey, data, ttl);
      }
      originalSend.call(this, data);
    };
    
    next();
  };
}

// ======================
// CACHE WARMING
// ======================

/**
 * Warm up cache with frequently accessed data
 */
export async function warmSchoolCache(prisma) {
  try {
    // Warm up school count
    const totalSchools = await prisma.school.count({ where: { deletedAt: null } });
    setSchoolCountInCache({}, totalSchools, 3600);
    
    // Warm up active schools
    const activeSchools = await prisma.school.count({ 
      where: { 
        deletedAt: null,
        status: 'ACTIVE'
      } 
    });
    setSchoolCountInCache({ status: 'ACTIVE' }, activeSchools, 3600);
    
    console.log('School cache warmed up successfully');
  } catch (error) {
    console.error('Error warming up school cache:', error);
  }
}

/**
 * Warm up cache for specific school
 */
export async function warmSchoolSpecificCache(schoolId, prisma) {
  try {
    // Get school data
    const school = await prisma.school.findUnique({
      where: { id: BigInt(schoolId) },
      include: {
        owner: true,
        academicSessions: {
          take: 5,
          orderBy: { startDate: 'desc' }
        },
        terms: {
          take: 5,
          orderBy: { startDate: 'desc' }
        },
      }
    });
    
    if (school) {
      setSchoolInCache(schoolId, school, 1800);
    }
    
    console.log(`School ${schoolId} cache warmed up successfully`);
  } catch (error) {
    console.error(`Error warming up school ${schoolId} cache:`, error);
  }
}

// ======================
// CACHE MONITORING
// ======================

/**
 * Monitor cache performance
 */
export function monitorCachePerformance() {
  const stats = getCacheStats();
  
  // Log cache performance metrics
  console.log('Cache Performance Metrics:', {
    timestamp: new Date().toISOString(),
    ...stats,
  });
  
  // Alert if hit rate is too low
  Object.entries(stats).forEach(([cacheName, cacheStats]) => {
    if (cacheStats.hitRate < 50) {
      console.warn(`Low cache hit rate for ${cacheName}: ${cacheStats.hitRate.toFixed(2)}%`);
    }
  });
}

// Set up periodic cache monitoring
setInterval(monitorCachePerformance, 300000); // Every 5 minutes

export default {
  // Cache methods
  getSchoolFromCache,
  setSchoolInCache,
  getSchoolsFromCache,
  setSchoolsInCache,
  getSchoolCountFromCache,
  setSchoolCountInCache,
  
  // Stats cache methods
  getSchoolStatsFromCache,
  setSchoolStatsInCache,
  getSchoolPerformanceFromCache,
  setSchoolPerformanceInCache,
  
  // Analytics cache methods
  getSchoolAnalyticsFromCache,
  setSchoolAnalyticsInCache,
  
  // Search cache methods
  getSchoolSearchFromCache,
  setSchoolSearchInCache,
  
  // Export cache methods
  getSchoolExportFromCache,
  setSchoolExportInCache,
  
  // Cache invalidation
  clearSchoolCache,
  clearSchoolCacheById,
  clearSchoolCacheByOwner,
  invalidateSchoolCacheOnCreate,
  invalidateSchoolCacheOnUpdate,
  invalidateSchoolCacheOnDelete,
  invalidateSchoolCacheOnBulkOperation,
  
  // Cache statistics
  getCacheStats,
  clearCacheStats,
  
  // Cache middleware
  schoolCacheMiddleware,
  schoolStatsCacheMiddleware,
  
  // Cache warming
  warmSchoolCache,
  warmSchoolSpecificCache,
  
  // Cache monitoring
  monitorCachePerformance,
}; 
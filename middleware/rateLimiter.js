import rateLimit from 'express-rate-limit';

// ======================
// GENERAL RATE LIMITERS
// ======================

/**
 * General API rate limiter
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});

/**
 * Strict API rate limiter for sensitive endpoints
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests, please try again later'
});

// ======================
// AUTH-SPECIFIC LIMITERS
// ======================

/**
 * Login attempt rate limiter
 */
export const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 login attempts per hour
  message: 'Too many login attempts from this IP, please try again after an hour',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Password reset request limiter
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 password reset requests per hour
  message: 'Too many password reset requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// ======================
// INVENTORY-SPECIFIC LIMITERS
// ======================

/**
 * Inventory creation rate limiter
 */
export const inventoryCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each user to 50 inventory creations per hour
  message: 'Too many inventory creation requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * Inventory update rate limiter
 */
export const inventoryUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each user to 100 updates per 15 minutes
  message: 'Too many inventory update requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

// ======================
// SUPPLIER-SPECIFIC LIMITERS
// ======================

/**
 * Supplier creation rate limiter
 */
export const supplierCreateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20, // limit each user to 20 supplier creations per day
  message: 'Too many supplier creation requests, please try again tomorrow',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * Supplier update rate limiter
 */
export const supplierUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // limit each user to 30 supplier updates per hour
  message: 'Too many supplier update requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * Supplier search rate limiter
 */
export const supplierSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 search requests per minute
  message: 'Too many supplier search requests, please try again in a minute',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

/**
 * General rate limiter for class operations
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Too many requests from this IP, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '15 minutes'
    }
  },
  standardHeaders: true, // Enable `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user ? `user:${req.user.id}` : req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});
// ======================
// CLASS-SPECIFIC RATE LIMITERS
// ======================

/**
 * Class creation rate limiter
 */
export const classCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each user to 20 class creations per hour
  message: {
    success: false,
    error: 'Too many class creation requests',
    message: 'Too many class creation requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 hour'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.user?.role === 'admin' // Skip for admins
});

/**
 * Class bulk operations rate limiter
 */
export const classBulkLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each user to 10 bulk operations per 5 minutes
  message: {
    success: false,
    error: 'Too many bulk operation requests',
    message: 'Too many bulk operation requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '5 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.user?.role === 'admin'
});

/**
 * Class analytics rate limiter
 */
export const classAnalyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // limit each user to 20 analytics requests per 5 minutes
  message: {
    success: false,
    error: 'Too many analytics requests',
    message: 'Too many analytics requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '5 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  skip: (req) => req.user?.role === 'admin'
});

// ======================
// CLASS SEARCH LIMITER
// ======================

/**
 * Class search rate limiter
 */
export const classSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 search requests per minute
  message: {
    success: false,
    error: 'Too many search requests',
    message: 'Too many search requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});

// ======================
// EXPORT ALL LIMITERS
// ======================

export default {
  // General limiters
  apiLimiter,
  strictLimiter,
  
  // Auth limiters
  loginLimiter,
  passwordResetLimiter,
  
  // Inventory limiters
  inventoryCreateLimiter,
  inventoryUpdateLimiter,
  
  // Supplier limiters
  supplierCreateLimiter,
  supplierUpdateLimiter,
  supplierSearchLimiter,
  classAnalyticsLimiter,
  classBulkLimiter,
  classSearchLimiter,
  rateLimiter
};
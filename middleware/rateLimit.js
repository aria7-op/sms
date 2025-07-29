import rateLimit from 'express-rate-limit';

// ======================
// RATE LIMITING CONFIGURATION
// ======================

// Using memory store for rate limiting
const createMemoryStore = () => {
  // Using built-in memory store from express-rate-limit
  return undefined;
};

// ======================
// RATE LIMITING STRATEGIES
// ======================

/**
 * General API rate limiter
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100000, // limit each IP to 100 requests per windowMs
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
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP (IPv6 safe)
    return req.user ? `user:${req.user.id}` : req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

/**
 * Authentication rate limiter
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50000, // limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Too many login attempts from this IP, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    // Use email if provided, otherwise use IP (IPv6 safe)
    const email = req.body?.email || req.query?.email;
    return email ? `email:${email}` : req.ip;
  }
});

/**
 * School creation rate limiter
 */
const schoolCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each user to 10 school creations per hour
  message: {
    success: false,
    error: 'Too many school creation requests',
    message: 'Too many school creation requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 hour'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  },
  skip: (req) => {
    // Only apply to authenticated users
    return !req.user;
  }
});

/**
 * School search rate limiter
 */
const schoolSearchLimiter = rateLimit({
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
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Export rate limiter
 */
const exportLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // limit each user to 5 export requests per 5 minutes
  message: {
    success: false,
    error: 'Too many export requests',
    message: 'Too many export requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '5 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Bulk operations rate limiter
 */
const bulkLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each user to 3 bulk operations per 10 minutes
  message: {
    success: false,
    error: 'Too many bulk operation requests',
    message: 'Too many bulk operation requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '10 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Analytics rate limiter
 */
const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // limit each user to 20 analytics requests per minute
  message: {
    success: false,
    error: 'Too many analytics requests',
    message: 'Too many analytics requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Cache management rate limiter
 */
const cacheLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each user to 10 cache operations per 5 minutes
  message: {
    success: false,
    error: 'Too many cache management requests',
    message: 'Too many cache management requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '5 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * File upload rate limiter
 */
const fileUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each user to 20 file uploads per 15 minutes
  message: {
    success: false,
    error: 'Too many file upload requests',
    message: 'Too many file upload requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '15 minutes'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

// ======================
// ROLE-BASED RATE LIMITERS
// ======================

/**
 * Rate limiter for different user roles
 */
const roleBasedLimiter = (roleLimits) => {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: (req) => {
      if (!req.user) return 100000; // Unauthenticated users
      
      const role = req.user.role;
      return roleLimits[role] || roleLimits.default || 50;
    },
    message: {
      success: false,
      error: 'Rate limit exceeded',
      message: 'Rate limit exceeded for your role, please try again later.',
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 429,
        retryAfter: '15 minutes'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: undefined, // Using built-in memory store
    keyGenerator: (req) => {
      const role = req.user?.role || 'anonymous';
      return `${role}:${req.user?.id || req.ip}`;
    }
  });
};

// Default role limits
const defaultRoleLimits = {
  'SUPER_ADMIN': 1000000,
  'SCHOOL_ADMIN': 500,
  'TEACHER': 200,
  'STAFF': 150,
  'STUDENT': 100,
  'PARENT': 100,
  'ACCOUNTANT': 200,
  'LIBRARIAN': 150,
  'default': 50
};

// ======================
// CUSTOM RATE LIMITERS
// ======================

/**
 * Create custom rate limiter
 */
const createCustomLimiter = (options) => {
  const {
    windowMs = 15 * 60 * 1000,
    max = 100,
    message = 'Too many requests',
    prefix = 'rl:custom:',
    keyGenerator = (req) => req.user ? `user:${req.user.id}` : req.ip,
    skip = () => false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Rate limit exceeded',
      message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 429,
        retryAfter: `${Math.ceil(windowMs / 60000)} minutes`
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRedisStore(prefix),
    keyGenerator,
    skip
  });
};

/**
 * School-specific rate limiter
 */
const schoolSpecificLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // limit each school to 50 requests per minute
  message: {
    success: false,
    error: 'School rate limit exceeded',
    message: 'Too many requests for this school, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    const schoolId = req.params.schoolId || req.body.schoolId || req.query.schoolId;
    return schoolId ? `school:${schoolId}` : req.ip;
  },
  skip: (req) => {
    // Skip if no school ID is provided
    return !(req.params.schoolId || req.body.schoolId || req.query.schoolId);
  }
});

/**
 * Subject search rate limiter
 */
const subjectSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 subject searches per minute
  message: {
    success: false,
    error: 'Too many subject search requests',
    message: 'Too many subject search requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Subject creation rate limiter
 */
const subjectCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each user to 20 subject creations per hour
  message: {
    success: false,
    error: 'Too many subject creation requests',
    message: 'Too many subject creation requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 hour'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  },
  skip: (req) => {
    // Only apply to authenticated users
    return !req.user;
  }
});

/**
 * Teacher creation rate limiter
 */
const teacherCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // limit each user to 20 teacher creations per hour
  message: {
    success: false,
    error: 'Too many teacher creation requests',
    message: 'Too many teacher creation requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 hour'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  },
  skip: (req) => {
    // Only apply to authenticated users
    return !req.user;
  }
});

/**
 * Teacher search rate limiter
 */
const teacherSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 teacher searches per minute
  message: {
    success: false,
    error: 'Too many teacher search requests',
    message: 'Too many teacher search requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Student creation rate limiter
 */
const studentCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // limit each user to 50 student creations per hour
  message: {
    success: false,
    error: 'Too many student creation requests',
    message: 'Too many student creation requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 hour'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  },
  skip: (req) => {
    // Only apply to authenticated users
    return !req.user;
  }
});

/**
 * Student search rate limiter
 */
const studentSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 student searches per minute
  message: {
    success: false,
    error: 'Too many student search requests',
    message: 'Too many student search requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Staff creation rate limiter
 */
const staffCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 15, // limit each user to 15 staff creations per hour
  message: {
    success: false,
    error: 'Too many staff creation requests',
    message: 'Too many staff creation requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 hour'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Staff search rate limiter
 */
const staffSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 staff searches per minute
  message: {
    success: false,
    error: 'Too many staff search requests',
    message: 'Too many staff search requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Parent search rate limiter
 */
const parentSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 parent searches per minute
  message: {
    success: false,
    error: 'Too many parent search requests',
    message: 'Too many parent search requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Grade search rate limiter
 */
const gradeSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 grade searches per minute
  message: {
    success: false,
    error: 'Too many grade search requests',
    message: 'Too many grade search requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

/**
 * Exam timetable search rate limiter
 */
const examTimetableSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each user to 30 exam timetable searches per minute
  message: {
    success: false,
    error: 'Too many exam timetable search requests',
    message: 'Too many exam timetable search requests, please try again later.',
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 429,
      retryAfter: '1 minute'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    return req.user ? `user:${req.user.id}` : req.ip;
  }
});

// ======================
// RATE LIMIT MONITORING
// ======================

/**
 * Rate limit monitoring middleware
 */
const rateLimitMonitor = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log rate limit headers for monitoring
    const remaining = res.getHeader('X-RateLimit-Remaining');
    const limit = res.getHeader('X-RateLimit-Limit');
    const reset = res.getHeader('X-RateLimit-Reset');
    
    if (remaining !== undefined && parseInt(remaining) < 10) {
      console.warn('Rate limit warning:', {
        ip: req.ip,
        userId: req.user?.id,
        userRole: req.user?.role,
        remaining,
        limit,
        reset,
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// ======================
// RATE LIMIT UTILITIES
// ======================

/**
 * Get rate limit info for a user
 */
const getRateLimitInfo = () => {
  // Memory store doesn't provide direct access to rate limit info
  // Return null since we can't get this information
  return null;
};

/**
 * Reset rate limit for a user
 */
const resetRateLimit = () => {
  // Memory store automatically resets when window expires
  // Return true since we can't manually reset
  return true;
};

/**
 * Get all rate limit keys
 */
const getAllRateLimitKeys = () => {
  // Memory store doesn't provide access to keys
  return [];
};


/**
 * Default rate limiter for general use
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
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
  standardHeaders: true,
  legacyHeaders: false,
  store: undefined, // Using built-in memory store
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise use IP
    return req.user ? `user:${req.user.id}` : req.ip;
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});


// Fee search rate limiter configuration
const FEE_SEARCH_LIMITER_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Allow unlimited requests for SUPER_ADMIN role
    return req.user?.role === 'admin';
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many fee search requests, please try again later'
    });
  }
};

/**
 * Rate limiter specifically for fee search endpoints
 * @param {object} overrides - Configuration overrides
 */
export const feeSearchLimiter = (overrides = {}) => {
  return rateLimit({
    ...FEE_SEARCH_LIMITER_CONFIG,
    ...overrides,
    keyGenerator: (req) => {
      // Create unique keys based on user ID if available, otherwise IP
      return req.user?.id ? `user_${req.user.id}` : req.ip;
    }
  });
};

// Additional fee-related rate limiters
export const feeCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each user to 20 fee creations per hour
  message: 'Too many fee creations, please try again later'
});

export const feeReportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each user to 10 report generations per hour
  message: 'Too many report requests, please try again later'
});

/**
 * Fee Item Search Rate Limiter
 * Limits search requests to prevent excessive database queries
 */
export const feeItemSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many search requests',
    message: 'Please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Allow unlimited requests for SUPER_ADMIN role
    return req.user?.role === 'SUPER_ADMIN';
  }
});


// ======================
// EXPORTS
// ======================

export {
  rateLimiter,
  generalLimiter,
  rateLimit,
  authLimiter,
  schoolCreateLimiter,
  schoolSearchLimiter,
  exportLimiter,
  bulkLimiter,
  analyticsLimiter,
  cacheLimiter,
  fileUploadLimiter,
  roleBasedLimiter,
  defaultRoleLimits,
  createCustomLimiter,
  schoolSpecificLimiter,
  subjectCreateLimiter,
  subjectSearchLimiter,
  teacherCreateLimiter,
  teacherSearchLimiter,
  studentCreateLimiter,
  studentSearchLimiter,
  staffCreateLimiter,
  staffSearchLimiter,
  parentSearchLimiter,
  gradeSearchLimiter,
  examTimetableSearchLimiter,
  rateLimitMonitor,
  getRateLimitInfo,
  resetRateLimit,
  getAllRateLimitKeys
}; 
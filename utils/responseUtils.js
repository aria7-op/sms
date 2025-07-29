import { PrismaClient } from '../generated/prisma/client.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// ======================
// SUCCESS RESPONSE UTILITIES
// ======================

/**
 * Create a standardized success response
 */
export const createSuccessResponse = (res, statusCode = 200, message = 'Success', data = null, meta = {}) => {
  const response = {
    success: true,
    message,
    data: convertBigIntToString(data),
    meta: {
      timestamp: new Date().toISOString(),
      statusCode,
      ...convertBigIntToString(meta)
    }
  };

  return res.status(statusCode).json(response);
};

/**
 * Create a paginated response
 */
export const createPaginatedResponse = (res, data, pagination, message = 'Data retrieved successfully') => {
  return createSuccessResponse(res, 200, message, data, {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      pages: pagination.pages,
      hasNext: pagination.page < pagination.pages,
      hasPrev: pagination.page > 1
    }
  });
};

/**
 * Create a list response
 */
export const createListResponse = (res, data, message = 'List retrieved successfully') => {
  return createSuccessResponse(res, 200, message, data, {
    count: Array.isArray(data) ? data.length : 0
  });
};

// ======================
// ERROR RESPONSE UTILITIES
// ======================

/**
 * Create a standardized error response
 */
export const createErrorResponse = (res, statusCode = 500, message = 'Internal server error', error = null, meta = {}) => {
  const response = {
    success: false,
    error: error || message,
    message,
    meta: {
      timestamp: new Date().toISOString(),
      statusCode,
      ...meta
    }
  };

  return res.status(statusCode).json(response);
};

/**
 * Create a validation error response
 */
export const createValidationErrorResponse = (res, errors, message = 'Validation failed') => {
  return createErrorResponse(res, 400, message, 'VALIDATION_ERROR', {
    validationErrors: errors,
    errorType: 'VALIDATION'
  });
};

/**
 * Create a not found error response
 */
export const createNotFoundResponse = (res, entity = 'Resource', message = null) => {
  const defaultMessage = `${entity} not found`;
  return createErrorResponse(res, 404, message || defaultMessage, 'NOT_FOUND', {
    errorType: 'NOT_FOUND',
    entity
  });
};

/**
 * Create an unauthorized error response
 */
export const createUnauthorizedResponse = (res, message = 'Unauthorized access') => {
  return createErrorResponse(res, 401, message, 'UNAUTHORIZED', {
    errorType: 'AUTHENTICATION'
  });
};

/**
 * Create a forbidden error response
 */
export const createForbiddenResponse = (res, message = 'Access forbidden') => {
  return createErrorResponse(res, 403, message, 'FORBIDDEN', {
    errorType: 'AUTHORIZATION'
  });
};

/**
 * Create a conflict error response
 */
export const createConflictResponse = (res, message = 'Resource conflict', details = {}) => {
  return createErrorResponse(res, 409, message, 'CONFLICT', {
    errorType: 'CONFLICT',
    details
  });
};

// ======================
// PAGINATION UTILITIES
// ======================

/**
 * Generate pagination response object
 */
export const generatePaginationResponse = (data, totalCount, page, limit) => {
  const currentPage = parseInt(page);
  const itemsPerPage = parseInt(limit);
  const totalPages = Math.ceil(Number(totalCount) / itemsPerPage);

  return {
    data,
    pagination: {
      page: currentPage,
      limit: itemsPerPage,
      total: Number(totalCount),
      pages: totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      prevPage: currentPage > 1 ? currentPage - 1 : null
    }
  };
};

/**
 * Parse pagination parameters from request
 */
export const parsePaginationParams = (req) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  
  return {
    page,
    limit,
    skip: (page - 1) * limit
  };
};

/**
 * Validate pagination parameters
 */
export const validatePaginationParams = (page, limit) => {
  const errors = [];

  if (page < 1) {
    errors.push('Page must be greater than 0');
  }

  if (limit < 1) {
    errors.push('Limit must be greater than 0');
  }

  if (limit > 100) {
    errors.push('Limit cannot exceed 100');
  }

  return errors;
};

// ======================
// CRYPTO & SECURITY UTILITIES
// ======================

/**
 * Generate a UUID v4
 */
export const generateUUID = () => {
  return crypto.randomUUID();
};

/**
 * Hash password with bcrypt
 */
export const hashPassword = async (password, salt = null) => {
  const saltRounds = 12;
  if (salt) {
    return await bcrypt.hash(password, salt);
  }
  return await bcrypt.hash(password, saltRounds);
};

/**
 * Generate secure salt
 */
export const generateSalt = () => {
  return bcrypt.genSaltSync(12);
};

/**
 * Verify password against hash with optional separate salt
 */
export const verifyPassword = async (password, hash, salt = null) => {
  if (salt) {
    // Use the stored salt to hash the provided password and compare
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword === hash;
  } else {
    // Fallback to bcrypt.compare for backward compatibility
    return await bcrypt.compare(password, hash);
  }
};

// ======================
// RESPONSE FORMATTING
// ======================

/**
 * Format response data
 */
export const formatResponse = (success, data, message = '', meta = {}) => ({
  success,
  message,
  data,
  meta: {
    timestamp: new Date().toISOString(),
    ...meta
  }
});

// ======================
// AUDIT LOGGING
// ======================

const prisma = new PrismaClient();

// Utility to convert BigInt to string recursively
export function convertBigIntToString(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertBigIntToString(v)])
    );
  } else if (typeof obj === 'bigint') {
    return obj.toString();
  }
  return obj;
}

/**
 * Create audit log entry
 */
export const createAuditLog = async (auditData) => {
  try {
    const {
      action,
      entityType,
      entityId,
      userId,
      schoolId,
      ownerId,
      oldData,
      newData,
      ipAddress,
      userAgent,
      status = 'SUCCESS',
      metadata = {}
    } = auditData;

    const auditLog = await prisma.auditLog.create({
      data: {
        action,
        entityType,
        entityId: entityId ? BigInt(entityId) : BigInt(0),
        userId: userId ? BigInt(userId) : null,
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null,
        oldData,
        newData,
        ipAddress,
        userAgent
      }
    });

    return auditLog;
  } catch (error) {
    console.error('Audit log creation failed:', error);
    // Don't throw error to avoid breaking the main operation
    return null;
  }
};

// ======================
// ERROR HANDLING
// ======================

/**
 * Handle errors and return appropriate HTTP responses
 */
export const handleError = (res, error, operation = 'operation') => {
  console.error(`${operation} error:`, error);
  
  // Prisma validation errors
  if (error.name === 'PrismaClientValidationError') {
    return createValidationErrorResponse(
      res, 
      [error.message], 
      'Invalid database query'
    );
  }
  
  // Prisma errors
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const field = error.meta?.target?.[0] || 'field';
        return createConflictResponse(
          res, 
          `${field} already exists`,
          { field, value: error.meta?.target }
        );
      
      case 'P2025':
        // Record not found
        return createNotFoundResponse(res, 'Resource');
      
      case 'P2003':
        // Foreign key constraint violation
        return createErrorResponse(
          res, 
          400, 
          'Invalid foreign key reference',
          'FOREIGN_KEY_VIOLATION'
        );
      
      case 'P2014':
        // The change you are trying to make would violate the required relation
        return createErrorResponse(
          res, 
          400, 
          'Cannot delete resource due to existing relationships',
          'RELATION_VIOLATION'
        );
      
      default:
        return createErrorResponse(
          res, 
          500, 
          'Database operation failed',
          'DATABASE_ERROR'
        );
    }
  }

  // Validation errors
  if (error.name === 'ValidationError' || error.name === 'ZodError') {
    return createValidationErrorResponse(
      res, 
      error.errors || [error.message], 
      'Validation failed'
    );
  }

  // Authorization errors
  if (error.name === 'UnauthorizedError') {
    return createUnauthorizedResponse(res, error.message);
  }

  if (error.name === 'ForbiddenError') {
    return createForbiddenResponse(res, error.message);
  }

  if (error.name === 'NotFoundError') {
    return createNotFoundResponse(res, error.entity || 'Resource', error.message);
  }

  // Generic error response
  return createErrorResponse(
    res, 
    500, 
    `${operation} failed: ${error.message}`,
    'INTERNAL_ERROR'
  );
};

// ======================
// PRISMA ERROR HANDLING
// ======================

/**
 * Handle Prisma errors and return appropriate HTTP responses
 */
export const handlePrismaError = (res, error, operation = 'unknown') => {
  console.error(`Prisma error in ${operation}:`, error);

  // Prisma Client Known Request Error
  if (error.code) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const field = error.meta?.target?.[0] || 'field';
        return createConflictResponse(
          res, 
          `${field} already exists`,
          { field, value: error.meta?.target }
        );
      
      case 'P2025':
        // Record not found
        return createNotFoundResponse(res, 'Resource');
      
      case 'P2003':
        // Foreign key constraint violation
        return createErrorResponse(
          res, 
          400, 
          'Invalid foreign key reference',
          'FOREIGN_KEY_VIOLATION'
        );
      
      case 'P2014':
        // The change you are trying to make would violate the required relation
        return createErrorResponse(
          res, 
          400, 
          'Cannot delete resource due to existing relationships',
          'RELATION_VIOLATION'
        );
      
      default:
        return createErrorResponse(
          res, 
          500, 
          'Database operation failed',
          'DATABASE_ERROR'
        );
    }
  }

  // Generic error
  return createErrorResponse(
    res, 
    500, 
    'Internal server error',
    'INTERNAL_ERROR'
  );
};

// ======================
// RESPONSE FORMATTING
// ======================

/**
 * Format data for response
 */
export const formatResponseData = (data, options = {}) => {
  const {
    includeTimestamps = true,
    includeMetadata = true,
    transform = null
  } = options;

  let formattedData = data;

  // Apply custom transformation if provided
  if (transform && typeof transform === 'function') {
    formattedData = transform(data);
  }

  // Add timestamps if requested
  if (includeTimestamps && formattedData) {
    if (Array.isArray(formattedData)) {
      formattedData = formattedData.map(item => ({
        ...item,
        _timestamp: new Date().toISOString()
      }));
    } else if (typeof formattedData === 'object') {
      formattedData = {
        ...formattedData,
        _timestamp: new Date().toISOString()
      };
    }
  }

  return formattedData;
};

/**
 * Create a standardized API response wrapper
 */
export const createApiResponse = (res, options = {}) => {
  const {
    success = true,
    statusCode = 200,
    message = 'Success',
    data = null,
    meta = {},
    format = true
  } = options;

  const responseData = format ? formatResponseData(data) : data;

  if (success) {
    return createSuccessResponse(res, statusCode, message, responseData, meta);
  } else {
    return createErrorResponse(res, statusCode, message, responseData, meta);
  }
};

// ======================
// CACHE RESPONSE UTILITIES
// ======================

/**
 * Create a cached response
 */
export const createCachedResponse = (res, data, cacheInfo = {}) => {
  return createSuccessResponse(res, 200, 'Data retrieved from cache', data, {
    cached: true,
    cacheInfo: {
      timestamp: new Date().toISOString(),
      ...cacheInfo
    }
  });
};

/**
 * Create a cache miss response
 */
export const createCacheMissResponse = (res, data, cacheInfo = {}) => {
  return createSuccessResponse(res, 200, 'Data retrieved from database', data, {
    cached: false,
    cacheInfo: {
      timestamp: new Date().toISOString(),
      ...cacheInfo
    }
  });
};

// ======================
// BULK OPERATION RESPONSES
// ======================

/**
 * Create a bulk operation response
 */
export const createBulkOperationResponse = (res, results, operation) => {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return createSuccessResponse(res, 200, `${operation} operation completed`, {
    successful,
    failed,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0
    }
  });
};

// ======================
// EXPORT/IMPORT RESPONSES
// ======================

/**
 * Create an export response
 */
export const createExportResponse = (res, data, format, filename) => {
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
  } else if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
  } else if (format === 'xlsx') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  return res.send(data);
};

/**
 * Create an import response
 */
export const createImportResponse = (res, results, entity) => {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  return createSuccessResponse(res, 201, `${entity} import completed`, {
    successful,
    failed,
    summary: {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      successRate: results.length > 0 ? (successful.length / results.length) * 100 : 0
    }
  });
};

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Check if response should be cached
 */
export const shouldCacheResponse = (req, data) => {
  // Don't cache if explicitly requested not to
  if (req.query.nocache === 'true') {
    return false;
  }

  // Don't cache if data is empty
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return false;
  }

  // Don't cache for authenticated users with sensitive data
  if (req.user && req.user.role === 'SUPER_ADMIN') {
    return false;
  }

  return true;
};

/**
 * Sanitize response data for caching
 */
export const sanitizeForCache = (data) => {
  if (!data) return data;

  // Remove sensitive fields
  const sensitiveFields = ['password', 'salt', 'token', 'secret'];
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForCache(item));
  }

  if (typeof data === 'object') {
    const sanitized = { ...data };
    sensitiveFields.forEach(field => {
      delete sanitized[field];
    });
    return sanitized;
  }

  return data;
};

export default {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  createListResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createConflictResponse,
  generatePaginationResponse,
  parsePaginationParams,
  validatePaginationParams,
  handlePrismaError,
  formatResponseData,
  createApiResponse,
  createCachedResponse,
  createCacheMissResponse,
  createBulkOperationResponse,
  createExportResponse,
  createImportResponse,
  shouldCacheResponse,
  sanitizeForCache,
  
  // Crypto & Security
  generateUUID,
  hashPassword,
  generateSalt,
  verifyPassword,
  
  // Response formatting
  formatResponse,
  
  // Audit logging
  createAuditLog,
  
  // Error handling
  handleError
}; 
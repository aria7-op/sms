import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// ======================
// AUDIT LOGGING MIDDLEWARE
// ======================

/**
 * Audit log middleware for tracking operations
 * @param {string} action - The action being performed (CREATE, UPDATE, DELETE, etc.)
 * @param {string} resource - The resource being affected (Class, Student, etc.)
 * @returns {Function} Express middleware function
 */
export const auditLog = (action, resource) => {
  return async (req, res, next) => {
    try {
      // Store original send method
      const originalSend = res.send;
      
      // Override send method to capture response
      res.send = function(data) {
        // Restore original send method
        res.send = originalSend;
        
        // Parse response data
        let responseData = data;
        try {
          if (typeof data === 'string') {
            responseData = JSON.parse(data);
          }
        } catch (error) {
          // If parsing fails, use original data
          responseData = { data: data };
        }
        
        // Create audit log entry
        createAuditLogEntry(req, action, resource, responseData);
        
        // Call original send method
        return originalSend.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Audit log middleware error:', error);
      next();
    }
  };
};


/**
 * Create audit log entry
 * @param {Object} req - Express request object
 * @param {string} action - The action performed
 * @param {string} resource - The resource affected
 * @param {Object} responseData - The response data
 */
export const createAuditLog = async (req, action, resource, responseData) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const ownerId = req.user?.role === 'SUPER_ADMIN' ? req.user?.id : null;
    const schoolId = req.user?.schoolId;
    
    const auditData = {
      action,
      entityType: resource,
      entityId: extractResourceId(req, responseData) ? BigInt(extractResourceId(req, responseData)) : BigInt(0),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      ownerId: ownerId ? BigInt(ownerId) : null,
      schoolId: schoolId ? BigInt(schoolId) : null,
      userId: userId ? BigInt(userId) : null,
      oldData: null,
      newData: sanitizeRequestBody(req.body)
    };
    
    await prisma.auditLog.create({
      data: auditData
    });
    
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
  }
};

/**
 * Create audit log entry
 * @param {Object} req - Express request object
 * @param {string} action - The action performed
 * @param {string} resource - The resource affected
 * @param {Object} responseData - The response data
 */
export const createAuditLogEntry = async (req, action, resource, responseData) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const ownerId = req.user?.role === 'SUPER_ADMIN' ? req.user?.id : null;
    const schoolId = req.user?.schoolId;
    
    const auditData = {
      action,
      entityType: resource,
      entityId: extractResourceId(req, responseData) ? BigInt(extractResourceId(req, responseData)) : BigInt(0),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      ownerId: ownerId ? BigInt(ownerId) : null,
      schoolId: schoolId ? BigInt(schoolId) : null,
      userId: userId ? BigInt(userId) : null,
      oldData: null,
      newData: sanitizeRequestBody(req.body)
    };
    
    // Store audit log in database
    await prisma.auditLog.create({
      data: auditData
    });
    
  } catch (error) {
    console.error('Failed to create audit log entry:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

/**
 * Extract resource ID from request or response
 * @param {Object} req - Express request object
 * @param {Object} responseData - Response data
 * @returns {string|null} Resource ID
 */
const extractResourceId = (req, responseData) => {
  // Try to get ID from URL params first
  if (req.params.id) {
    return req.params.id;
  }
  
  // Try to get ID from response data
  if (responseData?.data?.id) {
    return responseData.data.id;
  }
  
  // Try to get ID from request body
  if (req.body?.id) {
    return req.body.id;
  }
  
  return null;
};

/**
 * Sanitize request body to remove sensitive information
 * @param {Object} body - Request body
 * @returns {Object} Sanitized body
 */
const sanitizeRequestBody = (body) => {
  if (!body) return null;
  
  const sanitized = { ...body };
  
  // Remove sensitive fields
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'apiKey'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

/**
 * Sanitize headers to remove sensitive information
 * @param {Object} headers - Request headers
 * @returns {Object} Sanitized headers
 */
const sanitizeHeaders = (headers) => {
  if (!headers) return null;
  
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

/**
 * Get audit logs with filtering and pagination
 * @param {Object} filters - Filter criteria
 * @param {Object} pagination - Pagination options
 * @returns {Object} Audit logs and pagination info
 */
export const getAuditLogs = async (filters = {}, pagination = {}) => {
  try {
    const where = {};
    
    // Apply filters
    if (filters.userId) where.userId = filters.userId;
    if (filters.userRole) where.userRole = filters.userRole;
    if (filters.action) where.action = filters.action;
    if (filters.resource) where.resource = filters.resource;
    if (filters.resourceId) where.resourceId = filters.resourceId;
    if (filters.startDate) where.timestamp = { gte: new Date(filters.startDate) };
    if (filters.endDate) where.timestamp = { ...where.timestamp, lte: new Date(filters.endDate) };
    
    // Pagination
    const page = pagination.page || 1;
    const limit = pagination.limit || 50;
    const skip = (page - 1) * limit;
    
    // Get total count
    const total = await prisma.auditLog.count({ where });
    
    // Get audit logs
    const logs = await prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
    });
    
    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      }
    };
    
  } catch (error) {
    console.error('Failed to get audit logs:', error);
    throw error;
  }
};

/**
 * Clean up old audit logs
 * @param {number} daysToKeep - Number of days to keep logs
 * @returns {number} Number of deleted logs
 */
export const cleanupAuditLogs = async (daysToKeep = 90) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await prisma.auditLog.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });
    
    return result.count;
    
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error);
    throw error;
  }
};

// Export all available functions
export default {
  auditLog,
  createAuditLogEntry,
  getAuditLogs,
  createAuditLog,
  cleanupAuditLogs
};
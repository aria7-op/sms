import { z } from 'zod';
import * as classSchemas from '../utils/classSchemas.js';

// ======================
// VALIDATION MIDDLEWARE
// ======================

/**
 * Validate request body using Zod schema
 * @param {Object} schema - Zod schema for validation
 * @returns {Function} Express middleware function
 */
export const validateBody = (schema) => {
  return validateRequest(schema, 'body');
};

/**
 * Validate URL parameters using Zod schema
 * @param {Object} schema - Zod schema for validation
 * @returns {Function} Express middleware function
 */
export const validateParams = (schema) => {
  return (req, res, next) => {
    console.log('=== validateParams START ===');
    console.log('Schema:', schema);
    console.log('Params:', req.params);
    
    try {
      const validatedData = schema.parse(req.params);
      console.log('Validation successful:', validatedData);
      req.params = validatedData;
      console.log('=== validateParams END ===');
      next();
    } catch (error) {
      console.error('=== validateParams ERROR ===', error);
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Request parameters validation failed',
        details: error.errors || [error.message]
      });
    }
  };
};

/**
 * Validate query parameters using Zod schema
 * @param {Object} schema - Zod schema for validation
 * @returns {Function} Express middleware function
 */
export const validateQuery = (schema) => {
  return (req, res, next) => {
    console.log('=== validateQuery START ===');
    console.log('Schema:', schema);
    console.log('Query:', req.query);
    
    try {
      const validatedData = schema.parse(req.query);
      console.log('Validation successful:', validatedData);
      req.query = validatedData;
      console.log('=== validateQuery END ===');
      next();
    } catch (error) {
      console.error('=== validateQuery ERROR ===', error);
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Request query validation failed',
        details: error.errors || [error.message]
      });
    }
  };
};

/**
 * Validate request data using Zod schema
 * @param {Object} schema - Zod schema for validation
 * @param {string} source - Source of data to validate ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
export const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    console.log('VALIDATE REQUEST:', source, 'Schema:', schema._def?.typeName || 'unknown');
    console.log('VALIDATE DATA:', req[source]);
    try {
      const dataToValidate = req[source];
      
      // Validate data using schema
      const validatedData = schema.parse(dataToValidate);
      
      // Replace original data with validated data
      req[source] = validatedData;
      
      next();
    } catch (error) {
      // Format validation errors
      let validationErrors = [];
      if (error.errors && Array.isArray(error.errors)) {
        validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received
        }));
      } else {
        validationErrors = [{
          field: '',
          message: error.message || 'Unknown validation error',
          code: error.code || 'UNKNOWN',
          received: undefined
        }];
      }
      
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Request data validation failed',
        details: validationErrors,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400,
          source: source,
          schema: schema._def?.typeName || 'unknown'
        }
      });
    }
  };
};

/**
 * Validate multiple sources in one middleware
 * @param {Object} schemas - Object with schema definitions for different sources
 * @returns {Function} Express middleware function
 */
export const validateMultiple = (schemas) => {
  return (req, res, next) => {
    try {
      const errors = [];
      
      // Validate each source
      for (const [source, schema] of Object.entries(schemas)) {
        if (schema && req[source]) {
          try {
            const validatedData = schema.parse(req[source]);
            req[source] = validatedData;
          } catch (error) {
            errors.push({
              source,
              errors: error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message,
                code: err.code,
                received: err.received
              }))
            });
          }
        }
      }
      
      if (errors.length > 0) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: 'Multiple validation errors occurred',
          details: errors,
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400,
            sources: Object.keys(schemas)
          }
        });
        return;
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Validation middleware error',
        message: error.message,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Validate file upload
 * @param {Object} options - File validation options
 * @returns {Function} Express middleware function
 */
export const validateFileUpload = (options = {}) => {
  const {
    maxSize = 5 * 1024 * 1024, // 5MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
    maxFiles = 1,
    required = false
  } = options;
  
  return (req, res, next) => {
    try {
      const files = req.files || req.file;
      
      if (!files && required) {
        return res.status(400).json({
          success: false,
          error: 'File required',
          message: 'File upload is required',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400
          }
        });
      }
      
      if (!files) {
        return next();
      }
      
      const fileArray = Array.isArray(files) ? files : [files];
      
      if (fileArray.length > maxFiles) {
        return res.status(400).json({
          success: false,
          error: 'Too many files',
          message: `Maximum ${maxFiles} file(s) allowed`,
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400,
            maxFiles,
            received: fileArray.length
          }
        });
      }
      
      const errors = [];
      
      fileArray.forEach((file, index) => {
        // Check file size
        if (file.size > maxSize) {
          errors.push({
            file: file.originalname || `file_${index}`,
            error: 'File too large',
            maxSize: maxSize,
            actualSize: file.size
          });
        }
        
        // Check file type
        if (!allowedTypes.includes(file.mimetype)) {
          errors.push({
            file: file.originalname || `file_${index}`,
            error: 'File type not allowed',
            allowedTypes,
            actualType: file.mimetype
          });
        }
      });
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'File validation failed',
          message: 'One or more files failed validation',
          details: errors,
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400,
            maxSize,
            allowedTypes,
            maxFiles
          }
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'File validation error',
        message: error.message,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};


/**
 * Validate school access
 * @param {Object} user - User object containing id and schoolId
 * @param {number} schoolId - School ID to validate access for
 * @returns {Promise<void>} Resolves if access is valid, rejects with error if not
 */
export const validateSchoolAccess = async (user, schoolId) => {
  try {
    console.log('validateSchoolAccess called with:', { user, schoolId, userRole: user.role });
    
    // Import Prisma client
    const { PrismaClient } = await import('../generated/prisma/index.js');
    const prisma = new PrismaClient();

    // Super admins (owners) have access to all schools
    if (user.role === 'SUPER_ADMIN') {
      console.log('Owner detected, checking school ownership...');
      console.log('Looking for school with id:', BigInt(schoolId), 'ownerId:', BigInt(user.id));
      
      // First, let's see what schools this owner has
      const allOwnerSchools = await prisma.school.findMany({
        where: {
          ownerId: BigInt(user.id),
          deletedAt: null
        },
        select: { id: true, name: true, ownerId: true }
      });
      console.log('All schools for this owner:', allOwnerSchools);
      
      // Verify the school exists and belongs to this owner
      const school = await prisma.school.findFirst({
        where: {
          id: BigInt(schoolId),
          ownerId: BigInt(user.id),
          deletedAt: null
        }
      });

      // If not found, try without BigInt conversion to see if that's the issue
      if (!school) {
        console.log('Trying alternative query without BigInt conversion...');
        const schoolAlt = await prisma.school.findFirst({
          where: {
            id: parseInt(schoolId),
            ownerId: parseInt(user.id),
            deletedAt: null
          }
        });
        console.log('Alternative query result:', schoolAlt);
      }

      console.log('School query result:', school);

      if (!school) {
        console.log('School not found or does not belong to owner');
        const error = new Error('School not found or does not belong to this owner');
        error.statusCode = 404;
        throw error;
      }
      console.log('School access validated for owner');
      return;
    }

    // For other users, check if they belong to the school
    if (user.schoolId && BigInt(user.schoolId) === BigInt(schoolId)) {
      return;
    }

    // If none of the above conditions match, deny access
    const error = new Error('User does not have access to the specified school');
    error.statusCode = 403;
    throw error;

  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    console.error('School access validation error:', error);
    const newError = new Error('Failed to validate school access');
    newError.statusCode = 500;
    throw newError;
  }
};

/**
 * Validate department access
 * @param {Object} user - User object containing id and schoolId
 * @param {number} departmentId - Department ID to validate access for
 * @param {number} schoolId - School ID for context
 * @returns {Promise<void>} Resolves if access is valid, rejects with error if not
 */
export const validateDepartmentAccess = async (user, departmentId, schoolId) => {
  // Placeholder implementation: Replace with actual access validation logic
  // For example, check if the user has permission to access the department in the school
  const hasAccess = true; // TODO: Implement actual check

  if (!hasAccess) {
    const error = new Error('User does not have access to the specified department');
    error.statusCode = 403;
    throw error;
  }
};

/**
 * Validate class access
 * @param {Object} user - User object containing id and schoolId
 * @param {number} classId - Class ID to validate access for
 * @param {number} schoolId - School ID for context
 * @returns {Promise<void>} Resolves if access is valid, rejects with error if not
 */
export const validateClassAccess = async (user, classId, schoolId) => {
  try {
    console.log('validateClassAccess called with:', { user, classId, schoolId, userRole: user.role });
    
    // Import Prisma client
    const { PrismaClient } = await import('../generated/prisma/index.js');
    const prisma = new PrismaClient();

    // Check if class exists and belongs to the school
    const classData = await prisma.class.findFirst({
      where: {
        id: BigInt(classId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      select: {
        id: true,
        schoolId: true,
        name: true
      }
    });

    console.log('Class query result:', classData);

    if (!classData) {
      const error = new Error('Class not found or does not belong to this school');
      error.statusCode = 404;
      throw error;
    }

    // Super admins have access to all classes
    if (user.role === 'SUPER_ADMIN') {
      console.log('Super admin access granted to class');
      return;
    }

    // School admins have access to all classes in their school
    if (user.role === 'SCHOOL_ADMIN' && user.schoolId === parseInt(schoolId)) {
      return;
    }

    // Teachers can access classes they are assigned to
    if (user.role === 'TEACHER') {
      const teacher = await prisma.teacher.findFirst({
        where: {
          userId: BigInt(user.id),
          schoolId: BigInt(schoolId)
        },
        include: {
          subjects: {
            where: {
              classes: {
                some: {
                  id: BigInt(classId)
                }
              }
            }
          }
        }
      });

      if (teacher && teacher.subjects.length > 0) {
        return;
      }
    }

    // If none of the above conditions match, deny access
    const error = new Error('User does not have access to the specified class');
    error.statusCode = 403;
    throw error;

  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Class access validation error:', error);
    const newError = new Error('Failed to validate class access');
    newError.statusCode = 500;
    throw newError;
  }
};

/**
 * Validate pagination parameters
 * @param {Object} options - Pagination validation options
 * @returns {Function} Express middleware function
 */
export const validatePagination = (options = {}) => {
  const {
    maxLimit = 100,
    defaultLimit = 10,
    defaultPage = 1
  } = options;
  
  return (req, res, next) => {
    try {
      const { page, limit } = req.query;
      
      // Validate and set page
      let validatedPage = defaultPage;
      if (page) {
        const pageNum = parseInt(page);
        if (isNaN(pageNum) || pageNum < 1) {
          return res.status(400).json({
            success: false,
            error: 'Invalid page number',
            message: 'Page must be a positive integer',
            meta: {
              timestamp: new Date().toISOString(),
              statusCode: 400,
              received: page
            }
          });
        }
        validatedPage = pageNum;
      }
      
      // Validate and set limit
      let validatedLimit = defaultLimit;
      if (limit) {
        const limitNum = parseInt(limit);
        if (isNaN(limitNum) || limitNum < 1 || limitNum > maxLimit) {
          return res.status(400).json({
            success: false,
            error: 'Invalid limit',
            message: `Limit must be between 1 and ${maxLimit}`,
            meta: {
              timestamp: new Date().toISOString(),
              statusCode: 400,
              maxLimit,
              received: limit
            }
          });
        }
        validatedLimit = limitNum;
      }
      
      // Update query with validated values
      req.query.page = validatedPage;
      req.query.limit = validatedLimit;
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Pagination validation error',
        message: error.message,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Validate sorting parameters
 * @param {Array} allowedFields - Array of allowed sort fields
 * @param {string} defaultField - Default sort field
 * @param {string} defaultOrder - Default sort order ('asc' or 'desc')
 * @returns {Function} Express middleware function
 */
export const validateSorting = (allowedFields, defaultField, defaultOrder = 'desc') => {
  return (req, res, next) => {
    try {
      const { sortBy, sortOrder } = req.query;
      
      // Validate sort field
      let validatedSortBy = defaultField;
      if (sortBy) {
        if (!allowedFields.includes(sortBy)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid sort field',
            message: `Sort field must be one of: ${allowedFields.join(', ')}`,
            meta: {
              timestamp: new Date().toISOString(),
              statusCode: 400,
              allowedFields,
              received: sortBy
            }
          });
        }
        validatedSortBy = sortBy;
      }
      
      // Validate sort order
      let validatedSortOrder = defaultOrder;
      if (sortOrder) {
        const order = sortOrder.toLowerCase();
        if (!['asc', 'desc'].includes(order)) {
          return res.status(400).json({
            success: false,
            error: 'Invalid sort order',
            message: 'Sort order must be "asc" or "desc"',
            meta: {
              timestamp: new Date().toISOString(),
              statusCode: 400,
              allowedOrders: ['asc', 'desc'],
              received: sortOrder
            }
          });
        }
        validatedSortOrder = order;
      }
      
      // Update query with validated values
      req.query.sortBy = validatedSortBy;
      req.query.sortOrder = validatedSortOrder;
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Sorting validation error',
        message: error.message,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Validate date range parameters
 * @param {Object} options - Date range validation options
 * @returns {Function} Express middleware function
 */
export const validateDateRange = (options = {}) => {
  const {
    maxRange = 365, // Maximum range in days
    allowFuture = false,
    allowPast = true
  } = options;
  
  return (req, res, next) => {
    try {
      const { startDate, endDate, dateAfter, dateBefore } = req.query;
      
      const errors = [];
      
      // Helper function to validate date
      const validateDate = (dateStr, fieldName) => {
        if (!dateStr) return null;
        
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
          errors.push({
            field: fieldName,
            error: 'Invalid date format',
            received: dateStr
          });
          return null;
        }
        
        const now = new Date();
        
        if (!allowFuture && date > now) {
          errors.push({
            field: fieldName,
            error: 'Future dates not allowed',
            received: dateStr
          });
          return null;
        }
        
        if (!allowPast && date < now) {
          errors.push({
            field: fieldName,
            error: 'Past dates not allowed',
            received: dateStr
          });
          return null;
        }
        
        return date;
      };
      
      // Validate individual dates
      const start = validateDate(startDate, 'startDate');
      const end = validateDate(endDate, 'endDate');
      const after = validateDate(dateAfter, 'dateAfter');
      const before = validateDate(dateBefore, 'dateBefore');
      
      // Validate date ranges
      if (start && end && start > end) {
        errors.push({
          field: 'dateRange',
          error: 'Start date must be before end date',
          startDate,
          endDate
        });
      }
      
      if (after && before && after > before) {
        errors.push({
          field: 'dateRange',
          error: 'After date must be before before date',
          dateAfter,
          dateBefore
        });
      }
      
      // Check range limits
      if (start && end) {
        const rangeDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (rangeDays > maxRange) {
          errors.push({
            field: 'dateRange',
            error: `Date range too large. Maximum ${maxRange} days allowed`,
            rangeDays,
            maxRange
          });
        }
      }
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Date validation failed',
          message: 'One or more date validations failed',
          details: errors,
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400,
            maxRange,
            allowFuture,
            allowPast
          }
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Date validation error',
        message: error.message,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Sanitize and validate search parameters
 * @param {Object} options - Search validation options
 * @returns {Function} Express middleware function
 */
export const validateSearch = (options = {}) => {
  const {
    maxLength = 100,
    minLength = 1,
    allowedFields = [],
    excludeFields = []
  } = options;
  
  return (req, res, next) => {
    try {
      const { search, ...otherParams } = req.query;
      
      // Validate search term
      if (search) {
        const searchStr = String(search).trim();
        
        if (searchStr.length < minLength) {
          return res.status(400).json({
            success: false,
            error: 'Search term too short',
            message: `Search term must be at least ${minLength} characters`,
            meta: {
              timestamp: new Date().toISOString(),
              statusCode: 400,
              minLength,
              received: searchStr.length
            }
          });
        }
        
        if (searchStr.length > maxLength) {
          return res.status(400).json({
            success: false,
            error: 'Search term too long',
            message: `Search term must be at most ${maxLength} characters`,
            meta: {
              timestamp: new Date().toISOString(),
              statusCode: 400,
              maxLength,
              received: searchStr.length
            }
          });
        }
        
        // Update with sanitized search term
        req.query.search = searchStr;
      }
      
      // Validate other search parameters
      const errors = [];
      
      for (const [field, value] of Object.entries(otherParams)) {
        if (allowedFields.length > 0 && !allowedFields.includes(field)) {
          errors.push({
            field,
            error: 'Field not allowed in search',
            allowedFields
          });
        }
        
        if (excludeFields.includes(field)) {
          errors.push({
            field,
            error: 'Field excluded from search'
          });
        }
      }
      
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Search parameter validation failed',
          message: 'One or more search parameters are invalid',
          details: errors,
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400,
            allowedFields,
            excludeFields
          }
        });
      }
      
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Search validation error',
        message: error.message,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

// ======================
// COMMON VALIDATION SCHEMAS
// ======================

/**
 * ID validation schema
 */
export const idSchema = z.object({
  id: z.string().or(z.number()).transform((val) => {
    // Add debugging
    console.log('=== ID Validation Debug ===');
    console.log('Raw ID value:', val);
    console.log('Type of ID:', typeof val);
    console.log('Is undefined:', val === 'undefined' || val === undefined);
    
    // Handle undefined case
    if (val === 'undefined' || val === undefined || val === 'null' || val === null) {
      throw new Error('ID parameter is missing or invalid. Please provide a valid ID.');
    }
    
    // Handle empty string case
    if (val === '' || val === ' ') {
      throw new Error('ID parameter cannot be empty. Please provide a valid ID.');
    }
    
    const num = parseInt(val);
    if (isNaN(num) || num <= 0) {
      throw new Error(`ID must be a positive number. Received: "${val}"`);
    }
    return num;
  })
});

/**
 * Enhanced ID validation middleware that provides better error handling
 * for frontend issues with undefined/null ID parameters
 */
export const validateIdParam = (paramName = 'id') => {
  return (req, res, next) => {
    const idValue = req.params[paramName];
    
    console.log(`=== Enhanced ID Validation for ${paramName} ===`);
    console.log('Raw ID value:', idValue);
    console.log('Type of ID:', typeof idValue);
    
    // Check for undefined/null cases that frontend might send
    if (idValue === 'undefined' || idValue === undefined || 
        idValue === 'null' || idValue === null || 
        idValue === '' || idValue === ' ') {
      
      console.log('=== Invalid ID detected in enhanced validation ===');
      return res.status(400).json({
        success: false,
        error: 'Invalid ID parameter',
        message: `${paramName.charAt(0).toUpperCase() + paramName.slice(1)} ID is missing or invalid. Please provide a valid ${paramName}.`,
        details: {
          receivedId: idValue,
          expectedFormat: 'A positive number',
          example: `/api/${req.baseUrl.split('/').pop()}/123/analytics`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Validate it's a positive number
    const num = parseInt(idValue);
    if (isNaN(num) || num <= 0) {
      console.log('=== Invalid numeric ID detected ===');
      return res.status(400).json({
        success: false,
        error: 'Invalid ID format',
        message: `${paramName.charAt(0).toUpperCase() + paramName.slice(1)} ID must be a positive number.`,
        details: {
          receivedId: idValue,
          expectedFormat: 'A positive number',
          example: `/api/${req.baseUrl.split('/').pop()}/123/analytics`
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Store the validated ID for use in subsequent middleware
    req.validatedId = num;
    next();
  };
};

/**
 * Pagination validation schema
 */
export const paginationSchema = z.object({
  page: z.string().or(z.number()).transform((val) => {
    const num = parseInt(val);
    return isNaN(num) || num < 1 ? 1 : num;
  }).default(1),
  limit: z.string().or(z.number()).transform((val) => {
    const num = parseInt(val);
    if (isNaN(num) || num < 1) return 10;
    if (num > 100) return 100;
    return num;
  }).default(10)
});

/**
 * Search validation schema
 */
export const searchSchema = z.object({
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional().default('desc')
});

/**
 * Date range validation schema
 */
export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
}).refine((data) => {
  if (data.startDate && data.endDate) {
    return new Date(data.startDate) <= new Date(data.endDate);
  }
  return true;
}, {
  message: "End date must be after start date",
  path: ["endDate"]
});

/**
 * File upload validation schema
 */
export const fileUploadSchema = z.object({
  file: z.object({
    mimetype: z.string().refine((type) => {
      const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/csv',
        'application/json'
      ];
      return allowedTypes.includes(type);
    }, {
      message: 'File type not allowed. Allowed types: JPEG, PNG, GIF, PDF, DOC, DOCX, CSV, JSON'
    }),
    size: z.number().max(10 * 1024 * 1024, {
      message: 'File size too large. Maximum size is 10MB'
    })
  })
});

// ======================
// CUSTOM VALIDATION FUNCTIONS
// ======================

/**
 * Validate email format
 */
export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
export const validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,20}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate password strength
 */
export const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  if (!hasSpecialChar) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate URL format
 */
export const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate UUID format
 */
export const validateUuid = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// ======================
// SANITIZATION FUNCTIONS
// ======================

/**
 * Sanitize string input
 */
export const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/[&]/g, '&amp;') // Escape ampersands
    .replace(/["]/g, '&quot;') // Escape quotes
    .replace(/[']/g, '&#x27;') // Escape apostrophes
    .replace(/[/]/g, '&#x2F;'); // Escape forward slashes
};

/**
 * Sanitize object recursively
 */
export const sanitizeObject = (obj) => {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? sanitizeString(obj) : obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeObject(value);
  }
  
  return sanitized;
};

/**
 * Sanitize request data
 */
export const sanitizeRequest = (req, res, next) => {
  try {
    if (req.body) {
      req.body = sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  } catch (error) {
    console.error('Sanitization error:', error);
    next();
  }
};

// ======================
// ERROR HANDLING
// ======================

/**
 * Handle validation errors
 */
export const handleValidationError = (error, req, res, next) => {
  if (error instanceof z.ZodError) {
    const errors = error.errors.map(err => ({
      field: err.path.join('.'),
      message: err.message,
      code: err.code,
      received: err.received
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      message: 'Request validation failed. Please check your input.',
      details: errors,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 400,
        method: req.method,
        url: req.originalUrl
      }
    });
  }
  
  next(error);
};

/**
 * Custom error for validation failures
 */
export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
    this.statusCode = 400;
  }
}

/**
 * Custom validation middleware for class creation
 * Makes schoolId and createdBy optional for SUPER_ADMIN users
 */
export const validateClassCreateRequest = (req, res, next) => {
  try {
    const { schoolId, createdBy } = req.body;
    const userRole = req.user?.role;

    // For SUPER_ADMIN, schoolId and createdBy are optional (will be set by controller)
    if (userRole === 'SUPER_ADMIN') {
      // Create a modified schema that makes these fields optional
      const modifiedSchema = classSchemas.ClassCreateSchema.partial({
        schoolId: true,
        createdBy: true
      });
      
      const result = modifiedSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
    } else {
      // For other users, use the original schema (schoolId and createdBy required)
      const result = classSchemas.ClassCreateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: result.error.errors,
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
    }

    next();
  } catch (error) {
    console.error('Class create validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Validation error',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
};

export default {
  validateRequest,
  validateMultiple,
  validateFileUpload,
  validatePagination,
  validateSorting,
  validateDateRange,
  validateSearch,
  sanitizeRequest,
  handleValidationError,
  ValidationError,
  
  // Schemas
  idSchema,
  paginationSchema,
  searchSchema,
  dateRangeSchema,
  fileUploadSchema,
  
  // Validation functions
  validateEmail,
  validatePhone,
  validatePassword,
  validateUrl,
  validateUuid,
  
  // Sanitization functions
  sanitizeString,
  sanitizeObject,
  
  // Custom validation middleware
  validateClassCreateRequest
}; 
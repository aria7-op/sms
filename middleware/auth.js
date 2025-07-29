import jwt from 'jsonwebtoken';
import { PrismaClient } from '../generated/prisma/client.js';
import { default as ownersStore } from '../store/ownersStore.js';
import mysql from 'mysql2/promise';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Database connection pool (import from app.js)
let dbPool;

// Initialize database pool
async function initializeDbPool() {
  if (dbPool) return dbPool;
  
  try {
    let dbConfig;
    
    // Try to parse DATABASE_URL first
    if (process.env.DATABASE_URL) {
      // Remove mysql:// prefix
      const cleanUrl = process.env.DATABASE_URL.replace('mysql://', '');
      
      // Split into parts
      const [credentials, hostAndDb] = cleanUrl.split('@');
      const [user, password] = credentials.split(':');
      const [host, database] = hostAndDb.split('/');
      
      dbConfig = {
        host: host.split(':')[0],
        port: host.split(':')[1] || 3306,
        user: user,
        password: password,
        database: database
      };
    } else {
      dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'school',
        password: process.env.DB_PASSWORD || 'YourName123!',
        database: process.env.DB_NAME || 'school'
      };
    }
    
    dbPool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    return dbPool;
  } catch (error) {
    console.error('Failed to initialize database pool:', error);
    throw error;
  }
}

// ======================
// AUTHENTICATION MIDDLEWARE
// ======================

/**
 * Verify JWT token and attach user to request
 */
export const authenticateToken = async (req, res, next) => {
  console.log('=== authenticateToken START ===');
  console.log('Request:', req.method, req.path);
  console.log('Request IP:', req.ip, 'Forwarded for:', req.headers['x-forwarded-for']);
  console.log('User-Agent:', req.headers['user-agent']);
  console.log('Origin:', req.headers['origin']);
  console.log('Referer:', req.headers['referer']);
  console.log('Headers:', req.headers);
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log('Token:', token ? 'Present' : 'Missing');

  if (!token) {
    console.log('=== authenticateToken ERROR: No token ===');
    return res.status(401).json({
      success: false,
      error: 'Access denied',
      message: 'No token provided'
    });
  }

  try {
    console.log('Verifying token...');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified for user:', decoded.userId);
    console.log('Decoded token:', decoded);
    
    // Initialize database pool
    const pool = await initializeDbPool();
    
    // Find user in database using MySQL
    console.log('Fetching user from database...');
    const [users] = await pool.execute(
      'SELECT id, email, name, role, schoolId, status FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      console.log('=== authenticateToken ERROR: User not found ===');
      return res.status(401).json({
        success: false,
        error: 'Access denied',
        message: 'User not found in database'
      });
    }

    const user = users[0];
    console.log('User found:', user.id, user.email);
    
    // Set user data for compatibility
    req.user = {
      id: user.id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId ? user.schoolId.toString() : null,
      status: user.status
    };
    
    console.log('=== authenticateToken END (User) ===');
    next();
    
  } catch (error) {
    console.error('=== authenticateToken ERROR ===', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'Database error during authentication: ' + error.message
    });
  }
};

// ======================
// AUTHORIZATION MIDDLEWARE
// ======================

/**
 * Check if user has required roles
 */
export const authorizeRoles = (allowedRoles) => {
  return (req, res, next) => {
    try {
      // Ensure allowedRoles is an array
      if (!Array.isArray(allowedRoles)) {
        console.error('authorizeRoles: allowedRoles is not an array:', allowedRoles);
        return res.status(500).json({
          success: false,
          error: 'Authorization configuration error',
          message: 'Invalid role configuration.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 500
          }
        });
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please login to access this resource.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 401
          }
        });
      }

      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `You don't have permission to perform this action. Required roles: ${allowedRoles.join(', ')}`,
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 403,
            userRole: req.user.role,
            requiredRoles: allowedRoles
          }
        });
      }

      next();
    } catch (error) {
      console.error('Authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization failed',
        message: 'Authorization service error. Please try again.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Check if user has required permissions for specific actions
 */
export const authorizePermissions = (requiredPermissions) => {
  return (req, res, next) => {
    console.log('=== authorizePermissions START ===');
    console.log('Required permissions:', requiredPermissions);
    console.log('User role:', req.user?.role);
    
    try {
      if (!req.user) {
        console.log('=== authorizePermissions ERROR: No user ===');
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please login to access this resource.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 401
          }
        });
      }

      // Super admins (owners) have all permissions
      if (req.user.role === 'SUPER_ADMIN') {
        console.log('=== authorizePermissions END: SUPER_ADMIN access granted ===');
        return next();
      }

      // Check if user has required permissions
      const userPermissions = getUserPermissions(req.user.role);
      console.log('User permissions:', userPermissions);
      
      for (const permission of requiredPermissions) {
        if (!userPermissions.includes(permission)) {
          console.log('=== authorizePermissions ERROR: Permission denied ===');
          return res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            message: `You don't have permission to perform this action. Required permission: ${permission}`,
            meta: {
              timestamp: new Date().toISOString(),
              statusCode: 403,
              userRole: req.user.role,
              requiredPermissions,
              userPermissions
            }
          });
        }
      }

      console.log('=== authorizePermissions END: Access granted ===');
      next();
    } catch (error) {
      console.error('=== authorizePermissions ERROR ===', error);
      return res.status(500).json({
        success: false,
        error: 'Permission check failed',
        message: 'Permission service error. Please try again.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Check if user can access school-specific resources
 */
export const authorizeSchoolAccess = (schoolIdParam = 'schoolId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please login to access this resource.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 401
          }
        });
      }

      const schoolId = req.params[schoolIdParam] || req.body.schoolId || req.query.schoolId;
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          error: 'School ID required',
          message: 'School ID is required for this operation.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400
          }
        });
      }

      // Super admins can access all schools
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check if user belongs to the school
      if (req.user.schoolId && req.user.schoolId.toString() === schoolId.toString()) {
        return next();
      }

      // For school admins, check if they own the school
      if (req.user.role === 'SCHOOL_ADMIN') {
        const school = await prisma.school.findUnique({
          where: { id: BigInt(schoolId) },
          select: { ownerId: true }
        });

        if (school && school.ownerId.toString() === req.user.createdByOwnerId.toString()) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        error: 'School access denied',
        message: 'You don\'t have permission to access this school.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 403,
          userRole: req.user.role,
          userSchoolId: req.user.schoolId,
          requestedSchoolId: schoolId
        }
      });
    } catch (error) {
      console.error('School access check error:', error);
      return res.status(500).json({
        success: false,
        error: 'School access check failed',
        message: 'Access check service error. Please try again.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Check if user can access owner-specific resources
 */
export const authorizeOwnerAccess = (ownerIdParam = 'ownerId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'Please login to access this resource.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 401
          }
        });
      }

      const ownerId = req.params[ownerIdParam] || req.body.ownerId || req.query.ownerId;
      
      if (!ownerId) {
        return res.status(400).json({
          success: false,
          error: 'Owner ID required',
          message: 'Owner ID is required for this operation.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400
          }
        });
      }

      // Super admins can access all owners
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check if user belongs to the owner
      if (req.user.createdByOwnerId && req.user.createdByOwnerId.toString() === ownerId.toString()) {
        return next();
      }

      return res.status(403).json({
        success: false,
        error: 'Owner access denied',
        message: 'You don\'t have permission to access this owner\'s resources.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 403,
          userRole: req.user.role,
          userOwnerId: req.user.createdByOwnerId,
          requestedOwnerId: ownerId
        }
      });
    } catch (error) {
      console.error('Owner access check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Owner access check failed',
        message: 'Access check service error. Please try again.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

// ======================
// PERMISSION UTILITIES
// ======================

/**
 * Get permissions for a specific role
 */
export function getUserPermissions(role) {
  const permissions = {
    'SUPER_ADMIN': [
      // School permissions
      'school:create', 'school:read', 'school:update', 'school:delete', 'school:restore',
      'school:bulk_create', 'school:bulk_update', 'school:bulk_delete',
      'school:export', 'school:import', 'school:analytics', 'school:stats',
      
      // Owner permissions
      'owner:create', 'owner:read', 'owner:update', 'owner:delete', 'owner:restore',
      'owner:bulk_create', 'owner:bulk_update', 'owner:bulk_delete',
      'owner:export', 'owner:import', 'owner:analytics', 'owner:stats',
      
      // User permissions
      'user:create', 'user:read', 'user:update', 'user:delete', 'user:restore',
      'user:bulk_create', 'user:bulk_update', 'user:bulk_delete',
      'user:export', 'user:import', 'user:analytics', 'user:stats',
      
      // System permissions
      'system:cache_manage', 'system:settings', 'system:logs', 'system:backup'
    ],
    
    'SCHOOL_ADMIN': [
      // School permissions (own schools only)
      'school:read', 'school:update', 'school:analytics', 'school:stats',
      'school:export', 'school:import',
      
      // User permissions (own school users)
      'user:create', 'user:read', 'user:update', 'user:delete',
      'user:bulk_create', 'user:bulk_update', 'user:bulk_delete',
      'user:export', 'user:import', 'user:analytics', 'user:stats',
      
      // Academic permissions
      'class:create', 'class:read', 'class:update', 'class:delete',
      'subject:create', 'subject:read', 'subject:update', 'subject:delete',
      'teacher:create', 'teacher:read', 'teacher:update', 'teacher:delete',
      'student:create', 'student:read', 'student:update', 'student:delete',
      'staff:create', 'staff:read', 'staff:update', 'staff:delete',
      'parent:create', 'parent:read', 'parent:update', 'parent:delete',
      
      // Financial permissions
      'payment:create', 'payment:read', 'payment:update', 'payment:delete',
      'fee:create', 'fee:read', 'fee:update', 'fee:delete',
      
      // System permissions (limited)
      'system:cache_view'
    ],
    
    'TEACHER': [
      // Read permissions
      'school:read', 'user:read', 'class:read', 'subject:read',
      'student:read', 'staff:read', 'parent:read',
      
      // Academic permissions
      'attendance:create', 'attendance:read', 'attendance:update',
      'grade:create', 'grade:read', 'grade:update',
      'assignment:create', 'assignment:read', 'assignment:update', 'assignment:delete',
      
      // Limited analytics
      'school:stats', 'user:stats'
    ],
    
    'STUDENT': [
      // Read permissions (own data)
      'school:read', 'user:read', 'class:read', 'subject:read',
      'attendance:read', 'grade:read', 'assignment:read',
      
      // Limited actions
      'assignment:submit', 'user:update_own'
    ],
    
    'STAFF': [
      // Read permissions
      'school:read', 'user:read', 'class:read', 'subject:read',
      'student:read', 'teacher:read',
      
      // Limited permissions
      'attendance:read', 'grade:read', 'assignment:read'
    ],
    
    'PARENT': [
      // Read permissions (children's data)
      'school:read', 'student:read_children', 'attendance:read_children',
      'grade:read_children', 'assignment:read_children', 'parent:read',
      
      // Limited actions
      'user:update_own'
    ],
    
    'ACCOUNTANT': [
      // Financial permissions
      'payment:create', 'payment:read', 'payment:update', 'payment:delete',
      'fee:create', 'fee:read', 'fee:update', 'fee:delete',
      'payroll:create', 'payroll:read', 'payroll:update', 'payroll:delete',
      
      // Read permissions
      'school:read', 'user:read', 'student:read', 'staff:read',
      
      // Financial analytics
      'school:stats', 'payment:analytics'
    ],
    
    'LIBRARIAN': [
      // Library permissions
      'book:create', 'book:read', 'book:update', 'book:delete',
      'book_issue:create', 'book_issue:read', 'book_issue:update', 'book_issue:delete',
      
      // Read permissions
      'school:read', 'user:read', 'student:read', 'staff:read',
      
      // Library analytics
      'book:analytics', 'book:stats'
    ],
    
    'CRM_MANAGER': [
      // Customer management permissions
      'customer:create', 'customer:read', 'customer:update', 'customer:delete',
      'customer:bulk_create', 'customer:bulk_update', 'customer:bulk_delete',
      'customer:export', 'customer:import', 'customer:analytics', 'customer:stats',
      
      // Lead management
      'lead:create', 'lead:read', 'lead:update', 'lead:delete',
      'lead:convert', 'lead:assign', 'lead:analytics',
      
      // Communication permissions
      'communication:create', 'communication:read', 'communication:update',
      'email:send', 'sms:send', 'notification:send',
      
      // Read permissions
      'school:read', 'user:read', 'student:read', 'staff:read',
      
      // CRM analytics
      'customer:analytics', 'lead:analytics', 'communication:analytics'
    ]
  };

  return permissions[role] || [];
}

// ======================
// SPECIALIZED MIDDLEWARE
// ======================

/**
 * Require authentication for all routes
 */
export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: 'Please login to access this resource.',
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 401
      }
    });
  }
  next();
};

/**
 * Check if user is owner
 */
export const requireOwner = (req, res, next) => {
  console.log('🔐 requireOwner middleware - req.user:', req.user ? { id: req.user.id, role: req.user.role, type: req.user.type } : 'NO USER');
  console.log('🔐 requireOwner middleware - user role check:', req.user?.role === 'SUPER_ADMIN');
  
  if (!req.user || req.user.role !== 'SUPER_ADMIN') {
    console.log('❌ requireOwner middleware - ACCESS DENIED');
    return res.status(403).json({
      success: false,
      error: 'Owner access required',
      message: 'This action requires owner privileges.',
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 403,
        userRole: req.user?.role
      }
    });
  }
  console.log('✅ requireOwner middleware - ACCESS GRANTED');
  next();
};

/**
 * Check if user is school admin or owner
 */
export const requireSchoolAdmin = (req, res, next) => {
  if (!req.user || !['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'School admin access required',
      message: 'This action requires school administrator privileges.',
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 403,
        userRole: req.user?.role
      }
    });
  }
  next();
};

/**
 * Check if user is teacher or higher
 */
export const requireTeacher = (req, res, next) => {
  if (!req.user || !['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Teacher access required',
      message: 'This action requires teacher privileges.',
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 403,
        userRole: req.user?.role
      }
    });
  }
  next();
};

// ======================
// AUDIT LOGGING
// ======================

/**
 * Log user actions for audit
 */
export const auditLog = (action, entityType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = async function(data) {
      try {
        if (req.user && (res.statusCode === 200 || res.statusCode === 201)) {
          const responseData = JSON.parse(data);
          
          await prisma.auditLog.create({
            data: {
              action,
              entityType,
              entityId: responseData.data?.id || 0,
              oldData: req.method === 'PUT' || req.method === 'PATCH' ? req.body : null,
              newData: responseData.data,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              ownerId: req.user.type === 'owner' ? req.user.id : null,
              schoolId: req.user.schoolId,
              userId: req.user.type === 'user' ? req.user.id : null,
            }
          });
        }
      } catch (error) {
        console.error('Audit log error:', error);
      }
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// ======================
// ALIAS EXPORTS FOR BACKWARD COMPATIBILITY
// ======================

// Alias for authenticateToken
export const authenticate = authenticateToken;

/**
 * Authorize access to subject resources
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @param {string} paramKey - Name of the parameter containing subject ID
 */
export const authorizeSubjectAccess = (paramKey = 'id') => {
  return async (req, res, next) => {
    try {
      const subjectId = req.params[paramKey];
      if (!subjectId) {
        return res.status(400).json({
          success: false,
          error: 'Subject ID is required',
          message: 'Subject ID parameter is missing',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400,
            param: paramKey
          }
        });
      }

      // Get subject from database
      const subject = await prisma.subject.findUnique({
        where: { id: parseInt(subjectId) },
        select: {
          id: true,
          schoolId: true,
          departmentId: true,
          createdBy: true,
          updatedBy: true
        }
      });

      if (!subject) {
        return res.status(404).json({
          success: false,
          error: 'Subject not found',
          message: 'The requested subject does not exist',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 404,
            subjectId
          }
        });
      }

      // Check if user has permission to access this subject
      const user = req.user;
      const permissions = getUserPermissions(user.role);
      
      // Super admins have access to all subjects
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }

      // School admins can access subjects in their school
      if (user.role === 'SCHOOL_ADMIN' && user.schoolId === subject.schoolId) {
        return next();
      }

      // Teachers can access subjects they teach
      if (user.role === 'TEACHER') {
        // Check if teacher is assigned to this subject
        const teacherSubject = await prisma.teacherSubject.findFirst({
          where: {
            teacherId: user.id,
            subjectId: subject.id
          }
        });

        if (teacherSubject) {
          return next();
        }
      }

      // If none of the above conditions match, deny access
      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this subject',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 403,
          userRole: user.role,
          subjectId
        }
      });

    } catch (error) {
      console.error('Subject access authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization error',
        message: 'An error occurred while checking subject access',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500,
          error: error.message
        }
      });
    }
  };
};

/**
 * Authorize teacher access
 */
export const authorizeTeacherAccess = (paramKey = 'id') => {
  return async (req, res, next) => {
    try {
      const teacherId = req.params[paramKey];
      
      if (!teacherId) {
        return res.status(400).json({
          success: false,
          error: 'Teacher ID required',
          message: 'Teacher ID is required for this operation.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400
          }
        });
      }

      // Super admins can access any teacher
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check if teacher exists and belongs to user's school
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: parseInt(teacherId),
          schoolId: req.user.schoolId,
          deletedAt: null
        },
        select: {
          id: true,
          schoolId: true,
          departmentId: true
        }
      });

      if (!teacher) {
        return res.status(404).json({
          success: false,
          error: 'Teacher not found',
          message: 'Teacher not found or you do not have access to this teacher.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 404
          }
        });
      }

      // School admins can access any teacher in their school
      if (req.user.role === 'SCHOOL_ADMIN' && teacher.schoolId === req.user.schoolId) {
        return next();
      }

      // Teachers can access their own profile
      if (req.user.role === 'TEACHER') {
        const currentTeacher = await prisma.teacher.findFirst({
          where: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            deletedAt: null
          },
          select: { id: true }
        });

        if (currentTeacher && currentTeacher.id === parseInt(teacherId)) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this teacher.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 403,
          userRole: req.user.role,
          teacherId: parseInt(teacherId)
        }
      });
    } catch (error) {
      console.error('Teacher access authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization failed',
        message: 'Failed to verify teacher access permissions.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Authorize student access
 */
export const authorizeStudentAccess = (paramKey = 'id') => {
  return async (req, res, next) => {
    try {
      const studentId = req.params[paramKey];
      
      if (!studentId) {
        return res.status(400).json({
          success: false,
          error: 'Student ID required',
          message: 'Student ID is required for this operation.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400
          }
        });
      }

      // Super admins can access any student
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check if student exists and belongs to user's school
      const student = await prisma.student.findFirst({
        where: {
          id: parseInt(studentId),
          schoolId: req.user.schoolId,
          deletedAt: null
        },
        select: {
          id: true,
          schoolId: true,
          classId: true,
          userId: true
        }
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          error: 'Student not found',
          message: 'Student not found or you do not have access to this student.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 404
          }
        });
      }

      // School admins can access any student in their school
      if (req.user.role === 'SCHOOL_ADMIN' && student.schoolId === req.user.schoolId) {
        return next();
      }

      // Teachers can access students in their classes
      if (req.user.role === 'TEACHER') {
        // Check if teacher is assigned to the student's class
        if (student.classId) {
          const teacherClass = await prisma.teacherClass.findFirst({
            where: {
              teacherId: req.user.id,
              classId: student.classId
            }
          });

          if (teacherClass) {
            return next();
          }
        }
      }

      // Students can access their own profile
      if (req.user.role === 'STUDENT' && student.userId === req.user.id) {
        return next();
      }

      // Parents can access their children
      if (req.user.role === 'PARENT') {
        const parent = await prisma.parent.findFirst({
          where: {
            userId: req.user.id,
            schoolId: req.user.schoolId
          },
          select: { id: true }
        });

        if (parent) {
          const parentStudent = await prisma.student.findFirst({
            where: {
              id: parseInt(studentId),
              parentId: parent.id,
              schoolId: req.user.schoolId,
              deletedAt: null
            },
            select: { id: true }
          });

          if (parentStudent) {
            return next();
          }
        }
      }

      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this student.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 403,
          userRole: req.user.role,
          studentId: parseInt(studentId)
        }
      });
    } catch (error) {
      console.error('Student access authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization failed',
        message: 'Failed to verify student access permissions.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Authorize staff access
 */
export const authorizeStaffAccess = (paramKey = 'id') => {
  return async (req, res, next) => {
    try {
      const staffId = req.params[paramKey];
      
      if (!staffId) {
        return res.status(400).json({
          success: false,
          error: 'Staff ID required',
          message: 'Staff ID is required for this operation.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 400
          }
        });
      }

      // Super admins can access any staff
      if (req.user.role === 'SUPER_ADMIN') {
        return next();
      }

      // Check if staff exists and belongs to user's school
      const staff = await prisma.staff.findFirst({
        where: {
          id: parseInt(staffId),
          schoolId: req.user.schoolId,
          deletedAt: null
        },
        select: {
          id: true,
          schoolId: true,
          userId: true,
          departmentId: true
        }
      });

      if (!staff) {
        return res.status(404).json({
          success: false,
          error: 'Staff not found',
          message: 'Staff not found or you do not have access to this staff member.',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 404
          }
        });
      }

      // School admins can access any staff in their school
      if (req.user.role === 'SCHOOL_ADMIN' && staff.schoolId === req.user.schoolId) {
        return next();
      }

      // Staff can access their own profile
      if (req.user.role === 'STAFF' && staff.userId === req.user.id) {
        return next();
      }

      // Teachers can access staff in their department
      if (req.user.role === 'TEACHER') {
        const teacher = await prisma.teacher.findFirst({
          where: {
            userId: req.user.id,
            schoolId: req.user.schoolId,
            deletedAt: null
          },
          select: { departmentId: true }
        });

        if (teacher && teacher.departmentId && staff.departmentId && teacher.departmentId === staff.departmentId) {
          return next();
        }
      }

      return res.status(403).json({
        success: false,
        error: 'Access denied',
        message: 'You do not have permission to access this staff member.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 403,
          userRole: req.user.role,
          staffId: parseInt(staffId)
        }
      });
    } catch (error) {
      console.error('Staff access authorization error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authorization failed',
        message: 'Failed to verify staff access permissions.',
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 500
        }
      });
    }
  };
};

/**
 * Combined authentication and authorization middleware
 * @param {Array} allowedRoles - Array of allowed roles (optional)
 * @param {Array} requiredPermissions - Array of required permissions (optional)
 * @param {Object} options - Additional options (schoolIdParam, ownerIdParam, etc.)
 */
export const authorize = (allowedRoles = [], requiredPermissions = [], options = {}) => {
  return (req, res, next) => {
    // First authenticate the token
    authenticateToken(req, res, (err) => {
      if (err) return next(err);
      
      // If no authorization requirements, just continue
      if (allowedRoles.length === 0 && requiredPermissions.length === 0) {
        return next();
      }

      try {
        // Check roles if specified
        if (allowedRoles.length > 0) {
          const roleCheck = authorizeRoles(allowedRoles);
          roleCheck(req, res, (err) => {
            if (err) return next(err);
            
            // Check permissions if specified
            if (requiredPermissions.length > 0) {
              const permissionCheck = authorizePermissions(requiredPermissions);
              permissionCheck(req, res, (err) => {
                if (err) return next(err);
                next();
              });
            } else {
              next();
            }
          });
        } else {
          // Check permissions if specified
          if (requiredPermissions.length > 0) {
            const permissionCheck = authorizePermissions(requiredPermissions);
            permissionCheck(req, res, (err) => {
              if (err) return next(err);
              next();
            }
            );
          } else {
            next();
          }
        }
      } catch (error) {
        console.error('Authorization error:', error);
        return res.status(500).json({
          success: false,
          error: 'Authorization failed',
          message: 'An error occurred during authorization',
          meta: {
            timestamp: new Date().toISOString(),
            statusCode: 500
          }
        });
      }
    });
  };
};

export default {
  authenticateToken,
  authenticate, // Add the alias to default export
  authorizeRoles,
  authorizePermissions,
  authorizeSchoolAccess,
  authorizeOwnerAccess,
  requireAuth,
  requireOwner,
  requireSchoolAdmin,
  requireTeacher,
  auditLog,
  authorize,
  getUserPermissions,
  authorizeSubjectAccess,
  authorizeTeacherAccess,
  authorizeStudentAccess,
  authorizeStaffAccess
};

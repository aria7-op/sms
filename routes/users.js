import express from 'express';
import * as userController from '../controllers/userController.js';
import { 
  authenticateToken, 
  authorizeRoles, 
  authorizePermissions,
  requireOwner,
  requireSchoolAdmin,
  requireTeacher,
  auditLog 
} from '../middleware/auth.js';
import {
  generalLimiter,
  authLimiter,
  bulkLimiter,
  exportLimiter,
  fileUploadLimiter,
  roleBasedLimiter,
  defaultRoleLimits,
} from '../middleware/rateLimit.js';
import { validateRequest } from '../middleware/validation.js';
import {
  UserCreateSchema,
  UserUpdateSchema,
  UserSearchSchema,
  UserAuthSchema,
  UserPasswordChangeSchema,
  UserProfileUpdateSchema,
  UserBulkCreateSchema,
  UserBulkUpdateSchema,
  UserImportSchema,
  UserExportSchema,
  UserAnalyticsSchema,
  UserPerformanceSchema,
} from '../utils/userSchemas.js';

const router = express.Router();

// ======================
// AUTHENTICATION ROUTES
// ======================

/**
 * @route POST /api/users/login
 * @desc Universal login for users and owners
 * @access Public
 */
router.post('/login', 
  authLimiter,
  validateRequest(UserAuthSchema),
  userController.loginUser
);

/**
 * @route POST /api/users/logout
 * @desc User logout
 * @access Private
 */
router.post('/logout',
  authenticateToken,
  userController.logoutUser
);

/**
 * @route POST /api/users/change-password
 * @desc Change user password
 * @access Private
 */
router.post('/change-password',
  authenticateToken,
  validateRequest(UserPasswordChangeSchema),
  userController.changePassword
);

// ======================
// CRUD ROUTES
// ======================

/**
 * @route POST /api/users
 * @desc Create a new user
 * @access Private (Owner, School Admin)
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  userController.createUser
);

/**
 * @route GET /api/users
 * @desc Get users with pagination and filters
 * @access Private
 */
router.get('/',
  authenticateToken,
  generalLimiter,
  validateRequest(UserSearchSchema, 'query'),
  userController.getUsers
);

/**
 * @route GET /api/users/search
 * @desc Search users with advanced filters
 * @access Private
 */
router.get('/search',
  authenticateToken,
  generalLimiter,
  validateRequest(UserSearchSchema, 'query'),
  userController.searchUsers
);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Private
 */
router.get('/:id',
  authenticateToken,
  generalLimiter,
  userController.getUserById
);

/**
 * @route PUT /api/users/:id
 * @desc Update user
 * @access Private (Owner, School Admin, Self)
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  validateRequest(UserUpdateSchema),
  userController.updateUser
);

/**
 * @route PATCH /api/users/:id/profile
 * @desc Update user profile (self)
 * @access Private (Self)
 */
router.patch('/:id/profile',
  authenticateToken,
  generalLimiter,
  validateRequest(UserProfileUpdateSchema),
  userController.updateUser
);

/**
 * @route DELETE /api/users/:id
 * @desc Delete user (soft delete)
 * @access Private (Owner, School Admin)
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  userController.deleteUser
);

/**
 * @route PATCH /api/users/:id/restore
 * @desc Restore deleted user
 * @access Private (Owner, School Admin)
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  userController.restoreUser
);

// ======================
// BULK OPERATIONS ROUTES
// ======================

/**
 * @route POST /api/users/bulk/create
 * @desc Bulk create users
 * @access Private (Owner, School Admin)
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  bulkLimiter,
  validateRequest(UserBulkCreateSchema),
  userController.bulkCreateUsers
);

/**
 * @route PUT /api/users/bulk/update
 * @desc Bulk update users
 * @access Private (Owner, School Admin)
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  bulkLimiter,
  validateRequest(UserBulkUpdateSchema),
  userController.bulkUpdateUsers
);

/**
 * @route DELETE /api/users/bulk/delete
 * @desc Bulk delete users
 * @access Private (Owner, School Admin)
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  bulkLimiter,
  userController.bulkDeleteUsers
);

// ======================
// ANALYTICS & STATISTICS ROUTES
// ======================

/**
 * @route GET /api/users/:id/stats
 * @desc Get user statistics
 * @access Private (Self, Owner, School Admin)
 */
router.get('/:id/stats',
  authenticateToken,
  generalLimiter,
  userController.getUserStats
);

/**
 * @route GET /api/users/:id/analytics
 * @desc Get user analytics
 * @access Private (Self, Owner, School Admin)
 */
router.get('/:id/analytics',
  authenticateToken,
  generalLimiter,
  validateRequest(UserAnalyticsSchema, 'query'),
  userController.getUserAnalytics
);

/**
 * @route GET /api/users/:id/performance
 * @desc Get user performance metrics
 * @access Private (Self, Owner, School Admin, Teacher)
 */
router.get('/:id/performance',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  generalLimiter,
  validateRequest(UserPerformanceSchema, 'query'),
  userController.getUserPerformance
);

// ======================
// EXPORT & IMPORT ROUTES
// ======================

/**
 * @route GET /api/users/export
 * @desc Export users data
 * @access Private (Owner, School Admin)
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  exportLimiter,
  validateRequest(UserExportSchema, 'query'),
  userController.exportUsers
);

/**
 * @route POST /api/users/import
 * @desc Import users data
 * @access Private (Owner, School Admin)
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  fileUploadLimiter,
  validateRequest(UserImportSchema),
  userController.importUsers
);

// ======================
// UTILITY ROUTES
// ======================

/**
 * @route GET /api/users/username-suggestions
 * @desc Generate username suggestions
 * @access Private
 */
router.get('/username-suggestions',
  authenticateToken,
  generalLimiter,
  userController.generateUsernameSuggestions
);

/**
 * @route GET /api/users/counts/by-role
 * @desc Get user count by role
 * @access Private (Owner, School Admin)
 */
router.get('/counts/by-role',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  userController.getUserCountByRole
);

/**
 * @route GET /api/users/counts/by-status
 * @desc Get user count by status
 * @access Private (Owner, School Admin)
 */
router.get('/counts/by-status',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  userController.getUserCountByStatus
);

// ======================
// SCHOOL-SPECIFIC ROUTES
// ======================

/**
 * @route GET /api/schools/:schoolId/users
 * @desc Get users by school
 * @access Private (Owner, School Admin)
 */
router.get('/schools/:schoolId/users',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  userController.getUsersBySchool
);

// ======================
// ROLE-SPECIFIC ROUTES
// ======================

/**
 * @route GET /api/users/role/:role
 * @desc Get users by role
 * @access Private (Owner, School Admin)
 */
router.get('/role/:role',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  userController.getUsersByRole
);

/**
 * @route GET /api/users/status/:status
 * @desc Get users by status
 * @access Private (Owner, School Admin)
 */
router.get('/status/:status',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  generalLimiter,
  userController.getUsersByStatus
);

// ======================
// ROLE-BASED RATE LIMITING
// ======================

// Apply role-based rate limiting to all routes
router.use(roleBasedLimiter(defaultRoleLimits));

// ======================
// AUDIT LOGGING MIDDLEWARE
// ======================

/**
 * @desc Log all user operations for audit
 * @access Private
 */
router.use(auditLog);

// ======================
// ERROR HANDLING MIDDLEWARE
// ======================

// Handle 404 for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 404,
      method: req.method,
      path: req.originalUrl
    }
  });
});

// Global error handler
router.use((error, req, res, next) => {
  console.error('User route error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message,
    meta: {
      timestamp: new Date().toISOString(),
      statusCode: 500,
      method: req.method,
      path: req.originalUrl
    }
  });
});

export default router; 
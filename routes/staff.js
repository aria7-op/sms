import express from 'express';
import { z } from 'zod';
import staffController from '../controllers/staffController.js';
import { 
  staffCacheMiddleware, 
  staffByIdCacheMiddleware,
  staffStatsCacheMiddleware,
  staffAnalyticsCacheMiddleware,
  staffPerformanceCacheMiddleware,
  staffSearchCacheMiddleware,
  staffBySchoolCacheMiddleware,
  staffCountCacheMiddleware
} from '../cache/staffCache.js';
import { 
  authenticateToken, 
  authorizeRoles, 
  authorizePermissions,
  authorizeSchoolAccess,
  authorizeStaffAccess,
  auditLog
} from '../middleware/auth.js';
import { 
  validateRequest, 
  validateParams, 
  validateBody,
  validateQuery,
  sanitizeRequest,
  idSchema,
  paginationSchema
} from '../middleware/validation.js';
import { 
  generalLimiter,
  staffCreateLimiter,
  staffSearchLimiter,
  exportLimiter,
  bulkLimiter,
  analyticsLimiter,
  cacheLimiter,
  roleBasedLimiter,
  defaultRoleLimits
} from '../middleware/rateLimit.js';
import { 
  StaffCreateSchema, 
  StaffUpdateSchema, 
  StaffSearchSchema,
  StaffBulkCreateSchema,
  StaffBulkUpdateSchema,
  StaffBulkDeleteSchema
} from '../utils/staffUtils.js';

const router = express.Router();

// ======================
// GLOBAL MIDDLEWARE
// ======================

// Apply sanitization to all routes
router.use(sanitizeRequest);

// Apply general rate limiting
router.use(generalLimiter);

// Apply role-based rate limiting
router.use(roleBasedLimiter(defaultRoleLimits));

// ======================
// CRUD OPERATIONS
// ======================

/**
 * @route   POST /api/staff
 * @desc    Create a new staff member
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    StaffCreateSchema
 * @permissions staff:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:create']),
  staffCreateLimiter,
  validateBody(StaffCreateSchema),
  auditLog('CREATE', 'Staff'),
  staffController.createStaff
);

/**
 * @route   GET /api/staff
 * @desc    Get staff with pagination and filters
 * @access  Private (All authenticated users)
 * @query   StaffSearchSchema
 * @permissions staff:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['staff:read']),
  staffSearchLimiter,
  (req, res, next) => {
    console.log('convert page/limit: start');
    if (req.query.page) req.query.page = Number(req.query.page);
    if (req.query.limit) req.query.limit = Number(req.query.limit);
    next();
  },
  validateQuery(StaffSearchSchema),
  staffCacheMiddleware,
  staffController.getStaff
);

/**
 * @route   GET /api/staff/:id
 * @desc    Get staff by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Staff ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions staff:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffByIdCacheMiddleware,
  staffController.getStaffById
);

/**
 * @route   PUT /api/staff/:id
 * @desc    Update staff
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Staff ID
 * @body    StaffUpdateSchema
 * @permissions staff:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  validateBody(StaffUpdateSchema),
  authorizeStaffAccess('id'),
  auditLog('UPDATE', 'Staff'),
  staffController.updateStaff
);

/**
 * @route   DELETE /api/staff/:id
 * @desc    Delete staff (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Staff ID
 * @permissions staff:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:delete']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  auditLog('DELETE', 'Staff'),
  staffController.deleteStaff
);

/**
 * @route   PATCH /api/staff/:id/restore
 * @desc    Restore deleted staff
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Staff ID
 * @permissions staff:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:restore']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  auditLog('RESTORE', 'Staff'),
  staffController.restoreStaff
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/staff/:id/stats
 * @desc    Get staff statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Staff ID
 * @permissions staff:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffStatsCacheMiddleware,
  staffController.getStaffStats
);

/**
 * @route   GET /api/staff/:id/analytics
 * @desc    Get staff analytics
 * @access  Private (All authenticated users)
 * @params  {id} - Staff ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions staff:analytics
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['staff:analytics']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  analyticsLimiter,
  staffAnalyticsCacheMiddleware,
  staffController.getStaffAnalytics
);

/**
 * @route   GET /api/staff/:id/performance
 * @desc    Get staff performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Staff ID
 * @permissions staff:analytics
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['staff:analytics']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffPerformanceCacheMiddleware,
  staffController.getStaffPerformance
);

/**
 * @route   GET /api/staff/:id/dashboard
 * @desc    Get staff dashboard with comprehensive data
 * @access  Private (All authenticated users)
 * @params  {id} - Staff ID
 * @permissions staff:read
 */
router.get('/:id/dashboard',
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffDashboard
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/staff/bulk/create
 * @desc    Bulk create staff members
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    StaffBulkCreateSchema
 * @permissions staff:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:create']),
  bulkLimiter,
  validateBody(StaffBulkCreateSchema),
  auditLog('BULK_CREATE', 'Staff'),
  staffController.bulkCreateStaff
);

/**
 * @route   PUT /api/staff/bulk/update
 * @desc    Bulk update staff members
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    StaffBulkUpdateSchema
 * @permissions staff:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:update']),
  bulkLimiter,
  validateBody(StaffBulkUpdateSchema),
  auditLog('BULK_UPDATE', 'Staff'),
  staffController.bulkUpdateStaff
);

/**
 * @route   DELETE /api/staff/bulk/delete
 * @desc    Bulk delete staff members
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    StaffBulkDeleteSchema
 * @permissions staff:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:delete']),
  bulkLimiter,
  validateBody(StaffBulkDeleteSchema),
  auditLog('BULK_DELETE', 'Staff'),
  staffController.bulkDeleteStaff
);

// ======================
// SEARCH & EXPORT
// ======================

/**
 * @route   GET /api/staff/search/advanced
 * @desc    Advanced staff search
 * @access  Private (All authenticated users)
 * @query   StaffSearchSchema
 * @permissions staff:read
 */
router.get('/search/advanced',
  authenticateToken,
  authorizePermissions(['staff:read']),
  staffSearchLimiter,
  validateQuery(StaffSearchSchema),
  staffSearchCacheMiddleware,
  staffController.searchStaff
);

/**
 * @route   GET /api/staff/export
 * @desc    Export staff data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (csv, excel, pdf)
 * @query   StaffSearchSchema
 * @permissions staff:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:export']),
  exportLimiter,
  validateQuery(StaffSearchSchema),
  staffController.exportStaff
);

/**
 * @route   POST /api/staff/import
 * @desc    Import staff data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    FormData with file
 * @permissions staff:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['staff:import']),
  bulkLimiter,
  auditLog('IMPORT', 'Staff'),
  staffController.importStaff
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/staff/suggestions/employee-id
 * @desc    Generate employee ID suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {designation} - Staff designation for ID generation
 * @permissions staff:create
 */
router.get('/suggestions/employee-id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:create']),
  staffController.generateEmployeeIdSuggestions
);

/**
 * @route   GET /api/staff/stats/department
 * @desc    Get staff count by department
 * @access  Private (All authenticated users)
 * @permissions staff:read
 */
router.get('/stats/department',
  authenticateToken,
  authorizePermissions(['staff:read']),
  staffCountCacheMiddleware,
  staffController.getStaffCountByDepartment
);

/**
 * @route   GET /api/staff/stats/designation
 * @desc    Get staff count by designation
 * @access  Private (All authenticated users)
 * @permissions staff:read
 */
router.get('/stats/designation',
  authenticateToken,
  authorizePermissions(['staff:read']),
  staffCountCacheMiddleware,
  staffController.getStaffCountByDesignation
);

/**
 * @route   GET /api/staff/school/:schoolId
 * @desc    Get staff by school
 * @access  Private (All authenticated users)
 * @params  {schoolId} - School ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions staff:read
 */
router.get('/school/:schoolId',
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams({ schoolId: idSchema.shape.id }),
  authorizeSchoolAccess('schoolId'),
  staffBySchoolCacheMiddleware,
  staffController.getStaffBySchool
);

/**
 * @route   GET /api/staff/department/:departmentId
 * @desc    Get staff by department
 * @access  Private (All authenticated users)
 * @params  {departmentId} - Department ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions staff:read
 */
router.get('/department/:departmentId',
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams({ departmentId: idSchema.shape.id }),
  staffController.getStaffByDepartment
);

// ======================
// ADVANCED FEATURES
// ======================

/**
 * @route   GET /api/staff/report
 * @desc    Generate comprehensive staff report
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {...StaffSearchSchema} - Filters for report
 * @permissions staff:report
 */
router.get('/report',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:report']),
  staffController.getStaffReport
);

/**
 * @route   GET /api/staff/comparison
 * @desc    Compare multiple staff members
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {staffIds} - Array of staff IDs to compare
 * @permissions staff:read
 */
router.get('/comparison',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['staff:read']),
  staffController.getStaffComparison
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/staff/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  staffController.getCacheStats
);

/**
 * @route   POST /api/staff/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {staffId?} - Optional specific staff ID to warm
 * @body    {schoolId?} - Optional school ID to warm all staff
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  staffController.warmCache
);

/**
 * @route   DELETE /api/staff/cache/clear
 * @desc    Clear cache
 * @access  Private (SUPER_ADMIN)
 * @query   {all} - Clear all cache (not just school-specific)
 * @permissions system:cache_manage
 */
router.delete('/cache/clear',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  staffController.clearCache
);

// ======================
// COLLABORATION ROUTES
// ======================
router.get('/:id/collaboration', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffCollaboration
);
router.post('/:id/collaboration', 
  authenticateToken,
  authorizePermissions(['staff:create']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.createStaffCollaboration
);
router.put('/:id/collaboration/:collaborationId', 
  authenticateToken,
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.updateStaffCollaboration
);
router.delete('/:id/collaboration/:collaborationId', 
  authenticateToken,
  authorizePermissions(['staff:delete']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.deleteStaffCollaboration
);
router.get('/:id/collaboration/projects', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffProjects
);
router.post('/:id/collaboration/projects', 
  authenticateToken,
  authorizePermissions(['staff:create']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.createStaffProject
);
router.get('/:id/collaboration/teams', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffTeams
);
router.post('/:id/collaboration/teams', 
  authenticateToken,
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.assignStaffToTeam
);
router.get('/:id/collaboration/meetings', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffMeetings
);
router.post('/:id/collaboration/meetings', 
  authenticateToken,
  authorizePermissions(['staff:create']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.scheduleStaffMeeting
);

// ======================
// DOCUMENTS ROUTES
// ======================
router.get('/:id/documents', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffDocuments
);
router.post('/:id/documents', 
  authenticateToken,
  authorizePermissions(['staff:create']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.uploadStaffDocument
);
router.get('/:id/documents/:documentId', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffDocument
);
router.put('/:id/documents/:documentId', 
  authenticateToken,
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.updateStaffDocument
);
router.delete('/:id/documents/:documentId', 
  authenticateToken,
  authorizePermissions(['staff:delete']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.deleteStaffDocument
);
router.get('/:id/documents/categories', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getDocumentCategories
);
router.post('/:id/documents/categories', 
  authenticateToken,
  authorizePermissions(['staff:create']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.createDocumentCategory
);
router.get('/:id/documents/search', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.searchStaffDocuments
);
router.post('/:id/documents/verify', 
  authenticateToken,
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.verifyStaffDocument
);
router.get('/:id/documents/expiring', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getExpiringDocuments
);

// ======================
// TASKS ROUTES
// ======================
router.get('/:id/tasks', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffTasks
);
router.post('/:id/tasks', 
  authenticateToken,
  authorizePermissions(['staff:create']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.createStaffTask
);
router.get('/:id/tasks/:taskId', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getStaffTask
);
router.put('/:id/tasks/:taskId', 
  authenticateToken,
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.updateStaffTask
);
router.delete('/:id/tasks/:taskId', 
  authenticateToken,
  authorizePermissions(['staff:delete']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.deleteStaffTask
);
router.post('/:id/tasks/:taskId/assign', 
  authenticateToken,
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.assignStaffTask
);
router.post('/:id/tasks/:taskId/complete', 
  authenticateToken,
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.completeStaffTask
);
router.get('/:id/tasks/overdue', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getOverdueTasks
);
router.get('/:id/tasks/completed', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getCompletedTasks
);
router.get('/:id/tasks/statistics', 
  authenticateToken,
  authorizePermissions(['staff:read']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.getTaskStatistics
);
router.post('/:id/tasks/bulk-assign', 
  authenticateToken,
  authorizePermissions(['staff:update']),
  validateParams(idSchema),
  authorizeStaffAccess('id'),
  staffController.bulkAssignTasks
);

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
      method: req.method,
      url: req.originalUrl
    }
  });
});

// Global error handler
router.use((error, req, res, next) => {
  console.error('Staff route error:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    meta: {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  });
});

export default router; 
import express from 'express';
import { z } from 'zod';
import parentController from '../controllers/parentController.js';
import { 
  parentCacheMiddleware, 
  parentByIdCacheMiddleware,
  parentStatsCacheMiddleware,
  parentAnalyticsCacheMiddleware,
  parentPerformanceCacheMiddleware,
  parentSearchCacheMiddleware,
  parentBySchoolCacheMiddleware
} from '../cache/parentCache.js';
import { 
  authenticateToken, 
  authorizeRoles, 
  authorizePermissions,
  authorizeSchoolAccess,
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
  exportLimiter,
  bulkLimiter,
  analyticsLimiter,
  cacheLimiter,
  roleBasedLimiter,
  defaultRoleLimits,
  parentSearchLimiter
} from '../middleware/rateLimit.js';
import { 
  ParentCreateSchema, 
  ParentCreateWithUserSchema,
  ParentUpdateSchema, 
  ParentSearchSchema, 
  ParentBulkCreateSchema, 
  ParentBulkUpdateSchema, 
  ParentBulkDeleteSchema 
} from '../utils/parentUtils.js';

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
 * @route   POST /api/parents
 * @desc    Create a new parent
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    ParentCreateSchema
 * @permissions parent:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['parent:create']),
  validateBody(ParentCreateWithUserSchema),
  auditLog('CREATE', 'Parent'),
  parentController.createParent.bind(parentController)
);

/**
 * @route   GET /api/parents
 * @desc    Get parents with pagination and filters
 * @access  Private (All authenticated users)
 * @query   ParentSearchSchema
 * @permissions parent:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateQuery(ParentSearchSchema),
  parentCacheMiddleware(),
  parentController.getParents.bind(parentController)
);

/**
 * @route   GET /api/parents/:id
 * @desc    Get parent by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Parent ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions parent:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentByIdCacheMiddleware(),
  parentController.getParentById.bind(parentController)
);

/**
 * @route   PUT /api/parents/:id
 * @desc    Update parent
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, PARENT)
 * @params  {id} - Parent ID
 * @body    ParentUpdateSchema
 * @permissions parent:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'PARENT']),
  authorizePermissions(['parent:update']),
  validateParams(idSchema),
  validateBody(ParentUpdateSchema),
  auditLog('UPDATE', 'Parent'),
  parentController.updateParent.bind(parentController)
);

/**
 * @route   DELETE /api/parents/:id
 * @desc    Delete parent (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:delete']),
  validateParams(idSchema),
  auditLog('DELETE', 'Parent'),
  parentController.deleteParent.bind(parentController)
);

/**
 * @route   PATCH /api/parents/:id/restore
 * @desc    Restore deleted parent
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:restore']),
  validateParams(idSchema),
  auditLog('RESTORE', 'Parent'),
  parentController.restoreParent.bind(parentController)
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/parents/:id/stats
 * @desc    Get parent statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Parent ID
 * @permissions parent:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentStatsCacheMiddleware(),
  parentController.getParentStats.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/analytics
 * @desc    Get parent analytics
 * @access  Private (All authenticated users)
 * @params  {id} - Parent ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions parent:analytics
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['parent:analytics']),
  validateParams(idSchema),
  analyticsLimiter,
  parentAnalyticsCacheMiddleware(),
  parentController.getParentAnalytics.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/performance
 * @desc    Get parent performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Parent ID
 * @permissions parent:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentPerformanceCacheMiddleware(),
  parentController.getParentPerformance.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/dashboard
 * @desc    Get parent dashboard with comprehensive data
 * @access  Private (All authenticated users)
 * @params  {id} - Parent ID
 * @permissions parent:read
 */
router.get('/:id/dashboard',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentDashboard.bind(parentController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/parents/bulk/create
 * @desc    Bulk create parents
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    ParentBulkCreateSchema
 * @permissions parent:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:create']),
  bulkLimiter,
  validateBody(ParentBulkCreateSchema),
  auditLog('BULK_CREATE', 'Parent'),
  parentController.bulkCreateParents.bind(parentController)
);

/**
 * @route   PUT /api/parents/bulk/update
 * @desc    Bulk update parents
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    ParentBulkUpdateSchema
 * @permissions parent:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:update']),
  bulkLimiter,
  validateBody(ParentBulkUpdateSchema),
  auditLog('BULK_UPDATE', 'Parent'),
  parentController.bulkUpdateParents.bind(parentController)
);

/**
 * @route   DELETE /api/parents/bulk/delete
 * @desc    Bulk delete parents
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    ParentBulkDeleteSchema
 * @permissions parent:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:delete']),
  bulkLimiter,
  validateBody(ParentBulkDeleteSchema),
  auditLog('BULK_DELETE', 'Parent'),
  parentController.bulkDeleteParents.bind(parentController)
);

// ======================
// SEARCH & FILTER
// ======================

/**
 * @route   GET /api/parents/search
 * @desc    Search parents with advanced filters
 * @access  Private (All authenticated users)
 * @query   {q} - Search query (minimum 2 characters)
 * @query   {include} - Comma-separated list of relations to include
 * @permissions parent:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentSearchLimiter,
  parentSearchCacheMiddleware(),
  parentController.searchParents.bind(parentController)
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/parents/export
 * @desc    Export parents data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...ParentSearchSchema} - Filters for export
 * @permissions parent:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:export']),
  exportLimiter,
  parentController.exportParents.bind(parentController)
);

/**
 * @route   POST /api/parents/import
 * @desc    Import parents data
 * @access  Private (SUPER_ADMIN)
 * @body    {parents: ParentCreateSchema[], user: User}
 * @permissions parent:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['parent:import']),
  bulkLimiter,
  auditLog('IMPORT', 'Parent'),
  parentController.importParents.bind(parentController)
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/parents/suggestions/code
 * @desc    Generate parent code suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @query   {name} - Parent name for code generation
 * @permissions parent:create
 */
router.get('/suggestions/code',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['parent:create']),
  parentController.generateCodeSuggestions.bind(parentController)
);

/**
 * @route   GET /api/parents/stats/income-range
 * @desc    Get parent count by income range
 * @access  Private (All authenticated users)
 * @permissions parent:read
 */
router.get('/stats/income-range',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentCountByIncomeRange.bind(parentController)
);

/**
 * @route   GET /api/parents/stats/education
 * @desc    Get parent count by education
 * @access  Private (All authenticated users)
 * @permissions parent:read
 */
router.get('/stats/education',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentCountByEducation.bind(parentController)
);

/**
 * @route   GET /api/parents/school/:schoolId
 * @desc    Get parents by school
 * @access  Private (All authenticated users)
 * @params  {schoolId} - School ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions parent:read
 */
router.get('/school/:schoolId',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams({ schoolId: idSchema.shape.id }),
  authorizeSchoolAccess('schoolId'),
  parentBySchoolCacheMiddleware(),
  parentController.getParentsBySchool.bind(parentController)
);

/**
 * @route   GET /api/parents/report
 * @desc    Generate comprehensive parent report
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {...ParentSearchSchema} - Filters for report
 * @permissions parent:report
 */
router.get('/report',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:report']),
  analyticsLimiter,
  parentController.getParentReport.bind(parentController)
);

/**
 * @route   GET /api/parents/comparison
 * @desc    Compare multiple parents
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {parentIds} - Array of parent IDs to compare
 * @permissions parent:read
 */
router.get('/comparison',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:read']),
  analyticsLimiter,
  parentController.getParentComparison.bind(parentController)
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/parents/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  parentController.getCacheStats.bind(parentController)
);

/**
 * @route   POST /api/parents/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {parentId?} - Optional specific parent ID to warm
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  parentController.warmCache.bind(parentController)
);

/**
 * @route   DELETE /api/parents/cache/clear
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
  parentController.clearCache.bind(parentController)
);

// ======================
// ADVANCED FEATURES
// ======================

/**
 * @route   GET /api/parents/analytics/overview
 * @desc    Get comprehensive parent analytics overview
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions parent:analytics
 */
router.get('/analytics/overview',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:analytics']),
  analyticsLimiter,
  parentController.getParentReport.bind(parentController)
);

/**
 * @route   GET /api/parents/performance/leaderboard
 * @desc    Get parent performance leaderboard
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {limit} - Number of top parents to return
 * @query   {metric} - Performance metric (payment_rate, student_performance, overall)
 * @permissions parent:read
 */
router.get('/performance/leaderboard',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['parent:read']),
  analyticsLimiter,
  parentController.getParentReport.bind(parentController)
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
  console.error('Parent route error:', error);
  
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
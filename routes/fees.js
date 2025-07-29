import express from 'express';
import { z } from 'zod';
import feeController from '../controllers/feeController.js';
import { 
  feeCacheMiddleware, 
  feeByIdCacheMiddleware,
  feeStatsCacheMiddleware,
  feeAnalyticsCacheMiddleware,
  feeStructureCacheMiddleware,
  feeItemsCacheMiddleware,
  feeAssignmentsCacheMiddleware
} from '../cache/feeCache.js';
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
  feeSearchLimiter
} from '../middleware/rateLimit.js';
import { 
  FeeStructureCreateSchema, 
  FeeStructureUpdateSchema, 
  FeeItemCreateSchema,
  FeeItemUpdateSchema,
  FeeAssignmentSchema,
  FeeSearchSchema,
  FeeBulkCreateSchema,
  FeeBulkUpdateSchema,
  FeeBulkDeleteSchema
} from '../utils/feeUtils.js';

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
// FEE STRUCTURE CRUD
// ======================

/**
 * @route   POST /api/fee/structures
 * @desc    Create a new fee structure
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @body    FeeStructureCreateSchema
 * @permissions fee:create
 */
router.post('/structures',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:create']),
  validateBody(FeeStructureCreateSchema),
  auditLog('CREATE', 'FeeStructure'),
  feeController.createFeeStructure
);

/**
 * @route   GET /api/fee/structures
 * @desc    Get fee structures with pagination and filters
 * @access  Private (All authenticated users)
 * @query   FeeSearchSchema
 * @permissions fee:read
 */
router.get('/structures',
  authenticateToken,
  authorizePermissions(['fee:read']),
  validateQuery(FeeSearchSchema),
  feeCacheMiddleware(),
  feeController.getFeeStructures
);

/**
 * @route   GET /api/fee/structures/:id
 * @desc    Get fee structure by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Fee Structure ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions fee:read
 */
router.get('/structures/:id',
  authenticateToken,
  authorizePermissions(['fee:read']),
  validateParams(idSchema),
  feeByIdCacheMiddleware(),
  feeController.getFeeStructureById
);

/**
 * @route   PUT /api/fee/structures/:id
 * @desc    Update fee structure
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @params  {id} - Fee Structure ID
 * @body    FeeStructureUpdateSchema
 * @permissions fee:update
 */
router.put('/structures/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:update']),
  validateParams(idSchema),
  validateBody(FeeStructureUpdateSchema),
  auditLog('UPDATE', 'FeeStructure'),
  feeController.updateFeeStructure
);

/**
 * @route   DELETE /api/fee/structures/:id
 * @desc    Delete fee structure (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Fee Structure ID
 * @permissions fee:delete
 */
router.delete('/structures/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:delete']),
  validateParams(idSchema),
  auditLog('DELETE', 'FeeStructure'),
  feeController.deleteFeeStructure
);

/**
 * @route   PATCH /api/fee/structures/:id/restore
 * @desc    Restore deleted fee structure
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Fee Structure ID
 * @permissions fee:restore
 */
router.patch('/structures/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:restore']),
  validateParams(idSchema),
  auditLog('RESTORE', 'FeeStructure'),
  feeController.restoreFeeStructure
);

// ======================
// FEE ITEMS MANAGEMENT
// ======================

/**
 * @route   POST /api/fee/structures/:id/items
 * @desc    Add item to fee structure
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @params  {id} - Fee Structure ID
 * @body    FeeItemCreateSchema
 * @permissions fee:update
 */
router.post('/structures/:id/items',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:update']),
  validateParams(idSchema),
  validateBody(FeeItemCreateSchema),
  auditLog('ADD_ITEM', 'FeeStructure'),
  feeController.addFeeItem
);

/**
 * @route   PUT /api/fee/items/:itemId
 * @desc    Update fee item
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @params  {itemId} - Fee Item ID
 * @body    FeeItemUpdateSchema
 * @permissions fee:update
 */
router.put('/items/:itemId',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:update']),
  validateParams({ itemId: idSchema.shape.id }),
  validateBody(FeeItemUpdateSchema),
  auditLog('UPDATE_ITEM', 'FeeItem'),
  feeController.updateFeeItem
);

/**
 * @route   DELETE /api/fee/items/:itemId
 * @desc    Delete fee item (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {itemId} - Fee Item ID
 * @permissions fee:update
 */
router.delete('/items/:itemId',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:update']),
  validateParams({ itemId: idSchema.shape.id }),
  auditLog('DELETE_ITEM', 'FeeItem'),
  feeController.deleteFeeItem
);

// ======================
// FEE ASSIGNMENTS
// ======================

/**
 * @route   POST /api/fee/structures/:id/assign
 * @desc    Assign fee structure to class or student
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Fee Structure ID
 * @body    FeeAssignmentSchema
 * @permissions fee:assign
 */
router.post('/structures/:id/assign',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:assign']),
  validateParams(idSchema),
  validateBody(FeeAssignmentSchema),
  auditLog('ASSIGN', 'FeeStructure'),
  feeController.assignFeeStructure
);

/**
 * @route   GET /api/fee/structures/:id/assignments
 * @desc    Get fee structure assignments
 * @access  Private (All authenticated users)
 * @params  {id} - Fee Structure ID
 * @permissions fee:read
 */
router.get('/structures/:id/assignments',
  authenticateToken,
  authorizePermissions(['fee:read']),
  validateParams(idSchema),
  feeAssignmentsCacheMiddleware(),
  feeController.getFeeAssignments
);

/**
 * @route   DELETE /api/fee/assignments/:assignmentId
 * @desc    Remove fee structure assignment
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {assignmentId} - Assignment ID
 * @permissions fee:assign
 */
router.delete('/assignments/:assignmentId',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:assign']),
  validateParams({ assignmentId: idSchema.shape.id }),
  auditLog('UNASSIGN', 'FeeStructure'),
  feeController.removeAssignment
);

// ======================
// STUDENT FEE STRUCTURES
// ======================

/**
 * @route   GET /api/fee/students/:studentId/structures
 * @desc    Get applicable fee structures for a student
 * @access  Private (All authenticated users)
 * @params  {studentId} - Student ID
 * @permissions fee:read
 */
router.get('/students/:studentId/structures',
  authenticateToken,
  authorizePermissions(['fee:read']),
  validateParams({ studentId: idSchema.shape.id }),
  feeStructureCacheMiddleware(),
  feeController.getStudentFeeStructures
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/fee/structures/:id/stats
 * @desc    Get fee structure statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Fee Structure ID
 * @permissions fee:read
 */
router.get('/structures/:id/stats',
  authenticateToken,
  authorizePermissions(['fee:read']),
  validateParams(idSchema),
  feeStatsCacheMiddleware(),
  feeController.getFeeStats
);

/**
 * @route   GET /api/fee/analytics/overview
 * @desc    Get fee analytics overview
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions fee:analytics
 */
router.get('/analytics/overview',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:analytics']),
  analyticsLimiter,
  feeAnalyticsCacheMiddleware(),
  feeController.getFeeAnalytics
);

/**
 * @route   GET /api/fee/school/:schoolId/analytics
 * @desc    Get fee analytics by school
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @params  {schoolId} - School ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions fee:analytics
 */
router.get('/school/:schoolId/analytics',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:analytics']),
  validateParams({ schoolId: idSchema.shape.id }),
  authorizeSchoolAccess('schoolId'),
  analyticsLimiter,
  feeController.getSchoolFeeAnalytics
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/fee/structures/bulk/create
 * @desc    Bulk create fee structures
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    FeeBulkCreateSchema
 * @permissions fee:create
 */
router.post('/structures/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:create']),
  bulkLimiter,
  validateBody(FeeBulkCreateSchema),
  auditLog('BULK_CREATE', 'FeeStructure'),
  feeController.bulkCreateStructures
);

/**
 * @route   PUT /api/fee/structures/bulk/update
 * @desc    Bulk update fee structures
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    FeeBulkUpdateSchema
 * @permissions fee:update
 */
router.put('/structures/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:update']),
  bulkLimiter,
  validateBody(FeeBulkUpdateSchema),
  auditLog('BULK_UPDATE', 'FeeStructure'),
  feeController.bulkUpdateStructures
);

/**
 * @route   DELETE /api/fee/structures/bulk/delete
 * @desc    Bulk delete fee structures
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    FeeBulkDeleteSchema
 * @permissions fee:delete
 */
router.delete('/structures/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:delete']),
  bulkLimiter,
  validateBody(FeeBulkDeleteSchema),
  auditLog('BULK_DELETE', 'FeeStructure'),
  feeController.bulkDeleteStructures
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/fee/structures/export
 * @desc    Export fee structures data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...FeeSearchSchema} - Filters for export
 * @permissions fee:export
 */
router.get('/structures/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:export']),
  exportLimiter,
  feeController.exportFeeStructures
);

/**
 * @route   POST /api/fee/structures/import
 * @desc    Import fee structures data
 * @access  Private (SUPER_ADMIN)
 * @body    {structures: FeeStructureCreateSchema[], user: User}
 * @permissions fee:import
 */
router.post('/structures/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['fee:import']),
  bulkLimiter,
  auditLog('IMPORT', 'FeeStructure'),
  feeController.importFeeStructures
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/fee/suggestions/code
 * @desc    Generate fee structure code suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @query   {name} - Fee structure name for code generation
 * @permissions fee:create
 */
router.get('/suggestions/code',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:create']),
  feeController.generateCodeSuggestions
);

/**
 * @route   GET /api/fee/items
 * @desc    Get all fee items
 * @access  Private (All authenticated users)
 * @query   {include} - Comma-separated list of relations to include
 * @permissions fee:read
 */
router.get('/items',
  authenticateToken,
  authorizePermissions(['fee:read']),
  feeItemsCacheMiddleware(),
  feeController.getAllFeeItems
);

/**
 * @route   GET /api/fee/report
 * @desc    Generate comprehensive fee report
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @query   {...FeeSearchSchema} - Filters for report
 * @permissions fee:report
 */
router.get('/report',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:report']),
  analyticsLimiter,
  feeController.generateFeeReport
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/fee/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  feeController.getCacheStatistics
);

/**
 * @route   POST /api/fee/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {structureId?} - Optional specific fee structure ID to warm
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  feeController.warmFeeCache
);

/**
 * @route   DELETE /api/fee/cache/clear
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
  feeController.clearFeeCache
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
  console.error('Fee route error:', error);
  
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
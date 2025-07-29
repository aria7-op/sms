import express from 'express';
import { z } from 'zod';
import feeItemController from '../controllers/FeeItemController.js';
import { 
  feeItemCacheMiddleware, 
  feeItemByIdCacheMiddleware,
  feeItemByStructureCacheMiddleware
} from '../cache/feeItemCache.js';
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
  roleBasedLimiter,
  defaultRoleLimits,
  feeItemSearchLimiter
} from '../middleware/rateLimit.js';
import { 
  FeeItemCreateSchema, 
  FeeItemUpdateSchema,
  FeeItemSearchSchema,
  FeeItemBulkCreateSchema,
  FeeItemBulkUpdateSchema,
  FeeItemBulkDeleteSchema
} from '../utils/feeItemUtils.js';

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
// FEE ITEM CRUD
// ======================

/**
 * @route   POST /api/fee/items
 * @desc    Create a new fee item
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @body    FeeItemCreateSchema
 * @permissions fee:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:create']),
  validateBody(FeeItemCreateSchema),
  auditLog('CREATE', 'FeeItem'),
  feeItemController.createFeeItem
);

/**
 * @route   GET /api/fee/items
 * @desc    Get fee items with pagination and filters
 * @access  Private (All authenticated users)
 * @query   FeeItemSearchSchema
 * @permissions fee:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['fee:read']),
  validateQuery(FeeItemSearchSchema),
  feeItemCacheMiddleware(),
  feeItemController.getFeeItems
);

/**
 * @route   GET /api/fee/items/:id
 * @desc    Get fee item by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Fee Item ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions fee:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['fee:read']),
  validateParams(idSchema),
  feeItemByIdCacheMiddleware,
  feeItemController.getFeeItemById
);

/**
 * @route   PUT /api/fee/items/:id
 * @desc    Update fee item
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @params  {id} - Fee Item ID
 * @body    FeeItemUpdateSchema
 * @permissions fee:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:update']),
  validateParams(idSchema),
  validateBody(FeeItemUpdateSchema),
  auditLog('UPDATE', 'FeeItem'),
  feeItemController.updateFeeItem
);

/**
 * @route   DELETE /api/fee/items/:id
 * @desc    Delete fee item (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Fee Item ID
 * @permissions fee:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:delete']),
  validateParams(idSchema),
  auditLog('DELETE', 'FeeItem'),
  feeItemController.deleteFeeItem
);

/**
 * @route   PATCH /api/fee/items/:id/restore
 * @desc    Restore deleted fee item
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Fee Item ID
 * @permissions fee:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:restore']),
  validateParams(idSchema),
  auditLog('RESTORE', 'FeeItem'),
  feeItemController.restoreFeeItem
);

// ======================
// FEE ITEMS BY STRUCTURE
// ======================

/**
 * @route   GET /api/fee/items/structure/:structureId
 * @desc    Get fee items by structure ID
 * @access  Private (All authenticated users)
 * @params  {structureId} - Fee Structure ID
 * @permissions fee:read
 */
router.get('/structure/:structureId',
  authenticateToken,
  authorizePermissions(['fee:read']),
  validateParams({ structureId: idSchema.shape.id }),
  feeItemByStructureCacheMiddleware,
  feeItemController.getFeeItemsByStructure
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/fee/items/bulk/create
 * @desc    Bulk create fee items
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    FeeItemBulkCreateSchema
 * @permissions fee:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:create']),
  bulkLimiter,
  validateBody(FeeItemBulkCreateSchema),
  auditLog('BULK_CREATE', 'FeeItem'),
  feeItemController.bulkCreateItems
);

/**
 * @route   PUT /api/fee/items/bulk/update
 * @desc    Bulk update fee items
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    FeeItemBulkUpdateSchema
 * @permissions fee:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:update']),
  bulkLimiter,
  validateBody(FeeItemBulkUpdateSchema),
  auditLog('BULK_UPDATE', 'FeeItem'),
  feeItemController.bulkUpdateItems
);

/**
 * @route   DELETE /api/fee/items/bulk/delete
 * @desc    Bulk delete fee items
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    FeeItemBulkDeleteSchema
 * @permissions fee:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:delete']),
  bulkLimiter,
  validateBody(FeeItemBulkDeleteSchema),
  auditLog('BULK_DELETE', 'FeeItem'),
  feeItemController.bulkDeleteItems
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/fee/items/export
 * @desc    Export fee items data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...FeeItemSearchSchema} - Filters for export
 * @permissions fee:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['fee:export']),
  exportLimiter,
  feeItemController.exportFeeItems
);

/**
 * @route   POST /api/fee/items/import
 * @desc    Import fee items data
 * @access  Private (SUPER_ADMIN)
 * @body    {items: FeeItemCreateSchema[], user: User}
 * @permissions fee:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['fee:import']),
  bulkLimiter,
  auditLog('IMPORT', 'FeeItem'),
  feeItemController.importFeeItems
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/fee/items/duedate/summary
 * @desc    Get fee items due date summary
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @query   {schoolId} - School ID
 * @query   {structureId} - Fee Structure ID
 * @permissions fee:read
 */
router.get('/duedate/summary',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:read']),
  feeItemController.getDueDateSummary
);

/**
 * @route   GET /api/fee/items/optional/summary
 * @desc    Get optional fee items summary
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT)
 * @query   {schoolId} - School ID
 * @query   {structureId} - Fee Structure ID
 * @permissions fee:read
 */
router.get('/optional/summary',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
  authorizePermissions(['fee:read']),
  feeItemController.getOptionalItemsSummary
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   POST /api/fee/items/cache/warm
 * @desc    Warm up fee items cache
 * @access  Private (SUPER_ADMIN)
 * @body    {structureId?} - Optional fee structure ID to warm items for
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  feeItemController.warmFeeItemCache
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
  console.error('FeeItem route error:', error);
  
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
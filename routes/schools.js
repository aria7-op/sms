import express from 'express';
import { z } from 'zod';
import schoolController from '../controllers/schoolController.js';
import { 
  schoolCacheMiddleware, 
  schoolStatsCacheMiddleware 
} from '../cache/schoolCache.js';
import { 
  authenticateToken, 
  authorizeRoles, 
  authorizePermissions,
  authorizeSchoolAccess,
  authorizeOwnerAccess,
  auditLog
} from '../middleware/auth.js';
import { 
  validateRequest, 
  sanitizeRequest,
  idSchema,
  paginationSchema
} from '../middleware/validation.js';
import { 
  generalLimiter,
  schoolCreateLimiter,
  schoolSearchLimiter,
  exportLimiter,
  bulkLimiter,
  analyticsLimiter,
  cacheLimiter,
  roleBasedLimiter,
  defaultRoleLimits
} from '../middleware/rateLimit.js';
import { 
  SchoolCreateSchema, 
  SchoolUpdateSchema, 
  SchoolSearchSchema 
} from '../utils/schoolSchemas.js';

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
 * @route   POST /api/schools
 * @desc    Create a new school
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    SchoolCreateSchema
 * @permissions school:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:create']),
  schoolCreateLimiter,
  validateRequest(SchoolCreateSchema, 'body'),
  auditLog('CREATE', 'School'),
  schoolController.createSchool.bind(schoolController)
);

/**
 * @route   GET /api/schools
 * @desc    Get schools with pagination and filters
 * @access  Private (All authenticated users)
 * @query   SchoolSearchSchema
 * @permissions school:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['school:read']),
  schoolSearchLimiter,
  validateRequest(SchoolSearchSchema, 'query'),
  schoolCacheMiddleware(300), // 5 minutes cache
  schoolController.getSchools.bind(schoolController)
);

/**
 * @route   GET /api/schools/:id
 * @desc    Get school by ID
 * @access  Private (All authenticated users)
 * @params  {id} - School ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions school:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['school:read']),
  validateRequest(idSchema, 'params'),
  schoolController.getSchoolById.bind(schoolController)
);

/**
 * @route   PUT /api/schools/:id
 * @desc    Update school
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - School ID
 * @body    SchoolUpdateSchema
 * @permissions school:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:update']),
  validateRequest(idSchema, 'params'),
  validateRequest(SchoolUpdateSchema, 'body'),
  authorizeSchoolAccess('id'),
  auditLog('UPDATE', 'School'),
  schoolController.updateSchool.bind(schoolController)
);

/**
 * @route   DELETE /api/schools/:id
 * @desc    Delete school (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - School ID
 * @permissions school:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:delete']),
  validateRequest(idSchema, 'params'),
  authorizeSchoolAccess('id'),
  auditLog('DELETE', 'School'),
  schoolController.deleteSchool.bind(schoolController)
);

/**
 * @route   PATCH /api/schools/:id/restore
 * @desc    Restore deleted school
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - School ID
 * @permissions school:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:restore']),
  validateRequest(idSchema, 'params'),
  authorizeSchoolAccess('id'),
  auditLog('RESTORE', 'School'),
  schoolController.restoreSchool.bind(schoolController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/schools/bulk
 * @desc    Bulk create schools
 * @access  Private (SUPER_ADMIN)
 * @body    {schools: SchoolCreateSchema[], user: User}
 * @permissions school:bulk_create
 */
router.post('/bulk',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['school:bulk_create']),
  bulkLimiter,
  auditLog('BULK_CREATE', 'School'),
  schoolController.bulkCreateSchools.bind(schoolController)
);

/**
 * @route   PUT /api/schools/bulk
 * @desc    Bulk update schools
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {updates: {id: number, ...SchoolUpdateSchema}[], user: User}
 * @permissions school:bulk_update
 */
router.put('/bulk',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:bulk_update']),
  bulkLimiter,
  auditLog('BULK_UPDATE', 'School'),
  schoolController.bulkUpdateSchools.bind(schoolController)
);

/**
 * @route   DELETE /api/schools/bulk
 * @desc    Bulk delete schools
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {schoolIds: number[], user: User}
 * @permissions school:bulk_delete
 */
router.delete('/bulk',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:bulk_delete']),
  bulkLimiter,
  auditLog('BULK_DELETE', 'School'),
  schoolController.bulkDeleteSchools.bind(schoolController)
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/schools/:id/stats
 * @desc    Get school statistics
 * @access  Private (All authenticated users)
 * @params  {id} - School ID
 * @permissions school:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['school:read']),
  validateRequest(idSchema, 'params'),
  authorizeSchoolAccess('id'),
  schoolStatsCacheMiddleware(1800), // 30 minutes cache
  schoolController.getSchoolStats.bind(schoolController)
);

/**
 * @route   GET /api/schools/:id/analytics
 * @desc    Get school analytics
 * @access  Private (All authenticated users)
 * @params  {id} - School ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions school:analytics
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['school:analytics']),
  validateRequest(idSchema, 'params'),
  authorizeSchoolAccess('id'),
  analyticsLimiter,
  schoolController.getSchoolAnalytics.bind(schoolController)
);

/**
 * @route   GET /api/schools/:id/performance
 * @desc    Get school performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - School ID
 * @permissions school:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['school:read']),
  validateRequest(idSchema, 'params'),
  authorizeSchoolAccess('id'),
  schoolController.getSchoolPerformance.bind(schoolController)
);

// ======================
// SEARCH & FILTER
// ======================

/**
 * @route   GET /api/schools/search
 * @desc    Search schools with advanced filters
 * @access  Private (All authenticated users)
 * @query   SchoolSearchSchema
 * @permissions school:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['school:read']),
  schoolSearchLimiter,
  validateRequest(SchoolSearchSchema, 'query'),
  schoolController.searchSchools.bind(schoolController)
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/schools/export
 * @desc    Export schools data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...SchoolSearchSchema} - Filters for export
 * @permissions school:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:export']),
  exportLimiter,
  schoolController.exportSchools.bind(schoolController)
);

/**
 * @route   POST /api/schools/import
 * @desc    Import schools data
 * @access  Private (SUPER_ADMIN)
 * @body    {schools: SchoolCreateSchema[], user: User}
 * @permissions school:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['school:import']),
  bulkLimiter,
  auditLog('IMPORT', 'School'),
  schoolController.importSchools.bind(schoolController)
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/schools/suggestions/code
 * @desc    Generate school code suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {name} - School name for code generation
 * @permissions school:create
 */
router.get('/suggestions/code',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:create']),
  schoolController.generateCodeSuggestions.bind(schoolController)
);

/**
 * @route   GET /api/schools/stats/status
 * @desc    Get school count by status
 * @access  Private (All authenticated users)
 * @permissions school:read
 */
router.get('/stats/status',
  authenticateToken,
  authorizePermissions(['school:read']),
  schoolCacheMiddleware(1800), // 30 minutes cache
  schoolController.getSchoolCountByStatus.bind(schoolController)
);

/**
 * @route   GET /api/schools/stats/location
 * @desc    Get school count by location
 * @access  Private (All authenticated users)
 * @permissions school:read
 */
router.get('/stats/location',
  authenticateToken,
  authorizePermissions(['school:read']),
  schoolCacheMiddleware(1800), // 30 minutes cache
  schoolController.getSchoolCountByLocation.bind(schoolController)
);

/**
 * @route   GET /api/schools/owner/:ownerId
 * @desc    Get schools by owner
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {ownerId} - Owner ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions school:read
 */
router.get('/owner/:ownerId',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['school:read']),
  validateRequest({ ownerId: idSchema.shape.id }, 'params'),
  authorizeOwnerAccess('ownerId'),
  schoolController.getSchoolsByOwner.bind(schoolController)
);

/**
 * @route   GET /api/schools/status/:status
 * @desc    Get schools by status
 * @access  Private (All authenticated users)
 * @params  {status} - School status (ACTIVE, INACTIVE, PENDING, SUSPENDED)
 * @query   {include} - Comma-separated list of relations to include
 * @permissions school:read
 */
router.get('/status/:status',
  authenticateToken,
  authorizePermissions(['school:read']),
  validateRequest({ 
    status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED']) 
  }, 'params'),
  schoolController.getSchoolsByStatus.bind(schoolController)
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/schools/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  schoolController.getCacheStats.bind(schoolController)
);

/**
 * @route   POST /api/schools/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {schoolId?} - Optional specific school ID to warm
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  schoolController.warmCache.bind(schoolController)
);

/**
 * @route   POST /api/schools/cache/clear-performance
 * @desc    Clear performance cache
 * @access  Private (SUPER_ADMIN)
 * @body    {schoolId?} - Optional specific school ID to clear
 * @permissions system:cache_manage
 */
router.post('/cache/clear-performance',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  schoolController.clearPerformanceCache.bind(schoolController)
);

/**
 * @route   GET /api/schools/cache/clear-performance
 * @desc    Clear performance cache (GET version for convenience)
 * @access  Private (SUPER_ADMIN)
 * @query   {schoolId?} - Optional specific school ID to clear
 * @permissions system:cache_manage
 */
router.get('/cache/clear-performance',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  (req, res) => {
    // Convert GET request to POST format
    req.body = { schoolId: req.query.schoolId };
    schoolController.clearPerformanceCache(req, res);
  }
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
  console.error('School route error:', error);
  
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
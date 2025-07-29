import express from 'express';
import { z } from 'zod';
import subjectController from '../controllers/subjectController.js';
import { 
  subjectCacheMiddleware, 
  subjectStatsCacheMiddleware 
} from '../cache/subjectCache.js';
import { 
  authenticateToken, 
  authorizeRoles, 
  authorizePermissions,
  authorizeSchoolAccess,
  authorizeSubjectAccess,
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
  subjectCreateLimiter,
  subjectSearchLimiter,
  exportLimiter,
  bulkLimiter,
  analyticsLimiter,
  cacheLimiter,
  roleBasedLimiter,
  defaultRoleLimits
} from '../middleware/rateLimit.js';
import { 
  SubjectCreateSchema, 
  SubjectUpdateSchema, 
  SubjectSearchSchema 
} from '../utils/subjectUtils.js';

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
 * @route   POST /api/subjects
 * @desc    Create a new subject
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    SubjectCreateSchema
 * @permissions subject:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['subject:create']),
  subjectCreateLimiter,
  // Custom validation that makes schoolId optional for owners
  (req, res, next) => {
    try {
      // Create a modified schema based on user role
      const modifiedSchema = req.user.role === 'SUPER_ADMIN' 
        ? SubjectCreateSchema.extend({
            schoolId: z.number().int().positive().optional()
          })
        : SubjectCreateSchema;
      
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
      next();
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  },
  auditLog('CREATE', 'Subject'),
  subjectController.createSubject.bind(subjectController)
);

/**
 * @route   GET /api/subjects
 * @desc    Get subjects with pagination and filters
 * @access  Private (All authenticated users)
 * @query   SubjectSearchSchema
 * @permissions subject:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['subject:read']),
  subjectSearchLimiter,
  validateQuery(SubjectSearchSchema),
  // subjectCacheMiddleware, // Temporarily disabled to debug hanging issue
  subjectController.getSubjects.bind(subjectController)
);

/**
 * @route   GET /api/subjects/:id
 * @desc    Get subject by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Subject ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions subject:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['subject:read']),
  validateParams(idSchema),
  authorizeSubjectAccess('id'),
  subjectController.getSubjectById.bind(subjectController)
);

/**
 * @route   PUT /api/subjects/:id
 * @desc    Update subject
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Subject ID
 * @body    SubjectUpdateSchema
 * @permissions subject:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['subject:update']),
  validateParams(idSchema),
  validateBody(SubjectUpdateSchema),
  authorizeSubjectAccess('id'),
  auditLog('UPDATE', 'Subject'),
  subjectController.updateSubject.bind(subjectController)
);

/**
 * @route   DELETE /api/subjects/:id
 * @desc    Delete subject (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Subject ID
 * @permissions subject:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['subject:delete']),
  validateParams(idSchema),
  authorizeSubjectAccess('id'),
  auditLog('DELETE', 'Subject'),
  subjectController.deleteSubject.bind(subjectController)
);

/**
 * @route   PATCH /api/subjects/:id/restore
 * @desc    Restore deleted subject
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Subject ID
 * @permissions subject:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['subject:restore']),
  validateParams(idSchema),
  authorizeSubjectAccess('id'),
  auditLog('RESTORE', 'Subject'),
  subjectController.restoreSubject.bind(subjectController)
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/subjects/:id/stats
 * @desc    Get subject statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Subject ID
 * @permissions subject:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['subject:read']),
  validateParams(idSchema),
  authorizeSubjectAccess('id'),
  async (req, res, next) => {
    try {
      await subjectStatsCacheMiddleware(req, res, next);
    } catch (error) {
      next(error);
    }
  },
  subjectController.getSubjectStats.bind(subjectController)
);

/**
 * @route   GET /api/subjects/:id/analytics
 * @desc    Get subject analytics
 * @access  Private (All authenticated users)
 * @params  {id} - Subject ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions subject:analytics
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['subject:analytics']),
  validateParams(idSchema),
  authorizeSubjectAccess('id'),
  analyticsLimiter,
  subjectController.getSubjectAnalytics.bind(subjectController)
);

/**
 * @route   GET /api/subjects/:id/performance
 * @desc    Get subject performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Subject ID
 * @permissions subject:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['subject:read']),
  validateParams(idSchema),
  authorizeSubjectAccess('id'),
  subjectController.getSubjectPerformance.bind(subjectController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/subjects/bulk/create
 * @desc    Bulk create subjects
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {subjects: SubjectCreateSchema[]}
 * @permissions subject:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['subject:create']),
  bulkLimiter,
  auditLog('BULK_CREATE', 'Subject'),
  subjectController.bulkCreateSubjects.bind(subjectController)
);

/**
 * @route   PUT /api/subjects/bulk/update
 * @desc    Bulk update subjects
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {updates: SubjectUpdateSchema[]}
 * @permissions subject:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['subject:update']),
  bulkLimiter,
  auditLog('BULK_UPDATE', 'Subject'),
  subjectController.bulkUpdateSubjects.bind(subjectController)
);

/**
 * @route   DELETE /api/subjects/bulk/delete
 * @desc    Bulk delete subjects
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {subjectIds: number[]}
 * @permissions subject:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['subject:delete']),
  bulkLimiter,
  auditLog('BULK_DELETE', 'Subject'),
  subjectController.bulkDeleteSubjects.bind(subjectController)
);

// ======================
// SEARCH & FILTER
// ======================

/**
 * @route   GET /api/subjects/search
 * @desc    Search subjects with advanced filters
 * @access  Private (All authenticated users)
 * @query   SubjectSearchSchema
 * @permissions subject:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['subject:read']),
  subjectSearchLimiter,
  validateQuery(SubjectSearchSchema),
  subjectController.searchSubjects.bind(subjectController)
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/subjects/export
 * @desc    Export subjects data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...SubjectSearchSchema} - Filters for export
 * @permissions subject:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['subject:export']),
  exportLimiter,
  subjectController.exportSubjects.bind(subjectController)
);

/**
 * @route   POST /api/subjects/import
 * @desc    Import subjects data
 * @access  Private (SUPER_ADMIN)
 * @body    {subjects: SubjectCreateSchema[], user: User}
 * @permissions subject:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['subject:import']),
  bulkLimiter,
  auditLog('IMPORT', 'Subject'),
  subjectController.importSubjects.bind(subjectController)
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/subjects/suggestions/code
 * @desc    Generate subject code suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @query   {name} - Subject name for code generation
 * @query   {schoolId} - School ID
 * @permissions subject:create
 */
router.get('/suggestions/code',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['subject:create']),
  subjectController.generateCodeSuggestions.bind(subjectController)
);

/**
 * @route   GET /api/subjects/stats/department
 * @desc    Get subject count by department
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions subject:read
 */
router.get('/stats/department',
  authenticateToken,
  authorizePermissions(['subject:read']),
  subjectCacheMiddleware(1800), // 30 minutes cache
  subjectController.getSubjectCountByDepartment.bind(subjectController)
);

/**
 * @route   GET /api/subjects/stats/credit-hours
 * @desc    Get subject count by credit hours
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions subject:read
 */
router.get('/stats/credit-hours',
  authenticateToken,
  authorizePermissions(['subject:read']),
  subjectCacheMiddleware(1800), // 30 minutes cache
  subjectController.getSubjectCountByCreditHours.bind(subjectController)
);

/**
 * @route   GET /api/subjects/school/:schoolId
 * @desc    Get subjects by school
 * @access  Private (All authenticated users)
 * @params  {schoolId} - School ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions subject:read
 */
router.get('/school/:schoolId',
  authenticateToken,
  authorizePermissions(['subject:read']),
  validateParams({ schoolId: idSchema.shape.id }),
  authorizeSchoolAccess('schoolId'),
  subjectController.getSubjectsBySchool.bind(subjectController)
);

/**
 * @route   GET /api/subjects/department/:departmentId
 * @desc    Get subjects by department
 * @access  Private (All authenticated users)
 * @params  {departmentId} - Department ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions subject:read
 */
router.get('/department/:departmentId',
  authenticateToken,
  authorizePermissions(['subject:read']),
  validateParams({ departmentId: idSchema.shape.id }),
  subjectController.getSubjectsByDepartment.bind(subjectController)
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/subjects/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  subjectController.getCacheStats.bind(subjectController)
);

/**
 * @route   POST /api/subjects/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {subjectId?} - Optional specific subject ID to warm
 * @body    {schoolId?} - Optional school ID to warm all subjects
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  subjectController.warmCache.bind(subjectController)
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
  console.error('Subject route error:', error);
  
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
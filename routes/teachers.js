import express from 'express';
import { z } from 'zod';
import teacherController from '../controllers/teacherController.js';
import { 
  teacherCacheMiddleware, 
  teacherStatsCacheMiddleware 
} from '../cache/teacherCache.js';
import { 
  authenticateToken, 
  authorizeRoles, 
  authorizePermissions,
  authorizeSchoolAccess,
  authorizeTeacherAccess,
  auditLog
} from '../middleware/auth.js';
import { 
  validateRequest, 
  validateParams, 
  validateBody,
  validateQuery,
  sanitizeRequest,
  idSchema,
  paginationSchema,
  validateIdParam
} from '../middleware/validation.js';
import { 
  generalLimiter,
  teacherCreateLimiter,
  teacherSearchLimiter,
  exportLimiter,
  bulkLimiter,
  analyticsLimiter,
  cacheLimiter,
  roleBasedLimiter,
  defaultRoleLimits
} from '../middleware/rateLimit.js';
import { 
  TeacherCreateSchema, 
  TeacherUpdateSchema, 
  TeacherSearchSchema 
} from '../utils/teacherUtils.js';

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
 * @route   POST /api/teachers
 * @desc    Create a new teacher
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    TeacherCreateSchema
 * @permissions teacher:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:create']),
  teacherCreateLimiter,
  validateBody(TeacherCreateSchema),
  auditLog('CREATE', 'Teacher'),
  teacherController.createTeacher.bind(teacherController)
);

/**
 * @route   GET /api/teachers
 * @desc    Get teachers with pagination and filters
 * @access  Private (All authenticated users)
 * @query   TeacherSearchSchema
 * @permissions teacher:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['teacher:read']),
  teacherSearchLimiter,
  validateQuery(TeacherSearchSchema),
  // teacherCacheMiddleware, // Temporarily disabled to debug hanging issue
  teacherController.getTeachers.bind(teacherController)
);

/**
 * @route   GET /api/teachers/:id
 * @desc    Get teacher by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Teacher ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions teacher:read
 */
router.get('/:id',
  validateIdParam('id'),
  authenticateToken,
  authorizePermissions(['teacher:read']),
  authorizeTeacherAccess('id'),
  teacherController.getTeacherById.bind(teacherController)
);

/**
 * @route   PUT /api/teachers/:id
 * @desc    Update teacher
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Teacher ID
 * @body    TeacherUpdateSchema
 * @permissions teacher:update
 */
router.put('/:id',
  validateIdParam('id'),
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:update']),
  validateBody(TeacherUpdateSchema),
  authorizeTeacherAccess('id'),
  auditLog('UPDATE', 'Teacher'),
  teacherController.updateTeacher.bind(teacherController)
);

/**
 * @route   DELETE /api/teachers/:id
 * @desc    Delete teacher (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Teacher ID
 * @permissions teacher:delete
 */
router.delete('/:id',
  validateIdParam('id'),
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:delete']),
  authorizeTeacherAccess('id'),
  auditLog('DELETE', 'Teacher'),
  teacherController.deleteTeacher.bind(teacherController)
);

/**
 * @route   PATCH /api/teachers/:id/restore
 * @desc    Restore deleted teacher
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Teacher ID
 * @permissions teacher:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:restore']),
  validateParams(idSchema),
  authorizeTeacherAccess('id'),
  auditLog('RESTORE', 'Teacher'),
  teacherController.restoreTeacher.bind(teacherController)
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/teachers/:id/stats
 * @desc    Get teacher statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Teacher ID
 * @permissions teacher:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['teacher:read']),
  validateParams(idSchema),
  authorizeTeacherAccess('id'),
  async (req, res, next) => {
    try {
      await teacherStatsCacheMiddleware(req, res, next);
    } catch (error) {
      next(error);
    }
  },
  teacherController.getTeacherStats.bind(teacherController)
);

/**
 * @route   GET /api/teachers/:id/analytics
 * @desc    Get teacher analytics
 * @access  Private (All authenticated users)
 * @params  {id} - Teacher ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions teacher:analytics
 */
router.get('/:id/analytics',
  validateIdParam('id'),
  authenticateToken,
  authorizePermissions(['teacher:analytics']),
  authorizeTeacherAccess('id'),
  analyticsLimiter,
  teacherController.getTeacherAnalytics.bind(teacherController)
);

/**
 * @route   GET /api/teachers/:id/performance
 * @desc    Get teacher performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Teacher ID
 * @permissions teacher:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['teacher:read']),
  validateParams(idSchema),
  authorizeTeacherAccess('id'),
  teacherController.getTeacherPerformance.bind(teacherController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/teachers/bulk/create
 * @desc    Bulk create teachers
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {teachers: TeacherCreateSchema[]}
 * @permissions teacher:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:create']),
  bulkLimiter,
  auditLog('BULK_CREATE', 'Teacher'),
  teacherController.bulkCreateTeachers.bind(teacherController)
);

/**
 * @route   PUT /api/teachers/bulk/update
 * @desc    Bulk update teachers
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {updates: TeacherUpdateSchema[]}
 * @permissions teacher:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:update']),
  bulkLimiter,
  auditLog('BULK_UPDATE', 'Teacher'),
  teacherController.bulkUpdateTeachers.bind(teacherController)
);

/**
 * @route   DELETE /api/teachers/bulk/delete
 * @desc    Bulk delete teachers
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {teacherIds: number[]}
 * @permissions teacher:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:delete']),
  bulkLimiter,
  auditLog('BULK_DELETE', 'Teacher'),
  teacherController.bulkDeleteTeachers.bind(teacherController)
);

// ======================
// SEARCH & FILTER
// ======================

/**
 * @route   GET /api/teachers/search
 * @desc    Search teachers with advanced filters
 * @access  Private (All authenticated users)
 * @query   TeacherSearchSchema
 * @permissions teacher:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['teacher:read']),
  teacherSearchLimiter,
  validateQuery(TeacherSearchSchema),
  teacherController.searchTeachers.bind(teacherController)
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/teachers/export
 * @desc    Export teachers data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...TeacherSearchSchema} - Filters for export
 * @permissions teacher:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:export']),
  exportLimiter,
  teacherController.exportTeachers.bind(teacherController)
);

/**
 * @route   POST /api/teachers/import
 * @desc    Import teachers data
 * @access  Private (SUPER_ADMIN)
 * @body    {teachers: TeacherCreateSchema[], user: User}
 * @permissions teacher:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['teacher:import']),
  bulkLimiter,
  auditLog('IMPORT', 'Teacher'),
  teacherController.importTeachers.bind(teacherController)
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/teachers/suggestions/code
 * @desc    Generate teacher code suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {name} - Teacher name for code generation
 * @query   {schoolId} - School ID
 * @permissions teacher:create
 */
router.get('/suggestions/code',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['teacher:create']),
  teacherController.generateCodeSuggestions.bind(teacherController)
);

/**
 * @route   GET /api/teachers/stats/department
 * @desc    Get teacher count by department
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions teacher:read
 */
router.get('/stats/department',
  authenticateToken,
  authorizePermissions(['teacher:read']),
  teacherCacheMiddleware(1800), // 30 minutes cache
  teacherController.getTeacherCountByDepartment.bind(teacherController)
);

/**
 * @route   GET /api/teachers/stats/experience
 * @desc    Get teacher count by experience
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions teacher:read
 */
router.get('/stats/experience',
  authenticateToken,
  authorizePermissions(['teacher:read']),
  teacherCacheMiddleware(1800), // 30 minutes cache
  teacherController.getTeacherCountByExperience.bind(teacherController)
);

/**
 * @route   GET /api/teachers/school/:schoolId
 * @desc    Get teachers by school
 * @access  Private (All authenticated users)
 * @params  {schoolId} - School ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions teacher:read
 */
router.get('/school/:schoolId',
  authenticateToken,
  authorizePermissions(['teacher:read']),
  validateParams({ schoolId: idSchema.shape.id }),
  authorizeSchoolAccess('schoolId'),
  teacherController.getTeachersBySchool.bind(teacherController)
);

/**
 * @route   GET /api/teachers/department/:departmentId
 * @desc    Get teachers by department
 * @access  Private (All authenticated users)
 * @params  {departmentId} - Department ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions teacher:read
 */
router.get('/department/:departmentId',
  authenticateToken,
  authorizePermissions(['teacher:read']),
  validateParams({ departmentId: idSchema.shape.id }),
  teacherController.getTeachersByDepartment.bind(teacherController)
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/teachers/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  teacherController.getCacheStats.bind(teacherController)
);

/**
 * @route   POST /api/teachers/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {teacherId?} - Optional specific teacher ID to warm
 * @body    {schoolId?} - Optional school ID to warm all teachers
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  teacherController.warmCache.bind(teacherController)
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
  console.error('Teacher route error:', error);
  
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
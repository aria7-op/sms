import express from 'express';
import { z } from 'zod';
import gradeController from '../controllers/gradeController.js';
import { 
  gradeCacheMiddleware, 
  gradeStatsCacheMiddleware 
} from '../cache/gradeCache.js';
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
  gradeSearchLimiter
} from '../middleware/rateLimit.js';
import { 
  GradeCreateSchema, 
  GradeUpdateSchema, 
  GradeSearchSchema 
} from '../utils/gradeUtils.js';

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
 * @route   POST /api/grades
 * @desc    Create a new grade
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    GradeCreateSchema
 * @permissions grade:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['grade:create']),
  validateBody(GradeCreateSchema),
  auditLog('CREATE', 'Grade'),
  gradeController.createGrade.bind(gradeController)
);

/**
 * @route   GET /api/grades
 * @desc    Get grades with pagination and filters
 * @access  Private (All authenticated users)
 * @query   GradeSearchSchema
 * @permissions grade:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['grade:read']),
  gradeSearchLimiter,
  validateQuery(GradeSearchSchema),
  gradeCacheMiddleware,
  gradeController.getGrades.bind(gradeController)
);

/**
 * @route   GET /api/grades/:id
 * @desc    Get grade by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Grade ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions grade:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams(idSchema),
  gradeController.getGradeById.bind(gradeController)
);

/**
 * @route   PUT /api/grades/:id
 * @desc    Update grade
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Grade ID
 * @body    GradeUpdateSchema
 * @permissions grade:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['grade:update']),
  validateParams(idSchema),
  validateBody(GradeUpdateSchema),
  auditLog('UPDATE', 'Grade'),
  gradeController.updateGrade.bind(gradeController)
);

/**
 * @route   DELETE /api/grades/:id
 * @desc    Delete grade (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Grade ID
 * @permissions grade:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['grade:delete']),
  validateParams(idSchema),
  auditLog('DELETE', 'Grade'),
  gradeController.deleteGrade.bind(gradeController)
);

/**
 * @route   PATCH /api/grades/:id/restore
 * @desc    Restore deleted grade
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Grade ID
 * @permissions grade:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['grade:restore']),
  validateParams(idSchema),
  auditLog('RESTORE', 'Grade'),
  gradeController.restoreGrade.bind(gradeController)
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/grades/:id/stats
 * @desc    Get grade statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Grade ID
 * @permissions grade:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams(idSchema),
  async (req, res, next) => {
    try {
      await gradeStatsCacheMiddleware(req, res, next);
    } catch (error) {
      next(error);
    }
  },
  gradeController.getGradeStats.bind(gradeController)
);

/**
 * @route   GET /api/grades/:id/analytics
 * @desc    Get grade analytics
 * @access  Private (All authenticated users)
 * @params  {id} - Grade ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions grade:analytics
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['grade:analytics']),
  validateParams(idSchema),
  analyticsLimiter,
  gradeController.getGradeAnalytics.bind(gradeController)
);

/**
 * @route   GET /api/grades/:id/performance
 * @desc    Get grade performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Grade ID
 * @permissions grade:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams(idSchema),
  gradeController.getGradePerformance.bind(gradeController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/grades/bulk/create
 * @desc    Bulk create grades
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {grades: GradeCreateSchema[], skipDuplicates?: boolean}
 * @permissions grade:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['grade:create']),
  bulkLimiter,
  auditLog('BULK_CREATE', 'Grade'),
  gradeController.bulkCreateGrades.bind(gradeController)
);

/**
 * @route   PUT /api/grades/bulk/update
 * @desc    Bulk update grades
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {updates: {id: number, data: GradeUpdateSchema}[]}
 * @permissions grade:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['grade:update']),
  bulkLimiter,
  auditLog('BULK_UPDATE', 'Grade'),
  gradeController.bulkUpdateGrades.bind(gradeController)
);

/**
 * @route   DELETE /api/grades/bulk/delete
 * @desc    Bulk delete grades
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {gradeIds: number[]}
 * @permissions grade:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['grade:delete']),
  bulkLimiter,
  auditLog('BULK_DELETE', 'Grade'),
  gradeController.bulkDeleteGrades.bind(gradeController)
);

// ======================
// SEARCH & FILTER
// ======================

/**
 * @route   GET /api/grades/search
 * @desc    Search grades with advanced filters
 * @access  Private (All authenticated users)
 * @query   {q} - Search query
 * @query   {include} - Comma-separated list of relations to include
 * @permissions grade:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['grade:read']),
  gradeSearchLimiter,
  gradeController.searchGrades.bind(gradeController)
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/grades/export
 * @desc    Export grades data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...GradeSearchSchema} - Filters for export
 * @permissions grade:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['grade:export']),
  exportLimiter,
  gradeController.exportGrades.bind(gradeController)
);

/**
 * @route   POST /api/grades/import
 * @desc    Import grades data
 * @access  Private (SUPER_ADMIN)
 * @body    {grades: GradeCreateSchema[], user: User}
 * @permissions grade:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['grade:import']),
  bulkLimiter,
  auditLog('IMPORT', 'Grade'),
  gradeController.importGrades.bind(gradeController)
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/grades/student/:studentId
 * @desc    Get grades by student
 * @access  Private (All authenticated users)
 * @params  {studentId} - Student ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions grade:read
 */
router.get('/student/:studentId',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams({ studentId: idSchema.shape.id }),
  gradeController.getGradesByStudent.bind(gradeController)
);

/**
 * @route   GET /api/grades/exam/:examId
 * @desc    Get grades by exam
 * @access  Private (All authenticated users)
 * @params  {examId} - Exam ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions grade:read
 */
router.get('/exam/:examId',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams({ examId: idSchema.shape.id }),
  gradeController.getGradesByExam.bind(gradeController)
);

/**
 * @route   GET /api/grades/subject/:subjectId
 * @desc    Get grades by subject
 * @access  Private (All authenticated users)
 * @params  {subjectId} - Subject ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions grade:read
 */
router.get('/subject/:subjectId',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams({ subjectId: idSchema.shape.id }),
  gradeController.getGradesBySubject.bind(gradeController)
);

/**
 * @route   GET /api/grades/student/:studentId/gpa
 * @desc    Calculate student GPA
 * @access  Private (All authenticated users)
 * @params  {studentId} - Student ID
 * @permissions grade:read
 */
router.get('/student/:studentId/gpa',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams({ studentId: idSchema.shape.id }),
  gradeController.calculateStudentGPA.bind(gradeController)
);

/**
 * @route   GET /api/grades/student/:studentId/cgpa
 * @desc    Calculate student CGPA
 * @access  Private (All authenticated users)
 * @params  {studentId} - Student ID
 * @permissions grade:read
 */
router.get('/student/:studentId/cgpa',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams({ studentId: idSchema.shape.id }),
  gradeController.calculateStudentCGPA.bind(gradeController)
);

/**
 * @route   GET /api/grades/report
 * @desc    Generate grade report
 * @access  Private (All authenticated users)
 * @query   {...GradeSearchSchema} - Filters for report
 * @permissions grade:read
 */
router.get('/report',
  authenticateToken,
  authorizePermissions(['grade:read']),
  gradeController.generateGradeReport.bind(gradeController)
);

/**
 * @route   GET /api/grades/distribution
 * @desc    Get grade distribution
 * @access  Private (All authenticated users)
 * @query   {examId} - Optional exam ID filter
 * @query   {subjectId} - Optional subject ID filter
 * @permissions grade:read
 */
router.get('/distribution',
  authenticateToken,
  authorizePermissions(['grade:read']),
  gradeCacheMiddleware(1800), // 30 minutes cache
  gradeController.getGradeDistribution.bind(gradeController)
);

/**
 * @route   GET /api/grades/stats/performance
 * @desc    Get performance statistics
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions grade:read
 */
router.get('/stats/performance',
  authenticateToken,
  authorizePermissions(['grade:read']),
  gradeCacheMiddleware(1800), // 30 minutes cache
  gradeController.generateGradeReport.bind(gradeController)
);

/**
 * @route   GET /api/grades/stats/analytics
 * @desc    Get analytics statistics
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions grade:read
 */
router.get('/stats/analytics',
  authenticateToken,
  authorizePermissions(['grade:read']),
  gradeCacheMiddleware(1800), // 30 minutes cache
  gradeController.generateGradeReport.bind(gradeController)
);

/**
 * @route   GET /api/grades/school/:schoolId
 * @desc    Get grades by school
 * @access  Private (All authenticated users)
 * @params  {schoolId} - School ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions grade:read
 */
router.get('/school/:schoolId',
  authenticateToken,
  authorizePermissions(['grade:read']),
  validateParams({ schoolId: idSchema.shape.id }),
  authorizeSchoolAccess('schoolId'),
  gradeController.getGrades.bind(gradeController)
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/grades/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  gradeController.getCacheStats.bind(gradeController)
);

/**
 * @route   POST /api/grades/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {gradeId?} - Optional specific grade ID to warm
 * @body    {schoolId?} - Optional school ID to warm all grades
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  gradeController.warmCache.bind(gradeController)
);

/**
 * @route   DELETE /api/grades/cache/clear
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
  gradeController.clearCache.bind(gradeController)
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
  console.error('Grade route error:', error);
  
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
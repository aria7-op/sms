import express from 'express';
import { z } from 'zod';
import studentController from '../controllers/studentController.js';
import { 
  studentCacheMiddleware, 
  studentListCacheMiddleware,
  studentStatsCacheMiddleware 
} from '../cache/studentCache.js';
import { 
  authenticateToken, 
  authorizeRoles, 
  authorizePermissions,
  authorizeSchoolAccess,
  authorizeStudentAccess,
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
  studentCreateLimiter,
  studentSearchLimiter,
  exportLimiter,
  bulkLimiter,
  analyticsLimiter,
  cacheLimiter,
  roleBasedLimiter,
  defaultRoleLimits
} from '../middleware/rateLimit.js';
import { 
  StudentCreateSchema, 
  StudentUpdateSchema, 
  StudentSearchSchema 
} from '../utils/studentUtils.js';

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
// STATIC ANALYTICS ROUTES (must come before dynamic routes)
// ======================

/**
 * @route   GET /api/students/converted
 * @desc    Get all converted students
 * @access  Private (All authenticated users)
 * @permissions student:read
 */
router.get('/converted',
  authenticateToken,
  authorizePermissions(['student:read']),
  studentController.getConvertedStudents.bind(studentController)
);

/**
 * @route   GET /api/students/conversion-analytics
 * @desc    Get student conversion analytics
 * @access  Private (All authenticated users)
 * @permissions student:read
 */
router.get('/conversion-analytics',
  authenticateToken,
  authorizePermissions(['student:read']),
  studentController.getStudentConversionAnalytics.bind(studentController)
);

/**
 * @route   GET /api/students/conversion-stats/:studentId?
 * @desc    Get student conversion statistics
 * @access  Private (All authenticated users)
 * @params  {studentId?} - Optional student ID
 * @permissions student:read
 */
router.get('/conversion-stats/:studentId?',
  authenticateToken,
  authorizePermissions(['student:read']),
  studentController.getStudentConversionStats.bind(studentController)
);

// ======================
// CRUD OPERATIONS
// ======================

/**
 * @route   POST /api/students
 * @desc    Create a new student
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    StudentCreateSchema
 * @permissions student:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['student:create']),
  studentCreateLimiter,
  validateBody(StudentCreateSchema),
  auditLog('CREATE', 'Student'),
  studentController.createStudent.bind(studentController)
);

/**
 * @route   GET /api/students
 * @desc    Get students with pagination and filters
 * @access  Private (All authenticated users)
 * @query   StudentSearchSchema
 * @permissions student:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['student:read']),
  studentSearchLimiter,
  validateQuery(StudentSearchSchema),
  // studentListCacheMiddleware, // Temporarily disabled for debugging
  studentController.getStudents.bind(studentController)
);

/**
 * @route   GET /api/students/:id
 * @desc    Get student by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions student:read
 */
router.get('/:id',
  (req, res, next) => {
    console.log('=== ROUTE MATCHED: GET /:id ===');
    console.log('URL:', req.url);
    console.log('Params:', req.params);
    next();
  },
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  (req, res, next) => {
    console.log('=== BEFORE studentCacheMiddleware ===');
    next();
  },
  studentCacheMiddleware,
  (req, res, next) => {
    console.log('=== AFTER studentCacheMiddleware ===');
    next();
  },
  studentController.getStudentById.bind(studentController)
);

/**
 * @route   PUT /api/students/:id
 * @desc    Update student
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Student ID
 * @body    StudentUpdateSchema
 * @permissions student:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['student:update']),
  validateParams(idSchema),
  validateBody(StudentUpdateSchema),
  authorizeStudentAccess('id'),
  auditLog('UPDATE', 'Student'),
  studentController.updateStudent.bind(studentController)
);

/**
 * @route   DELETE /api/students/:id
 * @desc    Delete student (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Student ID
 * @permissions student:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['student:delete']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  auditLog('DELETE', 'Student'),
  studentController.deleteStudent.bind(studentController)
);

/**
 * @route   PATCH /api/students/:id/restore
 * @desc    Restore deleted student
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Student ID
 * @permissions student:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['student:restore']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  auditLog('RESTORE', 'Student'),
  studentController.restoreStudent.bind(studentController)
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/students/:id/stats
 * @desc    Get student statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @permissions student:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  async (req, res, next) => {
    try {
      await studentStatsCacheMiddleware(req, res, next);
    } catch (error) {
      next(error);
    }
  },
  studentController.getStudentStats.bind(studentController)
);

/**
 * @route   GET /api/students/:id/analytics
 * @desc    Get student analytics
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions student:analytics
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['student:analytics']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  analyticsLimiter,
  studentController.getStudentAnalytics.bind(studentController)
);

/**
 * @route   GET /api/students/:id/performance
 * @desc    Get student performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @permissions student:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  studentController.getStudentPerformance.bind(studentController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/students/bulk/create
 * @desc    Bulk create students
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {students: StudentCreateSchema[]}
 * @permissions student:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['student:create']),
  bulkLimiter,
  auditLog('BULK_CREATE', 'Student'),
  studentController.bulkCreateStudents.bind(studentController)
);

/**
 * @route   PUT /api/students/bulk/update
 * @desc    Bulk update students
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {updates: StudentUpdateSchema[]}
 * @permissions student:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['student:update']),
  bulkLimiter,
  auditLog('BULK_UPDATE', 'Student'),
  studentController.bulkUpdateStudents.bind(studentController)
);

/**
 * @route   DELETE /api/students/bulk/delete
 * @desc    Bulk delete students
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {studentIds: number[]}
 * @permissions student:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['student:delete']),
  bulkLimiter,
  auditLog('BULK_DELETE', 'Student'),
  studentController.bulkDeleteStudents.bind(studentController)
);

// ======================
// SEARCH & FILTER
// ======================

/**
 * @route   GET /api/students/search
 * @desc    Search students with advanced filters
 * @access  Private (All authenticated users)
 * @query   StudentSearchSchema
 * @permissions student:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['student:read']),
  studentSearchLimiter,
  validateQuery(StudentSearchSchema),
  studentController.searchStudents.bind(studentController)
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/students/export
 * @desc    Export students data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...StudentSearchSchema} - Filters for export
 * @permissions student:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['student:export']),
  exportLimiter,
  studentController.exportStudents.bind(studentController)
);

/**
 * @route   POST /api/students/import
 * @desc    Import students data
 * @access  Private (SUPER_ADMIN)
 * @body    {students: StudentCreateSchema[], user: User}
 * @permissions student:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['student:import']),
  bulkLimiter,
  auditLog('IMPORT', 'Student'),
  studentController.importStudents.bind(studentController)
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/students/suggestions/code
 * @desc    Generate student code suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @query   {name} - Student name for code generation
 * @query   {schoolId} - School ID
 * @permissions student:create
 */
router.get('/suggestions/code',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['student:create']),
  studentController.generateCodeSuggestions.bind(studentController)
);

/**
 * @route   GET /api/students/stats/class
 * @desc    Get student count by class
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions student:read
 */
router.get('/stats/class',
  authenticateToken,
  authorizePermissions(['student:read']),
  studentCacheMiddleware(1800), // 30 minutes cache
  studentController.getStudentCountByClass.bind(studentController)
);

/**
 * @route   GET /api/students/stats/status
 * @desc    Get student count by status
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions student:read
 */
router.get('/stats/status',
  authenticateToken,
  authorizePermissions(['student:read']),
  studentCacheMiddleware(1800), // 30 minutes cache
  studentController.getStudentCountByStatus.bind(studentController)
);

/**
 * @route   GET /api/students/school/:schoolId
 * @desc    Get students by school
 * @access  Private (All authenticated users)
 * @params  {schoolId} - School ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions student:read
 */
router.get('/school/:schoolId',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams({ schoolId: idSchema.shape.id }),
  authorizeSchoolAccess('schoolId'),
  studentController.getStudentsBySchool.bind(studentController)
);

/**
 * @route   GET /api/students/class/:classId
 * @desc    Get students by class
 * @access  Private (All authenticated users)
 * @params  {classId} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions student:read
 */
router.get('/class/:classId',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(z.object({ classId: idSchema.shape.id })),
  studentController.getStudentsByClass.bind(studentController)
);

/**
 * @route   GET /api/students/:id/dashboard
 * @desc    Get student dashboard data
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @permissions student:read
 */
router.get('/:id/dashboard',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  studentController.getStudentDashboard.bind(studentController)
);

/**
 * @route   GET /api/students/:id/attendance
 * @desc    Get student attendance records
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @permissions student:read
 */
router.get('/:id/attendance',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  studentController.getStudentAttendance.bind(studentController)
);

/**
 * @route   PUT /api/students/:id/attendance
 * @desc    Update student attendance
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Student ID
 * @permissions student:update
 */
router.put('/:id/attendance',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['student:update']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  auditLog('UPDATE', 'StudentAttendance'),
  studentController.updateStudentAttendance.bind(studentController)
);

/**
 * @route   GET /api/students/:id/behavior
 * @desc    Get student behavior records
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @permissions student:read
 */
router.get('/:id/behavior',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  studentController.getStudentBehavior.bind(studentController)
);

/**
 * @route   POST /api/students/:id/behavior
 * @desc    Add student behavior record
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Student ID
 * @permissions student:update
 */
router.post('/:id/behavior',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['student:update']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  auditLog('CREATE', 'StudentBehavior'),
  studentController.addStudentBehavior.bind(studentController)
);

/**
 * @route   GET /api/students/:id/documents
 * @desc    Get student documents
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @permissions student:read
 */
router.get('/:id/documents',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  studentController.getStudentDocuments.bind(studentController)
);

/**
 * @route   POST /api/students/:id/documents
 * @desc    Upload student document
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Student ID
 * @permissions student:update
 */
router.post('/:id/documents',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['student:update']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  auditLog('CREATE', 'StudentDocument'),
  studentController.uploadStudentDocument.bind(studentController)
);

/**
 * @route   GET /api/students/:id/financials
 * @desc    Get student financial records
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @permissions student:read
 */
router.get('/:id/financials',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  studentController.getStudentFinancials.bind(studentController)
);

/**
 * @route   PUT /api/students/:id/financials
 * @desc    Update student financial records
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Student ID
 * @permissions student:update
 */
router.put('/:id/financials',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['student:update']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  auditLog('UPDATE', 'StudentFinancials'),
  studentController.updateStudentFinancials.bind(studentController)
);

/**
 * @route   GET /api/students/:id/health
 * @desc    Get student health records
 * @access  Private (All authenticated users)
 * @params  {id} - Student ID
 * @permissions student:read
 */
router.get('/:id/health',
  authenticateToken,
  authorizePermissions(['student:read']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  studentController.getStudentHealth.bind(studentController)
);

/**
 * @route   POST /api/students/:id/health
 * @desc    Add student health record
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Student ID
 * @permissions student:update
 */
router.post('/:id/health',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['student:update']),
  validateParams(idSchema),
  authorizeStudentAccess('id'),
  auditLog('CREATE', 'StudentHealth'),
  studentController.addStudentHealthRecord.bind(studentController)
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/students/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  studentController.getCacheStats.bind(studentController)
);

/**
 * @route   POST /api/students/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {studentId?} - Optional specific student ID to warm
 * @body    {schoolId?} - Optional school ID to warm all students
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  studentController.warmCache.bind(studentController)
);

// ======================
// MAINTENANCE OPERATIONS
// ======================

/**
 * @route   POST /api/students/cleanup-orphaned
 * @desc    Clean up orphaned students (students with invalid school references)
 * @access  Private (SUPER_ADMIN only)
 * @permissions student:delete
 */
router.post('/cleanup-orphaned',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['student:delete']),
  auditLog('MAINTENANCE', 'Student'),
  studentController.cleanupOrphanedStudentsEndpoint.bind(studentController)
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
  console.error('Student route error:', error);
  
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

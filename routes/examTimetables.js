import express from 'express';
import { z } from 'zod';
import examTimetableController from '../controllers/examTimetableController.js';
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
  examTimetableSearchLimiter
} from '../middleware/rateLimit.js';
import { 
  ExamTimetableCreateSchema, 
  ExamTimetableUpdateSchema, 
  ExamTimetableSearchSchema 
} from '../utils/examTimetableUtils.js';

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
 * @route   POST /api/exam-timetables
 * @desc    Create a new exam timetable
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    ExamTimetableCreateSchema
 * @permissions exam_timetable:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam_timetable:create']),
  validateBody(ExamTimetableCreateSchema),
  auditLog('CREATE', 'ExamTimetable'),
  examTimetableController.createExamTimetable.bind(examTimetableController)
);

/**
 * @route   GET /api/exam-timetables
 * @desc    Get exam timetables with pagination and filters
 * @access  Private (All authenticated users)
 * @query   ExamTimetableSearchSchema
 * @permissions exam_timetable:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  examTimetableSearchLimiter,
  validateQuery(ExamTimetableSearchSchema),
  examTimetableController.getExamTimetables.bind(examTimetableController)
);

/**
 * @route   GET /api/exam-timetables/:id
 * @desc    Get exam timetable by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Exam Timetable ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions exam_timetable:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  validateParams(idSchema),
  examTimetableController.getExamTimetableById.bind(examTimetableController)
);

/**
 * @route   PUT /api/exam-timetables/:id
 * @desc    Update exam timetable
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Exam Timetable ID
 * @body    ExamTimetableUpdateSchema
 * @permissions exam_timetable:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam_timetable:update']),
  validateParams(idSchema),
  validateBody(ExamTimetableUpdateSchema),
  auditLog('UPDATE', 'ExamTimetable'),
  examTimetableController.updateExamTimetable.bind(examTimetableController)
);

/**
 * @route   DELETE /api/exam-timetables/:id
 * @desc    Delete exam timetable (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Exam Timetable ID
 * @permissions exam_timetable:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam_timetable:delete']),
  validateParams(idSchema),
  auditLog('DELETE', 'ExamTimetable'),
  examTimetableController.deleteExamTimetable.bind(examTimetableController)
);

/**
 * @route   PATCH /api/exam-timetables/:id/restore
 * @desc    Restore deleted exam timetable
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Exam Timetable ID
 * @permissions exam_timetable:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam_timetable:restore']),
  validateParams(idSchema),
  auditLog('RESTORE', 'ExamTimetable'),
  examTimetableController.restoreExamTimetable.bind(examTimetableController)
);

// ======================
// SCHEDULING & CONFLICT DETECTION
// ======================

/**
 * @route   POST /api/exam-timetables/:id/check-conflicts
 * @desc    Check for scheduling conflicts
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Exam Timetable ID (optional for new timetables)
 * @body    {date, startTime, endTime, roomNumber, subjectId, examId}
 * @permissions exam_timetable:create, exam_timetable:update
 */
router.post('/:id/check-conflicts',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam_timetable:create', 'exam_timetable:update']),
  validateParams({ id: idSchema.shape.id.optional() }),
  examTimetableController.checkConflicts.bind(examTimetableController)
);

/**
 * @route   POST /api/exam-timetables/check-conflicts
 * @desc    Check for scheduling conflicts (for new timetables)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    {date, startTime, endTime, roomNumber, subjectId, examId}
 * @permissions exam_timetable:create
 */
router.post('/check-conflicts',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam_timetable:create']),
  examTimetableController.checkConflicts.bind(examTimetableController)
);

/**
 * @route   POST /api/exam-timetables/exam/:examId/generate-schedule
 * @desc    Generate optimal schedule for an exam
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {examId} - Exam ID
 * @body    {constraints: {maxExamsPerDay, minGapBetweenExams, preferredTimeSlots}}
 * @permissions exam_timetable:create
 */
router.post('/exam/:examId/generate-schedule',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam_timetable:create']),
  validateParams({ examId: idSchema.shape.id }),
  examTimetableController.generateOptimalSchedule.bind(examTimetableController)
);

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * @route   GET /api/exam-timetables/:id/stats
 * @desc    Get exam timetable statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Exam Timetable ID
 * @permissions exam_timetable:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  validateParams(idSchema),
  examTimetableController.getExamTimetableStats.bind(examTimetableController)
);

/**
 * @route   GET /api/exam-timetables/:id/analytics
 * @desc    Get exam timetable analytics
 * @access  Private (All authenticated users)
 * @params  {id} - Exam Timetable ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions exam_timetable:analytics
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['exam_timetable:analytics']),
  validateParams(idSchema),
  analyticsLimiter,
  examTimetableController.getExamTimetableAnalytics.bind(examTimetableController)
);

/**
 * @route   GET /api/exam-timetables/:id/performance
 * @desc    Get exam timetable performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Exam Timetable ID
 * @permissions exam_timetable:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  validateParams(idSchema),
  examTimetableController.getExamTimetablePerformance.bind(examTimetableController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/exam-timetables/bulk/create
 * @desc    Bulk create exam timetables
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {timetables: ExamTimetableCreateSchema[], skipDuplicates: boolean}
 * @permissions exam_timetable:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam_timetable:create']),
  bulkLimiter,
  auditLog('BULK_CREATE', 'ExamTimetable'),
  examTimetableController.bulkCreateExamTimetables.bind(examTimetableController)
);

/**
 * @route   PUT /api/exam-timetables/bulk/update
 * @desc    Bulk update exam timetables
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {updates: ExamTimetableUpdateSchema[]}
 * @permissions exam_timetable:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam_timetable:update']),
  bulkLimiter,
  auditLog('BULK_UPDATE', 'ExamTimetable'),
  examTimetableController.bulkUpdateExamTimetables.bind(examTimetableController)
);

/**
 * @route   DELETE /api/exam-timetables/bulk/delete
 * @desc    Bulk delete exam timetables
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {timetableIds: number[]}
 * @permissions exam_timetable:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam_timetable:delete']),
  bulkLimiter,
  auditLog('BULK_DELETE', 'ExamTimetable'),
  examTimetableController.bulkDeleteExamTimetables.bind(examTimetableController)
);

// ======================
// SEARCH & FILTER
// ======================

/**
 * @route   GET /api/exam-timetables/search
 * @desc    Search exam timetables with advanced filters
 * @access  Private (All authenticated users)
 * @query   ExamTimetableSearchSchema
 * @permissions exam_timetable:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  examTimetableSearchLimiter,
  validateQuery(ExamTimetableSearchSchema),
  examTimetableController.searchExamTimetables.bind(examTimetableController)
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/exam-timetables/exam/:examId
 * @desc    Get exam timetables by exam
 * @access  Private (All authenticated users)
 * @params  {examId} - Exam ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions exam_timetable:read
 */
router.get('/exam/:examId',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  validateParams({ examId: idSchema.shape.id }),
  examTimetableController.getExamTimetablesByExam.bind(examTimetableController)
);

/**
 * @route   GET /api/exam-timetables/subject/:subjectId
 * @desc    Get exam timetables by subject
 * @access  Private (All authenticated users)
 * @params  {subjectId} - Subject ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions exam_timetable:read
 */
router.get('/subject/:subjectId',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  validateParams({ subjectId: idSchema.shape.id }),
  examTimetableController.getExamTimetablesBySubject.bind(examTimetableController)
);

/**
 * @route   GET /api/exam-timetables/upcoming
 * @desc    Get upcoming exam timetables
 * @access  Private (All authenticated users)
 * @query   {days} - Number of days to look ahead (default: 7)
 * @query   {include} - Comma-separated list of relations to include
 * @permissions exam_timetable:read
 */
router.get('/upcoming',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  examTimetableController.getUpcomingExamTimetables.bind(examTimetableController)
);

/**
 * @route   GET /api/exam-timetables/report
 * @desc    Generate exam timetable report
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {...ExamTimetableSearchSchema} - Filters for report
 * @permissions exam_timetable:read
 */
router.get('/report',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam_timetable:read']),
  examTimetableController.generateExamTimetableReport.bind(examTimetableController)
);

/**
 * @route   GET /api/exam-timetables/distribution
 * @desc    Get exam timetable distribution statistics
 * @access  Private (All authenticated users)
 * @query   {schoolId} - Optional school ID filter
 * @permissions exam_timetable:read
 */
router.get('/distribution',
  authenticateToken,
  authorizePermissions(['exam_timetable:read']),
  examTimetableController.getExamTimetableDistribution.bind(examTimetableController)
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   GET /api/exam-timetables/export
 * @desc    Export exam timetables data
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {format} - Export format (json, csv)
 * @query   {...ExamTimetableSearchSchema} - Filters for export
 * @permissions exam_timetable:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam_timetable:export']),
  exportLimiter,
  examTimetableController.exportExamTimetables.bind(examTimetableController)
);

/**
 * @route   POST /api/exam-timetables/import
 * @desc    Import exam timetables data
 * @access  Private (SUPER_ADMIN)
 * @body    {timetables: ExamTimetableCreateSchema[], user: User}
 * @permissions exam_timetable:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['exam_timetable:import']),
  bulkLimiter,
  auditLog('IMPORT', 'ExamTimetable'),
  examTimetableController.importExamTimetables.bind(examTimetableController)
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/exam-timetables/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  examTimetableController.getCacheStats.bind(examTimetableController)
);

/**
 * @route   POST /api/exam-timetables/cache/warm
 * @desc    Warm up cache
 * @access  Private (SUPER_ADMIN)
 * @body    {timetableId?} - Optional specific timetable ID to warm
 * @body    {schoolId?} - Optional school ID to warm all timetables
 * @permissions system:cache_manage
 */
router.post('/cache/warm',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  cacheLimiter,
  examTimetableController.warmCache.bind(examTimetableController)
);

/**
 * @route   DELETE /api/exam-timetables/cache/clear
 * @desc    Clear cache
 * @access  Private (SUPER_ADMIN)
 * @permissions system:cache_manage
 */
router.delete('/cache/clear',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['system:cache_manage']),
  examTimetableController.clearCache.bind(examTimetableController)
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
  console.error('Exam timetable route error:', error);
  
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

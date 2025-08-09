import express from 'express';
import { z } from 'zod';
import examController from '../controllers/examController.js';
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
  examSearchLimiter
} from '../middleware/rateLimiter.js';

const router = express.Router();

// ======================
// SCHEMAS
// ======================

const ExamCreateSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  type: z.enum(['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT', 'PROJECT', 'PRACTICAL']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  description: z.string().optional(),
  totalMarks: z.number().min(0).max(999.99),
  passingMarks: z.number().min(0).max(999.99),
  termId: z.number().int().positive().optional(),
  classId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional()
});

const ExamUpdateSchema = ExamCreateSchema.partial().omit({ code: true });

const ExamSearchSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  type: z.enum(['MIDTERM', 'FINAL', 'QUIZ', 'ASSIGNMENT', 'PROJECT', 'PRACTICAL']).optional(),
  classId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  termId: z.number().int().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  include: z.string().optional(),
  sortBy: z.string().default('startDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

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
 * @route   POST /api/exams
 * @desc    Create a new exam
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    ExamCreateSchema
 * @permissions exam:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam:create']),
  validateBody(ExamCreateSchema),
  auditLog('CREATE', 'Exam'),
  examController.createExam.bind(examController)
);

/**
 * @route   GET /api/exams
 * @desc    Get exams with pagination and filters
 * @access  Private (All authenticated users)
 * @query   ExamSearchSchema
 * @permissions exam:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['exam:read']),
  validateQuery(ExamSearchSchema),
  examController.getExams.bind(examController)
);

/**
 * @route   GET /api/exams/:id
 * @desc    Get exam by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Exam ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions exam:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['exam:read']),
  validateParams(idSchema),
  examController.getExamById.bind(examController)
);

/**
 * @route   PUT /api/exams/:id
 * @desc    Update exam by ID
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Exam ID
 * @body    ExamUpdateSchema
 * @permissions exam:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam:update']),
  validateParams(idSchema),
  validateBody(ExamUpdateSchema),
  auditLog('UPDATE', 'Exam'),
  examController.updateExam.bind(examController)
);

/**
 * @route   DELETE /api/exams/:id
 * @desc    Delete exam by ID (soft delete)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Exam ID
 * @permissions exam:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam:delete']),
  validateParams(idSchema),
  auditLog('DELETE', 'Exam'),
  examController.deleteExam.bind(examController)
);

/**
 * @route   PATCH /api/exams/:id/restore
 * @desc    Restore deleted exam
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Exam ID
 * @permissions exam:restore
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['exam:restore']),
  validateParams(idSchema),
  auditLog('RESTORE', 'Exam'),
  examController.restoreExam.bind(examController)
);

// ======================
// ANALYTICS & REPORTING
// ======================

/**
 * @route   GET /api/exams/:id/stats
 * @desc    Get exam statistics
 * @access  Private (All authenticated users)
 * @params  {id} - Exam ID
 * @permissions exam:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['exam:read']),
  analyticsLimiter,
  validateParams(idSchema),
  examController.getExamStats.bind(examController)
);

/**
 * @route   GET /api/exams/:id/analytics
 * @desc    Get exam analytics
 * @access  Private (All authenticated users)
 * @params  {id} - Exam ID
 * @query   {period} - Analytics period (7d, 30d, 90d, 1y)
 * @permissions exam:read
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['exam:read']),
  analyticsLimiter,
  validateParams(idSchema),
  examController.getExamAnalytics.bind(examController)
);

/**
 * @route   GET /api/exams/:id/performance
 * @desc    Get exam performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Exam ID
 * @permissions exam:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['exam:read']),
  analyticsLimiter,
  validateParams(idSchema),
  examController.getExamPerformance.bind(examController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/exams/bulk/create
 * @desc    Bulk create exams
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    {exams: ExamCreateSchema[], skipDuplicates: boolean}
 * @permissions exam:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam:create']),
  bulkLimiter,
  auditLog('BULK_CREATE', 'Exam'),
  examController.bulkCreateExams.bind(examController)
);

/**
 * @route   PUT /api/exams/bulk/update
 * @desc    Bulk update exams
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    {updates: {id: number, data: ExamUpdateSchema}[]}
 * @permissions exam:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam:update']),
  bulkLimiter,
  auditLog('BULK_UPDATE', 'Exam'),
  examController.bulkUpdateExams.bind(examController)
);

/**
 * @route   DELETE /api/exams/bulk/delete
 * @desc    Bulk delete exams
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    {examIds: number[]}
 * @permissions exam:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam:delete']),
  bulkLimiter,
  auditLog('BULK_DELETE', 'Exam'),
  examController.bulkDeleteExams.bind(examController)
);

// ======================
// SEARCH & FILTER
// ======================

/**
 * @route   GET /api/exams/search
 * @desc    Search exams
 * @access  Private (All authenticated users)
 * @query   {q: string, include?: string}
 * @permissions exam:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['exam:read']),
  examSearchLimiter,
  examController.searchExams.bind(examController)
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   GET /api/exams/class/:classId
 * @desc    Get exams by class
 * @access  Private (All authenticated users)
 * @params  {classId} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions exam:read, class:read
 */
router.get('/class/:classId',
  authenticateToken,
  authorizePermissions(['exam:read', 'class:read']),
  validateParams({ classId: idSchema.shape.id }),
  examController.getExamsByClass.bind(examController)
);

/**
 * @route   GET /api/exams/subject/:subjectId
 * @desc    Get exams by subject
 * @access  Private (All authenticated users)
 * @params  {subjectId} - Subject ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions exam:read, subject:read
 */
router.get('/subject/:subjectId',
  authenticateToken,
  authorizePermissions(['exam:read', 'subject:read']),
  validateParams({ subjectId: idSchema.shape.id }),
  examController.getExamsBySubject.bind(examController)
);

/**
 * @route   GET /api/exams/upcoming
 * @desc    Get upcoming exams
 * @access  Private (All authenticated users)
 * @query   {days: number, include?: string}
 * @permissions exam:read
 */
router.get('/upcoming',
  authenticateToken,
  authorizePermissions(['exam:read']),
  examController.getUpcomingExams.bind(examController)
);

// ======================
// REPORTING
// ======================

/**
 * @route   GET /api/exams/report
 * @desc    Generate exam report
 * @access  Private (All authenticated users)
 * @query   ExamSearchSchema (subset for filtering)
 * @permissions exam:read
 */
router.get('/report',
  authenticateToken,
  authorizePermissions(['exam:read']),
  analyticsLimiter,
  examController.generateExamReport.bind(examController)
);

// ======================
// IMPORT/EXPORT
// ======================

/**
 * @route   GET /api/exams/export
 * @desc    Export exams
 * @access  Private (All authenticated users)
 * @query   {format: 'csv'|'json', ...ExamSearchSchema}
 * @permissions exam:read
 */
router.get('/export',
  authenticateToken,
  authorizePermissions(['exam:read']),
  exportLimiter,
  examController.exportExams.bind(examController)
);

/**
 * @route   POST /api/exams/import
 * @desc    Import exams
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    {exams: ExamCreateSchema[]}
 * @permissions exam:create
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['exam:create']),
  bulkLimiter,
  auditLog('IMPORT', 'Exam'),
  examController.importExams.bind(examController)
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   GET /api/exams/cache/stats
 * @desc    Get cache statistics
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @permissions system:read
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['system:read']),
  cacheLimiter,
  examController.getCacheStats.bind(examController)
);

/**
 * @route   POST /api/exams/cache/warm
 * @desc    Warm cache
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {examId?} - Optional exam ID to warm specific exam
 * @permissions system:write
 */
router.post('/cache/warm/:examId?',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['system:write']),
  cacheLimiter,
  examController.warmCache.bind(examController)
);

/**
 * @route   DELETE /api/exams/cache/clear
 * @desc    Clear cache
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   {all: boolean} - Clear all caches or just school-specific
 * @permissions system:write
 */
router.delete('/cache/clear',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['system:write']),
  cacheLimiter,
  examController.clearCache.bind(examController)
);

export default router;

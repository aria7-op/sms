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
 * @route   GET /api/parents/debug/test
 * @desc    Test endpoint to isolate database issues
 * @access  Private (All authenticated users)
 * @permissions parent:read
 */
router.get('/debug/test',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentTest.bind(parentController)
);

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
 * @permissions parent:read
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['parent:read']),
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
// PARENT PORTAL ROUTES
// ======================

/**
 * @route   GET /api/parents/:id/students
 * @desc    Get parent's students
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:read, student:read
 */
router.get('/:id/students',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read']),
  validateParams(idSchema),
  parentController.getParentStudents.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/attendance
 * @desc    Get student attendance for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, attendance:read
 */
router.get('/:id/students/:studentId/attendance',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'attendance:read']),
  validateParams({ ...idSchema.shape, studentId: idSchema.shape.id }),
  parentController.getParentStudentAttendance.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/grades
 * @desc    Get student grades for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, grade:read
 */
router.get('/:id/students/:studentId/grades',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'grade:read']),
  validateParams({ ...idSchema.shape, studentId: idSchema.shape.id }),
  parentController.getParentStudentGrades.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/assignments
 * @desc    Get student assignments for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, assignment:read
 */
router.get('/:id/students/:studentId/assignments',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'assignment:read']),
  validateParams({ ...idSchema.shape, studentId: idSchema.shape.id }),
  parentController.getParentStudentAssignments.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/exams
 * @desc    Get student exams for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, exam:read
 */
router.get('/:id/students/:studentId/exams',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'exam:read']),
  validateParams({ ...idSchema.shape, studentId: idSchema.shape.id }),
  parentController.getParentStudentExams.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/timetable
 * @desc    Get student timetable for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, timetable:read
 */
router.get('/:id/students/:studentId/timetable',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'timetable:read']),
  validateParams({ ...idSchema.shape, studentId: idSchema.shape.id }),
  parentController.getParentStudentTimetable.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/fees
 * @desc    Get student fees for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, fee:read
 */
router.get('/:id/students/:studentId/fees',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'fee:read']),
  parentController.getParentStudentFees.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/payments
 * @desc    Get student payments for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, payment:read
 */
router.get('/:id/students/:studentId/payments',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'payment:read']),
  parentController.getParentStudentPayments.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/reports
 * @desc    Get student reports for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, report:read
 */
router.get('/:id/students/:studentId/reports',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'report:read']),
  parentController.getParentStudentReports.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/documents
 * @desc    Get student documents for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, document:read
 */
router.get('/:id/students/:studentId/documents',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'document:read']),
  parentController.getParentStudentDocuments.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/announcements
 * @desc    Get student announcements for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, announcement:read
 */
router.get('/:id/students/:studentId/announcements',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'announcement:read']),
  parentController.getParentStudentAnnouncements.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/messages
 * @desc    Get student messages for parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {studentId} - Student ID
 * @permissions parent:read, student:read, message:read
 */
router.get('/:id/students/:studentId/messages',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'student:read', 'message:read']),
  parentController.getParentStudentMessages.bind(parentController)
);

/**
 * @route   POST /api/parents/:id/messages
 * @desc    Send message from parent
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:read, message:create
 */
router.post('/:id/messages',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'message:create']),
  validateParams(idSchema),
  parentController.sendParentMessage.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/notifications
 * @desc    Get parent notifications
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:read, notification:read
 */
router.get('/:id/notifications',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'notification:read']),
  validateParams(idSchema),
  parentController.getParentNotifications.bind(parentController)
);

/**
 * @route   PATCH /api/parents/:id/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID, {notificationId} - Notification ID
 * @permissions parent:read, notification:update
 */
router.patch('/:id/notifications/:notificationId/read',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'notification:update']),
  validateParams({ ...idSchema.shape, notificationId: idSchema.shape.id }),
  parentController.markParentNotificationAsRead.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/dashboard
 * @desc    Get parent dashboard data
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:read
 */
router.get('/:id/dashboard',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentDashboard.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/calendar
 * @desc    Get parent calendar data
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:read
 */
router.get('/:id/calendar',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentCalendar.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/settings
 * @desc    Get parent settings
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:read
 */
router.get('/:id/settings',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentSettings.bind(parentController)
);

/**
 * @route   PUT /api/parents/:id/settings
 * @desc    Update parent settings
 * @access  Private (PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN)
 * @params  {id} - Parent ID
 * @permissions parent:read, parent:update
 */
router.put('/:id/settings',
  authenticateToken,
  authorizeRoles(['PARENT', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  authorizePermissions(['parent:read', 'parent:update']),
  validateParams(idSchema),
  parentController.updateParentSettings.bind(parentController)
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

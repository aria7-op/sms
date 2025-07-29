import express from 'express';
import * as classController from '../controllers/classController.js';
import * as classSchemas from '../utils/classSchemas.js';
import {
  validateRequest,
  sanitizeRequest,
  idSchema,
  paginationSchema,
  validateClassCreateRequest
} from '../middleware/validation.js';
import {
  authenticateToken,
  authorizeRoles,
  authorizePermissions,
  authorizeOwnerAccess
} from '../middleware/auth.js';
import {
  rateLimiter,
  classCreateLimiter,
  classSearchLimiter,
  classBulkLimiter,
  classAnalyticsLimiter
} from '../middleware/rateLimiter.js';
import { auditLog } from '../middleware/audit.js';
import { z } from 'zod';

const router = express.Router();

// ======================
// CRUD OPERATIONS
// ======================

/**
 * @route   POST /api/classes
 * @desc    Create a new class
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    ClassCreateSchema
 * @permissions class:create
 */
router.post('/',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['class:create']),
  classCreateLimiter,
  validateClassCreateRequest,
  auditLog('CREATE', 'Class'),
  classController.createClass
);

/**
 * @route   GET /api/classes
 * @desc    Get classes with pagination and filters
 * @access  Private (All authenticated users)
 * @query   ClassSearchSchema
 * @permissions class:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['class:read']),
  classSearchLimiter,
  validateRequest(classSchemas.ClassSearchSchema, 'query'),
  classController.getAllClasses
);

/**
 * @route   GET /api/classes/analytics
 * @desc    Get class analytics
 * @access  Private (All authenticated users)
 * @query   ClassAnalyticsSchema
 * @permissions class:read
 */
router.get('/analytics',
  authenticateToken,
  authorizePermissions(['class:read']),
  classAnalyticsLimiter,
  validateRequest(classSchemas.ClassAnalyticsSchema, 'query'),
  classController.getClassAnalytics
);

/**
 * @route   GET /api/classes/count
 * @desc    Get class count with filters
 * @access  Private (All authenticated users)
 * @query   {schoolId, level, section} - Optional filters
 * @permissions class:read
 */
router.get('/count',
  authenticateToken,
  authorizePermissions(['class:read']),
  classController.getClassCount
);

/**
 * @route   GET /api/classes/stats
 * @desc    Get class statistics
 * @access  Private (All authenticated users)
 * @query   {schoolId, level} - Optional filters
 * @permissions class:read
 */
router.get('/stats',
  authenticateToken,
  authorizePermissions(['class:read']),
  classAnalyticsLimiter,
  classController.getClassStats
);

/**
 * @route   GET /api/classes/export
 * @desc    Export classes
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @query   ClassExportSchema
 * @permissions class:export
 */
router.get('/export',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:export']),
  validateRequest(classSchemas.ClassExportSchema, 'query'),
  classController.exportClasses
);

/**
 * @route   GET /api/classes/suggestions/name
 * @desc    Get class name suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @query   {level, section, schoolId} - Optional filters
 * @permissions class:read
 */
router.get('/suggestions/name',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['class:read']),
  classController.getClassNameSuggestions
);

/**
 * @route   GET /api/classes/suggestions/code
 * @desc    Get class code suggestions
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @query   {name, level, section, schoolId} - Optional filters
 * @permissions class:read
 */
router.get('/suggestions/code',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['class:read']),
  classController.getClassCodeSuggestions
);

/**
 * @route   GET /api/classes/cache/stats
 * @desc    Get class cache statistics
 * @access  Private (SUPER_ADMIN)
 * @permissions class:admin
 */
router.get('/cache/stats',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['class:admin']),
  classController.getClassCacheStats
);

/**
 * @route   GET /api/classes/cache/health
 * @desc    Check class cache health
 * @access  Private (SUPER_ADMIN)
 * @permissions class:admin
 */
router.get('/cache/health',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['class:admin']),
  classController.checkClassCacheHealth
);

/**
 * @route   GET /api/classes/:id
 * @desc    Get class by ID
 * @access  Private (All authenticated users)
 * @params  {id} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['class:read']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  classController.getClassById
);

/**
 * @route   PUT /api/classes/:id
 * @desc    Update class by ID
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @params  {id} - Class ID
 * @body    ClassUpdateSchema
 * @permissions class:update
 */
router.put('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['class:update']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  validateRequest(classSchemas.ClassUpdateSchema, 'body'),
  auditLog('UPDATE', 'Class'),
  classController.updateClass
);

/**
 * @route   DELETE /api/classes/:id
 * @desc    Delete class by ID
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @params  {id} - Class ID
 * @permissions class:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:delete']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  auditLog('DELETE', 'Class'),
  classController.deleteClass
);

// ======================
// ADVANCED SEARCH & FILTERING
// ======================

/**
 * @route   GET /api/classes/search/advanced
 * @desc    Advanced search with complex filters
 * @access  Private (All authenticated users)
 * @query   ClassAdvancedSearchSchema
 * @permissions class:read
 */
router.get('/search/advanced',
  authenticateToken,
  authorizePermissions(['class:read']),
  classSearchLimiter,
  validateRequest(classSchemas.ClassAdvancedSearchSchema, 'query'),
  classController.searchClasses
);

/**
 * @route   GET /api/classes/school/:schoolId
 * @desc    Get classes by school
 * @access  Private (All authenticated users)
 * @params  {schoolId} - School ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read
 */
router.get('/school/:schoolId',
  authenticateToken,
  authorizePermissions(['class:read']),
  validateRequest(z.object({ schoolId: idSchema.shape.id }), 'params'),
  authorizeOwnerAccess('schoolId'),
  classController.getClassesBySchool
);

/**
 * @route   GET /api/classes/level/:level
 * @desc    Get classes by level
 * @access  Private (All authenticated users)
 * @params  {level} - Class level (1-20)
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read
 */
router.get('/level/:level',
  authenticateToken,
  authorizePermissions(['class:read']),
  validateRequest(z.coerce.number().int().min(1).max(20), 'params'),
  classController.getClassesByLevel
);

/**
 * @route   GET /api/classes/teacher/:teacherId
 * @desc    Get classes by teacher
 * @access  Private (All authenticated users)
 * @params  {teacherId} - Teacher ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read
 */
router.get('/teacher/:teacherId',
  authenticateToken,
  authorizePermissions(['class:read']),
  validateRequest(z.object({ teacherId: idSchema.shape.id }), 'params'),
  classController.getClassesByTeacher
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/classes/bulk/create
 * @desc    Bulk create classes
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    ClassBulkCreateSchema
 * @permissions class:create
 */
router.post('/bulk/create',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:create']),
  classBulkLimiter,
  validateRequest(classSchemas.ClassBulkCreateSchema, 'body'),
  auditLog('BULK_CREATE', 'Class'),
  classController.bulkCreateClasses
);

/**
 * @route   PUT /api/classes/bulk/update
 * @desc    Bulk update classes
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    ClassBulkUpdateSchema
 * @permissions class:update
 */
router.put('/bulk/update',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['class:update']),
  classBulkLimiter,
  validateRequest(classSchemas.ClassBulkUpdateSchema, 'body'),
  auditLog('BULK_UPDATE', 'Class'),
  classController.bulkUpdateClasses
);

/**
 * @route   DELETE /api/classes/bulk/delete
 * @desc    Bulk delete classes
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {ids: number[]} - Array of class IDs
 * @permissions class:delete
 */
router.delete('/bulk/delete',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:delete']),
  classBulkLimiter,
  validateRequest(z.object({ ids: z.array(idSchema.shape.id) }), 'body'),
  auditLog('BULK_DELETE', 'Class'),
  classController.bulkDeleteClasses
);

// ======================
// ANALYTICS & STATISTICS
// ======================

/**
 * @route   GET /api/classes/performance/:id
 * @desc    Get class performance metrics
 * @access  Private (All authenticated users)
 * @params  {id} - Class ID
 * @query   ClassPerformanceSchema
 * @permissions class:read
 */
router.get('/performance/:id',
  authenticateToken,
  authorizePermissions(['class:read']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  validateRequest(classSchemas.ClassPerformanceSchema, 'query'),
  classController.getClassPerformance
);

// ======================
// EXPORT & IMPORT
// ======================

/**
 * @route   POST /api/classes/import
 * @desc    Import classes
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    ClassImportSchema
 * @permissions class:import
 */
router.post('/import',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:import']),
  classBulkLimiter,
  validateRequest(classSchemas.ClassImportSchema, 'body'),
  auditLog('IMPORT', 'Class'),
  classController.importClasses
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route   POST /api/classes/generate/code
 * @desc    Generate unique class code
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, TEACHER)
 * @body    ClassCodeGenerationSchema
 * @permissions class:create
 */
router.post('/generate/code',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']),
  authorizePermissions(['class:create']),
  validateRequest(classSchemas.ClassCodeGenerationSchema, 'body'),
  classController.generateClassCode
);

/**
 * @route   POST /api/classes/generate/sections
 * @desc    Generate class sections for a level
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    ClassSectionGenerationSchema
 * @permissions class:create
 */
router.post('/generate/sections',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:create']),
  validateRequest(classSchemas.ClassSectionGenerationSchema, 'body'),
  classController.generateClassSections
);

// ======================
// CACHE MANAGEMENT
// ======================

/**
 * @route   DELETE /api/classes/cache/clear
 * @desc    Clear class cache
 * @access  Private (SUPER_ADMIN)
 * @permissions class:admin
 */
router.delete('/cache/clear',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN']),
  authorizePermissions(['class:admin']),
  classController.clearClassCache
);

// ======================
// RELATIONSHIP ENDPOINTS
// ======================

/**
 * @route   GET /api/classes/:id/students
 * @desc    Get students in a class
 * @access  Private (All authenticated users)
 * @params  {id} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read, student:read
 */
router.get('/:id/students',
  authenticateToken,
  authorizePermissions(['class:read', 'student:read']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  classController.getClassStudents
);

/**
 * @route   GET /api/classes/:id/subjects
 * @desc    Get subjects in a class
 * @access  Private (All authenticated users)
 * @params  {id} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read, subject:read
 */
router.get('/:id/subjects',
  authenticateToken,
  authorizePermissions(['class:read', 'subject:read']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  classController.getClassSubjects
);

/**
 * @route   GET /api/classes/:id/timetables
 * @desc    Get timetables for a class
 * @access  Private (All authenticated users)
 * @params  {id} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read, timetable:read
 */
router.get('/:id/timetables',
  authenticateToken,
  authorizePermissions(['class:read', 'timetable:read']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  classController.getClassTimetables
);

/**
 * @route   GET /api/classes/:id/exams
 * @desc    Get exams for a class
 * @access  Private (All authenticated users)
 * @params  {id} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read, exam:read
 */
router.get('/:id/exams',
  authenticateToken,
  authorizePermissions(['class:read', 'exam:read']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  classController.getClassExams
);

/**
 * @route   GET /api/classes/:id/assignments
 * @desc    Get assignments for a class
 * @access  Private (All authenticated users)
 * @params  {id} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read, assignment:read
 */
router.get('/:id/assignments',
  authenticateToken,
  authorizePermissions(['class:read', 'assignment:read']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  classController.getClassAssignments
);

/**
 * @route   GET /api/classes/:id/attendances
 * @desc    Get attendances for a class
 * @access  Private (All authenticated users)
 * @params  {id} - Class ID
 * @query   {include} - Comma-separated list of relations to include
 * @permissions class:read, attendance:read
 */
router.get('/:id/attendances',
  authenticateToken,
  authorizePermissions(['class:read', 'attendance:read']),
  validateRequest(z.object({ id: idSchema.shape.id }), 'params'),
  classController.getClassAttendances
);

// ======================
// BATCH OPERATIONS
// ======================

/**
 * @route   POST /api/classes/batch/assign-teacher
 * @desc    Assign teacher to multiple classes
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {classIds: number[], teacherId: number}
 * @permissions class:update
 */
router.post('/batch/assign-teacher',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:update']),
  validateRequest(z.object({
    classIds: z.array(idSchema.shape.id),
    teacherId: idSchema.shape.id
  }), 'body'),
  auditLog('BATCH_UPDATE', 'Class'),
  classController.batchAssignTeacher
);

/**
 * @route   POST /api/classes/batch/update-capacity
 * @desc    Update capacity for multiple classes
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {classIds: number[], capacity: number}
 * @permissions class:update
 */
router.post('/batch/update-capacity',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:update']),
  validateRequest(z.object({
    classIds: z.array(idSchema.shape.id),
    capacity: z.number().int().min(1).max(1000)
  }), 'body'),
  auditLog('BATCH_UPDATE', 'Class'),
  classController.batchUpdateCapacity
);

/**
 * @route   POST /api/classes/batch/transfer-students
 * @desc    Transfer students between classes
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 * @body    {fromClassId: number, toClassId: number, studentIds: number[]}
 * @permissions class:update, student:update
 */
router.post('/batch/transfer-students',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  authorizePermissions(['class:update', 'student:update']),
  validateRequest(z.object({
    fromClassId: idSchema.shape.id,
    toClassId: idSchema.shape.id,
    studentIds: z.array(idSchema.shape.id)
  }), 'body'),
  auditLog('BATCH_UPDATE', 'Class'),
  classController.batchTransferStudents
);

export default router; 
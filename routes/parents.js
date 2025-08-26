import express from 'express';
import parentController from '../controllers/parentController.js';
import { authenticateToken, authorizePermissions } from '../middleware/auth.js';
import { validateParams, validateBody, idSchema, paginationSchema } from '../middleware/validation.js';
import { z } from 'zod';

const router = express.Router();

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * @route   POST /api/parents
 * @desc    Create a new parent
 * @access  Private (Admin, Staff)
 * @permissions parent:create
 */
router.post('/',
  authenticateToken,
  authorizePermissions(['parent:create']),
  parentController.createParent.bind(parentController)
);

/**
 * @route   GET /api/parents
 * @desc    Get all parents with filtering and pagination
 * @access  Private (Admin, Staff, Teacher)
 * @permissions parent:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParents.bind(parentController)
);

/**
 * @route   GET /api/parents/:id
 * @desc    Get parent by ID
 * @access  Private (Admin, Staff, Teacher, Parent)
 * @permissions parent:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentById.bind(parentController)
);

/**
 * @route   PUT /api/parents/:id
 * @desc    Update parent
 * @access  Private (Admin, Staff)
 * @permissions parent:update
 */
router.put('/:id',
  authenticateToken,
  authorizePermissions(['parent:update']),
  validateParams(idSchema),
  parentController.updateParent.bind(parentController)
);

/**
 * @route   DELETE /api/parents/:id
 * @desc    Soft delete parent
 * @access  Private (Admin, Staff)
 * @permissions parent:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizePermissions(['parent:delete']),
  validateParams(idSchema),
  parentController.deleteParent.bind(parentController)
);

/**
 * @route   PATCH /api/parents/:id/restore
 * @desc    Restore soft-deleted parent
 * @access  Private (Admin, Staff)
 * @permissions parent:update
 */
router.patch('/:id/restore',
  authenticateToken,
  authorizePermissions(['parent:update']),
  validateParams(idSchema),
  parentController.restoreParent.bind(parentController)
);

// ============================================================================
// Analytics & Statistics
// ============================================================================

/**
 * @route   GET /api/parents/:id/stats
 * @desc    Get parent statistics
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentStats.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/analytics
 * @desc    Get parent analytics
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentAnalytics.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/performance
 * @desc    Get parent performance metrics
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentPerformance.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/dashboard
 * @desc    Get parent dashboard data
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/dashboard',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentDashboard.bind(parentController)
);

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * @route   POST /api/parents/bulk
 * @desc    Bulk create parents
 * @access  Private (Admin, Staff)
 * @permissions parent:create
 */
router.post('/bulk',
  authenticateToken,
  authorizePermissions(['parent:create']),
  parentController.bulkCreateParents.bind(parentController)
);

/**
 * @route   PUT /api/parents/bulk
 * @desc    Bulk update parents
 * @access  Private (Admin, Staff)
 * @permissions parent:update
 */
router.put('/bulk',
  authenticateToken,
  authorizePermissions(['parent:update']),
  parentController.bulkUpdateParents.bind(parentController)
);

/**
 * @route   DELETE /api/parents/bulk
 * @desc    Bulk delete parents
 * @access  Private (Admin, Staff)
 * @permissions parent:delete
 */
router.delete('/bulk',
  authenticateToken,
  authorizePermissions(['parent:delete']),
  parentController.bulkDeleteParents.bind(parentController)
);

// ============================================================================
// Search & Export
// ============================================================================

/**
 * @route   GET /api/parents/search
 * @desc    Search parents
 * @access  Private (Admin, Staff, Teacher)
 * @permissions parent:read
 */
router.get('/search',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.searchParents.bind(parentController)
);

/**
 * @route   GET /api/parents/export
 * @desc    Export parents data
 * @access  Private (Admin, Staff)
 * @permissions parent:read
 */
router.get('/export',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.exportParents.bind(parentController)
);

/**
 * @route   POST /api/parents/import
 * @desc    Import parents data
 * @access  Private (Admin, Staff)
 * @permissions parent:create
 */
router.post('/import',
  authenticateToken,
  authorizePermissions(['parent:create']),
  parentController.importParents.bind(parentController)
);

// ============================================================================
// Code Generation & Analysis
// ============================================================================

/**
 * @route   GET /api/parents/code-suggestions
 * @desc    Generate parent code suggestions
 * @access  Private (Admin, Staff)
 * @permissions parent:create
 */
router.get('/code-suggestions',
  authenticateToken,
  authorizePermissions(['parent:create']),
  parentController.generateCodeSuggestions.bind(parentController)
);

/**
 * @route   GET /api/parents/analytics/income-range
 * @desc    Get parent count by income range
 * @access  Private (Admin, Staff)
 * @permissions parent:read
 */
router.get('/analytics/income-range',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentCountByIncomeRange.bind(parentController)
);

/**
 * @route   GET /api/parents/analytics/education
 * @desc    Get parent count by education level
 * @access  Private (Admin, Staff)
 * @permissions parent:read
 */
router.get('/analytics/education',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentCountByEducation.bind(parentController)
);

/**
 * @route   GET /api/parents/analytics/school
 * @desc    Get parents by school
 * @access  Private (Admin, Staff)
 * @permissions parent:read
 */
router.get('/analytics/school',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentsBySchool.bind(parentController)
);

/**
 * @route   GET /api/parents/analytics/report
 * @desc    Get parent report
 * @access  Private (Admin, Staff)
 * @permissions parent:read
 */
router.get('/analytics/report',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentReport.bind(parentController)
);

/**
 * @route   GET /api/parents/analytics/comparison
 * @desc    Get parent comparison data
 * @access  Private (Admin, Staff)
 * @permissions parent:read
 */
router.get('/analytics/comparison',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentComparison.bind(parentController)
);

// ============================================================================
// Student-Related Endpoints
// ============================================================================

/**
 * @route   GET /api/parents/:id/students
 * @desc    Get parent's students
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:id/students',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  validateParams(idSchema),
  parentController.getParentStudents.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/attendance
 * @desc    Get student attendance for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, attendance:read_children
 */
router.get('/:id/students/:studentId/attendance',
  authenticateToken,
  authorizePermissions(['parent:read', 'attendance:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentAttendance.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/grades
 * @desc    Get student grades for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, grade:read_children
 */
router.get('/:id/students/:studentId/grades',
  authenticateToken,
  authorizePermissions(['parent:read', 'grade:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentGrades.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/assignments
 * @desc    Get student assignments for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, assignment:read_children
 */
router.get('/:id/students/:studentId/assignments',
  authenticateToken,
  authorizePermissions(['parent:read', 'assignment:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentAssignments.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/exams
 * @desc    Get student exams for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, exam:read_children
 */
router.get('/:id/students/:studentId/exams',
  authenticateToken,
  authorizePermissions(['parent:read', 'exam:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentExams.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/timetable
 * @desc    Get student timetable for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, timetable:read_children
 */
router.get('/:id/students/:studentId/timetable',
  authenticateToken,
  authorizePermissions(['parent:read', 'timetable:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentTimetable.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/fees
 * @desc    Get student fees for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, fee:read_children
 */
router.get('/:id/students/:studentId/fees',
  authenticateToken,
  authorizePermissions(['parent:read', 'fee:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentFees.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/payments
 * @desc    Get student payments for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, payment:read_children
 */
router.get('/:id/students/:studentId/payments',
  authenticateToken,
  authorizePermissions(['parent:read', 'payment:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentPayments.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/reports
 * @desc    Get student reports for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, report:read_children
 */
router.get('/:id/students/:studentId/reports',
  authenticateToken,
  authorizePermissions(['parent:read', 'report:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentReports.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/documents
 * @desc    Get student documents for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, document:read_children
 */
router.get('/:id/students/:studentId/documents',
  authenticateToken,
  authorizePermissions(['parent:read', 'document:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentDocuments.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/announcements
 * @desc    Get student announcements for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, announcement:read_children
 */
router.get('/:id/students/:studentId/announcements',
  authenticateToken,
  authorizePermissions(['parent:read', 'announcement:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentAnnouncements.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/students/:studentId/messages
 * @desc    Get student messages for parent
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, message:read_children
 */
router.get('/:id/students/:studentId/messages',
  authenticateToken,
  authorizePermissions(['parent:read', 'message:read_children']),
  validateParams(z.object({ id: idSchema.shape.id, studentId: idSchema.shape.id })),
  parentController.getParentStudentMessages.bind(parentController)
);

// ============================================================================
// Communication & Notifications
// ============================================================================

/**
 * @route   POST /api/parents/:id/messages
 * @desc    Send message to parent
 * @access  Private (Admin, Staff, Teacher)
 * @permissions parent:read, message:create
 */
router.post('/:id/messages',
  authenticateToken,
  authorizePermissions(['parent:read', 'message:create']),
  validateParams(idSchema),
  parentController.sendParentMessage.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/notifications
 * @desc    Get parent notifications
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, notification:read
 */
router.get('/:id/notifications',
  authenticateToken,
  authorizePermissions(['parent:read', 'notification:read']),
  validateParams(idSchema),
  parentController.getParentNotifications.bind(parentController)
);

/**
 * @route   PATCH /api/parents/:id/notifications/:notificationId/read
 * @desc    Mark parent notification as read
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, notification:update
 */
router.patch('/:id/notifications/:notificationId/read',
  authenticateToken,
  authorizePermissions(['parent:read', 'notification:update']),
  validateParams(z.object({ id: idSchema.shape.id, notificationId: idSchema.shape.id })),
  parentController.markParentNotificationAsRead.bind(parentController)
);

// ============================================================================
// Additional Features
// ============================================================================

/**
 * @route   GET /api/parents/:id/calendar
 * @desc    Get parent calendar
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/calendar',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentCalendar.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/settings
 * @desc    Get parent settings
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/settings',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentSettings.bind(parentController)
);

/**
 * @route   PUT /api/parents/:id/settings
 * @desc    Update parent settings
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, user:update_own
 */
router.put('/:id/settings',
  authenticateToken,
  authorizePermissions(['parent:read', 'user:update_own']),
  validateParams(idSchema),
  parentController.updateParentSettings.bind(parentController)
);

// ============================================================================
// Debug/Test Endpoints (Conditional)
// ============================================================================

/**
 * @route   GET /api/parents/debug/test
 * @desc    Test endpoint to isolate database issues
 * @access  Private (All authenticated users)
 * @permissions parent:read
 * Note: Only attach if method exists to avoid startup crashes
 */
if (typeof parentController.getParentTest === 'function') {
  router.get('/debug/test',
    authenticateToken,
    authorizePermissions(['parent:read']),
    parentController.getParentTest.bind(parentController)
  );
}

export default router; 

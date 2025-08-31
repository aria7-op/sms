import express from 'express';
import { authenticateToken, authorizePermissions } from '../middleware/auth.js';
import ParentController from '../controllers/parentController.js';

const router = express.Router();

// ============================================================================
// Essential CRUD Operations
// ============================================================================

/**
 * @route   GET /api/parents
 * @desc    Get all parents with filtering and pagination
 * @access  Private (Admin, Staff, Teacher)
 * @permissions parent:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['parent:read']),
  ParentController.getParents.bind(ParentController)
);

/**
 * @route   GET /api/parents/:id
 * @desc    Get parent by user ID (the ID parameter is the user ID, not parent ID)
 * @access  Private (Admin, Staff, Teacher, Parent)
 * @permissions parent:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['parent:read']),
  ParentController.getParentById.bind(ParentController)
);

/**
 * @route   POST /api/parents
 * @desc    Create a new parent
 * @access  Private (Admin, Staff)
 * @permissions parent:create
 */
router.post('/',
  authenticateToken,
  authorizePermissions(['parent:create']),
  ParentController.createParent.bind(ParentController)
);

/**
 * @route   PUT /api/parents/:id
 * @desc    Update parent by user ID (the ID parameter is the user ID, not parent ID)
 * @access  Private (Admin, Staff)
 * @permissions parent:update
 */
router.put('/:id',
  authenticateToken,
  authorizePermissions(['parent:update']),
  ParentController.updateParent.bind(ParentController)
);

/**
 * @route   DELETE /api/parents/:id
 * @desc    Soft delete parent by user ID (the ID parameter is the user ID, not parent ID)
 * @access  Private (Admin, Staff)
 * @permissions parent:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizePermissions(['parent:delete']),
  ParentController.deleteParent.bind(ParentController)
);

// ============================================================================
// Parent Students (Core Functionality)
// ============================================================================

/**
 * @route   GET /api/parents/:id/students
 * @desc    Get parent's students by user ID (the ID parameter is the user ID, not parent ID)
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:id/students',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getParentStudents.bind(ParentController)
);

// Debug endpoint
router.get('/:id/debug', 
  authenticateToken, 
  authorizePermissions(['parent:read']), 
  ParentController.debugParent.bind(ParentController)
);

// ============================================================================
// Comprehensive Student Data Endpoints
// ============================================================================

/**
 * @route   GET /api/parents/:parentId/students/:studentId/attendance
 * @desc    Get student attendance data (parent must have access to student)
 * @access  Private (Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:parentId/students/:studentId/attendance',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getStudentAttendance.bind(ParentController)
);

/**
 * @route   GET /api/parents/:parentId/students/:studentId/grades
 * @desc    Get student grades data (parent must have access to student)
 * @access  Private (Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:parentId/students/:studentId/grades',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getStudentGrades.bind(ParentController)
);

/**
 * @route   GET /api/parents/:parentId/students/:studentId/assignments
 * @desc    Get student assignments data (parent must have access to student)
 * @access  Private (Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:parentId/students/:studentId/assignments',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getStudentAssignments.bind(ParentController)
);

/**
 * @route   GET /api/parents/:parentId/students/:studentId/exams
 * @desc    Get student exams data (parent must have access to student)
 * @access  Private (Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:parentId/students/:studentId/exams',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getStudentExams.bind(ParentController)
);

/**
 * @route   GET /api/parents/:parentId/students/:studentId/fees
 * @desc    Get student fees data (parent must have access to student)
 * @access  Private (Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:parentId/students/:studentId/fees',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getStudentFees.bind(ParentController)
);

/**
 * @route   GET /api/parents/:parentId/students/:studentId/timetable
 * @desc    Get student timetable data (parent must have access to student)
 * @access  Private (Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:parentId/students/:studentId/timetable',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getStudentTimetable.bind(ParentController)
);

/**
 * @route   GET /api/parents/:parentId/notifications
 * @desc    Get parent notifications (for parent and their children)
 * @access  Private (Parent)
 * @permissions parent:read, notification:read
 */
router.get('/:parentId/notifications',
  authenticateToken,
  authorizePermissions(['parent:read', 'notification:read']),
  ParentController.getParentNotifications.bind(ParentController)
);

/**
 * @route   PATCH /api/parents/:parentId/notifications/:notificationId/read
 * @desc    Mark a specific notification as read
 * @access  Private (Parent)
 * @permissions parent:read, notification:read
 */
router.patch('/:parentId/notifications/:notificationId/read',
  authenticateToken,
  authorizePermissions(['parent:read', 'notification:read']),
  ParentController.markParentNotificationAsRead.bind(ParentController)
);

/**
 * @route   PATCH /api/parents/:parentId/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private (Parent)
 * @permissions parent:read, notification:read
 */
router.patch('/:parentId/notifications/read-all',
  authenticateToken,
  authorizePermissions(['parent:read', 'notification:read']),
  ParentController.markAllParentNotificationsAsRead.bind(ParentController)
);

/**
 * @route   GET /api/parents/:parentId/students/:studentId/notifications
 * @desc    Get student notifications data (parent must have access to student)
 * @access  Private (Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:parentId/students/:studentId/notifications',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getStudentNotifications.bind(ParentController)
);

/**
 * @route   GET /api/parents/:parentId/students/:studentId/academic-summary
 * @desc    Get student academic summary (parent must have access to student)
 * @access  Private (Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:parentId/students/:studentId/academic-summary',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  ParentController.getStudentAcademicSummary.bind(ParentController)
);

// ============================================================================
// Basic Statistics
// ============================================================================

/**
 * @route   GET /api/parents/stats
 * @desc    Get parent statistics
 * @access  Private (Admin, Staff)
 * @permissions parent:read
 */
router.get('/stats',
  authenticateToken,
  authorizePermissions(['parent:read']),
  ParentController.getParentStats.bind(ParentController)
);

export default router; 

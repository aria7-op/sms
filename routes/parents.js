import express from 'express';
import parentController from '../controllers/parentController.js';
import { authenticateToken, authorizePermissions } from '../middleware/auth.js';

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
  parentController.getParents.bind(parentController)
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
  parentController.getParentById.bind(parentController)
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
  parentController.createParent.bind(parentController)
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
  parentController.updateParent.bind(parentController)
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
  parentController.deleteParent.bind(parentController)
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
  parentController.getParentStudents.bind(parentController)
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
  parentController.getStudentAttendance.bind(parentController)
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
  parentController.getStudentGrades.bind(parentController)
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
  parentController.getStudentAssignments.bind(parentController)
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
  parentController.getStudentExams.bind(parentController)
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
  parentController.getStudentFees.bind(parentController)
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
  parentController.getStudentTimetable.bind(parentController)
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
  parentController.getStudentNotifications.bind(parentController)
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
  parentController.getStudentAcademicSummary.bind(parentController)
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
  parentController.getParentStats.bind(parentController)
);

export default router; 

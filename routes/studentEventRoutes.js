import express from 'express';
import StudentEventController from '../controllers/studentEventController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateSchoolAccess } from '../middleware/validation.js';

const router = express.Router();
const studentEventController = new StudentEventController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route GET /api/student-events/:studentId/timeline
 * @desc Get student timeline with detailed events
 * @access Private
 */
router.get('/:studentId/timeline', 
  validateSchoolAccess,
  studentEventController.getStudentTimeline.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/academic-events
 * @desc Get student academic events
 * @access Private
 */
router.get('/:studentId/academic-events',
  validateSchoolAccess,
  studentEventController.getStudentAcademicEvents.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/attendance-events
 * @desc Get student attendance events
 * @access Private
 */
router.get('/:studentId/attendance-events',
  validateSchoolAccess,
  studentEventController.getStudentAttendanceEvents.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/financial-events
 * @desc Get student financial events
 * @access Private
 */
router.get('/:studentId/financial-events',
  validateSchoolAccess,
  studentEventController.getStudentFinancialEvents.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/conversion-events
 * @desc Get student conversion events
 * @access Private
 */
router.get('/:studentId/conversion-events',
  validateSchoolAccess,
  studentEventController.getStudentConversionEvents.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/analytics
 * @desc Get student analytics
 * @access Private
 */
router.get('/:studentId/analytics',
  validateSchoolAccess,
  studentEventController.getStudentAnalytics.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/performance-summary
 * @desc Get student performance summary
 * @access Private
 */
router.get('/:studentId/performance-summary',
  validateSchoolAccess,
  studentEventController.getStudentPerformanceSummary.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/events
 * @desc Get student events with filtering
 * @access Private
 */
router.get('/:studentId/events',
  validateSchoolAccess,
  studentEventController.getStudentEvents.bind(studentEventController)
);

/**
 * @route POST /api/student-events/:studentId/exam-grade
 * @desc Create student exam grade event
 * @access Private
 */
router.post('/:studentId/exam-grade',
  validateSchoolAccess,
  studentEventController.createStudentExamGrade.bind(studentEventController)
);

/**
 * @route POST /api/student-events/:studentId/attendance
 * @desc Create student attendance event
 * @access Private
 */
router.post('/:studentId/attendance',
  validateSchoolAccess,
  studentEventController.createStudentAttendance.bind(studentEventController)
);

/**
 * @route POST /api/student-events/:studentId/class-change
 * @desc Create student class change event
 * @access Private
 */
router.post('/:studentId/class-change',
  validateSchoolAccess,
  studentEventController.createStudentClassChange.bind(studentEventController)
);

/**
 * @route POST /api/student-events/:studentId/performance-review
 * @desc Create student performance review event
 * @access Private
 */
router.post('/:studentId/performance-review',
  validateSchoolAccess,
  studentEventController.createStudentPerformanceReview.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/export
 * @desc Export student events
 * @access Private
 */
router.get('/:studentId/export',
  validateSchoolAccess,
  studentEventController.exportStudentEvents.bind(studentEventController)
);

/**
 * @route GET /api/student-events/:studentId/academic-performance-analytics
 * @desc Get student academic performance analytics
 * @access Private
 */
router.get('/:studentId/academic-performance-analytics',
  validateSchoolAccess,
  studentEventController.getStudentAcademicPerformanceAnalytics.bind(studentEventController)
);

export default router; 
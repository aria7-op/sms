import express from 'express';
import teacherClassSubjectController from '../controllers/teacherClassSubjectController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/teacher-class-subjects
 * @desc    Assign a teacher to teach a subject in a specific class
 * @access  Private (Authenticated users)
 * @body    { teacherId: number, classId: number, subjectId: number }
 */
router.post('/', teacherClassSubjectController.assignTeacher);

/**
 * @route   GET /api/teacher-class-subjects
 * @desc    Get all teacher-class-subject assignments for a school (with pagination and filtering)
 * @access  Private (Authenticated users)
 * @query   { teacherId?: number, classId?: number, subjectId?: number, isActive?: boolean, page?: number, limit?: number }
 */
router.get('/', teacherClassSubjectController.getAssignments);

/**
 * @route   GET /api/teacher-class-subjects/:id
 * @desc    Get assignment by ID
 * @access  Private (Authenticated users)
 * @params  { id: number }
 */
router.get('/:id', teacherClassSubjectController.getAssignmentById);

/**
 * @route   GET /api/teacher-class-subjects/teacher/:teacherId
 * @desc    Get assignments by teacher
 * @access  Private (Authenticated users)
 * @params  { teacherId: number }
 */
router.get('/teacher/:teacherId', teacherClassSubjectController.getAssignmentsByTeacher);

/**
 * @route   GET /api/teacher-class-subjects/class/:classId
 * @desc    Get assignments by class
 * @access  Private (Authenticated users)
 * @params  { classId: number }
 */
router.get('/class/:classId', teacherClassSubjectController.getAssignmentsByClass);

/**
 * @route   GET /api/teacher-class-subjects/subject/:subjectId
 * @desc    Get assignments by subject
 * @access  Private (Authenticated users)
 * @params  { subjectId: number }
 */
router.get('/subject/:subjectId', teacherClassSubjectController.getAssignmentsBySubject);

/**
 * @route   PATCH /api/teacher-class-subjects/:id/status
 * @desc    Update assignment status (active/inactive)
 * @access  Private (Authenticated users)
 * @params  { id: number }
 * @body    { isActive: boolean }
 */
router.patch('/:id/status', teacherClassSubjectController.updateAssignmentStatus);

/**
 * @route   DELETE /api/teacher-class-subjects/:id
 * @desc    Remove assignment (soft delete)
 * @access  Private (Authenticated users)
 * @params  { id: number }
 */
router.delete('/:id', teacherClassSubjectController.removeAssignment);

/**
 * @route   POST /api/teacher-class-subjects/bulk
 * @desc    Bulk assign teachers to classes and subjects
 * @access  Private (Authenticated users)
 * @body    { assignments: Array<{ teacherId: number, classId: number, subjectId: number }> }
 */
router.post('/bulk', teacherClassSubjectController.bulkAssign);

export default router; 
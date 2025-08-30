import express from 'express';
import { 
  getAllAttendances, 
  getAttendanceById, 
  createAttendance, 
  updateAttendance, 
  deleteAttendance,
  markInTime,
  markOutTime,
  bulkCreateAttendance,
  getClassAttendanceSummary,
  getAttendanceSummary,
  getAttendanceStats,
  getAttendanceAnalytics,
  getMonthlyAttendanceMatrix,
  exportAttendanceData,
  autoMarkAbsentStudents,
  markIncompleteAttendanceAsAbsent,
  getAttendanceTimeStatus
} from '../controllers/attendanceController.js';
import { authenticateToken, authorizePermissions, authorizeRolesOrPermissions } from '../middleware/auth.js';
// import { validateClassAccess } from '../middleware/validation.js';

const router = express.Router();

// PUBLIC ENDPOINTS - NO AUTHENTICATION REQUIRED
// These must come BEFORE the global authentication middleware

// Mark student in-time (arrival) - NO AUTHENTICATION REQUIRED
router.post('/mark-in-time', markInTime);

// Mark student out-time (departure) - NO AUTHENTICATION REQUIRED
router.post('/mark-out-time', markOutTime);

// Get attendance time status - NO AUTHENTICATION REQUIRED
router.get('/time-status', getAttendanceTimeStatus);

// Test endpoint to verify basic functionality - NO AUTHENTICATION REQUIRED
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Attendance routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Apply authentication to all OTHER routes
router.use(authenticateToken);

// Get all attendances with filtering and pagination
router.get('/', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read']), getAllAttendances);

// Get attendance summary and analytics
router.get('/summary', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read']), getAttendanceSummary);
router.get('/class-summary', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read']), getClassAttendanceSummary);
router.get('/stats', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read']), getAttendanceStats);
router.get('/analytics', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read']), getAttendanceAnalytics);
router.get('/monthly-matrix', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read']), getMonthlyAttendanceMatrix);

// Export attendance data
router.get('/export', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read']), exportAttendanceData);

// Automated attendance management
router.post('/auto-mark-absent', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:create', 'attendance:update']), autoMarkAbsentStudents);

// Mark incomplete attendance as absent (students without both inTime and outTime)
router.post('/mark-incomplete-absent', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:create', 'attendance:update']), markIncompleteAttendanceAsAbsent);

// Bulk create attendance records - MUST come before /:id routes
router.post('/bulk', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:create']), bulkCreateAttendance);

// Create new attendance record
router.post('/', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:create']), createAttendance);

// Get attendance by ID
router.get('/:id', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read']), getAttendanceById);

// Update attendance record
router.put('/:id', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:read', 'attendance:update']), updateAttendance);

// Delete attendance record (soft delete)
router.delete('/:id', authorizeRolesOrPermissions(['ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF'], ['attendance:delete']), deleteAttendance);

export default router; 

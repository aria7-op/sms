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
  exportAttendanceData
} from '../controllers/attendanceController.js';
import { authenticateToken, authorizePermissions } from '../middleware/auth.js';
// import { validateClassAccess } from '../middleware/validation.js';

const router = express.Router();

// PUBLIC ENDPOINTS - NO AUTHENTICATION REQUIRED
// These must come BEFORE the global authentication middleware

// Mark student in-time (arrival) - NO AUTHENTICATION REQUIRED
router.post('/mark-in-time', markInTime);

// Mark student out-time (departure) - NO AUTHENTICATION REQUIRED
router.post('/mark-out-time', markOutTime);

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
router.get('/', authorizePermissions(['attendance:read']), getAllAttendances);

// Get attendance summary and analytics
router.get('/summary', authorizePermissions(['attendance:read']), getAttendanceSummary);
router.get('/class-summary', authorizePermissions(['attendance:read']), getClassAttendanceSummary);
router.get('/stats', authorizePermissions(['attendance:read']), getAttendanceStats);
router.get('/analytics', authorizePermissions(['attendance:read']), getAttendanceAnalytics);
router.get('/monthly-matrix', authorizePermissions(['attendance:read']), getMonthlyAttendanceMatrix);

// Export attendance data
router.get('/export', authorizePermissions(['attendance:read']), exportAttendanceData);

// Bulk create attendance records - MUST come before /:id routes
router.post('/bulk', authorizePermissions(['attendance:create']), bulkCreateAttendance);

// Create new attendance record
router.post('/', authorizePermissions(['attendance:create']), createAttendance);

// Get attendance by ID
router.get('/:id', authorizePermissions(['attendance:read']), getAttendanceById);

// Update attendance record
router.put('/:id', authorizePermissions(['attendance:update']), updateAttendance);

// Delete attendance record (soft delete)
router.delete('/:id', authorizePermissions(['attendance:delete']), deleteAttendance);

export default router; 

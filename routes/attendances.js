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

// Apply authentication to all routes
router.use(authenticateToken);

// Get all attendances with filtering and pagination
router.get('/', authenticateToken, authorizePermissions(['attendance:read']), getAllAttendances);

// Test endpoint to verify basic functionality
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Attendance routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Get attendance summary and analytics
router.get('/summary', authenticateToken, authorizePermissions(['attendance:read']), getAttendanceSummary);
router.get('/class-summary', authenticateToken, authorizePermissions(['attendance:read']), getClassAttendanceSummary);
router.get('/stats', authenticateToken, authorizePermissions(['attendance:read']), getAttendanceStats);
router.get('/analytics', authenticateToken, authorizePermissions(['attendance:read']), getAttendanceAnalytics);
router.get('/monthly-matrix', authenticateToken, authorizePermissions(['attendance:read']), getMonthlyAttendanceMatrix);

// Export attendance data
router.get('/export', authenticateToken, authorizePermissions(['attendance:read']), exportAttendanceData);

// Mark student in-time (arrival) - MUST come before /:id routes
router.post('/mark-in-time', authenticateToken, authorizePermissions(['attendance:create']), markInTime);

// Mark student out-time (departure) - MUST come before /:id routes
router.post('/mark-out-time', authenticateToken, authorizePermissions(['attendance:update']), markOutTime);

// Bulk create attendance records - MUST come before /:id routes
router.post('/bulk', authenticateToken, authorizePermissions(['attendance:create']), bulkCreateAttendance);

// Create new attendance record
router.post('/', authenticateToken, authorizePermissions(['attendance:create']), createAttendance);

// Get attendance by ID
router.get('/:id', authenticateToken, authorizePermissions(['attendance:read']), getAttendanceById);

// Update attendance record
router.put('/:id', authenticateToken, authorizePermissions(['attendance:update']), updateAttendance);

// Delete attendance record (soft delete)
router.delete('/:id', authenticateToken, authorizePermissions(['attendance:delete']), deleteAttendance);

export default router; 

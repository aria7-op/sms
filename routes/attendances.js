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
// import { authenticateToken, authorizePermissions } from '../middleware/auth.js';
// import { validateClassAccess } from '../middleware/validation.js';

const router = express.Router();

// Apply authentication to all routes
// router.use(authenticateToken);

// Get all attendances with filtering and pagination
router.get('/', getAllAttendances);

// Test endpoint to verify basic functionality
router.get('/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Attendance routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Get attendance summary and analytics
router.get('/summary', getAttendanceSummary);
router.get('/class-summary', getClassAttendanceSummary);
router.get('/stats', getAttendanceStats);
router.get('/analytics', getAttendanceAnalytics);
router.get('/monthly-matrix', getMonthlyAttendanceMatrix);

// Export attendance data
router.get('/export', exportAttendanceData);

// Mark student in-time (arrival) - MUST come before /:id routes
router.post('/mark-in-time', markInTime);

// Mark student out-time (departure) - MUST come before /:id routes
router.post('/mark-out-time', markOutTime);

// Bulk create attendance records - MUST come before /:id routes
router.post('/bulk', bulkCreateAttendance);

// Create new attendance record
router.post('/', createAttendance);

// Get attendance by ID
router.get('/:id', getAttendanceById);

// Update attendance record
router.put('/:id', updateAttendance);

// Delete attendance record (soft delete)
router.delete('/:id', deleteAttendance);

export default router; 

import express from 'express';
import { 
  getAllAttendances, 
  getAttendanceById, 
  createAttendance, 
  updateAttendance, 
  deleteAttendance,
  markInTime,
  markOutTime,
  bulkCreateAttendance
} from '../controllers/attendanceController.js';
import { authenticateToken, authorizePermissions } from '../middleware/auth.js';
import { validateClassAccess } from '../middleware/validation.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get all attendances with filtering and pagination
router.get('/', authorizePermissions(['attendance:read']), getAllAttendances);

// Get attendance by ID
router.get('/:id', authorizePermissions(['attendance:read']), getAttendanceById);

// Create new attendance record
router.post('/', authorizePermissions(['attendance:create']), createAttendance);

// Update attendance record
router.put('/:id', authorizePermissions(['attendance:update']), updateAttendance);

// Mark student in-time (arrival)
router.post('/mark-in-time', authorizePermissions(['attendance:create']), markInTime);

// Mark student out-time (departure)
router.post('/mark-out-time', authorizePermissions(['attendance:update']), markOutTime);

// Bulk create attendance records
router.post('/bulk', authorizePermissions(['attendance:create']), bulkCreateAttendance);

// Delete attendance record (soft delete)
router.delete('/:id', authorizePermissions(['attendance:delete']), deleteAttendance);

export default router; 

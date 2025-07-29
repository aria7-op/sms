import express from 'express';
import { getAllAttendances, getAttendanceById, createAttendance, updateAttendance, deleteAttendance } from '../controllers/attendanceController.js';
const router = express.Router();

router.get('/', getAllAttendances);
router.get('/:id', getAttendanceById);
router.post('/', createAttendance);
router.put('/:id', updateAttendance);
router.delete('/:id', deleteAttendance);

export default router; 
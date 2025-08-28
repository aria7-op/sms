import express from 'express';
import { getAllPayrolls, getPayrollById, createPayroll, updatePayroll, deletePayroll } from '../controllers/payrollController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

router.get('/', getAllPayrolls);
router.get('/:id', getPayrollById);
router.post('/', authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN']), createPayroll);
router.put('/:id', authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'TEACHER','SUPER_ADMIN']), updatePayroll);
router.delete('/:id', authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'TEACHER','SUPER_ADMIN']), deletePayroll);

export default router; 

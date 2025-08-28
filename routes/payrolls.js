import express from 'express';
import { getAllPayrolls, getPayrollById, createPayroll, updatePayroll, deletePayroll } from '../controllers/payrollController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Debug middleware to see if it's being executed
router.use((req, res, next) => {
  console.log('🔍 Payroll router middleware executed for:', req.method, req.path);
  console.log('🔍 Headers:', req.headers);
  next();
});

// Test route to verify authentication
router.get('/test-auth', authenticateToken, (req, res) => {
  console.log('🔍 Test auth route - req.user:', req.user);
  res.json({ 
    success: true, 
    message: 'Authentication working',
    user: req.user ? {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      schoolId: req.user.schoolId
    } : 'NO USER'
  });
});

// Apply authentication to individual routes instead of router.use
router.get('/', authenticateToken, getAllPayrolls);
router.get('/:id', authenticateToken, getPayrollById);
router.post('/', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'TEACHER', 'SUPER_ADMIN']), createPayroll);
router.put('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'TEACHER','SUPER_ADMIN']), updatePayroll);
router.delete('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'TEACHER','SUPER_ADMIN']), deletePayroll);

export default router; 

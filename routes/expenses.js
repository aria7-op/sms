import express from 'express';
import { getAllExpenses, getExpenseById, createExpense, updateExpense, deleteExpense } from '../controllers/expenseController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
const router = express.Router();

// Apply authentication to individual routes instead of router.use()
router.get('/', authenticateToken, getAllExpenses);
router.get('/:id', authenticateToken, getExpenseById);
router.post('/', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), createExpense);
router.put('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), updateExpense);
router.delete('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), deleteExpense);

export default router; 

import express from 'express';
import { getAllIncomes, getIncomeById, createIncome, updateIncome, deleteIncome } from '../controllers/incomeController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, getAllIncomes);
router.get('/:id', authenticateToken, getIncomeById);
router.post('/', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), createIncome);
router.put('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), updateIncome);
router.delete('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), deleteIncome);

export default router; 
import express from 'express';
import { getAllPayrolls, getPayrollById, createPayroll, updatePayroll, deletePayroll } from '../controllers/payrollController.js';
const router = express.Router();

router.get('/', getAllPayrolls);
router.get('/:id', getPayrollById);
router.post('/', createPayroll);
router.put('/:id', updatePayroll);
router.delete('/:id', deletePayroll);

export default router; 
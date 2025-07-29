import express from 'express';
import { getAllMonthlyTests, getMonthlyTestById, createMonthlyTest, updateMonthlyTest, deleteMonthlyTest } from '../controllers/monthlyTestController.js';
const router = express.Router();

router.get('/', getAllMonthlyTests);
router.get('/:id', getMonthlyTestById);
router.post('/', createMonthlyTest);
router.put('/:id', updateMonthlyTest);
router.delete('/:id', deleteMonthlyTest);

export default router; 
import express from 'express';
import * as staffController from '../controllers/staffController.js';
import { authenticateToken } from '../middleware/auth.js';
const router = express.Router();

router.use(authenticateToken);

router.get('/', staffController.getAllStaffs);
router.get('/:id', staffController.getStaffById);
router.post('/', staffController.createStaff);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);

export default router; 
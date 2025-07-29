import express from 'express';
import { getAllPasswordResetTokens, getPasswordResetTokenById, createPasswordResetToken, updatePasswordResetToken, deletePasswordResetToken } from '../controllers/passwordResetTokenController.js';
const router = express.Router();

router.get('/', getAllPasswordResetTokens);
router.get('/:email/:token', getPasswordResetTokenById);
router.post('/', createPasswordResetToken);
router.put('/:email/:token', updatePasswordResetToken);
router.delete('/:email/:token', deletePasswordResetToken);

export default router; 
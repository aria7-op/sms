import express from 'express';
import * as authController from '../controllers/authController.js';
import { authorize } from '../middleware/auth.js';
const router = express.Router();

// Placeholder controllers
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/login-db', authController.loginDb); // New database-based login
router.get('/users', (req, res) => res.json({ message: 'Get users' }));

// ======================
// PASSWORD RESET ROUTES
// ======================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset (send reset email)
 * @access  Public
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @route   POST /api/auth/admin-reset-password
 * @desc    Admin reset any user's password
 * @access  Private (Admin only)
 */
router.post('/admin-reset-password', authorize(['SUPER_ADMIN', 'OWNER']), authController.adminResetPassword);

export default router; 

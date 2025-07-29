import express from 'express';
import googleDriveController from '../controllers/googleDriveController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ======================
// GOOGLE DRIVE ROUTES
// ======================

/**
 * @route   GET /api/google/auth-url
 * @desc    Get Google Drive authentication URL
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 */
router.get('/auth-url',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  googleDriveController.getAuthUrl
);

/**
 * @route   GET /api/google/callback
 * @desc    Handle Google OAuth callback
 * @access  Public (OAuth callback)
 */
router.get('/callback',
  googleDriveController.handleCallback
);

/**
 * @route   GET /api/google/files
 * @desc    List Excel files from Google Drive
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 */
router.get('/files',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  googleDriveController.listExcelFiles
);

/**
 * @route   POST /api/google/set-template
 * @desc    Set bill template from Google Drive
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 */
router.post('/set-template',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  googleDriveController.setBillTemplate
);

/**
 * @route   GET /api/google/template-status
 * @desc    Get current bill template status
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 */
router.get('/template-status',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  googleDriveController.getBillTemplateStatus
);

/**
 * @route   DELETE /api/google/disconnect
 * @desc    Disconnect Google Drive
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 */
router.delete('/disconnect',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  googleDriveController.disconnect
);

/**
 * @route   GET /api/google/status
 * @desc    Get Google Drive connection status
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 */
router.get('/status',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  googleDriveController.getConnectionStatus
);

/**
 * @route   GET /api/google/payment-setup
 * @desc    Get Google Drive setup status for payment creation
 * @access  Private (ACCOUNTANT, SCHOOL_ADMIN, SUPER_ADMIN)
 */
router.get('/payment-setup',
  authenticateToken,
  authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']),
  googleDriveController.getPaymentSetupStatus
);

export default router; 
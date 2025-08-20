import express from 'express';
const router = express.Router();
import paymentController from '../controllers/paymentController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { validatePaymentData, validateRefundData } from '../utils/paymentUtils.js';

// Analytics and reporting (MUST come before /:id routes to avoid conflicts)
router.get('/analytics/summary', authenticateToken, paymentController.getPaymentAnalytics);
router.get('/analytics', authenticateToken, paymentController.getPaymentAnalytics); // Add this for frontend compatibility
router.get('/report/generate', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.generatePaymentReport);

// Google Drive integration routes
router.get('/setup/google-drive', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.checkGoogleDriveSetup);

// Dashboard routes
router.get('/dashboard/summary', authenticateToken, paymentController.getDashboardSummary);
router.get('/dashboard/recent', authenticateToken, paymentController.getRecentPayments);
router.get('/dashboard/upcoming', authenticateToken, paymentController.getUpcomingPayments);

// Bulk operations
router.post('/bulk/create', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.createBulkPayments);
router.post('/bulk/update-status', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.bulkUpdateStatus);

// Student/Parent specific routes
router.get('/student/:studentId', authenticateToken, paymentController.getStudentPayments);
router.get('/parent/:parentId', authenticateToken, paymentController.getParentPayments);
router.get('/overdue/list', authenticateToken, paymentController.getOverduePayments);

// Payment gateway routes
router.post('/gateway/webhook/:gateway', paymentController.handleWebhook);
router.get('/gateway/status/:transactionId', authenticateToken, paymentController.getGatewayStatus);

// Payment CRUD routes (MUST come after specific routes to avoid conflicts)
router.post('/', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.createPayment);
router.get('/', authenticateToken, paymentController.getPayments);
router.put('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.updatePayment);
router.delete('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.deletePayment);

// Payment status management
router.patch('/:id/status', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.updatePaymentStatus);

// Refund routes
router.post('/:id/refunds', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.createRefund);
router.get('/:id/refunds', authenticateToken, paymentController.getPaymentRefunds);

// Installment routes
router.post('/:id/installments', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.createInstallment);
router.get('/:id/installments', authenticateToken, paymentController.getPaymentInstallments);
router.patch('/installments/:installmentId', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'TEACHER']), paymentController.updateInstallmentStatus);

// Generic ID route (MUST be last to avoid conflicts)
router.get('/:id', authenticateToken, paymentController.getPaymentById);

export default router; 

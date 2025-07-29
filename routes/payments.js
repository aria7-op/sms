import express from 'express';
const router = express.Router();
import paymentController from '../controllers/paymentController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { validatePaymentData, validateRefundData } from '../utils/paymentUtils.js';

// Payment CRUD routes
router.post('/', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.createPayment);
router.get('/', authenticateToken, paymentController.getPayments);
router.get('/:id', authenticateToken, paymentController.getPaymentById);
router.put('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.updatePayment);
router.delete('/:id', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.deletePayment);

// Google Drive integration routes
router.get('/setup/google-drive', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.checkGoogleDriveSetup);

// Payment status management
router.patch('/:id/status', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.updatePaymentStatus);

// Refund routes
router.post('/:id/refunds', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.createRefund);
router.get('/:id/refunds', authenticateToken, paymentController.getPaymentRefunds);

// Analytics and reporting
router.get('/analytics/summary', authenticateToken, paymentController.getPaymentAnalytics);
router.get('/report/generate', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.generatePaymentReport);

// Installment routes
router.post('/:id/installments', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.createInstallment);
router.get('/:id/installments', authenticateToken, paymentController.getPaymentInstallments);
router.patch('/installments/:installmentId', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.updateInstallmentStatus);

// Bulk operations
router.post('/bulk/create', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.createBulkPayments);
router.post('/bulk/update-status', authenticateToken, authorizeRoles(['ACCOUNTANT', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), paymentController.bulkUpdateStatus);

// Payment gateway routes
router.post('/gateway/webhook/:gateway', paymentController.handleWebhook);
router.get('/gateway/status/:transactionId', authenticateToken, paymentController.getGatewayStatus);

// Student/Parent specific routes
router.get('/student/:studentId', authenticateToken, paymentController.getStudentPayments);
router.get('/parent/:parentId', authenticateToken, paymentController.getParentPayments);
router.get('/overdue/list', authenticateToken, paymentController.getOverduePayments);

// Dashboard routes
router.get('/dashboard/summary', authenticateToken, paymentController.getDashboardSummary);
router.get('/dashboard/recent', authenticateToken, paymentController.getRecentPayments);
router.get('/dashboard/upcoming', authenticateToken, paymentController.getUpcomingPayments);

export default router; 
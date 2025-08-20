import express from 'express';
import IntegratedPaymentController from '../controllers/integratedPaymentController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { generalLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
const integratedPaymentController = new IntegratedPaymentController();

// Apply rate limiting to all routes
router.use(generalLimiter);

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   POST /api/integrated-payments/create-with-installments
 * @desc    Create payment with installments
 * @access  Private (Admin, Owner, Teacher)
 */
router.post('/create-with-installments', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
    integratedPaymentController.createPaymentWithInstallments.bind(integratedPaymentController)
);

/**
 * @route   GET /api/integrated-payments/:paymentId/complete-details
 * @desc    Get complete payment details with refunds and installments
 * @access  Private (Admin, Owner, Teacher, Student, Parent)
 */
router.get('/:paymentId/complete-details', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER', 'STUDENT', 'PARENT']),
    integratedPaymentController.getCompletePaymentDetails.bind(integratedPaymentController)
);

/**
 * @route   POST /api/integrated-payments/:paymentId/refund
 * @desc    Process refund for payment
 * @access  Private (Admin, Owner, Teacher)
 */
router.post('/:paymentId/refund', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
    integratedPaymentController.processRefund.bind(integratedPaymentController)
);

/**
 * @route   PATCH /api/integrated-payments/installments/:installmentId/pay
 * @desc    Mark installment as paid and update payment status
 * @access  Private (Admin, Owner, Teacher)
 */
router.patch('/installments/:installmentId/pay', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
    integratedPaymentController.payInstallment.bind(integratedPaymentController)
);

/**
 * @route   GET /api/integrated-payments/analytics
 * @access  Private (Admin, Owner, Teacher)
 */
router.get('/analytics', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
    integratedPaymentController.getPaymentAnalytics.bind(integratedPaymentController)
);

/**
 * @route   GET /api/integrated-payments/dashboard
 * @desc    Get payment dashboard with all related data
 * @access  Private (Admin, Owner, Teacher)
 */
router.get('/dashboard', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
    integratedPaymentController.getPaymentDashboard.bind(integratedPaymentController)
);

/**
 * @route   GET /api/integrated-payments/report/generate
 * @desc    Generate comprehensive payment report
 * @access  Private (Admin, Owner, Teacher)
 */
router.get('/report/generate', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
    integratedPaymentController.generatePaymentReport.bind(integratedPaymentController)
);

/**
 * @route   POST /api/integrated-payments/bulk-operations
 * @desc    Bulk operations for payments
 * @access  Private (Admin, Owner, Teacher)
 */
router.post('/bulk-operations', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
    integratedPaymentController.bulkPaymentOperations.bind(integratedPaymentController)
);

export { router as integratedPaymentRouter };
export default router;

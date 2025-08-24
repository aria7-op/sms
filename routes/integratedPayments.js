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
 * @route   POST /api/integrated-payments/create
 * @desc    Create payment
 * @access  Private (Admin, Owner, Teacher)
 */
router.post('/create', 
    authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
    integratedPaymentController.createPayment.bind(integratedPaymentController)
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


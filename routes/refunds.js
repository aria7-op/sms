import express from 'express';
import RefundController from '../controllers/refundController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Initialize controller
const refundController = new RefundController();

// Apply rate limiting to all routes
router.use(rateLimiter);

// Apply authentication to all routes
router.use(authenticateToken);

// ========================================
// CRUD Operations
// ========================================

/**
 * @route   POST /api/refunds
 * @desc    Create new refund
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.post('/',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.createRefund(req, res);
    }
);

/**
 * @route   GET /api/refunds
 * @desc    Get all refunds with filtering
 * @access  Private (ADMIN, ACCOUNTANT, PARENT, STUDENT)
 */
router.get('/',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT', 'STUDENT']),
    async (req, res) => {
        await refundController.getAllRefunds(req, res);
    }
);

/**
 * @route   GET /api/refunds/:id
 * @desc    Get refund by ID
 * @access  Private (ADMIN, ACCOUNTANT, PARENT, STUDENT)
 */
router.get('/:id',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT', 'STUDENT']),
    async (req, res) => {
        await refundController.getRefundById(req, res);
    }
);

/**
 * @route   PUT /api/refunds/:id
 * @desc    Update refund
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.put('/:id',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.updateRefund(req, res);
    }
);

/**
 * @route   DELETE /api/refunds/:id
 * @desc    Delete refund
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.delete('/:id',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.deleteRefund(req, res);
    }
);

// ========================================
// Payment-specific Operations
// ========================================

/**
 * @route   GET /api/refunds/payment/:paymentId
 * @desc    Get all refunds for a specific payment
 * @access  Private (ADMIN, ACCOUNTANT, PARENT, STUDENT)
 */
router.get('/payment/:paymentId',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT', 'STUDENT']),
    async (req, res) => {
        await refundController.getRefundsByPayment(req, res);
    }
);

// ========================================
// Refund Processing
// ========================================

/**
 * @route   POST /api/refunds/:id/process
 * @desc    Process refund
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.post('/:id/process',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.processRefund(req, res);
    }
);

/**
 * @route   POST /api/refunds/:id/cancel
 * @desc    Cancel refund
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.post('/:id/cancel',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.cancelRefund(req, res);
    }
);

// ========================================
// Bulk Operations
// ========================================

/**
 * @route   POST /api/refunds/bulk/update
 * @desc    Bulk update refunds
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.post('/bulk/update',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.bulkUpdateRefunds(req, res);
    }
);

// ========================================
// Analytics and Reporting
// ========================================

/**
 * @route   GET /api/refunds/statistics
 * @desc    Get refund statistics
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/statistics',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.getRefundStatistics(req, res);
    }
);

/**
 * @route   GET /api/refunds/analytics
 * @desc    Get refund analytics
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/analytics',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.getRefundAnalytics(req, res);
    }
);

// ========================================
// Search and Filtering
// ========================================

/**
 * @route   GET /api/refunds/search
 * @desc    Search refunds
 * @access  Private (ADMIN, ACCOUNTANT, PARENT, STUDENT)
 */
router.get('/search',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT', 'STUDENT']),
    async (req, res) => {
        await refundController.searchRefunds(req, res);
    }
);

// ========================================
// Dashboard
// ========================================

/**
 * @route   GET /api/refunds/dashboard
 * @desc    Get refund dashboard
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/dashboard',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.getRefundDashboard(req, res);
    }
);

// ========================================
// Role-specific Operations
// ========================================

/**
 * @route   GET /api/refunds/my-refunds
 * @desc    Get current user's refunds (for students/parents)
 * @access  Private (STUDENT, PARENT)
 */
router.get('/my-refunds',
    authorizeRoles(['STUDENT', 'PARENT']),
    async (req, res) => {
        // This would filter refunds based on the user's payments
        await refundController.getAllRefunds(req, res);
    }
);

/**
 * @route   GET /api/refunds/pending
 * @desc    Get pending refunds (for accountants)
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/pending',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        req.query.status = 'PENDING';
        await refundController.getAllRefunds(req, res);
    }
);

/**
 * @route   GET /api/refunds/processing
 * @desc    Get processing refunds (for accountants)
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/processing',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        req.query.status = 'PROCESSING';
        await refundController.getAllRefunds(req, res);
    }
);

/**
 * @route   GET /api/refunds/completed
 * @desc    Get completed refunds
 * @access  Private (ADMIN, ACCOUNTANT, PARENT, STUDENT)
 */
router.get('/completed',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT', 'STUDENT']),
    async (req, res) => {
        req.query.status = 'COMPLETED';
        await refundController.getAllRefunds(req, res);
    }
);

/**
 * @route   GET /api/refunds/failed
 * @desc    Get failed refunds (for accountants)
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/failed',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        req.query.status = 'FAILED';
        await refundController.getAllRefunds(req, res);
    }
);

/**
 * @route   GET /api/refunds/cancelled
 * @desc    Get cancelled refunds
 * @access  Private (ADMIN, ACCOUNTANT, PARENT, STUDENT)
 */
router.get('/cancelled',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT', 'STUDENT']),
    async (req, res) => {
        req.query.status = 'CANCELLED';
        await refundController.getAllRefunds(req, res);
    }
);

// ========================================
// Advanced Filtering
// ========================================

/**
 * @route   GET /api/refunds/by-date-range
 * @desc    Get refunds by date range
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/by-date-range',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.getAllRefunds(req, res);
    }
);

/**
 * @route   GET /api/refunds/by-amount-range
 * @desc    Get refunds by amount range
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/by-amount-range',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.getAllRefunds(req, res);
    }
);

/**
 * @route   GET /api/refunds/by-reason
 * @desc    Get refunds by reason
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/by-reason',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        await refundController.getAllRefunds(req, res);
    }
);

// ========================================
// Export Operations
// ========================================

/**
 * @route   GET /api/refunds/export/csv
 * @desc    Export refunds to CSV
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/export/csv',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        // This would generate and return a CSV file
        res.status(501).json({
            success: false,
            message: 'CSV export not implemented yet'
        });
    }
);

/**
 * @route   GET /api/refunds/export/pdf
 * @desc    Export refunds to PDF
 * @access  Private (ADMIN, ACCOUNTANT)
 */
router.get('/export/pdf',
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']),
    async (req, res) => {
        // This would generate and return a PDF file
        res.status(501).json({
            success: false,
            message: 'PDF export not implemented yet'
        });
    }
);

// ========================================
// Error Handling Middleware
// ========================================

// Handle validation errors
router.use((error, req, res, next) => {
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            errors: error.details
        });
    }

    next(error);
});

export default router;
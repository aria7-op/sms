import express from 'express';
const router = express.Router();
import NoticeController from '../controllers/noticeController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';

const noticeController = new NoticeController();



// Apply rate limiting to all notice routes
router.use(rateLimiter);

// Apply authentication to all routes
router.use(authenticateToken);

// ======================
// NOTICE CRUD OPERATIONS
// ======================

/**
 * @route   POST /api/notices
 * @desc    Create a new notice
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    noticeController.createNotice.bind(noticeController)
);

/**
 * @route   GET /api/notices
 * @desc    Get all notices with filtering and pagination
 * @access  Private (All authenticated users)
 */
router.get('/', 
    noticeController.getAllNotices.bind(noticeController)
);

/**
 * @route   GET /api/notices/published
 * @desc    Get published notices for current user
 * @access  Private (All authenticated users)
 */
router.get('/published', 
    noticeController.getPublishedNotices.bind(noticeController)
);

/**
 * @route   GET /api/notices/:id
 * @desc    Get notice by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', 
    noticeController.getNoticeById.bind(noticeController)
);

/**
 * @route   PUT /api/notices/:id
 * @desc    Update notice
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.put('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    noticeController.updateNotice.bind(noticeController)
);

/**
 * @route   PATCH /api/notices/:id/status
 * @desc    Update notice publication status
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.patch('/:id/status', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    noticeController.updateNoticePublicationStatus.bind(noticeController)
);

/**
 * @route   DELETE /api/notices/:id
 * @desc    Delete notice
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.delete('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    noticeController.deleteNotice.bind(noticeController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/notices/bulk/status
 * @desc    Bulk update notice publication status
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/bulk/status', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    noticeController.bulkUpdatePublicationStatus.bind(noticeController)
);

// ======================
// ANALYTICS & STATISTICS
// ======================

/**
 * @route   GET /api/notices/statistics
 * @desc    Get notice statistics
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/statistics', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    noticeController.getNoticeStatistics.bind(noticeController)
);

/**
 * @route   GET /api/notices/analytics
 * @desc    Get notice analytics
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/analytics', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    noticeController.getNoticeAnalytics.bind(noticeController)
);

// ======================
// SEARCH & FILTERING
// ======================

/**
 * @route   GET /api/notices/search
 * @desc    Search notices
 * @access  Private (All authenticated users)
 */
router.get('/search', 
    noticeController.searchNotices.bind(noticeController)
);

/**
 * @route   GET /api/notices/upcoming
 * @desc    Get upcoming notices
 * @access  Private (All authenticated users)
 */
router.get('/upcoming', 
    noticeController.getUpcomingNotices.bind(noticeController)
);

/**
 * @route   GET /api/notices/expired
 * @desc    Get expired notices
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/expired', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    noticeController.getExpiredNotices.bind(noticeController)
);

// ======================
// FILTERED VIEWS
// ======================

/**
 * @route   GET /api/notices/priority/:priority
 * @desc    Get notices by priority
 * @access  Private (All authenticated users)
 */
router.get('/priority/:priority', 
    noticeController.getNoticesByPriority.bind(noticeController)
);

/**
 * @route   GET /api/notices/role/:role
 * @desc    Get notices by target role
 * @access  Private (All authenticated users)
 */
router.get('/role/:role', 
    noticeController.getNoticesByTargetRole.bind(noticeController)
);

/**
 * @route   GET /api/notices/class/:classId
 * @desc    Get notices by class
 * @access  Private (All authenticated users)
 */
router.get('/class/:classId', 
    noticeController.getNoticesByClass.bind(noticeController)
);

// ======================
// DASHBOARD ENDPOINTS
// ======================

/**
 * @route   GET /api/notices/dashboard/recent
 * @desc    Get recent notices for dashboard
 * @access  Private (All authenticated users)
 */
router.get('/dashboard/recent', 
    (req, res) => {
        // Add limit for dashboard
        req.query.limit = req.query.limit || '5';
        noticeController.getAllNotices(req, res);
    }
);

/**
 * @route   GET /api/notices/dashboard/active
 * @desc    Get active notices for dashboard
 * @access  Private (All authenticated users)
 */
router.get('/dashboard/active', 
    (req, res) => {
        // Filter for active notices
        req.query.isPublished = 'true';
        req.query.limit = req.query.limit || '10';
        noticeController.getAllNotices(req, res);
    }
);

/**
 * @route   GET /api/notices/dashboard/urgent
 * @desc    Get urgent notices for dashboard
 * @access  Private (All authenticated users)
 */
router.get('/dashboard/urgent', 
    (req, res) => {
        // Filter for high priority notices
        req.query.priority = 'high';
        req.query.isPublished = 'true';
        req.query.limit = req.query.limit || '5';
        noticeController.getAllNotices(req, res);
    }
);

// ======================
// EXPORT ENDPOINTS
// ======================

/**
 * @route   GET /api/notices/export/csv
 * @desc    Export notices to CSV
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/export/csv', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement CSV export functionality
        res.status(501).json({
            success: false,
            message: 'CSV export not implemented yet'
        });
    }
);

/**
 * @route   GET /api/notices/export/pdf
 * @desc    Export notices to PDF
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/export/pdf', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement PDF export functionality
        res.status(501).json({
            success: false,
            message: 'PDF export not implemented yet'
        });
    }
);

// ======================
// NOTIFICATION ENDPOINTS
// ======================

/**
 * @route   POST /api/notices/:id/notify
 * @desc    Send notification for a notice
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/:id/notify', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement notification sending functionality
        res.status(501).json({
            success: false,
            message: 'Notification sending not implemented yet'
        });
    }
);

/**
 * @route   POST /api/notices/bulk/notify
 * @desc    Send notifications for multiple notices
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/bulk/notify', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement bulk notification sending functionality
        res.status(501).json({
            success: false,
            message: 'Bulk notification sending not implemented yet'
        });
    }
);

// ======================
// TEMPLATE ENDPOINTS
// ======================

/**
 * @route   GET /api/notices/templates
 * @desc    Get notice templates
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/templates', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement notice templates functionality
        res.status(501).json({
            success: false,
            message: 'Notice templates not implemented yet'
        });
    }
);

/**
 * @route   POST /api/notices/templates
 * @desc    Create notice template
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/templates', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement notice template creation functionality
        res.status(501).json({
            success: false,
            message: 'Notice template creation not implemented yet'
        });
    }
);

// Export the router
export default router;
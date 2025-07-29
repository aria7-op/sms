import express from 'express';
const router = express.Router();
import EventController from '../controllers/eventController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
const eventController = new EventController();

// Apply rate limiting to all event routes
router.use(rateLimiter);

// Apply authentication to all routes
router.use(authenticateToken);

// ======================
// EVENT CRUD OPERATIONS
// ======================

/**
 * @route   POST /api/events
 * @desc    Create a new event
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    eventController.createEvent.bind(eventController)
);

/**
 * @route   GET /api/events
 * @desc    Get all events with filtering and pagination
 * @access  Private (All authenticated users)
 */
router.get('/', 
    eventController.getAllEvents.bind(eventController)
);

/**
 * @route   GET /api/events/published
 * @desc    Get published events for current user
 * @access  Private (All authenticated users)
 */
router.get('/published', 
    eventController.getPublishedEvents.bind(eventController)
);

/**
 * @route   GET /api/events/:id
 * @desc    Get event by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id', 
    eventController.getEventById.bind(eventController)
);

/**
 * @route   PUT /api/events/:id
 * @desc    Update event
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.put('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    eventController.updateEvent.bind(eventController)
);

/**
 * @route   PATCH /api/events/:id/status
 * @desc    Update event publication status
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.patch('/:id/status', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    eventController.updateEventPublicationStatus.bind(eventController)
);

/**
 * @route   DELETE /api/events/:id
 * @desc    Delete event
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.delete('/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    eventController.deleteEvent.bind(eventController)
);

// ======================
// BULK OPERATIONS
// ======================

/**
 * @route   POST /api/events/bulk/status
 * @desc    Bulk update event publication status
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/bulk/status', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    eventController.bulkUpdatePublicationStatus.bind(eventController)
);

// ======================
// ANALYTICS & STATISTICS
// ======================

/**
 * @route   GET /api/events/statistics
 * @desc    Get event statistics
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/statistics', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    eventController.getEventStatistics.bind(eventController)
);

/**
 * @route   GET /api/events/analytics
 * @desc    Get event analytics
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/analytics', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    eventController.getEventAnalytics.bind(eventController)
);

// ======================
// SEARCH & FILTERING
// ======================

/**
 * @route   GET /api/events/search
 * @desc    Search events
 * @access  Private (All authenticated users)
 */
router.get('/search', 
    eventController.searchEvents.bind(eventController)
);

/**
 * @route   GET /api/events/upcoming
 * @desc    Get upcoming events
 * @access  Private (All authenticated users)
 */
router.get('/upcoming', 
    eventController.getUpcomingEvents.bind(eventController)
);

/**
 * @route   GET /api/events/ongoing
 * @desc    Get ongoing events
 * @access  Private (All authenticated users)
 */
router.get('/ongoing', 
    eventController.getOngoingEvents.bind(eventController)
);

/**
 * @route   GET /api/events/past
 * @desc    Get past events
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/past', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    eventController.getPastEvents.bind(eventController)
);

/**
 * @route   GET /api/events/date-range
 * @desc    Get events by date range
 * @access  Private (All authenticated users)
 */
router.get('/date-range', 
    eventController.getEventsByDateRange.bind(eventController)
);

// ======================
// FILTERED VIEWS
// ======================

/**
 * @route   GET /api/events/role/:role
 * @desc    Get events by target role
 * @access  Private (All authenticated users)
 */
router.get('/role/:role', 
    eventController.getEventsByTargetRole.bind(eventController)
);

/**
 * @route   GET /api/events/class/:classId
 * @desc    Get events by class
 * @access  Private (All authenticated users)
 */
router.get('/class/:classId', 
    eventController.getEventsByClass.bind(eventController)
);

/**
 * @route   GET /api/events/location/:location
 * @desc    Get events by location
 * @access  Private (All authenticated users)
 */
router.get('/location/:location', 
    eventController.getEventsByLocation.bind(eventController)
);

// ======================
// DASHBOARD ENDPOINTS
// ======================

/**
 * @route   GET /api/events/dashboard/recent
 * @desc    Get recent events for dashboard
 * @access  Private (All authenticated users)
 */
router.get('/dashboard/recent', 
    (req, res) => {
        // Add limit for dashboard
        req.query.limit = req.query.limit || '5';
        eventController.getAllEvents(req, res);
    }
);

/**
 * @route   GET /api/events/dashboard/upcoming
 * @desc    Get upcoming events for dashboard
 * @access  Private (All authenticated users)
 */
router.get('/dashboard/upcoming', 
    (req, res) => {
        // Filter for upcoming events
        req.query.limit = req.query.limit || '10';
        eventController.getUpcomingEvents(req, res);
    }
);

/**
 * @route   GET /api/events/dashboard/ongoing
 * @desc    Get ongoing events for dashboard
 * @access  Private (All authenticated users)
 */
router.get('/dashboard/ongoing', 
    (req, res) => {
        // Filter for ongoing events
        req.query.limit = req.query.limit || '5';
        eventController.getOngoingEvents(req, res);
    }
);

/**
 * @route   GET /api/events/dashboard/calendar
 * @desc    Get events for calendar view
 * @access  Private (All authenticated users)
 */
router.get('/dashboard/calendar', 
    (req, res) => {
        // Get events for calendar view (current month)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        req.query.startDate = startOfMonth.toISOString();
        req.query.endDate = endOfMonth.toISOString();
        req.query.limit = '50';
        
        eventController.getEventsByDateRange(req, res);
    }
);

// ======================
// EXPORT ENDPOINTS
// ======================

/**
 * @route   GET /api/events/export/csv
 * @desc    Export events to CSV
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
 * @route   GET /api/events/export/pdf
 * @desc    Export events to PDF
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

/**
 * @route   GET /api/events/export/calendar
 * @desc    Export events to calendar format (ICS)
 * @access  Private (All authenticated users)
 */
router.get('/export/calendar', 
    (req, res) => {
        // TODO: Implement calendar export functionality
        res.status(501).json({
            success: false,
            message: 'Calendar export not implemented yet'
        });
    }
);

// ======================
// NOTIFICATION ENDPOINTS
// ======================

/**
 * @route   POST /api/events/:id/notify
 * @desc    Send notification for an event
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
 * @route   POST /api/events/bulk/notify
 * @desc    Send notifications for multiple events
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
 * @route   GET /api/events/templates
 * @desc    Get event templates
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.get('/templates', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement event templates functionality
        res.status(501).json({
            success: false,
            message: 'Event templates not implemented yet'
        });
    }
);

/**
 * @route   POST /api/events/templates
 * @desc    Create event template
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/templates', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement event template creation functionality
        res.status(501).json({
            success: false,
            message: 'Event template creation not implemented yet'
        });
    }
);

// ======================
// RECURRING EVENTS
// ======================

/**
 * @route   POST /api/events/recurring
 * @desc    Create recurring event
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.post('/recurring', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement recurring event creation functionality
        res.status(501).json({
            success: false,
            message: 'Recurring event creation not implemented yet'
        });
    }
);

/**
 * @route   PUT /api/events/recurring/:id
 * @desc    Update recurring event
 * @access  Private (ADMIN, TEACHER, STAFF)
 */
router.put('/recurring/:id', 
    authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF']),
    (req, res) => {
        // TODO: Implement recurring event update functionality
        res.status(501).json({
            success: false,
            message: 'Recurring event update not implemented yet'
        });
    }
);

export default router;
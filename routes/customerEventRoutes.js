import express from 'express';
import CustomerEventController from '../controllers/customerEventController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateSchoolAccess } from '../middleware/validation.js';

const router = express.Router();
const customerEventController = new CustomerEventController();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * @route GET /api/customer-events/:customerId/timeline
 * @desc Get customer timeline with detailed events
 * @access Private
 */
router.get('/:customerId/timeline', 
  validateSchoolAccess,
  customerEventController.getCustomerTimeline.bind(customerEventController)
);

/**
 * @route GET /api/customer-events/:customerId/conversion-history
 * @desc Get customer conversion history
 * @access Private
 */
router.get('/:customerId/conversion-history',
  validateSchoolAccess,
  customerEventController.getCustomerConversionHistory.bind(customerEventController)
);

/**
 * @route GET /api/customer-events/:customerId/analytics
 * @desc Get customer analytics
 * @access Private
 */
router.get('/:customerId/analytics',
  validateSchoolAccess,
  customerEventController.getCustomerAnalytics.bind(customerEventController)
);

/**
 * @route GET /api/customer-events/:customerId/events
 * @desc Get customer events with filtering
 * @access Private
 */
router.get('/:customerId/events',
  validateSchoolAccess,
  customerEventController.getCustomerEvents.bind(customerEventController)
);

/**
 * @route POST /api/customer-events/:customerId/interaction
 * @desc Create customer interaction event
 * @access Private
 */
router.post('/:customerId/interaction',
  validateSchoolAccess,
  customerEventController.createCustomerInteraction.bind(customerEventController)
);

/**
 * @route POST /api/customer-events/:customerId/status-change
 * @desc Create customer status change event
 * @access Private
 */
router.post('/:customerId/status-change',
  validateSchoolAccess,
  customerEventController.createCustomerStatusChange.bind(customerEventController)
);

/**
 * @route POST /api/customer-events/:customerId/pipeline-stage-change
 * @desc Create customer pipeline stage change event
 * @access Private
 */
router.post('/:customerId/pipeline-stage-change',
  validateSchoolAccess,
  customerEventController.createCustomerPipelineStageChange.bind(customerEventController)
);

/**
 * @route GET /api/customer-events/:customerId/export
 * @desc Export customer events
 * @access Private
 */
router.get('/:customerId/export',
  validateSchoolAccess,
  customerEventController.exportCustomerEvents.bind(customerEventController)
);

/**
 * @route GET /api/customer-events/:customerId/conversion-analytics
 * @desc Get customer conversion analytics
 * @access Private
 */
router.get('/:customerId/conversion-analytics',
  validateSchoolAccess,
  customerEventController.getCustomerConversionAnalytics.bind(customerEventController)
);

/**
 * @route GET /api/customer-events/:customerId/interaction-summary
 * @desc Get customer interaction summary
 * @access Private
 */
router.get('/:customerId/interaction-summary',
  validateSchoolAccess,
  customerEventController.getCustomerInteractionSummary.bind(customerEventController)
);

export default router; 
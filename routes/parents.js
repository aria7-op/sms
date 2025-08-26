import express from 'express';
import parentController from '../controllers/parentController.js';
import { authenticateToken, authorizePermissions } from '../middleware/auth.js';
import { validateParams, idSchema } from '../middleware/validation.js';

const router = express.Router();

// ============================================================================
// Essential CRUD Operations
// ============================================================================

/**
 * @route   GET /api/parents
 * @desc    Get all parents with filtering and pagination
 * @access  Private (Admin, Staff, Teacher)
 * @permissions parent:read
 */
router.get('/',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParents.bind(parentController)
);

/**
 * @route   GET /api/parents/:id
 * @desc    Get parent by ID
 * @access  Private (Admin, Staff, Teacher, Parent)
 * @permissions parent:read
 */
router.get('/:id',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentById.bind(parentController)
);

/**
 * @route   POST /api/parents
 * @desc    Create a new parent
 * @access  Private (Admin, Staff)
 * @permissions parent:create
 */
router.post('/',
  authenticateToken,
  authorizePermissions(['parent:create']),
  parentController.createParent.bind(parentController)
);

/**
 * @route   PUT /api/parents/:id
 * @desc    Update parent
 * @access  Private (Admin, Staff)
 * @permissions parent:update
 */
router.put('/:id',
  authenticateToken,
  authorizePermissions(['parent:update']),
  validateParams(idSchema),
  parentController.updateParent.bind(parentController)
);

/**
 * @route   DELETE /api/parents/:id
 * @desc    Soft delete parent
 * @access  Private (Admin, Staff)
 * @permissions parent:delete
 */
router.delete('/:id',
  authenticateToken,
  authorizePermissions(['parent:delete']),
  validateParams(idSchema),
  parentController.deleteParent.bind(parentController)
);

// ============================================================================
// Parent Students (Core Functionality)
// ============================================================================

/**
 * @route   GET /api/parents/:id/students
 * @desc    Get parent's students
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, student:read_children
 */
router.get('/:id/students',
  authenticateToken,
  authorizePermissions(['parent:read', 'student:read_children']),
  validateParams(idSchema),
  parentController.getParentStudents.bind(parentController)
);

// ============================================================================
// Analytics & Statistics
// ============================================================================

/**
 * @route   GET /api/parents/:id/stats
 * @desc    Get parent statistics
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/stats',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentStats.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/analytics
 * @desc    Get parent analytics
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/analytics',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentAnalytics.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/performance
 * @desc    Get parent performance metrics
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
router.get('/:id/performance',
  authenticateToken,
  authorizePermissions(['parent:read']),
  validateParams(idSchema),
  parentController.getParentPerformance.bind(parentController)
);

/**
 * @route   GET /api/parents/:id/dashboard
 * @desc    Get parent dashboard data
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read
 */
if (typeof parentController.getParentDashboard === 'function') {
  router.get('/:id/dashboard',
    authenticateToken,
    authorizePermissions(['parent:read']),
    validateParams(idSchema),
    parentController.getParentDashboard.bind(parentController)
  );
}

// ============================================================================
// Notifications
// ============================================================================

/**
 * @route   GET /api/parents/:id/notifications
 * @desc    Get parent notifications
 * @access  Private (Admin, Staff, Parent)
 * @permissions parent:read, notification:read
 */
router.get('/:id/notifications',
  authenticateToken,
  authorizePermissions(['parent:read', 'notification:read']),
  validateParams(idSchema),
  parentController.getParentNotifications.bind(parentController)
);

export default router; 

import express from 'express';
import parentController from '../controllers/parentController.js';
import { authenticateToken, authorizePermissions } from '../middleware/auth.js';

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
  parentController.getParentStudents.bind(parentController)
);

// ============================================================================
// Basic Statistics
// ============================================================================

/**
 * @route   GET /api/parents/stats
 * @desc    Get parent statistics
 * @access  Private (Admin, Staff)
 * @permissions parent:read
 */
router.get('/stats',
  authenticateToken,
  authorizePermissions(['parent:read']),
  parentController.getParentStats.bind(parentController)
);

export default router; 

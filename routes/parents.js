import express from 'express';
import { authenticateToken, authorizePermissions } from '../middleware/auth.js';
import { PrismaClient } from '../generated/prisma/index.js';

const router = express.Router();
const prisma = new PrismaClient();

// BigInt conversion utility
function convertBigInts(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  }
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = convertBigInts(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// ============================================================================
// Essential CRUD Operations
// ============================================================================

/**
 * @route   GET /api/parents
 * @desc    Get all parents with filtering and pagination
 * @access  Private (Admin, Staff, Teacher)
 * @permissions parent:read
 */
router.get('/', authenticateToken, authorizePermissions(['parent:read']), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { page = 1, limit = 10, search, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      schoolId: BigInt(schoolId),
      deletedAt: null
    };

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (status) {
      where.user = { ...where.user, status: status };
    }

    const parents = await prisma.parent.findMany({
      where,
      skip,
      take,
      include: {
        user: {
          select: {
            id: true, uuid: true, username: true, phone: true,
            firstName: true, lastName: true, status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const total = await prisma.parent.count({ where });

    res.json({
      success: true,
      data: convertBigInts(parents),
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    console.error('Get parents error:', error);
    res.status(500).json({ success: false, message: 'Failed to get parents' });
  }
});

/**
 * @route   GET /api/parents/:id
 * @desc    Get parent by user ID
 * @access  Private (Admin, Staff, Teacher, Parent)
 * @permissions parent:read
 */
router.get('/:id', authenticateToken, authorizePermissions(['parent:read']), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const parent = await prisma.parent.findFirst({
      where: {
        userId: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        user: {
          select: {
            id: true, uuid: true, username: true, phone: true,
            firstName: true, lastName: true, status: true
          }
        },
        students: {
          where: { deletedAt: null },
          include: {
            user: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      }
    });

    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    res.json({ success: true, data: convertBigInts(parent) });
  } catch (error) {
    console.error('Get parent error:', error);
    res.status(500).json({ success: false, message: 'Failed to get parent' });
  }
});

/**
 * @route   POST /api/parents
 * @desc    Create a new parent
 * @access  Private (Admin, Staff)
 * @permissions parent:create
 */
router.post('/', authenticateToken, authorizePermissions(['parent:create']), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const userId = req.user.id;
    const parentData = req.body;

    if (!parentData.userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const existingParent = await prisma.parent.findUnique({
      where: { userId: BigInt(parentData.userId) }
    });

    if (existingParent) {
      return res.status(400).json({ success: false, message: 'User is already a parent' });
    }

    const parent = await prisma.parent.create({
      data: {
        userId: BigInt(parentData.userId),
        occupation: parentData.occupation || null,
        annualIncome: parentData.annualIncome ? parseFloat(parentData.annualIncome) : null,
        education: parentData.education || null,
        schoolId: BigInt(schoolId),
        createdBy: BigInt(userId)
      },
      include: {
        user: {
          select: {
            id: true, uuid: true, username: true, phone: true,
            firstName: true, lastName: true, status: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Parent created successfully',
      data: convertBigInts(parent)
    });
  } catch (error) {
    console.error('Create parent error:', error);
    res.status(500).json({ success: false, message: 'Failed to create parent' });
  }
});

/**
 * @route   PUT /api/parents/:id
 * @desc    Update parent
 * @access  Private (Admin, Staff)
 * @permissions parent:update
 */
router.put('/:id', authenticateToken, authorizePermissions(['parent:update']), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    const updateData = req.body;

    const parent = await prisma.parent.update({
      where: {
        userId: BigInt(id),
        schoolId: BigInt(schoolId)
      },
      data: {
        occupation: updateData.occupation,
        annualIncome: updateData.annualIncome ? parseFloat(updateData.annualIncome) : null,
        education: updateData.education,
        updatedBy: BigInt(req.user.id)
      },
      include: {
        user: {
          select: {
            id: true, uuid: true, username: true, email: true, phone: true,
            firstName: true, lastName: true, status: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Parent updated successfully',
      data: convertBigInts(parent)
    });
  } catch (error) {
    console.error('Update parent error:', error);
    res.status(500).json({ success: false, message: 'Failed to update parent' });
  }
});

/**
 * @route   DELETE /api/parents/:id
 * @desc    Soft delete parent
 * @access  Private (Admin, Staff)
 * @permissions parent:delete
 */
router.delete('/:id', authenticateToken, authorizePermissions(['parent:delete']), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    await prisma.parent.update({
      where: {
        userId: BigInt(id),
        schoolId: BigInt(schoolId)
      },
      data: {
        deletedAt: new Date(),
        updatedBy: BigInt(req.user.id)
      }
    });

    res.json({ success: true, message: 'Parent deleted successfully' });
  } catch (error) {
    console.error('Delete parent error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete parent' });
  }
});

// ============================================================================
// Parent Students
// ============================================================================

router.get('/:id/students', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const students = await prisma.student.findMany({
      where: {
        parentId: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { id: true, name: true } }
      }
    });

    res.json({ success: true, data: convertBigInts(students) });
  } catch (error) {
    console.error('Get parent students error:', error);
    res.status(500).json({ success: false, message: 'Failed to get parent students' });
  }
});

// Debug endpoint
router.get('/:id/debug', authenticateToken, authorizePermissions(['parent:read']), async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;

    const parent = await prisma.parent.findFirst({
      where: {
        userId: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        students: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, firstName: true, lastName: true } } }
        }
      }
    });

    if (!parent) {
      return res.json({
        success: false,
        message: 'Parent not found',
        debug: { searchedUserId: id, searchedSchoolId: schoolId, parentExists: false }
      });
    }

    res.json({
      success: true,
      message: 'Debug info retrieved',
      data: convertBigInts(parent)
    });
  } catch (error) {
    console.error('Debug parent error:', error);
    res.status(500).json({ success: false, message: 'Debug failed' });
  }
});

// ============================================================================
// Placeholder endpoints for other functionality
// ============================================================================

router.get('/:parentId/students/:studentId/attendance', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), (req, res) => {
  res.json({ success: true, message: 'Student attendance endpoint - implement as needed' });
});

router.get('/:parentId/students/:studentId/grades', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), (req, res) => {
  res.json({ success: true, message: 'Student grades endpoint - implement as needed' });
});

router.get('/:parentId/students/:studentId/assignments', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), (req, res) => {
  res.json({ success: true, message: 'Student assignments endpoint - implement as needed' });
});

router.get('/:parentId/students/:studentId/exams', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), (req, res) => {
  res.json({ success: true, message: 'Student exams endpoint - implement as needed' });
});

router.get('/:parentId/students/:studentId/fees', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), (req, res) => {
  res.json({ success: true, message: 'Student fees endpoint - implement as needed' });
});

router.get('/:parentId/students/:studentId/timetable', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), (req, res) => {
  res.json({ success: true, message: 'Student timetable endpoint - implement as needed' });
});

router.get('/:parentId/notifications', authenticateToken, authorizePermissions(['parent:read', 'notification:read']), (req, res) => {
  res.json({ success: true, message: 'Parent notifications endpoint - implement as needed' });
});

router.patch('/:parentId/notifications/:notificationId/read', authenticateToken, authorizePermissions(['parent:read', 'notification:read']), (req, res) => {
  res.json({ success: true, message: 'Mark notification as read endpoint - implement as needed' });
});

router.patch('/:parentId/notifications/read-all', authenticateToken, authorizePermissions(['parent:read', 'notification:read']), (req, res) => {
  res.json({ success: true, message: 'Mark all notifications as read endpoint - implement as needed' });
});

router.get('/:parentId/students/:studentId/notifications', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), (req, res) => {
  res.json({ success: true, message: 'Student notifications endpoint - implement as needed' });
});

router.get('/:parentId/students/:studentId/academic-summary', authenticateToken, authorizePermissions(['parent:read', 'student:read_children']), (req, res) => {
  res.json({ success: true, message: 'Student academic summary endpoint - implement as needed' });
});

router.get('/stats', authenticateToken, authorizePermissions(['parent:read']), async (req, res) => {
  try {
    const { schoolId } = req.user;
    
    const totalParents = await prisma.parent.count({
      where: { schoolId: BigInt(schoolId), deletedAt: null }
    });

    const activeParents = await prisma.parent.count({
      where: { 
        schoolId: BigInt(schoolId), 
        deletedAt: null,
        user: { status: 'ACTIVE' }
      }
    });

    res.json({
      success: true,
      data: {
        totalParents,
        activeParents,
        inactiveParents: totalParents - activeParents
      }
    });
  } catch (error) {
    console.error('Get parent stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to get parent stats' });
  }
});

export default router; 

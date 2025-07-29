import express from 'express';
import * as ownerController from '../controllers/ownerController.js';
import { authenticateToken, requireOwner, authorizeRoles } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { PrismaClient } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

// Owner authentication schema (same as UserAuthSchema)
const OwnerAuthSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.union([z.string(), z.number()]).transform(val => String(val)).pipe(z.string().min(1, 'Password is required')),
  rememberMe: z.boolean().default(false),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    deviceType: z.string().optional(),
  }).optional(),
});

const prisma = new PrismaClient();
const router = express.Router();

// ======================
// PUBLIC AUTHENTICATION ROUTES (NO AUTH REQUIRED)
// ======================

/**
 * @route   POST /api/owners/login
 * @desc    Owner login with email and password (DEPRECATED - Use /api/users/login instead)
 * @access  Public
 * @body    {email, password, rememberMe?}
 */
router.post('/login', 
  authLimiter,
  validateRequest(OwnerAuthSchema),
  ownerController.loginOwner
);

/**
 * @route   POST /api/owners/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @body    {refreshToken}
 */
router.post('/refresh-token', ownerController.refreshToken);

/**
 * @route   POST /api/owners
 * @desc    Create owner with comprehensive validation and security (Public for initial setup)
 * @access  Public
 * @body    {name, email, phone?, password, status?, timezone?, locale?, metadata?}
 */
router.post('/', ownerController.createOwner);

// ======================
// HEALTH CHECK & STATUS ROUTES (SPECIFIC ROUTES FIRST)
// ======================

/**
 * @route   GET /api/owners/health
 * @desc    Health check for owners service
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      message: 'Owners service is healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: 'Connected'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Owners service is unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
      database: 'Connection failed'
    });
  }
});

/**
 * @route   GET /api/owners/stats
 * @desc    Get owners statistics
 * @access  SUPER_ADMIN
 */
router.get('/stats', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const totalOwners = await prisma.owner.count();
    const activeOwners = await prisma.owner.count({ where: { status: 'ACTIVE' } });
    const inactiveOwners = await prisma.owner.count({ where: { status: 'INACTIVE' } });
    
    res.json({
      success: true,
      data: {
        totalOwners,
        activeOwners,
        inactiveOwners,
      }
    });
  } catch (error) {
    console.error('Error fetching owner stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch statistics',
      code: 'FETCH_STATS_ERROR'
    });
  }
});

// ======================
// AUTHENTICATED OWNER ROUTES (OWNER AUTH REQUIRED)
// ======================

/**
 * @route   GET /api/owners/me
 * @desc    Get current owner profile
 * @access  Owner
 */
router.get('/me', authenticateToken, requireOwner, ownerController.getCurrentOwner);

/**
 * @route   PUT /api/owners/me
 * @desc    Update current owner profile
 * @access  Owner
 */
router.put('/me', authenticateToken, requireOwner, ownerController.updateOwner);

/**
 * @route   POST /api/owners/me/change-password
 * @desc    Change current owner password
 * @access  Owner
 */
router.post('/me/change-password', authenticateToken, requireOwner, ownerController.changePassword);

/**
 * @route   POST /api/owners/logout
 * @desc    Owner logout
 * @access  Owner
 */
router.post('/logout', authenticateToken, requireOwner, ownerController.logoutOwner);

// ======================
// ADMIN CRUD ROUTES (SUPER_ADMIN REQUIRED)
// ======================

/**
 * @route   GET /api/owners
 * @desc    Get all owners with advanced filtering, sorting, pagination, and search
 * @access  SUPER_ADMIN
 */
router.get('/', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, sortBy, sortOrder } = req.query;
    
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }
    if (status) where.status = status;
    
    const owners = await prisma.owner.findMany({
      where,
      skip: (page - 1) * limit,
      take: parseInt(limit),
      orderBy: {
        [sortBy || 'createdAt']: sortOrder || 'desc'
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
      }
    });
    
    const total = await prisma.owner.count({ where });
    
    res.json(convertBigIntToString({
      success: true,
      data: owners,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    }));
  } catch (error) {
    console.error('Error fetching owners:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch owners',
      code: 'FETCH_OWNERS_ERROR'
    });
  }
});

// ======================
// ADVANCED FEATURES ROUTES (SPECIFIC ROUTES)
// ======================

/**
 * @route   GET /api/owners/export
 * @desc    Export owners data in various formats
 * @access  SUPER_ADMIN
 */
router.get('/export', authenticateToken, authorizeRoles(['SUPER_ADMIN']), ownerController.exportOwners);

/**
 * @route   POST /api/owners/bulk
 * @desc    Bulk operations on owners (activate, deactivate, suspend, delete)
 * @access  SUPER_ADMIN
 */
router.post('/bulk', authenticateToken, authorizeRoles(['SUPER_ADMIN']), ownerController.bulkOperation);

/**
 * @route   POST /api/owners/import
 * @desc    Import owners data
 * @access  SUPER_ADMIN
 */
router.post('/import', authenticateToken, authorizeRoles(['SUPER_ADMIN']), ownerController.importOwners);

// ======================
// OWNER STATUS MANAGEMENT ROUTES
// ======================

/**
 * @route   POST /api/owners/:id/activate
 * @desc    Activate owner account
 * @access  SUPER_ADMIN
 */
router.post('/:id/activate', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const owner = await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: { status: 'ACTIVE' }
    });
    
    res.json(convertBigIntToString({
      success: true,
      data: owner,
      message: 'Owner activated successfully'
    }));
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found for activation',
        code: 'OWNER_NOT_FOUND'
      });
    }
    console.error('Error activating owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to activate owner',
      code: 'ACTIVATE_OWNER_ERROR'
    });
  }
});

/**
 * @route   POST /api/owners/:id/deactivate
 * @desc    Deactivate owner account
 * @access  SUPER_ADMIN
 */
router.post('/:id/deactivate', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const owner = await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: { status: 'INACTIVE' }
    });
    
    res.json(convertBigIntToString({
      success: true,
      data: owner,
      message: 'Owner deactivated successfully'
    }));
  } catch (error) {
    console.error('Error deactivating owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to deactivate owner',
      code: 'DEACTIVATE_OWNER_ERROR'
    });
  }
});

/**
 * @route   POST /api/owners/:id/suspend
 * @desc    Suspend owner account
 * @access  SUPER_ADMIN
 */
router.post('/:id/suspend', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const owner = await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: { 
        status: 'SUSPENDED',
        suspendedAt: new Date()
      }
    });
    
    res.json(convertBigIntToString({
      success: true,
      data: owner,
      message: 'Owner suspended successfully'
    }));
  } catch (error) {
    console.error('Error suspending owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to suspend owner',
      code: 'SUSPEND_OWNER_ERROR'
    });
  }
});

/**
 * @route   POST /api/owners/:id/verify-email
 * @desc    Verify owner email
 * @access  SUPER_ADMIN
 */
router.post('/:id/verify-email', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const owner = await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: { 
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });
    
    res.json({
      success: true,
      data: owner,
      message: 'Email verified successfully'
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify email',
      code: 'VERIFY_EMAIL_ERROR'
    });
  }
});

// ======================
// AUDIT LOGS AND SESSIONS
// ======================

/**
 * @route   GET /api/owners/:id/audit-logs
 * @desc    Get audit logs for specific owner
 * @access  SUPER_ADMIN
 */
router.get('/:id/audit-logs', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: { ownerId: BigInt(req.params.id) },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch audit logs',
      code: 'FETCH_AUDIT_LOGS_ERROR'
    });
  }
});

/**
 * @route   GET /api/owners/:id/sessions
 * @desc    List owner sessions
 * @access  SUPER_ADMIN
 */
router.get('/:id/sessions', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { ownerId: BigInt(req.params.id) },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      success: true,
      data: sessions
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch sessions',
      code: 'FETCH_SESSIONS_ERROR'
    });
  }
});

/**
 * @route   POST /api/owners/:id/force-logout
 * @desc    Force logout owner (delete all sessions)
 * @access  SUPER_ADMIN
 */
router.post('/:id/force-logout', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    await prisma.session.deleteMany({
      where: { ownerId: BigInt(req.params.id) }
    });
    
    res.json({
      success: true,
      message: 'All sessions terminated successfully'
    });
  } catch (error) {
    console.error('Error force logging out owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to force logout',
      code: 'FORCE_LOGOUT_ERROR'
    });
  }
});

// ======================
// PASSWORD RESET (ADMIN INITIATED)
// ======================

/**
 * @route   POST /api/owners/:id/reset-password
 * @desc    Reset owner password
 * @access  SUPER_ADMIN
 */
router.post('/:id/reset-password', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const tempPassword = generateTempPassword();
    const { hashedPassword, salt } = await hashPassword(tempPassword);
    
    await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: { 
        password: hashedPassword,
        salt
      }
    });
    
    res.json({
      success: true,
      message: 'Password reset successfully. Temporary password generated.'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset password',
      code: 'RESET_PASSWORD_ERROR'
    });
  }
});

// ======================
// ANALYTICS & REPORTING ROUTES
// ======================

/**
 * @route   GET /api/owners/:id/analytics
 * @desc    Get owner analytics and statistics
 * @access  SUPER_ADMIN
 */
router.get('/:id/analytics', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    const [customerCount, schoolCount] = await Promise.all([
      prisma.customer.count({ where: { ownerId: BigInt(req.params.id) } }),
      prisma.school.count({ where: { ownerId: BigInt(req.params.id) } })
    ]);
    
    res.json({
      success: true,
      data: {
        customerCount,
        schoolCount,
      }
    });
  } catch (error) {
    console.error('Error fetching owner analytics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch analytics',
      code: 'FETCH_ANALYTICS_ERROR'
    });
  }
});

// ======================
// INDIVIDUAL OWNER ROUTES (SUPER_ADMIN REQUIRED)
// ======================

/**
 * @route   GET /api/owners/:id
 * @desc    Get owner by ID
 * @access  SUPER_ADMIN
 */
router.get('/:id', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid owner id',
        code: 'INVALID_OWNER_ID'
      });
    }
    console.log('🔍 Prisma query for owner ID:', req.params.id, typeof req.params.id);
    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(req.params.id) },
      include: {
        customers: true,
        schools: true
      }
    });
    console.log('👤 Prisma result:', owner);
    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }
    res.json(convertBigIntToString({
      success: true,
      data: owner
    }));
  } catch (error) {
    console.error('Error fetching owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch owner',
      code: 'FETCH_OWNER_ERROR'
    });
  }
});

/**
 * @route   PUT /api/owners/:id
 * @desc    Update owner by ID
 * @access  SUPER_ADMIN
 */
router.put('/:id', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid owner id',
        code: 'INVALID_OWNER_ID'
      });
    }
    const owner = await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: req.body
    });
    
    res.json(convertBigIntToString({
      success: true,
      data: owner
    }));
  } catch (error) {
    console.error('Error updating owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update owner',
      code: 'UPDATE_OWNER_ERROR'
    });
  }
});

/**
 * @route   DELETE /api/owners/:id
 * @desc    Delete owner by ID (soft delete)
 * @access  SUPER_ADMIN
 */
router.delete('/:id', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid owner id',
        code: 'INVALID_OWNER_ID'
      });
    }
    const owner = await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: { 
        deletedAt: new Date(),
        status: 'DELETED'
      }
    });
    
    res.json({
      success: true,
      message: 'Owner deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting owner:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete owner',
      code: 'DELETE_OWNER_ERROR'
    });
  }
});

// ======================
// LEGACY ROUTES (for backward compatibility)
// ======================

/**
 * @route   PATCH /api/owners/:id/status
 * @desc    Change owner status (activate, deactivate, suspend)
 * @access  SUPER_ADMIN
 */
router.patch('/:id/status', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid owner id',
        code: 'INVALID_OWNER_ID'
      });
    }
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status value',
        code: 'INVALID_STATUS'
      });
    }
    
    const updateData = { status };
    if (status === 'SUSPENDED') {
      updateData.suspendedAt = new Date();
    }
    
    const owner = await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: updateData
    });
    
    res.json(convertBigIntToString({
      success: true,
      data: owner,
      message: `Owner status updated to ${status}`
    }));
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found for status change',
        code: 'OWNER_NOT_FOUND'
      });
    }
    console.error('Error changing owner status:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to change status',
      code: 'CHANGE_STATUS_ERROR'
    });
  }
});

/**
 * @route   PATCH /api/owners/:id/metadata
 * @desc    Update owner metadata
 * @access  SUPER_ADMIN
 */
router.patch('/:id/metadata', authenticateToken, authorizeRoles(['SUPER_ADMIN']), async (req, res) => {
  try {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid owner id',
        code: 'INVALID_OWNER_ID'
      });
    }
    const { metadata } = req.body;
    
    const owner = await prisma.owner.update({
      where: { id: BigInt(req.params.id) },
      data: { metadata }
    });
    
    res.json(convertBigIntToString({
      success: true,
      data: owner,
      message: 'Metadata updated successfully'
    }));
  } catch (error) {
   console.error('Error updating metadata:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update metadata',
      code: 'UPDATE_METADATA_ERROR'
    });
  }
});

// ======================
// ERROR HANDLING MIDDLEWARE
// ======================

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Global error handler
router.use((error, req, res, next) => {
  console.error('Owner routes error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.details,
      code: 'VALIDATION_ERROR'
    });
  }
  
  if (error.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({
      error: 'Database Error',
      message: 'Invalid database operation',
      code: error.code,
      meta: error.meta
    });
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR'
  });
});

// Add this utility at the top of the file
function convertBigIntToString(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertBigIntToString(v)])
    );
  } else if (typeof obj === 'bigint') {
    return obj.toString();
  }
  return obj;
}

// Add this utility at the top of the file
function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

async function hashPassword(password) {
  const saltRounds = 12;
  const salt = await bcrypt.genSalt(saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);
  return { hashedPassword, salt };
}

// Add this before all :id routes to catch non-numeric ids
router.use('/:id', (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Owner with id '${req.params.id}' not found`,
      code: 'OWNER_NOT_FOUND'
    });
  }
  next();
});

export default router;
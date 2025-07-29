import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';
import userService from '../services/userService.js';

const prisma = new PrismaClient();

// ======================
// JWT CONFIGURATION
// ======================

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// ======================
// VALIDATION SCHEMAS
// ======================

const OwnerCreateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters'),
  email: z.string().email('Invalid email format').max(255, 'Email cannot exceed 255 characters'),
  phone: z.string().max(20, 'Phone cannot exceed 20 characters').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(255, 'Password cannot exceed 255 characters'),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  timezone: z.string().max(50, 'Timezone cannot exceed 50 characters').default('UTC'),
  locale: z.string().max(10, 'Locale cannot exceed 10 characters').default('en-US'),
  metadata: z.record(z.any()).optional(),
});

const OwnerUpdateSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name cannot exceed 100 characters').optional(),
  email: z.string().email('Invalid email format').max(255, 'Email cannot exceed 255 characters').optional(),
  phone: z.string().max(20, 'Phone cannot exceed 20 characters').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  timezone: z.string().max(50, 'Timezone cannot exceed 50 characters').optional(),
  locale: z.string().max(10, 'Locale cannot exceed 10 characters').optional(),
  metadata: z.record(z.any()).optional(),
});

const OwnerLoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

const OwnerPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(255, 'New password cannot exceed 255 characters'),
});

const BulkOperationSchema = z.object({
  operation: z.enum(['activate', 'deactivate', 'suspend', 'delete']),
  ownerIds: z.array(z.string()).min(1, 'At least one owner ID required'),
});

// ======================
// UTILITY FUNCTIONS
// ======================
async function hashPassword(password) {
  const saltRounds = 12;
  const salt = await bcrypt.genSalt(saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);
  return { hashedPassword, salt };
}

async function verifyPassword(password, hash, salt) {
  if (salt) {
    // Use the stored salt to hash the provided password and compare
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword === hash;
  } else {
    // Fallback to bcrypt.compare for backward compatibility
    return await bcrypt.compare(password, hash);
  }
}

function generateJWTToken(payload, expiresIn = JWT_EXPIRES_IN) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

function verifyJWTToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

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

// ======================
// AUTHENTICATION METHODS
// ======================

export const loginOwner = async (req, res) => {
  try {
    const { email, password, rememberMe = false } = OwnerLoginSchema.parse(req.body);

    // Check if owner exists in the owner table
    const owner = await prisma.owner.findUnique({
      where: { email }
    });

    if (!owner) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Check if owner status is active
    if (owner.status !== 'ACTIVE') {
      return res.status(403).json({
        error: 'Account Suspended',
        message: 'Your account is not active. Please contact support.',
        code: 'ACCOUNT_SUSPENDED'
      });
    }

    // Verify password using stored salt (same logic as userService)
    let isPasswordValid = false;
    if (owner.salt) {
      // Use the stored salt to hash the provided password and compare
      const hashedPassword = await bcrypt.hash(password, owner.salt);
      isPasswordValid = hashedPassword === owner.password;
    } else {
      // Fallback to bcrypt.compare for backward compatibility
      isPasswordValid = await bcrypt.compare(password, owner.password);
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate JWT token (same logic as userService)
    const tokenPayload = {
      userId: owner.id.toString(),
      email: owner.email,
      role: 'SUPER_ADMIN',
      name: owner.name
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: rememberMe ? '30d' : '24h',
    });

    // Create session (same logic as userService)
    const session = await prisma.session.create({
      data: {
        token,
        status: 'ACTIVE',
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        deviceType: req.get('Device-Type') || 'unknown',
        userId: owner.id,
        expiresAt: new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000),
      }
    });

    // Update owner's last login info
    await prisma.owner.update({
      where: { id: owner.id },
      data: {
        lastLogin: new Date(),
        lastIp: req.ip
      }
    });

    // Return response in the same format as userService
    res.status(200).json({
      success: true,
      data: {
        owner: {
          id: owner.id,
          name: owner.name,
          email: owner.email,
          status: owner.status,
          timezone: owner.timezone,
          locale: owner.locale,
          emailVerified: owner.emailVerified,
          createdAt: owner.createdAt,
          metadata: owner.metadata
        },
        token,
        sessionId: session.id,
        expiresAt: session.expiresAt,
      },
      message: 'Owner login successful',
      meta: {
        timestamp: new Date().toISOString(),
        source: 'database'
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Owner login error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
};

export const logoutOwner = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
      await prisma.session.deleteMany({
        where: {
          OR: [
            { accessToken: token },
            { refreshToken: token }
          ]
        }
      });
    }

    res.json({
      success: true,
      message: 'Successfully logged out'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    const session = await prisma.session.findUnique({
      where: { refreshToken }
    });

    if (!session) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    if (new Date() > new Date(session.expiresAt)) {
      await prisma.session.deleteMany({
        where: { refreshToken }
      });
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Refresh token expired',
        code: 'REFRESH_TOKEN_EXPIRED'
      });
    }

    const owner = await prisma.owner.findUnique({
      where: { id: session.userId }
    });

    if (!owner) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const newAccessToken = generateJWTToken({
      id: owner.id.toString(),
      email: owner.email,
      role: 'SUPER_ADMIN',
      name: owner.name
    });

    const newRefreshToken = generateRefreshToken();
    const expiresIn = 24 * 60 * 60;

    await prisma.session.deleteMany({
      where: { refreshToken }
    });

    const newSession = await prisma.session.create({
      data: {
        userId: owner.id,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000)
      }
    });

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn,
        tokenType: 'Bearer'
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Token refresh failed',
      code: 'REFRESH_ERROR'
    });
  }
};

export const getCurrentOwner = async (req, res) => {
  try {
    const owner = await prisma.owner.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        timezone: true,
        locale: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        metadata: true
      }
    });
    
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
    console.error('Get current owner error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get owner profile',
      code: 'GET_PROFILE_ERROR'
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = OwnerPasswordChangeSchema.parse(req.body);

    const owner = await prisma.owner.findUnique({
      where: { id: req.user.id }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const isValidPassword = await verifyPassword(currentPassword, owner.password, owner.salt);
    if (!isValidPassword) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    const { hashedPassword, salt } = await hashPassword(newPassword);

    const updatedOwner = await prisma.owner.update({
      where: { id: owner.id },
      data: {
        password: hashedPassword,
        salt
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    res.json(convertBigIntToString({
      success: true,
      message: 'Password changed successfully',
      data: updatedOwner
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Change password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to change password',
      code: 'CHANGE_PASSWORD_ERROR'
    });
  }
};

export const getAllOwners = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      search = '',
      status = '',
      emailVerified = null
    } = req.query;

   const pageNum = parseInt(page) || 1;
const limitNum = parseInt(limit) || 10;
const skip = (pageNum - 1) * limitNum;

const where = {};

if (search) {
  where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
    { phone: { contains: search } }
  ];
}

    if (status) {
      where.status = status;
    }

    if (emailVerified !== null) {
      where.emailVerified = emailVerified === 'true' ? { not: null } : null;
    }

    const [owners, total] = await Promise.all([
      prisma.owner.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sort]: order },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          lastLogin: true
        }
      }),
      prisma.owner.count({ where })
    ]);

    res.json(convertBigIntToString({
      success: true,
      data: owners,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    }));
  } catch (error) {
    console.error('Get all owners error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch owners',
      code: 'FETCH_OWNERS_ERROR'
    });
  }
};

export const getOwnerById = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        timezone: true,
        locale: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        lastLogin: true,
        metadata: true,
        _count: {
          select: {
            schools: true,
            createdUsers: true
          }
        }
      }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: owner
    });
  } catch (error) {
    console.error('Get owner by ID error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch owner',
      code: 'FETCH_OWNER_ERROR'
    });
  }
};

export const createOwner = async (req, res) => {
  try {
    const ownerData = OwnerCreateSchema.parse(req.body);

    const existingOwner = await prisma.owner.findUnique({
      where: { email: ownerData.email }
    });

    if (existingOwner) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    const { hashedPassword, salt } = await hashPassword(ownerData.password);

    const newOwner = await prisma.owner.create({
      data: {
        ...ownerData,
        password: hashedPassword,
        salt
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        timezone: true,
        locale: true,
        createdAt: true
      }
    });

    res.json({
      success: true,
      message: 'Owner created successfully',
      data: convertBigIntToString(newOwner)
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Create owner error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create owner',
      code: 'CREATE_OWNER_ERROR'
    });
  }
};

export const updateOwner = async (req, res) => {
  try {
    const id = req.params.id || req.user.id;
    const updateData = OwnerUpdateSchema.parse(req.body);

    const existingOwner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingOwner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    if (updateData.email && updateData.email !== existingOwner.email) {
      const emailExists = await prisma.owner.findUnique({
        where: { email: updateData.email }
      });

      if (emailExists) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Email already exists',
          code: 'EMAIL_EXISTS'
        });
      }
    }

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: {
        ...updateData
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        timezone: true,
        locale: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        metadata: true
      }
    });

    res.json(convertBigIntToString({
      success: true,
      message: 'Owner updated successfully',
      data: updatedOwner
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Update owner error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update owner',
      code: 'UPDATE_OWNER_ERROR'
    });
  }
};

export const deleteOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const existingOwner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingOwner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    await prisma.owner.delete({
      where: { id: BigInt(id) }
    });

    res.json({
      success: true,
      message: 'Owner deleted successfully'
    });
  } catch (error) {
    console.error('Delete owner error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete owner',
      code: 'DELETE_OWNER_ERROR'
    });
  }
};

export const bulkOperation = async (req, res) => {
  try {
    const { operation, ownerIds } = BulkOperationSchema.parse(req.body);

    const results = {
      success: [],
      failed: []
    };

    for (const id of ownerIds) {
      try {
        const owner = await prisma.owner.findUnique({
          where: { id: BigInt(id) }
        });

        if (!owner) {
          results.failed.push({ id, reason: 'Owner not found' });
          continue;
        }

        let data = {};
        switch (operation) {
          case 'activate':
            data.status = 'ACTIVE';
            break;
          case 'deactivate':
            data.status = 'INACTIVE';
            break;
          case 'suspend':
            data.status = 'SUSPENDED';
            break;
          case 'delete':
            await prisma.owner.delete({ where: { id: BigInt(id) } });
            results.success.push(id);
            continue;
        }

        await prisma.owner.update({
          where: { id: BigInt(id) },
          data
        });

        results.success.push(id);
      } catch (error) {
        results.failed.push({ id, reason: error.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk ${operation} operation completed`,
      data: results
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Bulk operation error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to perform bulk operation',
      code: 'BULK_OPERATION_ERROR'
    });
  }
};

export const getOwnerAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const [owner, schoolsCount, usersCount, sessions] = await Promise.all([
      prisma.owner.findUnique({
        where: { id: BigInt(id) },
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          createdAt: true,
          lastLogin: true
        }
      }),
      prisma.school.count({
        where: { ownerId: id }
      }),
      prisma.user.count({
        where: { createdById: id }
      }),
      prisma.session.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 1
      })
    ]);

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: {
        owner,
        statistics: {
          schools: schoolsCount,
          createdUsers: usersCount
        },
        activity: {
          sessions: sessions.length,
          lastActivity: sessions[0]?.createdAt || owner.lastLogin || owner.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get owner analytics error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get owner analytics',
      code: 'GET_ANALYTICS_ERROR'
    });
  }
};

export const exportOwners = async (req, res) => {
  try {
    const { format = 'json' } = req.query;

    const owners = await prisma.owner.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        emailVerified: true,
        createdAt: true,
        lastLogin: true
      }
    });

    if (format === 'csv') {
      const csvData = convertToCSV(owners);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=owners.csv');
      res.send(csvData);
    } else {
      res.json({
        success: true,
        data: owners
      });
    }
  } catch (error) {
    console.error('Export owners error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to export owners',
      code: 'EXPORT_ERROR'
    });
  }
};

export const importOwners = async (req, res) => {
  try {
    const { owners: ownersData } = req.body;

    if (!Array.isArray(ownersData)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Owners data must be an array',
        code: 'INVALID_IMPORT_DATA'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const ownerData of ownersData) {
      try {
        const validatedData = OwnerCreateSchema.parse(ownerData);
        
        const existingOwner = await prisma.owner.findUnique({
          where: { email: validatedData.email }
        });

        if (existingOwner) {
          results.failed.push({ 
            email: validatedData.email, 
            reason: 'Email already exists' 
          });
          continue;
        }

        const { hashedPassword, salt } = await hashPassword(validatedData.password);

        const newOwner = await prisma.owner.create({
          data: {
            ...validatedData,
            password: hashedPassword,
            salt
          },
          select: {
            id: true,
            name: true,
            email: true
          }
        });

        results.success.push(newOwner);
      } catch (error) {
        results.failed.push({ 
          data: ownerData, 
          reason: error.message 
        });
      }
    }

    res.json({
      success: true,
      message: 'Import completed',
      data: results
    });
  } catch (error) {
    console.error('Import owners error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to import owners',
      code: 'IMPORT_ERROR'
    });
  }
};

function convertToCSV(data) {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];

  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}

export const changeOwnerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid status',
        code: 'INVALID_STATUS'
      });
    }

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: { status },
      select: {
        id: true,
        name: true,
        email: true,
        status: true
      }
    });

    res.json({
      success: true,
      message: 'Owner status updated successfully',
      data: updatedOwner
    });
  } catch (error) {
    console.error('Change owner status error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update owner status',
      code: 'UPDATE_STATUS_ERROR'
    });
  }
};

export const updateOwnerMetadata = async (req, res) => {
  try {
    const { id } = req.params;
    const { metadata } = req.body;

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: { metadata },
      select: {
        id: true,
        name: true,
        email: true,
        metadata: true
      }
    });

    res.json({
      success: true,
      message: 'Owner metadata updated successfully',
      data: updatedOwner
    });
  } catch (error) {
    console.error('Update owner metadata error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update owner metadata',
      code: 'UPDATE_METADATA_ERROR'
    });
  }
};

export const getOwnerSessions = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where: { userId: id },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.session.count({
        where: { userId: id }
      })
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get owner sessions error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get owner sessions',
      code: 'GET_SESSIONS_ERROR'
    });
  }
};

export const forceLogoutOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    await prisma.session.deleteMany({
      where: { userId: id }
    });

    res.json({
      success: true,
      message: 'Owner force logged out successfully'
    });
  } catch (error) {
    console.error('Force logout owner error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to force logout owner',
      code: 'FORCE_LOGOUT_ERROR'
    });
  }
};

export const resetOwnerPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'New password must be at least 8 characters',
        code: 'INVALID_PASSWORD'
      });
    }

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const { hashedPassword, salt } = await hashPassword(newPassword);

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: {
        password: hashedPassword,
        salt
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    res.json({
      success: true,
      message: 'Owner password reset successfully',
      data: updatedOwner
    });
  } catch (error) {
    console.error('Reset owner password error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset owner password',
      code: 'RESET_PASSWORD_ERROR'
    });
  }
};

export const updateOwnerById = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = OwnerUpdateSchema.parse(req.body);

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    if (updateData.email && updateData.email !== owner.email) {
      const existingOwner = await prisma.owner.findUnique({
        where: { email: updateData.email }
      });

      if (existingOwner && existingOwner.id !== id) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'Email already exists',
          code: 'EMAIL_EXISTS'
        });
      }
    }

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: {
        ...updateData
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        timezone: true,
        locale: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        metadata: true
      }
    });

    res.json({
      success: true,
      message: 'Owner updated successfully',
      data: updatedOwner
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }

    console.error('Update owner by ID error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update owner',
      code: 'UPDATE_OWNER_ERROR'
    });
  }
};

export const activateOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true
      }
    });

    res.json({
      success: true,
      message: 'Owner activated successfully',
      data: updatedOwner
    });
  } catch (error) {
    console.error('Activate owner error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to activate owner',
      code: 'ACTIVATE_OWNER_ERROR'
    });
  }
};

export const deactivateOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: { status: 'INACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true
      }
    });

    res.json({
      success: true,
      message: 'Owner deactivated successfully',
      data: updatedOwner
    });
  } catch (error) {
    console.error('Deactivate owner error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to deactivate owner',
      code: 'DEACTIVATE_OWNER_ERROR'
    });
  }
};

export const suspendOwner = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: { status: 'SUSPENDED' },
      select: {
        id: true,
        name: true,
        email: true,
        status: true
      }
    });

    res.json({
      success: true,
      message: 'Owner suspended successfully',
      data: updatedOwner
    });
  } catch (error) {
    console.error('Suspend owner error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to suspend owner',
      code: 'SUSPEND_OWNER_ERROR'
    });
  }
};

export const verifyOwnerEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const owner = await prisma.owner.findUnique({
      where: { id: BigInt(id) }
    });

    if (!owner) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Owner not found',
        code: 'OWNER_NOT_FOUND'
      });
    }

    const updatedOwner = await prisma.owner.update({
      where: { id: BigInt(id) },
      data: { 
        emailVerified: new Date(),
        emailVerifiedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        emailVerified: true,
        emailVerifiedAt: true
      }
    });

    res.json({
      success: true,
      message: 'Owner email verified successfully',
      data: updatedOwner
    });
  } catch (error) {
    console.error('Verify owner email error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to verify owner email',
      code: 'VERIFY_EMAIL_ERROR'
    });
  }
};

export const getOwnerAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 50, action, startDate, endDate } = req.query;

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    const skip = (pageNum - 1) * limitNum;

    const where = { ownerId: id };

    if (action) {
      where.action = action;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    console.error('Get owner audit logs error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get owner audit logs',
      code: 'GET_AUDIT_LOGS_ERROR'
    });
  }
};
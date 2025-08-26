import { PrismaClient } from '../generated/prisma/client.js';
import Redis from 'ioredis';
import { 
  generateUUID, 
  hashPassword, 
  generateSalt,
  formatResponse,
  handlePrismaError,
  createAuditLog
} from '../utils/responseUtils.js';
import {
  sanitizeString,
  validateEmail,
  validatePhone
} from '../middleware/validation.js';
import {
  buildParentSearchQuery,
  buildParentIncludeQuery,
  formatParentResponse,
  validateParentData,
  generateParentCode,
  calculateIncomeRange,
  validateParentPermissions,
  generateParentReport
} from '../utils/parentUtils.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

// Redis configuration (optional - falls back to memory store if not available)
let redisClient = null;
let useRedis = false;

// Disable Redis for now - only use memory cache
console.log('Redis disabled - using memory cache only');

// Memory cache fallback
const memoryCache = new Map();
const cacheTTL = new Map();

class ParentService {
  constructor() {
    this.cachePrefix = 'parent';
    this.cacheTTL = 1800; // 30 minutes
    this.prisma = prisma;
  }

  // Helper method to convert user ID to parent record ID
  async getParentRecordIdByUserId(userId, schoolId) {
    try {
      const parent = await this.prisma.parent.findFirst({
        where: { 
          userId: BigInt(userId), 
          schoolId: BigInt(schoolId), 
          deletedAt: null 
        }
      });
      
      if (!parent) {
        throw new Error('Parent not found');
      }
      
      return parent.id;
    } catch (error) {
      logger.error('Error getting parent record ID:', error);
      throw error;
    }
  }

  // ======================
  // CACHE OPERATIONS
  // ======================

  async getCacheKey(key) {
    return `${this.cachePrefix}:${key}`;
  }

  async getFromCache(key) {
    try {
      const cacheKey = await this.getCacheKey(key);
      
      if (useRedis && redisClient) {
        const cached = await redisClient.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      } else {
        // Memory cache fallback
        if (this.isExpired(cacheKey)) {
          memoryCache.delete(cacheKey);
          cacheTTL.delete(cacheKey);
          return null;
        }
        return memoryCache.get(cacheKey) || null;
      }
    } catch (error) {
      logger.error('Cache get error:', error);
      return null;
    }
  }

  async setCache(key, data, ttl = this.cacheTTL) {
    try {
      const cacheKey = await this.getCacheKey(key);
      
      if (useRedis && redisClient) {
        await redisClient.setex(cacheKey, ttl, JSON.stringify(data));
      } else {
        // Memory cache fallback
        memoryCache.set(cacheKey, data);
        cacheTTL.set(cacheKey, Date.now() + (ttl * 1000));
      }
    } catch (error) {
      logger.error('Cache set error:', error);
    }
  }

  async deleteCache(pattern) {
    try {
      const cacheKey = await this.getCacheKey(pattern);
      
      if (useRedis && redisClient) {
        const keys = await redisClient.keys(cacheKey);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } else {
        // Memory cache fallback
        for (const key of memoryCache.keys()) {
          if (key.includes(pattern.replace('*', ''))) {
            memoryCache.delete(key);
            cacheTTL.delete(key);
          }
        }
      }
    } catch (error) {
      logger.error('Cache delete error:', error);
    }
  }

  isExpired(key) {
    const expiry = cacheTTL.get(key);
    return expiry && Date.now() > expiry;
  }

  async invalidateParentCache(parentId, schoolId) {
    await Promise.all([
      this.deleteCache(`*:${parentId}`),
      this.deleteCache(`*:school:${schoolId}`),
      this.deleteCache('*:stats*'),
      this.deleteCache('*:analytics*')
    ]);
  }

  // ======================
  // CRUD OPERATIONS
  // ======================

  async createParent(data, userId, schoolId) {
    try {
      // Validate data
      const validationErrors = await validateParentData(data, schoolId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Generate password hash and salt
      const salt = generateSalt();
      const hashedPassword = await hashPassword(data.password, salt);

      // Create user and parent in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Generate username if not provided
        const username = data.username || `${data.firstName.toLowerCase()}${data.lastName.toLowerCase()}${Date.now()}`;
        
        // Create user
        const user = await tx.user.create({
          data: {
            uuid: generateUUID(),
            username,
            email: data.email,
            phone: data.phone,
            password: hashedPassword,
            salt,
            firstName: sanitizeString(data.firstName),
            middleName: data.middleName ? sanitizeString(data.middleName) : null,
            lastName: sanitizeString(data.lastName),
            displayName: data.displayName ? sanitizeString(data.displayName) : null,
            gender: data.gender,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
            avatar: data.avatar,
            bio: data.bio ? sanitizeString(data.bio) : null,
            role: 'PARENT',
            status: 'ACTIVE',
            timezone: data.timezone || 'UTC',
            locale: data.locale || 'en-US',
            metadata: data.metadata || {},
            schoolId,
            createdByOwnerId: userId,
            createdBy: userId
          }
        });

        // Create parent
        const parent = await tx.parent.create({
          data: {
            uuid: generateUUID(),
            userId: user.id,
            occupation: data.occupation ? sanitizeString(data.occupation) : null,
            annualIncome: data.annualIncome ? parseFloat(data.annualIncome) : null,
            education: data.education ? sanitizeString(data.education) : null,
            schoolId,
            createdBy: userId
          },
          include: {
            user: true,
            students: true,
            payments: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        });

        return parent;
      });

      // Invalidate cache
      await this.invalidateParentCache(result.id, schoolId);

      // Create audit log
      await createAuditLog({
        action: 'CREATE',
        entityType: 'Parent',
        entityId: result.id,
        userId,
        schoolId,
        oldData: null,
        newData: {
          parentId: result.id,
          email: result.user.email,
          name: `${result.user.firstName} ${result.user.lastName}`
        }
      });

      logger.info(`Parent created: ${result.id} by user: ${userId}`);
      return formatParentResponse(result, { includeStats: true });

    } catch (error) {
      logger.error('Create parent error:', error);
      throw error;
    }
  }

  async getParents(filters, schoolId, include = null) {
    try {
      const cacheKey = `list:${JSON.stringify(filters)}:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      // Build where clause with school filter
      const baseWhere = {
        schoolId: BigInt(schoolId),
        deletedAt: null
      };

      // Add search filters if provided
      let where = baseWhere;
      if (filters.search) {
        where = {
          ...baseWhere,
          OR: [
            { user: { firstName: { contains: filters.search, mode: 'insensitive' } } },
            { user: { lastName: { contains: filters.search, mode: 'insensitive' } } },
            { user: { email: { contains: filters.search, mode: 'insensitive' } } },
            { occupation: { contains: filters.search, mode: 'insensitive' } }
          ]
        };
      }

      const includeObj = buildParentIncludeQuery(include);

      // Set default pagination values
      const page = parseInt(filters.page) || 1;
      const limit = parseInt(filters.limit) || 10;
      const skip = (page - 1) * limit;

      logger.debug('PARENTS: Before DB call', { where, includeObj, page, limit, skip });
      const [parents, total] = await Promise.all([
        this.prisma.parent.findMany({
          where,
          include: includeObj,
          skip,
          take: limit,
          orderBy: {
            [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc'
          }
        }),
        this.prisma.parent.count({ where })
      ]);
      logger.debug('PARENTS: After DB call', { parentCount: parents.length, total });

      logger.debug('PARENTS: Before formatting');
      const formattedParents = parents.map(parent => formatParentResponse(parent, { includeStats: true }));
      logger.debug('PARENTS: After formatting');
      
      const result = {
        parents: formattedParents,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };

      logger.debug('PARENTS: Before setCache and return');
      await this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      logger.error('Get parents error:', error);
      throw error;
    }
  }

  async getParentById(parentId, schoolId, include = null) {
    try {
      const cacheKey = `byId:${parentId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildParentIncludeQuery(include);

      const parent = await this.prisma.parent.findFirst({
        where: {
          id: parentId,
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: includeObj
      });

      if (!parent) {
        throw new Error('Parent not found');
      }

      const result = formatParentResponse(parent, { includeStats: true });
      await this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      logger.error('Get parent by ID error:', error);
      throw error;
    }
  }

  async updateParent(parentId, data, userId, schoolId) {
    try {
      // Check if parent exists and user has permission
      const existingParent = await this.prisma.parent.findFirst({
        where: { id: parentId, schoolId: BigInt(schoolId), deletedAt: null },
        include: { user: true }
      });

      if (!existingParent) {
        throw new Error('Parent not found');
      }

      // Validate permissions
      const hasPermission = await validateParentPermissions(parentId, userId, schoolId);
      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }

      // Validate data
      const validationErrors = await validateParentData(data, schoolId, existingParent.userId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Update in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Update user if user fields provided
        if (Object.keys(data).some(key => ['email', 'phone', 'firstName', 'middleName', 'lastName', 'displayName', 'gender', 'birthDate', 'avatar', 'bio', 'timezone', 'locale', 'metadata'].includes(key))) {
          const userData = {};
          if (data.email) userData.email = data.email;
          if (data.phone !== undefined) userData.phone = data.phone;
          if (data.firstName) userData.firstName = sanitizeString(data.firstName);
          if (data.middleName !== undefined) userData.middleName = data.middleName ? sanitizeString(data.middleName) : null;
          if (data.lastName) userData.lastName = sanitizeString(data.lastName);
          if (data.displayName !== undefined) userData.displayName = data.displayName ? sanitizeString(data.displayName) : null;
          if (data.gender) userData.gender = data.gender;
          if (data.birthDate) userData.birthDate = new Date(data.birthDate);
          if (data.avatar) userData.avatar = data.avatar;
          if (data.bio !== undefined) userData.bio = data.bio ? sanitizeString(data.bio) : null;
          if (data.timezone) userData.timezone = data.timezone;
          if (data.locale) userData.locale = data.locale;
          if (data.metadata) userData.metadata = data.metadata;
          userData.updatedBy = userId;

          await tx.user.update({
            where: { id: existingParent.userId },
            data: userData
          });
        }

        // Update parent
        const parentData = {};
        if (data.occupation !== undefined) parentData.occupation = data.occupation ? sanitizeString(data.occupation) : null;
        if (data.annualIncome !== undefined) parentData.annualIncome = data.annualIncome ? parseFloat(data.annualIncome) : null;
        if (data.education !== undefined) parentData.education = data.education ? sanitizeString(data.education) : null;
        parentData.updatedBy = userId;

        const parent = await tx.parent.update({
          where: { id: parentId },
          data: parentData,
          include: {
            user: true,
            students: true,
            payments: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        });

        return parent;
      });

      // Invalidate cache
      await this.invalidateParentCache(parentId, schoolId);

      // Create audit log
      await createAuditLog({
        action: 'UPDATE',
        entityType: 'Parent',
        entityId: parentId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          parentId,
          email: result.user.email,
          name: `${result.user.firstName} ${result.user.lastName}`,
          changes: data
        }
      });

      logger.info(`Parent updated: ${parentId} by user: ${userId}`);
      return formatParentResponse(result, { includeStats: true });

    } catch (error) {
      logger.error('Update parent error:', error);
      throw error;
    }
  }

  async deleteParent(parentId, userId, schoolId) {
    try {
      const parent = await this.prisma.parent.findFirst({
        where: { id: parentId, schoolId: BigInt(schoolId), deletedAt: null },
        include: { user: true }
      });

      if (!parent) {
        throw new Error('Parent not found');
      }

      // Check if parent has active students
      const activeStudents = await this.prisma.student.count({
        where: {
          parentId,
          schoolId: BigInt(schoolId),
          deletedAt: null,
          user: { status: 'ACTIVE' }
        }
      });

      if (activeStudents > 0) {
        throw new Error(`Cannot delete parent with ${activeStudents} active student(s). Please transfer or deactivate students first.`);
      }

      // Soft delete
      await this.prisma.$transaction(async (tx) => {
        await tx.parent.update({
          where: { id: parentId },
          data: {
            deletedAt: new Date(),
            updatedBy: userId
          }
        });

        await tx.user.update({
          where: { id: parent.userId },
          data: {
            status: 'INACTIVE',
            updatedBy: userId
          }
        });
      });

      // Invalidate cache
      await this.invalidateParentCache(parentId, schoolId);

      // Create audit log
      await createAuditLog({
        action: 'DELETE',
        entityType: 'Parent',
        entityId: parentId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          parentId,
          email: parent.user.email,
          name: `${parent.user.firstName} ${parent.user.lastName}`
        }
      });

      logger.info(`Parent deleted: ${parentId} by user: ${userId}`);
      return { success: true, message: 'Parent deleted successfully' };

    } catch (error) {
      logger.error('Delete parent error:', error);
      throw error;
    }
  }

  async restoreParent(parentId, userId, schoolId) {
    try {
      const parent = await this.prisma.parent.findFirst({
        where: { id: parentId, schoolId: BigInt(schoolId) },
        include: { user: true }
      });

      if (!parent) {
        throw new Error('Parent not found');
      }

      if (!parent.deletedAt) {
        throw new Error('Parent is not deleted');
      }

      // Restore
      await this.prisma.$transaction(async (tx) => {
        await tx.parent.update({
          where: { id: parentId },
          data: {
            deletedAt: null,
            updatedBy: userId
          }
        });

        await tx.user.update({
          where: { id: parent.userId },
          data: {
            status: 'ACTIVE',
            updatedBy: userId
          }
        });
      });

      // Invalidate cache
      await this.invalidateParentCache(parentId, schoolId);

      // Create audit log
      await createAuditLog({
        action: 'RESTORE',
        entityType: 'Parent',
        entityId: parentId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          parentId,
          email: parent.user.email,
          name: `${parent.user.firstName} ${parent.user.lastName}`
        }
      });

      logger.info(`Parent restored: ${parentId} by user: ${userId}`);
      return { success: true, message: 'Parent restored successfully' };

    } catch (error) {
      logger.error('Restore parent error:', error);
      throw error;
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateParents(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const parentData of data.parents) {
        try {
          const result = await this.createParent(parentData, userId, schoolId);
          results.push(result);
        } catch (error) {
          errors.push({
            data: parentData,
            error: error.message
          });
        }
      }

      return {
        success: true,
        created: results.length,
        failed: errors.length,
        results,
        errors
      };

    } catch (error) {
      logger.error('Bulk create parents error:', error);
      throw error;
    }
  }

  async bulkUpdateParents(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const update of data.updates) {
        try {
          const result = await this.updateParent(update.id, update.data, userId, schoolId);
          results.push(result);
        } catch (error) {
          errors.push({
            id: update.id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        updated: results.length,
        failed: errors.length,
        results,
        errors
      };

    } catch (error) {
      logger.error('Bulk update parents error:', error);
      throw error;
    }
  }

  async bulkDeleteParents(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const parentId of data.parentIds) {
        try {
          const result = await this.deleteParent(parentId, userId, schoolId);
          results.push({ id: parentId, ...result });
        } catch (error) {
          errors.push({
            id: parentId,
            error: error.message
          });
        }
      }

      return {
        success: true,
        deleted: results.length,
        failed: errors.length,
        results,
        errors
      };

    } catch (error) {
      logger.error('Bulk delete parents error:', error);
      throw error;
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getParentStats(parentId, schoolId) {
    try {
      const cacheKey = `stats:${parentId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      // Convert user ID to parent record ID
      const actualParentId = await this.getParentRecordIdByUserId(parentId, schoolId);

      const [parent, students, payments] = await Promise.all([
        this.prisma.parent.findFirst({
          where: { id: actualParentId, schoolId: BigInt(schoolId), deletedAt: null },
          include: {
            user: true,
            students: {
              include: {
                user: true,
                class: true,
                section: true
              }
            },
            payments: true
          }
        }),
        this.prisma.student.count({
          where: { parentId: actualParentId, schoolId: BigInt(schoolId), deletedAt: null }
        }),
        this.prisma.payment.findMany({
          where: { parentId: actualParentId, schoolId },
          select: {
            amount: true,
            status: true,
            paymentDate: true,
            dueDate: true
          }
        })
      ]);

      if (!parent) {
        throw new Error('Parent not found');
      }

      const stats = {
        parentId,
        totalStudents: students,
        totalPayments: payments.length,
        totalPaid: payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0),
        totalPending: payments.filter(p => p.status === 'UNPAID' || p.status === 'PARTIALLY_PAID').reduce((sum, p) => sum + Number(p.amount), 0),
        totalOverdue: payments.filter(p => p.status === 'OVERDUE').reduce((sum, p) => sum + Number(p.amount), 0),
        paymentHistory: {
          PAID: payments.filter(p => p.status === 'PAID').length,
          UNPAID: payments.filter(p => p.status === 'UNPAID').length,
          PARTIALLY_PAID: payments.filter(p => p.status === 'PARTIALLY_PAID').length,
          OVERDUE: payments.filter(p => p.status === 'OVERDUE').length,
          CANCELLED: payments.filter(p => p.status === 'CANCELLED').length,
          REFUNDED: payments.filter(p => p.status === 'REFUNDED').length
        },
        incomeRange: calculateIncomeRange(parent.annualIncome),
        lastPayment: payments.length > 0 ? payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0] : null,
        nextDuePayment: payments.filter(p => p.status === 'UNPAID' || p.status === 'PARTIALLY_PAID' || p.status === 'OVERDUE').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0] || null
      };

      await this.setCache(cacheKey, stats, 900); // 15 minutes
      return stats;

    } catch (error) {
      logger.error('Get parent stats error:', error);
      throw error;
    }
  }

  async getParentAnalytics(parentId, schoolId, period = '30d') {
    try {
      const cacheKey = `analytics:${parentId}:${period}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      // Convert user ID to parent record ID
      const actualParentId = await this.getParentRecordIdByUserId(parentId, schoolId);

      const now = new Date();
      let startDate;

      switch (period) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1y':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const payments = await this.prisma.payment.findMany({
        where: {
          parentId: actualParentId,
          schoolId,
          paymentDate: {
            gte: startDate,
            lte: now
          }
        },
        select: {
          amount: true,
          status: true,
          paymentDate: true,
          method: true
        },
        orderBy: { paymentDate: 'asc' }
      });

      // Group payments by date
      const dailyPayments = {};
      payments.forEach(payment => {
        const date = payment.paymentDate.toISOString().split('T')[0];
        if (!dailyPayments[date]) {
          dailyPayments[date] = {
            total: 0,
            count: 0,
            methods: {}
          };
        }
        dailyPayments[date].total += Number(payment.amount);
        dailyPayments[date].count += 1;
        dailyPayments[date].methods[payment.method] = (dailyPayments[date].methods[payment.method] || 0) + Number(payment.amount);
      });

      const analytics = {
        period,
        startDate,
        endDate: now,
        totalPayments: payments.length,
        totalAmount: payments.reduce((sum, p) => sum + Number(p.amount), 0),
        averageAmount: payments.length > 0 ? payments.reduce((sum, p) => sum + Number(p.amount), 0) / payments.length : 0,
        paymentMethods: payments.reduce((acc, p) => {
          acc[p.method] = (acc[p.method] || 0) + Number(p.amount);
          return acc;
        }, {}),
        dailyPayments,
        statusDistribution: payments.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {})
      };

      await this.setCache(cacheKey, analytics, 1800); // 30 minutes
      return analytics;

    } catch (error) {
      logger.error('Get parent analytics error:', error);
      throw error;
    }
  }

  async getParentPerformance(parentId, schoolId) {
    try {
      const cacheKey = `performance:${parentId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      // Convert user ID to parent record ID
      const actualParentId = await this.getParentRecordIdByUserId(parentId, schoolId);

      const [parent, students, payments] = await Promise.all([
        this.prisma.parent.findFirst({
          where: { id: actualParentId, schoolId: BigInt(schoolId), deletedAt: null },
          include: {
            user: true,
            students: {
              include: {
                grades: {
                  include: {
                    exam: true,
                    subject: true
                  }
                }
              }
            }
          }
        }),
        this.prisma.student.findMany({
          where: { parentId: actualParentId, schoolId: BigInt(schoolId), deletedAt: null },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            },
            grades: {
              include: {
                exam: true,
                subject: true
              }
            }
          }
        }),
        this.prisma.payment.findMany({
          where: { parentId: actualParentId, schoolId },
          select: {
            amount: true,
            status: true,
            paymentDate: true,
            dueDate: true
          }
        })
      ]);

      if (!parent) {
        throw new Error('Parent not found');
      }

      // Calculate student performance
      const studentPerformance = students.map(student => {
        const grades = student.grades || [];
        const totalMarks = grades.reduce((sum, g) => sum + Number(g.marks), 0);
        const averageMarks = grades.length > 0 ? totalMarks / grades.length : 0;
        
        // Safety check for user data
        const firstName = student.user?.firstName || 'Unknown';
        const lastName = student.user?.lastName || 'Student';
        
        return {
          studentId: student.id?.toString?.() || String(student.id),
          studentName: `${firstName} ${lastName}`,
          totalExams: grades.length,
          averageMarks,
          totalMarks,
          performance: averageMarks >= 80 ? 'EXCELLENT' : averageMarks >= 70 ? 'GOOD' : averageMarks >= 60 ? 'AVERAGE' : 'NEEDS_IMPROVEMENT'
        };
      });

      // Calculate payment performance
      const totalDue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0);
      const paymentRate = totalDue > 0 ? (totalPaid / totalDue) * 100 : 100;

      // Safety check for parent user data
      const parentFirstName = parent.user?.firstName || 'Unknown';
      const parentLastName = parent.user?.lastName || 'Parent';
      
      const performance = {
        parentId,
        parentName: `${parentFirstName} ${parentLastName}`,
        studentPerformance,
        paymentPerformance: {
          totalDue,
          totalPaid,
          paymentRate,
          status: paymentRate >= 90 ? 'EXCELLENT' : paymentRate >= 75 ? 'GOOD' : paymentRate >= 60 ? 'AVERAGE' : 'NEEDS_IMPROVEMENT'
        },
        overallPerformance: {
          averageStudentPerformance: studentPerformance.length > 0 ? studentPerformance.reduce((sum, s) => sum + (s.averageMarks || 0), 0) / studentPerformance.length : 0,
          paymentRate,
          combinedScore: studentPerformance.length > 0 ? ((studentPerformance.reduce((sum, s) => sum + (s.averageMarks || 0), 0) / studentPerformance.length) * 0.6 + paymentRate * 0.4) : paymentRate
        }
      };

      await this.setCache(cacheKey, performance, 3600); // 1 hour
      return performance;

    } catch (error) {
      logger.error('Get parent performance error:', error);
      throw error;
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  async searchParents(query, schoolId, include = null) {
    try {
      const cacheKey = `search:${query}:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildParentIncludeQuery(include);

      const parents = await this.prisma.parent.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          OR: [
            { user: { firstName: { contains: query, mode: 'insensitive' } } },
            { user: { lastName: { contains: query, mode: 'insensitive' } } },
            { user: { email: { contains: query, mode: 'insensitive' } } },
            { user: { phone: { contains: query, mode: 'insensitive' } } },
            { occupation: { contains: query, mode: 'insensitive' } },
            { education: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: includeObj,
        take: 20
      });

      const result = parents.map(parent => formatParentResponse(parent, { includeStats: true }));
      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;

    } catch (error) {
      logger.error('Search parents error:', error);
      throw error;
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  async exportParents(filters, schoolId, format = 'json') {
    try {
      // Build where clause with school filter
      const baseWhere = {
        schoolId: BigInt(schoolId),
        deletedAt: null
      };

      // Add search filters if provided
      let where = baseWhere;
      if (filters.search) {
        where = {
          ...baseWhere,
          OR: [
            { user: { firstName: { contains: filters.search, mode: 'insensitive' } } },
            { user: { lastName: { contains: filters.search, mode: 'insensitive' } } },
            { user: { email: { contains: filters.search, mode: 'insensitive' } } },
            { occupation: { contains: filters.search, mode: 'insensitive' } }
          ]
        };
      }

      const includeObj = buildParentIncludeQuery('students,payments,school');

      const parents = await this.prisma.parent.findMany({
        where,
        include: includeObj
      });

      const data = parents.map(parent => formatParentResponse(parent, { includeStats: true }));

      if (format === 'csv') {
        // Convert to CSV format
        const headers = ['ID', 'UUID', 'First Name', 'Last Name', 'Email', 'Phone', 'Occupation', 'Annual Income', 'Education', 'Student Count', 'Payment Count', 'Total Paid', 'Total Pending', 'Created At'];
        const csvData = data.map(parent => [
          parent.id,
          parent.uuid,
          parent.user.firstName,
          parent.user.lastName,
          parent.user.email,
          parent.user.phone,
          parent.occupation,
          parent.annualIncome,
          parent.education,
          parent.stats.totalStudents,
          parent.stats.totalPayments,
          parent.stats.totalPaid,
          parent.stats.totalPending,
          parent.createdAt
        ]);

        return {
          format: 'csv',
          headers,
          data: csvData,
          total: data.length
        };
      }

      return {
        format: 'json',
        data,
        total: data.length
      };

    } catch (error) {
      logger.error('Export parents error:', error);
      throw error;
    }
  }

  async importParents(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const parentData of data.parents) {
        try {
          const result = await this.createParent(parentData, userId, schoolId);
          results.push(result);
        } catch (error) {
          errors.push({
            data: parentData,
            error: error.message
          });
        }
      }

      return {
        success: true,
        imported: results.length,
        failed: errors.length,
        results,
        errors
      };

    } catch (error) {
      logger.error('Import parents error:', error);
      throw error;
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  async generateCodeSuggestions(name, schoolId) {
    try {
      const suggestions = [];
      const baseCode = name.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
      
      for (let i = 1; i <= 5; i++) {
        const code = `${baseCode}${String(i).padStart(3, '0')}`;
        const exists = await this.prisma.parent.findFirst({
          where: {
            schoolId,
            user: {
              OR: [
                { firstName: { startsWith: name.split(' ')[0] } },
                { lastName: { startsWith: name.split(' ').slice(-1)[0] } }
              ]
            }
          }
        });
        
        if (!exists) {
          suggestions.push(code);
        }
      }

      return suggestions;

    } catch (error) {
      logger.error('Generate code suggestions error:', error);
      throw error;
    }
  }

  async getParentCountByIncomeRange(schoolId) {
    try {
      const cacheKey = `countByIncome:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const parents = await this.prisma.parent.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        select: { annualIncome: true }
      });

      const distribution = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        UNKNOWN: 0
      };

      parents.forEach(parent => {
        const range = calculateIncomeRange(parent.annualIncome);
        distribution[range]++;
      });

      await this.setCache(cacheKey, distribution, 3600); // 1 hour
      return distribution;

    } catch (error) {
      logger.error('Get parent count by income range error:', error);
      throw error;
    }
  }

  async getParentCountByEducation(schoolId) {
    try {
      const cacheKey = `countByEducation:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const distribution = await this.prisma.parent.groupBy({
        by: ['education'],
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        _count: { education: true }
      });

      const result = distribution.reduce((acc, item) => {
        acc[item.education || 'UNKNOWN'] = item._count.education;
        return acc;
      }, {});

      await this.setCache(cacheKey, result, 3600); // 1 hour
      return result;

    } catch (error) {
      logger.error('Get parent count by education error:', error);
      throw error;
    }
  }

  async getParentsBySchool(schoolId, include = null) {
    try {
      const cacheKey = `bySchool:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildParentIncludeQuery(include);

      const parents = await this.prisma.parent.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        include: includeObj,
        orderBy: { createdAt: 'desc' }
      });

      const result = parents.map(parent => formatParentResponse(parent, { includeStats: true }));
      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;

    } catch (error) {
      logger.error('Get parents by school error:', error);
      throw error;
    }
  }

  // ======================
  // PARENT PORTAL METHODS
  // ======================

  async getParentStudents(parentId) {
    try {
      console.log('🔍 getParentStudents called with parentId:', parentId);
      
      const cacheKey = `students:${parentId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) {
        console.log('✅ Returning cached students:', cached.length);
        return cached;
      }

      // First, let's verify the parent exists
      const parent = await this.prisma.parent.findFirst({
        where: {
          userId: BigInt(parentId),
          deletedAt: null
        }
      });

      if (!parent) {
        console.log('❌ Parent not found for user ID:', parentId);
        return [];
      }

      console.log('✅ Found parent record:', parent.id);

      // Now find students linked to this parent
      const students = await this.prisma.student.findMany({
        where: {
          parentId: BigInt(parentId),
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true
            }
          },
          class: {
            select: { 
              id: true,
              name: true, 
              level: true,
              section: true
            }
          }
        },
        orderBy: { 
          user: { firstName: 'asc' } 
        }
      });

      console.log('🔍 Found students:', students.length);

      const result = students.map(student => ({
        id: student.id.toString(),
        userId: student.userId.toString(),
        username: student.user?.username || 'Unknown',
        firstName: student.user?.firstName || student.user?.username || 'Unknown',
        lastName: student.user?.lastName || '',
        email: student.user?.email || '',
        admissionNo: student.admissionNo || '',
        rollNo: student.rollNo || '',
        status: student.user?.status || 'ACTIVE',
        class: student.class ? {
          id: student.class.id.toString(),
          name: student.class.name || 'Unknown',
          level: student.class.level || 0,
          section: student.class.section || ''
        } : null,
        parentId: student.parentId.toString()
      }));

      console.log('✅ Processed students:', result.length);
      console.log('📋 Student details:', result);

      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;

    } catch (error) {
      logger.error('Get parent students error:', error);
      console.error('❌ getParentStudents error:', error);
      throw error;
    }
  }

  async getParentStudentAttendance(parentId, studentId, schoolId, filters = {}) {
    try {
      const { startDate, endDate, period } = filters;
      const cacheKey = `attendance:${parentId}:${studentId}:${startDate}:${endDate}:${period}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (startDate && endDate) {
        whereClause.date = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      const attendance = await this.prisma.attendance.findMany({
        where: whereClause,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentId: true }
          },
          class: {
            select: { name: true, grade: true }
          }
        },
        orderBy: { date: 'desc' }
      });

      const result = attendance.map(record => ({
        id: record.id,
        date: record.date,
        status: record.status,
        reason: record.reason,
        student: record.student,
        class: record.class,
        period: record.period
      }));

      await this.setCache(cacheKey, result, 300); // 5 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student attendance error:', error);
      throw error;
    }
  }

  async getParentStudentGrades(parentId, studentId, schoolId, filters = {}) {
    try {
      const { academicYear, term, subject } = filters;
      const cacheKey = `grades:${parentId}:${studentId}:${academicYear}:${term}:${subject}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (academicYear) whereClause.academicYearId = BigInt(academicYear);
      if (term) whereClause.term = term;
      if (subject) whereClause.subjectId = BigInt(subject);

      const grades = await this.prisma.grade.findMany({
        where: whereClause,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentId: true }
          },
          subject: {
            select: { name: true, code: true }
          },
          academicYear: {
            select: { name: true, startDate: true, endDate: true }
          }
        },
        orderBy: [{ academicYearId: 'desc' }, { term: 'asc' }, { subjectId: 'asc' }]
      });

      const result = grades.map(grade => ({
        id: grade.id,
        score: grade.score,
        maxScore: grade.maxScore,
        percentage: grade.percentage,
        grade: grade.grade,
        term: grade.term,
        subject: grade.subject,
        academicYear: grade.academicYear,
        assessmentDate: grade.assessmentDate,
        comments: grade.comments
      }));

      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student grades error:', error);
      throw error;
    }
  }

  async getParentStudentAssignments(parentId, studentId, schoolId, filters = {}) {
    try {
      const { status, subject, dueDate } = filters;
      const cacheKey = `assignments:${parentId}:${studentId}:${status}:${subject}:${dueDate}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (status) whereClause.status = status;
      if (subject) whereClause.subjectId = BigInt(subject);
      if (dueDate) whereClause.dueDate = new Date(dueDate);

      const assignments = await this.prisma.assignment.findMany({
        where: whereClause,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentId: true }
          },
          subject: {
            select: { name: true, code: true }
          },
          class: {
            select: { name: true, grade: true }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      const result = assignments.map(assignment => ({
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.dueDate,
        status: assignment.status,
        score: assignment.score,
        maxScore: assignment.maxScore,
        subject: assignment.subject,
        class: assignment.class,
        assignedDate: assignment.assignedDate,
        submittedDate: assignment.submittedDate
      }));

      await this.setCache(cacheKey, result, 600); // 10 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student assignments error:', error);
      throw error;
    }
  }

  async getParentStudentExams(parentId, studentId, schoolId, filters = {}) {
    try {
      const { academicYear, term, subject } = filters;
      const cacheKey = `exams:${parentId}:${studentId}:${academicYear}:${term}:${subject}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (academicYear) whereClause.academicYearId = BigInt(academicYear);
      if (term) whereClause.term = term;
      if (subject) whereClause.subjectId = BigInt(subject);

      const exams = await this.prisma.exam.findMany({
        where: whereClause,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentId: true }
          },
          subject: {
            select: { name: true, code: true }
          },
          academicYear: {
            select: { name: true, startDate: true, endDate: true }
          }
        },
        orderBy: [{ examDate: 'desc' }, { subjectId: 'asc' }]
      });

      const result = exams.map(exam => ({
        id: exam.id,
        title: exam.title,
        examDate: exam.examDate,
        score: exam.score,
        maxScore: exam.maxScore,
        percentage: exam.percentage,
        grade: exam.grade,
        term: exam.term,
        subject: exam.subject,
        academicYear: exam.academicYear,
        comments: exam.comments
      }));

      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student exams error:', error);
      throw error;
    }
  }

  async getParentStudentTimetable(parentId, studentId, schoolId, filters = {}) {
    try {
      const { weekStart, weekEnd } = filters;
      const cacheKey = `timetable:${parentId}:${studentId}:${weekStart}:${weekEnd}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (weekStart && weekEnd) {
        whereClause.date = {
          gte: new Date(weekStart),
          lte: new Date(weekEnd)
        };
      }

      const timetable = await this.prisma.timetable.findMany({
        where: whereClause,
        include: {
          subject: {
            select: { name: true, code: true }
          },
          teacher: {
            select: { firstName: true, lastName: true }
          },
          class: {
            select: { name: true, grade: true }
          }
        },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }]
      });

      const result = timetable.map(slot => ({
        id: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        subject: slot.subject,
        teacher: slot.teacher,
        class: slot.class,
        room: slot.room,
        dayOfWeek: slot.dayOfWeek
      }));

      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student timetable error:', error);
      throw error;
    }
  }

  async getParentStudentFees(parentId, studentId, schoolId, filters = {}) {
    try {
      const { status, academicYear, term } = filters;
      const cacheKey = `fees:${parentId}:${studentId}:${status}:${academicYear}:${term}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (status) whereClause.status = status;
      if (academicYear) whereClause.academicYearId = BigInt(academicYear);
      if (term) whereClause.term = term;

      const fees = await this.prisma.fee.findMany({
        where: whereClause,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentId: true }
          },
          academicYear: {
            select: { name: true, startDate: true, endDate: true }
          }
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
      });

      const result = fees.map(fee => ({
        id: fee.id,
        description: fee.description,
        amount: fee.amount,
        dueDate: fee.dueDate,
        status: fee.status,
        academicYear: fee.academicYear,
        term: fee.term,
        createdAt: fee.createdAt
      }));

      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student fees error:', error);
      throw error;
    }
  }

  async getParentStudentPayments(parentId, studentId, schoolId, filters = {}) {
    try {
      const { startDate, endDate, status } = filters;
      const cacheKey = `payments:${parentId}:${studentId}:${startDate}:${endDate}:${status}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (startDate && endDate) {
        whereClause.paymentDate = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }
      if (status) whereClause.status = status;

      const payments = await this.prisma.payment.findMany({
        where: whereClause,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentId: true }
          },
          fee: {
            select: { description: true, amount: true }
          }
        },
        orderBy: { paymentDate: 'desc' }
      });

      const result = payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        status: payment.status,
        method: payment.method,
        reference: payment.reference,
        student: payment.student,
        fee: payment.fee,
        createdAt: payment.createdAt
      }));

      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student payments error:', error);
      throw error;
    }
  }

  async getParentStudentReports(parentId, studentId, schoolId, filters = {}) {
    try {
      const { academicYear, term, type } = filters;
      const cacheKey = `reports:${parentId}:${studentId}:${academicYear}:${term}:${type}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (academicYear) whereClause.academicYearId = BigInt(academicYear);
      if (term) whereClause.term = term;
      if (type) whereClause.type = type;

      const reports = await this.prisma.report.findMany({
        where: whereClause,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentId: true }
          },
          academicYear: {
            select: { name: true, startDate: true, endDate: true }
          }
        },
        orderBy: [{ academicYearId: 'desc' }, { term: 'asc' }, { createdAt: 'desc' }]
      });

      const result = reports.map(report => ({
        id: report.id,
        title: report.title,
        content: report.content,
        type: report.type,
        term: report.term,
        academicYear: report.academicYear,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt
      }));

      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student reports error:', error);
      throw error;
    }
  }

  async getParentStudentDocuments(parentId, studentId, schoolId, filters = {}) {
    try {
      const { type, academicYear, subject } = filters;
      const cacheKey = `documents:${parentId}:${studentId}:${type}:${academicYear}:${subject}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        studentId: BigInt(studentId),
        schoolId: BigInt(schoolId)
      };

      if (type) whereClause.type = type;
      if (academicYear) whereClause.academicYearId = BigInt(academicYear);
      if (subject) whereClause.subjectId = BigInt(subject);

      const documents = await this.prisma.document.findMany({
        where: whereClause,
        include: {
          student: {
            select: { firstName: true, lastName: true, studentId: true }
          },
          subject: {
            select: { name: true, code: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const result = documents.map(doc => ({
        id: doc.id,
        title: doc.title,
        description: doc.description,
        type: doc.type,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        fileUrl: doc.fileUrl,
        subject: doc.subject,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
      }));

      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student documents error:', error);
      throw error;
    }
  }

  async getParentStudentAnnouncements(parentId, studentId, schoolId, filters = {}) {
    try {
      const { limit = 10, offset = 0, type } = filters;
      const cacheKey = `announcements:${parentId}:${studentId}:${type}:${limit}:${offset}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        schoolId: BigInt(schoolId),
        OR: [
          { targetAudience: 'ALL' },
          { targetAudience: 'PARENTS' },
          { targetAudience: 'STUDENTS' }
        ]
      };

      if (type) whereClause.type = type;

      const announcements = await this.prisma.announcement.findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: { firstName: true, lastName: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      const result = announcements.map(announcement => ({
        id: announcement.id,
        title: announcement.title,
        content: announcement.content,
        type: announcement.type,
        priority: announcement.priority,
        targetAudience: announcement.targetAudience,
        createdBy: announcement.createdBy,
        createdAt: announcement.createdAt,
        updatedAt: announcement.updatedAt
      }));

      await this.setCache(cacheKey, result, 300); // 5 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student announcements error:', error);
      throw error;
    }
  }

  async getParentStudentMessages(parentId, studentId, schoolId, filters = {}) {
    try {
      const { limit = 10, offset = 0, unreadOnly = false } = filters;
      const cacheKey = `messages:${parentId}:${studentId}:${unreadOnly}:${limit}:${offset}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        OR: [
          { senderId: BigInt(parentId) },
          { recipientId: BigInt(parentId) }
        ],
        schoolId: BigInt(schoolId)
      };

      if (unreadOnly) {
        whereClause.isRead = false;
      }

      const messages = await this.prisma.message.findMany({
        where: whereClause,
        include: {
          sender: {
            select: { firstName: true, lastName: true, role: true }
          },
          recipient: {
            select: { firstName: true, lastName: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      const result = messages.map(message => ({
        id: message.id,
        subject: message.subject,
        content: message.content,
        isRead: message.isRead,
        priority: message.priority,
        sender: message.sender,
        recipient: message.recipient,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt
      }));

      await this.setCache(cacheKey, result, 300); // 5 minutes
      return result;

    } catch (error) {
      logger.error('Get parent student messages error:', error);
      throw error;
    }
  }

  async sendParentMessage(parentId, messageData, userId, schoolId) {
    try {
      const { recipientId, subject, message, priority, attachments } = messageData;

      const result = await this.prisma.message.create({
        data: {
          senderId: BigInt(parentId),
          recipientId: BigInt(recipientId),
          subject,
          content: message,
          priority: priority || 'NORMAL',
          schoolId: BigInt(schoolId),
          attachments: attachments || []
        }
      });

      // Invalidate message cache
      await this.deleteCache(`messages:${parentId}:*`);

      return result;

    } catch (error) {
      logger.error('Send parent message error:', error);
      throw error;
    }
  }

  async getParentNotifications(parentId, schoolId, filters = {}) {
    try {
      const { limit = 10, offset = 0, unreadOnly = false, type } = filters;
      const cacheKey = `notifications:${parentId}:${unreadOnly}:${type}:${limit}:${offset}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        recipientId: BigInt(parentId),
        schoolId: BigInt(schoolId)
      };

      if (unreadOnly) whereClause.isRead = false;
      if (type) whereClause.type = type;

      const notifications = await this.prisma.notification.findMany({
        where: whereClause,
        include: {
          sender: {
            select: { firstName: true, lastName: true, role: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      const result = notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        content: notification.content,
        type: notification.type,
        isRead: notification.isRead,
        sender: notification.sender,
        createdAt: notification.createdAt,
        updatedAt: notification.updatedAt
      }));

      await this.setCache(cacheKey, result, 300); // 5 minutes
      return result;

    } catch (error) {
      logger.error('Get parent notifications error:', error);
      throw error;
    }
  }

  async markParentNotificationAsRead(parentId, notificationId, schoolId) {
    try {
      const result = await this.prisma.notification.update({
        where: {
          id: BigInt(notificationId),
          recipientId: BigInt(parentId),
          schoolId: BigInt(schoolId)
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      // Invalidate notification cache
      await this.deleteCache(`notifications:${parentId}:*`);

      return result;

    } catch (error) {
      logger.error('Mark parent notification as read error:', error);
      throw error;
    }
  }

  async getParentCalendar(parentId, schoolId, filters = {}) {
    try {
      const { startDate, endDate, type } = filters;
      const cacheKey = `calendar:${parentId}:${startDate}:${endDate}:${type}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        schoolId: BigInt(schoolId),
        OR: [
          { targetAudience: 'ALL' },
          { targetAudience: 'PARENTS' }
        ]
      };

      if (startDate && endDate) {
        whereClause.date = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }
      if (type) whereClause.type = type;

      const events = await this.prisma.event.findMany({
        where: whereClause,
        include: {
          createdBy: {
            select: { firstName: true, lastName: true, role: true }
          }
        },
        orderBy: { date: 'asc' }
      });

      const result = events.map(event => ({
        id: event.id,
        title: event.title,
        description: event.description,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        type: event.type,
        location: event.location,
        createdBy: event.createdBy
      }));

      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;

    } catch (error) {
      logger.error('Get parent calendar error:', error);
      throw error;
    }
  }

  async getParentSettings(parentId, schoolId) {
    try {
      const cacheKey = `settings:${parentId}:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const parent = await this.prisma.parent.findUnique({
        where: {
          id: BigInt(parentId),
          schoolId: BigInt(schoolId)
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          preferences: true,
          notificationSettings: true,
          privacySettings: true
        }
      });

      if (!parent) {
        throw new Error('Parent not found');
      }

      const result = {
        ...parent,
        preferences: parent.preferences || {},
        notificationSettings: parent.notificationSettings || {},
        privacySettings: parent.privacySettings || {}
      };

      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;

    } catch (error) {
      logger.error('Get parent settings error:', error);
      throw error;
    }
  }

  async updateParentSettings(parentId, updateData, userId, schoolId) {
    try {
      const { preferences, notificationSettings, privacySettings } = updateData;

      const result = await this.prisma.parent.update({
        where: {
          id: BigInt(parentId),
          schoolId: BigInt(schoolId)
        },
        data: {
          preferences: preferences || {},
          notificationSettings: notificationSettings || {},
          privacySettings: privacySettings || {},
          updatedAt: new Date(),
          updatedBy: BigInt(userId)
        }
      });

      // Invalidate settings cache
      await this.deleteCache(`settings:${parentId}:${schoolId}`);

      return result;

    } catch (error) {
      logger.error('Update parent settings error:', error);
      throw error;
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  async getCacheStats() {
    try {
      const keys = await redisClient.keys(`${this.cachePrefix}:*`);
      const stats = {
        totalKeys: keys.length,
        memoryUsage: await redisClient.memory('usage'),
        hitRate: await redisClient.info('stats').then(info => {
          const lines = info.split('\r\n');
          const hits = lines.find(line => line.startsWith('keyspace_hits:'))?.split(':')[1] || 0;
          const misses = lines.find(line => line.startsWith('keyspace_misses:'))?.split(':')[1] || 0;
          return hits / (parseInt(hits) + parseInt(misses)) * 100;
        })
      };

      return stats;

    } catch (error) {
      logger.error('Get cache stats error:', error);
      throw error;
    }
  }

  async warmCache(schoolId, parentId = null) {
    try {
      if (parentId) {
        // Warm specific parent cache
        await this.getParentById(parentId, schoolId, 'students,payments,school');
        await this.getParentStats(parentId, schoolId);
        await this.getParentAnalytics(parentId, schoolId, '30d');
        await this.getParentPerformance(parentId, schoolId);
      } else {
        // Warm all parents cache for school
        await this.getParents({ page: 1, limit: 50 }, schoolId, 'students,payments,school');
        await this.getParentCountByIncomeRange(schoolId);
        await this.getParentCountByEducation(schoolId);
        await this.getParentsBySchool(schoolId, 'students,payments,school');
      }

      return { success: true, message: 'Cache warmed successfully' };

    } catch (error) {
      logger.error('Warm cache error:', error);
      throw error;
    }
  }

  async clearCache(schoolId = null) {
    try {
      if (schoolId) {
        await this.deleteCache(`*:school:${schoolId}`);
      } else {
        await this.deleteCache('*');
      }

      return { success: true, message: 'Cache cleared successfully' };

    } catch (error) {
      logger.error('Clear cache error:', error);
      throw error;
    }
  }
}

export default new ParentService(); 

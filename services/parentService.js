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

      const [parent, students, payments] = await Promise.all([
        this.prisma.parent.findFirst({
          where: { id: parentId, schoolId: BigInt(schoolId), deletedAt: null },
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
          where: { parentId, schoolId: BigInt(schoolId), deletedAt: null }
        }),
        this.prisma.payment.findMany({
          where: { parentId, schoolId },
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
          parentId,
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

      const [parent, students, payments] = await Promise.all([
        this.prisma.parent.findFirst({
          where: { id: parentId, schoolId: BigInt(schoolId), deletedAt: null },
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
          where: { parentId, schoolId: BigInt(schoolId), deletedAt: null },
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
          where: { parentId, schoolId },
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
          studentId: student.id,
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
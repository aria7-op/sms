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
  buildStaffSearchQuery,
  buildStaffIncludeQuery,
  formatStaffResponse,
  validateStaffData,
  generateEmployeeId,
  calculateSalaryRange,
  calculateExperience,
  validateStaffPermissions,
  generateStaffReport
} from '../utils/staffUtils.js';
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

class StaffService {
  constructor() {
    this.cachePrefix = 'staff';
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

  async invalidateStaffCache(staffId, schoolId) {
    await Promise.all([
      this.deleteCache(`*:${staffId}`),
      this.deleteCache(`*:school:${schoolId}`),
      this.deleteCache('*:stats*'),
      this.deleteCache('*:analytics*')
    ]);
  }

  // ======================
  // CRUD OPERATIONS
  // ======================

  async createStaff(data, userId, schoolId) {
    try {
      if (schoolId === undefined || schoolId === null) {
        throw new Error('School ID is required to create staff.');
      }
      // Validate data
      const validationErrors = await validateStaffData(data, schoolId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Generate password hash and salt
      const salt = generateSalt();
      const hashedPassword = await hashPassword(data.password, salt);

      // Generate employee ID if not provided
      if (!data.employeeId) {
        data.employeeId = await generateEmployeeId(schoolId, data.designation);
      }

      // Create user and staff in transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // Create user
        const user = await tx.user.create({
          data: {
            uuid: generateUUID(),
            username: data.username,
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
            role: 'STAFF',
            status: 'ACTIVE',
            timezone: data.timezone || 'UTC',
            locale: data.locale || 'en-US',
            metadata: data.metadata || {},
            schoolId,
            createdByOwnerId: userId,
            createdBy: userId
          }
        });

        // Create staff
        const staff = await tx.staff.create({
          data: {
            uuid: generateUUID(),
            userId: user.id,
            employeeId: data.employeeId.toUpperCase(),
            departmentId: data.departmentId,
            designation: sanitizeString(data.designation),
            joiningDate: data.joiningDate ? new Date(data.joiningDate) : null,
            salary: data.salary ? parseFloat(data.salary) : null,
            accountNumber: data.accountNumber,
            bankName: data.bankName ? sanitizeString(data.bankName) : null,
            ifscCode: data.ifscCode ? data.ifscCode.toUpperCase() : null,
            schoolId,
            createdBy: userId
          },
          include: {
            user: true,
            department: true,
            attendances: true,
            payrolls: true,
            documents: true,
            bookIssues: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        });

        return staff;
      });

      // Invalidate cache
      await this.invalidateStaffCache(result.id, schoolId);

      // Create audit log
      await createAuditLog({
        action: 'CREATE',
        entityType: 'Staff',
        entityId: result.id,
        userId,
        schoolId,
        oldData: null,
        newData: {
          staffId: result.id,
          employeeId: result.employeeId,
          email: result.user.email,
          name: `${result.user.firstName} ${result.user.lastName}`
        }
      });

      logger.info(`Staff created: ${result.id} by user: ${userId}`);
      return formatStaffResponse(result, true);

    } catch (error) {
      logger.error('Create staff error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaff(filters, schoolId, include = null) {
    try {
      logger.info('getStaff: start', { filters, schoolId, include });
      // Minimal test query to debug hanging
      const staff = await this.prisma.staff.findMany({ take: 1 });
      logger.info('STAFF TEST:', staff);
      return {
        staff,
        pagination: { page: 1, limit: 1, total: staff.length, pages: 1, hasNext: false, hasPrev: false }
      };
      // --- original code below (commented out for test) ---
      /*
      const cacheKey = `list:${JSON.stringify(filters)}:${schoolId}:${include}`;
      // const cached = await this.getFromCache(cacheKey);
      // logger.info('getStaff: after cache check');
      // if (cached) return cached;
      // ... rest of original code ...
      */
    } catch (error) {
      logger.error('Get staff error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffById(staffId, schoolId, include = null) {
    try {
      logger.info('getStaffById: start', { staffId, schoolId, include });
      const cacheKey = `byId:${staffId}:${include}`;
      // const cached = await this.getFromCache(cacheKey);
      // logger.info('getStaffById: after cache check');
      // if (cached) return cached;

      const includeObj = buildStaffIncludeQuery(include);
      logger.info('getStaffById: built includeObj', { includeObj });

      let staff;
      try {
        staff = await this.prisma.staff.findFirst({
          where: {
            id: staffId,
            schoolId,
            deletedAt: null
          },
          include: includeObj
        });
        logger.info('getStaffById: after prisma query');
      } catch (prismaError) {
        logger.error('Prisma error in getStaffById:', prismaError);
        throw new Error('Failed to fetch staff. Please check your include parameters and try again.');
      }

      if (!staff) {
        throw new Error('Staff not found');
      }

      const result = formatStaffResponse(staff, true);
      logger.info('getStaffById: after formatting');
      // await this.setCache(cacheKey, result);
      logger.info('getStaffById: after setCache (bypassed)');
      return result;

    } catch (error) {
      logger.error('Get staff by ID error:', error);
      throw handlePrismaError(error);
    }
  }

  async updateStaff(staffId, data, userId, schoolId) {
    try {
      // Check if staff exists and user has permission
      const existingStaff = await this.prisma.staff.findFirst({
        where: { id: staffId, schoolId, deletedAt: null },
        include: { user: true }
      });

      if (!existingStaff) {
        throw new Error('Staff not found');
      }

      // Validate permissions
      const hasPermission = await validateStaffPermissions(staffId, userId, schoolId);
      if (!hasPermission) {
        throw new Error('Insufficient permissions');
      }

      // Validate data
      const validationErrors = await validateStaffData(data, schoolId, existingStaff.userId);
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
            where: { id: existingStaff.userId },
            data: userData
          });
        }

        // Update staff
        const staffData = {};
        if (data.employeeId) staffData.employeeId = data.employeeId.toUpperCase();
        if (data.departmentId !== undefined) staffData.departmentId = data.departmentId;
        if (data.designation) staffData.designation = sanitizeString(data.designation);
        if (data.joiningDate !== undefined) staffData.joiningDate = data.joiningDate ? new Date(data.joiningDate) : null;
        if (data.salary !== undefined) staffData.salary = data.salary ? parseFloat(data.salary) : null;
        if (data.accountNumber !== undefined) staffData.accountNumber = data.accountNumber;
        if (data.bankName !== undefined) staffData.bankName = data.bankName ? sanitizeString(data.bankName) : null;
        if (data.ifscCode !== undefined) staffData.ifscCode = data.ifscCode ? data.ifscCode.toUpperCase() : null;
        staffData.updatedBy = userId;

        const staff = await tx.staff.update({
          where: { id: staffId },
          data: staffData,
          include: {
            user: true,
            department: true,
            attendances: true,
            payrolls: true,
            documents: true,
            bookIssues: true,
            school: {
              select: {
                id: true,
                name: true,
                code: true
              }
            }
          }
        });

        return staff;
      });

      // Invalidate cache
      await this.invalidateStaffCache(staffId, schoolId);

      // Create audit log
      await createAuditLog({
        action: 'UPDATE',
        entityType: 'Staff',
        entityId: staffId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          staffId,
          employeeId: result.employeeId,
          email: result.user.email,
          name: `${result.user.firstName} ${result.user.lastName}`,
          changes: data
        }
      });

      logger.info(`Staff updated: ${staffId} by user: ${userId}`);
      return formatStaffResponse(result, true);

    } catch (error) {
      logger.error('Update staff error:', error);
      throw handlePrismaError(error);
    }
  }

  async deleteStaff(staffId, userId, schoolId) {
    try {
      const staff = await this.prisma.staff.findFirst({
        where: { id: staffId, schoolId, deletedAt: null },
        include: { user: true }
      });

      if (!staff) {
        throw new Error('Staff not found');
      }

      // Check if staff has active responsibilities
      const activeAttendances = await this.prisma.attendance.count({
        where: {
          staffId,
          schoolId,
          date: { gte: new Date() }
        }
      });

      if (activeAttendances > 0) {
        throw new Error(`Cannot delete staff with ${activeAttendances} active attendance records. Please handle attendance records first.`);
      }

      // Soft delete
      await this.prisma.$transaction(async (tx) => {
        await tx.staff.update({
          where: { id: staffId },
          data: {
            deletedAt: new Date(),
            updatedBy: userId
          }
        });

        await tx.user.update({
          where: { id: staff.userId },
          data: {
            status: 'INACTIVE',
            updatedBy: userId
          }
        });
      });

      // Invalidate cache
      await this.invalidateStaffCache(staffId, schoolId);

      // Create audit log
      await createAuditLog({
        action: 'DELETE',
        entityType: 'Staff',
        entityId: staffId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          staffId,
          employeeId: staff.employeeId,
          email: staff.user.email,
          name: `${staff.user.firstName} ${staff.user.lastName}`
        }
      });

      logger.info(`Staff deleted: ${staffId} by user: ${userId}`);
      return { success: true, message: 'Staff deleted successfully' };

    } catch (error) {
      logger.error('Delete staff error:', error);
      throw handlePrismaError(error);
    }
  }

  async restoreStaff(staffId, userId, schoolId) {
    try {
      const staff = await this.prisma.staff.findFirst({
        where: { id: staffId, schoolId },
        include: { user: true }
      });

      if (!staff) {
        throw new Error('Staff not found');
      }

      if (!staff.deletedAt) {
        throw new Error('Staff is not deleted');
      }

      // Restore
      await this.prisma.$transaction(async (tx) => {
        await tx.staff.update({
          where: { id: staffId },
          data: {
            deletedAt: null,
            updatedBy: userId
          }
        });

        await tx.user.update({
          where: { id: staff.userId },
          data: {
            status: 'ACTIVE',
            updatedBy: userId
          }
        });
      });

      // Invalidate cache
      await this.invalidateStaffCache(staffId, schoolId);

      // Create audit log
      await createAuditLog({
        action: 'RESTORE',
        entityType: 'Staff',
        entityId: staffId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          staffId,
          employeeId: staff.employeeId,
          email: staff.user.email,
          name: `${staff.user.firstName} ${staff.user.lastName}`
        }
      });

      logger.info(`Staff restored: ${staffId} by user: ${userId}`);
      return { success: true, message: 'Staff restored successfully' };

    } catch (error) {
      logger.error('Restore staff error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateStaff(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const staffData of data.staff) {
        try {
          const result = await this.createStaff(staffData, userId, schoolId);
          results.push(result);
        } catch (error) {
          errors.push({
            data: staffData,
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
      logger.error('Bulk create staff error:', error);
      throw handlePrismaError(error);
    }
  }

  async bulkUpdateStaff(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const update of data.updates) {
        try {
          const result = await this.updateStaff(update.id, update.data, userId, schoolId);
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
      logger.error('Bulk update staff error:', error);
      throw handlePrismaError(error);
    }
  }

  async bulkDeleteStaff(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const staffId of data.staffIds) {
        try {
          const result = await this.deleteStaff(staffId, userId, schoolId);
          results.push({ id: staffId, ...result });
        } catch (error) {
          errors.push({
            id: staffId,
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
      logger.error('Bulk delete staff error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getStaffStats(staffId, schoolId) {
    try {
      const cacheKey = `stats:${staffId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const [staff, attendances, payrolls] = await Promise.all([
        this.prisma.staff.findFirst({
          where: { id: staffId, schoolId, deletedAt: null },
          include: {
            user: true,
            department: true,
            attendances: {
              select: {
                date: true,
                status: true,
                remarks: true
              }
            },
            payrolls: {
              select: {
                month: true,
                year: true,
                basicSalary: true,
                allowances: true,
                deductions: true,
                netSalary: true,
                status: true,
                paymentDate: true
              }
            }
          }
        }),
        this.prisma.attendance.count({
          where: { staffId, schoolId }
        }),
        this.prisma.payroll.count({
          where: { staffId, schoolId }
        })
      ]);

      if (!staff) {
        throw new Error('Staff not found');
      }

      const stats = {
        staffId,
        experience: calculateExperience(staff.joiningDate),
        salaryRange: calculateSalaryRange(staff.salary),
        totalAttendances: attendances,
        totalPayrolls: payrolls,
        totalEarnings: staff.payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0),
        averageSalary: staff.payrolls.length > 0 ? staff.payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0) / staff.payrolls.length : 0,
        attendanceHistory: {
          PRESENT: staff.attendances.filter(a => a.status === 'PRESENT').length,
          ABSENT: staff.attendances.filter(a => a.status === 'ABSENT').length,
          LATE: staff.attendances.filter(a => a.status === 'LATE').length,
          EXCUSED: staff.attendances.filter(a => a.status === 'EXCUSED').length,
          HALF_DAY: staff.attendances.filter(a => a.status === 'HALF_DAY').length
        },
        payrollHistory: {
          PAID: staff.payrolls.filter(p => p.status === 'PAID').length,
          PENDING: staff.payrolls.filter(p => p.status === 'PENDING').length,
          PROCESSING: staff.payrolls.filter(p => p.status === 'PROCESSING').length
        },
        lastAttendance: staff.attendances.length > 0 ? staff.attendances.sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null,
        lastPayroll: staff.payrolls.length > 0 ? staff.payrolls.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate))[0] : null
      };

      await this.setCache(cacheKey, stats, 900); // 15 minutes
      return stats;

    } catch (error) {
      logger.error('Get staff stats error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffAnalytics(staffId, schoolId, period = '30d') {
    try {
      const cacheKey = `analytics:${staffId}:${period}`;
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

      const [attendances, payrolls] = await Promise.all([
        this.prisma.attendance.findMany({
          where: {
            staffId,
            schoolId,
            date: {
              gte: startDate,
              lte: now
            }
          },
          select: {
            date: true,
            status: true,
            remarks: true
          },
          orderBy: { date: 'asc' }
        }),
        this.prisma.payroll.findMany({
          where: {
            staffId,
            schoolId,
            paymentDate: {
              gte: startDate,
              lte: now
            }
          },
          select: {
            month: true,
            year: true,
            netSalary: true,
            status: true,
            paymentDate: true
          },
          orderBy: { paymentDate: 'asc' }
        })
      ]);

      // Group attendances by date
      const dailyAttendances = {};
      attendances.forEach(attendance => {
        const date = attendance.date.toISOString().split('T')[0];
        if (!dailyAttendances[date]) {
          dailyAttendances[date] = {
            total: 0,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            halfDay: 0
          };
        }
        dailyAttendances[date].total += 1;
        dailyAttendances[date][attendance.status.toLowerCase()] += 1;
      });

      const analytics = {
        period,
        startDate,
        endDate: now,
        totalAttendances: attendances.length,
        totalPayrolls: payrolls.length,
        totalEarnings: payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0),
        averageEarnings: payrolls.length > 0 ? payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0) / payrolls.length : 0,
        attendanceRate: attendances.length > 0 ? (attendances.filter(a => a.status === 'PRESENT').length / attendances.length * 100).toFixed(2) : 0,
        dailyAttendances,
        statusDistribution: attendances.reduce((acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        }, {}),
        payrollDistribution: payrolls.reduce((acc, p) => {
          acc[p.status] = (acc[p.status] || 0) + 1;
          return acc;
        }, {})
      };

      await this.setCache(cacheKey, analytics, 1800); // 30 minutes
      return analytics;

    } catch (error) {
      logger.error('Get staff analytics error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffPerformance(staffId, schoolId) {
    try {
      const cacheKey = `performance:${staffId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const [staff, attendances, payrolls] = await Promise.all([
        this.prisma.staff.findFirst({
          where: { id: staffId, schoolId, deletedAt: null },
          include: {
            user: true,
            department: true,
            attendances: {
              select: {
                date: true,
                status: true,
                remarks: true
              }
            }
          }
        }),
        this.prisma.attendance.findMany({
          where: { staffId, schoolId },
          select: {
            date: true,
            status: true
          }
        }),
        this.prisma.payroll.findMany({
          where: { staffId, schoolId },
          select: {
            month: true,
            year: true,
            netSalary: true,
            status: true
          }
        })
      ]);

      if (!staff) {
        throw new Error('Staff not found');
      }

      // Calculate attendance performance
      const totalDays = attendances.length;
      const presentDays = attendances.filter(a => a.status === 'PRESENT').length;
      const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 100;

      // Calculate financial performance
      const totalEarnings = payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0);
      const averageEarnings = payrolls.length > 0 ? totalEarnings / payrolls.length : 0;

      const performance = {
        staffId,
        staffName: `${staff.user.firstName} ${staff.user.lastName}`,
        employeeId: staff.employeeId,
        department: staff.department?.name || 'No Department',
        attendancePerformance: {
          totalDays,
          presentDays,
          attendanceRate,
          status: attendanceRate >= 95 ? 'EXCELLENT' : attendanceRate >= 85 ? 'GOOD' : attendanceRate >= 75 ? 'AVERAGE' : 'NEEDS_IMPROVEMENT'
        },
        financialPerformance: {
          totalEarnings,
          averageEarnings,
          payrollCount: payrolls.length,
          status: averageEarnings >= 50000 ? 'EXCELLENT' : averageEarnings >= 35000 ? 'GOOD' : averageEarnings >= 25000 ? 'AVERAGE' : 'NEEDS_IMPROVEMENT'
        },
        overallPerformance: {
          experience: calculateExperience(staff.joiningDate),
          salaryRange: calculateSalaryRange(staff.salary),
          combinedScore: (attendanceRate * 0.6 + (averageEarnings / 1000) * 0.4).toFixed(2)
        }
      };

      await this.setCache(cacheKey, performance, 3600); // 1 hour
      return performance;

    } catch (error) {
      logger.error('Get staff performance error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  async searchStaff(query, schoolId, include = null) {
    try {
      const cacheKey = `search:${query}:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildStaffIncludeQuery(include);

      const staff = await this.prisma.staff.findMany({
        where: {
          schoolId,
          deletedAt: null,
          OR: [
            { user: { firstName: { contains: query, mode: 'insensitive' } } },
            { user: { lastName: { contains: query, mode: 'insensitive' } } },
            { user: { email: { contains: query, mode: 'insensitive' } } },
            { user: { phone: { contains: query, mode: 'insensitive' } } },
            { employeeId: { contains: query, mode: 'insensitive' } },
            { designation: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: includeObj,
        take: 20
      });

      const result = staff.map(staff => formatStaffResponse(staff, true));
      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;

    } catch (error) {
      logger.error('Search staff error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  async exportStaff(filters, schoolId, format = 'json') {
    try {
      const where = buildStaffSearchQuery(filters, schoolId);
      const includeObj = buildStaffIncludeQuery('department,attendances,payrolls,school');

      const staff = await this.prisma.staff.findMany({
        where,
        include: includeObj
      });

      const data = staff.map(staff => formatStaffResponse(staff, true));

      if (format === 'csv') {
        // Convert to CSV format
        const headers = ['ID', 'UUID', 'Employee ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Designation', 'Department', 'Salary', 'Joining Date', 'Experience', 'Attendance Count', 'Payroll Count', 'Total Earnings', 'Created At'];
        const csvData = data.map(staff => [
          staff.id,
          staff.uuid,
          staff.employeeId,
          staff.user.firstName,
          staff.user.lastName,
          staff.user.email,
          staff.user.phone,
          staff.designation,
          staff.department?.name || 'No Department',
          staff.salary,
          staff.joiningDate,
          staff.stats.experience,
          staff.stats.totalAttendances,
          staff.stats.totalPayrolls,
          staff.stats.totalEarnings,
          staff.createdAt
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
      logger.error('Export staff error:', error);
      throw handlePrismaError(error);
    }
  }

  async importStaff(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const staffData of data.staff) {
        try {
          const result = await this.createStaff(staffData, userId, schoolId);
          results.push(result);
        } catch (error) {
          errors.push({
            data: staffData,
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
      logger.error('Import staff error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  async generateEmployeeIdSuggestions(designation, schoolId) {
    try {
      const suggestions = [];
      const prefix = designation.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
      
      for (let i = 1; i <= 5; i++) {
        const employeeId = `${prefix}${String(i).padStart(4, '0')}`;
        const exists = await this.prisma.staff.findFirst({
          where: {
            schoolId,
            employeeId
          }
        });
        
        if (!exists) {
          suggestions.push(employeeId);
        }
      }

      return suggestions;

    } catch (error) {
      logger.error('Generate employee ID suggestions error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffCountByDepartment(schoolId) {
    try {
      const cacheKey = `countByDepartment:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const distribution = await this.prisma.staff.groupBy({
        by: ['departmentId'],
        where: { schoolId, deletedAt: null },
        _count: { departmentId: true }
      });

      const departments = await this.prisma.department.findMany({
        where: { schoolId },
        select: { id: true, name: true, code: true }
      });

      const result = distribution.reduce((acc, item) => {
        const dept = departments.find(d => d.id === item.departmentId);
        const deptName = dept ? dept.name : 'No Department';
        acc[deptName] = item._count.departmentId;
        return acc;
      }, {});

      await this.setCache(cacheKey, result, 3600); // 1 hour
      return result;

    } catch (error) {
      logger.error('Get staff count by department error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffCountByDesignation(schoolId) {
    try {
      const cacheKey = `countByDesignation:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const distribution = await this.prisma.staff.groupBy({
        by: ['designation'],
        where: { schoolId, deletedAt: null },
        _count: { designation: true }
      });

      const result = distribution.reduce((acc, item) => {
        acc[item.designation] = item._count.designation;
        return acc;
      }, {});

      await this.setCache(cacheKey, result, 3600); // 1 hour
      return result;

    } catch (error) {
      logger.error('Get staff count by designation error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffBySchool(schoolId, include = null) {
    try {
      const cacheKey = `bySchool:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildStaffIncludeQuery(include);

      const staff = await this.prisma.staff.findMany({
        where: { schoolId, deletedAt: null },
        include: includeObj,
        orderBy: { createdAt: 'desc' }
      });

      const result = staff.map(staff => formatStaffResponse(staff, true));
      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;

    } catch (error) {
      logger.error('Get staff by school error:', error);
      throw handlePrismaError(error);
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
          const total = parseInt(hits) + parseInt(misses);
          return total > 0 ? (parseInt(hits) / total * 100).toFixed(2) : 0;
        }),
        keyTypes: {
          byId: keys.filter(key => key.includes(':byId:')).length,
          list: keys.filter(key => key.includes(':list:')).length,
          stats: keys.filter(key => key.includes(':stats:')).length,
          analytics: keys.filter(key => key.includes(':analytics:')).length,
          performance: keys.filter(key => key.includes(':performance:')).length,
          search: keys.filter(key => key.includes(':search:')).length,
          bySchool: keys.filter(key => key.includes(':bySchool:')).length,
          countByDepartment: keys.filter(key => key.includes(':countByDepartment:')).length,
          countByDesignation: keys.filter(key => key.includes(':countByDesignation:')).length
        }
      };

      return stats;
    } catch (error) {
      logger.error('Get staff cache stats error:', error);
      throw error;
    }
  }

  async warmCache(schoolId, staffId = null) {
    try {
      if (staffId) {
        // Warm specific staff cache
        await this.getStaffById(staffId, schoolId, 'department,attendances,payrolls,school');
        await this.getStaffStats(staffId, schoolId);
        await this.getStaffAnalytics(staffId, schoolId, '30d');
        await this.getStaffPerformance(staffId, schoolId);
      } else {
        // Warm school-level cache
        await this.getStaff({ page: 1, limit: 50 }, schoolId, 'department,attendances,payrolls,school');
        await this.getStaffCountByDepartment(schoolId);
        await this.getStaffCountByDesignation(schoolId);
        await this.getStaffBySchool(schoolId, 'department,attendances,payrolls,school');
      }

      return { success: true, message: 'Staff cache warmed successfully' };

    } catch (error) {
      logger.error('Warm staff cache error:', error);
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

      return { success: true, message: 'Staff cache cleared successfully' };

    } catch (error) {
      logger.error('Clear staff cache error:', error);
      throw error;
    }
  }

  async getStaffByDepartment(departmentId, schoolId) {
    try {
      const staff = await this.prisma.staff.findMany({
        where: {
          departmentId,
          schoolId,
          deletedAt: null
        },
        include: {
          user: true,
          department: true,
          attendances: true,
          payrolls: true,
          documents: true,
          bookIssues: true,
          school: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return staff.map(staff => formatStaffResponse(staff, true));
    } catch (error) {
      logger.error('Get staff by department error:', error);
      throw error;
    }
  }

  // ======================
  // COLLABORATION METHODS
  // ======================

  async getStaffCollaboration(staffId, schoolId) {
    try {
      const cacheKey = `collaboration:${staffId}:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const collaboration = await this.prisma.staffCollaboration.findMany({
        where: {
          staffId: parseInt(staffId),
          staff: { schoolId }
        },
        include: {
          projects: true,
          teams: true,
          meetings: true
        },
        orderBy: { createdAt: 'desc' }
      });

      await this.setCache(cacheKey, collaboration, 1800); // 30 minutes
      return collaboration;

    } catch (error) {
      logger.error('Get staff collaboration error:', error);
      throw handlePrismaError(error);
    }
  }

  async createStaffCollaboration(staffId, data, userId, schoolId) {
    try {
      const collaboration = await this.prisma.staffCollaboration.create({
        data: {
          staffId: parseInt(staffId),
          type: data.type,
          title: data.title,
          description: data.description,
          status: data.status || 'ACTIVE',
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          metadata: data.metadata || {},
          createdBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return collaboration;

    } catch (error) {
      logger.error('Create staff collaboration error:', error);
      throw handlePrismaError(error);
    }
  }

  async updateStaffCollaboration(staffId, collaborationId, data, userId, schoolId) {
    try {
      const collaboration = await this.prisma.staffCollaboration.update({
        where: {
          id: parseInt(collaborationId),
          staffId: parseInt(staffId)
        },
        data: {
          type: data.type,
          title: data.title,
          description: data.description,
          status: data.status,
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          metadata: data.metadata,
          updatedBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return collaboration;

    } catch (error) {
      logger.error('Update staff collaboration error:', error);
      throw handlePrismaError(error);
    }
  }

  async deleteStaffCollaboration(staffId, collaborationId, userId, schoolId) {
    try {
      await this.prisma.staffCollaboration.delete({
        where: {
          id: parseInt(collaborationId),
          staffId: parseInt(staffId)
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return { success: true, message: 'Collaboration deleted successfully' };

    } catch (error) {
      logger.error('Delete staff collaboration error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffProjects(staffId, schoolId) {
    try {
      const cacheKey = `projects:${staffId}:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const projects = await this.prisma.staffProject.findMany({
        where: {
          staffId: parseInt(staffId),
          staff: { schoolId }
        },
        include: {
          team: {
            include: {
              members: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      await this.setCache(cacheKey, projects, 1800); // 30 minutes
      return projects;

    } catch (error) {
      logger.error('Get staff projects error:', error);
      throw handlePrismaError(error);
    }
  }

  async createStaffProject(staffId, data, userId, schoolId) {
    try {
      const project = await this.prisma.staffProject.create({
        data: {
          staffId: parseInt(staffId),
          name: data.name,
          description: data.description,
          status: data.status || 'PLANNING',
          priority: data.priority || 'MEDIUM',
          startDate: data.startDate ? new Date(data.startDate) : null,
          endDate: data.endDate ? new Date(data.endDate) : null,
          budget: data.budget ? parseFloat(data.budget) : null,
          metadata: data.metadata || {},
          createdBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return project;

    } catch (error) {
      logger.error('Create staff project error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffTeams(staffId, schoolId) {
    try {
      const cacheKey = `teams:${staffId}:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const teams = await this.prisma.staffTeam.findMany({
        where: {
          members: {
            some: {
              staffId: parseInt(staffId)
            }
          },
          staff: { schoolId }
        },
        include: {
          members: {
            include: {
              staff: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      await this.setCache(cacheKey, teams, 1800); // 30 minutes
      return teams;

    } catch (error) {
      logger.error('Get staff teams error:', error);
      throw handlePrismaError(error);
    }
  }

  async assignStaffToTeam(staffId, data, userId, schoolId) {
    try {
      const teamMember = await this.prisma.staffTeamMember.create({
        data: {
          staffId: parseInt(staffId),
          teamId: parseInt(data.teamId),
          role: data.role || 'MEMBER',
          joinedAt: new Date(),
          createdBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          },
          team: true
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return teamMember;

    } catch (error) {
      logger.error('Assign staff to team error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffMeetings(staffId, schoolId) {
    try {
      const cacheKey = `meetings:${staffId}:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const meetings = await this.prisma.staffMeeting.findMany({
        where: {
          participants: {
            some: {
              staffId: parseInt(staffId)
            }
          },
          staff: { schoolId }
        },
        include: {
          participants: {
            include: {
              staff: {
                include: {
                  user: true
                }
              }
            }
          }
        },
        orderBy: { scheduledAt: 'desc' }
      });

      await this.setCache(cacheKey, meetings, 1800); // 30 minutes
      return meetings;

    } catch (error) {
      logger.error('Get staff meetings error:', error);
      throw handlePrismaError(error);
    }
  }

  async scheduleStaffMeeting(staffId, data, userId, schoolId) {
    try {
      const meeting = await this.prisma.staffMeeting.create({
        data: {
          staffId: parseInt(staffId),
          title: data.title,
          description: data.description,
          scheduledAt: new Date(data.scheduledAt),
          duration: parseInt(data.duration) || 60,
          location: data.location,
          type: data.type || 'IN_PERSON',
          status: data.status || 'SCHEDULED',
          metadata: data.metadata || {},
          createdBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return meeting;

    } catch (error) {
      logger.error('Schedule staff meeting error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // DOCUMENTS METHODS
  // ======================

  async getStaffDocuments(staffId, schoolId, filters = {}) {
    try {
      const cacheKey = `documents:${staffId}:${schoolId}:${JSON.stringify(filters)}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        staffId: parseInt(staffId),
        staff: { schoolId }
      };

      if (filters.category) {
        whereClause.category = filters.category;
      }

      if (filters.status) {
        whereClause.status = filters.status;
      }

      const documents = await this.prisma.staffDocument.findMany({
        where: whereClause,
        include: {
          staff: {
            include: {
              user: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      await this.setCache(cacheKey, documents, 1800); // 30 minutes
      return documents;

    } catch (error) {
      logger.error('Get staff documents error:', error);
      throw handlePrismaError(error);
    }
  }

  async uploadStaffDocument(staffId, data, file, userId, schoolId) {
    try {
      const document = await this.prisma.staffDocument.create({
        data: {
          staffId: parseInt(staffId),
          title: data.title,
          description: data.description,
          category: data.category,
          filePath: file.path,
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          status: data.status || 'PENDING',
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          metadata: data.metadata || {},
          createdBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return document;

    } catch (error) {
      logger.error('Upload staff document error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffDocument(staffId, documentId, schoolId) {
    try {
      const document = await this.prisma.staffDocument.findFirst({
        where: {
          id: parseInt(documentId),
          staffId: parseInt(staffId),
          staff: { schoolId }
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        }
      });

      if (!document) {
        throw new Error('Document not found');
      }

      return document;

    } catch (error) {
      logger.error('Get staff document error:', error);
      throw handlePrismaError(error);
    }
  }

  async updateStaffDocument(staffId, documentId, data, userId, schoolId) {
    try {
      const document = await this.prisma.staffDocument.update({
        where: {
          id: parseInt(documentId),
          staffId: parseInt(staffId)
        },
        data: {
          title: data.title,
          description: data.description,
          category: data.category,
          status: data.status,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          metadata: data.metadata,
          updatedBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return document;

    } catch (error) {
      logger.error('Update staff document error:', error);
      throw handlePrismaError(error);
    }
  }

  async deleteStaffDocument(staffId, documentId, userId, schoolId) {
    try {
      await this.prisma.staffDocument.delete({
        where: {
          id: parseInt(documentId),
          staffId: parseInt(staffId)
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return { success: true, message: 'Document deleted successfully' };

    } catch (error) {
      logger.error('Delete staff document error:', error);
      throw handlePrismaError(error);
    }
  }

  async getDocumentCategories(staffId, schoolId) {
    try {
      const cacheKey = `documentCategories:${staffId}:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const categories = await this.prisma.staffDocument.groupBy({
        by: ['category'],
        where: {
          staffId: parseInt(staffId),
          staff: { schoolId }
        },
        _count: { category: true }
      });

      const result = categories.map(cat => ({
        category: cat.category,
        count: cat._count.category
      }));

      await this.setCache(cacheKey, result, 3600); // 1 hour
      return result;

    } catch (error) {
      logger.error('Get document categories error:', error);
      throw handlePrismaError(error);
    }
  }

  async createDocumentCategory(staffId, data, userId, schoolId) {
    try {
      const category = await this.prisma.staffDocumentCategory.create({
        data: {
          staffId: parseInt(staffId),
          name: data.name,
          description: data.description,
          color: data.color,
          createdBy: userId
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return category;

    } catch (error) {
      logger.error('Create document category error:', error);
      throw handlePrismaError(error);
    }
  }

  async searchStaffDocuments(staffId, query, schoolId) {
    try {
      const documents = await this.prisma.staffDocument.findMany({
        where: {
          staffId: parseInt(staffId),
          staff: { schoolId },
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return documents;

    } catch (error) {
      logger.error('Search staff documents error:', error);
      throw handlePrismaError(error);
    }
  }

  async verifyStaffDocument(staffId, data, userId, schoolId) {
    try {
      const document = await this.prisma.staffDocument.update({
        where: {
          id: parseInt(data.documentId),
          staffId: parseInt(staffId)
        },
        data: {
          status: 'VERIFIED',
          verifiedAt: new Date(),
          verifiedBy: userId,
          verificationNotes: data.notes
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return document;

    } catch (error) {
      logger.error('Verify staff document error:', error);
      throw handlePrismaError(error);
    }
  }

  async getExpiringDocuments(staffId, days, schoolId) {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);

      const documents = await this.prisma.staffDocument.findMany({
        where: {
          staffId: parseInt(staffId),
          staff: { schoolId },
          expiryDate: {
            lte: expiryDate,
            gte: new Date()
          }
        },
        include: {
          staff: {
            include: {
              user: true
            }
          }
        },
        orderBy: { expiryDate: 'asc' }
      });

      return documents;

    } catch (error) {
      logger.error('Get expiring documents error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // TASKS METHODS
  // ======================

  async getStaffTasks(staffId, schoolId, filters = {}) {
    try {
      const cacheKey = `tasks:${staffId}:${schoolId}:${JSON.stringify(filters)}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const whereClause = {
        staffId: parseInt(staffId),
        staff: { schoolId }
      };

      if (filters.status) {
        whereClause.status = filters.status;
      }

      if (filters.priority) {
        whereClause.priority = filters.priority;
      }

      const tasks = await this.prisma.staffTask.findMany({
        where: whereClause,
        include: {
          staff: {
            include: {
              user: true
            }
          },
          assignee: {
            include: {
              user: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      await this.setCache(cacheKey, tasks, 1800); // 30 minutes
      return tasks;

    } catch (error) {
      logger.error('Get staff tasks error:', error);
      throw handlePrismaError(error);
    }
  }

  async createStaffTask(staffId, data, userId, schoolId) {
    try {
      const task = await this.prisma.staffTask.create({
        data: {
          staffId: parseInt(staffId),
          title: data.title,
          description: data.description,
          status: data.status || 'PENDING',
          priority: data.priority || 'MEDIUM',
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
          assigneeId: data.assigneeId ? parseInt(data.assigneeId) : null,
          metadata: data.metadata || {},
          createdBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          },
          assignee: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return task;

    } catch (error) {
      logger.error('Create staff task error:', error);
      throw handlePrismaError(error);
    }
  }

  async getStaffTask(staffId, taskId, schoolId) {
    try {
      const task = await this.prisma.staffTask.findFirst({
        where: {
          id: parseInt(taskId),
          staffId: parseInt(staffId),
          staff: { schoolId }
        },
        include: {
          staff: {
            include: {
              user: true
            }
          },
          assignee: {
            include: {
              user: true
            }
          }
        }
      });

      if (!task) {
        throw new Error('Task not found');
      }

      return task;

    } catch (error) {
      logger.error('Get staff task error:', error);
      throw handlePrismaError(error);
    }
  }

  async updateStaffTask(staffId, taskId, data, userId, schoolId) {
    try {
      const task = await this.prisma.staffTask.update({
        where: {
          id: parseInt(taskId),
          staffId: parseInt(staffId)
        },
        data: {
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
          assigneeId: data.assigneeId ? parseInt(data.assigneeId) : null,
          metadata: data.metadata,
          updatedBy: userId
        },
        include: {
          staff: {
            include: {
              user: true
            }
          },
          assignee: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return task;

    } catch (error) {
      logger.error('Update staff task error:', error);
      throw handlePrismaError(error);
    }
  }

  async deleteStaffTask(staffId, taskId, userId, schoolId) {
    try {
      await this.prisma.staffTask.delete({
        where: {
          id: parseInt(taskId),
          staffId: parseInt(staffId)
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return { success: true, message: 'Task deleted successfully' };

    } catch (error) {
      logger.error('Delete staff task error:', error);
      throw handlePrismaError(error);
    }
  }

  async assignStaffTask(staffId, taskId, data, userId, schoolId) {
    try {
      const task = await this.prisma.staffTask.update({
        where: {
          id: parseInt(taskId),
          staffId: parseInt(staffId)
        },
        data: {
          assigneeId: parseInt(data.assigneeId),
          assignedAt: new Date(),
          assignedBy: userId,
          assignmentNotes: data.notes
        },
        include: {
          staff: {
            include: {
              user: true
            }
          },
          assignee: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return task;

    } catch (error) {
      logger.error('Assign staff task error:', error);
      throw handlePrismaError(error);
    }
  }

  async completeStaffTask(staffId, taskId, data, userId, schoolId) {
    try {
      const task = await this.prisma.staffTask.update({
        where: {
          id: parseInt(taskId),
          staffId: parseInt(staffId)
        },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedBy: userId,
          actualHours: data.actualHours ? parseFloat(data.actualHours) : null,
          completionNotes: data.notes
        },
        include: {
          staff: {
            include: {
              user: true
            }
          },
          assignee: {
            include: {
              user: true
            }
          }
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return task;

    } catch (error) {
      logger.error('Complete staff task error:', error);
      throw handlePrismaError(error);
    }
  }

  async getOverdueTasks(staffId, schoolId) {
    try {
      const tasks = await this.prisma.staffTask.findMany({
        where: {
          staffId: parseInt(staffId),
          staff: { schoolId },
          dueDate: {
            lt: new Date()
          },
          status: {
            notIn: ['COMPLETED', 'CANCELLED']
          }
        },
        include: {
          staff: {
            include: {
              user: true
            }
          },
          assignee: {
            include: {
              user: true
            }
          }
        },
        orderBy: { dueDate: 'asc' }
      });

      return tasks;

    } catch (error) {
      logger.error('Get overdue tasks error:', error);
      throw handlePrismaError(error);
    }
  }

  async getCompletedTasks(staffId, schoolId, filters = {}) {
    try {
      const whereClause = {
        staffId: parseInt(staffId),
        staff: { schoolId },
        status: 'COMPLETED'
      };

      if (filters.startDate) {
        whereClause.completedAt = {
          gte: new Date(filters.startDate)
        };
      }

      if (filters.endDate) {
        whereClause.completedAt = {
          ...whereClause.completedAt,
          lte: new Date(filters.endDate)
        };
      }

      const tasks = await this.prisma.staffTask.findMany({
        where: whereClause,
        include: {
          staff: {
            include: {
              user: true
            }
          },
          assignee: {
            include: {
              user: true
            }
          }
        },
        orderBy: { completedAt: 'desc' }
      });

      return tasks;

    } catch (error) {
      logger.error('Get completed tasks error:', error);
      throw handlePrismaError(error);
    }
  }

  async getTaskStatistics(staffId, schoolId) {
    try {
      const cacheKey = `taskStats:${staffId}:${schoolId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const [totalTasks, completedTasks, overdueTasks, pendingTasks] = await Promise.all([
        this.prisma.staffTask.count({
          where: {
            staffId: parseInt(staffId),
            staff: { schoolId }
          }
        }),
        this.prisma.staffTask.count({
          where: {
            staffId: parseInt(staffId),
            staff: { schoolId },
            status: 'COMPLETED'
          }
        }),
        this.prisma.staffTask.count({
          where: {
            staffId: parseInt(staffId),
            staff: { schoolId },
            dueDate: {
              lt: new Date()
            },
            status: {
              notIn: ['COMPLETED', 'CANCELLED']
            }
          }
        }),
        this.prisma.staffTask.count({
          where: {
            staffId: parseInt(staffId),
            staff: { schoolId },
            status: 'PENDING'
          }
        })
      ]);

      const stats = {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        pending: pendingTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(2) : 0,
        overdueRate: totalTasks > 0 ? (overdueTasks / totalTasks * 100).toFixed(2) : 0
      };

      await this.setCache(cacheKey, stats, 3600); // 1 hour
      return stats;

    } catch (error) {
      logger.error('Get task statistics error:', error);
      throw handlePrismaError(error);
    }
  }

  async bulkAssignTasks(staffId, data, userId, schoolId) {
    try {
      const tasks = await this.prisma.staffTask.updateMany({
        where: {
          id: {
            in: data.taskIds.map(id => parseInt(id))
          },
          staffId: parseInt(staffId)
        },
        data: {
          assigneeId: parseInt(data.assigneeId),
          assignedAt: new Date(),
          assignedBy: userId,
          assignmentNotes: data.notes
        }
      });

      await this.invalidateStaffCache(staffId, schoolId);
      return { success: true, message: `${tasks.count} tasks assigned successfully` };

    } catch (error) {
      logger.error('Bulk assign tasks error:', error);
      throw handlePrismaError(error);
    }
  }
}

export default new StaffService();

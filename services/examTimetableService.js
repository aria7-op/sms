import { PrismaClient } from '../generated/prisma/client.js';
import Redis from 'ioredis';
import { 
  generateUUID, 
  formatResponse,
  handlePrismaError,
  createAuditLog
} from '../utils/responseUtils.js';
import {
  sanitizeString
} from '../middleware/validation.js';
import {
  buildExamTimetableSearchQuery,
  buildExamTimetableIncludeQuery,
  formatExamTimetableResponse,
  validateExamTimetableData,
  checkTimeConflict,
  checkRoomConflict,
  checkSubjectConflict,
  calculateDuration,
  isUpcoming,
  isToday,
  isPast,
  validateExamTimetablePermissions,
  generateExamTimetableReport,
  generateOptimalSchedule
} from '../utils/examTimetableUtils.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

// Redis configuration (optional - falls back to memory store if not available)
let redisClient = null;
let useRedis = false;

// Disable Redis for now - only use memory cache
console.log('Exam Timetable Service: Redis disabled - using memory cache only');

// Memory cache fallback
const memoryCache = new Map();
const cacheTTL = new Map();

class ExamTimetableService {
  constructor() {
    this.cachePrefix = 'examTimetable';
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

  async invalidateExamTimetableCache(timetableId, schoolId) {
    await Promise.all([
      this.deleteCache(`*:${timetableId}`),
      this.deleteCache(`*:school:${schoolId}`),
      this.deleteCache(`*:exam:*`),
      this.deleteCache('*:stats*'),
      this.deleteCache('*:analytics*'),
      this.deleteCache('*:report*')
    ]);
  }

  // ======================
  // CRUD OPERATIONS
  // ======================

  async createExamTimetable(data, userId, schoolId) {
    try {
      // Validate data
      const validationErrors = await validateExamTimetableData(data, schoolId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Create exam timetable
      const timetable = await this.prisma.examTimetable.create({
        data: {
          uuid: generateUUID(),
          examId: data.examId,
          subjectId: data.subjectId,
          date: new Date(data.date),
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          roomNumber: data.roomNumber ? sanitizeString(data.roomNumber) : null,
          schoolId,
          metadata: data.metadata || {},
          createdBy: userId
        },
        include: {
          exam: {
            include: {
              term: true,
              class: true,
              subject: true,
              school: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          },
          subject: {
            include: {
              department: true
            }
          },
          school: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'CREATE',
        resource: 'ExamTimetable',
        resourceId: timetable.id,
        userId,
        schoolId,
        details: {
          examId: timetable.examId,
          subjectId: timetable.subjectId,
          date: timetable.date,
          startTime: timetable.startTime,
          endTime: timetable.endTime,
          roomNumber: timetable.roomNumber
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateExamTimetableCache(timetable.id, schoolId);

      return formatExamTimetableResponse(timetable, true);
    } catch (error) {
      logger.error('Create exam timetable error:', error);
      throw error;
    }
  }

  async getExamTimetables(filters, schoolId, include = null) {
    try {
      const where = buildExamTimetableSearchQuery(filters, schoolId);
      const includeQuery = buildExamTimetableIncludeQuery(include);

      // Get total count
      const total = await this.prisma.examTimetable.count({ where });

      // Get timetables with pagination
      const timetables = await this.prisma.examTimetable.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        include: includeQuery
      });

      const formattedTimetables = timetables.map(timetable => 
        formatExamTimetableResponse(timetable, true)
      );

      return {
        data: formattedTimetables,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          pages: Math.ceil(total / filters.limit),
          hasNext: filters.page * filters.limit < total,
          hasPrev: filters.page > 1
        }
      };
    } catch (error) {
      logger.error('Get exam timetables error:', error);
      throw error;
    }
  }

  async getExamTimetableById(timetableId, schoolId, include = null) {
    try {
      const includeQuery = buildExamTimetableIncludeQuery(include);

      const timetable = await this.prisma.examTimetable.findFirst({
        where: {
          id: timetableId,
          schoolId,
          deletedAt: null
        },
        include: includeQuery
      });

      if (!timetable) {
        throw new Error('Exam timetable not found');
      }

      return formatExamTimetableResponse(timetable, true);
    } catch (error) {
      logger.error('Get exam timetable by ID error:', error);
      throw error;
    }
  }

  async updateExamTimetable(timetableId, data, userId, schoolId) {
    try {
      // Validate timetable exists and user has access
      await validateExamTimetablePermissions(timetableId, userId, schoolId);

      // Validate data
      const validationErrors = await validateExamTimetableData(data, schoolId, timetableId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Update timetable
      const updatedTimetable = await this.prisma.examTimetable.update({
        where: { id: timetableId },
        data: {
          date: data.date ? new Date(data.date) : undefined,
          startTime: data.startTime ? new Date(data.startTime) : undefined,
          endTime: data.endTime ? new Date(data.endTime) : undefined,
          roomNumber: data.roomNumber ? sanitizeString(data.roomNumber) : undefined,
          metadata: data.metadata,
          updatedBy: userId
        },
        include: {
          exam: {
            include: {
              term: true,
              class: true,
              subject: true,
              school: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          },
          subject: {
            include: {
              department: true
            }
          },
          school: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          updatedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'UPDATE',
        resource: 'ExamTimetable',
        resourceId: timetableId,
        userId,
        schoolId,
        details: {
          examId: updatedTimetable.examId,
          subjectId: updatedTimetable.subjectId,
          date: updatedTimetable.date,
          startTime: updatedTimetable.startTime,
          endTime: updatedTimetable.endTime,
          roomNumber: updatedTimetable.roomNumber
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateExamTimetableCache(timetableId, schoolId);

      return formatExamTimetableResponse(updatedTimetable, true);
    } catch (error) {
      logger.error('Update exam timetable error:', error);
      throw error;
    }
  }

  async deleteExamTimetable(timetableId, userId, schoolId) {
    try {
      // Validate timetable exists and user has access
      await validateExamTimetablePermissions(timetableId, userId, schoolId);

      // Soft delete timetable
      const deletedTimetable = await this.prisma.examTimetable.update({
        where: { id: timetableId },
        data: {
          deletedAt: new Date(),
          updatedBy: userId
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'DELETE',
        resource: 'ExamTimetable',
        resourceId: timetableId,
        userId,
        schoolId,
        details: {
          examId: deletedTimetable.examId,
          subjectId: deletedTimetable.subjectId,
          date: deletedTimetable.date
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateExamTimetableCache(timetableId, schoolId);

      return { success: true, message: 'Exam timetable deleted successfully' };
    } catch (error) {
      logger.error('Delete exam timetable error:', error);
      throw error;
    }
  }

  async restoreExamTimetable(timetableId, userId, schoolId) {
    try {
      // Validate timetable exists and user has access
      await validateExamTimetablePermissions(timetableId, userId, schoolId);

      // Restore timetable
      const restoredTimetable = await this.prisma.examTimetable.update({
        where: { id: timetableId },
        data: {
          deletedAt: null,
          updatedBy: userId
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'RESTORE',
        resource: 'ExamTimetable',
        resourceId: timetableId,
        userId,
        schoolId,
        details: {
          examId: restoredTimetable.examId,
          subjectId: restoredTimetable.subjectId,
          date: restoredTimetable.date
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateExamTimetableCache(timetableId, schoolId);

      return { success: true, message: 'Exam timetable restored successfully' };
    } catch (error) {
      logger.error('Restore exam timetable error:', error);
      throw error;
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateExamTimetables(data, userId, schoolId) {
    try {
      const results = [];

      for (const timetableData of data.timetables) {
        try {
          const timetable = await this.createExamTimetable(timetableData, userId, schoolId);
          results.push({
            success: true,
            data: timetable,
            message: 'Exam timetable created successfully'
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            data: timetableData
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk create exam timetables error:', error);
      throw error;
    }
  }

  async bulkUpdateExamTimetables(data, userId, schoolId) {
    try {
      const results = [];

      for (const update of data.updates) {
        try {
          const timetable = await this.updateExamTimetable(update.id, update.data, userId, schoolId);
          results.push({
            success: true,
            data: timetable,
            message: 'Exam timetable updated successfully'
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            data: update
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk update exam timetables error:', error);
      throw error;
    }
  }

  async bulkDeleteExamTimetables(data, userId, schoolId) {
    try {
      const results = [];

      for (const timetableId of data.timetableIds) {
        try {
          const result = await this.deleteExamTimetable(timetableId, userId, schoolId);
          results.push({
            success: true,
            data: result,
            message: 'Exam timetable deleted successfully'
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            timetableId
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk delete exam timetables error:', error);
      throw error;
    }
  }

  // ======================
  // SCHEDULING & CONFLICT DETECTION
  // ======================

  async checkConflicts(data, schoolId, excludeId = null) {
    try {
      const conflicts = {
        roomConflict: false,
        subjectConflict: false,
        timeConflict: false,
        details: []
      };

      // Check room conflict
      if (data.roomNumber) {
        conflicts.roomConflict = await checkRoomConflict(
          data.examId,
          data.subjectId,
          data.date,
          data.startTime,
          data.endTime,
          data.roomNumber,
          schoolId,
          excludeId
        );

        if (conflicts.roomConflict) {
          conflicts.details.push('Room is already booked for this time slot');
        }
      }

      // Check subject conflict
      conflicts.subjectConflict = await checkSubjectConflict(
        data.examId,
        data.subjectId,
        data.date,
        data.startTime,
        data.endTime,
        schoolId,
        excludeId
      );

      if (conflicts.subjectConflict) {
        conflicts.details.push('Subject already has an exam scheduled for this time slot');
      }

      // Check time conflicts with other exams
      const existingTimetables = await this.prisma.examTimetable.findMany({
        where: {
          examId: data.examId,
          schoolId,
          date: new Date(data.date),
          id: { not: excludeId },
          deletedAt: null
        }
      });

      for (const existing of existingTimetables) {
        if (checkTimeConflict(data.startTime, data.endTime, existing.startTime, existing.endTime)) {
          conflicts.timeConflict = true;
          conflicts.details.push(`Time conflict with ${existing.subject?.name || 'another exam'}`);
          break;
        }
      }

      return conflicts;
    } catch (error) {
      logger.error('Check conflicts error:', error);
      throw error;
    }
  }

  async generateOptimalSchedule(examId, schoolId, constraints = {}) {
    try {
      return await generateOptimalSchedule(examId, schoolId, constraints);
    } catch (error) {
      logger.error('Generate optimal schedule error:', error);
      throw error;
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getExamTimetableStats(timetableId, schoolId) {
    try {
      const timetable = await this.prisma.examTimetable.findFirst({
        where: {
          id: timetableId,
          schoolId,
          deletedAt: null
        },
        include: {
          exam: {
            include: {
              term: true,
              class: true,
              subject: true
            }
          },
          subject: {
            include: {
              department: true
            }
          }
        }
      });

      if (!timetable) {
        throw new Error('Exam timetable not found');
      }

      const duration = calculateDuration(timetable.startTime, timetable.endTime);
      const isUpcomingExam = isUpcoming(timetable.date, timetable.startTime);
      const isTodayExam = isToday(timetable.date);
      const isPastExam = isPast(timetable.date, timetable.endTime);

      return {
        timetable: formatExamTimetableResponse(timetable, true),
        stats: {
          duration,
          isUpcoming: isUpcomingExam,
          isToday: isTodayExam,
          isPast: isPastExam,
          timeUntilExam: isUpcomingExam ? this.calculateTimeUntil(timetable.date, timetable.startTime) : null
        }
      };
    } catch (error) {
      logger.error('Get exam timetable stats error:', error);
      throw error;
    }
  }

  async getExamTimetableAnalytics(timetableId, schoolId, period = '30d') {
    try {
      const timetable = await this.prisma.examTimetable.findFirst({
        where: {
          id: timetableId,
          schoolId,
          deletedAt: null
        },
        include: {
          exam: {
            include: {
              term: true,
              class: true,
              subject: true
            }
          },
          subject: {
            include: {
              department: true
            }
          }
        }
      });

      if (!timetable) {
        throw new Error('Exam timetable not found');
      }

      // Get related timetables for analytics
      const relatedTimetables = await this.prisma.examTimetable.findMany({
        where: {
          examId: timetable.examId,
          schoolId,
          deletedAt: null
        },
        include: {
          subject: true
        },
        orderBy: {
          date: 'asc'
        }
      });

      const analytics = {
        timetable: formatExamTimetableResponse(timetable, true),
        period,
        examSchedule: {
          totalSubjects: relatedTimetables.length,
          totalDuration: this.calculateTotalDuration(relatedTimetables),
          averageDuration: this.calculateAverageDuration(relatedTimetables),
          roomUtilization: this.calculateRoomUtilization(relatedTimetables),
          timeSlotDistribution: this.calculateTimeSlotDistribution(relatedTimetables)
        },
        subjectAnalysis: this.analyzeSubjectSchedule(relatedTimetables),
        roomAnalysis: this.analyzeRoomSchedule(relatedTimetables)
      };

      return analytics;
    } catch (error) {
      logger.error('Get exam timetable analytics error:', error);
      throw error;
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  calculateTimeUntil(date, startTime) {
    const now = new Date();
    const examDateTime = new Date(date);
    examDateTime.setHours(new Date(startTime).getHours());
    examDateTime.setMinutes(new Date(startTime).getMinutes());
    
    const diffMs = examDateTime - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      totalMinutes: Math.floor(diffMs / (1000 * 60)),
      days: diffDays,
      hours: diffHours,
      minutes: diffMinutes,
      formatted: `${diffDays}d ${diffHours}h ${diffMinutes}m`
    };
  }

  calculateTotalDuration(timetables) {
    return timetables.reduce((total, timetable) => {
      const duration = calculateDuration(timetable.startTime, timetable.endTime);
      return total + duration.totalMinutes;
    }, 0);
  }

  calculateAverageDuration(timetables) {
    if (timetables.length === 0) return 0;
    const totalDuration = this.calculateTotalDuration(timetables);
    return Math.round(totalDuration / timetables.length);
  }

  calculateRoomUtilization(timetables) {
    const roomStats = {};
    
    timetables.forEach(timetable => {
      if (timetable.roomNumber) {
        if (!roomStats[timetable.roomNumber]) {
          roomStats[timetable.roomNumber] = {
            totalExams: 0,
            totalMinutes: 0
          };
        }
        roomStats[timetable.roomNumber].totalExams++;
        const duration = calculateDuration(timetable.startTime, timetable.endTime);
        roomStats[timetable.roomNumber].totalMinutes += duration.totalMinutes;
      }
    });

    return roomStats;
  }

  calculateTimeSlotDistribution(timetables) {
    const distribution = {
      morning: 0,
      afternoon: 0,
      evening: 0
    };

    timetables.forEach(timetable => {
      const startHour = new Date(timetable.startTime).getHours();
      if (startHour >= 6 && startHour < 12) {
        distribution.morning++;
      } else if (startHour >= 12 && startHour < 17) {
        distribution.afternoon++;
      } else {
        distribution.evening++;
      }
    });

    return distribution;
  }

  analyzeSubjectSchedule(timetables) {
    const subjectStats = {};
    
    timetables.forEach(timetable => {
      const subjectName = timetable.subject.name;
      if (!subjectStats[subjectName]) {
        subjectStats[subjectName] = {
          totalExams: 0,
          totalMinutes: 0,
          averageDuration: 0
        };
      }
      subjectStats[subjectName].totalExams++;
      const duration = calculateDuration(timetable.startTime, timetable.endTime);
      subjectStats[subjectName].totalMinutes += duration.totalMinutes;
    });

    Object.keys(subjectStats).forEach(subject => {
      const stats = subjectStats[subject];
      stats.averageDuration = Math.round(stats.totalMinutes / stats.totalExams);
    });

    return subjectStats;
  }

  analyzeRoomSchedule(timetables) {
    const roomStats = {};
    
    timetables.forEach(timetable => {
      if (timetable.roomNumber) {
        if (!roomStats[timetable.roomNumber]) {
          roomStats[timetable.roomNumber] = {
            totalExams: 0,
            totalMinutes: 0,
            averageDuration: 0,
            utilization: 0
          };
        }
        roomStats[timetable.roomNumber].totalExams++;
        const duration = calculateDuration(timetable.startTime, timetable.endTime);
        roomStats[timetable.roomNumber].totalMinutes += duration.totalMinutes;
      }
    });

    Object.keys(roomStats).forEach(room => {
      const stats = roomStats[room];
      stats.averageDuration = Math.round(stats.totalMinutes / stats.totalExams);
      // Assuming 8-hour workday for utilization calculation
      stats.utilization = Math.round((stats.totalMinutes / (8 * 60)) * 100);
    });

    return roomStats;
  }

  // ======================
  // SEARCH & UTILITY
  // ======================

  async searchExamTimetables(query, schoolId, include = null) {
    try {
      const where = {
        schoolId,
        deletedAt: null,
        OR: [
          { roomNumber: { contains: query, mode: 'insensitive' } }
        ]
      };

      const includeQuery = buildExamTimetableIncludeQuery(include);

      const timetables = await this.prisma.examTimetable.findMany({
        where,
        include: includeQuery,
        orderBy: { date: 'asc' }
      });

      return timetables.map(timetable => formatExamTimetableResponse(timetable, true));
    } catch (error) {
      logger.error('Search exam timetables error:', error);
      throw error;
    }
  }

  async getExamTimetablesByExam(examId, schoolId, include = null) {
    try {
      const where = {
        examId,
        schoolId,
        deletedAt: null
      };

      const includeQuery = buildExamTimetableIncludeQuery(include);

      const timetables = await this.prisma.examTimetable.findMany({
        where,
        include: includeQuery,
        orderBy: { date: 'asc', startTime: 'asc' }
      });

      return timetables.map(timetable => formatExamTimetableResponse(timetable, true));
    } catch (error) {
      logger.error('Get exam timetables by exam error:', error);
      throw error;
    }
  }

  async getExamTimetablesBySubject(subjectId, schoolId, include = null) {
    try {
      const where = {
        subjectId,
        schoolId,
        deletedAt: null
      };

      const includeQuery = buildExamTimetableIncludeQuery(include);

      const timetables = await this.prisma.examTimetable.findMany({
        where,
        include: includeQuery,
        orderBy: { date: 'asc', startTime: 'asc' }
      });

      return timetables.map(timetable => formatExamTimetableResponse(timetable, true));
    } catch (error) {
      logger.error('Get exam timetables by subject error:', error);
      throw error;
    }
  }

  async getUpcomingExamTimetables(schoolId, days = 7, include = null) {
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const where = {
        schoolId,
        deletedAt: null,
        date: {
          gte: startDate,
          lte: endDate
        }
      };

      const includeQuery = buildExamTimetableIncludeQuery(include);

      const timetables = await this.prisma.examTimetable.findMany({
        where,
        include: includeQuery,
        orderBy: { date: 'asc', startTime: 'asc' }
      });

      return timetables.map(timetable => formatExamTimetableResponse(timetable, true));
    } catch (error) {
      logger.error('Get upcoming exam timetables error:', error);
      throw error;
    }
  }

  async generateExamTimetableReport(schoolId, filters = {}) {
    try {
      return await generateExamTimetableReport(schoolId, filters);
    } catch (error) {
      logger.error('Generate exam timetable report error:', error);
      throw error;
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  async getCacheStats() {
    try {
      if (useRedis && redisClient) {
        const info = await redisClient.info('memory');
        return {
          type: 'redis',
          info
        };
      } else {
        return {
          type: 'memory',
          size: memoryCache.size,
          keys: Array.from(memoryCache.keys())
        };
      }
    } catch (error) {
      logger.error('Get cache stats error:', error);
      throw error;
    }
  }

  async warmCache(schoolId, timetableId = null) {
    try {
      if (timetableId) {
        // Warm specific timetable
        const timetable = await this.getExamTimetableById(timetableId, schoolId, 'exam,subject,school');
        await this.setCache(`timetable:${timetableId}`, timetable, 3600);
      } else {
        // Warm all timetables for school
        const timetables = await this.getExamTimetables({ schoolId, limit: 100 }, schoolId, 'exam,subject,school');
        await this.setCache(`timetables:school:${schoolId}`, timetables, 3600);
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

export default new ExamTimetableService(); 
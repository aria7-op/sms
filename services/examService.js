import { PrismaClient } from '../generated/prisma/client.js';
import { 
  generateUUID, 
  formatResponse,
  handlePrismaError,
  createAuditLog
} from '../utils/responseUtils.js';
import {
  sanitizeString,
  validateExamData,
  generateExamCode,
  formatExamResponse,
  buildExamSearchQuery,
  buildExamIncludeQuery,
  calculateExamStatistics,
  validateExamPermissions,
  generateExamReport
} from '../utils/examUtils.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

// Redis configuration (same as ParentService)
let redisClient = null;
let useRedis = false;
console.log('Redis disabled - using memory cache only');
const memoryCache = new Map();
const cacheTTL = new Map();

class ExamService {
  constructor() {
    this.cachePrefix = 'exam';
    this.cacheTTL = 1800; // 30 minutes
    this.prisma = prisma;
  }

  // ======================
  // CACHE OPERATIONS (identical structure)
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
        if (keys.length > 0) await redisClient.del(...keys);
      } else {
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

  async invalidateExamCache(examId, schoolId) {
    await Promise.all([
      this.deleteCache(`*:${examId}`),
      this.deleteCache(`*:school:${schoolId}`),
      this.deleteCache('*:stats*'),
      this.deleteCache('*:analytics*')
    ]);
  }

  // ======================
  // CRUD OPERATIONS (Exam-specific)
  // ======================
  async createExam(data, userId, schoolId) {
    try {
      const validationErrors = await validateExamData(data, schoolId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      if (!data.code) data.code = generateExamCode(data.name, schoolId);

      const exam = await this.prisma.exam.create({
        data: {
          uuid: generateUUID(),
          name: sanitizeString(data.name),
          code: data.code,
          type: data.type,
          startDate: new Date(data.startDate),
          endDate: new Date(data.endDate),
          description: data.description ? sanitizeString(data.description) : null,
          totalMarks: parseFloat(data.totalMarks),
          passingMarks: parseFloat(data.passingMarks),
          termId: data.termId || null,
          classId: data.classId || null,
          subjectId: data.subjectId || null,
          schoolId,
          createdBy: userId,
          metadata: data.metadata || {}
        },
        include: {
          term: true,
          class: true,
          subject: true,
          school: true,
          grades: true
        }
      });

      await this.invalidateExamCache(exam.id, schoolId);
      await createAuditLog({
        action: 'CREATE',
        entityType: 'Exam',
        entityId: exam.id,
        userId,
        schoolId,
        oldData: null,
        newData: {
          examName: exam.name,
          examCode: exam.code,
          type: exam.type
        }
      });

      logger.info(`Exam created: ${exam.id} by user: ${userId}`);
      return formatExamResponse(exam, true);
    } catch (error) {
      logger.error('Create exam error:', error);
      throw handlePrismaError(error);
    }
  }

  async getExams(filters, schoolId, include = null) {
    try {
      const cacheKey = `list:${JSON.stringify(filters)}:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const where = buildExamSearchQuery(filters, schoolId);
      const includeObj = buildExamIncludeQuery(include);

      const [exams, total] = await Promise.all([
        this.prisma.exam.findMany({
          where,
          include: includeObj,
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit,
          orderBy: { [filters.sortBy]: filters.sortOrder }
        }),
        this.prisma.exam.count({ where })
      ]);

      const result = {
        exams: exams.map(exam => formatExamResponse(exam, true)),
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total,
          pages: Math.ceil(total / filters.limit),
          hasNext: filters.page * filters.limit < total,
          hasPrev: filters.page > 1
        }
      };

      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Get exams error:', error);
      throw handlePrismaError(error);
    }
  }

  async getExamById(examId, schoolId, include = null) {
    try {
      const cacheKey = `byId:${examId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildExamIncludeQuery(include);
      const exam = await this.prisma.exam.findFirst({
        where: { id: examId, schoolId, deletedAt: null },
        include: includeObj
      });

      if (!exam) throw new Error('Exam not found');

      const result = formatExamResponse(exam, true);
      await this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error('Get exam by ID error:', error);
      throw handlePrismaError(error);
    }
  }

  async updateExam(examId, data, userId, schoolId) {
    try {
      const existingExam = await this.prisma.exam.findFirst({
        where: { id: examId, schoolId, deletedAt: null }
      });
      if (!existingExam) throw new Error('Exam not found');

      const hasPermission = await validateExamPermissions(examId, userId, schoolId);
      if (!hasPermission) throw new Error('Insufficient permissions');

      const validationErrors = await validateExamData(data, schoolId, examId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      const updatedExam = await this.prisma.exam.update({
        where: { id: examId },
        data: {
          name: data.name ? sanitizeString(data.name) : undefined,
          type: data.type || undefined,
          startDate: data.startDate ? new Date(data.startDate) : undefined,
          endDate: data.endDate ? new Date(data.endDate) : undefined,
          description: data.description ? sanitizeString(data.description) : undefined,
          totalMarks: data.totalMarks ? parseFloat(data.totalMarks) : undefined,
          passingMarks: data.passingMarks ? parseFloat(data.passingMarks) : undefined,
          termId: data.termId || undefined,
          classId: data.classId || undefined,
          subjectId: data.subjectId || undefined,
          metadata: data.metadata || undefined,
          updatedBy: userId
        },
        include: {
          term: true,
          class: true,
          subject: true,
          school: true,
          grades: true
        }
      });

      await this.invalidateExamCache(examId, schoolId);
      await createAuditLog({
        action: 'UPDATE',
        entityType: 'Exam',
        entityId: examId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          examName: updatedExam.name,
          changes: data
        }
      });

      logger.info(`Exam updated: ${examId} by user: ${userId}`);
      return formatExamResponse(updatedExam, true);
    } catch (error) {
      logger.error('Update exam error:', error);
      throw handlePrismaError(error);
    }
  }

  async deleteExam(examId, userId, schoolId) {
    try {
      const exam = await this.prisma.exam.findFirst({
        where: { id: examId, schoolId, deletedAt: null }
      });
      if (!exam) throw new Error('Exam not found');

      // Check if exam has grades
      const gradeCount = await this.prisma.grade.count({
        where: { examId }
      });
      if (gradeCount > 0) {
        throw new Error(`Cannot delete exam with ${gradeCount} grades. Delete grades first.`);
      }

      await this.prisma.exam.update({
        where: { id: examId },
        data: {
          deletedAt: new Date(),
          updatedBy: userId
        }
      });

      await this.invalidateExamCache(examId, schoolId);
      await createAuditLog({
        action: 'DELETE',
        entityType: 'Exam',
        entityId: examId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          examName: exam.name
        }
      });

      logger.info(`Exam deleted: ${examId} by user: ${userId}`);
      return { success: true, message: 'Exam deleted successfully' };
    } catch (error) {
      logger.error('Delete exam error:', error);
      throw handlePrismaError(error);
    }
  }

  async restoreExam(examId, userId, schoolId) {
    try {
      const exam = await this.prisma.exam.findFirst({
        where: { id: examId, schoolId }
      });
      if (!exam) throw new Error('Exam not found');
      if (!exam.deletedAt) throw new Error('Exam is not deleted');

      await this.prisma.exam.update({
        where: { id: examId },
        data: {
          deletedAt: null,
          updatedBy: userId
        }
      });

      await this.invalidateExamCache(examId, schoolId);
      await createAuditLog({
        action: 'RESTORE',
        entityType: 'Exam',
        entityId: examId,
        userId,
        schoolId,
        oldData: null,
        newData: {
          examName: exam.name
        }
      });

      logger.info(`Exam restored: ${examId} by user: ${userId}`);
      return { success: true, message: 'Exam restored successfully' };
    } catch (error) {
      logger.error('Restore exam error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================
  async bulkCreateExams(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const examData of data.exams) {
        try {
          const result = await this.createExam(examData, userId, schoolId);
          results.push(result);
        } catch (error) {
          errors.push({
            data: examData,
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
      logger.error('Bulk create exams error:', error);
      throw handlePrismaError(error);
    }
  }

  async bulkUpdateExams(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const update of data.updates) {
        try {
          const result = await this.updateExam(update.id, update.data, userId, schoolId);
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
      logger.error('Bulk update exams error:', error);
      throw handlePrismaError(error);
    }
  }

  async bulkDeleteExams(data, userId, schoolId) {
    try {
      const results = [];
      const errors = [];

      for (const examId of data.examIds) {
        try {
          const result = await this.deleteExam(examId, userId, schoolId);
          results.push({ id: examId, ...result });
        } catch (error) {
          errors.push({
            id: examId,
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
      logger.error('Bulk delete exams error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================
  async getExamStats(examId, schoolId) {
    try {
      const cacheKey = `stats:${examId}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const exam = await this.prisma.exam.findUnique({
        where: { id: examId, schoolId },
        include: {
          grades: {
            include: {
              student: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      });

      if (!exam) throw new Error('Exam not found');

      const stats = calculateExamStatistics(exam);
      await this.setCache(cacheKey, stats, 900); // 15 minutes
      return stats;
    } catch (error) {
      logger.error('Get exam stats error:', error);
      throw handlePrismaError(error);
    }
  }

  async getExamAnalytics(examId, schoolId, period = '30d') {
    try {
      const cacheKey = `analytics:${examId}:${period}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const exam = await this.prisma.exam.findUnique({
        where: { id: examId, schoolId },
        include: {
          grades: {
            include: {
              student: {
                include: {
                  user: true,
                  class: true,
                  section: true
                }
              }
            }
          }
        }
      });

      if (!exam) throw new Error('Exam not found');

      const analytics = {
        exam: formatExamResponse(exam),
        period,
        totalStudents: exam.grades.length,
        averageScore: exam.grades.reduce((sum, g) => sum + g.marks, 0) / exam.grades.length,
        passRate: (exam.grades.filter(g => g.marks >= exam.passingMarks).length / exam.grades.length) * 100,
        scoreDistribution: this.calculateScoreDistribution(exam.grades),
        classPerformance: this.calculateClassPerformance(exam.grades),
        sectionPerformance: this.calculateSectionPerformance(exam.grades)
      };

      await this.setCache(cacheKey, analytics, 1800); // 30 minutes
      return analytics;
    } catch (error) {
      logger.error('Get exam analytics error:', error);
      throw handlePrismaError(error);
    }
  }

  calculateScoreDistribution(grades) {
    const distribution = {
      '0-49': 0,
      '50-59': 0,
      '60-69': 0,
      '70-79': 0,
      '80-89': 0,
      '90-100': 0
    };

    grades.forEach(grade => {
      const score = grade.marks;
      if (score < 50) distribution['0-49']++;
      else if (score < 60) distribution['50-59']++;
      else if (score < 70) distribution['60-69']++;
      else if (score < 80) distribution['70-79']++;
      else if (score < 90) distribution['80-89']++;
      else distribution['90-100']++;
    });

    return distribution;
  }

  calculateClassPerformance(grades) {
    const classPerformance = {};
    grades.forEach(grade => {
      const className = grade.student.class?.name || 'Unknown';
      if (!classPerformance[className]) {
        classPerformance[className] = {
          total: 0,
          sum: 0,
          count: 0
        };
      }
      classPerformance[className].sum += grade.marks;
      classPerformance[className].count++;
    });

    return Object.entries(classPerformance).reduce((acc, [className, data]) => {
      acc[className] = data.sum / data.count;
      return acc;
    }, {});
  }

  calculateSectionPerformance(grades) {
    const sectionPerformance = {};
    grades.forEach(grade => {
      const sectionName = grade.student.section?.name || 'Unknown';
      if (!sectionPerformance[sectionName]) {
        sectionPerformance[sectionName] = {
          total: 0,
          sum: 0,
          count: 0
        };
      }
      sectionPerformance[sectionName].sum += grade.marks;
      sectionPerformance[sectionName].count++;
    });

    return Object.entries(sectionPerformance).reduce((acc, [sectionName, data]) => {
      acc[sectionName] = data.sum / data.count;
      return acc;
    }, {});
  }

  // ======================
  // SEARCH & UTILITY
  // ======================
  async searchExams(query, schoolId, include = null) {
    try {
      const cacheKey = `search:${query}:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildExamIncludeQuery(include);
      const exams = await this.prisma.exam.findMany({
        where: {
          schoolId,
          deletedAt: null,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { code: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } }
          ]
        },
        include: includeObj,
        take: 20
      });

      const result = exams.map(exam => formatExamResponse(exam, true));
      await this.setCache(cacheKey, result, 900); // 15 minutes
      return result;
    } catch (error) {
      logger.error('Search exams error:', error);
      throw handlePrismaError(error);
    }
  }

  async getExamsByTerm(termId, schoolId, include = null) {
    try {
      const cacheKey = `byTerm:${termId}:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildExamIncludeQuery(include);
      const exams = await this.prisma.exam.findMany({
        where: { termId, schoolId, deletedAt: null },
        include: includeObj,
        orderBy: { startDate: 'asc' }
      });

      const result = exams.map(exam => formatExamResponse(exam, true));
      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;
    } catch (error) {
      logger.error('Get exams by term error:', error);
      throw handlePrismaError(error);
    }
  }

  async getExamsByClass(classId, schoolId, include = null) {
    try {
      const cacheKey = `byClass:${classId}:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildExamIncludeQuery(include);
      const exams = await this.prisma.exam.findMany({
        where: { classId, schoolId, deletedAt: null },
        include: includeObj,
        orderBy: { startDate: 'asc' }
      });

      const result = exams.map(exam => formatExamResponse(exam, true));
      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;
    } catch (error) {
      logger.error('Get exams by class error:', error);
      throw handlePrismaError(error);
    }
  }

  async getExamsBySubject(subjectId, schoolId, include = null) {
    try {
      const cacheKey = `bySubject:${subjectId}:${schoolId}:${include}`;
      const cached = await this.getFromCache(cacheKey);
      if (cached) return cached;

      const includeObj = buildExamIncludeQuery(include);
      const exams = await this.prisma.exam.findMany({
        where: { subjectId, schoolId, deletedAt: null },
        include: includeObj,
        orderBy: { startDate: 'asc' }
      });

      const result = exams.map(exam => formatExamResponse(exam, true));
      await this.setCache(cacheKey, result, 1800); // 30 minutes
      return result;
    } catch (error) {
      logger.error('Get exams by subject error:', error);
      throw handlePrismaError(error);
    }
  }

  async generateExamReport(examId, schoolId, format = 'pdf') {
    try {
      const exam = await this.getExamById(examId, schoolId, 'grades,term,class,subject');
      const stats = await this.getExamStats(examId, schoolId);
      
      if (format === 'pdf') {
        // Generate PDF report logic
        return {
          format: 'pdf',
          exam,
          stats,
          generatedAt: new Date()
        };
      } else {
        // Default to JSON
        return {
          format: 'json',
          exam,
          stats
        };
      }
    } catch (error) {
      logger.error('Generate exam report error:', error);
      throw handlePrismaError(error);
    }
  }

  // ======================
  // CACHE MANAGEMENT (identical to ParentService)
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

  async warmCache(schoolId, examId = null) {
    try {
      if (examId) {
        await this.getExamById(examId, schoolId, 'grades,term,class,subject');
        await this.getExamStats(examId, schoolId);
        await this.getExamAnalytics(examId, schoolId, '30d');
      } else {
        await this.getExams({ page: 1, limit: 50 }, schoolId, 'grades,term,class,subject');
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

export default new ExamService();
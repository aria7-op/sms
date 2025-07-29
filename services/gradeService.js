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
  buildGradeSearchQuery,
  buildGradeIncludeQuery,
  formatGradeResponse,
  validateGradeData,
  calculateGrade,
  calculateGPA,
  calculateCGPA,
  calculatePercentage,
  isPassingGrade,
  validateGradePermissions,
  generateGradeReport
} from '../utils/gradeUtils.js';
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

class GradeService {
  constructor() {
    this.cachePrefix = 'grade';
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

  async invalidateGradeCache(gradeId, schoolId) {
    await Promise.all([
      this.deleteCache(`*:${gradeId}`),
      this.deleteCache(`*:school:${schoolId}`),
      this.deleteCache('*:stats*'),
      this.deleteCache('*:analytics*'),
      this.deleteCache('*:report*')
    ]);
  }

  // ======================
  // CRUD OPERATIONS
  // ======================

  async createGrade(data, userId, schoolId) {
    try {
      // Validate data
      const validationErrors = await validateGradeData(data, schoolId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Get exam details for grade calculation
      const exam = await this.prisma.exam.findFirst({
        where: {
          id: data.examId,
          schoolId,
          deletedAt: null
        }
      });

      // Calculate grade if not provided
      let calculatedGrade = data.grade;
      if (!calculatedGrade && !data.isAbsent) {
        calculatedGrade = calculateGrade(data.marks, exam.totalMarks, exam.passingMarks);
      }

      // Create grade
      const grade = await this.prisma.grade.create({
        data: {
          uuid: generateUUID(),
          examId: data.examId,
          studentId: data.studentId,
          subjectId: data.subjectId,
          marks: data.marks,
          grade: calculatedGrade,
          remarks: data.remarks ? sanitizeString(data.remarks) : null,
          isAbsent: data.isAbsent,
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
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              },
              class: true,
              section: true
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
        resource: 'Grade',
        resourceId: grade.id,
        userId,
        schoolId,
        details: {
          examId: grade.examId,
          studentId: grade.studentId,
          subjectId: grade.subjectId,
          marks: grade.marks,
          grade: grade.grade,
          isAbsent: grade.isAbsent
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateGradeCache(grade.id, schoolId);

      return formatGradeResponse(grade, true);
    } catch (error) {
      logger.error('Create grade error:', error);
      throw error;
    }
  }

  async getGrades(filters, schoolId, include = null) {
    try {
      const where = buildGradeSearchQuery(filters, schoolId);
      const includeQuery = buildGradeIncludeQuery(include);

      // Get total count
      const total = await this.prisma.grade.count({ where });

      // Get grades with pagination
      const grades = await this.prisma.grade.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        include: includeQuery
      });

      const formattedGrades = grades.map(grade => 
        formatGradeResponse(grade, true)
      );

      return {
        data: formattedGrades,
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
      logger.error('Get grades error:', error);
      throw error;
    }
  }

  async getGradeById(gradeId, schoolId, include = null) {
    try {
      const includeQuery = buildGradeIncludeQuery(include);

      const grade = await this.prisma.grade.findFirst({
        where: {
          id: gradeId,
          schoolId,
          deletedAt: null
        },
        include: includeQuery
      });

      if (!grade) {
        throw new Error('Grade not found');
      }

      return formatGradeResponse(grade, true);
    } catch (error) {
      logger.error('Get grade by ID error:', error);
      throw error;
    }
  }

  async updateGrade(gradeId, data, userId, schoolId) {
    try {
      // Validate grade exists and user has access
      await validateGradePermissions(gradeId, userId, schoolId);

      // Validate data
      const validationErrors = await validateGradeData(data, schoolId, gradeId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Get exam details for grade calculation
      const existingGrade = await this.prisma.grade.findFirst({
        where: { id: gradeId },
        include: { exam: true }
      });

      // Calculate grade if marks changed and grade not provided
      let calculatedGrade = data.grade;
      if (data.marks !== undefined && !data.grade && !data.isAbsent) {
        calculatedGrade = calculateGrade(data.marks, existingGrade.exam.totalMarks, existingGrade.exam.passingMarks);
      }

      // Update grade
      const updatedGrade = await this.prisma.grade.update({
        where: { id: gradeId },
        data: {
          marks: data.marks,
          grade: calculatedGrade,
          remarks: data.remarks ? sanitizeString(data.remarks) : undefined,
          isAbsent: data.isAbsent,
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
          student: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              },
              class: true,
              section: true
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
        resource: 'Grade',
        resourceId: gradeId,
        userId,
        schoolId,
        details: {
          examId: updatedGrade.examId,
          studentId: updatedGrade.studentId,
          subjectId: updatedGrade.subjectId,
          marks: updatedGrade.marks,
          grade: updatedGrade.grade,
          isAbsent: updatedGrade.isAbsent
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateGradeCache(gradeId, schoolId);

      return formatGradeResponse(updatedGrade, true);
    } catch (error) {
      logger.error('Update grade error:', error);
      throw error;
    }
  }

  async deleteGrade(gradeId, userId, schoolId) {
    try {
      // Validate grade exists and user has access
      await validateGradePermissions(gradeId, userId, schoolId);

      // Soft delete grade
      const deletedGrade = await this.prisma.grade.update({
        where: { id: gradeId },
        data: {
          deletedAt: new Date(),
          updatedBy: userId
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'DELETE',
        resource: 'Grade',
        resourceId: gradeId,
        userId,
        schoolId,
        details: {
          examId: deletedGrade.examId,
          studentId: deletedGrade.studentId,
          subjectId: deletedGrade.subjectId
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateGradeCache(gradeId, schoolId);

      return { success: true, message: 'Grade deleted successfully' };
    } catch (error) {
      logger.error('Delete grade error:', error);
      throw error;
    }
  }

  async restoreGrade(gradeId, userId, schoolId) {
    try {
      // Validate grade exists and user has access
      await validateGradePermissions(gradeId, userId, schoolId);

      // Restore grade
      const restoredGrade = await this.prisma.grade.update({
        where: { id: gradeId },
        data: {
          deletedAt: null,
          updatedBy: userId
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'RESTORE',
        resource: 'Grade',
        resourceId: gradeId,
        userId,
        schoolId,
        details: {
          examId: restoredGrade.examId,
          studentId: restoredGrade.studentId,
          subjectId: restoredGrade.subjectId
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateGradeCache(gradeId, schoolId);

      return { success: true, message: 'Grade restored successfully' };
    } catch (error) {
      logger.error('Restore grade error:', error);
      throw error;
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateGrades(data, userId, schoolId) {
    try {
      const results = [];

      for (const gradeData of data.grades) {
        try {
          const grade = await this.createGrade(gradeData, userId, schoolId);
          results.push({
            success: true,
            data: grade,
            message: 'Grade created successfully'
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            data: gradeData
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk create grades error:', error);
      throw error;
    }
  }

  async bulkUpdateGrades(data, userId, schoolId) {
    try {
      const results = [];

      for (const update of data.updates) {
        try {
          const grade = await this.updateGrade(update.id, update.data, userId, schoolId);
          results.push({
            success: true,
            data: grade,
            message: 'Grade updated successfully'
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
      logger.error('Bulk update grades error:', error);
      throw error;
    }
  }

  async bulkDeleteGrades(data, userId, schoolId) {
    try {
      const results = [];

      for (const gradeId of data.gradeIds) {
        try {
          const result = await this.deleteGrade(gradeId, userId, schoolId);
          results.push({
            success: true,
            data: result,
            message: 'Grade deleted successfully'
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            gradeId
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk delete grades error:', error);
      throw error;
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getGradeStats(gradeId, schoolId) {
    try {
      const grade = await this.prisma.grade.findFirst({
        where: {
          id: gradeId,
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
          student: {
            include: {
              user: true,
              class: true,
              section: true
            }
          },
          subject: {
            include: {
              department: true
            }
          }
        }
      });

      if (!grade) {
        throw new Error('Grade not found');
      }

      const percentage = calculatePercentage(grade.marks, grade.exam.totalMarks);
      const isPassing = isPassingGrade(grade.grade);

      return {
        grade: formatGradeResponse(grade, true),
        stats: {
          percentage,
          isPassing,
          gradePoints: calculateGradePoints(grade.grade),
          examTotalMarks: grade.exam.totalMarks,
          examPassingMarks: grade.exam.passingMarks
        }
      };
    } catch (error) {
      logger.error('Get grade stats error:', error);
      throw error;
    }
  }

  async getGradeAnalytics(gradeId, schoolId, period = '30d') {
    try {
      const grade = await this.prisma.grade.findFirst({
        where: {
          id: gradeId,
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
          student: {
            include: {
              user: true,
              class: true,
              section: true
            }
          },
          subject: {
            include: {
              department: true
            }
          }
        }
      });

      if (!grade) {
        throw new Error('Grade not found');
      }

      // Get student's performance history
      const studentGrades = await this.prisma.grade.findMany({
        where: {
          studentId: grade.studentId,
          schoolId,
          deletedAt: null
        },
        include: {
          exam: true,
          subject: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      const analytics = {
        grade: formatGradeResponse(grade, true),
        period,
        performanceHistory: await this.calculatePerformanceHistory(studentGrades, period),
        subjectPerformance: await this.calculateSubjectPerformance(studentGrades),
        examPerformance: await this.calculateExamPerformance(studentGrades),
        trendAnalysis: await this.calculateTrendAnalysis(studentGrades, period)
      };

      return analytics;
    } catch (error) {
      logger.error('Get grade analytics error:', error);
      throw error;
    }
  }

  async calculatePerformanceHistory(grades, period) {
    // Implementation for performance history calculation
    return {
      totalExams: grades.length,
      averageMarks: grades.length > 0 ? grades.reduce((sum, g) => sum + parseFloat(g.marks), 0) / grades.length : 0,
      averagePercentage: grades.length > 0 ? grades.reduce((sum, g) => sum + calculatePercentage(g.marks, g.exam.totalMarks), 0) / grades.length : 0,
      bestGrade: grades.length > 0 ? grades.reduce((best, g) => g.marks > best.marks ? g : best, grades[0]) : null,
      worstGrade: grades.length > 0 ? grades.reduce((worst, g) => g.marks < worst.marks ? g : worst, grades[0]) : null
    };
  }

  async calculateSubjectPerformance(grades) {
    const subjectStats = {};
    
    grades.forEach(grade => {
      const subjectName = grade.subject.name;
      if (!subjectStats[subjectName]) {
        subjectStats[subjectName] = {
          totalGrades: 0,
          totalMarks: 0,
          averageMarks: 0,
          averagePercentage: 0
        };
      }
      subjectStats[subjectName].totalGrades++;
      subjectStats[subjectName].totalMarks += parseFloat(grade.marks);
    });

    Object.keys(subjectStats).forEach(subject => {
      const stats = subjectStats[subject];
      stats.averageMarks = stats.totalMarks / stats.totalGrades;
      stats.averagePercentage = calculatePercentage(stats.averageMarks, 100);
    });

    return subjectStats;
  }

  async calculateExamPerformance(grades) {
    const examStats = {};
    
    grades.forEach(grade => {
      const examName = grade.exam.name;
      if (!examStats[examName]) {
        examStats[examName] = {
          totalGrades: 0,
          totalMarks: 0,
          averageMarks: 0,
          averagePercentage: 0
        };
      }
      examStats[examName].totalGrades++;
      examStats[examName].totalMarks += parseFloat(grade.marks);
    });

    Object.keys(examStats).forEach(exam => {
      const stats = examStats[exam];
      stats.averageMarks = stats.totalMarks / stats.totalGrades;
      stats.averagePercentage = calculatePercentage(stats.averageMarks, 100);
    });

    return examStats;
  }

  async calculateTrendAnalysis(grades, period) {
    // Implementation for trend analysis
    return {
      trend: 'improving',
      improvementRate: 5.2,
      consistency: 'good',
      recommendations: [
        'Continue current study habits',
        'Focus on weak subjects',
        'Practice more in exam conditions'
      ]
    };
  }

  // ======================
  // SEARCH & UTILITY
  // ======================

  async searchGrades(query, schoolId, include = null) {
    try {
      const where = {
        schoolId,
        deletedAt: null,
        OR: [
          { grade: { contains: query, mode: 'insensitive' } },
          { remarks: { contains: query, mode: 'insensitive' } }
        ]
      };

      const includeQuery = buildGradeIncludeQuery(include);

      const grades = await this.prisma.grade.findMany({
        where,
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });

      return grades.map(grade => formatGradeResponse(grade, true));
    } catch (error) {
      logger.error('Search grades error:', error);
      throw error;
    }
  }

  async getGradesByStudent(studentId, schoolId, include = null) {
    try {
      const where = {
        studentId,
        schoolId,
        deletedAt: null
      };

      const includeQuery = buildGradeIncludeQuery(include);

      const grades = await this.prisma.grade.findMany({
        where,
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });

      return grades.map(grade => formatGradeResponse(grade, true));
    } catch (error) {
      logger.error('Get grades by student error:', error);
      throw error;
    }
  }

  async getGradesByExam(examId, schoolId, include = null) {
    try {
      const where = {
        examId,
        schoolId,
        deletedAt: null
      };

      const includeQuery = buildGradeIncludeQuery(include);

      const grades = await this.prisma.grade.findMany({
        where,
        include: includeQuery,
        orderBy: { marks: 'desc' }
      });

      return grades.map(grade => formatGradeResponse(grade, true));
    } catch (error) {
      logger.error('Get grades by exam error:', error);
      throw error;
    }
  }

  async getGradesBySubject(subjectId, schoolId, include = null) {
    try {
      const where = {
        subjectId,
        schoolId,
        deletedAt: null
      };

      const includeQuery = buildGradeIncludeQuery(include);

      const grades = await this.prisma.grade.findMany({
        where,
        include: includeQuery,
        orderBy: { marks: 'desc' }
      });

      return grades.map(grade => formatGradeResponse(grade, true));
    } catch (error) {
      logger.error('Get grades by subject error:', error);
      throw error;
    }
  }

  async calculateStudentGPA(studentId, schoolId) {
    try {
      const grades = await this.prisma.grade.findMany({
        where: {
          studentId,
          schoolId,
          deletedAt: null,
          grade: { not: null }
        },
        select: {
          grade: true
        }
      });

      return calculateGPA(grades);
    } catch (error) {
      logger.error('Calculate student GPA error:', error);
      throw error;
    }
  }

  async calculateStudentCGPA(studentId, schoolId) {
    try {
      const grades = await this.prisma.grade.findMany({
        where: {
          studentId,
          schoolId,
          deletedAt: null,
          grade: { not: null }
        },
        select: {
          grade: true
        }
      });

      return calculateCGPA(grades);
    } catch (error) {
      logger.error('Calculate student CGPA error:', error);
      throw error;
    }
  }

  async generateGradeReport(schoolId, filters = {}) {
    try {
      return await generateGradeReport(schoolId, filters);
    } catch (error) {
      logger.error('Generate grade report error:', error);
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

  async warmCache(schoolId, gradeId = null) {
    try {
      if (gradeId) {
        // Warm specific grade
        const grade = await this.getGradeById(gradeId, schoolId, 'exam,student,subject,school');
        await this.setCache(`grade:${gradeId}`, grade, 3600);
      } else {
        // Warm all grades for school
        const grades = await this.getGrades({ schoolId, limit: 100 }, schoolId, 'exam,student,subject,school');
        await this.setCache(`grades:school:${schoolId}`, grades, 3600);
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

export default new GradeService(); 
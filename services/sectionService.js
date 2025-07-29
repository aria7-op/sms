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
  buildSectionSearchQuery,
  buildSectionIncludeQuery,
  formatSectionResponse,
  validateSectionData,
  generateSectionName,
  calculateSectionUtilization,
  validateSectionPermissions,
  generateSectionReport
} from '../utils/sectionUtils.js';
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

class SectionService {
  constructor() {
    this.cachePrefix = 'section';
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

  async invalidateSectionCache(sectionId, schoolId) {
    await Promise.all([
      this.deleteCache(`*:${sectionId}`),
      this.deleteCache(`*:school:${schoolId}`),
      this.deleteCache('*:stats*'),
      this.deleteCache('*:analytics*')
    ]);
  }

  // ======================
  // CRUD OPERATIONS
  // ======================

  async createSection(data, userId, schoolId) {
    try {
      // Validate data
      const validationErrors = await validateSectionData(data, schoolId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Generate section name if not provided
      if (!data.name) {
        data.name = await generateSectionName(data.classId, schoolId);
      }

      // Create section
      const section = await this.prisma.section.create({
        data: {
          uuid: generateUUID(),
          name: sanitizeString(data.name),
          classId: data.classId,
          teacherId: data.teacherId,
          capacity: data.capacity,
          roomNumber: data.roomNumber ? sanitizeString(data.roomNumber) : null,
          schoolId,
          metadata: data.metadata || {},
          createdBy: userId
        },
        include: {
          class: {
            include: {
              school: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          },
          teacher: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          school: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'CREATE',
        resource: 'Section',
        resourceId: section.id,
        userId,
        schoolId,
        details: {
          sectionName: section.name,
          classId: section.classId,
          capacity: section.capacity
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateSectionCache(section.id, schoolId);

      return formatSectionResponse(section, true);
    } catch (error) {
      logger.error('Create section error:', error);
      throw error;
    }
  }

  async getSections(filters, schoolId, include = null) {
    try {
      const where = buildSectionSearchQuery(filters, schoolId);
      const includeQuery = buildSectionIncludeQuery(include);

      // Get total count
      const total = await this.prisma.section.count({ where });

      // Get sections with pagination
      const sections = await this.prisma.section.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { [filters.sortBy]: filters.sortOrder },
        include: includeQuery
      });

      const formattedSections = sections.map(section => 
        formatSectionResponse(section, true)
      );

      return {
        data: formattedSections,
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
      logger.error('Get sections error:', error);
      throw error;
    }
  }

  async getSectionById(sectionId, schoolId, include = null) {
    try {
      const includeQuery = buildSectionIncludeQuery(include);

      const section = await this.prisma.section.findFirst({
        where: {
          id: sectionId,
          schoolId,
          deletedAt: null
        },
        include: includeQuery
      });

      if (!section) {
        throw new Error('Section not found');
      }

      return formatSectionResponse(section, true);
    } catch (error) {
      logger.error('Get section by ID error:', error);
      throw error;
    }
  }

  async updateSection(sectionId, data, userId, schoolId) {
    try {
      // Validate section exists and user has access
      await validateSectionPermissions(sectionId, userId, schoolId);

      // Validate data
      const validationErrors = await validateSectionData(data, schoolId, sectionId);
      if (validationErrors.length > 0) {
        throw new Error(`Validation errors: ${validationErrors.join(', ')}`);
      }

      // Update section
      const updatedSection = await this.prisma.section.update({
        where: { id: sectionId },
        data: {
          name: data.name ? sanitizeString(data.name) : undefined,
          classId: data.classId,
          teacherId: data.teacherId,
          capacity: data.capacity,
          roomNumber: data.roomNumber ? sanitizeString(data.roomNumber) : undefined,
          metadata: data.metadata,
          updatedBy: userId
        },
        include: {
          class: {
            include: {
              school: {
                select: {
                  id: true,
                  name: true,
                  code: true
                }
              }
            }
          },
          teacher: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          school: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'UPDATE',
        resource: 'Section',
        resourceId: sectionId,
        userId,
        schoolId,
        details: {
          sectionName: updatedSection.name,
          classId: updatedSection.classId,
          capacity: updatedSection.capacity
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateSectionCache(sectionId, schoolId);

      return formatSectionResponse(updatedSection, true);
    } catch (error) {
      logger.error('Update section error:', error);
      throw error;
    }
  }

  async deleteSection(sectionId, userId, schoolId) {
    try {
      // Validate section exists and user has access
      await validateSectionPermissions(sectionId, userId, schoolId);

      // Check if section has students
      const studentCount = await this.prisma.student.count({
        where: {
          sectionId,
          deletedAt: null
        }
      });

      if (studentCount > 0) {
        throw new Error(`Cannot delete section with ${studentCount} students. Please transfer students first.`);
      }

      // Soft delete section
      const deletedSection = await this.prisma.section.update({
        where: { id: sectionId },
        data: {
          deletedAt: new Date(),
          updatedBy: userId
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'DELETE',
        resource: 'Section',
        resourceId: sectionId,
        userId,
        schoolId,
        details: {
          sectionName: deletedSection.name,
          classId: deletedSection.classId
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateSectionCache(sectionId, schoolId);

      return { success: true, message: 'Section deleted successfully' };
    } catch (error) {
      logger.error('Delete section error:', error);
      throw error;
    }
  }

  async restoreSection(sectionId, userId, schoolId) {
    try {
      // Validate section exists and user has access
      await validateSectionPermissions(sectionId, userId, schoolId);

      // Restore section
      const restoredSection = await this.prisma.section.update({
        where: { id: sectionId },
        data: {
          deletedAt: null,
          updatedBy: userId
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'RESTORE',
        resource: 'Section',
        resourceId: sectionId,
        userId,
        schoolId,
        details: {
          sectionName: restoredSection.name,
          classId: restoredSection.classId
        },
        ipAddress: null,
        userAgent: null
      });

      // Invalidate cache
      await this.invalidateSectionCache(sectionId, schoolId);

      return { success: true, message: 'Section restored successfully' };
    } catch (error) {
      logger.error('Restore section error:', error);
      throw error;
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateSections(data, userId, schoolId) {
    try {
      const results = [];

      for (const sectionData of data.sections) {
        try {
          const section = await this.createSection(sectionData, userId, schoolId);
          results.push({
            success: true,
            data: section,
            message: 'Section created successfully'
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            data: sectionData
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk create sections error:', error);
      throw error;
    }
  }

  async bulkUpdateSections(data, userId, schoolId) {
    try {
      const results = [];

      for (const update of data.updates) {
        try {
          const section = await this.updateSection(update.id, update.data, userId, schoolId);
          results.push({
            success: true,
            data: section,
            message: 'Section updated successfully'
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
      logger.error('Bulk update sections error:', error);
      throw error;
    }
  }

  async bulkDeleteSections(data, userId, schoolId) {
    try {
      const results = [];

      for (const sectionId of data.sectionIds) {
        try {
          const result = await this.deleteSection(sectionId, userId, schoolId);
          results.push({
            success: true,
            data: result,
            message: 'Section deleted successfully'
          });
        } catch (error) {
          results.push({
            success: false,
            error: error.message,
            sectionId
          });
        }
      }

      return results;
    } catch (error) {
      logger.error('Bulk delete sections error:', error);
      throw error;
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getSectionStats(sectionId, schoolId) {
    try {
      const section = await this.prisma.section.findFirst({
        where: {
          id: sectionId,
          schoolId,
          deletedAt: null
        },
        include: {
          class: true,
          teacher: {
            include: {
              user: true
            }
          },
          _count: {
            select: {
              students: true
            }
          }
        }
      });

      if (!section) {
        throw new Error('Section not found');
      }

      const utilization = await calculateSectionUtilization(sectionId);

      return {
        section: formatSectionResponse(section, true),
        utilization,
        stats: {
          totalStudents: section._count.students,
          capacity: section.capacity,
          utilizationPercentage: utilization.utilization,
          availableSeats: utilization.available
        }
      };
    } catch (error) {
      logger.error('Get section stats error:', error);
      throw error;
    }
  }

  async getSectionAnalytics(sectionId, schoolId, period = '30d') {
    try {
      const section = await this.prisma.section.findFirst({
        where: {
          id: sectionId,
          schoolId,
          deletedAt: null
        },
        include: {
          class: true,
          students: {
            where: {
              deletedAt: null
            },
            include: {
              user: true
            }
          }
        }
      });

      if (!section) {
        throw new Error('Section not found');
      }

      // Calculate analytics based on period
      const analytics = {
        section: formatSectionResponse(section, true),
        period,
        studentGrowth: await this.calculateStudentGrowth(sectionId, period),
        utilizationTrend: await this.calculateUtilizationTrend(sectionId, period),
        genderDistribution: this.calculateGenderDistribution(section.students),
        ageDistribution: this.calculateAgeDistribution(section.students)
      };

      return analytics;
    } catch (error) {
      logger.error('Get section analytics error:', error);
      throw error;
    }
  }

  async calculateStudentGrowth(sectionId, period) {
    // Implementation for student growth calculation
    return {
      growth: 0,
      trend: 'stable'
    };
  }

  async calculateUtilizationTrend(sectionId, period) {
    // Implementation for utilization trend calculation
    return {
      trend: 'stable',
      averageUtilization: 75
    };
  }

  calculateGenderDistribution(students) {
    const distribution = {
      MALE: 0,
      FEMALE: 0,
      OTHER: 0,
      PREFER_NOT_TO_SAY: 0
    };

    students.forEach(student => {
      const gender = student.user?.gender || 'PREFER_NOT_TO_SAY';
      distribution[gender]++;
    });

    return distribution;
  }

  calculateAgeDistribution(students) {
    const distribution = {
      '5-10': 0,
      '11-15': 0,
      '16-20': 0,
      '21+': 0
    };

    students.forEach(student => {
      if (student.user?.birthDate) {
        const age = new Date().getFullYear() - new Date(student.user.birthDate).getFullYear();
        if (age <= 10) distribution['5-10']++;
        else if (age <= 15) distribution['11-15']++;
        else if (age <= 20) distribution['16-20']++;
        else distribution['21+']++;
      }
    });

    return distribution;
  }

  // ======================
  // SEARCH & UTILITY
  // ======================

  async searchSections(query, schoolId, include = null) {
    try {
      const where = {
        schoolId,
        deletedAt: null,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { roomNumber: { contains: query, mode: 'insensitive' } }
        ]
      };

      const includeQuery = buildSectionIncludeQuery(include);

      const sections = await this.prisma.section.findMany({
        where,
        include: includeQuery,
        orderBy: { name: 'asc' }
      });

      return sections.map(section => formatSectionResponse(section, true));
    } catch (error) {
      logger.error('Search sections error:', error);
      throw error;
    }
  }

  async getSectionsByClass(classId, schoolId, include = null) {
    try {
      const where = {
        classId,
        schoolId,
        deletedAt: null
      };

      const includeQuery = buildSectionIncludeQuery(include);

      const sections = await this.prisma.section.findMany({
        where,
        include: includeQuery,
        orderBy: { name: 'asc' }
      });

      return sections.map(section => formatSectionResponse(section, true));
    } catch (error) {
      logger.error('Get sections by class error:', error);
      throw error;
    }
  }

  async getSectionsByTeacher(teacherId, schoolId, include = null) {
    try {
      const where = {
        teacherId,
        schoolId,
        deletedAt: null
      };

      const includeQuery = buildSectionIncludeQuery(include);

      const sections = await this.prisma.section.findMany({
        where,
        include: includeQuery,
        orderBy: { name: 'asc' }
      });

      return sections.map(section => formatSectionResponse(section, true));
    } catch (error) {
      logger.error('Get sections by teacher error:', error);
      throw error;
    }
  }

  async generateSectionReport(schoolId, filters = {}) {
    try {
      return await generateSectionReport(schoolId, filters);
    } catch (error) {
      logger.error('Generate section report error:', error);
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

  async warmCache(schoolId, sectionId = null) {
    try {
      if (sectionId) {
        // Warm specific section
        const section = await this.getSectionById(sectionId, schoolId, 'class,teacher,students,school');
        await this.setCache(`section:${sectionId}`, section, 3600);
      } else {
        // Warm all sections for school
        const sections = await this.getSections({ schoolId, limit: 100 }, schoolId, 'class,teacher,students,school');
        await this.setCache(`sections:school:${schoolId}`, sections, 3600);
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

export default new SectionService(); 
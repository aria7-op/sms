import { PrismaClient } from '../generated/prisma/client.js';
import { 
  generateTeacherCode, 
  validateTeacherConstraints, 
  buildTeacherSearchQuery, 
  buildTeacherIncludeQuery,
  generateTeacherStats,
  generateTeacherAnalytics,
  calculateTeacherPerformance,
  generateTeacherExportData,
  validateTeacherImportData,
  generateTeacherCodeSuggestions,
  getTeacherCountByDepartment,
  getTeacherCountByExperience
} from '../utils/teacherUtils.js';
import { 
  setTeacherInCache, 
  getTeacherFromCache, 
  setTeacherListInCache, 
  getTeacherListFromCache,
  setTeacherSearchInCache,
  getTeacherSearchFromCache,
  setTeacherStatsInCache,
  getTeacherStatsFromCache,
  setTeacherAnalyticsInCache,
  getTeacherAnalyticsFromCache,
  setTeacherPerformanceInCache,
  getTeacherPerformanceFromCache,
  invalidateTeacherCacheOnCreate,
  invalidateTeacherCacheOnUpdate,
  invalidateTeacherCacheOnDelete,
  invalidateTeacherCacheOnBulkOperation
} from '../cache/teacherCache.js';
import { 
  setCache, 
  getCache, 
  deleteCache 
} from '../cache/cacheManager.js';
import { 
  createAuditLog, 
  createNotification 
} from './notificationService.js';
import { getUserIdsByRoles } from '../utils/notificationTriggers.js';
import { 
  validateSchoolAccess, 
  validateDepartmentAccess 
} from '../middleware/validation.js';
import { 
  generatePaginationResponse, 
  handlePrismaError, 
  createSuccessResponse, 
  createErrorResponse,
  convertBigIntToString
} from '../utils/responseUtils.js';

const prisma = new PrismaClient();

class TeacherService {
  // ======================
  // CRUD OPERATIONS
  // ======================

  /**
   * Create a new teacher
   */
  async createTeacher(teacherData, userId, schoolId, user = null) {
    try {
      const { departmentId } = teacherData;

      // Validate school access
      await validateSchoolAccess({ id: userId, schoolId }, schoolId);

      // Validate department access if provided
      if (departmentId) {
        await validateDepartmentAccess({ id: userId, schoolId }, departmentId, schoolId);
      }

      // Generate teacher code
      const teacherCode = await generateTeacherCode(
        teacherData.employeeId || teacherData.user?.firstName,
        schoolId
      );

      // Validate teacher constraints
      await validateTeacherConstraints(schoolId, teacherCode, departmentId);

      // Create teacher with user
      const { schoolId: _, ...teacherDataWithoutSchoolId } = teacherData;
      const teacher = await prisma.teacher.create({
        data: {
          ...teacherDataWithoutSchoolId,
          employeeId: teacherCode,
          createdBy: userId,
          school: {
            connect: { id: schoolId }
          },
          user: {
            create: {
              ...teacherData.user,
              role: 'TEACHER',
              schoolId,
              createdBy: userId,
              username: teacherData.user.username || `${teacherData.user.firstName.toLowerCase()}${teacherData.user.lastName.toLowerCase()}${Date.now()}`,
              createdByOwnerId: BigInt(user?.role === 'SUPER_ADMIN' ? user.id : user?.createdByOwnerId || userId)
            }
          }
        },
        include: {
          user: {
            select: {
              id: true,
              uuid: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true
            }
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true
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

      // Invalidate cache
      await invalidateTeacherCacheOnCreate(teacher);

      // Create audit log
      await createAuditLog({
        action: 'CREATE',
        entityType: 'Teacher',
        entityId: teacher.id,
        userId,
        schoolId,
        oldData: null,
        newData: {
          teacherId: teacher.id,
          employeeId: teacher.employeeId,
          departmentId: teacher.departmentId
        }
      });

      // Get recipient user IDs for SCHOOL_ADMIN role
      const recipientUserIds = await getUserIdsByRoles(['SCHOOL_ADMIN'], schoolId);

      // Create notification
      await createNotification({
        type: 'CREATION',
        title: 'New Teacher Added',
        message: `Teacher ${teacher.user.firstName} ${teacher.user.lastName} has been added to the system`,
        recipients: recipientUserIds,
        schoolId,
        metadata: {
          teacherId: teacher.id,
          employeeId: teacher.employeeId
        }
      });

      return {
        success: true,
        data: teacher,
        message: 'Teacher created successfully'
      };
    } catch (error) {
      console.error('Teacher service create error:', error);
      throw error;
    }
  }

  /**
   * Get teachers with pagination and filters
   */
  async getTeachers(filters, userId, schoolId) {
    try {
      console.log('🔍 getTeachers called with:', { filters, userId, schoolId });
      console.log('🔍 schoolId type:', typeof schoolId, 'value:', schoolId);
      
      const { 
        page = 1, 
        limit = 10, 
        search, 
        departmentId, 
        isClassTeacher, 
        status,
        experience,
        include = [],
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      // Convert schoolId to BigInt if it's not already
      console.log('🔍 Converting schoolId to BigInt...');
      const schoolIdBigInt = BigInt(schoolId);
      console.log('✅ Converted schoolId to BigInt:', schoolIdBigInt);

      // Build simple where clause
      const where = {
        schoolId: schoolIdBigInt,
        deletedAt: null
      };

      // Add search filter if provided
      if (search) {
        where.OR = [
          {
            user: {
              firstName: {
                contains: search,
                mode: 'insensitive'
              }
            }
          },
          {
            user: {
              lastName: {
                contains: search,
                mode: 'insensitive'
              }
            }
          },
          {
            employeeId: {
              contains: search,
              mode: 'insensitive'
            }
          }
        ];
      }

      // Add department filter if provided
      if (departmentId) {
        where.departmentId = BigInt(departmentId);
      }

      // Add isClassTeacher filter if provided
      if (isClassTeacher !== undefined) {
        where.isClassTeacher = isClassTeacher === 'true';
      }

      console.log('🔍 Where clause:', JSON.stringify(convertBigIntToString(where), null, 2));

      // Build include query
      const includeQuery = {
        user: {
          select: {
            id: true,
            uuid: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            createdAt: true
          }
        },
        department: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        school: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      };

      // Get total count
      console.log('🔍 Getting total count...');
      const totalCount = await prisma.teacher.count({ where });
      console.log('✅ Total count:', totalCount);

      // Get teachers
      console.log('🔍 Getting teachers...');
      const teachers = await prisma.teacher.findMany({
        where,
        include: includeQuery,
        orderBy: { [sortBy]: sortOrder },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      });

      console.log('✅ Found teachers:', teachers.length);

      const response = generatePaginationResponse(teachers, totalCount, parseInt(page), parseInt(limit));
      console.log('✅ Generated response:', JSON.stringify(convertBigIntToString(response), null, 2));

      return {
        success: true,
        data: response,
        message: 'Teachers retrieved successfully'
      };
    } catch (error) {
      console.error('❌ Teacher service get error:', error);
      throw error;
    }
  }

  /**
   * Get teacher by ID
   */
  async getTeacherById(teacherId, userId, schoolId, include = []) {
    try {
      // Check cache first
      const cachedTeacher = await getTeacherFromCache(parseInt(teacherId));
      
      if (cachedTeacher) {
        return {
          success: true,
          data: cachedTeacher,
          message: 'Teacher retrieved from cache',
          cached: true
        };
      }

      const includeQuery = buildTeacherIncludeQuery(include);

      const teacher = await prisma.teacher.findFirst({
        where: {
          id: parseInt(teacherId),
          schoolId,
          deletedAt: null
        },
        include: includeQuery
      });

      if (!teacher) {
        throw new Error('Teacher not found');
      }

      // Cache the result
      await setTeacherInCache(teacher);

      return {
        success: true,
        data: teacher,
        message: 'Teacher retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service get by ID error:', error);
      throw error;
    }
  }

  /**
   * Update teacher
   */
  async updateTeacher(teacherId, updateData, userId, schoolId) {
    try {
      // Get existing teacher
      const existingTeacher = await prisma.teacher.findFirst({
        where: {
          id: parseInt(teacherId),
          schoolId,
          deletedAt: null
        },
        include: {
          user: true,
          department: true
        }
      });

      if (!existingTeacher) {
        throw new Error('Teacher not found');
      }

      // Validate department access if changing department
      if (updateData.departmentId && updateData.departmentId !== existingTeacher.departmentId) {
        await validateDepartmentAccess({ id: userId, schoolId }, updateData.departmentId, schoolId);
      }

      // Validate teacher constraints if changing employee ID
      if (updateData.employeeId && updateData.employeeId !== existingTeacher.employeeId) {
        await validateTeacherConstraints(schoolId, updateData.employeeId, updateData.departmentId);
      }

      // Update teacher
      const updatedTeacher = await prisma.teacher.update({
        where: { id: parseInt(teacherId) },
        data: {
          ...updateData,
          updatedBy: userId,
          user: updateData.user ? {
            update: {
              ...updateData.user,
              updatedBy: userId
            }
          } : undefined
        },
        include: {
          user: {
            select: {
              id: true,
              uuid: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
              updatedAt: true
            }
          },
          department: {
            select: {
              id: true,
              name: true,
              code: true
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

      // Invalidate cache
      await invalidateTeacherCacheOnUpdate(updatedTeacher, existingTeacher);

      // Create audit log
      await createAuditLog({
        action: 'UPDATE',
        entityType: 'Teacher',
        entityId: updatedTeacher.id,
        userId,
        schoolId,
        oldData: null,
        newData: {
          teacherId: updatedTeacher.id,
          employeeId: updatedTeacher.employeeId,
          changes: updateData
        }
      });

      return {
        success: true,
        data: updatedTeacher,
        message: 'Teacher updated successfully'
      };
    } catch (error) {
      console.error('Teacher service update error:', error);
      throw error;
    }
  }

  /**
   * Delete teacher (soft delete)
   */
  async deleteTeacher(teacherId, userId, schoolId) {
    try {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: parseInt(teacherId),
          schoolId,
          deletedAt: null
        },
        include: {
          user: true,
          subjects: true
        }
      });

      if (!teacher) {
        throw new Error('Teacher not found');
      }

      // Check if teacher has active subjects
      if (teacher.subjects.length > 0) {
        throw new Error('Cannot delete teacher with active subjects. Please reassign subjects first.');
      }

      // Soft delete teacher and user
      await prisma.$transaction([
        prisma.teacher.update({
          where: { id: parseInt(teacherId) },
          data: {
            deletedAt: new Date(),
            updatedBy: userId
          }
        }),
        prisma.user.update({
          where: { id: teacher.userId },
          data: {
            status: 'INACTIVE',
            updatedBy: userId
          }
        })
      ]);

      // Invalidate cache
      await invalidateTeacherCacheOnDelete(teacher);

      // Create audit log
      await createAuditLog({
        action: 'DELETE',
        entityType: 'Teacher',
        entityId: teacher.id,
        userId,
        schoolId,
        oldData: null,
        newData: {
          teacherId: teacher.id,
          employeeId: teacher.employeeId
        }
      });

      return {
        success: true,
        message: 'Teacher deleted successfully'
      };
    } catch (error) {
      console.error('Teacher service delete error:', error);
      throw error;
    }
  }

  /**
   * Restore deleted teacher
   */
  async restoreTeacher(teacherId, userId, schoolId) {
    try {
      const teacher = await prisma.teacher.findFirst({
        where: {
          id: parseInt(teacherId),
          schoolId,
          deletedAt: { not: null }
        },
        include: {
          user: true
        }
      });

      if (!teacher) {
        throw new Error('Teacher not found or not deleted');
      }

      // Restore teacher and user
      await prisma.$transaction([
        prisma.teacher.update({
          where: { id: parseInt(teacherId) },
          data: {
            deletedAt: null,
            updatedBy: userId
          }
        }),
        prisma.user.update({
          where: { id: teacher.userId },
          data: {
            status: 'ACTIVE',
            updatedBy: userId
          }
        })
      ]);

      // Invalidate cache
      await invalidateTeacherCacheOnCreate(teacher);

      // Create audit log
      await createAuditLog({
        action: 'RESTORE',
        entityType: 'Teacher',
        entityId: teacher.id,
        userId,
        schoolId,
        oldData: null,
        newData: {
          teacherId: teacher.id,
          employeeId: teacher.employeeId
        }
      });

      return {
        success: true,
        message: 'Teacher restored successfully'
      };
    } catch (error) {
      console.error('Teacher service restore error:', error);
      throw error;
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  /**
   * Search teachers with advanced filters
   */
  async searchTeachers(filters, userId, schoolId) {
    try {
      const { 
        search, 
        departmentId, 
        isClassTeacher, 
        status,
        experience,
        qualification,
        specialization,
        joiningDateFrom,
        joiningDateTo,
        include = [],
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const queryFilters = {
        search,
        departmentId: departmentId ? parseInt(departmentId) : undefined,
        isClassTeacher: isClassTeacher === 'true',
        status,
        experience: experience ? parseInt(experience) : undefined,
        qualification,
        specialization,
        joiningDateFrom,
        joiningDateTo
      };

      // Check cache first
      const cachedData = await getTeacherSearchFromCache({ filters: queryFilters, include, sortBy, sortOrder });
      
      if (cachedData) {
        return {
          success: true,
          data: cachedData,
          message: 'Teachers search results from cache',
          cached: true
        };
      }

      // Build query
      const query = buildTeacherSearchQuery(queryFilters);
      const includeQuery = buildTeacherIncludeQuery(include);

      const teachers = await prisma.teacher.findMany({
        where: {
          ...query,
          schoolId,
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { [sortBy]: sortOrder }
      });

      // Cache the result
      await setTeacherSearchInCache({ filters: queryFilters, include, sortBy, sortOrder }, teachers);

      return {
        success: true,
        data: teachers,
        message: 'Teachers search completed successfully'
      };
    } catch (error) {
      console.error('Teacher service search error:', error);
      throw error;
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  /**
   * Get teacher statistics
   */
  async getTeacherStats(teacherId, userId, schoolId) {
    try {
      // Check cache first
      const cachedStats = await getTeacherStatsFromCache(parseInt(teacherId));
      if (cachedStats) {
        return {
          success: true,
          data: cachedStats,
          message: 'Teacher stats retrieved from cache',
          cached: true
        };
      }

      const stats = await generateTeacherStats(parseInt(teacherId));

      // Cache the result
      await setTeacherStatsInCache(parseInt(teacherId), stats);

      return {
        success: true,
        data: stats,
        message: 'Teacher statistics retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service stats error:', error);
      throw error;
    }
  }

  /**
   * Get teacher analytics
   */
  async getTeacherAnalytics(teacherId, period, userId, schoolId) {
    try {
      // Check cache first
      const cachedAnalytics = await getTeacherAnalyticsFromCache(parseInt(teacherId), period);
      if (cachedAnalytics) {
        return {
          success: true,
          data: cachedAnalytics,
          message: 'Teacher analytics retrieved from cache',
          cached: true
        };
      }

      const analytics = await generateTeacherAnalytics(parseInt(teacherId), period);

      // Cache the result
      await setTeacherAnalyticsInCache(parseInt(teacherId), period, analytics);

      return {
        success: true,
        data: analytics,
        message: 'Teacher analytics retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service analytics error:', error);
      throw error;
    }
  }

  /**
   * Get teacher performance metrics
   */
  async getTeacherPerformance(teacherId, userId, schoolId) {
    try {
      // Check cache first
      const cachedPerformance = await getTeacherPerformanceFromCache(parseInt(teacherId));
      if (cachedPerformance) {
        return {
          success: true,
          data: cachedPerformance,
          message: 'Teacher performance retrieved from cache',
          cached: true
        };
      }

      const performance = await calculateTeacherPerformance(parseInt(teacherId));

      // Cache the result
      await setTeacherPerformanceInCache(parseInt(teacherId), performance);

      return {
        success: true,
        data: performance,
        message: 'Teacher performance retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service performance error:', error);
      throw error;
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  /**
   * Bulk create teachers
   */
  async bulkCreateTeachers(teachers, userId, schoolId) {
    try {
      if (!Array.isArray(teachers) || teachers.length === 0) {
        throw new Error('Teachers array is required');
      }

      const results = [];
      const errors = [];

      for (const teacherData of teachers) {
        try {
          const result = await this.createTeacher(teacherData, userId, schoolId);
          results.push(result.data);
        } catch (error) {
          errors.push({
            teacherData,
            error: error.message
          });
        }
      }

      // Create audit log
      await createAuditLog({
        action: 'BULK_CREATE',
        entityType: 'Teacher',
        userId,
        schoolId,
        oldData: null,
        newData: {
          totalTeachers: teachers.length,
          successful: results.length,
          failed: errors.length
        }
      });

      return {
        success: true,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: teachers.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: 'Bulk teacher creation completed'
      };
    } catch (error) {
      console.error('Teacher service bulk create error:', error);
      throw error;
    }
  }

  /**
   * Bulk update teachers
   */
  async bulkUpdateTeachers(updates, userId, schoolId) {
    try {
      if (!Array.isArray(updates) || updates.length === 0) {
        throw new Error('Updates array is required');
      }

      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          const { id, ...updateData } = update;
          const result = await this.updateTeacher(id, updateData, userId, schoolId);
          results.push(result.data);
        } catch (error) {
          errors.push({
            id: update.id,
            error: error.message
          });
        }
      }

      // Create audit log
      await createAuditLog({
        action: 'BULK_UPDATE',
        entityType: 'Teacher',
        userId,
        schoolId,
        oldData: null,
        newData: {
          totalUpdates: updates.length,
          successful: results.length,
          failed: errors.length
        }
      });

      return {
        success: true,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: updates.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: 'Bulk teacher update completed'
      };
    } catch (error) {
      console.error('Teacher service bulk update error:', error);
      throw error;
    }
  }

  /**
   * Bulk delete teachers
   */
  async bulkDeleteTeachers(teacherIds, userId, schoolId) {
    try {
      if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
        throw new Error('Teacher IDs array is required');
      }

      const results = [];
      const errors = [];

      for (const teacherId of teacherIds) {
        try {
          await this.deleteTeacher(teacherId, userId, schoolId);
          results.push({ teacherId, success: true });
        } catch (error) {
          errors.push({
            teacherId,
            error: error.message
          });
        }
      }

      // Create audit log
      await createAuditLog({
        action: 'BULK_DELETE',
        entityType: 'Teacher',
        userId,
        schoolId,
        oldData: null,
        newData: {
          totalTeachers: teacherIds.length,
          successful: results.length,
          failed: errors.length
        }
      });

      return {
        success: true,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: teacherIds.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: 'Bulk teacher deletion completed'
      };
    } catch (error) {
      console.error('Teacher service bulk delete error:', error);
      throw error;
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  /**
   * Export teachers data
   */
  async exportTeachers(filters, format, userId, schoolId) {
    try {
      // Get teachers based on filters
      const query = buildTeacherSearchQuery(filters);

      const teachers = await prisma.teacher.findMany({
        where: {
          ...query,
          schoolId,
          deletedAt: null
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              gender: true,
              dateOfBirth: true
            }
          },
          department: {
            select: {
              name: true,
              code: true
            }
          },
          school: {
            select: {
              name: true,
              code: true
            }
          }
        }
      });

      const exportData = await generateTeacherExportData(teachers, format);

      return {
        success: true,
        data: exportData,
        message: 'Teachers export completed successfully'
      };
    } catch (error) {
      console.error('Teacher service export error:', error);
      throw error;
    }
  }

  /**
   * Import teachers data
   */
  async importTeachers(teachers, user, userId, schoolId) {
    try {
      if (!Array.isArray(teachers) || teachers.length === 0) {
        throw new Error('Teachers array is required');
      }

      // Validate import data
      const validationResult = validateTeacherImportData(teachers);
      if (!validationResult.isValid) {
        throw new Error('Invalid import data');
      }

      const results = [];
      const errors = [];

      for (const teacherData of teachers) {
        try {
          const result = await this.createTeacher(teacherData, userId, schoolId);
          results.push(result.data);
        } catch (error) {
          errors.push({
            teacherData,
            error: error.message
          });
        }
      }

      // Create audit log
      await createAuditLog({
        action: 'IMPORT',
        entityType: 'Teacher',
        userId,
        schoolId,
        oldData: null,
        newData: {
          totalTeachers: teachers.length,
          successful: results.length,
          failed: errors.length,
          importedBy: user?.email || 'system'
        }
      });

      return {
        success: true,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: teachers.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: 'Teachers import completed'
      };
    } catch (error) {
      console.error('Teacher service import error:', error);
      throw error;
    }
  }

  // ======================
  // UTILITY OPERATIONS
  // ======================

  /**
   * Generate teacher code suggestions
   */
  async generateCodeSuggestions(name, schoolId) {
    try {
      if (!name || !schoolId) {
        throw new Error('Name and schoolId are required');
      }

      const suggestions = await generateTeacherCodeSuggestions(name, schoolId);

      return {
        success: true,
        data: suggestions,
        message: 'Code suggestions generated successfully'
      };
    } catch (error) {
      console.error('Teacher service code suggestions error:', error);
      throw error;
    }
  }

  /**
   * Get teacher count by department
   */
  async getTeacherCountByDepartment(schoolId) {
    try {
      const counts = await getTeacherCountByDepartment(schoolId);

      return {
        success: true,
        data: counts,
        message: 'Teacher count by department retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service count by department error:', error);
      throw error;
    }
  }

  /**
   * Get teacher count by experience
   */
  async getTeacherCountByExperience(schoolId) {
    try {
      const counts = await getTeacherCountByExperience(schoolId);

      return {
        success: true,
        data: counts,
        message: 'Teacher count by experience retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service count by experience error:', error);
      throw error;
    }
  }

  /**
   * Get teachers by department
   */
  async getTeachersByDepartment(departmentId, include, userId, schoolId) {
    try {
      const includeQuery = buildTeacherIncludeQuery(include);

      const teachers = await prisma.teacher.findMany({
        where: {
          departmentId: parseInt(departmentId),
          schoolId,
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });

      return {
        success: true,
        data: teachers,
        message: 'Teachers by department retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service by department error:', error);
      throw error;
    }
  }

  /**
   * Get teachers by school
   */
  async getTeachersBySchool(schoolId, include, userId) {
    try {
      const includeQuery = buildTeacherIncludeQuery(include);

      const teachers = await prisma.teacher.findMany({
        where: {
          schoolId: parseInt(schoolId),
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });

      return {
        success: true,
        data: teachers,
        message: 'Teachers by school retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service by school error:', error);
      throw error;
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const stats = await getCache('teacher:cache:stats');
      
      return {
        success: true,
        data: stats || {
          type: 'memory',
          status: 'disabled'
        },
        message: 'Cache statistics retrieved successfully'
      };
    } catch (error) {
      console.error('Teacher service cache stats error:', error);
      throw error;
    }
  }

  /**
   * Warm up cache
   */
  async warmCache(teacherId, schoolId, userId) {
    try {
      if (teacherId) {
        // Warm specific teacher cache
        const teacher = await prisma.teacher.findFirst({
          where: {
            id: parseInt(teacherId),
            schoolId,
            deletedAt: null
          },
          include: {
            user: true,
            department: true,
            school: true
          }
        });

        if (teacher) {
          await setTeacherInCache(teacher);
        }
      } else if (schoolId) {
        // Warm all teachers for school
        const teachers = await prisma.teacher.findMany({
          where: {
            schoolId: parseInt(schoolId),
            deletedAt: null
          },
          include: {
            user: true,
            department: true
          }
        });

        for (const teacher of teachers) {
          await setTeacherInCache(teacher);
        }
      }

      return {
        success: true,
        message: 'Cache warmed successfully'
      };
    } catch (error) {
      console.error('Teacher service warm cache error:', error);
      throw error;
    }
  }
}

export default new TeacherService(); 
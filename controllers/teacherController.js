import teacherService from '../services/teacherService.js';
import { 
  handlePrismaError, 
  createSuccessResponse, 
  createErrorResponse 
} from '../utils/responseUtils.js';
import { eventStore } from '../eventstore/index.js';
import { 
  triggerEntityCreatedNotifications,
  triggerEntityUpdatedNotifications,
  triggerEntityDeletedNotifications
} from '../utils/notificationTriggers.js';

class TeacherController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  /**
   * Create a new teacher
   */
  async createTeacher(req, res) {
    try {
      const teacherData = req.body;
      const { schoolId } = teacherData;

      const result = await teacherService.createTeacher(
        teacherData, 
        req.user.id, 
        schoolId,
        req.user
      );

      // Event sourcing
      eventStore.append('teacher', {
        type: 'TeacherCreated',
        aggregateId: result.data.id,
        payload: result.data,
        timestamp: Date.now()
      });

      // Trigger automatic notifications for teacher creation
      await triggerEntityCreatedNotifications(
        'teacher',
        result.data.id,
        result.data,
        req.user,
        {
          auditDetails: {
            teacherId: result.data.id,
            teacherName: `${result.data.user?.firstName} ${result.data.user?.lastName}`,
            department: result.data.department
          }
        }
      );

      return createSuccessResponse(res, 201, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'createTeacher');
    }
  }

  /**
   * Get teachers with pagination and filters
   */
  async getTeachers(req, res) {
    console.log('--- getTeachers endpoint hit ---');
    console.log('🔍 Full user object:', JSON.stringify(req.user, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value, 2));
    
    try {
      // Check if user has schoolId or schoolIds
      let schoolId = req.user.schoolId;
      
      if (!schoolId && req.user.schoolIds && req.user.schoolIds.length > 0) {
        schoolId = req.user.schoolIds[0];
        console.log('🔍 Using first schoolId from schoolIds array:', schoolId);
      }
      
      if (!schoolId) {
        console.log('❌ No schoolId found for user:', req.user);
        return res.status(400).json({
          success: false,
          message: 'No schoolId found for this user. Please select a school or ensure your account is associated with a school.'
        });
      }
      
      console.log('✅ Using schoolId:', schoolId);
      console.log('getTeachers controller called with:', {
        query: req.query,
        userId: req.user.id,
        schoolId: schoolId,
        userType: typeof schoolId
      });

      const result = await teacherService.getTeachers(
        req.query, 
        req.user.id, 
        schoolId
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      console.error('getTeachers controller error:', error);
      return handlePrismaError(res, error, 'getTeachers');
    }
  }

  /**
   * Get teacher by ID
   */
  async getTeacherById(req, res) {
    try {
      const { id } = req.params;
      const { include = [] } = req.query;

      const result = await teacherService.getTeacherById(
        parseInt(id), 
        req.user.id, 
        req.user.schoolId, 
        include
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getTeacherById');
    }
  }

  /**
   * Update teacher
   */
  async updateTeacher(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const result = await teacherService.updateTeacher(
        parseInt(id), 
        updateData, 
        req.user.id, 
        req.user.schoolId
      );

      // Event sourcing
      eventStore.append('teacher', {
        type: 'TeacherUpdated',
        aggregateId: parseInt(id),
        payload: updateData,
        timestamp: Date.now()
      });

      // Trigger automatic notifications for teacher update
      await triggerEntityUpdatedNotifications(
        'teacher',
        parseInt(id),
        result.data,
        result.previousData || {},
        req.user,
        {
          auditDetails: {
            teacherId: parseInt(id),
            updatedFields: Object.keys(updateData)
          }
        }
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'updateTeacher');
    }
  }

  /**
   * Delete teacher (soft delete)
   */
  async deleteTeacher(req, res) {
    try {
      const { id } = req.params;

      const result = await teacherService.deleteTeacher(
        parseInt(id), 
        req.user.id, 
        req.user.schoolId
      );

      // Event sourcing
      eventStore.append('teacher', {
        type: 'TeacherDeleted',
        aggregateId: parseInt(id),
        payload: { id: parseInt(id) },
        timestamp: Date.now()
      });

      // Trigger automatic notifications for teacher deletion
      await triggerEntityDeletedNotifications(
        'teacher',
        parseInt(id),
        result.data || { id: parseInt(id) },
        req.user,
        {
          auditDetails: {
            teacherId: parseInt(id)
          }
        }
      );

      return createSuccessResponse(res, 200, result.message);
    } catch (error) {
      return handlePrismaError(res, error, 'deleteTeacher');
    }
  }

  /**
   * Restore deleted teacher
   */
  async restoreTeacher(req, res) {
    try {
      const { id } = req.params;

      const result = await teacherService.restoreTeacher(
        parseInt(id), 
        req.user.id, 
        req.user.schoolId
      );

      // Event sourcing
      eventStore.append('teacher', {
        type: 'TeacherRestored',
        aggregateId: parseInt(id),
        payload: { id: parseInt(id) },
        timestamp: Date.now()
      });

      return createSuccessResponse(res, 200, result.message);
    } catch (error) {
      return handlePrismaError(res, error, 'restoreTeacher');
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  /**
   * Search teachers with advanced filters
   */
  async searchTeachers(req, res) {
    try {
      const result = await teacherService.searchTeachers(
        req.query, 
        req.user.id, 
        req.user.schoolId
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'searchTeachers');
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  /**
   * Get teacher statistics
   */
  async getTeacherStats(req, res) {
    try {
      const { id } = req.params;

      const result = await teacherService.getTeacherStats(
        parseInt(id), 
        req.user.id, 
        req.user.schoolId
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getTeacherStats');
    }
  }

  /**
   * Get teacher analytics
   */
  async getTeacherAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const result = await teacherService.getTeacherAnalytics(
        parseInt(id), 
        period, 
        req.user.id, 
        req.user.schoolId
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getTeacherAnalytics');
    }
  }

  /**
   * Get teacher performance metrics
   */
  async getTeacherPerformance(req, res) {
    try {
      const { id } = req.params;

      const result = await teacherService.getTeacherPerformance(
        parseInt(id), 
        req.user.id, 
        req.user.schoolId
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getTeacherPerformance');
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  /**
   * Bulk create teachers
   */
  async bulkCreateTeachers(req, res) {
    try {
      const { teachers } = req.body;

      const result = await teacherService.bulkCreateTeachers(
        teachers, 
        req.user.id, 
        req.user.schoolId
      );

      // Event sourcing
      if (Array.isArray(result.data)) {
        result.data.forEach(teacher => {
          eventStore.append('teacher', {
            type: 'TeacherCreated',
            aggregateId: teacher.id,
            payload: teacher,
            timestamp: Date.now()
          });
        });
      }

      return createSuccessResponse(res, 201, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'bulkCreateTeachers');
    }
  }

  /**
   * Bulk update teachers
   */
  async bulkUpdateTeachers(req, res) {
    try {
      const { updates } = req.body;

      const result = await teacherService.bulkUpdateTeachers(
        updates, 
        req.user.id, 
        req.user.schoolId
      );

      // Event sourcing
      if (Array.isArray(updates)) {
        updates.forEach(update => {
          eventStore.append('teacher', {
            type: 'TeacherUpdated',
            aggregateId: update.id,
            payload: update.data,
            timestamp: Date.now()
          });
        });
      }

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'bulkUpdateTeachers');
    }
  }

  /**
   * Bulk delete teachers
   */
  async bulkDeleteTeachers(req, res) {
    try {
      const { teacherIds } = req.body;

      const result = await teacherService.bulkDeleteTeachers(
        teacherIds, 
        req.user.id, 
        req.user.schoolId
      );

      // Event sourcing
      if (Array.isArray(teacherIds)) {
        teacherIds.forEach(id => {
          eventStore.append('teacher', {
            type: 'TeacherDeleted',
            aggregateId: id,
            payload: { id },
            timestamp: Date.now()
          });
        });
      }

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'bulkDeleteTeachers');
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  /**
   * Export teachers data
   */
  async exportTeachers(req, res) {
    try {
      const { format = 'json', ...filters } = req.query;

      const result = await teacherService.exportTeachers(
        filters, 
        format, 
        req.user.id, 
        req.user.schoolId
      );

      // Set response headers
      const filename = `teachers_export_${new Date().toISOString().split('T')[0]}.${format}`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
      } else {
        res.setHeader('Content-Type', 'application/json');
      }

      return res.send(result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'exportTeachers');
    }
  }

  /**
   * Import teachers data
   */
  async importTeachers(req, res) {
    try {
      const { teachers, user } = req.body;

      const result = await teacherService.importTeachers(
        teachers, 
        user, 
        req.user.id, 
        req.user.schoolId
      );

      return createSuccessResponse(res, 201, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'importTeachers');
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  /**
   * Generate teacher code suggestions
   */
  async generateCodeSuggestions(req, res) {
    try {
      const { name, schoolId } = req.query;

      const result = await teacherService.generateCodeSuggestions(name, schoolId);

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'generateCodeSuggestions');
    }
  }

  /**
   * Get teacher count by department
   */
  async getTeacherCountByDepartment(req, res) {
    try {
      const { schoolId } = req.query;

      const result = await teacherService.getTeacherCountByDepartment(
        schoolId || req.user.schoolId
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getTeacherCountByDepartment');
    }
  }

  /**
   * Get teacher count by experience
   */
  async getTeacherCountByExperience(req, res) {
    try {
      const { schoolId } = req.query;

      const result = await teacherService.getTeacherCountByExperience(
        schoolId || req.user.schoolId
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getTeacherCountByExperience');
    }
  }

  /**
   * Get teachers by department
   */
  async getTeachersByDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const { include = [] } = req.query;

      const result = await teacherService.getTeachersByDepartment(
        parseInt(departmentId), 
        include, 
        req.user.id, 
        req.user.schoolId
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getTeachersByDepartment');
    }
  }

  /**
   * Get teachers by school
   */
  async getTeachersBySchool(req, res) {
    try {
      const { schoolId } = req.params;
      const { include = [] } = req.query;

      const result = await teacherService.getTeachersBySchool(
        parseInt(schoolId), 
        include, 
        req.user.id
      );

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getTeachersBySchool');
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  /**
   * Get cache statistics
   */
  async getCacheStats(req, res) {
    try {
      const result = await teacherService.getCacheStats();

      return createSuccessResponse(res, 200, result.message, result.data);
    } catch (error) {
      return handlePrismaError(res, error, 'getCacheStats');
    }
  }

  /**
   * Warm up cache
   */
  async warmCache(req, res) {
    try {
      const { teacherId, schoolId } = req.body;

      const result = await teacherService.warmCache(
        teacherId, 
        schoolId, 
        req.user.id
      );

      return createSuccessResponse(res, 200, result.message);
    } catch (error) {
      return handlePrismaError(res, error, 'warmCache');
    }
  }
}

export default new TeacherController(); 
import parentService from '../services/parentService.js';
import { formatResponse, handleError } from '../utils/responseUtils.js';
import logger from '../config/logger.js';

class ParentController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  async createParent(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const parentData = req.body;

      const result = await parentService.createParent(parentData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Parent created successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          createdBy: userId,
          schoolId
        }
      }, 201);

    } catch (error) {
      logger.error('Create parent controller error:', error);
      return handleError(res, error);
    }
  }

  async getParents(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const include = req.query.include;

      const result = await parentService.getParents(filters, schoolId, include);

      return formatResponse(res, {
        success: true,
        message: 'Parents retrieved successfully',
        data: result.parents,
        pagination: result.pagination,
        meta: {
          timestamp: new Date().toISOString(),
          total: result.pagination.total,
          filters,
          include
        }
      });

    } catch (error) {
      logger.error('Get parents controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentById(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const include = req.query.include;

      const result = await parentService.getParentById(parseInt(id), schoolId, include);

      return formatResponse(res, {
        success: true,
        message: 'Parent retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          include
        }
      });

    } catch (error) {
      logger.error('Get parent by ID controller error:', error);
      return handleError(res, error);
    }
  }

  async updateParent(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const updateData = req.body;

      const result = await parentService.updateParent(parseInt(id), updateData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Parent updated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          updatedBy: userId,
          changes: updateData
        }
      });

    } catch (error) {
      logger.error('Update parent controller error:', error);
      return handleError(res, error);
    }
  }

  async deleteParent(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;

      const result = await parentService.deleteParent(parseInt(id), userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: result.message,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          deletedBy: userId
        }
      });

    } catch (error) {
      logger.error('Delete parent controller error:', error);
      return handleError(res, error);
    }
  }

  async restoreParent(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;

      const result = await parentService.restoreParent(parseInt(id), userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: result.message,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          restoredBy: userId
        }
      });

    } catch (error) {
      logger.error('Restore parent controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getParentStats(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const result = await parentService.getParentStats(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Parent statistics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get parent stats controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const result = await parentService.getParentAnalytics(parseInt(id), schoolId, period);

      return formatResponse(res, {
        success: true,
        message: 'Parent analytics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          period,
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get parent analytics controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentPerformance(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const result = await parentService.getParentPerformance(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Parent performance metrics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get parent performance controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateParents(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const bulkData = req.body;

      const result = await parentService.bulkCreateParents(bulkData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: `Bulk parent creation completed. ${result.created} created, ${result.failed} failed`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          createdBy: userId,
          total: result.created + result.failed,
          successRate: ((result.created / (result.created + result.failed)) * 100).toFixed(2) + '%'
        }
      });

    } catch (error) {
      logger.error('Bulk create parents controller error:', error);
      return handleError(res, error);
    }
  }

  async bulkUpdateParents(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const bulkData = req.body;

      const result = await parentService.bulkUpdateParents(bulkData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: `Bulk parent update completed. ${result.updated} updated, ${result.failed} failed`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          updatedBy: userId,
          total: result.updated + result.failed,
          successRate: ((result.updated / (result.updated + result.failed)) * 100).toFixed(2) + '%'
        }
      });

    } catch (error) {
      logger.error('Bulk update parents controller error:', error);
      return handleError(res, error);
    }
  }

  async bulkDeleteParents(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const bulkData = req.body;

      const result = await parentService.bulkDeleteParents(bulkData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: `Bulk parent deletion completed. ${result.deleted} deleted, ${result.failed} failed`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          deletedBy: userId,
          total: result.deleted + result.failed,
          successRate: ((result.deleted / (result.deleted + result.failed)) * 100).toFixed(2) + '%'
        }
      });

    } catch (error) {
      logger.error('Bulk delete parents controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  async searchParents(req, res) {
    try {
      const { schoolId } = req.user;
      const { q: query } = req.query;
      const include = req.query.include;

      if (!query || query.trim().length < 2) {
        return formatResponse(res, {
          success: false,
          message: 'Search query must be at least 2 characters long',
          data: [],
          meta: {
            timestamp: new Date().toISOString(),
            query: query || ''
          }
        }, 400);
      }

      const result = await parentService.searchParents(query.trim(), schoolId, include);

      return formatResponse(res, {
        success: true,
        message: 'Parent search completed successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          query: query.trim(),
          total: result.length,
          include
        }
      });

    } catch (error) {
      logger.error('Search parents controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  async exportParents(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const { format = 'json' } = req.query;

      const result = await parentService.exportParents(filters, schoolId, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="parents_export_${new Date().toISOString().split('T')[0]}.csv"`);
        
        // Convert to CSV string
        const csvContent = [
          result.headers.join(','),
          ...result.data.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        return res.send(csvContent);
      }

      return formatResponse(res, {
        success: true,
        message: 'Parents exported successfully',
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          format,
          total: result.total,
          filters
        }
      });

    } catch (error) {
      logger.error('Export parents controller error:', error);
      return handleError(res, error);
    }
  }

  async importParents(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const importData = req.body;

      const result = await parentService.importParents(importData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: `Parent import completed. ${result.imported} imported, ${result.failed} failed`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          importedBy: userId,
          total: result.imported + result.failed,
          successRate: ((result.imported / (result.imported + result.failed)) * 100).toFixed(2) + '%'
        }
      });

    } catch (error) {
      logger.error('Import parents controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  async generateCodeSuggestions(req, res) {
    try {
      const { schoolId } = req.user;
      const { name } = req.query;

      if (!name || name.trim().length < 2) {
        return formatResponse(res, {
          success: false,
          message: 'Name must be at least 2 characters long',
          data: [],
          meta: {
            timestamp: new Date().toISOString(),
            name: name || ''
          }
        }, 400);
      }

      const result = await parentService.generateCodeSuggestions(name.trim(), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Code suggestions generated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          name: name.trim(),
          count: result.length
        }
      });

    } catch (error) {
      logger.error('Generate code suggestions controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentCountByIncomeRange(req, res) {
    try {
      const { schoolId } = req.user;

      const result = await parentService.getParentCountByIncomeRange(schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Parent count by income range retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get parent count by income range controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentCountByEducation(req, res) {
    try {
      const { schoolId } = req.user;

      const result = await parentService.getParentCountByEducation(schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Parent count by education retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get parent count by education controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentsBySchool(req, res) {
    try {
      const { schoolId } = req.user;
      const include = req.query.include;

      const result = await parentService.getParentsBySchool(schoolId, include);

      return formatResponse(res, {
        success: true,
        message: 'Parents by school retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId,
          total: result.length,
          include
        }
      });

    } catch (error) {
      logger.error('Get parents by school controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  async getCacheStats(req, res) {
    try {
      const result = await parentService.getCacheStats();

      return formatResponse(res, {
        success: true,
        message: 'Cache statistics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          cachePrefix: 'parent'
        }
      });

    } catch (error) {
      logger.error('Get cache stats controller error:', error);
      return handleError(res, error);
    }
  }

  async warmCache(req, res) {
    try {
      const { schoolId } = req.user;
      const { parentId } = req.body;

      const result = await parentService.warmCache(schoolId, parentId);

      return formatResponse(res, {
        success: true,
        message: result.message,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId,
          parentId: parentId || 'all'
        }
      });

    } catch (error) {
      logger.error('Warm cache controller error:', error);
      return handleError(res, error);
    }
  }

  async clearCache(req, res) {
    try {
      const { schoolId } = req.user;
      const { all } = req.query;

      const result = await parentService.clearCache(all ? null : schoolId);

      return formatResponse(res, {
        success: true,
        message: result.message,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          scope: all ? 'global' : 'school',
          schoolId: all ? null : schoolId
        }
      });

    } catch (error) {
      logger.error('Clear cache controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // ADVANCED FEATURES
  // ======================

  async getParentReport(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;

      const result = await parentService.generateParentReport(schoolId, filters);

      return formatResponse(res, {
        success: true,
        message: 'Parent report generated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          filters,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Get parent report controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentDashboard(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      // Add timeout protection for each service call
      const timeout = 15000; // 15 seconds timeout
      
      const createTimeoutPromise = (promise, serviceName) => {
        return Promise.race([
          promise,
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`${serviceName} timeout after ${timeout}ms`)), timeout)
          )
        ]);
      };

      const [stats, analytics, performance] = await Promise.allSettled([
        createTimeoutPromise(parentService.getParentStats(parseInt(id), schoolId), 'Stats'),
        createTimeoutPromise(parentService.getParentAnalytics(parseInt(id), schoolId, '30d'), 'Analytics'),
        createTimeoutPromise(parentService.getParentPerformance(parseInt(id), schoolId), 'Performance')
      ]);

      // Handle partial failures gracefully
      const dashboard = {
        stats: stats.status === 'fulfilled' ? stats.value : null,
        analytics: analytics.status === 'fulfilled' ? analytics.value : null,
        performance: performance.status === 'fulfilled' ? performance.value : null,
        summary: {
          totalStudents: stats.status === 'fulfilled' ? stats.value?.totalStudents : 0,
          totalPayments: stats.status === 'fulfilled' ? stats.value?.totalPayments : 0,
          paymentRate: performance.status === 'fulfilled' ? performance.value?.paymentPerformance?.paymentRate : 0,
          averageStudentPerformance: performance.status === 'fulfilled' ? performance.value?.overallPerformance?.averageStudentPerformance : 0,
          overallScore: performance.status === 'fulfilled' ? performance.value?.overallPerformance?.combinedScore : 0
        },
        errors: {
          stats: stats.status === 'rejected' ? stats.reason?.message : null,
          analytics: analytics.status === 'rejected' ? analytics.reason?.message : null,
          performance: performance.status === 'rejected' ? performance.reason?.message : null
        }
      };

      // Log any failures for debugging
      if (stats.status === 'rejected') logger.warn(`Stats failed: ${stats.reason?.message}`);
      if (analytics.status === 'rejected') logger.warn(`Analytics failed: ${analytics.reason?.message}`);
      if (performance.status === 'rejected') logger.warn(`Performance failed: ${performance.reason?.message}`);

      return formatResponse(res, {
        success: true,
        message: 'Parent dashboard retrieved successfully',
        data: dashboard,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          cacheStatus: 'cached',
          partialData: stats.status === 'rejected' || analytics.status === 'rejected' || performance.status === 'rejected'
        }
      });

    } catch (error) {
      logger.error('Get parent dashboard controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentComparison(req, res) {
    try {
      const { schoolId } = req.user;
      const { parentIds } = req.query;

      if (!parentIds || !Array.isArray(parentIds) || parentIds.length < 2) {
        return formatResponse(res, {
          success: false,
          message: 'At least 2 parent IDs are required for comparison',
          data: null,
          meta: {
            timestamp: new Date().toISOString()
          }
        }, 400);
      }

      const comparisons = await Promise.all(
        parentIds.map(id => parentService.getParentPerformance(parseInt(id), schoolId))
      );

      const comparison = {
        parents: comparisons,
        summary: {
          totalParents: comparisons.length,
          averagePaymentRate: comparisons.reduce((sum, p) => sum + p.paymentPerformance.paymentRate, 0) / comparisons.length,
          averageStudentPerformance: comparisons.reduce((sum, p) => sum + p.overallPerformance.averageStudentPerformance, 0) / comparisons.length,
          averageOverallScore: comparisons.reduce((sum, p) => sum + p.overallPerformance.combinedScore, 0) / comparisons.length
        }
      };

      return formatResponse(res, {
        success: true,
        message: 'Parent comparison generated successfully',
        data: comparison,
        meta: {
          timestamp: new Date().toISOString(),
          parentIds: parentIds.map(id => parseInt(id)),
          total: comparisons.length
        }
      });

    } catch (error) {
      logger.error('Get parent comparison controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // PARENT PORTAL METHODS
  // ======================

  async getParentStudents(req, res) {
    try {
      const { id } = req.params;

      console.log('🔍 getParentStudents called with parentId:', id);

      // Call the service without schoolId requirement
      const students = await parentService.getParentStudents(parseInt(id));

      console.log('✅ Found students:', students.length);

      return formatResponse(res, {
        success: true,
        message: 'Parent students retrieved successfully',
        data: students,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          totalStudents: students.length
        }
      });

    } catch (error) {
      logger.error('Get parent students controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentAttendance(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { startDate, endDate, period } = req.query;

      const attendance = await parentService.getParentStudentAttendance(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { startDate, endDate, period }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student attendance retrieved successfully',
        data: attendance,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { startDate, endDate, period }
        }
      });

    } catch (error) {
      logger.error('Get parent student attendance controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentGrades(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { academicYear, term, subject } = req.query;

      const grades = await parentService.getParentStudentGrades(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { academicYear, term, subject }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student grades retrieved successfully',
        data: grades,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { academicYear, term, subject }
        }
      });

    } catch (error) {
      logger.error('Get parent student grades controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentAssignments(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { status, subject, dueDate } = req.query;

      const assignments = await parentService.getParentStudentAssignments(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { status, subject, dueDate }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student assignments retrieved successfully',
        data: assignments,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { status, subject, dueDate }
        }
      });

    } catch (error) {
      logger.error('Get parent student assignments controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentExams(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { academicYear, term, subject } = req.query;

      const exams = await parentService.getParentStudentExams(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { academicYear, term, subject }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student exams retrieved successfully',
        data: exams,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { academicYear, term, subject }
        }
      });

    } catch (error) {
      logger.error('Get parent student exams controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentTimetable(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { weekStart, weekEnd } = req.query;

      const timetable = await parentService.getParentStudentTimetable(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { weekStart, weekEnd }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student timetable retrieved successfully',
        data: timetable,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { weekStart, weekEnd }
        }
      });

    } catch (error) {
      logger.error('Get parent student timetable controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentFees(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { status, academicYear, term } = req.query;

      const fees = await parentService.getParentStudentFees(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { status, academicYear, term }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student fees retrieved successfully',
        data: fees,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { status, academicYear, term }
        }
      });

    } catch (error) {
      logger.error('Get parent student fees controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentPayments(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { startDate, endDate, status } = req.query;

      const payments = await parentService.getParentStudentPayments(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { startDate, endDate, status }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student payments retrieved successfully',
        data: payments,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { startDate, endDate, status }
        }
      });

    } catch (error) {
      logger.error('Get parent student payments controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentReports(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { academicYear, term, type } = req.query;

      const reports = await parentService.getParentStudentReports(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { academicYear, term, type }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student reports retrieved successfully',
        data: reports,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { academicYear, term, type }
        }
      });

    } catch (error) {
      logger.error('Get parent student reports controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentDocuments(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { type, academicYear, subject } = req.query;

      const documents = await parentService.getParentStudentDocuments(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { type, academicYear, subject }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student documents retrieved successfully',
        data: documents,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { type, academicYear, subject }
        }
      });

    } catch (error) {
      logger.error('Get parent student documents controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentAnnouncements(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { limit, offset, type } = req.query;

      const announcements = await parentService.getParentStudentAnnouncements(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { limit: parseInt(limit) || 10, offset: parseInt(offset) || 0, type }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student announcements retrieved successfully',
        data: announcements,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { limit, offset, type }
        }
      });

    } catch (error) {
      logger.error('Get parent student announcements controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentStudentMessages(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, studentId } = req.params;
      const { limit, offset, unreadOnly } = req.query;

      const messages = await parentService.getParentStudentMessages(
        parseInt(id), 
        parseInt(studentId), 
        schoolId, 
        { limit: parseInt(limit) || 10, offset: parseInt(offset) || 0, unreadOnly: unreadOnly === 'true' }
      );

      return formatResponse(res, {
        success: true,
        message: 'Student messages retrieved successfully',
        data: messages,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          studentId: parseInt(studentId),
          filters: { limit, offset, unreadOnly }
        }
      });

    } catch (error) {
      logger.error('Get parent student messages controller error:', error);
      return handleError(res, error);
    }
  }

  async sendParentMessage(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const { recipientId, subject, message, priority, attachments } = req.body;

      const result = await parentService.sendParentMessage(
        parseInt(id),
        { recipientId, subject, message, priority, attachments },
        userId,
        schoolId
      );

      return formatResponse(res, {
        success: true,
        message: 'Message sent successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          sentBy: userId,
          recipientId
        }
      }, 201);

    } catch (error) {
      logger.error('Send parent message controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentNotifications(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { limit, offset, unreadOnly, type } = req.query;

      const notifications = await parentService.getParentNotifications(
        parseInt(id), 
        schoolId, 
        { limit: parseInt(limit) || 10, offset: parseInt(offset) || 0, unreadOnly: unreadOnly === 'true', type }
      );

      return formatResponse(res, {
        success: true,
        message: 'Parent notifications retrieved successfully',
        data: notifications,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          filters: { limit, offset, unreadOnly, type }
        }
      });

    } catch (error) {
      logger.error('Get parent notifications controller error:', error);
      return handleError(res, error);
    }
  }

  async markParentNotificationAsRead(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, notificationId } = req.params;

      const result = await parentService.markParentNotificationAsRead(
        parseInt(id),
        parseInt(notificationId),
        parseInt(notificationId),
        schoolId
      );

      return formatResponse(res, {
        success: true,
        message: 'Notification marked as read successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          notificationId: parseInt(notificationId)
        }
      });

    } catch (error) {
      logger.error('Mark parent notification as read controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentCalendar(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { startDate, endDate, type } = req.query;

      const calendar = await parentService.getParentCalendar(
        parseInt(id), 
        schoolId, 
        { startDate, endDate, type }
      );

      return formatResponse(res, {
        success: true,
        message: 'Parent calendar retrieved successfully',
        data: calendar,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          filters: { startDate, endDate, type }
        }
      });

    } catch (error) {
      logger.error('Get parent calendar controller error:', error);
      return handleError(res, error);
    }
  }

  async getParentSettings(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const settings = await parentService.getParentSettings(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Parent settings retrieved successfully',
        data: settings,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get parent settings controller error:', error);
      return handleError(res, error);
    }
  }

  async updateParentSettings(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const updateData = req.body;

      const result = await parentService.updateParentSettings(
        parseInt(id),
        updateData,
        userId,
        schoolId
      );

      return formatResponse(res, {
        success: true,
        message: 'Parent settings updated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          parentId: parseInt(id),
          updatedBy: userId
        }
      });

    } catch (error) {
      logger.error('Update parent settings controller error:', error);
      return handleError(res, error);
    }
  }
}

export default new ParentController(); 

import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();
import staffService from '../services/staffService.js';
import { formatResponse, handleError } from '../utils/responseUtils.js';
import logger from '../config/logger.js';

export const getAllStaffs = async (req, res) => {
  const staffs = await prisma.staff.findMany({ include: { user: true } });
  res.json(staffs);
};

export const getStaffById = async (req, res) => {
  const staff = await prisma.staff.findUnique({
    where: { id: BigInt(req.params.id) },
    include: { user: true }
  });
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  res.json(staff);
};

export const createStaff = async (req, res) => {
  try {
    // Use schoolId from user if present, otherwise from body
    const schoolId = req.user.schoolId || req.body.schoolId;
    const userId = req.user.id;
    const staffData = req.body;

    if (!schoolId) {
      throw new Error('School ID is required to create staff.');
    }

    const result = await staffService.createStaff(staffData, userId, schoolId);

    return formatResponse(res, {
      success: true,
      message: 'Staff created successfully',
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        createdBy: userId,
        schoolId
      }
    }, 201);

  } catch (error) {
    logger.error('Create staff controller error:', error);
    return handleError(res, error);
  }
};

export const updateStaff = async (req, res) => {
  const { position } = req.body;
  const staff = await prisma.staff.update({
    where: { id: BigInt(req.params.id) },
    data: { position }
  });
  res.json(staff);
};

export const deleteStaff = async (req, res) => {
  await prisma.staff.delete({ where: { id: BigInt(req.params.id) } });
  res.json({ message: 'Staff deleted' });
};

class StaffController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  async createStaff(req, res) {
    try {
      // Use schoolId from user if present, otherwise from body
      const schoolId = req.user.schoolId || req.body.schoolId;
      const userId = req.user.id;
      const staffData = req.body;

      if (!schoolId) {
        throw new Error('School ID is required to create staff.');
      }

      const result = await staffService.createStaff(staffData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff created successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          createdBy: userId,
          schoolId
        }
      }, 201);

    } catch (error) {
      logger.error('Create staff controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffByDepartment(req, res) {
    try {
      const { schoolId } = req.user;
      const { departmentId } = req.params;

      const result = await staffService.getStaffByDepartment(parseInt(departmentId), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff by department retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          departmentId: parseInt(departmentId)
        }
      });

    } catch (error) {
      logger.error('Get staff by department controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaff(req, res) {
    console.log('STAFF CONTROLLER: received request', req.method, req.url);
    console.log('Incoming query:', req.query);
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const include = req.query.include;

      const result = await staffService.getStaff(filters, schoolId, include);

      return formatResponse(res, {
        success: true,
        message: 'Staff retrieved successfully',
        data: result.staff,
        pagination: result.pagination,
        meta: {
          timestamp: new Date().toISOString(),
          total: result.pagination.total,
          filters,
          include
        }
      });

    } catch (error) {
      logger.error('Get staff controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffById(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const include = req.query.include;

      const result = await staffService.getStaffById(parseInt(id), schoolId, include);

      return formatResponse(res, {
        success: true,
        message: 'Staff retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          include
        }
      });

    } catch (error) {
      logger.error('Get staff by ID controller error:', error);
      return handleError(res, error);
    }
  }

  async updateStaff(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const updateData = req.body;

      const result = await staffService.updateStaff(parseInt(id), updateData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff updated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          updatedBy: userId,
          changes: updateData
        }
      });

    } catch (error) {
      logger.error('Update staff controller error:', error);
      return handleError(res, error);
    }
  }

  async deleteStaff(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;

      const result = await staffService.deleteStaff(parseInt(id), userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: result.message,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          deletedBy: userId
        }
      });

    } catch (error) {
      logger.error('Delete staff controller error:', error);
      return handleError(res, error);
    }
  }

  async restoreStaff(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;

      const result = await staffService.restoreStaff(parseInt(id), userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: result.message,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          restoredBy: userId
        }
      });

    } catch (error) {
      logger.error('Restore staff controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getStaffStats(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const result = await staffService.getStaffStats(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff statistics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get staff stats controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const result = await staffService.getStaffAnalytics(parseInt(id), schoolId, period);

      return formatResponse(res, {
        success: true,
        message: 'Staff analytics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          period,
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get staff analytics controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffPerformance(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const result = await staffService.getStaffPerformance(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff performance metrics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get staff performance controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateStaff(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const bulkData = req.body;

      const result = await staffService.bulkCreateStaff(bulkData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: `Bulk staff creation completed. ${result.created} created, ${result.failed} failed`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          createdBy: userId,
          total: result.created + result.failed,
          successRate: ((result.created / (result.created + result.failed)) * 100).toFixed(2) + '%'
        }
      });

    } catch (error) {
      logger.error('Bulk create staff controller error:', error);
      return handleError(res, error);
    }
  }

  async bulkUpdateStaff(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const bulkData = req.body;

      const result = await staffService.bulkUpdateStaff(bulkData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: `Bulk staff update completed. ${result.updated} updated, ${result.failed} failed`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          updatedBy: userId,
          total: result.updated + result.failed,
          successRate: ((result.updated / (result.updated + result.failed)) * 100).toFixed(2) + '%'
        }
      });

    } catch (error) {
      logger.error('Bulk update staff controller error:', error);
      return handleError(res, error);
    }
  }

  async bulkDeleteStaff(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const bulkData = req.body;

      const result = await staffService.bulkDeleteStaff(bulkData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: `Bulk staff deletion completed. ${result.deleted} deleted, ${result.failed} failed`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          deletedBy: userId,
          total: result.deleted + result.failed,
          successRate: ((result.deleted / (result.deleted + result.failed)) * 100).toFixed(2) + '%'
        }
      });

    } catch (error) {
      logger.error('Bulk delete staff controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  async searchStaff(req, res) {
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

      const result = await staffService.searchStaff(query.trim(), schoolId, include);

      return formatResponse(res, {
        success: true,
        message: 'Staff search completed successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          query: query.trim(),
          total: result.length,
          include
        }
      });

    } catch (error) {
      logger.error('Search staff controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  async exportStaff(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const { format = 'json' } = req.query;

      const result = await staffService.exportStaff(filters, schoolId, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="staff_export_${new Date().toISOString().split('T')[0]}.csv"`);
        
        // Convert to CSV string
        const csvContent = [
          result.headers.join(','),
          ...result.data.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        return res.send(csvContent);
      }

      return formatResponse(res, {
        success: true,
        message: 'Staff exported successfully',
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          format,
          total: result.total,
          filters
        }
      });

    } catch (error) {
      logger.error('Export staff controller error:', error);
      return handleError(res, error);
    }
  }

  async importStaff(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const importData = req.body;

      const result = await staffService.importStaff(importData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: `Staff import completed. ${result.imported} imported, ${result.failed} failed`,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          importedBy: userId,
          total: result.imported + result.failed,
          successRate: ((result.imported / (result.imported + result.failed)) * 100).toFixed(2) + '%'
        }
      });

    } catch (error) {
      logger.error('Import staff controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  async generateEmployeeIdSuggestions(req, res) {
    try {
      const { schoolId } = req.user;
      const { designation } = req.query;

      if (!designation || designation.trim().length < 2) {
        return formatResponse(res, {
          success: false,
          message: 'Designation must be at least 2 characters long',
          data: [],
          meta: {
            timestamp: new Date().toISOString(),
            designation: designation || ''
          }
        }, 400);
      }

      const result = await staffService.generateEmployeeIdSuggestions(designation.trim(), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Employee ID suggestions generated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          designation: designation.trim(),
          count: result.length
        }
      });

    } catch (error) {
      logger.error('Generate employee ID suggestions controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffCountByDepartment(req, res) {
    try {
      const { schoolId } = req.user;

      const result = await staffService.getStaffCountByDepartment(schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff count by department retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get staff count by department controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffCountByDesignation(req, res) {
    try {
      const { schoolId } = req.user;

      const result = await staffService.getStaffCountByDesignation(schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff count by designation retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get staff count by designation controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffBySchool(req, res) {
    try {
      const { schoolId } = req.user;
      const include = req.query.include;

      const result = await staffService.getStaffBySchool(schoolId, include);

      return formatResponse(res, {
        success: true,
        message: 'Staff by school retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId,
          total: result.length,
          include
        }
      });

    } catch (error) {
      logger.error('Get staff by school controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  async getCacheStats(req, res) {
    try {
      const result = await staffService.getCacheStats();

      return formatResponse(res, {
        success: true,
        message: 'Cache statistics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          cachePrefix: 'staff'
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
      const { staffId } = req.body;

      const result = await staffService.warmCache(schoolId, staffId);

      return formatResponse(res, {
        success: true,
        message: result.message,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId,
          staffId: staffId || 'all'
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

      const result = await staffService.clearCache(all ? null : schoolId);

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

  async getStaffReport(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;

      const result = await staffService.generateStaffReport(schoolId, filters);

      return formatResponse(res, {
        success: true,
        message: 'Staff report generated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          filters,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Get staff report controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffDashboard(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const [stats, analytics, performance] = await Promise.all([
        staffService.getStaffStats(parseInt(id), schoolId),
        staffService.getStaffAnalytics(parseInt(id), schoolId, '30d'),
        staffService.getStaffPerformance(parseInt(id), schoolId)
      ]);

      const dashboard = {
        stats,
        analytics,
        performance,
        summary: {
          experience: stats.experience,
          attendanceRate: analytics.attendanceRate,
          totalEarnings: stats.totalEarnings,
          averageEarnings: stats.averageSalary,
          overallScore: performance.overallPerformance.combinedScore
        }
      };

      return formatResponse(res, {
        success: true,
        message: 'Staff dashboard retrieved successfully',
        data: dashboard,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          cacheStatus: 'cached'
        }
      });

    } catch (error) {
      logger.error('Get staff dashboard controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffComparison(req, res) {
    try {
      const { schoolId } = req.user;
      const { staffIds } = req.query;

      if (!staffIds || !Array.isArray(staffIds) || staffIds.length < 2) {
        return formatResponse(res, {
          success: false,
          message: 'At least 2 staff IDs are required for comparison',
          data: null,
          meta: {
            timestamp: new Date().toISOString()
          }
        }, 400);
      }

      const comparisons = await Promise.all(
        staffIds.map(id => staffService.getStaffPerformance(parseInt(id), schoolId))
      );

      const comparison = {
        staff: comparisons,
        summary: {
          totalStaff: comparisons.length,
          averageAttendanceRate: comparisons.reduce((sum, s) => sum + parseFloat(s.attendancePerformance.attendanceRate), 0) / comparisons.length,
          averageEarnings: comparisons.reduce((sum, s) => sum + s.financialPerformance.averageEarnings, 0) / comparisons.length,
          averageExperience: comparisons.reduce((sum, s) => sum + s.overallPerformance.experience, 0) / comparisons.length
        }
      };

      return formatResponse(res, {
        success: true,
        message: 'Staff comparison generated successfully',
        data: comparison,
        meta: {
          timestamp: new Date().toISOString(),
          staffIds: staffIds.map(id => parseInt(id)),
          total: comparisons.length
        }
      });

    } catch (error) {
      logger.error('Get staff comparison controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // COLLABORATION METHODS
  // ======================

  async getStaffCollaboration(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const result = await staffService.getStaffCollaboration(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff collaboration data retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get staff collaboration controller error:', error);
      return handleError(res, error);
    }
  }

  async createStaffCollaboration(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const collaborationData = req.body;

      const result = await staffService.createStaffCollaboration(parseInt(id), collaborationData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff collaboration created successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          createdBy: userId
        }
      }, 201);

    } catch (error) {
      logger.error('Create staff collaboration controller error:', error);
      return handleError(res, error);
    }
  }

  async updateStaffCollaboration(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id, collaborationId } = req.params;
      const updateData = req.body;

      const result = await staffService.updateStaffCollaboration(parseInt(id), parseInt(collaborationId), updateData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff collaboration updated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          collaborationId: parseInt(collaborationId),
          updatedBy: userId
        }
      });

    } catch (error) {
      logger.error('Update staff collaboration controller error:', error);
      return handleError(res, error);
    }
  }

  async deleteStaffCollaboration(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id, collaborationId } = req.params;

      const result = await staffService.deleteStaffCollaboration(parseInt(id), parseInt(collaborationId), userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff collaboration deleted successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          collaborationId: parseInt(collaborationId),
          deletedBy: userId
        }
      });

    } catch (error) {
      logger.error('Delete staff collaboration controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffProjects(req, res) {
    try {
      const schoolId = req.query.schoolId || req.user?.schoolId;
      if (!schoolId) {
        return res.status(400).json({ success: false, error: 'No schoolId found for user' });
      }
      const { id } = req.params;

      const result = await staffService.getStaffProjects(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff projects retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get staff projects controller error:', error);
      return handleError(res, error);
    }
  }

  async createStaffProject(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const projectData = req.body;

      const result = await staffService.createStaffProject(parseInt(id), projectData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff project created successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          createdBy: userId
        }
      }, 201);

    } catch (error) {
      logger.error('Create staff project controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffTeams(req, res) {
    try {
      const schoolId = req.query.schoolId || req.user?.schoolId;
      if (!schoolId) {
        return res.status(400).json({ success: false, error: 'No schoolId found for user' });
      }
      const { id } = req.params;

      const result = await staffService.getStaffTeams(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff teams retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get staff teams controller error:', error);
      return handleError(res, error);
    }
  }

  async assignStaffToTeam(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const teamData = req.body;

      const result = await staffService.assignStaffToTeam(parseInt(id), teamData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff assigned to team successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          assignedBy: userId
        }
      });

    } catch (error) {
      logger.error('Assign staff to team controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffMeetings(req, res) {
    try {
      const schoolId = req.query.schoolId || req.user?.schoolId;
      if (!schoolId) {
        return res.status(400).json({ success: false, error: 'No schoolId found for user' });
      }
      const { id } = req.params;

      const result = await staffService.getStaffMeetings(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff meetings retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get staff meetings controller error:', error);
      return handleError(res, error);
    }
  }

  async scheduleStaffMeeting(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const meetingData = req.body;

      const result = await staffService.scheduleStaffMeeting(parseInt(id), meetingData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff meeting scheduled successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          scheduledBy: userId
        }
      }, 201);

    } catch (error) {
      logger.error('Schedule staff meeting controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // DOCUMENTS METHODS
  // ======================

  async getStaffDocuments(req, res) {
    try {
      const schoolId = req.query.schoolId || req.user?.schoolId;
      if (!schoolId) {
        return res.status(400).json({ success: false, error: 'No schoolId found for user' });
      }
      const { id } = req.params;
      const filters = req.query;

      const result = await staffService.getStaffDocuments(parseInt(id), schoolId, filters);

      return formatResponse(res, {
        success: true,
        message: 'Staff documents retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          filters
        }
      });

    } catch (error) {
      logger.error('Get staff documents controller error:', error);
      return handleError(res, error);
    }
  }

  async uploadStaffDocument(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const documentData = req.body;
      const file = req.file;

      const result = await staffService.uploadStaffDocument(parseInt(id), documentData, file, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff document uploaded successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          uploadedBy: userId,
          fileSize: file?.size,
          fileType: file?.mimetype
        }
      }, 201);

    } catch (error) {
      logger.error('Upload staff document controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffDocument(req, res) {
    try {
      const schoolId = req.query.schoolId || req.user?.schoolId;
      if (!schoolId) {
        return res.status(400).json({ success: false, error: 'No schoolId found for user' });
      }
      const { id, documentId } = req.params;

      const result = await staffService.getStaffDocument(parseInt(id), parseInt(documentId), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff document retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          documentId: parseInt(documentId)
        }
      });

    } catch (error) {
      logger.error('Get staff document controller error:', error);
      return handleError(res, error);
    }
  }

  async updateStaffDocument(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id, documentId } = req.params;
      const updateData = req.body;

      const result = await staffService.updateStaffDocument(parseInt(id), parseInt(documentId), updateData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff document updated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          documentId: parseInt(documentId),
          updatedBy: userId
        }
      });

    } catch (error) {
      logger.error('Update staff document controller error:', error);
      return handleError(res, error);
    }
  }

  async deleteStaffDocument(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id, documentId } = req.params;

      const result = await staffService.deleteStaffDocument(parseInt(id), parseInt(documentId), userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff document deleted successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          documentId: parseInt(documentId),
          deletedBy: userId
        }
      });

    } catch (error) {
      logger.error('Delete staff document controller error:', error);
      return handleError(res, error);
    }
  }

  async getDocumentCategories(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const result = await staffService.getDocumentCategories(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Document categories retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get document categories controller error:', error);
      return handleError(res, error);
    }
  }

  async createDocumentCategory(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const categoryData = req.body;

      const result = await staffService.createDocumentCategory(parseInt(id), categoryData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Document category created successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          createdBy: userId
        }
      }, 201);

    } catch (error) {
      logger.error('Create document category controller error:', error);
      return handleError(res, error);
    }
  }

  async searchStaffDocuments(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const searchQuery = req.query;

      const result = await staffService.searchStaffDocuments(parseInt(id), searchQuery, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff documents search completed successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          searchQuery
        }
      });

    } catch (error) {
      logger.error('Search staff documents controller error:', error);
      return handleError(res, error);
    }
  }

  async verifyStaffDocument(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const verificationData = req.body;

      const result = await staffService.verifyStaffDocument(parseInt(id), verificationData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff document verified successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          verifiedBy: userId
        }
      });

    } catch (error) {
      logger.error('Verify staff document controller error:', error);
      return handleError(res, error);
    }
  }

  async getExpiringDocuments(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { days } = req.query;

      const result = await staffService.getExpiringDocuments(parseInt(id), parseInt(days) || 30, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Expiring documents retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          days: parseInt(days) || 30
        }
      });

    } catch (error) {
      logger.error('Get expiring documents controller error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // TASKS METHODS
  // ======================

  async getStaffTasks(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const filters = req.query;

      const result = await staffService.getStaffTasks(parseInt(id), schoolId, filters);

      return formatResponse(res, {
        success: true,
        message: 'Staff tasks retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          filters
        }
      });

    } catch (error) {
      logger.error('Get staff tasks controller error:', error);
      return handleError(res, error);
    }
  }

  async createStaffTask(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const taskData = req.body;

      const result = await staffService.createStaffTask(parseInt(id), taskData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff task created successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          createdBy: userId
        }
      }, 201);

    } catch (error) {
      logger.error('Create staff task controller error:', error);
      return handleError(res, error);
    }
  }

  async getStaffTask(req, res) {
    try {
      const { schoolId } = req.user;
      const { id, taskId } = req.params;

      const result = await staffService.getStaffTask(parseInt(id), parseInt(taskId), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff task retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          taskId: parseInt(taskId)
        }
      });

    } catch (error) {
      logger.error('Get staff task controller error:', error);
      return handleError(res, error);
    }
  }

  async updateStaffTask(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id, taskId } = req.params;
      const updateData = req.body;

      const result = await staffService.updateStaffTask(parseInt(id), parseInt(taskId), updateData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff task updated successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          taskId: parseInt(taskId),
          updatedBy: userId
        }
      });

    } catch (error) {
      logger.error('Update staff task controller error:', error);
      return handleError(res, error);
    }
  }

  async deleteStaffTask(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id, taskId } = req.params;

      const result = await staffService.deleteStaffTask(parseInt(id), parseInt(taskId), userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff task deleted successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          taskId: parseInt(taskId),
          deletedBy: userId
        }
      });

    } catch (error) {
      logger.error('Delete staff task controller error:', error);
      return handleError(res, error);
    }
  }

  async assignStaffTask(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id, taskId } = req.params;
      const assignmentData = req.body;

      const result = await staffService.assignStaffTask(parseInt(id), parseInt(taskId), assignmentData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff task assigned successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          taskId: parseInt(taskId),
          assignedBy: userId
        }
      });

    } catch (error) {
      logger.error('Assign staff task controller error:', error);
      return handleError(res, error);
    }
  }

  async completeStaffTask(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id, taskId } = req.params;
      const completionData = req.body;

      const result = await staffService.completeStaffTask(parseInt(id), parseInt(taskId), completionData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Staff task completed successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          taskId: parseInt(taskId),
          completedBy: userId
        }
      });

    } catch (error) {
      logger.error('Complete staff task controller error:', error);
      return handleError(res, error);
    }
  }

  async getOverdueTasks(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const result = await staffService.getOverdueTasks(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Overdue tasks retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get overdue tasks controller error:', error);
      return handleError(res, error);
    }
  }

  async getCompletedTasks(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const filters = req.query;

      const result = await staffService.getCompletedTasks(parseInt(id), schoolId, filters);

      return formatResponse(res, {
        success: true,
        message: 'Completed tasks retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          filters
        }
      });

    } catch (error) {
      logger.error('Get completed tasks controller error:', error);
      return handleError(res, error);
    }
  }

  async getTaskStatistics(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const result = await staffService.getTaskStatistics(parseInt(id), schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Task statistics retrieved successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get task statistics controller error:', error);
      return handleError(res, error);
    }
  }

  async bulkAssignTasks(req, res) {
    try {
      const { schoolId } = req.user;
      const userId = req.user.id;
      const { id } = req.params;
      const bulkData = req.body;

      const result = await staffService.bulkAssignTasks(parseInt(id), bulkData, userId, schoolId);

      return formatResponse(res, {
        success: true,
        message: 'Tasks bulk assigned successfully',
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          staffId: parseInt(id),
          assignedBy: userId,
          totalTasks: bulkData.tasks?.length || 0
        }
      });

    } catch (error) {
      logger.error('Bulk assign tasks controller error:', error);
      return handleError(res, error);
    }
  }
}

export default new StaffController(); 
import schoolService from '../services/schoolService.js';
import { 
  SchoolCreateSchema,
  SchoolUpdateSchema,
  SchoolSearchSchema
} from '../utils/schoolSchemas.js';
import { convertBigIntToString } from '../utils/responseUtils.js';
import { 
  getSchoolFromCache,
  getSchoolsFromCache,
  getSchoolStatsFromCache,
  getSchoolAnalyticsFromCache,
  getSchoolPerformanceFromCache,
  getSchoolSearchFromCache,
  getSchoolExportFromCache,
  getCacheStats,
  warmSchoolCache,
  warmSchoolSpecificCache,
  clearSchoolPerformanceCache,
} from '../cache/schoolCache.js';

// ======================
// RESPONSE HELPERS
// ======================

const createResponse = (success, data = null, message = '', error = null, meta = {}) => {
  return {
    success,
    data,
    message,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
};

const createErrorResponse = (error, statusCode = 500, details = null) => {
  return {
    success: false,
    error: error.message || 'Internal server error',
    details,
    meta: {
      timestamp: new Date().toISOString(),
      statusCode
    }
  };
};

// ======================
// SCHOOL CONTROLLER
// ======================

class SchoolController {
  constructor() {
    this.service = schoolService;
  }

  // ======================
  // CRUD OPERATIONS
  // ======================

  /**
   * Create a new school
   * POST /api/schools
   */
  async createSchool(req, res) {
    try {
      const { body, user } = req;
      
      // Validate request body
      const validation = SchoolCreateSchema.safeParse(body);
      if (!validation.success) {
        return res.status(400).json(createErrorResponse(
          new Error('Validation failed'),
          400,
          validation.error.errors
        ));
      }
      
      // Create school
      const result = await this.service.createSchool(body, user?.id);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400,
          result.details
        ));
      }
      
      return res.status(201).json(createResponse(
        true,
        convertBigIntToString(result.data),
        result.message,
        null,
        { source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error creating school:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Get school by ID
   * GET /api/schools/:id
   */
  async getSchoolById(req, res) {
    try {
      const { id } = req.params;
      const { include } = req.query;
      
      // Validate school ID
      if (!id || isNaN(id)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid school ID'),
          400
        ));
      }
      
      // Get school
      const result = await this.service.getSchoolById(id, include);
      
      if (!result.success) {
        return res.status(404).json(createErrorResponse(
          new Error(result.error),
          404
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        convertBigIntToString(result.data),
        'School retrieved successfully',
        null,
        { source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error getting school:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Get schools with pagination and filters
   * GET /api/schools
   */
  async getSchools(req, res) {
    try {
      const { query } = req;
      
      // Validate query parameters
      const validation = SchoolSearchSchema.safeParse(query);
      if (!validation.success) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid query parameters'),
          400,
          validation.error.errors
        ));
      }
      
      // Get schools
      const result = await this.service.getSchools(validation.data);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400,
          result.details
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        convertBigIntToString(result.data),
        'Schools retrieved successfully',
        null,
        { source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error getting schools:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Update school
   * PUT /api/schools/:id
   */
  async updateSchool(req, res) {
    try {
      const { id } = req.params;
      const { body, user } = req;
      
      // Validate school ID
      if (!id || isNaN(id)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid school ID'),
          400
        ));
      }
      
      // Validate request body
      const validation = SchoolUpdateSchema.safeParse(body);
      if (!validation.success) {
        return res.status(400).json(createErrorResponse(
          new Error('Validation failed'),
          400,
          validation.error.errors
        ));
      }
      
      // Update school
      const result = await this.service.updateSchool(id, body, user?.id);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400,
          result.details
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        convertBigIntToString(result.data),
        result.message,
        null,
        { source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error updating school:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Delete school (soft delete)
   * DELETE /api/schools/:id
   */
  async deleteSchool(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      
      // Validate school ID
      if (!id || isNaN(id)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid school ID'),
          400
        ));
      }
      
      // Delete school
      const result = await this.service.deleteSchool(id, user?.id);
      
      if (!result.success) {
        return res.status(404).json(createErrorResponse(
          new Error(result.error),
          404
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        result.message
      ));
    } catch (error) {
      console.error('Error deleting school:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Restore deleted school
   * PATCH /api/schools/:id/restore
   */
  async restoreSchool(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      
      // Validate school ID
      if (!id || isNaN(id)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid school ID'),
          400
        ));
      }
      
      // Restore school
      const result = await this.service.restoreSchool(id, user?.id);
      
      if (!result.success) {
        return res.status(404).json(createErrorResponse(
          new Error(result.error),
          404
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        result.message
      ));
    } catch (error) {
      console.error('Error restoring school:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  /**
   * Bulk create schools
   * POST /api/schools/bulk
   */
  async bulkCreateSchools(req, res) {
    try {
      const { schools, user } = req.body;
      
      if (!Array.isArray(schools) || schools.length === 0) {
        return res.status(400).json(createErrorResponse(
          new Error('Schools array is required and cannot be empty'),
          400
        ));
      }
      
      if (schools.length > 100) {
        return res.status(400).json(createErrorResponse(
          new Error('Cannot create more than 100 schools at once'),
          400
        ));
      }
      
      // Bulk create schools
      const result = await this.service.bulkCreateSchools(schools, user?.id);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      return res.status(201).json(createResponse(
        true,
        result.data,
        result.message
      ));
    } catch (error) {
      console.error('Error bulk creating schools:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Bulk update schools
   * PUT /api/schools/bulk
   */
  async bulkUpdateSchools(req, res) {
    try {
      const { updates, user } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json(createErrorResponse(
          new Error('Updates array is required and cannot be empty'),
          400
        ));
      }
      
      if (updates.length > 50) {
        return res.status(400).json(createErrorResponse(
          new Error('Cannot update more than 50 schools at once'),
          400
        ));
      }
      
      // Bulk update schools
      const result = await this.service.bulkUpdateSchools(updates, user?.id);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        result.message
      ));
    } catch (error) {
      console.error('Error bulk updating schools:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Bulk delete schools
   * DELETE /api/schools/bulk
   */
  async bulkDeleteSchools(req, res) {
    try {
      const { schoolIds, user } = req.body;
      
      if (!Array.isArray(schoolIds) || schoolIds.length === 0) {
        return res.status(400).json(createErrorResponse(
          new Error('School IDs array is required and cannot be empty'),
          400
        ));
      }
      
      if (schoolIds.length > 50) {
        return res.status(400).json(createErrorResponse(
          new Error('Cannot delete more than 50 schools at once'),
          400
        ));
      }
      
      // Bulk delete schools
      const result = await this.service.bulkDeleteSchools(schoolIds, user?.id);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        result.message
      ));
    } catch (error) {
      console.error('Error bulk deleting schools:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  /**
   * Get school statistics
   * GET /api/schools/:id/stats
   */
  async getSchoolStats(req, res) {
    try {
      const { id } = req.params;
      
      // Validate school ID
      if (!id || isNaN(id)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid school ID'),
          400
        ));
      }
      
      // Get school stats
      const result = await this.service.getSchoolStats(id);
      
      if (!result.success) {
        return res.status(404).json(createErrorResponse(
          new Error(result.error),
          404
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'School statistics retrieved successfully',
        null,
        { source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error getting school stats:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Get school analytics
   * GET /api/schools/:id/analytics
   */
  async getSchoolAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { period = '30d' } = req.query;
      
      // Validate school ID
      if (!id || isNaN(id)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid school ID'),
          400
        ));
      }
      
      // Validate period
      const validPeriods = ['7d', '30d', '90d', '1y'];
      if (!validPeriods.includes(period)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid period. Must be one of: 7d, 30d, 90d, 1y'),
          400
        ));
      }
      
      // Get school analytics
      const result = await this.service.getSchoolAnalytics(id, period);
      
      if (!result.success) {
        return res.status(404).json(createErrorResponse(
          new Error(result.error),
          404
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'School analytics retrieved successfully',
        null,
        { source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error getting school analytics:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Get school performance metrics
   * GET /api/schools/:id/performance
   */
  async getSchoolPerformance(req, res) {
    try {
      const { id } = req.params;
      
      // Validate school ID
      if (!id || isNaN(id)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid school ID'),
          400
        ));
      }
      
      // Get school performance
      const result = await this.service.getSchoolPerformance(id);
      
      if (!result.success) {
        return res.status(404).json(createErrorResponse(
          new Error(result.error),
          404
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'School performance metrics retrieved successfully',
        null,
        { source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error getting school performance:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  /**
   * Search schools with advanced filters
   * GET /api/schools/search
   */
  async searchSchools(req, res) {
    try {
      const { query } = req;
      
      // Validate query parameters
      const validation = SchoolSearchSchema.safeParse(query);
      if (!validation.success) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid search parameters'),
          400,
          validation.error.errors
        ));
      }
      
      // Search schools
      const result = await this.service.searchSchools(validation.data);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400,
          result.details
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'School search completed successfully',
        null,
        { source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error searching schools:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  /**
   * Export schools data
   * GET /api/schools/export
   */
  async exportSchools(req, res) {
    try {
      const { format = 'json', ...filters } = req.query;
      
      // Validate format
      const validFormats = ['json', 'csv'];
      if (!validFormats.includes(format)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid format. Must be one of: json, csv'),
          400
        ));
      }
      
      // Export schools
      const result = await this.service.exportSchools(filters, format);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      // Set response headers for file download
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="schools.csv"');
        return res.status(200).send(result.data);
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'Schools exported successfully',
        null,
        { format, source: result.source || 'database' }
      ));
    } catch (error) {
      console.error('Error exporting schools:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Import schools data
   * POST /api/schools/import
   */
  async importSchools(req, res) {
    try {
      const { schools, user } = req.body;
      
      if (!Array.isArray(schools) || schools.length === 0) {
        return res.status(400).json(createErrorResponse(
          new Error('Schools array is required and cannot be empty'),
          400
        ));
      }
      
      if (schools.length > 1000) {
        return res.status(400).json(createErrorResponse(
          new Error('Cannot import more than 1000 schools at once'),
          400
        ));
      }
      
      // Import schools
      const result = await this.service.importSchools(schools, user?.id);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400,
          result.details
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        result.message
      ));
    } catch (error) {
      console.error('Error importing schools:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  /**
   * Generate school code suggestions
   * GET /api/schools/suggestions/code
   */
  async generateCodeSuggestions(req, res) {
    try {
      const { name } = req.query;
      
      if (!name || name.trim().length < 2) {
        return res.status(400).json(createErrorResponse(
          new Error('School name is required and must be at least 2 characters'),
          400
        ));
      }
      
      // Generate suggestions
      const result = await this.service.generateCodeSuggestions(name.trim());
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'Code suggestions generated successfully'
      ));
    } catch (error) {
      console.error('Error generating code suggestions:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Get school count by status
   * GET /api/schools/stats/status
   */
  async getSchoolCountByStatus(req, res) {
    try {
      const result = await this.service.getSchoolCountByStatus();
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'School count by status retrieved successfully'
      ));
    } catch (error) {
      console.error('Error getting school count by status:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Get school count by location
   * GET /api/schools/stats/location
   */
  async getSchoolCountByLocation(req, res) {
    try {
      const result = await this.service.getSchoolCountByLocation();
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'School count by location retrieved successfully'
      ));
    } catch (error) {
      console.error('Error getting school count by location:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Get schools by owner
   * GET /api/schools/owner/:ownerId
   */
  async getSchoolsByOwner(req, res) {
    try {
      const { ownerId } = req.params;
      const { include } = req.query;
      
      // Validate owner ID
      if (!ownerId || isNaN(ownerId)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid owner ID'),
          400
        ));
      }
      
      // Get schools by owner
      const result = await this.service.getSchoolsByOwner(ownerId, include);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'Schools by owner retrieved successfully'
      ));
    } catch (error) {
      console.error('Error getting schools by owner:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Get schools by status
   * GET /api/schools/status/:status
   */
  async getSchoolsByStatus(req, res) {
    try {
      const { status } = req.params;
      const { include } = req.query;
      
      // Validate status
      const validStatuses = ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json(createErrorResponse(
          new Error('Invalid status. Must be one of: ACTIVE, INACTIVE, PENDING, SUSPENDED'),
          400
        ));
      }
      
      // Get schools by status
      const result = await this.service.getSchoolsByStatus(status, include);
      
      if (!result.success) {
        return res.status(400).json(createErrorResponse(
          new Error(result.error),
          400
        ));
      }
      
      return res.status(200).json(createResponse(
        true,
        result.data,
        'Schools by status retrieved successfully'
      ));
    } catch (error) {
      console.error('Error getting schools by status:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  /**
   * Get cache statistics
   * GET /api/schools/cache/stats
   */
  async getCacheStats(req, res) {
    try {
      const stats = getCacheStats();
      
      return res.status(200).json(createResponse(
        true,
        stats,
        'Cache statistics retrieved successfully'
      ));
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Warm up cache
   * POST /api/schools/cache/warm
   */
  async warmCache(req, res) {
    try {
      const { schoolId } = req.body;
      
      if (schoolId) {
        // Warm specific school cache
        await warmSchoolSpecificCache(schoolId, this.service.prisma);
        return res.status(200).json(createResponse(
          true,
          null,
          `Cache warmed for school ${schoolId}`
        ));
      } else {
        // Warm general cache
        await warmSchoolCache(this.service.prisma);
        return res.status(200).json(createResponse(
          true,
          null,
          'General cache warmed successfully'
        ));
      }
    } catch (error) {
      console.error('Error warming cache:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }

  /**
   * Clear performance cache
   * POST /api/schools/cache/clear-performance
   */
  async clearPerformanceCache(req, res) {
    try {
      const { schoolId } = req.body;
      
      if (schoolId) {
        // Clear specific school performance cache
        clearSchoolPerformanceCache(schoolId);
        return res.status(200).json(createResponse(
          true,
          null,
          `Performance cache cleared for school ${schoolId}`
        ));
      } else {
        // Clear all performance cache
        clearSchoolPerformanceCache();
        return res.status(200).json(createResponse(
          true,
          null,
          'All performance cache cleared successfully'
        ));
      }
    } catch (error) {
      console.error('Error clearing performance cache:', error);
      return res.status(500).json(createErrorResponse(error));
    }
  }
}

// ======================
// CONTROLLER INSTANCE
// ======================

const schoolController = new SchoolController();

export default schoolController; 
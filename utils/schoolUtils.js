import { PrismaClient } from '../generated/prisma/client.js';
import { 
  SchoolCreateSchema, 
  SchoolUpdateSchema, 
  SchoolSearchSchema,
  generateSchoolCode,
  formatPhoneNumber,
  validateCoordinates,
  generateSchoolStats,
  generateSchoolAnalytics,
  buildSchoolSearchQuery,
  buildSchoolIncludeQuery,
  generateSchoolExportData,
  validateSchoolImportData,
  generateSchoolCodeSuggestions,
  calculateSchoolPerformance,
} from '../utils/schoolSchemas.js';
import {
  getSchoolFromCache,
  setSchoolInCache,
  getSchoolsFromCache,
  setSchoolsInCache,
  getSchoolCountFromCache,
  setSchoolCountInCache,
  getSchoolStatsFromCache,
  setSchoolStatsInCache,
  getSchoolAnalyticsFromCache,
  setSchoolAnalyticsInCache,
  getSchoolPerformanceFromCache,
  setSchoolPerformanceInCache,
  getSchoolSearchFromCache,
  setSchoolSearchInCache,
  getSchoolExportFromCache,
  setSchoolExportInCache,
  invalidateSchoolCacheOnCreate,
  invalidateSchoolCacheOnUpdate,
  invalidateSchoolCacheOnDelete,
  invalidateSchoolCacheOnBulkOperation,
} from '../cache/schoolCache.js';

const prisma = new PrismaClient();

// ======================
// SCHOOL SERVICE CLASS
// ======================

class SchoolService {
  constructor() {
    this.prisma = prisma;
  }

  // ======================
  // CRUD OPERATIONS
  // ======================

  /**
   * Create a new school
   */
  async createSchool(schoolData, createdBy) {
    try {
      // Validate input data
      const validatedData = SchoolCreateSchema.parse(schoolData);
      
      // Check if school code already exists
      const existingSchool = await this.prisma.school.findUnique({
        where: { code: validatedData.code }
      });
      
      if (existingSchool) {
        throw new Error('School code already exists');
      }
      
      // Check if email already exists
      const existingEmail = await this.prisma.school.findUnique({
        where: { email: validatedData.email }
      });
      
      if (existingEmail) {
        throw new Error('School email already exists');
      }
      
      // Format phone number
      if (validatedData.phone) {
        validatedData.phone = formatPhoneNumber(validatedData.phone);
      }
      
      // Validate coordinates
      if (validatedData.latitude || validatedData.longitude) {
        validateCoordinates(validatedData.latitude, validatedData.longitude);
      }
      
      // Create school
      const school = await this.prisma.school.create({
        data: {
          ...validatedData,
          ownerId: BigInt(validatedData.ownerId),
          academicSessionId: validatedData.academicSessionId ? BigInt(validatedData.academicSessionId) : null,
          currentTermId: validatedData.currentTermId ? BigInt(validatedData.currentTermId) : null,
          createdBy: createdBy ? BigInt(createdBy) : null,
        },
        include: {
          owner: true,
          academicSessions: {
            take: 5,
            orderBy: { startDate: 'desc' }
          },
          terms: {
            take: 5,
            orderBy: { startDate: 'desc' }
          },
        }
      });
      
      // Invalidate cache
      invalidateSchoolCacheOnCreate(validatedData.ownerId);
      
      // Set in cache
      setSchoolInCache(school.id.toString(), school);
      
      return {
        success: true,
        data: school,
        message: 'School created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.errors || null
      };
    }
  }

  /**
   * Get school by ID
   */
  async getSchoolById(schoolId, include = null) {
    try {
      // Check cache first
      const cachedSchool = getSchoolFromCache(schoolId);
      if (cachedSchool) {
        return {
          success: true,
          data: cachedSchool,
          source: 'cache'
        };
      }
      
      // Build include query
      const includeQuery = buildSchoolIncludeQuery(include);
      
      // Get from database
      const school = await this.prisma.school.findUnique({
        where: { id: BigInt(schoolId) },
        include: includeQuery
      });
      
      if (!school) {
        throw new Error('School not found');
      }
      
      // Set in cache
      setSchoolInCache(schoolId, school);
      
      return {
        success: true,
        data: school,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get schools with pagination and filters
   */
  async getSchools(filters = {}, include = null) {
    try {
      // Validate filters
      const validatedFilters = SchoolSearchSchema.parse(filters);
      
      // Check cache first
      const cachedSchools = getSchoolsFromCache(validatedFilters);
      if (cachedSchools) {
        return {
          success: true,
          data: cachedSchools,
          source: 'cache'
        };
      }
      
      // Build queries
      const where = buildSchoolSearchQuery(validatedFilters);
      const includeQuery = buildSchoolIncludeQuery(include);
      
      // Calculate pagination
      const page = validatedFilters.page;
      const limit = validatedFilters.limit;
      const skip = (page - 1) * limit;
      
      // Get schools and count
      const [schools, total] = await Promise.all([
        this.prisma.school.findMany({
          where,
          include: includeQuery,
          orderBy: { [validatedFilters.sort]: validatedFilters.order },
          skip,
          take: limit,
        }),
        this.prisma.school.count({ where })
      ]);
      
      const result = {
        schools,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        }
      };
      
      // Set in cache
      setSchoolsInCache(validatedFilters, result);
      
      return {
        success: true,
        data: result,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.errors || null
      };
    }
  }

  /**
   * Update school
   */
  async updateSchool(schoolId, updateData, updatedBy) {
    try {
      // Validate input data
      const validatedData = SchoolUpdateSchema.parse(updateData);
      
      // Check if school exists
      const existingSchool = await this.prisma.school.findUnique({
        where: { id: BigInt(schoolId) }
      });
      
      if (!existingSchool) {
        throw new Error('School not found');
      }
      
      // Check for unique constraints
      if (validatedData.code) {
        const existingCode = await this.prisma.school.findFirst({
          where: {
            code: validatedData.code,
            id: { not: BigInt(schoolId) }
          }
        });
        
        if (existingCode) {
          throw new Error('School code already exists');
        }
      }
      
      if (validatedData.email) {
        const existingEmail = await this.prisma.school.findFirst({
          where: {
            email: validatedData.email,
            id: { not: BigInt(schoolId) }
          }
        });
        
        if (existingEmail) {
          throw new Error('School email already exists');
        }
      }
      
      // Format phone number
      if (validatedData.phone) {
        validatedData.phone = formatPhoneNumber(validatedData.phone);
      }
      
      // Validate coordinates
      if (validatedData.latitude || validatedData.longitude) {
        validateCoordinates(validatedData.latitude, validatedData.longitude);
      }
      
      // Update school
      const school = await this.prisma.school.update({
        where: { id: BigInt(schoolId) },
        data: {
          ...validatedData,
          academicSessionId: validatedData.academicSessionId ? BigInt(validatedData.academicSessionId) : undefined,
          currentTermId: validatedData.currentTermId ? BigInt(validatedData.currentTermId) : undefined,
          updatedBy: updatedBy ? BigInt(updatedBy) : undefined,
        },
        include: {
          owner: true,
          academicSessions: {
            take: 5,
            orderBy: { startDate: 'desc' }
          },
          terms: {
            take: 5,
            orderBy: { startDate: 'desc' }
          },
        }
      });
      
      // Invalidate cache
      invalidateSchoolCacheOnUpdate(schoolId, school.ownerId.toString());
      
      // Set in cache
      setSchoolInCache(schoolId, school);
      
      return {
        success: true,
        data: school,
        message: 'School updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.errors || null
      };
    }
  }

  /**
   * Delete school (soft delete)
   */
  async deleteSchool(schoolId, deletedBy) {
    try {
      // Check if school exists
      const existingSchool = await this.prisma.school.findUnique({
        where: { id: BigInt(schoolId) }
      });
      
      if (!existingSchool) {
        throw new Error('School not found');
      }
      
      // Soft delete
      const school = await this.prisma.school.update({
        where: { id: BigInt(schoolId) },
        data: {
          deletedAt: new Date(),
          updatedBy: deletedBy ? BigInt(deletedBy) : undefined,
        }
      });
      
      // Invalidate cache
      invalidateSchoolCacheOnDelete(schoolId, school.ownerId.toString());
      
      return {
        success: true,
        data: school,
        message: 'School deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore deleted school
   */
  async restoreSchool(schoolId, restoredBy) {
    try {
      // Check if school exists and is deleted
      const existingSchool = await this.prisma.school.findUnique({
        where: { id: BigInt(schoolId) }
      });
      
      if (!existingSchool) {
        throw new Error('School not found');
      }
      
      if (!existingSchool.deletedAt) {
        throw new Error('School is not deleted');
      }
      
      // Restore school
      const school = await this.prisma.school.update({
        where: { id: BigInt(schoolId) },
        data: {
          deletedAt: null,
          updatedBy: restoredBy ? BigInt(restoredBy) : undefined,
        },
        include: {
          owner: true,
          academicSessions: {
            take: 5,
            orderBy: { startDate: 'desc' }
          },
          terms: {
            take: 5,
            orderBy: { startDate: 'desc' }
          },
        }
      });
      
      // Invalidate cache
      invalidateSchoolCacheOnUpdate(schoolId, school.ownerId.toString());
      
      // Set in cache
      setSchoolInCache(schoolId, school);
      
      return {
        success: true,
        data: school,
        message: 'School restored successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  /**
   * Bulk create schools
   */
  async bulkCreateSchools(schoolsData, createdBy) {
    try {
      const results = [];
      const errors = [];
      
      for (let i = 0; i < schoolsData.length; i++) {
        const schoolData = schoolsData[i];
        const result = await this.createSchool(schoolData, createdBy);
        
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push({
            index: i,
            data: schoolData,
            error: result.error
          });
        }
      }
      
      // Invalidate cache for all affected owners
      const ownerIds = [...new Set(schoolsData.map(s => s.ownerId))];
      invalidateSchoolCacheOnBulkOperation(ownerIds);
      
      return {
        success: true,
        data: {
          created: results,
          errors,
          summary: {
            total: schoolsData.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: `Bulk operation completed. ${results.length} schools created, ${errors.length} failed.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Bulk update schools
   */
  async bulkUpdateSchools(updates, updatedBy) {
    try {
      const results = [];
      const errors = [];
      
      for (const update of updates) {
        const { id, ...updateData } = update;
        const result = await this.updateSchool(id, updateData, updatedBy);
        
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push({
            id,
            data: updateData,
            error: result.error
          });
        }
      }
      
      return {
        success: true,
        data: {
          updated: results,
          errors,
          summary: {
            total: updates.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: `Bulk operation completed. ${results.length} schools updated, ${errors.length} failed.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Bulk delete schools
   */
  async bulkDeleteSchools(schoolIds, deletedBy) {
    try {
      const results = [];
      const errors = [];
      
      for (const schoolId of schoolIds) {
        const result = await this.deleteSchool(schoolId, deletedBy);
        
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push({
            id: schoolId,
            error: result.error
          });
        }
      }
      
      return {
        success: true,
        data: {
          deleted: results,
          errors,
          summary: {
            total: schoolIds.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: `Bulk operation completed. ${results.length} schools deleted, ${errors.length} failed.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  /**
   * Get school statistics
   */
  async getSchoolStats(schoolId) {
    try {
      // Check cache first
      const cachedStats = getSchoolStatsFromCache(schoolId);
      if (cachedStats) {
        return {
          success: true,
          data: cachedStats,
          source: 'cache'
        };
      }
      
      // Generate stats
      const stats = await generateSchoolStats(schoolId);
      
      // Set in cache
      setSchoolStatsInCache(schoolId, stats);
      
      return {
        success: true,
        data: stats,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get school analytics
   */
  async getSchoolAnalytics(schoolId, period = '30d') {
    try {
      // Check cache first
      const cachedAnalytics = getSchoolAnalyticsFromCache(schoolId, period);
      if (cachedAnalytics) {
        return {
          success: true,
          data: cachedAnalytics,
          source: 'cache'
        };
      }
      
      // Generate analytics
      const analytics = await generateSchoolAnalytics(schoolId, period);
      
      // Set in cache
      setSchoolAnalyticsInCache(schoolId, period, analytics);
      
      return {
        success: true,
        data: analytics,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get school performance metrics
   */
  async getSchoolPerformance(schoolId) {
    try {
      // Check cache first
      const cachedPerformance = getSchoolPerformanceFromCache(schoolId);
      if (cachedPerformance) {
        return {
          success: true,
          data: cachedPerformance,
          source: 'cache'
        };
      }
      
      // Calculate performance
      const performance = await calculateSchoolPerformance(schoolId);
      
      // Set in cache
      setSchoolPerformanceInCache(schoolId, performance);
      
      return {
        success: true,
        data: performance,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  /**
   * Search schools with advanced filters
   */
  async searchSchools(searchParams) {
    try {
      // Check cache first
      const cachedResults = getSchoolSearchFromCache(searchParams);
      if (cachedResults) {
        return {
          success: true,
          data: cachedResults,
          source: 'cache'
        };
      }
      
      // Validate search parameters
      const validatedParams = SchoolSearchSchema.parse(searchParams);
      
      // Build search query
      const where = buildSchoolSearchQuery(validatedParams);
      const includeQuery = buildSchoolIncludeQuery(validatedParams.include);
      
      // Calculate pagination
      const page = validatedParams.page;
      const limit = validatedParams.limit;
      const skip = (page - 1) * limit;
      
      // Execute search
      const [schools, total] = await Promise.all([
        this.prisma.school.findMany({
          where,
          include: includeQuery,
          orderBy: { [validatedParams.sort]: validatedParams.order },
          skip,
          take: limit,
        }),
        this.prisma.school.count({ where })
      ]);
      
      const result = {
        schools,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        filters: validatedParams
      };
      
      // Set in cache
      setSchoolSearchInCache(searchParams, result);
      
      return {
        success: true,
        data: result,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.errors || null
      };
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  /**
   * Export schools data
   */
  async exportSchools(filters = {}, format = 'json') {
    try {
      // Check cache first
      const cachedExport = getSchoolExportFromCache(filters, format);
      if (cachedExport) {
        return {
          success: true,
          data: cachedExport,
          source: 'cache'
        };
      }
      
      // Get schools
      const schoolsResult = await this.getSchools(filters);
      
      if (!schoolsResult.success) {
        throw new Error(schoolsResult.error);
      }
      
      // Generate export data
      const exportData = await generateSchoolExportData(schoolsResult.data.schools, format);
      
      // Set in cache
      setSchoolExportInCache(filters, format, exportData);
      
      return {
        success: true,
        data: exportData,
        format,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import schools data
   */
  async importSchools(importData, createdBy) {
    try {
      // Validate import data
      const validation = validateSchoolImportData(importData);
      
      if (validation.errors.length > 0) {
        return {
          success: false,
          error: 'Import validation failed',
          details: validation.errors
        };
      }
      
      // Bulk create schools
      const result = await this.bulkCreateSchools(validation.validSchools, createdBy);
      
      return {
        success: true,
        data: result.data,
        message: `Import completed. ${result.data.summary.successful} schools imported, ${result.data.summary.failed} failed.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  /**
   * Generate school code suggestions
   */
  async generateCodeSuggestions(name) {
    try {
      const suggestions = generateSchoolCodeSuggestions(name);
      
      // Check which suggestions are available
      const existingCodes = await this.prisma.school.findMany({
        where: { code: { in: suggestions } },
        select: { code: true }
      });
      
      const existingCodeSet = new Set(existingCodes.map(s => s.code));
      const availableSuggestions = suggestions.filter(code => !existingCodeSet.has(code));
      
      return {
        success: true,
        data: {
          suggestions: availableSuggestions,
          allSuggestions: suggestions,
          existingCodes: Array.from(existingCodeSet)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get school count by status
   */
  async getSchoolCountByStatus() {
    try {
      const counts = await this.prisma.school.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true }
      });
      
      const result = counts.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {});
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get school count by location
   */
  async getSchoolCountByLocation() {
    try {
      const countryCounts = await this.prisma.school.groupBy({
        by: ['country'],
        where: { deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      });
      
      const stateCounts = await this.prisma.school.groupBy({
        by: ['state'],
        where: { deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      });
      
      const cityCounts = await this.prisma.school.groupBy({
        by: ['city'],
        where: { deletedAt: null },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10
      });
      
      return {
        success: true,
        data: {
          countries: countryCounts.map(item => ({
            country: item.country,
            count: item._count.id
          })),
          states: stateCounts.map(item => ({
            state: item.state,
            count: item._count.id
          })),
          cities: cityCounts.map(item => ({
            city: item.city,
            count: item._count.id
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get schools by owner
   */
  async getSchoolsByOwner(ownerId, include = null) {
    try {
      const includeQuery = buildSchoolIncludeQuery(include);
      
      const schools = await this.prisma.school.findMany({
        where: { 
          ownerId: BigInt(ownerId),
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });
      
      return {
        success: true,
        data: schools
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get schools by status
   */
  async getSchoolsByStatus(status, include = null) {
    try {
      const includeQuery = buildSchoolIncludeQuery(include);
      
      const schools = await this.prisma.school.findMany({
        where: { 
          status,
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });
      
      return {
        success: true,
        data: schools
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// ======================
// SERVICE INSTANCE
// ======================

const schoolService = new SchoolService();

export default schoolService; 
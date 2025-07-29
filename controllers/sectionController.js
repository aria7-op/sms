import sectionService from '../services/sectionService.js';
import { 
  formatResponse, 
  handleError 
} from '../utils/responseUtils.js';
import logger from '../config/logger.js';

class SectionController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  async createSection(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const sectionData = req.body;

      const section = await sectionService.createSection(sectionData, userId, schoolId);

      res.status(201).json(formatResponse(true, section, 'Section created successfully'));
    } catch (error) {
      logger.error('Create section controller error:', error);
      handleError(error, res, 'create section');
    }
  }

  async getSections(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const include = filters.include ? filters.include.split(',') : null;

      const sections = await sectionService.getSections(filters, schoolId, include);

      res.json(formatResponse(true, sections, 'Sections retrieved successfully'));
    } catch (error) {
      logger.error('Get sections controller error:', error);
      handleError(error, res, 'get sections');
    }
  }

  async getSectionById(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const section = await sectionService.getSectionById(parseInt(id), schoolId, includeArray);

      res.json(formatResponse(true, section, 'Section retrieved successfully'));
    } catch (error) {
      logger.error('Get section by ID controller error:', error);
      handleError(error, res, 'get section');
    }
  }

  async updateSection(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;
      const updateData = req.body;

      const section = await sectionService.updateSection(parseInt(id), updateData, userId, schoolId);

      res.json(formatResponse(true, section, 'Section updated successfully'));
    } catch (error) {
      logger.error('Update section controller error:', error);
      handleError(error, res, 'update section');
    }
  }

  async deleteSection(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;

      const result = await sectionService.deleteSection(parseInt(id), userId, schoolId);

      res.json(formatResponse(true, result, 'Section deleted successfully'));
    } catch (error) {
      logger.error('Delete section controller error:', error);
      handleError(error, res, 'delete section');
    }
  }

  async restoreSection(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;

      const result = await sectionService.restoreSection(parseInt(id), userId, schoolId);

      res.json(formatResponse(true, result, 'Section restored successfully'));
    } catch (error) {
      logger.error('Restore section controller error:', error);
      handleError(error, res, 'restore section');
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getSectionStats(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const stats = await sectionService.getSectionStats(parseInt(id), schoolId);

      res.json(formatResponse(true, stats, 'Section statistics retrieved successfully'));
    } catch (error) {
      logger.error('Get section stats controller error:', error);
      handleError(error, res, 'get section statistics');
    }
  }

  async getSectionAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const analytics = await sectionService.getSectionAnalytics(parseInt(id), schoolId, period);

      res.json(formatResponse(true, analytics, 'Section analytics retrieved successfully'));
    } catch (error) {
      logger.error('Get section analytics controller error:', error);
      handleError(error, res, 'get section analytics');
    }
  }

  async getSectionPerformance(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      // This would include performance metrics like attendance, grades, etc.
      const performance = {
        sectionId: parseInt(id),
        attendance: {
          present: 85,
          absent: 10,
          late: 5,
          percentage: 85
        },
        academicPerformance: {
          averageGrade: 'B+',
          topPerformers: 5,
          needsImprovement: 2
        },
        behaviorMetrics: {
          excellent: 15,
          good: 20,
          needsAttention: 3
        }
      };

      res.json(formatResponse(true, performance, 'Section performance retrieved successfully'));
    } catch (error) {
      logger.error('Get section performance controller error:', error);
      handleError(error, res, 'get section performance');
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateSections(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { sections, skipDuplicates = false } = req.body;

      const results = await sectionService.bulkCreateSections({ sections, skipDuplicates }, userId, schoolId);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.status(201).json(formatResponse(true, {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount
        }
      }, `Bulk create completed. ${successCount} successful, ${failureCount} failed`));
    } catch (error) {
      logger.error('Bulk create sections controller error:', error);
      handleError(error, res, 'bulk create sections');
    }
  }

  async bulkUpdateSections(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { updates } = req.body;

      const results = await sectionService.bulkUpdateSections({ updates }, userId, schoolId);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.json(formatResponse(true, {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount
        }
      }, `Bulk update completed. ${successCount} successful, ${failureCount} failed`));
    } catch (error) {
      logger.error('Bulk update sections controller error:', error);
      handleError(error, res, 'bulk update sections');
    }
  }

  async bulkDeleteSections(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { sectionIds } = req.body;

      const results = await sectionService.bulkDeleteSections({ sectionIds }, userId, schoolId);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.json(formatResponse(true, {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount
        }
      }, `Bulk delete completed. ${successCount} successful, ${failureCount} failed`));
    } catch (error) {
      logger.error('Bulk delete sections controller error:', error);
      handleError(error, res, 'bulk delete sections');
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  async searchSections(req, res) {
    try {
      const { schoolId } = req.user;
      const { q: query, include } = req.query;

      if (!query) {
        return res.status(400).json(formatResponse(false, null, 'Search query is required'));
      }

      const includeArray = include ? include.split(',') : null;
      const sections = await sectionService.searchSections(query, schoolId, includeArray);

      res.json(formatResponse(true, sections, 'Sections search completed successfully'));
    } catch (error) {
      logger.error('Search sections controller error:', error);
      handleError(error, res, 'search sections');
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  async getSectionsByClass(req, res) {
    try {
      const { schoolId } = req.user;
      const { classId } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const sections = await sectionService.getSectionsByClass(parseInt(classId), schoolId, includeArray);

      res.json(formatResponse(true, sections, 'Sections by class retrieved successfully'));
    } catch (error) {
      logger.error('Get sections by class controller error:', error);
      handleError(error, res, 'get sections by class');
    }
  }

  async getSectionsByTeacher(req, res) {
    try {
      const { schoolId } = req.user;
      const { teacherId } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const sections = await sectionService.getSectionsByTeacher(parseInt(teacherId), schoolId, includeArray);

      res.json(formatResponse(true, sections, 'Sections by teacher retrieved successfully'));
    } catch (error) {
      logger.error('Get sections by teacher controller error:', error);
      handleError(error, res, 'get sections by teacher');
    }
  }

  async generateSectionReport(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;

      const report = await sectionService.generateSectionReport(schoolId, filters);

      res.json(formatResponse(true, report, 'Section report generated successfully'));
    } catch (error) {
      logger.error('Generate section report controller error:', error);
      handleError(error, res, 'generate section report');
    }
  }

  async generateNameSuggestions(req, res) {
    try {
      const { schoolId } = req.user;
      const { classId } = req.query;

      if (!classId) {
        return res.status(400).json(formatResponse(false, null, 'Class ID is required'));
      }

      // Generate section name suggestions
      const suggestions = [];
      const sectionLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      
      for (let i = 0; i < 5; i++) {
        suggestions.push(sectionLetters[i]);
      }

      res.json(formatResponse(true, { suggestions }, 'Section name suggestions generated successfully'));
    } catch (error) {
      logger.error('Generate name suggestions controller error:', error);
      handleError(error, res, 'generate name suggestions');
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  async exportSections(req, res) {
    try {
      const { schoolId } = req.user;
      const { format = 'json', ...filters } = req.query;

      const sections = await sectionService.getSections(filters, schoolId, 'class,teacher,students,school');

      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCSV(sections.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="sections.csv"');
        return res.send(csvData);
      }

      res.json(formatResponse(true, sections, 'Sections exported successfully'));
    } catch (error) {
      logger.error('Export sections controller error:', error);
      handleError(error, res, 'export sections');
    }
  }

  async importSections(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { sections, user } = req.body;

      if (!Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json(formatResponse(false, null, 'Sections array is required'));
      }

      const results = await sectionService.bulkCreateSections({ sections }, userId, schoolId);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.status(201).json(formatResponse(true, {
        results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failureCount
        }
      }, `Import completed. ${successCount} successful, ${failureCount} failed`));
    } catch (error) {
      logger.error('Import sections controller error:', error);
      handleError(error, res, 'import sections');
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  async getCacheStats(req, res) {
    try {
      const stats = await sectionService.getCacheStats();

      res.json(formatResponse(true, stats, 'Cache statistics retrieved successfully'));
    } catch (error) {
      logger.error('Get cache stats controller error:', error);
      handleError(error, res, 'get cache statistics');
    }
  }

  async warmCache(req, res) {
    try {
      const { schoolId } = req.user;
      const { sectionId } = req.body;

      const result = await sectionService.warmCache(schoolId, sectionId);

      res.json(formatResponse(true, result, 'Cache warmed successfully'));
    } catch (error) {
      logger.error('Warm cache controller error:', error);
      handleError(error, res, 'warm cache');
    }
  }

  async clearCache(req, res) {
    try {
      const { schoolId } = req.user;
      const { all } = req.query;

      const result = await sectionService.clearCache(all ? null : schoolId);

      res.json(formatResponse(true, result, 'Cache cleared successfully'));
    } catch (error) {
      logger.error('Clear cache controller error:', error);
      handleError(error, res, 'clear cache');
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  convertToCSV(data) {
    if (!data || data.length === 0) return '';

    const headers = ['ID', 'Name', 'Class', 'Teacher', 'Capacity', 'Room Number', 'Students', 'Utilization %'];
    const rows = data.map(section => [
      section.id,
      section.name,
      section.class?.name || '',
      section.teacher?.user ? `${section.teacher.user.firstName} ${section.teacher.user.lastName}` : '',
      section.capacity,
      section.roomNumber || '',
      section.stats?.studentCount || 0,
      section.stats?.utilization || 0
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

export default new SectionController(); 
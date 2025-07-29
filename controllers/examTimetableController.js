import examTimetableService from '../services/examTimetableService.js';
import { 
  formatResponse, 
  handleError 
} from '../utils/responseUtils.js';
import logger from '../config/logger.js';

class ExamTimetableController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  async createExamTimetable(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const timetableData = req.body;

      const timetable = await examTimetableService.createExamTimetable(timetableData, userId, schoolId);

      res.status(201).json(formatResponse(true, timetable, 'Exam timetable created successfully'));
    } catch (error) {
      logger.error('Create exam timetable controller error:', error);
      handleError(error, res, 'create exam timetable');
    }
  }

  async getExamTimetables(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const include = filters.include ? filters.include.split(',') : null;

      const timetables = await examTimetableService.getExamTimetables(filters, schoolId, include);

      res.json(formatResponse(true, timetables, 'Exam timetables retrieved successfully'));
    } catch (error) {
      logger.error('Get exam timetables controller error:', error);
      handleError(error, res, 'get exam timetables');
    }
  }

  async getExamTimetableById(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const timetable = await examTimetableService.getExamTimetableById(parseInt(id), schoolId, includeArray);

      res.json(formatResponse(true, timetable, 'Exam timetable retrieved successfully'));
    } catch (error) {
      logger.error('Get exam timetable by ID controller error:', error);
      handleError(error, res, 'get exam timetable');
    }
  }

  async updateExamTimetable(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;
      const updateData = req.body;

      const timetable = await examTimetableService.updateExamTimetable(parseInt(id), updateData, userId, schoolId);

      res.json(formatResponse(true, timetable, 'Exam timetable updated successfully'));
    } catch (error) {
      logger.error('Update exam timetable controller error:', error);
      handleError(error, res, 'update exam timetable');
    }
  }

  async deleteExamTimetable(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;

      const result = await examTimetableService.deleteExamTimetable(parseInt(id), userId, schoolId);

      res.json(formatResponse(true, result, 'Exam timetable deleted successfully'));
    } catch (error) {
      logger.error('Delete exam timetable controller error:', error);
      handleError(error, res, 'delete exam timetable');
    }
  }

  async restoreExamTimetable(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;

      const result = await examTimetableService.restoreExamTimetable(parseInt(id), userId, schoolId);

      res.json(formatResponse(true, result, 'Exam timetable restored successfully'));
    } catch (error) {
      logger.error('Restore exam timetable controller error:', error);
      handleError(error, res, 'restore exam timetable');
    }
  }

  // ======================
  // SCHEDULING & CONFLICT DETECTION
  // ======================

  async checkConflicts(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const conflictData = req.body;

      const conflicts = await examTimetableService.checkConflicts(conflictData, schoolId, id ? parseInt(id) : null);

      res.json(formatResponse(true, conflicts, 'Conflict check completed successfully'));
    } catch (error) {
      logger.error('Check conflicts controller error:', error);
      handleError(error, res, 'check conflicts');
    }
  }

  async generateOptimalSchedule(req, res) {
    try {
      const { schoolId } = req.user;
      const { examId } = req.params;
      const { constraints } = req.body;

      const schedule = await examTimetableService.generateOptimalSchedule(parseInt(examId), schoolId, constraints);

      res.json(formatResponse(true, schedule, 'Optimal schedule generated successfully'));
    } catch (error) {
      logger.error('Generate optimal schedule controller error:', error);
      handleError(error, res, 'generate optimal schedule');
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getExamTimetableStats(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const stats = await examTimetableService.getExamTimetableStats(parseInt(id), schoolId);

      res.json(formatResponse(true, stats, 'Exam timetable statistics retrieved successfully'));
    } catch (error) {
      logger.error('Get exam timetable stats controller error:', error);
      handleError(error, res, 'get exam timetable statistics');
    }
  }

  async getExamTimetableAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const analytics = await examTimetableService.getExamTimetableAnalytics(parseInt(id), schoolId, period);

      res.json(formatResponse(true, analytics, 'Exam timetable analytics retrieved successfully'));
    } catch (error) {
      logger.error('Get exam timetable analytics controller error:', error);
      handleError(error, res, 'get exam timetable analytics');
    }
  }

  async getExamTimetablePerformance(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      // This would include performance metrics like room utilization, scheduling efficiency, etc.
      const performance = {
        timetableId: parseInt(id),
        roomUtilization: 85,
        schedulingEfficiency: 92,
        conflictRate: 3,
        optimization: {
          roomUsage: 'optimal',
          timeDistribution: 'balanced',
          subjectSpacing: 'adequate',
          recommendations: [
            'Consider adding more morning slots',
            'Optimize room allocation for large subjects',
            'Reduce gaps between consecutive exams'
          ]
        },
        metrics: {
          totalExams: 15,
          totalHours: 30,
          averageDuration: 120,
          roomCount: 5,
          subjectCount: 8
        }
      };

      res.json(formatResponse(true, performance, 'Exam timetable performance retrieved successfully'));
    } catch (error) {
      logger.error('Get exam timetable performance controller error:', error);
      handleError(error, res, 'get exam timetable performance');
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateExamTimetables(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { timetables, skipDuplicates = false } = req.body;

      const results = await examTimetableService.bulkCreateExamTimetables({ timetables, skipDuplicates }, userId, schoolId);

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
      logger.error('Bulk create exam timetables controller error:', error);
      handleError(error, res, 'bulk create exam timetables');
    }
  }

  async bulkUpdateExamTimetables(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { updates } = req.body;

      const results = await examTimetableService.bulkUpdateExamTimetables({ updates }, userId, schoolId);

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
      logger.error('Bulk update exam timetables controller error:', error);
      handleError(error, res, 'bulk update exam timetables');
    }
  }

  async bulkDeleteExamTimetables(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { timetableIds } = req.body;

      const results = await examTimetableService.bulkDeleteExamTimetables({ timetableIds }, userId, schoolId);

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
      logger.error('Bulk delete exam timetables controller error:', error);
      handleError(error, res, 'bulk delete exam timetables');
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  async searchExamTimetables(req, res) {
    try {
      const { schoolId } = req.user;
      const { q: query, include } = req.query;

      if (!query) {
        return res.status(400).json(formatResponse(false, null, 'Search query is required'));
      }

      const includeArray = include ? include.split(',') : null;
      const timetables = await examTimetableService.searchExamTimetables(query, schoolId, includeArray);

      res.json(formatResponse(true, timetables, 'Exam timetables search completed successfully'));
    } catch (error) {
      logger.error('Search exam timetables controller error:', error);
      handleError(error, res, 'search exam timetables');
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  async getExamTimetablesByExam(req, res) {
    try {
      const { schoolId } = req.user;
      const { examId } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const timetables = await examTimetableService.getExamTimetablesByExam(parseInt(examId), schoolId, includeArray);

      res.json(formatResponse(true, timetables, 'Exam timetables by exam retrieved successfully'));
    } catch (error) {
      logger.error('Get exam timetables by exam controller error:', error);
      handleError(error, res, 'get exam timetables by exam');
    }
  }

  async getExamTimetablesBySubject(req, res) {
    try {
      const { schoolId } = req.user;
      const { subjectId } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const timetables = await examTimetableService.getExamTimetablesBySubject(parseInt(subjectId), schoolId, includeArray);

      res.json(formatResponse(true, timetables, 'Exam timetables by subject retrieved successfully'));
    } catch (error) {
      logger.error('Get exam timetables by subject controller error:', error);
      handleError(error, res, 'get exam timetables by subject');
    }
  }

  async getUpcomingExamTimetables(req, res) {
    try {
      const { schoolId } = req.user;
      const { days = 7 } = req.query;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const timetables = await examTimetableService.getUpcomingExamTimetables(schoolId, parseInt(days), includeArray);

      res.json(formatResponse(true, timetables, 'Upcoming exam timetables retrieved successfully'));
    } catch (error) {
      logger.error('Get upcoming exam timetables controller error:', error);
      handleError(error, res, 'get upcoming exam timetables');
    }
  }

  async generateExamTimetableReport(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;

      const report = await examTimetableService.generateExamTimetableReport(schoolId, filters);

      res.json(formatResponse(true, report, 'Exam timetable report generated successfully'));
    } catch (error) {
      logger.error('Generate exam timetable report controller error:', error);
      handleError(error, res, 'generate exam timetable report');
    }
  }

  async getExamTimetableDistribution(req, res) {
    try {
      const { schoolId } = req.user;
      const { examId, subjectId } = req.query;

      // This would calculate timetable distribution for an exam or subject
      const distribution = {
        examId: examId ? parseInt(examId) : null,
        subjectId: subjectId ? parseInt(subjectId) : null,
        totalTimetables: 25,
        roomDistribution: {
          'Room 101': 8,
          'Room 102': 7,
          'Room 103': 5,
          'Room 104': 3,
          'Room 105': 2
        },
        timeDistribution: {
          '09:00-11:00': 10,
          '11:30-13:30': 8,
          '14:00-16:00': 7
        },
        dateDistribution: {
          '2024-01-15': 5,
          '2024-01-16': 8,
          '2024-01-17': 6,
          '2024-01-18': 6
        },
        statistics: {
          averageDuration: 120,
          totalHours: 50,
          roomUtilization: 85,
          schedulingEfficiency: 92
        }
      };

      res.json(formatResponse(true, distribution, 'Exam timetable distribution retrieved successfully'));
    } catch (error) {
      logger.error('Get exam timetable distribution controller error:', error);
      handleError(error, res, 'get exam timetable distribution');
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  async exportExamTimetables(req, res) {
    try {
      const { schoolId } = req.user;
      const { format = 'json', ...filters } = req.query;

      const timetables = await examTimetableService.getExamTimetables(filters, schoolId, 'exam,subject,school');

      if (format === 'csv') {
        const csvData = this.convertToCSV(timetables.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="exam_timetables.csv"');
        return res.send(csvData);
      }

      res.json(formatResponse(true, timetables, 'Exam timetables exported successfully'));
    } catch (error) {
      logger.error('Export exam timetables controller error:', error);
      handleError(error, res, 'export exam timetables');
    }
  }

  async importExamTimetables(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { timetables, user } = req.body;

      if (!Array.isArray(timetables) || timetables.length === 0) {
        return res.status(400).json(formatResponse(false, null, 'Timetables array is required'));
      }

      const results = await examTimetableService.bulkCreateExamTimetables({ timetables }, userId, schoolId);

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
      logger.error('Import exam timetables controller error:', error);
      handleError(error, res, 'import exam timetables');
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  async getCacheStats(req, res) {
    try {
      const stats = await examTimetableService.getCacheStats();

      res.json(formatResponse(true, stats, 'Cache statistics retrieved successfully'));
    } catch (error) {
      logger.error('Get cache stats controller error:', error);
      handleError(error, res, 'get cache statistics');
    }
  }

  async warmCache(req, res) {
    try {
      const { schoolId } = req.user;
      const { timetableId } = req.body;

      const result = await examTimetableService.warmCache(schoolId, timetableId);

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

      const result = await examTimetableService.clearCache(all ? null : schoolId);

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

    const headers = ['ID', 'Exam', 'Subject', 'Date', 'Start Time', 'End Time', 'Duration', 'Room', 'Status'];
    const rows = data.map(timetable => [
      timetable.id,
      timetable.exam?.name || '',
      timetable.subject?.name || '',
      new Date(timetable.date).toLocaleDateString(),
      new Date(timetable.startTime).toLocaleTimeString(),
      new Date(timetable.endTime).toLocaleTimeString(),
      timetable.stats?.duration?.formatted || '',
      timetable.roomNumber || '',
      timetable.stats?.isUpcoming ? 'Upcoming' : timetable.stats?.isToday ? 'Today' : 'Past'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

export default new ExamTimetableController(); 
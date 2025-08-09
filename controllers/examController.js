import examService from '../services/examService.js';
import { 
  formatResponse, 
  handleError 
} from '../utils/responseUtils.js';
import logger from '../config/logger.js';

class ExamController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  async createExam(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const examData = req.body;

      const exam = await examService.createExam(examData, userId, schoolId);

      res.status(201).json(formatResponse(true, exam, 'Exam created successfully'));
    } catch (error) {
      logger.error('Create exam controller error:', error);
      handleError(error, res, 'create exam');
    }
  }

  async getExams(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const include = filters.include ? filters.include.split(',') : null;

      const exams = await examService.getExams(filters, schoolId, include);

      res.json(formatResponse(true, exams, 'Exams retrieved successfully'));
    } catch (error) {
      logger.error('Get exams controller error:', error);
      handleError(error, res, 'get exams');
    }
  }

  async getExamById(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const include = req.query.include ? req.query.include.split(',') : null;

      const exam = await examService.getExamById(parseInt(id), schoolId, include);

      res.json(formatResponse(true, exam, 'Exam retrieved successfully'));
    } catch (error) {
      logger.error('Get exam by ID controller error:', error);
      handleError(error, res, 'get exam');
    }
  }

  async updateExam(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, userId } = req.user;
      const updateData = req.body;

      const exam = await examService.updateExam(parseInt(id), updateData, userId, schoolId);

      res.json(formatResponse(true, exam, 'Exam updated successfully'));
    } catch (error) {
      logger.error('Update exam controller error:', error);
      handleError(error, res, 'update exam');
    }
  }

  async deleteExam(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, userId } = req.user;

      const result = await examService.deleteExam(parseInt(id), userId, schoolId);

      res.json(formatResponse(true, result, 'Exam deleted successfully'));
    } catch (error) {
      logger.error('Delete exam controller error:', error);
      handleError(error, res, 'delete exam');
    }
  }

  async restoreExam(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, userId } = req.user;

      const result = await examService.restoreExam(parseInt(id), userId, schoolId);

      res.json(formatResponse(true, result, 'Exam restored successfully'));
    } catch (error) {
      logger.error('Restore exam controller error:', error);
      handleError(error, res, 'restore exam');
    }
  }

  // ======================
  // ANALYTICS & REPORTING
  // ======================

  async getExamStats(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const stats = await examService.getExamStats(parseInt(id), schoolId);

      res.json(formatResponse(true, stats, 'Exam statistics retrieved successfully'));
    } catch (error) {
      logger.error('Get exam stats controller error:', error);
      handleError(error, res, 'get exam stats');
    }
  }

  async getExamAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const { period = '30d' } = req.query;

      const analytics = await examService.getExamAnalytics(parseInt(id), schoolId, period);

      res.json(formatResponse(true, analytics, 'Exam analytics retrieved successfully'));
    } catch (error) {
      logger.error('Get exam analytics controller error:', error);
      handleError(error, res, 'get exam analytics');
    }
  }

  async getExamPerformance(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const performance = await examService.getExamPerformance(parseInt(id), schoolId);

      res.json(formatResponse(true, performance, 'Exam performance retrieved successfully'));
    } catch (error) {
      logger.error('Get exam performance controller error:', error);
      handleError(error, res, 'get exam performance');
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateExams(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { exams, skipDuplicates = false } = req.body;

      const results = await examService.bulkCreateExams({ exams, skipDuplicates }, userId, schoolId);

      res.status(201).json(formatResponse(true, results, 'Bulk exam creation completed'));
    } catch (error) {
      logger.error('Bulk create exams controller error:', error);
      handleError(error, res, 'bulk create exams');
    }
  }

  async bulkUpdateExams(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { updates } = req.body;

      const results = await examService.bulkUpdateExams({ updates }, userId, schoolId);

      res.json(formatResponse(true, results, 'Bulk exam update completed'));
    } catch (error) {
      logger.error('Bulk update exams controller error:', error);
      handleError(error, res, 'bulk update exams');
    }
  }

  async bulkDeleteExams(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { examIds } = req.body;

      const results = await examService.bulkDeleteExams({ examIds }, userId, schoolId);

      res.json(formatResponse(true, results, 'Bulk exam deletion completed'));
    } catch (error) {
      logger.error('Bulk delete exams controller error:', error);
      handleError(error, res, 'bulk delete exams');
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  async searchExams(req, res) {
    try {
      const { schoolId } = req.user;
      const { q: query } = req.query;
      const include = req.query.include ? req.query.include.split(',') : null;

      const exams = await examService.searchExams(query, schoolId, include);

      res.json(formatResponse(true, exams, 'Exam search completed'));
    } catch (error) {
      logger.error('Search exams controller error:', error);
      handleError(error, res, 'search exams');
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  async getExamsByClass(req, res) {
    try {
      const { classId } = req.params;
      const { schoolId } = req.user;
      const include = req.query.include ? req.query.include.split(',') : null;

      const exams = await examService.getExamsByClass(parseInt(classId), schoolId, include);

      res.json(formatResponse(true, exams, 'Class exams retrieved successfully'));
    } catch (error) {
      logger.error('Get exams by class controller error:', error);
      handleError(error, res, 'get class exams');
    }
  }

  async getExamsBySubject(req, res) {
    try {
      const { subjectId } = req.params;
      const { schoolId } = req.user;
      const include = req.query.include ? req.query.include.split(',') : null;

      const exams = await examService.getExamsBySubject(parseInt(subjectId), schoolId, include);

      res.json(formatResponse(true, exams, 'Subject exams retrieved successfully'));
    } catch (error) {
      logger.error('Get exams by subject controller error:', error);
      handleError(error, res, 'get subject exams');
    }
  }

  async getUpcomingExams(req, res) {
    try {
      const { schoolId } = req.user;
      const { days = 30 } = req.query;
      const include = req.query.include ? req.query.include.split(',') : null;

      const exams = await examService.getUpcomingExams(schoolId, parseInt(days), include);

      res.json(formatResponse(true, exams, 'Upcoming exams retrieved successfully'));
    } catch (error) {
      logger.error('Get upcoming exams controller error:', error);
      handleError(error, res, 'get upcoming exams');
    }
  }

  // ======================
  // REPORTING
  // ======================

  async generateExamReport(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;

      const report = await examService.generateExamReport(schoolId, filters);

      res.json(formatResponse(true, report, 'Exam report generated successfully'));
    } catch (error) {
      logger.error('Generate exam report controller error:', error);
      handleError(error, res, 'generate exam report');
    }
  }

  // ======================
  // IMPORT/EXPORT
  // ======================

  async exportExams(req, res) {
    try {
      const { schoolId } = req.user;
      const { format = 'csv', ...filters } = req.query;

      const exams = await examService.getExams(filters, schoolId, 'class,subject,term');

      let content, contentType, filename;

      if (format === 'json') {
        content = JSON.stringify(exams, null, 2);
        contentType = 'application/json';
        filename = `exams-${Date.now()}.json`;
      } else {
        content = this.convertToCSV(exams.data || []);
        contentType = 'text/csv';
        filename = `exams-${Date.now()}.csv`;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      logger.error('Export exams controller error:', error);
      handleError(error, res, 'export exams');
    }
  }

  async importExams(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { exams } = req.body;

      const results = await examService.bulkCreateExams({ exams, skipDuplicates: true }, userId, schoolId);

      res.json(formatResponse(true, results, 'Exam import completed'));
    } catch (error) {
      logger.error('Import exams controller error:', error);
      handleError(error, res, 'import exams');
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  async getCacheStats(req, res) {
    try {
      const stats = await examService.getCacheStats();

      res.json(formatResponse(true, stats, 'Cache statistics retrieved'));
    } catch (error) {
      logger.error('Get cache stats controller error:', error);
      handleError(error, res, 'get cache stats');
    }
  }

  async warmCache(req, res) {
    try {
      const { schoolId } = req.user;
      const { examId } = req.params;

      const result = await examService.warmCache(schoolId, examId ? parseInt(examId) : null);

      res.json(formatResponse(true, result, 'Cache warmed successfully'));
    } catch (error) {
      logger.error('Warm cache controller error:', error);
      handleError(error, res, 'warm cache');
    }
  }

  async clearCache(req, res) {
    try {
      const { schoolId } = req.user;
      const { all = false } = req.query;

      const result = await examService.clearCache(all ? null : schoolId);

      res.json(formatResponse(true, result, 'Cache cleared successfully'));
    } catch (error) {
      logger.error('Clear cache controller error:', error);
      handleError(error, res, 'clear cache');
    }
  }

  // ======================
  // HELPER METHODS
  // ======================

  convertToCSV(data) {
    if (!Array.isArray(data) || data.length === 0) {
      return 'No data available';
    }

    const headers = ['ID', 'Name', 'Code', 'Type', 'Start Date', 'End Date', 'Total Marks', 'Passing Marks', 'Class', 'Subject', 'Term'];
    const csvContent = [
      headers.join(','),
      ...data.map(exam => [
        exam.id,
        `"${exam.name}"`,
        exam.code,
        exam.type,
        exam.startDate,
        exam.endDate,
        exam.totalMarks,
        exam.passingMarks,
        exam.class?.name || '',
        exam.subject?.name || '',
        exam.term?.name || ''
      ].join(','))
    ].join('\n');

    return csvContent;
  }
}

export default new ExamController();

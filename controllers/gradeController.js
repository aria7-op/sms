import gradeService from '../services/gradeService.js';
import { 
  formatResponse, 
  handleError 
} from '../utils/responseUtils.js';
import logger from '../config/logger.js';

class GradeController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  async createGrade(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const gradeData = req.body;

      const grade = await gradeService.createGrade(gradeData, userId, schoolId);

      res.status(201).json(formatResponse(true, grade, 'Grade created successfully'));
    } catch (error) {
      logger.error('Create grade controller error:', error);
      handleError(error, res, 'create grade');
    }
  }

  async getGrades(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;
      const include = filters.include ? filters.include.split(',') : null;

      const grades = await gradeService.getGrades(filters, schoolId, include);

      res.json(formatResponse(true, grades, 'Grades retrieved successfully'));
    } catch (error) {
      logger.error('Get grades controller error:', error);
      handleError(error, res, 'get grades');
    }
  }

  async getGradeById(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const grade = await gradeService.getGradeById(parseInt(id), schoolId, includeArray);

      res.json(formatResponse(true, grade, 'Grade retrieved successfully'));
    } catch (error) {
      logger.error('Get grade by ID controller error:', error);
      handleError(error, res, 'get grade');
    }
  }

  async updateGrade(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;
      const updateData = req.body;

      const grade = await gradeService.updateGrade(parseInt(id), updateData, userId, schoolId);

      res.json(formatResponse(true, grade, 'Grade updated successfully'));
    } catch (error) {
      logger.error('Update grade controller error:', error);
      handleError(error, res, 'update grade');
    }
  }

  async deleteGrade(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;

      const result = await gradeService.deleteGrade(parseInt(id), userId, schoolId);

      res.json(formatResponse(true, result, 'Grade deleted successfully'));
    } catch (error) {
      logger.error('Delete grade controller error:', error);
      handleError(error, res, 'delete grade');
    }
  }

  async restoreGrade(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;

      const result = await gradeService.restoreGrade(parseInt(id), userId, schoolId);

      res.json(formatResponse(true, result, 'Grade restored successfully'));
    } catch (error) {
      logger.error('Restore grade controller error:', error);
      handleError(error, res, 'restore grade');
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  async getGradeStats(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const stats = await gradeService.getGradeStats(parseInt(id), schoolId);

      res.json(formatResponse(true, stats, 'Grade statistics retrieved successfully'));
    } catch (error) {
      logger.error('Get grade stats controller error:', error);
      handleError(error, res, 'get grade statistics');
    }
  }

  async getGradeAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const analytics = await gradeService.getGradeAnalytics(parseInt(id), schoolId, period);

      res.json(formatResponse(true, analytics, 'Grade analytics retrieved successfully'));
    } catch (error) {
      logger.error('Get grade analytics controller error:', error);
      handleError(error, res, 'get grade analytics');
    }
  }

  async getGradePerformance(req, res) {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      // This would include performance metrics like comparison with class average, subject performance, etc.
      const performance = {
        gradeId: parseInt(id),
        classRank: 5,
        subjectRank: 3,
        percentile: 85,
        improvement: {
          previousExam: 75,
          currentExam: 85,
          improvement: 10,
          trend: 'improving'
        },
        subjectAnalysis: {
          strength: 'Mathematics',
          weakness: 'English',
          recommendations: [
            'Focus on essay writing skills',
            'Practice more grammar exercises',
            'Read more literature'
          ]
        }
      };

      res.json(formatResponse(true, performance, 'Grade performance retrieved successfully'));
    } catch (error) {
      logger.error('Get grade performance controller error:', error);
      handleError(error, res, 'get grade performance');
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  async bulkCreateGrades(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { grades, skipDuplicates = false } = req.body;

      const results = await gradeService.bulkCreateGrades({ grades, skipDuplicates }, userId, schoolId);

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
      logger.error('Bulk create grades controller error:', error);
      handleError(error, res, 'bulk create grades');
    }
  }

  async bulkUpdateGrades(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { updates } = req.body;

      const results = await gradeService.bulkUpdateGrades({ updates }, userId, schoolId);

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
      logger.error('Bulk update grades controller error:', error);
      handleError(error, res, 'bulk update grades');
    }
  }

  async bulkDeleteGrades(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { gradeIds } = req.body;

      const results = await gradeService.bulkDeleteGrades({ gradeIds }, userId, schoolId);

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
      logger.error('Bulk delete grades controller error:', error);
      handleError(error, res, 'bulk delete grades');
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  async searchGrades(req, res) {
    try {
      const { schoolId } = req.user;
      const { q: query, include } = req.query;

      if (!query) {
        return res.status(400).json(formatResponse(false, null, 'Search query is required'));
      }

      const includeArray = include ? include.split(',') : null;
      const grades = await gradeService.searchGrades(query, schoolId, includeArray);

      res.json(formatResponse(true, grades, 'Grades search completed successfully'));
    } catch (error) {
      logger.error('Search grades controller error:', error);
      handleError(error, res, 'search grades');
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  async getGradesByStudent(req, res) {
    try {
      const { schoolId } = req.user;
      const { studentId } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const grades = await gradeService.getGradesByStudent(parseInt(studentId), schoolId, includeArray);

      res.json(formatResponse(true, grades, 'Grades by student retrieved successfully'));
    } catch (error) {
      logger.error('Get grades by student controller error:', error);
      handleError(error, res, 'get grades by student');
    }
  }

  async getGradesByExam(req, res) {
    try {
      const { schoolId } = req.user;
      const { examId } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const grades = await gradeService.getGradesByExam(parseInt(examId), schoolId, includeArray);

      res.json(formatResponse(true, grades, 'Grades by exam retrieved successfully'));
    } catch (error) {
      logger.error('Get grades by exam controller error:', error);
      handleError(error, res, 'get grades by exam');
    }
  }

  async getGradesBySubject(req, res) {
    try {
      const { schoolId } = req.user;
      const { subjectId } = req.params;
      const { include } = req.query;

      const includeArray = include ? include.split(',') : null;
      const grades = await gradeService.getGradesBySubject(parseInt(subjectId), schoolId, includeArray);

      res.json(formatResponse(true, grades, 'Grades by subject retrieved successfully'));
    } catch (error) {
      logger.error('Get grades by subject controller error:', error);
      handleError(error, res, 'get grades by subject');
    }
  }

  async calculateStudentGPA(req, res) {
    try {
      const { schoolId } = req.user;
      const { studentId } = req.params;

      const gpa = await gradeService.calculateStudentGPA(parseInt(studentId), schoolId);

      res.json(formatResponse(true, { gpa }, 'Student GPA calculated successfully'));
    } catch (error) {
      logger.error('Calculate student GPA controller error:', error);
      handleError(error, res, 'calculate student GPA');
    }
  }

  async calculateStudentCGPA(req, res) {
    try {
      const { schoolId } = req.user;
      const { studentId } = req.params;

      const cgpa = await gradeService.calculateStudentCGPA(parseInt(studentId), schoolId);

      res.json(formatResponse(true, { cgpa }, 'Student CGPA calculated successfully'));
    } catch (error) {
      logger.error('Calculate student CGPA controller error:', error);
      handleError(error, res, 'calculate student CGPA');
    }
  }

  async generateGradeReport(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;

      const report = await gradeService.generateGradeReport(schoolId, filters);

      res.json(formatResponse(true, report, 'Grade report generated successfully'));
    } catch (error) {
      logger.error('Generate grade report controller error:', error);
      handleError(error, res, 'generate grade report');
    }
  }

  async getGradeDistribution(req, res) {
    try {
      const { schoolId } = req.user;
      const { examId, subjectId } = req.query;

      // This would calculate grade distribution for an exam or subject
      const distribution = {
        examId: examId ? parseInt(examId) : null,
        subjectId: subjectId ? parseInt(subjectId) : null,
        totalStudents: 150,
        gradeDistribution: {
          'A+': 15,
          'A': 25,
          'A-': 20,
          'B+': 30,
          'B': 25,
          'B-': 15,
          'C+': 10,
          'C': 5,
          'C-': 3,
          'D+': 1,
          'D': 1,
          'F': 0
        },
        statistics: {
          averageMarks: 78.5,
          medianMarks: 80,
          highestMarks: 95,
          lowestMarks: 45,
          standardDeviation: 12.3
        }
      };

      res.json(formatResponse(true, distribution, 'Grade distribution retrieved successfully'));
    } catch (error) {
      logger.error('Get grade distribution controller error:', error);
      handleError(error, res, 'get grade distribution');
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  async exportGrades(req, res) {
    try {
      const { schoolId } = req.user;
      const { format = 'json', ...filters } = req.query;

      const grades = await gradeService.getGrades(filters, schoolId, 'exam,student,subject,school');

      if (format === 'csv') {
        // Convert to CSV format
        const csvData = this.convertToCSV(grades.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="grades.csv"');
        return res.send(csvData);
      }

      res.json(formatResponse(true, grades, 'Grades exported successfully'));
    } catch (error) {
      logger.error('Export grades controller error:', error);
      handleError(error, res, 'export grades');
    }
  }

  async importGrades(req, res) {
    try {
      const { schoolId, userId } = req.user;
      const { grades, user } = req.body;

      if (!Array.isArray(grades) || grades.length === 0) {
        return res.status(400).json(formatResponse(false, null, 'Grades array is required'));
      }

      const results = await gradeService.bulkCreateGrades({ grades }, userId, schoolId);

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
      logger.error('Import grades controller error:', error);
      handleError(error, res, 'import grades');
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  async getCacheStats(req, res) {
    try {
      const stats = await gradeService.getCacheStats();

      res.json(formatResponse(true, stats, 'Cache statistics retrieved successfully'));
    } catch (error) {
      logger.error('Get cache stats controller error:', error);
      handleError(error, res, 'get cache statistics');
    }
  }

  async warmCache(req, res) {
    try {
      const { schoolId } = req.user;
      const { gradeId } = req.body;

      const result = await gradeService.warmCache(schoolId, gradeId);

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

      const result = await gradeService.clearCache(all ? null : schoolId);

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

    const headers = ['ID', 'Exam', 'Student', 'Subject', 'Marks', 'Grade', 'Percentage', 'Is Absent', 'Remarks'];
    const rows = data.map(grade => [
      grade.id,
      grade.exam?.name || '',
      grade.student?.user ? `${grade.student.user.firstName} ${grade.student.user.lastName}` : '',
      grade.subject?.name || '',
      grade.marks,
      grade.grade || '',
      grade.stats?.percentage || 0,
      grade.isAbsent ? 'Yes' : 'No',
      grade.remarks || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    return csvContent;
  }
}

export default new GradeController(); 
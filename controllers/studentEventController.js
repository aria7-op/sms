import StudentEventService from '../services/studentEventService.js';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createSuccessResponse, createErrorResponse } from '../utils/responseUtils.js';

const prisma = new PrismaClient();
const studentEventService = new StudentEventService();

class StudentEventController {
  constructor() {
    this.studentEventService = studentEventService;
  }

  /**
   * Get student timeline
   */
  async getStudentTimeline(req, res) {
    try {
      const { studentId } = req.params;
      const { startDate, endDate, eventType } = req.query;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const filters = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (eventType) filters.eventType = eventType;

      const result = await this.studentEventService.getStudentTimeline(studentId, filters);

      return createSuccessResponse(res, 'Student timeline retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting student timeline:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student timeline');
    }
  }

  /**
   * Get student academic events
   */
  async getStudentAcademicEvents(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.getStudentAcademicEvents(studentId);

      return createSuccessResponse(res, 'Student academic events retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting student academic events:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student academic events');
    }
  }

  /**
   * Get student attendance events
   */
  async getStudentAttendanceEvents(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.getStudentAttendanceEvents(studentId);

      return createSuccessResponse(res, 'Student attendance events retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting student attendance events:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student attendance events');
    }
  }

  /**
   * Get student financial events
   */
  async getStudentFinancialEvents(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.getStudentFinancialEvents(studentId);

      return createSuccessResponse(res, 'Student financial events retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting student financial events:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student financial events');
    }
  }

  /**
   * Get student conversion events
   */
  async getStudentConversionEvents(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.getStudentConversionEvents(studentId);

      return createSuccessResponse(res, 'Student conversion events retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting student conversion events:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student conversion events');
    }
  }

  /**
   * Get student analytics
   */
  async getStudentAnalytics(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.getStudentAnalytics(studentId);

      return createSuccessResponse(res, 'Student analytics retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting student analytics:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student analytics');
    }
  }

  /**
   * Get student performance summary
   */
  async getStudentPerformanceSummary(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.getStudentPerformanceSummary(studentId);

      return createSuccessResponse(res, 'Student performance summary retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting student performance summary:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student performance summary');
    }
  }

  /**
   * Get student events with filtering
   */
  async getStudentEvents(req, res) {
    try {
      const { studentId } = req.params;
      const { 
        eventType, 
        startDate, 
        endDate, 
        page = 1, 
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const filters = {
        eventType,
        startDate,
        endDate,
        page: parseInt(page),
        limit: parseInt(limit),
        sortBy,
        sortOrder
      };

      const result = await this.studentEventService.getStudentEvents(studentId, filters);

      return createSuccessResponse(res, 'Student events retrieved successfully', result.data);
    } catch (error) {
      logger.error('Error getting student events:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student events');
    }
  }

  /**
   * Create student exam grade event
   */
  async createStudentExamGrade(req, res) {
    try {
      const { studentId } = req.params;
      const gradeData = req.body;
      const { schoolId, id: userId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.createStudentExamGradeEvent(
        studentId,
        gradeData,
        userId,
        schoolId
      );

      return createSuccessResponse(res, 'Student exam grade event created successfully', result.data);
    } catch (error) {
      logger.error('Error creating student exam grade event:', error);
      return createErrorResponse(res, 500, 'Failed to create student exam grade event');
    }
  }

  /**
   * Create student attendance event
   */
  async createStudentAttendance(req, res) {
    try {
      const { studentId } = req.params;
      const attendanceData = req.body;
      const { schoolId, id: userId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.createStudentAttendanceEvent(
        studentId,
        attendanceData,
        userId,
        schoolId
      );

      return createSuccessResponse(res, 'Student attendance event created successfully', result.data);
    } catch (error) {
      logger.error('Error creating student attendance event:', error);
      return createErrorResponse(res, 500, 'Failed to create student attendance event');
    }
  }

  /**
   * Create student class change event
   */
  async createStudentClassChange(req, res) {
    try {
      const { studentId } = req.params;
      const classChangeData = req.body;
      const { schoolId, id: userId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.createStudentClassChangeEvent(
        studentId,
        classChangeData,
        userId,
        schoolId
      );

      return createSuccessResponse(res, 'Student class change event created successfully', result.data);
    } catch (error) {
      logger.error('Error creating student class change event:', error);
      return createErrorResponse(res, 500, 'Failed to create student class change event');
    }
  }

  /**
   * Create student performance review event
   */
  async createStudentPerformanceReview(req, res) {
    try {
      const { studentId } = req.params;
      const performanceData = req.body;
      const { schoolId, id: userId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.createStudentPerformanceReviewEvent(
        studentId,
        performanceData,
        userId,
        schoolId
      );

      return createSuccessResponse(res, 'Student performance review event created successfully', result.data);
    } catch (error) {
      logger.error('Error creating student performance review event:', error);
      return createErrorResponse(res, 500, 'Failed to create student performance review event');
    }
  }

  /**
   * Export student events
   */
  async exportStudentEvents(req, res) {
    try {
      const { studentId } = req.params;
      const { format = 'json' } = req.query;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      const result = await this.studentEventService.exportStudentEvents(studentId, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="student_${studentId}_events.csv"`);
        
        // Convert to CSV string
        const headers = Object.keys(result.data[0] || {}).join(',');
        const rows = result.data.map(row => Object.values(row).join(','));
        const csvContent = [headers, ...rows].join('\n');
        
        return res.send(csvContent);
      }

      return createSuccessResponse(res, 'Student events exported successfully', result.data);
    } catch (error) {
      logger.error('Error exporting student events:', error);
      return createErrorResponse(res, 500, 'Failed to export student events');
    }
  }

  /**
   * Get student academic performance analytics
   */
  async getStudentAcademicPerformanceAnalytics(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;

      // Verify student exists and belongs to school
      const student = await prisma.student.findFirst({
        where: {
          id: BigInt(studentId),
          schoolId: BigInt(schoolId)
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      // Get academic events
      const academicEvents = await this.studentEventService.getStudentAcademicEvents(studentId);
      
      // Get performance summary
      const performanceSummary = await this.studentEventService.getStudentPerformanceSummary(studentId);
      
      // Calculate academic analytics
      const academicAnalytics = {
        totalExams: performanceSummary.data.totalExams,
        averageScore: performanceSummary.data.averageScore,
        highestScore: performanceSummary.data.highestScore,
        lowestScore: performanceSummary.data.lowestScore,
        subjects: performanceSummary.data.subjects,
        recentGrades: performanceSummary.data.recentGrades,
        academicEvents: academicEvents.data.length,
        performanceTrend: this.calculatePerformanceTrend(performanceSummary.data.recentGrades)
      };

      return createSuccessResponse(res, 'Student academic performance analytics retrieved successfully', academicAnalytics);
    } catch (error) {
      logger.error('Error getting student academic performance analytics:', error);
      return createErrorResponse(res, 500, 'Failed to retrieve student academic performance analytics');
    }
  }

  /**
   * Calculate performance trend
   */
  calculatePerformanceTrend(recentGrades) {
    if (recentGrades.length < 2) return 'INSUFFICIENT_DATA';
    
    const scores = recentGrades.map(grade => grade.marks / grade.totalMarks * 100);
    const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
    const secondHalf = scores.slice(Math.floor(scores.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, score) => sum + score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, score) => sum + score, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg + 5) return 'IMPROVING';
    if (secondAvg < firstAvg - 5) return 'DECLINING';
    return 'STABLE';
  }
}

export default StudentEventController; 
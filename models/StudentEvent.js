import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

class StudentEvent {
  constructor() {
    this.prisma = prisma;
  }

  /**
   * Create a new student event
   */
  async create(eventData) {
    try {
      const event = await this.prisma.studentEvent.create({
        data: {
          ...eventData,
          metadata: eventData.metadata ? JSON.stringify(eventData.metadata) : null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info(`Student event created: ${event.id} - ${event.eventType}`);
      return { success: true, data: event };
    } catch (error) {
      logger.error('Error creating student event:', error);
      throw error;
    }
  }

  /**
   * Get student events with filtering and pagination
   */
  async getAll(filters = {}) {
    try {
      const {
        studentId,
        eventType,
        startDate,
        endDate,
        page = 1,
        limit = 50,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = filters;

      const whereClause = {};
      
      if (studentId) whereClause.studentId = BigInt(studentId);
      if (eventType) whereClause.eventType = eventType;
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = new Date(startDate);
        if (endDate) whereClause.createdAt.lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;
      
      const [events, total] = await Promise.all([
        this.prisma.studentEvent.findMany({
          where: whereClause,
          include: {
            student: {
              select: {
                id: true,
                admissionNo: true,
                rollNo: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                },
                class: {
                  select: {
                    id: true,
                    name: true,
                    code: true
                  }
                },
                section: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            },
            createdByUser: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        this.prisma.studentEvent.count({ where: whereClause })
      ]);

      return {
        success: true,
        data: events,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting student events:', error);
      throw error;
    }
  }

  /**
   * Get student events by student ID
   */
  async getByStudentId(studentId, filters = {}) {
    try {
      const events = await this.prisma.studentEvent.findMany({
        where: {
          studentId: BigInt(studentId),
          ...filters
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, data: events };
    } catch (error) {
      logger.error('Error getting student events by student ID:', error);
      throw error;
    }
  }

  /**
   * Get student academic events (exams, grades, assignments)
   */
  async getAcademicEvents(studentId) {
    try {
      const events = await this.prisma.studentEvent.findMany({
        where: {
          studentId: BigInt(studentId),
          eventType: {
            in: [
              'STUDENT_EXAM_GRADE_ADDED',
              'STUDENT_EXAM_GRADE_UPDATED',
              'STUDENT_ASSIGNMENT_SUBMITTED',
              'STUDENT_ASSIGNMENT_GRADED',
              'STUDENT_ACADEMIC_PERFORMANCE_REVIEW',
              'STUDENT_CLASS_CHANGED',
              'STUDENT_SECTION_CHANGED'
            ]
          }
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, data: events };
    } catch (error) {
      logger.error('Error getting student academic events:', error);
      throw error;
    }
  }

  /**
   * Get student attendance events
   */
  async getAttendanceEvents(studentId) {
    try {
      const events = await this.prisma.studentEvent.findMany({
        where: {
          studentId: BigInt(studentId),
          eventType: {
            in: [
              'STUDENT_ATTENDANCE_MARKED',
              'STUDENT_ATTENDANCE_UPDATED',
              'STUDENT_ABSENT',
              'STUDENT_LATE',
              'STUDENT_ATTENDANCE_REPORT'
            ]
          }
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, data: events };
    } catch (error) {
      logger.error('Error getting student attendance events:', error);
      throw error;
    }
  }

  /**
   * Get student financial events
   */
  async getFinancialEvents(studentId) {
    try {
      const events = await this.prisma.studentEvent.findMany({
        where: {
          studentId: BigInt(studentId),
          eventType: {
            in: [
              'STUDENT_PAYMENT_MADE',
              'STUDENT_PAYMENT_FAILED',
              'STUDENT_FEE_DUE',
              'STUDENT_FEE_OVERDUE',
              'STUDENT_SCHOLARSHIP_GRANTED',
              'STUDENT_REFUND_PROCESSED',
              'STUDENT_INSTALLMENT_PAID'
            ]
          }
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, data: events };
    } catch (error) {
      logger.error('Error getting student financial events:', error);
      throw error;
    }
  }

  /**
   * Get student conversion events (from customer to student)
   */
  async getConversionEvents(studentId) {
    try {
      const events = await this.prisma.studentEvent.findMany({
        where: {
          studentId: BigInt(studentId),
          eventType: {
            in: [
              'CUSTOMER_CONVERTED_TO_STUDENT',
              'STUDENT_ENROLLMENT_COMPLETED',
              'STUDENT_ADMISSION_APPROVED',
              'STUDENT_REGISTRATION_COMPLETED'
            ]
          }
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return { success: true, data: events };
    } catch (error) {
      logger.error('Error getting student conversion events:', error);
      throw error;
    }
  }

  /**
   * Get student timeline
   */
  async getStudentTimeline(studentId, filters = {}) {
    try {
      const events = await this.prisma.studentEvent.findMany({
        where: {
          studentId: BigInt(studentId),
          ...filters
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Group events by date
      const timeline = events.reduce((acc, event) => {
        const date = event.createdAt.toISOString().split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(event);
        return acc;
      }, {});

      return { success: true, data: timeline };
    } catch (error) {
      logger.error('Error getting student timeline:', error);
      throw error;
    }
  }

  /**
   * Get student analytics
   */
  async getStudentAnalytics(studentId) {
    try {
      const [
        totalEvents,
        academicEvents,
        attendanceEvents,
        financialEvents,
        conversionEvents,
        recentEvents
      ] = await Promise.all([
        this.prisma.studentEvent.count({
          where: { studentId: BigInt(studentId) }
        }),
        this.prisma.studentEvent.count({
          where: {
            studentId: BigInt(studentId),
            eventType: {
              in: [
                'STUDENT_EXAM_GRADE_ADDED',
                'STUDENT_EXAM_GRADE_UPDATED',
                'STUDENT_ASSIGNMENT_SUBMITTED',
                'STUDENT_ASSIGNMENT_GRADED',
                'STUDENT_ACADEMIC_PERFORMANCE_REVIEW'
              ]
            }
          }
        }),
        this.prisma.studentEvent.count({
          where: {
            studentId: BigInt(studentId),
            eventType: {
              in: [
                'STUDENT_ATTENDANCE_MARKED',
                'STUDENT_ATTENDANCE_UPDATED',
                'STUDENT_ABSENT',
                'STUDENT_LATE'
              ]
            }
          }
        }),
        this.prisma.studentEvent.count({
          where: {
            studentId: BigInt(studentId),
            eventType: {
              in: [
                'STUDENT_PAYMENT_MADE',
                'STUDENT_PAYMENT_FAILED',
                'STUDENT_FEE_DUE',
                'STUDENT_FEE_OVERDUE',
                'STUDENT_SCHOLARSHIP_GRANTED'
              ]
            }
          }
        }),
        this.prisma.studentEvent.count({
          where: {
            studentId: BigInt(studentId),
            eventType: {
              in: [
                'CUSTOMER_CONVERTED_TO_STUDENT',
                'STUDENT_ENROLLMENT_COMPLETED',
                'STUDENT_ADMISSION_APPROVED'
              ]
            }
          }
        }),
        this.prisma.studentEvent.findMany({
          where: { studentId: BigInt(studentId) },
          take: 10,
          orderBy: { createdAt: 'desc' }
        })
      ]);

      return {
        success: true,
        data: {
          totalEvents,
          academicEvents,
          attendanceEvents,
          financialEvents,
          conversionEvents,
          recentEvents
        }
      };
    } catch (error) {
      logger.error('Error getting student analytics:', error);
      throw error;
    }
  }

  /**
   * Get student performance summary
   */
  async getStudentPerformanceSummary(studentId) {
    try {
      const academicEvents = await this.prisma.studentEvent.findMany({
        where: {
          studentId: BigInt(studentId),
          eventType: {
            in: [
              'STUDENT_EXAM_GRADE_ADDED',
              'STUDENT_EXAM_GRADE_UPDATED',
              'STUDENT_ASSIGNMENT_GRADED'
            ]
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Calculate performance metrics
      const grades = academicEvents
        .filter(event => event.metadata)
        .map(event => {
          const metadata = JSON.parse(event.metadata);
          return {
            marks: metadata.marks || 0,
            totalMarks: metadata.totalMarks || 100,
            subject: metadata.subject,
            examType: metadata.examType,
            date: event.createdAt
          };
        });

      const performanceSummary = {
        totalExams: grades.length,
        averageScore: grades.length > 0 ? 
          grades.reduce((sum, grade) => sum + (grade.marks / grade.totalMarks * 100), 0) / grades.length : 0,
        highestScore: grades.length > 0 ? Math.max(...grades.map(g => g.marks / g.totalMarks * 100)) : 0,
        lowestScore: grades.length > 0 ? Math.min(...grades.map(g => g.marks / g.totalMarks * 100)) : 0,
        recentGrades: grades.slice(0, 5),
        subjects: [...new Set(grades.map(g => g.subject))]
      };

      return { success: true, data: performanceSummary };
    } catch (error) {
      logger.error('Error getting student performance summary:', error);
      throw error;
    }
  }

  /**
   * Delete student events
   */
  async deleteByStudentId(studentId) {
    try {
      await this.prisma.studentEvent.deleteMany({
        where: { studentId: BigInt(studentId) }
      });

      logger.info(`Deleted all events for student: ${studentId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting student events:', error);
      throw error;
    }
  }
}

export default StudentEvent; 
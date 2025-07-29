import StudentEvent from '../models/StudentEvent.js';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createNotification } from './notificationService.js';

const prisma = new PrismaClient();

class StudentEventService {
  constructor() {
    this.studentEventModel = new StudentEvent();
  }

  /**
   * Create student enrollment event
   */
  async createStudentEnrollmentEvent(studentData, userId, schoolId) {
    try {
      const eventData = {
        studentId: studentData.id,
        eventType: 'STUDENT_ENROLLMENT_COMPLETED',
        title: 'Student Enrollment Completed',
        description: `Student ${studentData.user?.firstName} ${studentData.user?.lastName} has been enrolled`,
        metadata: {
          studentName: `${studentData.user?.firstName} ${studentData.user?.lastName}`,
          admissionNo: studentData.admissionNo,
          rollNo: studentData.rollNo,
          classId: studentData.classId,
          sectionId: studentData.sectionId,
          parentId: studentData.parentId,
          admissionDate: studentData.admissionDate,
          previousCustomerId: studentData.previousCustomerId,
          enrollmentMethod: studentData.enrollmentMethod,
          enrollmentSource: studentData.enrollmentSource
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'SUCCESS'
      };

      const result = await this.studentEventModel.create(eventData);

      // Create notification
      await createNotification({
        title: 'Student Enrollment Completed',
        message: `Student ${studentData.user?.firstName} ${studentData.user?.lastName} has been successfully enrolled`,
        type: 'STUDENT_ENROLLED',
        userId: userId,
        schoolId: schoolId,
        metadata: {
          studentId: studentData.id,
          admissionNo: studentData.admissionNo,
          studentName: `${studentData.user?.firstName} ${studentData.user?.lastName}`
        }
      });

      return result;
    } catch (error) {
      logger.error('Error creating student enrollment event:', error);
      throw error;
    }
  }

  /**
   * Create student exam grade event
   */
  async createStudentExamGradeEvent(studentId, gradeData, userId, schoolId) {
    try {
      const eventData = {
        studentId: studentId,
        eventType: 'STUDENT_EXAM_GRADE_ADDED',
        title: 'Student Exam Grade Added',
        description: `Grade ${gradeData.marks}/${gradeData.totalMarks} added for ${gradeData.subject}`,
        metadata: {
          examId: gradeData.examId,
          subjectId: gradeData.subjectId,
          subject: gradeData.subject,
          examType: gradeData.examType,
          marks: gradeData.marks,
          totalMarks: gradeData.totalMarks,
          grade: gradeData.grade,
          percentage: (gradeData.marks / gradeData.totalMarks * 100).toFixed(2),
          remarks: gradeData.remarks,
          isAbsent: gradeData.isAbsent,
          examDate: gradeData.examDate
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.studentEventModel.create(eventData);

      // Create notification for significant grade changes
      if (gradeData.marks / gradeData.totalMarks < 0.4) {
        await createNotification({
          title: 'Low Grade Alert',
          message: `Student received low grade in ${gradeData.subject}: ${gradeData.marks}/${gradeData.totalMarks}`,
          type: 'LOW_GRADE_ALERT',
          userId: userId,
          schoolId: schoolId,
          metadata: {
            studentId: studentId,
            subject: gradeData.subject,
            marks: gradeData.marks,
            totalMarks: gradeData.totalMarks
          }
        });
      }

      return result;
    } catch (error) {
      logger.error('Error creating student exam grade event:', error);
      throw error;
    }
  }

  /**
   * Create student attendance event
   */
  async createStudentAttendanceEvent(studentId, attendanceData, userId, schoolId) {
    try {
      const eventData = {
        studentId: studentId,
        eventType: 'STUDENT_ATTENDANCE_MARKED',
        title: 'Student Attendance Marked',
        description: `Attendance marked as ${attendanceData.status} for ${attendanceData.date}`,
        metadata: {
          date: attendanceData.date,
          status: attendanceData.status,
          classId: attendanceData.classId,
          subjectId: attendanceData.subjectId,
          remarks: attendanceData.remarks,
          markedBy: userId,
          markedAt: new Date().toISOString()
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.studentEventModel.create(eventData);

      // Create notification for absences
      if (attendanceData.status === 'ABSENT') {
        await createNotification({
          title: 'Student Absent',
          message: `Student was absent on ${attendanceData.date}`,
          type: 'STUDENT_ABSENT',
          userId: userId,
          schoolId: schoolId,
          metadata: {
            studentId: studentId,
            date: attendanceData.date,
            status: attendanceData.status
          }
        });
      }

      return result;
    } catch (error) {
      logger.error('Error creating student attendance event:', error);
      throw error;
    }
  }

  /**
   * Create student payment event
   */
  async createStudentPaymentEvent(studentId, paymentData, userId, schoolId) {
    try {
      const eventData = {
        studentId: studentId,
        eventType: 'STUDENT_PAYMENT_MADE',
        title: 'Student Payment Made',
        description: `Payment of ${paymentData.amount} received`,
        metadata: {
          paymentId: paymentData.paymentId,
          amount: paymentData.amount,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: paymentData.paymentStatus,
          transactionId: paymentData.transactionId,
          feeType: paymentData.feeType,
          dueDate: paymentData.dueDate,
          paidDate: paymentData.paidDate,
          gatewayResponse: paymentData.gatewayResponse
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'SUCCESS'
      };

      const result = await this.studentEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating student payment event:', error);
      throw error;
    }
  }

  /**
   * Create student class change event
   */
  async createStudentClassChangeEvent(studentId, classChangeData, userId, schoolId) {
    try {
      const eventData = {
        studentId: studentId,
        eventType: 'STUDENT_CLASS_CHANGED',
        title: 'Student Class Changed',
        description: `Student moved from ${classChangeData.oldClass} to ${classChangeData.newClass}`,
        metadata: {
          oldClassId: classChangeData.oldClassId,
          newClassId: classChangeData.newClassId,
          oldClass: classChangeData.oldClass,
          newClass: classChangeData.newClass,
          oldSectionId: classChangeData.oldSectionId,
          newSectionId: classChangeData.newSectionId,
          oldSection: classChangeData.oldSection,
          newSection: classChangeData.newSection,
          reason: classChangeData.reason,
          effectiveDate: classChangeData.effectiveDate,
          changedBy: userId
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.studentEventModel.create(eventData);

      // Create notification
      await createNotification({
        title: 'Student Class Changed',
        message: `Student has been moved from ${classChangeData.oldClass} to ${classChangeData.newClass}`,
        type: 'STUDENT_CLASS_CHANGED',
        userId: userId,
        schoolId: schoolId,
        metadata: {
          studentId: studentId,
          oldClass: classChangeData.oldClass,
          newClass: classChangeData.newClass
        }
      });

      return result;
    } catch (error) {
      logger.error('Error creating student class change event:', error);
      throw error;
    }
  }

  /**
   * Create student academic performance review event
   */
  async createStudentPerformanceReviewEvent(studentId, performanceData, userId, schoolId) {
    try {
      const eventData = {
        studentId: studentId,
        eventType: 'STUDENT_ACADEMIC_PERFORMANCE_REVIEW',
        title: 'Student Academic Performance Review',
        description: `Academic performance review completed`,
        metadata: {
          reviewPeriod: performanceData.reviewPeriod,
          averageScore: performanceData.averageScore,
          totalSubjects: performanceData.totalSubjects,
          subjectsWithLowGrades: performanceData.subjectsWithLowGrades,
          improvementAreas: performanceData.improvementAreas,
          strengths: performanceData.strengths,
          recommendations: performanceData.recommendations,
          reviewedBy: userId,
          reviewDate: new Date().toISOString()
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.studentEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating student performance review event:', error);
      throw error;
    }
  }

  /**
   * Create student assignment submission event
   */
  async createStudentAssignmentSubmissionEvent(studentId, assignmentData, userId, schoolId) {
    try {
      const eventData = {
        studentId: studentId,
        eventType: 'STUDENT_ASSIGNMENT_SUBMITTED',
        title: 'Student Assignment Submitted',
        description: `Assignment "${assignmentData.title}" submitted`,
        metadata: {
          assignmentId: assignmentData.assignmentId,
          title: assignmentData.title,
          subject: assignmentData.subject,
          submittedAt: assignmentData.submittedAt,
          submissionMethod: assignmentData.submissionMethod,
          attachments: assignmentData.attachments,
          wordCount: assignmentData.wordCount,
          isLate: assignmentData.isLate,
          lateBy: assignmentData.lateBy
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.studentEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating student assignment submission event:', error);
      throw error;
    }
  }

  /**
   * Create student assignment graded event
   */
  async createStudentAssignmentGradedEvent(studentId, gradeData, userId, schoolId) {
    try {
      const eventData = {
        studentId: studentId,
        eventType: 'STUDENT_ASSIGNMENT_GRADED',
        title: 'Student Assignment Graded',
        description: `Assignment "${gradeData.title}" graded: ${gradeData.marks}/${gradeData.totalMarks}`,
        metadata: {
          assignmentId: gradeData.assignmentId,
          title: gradeData.title,
          subject: gradeData.subject,
          marks: gradeData.marks,
          totalMarks: gradeData.totalMarks,
          grade: gradeData.grade,
          percentage: (gradeData.marks / gradeData.totalMarks * 100).toFixed(2),
          feedback: gradeData.feedback,
          gradedBy: userId,
          gradedAt: new Date().toISOString()
        },
        createdBy: userId,
        schoolId: schoolId,
        severity: 'INFO'
      };

      const result = await this.studentEventModel.create(eventData);

      return result;
    } catch (error) {
      logger.error('Error creating student assignment graded event:', error);
      throw error;
    }
  }

  /**
   * Get student timeline with detailed events
   */
  async getStudentTimeline(studentId, filters = {}) {
    try {
      const result = await this.studentEventModel.getStudentTimeline(studentId, filters);
      return result;
    } catch (error) {
      logger.error('Error getting student timeline:', error);
      throw error;
    }
  }

  /**
   * Get student academic events
   */
  async getStudentAcademicEvents(studentId) {
    try {
      const result = await this.studentEventModel.getAcademicEvents(studentId);
      return result;
    } catch (error) {
      logger.error('Error getting student academic events:', error);
      throw error;
    }
  }

  /**
   * Get student attendance events
   */
  async getStudentAttendanceEvents(studentId) {
    try {
      const result = await this.studentEventModel.getAttendanceEvents(studentId);
      return result;
    } catch (error) {
      logger.error('Error getting student attendance events:', error);
      throw error;
    }
  }

  /**
   * Get student financial events
   */
  async getStudentFinancialEvents(studentId) {
    try {
      const result = await this.studentEventModel.getFinancialEvents(studentId);
      return result;
    } catch (error) {
      logger.error('Error getting student financial events:', error);
      throw error;
    }
  }

  /**
   * Get student conversion events
   */
  async getStudentConversionEvents(studentId) {
    try {
      const result = await this.studentEventModel.getConversionEvents(studentId);
      return result;
    } catch (error) {
      logger.error('Error getting student conversion events:', error);
      throw error;
    }
  }

  /**
   * Get student analytics
   */
  async getStudentAnalytics(studentId) {
    try {
      const result = await this.studentEventModel.getStudentAnalytics(studentId);
      return result;
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
      const result = await this.studentEventModel.getStudentPerformanceSummary(studentId);
      return result;
    } catch (error) {
      logger.error('Error getting student performance summary:', error);
      throw error;
    }
  }

  /**
   * Get student events with advanced filtering
   */
  async getStudentEvents(studentId, filters = {}) {
    try {
      const result = await this.studentEventModel.getByStudentId(studentId, filters);
      return result;
    } catch (error) {
      logger.error('Error getting student events:', error);
      throw error;
    }
  }

  /**
   * Create bulk student events
   */
  async createBulkStudentEvents(events) {
    try {
      const createdEvents = [];
      
      for (const event of events) {
        const result = await this.studentEventModel.create(event);
        createdEvents.push(result.data);
      }

      logger.info(`Created ${createdEvents.length} student events`);
      return { success: true, data: createdEvents };
    } catch (error) {
      logger.error('Error creating bulk student events:', error);
      throw error;
    }
  }

  /**
   * Export student events
   */
  async exportStudentEvents(studentId, format = 'json') {
    try {
      const events = await this.studentEventModel.getByStudentId(studentId);
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvData = events.data.map(event => ({
          Date: event.createdAt,
          Event_Type: event.eventType,
          Title: event.title,
          Description: event.description,
          Severity: event.severity,
          Created_By: event.createdByUser ? `${event.createdByUser.firstName} ${event.createdByUser.lastName}` : 'System'
        }));

        return { success: true, data: csvData, format: 'csv' };
      }

      return { success: true, data: events.data, format: 'json' };
    } catch (error) {
      logger.error('Error exporting student events:', error);
      throw error;
    }
  }
}

export default StudentEventService; 
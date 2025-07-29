import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const ExamTimetableCreateSchema = z.object({
  examId: z.number().int().positive('Exam ID is required'),
  subjectId: z.number().int().positive('Subject ID is required'),
  date: z.string().datetime('Date must be a valid datetime'),
  startTime: z.string().datetime('Start time must be a valid datetime'),
  endTime: z.string().datetime('End time must be a valid datetime'),
  roomNumber: z.string()
    .max(20, 'Room number must be less than 20 characters')
    .optional(),
  schoolId: z.number().int().positive('School ID is required'),
  metadata: z.record(z.any()).optional()
});

export const ExamTimetableUpdateSchema = z.object({
  date: z.string().datetime('Date must be a valid datetime').optional(),
  startTime: z.string().datetime('Start time must be a valid datetime').optional(),
  endTime: z.string().datetime('End time must be a valid datetime').optional(),
  roomNumber: z.string()
    .max(20, 'Room number must be less than 20 characters')
    .optional(),
  metadata: z.record(z.any()).optional()
});

export const ExamTimetableSearchSchema = z.object({
  // Search filters
  search: z.string().optional(),
  examId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  schoolId: z.number().int().positive().optional(),
  
  // Date filters
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  startTimeFrom: z.string().datetime().optional(),
  startTimeTo: z.string().datetime().optional(),
  endTimeFrom: z.string().datetime().optional(),
  endTimeTo: z.string().datetime().optional(),
  
  // Room filters
  roomNumber: z.string().optional(),
  
  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'date', 'startTime', 'endTime', 'examId', 'subjectId']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  
  // Include relations
  include: z.string().optional()
});

export const ExamTimetableBulkCreateSchema = z.object({
  timetables: z.array(ExamTimetableCreateSchema).min(1).max(1000),
  skipDuplicates: z.boolean().default(false)
});

export const ExamTimetableBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int().positive(),
    data: ExamTimetableUpdateSchema
  })).min(1).max(1000)
});

export const ExamTimetableBulkDeleteSchema = z.object({
  timetableIds: z.array(z.number().int().positive()).min(1).max(1000)
});

export const ExamTimetableConflictCheckSchema = z.object({
  examId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  date: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  roomNumber: z.string().optional(),
  excludeId: z.number().int().positive().optional()
});

// ======================
// SCHEDULING FUNCTIONS
// ======================

export const checkTimeConflict = (start1, end1, start2, end2) => {
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  
  return s1 < e2 && s2 < e1;
};

export const checkRoomConflict = async (examId, subjectId, date, startTime, endTime, roomNumber, schoolId, excludeId = null) => {
  if (!roomNumber) return false;
  
  const existingTimetable = await prisma.examTimetable.findFirst({
    where: {
      examId,
      roomNumber,
      schoolId,
      date: new Date(date),
      id: { not: excludeId },
      deletedAt: null,
      OR: [
        {
          startTime: {
            lte: new Date(endTime)
          },
          endTime: {
            gte: new Date(startTime)
          }
        }
      ]
    }
  });
  
  return !!existingTimetable;
};

export const checkSubjectConflict = async (examId, subjectId, date, startTime, endTime, schoolId, excludeId = null) => {
  const existingTimetable = await prisma.examTimetable.findFirst({
    where: {
      examId,
      subjectId,
      schoolId,
      date: new Date(date),
      id: { not: excludeId },
      deletedAt: null,
      OR: [
        {
          startTime: {
            lte: new Date(endTime)
          },
          endTime: {
            gte: new Date(startTime)
          }
        }
      ]
    }
  });
  
  return !!existingTimetable;
};

export const validateExamTimetableData = async (data, schoolId, excludeId = null) => {
  const errors = [];
  
  // Check if exam exists and belongs to the school
  const examExists = await prisma.exam.findFirst({
    where: {
      id: data.examId,
      schoolId,
      deletedAt: null
    }
  });
  
  if (!examExists) {
    errors.push('Exam does not exist or does not belong to this school');
  }
  
  // Check if subject exists and belongs to the school
  const subjectExists = await prisma.subject.findFirst({
    where: {
      id: data.subjectId,
      schoolId,
      deletedAt: null
    }
  });
  
  if (!subjectExists) {
    errors.push('Subject does not exist or does not belong to this school');
  }
  
  // Check for duplicate timetable entry
  const existingTimetable = await prisma.examTimetable.findFirst({
    where: {
      examId: data.examId,
      subjectId: data.subjectId,
      schoolId,
      id: { not: excludeId },
      deletedAt: null
    }
  });
  
  if (existingTimetable) {
    errors.push('Timetable already exists for this exam and subject combination');
  }
  
  // Check time conflicts
  const roomConflict = await checkRoomConflict(
    data.examId,
    data.subjectId,
    data.date,
    data.startTime,
    data.endTime,
    data.roomNumber,
    schoolId,
    excludeId
  );
  
  if (roomConflict) {
    errors.push('Room is already booked for this time slot');
  }
  
  const subjectConflict = await checkSubjectConflict(
    data.examId,
    data.subjectId,
    data.date,
    data.startTime,
    data.endTime,
    schoolId,
    excludeId
  );
  
  if (subjectConflict) {
    errors.push('Subject already has an exam scheduled for this time slot');
  }
  
  // Validate time logic
  const startTime = new Date(data.startTime);
  const endTime = new Date(data.endTime);
  const examDate = new Date(data.date);
  
  if (startTime >= endTime) {
    errors.push('Start time must be before end time');
  }
  
  if (startTime.getDate() !== examDate.getDate() || 
      startTime.getMonth() !== examDate.getMonth() || 
      startTime.getFullYear() !== examDate.getFullYear()) {
    errors.push('Start time must be on the same date as the exam date');
  }
  
  if (endTime.getDate() !== examDate.getDate() || 
      endTime.getMonth() !== examDate.getMonth() || 
      endTime.getFullYear() !== examDate.getFullYear()) {
    errors.push('End time must be on the same date as the exam date');
  }
  
  return errors;
};

export const buildExamTimetableSearchQuery = (filters, schoolId) => {
  const where = {
    schoolId,
    deletedAt: null
  };
  
  // Basic filters
  if (filters.examId) {
    where.examId = filters.examId;
  }
  
  if (filters.subjectId) {
    where.subjectId = filters.subjectId;
  }
  
  if (filters.roomNumber) {
    where.roomNumber = { contains: filters.roomNumber, mode: 'insensitive' };
  }
  
  // Date filters
  if (filters.dateFrom) where.date = { gte: new Date(filters.dateFrom) };
  if (filters.dateTo) where.date = { ...where.date, lte: new Date(filters.dateTo) };
  if (filters.startTimeFrom) where.startTime = { gte: new Date(filters.startTimeFrom) };
  if (filters.startTimeTo) where.startTime = { ...where.startTime, lte: new Date(filters.startTimeTo) };
  if (filters.endTimeFrom) where.endTime = { gte: new Date(filters.endTimeFrom) };
  if (filters.endTimeTo) where.endTime = { ...where.endTime, lte: new Date(filters.endTimeTo) };
  
  // Search across multiple fields
  if (filters.search) {
    where.OR = [
      { roomNumber: { contains: filters.search, mode: 'insensitive' } }
    ];
  }
  
  return where;
};

export const buildExamTimetableIncludeQuery = (include = []) => {
  const includeQuery = {};
  
  if (Array.isArray(include)) {
    if (include.includes('exam')) {
      includeQuery.exam = {
        include: {
          term: true,
          class: true,
          subject: true,
          school: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      };
    }
    
    if (include.includes('subject')) {
      includeQuery.subject = {
        include: {
          department: true
        }
      };
    }
    
    if (include.includes('school')) {
      includeQuery.school = {
        select: {
          id: true,
          name: true,
          code: true
        }
      };
    }
    
    if (include.includes('createdByUser')) {
      includeQuery.createdByUser = {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      };
    }
    
    if (include.includes('updatedByUser')) {
      includeQuery.updatedByUser = {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      };
    }
  } else if (typeof include === 'string') {
    const includes = include.split(',').map(item => item.trim());
    
    if (includes.includes('exam')) {
      includeQuery.exam = true;
    }
    
    if (includes.includes('subject')) {
      includeQuery.subject = true;
    }
    
    if (includes.includes('school')) {
      includeQuery.school = true;
    }
    
    if (includes.includes('createdByUser')) {
      includeQuery.createdByUser = true;
    }
    
    if (includes.includes('updatedByUser')) {
      includeQuery.updatedByUser = true;
    }
  }
  
  return includeQuery;
};

export const formatExamTimetableResponse = (timetable, includeStats = false) => {
  const formatted = {
    id: timetable.id,
    uuid: timetable.uuid,
    examId: timetable.examId,
    subjectId: timetable.subjectId,
    date: timetable.date,
    startTime: timetable.startTime,
    endTime: timetable.endTime,
    roomNumber: timetable.roomNumber,
    schoolId: timetable.schoolId,
    createdAt: timetable.createdAt,
    updatedAt: timetable.updatedAt,
    metadata: timetable.metadata
  };
  
  // Include relations if they exist
  if (timetable.exam) {
    formatted.exam = {
      id: timetable.exam.id,
      name: timetable.exam.name,
      code: timetable.exam.code,
      type: timetable.exam.type,
      totalMarks: timetable.exam.totalMarks,
      passingMarks: timetable.exam.passingMarks,
      term: timetable.exam.term ? {
        id: timetable.exam.term.id,
        name: timetable.exam.term.name
      } : null,
      class: timetable.exam.class ? {
        id: timetable.exam.class.id,
        name: timetable.exam.class.name
      } : null,
      subject: timetable.exam.subject ? {
        id: timetable.exam.subject.id,
        name: timetable.exam.subject.name
      } : null,
      school: timetable.exam.school ? {
        id: timetable.exam.school.id,
        name: timetable.exam.school.name,
        code: timetable.exam.school.code
      } : null
    };
  }
  
  if (timetable.subject) {
    formatted.subject = {
      id: timetable.subject.id,
      name: timetable.subject.name,
      code: timetable.subject.code,
      department: timetable.subject.department ? {
        id: timetable.subject.department.id,
        name: timetable.subject.department.name
      } : null
    };
  }
  
  if (timetable.school) {
    formatted.school = {
      id: timetable.school.id,
      name: timetable.school.name,
      code: timetable.school.code
    };
  }
  
  if (timetable.createdByUser) {
    formatted.createdByUser = {
      id: timetable.createdByUser.id,
      firstName: timetable.createdByUser.firstName,
      lastName: timetable.createdByUser.lastName,
      email: timetable.createdByUser.email
    };
  }
  
  if (timetable.updatedByUser) {
    formatted.updatedByUser = {
      id: timetable.updatedByUser.id,
      firstName: timetable.updatedByUser.firstName,
      lastName: timetable.updatedByUser.lastName,
      email: timetable.updatedByUser.email
    };
  }
  
  // Include statistics if requested
  if (includeStats) {
    formatted.stats = {
      duration: calculateDuration(timetable.startTime, timetable.endTime),
      isUpcoming: isUpcoming(timetable.date, timetable.startTime),
      isToday: isToday(timetable.date),
      isPast: isPast(timetable.date, timetable.endTime)
    };
  }
  
  return formatted;
};

export const calculateDuration = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMins / 60);
  const minutes = diffMins % 60;
  
  return {
    totalMinutes: diffMins,
    hours,
    minutes,
    formatted: `${hours}h ${minutes}m`
  };
};

export const isUpcoming = (date, startTime) => {
  const now = new Date();
  const examDateTime = new Date(date);
  examDateTime.setHours(new Date(startTime).getHours());
  examDateTime.setMinutes(new Date(startTime).getMinutes());
  
  return examDateTime > now;
};

export const isToday = (date) => {
  const today = new Date();
  const examDate = new Date(date);
  
  return today.getDate() === examDate.getDate() &&
         today.getMonth() === examDate.getMonth() &&
         today.getFullYear() === examDate.getFullYear();
};

export const isPast = (date, endTime) => {
  const now = new Date();
  const examDateTime = new Date(date);
  examDateTime.setHours(new Date(endTime).getHours());
  examDateTime.setMinutes(new Date(endTime).getMinutes());
  
  return examDateTime < now;
};

export const validateExamTimetablePermissions = async (timetableId, userId, schoolId) => {
  const timetable = await prisma.examTimetable.findFirst({
    where: {
      id: timetableId,
      schoolId
    }
  });
  
  if (!timetable) {
    throw new Error('Exam timetable not found or access denied');
  }
  
  return timetable;
};

export const generateExamTimetableReport = async (schoolId, filters = {}) => {
  const where = buildExamTimetableSearchQuery(filters, schoolId);
  
  const timetables = await prisma.examTimetable.findMany({
    where,
    include: {
      exam: {
        include: {
          term: true,
          class: true,
          subject: true
        }
      },
      subject: {
        include: {
          department: true
        }
      }
    }
  });
  
  const report = {
    totalTimetables: timetables.length,
    totalExams: new Set(timetables.map(t => t.examId)).size,
    totalSubjects: new Set(timetables.map(t => t.subjectId)).size,
    totalRooms: new Set(timetables.map(t => t.roomNumber).filter(Boolean)).size,
    upcomingExams: 0,
    todayExams: 0,
    pastExams: 0,
    roomUtilization: {},
    subjectDistribution: {},
    examDistribution: {},
    timeSlotAnalysis: {
      morning: 0,
      afternoon: 0,
      evening: 0
    }
  };
  
  timetables.forEach(timetable => {
    // Count upcoming, today, and past exams
    if (isUpcoming(timetable.date, timetable.startTime)) {
      report.upcomingExams++;
    } else if (isToday(timetable.date)) {
      report.todayExams++;
    } else if (isPast(timetable.date, timetable.endTime)) {
      report.pastExams++;
    }
    
    // Room utilization
    if (timetable.roomNumber) {
      if (!report.roomUtilization[timetable.roomNumber]) {
        report.roomUtilization[timetable.roomNumber] = {
          totalExams: 0,
          totalHours: 0
        };
      }
      report.roomUtilization[timetable.roomNumber].totalExams++;
      const duration = calculateDuration(timetable.startTime, timetable.endTime);
      report.roomUtilization[timetable.roomNumber].totalHours += duration.hours + (duration.minutes / 60);
    }
    
    // Subject distribution
    if (timetable.subject) {
      const subjectName = timetable.subject.name;
      if (!report.subjectDistribution[subjectName]) {
        report.subjectDistribution[subjectName] = 0;
      }
      report.subjectDistribution[subjectName]++;
    }
    
    // Exam distribution
    if (timetable.exam) {
      const examName = timetable.exam.name;
      if (!report.examDistribution[examName]) {
        report.examDistribution[examName] = 0;
      }
      report.examDistribution[examName]++;
    }
    
    // Time slot analysis
    const startHour = new Date(timetable.startTime).getHours();
    if (startHour >= 6 && startHour < 12) {
      report.timeSlotAnalysis.morning++;
    } else if (startHour >= 12 && startHour < 17) {
      report.timeSlotAnalysis.afternoon++;
    } else {
      report.timeSlotAnalysis.evening++;
    }
  });
  
  // Calculate room utilization percentages
  Object.keys(report.roomUtilization).forEach(room => {
    const roomData = report.roomUtilization[room];
    roomData.averageHoursPerExam = roomData.totalExams > 0 ? 
      (roomData.totalHours / roomData.totalExams) : 0;
  });
  
  return report;
};

export const generateOptimalSchedule = async (examId, schoolId, constraints = {}) => {
  // This would implement an algorithm to generate optimal exam schedules
  // considering room availability, subject conflicts, and other constraints
  
  const exam = await prisma.exam.findFirst({
    where: { id: examId, schoolId },
    include: { class: true }
  });
  
  if (!exam) {
    throw new Error('Exam not found');
  }
  
  // Get all subjects for this exam
  const subjects = await prisma.subject.findMany({
    where: { schoolId, deletedAt: null }
  });
  
  // Get available rooms
  const rooms = ['Room 101', 'Room 102', 'Room 103', 'Room 104', 'Room 105'];
  
  // Generate schedule (simplified algorithm)
  const schedule = [];
  const examDate = new Date(exam.startDate);
  let currentTime = new Date(examDate);
  currentTime.setHours(9, 0, 0, 0); // Start at 9 AM
  
  subjects.forEach((subject, index) => {
    const endTime = new Date(currentTime);
    endTime.setHours(currentTime.getHours() + 2); // 2-hour exams
    
    schedule.push({
      subjectId: subject.id,
      subjectName: subject.name,
      date: new Date(examDate),
      startTime: new Date(currentTime),
      endTime: new Date(endTime),
      roomNumber: rooms[index % rooms.length]
    });
    
    // Move to next time slot (30-minute break)
    currentTime.setHours(currentTime.getHours() + 2, currentTime.getMinutes() + 30);
  });
  
  return schedule;
};

export default {
  ExamTimetableCreateSchema,
  ExamTimetableUpdateSchema,
  ExamTimetableSearchSchema,
  ExamTimetableBulkCreateSchema,
  ExamTimetableBulkUpdateSchema,
  ExamTimetableBulkDeleteSchema,
  ExamTimetableConflictCheckSchema,
  checkTimeConflict,
  checkRoomConflict,
  checkSubjectConflict,
  validateExamTimetableData,
  buildExamTimetableSearchQuery,
  buildExamTimetableIncludeQuery,
  formatExamTimetableResponse,
  calculateDuration,
  isUpcoming,
  isToday,
  isPast,
  validateExamTimetablePermissions,
  generateExamTimetableReport,
  generateOptimalSchedule
}; 
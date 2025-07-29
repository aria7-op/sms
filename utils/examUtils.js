import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const ExamCreateSchema = z.object({
  name: z.string().min(3, 'Exam name must be at least 3 characters'),
  code: z.string().min(3, 'Exam code must be at least 3 characters').optional(),
  type: z.enum(['QUIZ', 'MIDTERM', 'FINAL', 'ASSIGNMENT', 'PROJECT']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  totalMarks: z.number().positive('Total marks must be positive'),
  passingMarks: z.number().positive('Passing marks must be positive').optional(),
  description: z.string().max(1000).optional(),
  termId: z.number().int().positive('Term ID is required'),
  classId: z.number().int().positive('Class ID is required'),
  subjectId: z.number().int().positive('Subject ID is required'),
  schoolId: z.number().int().positive('School ID is required'),
  metadata: z.record(z.any()).optional()
});

export const ExamUpdateSchema = z.object({
  name: z.string().min(3).optional(),
  code: z.string().min(3).optional(),
  type: z.enum(['QUIZ', 'MIDTERM', 'FINAL', 'ASSIGNMENT', 'PROJECT']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  totalMarks: z.number().positive().optional(),
  passingMarks: z.number().positive().optional(),
  description: z.string().max(1000).optional(),
  termId: z.number().int().positive().optional(),
  classId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional()
});

export const ExamSearchSchema = z.object({
  search: z.string().optional(),
  type: z.enum(['QUIZ', 'MIDTERM', 'FINAL', 'ASSIGNMENT', 'PROJECT']).optional(),
  termId: z.number().int().positive().optional(),
  classId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  schoolId: z.number().int().positive().optional(),
  startDateFrom: z.string().datetime().optional(),
  startDateTo: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'startDate', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  include: z.string().optional()
});

export const ExamBulkCreateSchema = z.object({
  exams: z.array(ExamCreateSchema).min(1).max(100),
  skipDuplicates: z.boolean().default(false)
});

export const ExamBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int().positive(),
    data: ExamUpdateSchema
  })).min(1).max(100)
});

export const ExamBulkDeleteSchema = z.object({
  examIds: z.array(z.number().int().positive()).min(1).max(100)
});

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Sanitize exam input data
 * @param {string} str - Input string to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
  if (!str) return str;
  return str.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Validate exam data before creation/update
 * @param {object} data - Exam data to validate
 * @param {number} schoolId - School ID
 * @param {number} [examId] - Optional exam ID for update validation
 * @returns {string[]} Array of validation errors
 */
export async function validateExamData(data, schoolId, examId = null) {
  const errors = [];

  if (!data.name || data.name.trim().length < 3) {
    errors.push('Exam name must be at least 3 characters');
  }

  if (data.startDate && data.endDate && new Date(data.startDate) >= new Date(data.endDate)) {
    errors.push('End date must be after start date');
  }

  if (data.totalMarks <= 0) {
    errors.push('Total marks must be greater than 0');
  }

  if (data.passingMarks && data.passingMarks > data.totalMarks) {
    errors.push('Passing marks cannot exceed total marks');
  }

  // Check for duplicate exam code
  if (data.code) {
    const existingExam = await prisma.exam.findFirst({
      where: {
        code: data.code,
        schoolId,
        NOT: { id: examId || undefined }
      }
    });
    if (existingExam) {
      errors.push('Exam code already exists');
    }
  }

  return errors;
}

/**
 * Generate a unique exam code
 * @param {string} name - Exam name
 * @param {number} schoolId - School ID
 * @returns {string} Generated exam code
 */
export function generateExamCode(name, schoolId) {
  const prefix = name.substring(0, 3).toUpperCase();
  const suffix = schoolId.toString().slice(-3).padStart(3, '0');
  return `${prefix}-${suffix}`;
}

// ======================
// BUILD QUERY FUNCTIONS
// ======================

/**
 * Build search query for exams
 * @param {object} filters - Filter criteria
 * @param {number} schoolId - School ID
 * @returns {object} Prisma where clause
 */
export function buildExamSearchQuery(filters, schoolId) {
  const where = {
    schoolId,
    deletedAt: null
  };

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  if (filters.type) {
    where.type = filters.type;
  }

  if (filters.termId) {
    where.termId = filters.termId;
  }

  if (filters.classId) {
    where.classId = filters.classId;
  }

  if (filters.subjectId) {
    where.subjectId = filters.subjectId;
  }

  if (filters.startDateFrom || filters.startDateTo) {
    where.startDate = {};
    if (filters.startDateFrom) where.startDate.gte = new Date(filters.startDateFrom);
    if (filters.startDateTo) where.startDate.lte = new Date(filters.startDateTo);
  }

  return where;
}

/**
 * Build include query for exams
 * @param {string|null} include - Comma-separated relations to include
 * @returns {object} Prisma include object
 */
export function buildExamIncludeQuery(include = null) {
  const includeObj = {
    term: true,
    class: true,
    subject: true,
    school: true
  };

  if (!include) return includeObj;

  if (include.includes('grades')) {
    includeObj.grades = {
      include: {
        student: {
          include: {
            user: true
          }
        }
      }
    };
  }

  if (include.includes('timetable')) {
    includeObj.timetable = true;
  }

  return includeObj;
}

// ======================
// FORMAT RESPONSE FUNCTIONS
// ======================

/**
 * Format exam response for API
 * @param {object} exam - Exam object from Prisma
 * @param {boolean} [detailed=false] - Include detailed relationships
 * @returns {object} Formatted exam response
 */
export function formatExamResponse(exam, detailed = false) {
  const baseResponse = {
    id: exam.id,
    uuid: exam.uuid,
    name: exam.name,
    code: exam.code,
    type: exam.type,
    startDate: exam.startDate,
    endDate: exam.endDate,
    totalMarks: exam.totalMarks,
    passingMarks: exam.passingMarks,
    description: exam.description,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt
  };

  if (detailed) {
    return {
      ...baseResponse,
      term: exam.term,
      class: exam.class,
      subject: exam.subject,
      school: exam.school,
      grades: exam.grades || [],
      timetable: exam.timetable || []
    };
  }

  return baseResponse;
}

// ======================
// CALCULATION FUNCTIONS
// ======================

/**
 * Calculate exam statistics
 * @param {object} exam - Exam object with grades
 * @returns {object} Exam statistics
 */
export function calculateExamStatistics(exam) {
  const grades = exam.grades || [];
  const totalStudents = grades.length;

  if (totalStudents === 0) {
    return {
      totalStudents: 0,
      averageScore: 0,
      passRate: 0,
      highestScore: 0,
      lowestScore: 0,
      gradeDistribution: {}
    };
  }

  const sum = grades.reduce((total, grade) => total + grade.marks, 0);
  const averageScore = sum / totalStudents;
  const passedStudents = grades.filter(grade => grade.marks >= exam.passingMarks).length;
  const passRate = (passedStudents / totalStudents) * 100;
  const highestScore = Math.max(...grades.map(grade => grade.marks));
  const lowestScore = Math.min(...grades.map(grade => grade.marks));

  const gradeDistribution = {
    'A+': grades.filter(grade => grade.marks >= 90).length,
    'A': grades.filter(grade => grade.marks >= 80 && grade.marks < 90).length,
    'B+': grades.filter(grade => grade.marks >= 75 && grade.marks < 80).length,
    'B': grades.filter(grade => grade.marks >= 70 && grade.marks < 75).length,
    'C+': grades.filter(grade => grade.marks >= 65 && grade.marks < 70).length,
    'C': grades.filter(grade => grade.marks >= 60 && grade.marks < 65).length,
    'D': grades.filter(grade => grade.marks >= 50 && grade.marks < 60).length,
    'F': grades.filter(grade => grade.marks < 50).length
  };

  return {
    totalStudents,
    averageScore: parseFloat(averageScore.toFixed(2)),
    passRate: parseFloat(passRate.toFixed(2)),
    highestScore,
    lowestScore,
    gradeDistribution
  };
}

/**
 * Calculate score distribution for visualization
 * @param {array} grades - Array of grade objects
 * @returns {object} Score distribution by ranges
 */
export function calculateScoreDistribution(grades) {
  const distribution = {
    '90-100': 0,
    '80-89': 0,
    '70-79': 0,
    '60-69': 0,
    '50-59': 0,
    '0-49': 0
  };

  grades.forEach(grade => {
    const score = grade.marks;
    if (score >= 90) distribution['90-100']++;
    else if (score >= 80) distribution['80-89']++;
    else if (score >= 70) distribution['70-79']++;
    else if (score >= 60) distribution['60-69']++;
    else if (score >= 50) distribution['50-59']++;
    else distribution['0-49']++;
  });

  return distribution;
}

/**
 * Calculate performance by class
 * @param {array} grades - Array of grade objects with student and class info
 * @returns {object} Average scores by class
 */
export function calculateClassPerformance(grades) {
  const classPerformance = {};

  grades.forEach(grade => {
    const className = grade.student?.class?.name || 'Unknown';
    if (!classPerformance[className]) {
      classPerformance[className] = {
        total: 0,
        count: 0,
        students: new Set()
      };
    }
    classPerformance[className].total += grade.marks;
    classPerformance[className].count++;
    classPerformance[className].students.add(grade.studentId);
  });

  return Object.entries(classPerformance).reduce((acc, [className, data]) => {
    acc[className] = {
      averageScore: parseFloat((data.total / data.count).toFixed(2)),
      totalStudents: data.students.size
    };
    return acc;
  }, {});
}

/**
 * Calculate performance by section
 * @param {array} grades - Array of grade objects with student and section info
 * @returns {object} Average scores by section
 */
export function calculateSectionPerformance(grades) {
  const sectionPerformance = {};

  grades.forEach(grade => {
    const sectionName = grade.student?.section?.name || 'Unknown';
    if (!sectionPerformance[sectionName]) {
      sectionPerformance[sectionName] = {
        total: 0,
        count: 0,
        students: new Set()
      };
    }
    sectionPerformance[sectionName].total += grade.marks;
    sectionPerformance[sectionName].count++;
    sectionPerformance[sectionName].students.add(grade.studentId);
  });

  return Object.entries(sectionPerformance).reduce((acc, [sectionName, data]) => {
    acc[sectionName] = {
      averageScore: parseFloat((data.total / data.count).toFixed(2)),
      totalStudents: data.students.size
    };
    return acc;
  }, {});
}

// ======================
// PERMISSION FUNCTIONS
// ======================

/**
 * Validate user permissions for exam operations
 * @param {number} examId - Exam ID
 * @param {number} userId - User ID
 * @param {number} schoolId - School ID
 * @returns {Promise<boolean>} True if user has permission
 */
export async function validateExamPermissions(examId, userId, schoolId) {
  try {
    // Check if user is admin or exam creator
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (user.role === 'ADMIN') return true;

    const exam = await prisma.exam.findFirst({
      where: { id: examId, schoolId },
      select: { createdBy: true }
    });

    return exam?.createdBy === userId;
  } catch (error) {
    logger.error('Validate exam permissions error:', error);
    return false;
  }
}

// ======================
// REPORT GENERATION FUNCTIONS
// ======================

/**
 * Generate exam report
 * @param {number} schoolId - School ID
 * @param {object} filters - Report filters
 * @returns {Promise<object>} Generated report
 */
export async function generateExamReport(schoolId, filters = {}) {
  try {
    const where = buildExamSearchQuery(filters, schoolId);
    const exams = await prisma.exam.findMany({
      where,
      include: {
        grades: {
          include: {
            student: {
              include: {
                user: true,
                class: true,
                section: true
              }
            }
          }
        },
        term: true,
        class: true,
        subject: true
      },
      orderBy: { startDate: 'desc' }
    });

    const report = {
      generatedAt: new Date(),
      totalExams: exams.length,
      exams: exams.map(exam => {
        const stats = calculateExamStatistics(exam);
        return {
          id: exam.id,
          name: exam.name,
          code: exam.code,
          type: exam.type,
          startDate: exam.startDate,
          endDate: exam.endDate,
          term: exam.term?.name,
          class: exam.class?.name,
          subject: exam.subject?.name,
          totalStudents: stats.totalStudents,
          averageScore: stats.averageScore,
          passRate: stats.passRate
        };
      }),
      summary: {
        totalStudents: exams.reduce((sum, exam) => sum + (exam.grades?.length || 0), 0),
        averagePassRate: exams.length > 0 
          ? exams.reduce((sum, exam) => {
              const stats = calculateExamStatistics(exam);
              return sum + stats.passRate;
            }, 0) / exams.length
          : 0
      }
    };

    return report;
  } catch (error) {
    logger.error('Generate exam report error:', error);
    throw error;
  }
}

export default {
  // Schemas
  ExamCreateSchema,
  ExamUpdateSchema,
  ExamSearchSchema,
  ExamBulkCreateSchema,
  ExamBulkUpdateSchema,
  ExamBulkDeleteSchema,

  // Utility functions
  sanitizeString,
  validateExamData,
  generateExamCode,

  // Query builders
  buildExamSearchQuery,
  buildExamIncludeQuery,

  // Format functions
  formatExamResponse,

  // Calculation functions
  calculateExamStatistics,
  calculateScoreDistribution,
  calculateClassPerformance,
  calculateSectionPerformance,

  // Permission functions
  validateExamPermissions,

  // Report functions
  generateExamReport
};
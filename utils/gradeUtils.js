import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const GradeCreateSchema = z.object({
  examId: z.number().int().positive('Exam ID is required'),
  studentId: z.number().int().positive('Student ID is required'),
  subjectId: z.number().int().positive('Subject ID is required'),
  marks: z.number()
    .min(0, 'Marks cannot be negative')
    .max(100, 'Marks cannot exceed 100')
    .refine(val => val % 0.01 === 0, 'Marks must have maximum 2 decimal places'),
  grade: z.string()
    .max(5, 'Grade must be less than 5 characters')
    .regex(/^[A-F][+-]?$/, 'Grade must be A, B, C, D, E, F with optional + or -')
    .optional(),
  remarks: z.string()
    .max(255, 'Remarks must be less than 255 characters')
    .optional(),
  isAbsent: z.boolean().default(false),
  schoolId: z.number().int().positive('School ID is required'),
  metadata: z.record(z.any()).optional()
});

export const GradeUpdateSchema = z.object({
  marks: z.number()
    .min(0, 'Marks cannot be negative')
    .max(100, 'Marks cannot exceed 100')
    .refine(val => val % 0.01 === 0, 'Marks must have maximum 2 decimal places')
    .optional(),
  grade: z.string()
    .max(5, 'Grade must be less than 5 characters')
    .regex(/^[A-F][+-]?$/, 'Grade must be A, B, C, D, E, F with optional + or -')
    .optional(),
  remarks: z.string()
    .max(255, 'Remarks must be less than 255 characters')
    .optional(),
  isAbsent: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

export const GradeSearchSchema = z.object({
  // Search filters
  search: z.string().optional(),
  examId: z.number().int().positive().optional(),
  studentId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  schoolId: z.number().int().positive().optional(),
  
  // Grade filters
  minMarks: z.number().min(0).max(100).optional(),
  maxMarks: z.number().min(0).max(100).optional(),
  grade: z.string().optional(),
  isAbsent: z.boolean().optional(),
  
  // Date filters
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  
  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'marks', 'grade', 'examId', 'studentId', 'subjectId']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Include relations
  include: z.string().optional()
});

export const GradeBulkCreateSchema = z.object({
  grades: z.array(GradeCreateSchema).min(1).max(1000),
  skipDuplicates: z.boolean().default(false)
});

export const GradeBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int().positive(),
    data: GradeUpdateSchema
  })).min(1).max(1000)
});

export const GradeBulkDeleteSchema = z.object({
  gradeIds: z.array(z.number().int().positive()).min(1).max(1000)
});

export const GradeCalculationSchema = z.object({
  examId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  studentId: z.number().int().positive(),
  marks: z.number().min(0).max(100),
  totalMarks: z.number().positive(),
  passingMarks: z.number().positive()
});

// ======================
// GRADE CALCULATION FUNCTIONS
// ======================

export const calculateGrade = (marks, totalMarks = 100, passingMarks = 40) => {
  if (marks === null || marks === undefined) return null;
  
  const percentage = (marks / totalMarks) * 100;
  
  if (percentage >= 90) return 'A+';
  if (percentage >= 85) return 'A';
  if (percentage >= 80) return 'A-';
  if (percentage >= 75) return 'B+';
  if (percentage >= 70) return 'B';
  if (percentage >= 65) return 'B-';
  if (percentage >= 60) return 'C+';
  if (percentage >= 55) return 'C';
  if (percentage >= 50) return 'C-';
  if (percentage >= 45) return 'D+';
  if (percentage >= 40) return 'D';
  if (percentage >= 35) return 'D-';
  if (percentage >= 30) return 'E+';
  if (percentage >= 25) return 'E';
  if (percentage >= 20) return 'E-';
  return 'F';
};

export const calculateGPA = (grades) => {
  if (!grades || grades.length === 0) return 0;
  
  const gradePoints = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'E+': 0.3, 'E': 0.0, 'E-': 0.0,
    'F': 0.0
  };
  
  const totalPoints = grades.reduce((sum, grade) => {
    return sum + (gradePoints[grade.grade] || 0);
  }, 0);
  
  return Math.round((totalPoints / grades.length) * 100) / 100;
};

export const calculateCGPA = (allGrades) => {
  if (!allGrades || allGrades.length === 0) return 0;
  
  const gradePoints = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'E+': 0.3, 'E': 0.0, 'E-': 0.0,
    'F': 0.0
  };
  
  const totalPoints = allGrades.reduce((sum, grade) => {
    return sum + (gradePoints[grade.grade] || 0);
  }, 0);
  
  return Math.round((totalPoints / allGrades.length) * 100) / 100;
};

export const calculatePercentage = (marks, totalMarks = 100) => {
  if (marks === null || marks === undefined || totalMarks === 0) return 0;
  return Math.round((marks / totalMarks) * 100 * 100) / 100;
};

export const isPassingGrade = (grade, passingGrade = 'D') => {
  const gradeOrder = ['F', 'E-', 'E', 'E+', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
  const gradeIndex = gradeOrder.indexOf(grade);
  const passingIndex = gradeOrder.indexOf(passingGrade);
  return gradeIndex >= passingIndex;
};

// ======================
// HELPER FUNCTIONS
// ======================

export const validateGradeData = async (data, schoolId, excludeId = null) => {
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
  
  // Check if student exists and belongs to the school
  const studentExists = await prisma.student.findFirst({
    where: {
      id: data.studentId,
      schoolId,
      deletedAt: null
    }
  });
  
  if (!studentExists) {
    errors.push('Student does not exist or does not belong to this school');
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
  
  // Check for duplicate grade entry
  const existingGrade = await prisma.grade.findFirst({
    where: {
      examId: data.examId,
      studentId: data.studentId,
      subjectId: data.subjectId,
      schoolId,
      id: { not: excludeId },
      deletedAt: null
    }
  });
  
  if (existingGrade) {
    errors.push('Grade already exists for this exam, student, and subject combination');
  }
  
  // Validate marks against exam total marks
  if (examExists && data.marks > examExists.totalMarks) {
    errors.push(`Marks cannot exceed exam total marks (${examExists.totalMarks})`);
  }
  
  return errors;
};

export const buildGradeSearchQuery = (filters, schoolId) => {
  const where = {
    schoolId,
    deletedAt: null
  };
  
  // Basic filters
  if (filters.examId) {
    where.examId = filters.examId;
  }
  
  if (filters.studentId) {
    where.studentId = filters.studentId;
  }
  
  if (filters.subjectId) {
    where.subjectId = filters.subjectId;
  }
  
  if (filters.grade) {
    where.grade = filters.grade;
  }
  
  if (filters.isAbsent !== undefined) {
    where.isAbsent = filters.isAbsent;
  }
  
  // Marks filters
  if (filters.minMarks || filters.maxMarks) {
    where.marks = {};
    if (filters.minMarks) where.marks.gte = filters.minMarks;
    if (filters.maxMarks) where.marks.lte = filters.maxMarks;
  }
  
  // Date filters
  if (filters.createdAfter) where.createdAt = { gte: new Date(filters.createdAfter) };
  if (filters.createdBefore) where.createdAt = { ...where.createdAt, lte: new Date(filters.createdBefore) };
  if (filters.updatedAfter) where.updatedAt = { gte: new Date(filters.updatedAfter) };
  if (filters.updatedBefore) where.updatedAt = { ...where.updatedAt, lte: new Date(filters.updatedBefore) };
  
  // Search across multiple fields
  if (filters.search) {
    where.OR = [
      { grade: { contains: filters.search, mode: 'insensitive' } },
      { remarks: { contains: filters.search, mode: 'insensitive' } }
    ];
  }
  
  return where;
};

export const buildGradeIncludeQuery = (include = []) => {
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
    
    if (include.includes('student')) {
      includeQuery.student = {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          class: true,
          section: true
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
    
    if (includes.includes('student')) {
      includeQuery.student = true;
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

export const formatGradeResponse = (grade, includeStats = false) => {
  const formatted = {
    id: grade.id,
    uuid: grade.uuid,
    examId: grade.examId,
    studentId: grade.studentId,
    subjectId: grade.subjectId,
    marks: grade.marks,
    grade: grade.grade,
    remarks: grade.remarks,
    isAbsent: grade.isAbsent,
    schoolId: grade.schoolId,
    createdAt: grade.createdAt,
    updatedAt: grade.updatedAt,
    metadata: grade.metadata
  };
  
  // Include relations if they exist
  if (grade.exam) {
    formatted.exam = {
      id: grade.exam.id,
      name: grade.exam.name,
      code: grade.exam.code,
      type: grade.exam.type,
      totalMarks: grade.exam.totalMarks,
      passingMarks: grade.exam.passingMarks,
      term: grade.exam.term ? {
        id: grade.exam.term.id,
        name: grade.exam.term.name
      } : null,
      class: grade.exam.class ? {
        id: grade.exam.class.id,
        name: grade.exam.class.name
      } : null,
      subject: grade.exam.subject ? {
        id: grade.exam.subject.id,
        name: grade.exam.subject.name
      } : null,
      school: grade.exam.school ? {
        id: grade.exam.school.id,
        name: grade.exam.school.name,
        code: grade.exam.school.code
      } : null
    };
  }
  
  if (grade.student) {
    formatted.student = {
      id: grade.student.id,
      uuid: grade.student.uuid,
      user: grade.student.user ? {
        id: grade.student.user.id,
        firstName: grade.student.user.firstName,
        lastName: grade.student.user.lastName,
        email: grade.student.user.email
      } : null,
      class: grade.student.class ? {
        id: grade.student.class.id,
        name: grade.student.class.name
      } : null,
      section: grade.student.section ? {
        id: grade.student.section.id,
        name: grade.student.section.name
      } : null
    };
  }
  
  if (grade.subject) {
    formatted.subject = {
      id: grade.subject.id,
      name: grade.subject.name,
      code: grade.subject.code,
      department: grade.subject.department ? {
        id: grade.subject.department.id,
        name: grade.subject.department.name
      } : null
    };
  }
  
  if (grade.school) {
    formatted.school = {
      id: grade.school.id,
      name: grade.school.name,
      code: grade.school.code
    };
  }
  
  if (grade.createdByUser) {
    formatted.createdByUser = {
      id: grade.createdByUser.id,
      firstName: grade.createdByUser.firstName,
      lastName: grade.createdByUser.lastName,
      email: grade.createdByUser.email
    };
  }
  
  if (grade.updatedByUser) {
    formatted.updatedByUser = {
      id: grade.updatedByUser.id,
      firstName: grade.updatedByUser.firstName,
      lastName: grade.updatedByUser.lastName,
      email: grade.updatedByUser.email
    };
  }
  
  // Include statistics if requested
  if (includeStats && grade.exam) {
    formatted.stats = {
      percentage: calculatePercentage(grade.marks, grade.exam.totalMarks),
      isPassing: isPassingGrade(grade.grade),
      gradePoints: calculateGradePoints(grade.grade)
    };
  }
  
  return formatted;
};

export const calculateGradePoints = (grade) => {
  const gradePoints = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'E+': 0.3, 'E': 0.0, 'E-': 0.0,
    'F': 0.0
  };
  
  return gradePoints[grade] || 0;
};

export const validateGradePermissions = async (gradeId, userId, schoolId) => {
  const grade = await prisma.grade.findFirst({
    where: {
      id: gradeId,
      schoolId
    }
  });
  
  if (!grade) {
    throw new Error('Grade not found or access denied');
  }
  
  return grade;
};

export const generateGradeReport = async (schoolId, filters = {}) => {
  const where = buildGradeSearchQuery(filters, schoolId);
  
  const grades = await prisma.grade.findMany({
    where,
    include: {
      exam: {
        include: {
          term: true,
          class: true,
          subject: true
        }
      },
      student: {
        include: {
          user: true,
          class: true,
          section: true
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
    totalGrades: grades.length,
    totalStudents: new Set(grades.map(g => g.studentId)).size,
    totalSubjects: new Set(grades.map(g => g.subjectId)).size,
    totalExams: new Set(grades.map(g => g.examId)).size,
    averageMarks: 0,
    averagePercentage: 0,
    gradeDistribution: {
      'A+': 0, 'A': 0, 'A-': 0,
      'B+': 0, 'B': 0, 'B-': 0,
      'C+': 0, 'C': 0, 'C-': 0,
      'D+': 0, 'D': 0, 'D-': 0,
      'E+': 0, 'E': 0, 'E-': 0,
      'F': 0
    },
    performanceBySubject: {},
    performanceByClass: {},
    performanceByExam: {},
    absentCount: 0,
    passingCount: 0,
    failingCount: 0
  };
  
  let totalMarks = 0;
  let totalPercentage = 0;
  
  grades.forEach(grade => {
    // Calculate averages
    totalMarks += parseFloat(grade.marks);
    const percentage = calculatePercentage(grade.marks, grade.exam?.totalMarks || 100);
    totalPercentage += percentage;
    
    // Grade distribution
    if (grade.grade && report.gradeDistribution[grade.grade] !== undefined) {
      report.gradeDistribution[grade.grade]++;
    }
    
    // Absent count
    if (grade.isAbsent) {
      report.absentCount++;
    }
    
    // Pass/Fail count
    if (grade.grade) {
      if (isPassingGrade(grade.grade)) {
        report.passingCount++;
      } else {
        report.failingCount++;
      }
    }
    
    // Performance by subject
    if (grade.subject) {
      const subjectName = grade.subject.name;
      if (!report.performanceBySubject[subjectName]) {
        report.performanceBySubject[subjectName] = {
          totalGrades: 0,
          totalMarks: 0,
          averageMarks: 0,
          averagePercentage: 0
        };
      }
      report.performanceBySubject[subjectName].totalGrades++;
      report.performanceBySubject[subjectName].totalMarks += parseFloat(grade.marks);
    }
    
    // Performance by class
    if (grade.student?.class) {
      const className = grade.student.class.name;
      if (!report.performanceByClass[className]) {
        report.performanceByClass[className] = {
          totalGrades: 0,
          totalMarks: 0,
          averageMarks: 0,
          averagePercentage: 0
        };
      }
      report.performanceByClass[className].totalGrades++;
      report.performanceByClass[className].totalMarks += parseFloat(grade.marks);
    }
    
    // Performance by exam
    if (grade.exam) {
      const examName = grade.exam.name;
      if (!report.performanceByExam[examName]) {
        report.performanceByExam[examName] = {
          totalGrades: 0,
          totalMarks: 0,
          averageMarks: 0,
          averagePercentage: 0
        };
      }
      report.performanceByExam[examName].totalGrades++;
      report.performanceByExam[examName].totalMarks += parseFloat(grade.marks);
    }
  });
  
  // Calculate averages
  if (grades.length > 0) {
    report.averageMarks = Math.round((totalMarks / grades.length) * 100) / 100;
    report.averagePercentage = Math.round((totalPercentage / grades.length) * 100) / 100;
  }
  
  // Calculate subject averages
  Object.keys(report.performanceBySubject).forEach(subject => {
    const subjectData = report.performanceBySubject[subject];
    subjectData.averageMarks = Math.round((subjectData.totalMarks / subjectData.totalGrades) * 100) / 100;
    subjectData.averagePercentage = Math.round((subjectData.averageMarks / 100) * 100 * 100) / 100;
  });
  
  // Calculate class averages
  Object.keys(report.performanceByClass).forEach(className => {
    const classData = report.performanceByClass[className];
    classData.averageMarks = Math.round((classData.totalMarks / classData.totalGrades) * 100) / 100;
    classData.averagePercentage = Math.round((classData.averageMarks / 100) * 100 * 100) / 100;
  });
  
  // Calculate exam averages
  Object.keys(report.performanceByExam).forEach(examName => {
    const examData = report.performanceByExam[examName];
    examData.averageMarks = Math.round((examData.totalMarks / examData.totalGrades) * 100) / 100;
    examData.averagePercentage = Math.round((examData.averageMarks / 100) * 100 * 100) / 100;
  });
  
  return report;
};

export default {
  GradeCreateSchema,
  GradeUpdateSchema,
  GradeSearchSchema,
  GradeBulkCreateSchema,
  GradeBulkUpdateSchema,
  GradeBulkDeleteSchema,
  GradeCalculationSchema,
  calculateGrade,
  calculateGPA,
  calculateCGPA,
  calculatePercentage,
  isPassingGrade,
  validateGradeData,
  buildGradeSearchQuery,
  buildGradeIncludeQuery,
  formatGradeResponse,
  calculateGradePoints,
  validateGradePermissions,
  generateGradeReport
}; 
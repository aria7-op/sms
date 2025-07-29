import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';
import { cacheManager } from '../cache/cacheManager.js';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const SubjectCreateSchema = z.object({
  name: z.string().min(1, 'Subject name is required').max(100, 'Subject name must be less than 100 characters'),
  code: z.string().min(1, 'Subject code is required').max(20, 'Subject code must be less than 20 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  creditHours: z.number().int().min(1, 'Credit hours must be at least 1').max(10, 'Credit hours must be less than 10'),
  isElective: z.boolean().default(false),
  departmentId: z.number().int().positive().optional(),
  schoolId: z.number().int().positive('School ID is required')
});

export const SubjectUpdateSchema = z.object({
  name: z.string().min(1, 'Subject name is required').max(100, 'Subject name must be less than 100 characters').optional(),
  code: z.string().min(1, 'Subject code is required').max(20, 'Subject code must be less than 20 characters').optional(),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  creditHours: z.number().int().min(1, 'Credit hours must be at least 1').max(10, 'Credit hours must be less than 10').optional(),
  isElective: z.boolean().optional(),
  departmentId: z.number().int().positive().optional()
});

export const SubjectSearchSchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.enum(['id', 'name', 'code', 'creditHours', 'createdAt', 'updatedAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  
  // Filters
  search: z.string().optional(),
  name: z.string().optional(),
  code: z.string().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  schoolId: z.coerce.number().int().positive().optional(),
  isElective: z.coerce.boolean().optional(),
  creditHours: z.coerce.number().int().positive().optional(),
  minCreditHours: z.coerce.number().int().positive().optional(),
  maxCreditHours: z.coerce.number().int().positive().optional(),
  
  // Date filters
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  updatedAfter: z.coerce.date().optional(),
  updatedBefore: z.coerce.date().optional(),
  
  // Include relations
  include: z.string().optional()
});

// ======================
// HELPER FUNCTIONS
// ======================

/**
 * Generate subject code
 */
export const generateSubjectCode = async (name, schoolId, existingCodes = []) => {
  try {
    // Extract initials from name
    const initials = name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .substring(0, 3);

    // Get school code
    const school = await prisma.school.findUnique({
      where: { id: BigInt(schoolId) },
      select: { code: true }
    });

    const schoolCode = school?.code?.substring(0, 2).toUpperCase() || 'SC';

    // Generate base code
    let baseCode = `${schoolCode}${initials}`;
    let counter = 1;
    let finalCode = baseCode;

    // Check if code exists and generate unique one
    while (existingCodes.includes(finalCode)) {
      finalCode = `${baseCode}${counter.toString().padStart(2, '0')}`;
      counter++;
    }

    return finalCode;
  } catch (error) {
    console.error('Error generating subject code:', error);
    throw new Error('Failed to generate subject code');
  }
};

/**
 * Validate subject constraints
 */
export const validateSubjectConstraints = async (schoolId, code, departmentId = null) => {
  try {
    const errors = [];

    // Check if code is unique within school
    const existingSubject = await prisma.subject.findFirst({
      where: {
        schoolId: BigInt(schoolId),
        code: code,
        deletedAt: null
      }
    });

    if (existingSubject) {
      errors.push('Subject code must be unique within the school');
    }

    // Check if department exists and belongs to school
    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: {
          id: BigInt(departmentId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!department) {
        errors.push('Department does not exist or does not belong to the school');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (error) {
    console.error('Error validating subject constraints:', error);
    return {
      isValid: false,
      errors: ['Failed to validate subject constraints']
    };
  }
};

/**
 * Build subject search query
 */
export const buildSubjectSearchQuery = (filters, schoolId) => {
  const where = {
    schoolId: BigInt(schoolId),
    deletedAt: null
  };

  // School filter (if explicitly provided, it should match the user's school)
  if (filters.schoolId) {
    // Ensure the requested schoolId matches the user's schoolId for security
    if (BigInt(filters.schoolId) !== BigInt(schoolId)) {
      throw new Error('Access denied: Cannot access subjects from other schools');
    }
  }

  // Department filter
  if (filters.departmentId) {
    where.departmentId = BigInt(filters.departmentId);
  }

  // Elective filter
  if (filters.isElective !== undefined) {
    where.isElective = filters.isElective;
  }

  // Credit hours filters
  if (filters.creditHours) {
    where.creditHours = filters.creditHours;
  } else if (filters.minCreditHours || filters.maxCreditHours) {
    where.creditHours = {};
    if (filters.minCreditHours) {
      where.creditHours.gte = filters.minCreditHours;
    }
    if (filters.maxCreditHours) {
      where.creditHours.lte = filters.maxCreditHours;
    }
  }

  // Date filters
  if (filters.createdAfter || filters.createdBefore) {
    where.createdAt = {};
    if (filters.createdAfter) {
      where.createdAt.gte = filters.createdAfter;
    }
    if (filters.createdBefore) {
      where.createdAt.lte = filters.createdBefore;
    }
  }

  if (filters.updatedAfter || filters.updatedBefore) {
    where.updatedAt = {};
    if (filters.updatedAfter) {
      where.updatedAt.gte = filters.updatedAfter;
    }
    if (filters.updatedBefore) {
      where.updatedAt.lte = filters.updatedBefore;
    }
  }

  // Search filter
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  // Specific filters
  if (filters.name) {
    where.name = { contains: filters.name, mode: 'insensitive' };
  }

  if (filters.code) {
    where.code = { contains: filters.code, mode: 'insensitive' };
  }

  return where;
};

/**
 * Build subject include query
 */
export const buildSubjectIncludeQuery = (include) => {
  const includeQuery = {};

  if (!include) return includeQuery;

  const includes = include.split(',').map(item => item.trim());

  if (includes.includes('school')) {
    includeQuery.school = true;
  }

  if (includes.includes('department')) {
    includeQuery.department = true;
  }

  if (includes.includes('classes')) {
    includeQuery.classes = {
      where: { deletedAt: null },
      include: {
        school: true
      }
    };
  }

  if (includes.includes('teachers')) {
    includeQuery.teachers = {
      where: { deletedAt: null },
      include: {
        user: true,
        department: true
      }
    };
  }

  if (includes.includes('timetables')) {
    includeQuery.timetables = {
      where: { deletedAt: null },
      include: {
        class: true
      }
    };
  }

  if (includes.includes('exams')) {
    includeQuery.exams = {
      where: { deletedAt: null },
      include: {
        term: true,
        class: true
      }
    };
  }

  if (includes.includes('assignments')) {
    includeQuery.assignments = {
      where: { deletedAt: null },
      include: {
        class: true,
        teacher: {
          include: { user: true }
        }
      }
    };
  }

  if (includes.includes('books')) {
    includeQuery.books = {
      where: { deletedAt: null }
    };
  }

  if (includes.includes('grades')) {
    includeQuery.grades = {
      where: { deletedAt: null },
      include: {
        exam: true,
        student: {
          include: { user: true }
        }
      }
    };
  }

  if (includes.includes('examTimetables')) {
    includeQuery.examTimetables = {
      where: { deletedAt: null },
      include: {
        exam: true
      }
    };
  }

  if (includes.includes('attendances')) {
    includeQuery.attendances = {
      where: { deletedAt: null },
      include: {
        class: true,
        student: {
          include: { user: true }
        }
      }
    };
  }

  return includeQuery;
};

// ======================
// STATISTICS & ANALYTICS
// ======================

/**
 * Generate subject statistics
 */
export const generateSubjectStats = async (subjectId) => {
  try {
    const cacheKey = `subject:stats:${subjectId}`;
    const cachedStats = await cacheManager.get(cacheKey);
    
    if (cachedStats) {
      return cachedStats;
    }

    const subject = await prisma.subject.findUnique({
      where: { id: BigInt(subjectId) },
      include: {
        department: true,
        school: true,
        classes: {
          where: { deletedAt: null }
        },
        teachers: {
          where: { deletedAt: null },
          include: { user: true }
        },
        timetables: {
          where: { deletedAt: null }
        },
        exams: {
          where: { deletedAt: null }
        },
        assignments: {
          where: { deletedAt: null }
        },
        books: {
          where: { deletedAt: null }
        },
        grades: {
          where: { deletedAt: null }
        }
      }
    });

    if (!subject) {
      throw new Error('Subject not found');
    }

    // Calculate statistics
    const stats = {
      basic: {
        id: subject.id.toString(),
        name: subject.name,
        code: subject.code,
        creditHours: subject.creditHours,
        isElective: subject.isElective,
        department: subject.department?.name || 'No Department',
        school: subject.school.name
      },
      counts: {
        classes: subject.classes.length,
        teachers: subject.teachers.length,
        timetables: subject.timetables.length,
        exams: subject.exams.length,
        assignments: subject.assignments.length,
        books: subject.books.length,
        grades: subject.grades.length
      },
      performance: {
        averageGrade: subject.grades.length > 0 
          ? subject.grades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0) / subject.grades.length
          : 0,
        totalStudents: new Set(subject.grades.map(grade => grade.studentId)).size,
        totalExams: subject.exams.length
      },
      schedule: {
        totalPeriods: subject.timetables.length,
        weeklyHours: subject.timetables.length * (subject.creditHours || 1)
      }
    };

    // Cache the results
    await cacheManager.set(cacheKey, stats, 1800); // 30 minutes

    return stats;
  } catch (error) {
    console.error('Error generating subject stats:', error);
    throw new Error('Failed to generate subject statistics');
  }
};

/**
 * Generate subject analytics
 */
export const generateSubjectAnalytics = async (subjectId, period = '30d') => {
  try {
    const cacheKey = `subject:analytics:${subjectId}:${period}`;
    const cachedAnalytics = await cacheManager.get(cacheKey);
    
    if (cachedAnalytics) {
      return cachedAnalytics;
    }

    const subject = await prisma.subject.findUnique({
      where: { id: BigInt(subjectId) },
      include: {
        grades: {
          where: { deletedAt: null },
          include: {
            exam: true,
            student: {
              include: { user: true }
            }
          }
        },
        timetables: {
          where: { deletedAt: null }
        },
        assignments: {
          where: { deletedAt: null }
        }
      }
    });

    if (!subject) {
      throw new Error('Subject not found');
    }

    // Calculate period-based analytics
    const now = new Date();
    let startDate;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const recentGrades = subject.grades.filter(grade => 
      new Date(grade.createdAt) >= startDate
    );

    const analytics = {
      period,
      startDate,
      endDate: now,
      performance: {
        totalGrades: recentGrades.length,
        averageGrade: recentGrades.length > 0 
          ? recentGrades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0) / recentGrades.length
          : 0,
        highestGrade: recentGrades.length > 0 
          ? Math.max(...recentGrades.map(grade => parseFloat(grade.marks)))
          : 0,
        lowestGrade: recentGrades.length > 0 
          ? Math.min(...recentGrades.map(grade => parseFloat(grade.marks)))
          : 0,
        passRate: recentGrades.length > 0 
          ? (recentGrades.filter(grade => parseFloat(grade.marks) >= 40).length / recentGrades.length) * 100
          : 0
      },
      engagement: {
        totalAssignments: subject.assignments.length,
        totalTimetables: subject.timetables.length,
        weeklyHours: subject.timetables.length * (subject.creditHours || 1)
      },
      trends: {
        gradeDistribution: {
          excellent: recentGrades.filter(grade => parseFloat(grade.marks) >= 80).length,
          good: recentGrades.filter(grade => parseFloat(grade.marks) >= 60 && parseFloat(grade.marks) < 80).length,
          average: recentGrades.filter(grade => parseFloat(grade.marks) >= 40 && parseFloat(grade.marks) < 60).length,
          poor: recentGrades.filter(grade => parseFloat(grade.marks) < 40).length
        }
      }
    };

    // Cache the results
    await cacheManager.set(cacheKey, analytics, 3600); // 1 hour

    return analytics;
  } catch (error) {
    console.error('Error generating subject analytics:', error);
    throw new Error('Failed to generate subject analytics');
  }
};

/**
 * Calculate subject performance
 */
export const calculateSubjectPerformance = async (subjectId) => {
  try {
    const cacheKey = `subject:performance:${subjectId}`;
    const cachedPerformance = await cacheManager.get(cacheKey);
    
    if (cachedPerformance) {
      return cachedPerformance;
    }

    const subject = await prisma.subject.findUnique({
      where: { id: BigInt(subjectId) },
      include: {
        grades: {
          where: { deletedAt: null },
          include: {
            exam: true,
            student: {
              include: { user: true }
            }
          }
        },
        classes: {
          where: { deletedAt: null },
          include: {
            students: {
              where: { deletedAt: null }
            }
          }
        }
      }
    });

    if (!subject) {
      throw new Error('Subject not found');
    }

    const performance = {
      subjectId: subject.id.toString(),
      subjectName: subject.name,
      overallStats: {
        totalStudents: subject.classes.reduce((sum, cls) => sum + cls.students.length, 0),
        totalGrades: subject.grades.length,
        averageGrade: subject.grades.length > 0 
          ? subject.grades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0) / subject.grades.length
          : 0,
        passRate: subject.grades.length > 0 
          ? (subject.grades.filter(grade => parseFloat(grade.marks) >= 40).length / subject.grades.length) * 100
          : 0
      },
      classPerformance: subject.classes.map(cls => ({
        classId: cls.id.toString(),
        className: cls.name,
        studentCount: cls.students.length,
        averageGrade: subject.grades
          .filter(grade => cls.students.some(student => student.id === grade.studentId))
          .reduce((sum, grade) => sum + parseFloat(grade.marks), 0) / 
          Math.max(subject.grades.filter(grade => cls.students.some(student => student.id === grade.studentId)).length, 1)
      })),
      gradeDistribution: {
        excellent: subject.grades.filter(grade => parseFloat(grade.marks) >= 80).length,
        good: subject.grades.filter(grade => parseFloat(grade.marks) >= 60 && parseFloat(grade.marks) < 80).length,
        average: subject.grades.filter(grade => parseFloat(grade.marks) >= 40 && parseFloat(grade.marks) < 60).length,
        poor: subject.grades.filter(grade => parseFloat(grade.marks) < 40).length
      }
    };

    // Cache the results
    await cacheManager.set(cacheKey, performance, 1800); // 30 minutes

    return performance;
  } catch (error) {
    console.error('Error calculating subject performance:', error);
    throw new Error('Failed to calculate subject performance');
  }
};

// ======================
// EXPORT & IMPORT
// ======================

/**
 * Generate subject export data
 */
export const generateSubjectExportData = async (subjects, format = 'json') => {
  try {
    if (format === 'csv') {
      const csvHeaders = [
        'ID', 'Name', 'Code', 'Description', 'Credit Hours', 
        'Is Elective', 'Department', 'School', 'Created At'
      ];

      const csvRows = subjects.map(subject => [
        subject.id,
        subject.name,
        subject.code,
        subject.description || '',
        subject.creditHours,
        subject.isElective ? 'Yes' : 'No',
        subject.department?.name || '',
        subject.school?.name || '',
        subject.createdAt
      ]);

      const csvContent = [
        csvHeaders.join(','),
        ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      return csvContent;
    }

    // JSON format
    return subjects.map(subject => ({
      id: subject.id.toString(),
      name: subject.name,
      code: subject.code,
      description: subject.description,
      creditHours: subject.creditHours,
      isElective: subject.isElective,
      department: subject.department ? {
        id: subject.department.id.toString(),
        name: subject.department.name,
        code: subject.department.code
      } : null,
      school: subject.school ? {
        id: subject.school.id.toString(),
        name: subject.school.name,
        code: subject.school.code
      } : null,
      createdAt: subject.createdAt,
      updatedAt: subject.updatedAt
    }));
  } catch (error) {
    console.error('Error generating subject export data:', error);
    throw new Error('Failed to generate export data');
  }
};

/**
 * Validate subject import data
 */
export const validateSubjectImportData = (subjects) => {
  const errors = [];

  subjects.forEach((subject, index) => {
    try {
      SubjectCreateSchema.parse(subject);
    } catch (error) {
      errors.push({
        index,
        errors: error.errors
      });
    }
  });

  return errors;
};

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Generate subject code suggestions
 */
export const generateSubjectCodeSuggestions = (name, schoolCode) => {
  const suggestions = [];

  // Extract initials
  const initials = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3);

  // Generate variations
  suggestions.push(`${schoolCode}${initials}`);
  suggestions.push(`${schoolCode}${name.substring(0, 3).toUpperCase()}`);
  suggestions.push(`${schoolCode}${name.replace(/\s+/g, '').substring(0, 4).toUpperCase()}`);

  // Add numeric suffixes
  for (let i = 1; i <= 3; i++) {
    suggestions.push(`${schoolCode}${initials}${i.toString().padStart(2, '0')}`);
  }

  return [...new Set(suggestions)]; // Remove duplicates
};

/**
 * Get subject count by department
 */
export const getSubjectCountByDepartment = async (schoolId) => {
  try {
    const where = {
      deletedAt: null
    };

    if (schoolId) {
      where.schoolId = BigInt(schoolId);
    }

    const countByDepartment = await prisma.subject.groupBy({
      by: ['departmentId'],
      where,
      _count: { id: true }
    });

    const departmentIds = countByDepartment.map(item => item.departmentId).filter(Boolean);
    
    const departments = await prisma.department.findMany({
      where: {
        id: { in: departmentIds },
        deletedAt: null
      },
      select: { id: true, name: true, code: true }
    });

    return countByDepartment.map(item => ({
      departmentId: item.departmentId?.toString(),
      departmentName: departments.find(dept => dept.id === item.departmentId)?.name || 'No Department',
      departmentCode: departments.find(dept => dept.id === item.departmentId)?.code || 'N/A',
      count: item._count.id
    }));
  } catch (error) {
    console.error('Error getting subject count by department:', error);
    throw new Error('Failed to get subject count by department');
  }
};

/**
 * Get subject count by credit hours
 */
export const getSubjectCountByCreditHours = async (schoolId) => {
  try {
    const where = {
      deletedAt: null
    };

    if (schoolId) {
      where.schoolId = BigInt(schoolId);
    }

    const countByCreditHours = await prisma.subject.groupBy({
      by: ['creditHours'],
      where,
      _count: { id: true },
      orderBy: { creditHours: 'asc' }
    });

    return countByCreditHours.map(item => ({
      creditHours: item.creditHours,
      count: item._count.id
    }));
  } catch (error) {
    console.error('Error getting subject count by credit hours:', error);
    throw new Error('Failed to get subject count by credit hours');
  }
}; 
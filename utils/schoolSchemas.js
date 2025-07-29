import { z } from 'zod';

// ======================
// SCHOOL VALIDATION SCHEMAS
// ======================

/**
 * School creation schema
 */
export const SchoolCreateSchema = z.object({
  name: z.string()
    .min(2, 'School name must be at least 2 characters')
    .max(100, 'School name must be less than 100 characters')
    .trim(),
  
  code: z.string()
    .min(2, 'School code must be at least 2 characters')
    .max(20, 'School code must be less than 20 characters')
    .regex(/^[A-Z0-9_-]+$/, 'School code must contain only uppercase letters, numbers, underscores, and hyphens')
    .trim(),
  
  email: z.string()
    .email('Invalid email format')
    .max(100, 'Email must be less than 100 characters')
    .trim(),
  
  phone: z.string()
    .optional()
    .refine((val) => !val || /^[\+]?[1-9][\d]{0,15}$/.test(val), 'Invalid phone number format')
    .transform((val) => val?.trim()),
  
  address: z.object({
    street: z.string().min(5, 'Street address must be at least 5 characters').max(200).trim(),
    city: z.string().min(2, 'City must be at least 2 characters').max(50).trim(),
    state: z.string().min(2, 'State must be at least 2 characters').max(50).trim(),
    country: z.string().min(2, 'Country must be at least 2 characters').max(50).trim(),
    postalCode: z.string().min(3, 'Postal code must be at least 3 characters').max(20).trim(),
  }).optional(),
  
  location: z.object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }).optional(),
  
  website: z.string()
    .url('Invalid website URL')
    .optional()
    .transform((val) => val?.trim()),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional()
    .transform((val) => val?.trim()),
  
  type: z.enum(['PRIMARY', 'SECONDARY', 'HIGH_SCHOOL', 'UNIVERSITY', 'COLLEGE', 'VOCATIONAL', 'SPECIAL_EDUCATION', 'OTHER'])
    .default('OTHER'),
  
  level: z.enum(['PRIMARY', 'SECONDARY', 'HIGHER', 'MIXED'])
    .default('MIXED'),
  
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'])
    .default('PENDING'),
  
  timezone: z.string()
    .default('UTC')
    .transform((val) => val?.trim()),
  
  locale: z.string()
    .default('en-US')
    .transform((val) => val?.trim()),
  
  academicSessionId: z.number().int().positive().optional(),
  currentTermId: z.number().int().positive().optional(),
  
  metadata: z.record(z.any()).optional(),
  
  ownerId: z.number().int().positive(),
});

/**
 * School update schema
 */
export const SchoolUpdateSchema = SchoolCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

/**
 * School search schema
 */
export const SchoolSearchSchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  
  // Sorting
  sortBy: z.enum(['name', 'code', 'email', 'type', 'level', 'status', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Filtering
  search: z.string().optional().transform((val) => val?.trim()),
  name: z.string().optional().transform((val) => val?.trim()),
  code: z.string().optional().transform((val) => val?.trim()),
  email: z.string().optional().transform((val) => val?.trim()),
  type: z.enum(['PRIMARY', 'SECONDARY', 'HIGH_SCHOOL', 'UNIVERSITY', 'COLLEGE', 'VOCATIONAL', 'SPECIAL_EDUCATION', 'OTHER']).optional(),
  level: z.enum(['PRIMARY', 'SECONDARY', 'HIGHER', 'MIXED']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  ownerId: z.coerce.number().int().positive().optional(),
  
  // Date filters
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  
  // Include relations
  include: z.string().optional().transform((val) => 
    val ? val.split(',').map(item => item.trim()) : []
  ),
});

/**
 * School bulk create schema
 */
export const SchoolBulkCreateSchema = z.object({
  schools: z.array(SchoolCreateSchema).min(1).max(100),
  user: z.object({
    id: z.number().int().positive(),
    role: z.string(),
  }).optional(),
});

/**
 * School bulk update schema
 */
export const SchoolBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int().positive(),
    data: SchoolUpdateSchema.omit({ id: true }),
  })).min(1).max(100),
  user: z.object({
    id: z.number().int().positive(),
    role: z.string(),
  }).optional(),
});

/**
 * School import schema
 */
export const SchoolImportSchema = z.object({
  data: z.array(z.record(z.any())).min(1).max(1000),
  options: z.object({
    skipDuplicates: z.boolean().default(true),
    updateExisting: z.boolean().default(false),
    validateOnly: z.boolean().default(false),
  }).optional(),
  user: z.object({
    id: z.number().int().positive(),
    role: z.string(),
  }).optional(),
});

/**
 * School export schema
 */
export const SchoolExportSchema = z.object({
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json'),
  filters: SchoolSearchSchema.omit({ page: true, limit: true }).optional(),
  fields: z.array(z.string()).optional(),
  includeRelations: z.boolean().default(false),
});

/**
 * School analytics schema
 */
export const SchoolAnalyticsSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  metrics: z.array(z.enum(['students', 'teachers', 'classes', 'performance', 'attendance', 'revenue'])).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year']).optional(),
});

/**
 * School performance schema
 */
export const SchoolPerformanceSchema = z.object({
  academicYear: z.string().optional(),
  term: z.string().optional(),
  metrics: z.array(z.enum(['academic', 'attendance', 'behavior', 'extracurricular', 'overall'])).optional(),
});

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Generate school code from name
 */
export const generateSchoolCode = (name) => {
  if (!name) return null;
  
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .substring(0, 10); // Limit to 10 characters
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Add country code if not present
  if (cleaned.length === 10) {
    return `+1${cleaned}`; // Assume US/Canada
  }
  
  // Add + if not present
  if (!phone.startsWith('+')) {
    return `+${cleaned}`;
  }
  
  return phone;
};

/**
 * Validate coordinates
 */
export const validateCoordinates = (latitude, longitude) => {
  if (latitude !== undefined && (latitude < -90 || latitude > 90)) {
    throw new Error('Latitude must be between -90 and 90');
  }
  
  if (longitude !== undefined && (longitude < -180 || longitude > 180)) {
    throw new Error('Longitude must be between -180 and 180');
  }
  
  return true;
};

/**
 * Generate school statistics
 */
export const generateSchoolStats = (school) => {
  return {
    totalStudents: school.students?.length || 0,
    totalTeachers: school.teachers?.length || 0,
    totalClasses: school.classes?.length || 0,
    totalSubjects: school.subjects?.length || 0,
    activeStudents: school.students?.filter(s => s.status === 'ACTIVE').length || 0,
    activeTeachers: school.teachers?.filter(t => t.status === 'ACTIVE').length || 0,
    activeClasses: school.classes?.filter(c => c.status === 'ACTIVE').length || 0,
  };
};

/**
 * Generate school analytics
 */
export const generateSchoolAnalytics = (school, period = '30d') => {
  // This would typically involve complex calculations
  // For now, return basic structure
  return {
    period,
    enrollment: {
      current: school.students?.length || 0,
      trend: 0, // Would calculate trend
      projection: 0, // Would calculate projection
    },
    performance: {
      average: 0, // Would calculate average performance
      trend: 0,
      topPerformers: 0,
    },
    attendance: {
      rate: 0, // Would calculate attendance rate
      trend: 0,
    },
    financial: {
      revenue: 0,
      expenses: 0,
      profit: 0,
    },
  };
};

/**
 * Build school search query
 */
export const buildSchoolSearchQuery = (filters) => {
  const where = {};
  
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  
  if (filters.name) {
    where.name = { contains: filters.name, mode: 'insensitive' };
  }
  
  if (filters.code) {
    where.code = { contains: filters.code, mode: 'insensitive' };
  }
  
  if (filters.email) {
    where.email = { contains: filters.email, mode: 'insensitive' };
  }
  
  if (filters.type) {
    where.type = filters.type;
  }
  
  if (filters.level) {
    where.level = filters.level;
  }
  
  if (filters.status) {
    where.status = filters.status;
  }
  
  if (filters.ownerId) {
    where.ownerId = BigInt(filters.ownerId);
  }
  
  if (filters.createdAfter) {
    where.createdAt = { ...where.createdAt, gte: new Date(filters.createdAfter) };
  }
  
  if (filters.createdBefore) {
    where.createdAt = { ...where.createdAt, lte: new Date(filters.createdBefore) };
  }
  
  if (filters.updatedAfter) {
    where.updatedAt = { ...where.updatedAt, gte: new Date(filters.updatedAfter) };
  }
  
  if (filters.updatedBefore) {
    where.updatedAt = { ...where.updatedAt, lte: new Date(filters.updatedBefore) };
  }
  
  // Always exclude deleted schools unless specifically requested
  where.deletedAt = null;
  
  return where;
};

/**
 * Build school include query
 */
export const buildSchoolIncludeQuery = (include = []) => {
  const includeQuery = {};
  
  if (include.includes('owner')) {
    includeQuery.owner = true;
  }
  
  if (include.includes('students')) {
    includeQuery.students = {
      where: { deletedAt: null },
      take: 100, // Limit for performance
    };
  }
  
  if (include.includes('teachers')) {
    includeQuery.teachers = {
      where: { deletedAt: null },
      take: 100,
    };
  }
  
  if (include.includes('classes')) {
    includeQuery.classes = {
      where: { deletedAt: null },
      take: 100,
    };
  }
  
  if (include.includes('subjects')) {
    includeQuery.subjects = {
      where: { deletedAt: null },
      take: 100,
    };
  }
  
  if (include.includes('academicSessions')) {
    includeQuery.academicSessions = {
      take: 5,
      orderBy: { startDate: 'desc' },
    };
  }
  
  if (include.includes('terms')) {
    includeQuery.terms = {
      take: 5,
      orderBy: { startDate: 'desc' },
    };
  }
  
  return includeQuery;
};

/**
 * Generate school export data
 */
export const generateSchoolExportData = (schools, format = 'json') => {
  switch (format) {
    case 'json':
      return schools;
    
    case 'csv':
      // Convert to CSV format
      const headers = ['id', 'name', 'code', 'email', 'type', 'level', 'status', 'createdAt'];
      const csvData = schools.map(school => 
        headers.map(header => school[header]).join(',')
      );
      return [headers.join(','), ...csvData].join('\n');
    
    case 'xlsx':
      // Would use a library like xlsx
      return schools;
    
    case 'pdf':
      // Would use a library like pdfkit
      return schools;
    
    default:
      return schools;
  }
};

/**
 * Validate school import data
 */
export const validateSchoolImportData = (data) => {
  const results = {
    valid: [],
    invalid: [],
    errors: [],
  };
  
  data.forEach((row, index) => {
    try {
      const validated = SchoolCreateSchema.parse(row);
      results.valid.push(validated);
    } catch (error) {
      results.invalid.push(row);
      results.errors.push({
        row: index + 1,
        errors: error.errors,
      });
    }
  });
  
  return results;
};

/**
 * Generate school code suggestions
 */
export const generateSchoolCodeSuggestions = (name) => {
  if (!name) return [];
  
  const base = generateSchoolCode(name);
  const suggestions = [base];
  
  // Add variations
  for (let i = 1; i <= 5; i++) {
    suggestions.push(`${base}_${i}`);
  }
  
  // Add year variations
  const currentYear = new Date().getFullYear();
  suggestions.push(`${base}_${currentYear}`);
  
  return suggestions.slice(0, 5); // Return top 5 suggestions
};

/**
 * Calculate school performance
 */
export const calculateSchoolPerformance = async (schoolId) => {
  try {
    const { PrismaClient } = await import('../generated/prisma/index.js');
    const prisma = new PrismaClient();

    console.log(`Calculating performance for school ID: ${schoolId}`);

    // Get school with comprehensive related data
    const school = await prisma.school.findUnique({
      where: { id: BigInt(schoolId) },
      include: {
        students: {
          where: { deletedAt: null },
          include: {
            grades: {
              include: {
                exam: true,
                subject: true
              }
            },
            attendances: {
              where: {
                date: {
                  gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
                }
              }
            },
            class: true,
            section: true
          }
        },
        teachers: {
          where: { deletedAt: null },
          include: {
            user: true,
            department: true
          }
        },
        classes: {
          where: { deletedAt: null },
          include: {
            students: true,
            subjects: true
          }
        },
        exams: {
          where: {
            startDate: {
              gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) // Last 6 months
            }
          },
          include: {
            grades: true,
            term: true
          }
        },
        subjects: {
          include: {
            grades: true
          }
        },
        departments: {
          include: {
            teachers: true
          }
        },
        sections: {
          include: {
            students: true
          }
        }
      }
    });

    if (!school) {
      throw new Error('School not found');
    }

    console.log(`School found: ${school.name}`);
    console.log(`Students: ${school.students.length}`);
    console.log(`Teachers: ${school.teachers.length}`);
    console.log(`Classes: ${school.classes.length}`);
    console.log(`Exams: ${school.exams.length}`);

    // Calculate comprehensive academic performance
    const academicScore = await calculateAcademicPerformance(school);
    console.log('Academic score calculated:', academicScore);
    
    // Calculate attendance performance
    const attendanceRate = await calculateAttendanceRate(school);
    console.log('Attendance rate calculated:', attendanceRate);
    
    // Calculate behavior score
    const behaviorScore = await calculateBehaviorScore(school);
    console.log('Behavior score calculated:', behaviorScore);
    
    // Calculate extracurricular participation
    const extracurricularScore = await calculateExtracurricularScore(school);
    console.log('Extracurricular score calculated:', extracurricularScore);
    
    // Calculate infrastructure and resources score
    const infrastructureScore = await calculateInfrastructureScore(school);
    console.log('Infrastructure score calculated:', infrastructureScore);
    
    // Calculate overall performance with weighted components
    const overallScore = (academicScore.score * 0.35) + 
                        (attendanceRate * 0.25) + 
                        (behaviorScore * 0.15) + 
                        (extracurricularScore * 0.15) +
                        (infrastructureScore * 0.10);

    const performance = {
      academic: {
        score: Math.round(academicScore.score * 100) / 100,
        grade: getGradeFromScore(academicScore.score),
        trend: academicScore.trend,
        totalStudents: school.students.length,
        totalExams: school.exams.length,
        averageMarks: Math.round(academicScore.averageMarks * 100) / 100,
        subjectsWithGrades: academicScore.subjectsWithGrades,
        classPerformance: academicScore.classPerformance,
        recentPerformance: academicScore.recentPerformance
      },
      attendance: {
        rate: Math.round(attendanceRate * 100) / 100,
        trend: 0, // Would need historical data for trend
        totalDays: school.students.reduce((sum, student) => sum + student.attendances.length, 0),
        presentDays: school.students.reduce((sum, student) => 
          sum + student.attendances.filter(att => att.status === 'PRESENT').length, 0),
        absentDays: school.students.reduce((sum, student) => 
          sum + student.attendances.filter(att => att.status === 'ABSENT').length, 0),
        lateDays: school.students.reduce((sum, student) => 
          sum + student.attendances.filter(att => att.status === 'LATE').length, 0)
      },
      behavior: {
        score: Math.round(behaviorScore * 100) / 100,
        incidents: 0, // Would need behavior tracking data
        attendanceContribution: Math.round(behaviorScore.attendanceContribution * 100) / 100,
        academicContribution: Math.round(behaviorScore.academicContribution * 100) / 100
      },
      extracurricular: {
        participation: Math.round(extracurricularScore * 100) / 100,
        achievements: 0, // Would need achievement tracking data
        teacherStudentRatio: Math.round(extracurricularScore.teacherStudentRatio * 100) / 100,
        classDiversity: extracurricularScore.classDiversity
      },
      infrastructure: {
        score: Math.round(infrastructureScore * 100) / 100,
        totalClasses: school.classes.length,
        totalSections: school.sections.length,
        totalDepartments: school.departments.length,
        totalSubjects: school.subjects.length,
        averageClassSize: school.students.length > 0 ? Math.round(school.students.length / school.classes.length) : 0
      },
      overall: {
        score: Math.round(overallScore * 100) / 100,
        grade: getGradeFromScore(overallScore),
        rank: 0, // Would need comparison with other schools
        components: {
          academic: Math.round(academicScore.score * 35) / 100,
          attendance: Math.round(attendanceRate * 25) / 100,
          behavior: Math.round(behaviorScore.score * 15) / 100,
          extracurricular: Math.round(extracurricularScore * 15) / 100,
          infrastructure: Math.round(infrastructureScore * 10) / 100
        }
      },
      metadata: {
        calculationDate: new Date().toISOString(),
        dataPoints: {
          students: school.students.length,
          teachers: school.teachers.length,
          classes: school.classes.length,
          exams: school.exams.length,
          grades: school.students.reduce((sum, student) => sum + student.grades.length, 0),
          attendances: school.students.reduce((sum, student) => sum + student.attendances.length, 0)
        }
      }
    };

    console.log('Final performance calculated:', performance);
    await prisma.$disconnect();
    return performance;
  } catch (error) {
    console.error('Error calculating school performance:', error);
    // Return default structure on error
    return {
      academic: {
        score: 0,
        grade: 'N/A',
        trend: 0,
        totalStudents: 0,
        totalExams: 0,
        averageMarks: 0,
        subjectsWithGrades: 0,
        classPerformance: {},
        recentPerformance: 0
      },
      attendance: {
        rate: 0,
        trend: 0,
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0
      },
      behavior: {
        score: 0,
        incidents: 0,
        attendanceContribution: 0,
        academicContribution: 0
      },
      extracurricular: {
        participation: 0,
        achievements: 0,
        teacherStudentRatio: 0,
        classDiversity: 0
      },
      infrastructure: {
        score: 0,
        totalClasses: 0,
        totalSections: 0,
        totalDepartments: 0,
        totalSubjects: 0,
        averageClassSize: 0
      },
      overall: {
        score: 0,
        grade: 'N/A',
        rank: 0,
        components: {
          academic: 0,
          attendance: 0,
          behavior: 0,
          extracurricular: 0,
          infrastructure: 0
        }
      },
      metadata: {
        calculationDate: new Date().toISOString(),
        dataPoints: {
          students: 0,
          teachers: 0,
          classes: 0,
          exams: 0,
          grades: 0,
          attendances: 0
        }
      }
    };
  }
};

// Helper functions
async function calculateAcademicPerformance(school) {
  const allGrades = school.students.flatMap(student => student.grades);
  
  if (allGrades.length === 0) {
    // If no grades, provide a baseline score based on school setup
    const baselineScore = school.students.length > 0 ? 0.6 : 0.5; // Assume average performance
    return { 
      score: baselineScore, 
      trend: 0, 
      averageMarks: 60,
      subjectsWithGrades: 0,
      classPerformance: {},
      recentPerformance: baselineScore
    };
  }

  const totalMarks = allGrades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0);
  const averageMarks = totalMarks / allGrades.length;
  
  // Convert to percentage (assuming max marks is 100)
  const score = Math.min(averageMarks / 100, 1);
  
  // Calculate trend (simplified - would need historical data for real trend)
  const recentGrades = allGrades.filter(grade => 
    new Date(grade.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  );
  const recentAverage = recentGrades.length > 0 
    ? recentGrades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0) / recentGrades.length
    : averageMarks;
  
  const trend = recentAverage > averageMarks ? 1 : recentAverage < averageMarks ? -1 : 0;
  
  // Calculate class performance
  const classPerformance = {};
  school.classes.forEach(cls => {
    const classGrades = allGrades.filter(grade => 
      grade.student?.classId === cls.id
    );
    if (classGrades.length > 0) {
      const classAverage = classGrades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0) / classGrades.length;
      classPerformance[cls.name] = Math.round(classAverage * 100) / 100;
    }
  });
  
  // Count subjects with grades
  const subjectsWithGrades = new Set(allGrades.map(grade => grade.subjectId)).size;
  
  return { 
    score, 
    trend, 
    averageMarks,
    subjectsWithGrades,
    classPerformance,
    recentPerformance: Math.min(recentAverage / 100, 1)
  };
}

async function calculateAttendanceRate(school) {
  const allAttendances = school.students.flatMap(student => student.attendances);
  
  if (allAttendances.length === 0) {
    // If no attendance data, provide a baseline based on school setup
    return school.students.length > 0 ? 0.85 : 0.8; // Assume good attendance
  }

  const presentCount = allAttendances.filter(att => att.status === 'PRESENT').length;
  const totalCount = allAttendances.length;
  
  return totalCount > 0 ? presentCount / totalCount : 0.85;
}

async function calculateBehaviorScore(school) {
  // Simplified behavior score based on attendance and academic performance
  const attendanceRate = await calculateAttendanceRate(school);
  const academicScore = await calculateAcademicPerformance(school);
  
  // Calculate contributions
  const attendanceContribution = attendanceRate * 0.6;
  const academicContribution = academicScore.score * 0.4;
  
  // Combine attendance and academic performance for behavior score
  const score = attendanceContribution + academicContribution;
  
  return { 
    score, 
    attendanceContribution, 
    academicContribution 
  };
}

async function calculateExtracurricularScore(school) {
  // Simplified extracurricular score based on student engagement
  // In a real implementation, this would be based on actual extracurricular activities
  const totalStudents = school.students.length;
  const totalTeachers = school.teachers.length;
  const totalClasses = school.classes.length;
  
  // Calculate teacher-student ratio (normalized)
  const teacherStudentRatio = totalStudents > 0 ? Math.min(totalTeachers / totalStudents, 0.5) : 0.1;
  
  // Calculate class diversity (more classes = more opportunities)
  const classDiversity = totalClasses > 0 ? Math.min(totalClasses / Math.max(totalStudents, 1), 0.3) : 0.1;
  
  // Combine factors for extracurricular score
  const score = (teacherStudentRatio * 0.7) + (classDiversity * 0.3);
  
  return {
    score,
    teacherStudentRatio,
    classDiversity
  };
}

async function calculateInfrastructureScore(school) {
  const totalStudents = school.students.length;
  const totalClasses = school.classes.length;
  const totalSections = school.sections.length;
  const totalDepartments = school.departments.length;
  const totalSubjects = school.subjects.length;
  
  // Calculate infrastructure factors
  const classCapacity = totalClasses > 0 ? Math.min(totalStudents / totalClasses, 30) / 30 : 0.5;
  const sectionDiversity = totalSections > 0 ? Math.min(totalSections / Math.max(totalClasses, 1), 3) / 3 : 0.3;
  const departmentCoverage = totalDepartments > 0 ? Math.min(totalDepartments / 5, 1) : 0.2;
  const subjectBreadth = totalSubjects > 0 ? Math.min(totalSubjects / 10, 1) : 0.3;
  
  // Weighted infrastructure score
  const score = (classCapacity * 0.3) + (sectionDiversity * 0.2) + (departmentCoverage * 0.25) + (subjectBreadth * 0.25);
  
  return score;
}

function getGradeFromScore(score) {
  if (score >= 0.9) return 'A+';
  if (score >= 0.8) return 'A';
  if (score >= 0.7) return 'B+';
  if (score >= 0.6) return 'B';
  if (score >= 0.5) return 'C+';
  if (score >= 0.4) return 'C';
  if (score >= 0.3) return 'D';
  return 'F';
} 
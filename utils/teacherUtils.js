import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';
import { generateUsername } from './userSchemas.js';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const TeacherCreateSchema = z.object({
  employeeId: z.string().optional(),
  departmentId: z.number().optional(),
  qualification: z.string().max(255).optional(),
  specialization: z.string().max(255).optional(),
  joiningDate: z.string().datetime().optional(),
  experience: z.number().int().min(0).max(50).optional(),
  salary: z.number().positive().optional(),
  isClassTeacher: z.boolean().default(false),
  schoolId: z.number().int().positive(),
  user: z.object({
    firstName: z.string().min(2).max(50),
    lastName: z.string().min(2).max(50),
    email: z.string().email(),
    phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
    password: z.string().min(8).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
    dateOfBirth: z.string().datetime().optional(),
    address: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional()
  })
});

export const TeacherUpdateSchema = z.object({
  employeeId: z.string().optional(),
  departmentId: z.number().optional(),
  qualification: z.string().max(255).optional(),
  specialization: z.string().max(255).optional(),
  joiningDate: z.string().datetime().optional(),
  experience: z.number().int().min(0).max(50).optional(),
  salary: z.number().positive().optional(),
  isClassTeacher: z.boolean().optional(),
  user: z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    email: z.string().email().optional(),
    phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
    dateOfBirth: z.string().datetime().optional(),
    address: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional()
  }).optional()
});

export const TeacherSearchSchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
  isClassTeacher: z.string().transform(val => val === 'true').optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  experience: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
  qualification: z.string().optional(),
  specialization: z.string().optional(),
  joiningDateFrom: z.string().datetime().optional(),
  joiningDateTo: z.string().datetime().optional(),
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => parseInt(val) || 10).optional(),
  include: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Generate teacher code
 */
export const generateTeacherCode = async (name, schoolId, existingCodes = []) => {
  try {
    // Get school code
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { code: true }
    });

    if (!school) {
      throw new Error('School not found');
    }

    const schoolCode = school.code;
    const currentYear = new Date().getFullYear().toString().slice(-2);
    
    // Generate base code from name
    let baseCode = '';
    if (name) {
      const nameParts = name.split(' ').filter(part => part.length > 0);
      if (nameParts.length >= 2) {
        baseCode = (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
      } else {
        baseCode = nameParts[0].substring(0, 2).toUpperCase();
      }
    } else {
      baseCode = 'TC'; // Teacher Code
    }

    // Get existing codes for this pattern
    const pattern = `${schoolCode}${baseCode}${currentYear}`;
    const existingTeachers = await prisma.teacher.findMany({
      where: {
        employeeId: {
          startsWith: pattern
        },
        schoolId,
        deletedAt: null
      },
      select: { employeeId: true }
    });

    const existingPatternCodes = existingTeachers.map(t => t.employeeId);
    const allExistingCodes = [...existingCodes, ...existingPatternCodes];

    // Find next available number
    let counter = 1;
    let teacherCode = `${pattern}${counter.toString().padStart(3, '0')}`;
    
    while (allExistingCodes.includes(teacherCode)) {
      counter++;
      teacherCode = `${pattern}${counter.toString().padStart(3, '0')}`;
    }

    return teacherCode;
  } catch (error) {
    console.error('Error generating teacher code:', error);
    throw new Error('Failed to generate teacher code');
  }
};

/**
 * Validate teacher constraints
 */
export const validateTeacherConstraints = async (schoolId, employeeId, departmentId = null) => {
  try {
    // Check if employee ID already exists
    const existingTeacher = await prisma.teacher.findFirst({
      where: {
        employeeId,
        schoolId,
        deletedAt: null
      }
    });

    if (existingTeacher) {
      throw new Error(`Teacher with employee ID ${employeeId} already exists`);
    }

    // Validate department exists and belongs to school
    if (departmentId) {
      const department = await prisma.department.findFirst({
        where: {
          id: departmentId,
          schoolId,
          deletedAt: null
        }
      });

      if (!department) {
        throw new Error('Department not found or does not belong to this school');
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating teacher constraints:', error);
    throw error;
  }
};

/**
 * Build teacher search query
 */
export const buildTeacherSearchQuery = (filters) => {
  const query = {};

  // Search in teacher and user fields
  if (filters.search) {
    const searchTerm = filters.search.trim();
    query.OR = [
      {
        employeeId: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      {
        qualification: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      {
        specialization: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      {
        user: {
          OR: [
            {
              firstName: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            },
            {
              lastName: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            },
            {
              email: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            },
            {
              phone: {
                contains: searchTerm,
                mode: 'insensitive'
              }
            }
          ]
        }
      }
    ];
  }

  // Department filter
  if (filters.departmentId) {
    query.departmentId = filters.departmentId;
  }

  // Class teacher filter
  if (filters.isClassTeacher !== undefined) {
    query.isClassTeacher = filters.isClassTeacher;
  }

  // Status filter
  if (filters.status) {
    query.user = {
      ...query.user,
      status: filters.status
    };
  }

  // Experience filter
  if (filters.experience) {
    query.experience = {
      gte: filters.experience
    };
  }

  // Qualification filter
  if (filters.qualification) {
    query.qualification = {
      contains: filters.qualification,
      mode: 'insensitive'
    };
  }

  // Specialization filter
  if (filters.specialization) {
    query.specialization = {
      contains: filters.specialization,
      mode: 'insensitive'
    };
  }

  // Joining date range filter
  if (filters.joiningDateFrom || filters.joiningDateTo) {
    query.joiningDate = {};
    if (filters.joiningDateFrom) {
      query.joiningDate.gte = new Date(filters.joiningDateFrom);
    }
    if (filters.joiningDateTo) {
      query.joiningDate.lte = new Date(filters.joiningDateTo);
    }
  }

  return query;
};

/**
 * Build teacher include query
 */
export const buildTeacherIncludeQuery = (include = []) => {
  const includeQuery = {
    user: {
      select: {
        id: true,
        uuid: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        gender: true,
        dateOfBirth: true,
        address: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        createdAt: true,
        updatedAt: true
      }
    },
    department: {
      select: {
        id: true,
        name: true,
        code: true,
        description: true
      }
    },
    school: {
      select: {
        id: true,
        name: true,
        code: true,
        shortName: true
      }
    }
  };

  // Add conditional includes
  if (include.includes('subjects')) {
    includeQuery.subjects = {
      select: {
        id: true,
        name: true,
        code: true,
        creditHours: true,
        isElective: true
      }
    };
  }

  if (include.includes('classes')) {
    includeQuery.classes = {
      select: {
        id: true,
        name: true,
        code: true,
        grade: true
      }
    };
  }

  if (include.includes('attendances')) {
    includeQuery.attendances = {
      where: {
        date: {
          gte: new Date(new Date().getFullYear(), 0, 1) // Current year
        }
      },
      select: {
        id: true,
        date: true,
        status: true,
        remarks: true
      },
      orderBy: { date: 'desc' },
      take: 30 // Last 30 attendances
    };
  }

  if (include.includes('documents')) {
    includeQuery.documents = {
      select: {
        id: true,
        type: true,
        title: true,
        fileName: true,
        fileSize: true,
        uploadedAt: true
      },
      orderBy: { uploadedAt: 'desc' }
    };
  }

  return includeQuery;
};

/**
 * Generate teacher statistics
 */
export const generateTeacherStats = async (teacherId) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: true,
        department: true,
        subjects: true,
        classes: true,
        attendances: {
          where: {
            date: {
              gte: new Date(new Date().getFullYear(), 0, 1) // Current year
            }
          }
        }
      }
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Calculate attendance statistics
    const totalAttendanceDays = teacher.attendances.length;
    const presentDays = teacher.attendances.filter(a => a.status === 'PRESENT').length;
    const absentDays = teacher.attendances.filter(a => a.status === 'ABSENT').length;
    const lateDays = teacher.attendances.filter(a => a.status === 'LATE').length;
    const attendanceRate = totalAttendanceDays > 0 ? (presentDays / totalAttendanceDays) * 100 : 0;

    // Calculate subject statistics
    const totalSubjects = teacher.subjects.length;
    const electiveSubjects = teacher.subjects.filter(s => s.isElective).length;
    const coreSubjects = totalSubjects - electiveSubjects;

    // Calculate class statistics
    const totalClasses = teacher.classes.length;

    // Calculate experience statistics
    const joiningDate = teacher.joiningDate;
    const currentDate = new Date();
    const experienceInYears = joiningDate ? 
      Math.floor((currentDate - new Date(joiningDate)) / (1000 * 60 * 60 * 24 * 365.25)) : 
      teacher.experience || 0;

    const stats = {
      teacherId,
      employeeId: teacher.employeeId,
      name: `${teacher.user.firstName} ${teacher.user.lastName}`,
      department: teacher.department?.name || 'Not Assigned',
      attendance: {
        totalDays: totalAttendanceDays,
        presentDays,
        absentDays,
        lateDays,
        attendanceRate: Math.round(attendanceRate * 100) / 100
      },
      subjects: {
        total: totalSubjects,
        core: coreSubjects,
        elective: electiveSubjects
      },
      classes: {
        total: totalClasses
      },
      experience: {
        years: experienceInYears,
        joiningDate: teacher.joiningDate,
        isClassTeacher: teacher.isClassTeacher
      },
      salary: teacher.salary,
      qualification: teacher.qualification,
      specialization: teacher.specialization,
      status: teacher.user.status,
      lastUpdated: teacher.updatedAt
    };

    return stats;
  } catch (error) {
    console.error('Error generating teacher stats:', error);
    throw new Error('Failed to generate teacher statistics');
  }
};

/**
 * Generate teacher analytics
 */
export const generateTeacherAnalytics = async (teacherId, period = '30d') => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: true,
        department: true,
        subjects: true,
        classes: true,
        attendances: {
          where: {
            date: {
              gte: getDateFromPeriod(period)
            }
          },
          orderBy: { date: 'asc' }
        }
      }
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Attendance analytics
    const attendanceAnalytics = analyzeAttendance(teacher.attendances, period);

    // Subject analytics
    const subjectAnalytics = {
      totalSubjects: teacher.subjects.length,
      subjectsByType: {
        core: teacher.subjects.filter(s => !s.isElective).length,
        elective: teacher.subjects.filter(s => s.isElective).length
      },
      subjectsByCreditHours: teacher.subjects.reduce((acc, subject) => {
        const hours = subject.creditHours || 0;
        acc[hours] = (acc[hours] || 0) + 1;
        return acc;
      }, {}),
      totalCreditHours: teacher.subjects.reduce((sum, subject) => sum + (subject.creditHours || 0), 0)
    };

    // Class analytics
    const classAnalytics = {
      totalClasses: teacher.classes.length,
      classesByGrade: teacher.classes.reduce((acc, cls) => {
        const grade = cls.grade || 'Unknown';
        acc[grade] = (acc[grade] || 0) + 1;
        return acc;
      }, {})
    };

    // Performance analytics
    const performanceAnalytics = {
      attendanceRate: attendanceAnalytics.attendanceRate,
      experienceLevel: getExperienceLevel(teacher.experience || 0),
      workloadScore: calculateWorkloadScore(teacher.subjects.length, teacher.classes.length),
      efficiencyScore: calculateEfficiencyScore(attendanceAnalytics.attendanceRate, teacher.experience || 0)
    };

    const analytics = {
      teacherId,
      employeeId: teacher.employeeId,
      name: `${teacher.user.firstName} ${teacher.user.lastName}`,
      period,
      attendance: attendanceAnalytics,
      subjects: subjectAnalytics,
      classes: classAnalytics,
      performance: performanceAnalytics,
      department: teacher.department?.name || 'Not Assigned',
      generatedAt: new Date()
    };

    return analytics;
  } catch (error) {
    console.error('Error generating teacher analytics:', error);
    throw new Error('Failed to generate teacher analytics');
  }
};

/**
 * Calculate teacher performance
 */
export const calculateTeacherPerformance = async (teacherId) => {
  try {
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        user: true,
        department: true,
        subjects: true,
        classes: true,
        attendances: {
          where: {
            date: {
              gte: new Date(new Date().getFullYear(), 0, 1) // Current year
            }
          }
        }
      }
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Calculate various performance metrics
    const attendanceScore = calculateAttendanceScore(teacher.attendances);
    const workloadScore = calculateWorkloadScore(teacher.subjects.length, teacher.classes.length);
    const experienceScore = calculateExperienceScore(teacher.experience || 0);
    const qualificationScore = calculateQualificationScore(teacher.qualification);

    // Calculate overall performance score
    const overallScore = Math.round(
      (attendanceScore * 0.3 + 
       workloadScore * 0.25 + 
       experienceScore * 0.25 + 
       qualificationScore * 0.2) * 100
    ) / 100;

    const performance = {
      teacherId,
      employeeId: teacher.employeeId,
      name: `${teacher.user.firstName} ${teacher.user.lastName}`,
      scores: {
        attendance: attendanceScore,
        workload: workloadScore,
        experience: experienceScore,
        qualification: qualificationScore,
        overall: overallScore
      },
      metrics: {
        totalSubjects: teacher.subjects.length,
        totalClasses: teacher.classes.length,
        attendanceRate: calculateAttendanceRate(teacher.attendances),
        experienceYears: teacher.experience || 0,
        isClassTeacher: teacher.isClassTeacher
      },
      grade: getPerformanceGrade(overallScore),
      department: teacher.department?.name || 'Not Assigned',
      lastUpdated: new Date()
    };

    return performance;
  } catch (error) {
    console.error('Error calculating teacher performance:', error);
    throw new Error('Failed to calculate teacher performance');
  }
};

/**
 * Generate teacher export data
 */
export const generateTeacherExportData = async (teachers, format = 'json') => {
  try {
    const exportData = teachers.map(teacher => ({
      employeeId: teacher.employeeId,
      firstName: teacher.user.firstName,
      lastName: teacher.user.lastName,
      email: teacher.user.email,
      phone: teacher.user.phone,
      gender: teacher.user.gender,
      dateOfBirth: teacher.user.dateOfBirth,
      department: teacher.department?.name || 'Not Assigned',
      qualification: teacher.qualification,
      specialization: teacher.specialization,
      joiningDate: teacher.joiningDate,
      experience: teacher.experience,
      salary: teacher.salary,
      isClassTeacher: teacher.isClassTeacher,
      status: teacher.user.status,
      address: teacher.user.address,
      city: teacher.user.city,
      state: teacher.user.state,
      country: teacher.user.country,
      postalCode: teacher.user.postalCode,
      school: teacher.school.name,
      createdAt: teacher.createdAt,
      updatedAt: teacher.updatedAt
    }));

    if (format === 'csv') {
      // Convert to CSV format
      const headers = Object.keys(exportData[0] || {}).join(',');
      const rows = exportData.map(row => 
        Object.values(row).map(value => 
          typeof value === 'string' && value.includes(',') ? `"${value}"` : value
        ).join(',')
      );
      return `${headers}\n${rows.join('\n')}`;
    }

    return exportData;
  } catch (error) {
    console.error('Error generating teacher export data:', error);
    throw new Error('Failed to generate export data');
  }
};

/**
 * Validate teacher import data
 */
export const validateTeacherImportData = (teachers) => {
  const errors = [];
  const validTeachers = [];

  for (let i = 0; i < teachers.length; i++) {
    const teacher = teachers[i];
    const rowErrors = [];

    // Required fields validation
    if (!teacher.user?.firstName) {
      rowErrors.push('First name is required');
    }
    if (!teacher.user?.lastName) {
      rowErrors.push('Last name is required');
    }
    if (!teacher.user?.email) {
      rowErrors.push('Email is required');
    }
    if (!teacher.schoolId) {
      rowErrors.push('School ID is required');
    }

    // Email format validation
    if (teacher.user?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.user.email)) {
      rowErrors.push('Invalid email format');
    }

    // Phone format validation
    if (teacher.user?.phone && !/^\+?[\d\s\-\(\)]+$/.test(teacher.user.phone)) {
      rowErrors.push('Invalid phone format');
    }

    // Experience validation
    if (teacher.experience && (teacher.experience < 0 || teacher.experience > 50)) {
      rowErrors.push('Experience must be between 0 and 50 years');
    }

    // Salary validation
    if (teacher.salary && teacher.salary <= 0) {
      rowErrors.push('Salary must be positive');
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: i + 1,
        teacher: teacher,
        errors: rowErrors
      });
    } else {
      validTeachers.push(teacher);
    }
  }

  return {
    isValid: errors.length === 0,
    validTeachers,
    errors
  };
};

/**
 * Generate teacher code suggestions
 */
export const generateTeacherCodeSuggestions = async (name, schoolId) => {
  try {
    const suggestions = [];
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { code: true }
    });

    if (!school) {
      throw new Error('School not found');
    }

    const schoolCode = school.code;
    const currentYear = new Date().getFullYear().toString().slice(-2);
    
    // Generate suggestions based on name
    const nameParts = name.split(' ').filter(part => part.length > 0);
    
    if (nameParts.length >= 2) {
      const initials = (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
      suggestions.push(`${schoolCode}${initials}${currentYear}001`);
      suggestions.push(`${schoolCode}${initials}${currentYear}002`);
      suggestions.push(`${schoolCode}${initials}${currentYear}003`);
    } else {
      const prefix = nameParts[0].substring(0, 2).toUpperCase();
      suggestions.push(`${schoolCode}${prefix}${currentYear}001`);
      suggestions.push(`${schoolCode}${prefix}${currentYear}002`);
      suggestions.push(`${schoolCode}${prefix}${currentYear}003`);
    }

    return suggestions;
  } catch (error) {
    console.error('Error generating teacher code suggestions:', error);
    throw new Error('Failed to generate code suggestions');
  }
};

/**
 * Get teacher count by department
 */
export const getTeacherCountByDepartment = async (schoolId) => {
  try {
    const where = { deletedAt: null };
    if (schoolId) where.schoolId = schoolId;

    const counts = await prisma.teacher.groupBy({
      by: ['departmentId'],
      where,
      _count: {
        id: true
      }
    });

    const departmentCounts = [];
    
    for (const count of counts) {
      const department = await prisma.department.findUnique({
        where: { id: count.departmentId },
        select: { name: true, code: true }
      });

      departmentCounts.push({
        departmentId: count.departmentId,
        departmentName: department?.name || 'Not Assigned',
        departmentCode: department?.code || 'NA',
        count: count._count.id
      });
    }

    // Add count for teachers without department
    const noDepartmentCount = await prisma.teacher.count({
      where: {
        schoolId,
        departmentId: null,
        deletedAt: null
      }
    });

    if (noDepartmentCount > 0) {
      departmentCounts.push({
        departmentId: null,
        departmentName: 'Not Assigned',
        departmentCode: 'NA',
        count: noDepartmentCount
      });
    }

    return departmentCounts.sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('Error getting teacher count by department:', error);
    throw new Error('Failed to get teacher count by department');
  }
};

/**
 * Get teacher count by experience
 */
export const getTeacherCountByExperience = async (schoolId) => {
  try {
    const teachers = await prisma.teacher.findMany({
      where: {
        schoolId,
        deletedAt: null
      },
      select: { experience: true }
    });

    const experienceRanges = {
      '0-2 years': 0,
      '3-5 years': 0,
      '6-10 years': 0,
      '11-15 years': 0,
      '16-20 years': 0,
      '20+ years': 0
    };

    teachers.forEach(teacher => {
      const experience = teacher.experience || 0;
      if (experience <= 2) {
        experienceRanges['0-2 years']++;
      } else if (experience <= 5) {
        experienceRanges['3-5 years']++;
      } else if (experience <= 10) {
        experienceRanges['6-10 years']++;
      } else if (experience <= 15) {
        experienceRanges['11-15 years']++;
      } else if (experience <= 20) {
        experienceRanges['16-20 years']++;
      } else {
        experienceRanges['20+ years']++;
      }
    });

    return Object.entries(experienceRanges).map(([range, count]) => ({
      range,
      count
    }));
  } catch (error) {
    console.error('Error getting teacher count by experience:', error);
    throw new Error('Failed to get teacher count by experience');
  }
};

// ======================
// HELPER FUNCTIONS
// ======================

function getDateFromPeriod(period) {
  const now = new Date();
  switch (period) {
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case '90d':
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    case '1y':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

function analyzeAttendance(attendances, period) {
  const totalDays = attendances.length;
  const presentDays = attendances.filter(a => a.status === 'PRESENT').length;
  const absentDays = attendances.filter(a => a.status === 'ABSENT').length;
  const lateDays = attendances.filter(a => a.status === 'LATE').length;
  const excusedDays = attendances.filter(a => a.status === 'EXCUSED').length;

  const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

  return {
    totalDays,
    presentDays,
    absentDays,
    lateDays,
    excusedDays,
    attendanceRate: Math.round(attendanceRate * 100) / 100,
    period
  };
}

function getExperienceLevel(experience) {
  if (experience <= 2) return 'Beginner';
  if (experience <= 5) return 'Intermediate';
  if (experience <= 10) return 'Experienced';
  if (experience <= 15) return 'Senior';
  return 'Expert';
}

function calculateWorkloadScore(subjectCount, classCount) {
  const totalWorkload = subjectCount + classCount;
  if (totalWorkload <= 3) return 1.0;
  if (totalWorkload <= 5) return 0.9;
  if (totalWorkload <= 7) return 0.8;
  if (totalWorkload <= 10) return 0.7;
  return 0.6;
}

function calculateEfficiencyScore(attendanceRate, experience) {
  const attendanceScore = attendanceRate / 100;
  const experienceScore = Math.min(experience / 20, 1); // Cap at 20 years
  return Math.round((attendanceScore * 0.7 + experienceScore * 0.3) * 100) / 100;
}

function calculateAttendanceScore(attendances) {
  const totalDays = attendances.length;
  if (totalDays === 0) return 0;
  
  const presentDays = attendances.filter(a => a.status === 'PRESENT').length;
  const lateDays = attendances.filter(a => a.status === 'LATE').length;
  
  return Math.round(((presentDays + lateDays * 0.5) / totalDays) * 100) / 100;
}

function calculateAttendanceRate(attendances) {
  const totalDays = attendances.length;
  if (totalDays === 0) return 0;
  
  const presentDays = attendances.filter(a => a.status === 'PRESENT').length;
  return Math.round((presentDays / totalDays) * 100);
}

function calculateExperienceScore(experience) {
  return Math.min(experience / 20, 1); // Cap at 20 years
}

function calculateQualificationScore(qualification) {
  if (!qualification) return 0.5;
  
  const qual = qualification.toLowerCase();
  if (qual.includes('phd') || qual.includes('doctorate')) return 1.0;
  if (qual.includes('master') || qual.includes('m.ed')) return 0.9;
  if (qual.includes('bachelor') || qual.includes('b.ed')) return 0.8;
  if (qual.includes('diploma')) return 0.7;
  return 0.6;
}

function getPerformanceGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  return 'D';
} 
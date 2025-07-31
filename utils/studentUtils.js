import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const StudentCreateSchema = z.object({
  admissionNo: z.string().optional(),
  rollNo: z.string().max(20).optional(),
  classId: z.union([z.string(), z.number()]).transform(val => val ? parseInt(val) : undefined).optional(),
  sectionId: z.union([z.string(), z.number()]).transform(val => val ? parseInt(val) : undefined).optional(),
  parentId: z.union([z.string(), z.number()]).transform(val => val ? parseInt(val) : undefined).optional(),
  admissionDate: z.string().datetime().optional(),
  bloodGroup: z.string().max(5).optional(),
  nationality: z.string().max(50).optional(),
  religion: z.string().max(50).optional(),
  caste: z.string().max(50).optional(),
  aadharNo: z.string().max(20).optional(),
  bankAccountNo: z.string().max(30).optional(),
  bankName: z.string().max(100).optional(),
  ifscCode: z.string().max(20).optional(),
  previousSchool: z.string().max(255).optional(),
  schoolId: z.union([z.string(), z.number()]).transform(val => val ? parseInt(val) : undefined).optional(), // Made optional for owners
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

export const StudentUpdateSchema = z.object({
  admissionNo: z.string().optional(),
  rollNo: z.string().max(20).optional(),
  classId: z.number().int().positive().optional(),
  sectionId: z.number().int().positive().optional(),
  parentId: z.number().int().positive().optional(),
  admissionDate: z.string().datetime().optional(),
  bloodGroup: z.string().max(5).optional(),
  nationality: z.string().max(50).optional(),
  religion: z.string().max(50).optional(),
  caste: z.string().max(50).optional(),
  aadharNo: z.string().max(20).optional(),
  bankAccountNo: z.string().max(30).optional(),
  bankName: z.string().max(100).optional(),
  ifscCode: z.string().max(20).optional(),
  previousSchool: z.string().max(255).optional(),
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
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'TRANSFERRED']).optional()
  }).optional()
});

export const StudentSearchSchema = z.object({
  search: z.string().optional(),
  classId: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
  sectionId: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
  parentId: z.string().transform(val => val ? parseInt(val) : undefined).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'TRANSFERRED']).optional(),
  bloodGroup: z.string().optional(),
  nationality: z.string().optional(),
  religion: z.string().optional(),
  admissionDateFrom: z.string().datetime().optional(),
  admissionDateTo: z.string().datetime().optional(),
  page: z.string().transform(val => parseInt(val) || 1).optional(),
  limit: z.string().transform(val => {
    if (val === 'all' || val === 'unlimited') return val;
    return parseInt(val) || 10;
  }).optional(),
  include: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Generate student admission number
 */
export const generateStudentCode = async (name, schoolId, existingCodes = []) => {
  try {
    // Get school code
    const school = await prisma.school.findUnique({
      where: { id: BigInt(schoolId) },
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
      baseCode = 'ST'; // Student Code
    }

    // Get existing codes for this pattern
    const pattern = `${schoolCode}${baseCode}${currentYear}`;
    const existingStudents = await prisma.student.findMany({
      where: {
        admissionNo: {
          startsWith: pattern
        },
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      select: { admissionNo: true }
    });

    const existingPatternCodes = existingStudents.map(s => s.admissionNo);
    const allExistingCodes = [...existingCodes, ...existingPatternCodes];

    // Find next available number
    let counter = 1;
    let studentCode = `${pattern}${counter.toString().padStart(3, '0')}`;
    
    while (allExistingCodes.includes(studentCode)) {
      counter++;
      studentCode = `${pattern}${counter.toString().padStart(3, '0')}`;
    }

    return studentCode;
  } catch (error) {
    console.error('Error generating student code:', error);
    throw new Error('Failed to generate student code');
  }
};

/**
 * Validate student constraints
 */
export const validateStudentConstraints = async (schoolId, admissionNo, classId = null) => {
  try {
    // Check if admission number already exists
    const existingStudent = await prisma.student.findFirst({
      where: {
        admissionNo,
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (existingStudent) {
      throw new Error(`Student with admission number ${admissionNo} already exists`);
    }

    // Validate class exists and belongs to school
    if (classId) {
      const classData = await prisma.class.findFirst({
        where: {
          id: BigInt(classId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!classData) {
        throw new Error('Class not found or does not belong to this school');
      }
    }

    return true;
  } catch (error) {
    console.error('Error validating student constraints:', error);
    throw error;
  }
};

/**
 * Build student search query
 */
export const buildStudentSearchQuery = (filters) => {
  const query = {};

  // Search in student and user fields
  if (filters.search) {
    const searchTerm = filters.search.trim();
    query.OR = [
      {
        admissionNo: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      {
        rollNo: {
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
            }
          ]
        }
      }
    ];
  }

  // Filter by class
  if (filters.classId) {
    query.classId = filters.classId;
  }

  // Filter by section
  if (filters.sectionId) {
    query.sectionId = filters.sectionId;
  }

  // Filter by parent
  if (filters.parentId) {
    query.parentId = filters.parentId;
  }

  // Filter by status
  if (filters.status) {
    query.user = {
      ...query.user,
      status: filters.status
    };
  }

  // Filter by blood group
  if (filters.bloodGroup) {
    query.bloodGroup = filters.bloodGroup;
  }

  // Filter by nationality
  if (filters.nationality) {
    query.nationality = filters.nationality;
  }

  // Filter by religion
  if (filters.religion) {
    query.religion = filters.religion;
  }

  // Date range filters
  if (filters.admissionDateFrom || filters.admissionDateTo) {
    query.admissionDate = {};
    if (filters.admissionDateFrom) {
      query.admissionDate.gte = new Date(filters.admissionDateFrom);
    }
    if (filters.admissionDateTo) {
      query.admissionDate.lte = new Date(filters.admissionDateTo);
    }
  }

  return query;
};

/**
 * Build student include query
 */
export const buildStudentIncludeQuery = (include = []) => {
  const includeQuery = {};

  if (include.length === 0) {
    // Default includes - fetch all user fields
    includeQuery.user = {
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        emailVerified: true,
        phone: true,
        phoneVerified: true,
        // password: false, // Never include password for security
        // salt: false, // Never include salt for security
        firstName: true,
        middleName: true,
        lastName: true,
        displayName: true,
        gender: true,
        birthDate: true,
        avatar: true,
        coverImage: true,
        bio: true,
        role: true,
        status: true,
        lastLogin: true,
        lastIp: true,
        timezone: true,
        locale: true,
        metadata: true,
        schoolId: true,
        createdByOwnerId: true,
        createdBy: true,
        updatedBy: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true
      }
    };
    includeQuery.class = {
      select: {
        id: true,
        name: true,
        code: true
      }
    };
    includeQuery.section = {
      select: {
        id: true,
        name: true
      }
    };
    includeQuery.parent = {
      select: {
        id: true,
        user: {
          select: {
            id: true,
            uuid: true,
            username: true,
            email: true,
            emailVerified: true,
            phone: true,
            phoneVerified: true,
            // password: false, // Never include password for security
            // salt: false, // Never include salt for security
            firstName: true,
            middleName: true,
            lastName: true,
            displayName: true,
            gender: true,
            birthDate: true,
            avatar: true,
            coverImage: true,
            bio: true,
            role: true,
            status: true,
            lastLogin: true,
            lastIp: true,
            timezone: true,
            locale: true,
            metadata: true,
            schoolId: true,
            createdByOwnerId: true,
            createdBy: true,
            updatedBy: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true
          }
        }
      }
    };
    includeQuery.school = {
      select: {
        id: true,
        name: true,
        code: true
      }
    };
    includeQuery._count = {
      select: {
        attendances: true,
        grades: true,
        payments: true,
        documents: true,
        bookIssues: true,
        studentTransports: true,
        assignmentSubmissions: true
      }
    };
  } else {
    // Custom includes
    if (include.includes('user')) {
      includeQuery.user = true;
    }
    if (include.includes('class')) {
      includeQuery.class = true;
    }
    if (include.includes('section')) {
      includeQuery.section = true;
    }
    if (include.includes('parent')) {
      includeQuery.parent = {
        include: {
          user: true
        }
      };
    }
    if (include.includes('school')) {
      includeQuery.school = true;
    }
    if (include.includes('attendances')) {
      includeQuery.attendances = true;
    }
    if (include.includes('grades')) {
      includeQuery.grades = true;
    }
    if (include.includes('payments')) {
      includeQuery.payments = true;
    }
    if (include.includes('documents')) {
      includeQuery.documents = true;
    }
    if (include.includes('bookIssues')) {
      includeQuery.bookIssues = true;
    }
    if (include.includes('studentTransports')) {
      includeQuery.studentTransports = true;
    }
    if (include.includes('assignmentSubmissions')) {
      includeQuery.assignmentSubmissions = true;
    }
    if (include.includes('_count')) {
      includeQuery._count = {
        select: {
          attendances: true,
          grades: true,
          payments: true,
          documents: true,
          bookIssues: true,
          studentTransports: true,
          assignmentSubmissions: true
        }
      };
    }
  }

  return includeQuery;
};

/**
 * Generate student statistics
 */
export const generateStudentStats = async (studentId) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        class: true,
        section: true,
        parent: {
          include: {
            user: true
          }
        },
        attendances: true,
        grades: true,
        payments: true,
        documents: true,
        bookIssues: true,
        studentTransports: true,
        assignmentSubmissions: true
      }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate attendance statistics
    const totalAttendanceDays = student.attendances.length;
    const presentDays = student.attendances.filter(a => a.status === 'PRESENT').length;
    const absentDays = student.attendances.filter(a => a.status === 'ABSENT').length;
    const lateDays = student.attendances.filter(a => a.status === 'LATE').length;
    const attendanceRate = totalAttendanceDays > 0 ? (presentDays / totalAttendanceDays) * 100 : 0;

    // Calculate academic statistics
    const totalGrades = student.grades.length;
    const totalMarks = student.grades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0);
    const averageMarks = totalGrades > 0 ? totalMarks / totalGrades : 0;
    const passingGrades = student.grades.filter(grade => parseFloat(grade.marks) >= 40).length;
    const passRate = totalGrades > 0 ? (passingGrades / totalGrades) * 100 : 0;

    // Calculate financial statistics
    const totalPayments = student.payments.length;
    const totalPaid = student.payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    const pendingPayments = student.payments.filter(p => p.status === 'PENDING').length;

    // Calculate other statistics
    const totalDocuments = student.documents.length;
    const totalBookIssues = student.bookIssues.length;
    const activeBookIssues = student.bookIssues.filter(b => !b.returnDate).length;
    const totalTransports = student.studentTransports.length;
    const totalAssignments = student.assignmentSubmissions.length;

    return {
      student: {
        id: student.id,
        admissionNo: student.admissionNo,
        rollNo: student.rollNo,
        name: `${student.user.firstName} ${student.user.lastName}`,
        email: student.user.email,
        status: student.user.status
      },
      class: student.class ? {
        id: student.class.id,
        name: student.class.name,
        code: student.class.code
      } : null,
      section: student.section ? {
        id: student.section.id,
        name: student.section.name
      } : null,
      parent: student.parent ? {
        id: student.parent.id,
        name: `${student.parent.user.firstName} ${student.parent.user.lastName}`,
        email: student.parent.user.email
      } : null,
      attendance: {
        total: totalAttendanceDays,
        present: presentDays,
        absent: absentDays,
        late: lateDays,
        rate: Math.round(attendanceRate * 100) / 100
      },
      academic: {
        totalGrades: totalGrades,
        averageMarks: Math.round(averageMarks * 100) / 100,
        passingGrades: passingGrades,
        passRate: Math.round(passRate * 100) / 100
      },
      financial: {
        totalPayments: totalPayments,
        totalPaid: totalPaid,
        pendingPayments: pendingPayments
      },
      other: {
        documents: totalDocuments,
        bookIssues: totalBookIssues,
        activeBookIssues: activeBookIssues,
        transports: totalTransports,
        assignments: totalAssignments
      }
    };
  } catch (error) {
    console.error('Error generating student stats:', error);
    throw error;
  }
};

/**
 * Generate student analytics
 */
export const generateStudentAnalytics = async (studentId, period = '30d') => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        attendances: {
          where: {
            date: {
              gte: getDateFromPeriod(period)
            }
          }
        },
        grades: {
          where: {
            createdAt: {
              gte: getDateFromPeriod(period)
            }
          }
        },
        payments: {
          where: {
            createdAt: {
              gte: getDateFromPeriod(period)
            }
          }
        }
      }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Attendance analytics
    const attendanceAnalytics = analyzeAttendance(student.attendances, period);

    // Academic analytics
    const academicAnalytics = analyzeAcademicPerformance(student.grades, period);

    // Financial analytics
    const financialAnalytics = analyzeFinancialStatus(student.payments, period);

    return {
      studentId,
      period,
      attendance: attendanceAnalytics,
      academic: academicAnalytics,
      financial: financialAnalytics,
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating student analytics:', error);
    throw error;
  }
};

/**
 * Calculate student performance
 */
export const calculateStudentPerformance = async (studentId) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        user: true,
        class: true,
        attendances: true,
        grades: true,
        payments: true
      }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Calculate attendance score
    const attendanceScore = calculateAttendanceScore(student.attendances);

    // Calculate academic score
    const academicScore = calculateAcademicScore(student.grades);

    // Calculate financial score
    const financialScore = calculateFinancialScore(student.payments);

    // Calculate overall performance score
    const overallScore = (attendanceScore * 0.3) + (academicScore * 0.5) + (financialScore * 0.2);

    // Get performance grade
    const performanceGrade = getPerformanceGrade(overallScore);

    return {
      studentId,
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      class: student.class ? student.class.name : 'Not Assigned',
      scores: {
        attendance: Math.round(attendanceScore * 100) / 100,
        academic: Math.round(academicScore * 100) / 100,
        financial: Math.round(financialScore * 100) / 100,
        overall: Math.round(overallScore * 100) / 100
      },
      grade: performanceGrade,
      analysis: {
        attendanceRate: calculateAttendanceRate(student.attendances),
        averageMarks: calculateAverageMarks(student.grades),
        paymentCompliance: calculatePaymentCompliance(student.payments)
      },
      generatedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error calculating student performance:', error);
    throw error;
  }
};

/**
 * Generate student export data
 */
export const generateStudentExportData = async (students, format = 'json') => {
  try {
    if (format === 'csv') {
      // Generate CSV format
      const headers = [
        'ID', 'Admission No', 'Roll No', 'First Name', 'Last Name', 'Email',
        'Phone', 'Class', 'Section', 'Parent', 'Blood Group', 'Nationality',
        'Religion', 'Admission Date', 'Status', 'Created At'
      ];

      const rows = students.map(student => [
        student.id,
        student.admissionNo,
        student.rollNo || '',
        student.user.firstName,
        student.user.lastName,
        student.user.email,
        student.user.phone || '',
        student.class ? student.class.name : '',
        student.section ? student.section.name : '',
        student.parent ? `${student.parent.user.firstName} ${student.parent.user.lastName}` : '',
        student.bloodGroup || '',
        student.nationality || '',
        student.religion || '',
        student.admissionDate ? new Date(student.admissionDate).toISOString().split('T')[0] : '',
        student.user.status,
        new Date(student.createdAt).toISOString()
      ]);

      return [headers, ...rows].map(row => row.join(',')).join('\n');
    } else {
      // Return JSON format
      return students.map(student => ({
        id: student.id,
        admissionNo: student.admissionNo,
        rollNo: student.rollNo,
        user: {
          firstName: student.user.firstName,
          lastName: student.user.lastName,
          email: student.user.email,
          phone: student.user.phone,
          status: student.user.status
        },
        class: student.class ? {
          id: student.class.id,
          name: student.class.name,
          code: student.class.code
        } : null,
        section: student.section ? {
          id: student.section.id,
          name: student.section.name
        } : null,
        parent: student.parent ? {
          id: student.parent.id,
          name: `${student.parent.user.firstName} ${student.parent.user.lastName}`,
          email: student.parent.user.email
        } : null,
        bloodGroup: student.bloodGroup,
        nationality: student.nationality,
        religion: student.religion,
        admissionDate: student.admissionDate,
        createdAt: student.createdAt
      }));
    }
  } catch (error) {
    console.error('Error generating student export data:', error);
    throw error;
  }
};

/**
 * Validate student import data
 */
export const validateStudentImportData = (students) => {
  const errors = [];
  const validStudents = [];

  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const studentErrors = [];

    // Validate required fields
    if (!student.user?.firstName) {
      studentErrors.push('First name is required');
    }
    if (!student.user?.lastName) {
      studentErrors.push('Last name is required');
    }
    if (!student.user?.email) {
      studentErrors.push('Email is required');
    }
    if (!student.schoolId) {
      studentErrors.push('School ID is required');
    }

    // Validate email format
    if (student.user?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.user.email)) {
      studentErrors.push('Invalid email format');
    }

    // Validate phone format
    if (student.user?.phone && !/^\+?[\d\s\-\(\)]+$/.test(student.user.phone)) {
      studentErrors.push('Invalid phone format');
    }

    if (studentErrors.length > 0) {
      errors.push({
        index: i,
        student: student,
        errors: studentErrors
      });
    } else {
      validStudents.push(student);
    }
  }

  return {
    isValid: errors.length === 0,
    validStudents,
    errors
  };
};

/**
 * Generate student code suggestions
 */
export const generateStudentCodeSuggestions = async (name, schoolId) => {
  try {
    const suggestions = [];
    
    if (!name || !schoolId) {
      return suggestions;
    }

    // Get school code
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { code: true }
    });

    if (!school) {
      return suggestions;
    }

    const schoolCode = school.code;
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const nameParts = name.split(' ').filter(part => part.length > 0);

    // Generate different patterns
    if (nameParts.length >= 2) {
      const initials = (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
      suggestions.push(`${schoolCode}${initials}${currentYear}001`);
      suggestions.push(`${schoolCode}${initials}${currentYear}002`);
      suggestions.push(`${schoolCode}${initials}${currentYear}003`);
    } else if (nameParts.length === 1) {
      const initials = nameParts[0].substring(0, 2).toUpperCase();
      suggestions.push(`${schoolCode}${initials}${currentYear}001`);
      suggestions.push(`${schoolCode}${initials}${currentYear}002`);
      suggestions.push(`${schoolCode}${initials}${currentYear}003`);
    }

    return suggestions;
  } catch (error) {
    console.error('Error generating student code suggestions:', error);
    return [];
  }
};

/**
 * Get student count by class
 */
export const getStudentCountByClass = async (schoolId) => {
  try {
    const where = { deletedAt: null };
    if (schoolId) where.schoolId = schoolId;

    const counts = await prisma.student.groupBy({
      by: ['classId'],
      where,
      _count: {
        id: true
      }
    });

    const classDetails = await prisma.class.findMany({
      where: {
        id: {
          in: counts.map(c => c.classId).filter(id => id !== null)
        }
      },
      select: {
        id: true,
        name: true,
        code: true
      }
    });

    return counts.map(count => ({
      classId: count.classId,
      count: count._count.id,
      class: classDetails.find(c => c.id === count.classId) || null
    }));
  } catch (error) {
    console.error('Error getting student count by class:', error);
    throw error;
  }
};

/**
 * Get student count by status
 */
export const getStudentCountByStatus = async (schoolId) => {
  try {
    const where = { deletedAt: null };
    if (schoolId) where.schoolId = schoolId;

    const counts = await prisma.student.groupBy({
      by: ['userId'],
      where,
      _count: {
        id: true
      }
    });

    const userIds = counts.map(c => c.userId);
    
    const userStatuses = await prisma.user.findMany({
      where: {
        id: {
          in: userIds
        }
      },
      select: {
        id: true,
        status: true
      }
    });

    const statusCounts = {};
    userStatuses.forEach(user => {
      statusCounts[user.status] = (statusCounts[user.status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));
  } catch (error) {
    console.error('Error getting student count by status:', error);
    throw error;
  }
};

/**
 * Get aggregate student statistics
 */
export const getAggregateStudentStats = async (schoolId = null) => {
  const where = { deletedAt: null };
  if (schoolId) where.schoolId = schoolId;

  // Get all students with user relation (for gender, status, age)
  const students = await prisma.student.findMany({
    where,
    include: {
      user: true
    }
  });

  // Total students
  const totalStudents = students.length;

  // Gender breakdown
  const genderCounts = {
    MALE: 0,
    FEMALE: 0,
    OTHER: 0,
    PREFER_NOT_TO_SAY: 0
  };
  students.forEach(s => {
    const gender = s.user?.gender || 'PREFER_NOT_TO_SAY';
    if (genderCounts[gender] !== undefined) genderCounts[gender]++;
    else genderCounts['PREFER_NOT_TO_SAY']++;
  });

  // Status breakdown
  const statusCounts = {
    ACTIVE: 0,
    INACTIVE: 0,
    SUSPENDED: 0,
    GRADUATED: 0,
    TRANSFERRED: 0
  };
  students.forEach(s => {
    const status = s.user?.status || 'INACTIVE';
    if (statusCounts[status] !== undefined) statusCounts[status]++;
    else statusCounts['INACTIVE']++;
  });

  // Age distribution (optional)
  const ageDistribution = {
    '5-10': 0,
    '11-15': 0,
    '16-20': 0,
    '21+': 0
  };
  const now = new Date();
  students.forEach(s => {
    if (s.user?.dateOfBirth) {
      const age = now.getFullYear() - new Date(s.user.dateOfBirth).getFullYear();
      if (age <= 10) ageDistribution['5-10']++;
      else if (age <= 15) ageDistribution['11-15']++;
      else if (age <= 20) ageDistribution['16-20']++;
      else ageDistribution['21+']++;
    }
  });

  return {
    totalStudents,
    genderCounts,
    statusCounts,
    ageDistribution
  };
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
  const total = attendances.length;
  const present = attendances.filter(a => a.status === 'PRESENT').length;
  const absent = attendances.filter(a => a.status === 'ABSENT').length;
  const late = attendances.filter(a => a.status === 'LATE').length;

  return {
    total,
    present,
    absent,
    late,
    attendanceRate: total > 0 ? (present / total) * 100 : 0,
    period
  };
}

function analyzeAcademicPerformance(grades, period) {
  const total = grades.length;
  const totalMarks = grades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0);
  const averageMarks = total > 0 ? totalMarks / total : 0;
  const passingGrades = grades.filter(grade => parseFloat(grade.marks) >= 40).length;
  const passRate = total > 0 ? (passingGrades / total) * 100 : 0;

  return {
    total,
    totalMarks,
    averageMarks,
    passingGrades,
    passRate,
    period
  };
}

function analyzeFinancialStatus(payments, period) {
  const total = payments.length;
  const totalPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  const pendingPayments = payments.filter(p => p.status === 'PENDING').length;
  const completedPayments = payments.filter(p => p.status === 'COMPLETED').length;

  return {
    total,
    totalPaid,
    pendingPayments,
    completedPayments,
    completionRate: total > 0 ? (completedPayments / total) * 100 : 0,
    period
  };
}

function calculateAttendanceScore(attendances) {
  const total = attendances.length;
  if (total === 0) return 0;

  const present = attendances.filter(a => a.status === 'PRESENT').length;
  const late = attendances.filter(a => a.status === 'LATE').length;
  
  // Present = 1.0, Late = 0.7, Absent = 0.0
  return ((present + (late * 0.7)) / total) * 100;
}

function calculateAcademicScore(grades) {
  const total = grades.length;
  if (total === 0) return 0;

  const totalMarks = grades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0);
  const averageMarks = totalMarks / total;
  
  // Convert to percentage score (assuming max marks is 100)
  return Math.min(averageMarks, 100);
}

function calculateFinancialScore(payments) {
  const total = payments.length;
  if (total === 0) return 100; // No payments means good financial standing

  const completed = payments.filter(p => p.status === 'COMPLETED').length;
  return (completed / total) * 100;
}

function calculateAttendanceRate(attendances) {
  const total = attendances.length;
  if (total === 0) return 0;

  const present = attendances.filter(a => a.status === 'PRESENT').length;
  return (present / total) * 100;
}

function calculateAverageMarks(grades) {
  const total = grades.length;
  if (total === 0) return 0;

  const totalMarks = grades.reduce((sum, grade) => sum + parseFloat(grade.marks), 0);
  return totalMarks / total;
}

function calculatePaymentCompliance(payments) {
  const total = payments.length;
  if (total === 0) return 100;

  const completed = payments.filter(p => p.status === 'COMPLETED').length;
  return (completed / total) * 100;
}

function getPerformanceGrade(score) {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  if (score >= 30) return 'D';
  return 'F';
} 

import { z } from 'zod';

// ======================
// USER VALIDATION SCHEMAS
// ======================

/**
 * User creation schema (flat format)
 */
export const UserCreateSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
    .trim(),
  
  email: z.string()
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .trim(),
  
  firstName: z.string()
    .min(1, 'First name is required')
    .max(100, 'First name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes')
    .trim(),
  
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be less than 100 characters')
    .regex(/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes')
    .trim(),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(255, 'Password must be less than 255 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  phone: z.string()
    .optional()
    .refine((val) => !val || /^[\+]?[1-9][\d]{0,15}$/.test(val), 'Invalid phone number format')
    .transform((val) => val?.trim()),
  
  dateOfBirth: z.string()
    .datetime()
    .optional()
    .refine((val) => !val || new Date(val) < new Date(), 'Date of birth must be in the past'),
  
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])
    .optional(),
  
  address: z.object({
    street: z.string().min(5, 'Street address must be at least 5 characters').max(255).trim(),
    city: z.string().min(2, 'City must be at least 2 characters').max(100).trim(),
    state: z.string().min(2, 'State must be at least 2 characters').max(100).trim(),
    country: z.string().min(2, 'Country must be at least 2 characters').max(100).trim(),
    postalCode: z.string().min(3, 'Postal code must be at least 3 characters').max(20).trim(),
  }).optional(),
  
  emergencyContact: z.object({
    name: z.string().min(2, 'Emergency contact name must be at least 2 characters').max(100).trim(),
    relationship: z.string().min(2, 'Relationship must be at least 2 characters').max(50).trim(),
    phone: z.string().min(10, 'Emergency contact phone must be at least 10 characters').max(20).trim(),
    email: z.string().email('Invalid emergency contact email').optional(),
  }).optional(),
  
  role: z.enum(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'STAFF', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'CRM_MANAGER'])
    .default('STUDENT'),
  
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'TRANSFERRED'])
    .default('ACTIVE'),
  
  schoolId: z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
  classId: z.number().int().positive().optional(),
  
  // Academic information
  admissionDate: z.string().datetime().optional(),
  graduationDate: z.string().datetime().optional(),
  studentId: z.string().max(50).optional(),
  rollNumber: z.string().max(50).optional(),
  
  // Teacher specific
  qualification: z.string().max(255).optional(),
  experience: z.number().int().min(0).max(50).optional(),
  specialization: z.string().max(255).optional(),
  
  // Staff specific
  designation: z.string().max(100).optional(),
  employeeId: z.string().max(50).optional(),
  joiningDate: z.string().datetime().optional(),
  
  // Parent specific
  children: z.array(z.number().int().positive()).optional(),
  
  // Profile information
  profilePicture: z.string().url('Invalid profile picture URL').optional(),
  bio: z.string().max(500, 'Bio must be less than 500 characters').optional(),
  
  // Settings
  timezone: z.string().default('UTC').transform((val) => val?.trim()),
  locale: z.string().default('en-US').transform((val) => val?.trim()),
  preferences: z.record(z.any()).optional(),
  
  // Metadata
  metadata: z.record(z.any()).optional(),
  
  // Required fields
  createdByOwnerId: z.number().int().positive(),
});

/**
 * User creation schema (nested format)
 */
export const UserCreateNestedSchema = z.object({
  user: UserCreateSchema,
  staff: z.object({
    departmentId: z.number().int().positive(),
    employeeId: z.string().max(50),
    designation: z.string().max(100),
    joiningDate: z.string().datetime().optional(),
    salary: z.number().positive().optional(),
    accountNumber: z.string().max(50).optional(),
    bankName: z.string().max(100).optional(),
    ifscCode: z.string().max(20).optional(),
  }).optional(),
  teacher: z.object({
    departmentId: z.number().int().positive(),
    employeeId: z.string().max(50),
    qualification: z.string().max(255).optional(),
    specialization: z.string().max(255).optional(),
    joiningDate: z.string().datetime().optional(),
    experience: z.number().int().min(0).max(50).optional(),
    salary: z.number().positive().optional(),
    isClassTeacher: z.boolean().default(false),
  }).optional(),
});

/**
 * User update schema
 */
export const UserUpdateSchema = UserCreateSchema.partial().extend({
  id: z.number().int().positive(),
  password: z.string().optional(), // Make password optional for updates
});

/**
 * User search schema
 */
export const UserSearchSchema = z.object({
  // Pagination
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  
  // Sorting
  sortBy: z.enum(['username', 'email', 'firstName', 'lastName', 'role', 'status', 'createdAt', 'updatedAt', 'lastLogin']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Filtering
  search: z.string().optional().transform((val) => val?.trim()),
  username: z.string().optional().transform((val) => val?.trim()),
  email: z.string().optional().transform((val) => val?.trim()),
  firstName: z.string().optional().transform((val) => val?.trim()),
  lastName: z.string().optional().transform((val) => val?.trim()),
  role: z.enum(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'STAFF', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'CRM_MANAGER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'GRADUATED', 'TRANSFERRED']).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  schoolId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  classId: z.coerce.number().int().positive().optional(),
  createdByOwnerId: z.coerce.number().int().positive().optional(),
  
  // Date filters
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  lastLoginAfter: z.string().datetime().optional(),
  lastLoginBefore: z.string().datetime().optional(),
  admissionDateAfter: z.string().datetime().optional(),
  admissionDateBefore: z.string().datetime().optional(),
  
  // Include relations
  include: z.string().optional().transform((val) => 
    val ? val.split(',').map(item => item.trim()) : []
  ),
});

/**
 * User bulk create schema
 */
export const UserBulkCreateSchema = z.object({
  users: z.array(UserCreateSchema).min(1).max(100),
  options: z.object({
    skipDuplicates: z.boolean().default(true),
    generatePasswords: z.boolean().default(false),
    sendWelcomeEmail: z.boolean().default(false),
    assignDefaultRole: z.boolean().default(true),
  }).optional(),
  user: z.object({
    id: z.number().int().positive(),
    role: z.string(),
  }).optional(),
});

/**
 * User bulk update schema
 */
export const UserBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int().positive(),
    data: UserUpdateSchema.omit({ id: true }),
  })).min(1).max(100),
  options: z.object({
    validateOnly: z.boolean().default(false),
    sendNotifications: z.boolean().default(true),
  }).optional(),
  user: z.object({
    id: z.number().int().positive(),
    role: z.string(),
  }).optional(),
});

/**
 * User import schema
 */
export const UserImportSchema = z.object({
  data: z.array(z.record(z.any())).min(1).max(1000),
  options: z.object({
    skipDuplicates: z.boolean().default(true),
    updateExisting: z.boolean().default(false),
    validateOnly: z.boolean().default(false),
    generatePasswords: z.boolean().default(false),
    sendWelcomeEmail: z.boolean().default(false),
    defaultRole: z.enum(['STUDENT', 'TEACHER', 'STAFF', 'PARENT']).default('STUDENT'),
  }).optional(),
  user: z.object({
    id: z.number().int().positive(),
    role: z.string(),
  }).optional(),
});

/**
 * User export schema
 */
export const UserExportSchema = z.object({
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json'),
  filters: UserSearchSchema.omit({ page: true, limit: true }).optional(),
  fields: z.array(z.string()).optional(),
  includeRelations: z.boolean().default(false),
  includeSensitiveData: z.boolean().default(false),
});

/**
 * User analytics schema
 */
export const UserAnalyticsSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y', 'all']).default('30d'),
  metrics: z.array(z.enum(['registration', 'activity', 'performance', 'attendance', 'payments'])).optional(),
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year', 'role', 'status']).optional(),
  schoolId: z.number().int().positive().optional(),
});

/**
 * User performance schema
 */
export const UserPerformanceSchema = z.object({
  academicYear: z.string().optional(),
  term: z.string().optional(),
  metrics: z.array(z.enum(['academic', 'attendance', 'behavior', 'extracurricular', 'overall'])).optional(),
  includeComparisons: z.boolean().default(true),
});

/**
 * User authentication schema
 */
export const UserAuthSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.union([z.string(), z.number()]).transform(val => String(val)).pipe(z.string().min(1, 'Password is required')),
  rememberMe: z.boolean().default(false),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    deviceType: z.string().optional(),
  }).optional(),
});

/**
 * User password change schema
 */
export const UserPasswordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * User profile update schema
 */
export const UserProfileUpdateSchema = UserCreateSchema.pick({
  firstName: true,
  lastName: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  address: true,
  emergencyContact: true,
  profilePicture: true,
  bio: true,
  timezone: true,
  locale: true,
  preferences: true,
}).partial();

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Generate username from name
 */
export const generateUsername = (firstName, lastName) => {
  if (!firstName || !lastName) return null;
  
  const base = `${firstName.toLowerCase()}${lastName.toLowerCase()}`;
  const clean = base.replace(/[^a-z0-9]/g, '');
  
  return clean.substring(0, 20);
};

/**
 * Generate student ID
 */
export const generateStudentId = (schoolCode, year, sequence) => {
  const yearStr = year.toString().slice(-2);
  const sequenceStr = sequence.toString().padStart(4, '0');
  return `${schoolCode}${yearStr}${sequenceStr}`;
};

/**
 * Generate roll number
 */
export const generateRollNumber = (classId, sequence) => {
  return `${classId.toString().padStart(3, '0')}${sequence.toString().padStart(3, '0')}`;
};

/**
 * Format phone number
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }
  
  if (!phone.startsWith('+')) {
    return `+${cleaned}`;
  }
  
  return phone;
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password) => {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[@$!%*?&]/.test(password),
  };
  
  const score = Object.values(checks).filter(Boolean).length;
  
  return {
    isValid: score >= 4,
    score,
    checks,
    strength: score < 2 ? 'weak' : score < 4 ? 'medium' : 'strong',
  };
};

/**
 * Generate user statistics
 */
export const generateUserStats = (user) => {
  return {
    totalSessions: user.sessions?.length || 0,
    totalDocuments: user.documents?.length || 0,
    totalMessages: user.sentMessages?.length || 0,
    totalReceivedMessages: user.receivedMessages?.length || 0,
    totalPayments: user.payments?.length || 0,
    totalAttendance: user.attendance?.length || 0,
    totalGrades: user.grades?.length || 0,
    totalAssignments: user.assignments?.length || 0,
    totalSubmissions: user.submissions?.length || 0,
    activeSessions: user.sessions?.filter(s => s.status === 'ACTIVE').length || 0,
    activeDocuments: user.documents?.filter(d => d.status === 'ACTIVE').length || 0,
  };
};

/**
 * Generate user analytics
 */
export const generateUserAnalytics = (user, period = '30d') => {
  return {
    period,
    activity: {
      loginFrequency: 0, // Would calculate from sessions
      lastActive: user.lastLogin,
      averageSessionDuration: 0, // Would calculate from sessions
    },
    academic: {
      attendanceRate: 0, // Would calculate from attendance
      averageGrade: 0, // Would calculate from grades
      completedAssignments: 0, // Would calculate from submissions
    },
    financial: {
      totalPaid: 0, // Would calculate from payments
      outstandingAmount: 0, // Would calculate from payments
      paymentHistory: [], // Would get from payments
    },
    engagement: {
      messagesSent: user.sentMessages?.length || 0,
      messagesReceived: user.receivedMessages?.length || 0,
      documentsUploaded: user.documents?.length || 0,
    },
  };
};

/**
 * Build user search query
 */
export const buildUserSearchQuery = (filters) => {
  const where = {};
  
  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { studentId: { contains: filters.search, mode: 'insensitive' } },
      { rollNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }
  
  if (filters.username) {
    where.username = { contains: filters.username, mode: 'insensitive' };
  }
  
  if (filters.email) {
    where.email = { contains: filters.email, mode: 'insensitive' };
  }
  
  if (filters.firstName) {
    where.firstName = { contains: filters.firstName, mode: 'insensitive' };
  }
  
  if (filters.lastName) {
    where.lastName = { contains: filters.lastName, mode: 'insensitive' };
  }
  
  if (filters.role) {
    where.role = filters.role;
  }
  
  if (filters.status) {
    where.status = filters.status;
  }
  
  if (filters.gender) {
    where.gender = filters.gender;
  }
  
  if (filters.schoolId) {
    where.schoolId = BigInt(filters.schoolId);
  }
  
  if (filters.departmentId) {
    where.departmentId = BigInt(filters.departmentId);
  }
  
  if (filters.classId) {
    where.classId = BigInt(filters.classId);
  }
  
  if (filters.createdByOwnerId) {
    where.createdByOwnerId = BigInt(filters.createdByOwnerId);
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
  
  if (filters.lastLoginAfter) {
    where.lastLogin = { ...where.lastLogin, gte: new Date(filters.lastLoginAfter) };
  }
  
  if (filters.lastLoginBefore) {
    where.lastLogin = { ...where.lastLogin, lte: new Date(filters.lastLoginBefore) };
  }
  
  if (filters.admissionDateAfter) {
    where.admissionDate = { ...where.admissionDate, gte: new Date(filters.admissionDateAfter) };
  }
  
  if (filters.admissionDateBefore) {
    where.admissionDate = { ...where.admissionDate, lte: new Date(filters.admissionDateBefore) };
  }
  
  // Always exclude deleted users unless specifically requested
  where.deletedAt = null;
  
  return where;
};

/**
 * Build user include query
 */
export const buildUserIncludeQuery = (include = []) => {
  const includeQuery = {};
  
  if (include.includes('school')) {
    includeQuery.school = true;
  }
  
  // Department is linked through Staff/Teacher models, not directly to User
  // if (include.includes('department')) {
  //   includeQuery.department = true;
  // }
  
  if (include.includes('class')) {
    includeQuery.class = true;
  }
  
  if (include.includes('sessions')) {
    includeQuery.sessions = {
      where: { status: 'ACTIVE' },
      take: 10,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  if (include.includes('documents')) {
    includeQuery.documents = {
      where: { deletedAt: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  if (include.includes('payments')) {
    includeQuery.payments = {
      where: { deletedAt: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  if (include.includes('attendance')) {
    includeQuery.attendance = {
      where: { deletedAt: null },
      take: 50,
      orderBy: { date: 'desc' },
    };
  }
  
  if (include.includes('grades')) {
    includeQuery.grades = {
      where: { deletedAt: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  if (include.includes('assignments')) {
    includeQuery.assignments = {
      where: { deletedAt: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  if (include.includes('submissions')) {
    includeQuery.submissions = {
      where: { deletedAt: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  if (include.includes('sentMessages')) {
    includeQuery.sentMessages = {
      where: { deletedAt: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  if (include.includes('receivedMessages')) {
    includeQuery.receivedMessages = {
      where: { deletedAt: null },
      take: 20,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  if (include.includes('auditLogs')) {
    includeQuery.auditLogs = {
      take: 20,
      orderBy: { createdAt: 'desc' },
    };
  }
  
  return includeQuery;
};

/**
 * Generate user export data
 */
export const generateUserExportData = (users, format = 'json', includeSensitiveData = false) => {
  const exportUsers = users.map(user => {
    const exportUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      gender: user.gender,
      phone: user.phone,
      dateOfBirth: user.dateOfBirth,
      admissionDate: user.admissionDate,
      graduationDate: user.graduationDate,
      studentId: user.studentId,
      rollNumber: user.rollNumber,
      qualification: user.qualification,
      experience: user.experience,
      specialization: user.specialization,
      designation: user.designation,
      joiningDate: user.joiningDate,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    
    if (includeSensitiveData) {
      exportUser.address = user.address;
      exportUser.emergencyContact = user.emergencyContact;
      exportUser.metadata = user.metadata;
    }
    
    return exportUser;
  });
  
  switch (format) {
    case 'json':
      return exportUsers;
    
    case 'csv':
      const headers = Object.keys(exportUsers[0] || {});
      const csvData = exportUsers.map(user => 
        headers.map(header => {
          const value = user[header];
          return typeof value === 'object' ? JSON.stringify(value) : value;
        }).join(',')
      );
      return [headers.join(','), ...csvData].join('\n');
    
    case 'xlsx':
      return exportUsers;
    
    case 'pdf':
      return exportUsers;
    
    default:
      return exportUsers;
  }
};

/**
 * Validate user import data
 */
export const validateUserImportData = (data) => {
  const results = {
    valid: [],
    invalid: [],
    errors: [],
  };
  
  data.forEach((row, index) => {
    try {
      const validated = UserCreateSchema.parse(row);
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
 * Generate username suggestions
 */
export const generateUsernameSuggestions = (firstName, lastName) => {
  if (!firstName || !lastName) return [];
  
  const base = generateUsername(firstName, lastName);
  const suggestions = [base];
  
  // Add variations
  for (let i = 1; i <= 5; i++) {
    suggestions.push(`${base}${i}`);
  }
  
  // Add year variations
  const currentYear = new Date().getFullYear();
  suggestions.push(`${base}${currentYear}`);
  
  return suggestions.slice(0, 5);
};

/**
 * Calculate user performance
 */
export const calculateUserPerformance = (user) => {
  return {
    academic: {
      score: 0,
      grade: 'N/A',
      trend: 0,
      attendanceRate: 0,
    },
    engagement: {
      score: 0,
      loginFrequency: 0,
      messageActivity: 0,
    },
    financial: {
      score: 0,
      paymentCompliance: 0,
      outstandingAmount: 0,
    },
    overall: {
      score: 0,
      grade: 'N/A',
      rank: 0,
    },
  };
}; 
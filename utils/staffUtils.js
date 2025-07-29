import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';
import { 
  generateUUID, 
  hashPassword, 
  generateSalt,
  formatResponse,
  createAuditLog
} from './responseUtils.js';
import { 
  validateEmail, 
  validatePhone, 
  sanitizeString 
} from '../middleware/validation.js';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const StaffCreateSchema = z.object({
  // User fields
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/, 'Username must contain only letters, numbers, and underscores'),
  email: z.string().email('Invalid email format'),
  phone: z.string().optional().refine(val => !val || validatePhone(val), 'Invalid phone number format'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  firstName: z.string().min(2).max(50).regex(/^[a-zA-Z\s]+$/, 'First name must contain only letters and spaces'),
  middleName: z.string().max(50).regex(/^[a-zA-Z\s]*$/, 'Middle name must contain only letters and spaces').optional(),
  lastName: z.string().min(2).max(50).regex(/^[a-zA-Z\s]+$/, 'Last name must contain only letters and spaces'),
  displayName: z.string().max(100).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  birthDate: z.string().datetime().optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(255).optional(),
  
  // Staff specific fields
  employeeId: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/, 'Employee ID must contain only uppercase letters, numbers, underscores, and hyphens'),
  departmentId: z.number().int().positive().optional(),
  designation: z.string().min(2).max(100),
  joiningDate: z.string().datetime().optional(),
  salary: z.number().positive().optional(),
  accountNumber: z.string().max(30).regex(/^[0-9]+$/, 'Account number must contain only numbers').optional(),
  bankName: z.string().max(100).optional(),
  ifscCode: z.string().max(20).regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').optional(),
  
  // System fields
  schoolId: z.number().int().positive(),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en-US'),
  metadata: z.record(z.any()).optional()
});

export const StaffUpdateSchema = z.object({
  // User fields
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional().refine(val => !val || validatePhone(val), 'Invalid phone number format'),
  firstName: z.string().min(2).max(50).regex(/^[a-zA-Z\s]+$/, 'First name must contain only letters and spaces').optional(),
  middleName: z.string().max(50).regex(/^[a-zA-Z\s]*$/, 'Middle name must contain only letters and spaces').optional(),
  lastName: z.string().min(2).max(50).regex(/^[a-zA-Z\s]+$/, 'Last name must contain only letters and spaces').optional(),
  displayName: z.string().max(100).optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  birthDate: z.string().datetime().optional(),
  avatar: z.string().url().optional(),
  bio: z.string().max(255).optional(),
  
  // Staff specific fields
  employeeId: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/, 'Employee ID must contain only uppercase letters, numbers, underscores, and hyphens').optional(),
  departmentId: z.number().int().positive().optional(),
  designation: z.string().min(2).max(100).optional(),
  joiningDate: z.string().datetime().optional(),
  salary: z.number().positive().optional(),
  accountNumber: z.string().max(30).regex(/^[0-9]+$/, 'Account number must contain only numbers').optional(),
  bankName: z.string().max(100).optional(),
  ifscCode: z.string().max(20).regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').optional(),
  
  // System fields
  timezone: z.string().optional(),
  locale: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

export const StaffSearchSchema = z.object({
  // Search filters
  id: z.preprocess(val => (val === '' ? undefined : val), z.number().int().positive().optional()),
  search: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  employeeId: z.string().optional(),
  designation: z.string().optional(),
  departmentId: z.number().int().positive().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  
  // Salary filters
  minSalary: z.number().positive().optional(),
  maxSalary: z.number().positive().optional(),
  salaryRange: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  
  // Date filters
  joiningDateAfter: z.string().datetime().optional(),
  joiningDateBefore: z.string().datetime().optional(),
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  
  // Status filters
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  
  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'employeeId', 'designation', 'salary', 'joiningDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Include relations
  include: z.string().optional(),
  
  // School filter
  schoolId: z.number().int().positive().optional()
});

export const StaffBulkCreateSchema = z.object({
  staff: z.array(StaffCreateSchema).min(1).max(100),
  skipDuplicates: z.boolean().default(false)
});

export const StaffBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int().positive(),
    data: StaffUpdateSchema
  })).min(1).max(100)
});

export const StaffBulkDeleteSchema = z.object({
  staffIds: z.array(z.number().int().positive()).min(1).max(100)
});

// ======================
// HELPER FUNCTIONS
// ======================

export const generateEmployeeId = async (schoolId, designation) => {
  const prefix = designation.split(' ').map(word => word.charAt(0)).join('').toUpperCase();
  const existingCount = await prisma.staff.count({
    where: {
      schoolId,
      designation: { contains: designation.split(' ')[0] }
    }
  });
  
  return `${prefix}${String(existingCount + 1).padStart(4, '0')}`;
};

export const calculateSalaryRange = (salary) => {
  if (!salary) return 'UNKNOWN';
  if (salary < 30000) return 'LOW';
  if (salary < 80000) return 'MEDIUM';
  return 'HIGH';
};

export const calculateExperience = (joiningDate) => {
  if (!joiningDate) return 0;
  const joinDate = new Date(joiningDate);
  const now = new Date();
  const diffTime = Math.abs(now - joinDate);
  const diffYears = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 365));
  return diffYears;
};

export const validateStaffData = async (data, schoolId, excludeId = null) => {
  const errors = [];
  
  // Check for duplicate email
  const emailWhere = {
    email: data.email,
    schoolId
  };
  if (excludeId !== null && excludeId !== undefined) {
    emailWhere.id = { not: excludeId };
  }
  const existingEmail = await prisma.user.findFirst({
    where: emailWhere
  });
  
  if (existingEmail) {
    errors.push('Email already exists');
  }
  
  // Check for duplicate username
  const usernameWhere = {
    username: data.username,
    schoolId
  };
  if (excludeId !== null && excludeId !== undefined) {
    usernameWhere.id = { not: excludeId };
  }
  const existingUsername = await prisma.user.findFirst({
    where: usernameWhere
  });
  
  if (existingUsername) {
    errors.push('Username already exists');
  }
  
  // Check for duplicate employee ID
  const employeeIdWhere = {
    employeeId: data.employeeId,
    schoolId
  };
  if (excludeId !== null && excludeId !== undefined) {
    employeeIdWhere.id = { not: excludeId };
  }
  const existingEmployeeId = await prisma.staff.findFirst({
    where: employeeIdWhere
  });
  
  if (existingEmployeeId) {
    errors.push('Employee ID already exists');
  }
  
  // Check for duplicate phone
  if (data.phone) {
    const phoneWhere = {
      phone: data.phone,
      schoolId
    };
    if (excludeId !== null && excludeId !== undefined) {
      phoneWhere.id = { not: excludeId };
    }
    const existingPhone = await prisma.user.findFirst({
      where: phoneWhere
    });
    
    if (existingPhone) {
      errors.push('Phone number already exists');
    }
  }
  
  return errors;
};

export const buildStaffSearchQuery = (filters, schoolId) => {
  const where = {
    schoolId,
    deletedAt: null
  };
  
  // Text search
  if (filters.search) {
    where.OR = [
      { user: { firstName: { contains: filters.search, mode: 'insensitive' } } },
      { user: { lastName: { contains: filters.search, mode: 'insensitive' } } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } },
      { user: { phone: { contains: filters.search, mode: 'insensitive' } } },
      { employeeId: { contains: filters.search, mode: 'insensitive' } },
      { designation: { contains: filters.search, mode: 'insensitive' } }
    ];
  }
  
  // Individual filters
  if (filters.name) {
    where.OR = [
      { user: { firstName: { contains: filters.name, mode: 'insensitive' } } },
      { user: { lastName: { contains: filters.name, mode: 'insensitive' } } }
    ];
  }
  
  if (filters.email) {
    where.user = { ...where.user, email: { contains: filters.email, mode: 'insensitive' } };
  }
  
  if (filters.phone) {
    where.user = { ...where.user, phone: { contains: filters.phone, mode: 'insensitive' } };
  }
  
  if (filters.employeeId) {
    where.employeeId = { contains: filters.employeeId, mode: 'insensitive' };
  }
  
  if (filters.designation) {
    where.designation = { contains: filters.designation, mode: 'insensitive' };
  }
  
  if (filters.departmentId) {
    where.departmentId = filters.departmentId;
  }
  
  if (filters.gender) {
    where.user = { ...where.user, gender: filters.gender };
  }
  
  // Salary filters
  if (filters.minSalary || filters.maxSalary) {
    where.salary = {};
    if (filters.minSalary) where.salary.gte = filters.minSalary;
    if (filters.maxSalary) where.salary.lte = filters.maxSalary;
  }
  
  if (filters.salaryRange) {
    const ranges = {
      LOW: { lt: 30000 },
      MEDIUM: { gte: 30000, lt: 80000 },
      HIGH: { gte: 80000 }
    };
    where.salary = ranges[filters.salaryRange];
  }
  
  // Date filters
  if (filters.joiningDateAfter || filters.joiningDateBefore) {
    where.joiningDate = {};
    if (filters.joiningDateAfter) where.joiningDate.gte = new Date(filters.joiningDateAfter);
    if (filters.joiningDateBefore) where.joiningDate.lte = new Date(filters.joiningDateBefore);
  }
  
  if (filters.createdAfter || filters.createdBefore) {
    where.createdAt = {};
    if (filters.createdAfter) where.createdAt.gte = new Date(filters.createdAfter);
    if (filters.createdBefore) where.createdAt.lte = new Date(filters.createdBefore);
  }
  
  if (filters.updatedAfter || filters.updatedBefore) {
    where.updatedAt = {};
    if (filters.updatedAfter) where.updatedAt.gte = new Date(filters.updatedAfter);
    if (filters.updatedBefore) where.updatedAt.lte = new Date(filters.updatedBefore);
  }
  
  // Status filter
  if (filters.status) {
    where.user = { ...where.user, status: filters.status };
  }
  
  return where;
};

const VALID_INCLUDES = [
  'user', 'department', 'attendances', 'payrolls', 'documents', 'bookIssues', 'school'
];

export const buildStaffIncludeQuery = (include) => {
  const includeObj = {
    user: {
      select: {
        id: true,
        uuid: true,
        username: true,
        email: true,
        phone: true,
        firstName: true,
        middleName: true,
        lastName: true,
        displayName: true,
        gender: true,
        birthDate: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        lastLogin: true,
        timezone: true,
        locale: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      }
    }
  };

  if (!include) return includeObj;

  const includes = include
    .split(',')
    .map(i => i.trim())
    .filter(i => VALID_INCLUDES.includes(i));

  if (includes.includes('department')) {
    includeObj.department = {
      select: {
        id: true,
        uuid: true,
        name: true,
        code: true,
        description: true
      }
    };
  }
  if (includes.includes('attendances')) {
    includeObj.attendances = {
      select: {
        id: true,
        uuid: true,
        date: true,
        status: true,
        remarks: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { date: 'desc' },
      take: 10
    };
  }
  if (includes.includes('payrolls')) {
    includeObj.payrolls = {
      select: {
        id: true,
        uuid: true,
        month: true,
        year: true,
        basicSalary: true,
        allowances: true,
        deductions: true,
        netSalary: true,
        status: true,
        paymentDate: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 12
    };
  }
  if (includes.includes('documents')) {
    includeObj.documents = {
      select: {
        id: true,
        uuid: true,
        title: true,
        type: true,
        url: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    };
  }
  if (includes.includes('bookIssues')) {
    includeObj.bookIssues = {
      select: {
        id: true,
        uuid: true,
        bookId: true,
        issueDate: true,
        returnDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            isbn: true
          }
        }
      },
      orderBy: { issueDate: 'desc' },
      take: 10
    };
  }
  if (includes.includes('school')) {
    includeObj.school = {
      select: {
        id: true,
        uuid: true,
        name: true,
        shortName: true,
        code: true,
        email: true,
        phone: true,
        address: true,
        status: true
      }
    };
  }
  return includeObj;
};

export const formatStaffResponse = (staff, includeStats = false) => {
  const formatted = {
    id: staff.id,
    uuid: staff.uuid,
    employeeId: staff.employeeId,
    departmentId: staff.departmentId,
    designation: staff.designation,
    joiningDate: staff.joiningDate,
    salary: staff.salary,
    accountNumber: staff.accountNumber,
    bankName: staff.bankName,
    ifscCode: staff.ifscCode,
    schoolId: staff.schoolId,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
    deletedAt: staff.deletedAt,
    
    // User information
    user: staff.user ? {
      id: staff.user.id,
      uuid: staff.user.uuid,
      username: staff.user.username,
      email: staff.user.email,
      phone: staff.user.phone,
      firstName: staff.user.firstName,
      middleName: staff.user.middleName,
      lastName: staff.user.lastName,
      displayName: staff.user.displayName,
      fullName: `${staff.user.firstName} ${staff.user.middleName ? staff.user.middleName + ' ' : ''}${staff.user.lastName}`,
      gender: staff.user.gender,
      birthDate: staff.user.birthDate,
      avatar: staff.user.avatar,
      bio: staff.user.bio,
      role: staff.user.role,
      status: staff.user.status,
      lastLogin: staff.user.lastLogin,
      timezone: staff.user.timezone,
      locale: staff.user.locale,
      metadata: staff.user.metadata
    } : null,
    
    // Related data
    department: staff.department || null,
    attendances: staff.attendances || [],
    payrolls: staff.payrolls || [],
    documents: staff.documents || [],
    bookIssues: staff.bookIssues || [],
    school: staff.school || null
  };
  
  if (includeStats) {
    formatted.stats = {
      experience: calculateExperience(staff.joiningDate),
      salaryRange: calculateSalaryRange(staff.salary),
      totalAttendances: staff.attendances?.length || 0,
      totalPayrolls: staff.payrolls?.length || 0,
      totalDocuments: staff.documents?.length || 0,
      totalBookIssues: staff.bookIssues?.length || 0,
      totalEarnings: staff.payrolls?.reduce((sum, p) => sum + Number(p.netSalary), 0) || 0,
      averageSalary: staff.payrolls?.length > 0 ? staff.payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0) / staff.payrolls.length : 0
    };
  }
  
  return formatted;
};

export const validateStaffPermissions = async (staffId, userId, schoolId) => {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId },
    include: { user: true }
  });
  
  if (!staff) {
    throw new Error('Staff not found');
  }
  
  // Check if user is the staff themselves
  if (staff.userId === userId) {
    return true;
  }
  
  // Check if user has admin privileges
  const user = await prisma.user.findFirst({
    where: { id: userId, schoolId },
    select: { role: true }
  });
  
  if (user && ['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(user.role)) {
    return true;
  }
  
  return false;
};

export const generateStaffReport = async (schoolId, filters = {}) => {
  const where = buildStaffSearchQuery(filters, schoolId);
  
  const staff = await prisma.staff.findMany({
    where,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          gender: true,
          status: true,
          createdAt: true
        }
      },
      department: {
        select: {
          name: true,
          code: true
        }
      },
      attendances: {
        select: {
          date: true,
          status: true
        }
      },
      payrolls: {
        select: {
          month: true,
          year: true,
          netSalary: true,
          status: true
        }
      }
    }
  });
  
  const report = {
    totalStaff: staff.length,
    activeStaff: staff.filter(s => s.user.status === 'ACTIVE').length,
    inactiveStaff: staff.filter(s => s.user.status === 'INACTIVE').length,
    suspendedStaff: staff.filter(s => s.user.status === 'SUSPENDED').length,
    
    genderDistribution: {
      MALE: staff.filter(s => s.user.gender === 'MALE').length,
      FEMALE: staff.filter(s => s.user.gender === 'FEMALE').length,
      OTHER: staff.filter(s => s.user.gender === 'OTHER').length,
      PREFER_NOT_TO_SAY: staff.filter(s => s.user.gender === 'PREFER_NOT_TO_SAY').length
    },
    
    salaryDistribution: {
      LOW: staff.filter(s => calculateSalaryRange(s.salary) === 'LOW').length,
      MEDIUM: staff.filter(s => calculateSalaryRange(s.salary) === 'MEDIUM').length,
      HIGH: staff.filter(s => calculateSalaryRange(s.salary) === 'HIGH').length,
      UNKNOWN: staff.filter(s => !s.salary).length
    },
    
    departmentDistribution: staff.reduce((acc, s) => {
      const deptName = s.department?.name || 'No Department';
      acc[deptName] = (acc[deptName] || 0) + 1;
      return acc;
    }, {}),
    
    designationDistribution: staff.reduce((acc, s) => {
      acc[s.designation] = (acc[s.designation] || 0) + 1;
      return acc;
    }, {}),
    
    totalAttendances: staff.reduce((sum, s) => sum + s.attendances.length, 0),
    totalPayrolls: staff.reduce((sum, s) => sum + s.payrolls.length, 0),
    totalSalaryExpense: staff.reduce((sum, s) => sum + s.payrolls.reduce((pSum, p) => pSum + Number(p.netSalary), 0), 0),
    averageSalary: staff.length > 0 ? staff.reduce((sum, s) => sum + (s.salary || 0), 0) / staff.length : 0,
    
    staff: staff.map(s => ({
      id: s.id,
      uuid: s.uuid,
      name: `${s.user.firstName} ${s.user.lastName}`,
      email: s.user.email,
      phone: s.user.phone,
      gender: s.user.gender,
      status: s.user.status,
      employeeId: s.employeeId,
      designation: s.designation,
      department: s.department?.name || 'No Department',
      salary: s.salary,
      joiningDate: s.joiningDate,
      experience: calculateExperience(s.joiningDate),
      attendanceCount: s.attendances.length,
      payrollCount: s.payrolls.length,
      totalEarnings: s.payrolls.reduce((sum, p) => sum + Number(p.netSalary), 0),
      createdAt: s.createdAt
    }))
  };
  
  return report;
}; 
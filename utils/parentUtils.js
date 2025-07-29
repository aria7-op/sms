// utils/parentUtils.js
import { PrismaClient } from '../generated/prisma/client.js';
import { v4 as uuidv4 } from 'uuid';
import { formatResponse } from './responseUtils.js';
// utils/parentSchemas.js
import { z } from 'zod';
import { validatePhone, validateEmail } from '../middleware/validation.js';

const prisma = new PrismaClient();


// Define schema first


// Schema for creating parent with existing user ID
export const ParentCreateSchema = z.object({
  userId: z.bigint(),
  occupation: z.string().max(100).optional().nullable(),
  annualIncome: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/).optional().nullable(), // stored as string to be parsed later to Decimal
  education: z.string().max(100).optional().nullable(),
  schoolId: z.bigint(),
  createdBy: z.bigint(),
  // `uuid`, `id`, `createdAt`, `updatedAt`, `deletedAt` are usually auto-handled by Prisma, so not included for create
});

// Schema for creating parent with user data (creates both user and parent)
export const ParentCreateWithUserSchema = z.object({
  // User fields
  firstName: z.string().min(1, "First name is required").max(50, "First name cannot exceed 50 characters"),
  middleName: z.string().max(50, "Middle name cannot exceed 50 characters").optional(),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name cannot exceed 50 characters"),
  email: z.string().email("Invalid email format").min(1, "Email is required"),
  phone: z.string().min(1, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']).optional(),
  displayName: z.string().max(100, "Display name cannot exceed 100 characters").optional(),
  bio: z.string().max(255, "Bio cannot exceed 255 characters").optional(),
  timezone: z.string().default("UTC"),
  locale: z.string().default("en-US"),
  
  // Parent-specific fields
  occupation: z.string().max(100, "Occupation cannot exceed 100 characters").optional(),
  annualIncome: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Invalid income format").optional(),
  education: z.string().max(100, "Education cannot exceed 100 characters").optional(),
});
/**
 * Builds the include query for parent relations
 * @param {string} include - Comma-separated list of relations to include
 * @returns {Object} Prisma include object
 */
export const buildParentIncludeQuery = (include) => {
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

  const includes = include.split(',').map(i => i.trim());

  if (includes.includes('students')) {
    includeObj.students = {
      select: {
        id: true,
        uuid: true,
        admissionNo: true,
        rollNo: true,
        admissionDate: true,
        bloodGroup: true,
        nationality: true,
        religion: true,
        caste: true,
        previousSchool: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatar: true,
            status: true
          }
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
            section: true
          }
        },
        section: {
          select: {
            id: true,
            name: true,
            roomNumber: true
          }
        }
      }
    };
  }

  if (includes.includes('payments')) {
    includeObj.payments = {
      select: {
        id: true,
        uuid: true,
        amount: true,
        status: true,
        method: true,
        transactionId: true,
        paymentDate: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true
      }
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

  if (includes.includes('addresses')) {
    includeObj.addresses = {
      select: {
        id: true,
        type: true,
        street: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true
      }
    };
  }

  return includeObj;
};

/**
 * Builds search query for parents with various filters
 * @param {Object} filters - Search filters
 * @param {number} schoolId - School ID to scope the search
 * @returns {Object} Prisma where clause object
 */

/**
 * Calculates the income range category based on annual income
 * @param {number|null|undefined} annualIncome - The parent's annual income
 * @returns {string} Income range category
 */
export const calculateIncomeRange = (annualIncome) => {
  // Handle invalid or missing income values
  if (annualIncome === null || annualIncome === undefined || isNaN(annualIncome)) {
    return 'NOT_SPECIFIED';
  }

  // Convert to number if it's a string
  const income = Number(annualIncome);

  // Define income brackets (adjust these values as needed)
  if (income < 30000) return 'LOW';
  if (income < 60000) return 'LOWER_MIDDLE';
  if (income < 100000) return 'UPPER_MIDDLE';
  if (income < 200000) return 'HIGH';
  return 'VERY_HIGH';
};

/**
 * Formats parent data for consistent API responses
 * @param {Object} parent - Raw parent data from Prisma
 * @param {Object} options - Formatting options
 * @param {boolean} [options.includeStats=false] - Include calculated statistics
 * @param {boolean} [options.minimal=false] - Return only essential fields
 * @returns {Object} Formatted parent response
 */
export const formatParentResponse = (parent, options = {}) => {
  const { includeStats = false, minimal = false } = options;
  
  // Base response structure
  const response = {
    id: parent.id,
    uuid: parent.uuid,
    code: parent.code || null,
    occupation: parent.occupation || null,
    education: parent.education || null,
    incomeRange: calculateIncomeRange(parent.annualIncome),
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt
  };

  // Include financial data unless minimal
  if (!minimal) {
    response.annualIncome = parent.annualIncome || null;
    response.incomeRange = calculateIncomeRange(parent.annualIncome);
  }

  // User information
  if (parent.user) {
    response.user = {
      id: parent.user.id,
      firstName: parent.user.firstName,
      lastName: parent.user.lastName,
      fullName: `${parent.user.firstName} ${parent.user.lastName}`.trim(),
      email: parent.user.email,
      phone: parent.user.phone,
      avatar: parent.user.avatar,
      status: parent.user.status
    };

    if (!minimal) {
      response.user = {
        ...response.user,
        middleName: parent.user.middleName,
        displayName: parent.user.displayName,
        gender: parent.user.gender,
        birthDate: parent.user.birthDate,
        lastLogin: parent.user.lastLogin,
        timezone: parent.user.timezone,
        locale: parent.user.locale
      };
    }
  }

  // Relationships (only include if they exist and not in minimal mode)
  if (!minimal) {
    if (parent.students) {
      response.students = parent.students.map(student => ({
        id: student.id,
        name: student.user?.firstName 
          ? `${student.user.firstName} ${student.user.lastName}` 
          : 'Unknown Student',
        admissionNo: student.admissionNo,
        class: student.class?.name,
        status: student.user?.status
      }));
    }

    if (parent.addresses) {
      response.addresses = parent.addresses.map(address => ({
        type: address.type,
        street: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        isPrimary: address.isPrimary
      }));
    }

    if (parent.school) {
      response.school = {
        id: parent.school.id,
        name: parent.school.name,
        shortName: parent.school.shortName
      };
    }
  }

  // Include statistics if requested
  if (includeStats) {
    response.stats = {
      studentCount: parent.students?.length || 0,
      activeStudents: parent.students?.filter(s => s.user?.status === 'ACTIVE').length || 0,
      totalPayments: parent.payments?.length || 0,
      paidAmount: parent.payments?.reduce((sum, p) => 
        p.status === 'PAID' ? sum + (p.amount || 0) : sum, 0) || 0,
      pendingAmount: parent.payments?.reduce((sum, p) => 
        ['PENDING', 'PARTIALLY_PAID'].includes(p.status) ? sum + (p.amount || 0) : sum, 0) || 0
    };
  }

  return response;
};

/**
 * Generates a unique parent identification code based on initials and school records
 * @param {number} schoolId - The school ID for scoping
 * @param {string} firstName - Parent's first name
 * @param {string} lastName - Parent's last name
 * @returns {Promise<string>} Generated parent code (format: INITIALS+SEQ)
 */
export const generateParentCode = async (schoolId, firstName, lastName) => {
  // Validate inputs
  if (!schoolId || !firstName || !lastName) {
    throw new Error('Missing required parameters: schoolId, firstName, lastName');
  }

  // Clean and format names
  const cleanFirstName = firstName.trim().replace(/[^a-zA-Z]/g, '');
  const cleanLastName = lastName.trim().replace(/[^a-zA-Z]/g, '');

  // Get initials (handle single-character names)
  const firstInitial = cleanFirstName.charAt(0).toUpperCase();
  const lastInitial = cleanLastName.charAt(0).toUpperCase();
  
  if (!firstInitial || !lastInitial) {
    throw new Error('Invalid name format - could not extract initials');
  }

  const baseCode = `${firstInitial}${lastInitial}`;

  // Find existing parents with similar codes
  const existingParents = await prisma.parent.findMany({
    where: {
      schoolId,
      code: {
        startsWith: baseCode
      }
    },
    select: {
      code: true
    },
    orderBy: {
      code: 'desc'
    }
  });

  // Determine next sequence number
  let nextSequence = 1;
  if (existingParents.length > 0) {
    const latestCode = existingParents[0].code;
    const sequencePart = latestCode.slice(baseCode.length);
    const existingSequence = parseInt(sequencePart) || 0;
    nextSequence = existingSequence + 1;
  }

  // Format with leading zeros (e.g., 001)
  const sequenceString = String(nextSequence).padStart(3, '0');
  
  return `${baseCode}${sequenceString}`;
};

/**
 * Generates a comprehensive report of parent data with statistics
 * @param {number} schoolId - The school ID to generate report for
 * @param {Object} filters - Report filters
 * @param {Date} [filters.startDate] - Report start date
 * @param {Date} [filters.endDate] - Report end date
 * @param {string} [filters.incomeRange] - Filter by income range
 * @param {string} [filters.status] - Filter by parent status
 * @returns {Promise<Object>} Generated report with statistics
 */
export const generateParentReport = async (schoolId, filters = {}) => {
  // Build base query conditions
  const where = {
    schoolId,
    deletedAt: null,
    createdAt: {
      gte: filters.startDate,
      lte: filters.endDate
    }
  };

  // Add optional filters
  if (filters.incomeRange) {
    where.incomeRange = filters.incomeRange;
  }
  if (filters.status) {
    where.user = { ...where.user, status: filters.status };
  }

  // Get all parents with necessary relations
  const parents = await prisma.parent.findMany({
    where,
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          status: true,
          createdAt: true
        }
      },
      students: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      },
      payments: {
        select: {
          amount: true,
          status: true,
          paymentDate: true
        }
      }
    }
  });

  // Calculate report statistics
  const stats = {
    totalParents: parents.length,
    activeParents: parents.filter(p => p.user.status === 'ACTIVE').length,
    incomeDistribution: {
      LOW: 0,
      LOWER_MIDDLE: 0,
      UPPER_MIDDLE: 0,
      HIGH: 0,
      VERY_HIGH: 0,
      UNSPECIFIED: 0
    },
    paymentSummary: {
      totalPaid: 0,
      totalPending: 0,
      totalAmount: 0
    },
    studentDistribution: {
      withStudents: 0,
      withoutStudents: 0
    }
  };

  // Process each parent
  parents.forEach(parent => {
    const incomeRange = calculateIncomeRange(parent.annualIncome);
    stats.incomeDistribution[incomeRange]++;

    // Payment stats
    parent.payments?.forEach(payment => {
      stats.paymentSummary.totalAmount += payment.amount || 0;
      if (payment.status === 'PAID') {
        stats.paymentSummary.totalPaid += payment.amount || 0;
      } else {
        stats.paymentSummary.totalPending += payment.amount || 0;
      }
    });

    // Student stats
    if (parent.students?.length > 0) {
      stats.studentDistribution.withStudents++;
    } else {
      stats.studentDistribution.withoutStudents++;
    }
  });

  // Generate CSV-ready data
  const csvData = parents.map(parent => ({
    parentId: parent.id,
    name: `${parent.user.firstName} ${parent.user.lastName}`,
    email: parent.user.email,
    status: parent.user.status,
    incomeRange: calculateIncomeRange(parent.annualIncome),
    studentCount: parent.students?.length || 0,
    totalPayments: parent.payments?.length || 0,
    lastPaymentDate: parent.payments?.length 
      ? new Date(Math.max(...parent.payments.map(p => new Date(p.paymentDate))))
      .toISOString().split('T')[0]
      : null
  }));

  // Calculate averages
  const totalStudents = parents.reduce((sum, p) => sum + (p.students?.length || 0), 0);
  const averageStudentsPerParent = parents.length > 0 ? totalStudents / parents.length : 0;
  const averagePaymentAmount = parents.length > 0 ? stats.paymentSummary.totalAmount / parents.length : 0;

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      schoolId,
      filters,
      timeRange: {
        start: filters.startDate,
        end: filters.endDate
      }
    },
    statistics: stats,
    summary: {
      averageStudentsPerParent,
      averagePaymentAmount
    },
    csvData,
    visualizations: {
      incomeDistribution: Object.entries(stats.incomeDistribution)
        .filter(([_, count]) => count > 0)
        .map(([range, count]) => ({ range, count })),
      statusDistribution: [
        { status: 'ACTIVE', count: stats.activeParents },
        { status: 'INACTIVE', count: parents.length - stats.activeParents }
      ]
    }
  };
};

/**
 * Validates parent data for creation/updates
 * @param {Object} data - Parent data to validate
 * @param {number} schoolId - School ID for scoping
 * @param {number|null} [excludeId=null] - Parent ID to exclude (for updates)
 * @returns {Promise<{isValid: boolean, errors: string[]}>} Validation result
 */
export const validateParentData = async (data, schoolId, excludeId = null) => {
  const errors = [];
  
  // Required fields validation
  const requiredFields = ['username', 'email', 'firstName', 'lastName'];
  requiredFields.forEach(field => {
    if (!data[field]) {
      errors.push(`${field} is required`);
    }
  });

  // Email format validation
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Invalid email format');
  }

  // Phone validation (if provided)
  if (data.phone && !/^[\d\s\+\-\(\)]{10,20}$/.test(data.phone)) {
    errors.push('Phone must be 10-20 digits with optional formatting');
  }

  // Username validation
  if (data.username && !/^[a-zA-Z0-9_]{3,30}$/.test(data.username)) {
    errors.push('Username must be 3-30 alphanumeric characters or underscores');
  }

  // Name validation
  if (data.firstName && !/^[a-zA-Z\-'\s]{2,50}$/.test(data.firstName)) {
    errors.push('First name must be 2-50 valid characters');
  }
  if (data.lastName && !/^[a-zA-Z\-'\s]{2,50}$/.test(data.lastName)) {
    errors.push('Last name must be 2-50 valid characters');
  }

  // Check for existing email (if not excluded)
  if (data.email && !errors.some(e => e.includes('email'))) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email: data.email,
        schoolId,
        id: excludeId ? { not: excludeId } : undefined
      }
    });
    if (existingEmail) {
      errors.push('Email already exists in this school');
    }
  }

  // Check for existing username (if not excluded)
  if (data.username && !errors.some(e => e.includes('username'))) {
    const existingUsername = await prisma.user.findFirst({
      where: {
        username: data.username,
        schoolId,
        id: excludeId ? { not: excludeId } : undefined
      }
    });
    if (existingUsername) {
      errors.push('Username already exists in this school');
    }
  }

  // Check for existing phone (if provided and not excluded)
  if (data.phone && !errors.some(e => e.includes('phone'))) {
    const existingPhone = await prisma.user.findFirst({
      where: {
        phone: data.phone,
        schoolId,
        id: excludeId ? { not: excludeId } : undefined
      }
    });
    if (existingPhone) {
      errors.push('Phone number already exists in this school');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validates if a user has permission to access/modify parent data
 * @param {number} parentId - The parent record ID to check
 * @param {number} userId - The user ID requesting access
 * @param {number} schoolId - School ID for permission scoping
 * @param {string} [action='view'] - Action being performed (view/edit/delete)
 * @returns {Promise<{hasPermission: boolean, message?: string}>} Permission check result
 */
export const validateParentPermissions = async (parentId, userId, schoolId, action = 'view') => {
  try {
    // First get the parent record
    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        user: {
          select: {
            id: true,
            role: true
          }
        }
      }
    });

    // Parent doesn't exist
    if (!parent) {
      return { 
        hasPermission: false,
        message: 'Parent record not found'
      };
    }

    // Get the requesting user's information
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        schoolId: true
      }
    });

    // User doesn't exist
    if (!user) {
      return {
        hasPermission: false,
        message: 'User not found'
      };
    }

    // Check school access
    if (user.schoolId !== schoolId) {
      return {
        hasPermission: false,
        message: 'Access to this school denied'
      };
    }

    // Permission scenarios:
    
    // 1. User is the parent themselves
    if (parent.userId === userId) {
      // Parents can always view their own data
      if (action === 'view') return { hasPermission: true };
      
      // Additional checks for edit/delete
      return {
        hasPermission: false,
        message: 'Parents cannot modify their own records'
      };
    }

    // 2. User is an admin (school admin or super admin)
    if (['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      // Admins can perform any action
      return { hasPermission: true };
    }

    // 3. User is a staff member with parent management permissions
    if (user.role === 'STAFF') {
      const staffPermissions = await prisma.staffPermission.findFirst({
        where: {
          userId,
          permission: 'MANAGE_PARENTS'
        }
      });
      
      if (staffPermissions) {
        // Staff with parent management can view/edit but not delete
        return {
          hasPermission: ['view', 'edit'].includes(action),
          message: action === 'delete' 
            ? 'Staff cannot delete parent records' 
            : undefined
        };
      }
    }

    // Default deny
    return {
      hasPermission: false,
      message: 'Insufficient permissions'
    };

  } catch (error) {
    console.error('Permission validation error:', error);
    return {
      hasPermission: false,
      message: 'Error validating permissions'
    };
  }
};



// Common field validations reused across schemas
const commonFields = {
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores allowed"),
  
  email: z.string()
    .email("Invalid email format")
    .refine(validateEmail, "Invalid email domain"),
    
  phone: z.string()
    .optional()
    .refine(val => !val || validatePhone(val), "Invalid phone number format"),
    
  firstName: z.string()
    .min(2, "First name too short")
    .max(50, "First name too long")
    .regex(/^[a-zA-Z\s\-']+$/, "Invalid characters in first name"),
    
  lastName: z.string()
    .min(2, "Last name too short")
    .max(50, "Last name too long")
    .regex(/^[a-zA-Z\s\-']+$/, "Invalid characters in last name"),
    
  // ... other common fields ...
};

// Base parent schema with common validation
const BaseParentSchema = z.object({
  ...commonFields,
  schoolId: z.number().int().positive("Invalid school ID"),
  metadata: z.record(z.any()).optional()
});

// Individual parent creation schema


// Individual parent update schema
export const ParentUpdateSchema = BaseParentSchema.partial().omit({ 
  username: true,
  schoolId: true 
});


export const ParentBulkDeleteSchema = z.object({
  parentIds: z.array(
    z.number().int().positive("Each ID must be a positive integer")
  )
  .min(1, "At least one parent ID is required")
  .max(100, "Cannot delete more than 100 parents at once"),
  
  options: z.object({
    archiveInstead: z.boolean()
      .default(false)
      .describe("Soft delete/archive records instead of hard delete"),
      
    transferStudents: z.boolean()
      .default(false)
      .describe("Transfer students to another parent before deletion"),
      
    transferParentId: z.number()
      .int()
      .positive()
      .optional()
      .describe("Parent ID to transfer students to"),
      
    reason: z.string()
      .min(10, "Deletion reason must be at least 10 characters")
      .max(500, "Reason cannot exceed 500 characters")
      .optional()
  }).default({})
}).superRefine(async (data, ctx) => {
  // Validate transfer parent exists if specified
  if (data.options.transferStudents && !data.options.transferParentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Transfer parent ID required when transferring students",
      path: ["options", "transferParentId"]
    });
  }

  // Don't allow transferring to same parents being deleted
  if (data.options.transferParentId && data.parentIds.includes(data.options.transferParentId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Cannot transfer students to a parent being deleted",
      path: ["options", "transferParentId"]
    });
  }

  // Verify all parent IDs exist in database (async check)
  const existingParents = await prisma.parent.findMany({
    where: { id: { in: data.parentIds } },
    select: { id: true }
  });

  const missingIds = data.parentIds.filter(id => 
    !existingParents.some(p => p.id === id)
  );

  if (missingIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Parents not found: ${missingIds.join(', ')}`,
      path: ["parentIds"]
    });
  }
});

export const ParentBulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.number().int().positive("Invalid parent ID"),
      data: ParentUpdateSchema
    })
  )
  .min(1, "At least one update required")
  .max(100, "Cannot update more than 100 parents at once"),
  
  options: z.object({
    validateEmailUniqueness: z.boolean()
      .default(true)
      .describe("Verify updated emails remain unique"),
      
    validatePhoneUniqueness: z.boolean()
      .default(true)
      .describe("Verify updated phone numbers remain unique"),
      
    skipInactive: z.boolean()
      .default(false)
      .describe("Skip updates for inactive parents"),
      
    notification: z.object({
      notifyParents: z.boolean().default(false),
      templateId: z.string().optional()
    }).default({})
  }).default({})
}).superRefine(async (data, ctx) => {
  // Validate all parent IDs exist
  const parentIds = data.updates.map(u => u.id);
  const existingParents = await prisma.parent.findMany({
    where: { id: { in: parentIds } },
    include: { user: true }
  });

  // Check for non-existent parents
  const missingIds = parentIds.filter(id => 
    !existingParents.some(p => p.id === id)
  );
  if (missingIds.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Parents not found: ${missingIds.join(', ')}`,
      path: ["updates"]
    });
  }

  // Check for email uniqueness if enabled
  if (data.options.validateEmailUniqueness) {
    const emailUpdates = data.updates
      .filter(u => u.data.email)
      .map(u => ({ id: u.id, email: u.data.email?.toLowerCase() }));

    const duplicateEmails = await checkFieldUniqueness(
      'email',
      emailUpdates,
      existingParents
    );
    
    if (duplicateEmails.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate emails: ${duplicateEmails.join(', ')}`,
        path: ["options", "validateEmailUniqueness"]
      });
    }
  }

  // Check for phone uniqueness if enabled
  if (data.options.validatePhoneUniqueness) {
    const phoneUpdates = data.updates
      .filter(u => u.data.phone)
      .map(u => ({ id: u.id, phone: u.data.phone }));

    const duplicatePhones = await checkFieldUniqueness(
      'phone',
      phoneUpdates,
      existingParents
    );
    
    if (duplicatePhones.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate phone numbers: ${duplicatePhones.join(', ')}`,
        path: ["options", "validatePhoneUniqueness"]
      });
    }
  }
});

// Helper function to check field uniqueness
async function checkFieldUniqueness(field, updates, existingParents) {
  const existingValues = await prisma.user.findMany({
    where: {
      [field]: { in: updates.map(u => u[field]) },
      NOT: { parentId: { in: updates.map(u => u.id) } }
    },
    select: { [field]: true }
  });

  return updates
    .filter(u => existingValues.some(ev => ev[field] === u[field]))
    .map(u => u[field]);
}


export const ParentSearchSchema = z.object({
  // Text search fields
  query: z.string().trim().min(1).max(100).optional(),

  // Filter fields
  filters: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'PENDING']).optional(),
    incomeRange: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).optional(),
    hasStudents: z.boolean().optional(),
    createdAt: z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional()
    }).optional(),
    updatedAt: z.object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional()
    }).optional()
  }).optional(),

  // Pagination
  pagination: z.object({
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    cursor: z.number().int().positive().optional()
  }).optional(),

  // Sorting
  sort: z.object({
    field: z.enum([
      'firstName',
      'lastName',
      'email',
      'createdAt',
      'annualIncome'
    ]).default('lastName'),
    order: z.enum(['asc', 'desc']).default('asc')
  }).optional(),

  // Related data inclusion
  include: z.array(
    z.enum(['students', 'payments', 'addresses'])
  ).optional()
}).transform(data => {
  // Transform empty string query to undefined
  if (data.query === '') {
    return { ...data, query: undefined };
  }
  return data;
});



// Utility function to convert schema to Prisma query
export function buildParentSearchQuery(params) {
  const { query, filters, sort } = ParentSearchSchema.parse(params);
  
  const where = {
    AND: []
  };

  // Text search
  if (query) {
    where.AND.push({
      OR: [
        { user: { firstName: { contains: query, mode: 'insensitive' } } },
        { user: { lastName: { contains: query, mode: 'insensitive' } } },
        { user: { email: { contains: query, mode: 'insensitive' } } },
        { occupation: { contains: query, mode: 'insensitive' } }
      ]
    });
  }

  // Status filter
  if (filters?.status) {
    where.AND.push({ user: { status: filters.status } });
  }

  // Income range filter
  if (filters?.incomeRange) {
    const ranges = {
      LOW: { lt: 30000 },
      MEDIUM: { gte: 30000, lt: 100000 },
      HIGH: { gte: 100000, lt: 200000 },
      VERY_HIGH: { gte: 200000 }
    };
    where.AND.push({ annualIncome: ranges[filters.incomeRange] });
  }

  // Student relationship filter
  if (filters?.hasStudents !== undefined) {
    where.AND.push({
      students: filters.hasStudents ? { some: {} } : { none: {} }
    });
  }

  // Date filters
  if (filters?.createdAt) {
    where.AND.push({
      createdAt: {
        gte: filters.createdAt.from,
        lte: filters.createdAt.to
      }
    });
  }

  if (filters?.updatedAt) {
    where.AND.push({
      updatedAt: {
        gte: filters.updatedAt.from,
        lte: filters.updatedAt.to
      }
    });
  }

  // Build orderBy
  const orderBy = [];
  if (sort) {
    const sortField = sort.field === 'annualIncome' ? 
      sort.field : 
      `user.${sort.field}`;
    
    orderBy.push({
      [sortField]: sort.order
    });
  }

  return { where, orderBy };
}
export const ParentBulkCreateSchema = z.array(
  ParentCreateSchema.omit({ 
    id: true,
    uuid: true,
    createdAt: true,
    updatedAt: true 
  }).extend({
    // You might want to add bulk-specific fields here
    temporaryId: z.string().optional().describe("Client-side ID for tracking"),
    skipOnError: z.boolean().optional().default(false)
  })
).min(1, "At least one parent required")
.max(100, "Cannot create more than 100 parents at once");

export default {
  buildParentIncludeQuery,
  buildParentSearchQuery,
  calculateIncomeRange,
  formatParentResponse,
  generateParentCode,
  generateParentReport,
  validateParentData,
  validateParentPermissions,
  ParentCreateSchema,
  ParentBulkCreateSchema
};
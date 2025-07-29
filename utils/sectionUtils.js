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

export const SectionCreateSchema = z.object({
  name: z.string()
    .min(1, 'Section name is required')
    .max(50, 'Section name must be less than 50 characters')
    .regex(/^[A-Z0-9\s]+$/, 'Section name can only contain uppercase letters, numbers, and spaces')
    .trim(),
  
  classId: z.number().int().positive('Class ID is required'),
  
  teacherId: z.number().int().positive().optional(),
  
  capacity: z.number().int().positive('Capacity must be a positive number')
    .min(1, 'Capacity must be at least 1')
    .max(100, 'Capacity cannot exceed 100'),
  
  roomNumber: z.string()
    .max(20, 'Room number must be less than 20 characters')
    .regex(/^[A-Z0-9\-\s]+$/, 'Room number can only contain uppercase letters, numbers, hyphens, and spaces')
    .optional(),
  
  schoolId: z.number().int().positive('School ID is required'),
  
  // System fields
  metadata: z.record(z.any()).optional()
});

export const SectionUpdateSchema = z.object({
  name: z.string()
    .min(1, 'Section name is required')
    .max(50, 'Section name must be less than 50 characters')
    .regex(/^[A-Z0-9\s]+$/, 'Section name can only contain uppercase letters, numbers, and spaces')
    .trim()
    .optional(),
  
  classId: z.number().int().positive().optional(),
  
  teacherId: z.number().int().positive().optional(),
  
  capacity: z.number().int().positive()
    .min(1, 'Capacity must be at least 1')
    .max(100, 'Capacity cannot exceed 100')
    .optional(),
  
  roomNumber: z.string()
    .max(20, 'Room number must be less than 20 characters')
    .regex(/^[A-Z0-9\-\s]+$/, 'Room number can only contain uppercase letters, numbers, hyphens, and spaces')
    .optional(),
  
  // System fields
  metadata: z.record(z.any()).optional()
});

export const SectionSearchSchema = z.object({
  // Search filters
  search: z.string().optional(),
  name: z.string().optional(),
  classId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().optional(),
  schoolId: z.number().int().positive().optional(),
  
  // Capacity filters
  minCapacity: z.number().int().positive().optional(),
  maxCapacity: z.number().int().positive().optional(),
  
  // Date filters
  createdAfter: z.string().datetime().optional(),
  createdBefore: z.string().datetime().optional(),
  updatedAfter: z.string().datetime().optional(),
  updatedBefore: z.string().datetime().optional(),
  
  // Pagination
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'capacity', 'classId']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  
  // Include relations
  include: z.string().optional()
});

export const SectionBulkCreateSchema = z.object({
  sections: z.array(SectionCreateSchema).min(1).max(100),
  skipDuplicates: z.boolean().default(false)
});

export const SectionBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.number().int().positive(),
    data: SectionUpdateSchema
  })).min(1).max(100)
});

export const SectionBulkDeleteSchema = z.object({
  sectionIds: z.array(z.number().int().positive()).min(1).max(100)
});

// ======================
// HELPER FUNCTIONS
// ======================

export const generateSectionName = async (classId, schoolId) => {
  const existingSections = await prisma.section.findMany({
    where: {
      classId,
      schoolId,
      deletedAt: null
    },
    orderBy: {
      name: 'asc'
    }
  });
  
  const sectionCount = existingSections.length;
  const sectionLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  if (sectionCount >= sectionLetters.length) {
    // If we exceed single letters, use A1, A2, etc.
    const baseLetter = sectionLetters[sectionCount % sectionLetters.length];
    const number = Math.floor(sectionCount / sectionLetters.length) + 1;
    return `${baseLetter}${number}`;
  }
  
  return sectionLetters[sectionCount];
};

export const calculateSectionUtilization = async (sectionId) => {
  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: {
      _count: {
        select: {
          students: true
        }
      }
    }
  });
  
  if (!section) return 0;
  
  return {
    capacity: section.capacity,
    current: section._count.students,
    utilization: Math.round((section._count.students / section.capacity) * 100),
    available: section.capacity - section._count.students
  };
};

export const validateSectionData = async (data, schoolId, excludeId = null) => {
  const errors = [];
  
  // Check for duplicate section name in the same class
  const existingSection = await prisma.section.findFirst({
    where: {
      name: data.name,
      classId: data.classId,
      schoolId,
      id: { not: excludeId },
      deletedAt: null
    }
  });
  
  if (existingSection) {
    errors.push('Section name already exists in this class');
  }
  
  // Check if class exists and belongs to the school
  const classExists = await prisma.class.findFirst({
    where: {
      id: data.classId,
      schoolId,
      deletedAt: null
    }
  });
  
  if (!classExists) {
    errors.push('Class does not exist or does not belong to this school');
  }
  
  // Check if teacher exists and belongs to the school (if provided)
  if (data.teacherId) {
    const teacherExists = await prisma.teacher.findFirst({
      where: {
        id: data.teacherId,
        schoolId,
        deletedAt: null
      }
    });
    
    if (!teacherExists) {
      errors.push('Teacher does not exist or does not belong to this school');
    }
  }
  
  // Check capacity constraints
  if (data.capacity) {
    const currentStudents = await prisma.student.count({
      where: {
        sectionId: excludeId,
        deletedAt: null
      }
    });
    
    if (data.capacity < currentStudents) {
      errors.push(`Cannot reduce capacity below current student count (${currentStudents})`);
    }
  }
  
  return errors;
};

export const buildSectionSearchQuery = (filters, schoolId) => {
  const where = {
    schoolId,
    deletedAt: null
  };
  
  // Basic filters
  if (filters.name) {
    where.name = { contains: filters.name, mode: 'insensitive' };
  }
  
  if (filters.classId) {
    where.classId = filters.classId;
  }
  
  if (filters.teacherId) {
    where.teacherId = filters.teacherId;
  }
  
  // Capacity filters
  if (filters.minCapacity || filters.maxCapacity) {
    where.capacity = {};
    if (filters.minCapacity) where.capacity.gte = filters.minCapacity;
    if (filters.maxCapacity) where.capacity.lte = filters.maxCapacity;
  }
  
  // Date filters
  if (filters.createdAfter) where.createdAt = { gte: new Date(filters.createdAfter) };
  if (filters.createdBefore) where.createdAt = { ...where.createdAt, lte: new Date(filters.createdBefore) };
  if (filters.updatedAfter) where.updatedAt = { gte: new Date(filters.updatedAfter) };
  if (filters.updatedBefore) where.updatedAt = { ...where.updatedAt, lte: new Date(filters.updatedBefore) };
  
  // Search across multiple fields
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { roomNumber: { contains: filters.search, mode: 'insensitive' } }
    ];
  }
  
  return where;
};

export const buildSectionIncludeQuery = (include = []) => {
  const includeQuery = {};
  
  if (Array.isArray(include)) {
    if (include.includes('class')) {
      includeQuery.class = {
        include: {
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
    
    if (include.includes('teacher')) {
      includeQuery.teacher = {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      };
    }
    
    if (include.includes('students')) {
      includeQuery.students = {
        where: {
          deletedAt: null
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
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
    
    if (include.includes('_count')) {
      includeQuery._count = {
        select: {
          students: true
        }
      };
    }
  } else if (typeof include === 'string') {
    const includes = include.split(',').map(item => item.trim());
    
    if (includes.includes('class')) {
      includeQuery.class = true;
    }
    
    if (includes.includes('teacher')) {
      includeQuery.teacher = true;
    }
    
    if (includes.includes('students')) {
      includeQuery.students = {
        where: {
          deletedAt: null
        }
      };
    }
    
    if (includes.includes('school')) {
      includeQuery.school = true;
    }
    
    if (includes.includes('_count')) {
      includeQuery._count = {
        select: {
          students: true
        }
      };
    }
  }
  
  return includeQuery;
};

export const formatSectionResponse = (section, includeStats = false) => {
  const formatted = {
    id: section.id,
    uuid: section.uuid,
    name: section.name,
    classId: section.classId,
    teacherId: section.teacherId,
    capacity: section.capacity,
    roomNumber: section.roomNumber,
    schoolId: section.schoolId,
    createdAt: section.createdAt,
    updatedAt: section.updatedAt,
    metadata: section.metadata
  };
  
  // Include relations if they exist
  if (section.class) {
    formatted.class = {
      id: section.class.id,
      name: section.class.name,
      code: section.class.code,
      level: section.class.level,
      school: section.class.school ? {
        id: section.class.school.id,
        name: section.class.school.name,
        code: section.class.school.code
      } : null
    };
  }
  
  if (section.teacher) {
    formatted.teacher = {
      id: section.teacher.id,
      user: section.teacher.user ? {
        id: section.teacher.user.id,
        firstName: section.teacher.user.firstName,
        lastName: section.teacher.user.lastName,
        email: section.teacher.user.email
      } : null
    };
  }
  
  if (section.students) {
    formatted.students = section.students.map(student => ({
      id: student.id,
      uuid: student.uuid,
      user: student.user ? {
        id: student.user.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email
      } : null
    }));
  }
  
  if (section.school) {
    formatted.school = {
      id: section.school.id,
      name: section.school.name,
      code: section.school.code
    };
  }
  
  // Include statistics if requested
  if (includeStats && section._count) {
    formatted.stats = {
      studentCount: section._count.students,
      utilization: Math.round((section._count.students / section.capacity) * 100),
      available: section.capacity - section._count.students
    };
  }
  
  return formatted;
};

export const validateSectionPermissions = async (sectionId, userId, schoolId) => {
  const section = await prisma.section.findFirst({
    where: {
      id: sectionId,
      schoolId
    }
  });
  
  if (!section) {
    throw new Error('Section not found or access denied');
  }
  
  return section;
};

export const generateSectionReport = async (schoolId, filters = {}) => {
  const where = buildSectionSearchQuery(filters, schoolId);
  
  const sections = await prisma.section.findMany({
    where,
    include: {
      class: true,
      teacher: {
        include: {
          user: true
        }
      },
      _count: {
        select: {
          students: true
        }
      }
    }
  });
  
  const report = {
    totalSections: sections.length,
    totalCapacity: sections.reduce((sum, section) => sum + section.capacity, 0),
    totalStudents: sections.reduce((sum, section) => sum + section._count.students, 0),
    averageUtilization: 0,
    sectionsByClass: {},
    sectionsByTeacher: {},
    utilizationRanges: {
      low: 0,      // 0-25%
      medium: 0,   // 26-75%
      high: 0,     // 76-100%
      full: 0      // 100%
    }
  };
  
  sections.forEach(section => {
    const utilization = Math.round((section._count.students / section.capacity) * 100);
    
    // Calculate average utilization
    report.averageUtilization += utilization;
    
    // Group by class
    const className = section.class ? section.class.name : 'Unknown';
    if (!report.sectionsByClass[className]) {
      report.sectionsByClass[className] = {
        count: 0,
        capacity: 0,
        students: 0
      };
    }
    report.sectionsByClass[className].count++;
    report.sectionsByClass[className].capacity += section.capacity;
    report.sectionsByClass[className].students += section._count.students;
    
    // Group by teacher
    const teacherName = section.teacher && section.teacher.user 
      ? `${section.teacher.user.firstName} ${section.teacher.user.lastName}`
      : 'Unassigned';
    if (!report.sectionsByTeacher[teacherName]) {
      report.sectionsByTeacher[teacherName] = {
        count: 0,
        capacity: 0,
        students: 0
      };
    }
    report.sectionsByTeacher[teacherName].count++;
    report.sectionsByTeacher[teacherName].capacity += section.capacity;
    report.sectionsByTeacher[teacherName].students += section._count.students;
    
    // Utilization ranges
    if (utilization === 100) {
      report.utilizationRanges.full++;
    } else if (utilization >= 76) {
      report.utilizationRanges.high++;
    } else if (utilization >= 26) {
      report.utilizationRanges.medium++;
    } else {
      report.utilizationRanges.low++;
    }
  });
  
  if (sections.length > 0) {
    report.averageUtilization = Math.round(report.averageUtilization / sections.length);
  }
  
  return report;
};

export default {
  SectionCreateSchema,
  SectionUpdateSchema,
  SectionSearchSchema,
  SectionBulkCreateSchema,
  SectionBulkUpdateSchema,
  SectionBulkDeleteSchema,
  generateSectionName,
  calculateSectionUtilization,
  validateSectionData,
  buildSectionSearchQuery,
  buildSectionIncludeQuery,
  formatSectionResponse,
  validateSectionPermissions,
  generateSectionReport
}; 
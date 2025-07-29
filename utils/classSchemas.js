import { z } from 'zod';

// ======================
// BASE SCHEMAS
// ======================

export const ClassBaseSchema = z.object({
  name: z.string()
    .min(1, 'Class name is required')
    .max(100, 'Class name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Class name can only contain letters, numbers, spaces, hyphens, and underscores'),
  
  code: z.string()
    .min(1, 'Class code is required')
    .max(20, 'Class code must be less than 20 characters')
    .regex(/^[A-Z0-9\-_]+$/, 'Class code can only contain uppercase letters, numbers, hyphens, and underscores'),
  
  level: z.number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(20, 'Level must be at most 20'),
  
  section: z.string()
    .max(10, 'Section must be less than 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Section can only contain uppercase letters and numbers')
    .optional(),
  
  roomNumber: z.string()
    .max(20, 'Room number must be less than 20 characters')
    .regex(/^[A-Z0-9\-_]+$/, 'Room number can only contain letters, numbers, hyphens, and underscores')
    .optional(),
  
  capacity: z.number()
    .int('Capacity must be an integer')
    .min(1, 'Capacity must be at least 1')
    .max(1000, 'Capacity must be at most 1000'),
  
  classTeacherId: z.number()
    .int('Class teacher ID must be an integer')
    .positive('Class teacher ID must be positive')
    .optional(),
  
  schoolId: z.number()
    .int('School ID must be an integer')
    .positive('School ID must be positive'),
});

// ======================
// CREATE SCHEMAS
// ======================

export const ClassCreateSchema = ClassBaseSchema.extend({
  createdBy: z.number()
    .int('Created by ID must be an integer')
    .positive('Created by ID must be positive'),
});

export const ClassBulkCreateSchema = z.object({
  classes: z.array(ClassCreateSchema)
    .min(1, 'At least one class is required')
    .max(100, 'Maximum 100 classes can be created at once'),
  
  options: z.object({
    skipDuplicates: z.boolean().default(true),
    validateOnly: z.boolean().default(false),
    generateCodes: z.boolean().default(false),
    assignDefaultTeacher: z.boolean().default(false),
  }).optional(),
});

// ======================
// UPDATE SCHEMAS
// ======================

export const ClassUpdateSchema = ClassBaseSchema.partial().extend({
  updatedBy: z.number()
    .int('Updated by ID must be an integer')
    .positive('Updated by ID must be positive'),
});

export const ClassBulkUpdateSchema = z.object({
  updates: z.array(z.object({
    id: z.number()
      .int('Class ID must be an integer')
      .positive('Class ID must be positive'),
    data: ClassUpdateSchema.omit({ updatedBy: true }),
  }))
    .min(1, 'At least one update is required')
    .max(100, 'Maximum 100 classes can be updated at once'),
  
  options: z.object({
    validateOnly: z.boolean().default(false),
    sendNotifications: z.boolean().default(true),
    updateRelatedRecords: z.boolean().default(false),
  }).optional(),
});

// ======================
// SEARCH & FILTER SCHEMAS
// ======================

export const ClassSearchSchema = z.object({
  // Pagination
  page: z.coerce.number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(10),
  
  // Sorting
  sortBy: z.enum(['name', 'code', 'level', 'section', 'capacity', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  
  sortOrder: z.enum(['asc', 'desc'])
    .default('desc'),
  
  // Search
  search: z.string()
    .max(100, 'Search term must be less than 100 characters')
    .optional(),
  
  // Filters
  level: z.coerce.number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(20, 'Level must be at most 20')
    .optional(),
  
  section: z.string()
    .max(10, 'Section must be less than 10 characters')
    .optional(),
  
  schoolId: z.coerce.number()
    .int('School ID must be an integer')
    .positive('School ID must be positive')
    .optional(),
  
  classTeacherId: z.coerce.number()
    .int('Class teacher ID must be an integer')
    .positive('Class teacher ID must be positive')
    .optional(),
  
  hasStudents: z.coerce.boolean().optional(),
  hasSubjects: z.coerce.boolean().optional(),
  hasTimetable: z.coerce.boolean().optional(),
  
  // Date filters
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  updatedAfter: z.coerce.date().optional(),
  updatedBefore: z.coerce.date().optional(),
  
  // Relations to include
  include: z.string()
    .max(500, 'Include string must be less than 500 characters')
    .optional(),
});

export const ClassAdvancedSearchSchema = ClassSearchSchema.extend({
  // Advanced filters
  capacityMin: z.coerce.number()
    .int('Minimum capacity must be an integer')
    .min(1, 'Minimum capacity must be at least 1')
    .optional(),
  
  capacityMax: z.coerce.number()
    .int('Maximum capacity must be an integer')
    .max(1000, 'Maximum capacity must be at most 1000')
    .optional(),
  
  levelRange: z.string()
    .regex(/^\\d+-\\d+$/, 'Level range must be in format "min-max"')
    .optional(),
  
  // Student count filters
  studentCountMin: z.coerce.number()
    .int('Minimum student count must be an integer')
    .min(0, 'Minimum student count must be at least 0')
    .optional(),
  
  studentCountMax: z.coerce.number()
    .int('Maximum student count must be an integer')
    .min(0, 'Maximum student count must be at least 0')
    .optional(),
  
  // Subject count filters
  subjectCountMin: z.coerce.number()
    .int('Minimum subject count must be an integer')
    .min(0, 'Minimum subject count must be at least 0')
    .optional(),
  
  subjectCountMax: z.coerce.number()
    .int('Maximum subject count must be an integer')
    .min(0, 'Maximum subject count must be at least 0')
    .optional(),
});

// ======================
// ANALYTICS SCHEMAS
// ======================

export const ClassAnalyticsSchema = z.object({
  period: z.enum(['7d', '30d', '90d', '1y', 'all'])
    .default('30d'),
  
  metrics: z.string()
    .regex(/^[a-zA-Z,]+$/, 'Metrics must be comma-separated values')
    .default('registration,activity,performance'),
  
  groupBy: z.enum(['day', 'week', 'month', 'quarter', 'year', 'level', 'section'])
    .default('day'),
  
  schoolId: z.coerce.number()
    .int('School ID must be an integer')
    .positive('School ID must be positive')
    .optional(),
  
  level: z.coerce.number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(20, 'Level must be at most 20')
    .optional(),
});

export const ClassPerformanceSchema = z.object({
  academicYear: z.string()
    .regex(/^\\d{4}-\\d{4}$/, 'Academic year must be in format "YYYY-YYYY"')
    .optional(),
  
  term: z.enum(['FIRST_TERM', 'SECOND_TERM', 'THIRD_TERM', 'SUMMER', 'WINTER'])
    .optional(),
  
  metrics: z.string()
    .regex(/^[a-zA-Z,]+$/, 'Metrics must be comma-separated values')
    .default('academic,attendance,behavior'),
  
  includeComparisons: z.coerce.boolean().default(true),
  
  schoolId: z.coerce.number()
    .int('School ID must be an integer')
    .positive('School ID must be positive')
    .optional(),
});

// ======================
// EXPORT/IMPORT SCHEMAS
// ======================

export const ClassExportSchema = z.object({
  format: z.enum(['json', 'csv', 'xlsx', 'pdf'])
    .default('json'),
  
  includeSensitiveData: z.coerce.boolean().default(false),
  
  includeRelations: z.coerce.boolean().default(true),
  
  filters: ClassSearchSchema.omit({ page: true, limit: true }).optional(),
});

export const ClassImportSchema = z.object({
  data: z.array(ClassCreateSchema.omit({ createdBy: true }))
    .min(1, 'At least one class is required')
    .max(1000, 'Maximum 1000 classes can be imported at once'),
  
  options: z.object({
    skipDuplicates: z.boolean().default(true),
    updateExisting: z.boolean().default(false),
    validateOnly: z.boolean().default(false),
    generateCodes: z.boolean().default(false),
    assignDefaultTeacher: z.boolean().default(false),
    defaultSchoolId: z.number()
      .int('Default school ID must be an integer')
      .positive('Default school ID must be positive')
      .optional(),
    defaultCreatedBy: z.number()
      .int('Default created by ID must be an integer')
      .positive('Default created by ID must be positive')
      .optional(),
  }).optional(),
});

// ======================
// UTILITY SCHEMAS
// ======================

export const ClassCodeGenerationSchema = z.object({
  name: z.string()
    .min(1, 'Class name is required')
    .max(100, 'Class name must be less than 100 characters'),
  
  level: z.number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(20, 'Level must be at most 20'),
  
  section: z.string()
    .max(10, 'Section must be less than 10 characters')
    .optional(),
  
  schoolId: z.number()
    .int('School ID must be an integer')
    .positive('School ID must be positive'),
});

export const ClassSectionGenerationSchema = z.object({
  level: z.number()
    .int('Level must be an integer')
    .min(1, 'Level must be at least 1')
    .max(20, 'Level must be at most 20'),
  
  count: z.number()
    .int('Count must be an integer')
    .min(1, 'Count must be at least 1')
    .max(20, 'Count must be at most 20')
    .default(1),
  
  prefix: z.string()
    .max(5, 'Prefix must be less than 5 characters')
    .default('A'),
  
  schoolId: z.number()
    .int('School ID must be an integer')
    .positive('School ID must be positive'),
});

// ======================
// RESPONSE SCHEMAS
// ======================

export const ClassResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.number(),
    uuid: z.string(),
    name: z.string(),
    code: z.string(),
    level: z.number(),
    section: z.string().nullable(),
    roomNumber: z.string().nullable(),
    capacity: z.number(),
    classTeacherId: z.number().nullable(),
    schoolId: z.number(),
    createdBy: z.number(),
    updatedBy: z.number().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable(),
    
    // Relations
    school: z.object({
      id: z.number(),
      name: z.string(),
      code: z.string(),
    }).optional(),
    
    classTeacher: z.object({
      id: z.number(),
      employeeId: z.string(),
      user: z.object({
        id: z.number(),
        firstName: z.string(),
        lastName: z.string(),
        email: z.string(),
      }),
    }).optional(),
    
    students: z.array(z.object({
      id: z.number(),
      admissionNo: z.string(),
      user: z.object({
        id: z.number(),
        firstName: z.string(),
        lastName: z.string(),
      }),
    })).optional(),
    
    subjects: z.array(z.object({
      id: z.number(),
      name: z.string(),
      code: z.string(),
    })).optional(),
    
    _count: z.object({
      students: z.number(),
      subjects: z.number(),
      timetables: z.number(),
      exams: z.number(),
    }).optional(),
  }),
  message: z.string().optional(),
  meta: z.object({
    timestamp: z.string(),
    source: z.string().optional(),
  }),
});

export const ClassListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(ClassResponseSchema.shape.data),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrev: z.boolean(),
  }),
  meta: z.object({
    timestamp: z.string(),
    source: z.string().optional(),
  }),
});

// ======================
// VALIDATION HELPERS
// ======================

export const validateClassCode = (code, schoolId, excludeId = null) => {
  return z.string()
    .min(1, 'Class code is required')
    .max(20, 'Class code must be less than 20 characters')
    .regex(/^[A-Z0-9\-_]+$/, 'Class code can only contain uppercase letters, numbers, hyphens, and underscores')
    .refine(async (code) => {
      // This would be implemented in the service to check uniqueness
      return true;
    }, 'Class code must be unique within the school');
};

export const validateClassCapacity = (capacity, currentStudentCount = 0) => {
  return z.number()
    .int('Capacity must be an integer')
    .min(1, 'Capacity must be at least 1')
    .max(1000, 'Capacity must be at most 1000')
    .refine((capacity) => capacity >= currentStudentCount, 
      'Capacity cannot be less than current student count');
};

// ======================
// DEFAULT VALUES
// ======================

export const DEFAULT_CLASS_VALUES = {
  capacity: 30,
  level: 1,
  section: 'A',
}; 
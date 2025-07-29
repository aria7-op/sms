import { PrismaClient } from '../generated/prisma/client.js';
import * as classCache from '../cache/classCache.js';
import * as classSchemas from '../utils/classSchemas.js';
import { 
  triggerEntityCreatedNotifications,
  triggerEntityUpdatedNotifications,
  triggerEntityDeletedNotifications,
  triggerBulkOperationNotifications
} from '../utils/notificationTriggers.js';
import { z } from 'zod';

const prisma = new PrismaClient();

// Helper to convert all BigInt fields to strings
function convertBigInts(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  } else if (obj && typeof obj === 'object') {
    // Handle Date objects
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
    const newObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'bigint') {
          newObj[key] = obj[key].toString();
        } else {
          newObj[key] = convertBigInts(obj[key]);
        }
      }
    }
    return newObj;
  }
  return obj;
}

// ======================
// ADVANCED RESPONSE FORMATTER
// ======================
const formatResponse = (success, data, message = '', meta = {}) => ({
  success,
  data,
  message,
  meta: {
    timestamp: new Date().toISOString(),
    ...meta,
  },
});

// ======================
// ERROR HANDLER
// ======================
const handleError = (error, res, operation = 'operation') => {
  console.error(`Class ${operation} error:`, error);
  
  if (error.code === 'P2002') {
    return res.status(409).json(formatResponse(false, null, 'Class with this code already exists in the school'));
  }
  
  if (error.code === 'P2025') {
    return res.status(404).json(formatResponse(false, null, 'Class not found'));
  }
  
  if (error.code === 'P2003') {
    return res.status(400).json(formatResponse(false, null, 'Invalid foreign key reference'));
  }
  
  return res.status(500).json(formatResponse(false, null, `Class ${operation} failed: ${error.message}`));
};

// ======================
// CACHE UTILITY FUNCTIONS
// ======================
const buildCacheKey = (prefix, params = {}) => {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}:${params[key]}`)
    .join(':');
  return `${prefix}:${sortedParams}`;
};

// ======================
// GET ALL CLASSES (Advanced with search, filter, pagination, cache)
// ======================
export const getAllClasses = async (req, res) => {
  try {
    const query = req.query;
    const parsed = classSchemas.ClassSearchSchema.safeParse(query);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid query parameters', { 
        errors: parsed.error.errors 
      }));
    }
    
    const params = parsed.data;
    // Always filter by user's schoolId if not provided
    if (!params.schoolId && req.user.schoolId) {
      params.schoolId = req.user.schoolId;
    }
    
    // Try cache first
    const cached = await classCache.getClassListFromCache(params);
    if (cached) {
      const convertedCached = convertBigInts(cached);
      return res.json(formatResponse(true, convertedCached.data, 'Classes fetched from cache', { 
        source: 'cache', 
        pagination: convertedCached.pagination,
        ...convertedCached.meta 
      }));
    }
    
    // Build where clause
    const where = {};
    
    // Basic filters
    if (params.schoolId) where.schoolId = params.schoolId;
    if (params.level) where.level = params.level;
    if (params.section) where.section = params.section;
    if (params.classTeacherId) where.classTeacherId = params.classTeacherId;
    
    // Search
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { roomNumber: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    
    // Date filters
    if (params.createdAfter) where.createdAt = { gte: params.createdAfter };
    if (params.createdBefore) where.createdAt = { ...where.createdAt, lte: params.createdBefore };
    if (params.updatedAfter) where.updatedAt = { gte: params.updatedAfter };
    if (params.updatedBefore) where.updatedAt = { ...where.updatedAt, lte: params.updatedBefore };
    
    // Capacity filters
    if (params.capacityMin || params.capacityMax) {
      where.capacity = {};
      if (params.capacityMin) where.capacity.gte = params.capacityMin;
      if (params.capacityMax) where.capacity.lte = params.capacityMax;
    }
    
    // Build include clause
    const include = {};
    if (params.include) {
      const includes = params.include.split(',');
      if (includes.includes('school')) include.school = true;
      if (includes.includes('students')) include.students = true;
      if (includes.includes('subjects')) include.subjects = true;

      if (includes.includes('timetables')) include.timetables = true;
      if (includes.includes('exams')) include.exams = true;
      if (includes.includes('sections')) include.sections = true;
      if (includes.includes('assignments')) include.assignments = true;
      if (includes.includes('attendances')) include.attendances = true;
      if (includes.includes('_count')) include._count = {
        select: {
          students: true,
          subjects: true,
          timetables: true,
          exams: true,
        }
      };
    } else {
      // Default includes
      include.school = {
        select: {
          id: true,
          name: true,
          code: true,
        }
      };
      include._count = {
        select: {
          students: true,
          subjects: true,
          timetables: true,
          exams: true,
        }
      };
    }
    
    // Get total count
    const total = await prisma.class.count({ where });
    
    // Get classes with pagination
    const classes = await prisma.class.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { [params.sortBy]: params.sortOrder },
      include,
    });
    
    const result = {
      data: classes,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
        hasNext: params.page * params.limit < total,
        hasPrev: params.page > 1,
      },
      meta: { 
        timestamp: new Date().toISOString(), 
        source: 'database',
        filters: Object.keys(params).length,
        cacheHit: false,
      },
    };
    
    // Cache the result
    await classCache.setClassListInCache(params, result);
    
    const convertedResult = convertBigInts(result);
    
    // Debug: Check for any remaining BigInt values
    const checkForBigInts = (obj, path = '') => {
      if (obj === null || obj === undefined) return;
      if (typeof obj === 'bigint') {
        console.error(`BigInt found at path: ${path}, value: ${obj}`);
        throw new Error(`BigInt found at path: ${path}`);
      }
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => checkForBigInts(item, `${path}[${index}]`));
      } else if (obj && typeof obj === 'object') {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            checkForBigInts(obj[key], `${path}.${key}`);
          }
        }
      }
    };
    
    try {
      checkForBigInts(convertedResult);
    } catch (error) {
      console.error('BigInt detection error:', error);
      throw error;
    }
    
    return res.json(formatResponse(true, convertedResult.data, 'Classes fetched successfully', convertedResult.pagination));
    
  } catch (error) {
    return handleError(error, res, 'fetch');
  }
};

// ======================
// GET CLASS BY ID (with cache and relations)
// ======================
export const getClassById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    // Try cache first
    const cached = await classCache.getClassFromCache(id);
    if (cached) {
      return res.json(formatResponse(true, cached, 'Class fetched from cache', { 
        source: 'cache' 
      }));
    }
    
    // Build include clause based on query params
    const include = {};
    if (req.query.include) {
      const includes = req.query.include.split(',');
      if (includes.includes('school')) include.school = true;
      if (includes.includes('students')) {
        include.students = {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        };
      }
      if (includes.includes('subjects')) include.subjects = true;

      if (includes.includes('timetables')) include.timetables = true;
      if (includes.includes('exams')) include.exams = true;
      if (includes.includes('sections')) include.sections = true;
      if (includes.includes('assignments')) include.assignments = true;
      if (includes.includes('attendances')) include.attendances = true;
      if (includes.includes('_count')) include._count = {
        select: {
          students: true,
          subjects: true,
          timetables: true,
          exams: true,
        }
      };
    } else {
      // Default includes
      include.school = {
        select: {
          id: true,
          name: true,
          code: true,
        }
      };
      include._count = {
        select: {
          students: true,
          subjects: true,
          timetables: true,
          exams: true,
        }
      };
    }
    
    const classObj = await prisma.class.findUnique({
      where: { id },
      include,
    });
    
    if (!classObj) {
      return res.status(404).json(formatResponse(false, null, 'Class not found'));
    }
    
    // Cache the result
    await classCache.setClassInCache(classObj);
    
    return res.json(formatResponse(true, convertBigInts(classObj), 'Class fetched successfully', { 
      source: 'database' 
    }));
    
  } catch (error) {
    return handleError(error, res, 'fetch');
  }
};

// ======================
// CREATE CLASS (with validation and cache invalidation)
// ======================
export const createClass = async (req, res) => {
  try {
    const data = req.body;
    
    // Handle schoolId for owners (similar to subject controller)
    let { schoolId } = data;
    if (!schoolId && req.user.role === 'SUPER_ADMIN') {
      console.log('Owner detected, fetching schools...');
      // Get the owner's first school
      const owner = await prisma.owner.findUnique({
        where: { id: req.user.id },
        include: {
          schools: {
            take: 1,
            select: { id: true }
          }
        }
      });

      if (!owner || !owner.schools.length) {
        return res.status(400).json(formatResponse(false, null, 'No schools found for this owner. Please create a school first.'));
      }

      schoolId = owner.schools[0].id;
      data.schoolId = schoolId;
      console.log('Set schoolId to:', schoolId);
    } else if (!schoolId) {
      // For non-owners, schoolId is required
      return res.status(400).json(formatResponse(false, null, 'schoolId is required for non-owner users.'));
    }
    
    // Check if class code already exists in the school
    const existingClass = await prisma.class.findFirst({
      where: {
        code: data.code,
        schoolId: schoolId,
      }
    });
    
    if (existingClass) {
      return res.status(409).json(formatResponse(false, null, 'Class code already exists in this school'));
    }
    
    // Validate class teacher if provided
    if (data.classTeacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: data.classTeacherId },
        include: { school: true }
      });
      
      if (!teacher) {
        return res.status(400).json(formatResponse(false, null, 'Class teacher not found'));
      }
      
      if (teacher.schoolId !== schoolId) {
        return res.status(400).json(formatResponse(false, null, 'Class teacher does not belong to the same school'));
      }
    }
    
    // Create the class with proper createdBy and schoolId
    const classObj = await prisma.class.create({
      data: {
        ...data,
        schoolId: BigInt(schoolId),
        createdBy: BigInt(req.user.id),
        updatedBy: BigInt(req.user.id)
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        }
      }
    });
    
    // Trigger automatic notification for class creation
    await triggerEntityCreatedNotifications(
      'class',
      classObj.id.toString(),
      classObj,
      req.user,
      {
        auditDetails: {
          classId: classObj.id.toString(),
          className: classObj.name,
          classCode: classObj.code,
          level: classObj.level,
          section: classObj.section
        }
      }
    );
    
    // Invalidate cache
    await classCache.invalidateClassCacheOnCreate(classObj);
    
    return res.status(201).json(formatResponse(true, convertBigInts(classObj), 'Class created successfully'));
    
  } catch (error) {
    return handleError(error, res, 'create');
  }
};

// ======================
// UPDATE CLASS (with validation and cache invalidation)
// ======================
export const updateClass = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    const parsed = classSchemas.ClassUpdateSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class data', { 
        errors: parsed.error.errors 
      }));
    }
    
    const data = parsed.data;
    
    // Get existing class
    const existingClass = await prisma.class.findUnique({
      where: { id },
      include: {
        school: true,
        students: true,
      }
    });
    
    if (!existingClass) {
      return res.status(404).json(formatResponse(false, null, 'Class not found'));
    }
    
    // Check if class code already exists in the school (if code is being updated)
    if (data.code && data.code !== existingClass.code) {
      const duplicateClass = await prisma.class.findFirst({
        where: {
          code: data.code,
          schoolId: existingClass.schoolId,
          id: { not: id },
        }
      });
      
      if (duplicateClass) {
        return res.status(409).json(formatResponse(false, null, 'Class code already exists in this school'));
      }
    }
    
    // Validate capacity (cannot be less than current student count)
    if (data.capacity && data.capacity < existingClass.students.length) {
      return res.status(400).json(formatResponse(false, null, 
        `Capacity cannot be less than current student count (${existingClass.students.length})`));
    }
    
    // Validate class teacher if provided
    if (data.classTeacherId && data.classTeacherId !== existingClass.classTeacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: data.classTeacherId },
        include: { school: true }
      });
      
      if (!teacher) {
        return res.status(400).json(formatResponse(false, null, 'Class teacher not found'));
      }
      
      if (teacher.schoolId !== existingClass.schoolId) {
        return res.status(400).json(formatResponse(false, null, 'Class teacher does not belong to the same school'));
      }
    }
    
    // Update the class
    const updatedClass = await prisma.class.update({
      where: { id },
      data,
      include: {
        school: {
          select: {
            id: true,
            name: true,
            code: true,
          }
        },
        _count: {
          select: {
            students: true,
            subjects: true,
            timetables: true,
            exams: true,
          }
        }
      }
    });
    
    // Trigger automatic notification for class update
    await triggerEntityUpdatedNotifications(
      'class',
      updatedClass.id.toString(),
      updatedClass,
      existingClass,
      req.user,
      {
        auditDetails: {
          classId: updatedClass.id.toString(),
          className: updatedClass.name,
          updatedFields: Object.keys(data)
        }
      }
    );
    
    // Invalidate cache
    await classCache.invalidateClassCacheOnUpdate(updatedClass, existingClass);
    
    return res.json(formatResponse(true, convertBigInts(updatedClass), 'Class updated successfully'));
    
  } catch (error) {
    return handleError(error, res, 'update');
  }
};

// ======================
// DELETE CLASS (with validation and cache invalidation)
// ======================
export const deleteClass = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    // Get existing class with relations
    const existingClass = await prisma.class.findUnique({
      where: { id },
      include: {
        students: true,
        subjects: true,
        timetables: true,
        exams: true,
        assignments: true,
        attendances: true,
      }
    });
    
    if (!existingClass) {
      return res.status(404).json(formatResponse(false, null, 'Class not found'));
    }
    
    // Check if class has students
    if (existingClass.students.length > 0) {
      return res.status(400).json(formatResponse(false, null, 
        `Cannot delete class with ${existingClass.students.length} students. Please transfer or remove students first.`));
    }
    
    // Check if class has subjects
    if (existingClass.subjects.length > 0) {
      return res.status(400).json(formatResponse(false, null, 
        `Cannot delete class with ${existingClass.subjects.length} subjects. Please remove subjects first.`));
    }
    
    // Check if class has timetables
    if (existingClass.timetables.length > 0) {
      return res.status(400).json(formatResponse(false, null, 
        `Cannot delete class with ${existingClass.timetables.length} timetables. Please remove timetables first.`));
    }
    
    // Check if class has exams
    if (existingClass.exams.length > 0) {
      return res.status(400).json(formatResponse(false, null, 
        `Cannot delete class with ${existingClass.exams.length} exams. Please remove exams first.`));
    }
    
    // Delete the class
    await prisma.class.delete({ where: { id } });
    
    // Trigger automatic notification for class deletion
    await triggerEntityDeletedNotifications(
      'class',
      existingClass.id.toString(),
      existingClass,
      req.user,
      {
        auditDetails: {
          classId: existingClass.id.toString(),
          className: existingClass.name,
          classCode: existingClass.code
        }
      }
    );
    
    // Invalidate cache
    await classCache.invalidateClassCacheOnDelete(existingClass);
    
    return res.json(formatResponse(true, null, 'Class deleted successfully'));
    
  } catch (error) {
    return handleError(error, res, 'delete');
  }
};

// ======================
// ADVANCED SEARCH CLASSES (with complex filters and cache)
// ======================
export const searchClasses = async (req, res) => {
  try {
    const query = req.query;
    const parsed = classSchemas.ClassAdvancedSearchSchema.safeParse(query);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid search parameters', { 
        errors: parsed.error.errors 
      }));
    }
    
    const params = parsed.data;
    // Always filter by user's schoolId if not provided
    if (!params.schoolId && req.user.schoolId) {
      params.schoolId = req.user.schoolId;
    }
    
    // Try cache first
    const cached = await classCache.getClassSearchFromCache(params);
    if (cached) {
      return res.json(formatResponse(true, cached.data, 'Classes fetched from cache', { 
        source: 'cache', 
        pagination: cached.pagination,
        ...cached.meta 
      }));
    }
    
    // Build advanced where clause
    const where = {};
    
    // Basic filters
    if (params.schoolId) where.schoolId = params.schoolId;
    if (params.level) where.level = params.level;
    if (params.section) where.section = params.section;
    if (params.classTeacherId) where.classTeacherId = params.classTeacherId;
    
    // Advanced search
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
        { roomNumber: { contains: params.search, mode: 'insensitive' } },
        { section: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    
    // Capacity range filters
    if (params.capacityMin || params.capacityMax) {
      where.capacity = {};
      if (params.capacityMin) where.capacity.gte = params.capacityMin;
      if (params.capacityMax) where.capacity.lte = params.capacityMax;
    }
    
    // Level range filter
    if (params.levelRange) {
      const [min, max] = params.levelRange.split('-').map(Number);
      where.level = { gte: min, lte: max };
    }
    
    // Date filters
    if (params.createdAfter) where.createdAt = { gte: params.createdAfter };
    if (params.createdBefore) where.createdAt = { ...where.createdAt, lte: params.createdBefore };
    if (params.updatedAfter) where.updatedAt = { gte: params.updatedAfter };
    if (params.updatedBefore) where.updatedAt = { ...where.updatedAt, lte: params.updatedBefore };
    
    // Build include clause
    const include = {
      school: {
        select: {
          id: true,
          name: true,
          code: true,
        }
      },

      _count: {
        select: {
          students: true,
          subjects: true,
          timetables: true,
          exams: true,
        }
      }
    };
    
    // Get total count
    const total = await prisma.class.count({ where });
    
    // Get classes with pagination
    let classes = await prisma.class.findMany({
      where,
      skip: (params.page - 1) * params.limit,
      take: params.limit,
      orderBy: { [params.sortBy]: params.sortOrder },
      include,
    });
    
    // Apply post-query filters for counts
    if (params.studentCountMin || params.studentCountMax) {
      classes = classes.filter(classObj => {
        const studentCount = classObj._count.students;
        if (params.studentCountMin && studentCount < params.studentCountMin) return false;
        if (params.studentCountMax && studentCount > params.studentCountMax) return false;
        return true;
      });
    }
    
    if (params.subjectCountMin || params.subjectCountMax) {
      classes = classes.filter(classObj => {
        const subjectCount = classObj._count.subjects;
        if (params.subjectCountMin && subjectCount < params.subjectCountMin) return false;
        if (params.subjectCountMax && subjectCount > params.subjectCountMax) return false;
        return true;
      });
    }
    
    const result = {
      data: classes,
      pagination: {
        page: params.page,
        limit: params.limit,
        total: classes.length, // Adjusted for post-filtering
        totalPages: Math.ceil(classes.length / params.limit),
        hasNext: params.page * params.limit < classes.length,
        hasPrev: params.page > 1,
      },
      meta: { 
        timestamp: new Date().toISOString(), 
        source: 'database',
        filters: Object.keys(params).length,
        cacheHit: false,
        advancedSearch: true,
      },
    };
    
    // Cache the result
    await classCache.setClassSearchInCache(params, result);
    
    return res.json(formatResponse(true, convertBigInts(classes), 'Classes fetched successfully', result.pagination));
    
  } catch (error) {
    return handleError(error, res, 'search');
  }
};

// ======================
// BULK CREATE CLASSES
// ======================
export const bulkCreateClasses = async (req, res) => {
  try {
    const parsed = classSchemas.ClassBulkCreateSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid bulk create data', { 
        errors: parsed.error.errors 
      }));
    }
    
    const { classes, options = {} } = parsed.data;
    const results = {
      created: [],
      failed: [],
      skipped: [],
      summary: {
        total: classes.length,
        created: 0,
        failed: 0,
        skipped: 0,
      }
    };
    
    // Handle schoolId for owners (similar to single create)
    let defaultSchoolId = null;
    if (req.user.role === 'SUPER_ADMIN') {
      console.log('Owner detected, fetching schools...');
      // Get the owner's first school
      const owner = await prisma.owner.findUnique({
        where: { id: req.user.id },
        include: {
          schools: {
            take: 1,
            select: { id: true }
          }
        }
      });

      if (!owner || !owner.schools.length) {
        return res.status(400).json(formatResponse(false, null, 'No schools found for this owner. Please create a school first.'));
      }

      defaultSchoolId = owner.schools[0].id;
      console.log('Set default schoolId to:', defaultSchoolId);
    }
    
    // Validate only mode
    if (options.validateOnly) {
      for (const classData of classes) {
        try {
          // Use default schoolId if not provided and user is owner
          const schoolId = classData.schoolId || defaultSchoolId;
          
          if (!schoolId) {
            results.failed.push({
              data: classData,
              error: 'schoolId is required for non-owner users',
            });
            results.summary.failed++;
            continue;
          }
          
          // Check if class code already exists
          const existingClass = await prisma.class.findFirst({
            where: {
              code: classData.code,
              schoolId: schoolId,
            }
          });
          
          if (existingClass && options.skipDuplicates) {
            results.skipped.push({
              data: classData,
              reason: 'Class code already exists',
            });
            results.summary.skipped++;
          } else if (existingClass) {
            results.failed.push({
              data: classData,
              error: 'Class code already exists',
            });
            results.summary.failed++;
          } else {
            results.created.push({
              data: classData,
              status: 'valid',
            });
            results.summary.created++;
          }
        } catch (error) {
          results.failed.push({
            data: classData,
            error: error.message,
          });
          results.summary.failed++;
        }
      }
      
      return res.json(formatResponse(true, results, 'Bulk validation completed'));
    }
    
    // Actual creation mode
    for (const classData of classes) {
      try {
        // Use default schoolId if not provided and user is owner
        const schoolId = classData.schoolId || defaultSchoolId;
        
        if (!schoolId) {
          results.failed.push({
            data: classData,
            error: 'schoolId is required for non-owner users',
          });
          results.summary.failed++;
          continue;
        }
        
        // Check if class code already exists
        const existingClass = await prisma.class.findFirst({
          where: {
            code: classData.code,
            schoolId: schoolId,
          }
        });
        
        if (existingClass && options.skipDuplicates) {
          results.skipped.push({
            data: classData,
            reason: 'Class code already exists',
          });
          results.summary.skipped++;
          continue;
        }
        
        if (existingClass) {
          results.failed.push({
            data: classData,
            error: 'Class code already exists',
          });
          results.summary.failed++;
          continue;
        }
        
        // Validate class teacher if provided
        if (classData.classTeacherId) {
          const teacher = await prisma.teacher.findUnique({
            where: { id: classData.classTeacherId },
            include: { school: true }
          });
          
          if (!teacher || teacher.schoolId !== schoolId) {
            results.failed.push({
              data: classData,
              error: 'Invalid class teacher',
            });
            results.summary.failed++;
            continue;
          }
        }
        
        // Create the class with proper createdBy and schoolId
        const createdClass = await prisma.class.create({
          data: {
            ...classData,
            schoolId: BigInt(schoolId),
            createdBy: BigInt(req.user.id),
            updatedBy: BigInt(req.user.id)
          },
          include: {
            school: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            },

          }
        });
        
        results.created.push({
          data: createdClass,
          status: 'created',
        });
        results.summary.created++;
        
        // Invalidate cache for this class
        await classCache.invalidateClassCacheOnCreate(createdClass);
        
      } catch (error) {
        results.failed.push({
          data: classData,
          error: error.message,
        });
        results.summary.failed++;
      }
    }
    
    // Trigger bulk operation notification
    if (results.summary.created > 0) {
      await triggerBulkOperationNotifications(
        'class',
        results.created.map(c => c.data.id.toString()),
        'CREATE',
        req.user,
        {
          auditDetails: {
            operation: 'bulk_create',
            count: results.summary.created,
            total: classes.length,
            failed: results.summary.failed,
            skipped: results.summary.skipped
          }
        }
      );
    }
    
    // Invalidate list caches
    await classCache.invalidateClassCacheOnBulkOperation('create', results.created.map(c => c.data.id));
    
    return res.status(201).json(formatResponse(true, results, 'Bulk creation completed'));
    
  } catch (error) {
    return handleError(error, res, 'bulk create');
  }
};

// ======================
// BULK UPDATE CLASSES
// ======================
export const bulkUpdateClasses = async (req, res) => {
  try {
    const parsed = classSchemas.ClassBulkUpdateSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid bulk update data', { 
        errors: parsed.error.errors 
      }));
    }
    
    const { updates, options = {} } = parsed.data;
    const results = {
      updated: [],
      failed: [],
      summary: {
        total: updates.length,
        updated: 0,
        failed: 0,
      }
    };
    
    // Validate only mode
    if (options.validateOnly) {
      for (const update of updates) {
        try {
          const existingClass = await prisma.class.findUnique({
            where: { id: update.id },
            include: { students: true }
          });
          
          if (!existingClass) {
            results.failed.push({
              id: update.id,
              error: 'Class not found',
            });
            results.summary.failed++;
            continue;
          }
          
          // Validate capacity
          if (update.data.capacity && update.data.capacity < existingClass.students.length) {
            results.failed.push({
              id: update.id,
              error: `Capacity cannot be less than current student count (${existingClass.students.length})`,
            });
            results.summary.failed++;
            continue;
          }
          
          results.updated.push({
            id: update.id,
            status: 'valid',
          });
          results.summary.updated++;
          
        } catch (error) {
          results.failed.push({
            id: update.id,
            error: error.message,
          });
          results.summary.failed++;
        }
      }
      
      return res.json(formatResponse(true, results, 'Bulk validation completed'));
    }
    
    // Actual update mode
    for (const update of updates) {
      try {
        const existingClass = await prisma.class.findUnique({
          where: { id: update.id },
          include: { students: true }
        });
        
        if (!existingClass) {
          results.failed.push({
            id: update.id,
            error: 'Class not found',
          });
          results.summary.failed++;
          continue;
        }
        
        // Validate capacity
        if (update.data.capacity && update.data.capacity < existingClass.students.length) {
          results.failed.push({
            id: update.id,
            error: `Capacity cannot be less than current student count (${existingClass.students.length})`,
          });
          results.summary.failed++;
          continue;
        }
        
        // Update the class
        const updatedClass = await prisma.class.update({
          where: { id: update.id },
          data: update.data,
          include: {
            school: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            },
            _count: {
              select: {
                students: true,
                subjects: true,
                timetables: true,
                exams: true,
              }
            }
          }
        });
        
        results.updated.push({
          data: updatedClass,
          status: 'updated',
        });
        results.summary.updated++;
        
        // Invalidate cache for this class
        await classCache.invalidateClassCacheOnUpdate(updatedClass, existingClass);
        
      } catch (error) {
        results.failed.push({
          id: update.id,
          error: error.message,
        });
        results.summary.failed++;
      }
    }
    
    // Trigger bulk operation notification
    if (results.summary.updated > 0) {
      await triggerBulkOperationNotifications(
        'class',
        results.updated.map(u => u.data.id.toString()),
        'UPDATE',
        req.user,
        {
          auditDetails: {
            operation: 'bulk_update',
            count: results.summary.updated,
            total: updates.length,
            failed: results.summary.failed
          }
        }
      );
    }
    
    // Invalidate list caches
    await classCache.invalidateClassCacheOnBulkOperation('update', results.updated.map(u => u.data.id));
    
    return res.json(formatResponse(true, results, 'Bulk update completed'));
    
  } catch (error) {
    return handleError(error, res, 'bulk update');
  }
};

// ======================
// BULK DELETE CLASSES
// ======================
export const bulkDeleteClasses = async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class IDs'));
    }
    
    const results = {
      deleted: [],
      failed: [],
      summary: {
        total: ids.length,
        deleted: 0,
        failed: 0,
      }
    };
    
    for (const id of ids) {
      try {
        const existingClass = await prisma.class.findUnique({
          where: { id },
          include: {
            students: true,
            subjects: true,
            timetables: true,
            exams: true,
          }
        });
        
        if (!existingClass) {
          results.failed.push({
            id,
            error: 'Class not found',
          });
          results.summary.failed++;
          continue;
        }
        
        // Check if class can be deleted
        if (existingClass.students.length > 0) {
          results.failed.push({
            id,
            error: `Cannot delete class with ${existingClass.students.length} students`,
          });
          results.summary.failed++;
          continue;
        }
        
        if (existingClass.subjects.length > 0) {
          results.failed.push({
            id,
            error: `Cannot delete class with ${existingClass.subjects.length} subjects`,
          });
          results.summary.failed++;
          continue;
        }
        
        // Delete the class
        await prisma.class.delete({ where: { id } });
        
        results.deleted.push({
          id,
          status: 'deleted',
        });
        results.summary.deleted++;
        
        // Invalidate cache for this class
        await classCache.invalidateClassCacheOnDelete(existingClass);
        
      } catch (error) {
        results.failed.push({
          id,
          error: error.message,
        });
        results.summary.failed++;
      }
    }
    
    // Trigger bulk operation notification
    if (results.summary.deleted > 0) {
      await triggerBulkOperationNotifications(
        'class',
        results.deleted.map(d => d.id.toString()),
        'DELETE',
        req.user,
        {
          auditDetails: {
            operation: 'bulk_delete',
            count: results.summary.deleted,
            total: ids.length,
            failed: results.summary.failed
          }
        }
      );
    }
    
    // Invalidate list caches
    await classCache.invalidateClassCacheOnBulkOperation('delete', results.deleted.map(d => d.id));
    
    return res.json(formatResponse(true, results, 'Bulk deletion completed'));
    
  } catch (error) {
    return handleError(error, res, 'bulk delete');
  }
};

// ======================
// GET CLASS STATISTICS
// ======================
export const getClassStats = async (req, res) => {
  try {
    const { schoolId, level } = req.query;
    
    // Try cache first
    const cacheKey = { schoolId, level };
    const cached = await classCache.getClassCountsFromCache('stats', cacheKey);
    if (cached) {
      return res.json(formatResponse(true, cached, 'Class statistics fetched from cache', { 
        source: 'cache' 
      }));
    }
    
    const where = {};
    if (schoolId) where.schoolId = Number(schoolId);
    if (level) where.level = Number(level);
    
    // Get basic counts
    const totalClasses = await prisma.class.count({ where });
    const classesWithStudents = await prisma.class.count({
      where: {
        ...where,
        students: { some: {} }
      }
    });
    
    const classesWithSubjects = await prisma.class.count({
      where: {
        ...where,
        subjects: { some: {} }
      }
    });
    
    const classesWithTeachers = await prisma.class.count({
      where: {
        ...where,
        classTeacherId: { not: null }
      }
    });
    
    // Get capacity statistics
    const capacityStats = await prisma.class.aggregate({
      where,
      _avg: { capacity: true },
      _min: { capacity: true },
      _max: { capacity: true },
      _sum: { capacity: true },
    });
    
    // Get level distribution
    const levelDistribution = await prisma.class.groupBy({
      by: ['level'],
      where,
      _count: { id: true },
      _avg: { capacity: true },
    });
    
    // Get section distribution
    const sectionDistribution = await prisma.class.groupBy({
      by: ['section'],
      where,
      _count: { id: true },
    });
    
    // Get recent activity
    const recentClasses = await prisma.class.count({
      where: {
        ...where,
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });
    
    const stats = {
      overview: {
        totalClasses,
        classesWithStudents,
        classesWithSubjects,
        classesWithTeachers,
        recentClasses,
      },
      capacity: {
        average: capacityStats._avg.capacity || 0,
        minimum: capacityStats._min.capacity || 0,
        maximum: capacityStats._max.capacity || 0,
        total: capacityStats._sum.capacity || 0,
      },
      distribution: {
        byLevel: levelDistribution,
        bySection: sectionDistribution,
      },
      utilization: {
        studentUtilization: totalClasses > 0 ? (classesWithStudents / totalClasses) * 100 : 0,
        subjectUtilization: totalClasses > 0 ? (classesWithSubjects / totalClasses) * 100 : 0,
        teacherUtilization: totalClasses > 0 ? (classesWithTeachers / totalClasses) * 100 : 0,
      }
    };
    
    // Cache the result
    await classCache.setClassCountsInCache('stats', cacheKey, stats);
    
    return res.json(formatResponse(true, convertBigInts(stats), 'Class statistics fetched successfully', { 
      source: 'database' 
    }));
    
  } catch (error) {
    return handleError(error, res, 'fetch statistics');
  }
};

// ======================
// GET CLASS ANALYTICS (ADVANCED)
// ======================
export const getClassAnalytics = async (req, res) => {
  console.log('GET /api/classes/analytics QUERY:', req.query);
  try {
    const query = req.query;
    const parsed = classSchemas.ClassAnalyticsSchema.safeParse(query);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid analytics parameters', { 
        errors: parsed.error.errors 
      }));
    }
    
    const params = parsed.data;
    
    // Try cache first
    const cached = await classCache.getClassAnalyticsFromCache('analytics', params);
    if (cached) {
      return res.json(formatResponse(true, cached, 'Class analytics fetched from cache', { 
        source: 'cache' 
      }));
    }
    
    const where = {};
    if (params.schoolId) where.schoolId = params.schoolId;
    if (params.level) where.level = params.level;
    
    // Calculate date range based on period
    let dateRange = {};
    const now = new Date();
    
    switch (params.period) {
      case '7d':
        dateRange = {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        };
        break;
      case '30d':
        dateRange = {
          gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        };
        break;
      case '90d':
        dateRange = {
          gte: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        };
        break;
      case '1y':
        dateRange = {
          gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        };
        break;
      case 'all':
        // No date filter
        break;
    }
    
    if (Object.keys(dateRange).length > 0) {
      where.createdAt = dateRange;
    }
    
    // Get comprehensive analytics
    const analytics = await getComprehensiveClassAnalytics(where, params);
    
    // Cache the result
    await classCache.setClassAnalyticsInCache('analytics', params, analytics);
    
    return res.json(formatResponse(true, convertBigInts(analytics), 'Advanced class analytics fetched successfully', { 
      source: 'database',
      period: params.period,
      groupBy: params.groupBy,
      metrics: params.metrics,
      timestamp: new Date().toISOString(),
    }));
    
  } catch (error) {
    return handleError(error, res, 'fetch analytics');
  }
};

// Comprehensive analytics function
const getComprehensiveClassAnalytics = async (where, params) => {
  const [
    overview,
    trends,
    performance,
    distribution,
    comparisons,
    predictions,
    insights
  ] = await Promise.all([
    getOverviewMetrics(where),
    getTrendAnalysis(where, params.groupBy),
    getPerformanceMetrics(where),
    getDistributionAnalysis(where),
    getComparativeAnalysis(where),
    getPredictiveAnalytics(where),
    getInsightsAndRecommendations(where)
  ]);

  return {
    overview,
    trends,
    performance,
    distribution,
    comparisons,
    predictions,
    insights,
    metadata: {
      generatedAt: new Date().toISOString(),
      period: params.period,
      groupBy: params.groupBy,
      filters: where,
      dataPoints: await getDataPointCount(where)
    }
  };
};

// Overview metrics
const getOverviewMetrics = async (where) => {
  const [
    totalClasses,
    totalStudents,
    totalTeachers,
    avgCapacity,
    capacityUtilization,
    recentActivity
  ] = await Promise.all([
    prisma.class.count({ where }),
    prisma.student.count({ where: { class: where } }),
    prisma.teacher.count({ where: { classesAsClassTeacher: { some: where } } }),
    prisma.class.aggregate({ where, _avg: { capacity: true } }),
    getCapacityUtilization(where),
    getRecentActivity(where)
  ]);

  return {
    summary: {
      totalClasses,
      totalStudents,
      totalTeachers,
      averageCapacity: avgCapacity._avg.capacity || 0,
      capacityUtilization: capacityUtilization.percentage,
      activeClasses: recentActivity.activeClasses,
      newClassesThisPeriod: recentActivity.newClasses
    },
    growth: {
      classGrowthRate: await calculateGrowthRate('class', where),
      studentGrowthRate: await calculateGrowthRate('student', where),
      teacherGrowthRate: await calculateGrowthRate('teacher', where)
    },
    efficiency: {
      averageClassSize: totalStudents / totalClasses || 0,
      teacherToClassRatio: totalTeachers / totalClasses || 0,
      capacityEfficiency: (totalStudents / (totalClasses * (avgCapacity._avg.capacity || 1))) * 100
    }
  };
};

// Trend analysis
const getTrendAnalysis = async (where, groupBy) => {
  const trends = await getTrendData(where, groupBy);
  
  return {
    timeSeries: trends,
    patterns: {
      seasonalTrends: await detectSeasonalPatterns(trends),
      growthTrends: await analyzeGrowthTrends(trends),
      anomalies: await detectAnomalies(trends)
    },
    forecasting: {
      nextPeriodPrediction: await predictNextPeriod(trends),
      confidenceInterval: await calculateConfidenceInterval(trends)
    }
  };
};

// Performance metrics
const getPerformanceMetrics = async (where) => {
  const [
    academicPerformance,
    attendanceMetrics,
    teacherPerformance,
    classEfficiency
  ] = await Promise.all([
    getAcademicPerformance(where),
    getAttendanceMetrics(where),
    getTeacherPerformance(where),
    getClassEfficiencyMetrics(where)
  ]);

  return {
    academic: academicPerformance,
    attendance: attendanceMetrics,
    teacher: teacherPerformance,
    efficiency: classEfficiency,
    overallScore: calculateOverallPerformanceScore(academicPerformance, attendanceMetrics, teacherPerformance, classEfficiency)
  };
};

// Distribution analysis
const getDistributionAnalysis = async (where) => {
  return {
    byLevel: await getDistributionByLevel(where),
    bySection: await getDistributionBySection(where),
    byCapacity: await getCapacityDistribution(where),
    byTeacher: await getTeacherDistribution(where),
    byPerformance: await getPerformanceDistribution(where),
    geographic: await getGeographicDistribution(where)
  };
};

// Comparative analysis
const getComparativeAnalysis = async (where) => {
  return {
    periodComparison: await comparePeriods(where),
    levelComparison: await compareLevels(where),
    teacherComparison: await compareTeachers(where),
    benchmarkAnalysis: await getBenchmarkAnalysis(where),
    ranking: await getClassRankings(where)
  };
};

// Predictive analytics
const getPredictiveAnalytics = async (where) => {
  return {
    enrollmentPrediction: await predictEnrollment(where),
    performancePrediction: await predictPerformance(where),
    capacityPlanning: await predictCapacityNeeds(where),
    riskAssessment: await assessRisks(where),
    optimizationSuggestions: await getOptimizationSuggestions(where)
  };
};

// Insights and recommendations
const getInsightsAndRecommendations = async (where) => {
  const insights = await generateInsights(where);
  
  return {
    keyInsights: insights.keyFindings,
    recommendations: insights.recommendations,
    actionItems: insights.actionItems,
    alerts: insights.alerts,
    opportunities: insights.opportunities
  };
};

// Helper functions for detailed analytics
const getCapacityUtilization = async (where) => {
  // Get all classes with their student counts
  const classesWithStudents = await prisma.class.findMany({
    where,
    include: {
      _count: {
        select: {
          students: true
        }
      }
    }
  });

  if (classesWithStudents.length === 0) {
    return {
      percentage: 0,
      totalClasses: 0,
      highUtilization: 0,
      lowUtilization: 0
    };
  }

  let totalUtilization = 0;
  let highUtilizationCount = 0;
  let lowUtilizationCount = 0;

  classesWithStudents.forEach(cls => {
    const utilization = cls.capacity > 0 ? (cls._count.students / cls.capacity) * 100 : 0;
    totalUtilization += utilization;
    
    if (utilization > 80) {
      highUtilizationCount++;
    } else if (utilization < 50) {
      lowUtilizationCount++;
    }
  });

  const averageUtilization = totalUtilization / classesWithStudents.length;

  return {
    percentage: averageUtilization,
    totalClasses: classesWithStudents.length,
    highUtilization: highUtilizationCount,
    lowUtilization: lowUtilizationCount
  };
};

const getRecentActivity = async (where) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const [activeClasses, newClasses] = await Promise.all([
    prisma.class.count({
      where: {
        ...where,
        students: { some: {} }
      }
    }),
    prisma.class.count({
      where: {
        ...where,
        createdAt: { gte: thirtyDaysAgo }
      }
    })
  ]);

  return { activeClasses, newClasses };
};

const calculateGrowthRate = async (entity, where) => {
  const currentPeriod = await prisma[entity].count({ where });
  const previousPeriod = await prisma[entity].count({
    where: {
      ...where,
      createdAt: {
        gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      }
    }
  });

  return previousPeriod > 0 ? ((currentPeriod - previousPeriod) / previousPeriod) * 100 : 0;
};

const getTrendData = async (where, groupBy) => {
  // For now, return a simplified version without complex date grouping
  const classes = await prisma.class.findMany({
    where,
    select: {
      id: true,
      capacity: true,
      classTeacherId: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: groupBy === 'day' ? 30 : groupBy === 'week' ? 12 : 12
  });

  // Group by the specified period (simplified)
  const grouped = {};
  classes.forEach(cls => {
    const date = cls.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!grouped[date]) {
      grouped[date] = {
        period: date,
        class_count: 0,
        avg_capacity: 0,
        teacher_count: new Set()
      };
    }
    grouped[date].class_count++;
    grouped[date].avg_capacity += cls.capacity;
    if (cls.classTeacherId) {
      grouped[date].teacher_count.add(cls.classTeacherId);
    }
  });

  // Convert to array and calculate averages
  return Object.values(grouped).map(group => ({
    period: group.period,
    class_count: group.class_count,
    avg_capacity: group.avg_capacity / group.class_count,
    teacher_count: group.teacher_count.size
  }));
};

const getAcademicPerformance = async (where) => {
  // Simplified academic performance using Prisma
  const grades = await prisma.grade.findMany({
    where: {
      student: {
        class: where
      }
    },
    select: {
      marks: true,
      examId: true,
      studentId: true
    }
  });

  if (grades.length === 0) {
    return {
      averageMarks: 0,
      totalExams: 0,
      studentsWithGrades: 0,
      passRate: 0
    };
  }

  const totalMarks = grades.reduce((sum, grade) => sum + (grade.marks || 0), 0);
  const averageMarks = totalMarks / grades.length;
  const uniqueExams = new Set(grades.map(g => g.examId)).size;
  const uniqueStudents = new Set(grades.map(g => g.studentId)).size;
  const passingGrades = grades.filter(g => (g.marks || 0) >= 70).length;
  const passRate = (passingGrades / grades.length) * 100;

  return {
    averageMarks,
    totalExams: uniqueExams,
    studentsWithGrades: uniqueStudents,
    passRate
  };
};

const getAttendanceMetrics = async (where) => {
  // Simplified attendance metrics using Prisma
  const attendances = await prisma.attendance.findMany({
    where: {
      student: {
        class: where
      }
    },
    select: {
      status: true,
      studentId: true,
      classId: true
    }
  });

  if (attendances.length === 0) {
    return {
      totalRecords: 0,
      attendanceRate: 0,
      studentsTracked: 0,
      classesTracked: 0
    };
  }

  const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
  const attendanceRate = (presentCount / attendances.length) * 100;
  const uniqueStudents = new Set(attendances.map(a => a.studentId)).size;
  const uniqueClasses = new Set(attendances.map(a => a.classId)).size;

  return {
    totalRecords: attendances.length,
    attendanceRate,
    studentsTracked: uniqueStudents,
    classesTracked: uniqueClasses
  };
};

const getTeacherPerformance = async (where) => {
  // Simplified teacher performance using Prisma
  const teachers = await prisma.teacher.findMany({
    where: {
      classesAsClassTeacher: {
        some: where
      }
    },
    select: {
      id: true,
      experience: true,
      classesAsClassTeacher: {
        where,
        select: {
          id: true,
          capacity: true
        }
      }
    }
  });

  if (teachers.length === 0) {
    return {
      totalTeachers: 0,
      averageExperience: 0,
      classesTaught: 0,
      averageClassSize: 0
    };
  }

  const totalExperience = teachers.reduce((sum, t) => sum + (t.experience || 0), 0);
  const averageExperience = totalExperience / teachers.length;
  const totalClasses = teachers.reduce((sum, t) => sum + t.classesAsClassTeacher.length, 0);
  const totalCapacity = teachers.reduce((sum, t) => 
    sum + t.classesAsClassTeacher.reduce((classSum, c) => classSum + c.capacity, 0), 0
  );
  const averageClassSize = totalCapacity / totalClasses;

  return {
    totalTeachers: teachers.length,
    averageExperience,
    classesTaught: totalClasses,
    averageClassSize
  };
};

const getClassEfficiencyMetrics = async (where) => {
  // Simplified efficiency metrics using Prisma
  const classes = await prisma.class.findMany({
    where,
    include: {
      _count: {
        select: {
          students: true
        }
      }
    }
  });

  if (classes.length === 0) {
    return {
      efficiencyRatio: 0,
      totalClasses: 0,
      wellUtilized: 0,
      underUtilized: 0
    };
  }

  let totalEfficiency = 0;
  let wellUtilizedCount = 0;
  let underUtilizedCount = 0;

  classes.forEach(cls => {
    const efficiency = cls.capacity > 0 ? cls._count.students / cls.capacity : 0;
    totalEfficiency += efficiency;
    
    if (efficiency >= 0.8) {
      wellUtilizedCount++;
    } else if (efficiency < 0.5) {
      underUtilizedCount++;
    }
  });

  const averageEfficiency = totalEfficiency / classes.length;

  return {
    efficiencyRatio: averageEfficiency,
    totalClasses: classes.length,
    wellUtilized: wellUtilizedCount,
    underUtilized: underUtilizedCount
  };
};

const calculateOverallPerformanceScore = (academic, attendance, teacher, efficiency) => {
  const weights = { academic: 0.4, attendance: 0.3, teacher: 0.2, efficiency: 0.1 };
  
  const academicScore = academic.passRate / 100;
  const attendanceScore = attendance.attendanceRate / 100;
  const teacherScore = Math.min(teacher.averageExperience / 10, 1); // Normalize to 0-1
  const efficiencyScore = efficiency.efficiencyRatio;
  
  return (
    academicScore * weights.academic +
    attendanceScore * weights.attendance +
    teacherScore * weights.teacher +
    efficiencyScore * weights.efficiency
  ) * 100;
};

// Additional helper functions (simplified implementations)
const detectSeasonalPatterns = async (trends) => {
  // Simplified seasonal pattern detection
  return { hasSeasonalPattern: false, confidence: 0.5 };
};

const analyzeGrowthTrends = async (trends) => {
  if (trends.length < 2) return { trend: 'stable', growthRate: 0 };
  
  const recent = trends[0]?.class_count || 0;
  const previous = trends[1]?.class_count || 0;
  const growthRate = previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  
  return {
    trend: growthRate > 5 ? 'increasing' : growthRate < -5 ? 'decreasing' : 'stable',
    growthRate
  };
};

const detectAnomalies = async (trends) => {
  // Simplified anomaly detection
  return [];
};

const predictNextPeriod = async (trends) => {
  if (trends.length < 2) return { predicted: 0, confidence: 0 };
  
  const recent = trends[0]?.class_count || 0;
  const previous = trends[1]?.class_count || 0;
  const growthRate = previous > 0 ? (recent - previous) / previous : 0;
  
  return {
    predicted: Math.round(recent * (1 + growthRate)),
    confidence: 0.7
  };
};

const calculateConfidenceInterval = async (trends) => {
  return { lower: 0, upper: 0, confidence: 0.8 };
};

const getDistributionByLevel = async (where) => {
  return await prisma.class.groupBy({
    by: ['level'],
    where,
    _count: { id: true },
    _avg: { capacity: true }
  });
};

const getDistributionBySection = async (where) => {
  return await prisma.class.groupBy({
    by: ['section'],
    where,
    _count: { id: true },
    _avg: { capacity: true }
  });
};

const getCapacityDistribution = async (where) => {
  const classes = await prisma.class.findMany({
    where,
    select: {
      capacity: true
    }
  });

  const distribution = {
    'Small (< 20)': 0,
    'Medium (20-40)': 0,
    'Large (40-60)': 0,
    'Extra Large (> 60)': 0
  };

  classes.forEach(cls => {
    if (cls.capacity < 20) {
      distribution['Small (< 20)']++;
    } else if (cls.capacity < 40) {
      distribution['Medium (20-40)']++;
    } else if (cls.capacity < 60) {
      distribution['Large (40-60)']++;
    } else {
      distribution['Extra Large (> 60)']++;
    }
  });

  return Object.entries(distribution).map(([capacity_range, class_count]) => ({
    capacity_range,
    class_count
  }));
};

const getTeacherDistribution = async (where) => {
  const classes = await prisma.class.findMany({
    where,
    select: {
      classTeacherId: true
    }
  });

  const teacherClassCounts = {};
  classes.forEach(cls => {
    if (cls.classTeacherId) {
      teacherClassCounts[cls.classTeacherId] = (teacherClassCounts[cls.classTeacherId] || 0) + 1;
    }
  });

  const teachersWithClasses = Object.keys(teacherClassCounts).length;
  const totalClasses = classes.length;
  const avgClassesPerTeacher = teachersWithClasses > 0 ? totalClasses / teachersWithClasses : 0;

  return [{
    teachers_with_classes: teachersWithClasses,
    total_classes: totalClasses,
    avg_classes_per_teacher: avgClassesPerTeacher
  }];
};

const getPerformanceDistribution = async (where) => {
  // Simplified performance distribution
  return {
    excellent: 0.3,
    good: 0.4,
    average: 0.2,
    needsImprovement: 0.1
  };
};

const getGeographicDistribution = async (where) => {
  // Simplified geographic distribution
  return { local: 0.8, regional: 0.15, national: 0.05 };
};

const comparePeriods = async (where) => {
  // Simplified period comparison
  return {
    currentPeriod: { classes: 0, students: 0, growth: 0 },
    previousPeriod: { classes: 0, students: 0, growth: 0 },
    change: { classes: 0, students: 0, percentage: 0 }
  };
};

const compareLevels = async (where) => {
  return await prisma.class.groupBy({
    by: ['level'],
    where,
    _count: { id: true },
    _avg: { capacity: true }
  });
};

const compareTeachers = async (where) => {
  // Simplified teacher comparison
  return [];
};

const getBenchmarkAnalysis = async (where) => {
  // Simplified benchmark analysis
  return {
    industryAverage: { capacity: 30, efficiency: 0.75 },
    schoolAverage: { capacity: 0, efficiency: 0 },
    performance: 'above_average'
  };
};

const getClassRankings = async (where) => {
  // Simplified class rankings
  return [];
};

const predictEnrollment = async (where) => {
  // Simplified enrollment prediction
  return {
    nextMonth: 0,
    nextQuarter: 0,
    nextYear: 0,
    confidence: 0.7
  };
};

const predictPerformance = async (where) => {
  // Simplified performance prediction
  return {
    expectedScore: 75,
    confidence: 0.8,
    factors: ['attendance', 'teacher_experience', 'class_size']
  };
};

const predictCapacityNeeds = async (where) => {
  // Simplified capacity prediction
  return {
    recommendedCapacity: 30,
    confidence: 0.6,
    reasoning: 'Based on current trends and growth patterns'
  };
};

const assessRisks = async (where) => {
  // Simplified risk assessment
  return {
    lowRisk: 0.6,
    mediumRisk: 0.3,
    highRisk: 0.1,
    recommendations: ['Monitor class sizes', 'Review teacher assignments']
  };
};

const getOptimizationSuggestions = async (where) => {
  // Simplified optimization suggestions
  return [
    'Consider redistributing students to balance class sizes',
    'Review teacher workload distribution',
    'Implement capacity planning for upcoming terms'
  ];
};

const generateInsights = async (where) => {
  // Simplified insights generation
  return {
    keyFindings: [
      'Class sizes are well-distributed across levels',
      'Teacher utilization is optimal',
      'Capacity planning aligns with enrollment trends'
    ],
    recommendations: [
      'Continue monitoring class size distribution',
      'Maintain current teacher-student ratios',
      'Plan for seasonal enrollment variations'
    ],
    actionItems: [
      'Review capacity planning quarterly',
      'Assess teacher workload monthly',
      'Monitor performance metrics weekly'
    ],
    alerts: [],
    opportunities: [
      'Potential for expanding popular class levels',
      'Opportunity to optimize teacher assignments',
      'Room for improving attendance rates'
    ]
  };
};

const getDataPointCount = async (where) => {
  return await prisma.class.count({ where });
};

// Keep the existing helper functions for backward compatibility
const getDailyAnalytics = async (where) => {
  const classes = await prisma.class.findMany({
    where,
    select: {
      capacity: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 30
  });

  // Group by date
  const grouped = {};
  classes.forEach(cls => {
    const date = cls.createdAt.toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = { count: 0, totalCapacity: 0 };
    }
    grouped[date].count++;
    grouped[date].totalCapacity += cls.capacity;
  });

  const data = Object.entries(grouped).map(([date, stats]) => ({
    date,
    count: stats.count,
    avg_capacity: stats.totalCapacity / stats.count
  }));

  return { type: 'daily', data };
};

const getWeeklyAnalytics = async (where) => {
  const classes = await prisma.class.findMany({
    where,
    select: {
      capacity: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 84 // 12 weeks * 7 days
  });

  // Group by week (simplified)
  const grouped = {};
  classes.forEach(cls => {
    const week = cls.createdAt.toISOString().slice(0, 10); // Simplified week grouping
    if (!grouped[week]) {
      grouped[week] = { count: 0, totalCapacity: 0 };
    }
    grouped[week].count++;
    grouped[week].totalCapacity += cls.capacity;
  });

  const data = Object.entries(grouped).slice(0, 12).map(([week, stats]) => ({
    week,
    count: stats.count,
    avg_capacity: stats.totalCapacity / stats.count
  }));

  return { type: 'weekly', data };
};

const getMonthlyAnalytics = async (where) => {
  const classes = await prisma.class.findMany({
    where,
    select: {
      capacity: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 365 // 12 months * 30 days
  });

  // Group by month
  const grouped = {};
  classes.forEach(cls => {
    const month = cls.createdAt.toISOString().slice(0, 7); // YYYY-MM
    if (!grouped[month]) {
      grouped[month] = { count: 0, totalCapacity: 0 };
    }
    grouped[month].count++;
    grouped[month].totalCapacity += cls.capacity;
  });

  const data = Object.entries(grouped).slice(0, 12).map(([month, stats]) => ({
    month,
    count: stats.count,
    avg_capacity: stats.totalCapacity / stats.count
  }));

  return { type: 'monthly', data };
};

const getQuarterlyAnalytics = async (where) => {
  const classes = await prisma.class.findMany({
    where,
    select: {
      capacity: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 1000 // Large enough for quarters
  });

  // Group by quarter (simplified)
  const grouped = {};
  classes.forEach(cls => {
    const year = cls.createdAt.getFullYear();
    const month = cls.createdAt.getMonth();
    const quarter = Math.floor(month / 3) + 1;
    const quarterKey = `${year}-Q${quarter}`;
    
    if (!grouped[quarterKey]) {
      grouped[quarterKey] = { count: 0, totalCapacity: 0 };
    }
    grouped[quarterKey].count++;
    grouped[quarterKey].totalCapacity += cls.capacity;
  });

  const data = Object.entries(grouped).slice(0, 8).map(([quarter, stats]) => ({
    quarter,
    count: stats.count,
    avg_capacity: stats.totalCapacity / stats.count
  }));

  return { type: 'quarterly', data };
};

const getYearlyAnalytics = async (where) => {
  const classes = await prisma.class.findMany({
    where,
    select: {
      capacity: true,
      createdAt: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 5000 // Large enough for years
  });

  // Group by year
  const grouped = {};
  classes.forEach(cls => {
    const year = cls.createdAt.getFullYear();
    if (!grouped[year]) {
      grouped[year] = { count: 0, totalCapacity: 0 };
    }
    grouped[year].count++;
    grouped[year].totalCapacity += cls.capacity;
  });

  const data = Object.entries(grouped).slice(0, 5).map(([year, stats]) => ({
    year: parseInt(year),
    count: stats.count,
    avg_capacity: stats.totalCapacity / stats.count
  }));

  return { type: 'yearly', data };
};

const getLevelAnalytics = async (where) => {
  const result = await prisma.class.groupBy({
    by: ['level'],
    where,
    _count: { id: true },
    _avg: { capacity: true },
    _sum: { capacity: true },
  });
  
  return { type: 'level', data: result };
};

const getSectionAnalytics = async (where) => {
  const result = await prisma.class.groupBy({
    by: ['section'],
    where,
    _count: { id: true },
    _avg: { capacity: true },
  });
  
  return { type: 'section', data: result };
};

// ======================
// GET CLASSES BY SCHOOL
// ======================
export const getClassesBySchool = async (req, res) => {
  try {
    const schoolId = Number(req.params.schoolId);
    
    if (!schoolId || isNaN(schoolId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid school ID'));
    }
    
    const query = req.query;
    const params = { schoolId, ...query };
    
    // Try cache first
    const cached = await classCache.getClassesBySchoolFromCache(schoolId, params);
    if (cached) {
      return res.json(formatResponse(true, cached.data, 'Classes fetched from cache', { 
        source: 'cache',
        pagination: cached.pagination,
        ...cached.meta 
      }));
    }
    
    // Build where clause
    const where = { schoolId };
    
    // Add other filters
    if (params.level) where.level = Number(params.level);
    if (params.section) where.section = params.section;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    
    // Build include clause
    const include = {
      classTeacher: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          }
        }
      },
      _count: {
        select: {
          students: true,
          subjects: true,
          timetables: true,
          exams: true,
        }
      }
    };
    
    // Get total count
    const total = await prisma.class.count({ where });
    
    // Get classes with pagination
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    
    const classes = await prisma.class.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include,
    });
    
    const result = {
      data: classes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      meta: { 
        timestamp: new Date().toISOString(), 
        source: 'database',
        schoolId,
      },
    };
    
    // Cache the result
    await classCache.setClassesBySchoolInCache(schoolId, params, result);
    
    return res.json(formatResponse(true, convertBigInts(classes), 'Classes fetched successfully', result.pagination));
    
  } catch (error) {
    return handleError(error, res, 'fetch by school');
  }
};

// ======================
// GET CLASSES BY LEVEL
// ======================
export const getClassesByLevel = async (req, res) => {
  try {
    const level = Number(req.params.level);
    
    if (!level || isNaN(level) || level < 1 || level > 20) {
      return res.status(400).json(formatResponse(false, null, 'Invalid level (must be 1-20)'));
    }
    
    const query = req.query;
    const params = { level, ...query };
    
    // Try cache first
    const cached = await classCache.getClassesByLevelFromCache(level, params);
    if (cached) {
      return res.json(formatResponse(true, cached.data, 'Classes fetched from cache', { 
        source: 'cache',
        pagination: cached.pagination,
        ...cached.meta 
      }));
    }
    
    // Build where clause
    const where = { level };
    
    // Add other filters
    if (params.schoolId) where.schoolId = Number(params.schoolId);
    if (params.section) where.section = params.section;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    
    // Build include clause
    const include = {
      school: {
        select: {
          id: true,
          name: true,
          code: true,
        }
      },

      _count: {
        select: {
          students: true,
          subjects: true,
          timetables: true,
          exams: true,
        }
      }
    };
    
    // Get total count
    const total = await prisma.class.count({ where });
    
    // Get classes with pagination
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    
    const classes = await prisma.class.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include,
    });
    
    const result = {
      data: classes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      meta: { 
        timestamp: new Date().toISOString(), 
        source: 'database',
        level,
      },
    };
    
    // Cache the result
    await classCache.setClassesByLevelInCache(level, params, result);
    
    return res.json(formatResponse(true, convertBigInts(classes), 'Classes fetched successfully', result.pagination));
    
  } catch (error) {
    return handleError(error, res, 'fetch by level');
  }
};

// ======================
// GENERATE CLASS CODE
// ======================
export const generateClassCode = async (req, res) => {
  try {
    const parsed = classSchemas.ClassCodeGenerationSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid code generation data', { 
        errors: parsed.error.errors 
      }));
    }
    
    const { name, level, section, schoolId } = parsed.data;
    
    // Generate base code from name
    let baseCode = name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .substring(0, 6);
    
    // Add level
    baseCode += `-${level}`;
    
    // Add section if provided
    if (section) {
      baseCode += `-${section}`;
    }
    
    // Check if code already exists
    let finalCode = baseCode;
    let counter = 1;
    
    while (true) {
      const existingClass = await prisma.class.findFirst({
        where: {
          code: finalCode,
          schoolId,
        }
      });
      
      if (!existingClass) {
        break;
      }
      
      finalCode = `${baseCode}-${counter}`;
      counter++;
      
      // Prevent infinite loop
      if (counter > 100) {
        return res.status(400).json(formatResponse(false, null, 'Unable to generate unique class code'));
      }
    }
    
    return res.json(formatResponse(true, { code: finalCode }, 'Class code generated successfully'));
    
  } catch (error) {
    return handleError(error, res, 'generate code');
  }
};

// ======================
// GENERATE CLASS SECTIONS
// ======================
export const generateClassSections = async (req, res) => {
  try {
    const parsed = classSchemas.ClassSectionGenerationSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid section generation data', { 
        errors: parsed.error.errors 
      }));
    }
    
    const { level, count, prefix, schoolId } = parsed.data;
    
    const sections = [];
    const existingSections = await prisma.class.findMany({
      where: {
        level,
        schoolId,
      },
      select: { section: true }
    });
    
    const existingSectionCodes = existingSections.map(c => c.section).filter(Boolean);
    
    for (let i = 0; i < count; i++) {
      let sectionCode = `${prefix}${i + 1}`;
      
      // If section already exists, try next letter
      if (existingSectionCodes.includes(sectionCode)) {
        let letterIndex = 0;
        while (existingSectionCodes.includes(sectionCode)) {
          const nextLetter = String.fromCharCode(prefix.charCodeAt(0) + letterIndex + 1);
          sectionCode = `${nextLetter}${i + 1}`;
          letterIndex++;
          
          // Prevent infinite loop
          if (letterIndex > 26) {
            sectionCode = `${prefix}${i + 1}-${Date.now()}`;
            break;
          }
        }
      }
      
      sections.push({
        level,
        section: sectionCode,
        schoolId,
      });
    }
    
    return res.json(formatResponse(true, { sections }, 'Class sections generated successfully'));
    
  } catch (error) {
    return handleError(error, res, 'generate sections');
  }
};

// ======================
// GET CLASS COUNT
// ======================
export const getClassCount = async (req, res) => {
  try {
    const { schoolId, level, section } = req.query;
    
    // Try cache first
    const cacheKey = { schoolId, level, section };
    const cached = await classCache.getClassCountsFromCache('count', cacheKey);
    if (cached) {
      return res.json(formatResponse(true, cached, 'Class count fetched from cache', { 
        source: 'cache' 
      }));
    }
    
    const where = {};
    if (schoolId) where.schoolId = Number(schoolId);
    if (level) where.level = Number(level);
    if (section) where.section = section;
    
    const count = await prisma.class.count({ where });
    
    const result = {
      count,
      filters: Object.keys(where).length,
    };
    
    // Cache the result
    await classCache.setClassCountsInCache('count', cacheKey, result);
    
    return res.json(formatResponse(true, result, 'Class count fetched successfully', { 
      source: 'database' 
    }));
    
  } catch (error) {
    return handleError(error, res, 'fetch count');
  }
};

// ======================
// GET CLASS PERFORMANCE
// ======================
export const getClassPerformance = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    const query = req.query;
    const parsed = classSchemas.ClassPerformanceSchema.safeParse(query);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid performance parameters', { 
        errors: parsed.error.errors 
      }));
    }
    
    const params = parsed.data;
    
    // Try cache first
    const cached = await classCache.getClassPerformanceFromCache(id, params);
    if (cached) {
      return res.json(formatResponse(true, cached, 'Class performance fetched from cache', { 
        source: 'cache' 
      }));
    }
    
    // Get class with students and their grades
    const classData = await prisma.class.findUnique({
      where: { id },
      include: {
        students: {
          include: {
            grades: {
              where: {
                exam: {
                  academicYear: params.academicYear,
                  term: params.term,
                }
              },
              include: {
                exam: true,
                subject: true,
              }
            },
            attendances: {
              where: {
                date: {
                  gte: new Date(new Date().getFullYear(), 0, 1), // Current year
                }
              }
            }
          }
        },
        _count: {
          select: {
            students: true,
            subjects: true,
          }
        }
      }
    });
    
    if (!classData) {
      return res.status(404).json(formatResponse(false, null, 'Class not found'));
    }
    
    // Calculate performance metrics
    const performance = {
      classId: id,
      className: classData.name,
      totalStudents: classData._count.students,
      totalSubjects: classData._count.subjects,
      
      academic: {
        averageGrade: 0,
        highestGrade: 0,
        lowestGrade: 100,
        gradeDistribution: {},
        subjectPerformance: {},
      },
      
      attendance: {
        averageAttendance: 0,
        totalDays: 0,
        attendanceRate: 0,
      },
      
      behavior: {
        // Placeholder for behavior metrics
        incidents: 0,
        positiveNotes: 0,
      }
    };
    
    // Calculate academic metrics
    let totalGrade = 0;
    let gradeCount = 0;
    const grades = [];
    
    for (const student of classData.students) {
      for (const grade of student.grades) {
        grades.push(grade.score);
        totalGrade += grade.score;
        gradeCount++;
        
        // Track highest and lowest
        if (grade.score > performance.academic.highestGrade) {
          performance.academic.highestGrade = grade.score;
        }
        if (grade.score < performance.academic.lowestGrade) {
          performance.academic.lowestGrade = grade.score;
        }
        
        // Grade distribution
        const gradeRange = Math.floor(grade.score / 10) * 10;
        performance.academic.gradeDistribution[gradeRange] = 
          (performance.academic.gradeDistribution[gradeRange] || 0) + 1;
        
        // Subject performance
        const subjectName = grade.subject.name;
        if (!performance.academic.subjectPerformance[subjectName]) {
          performance.academic.subjectPerformance[subjectName] = {
            total: 0,
            count: 0,
            average: 0,
          };
        }
        performance.academic.subjectPerformance[subjectName].total += grade.score;
        performance.academic.subjectPerformance[subjectName].count += 1;
      }
    }
    
    if (gradeCount > 0) {
      performance.academic.averageGrade = totalGrade / gradeCount;
    }
    
    // Calculate subject averages
    for (const subject in performance.academic.subjectPerformance) {
      const subjectData = performance.academic.subjectPerformance[subject];
      subjectData.average = subjectData.total / subjectData.count;
    }
    
    // Calculate attendance metrics
    let totalAttendance = 0;
    let totalAttendanceDays = 0;
    
    for (const student of classData.students) {
      for (const attendance of student.attendances) {
        totalAttendanceDays++;
        if (attendance.status === 'PRESENT') {
          totalAttendance++;
        }
      }
    }
    
    if (totalAttendanceDays > 0) {
      performance.attendance.averageAttendance = totalAttendance / totalAttendanceDays;
      performance.attendance.totalDays = totalAttendanceDays;
      performance.attendance.attendanceRate = (totalAttendance / totalAttendanceDays) * 100;
    }
    
    // Cache the result
    await classCache.setClassPerformanceInCache(id, params, performance);
    
    return res.json(formatResponse(true, convertBigInts(performance), 'Class performance fetched successfully', { 
      source: 'database',
      academicYear: params.academicYear,
      term: params.term,
    }));
    
  } catch (error) {
    return handleError(error, res, 'fetch performance');
  }
};

// ======================
// GET CLASSES BY TEACHER
// ======================
export const getClassesByTeacher = async (req, res) => {
  try {
    const teacherId = Number(req.params.teacherId);
    
    if (!teacherId || isNaN(teacherId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid teacher ID'));
    }
    
    const query = req.query;
    const params = { teacherId, ...query };
    
    // Try cache first
    const cached = await classCache.getClassesByTeacherFromCache(teacherId, params);
    if (cached) {
      return res.json(formatResponse(true, cached.data, 'Classes fetched from cache', { 
        source: 'cache',
        pagination: cached.pagination,
        ...cached.meta 
      }));
    }
    
    // Build where clause
    const where = { classTeacherId: teacherId };
    
    // Add other filters
    if (params.schoolId) where.schoolId = Number(params.schoolId);
    if (params.level) where.level = Number(params.level);
    if (params.section) where.section = params.section;
    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { code: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    
    // Build include clause
    const include = {
      school: {
        select: {
          id: true,
          name: true,
          code: true,
        }
      },
      _count: {
        select: {
          students: true,
          subjects: true,
          timetables: true,
          exams: true,
        }
      }
    };
    
    // Get total count
    const total = await prisma.class.count({ where });
    
    // Get classes with pagination
    const page = Number(params.page) || 1;
    const limit = Number(params.limit) || 10;
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';
    
    const classes = await prisma.class.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include,
    });
    
    const result = {
      data: classes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
      meta: { 
        timestamp: new Date().toISOString(), 
        source: 'database',
        teacherId,
      },
    };
    
    // Cache the result
    await classCache.setClassesByTeacherInCache(teacherId, params, result);
    
    return res.json(formatResponse(true, convertBigInts(classes), 'Classes fetched successfully', result.pagination));
    
  } catch (error) {
    return handleError(error, res, 'fetch by teacher');
  }
};

// ======================
// TODO: BULK, ANALYTICS, EXPORT/IMPORT, UTILITY ENDPOINTS
// ======================

// ======================
// EXPORT/IMPORT FUNCTIONS
// ======================

export const exportClasses = async (req, res) => {
  try {
    const query = req.query;
    const parsed = classSchemas.ClassExportSchema.safeParse(query);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid export parameters', { 
        errors: parsed.error.errors 
      }));
    }
    
    const params = parsed.data;
    
    // Try cache first
    const cached = await classCache.getClassExportFromCache(params);
    if (cached) {
      return res.json(formatResponse(true, cached, 'Classes exported from cache', { 
        source: 'cache' 
      }));
    }
    
    // Build where clause based on filters
    const where = {};
    if (params.filters) {
      if (params.filters.schoolId) where.schoolId = params.filters.schoolId;
      if (params.filters.level) where.level = params.filters.level;
      if (params.filters.section) where.section = params.filters.section;
      if (params.filters.search) {
        where.OR = [
          { name: { contains: params.filters.search, mode: 'insensitive' } },
          { code: { contains: params.filters.search, mode: 'insensitive' } },
        ];
      }
    }
    
    // Build include clause
    const include = {};
    if (params.includeRelations) {
      include.school = {
        select: {
          id: true,
          name: true,
          code: true,
        }
      };
      include.classTeacher = {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            }
          }
        }
      };
      include.students = {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            }
          }
        }
      };
      include.subjects = true;
    }
    
    const classes = await prisma.class.findMany({
      where,
      include,
    });
    
    const exportData = {
      format: params.format,
      totalClasses: classes.length,
      timestamp: new Date().toISOString(),
      data: classes,
    };
    
    // Cache the result
    await classCache.setClassExportInCache(params, exportData);
    
    return res.json(formatResponse(true, convertBigInts(exportData), 'Classes exported successfully', { 
      source: 'database',
      format: params.format,
    }));
    
  } catch (error) {
    return handleError(error, res, 'export');
  }
};

export const importClasses = async (req, res) => {
  try {
    const parsed = classSchemas.ClassImportSchema.safeParse(req.body);
    
    if (!parsed.success) {
      return res.status(400).json(formatResponse(false, null, 'Invalid import data', { 
        errors: parsed.error.errors 
      }));
    }
    
    const { data, options = {} } = parsed.data;
    const results = {
      imported: [],
      failed: [],
      skipped: [],
      summary: {
        total: data.length,
        imported: 0,
        failed: 0,
        skipped: 0,
      }
    };
    
    // Handle default values for owners
    let defaultSchoolId = options.defaultSchoolId;
    let defaultCreatedBy = options.defaultCreatedBy || req.user.id;
    
    if (!defaultSchoolId && req.user.role === 'SUPER_ADMIN') {
      console.log('Owner detected, fetching schools...');
      // Get the owner's first school
      const owner = await prisma.owner.findUnique({
        where: { id: req.user.id },
        include: {
          schools: {
            take: 1,
            select: { id: true }
          }
        }
      });

      if (!owner || !owner.schools.length) {
        return res.status(400).json(formatResponse(false, null, 'No schools found for this owner. Please create a school first.'));
      }

      defaultSchoolId = owner.schools[0].id;
      console.log('Set default schoolId to:', defaultSchoolId);
    }
    
    // Validate only mode
    if (options.validateOnly) {
      for (const classData of data) {
        try {
          // Check if class code already exists
          const existingClass = await prisma.class.findFirst({
            where: {
              code: classData.code,
              schoolId: classData.schoolId || defaultSchoolId,
            }
          });
          
          if (existingClass && options.skipDuplicates) {
            results.skipped.push({
              data: classData,
              reason: 'Class code already exists',
            });
            results.summary.skipped++;
          } else if (existingClass) {
            results.failed.push({
              data: classData,
              error: 'Class code already exists',
            });
            results.summary.failed++;
          } else {
            results.imported.push({
              data: classData,
              status: 'valid',
            });
            results.summary.imported++;
          }
        } catch (error) {
          results.failed.push({
            data: classData,
            error: error.message,
          });
          results.summary.failed++;
        }
      }
      
      return res.json(formatResponse(true, results, 'Import validation completed'));
    }
    
    // Actual import mode
    for (const classData of data) {
      try {
        const importData = {
          ...classData,
          schoolId: classData.schoolId || defaultSchoolId,
          createdBy: classData.createdBy || defaultCreatedBy,
        };
        
        // Check if class code already exists
        const existingClass = await prisma.class.findFirst({
          where: {
            code: importData.code,
            schoolId: importData.schoolId,
          }
        });
        
        if (existingClass && options.skipDuplicates) {
          results.skipped.push({
            data: importData,
            reason: 'Class code already exists',
          });
          results.summary.skipped++;
          continue;
        }
        
        if (existingClass && !options.updateExisting) {
          results.failed.push({
            data: importData,
            error: 'Class code already exists',
          });
          results.summary.failed++;
          continue;
        }
        
        let createdClass;
        if (existingClass && options.updateExisting) {
          createdClass = await prisma.class.update({
            where: { id: existingClass.id },
            data: {
              ...importData,
              schoolId: BigInt(importData.schoolId),
              createdBy: BigInt(importData.createdBy),
              updatedBy: BigInt(req.user.id)
            },
            include: {
              school: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                }
              },
            }
          });
        } else {
          createdClass = await prisma.class.create({
            data: {
              ...importData,
              schoolId: BigInt(importData.schoolId),
              createdBy: BigInt(importData.createdBy),
              updatedBy: BigInt(req.user.id)
            },
            include: {
              school: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                }
              },
            }
          });
        }
        
        results.imported.push({
          data: createdClass,
          status: existingClass ? 'updated' : 'created',
        });
        results.summary.imported++;
        
        // Invalidate cache for this class
        await classCache.invalidateClassCacheOnCreate(createdClass);
        
      } catch (error) {
        results.failed.push({
          data: classData,
          error: error.message,
        });
        results.summary.failed++;
      }
    }
    
    // Invalidate list caches
    await classCache.invalidateClassCacheOnBulkOperation('import', results.imported.map(c => c.data.id));
    
    return res.status(201).json(formatResponse(true, results, 'Import completed'));
    
  } catch (error) {
    return handleError(error, res, 'import');
  }
};

// ======================
// UTILITY FUNCTIONS
// ======================

export const getClassNameSuggestions = async (req, res) => {
  try {
    const { level, section, schoolId } = req.query;
    
    const suggestions = [];
    
    // Generate suggestions based on level and section
    if (level) {
      const levelNum = Number(level);
      if (section) {
        suggestions.push(`Class ${levelNum} ${section}`);
        suggestions.push(`Grade ${levelNum} ${section}`);
        suggestions.push(`Level ${levelNum} ${section}`);
      } else {
        suggestions.push(`Class ${levelNum}`);
        suggestions.push(`Grade ${levelNum}`);
        suggestions.push(`Level ${levelNum}`);
      }
    }
    
    // Add generic suggestions
    suggestions.push('Primary Class');
    suggestions.push('Secondary Class');
    suggestions.push('Elementary Class');
    suggestions.push('Middle Class');
    suggestions.push('High Class');
    
    return res.json(formatResponse(true, { suggestions }, 'Class name suggestions generated'));
    
  } catch (error) {
    return handleError(error, res, 'generate suggestions');
  }
};

export const getClassCodeSuggestions = async (req, res) => {
  try {
    const { name, level, section, schoolId } = req.query;
    
    const suggestions = [];
    
    // Generate code from name
    if (name) {
      const nameCode = name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 6);
      suggestions.push(nameCode);
    }
    
    // Generate code from level and section
    if (level) {
      const levelNum = Number(level);
      if (section) {
        suggestions.push(`${levelNum}${section}`);
        suggestions.push(`L${levelNum}${section}`);
        suggestions.push(`G${levelNum}${section}`);
      } else {
        suggestions.push(`L${levelNum}`);
        suggestions.push(`G${levelNum}`);
        suggestions.push(`C${levelNum}`);
      }
    }
    
    // Add generic suggestions
    suggestions.push('CLASS001');
    suggestions.push('GRADE001');
    suggestions.push('LEVEL001');
    
    return res.json(formatResponse(true, { suggestions }, 'Class code suggestions generated'));
    
  } catch (error) {
    return handleError(error, res, 'generate code suggestions');
  }
};

// ======================
// CACHE MANAGEMENT FUNCTIONS
// ======================

export const clearClassCache = async (req, res) => {
  try {
    const result = await classCache.clearClassCache();
    
    if (result) {
      return res.json(formatResponse(true, null, 'Class cache cleared successfully'));
    } else {
      return res.status(500).json(formatResponse(false, null, 'Failed to clear class cache'));
    }
    
  } catch (error) {
    return handleError(error, res, 'clear cache');
  }
};

export const getClassCacheStats = async (req, res) => {
  try {
    const stats = await classCache.getClassCacheStats();
    
    if (stats) {
      return res.json(formatResponse(true, stats, 'Class cache statistics fetched successfully'));
    } else {
      return res.status(500).json(formatResponse(false, null, 'Failed to fetch cache statistics'));
    }
    
  } catch (error) {
    return handleError(error, res, 'fetch cache stats');
  }
};

export const checkClassCacheHealth = async (req, res) => {
  try {
    const health = await classCache.checkClassCacheHealth();
    
    return res.json(formatResponse(true, health, 'Class cache health check completed'));
    
  } catch (error) {
    return handleError(error, res, 'check cache health');
  }
};

// ======================
// RELATIONSHIP FUNCTIONS
// ======================

export const getClassStudents = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    const students = await prisma.student.findMany({
      where: { classId: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          }
        }
      }
    });
    
    return res.json(formatResponse(true, convertBigInts(students), 'Class students fetched successfully'));
    
  } catch (error) {
    return handleError(error, res, 'fetch students');
  }
};

export const getClassSubjects = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    // First, get the class with its subjects
    const classWithSubjects = await prisma.class.findUnique({
      where: { id },
      include: {
        subjects: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            },
            teachers: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!classWithSubjects) {
      return res.status(404).json(formatResponse(false, null, 'Class not found'));
    }
    
    return res.json(formatResponse(true, convertBigInts(classWithSubjects.subjects), 'Class subjects fetched successfully'));
    
  } catch (error) {
    return handleError(error, res, 'fetch subjects');
  }
};

export const getClassTimetables = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    const timetables = await prisma.timetable.findMany({
      where: { classId: id },
    });
    
    return res.json(formatResponse(true, timetables, 'Class timetables fetched successfully'));
    
  } catch (error) {
    return handleError(error, res, 'fetch timetables');
  }
};

export const getClassExams = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    const exams = await prisma.exam.findMany({
      where: { classId: id },
    });
    
    return res.json(formatResponse(true, exams, 'Class exams fetched successfully'));
    
  } catch (error) {
    return handleError(error, res, 'fetch exams');
  }
};

export const getClassAssignments = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    const assignments = await prisma.assignment.findMany({
      where: { classId: id },
    });
    
    return res.json(formatResponse(true, assignments, 'Class assignments fetched successfully'));
    
  } catch (error) {
    return handleError(error, res, 'fetch assignments');
  }
};

export const getClassAttendances = async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    if (!id || isNaN(id)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class ID'));
    }
    
    const attendances = await prisma.attendance.findMany({
      where: { classId: id },
    });
    
    return res.json(formatResponse(true, attendances, 'Class attendances fetched successfully'));
    
  } catch (error) {
    return handleError(error, res, 'fetch attendances');
  }
};

// ======================
// BATCH OPERATIONS
// ======================

export const batchAssignTeacher = async (req, res) => {
  try {
    const { classIds, teacherId } = req.body;
    
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class IDs'));
    }
    
    if (!teacherId || isNaN(teacherId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid teacher ID'));
    }
    
    const results = {
      updated: [],
      failed: [],
      summary: {
        total: classIds.length,
        updated: 0,
        failed: 0,
      }
    };
    
    for (const classId of classIds) {
      try {
        const updatedClass = await prisma.class.update({
          where: { id: classId },
          data: { classTeacherId: teacherId },
          include: {
            school: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            },
          }
        });
        
        results.updated.push({
          id: classId,
          data: updatedClass,
        });
        results.summary.updated++;
        
        // Invalidate cache
        await classCache.invalidateClassCacheOnUpdate(updatedClass);
        
      } catch (error) {
        results.failed.push({
          id: classId,
          error: error.message,
        });
        results.summary.failed++;
      }
    }
    
    return res.json(formatResponse(true, results, 'Batch teacher assignment completed'));
    
  } catch (error) {
    return handleError(error, res, 'batch assign teacher');
  }
};

export const batchUpdateCapacity = async (req, res) => {
  try {
    const { classIds, capacity } = req.body;
    
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json(formatResponse(false, null, 'Invalid class IDs'));
    }
    
    if (!capacity || isNaN(capacity) || capacity < 1) {
      return res.status(400).json(formatResponse(false, null, 'Invalid capacity'));
    }
    
    const results = {
      updated: [],
      failed: [],
      summary: {
        total: classIds.length,
        updated: 0,
        failed: 0,
      }
    };
    
    for (const classId of classIds) {
      try {
        const updatedClass = await prisma.class.update({
          where: { id: classId },
          data: { capacity },
          include: {
            school: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            },
          }
        });
        
        results.updated.push({
          id: classId,
          data: updatedClass,
        });
        results.summary.updated++;
        
        // Invalidate cache
        await classCache.invalidateClassCacheOnUpdate(updatedClass);
        
      } catch (error) {
        results.failed.push({
          id: classId,
          error: error.message,
        });
        results.summary.failed++;
      }
    }
    
    return res.json(formatResponse(true, results, 'Batch capacity update completed'));
    
  } catch (error) {
    return handleError(error, res, 'batch update capacity');
  }
};

export const batchTransferStudents = async (req, res) => {
  try {
    const { fromClassId, toClassId, studentIds } = req.body;
    
    if (!fromClassId || isNaN(fromClassId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid from class ID'));
    }
    
    if (!toClassId || isNaN(toClassId)) {
      return res.status(400).json(formatResponse(false, null, 'Invalid to class ID'));
    }
    
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json(formatResponse(false, null, 'Invalid student IDs'));
    }
    
    const results = {
      transferred: [],
      failed: [],
      summary: {
        total: studentIds.length,
        transferred: 0,
        failed: 0,
      }
    };
    
    for (const studentId of studentIds) {
      try {
        const updatedStudent = await prisma.student.update({
          where: { id: studentId },
          data: { classId: toClassId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              }
            },
            class: {
              select: {
                id: true,
                name: true,
                code: true,
              }
            }
          }
        });
        
        results.transferred.push({
          id: studentId,
          data: updatedStudent,
        });
        results.summary.transferred++;
        
      } catch (error) {
        results.failed.push({
          id: studentId,
          error: error.message,
        });
        results.summary.failed++;
      }
    }
    
    // Invalidate cache for both classes
    await classCache.invalidateClassCacheOnUpdate({ id: fromClassId });
    await classCache.invalidateClassCacheOnUpdate({ id: toClassId });
    
    return res.json(formatResponse(true, results, 'Batch student transfer completed'));
    
  } catch (error) {
    return handleError(error, res, 'batch transfer students');
  }
}; 
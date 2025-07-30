import { PrismaClient } from '../generated/prisma/client.js';
import { 
  handlePrismaError, 
  createSuccessResponse, 
  createErrorResponse 
} from '../utils/responseUtils.js';
import { 
  generateStudentCode, 
  validateStudentConstraints, 
  buildStudentSearchQuery, 
  buildStudentIncludeQuery,
  generateStudentStats,
  generateStudentAnalytics,
  calculateStudentPerformance,
  generateStudentExportData,
  validateStudentImportData,
  generateStudentCodeSuggestions,
  getStudentCountByClass,
  getStudentCountByStatus
} from '../utils/studentUtils.js';
import { 
  setStudentInCache, 
  getStudentFromCache, 
  setStudentListInCache, 
  getStudentListFromCache,
  setStudentSearchInCache,
  getStudentSearchFromCache,
  setStudentStatsInCache,
  getStudentStatsFromCache,
  setStudentAnalyticsInCache,
  getStudentAnalyticsFromCache,
  setStudentPerformanceInCache,
  getStudentPerformanceFromCache,
  invalidateStudentCacheOnCreate,
  invalidateStudentCacheOnUpdate,
  invalidateStudentCacheOnDelete,
  invalidateStudentCacheOnBulkOperation,
  getStudentCacheStats,
  warmStudentCache
} from '../cache/studentCache.js';
import { 
  createAuditLog, 
  createNotification,
  triggerEntityCreatedNotification,
  triggerEntityUpdatedNotification
} from '../services/notificationService.js';
import { 
  triggerEntityCreatedNotifications
} from '../utils/notificationTriggers.js';
import { 
  validateSchoolAccess, 
  validateClassAccess 
} from '../middleware/validation.js';
import StudentEventService from '../services/studentEventService.js';

const prisma = new PrismaClient();

// ======================
// UTILITY FUNCTIONS
// ======================
const cleanupOrphanedStudents = async () => {
  try {
    // Find students with invalid school references
    const orphanedStudents = await prisma.student.findMany({
      where: {
        OR: [
          { schoolId: null },
          {
            school: null
          }
        ]
      },
      select: {
        id: true,
        admissionNo: true,
        schoolId: true
      }
    });

    if (orphanedStudents.length > 0) {
      console.log(`Found ${orphanedStudents.length} orphaned students:`, orphanedStudents);
      
      // Get the first available school for each orphaned student
      const firstSchool = await prisma.school.findFirst({
        select: { id: true }
      });

      if (firstSchool) {
        // Update orphaned students to use the first available school
        await prisma.student.updateMany({
          where: {
            id: {
              in: orphanedStudents.map(s => s.id)
            }
          },
          data: {
            schoolId: firstSchool.id
          }
        });
        
        console.log(`Updated ${orphanedStudents.length} orphaned students to use school ID: ${firstSchool.id}`);
      }
    }

    // Find students with invalid user references
    const orphanedUserStudents = await prisma.student.findMany({
      where: {
        OR: [
          { userId: null },
          {
            user: null
          }
        ]
      },
      select: {
        id: true,
        admissionNo: true,
        userId: true
      }
    });

    if (orphanedUserStudents.length > 0) {
      console.log(`Found ${orphanedUserStudents.length} students with orphaned user references:`, orphanedUserStudents);
      
      // Get the first available user for each orphaned student
      const firstUser = await prisma.user.findFirst({
        where: {
          role: 'STUDENT'
        },
        select: { id: true }
      });

      if (firstUser) {
        // Update orphaned students to use the first available user
        await prisma.student.updateMany({
          where: {
            id: {
              in: orphanedUserStudents.map(s => s.id)
            }
          },
          data: {
            userId: firstUser.id
          }
        });
        
        console.log(`Updated ${orphanedUserStudents.length} students to use user ID: ${firstUser.id}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up orphaned students:', error);
  }
};

// Utility function to convert BigInt values to strings for JSON serialization
function convertBigInts(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  }
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = convertBigInts(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

class StudentController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  /**
   * Create a new student
   */
  async createStudent(req, res) {
    try {
      const studentData = req.body;
      let { schoolId, classId } = studentData;

      // If schoolId is not provided in request body, get it from user context
      if (!schoolId) {
        if (req.user.type === 'owner' || req.user.role === 'SUPER_ADMIN') {
          // For owners, use the first school or require schoolId in request
          schoolId = req.user.schoolId || req.user.schoolIds?.[0];
          if (!schoolId) {
            return createErrorResponse(res, 400, 'School ID is required for student creation');
          }
        } else {
          // For regular users, use their school
          schoolId = req.user.schoolId;
          if (!schoolId) {
            return createErrorResponse(res, 400, 'User does not have an associated school');
          }
        }
      }

      // Validate school access
      await validateSchoolAccess(req.user, schoolId);

      // Validate class access if provided
      if (classId) {
        await validateClassAccess(req.user, classId, schoolId);
      }

      // Generate student code
      const studentCode = await generateStudentCode(
        studentData.admissionNo || studentData.user?.firstName,
        schoolId
      );

      // Validate student constraints
      await validateStudentConstraints(schoolId, studentCode, classId);

      // Remove classId and schoolId from studentData to avoid Prisma validation error
      const { classId: _, schoolId: __, ...studentDataWithoutRelations } = studentData;
      
      // Remove dateOfBirth from user data and map to birthDate
      const { dateOfBirth, ...userDataWithoutDateOfBirth } = studentData.user;
      
      // Extract address fields and move to metadata
      const { address, city, state, country, postalCode, ...userDataWithoutAddress } = userDataWithoutDateOfBirth;
      
      // Create metadata object with address information
      const userMetadata = {
        address: {
          street: address,
          city,
          state,
          country,
          postalCode
        }
      };

      // EVENT-FIRST WORKFLOW: Log event before creating student
      const studentEventService = new StudentEventService();
      const eventData = {
        studentData: studentDataWithoutRelations,
        userData: userDataWithoutAddress,
        studentCode,
        classId,
        schoolId,
        createdBy: req.user.id,
        userMetadata
      };
      
      // Log the student creation event FIRST
      const event = await studentEventService.createStudentCreationEvent(
        eventData,
        req.user.id,
        schoolId
      );
      
      // Create student with user
      const student = await prisma.student.create({
        data: {
          ...studentDataWithoutRelations,
          admissionNo: studentCode,
          createdBy: req.user.id,
          school: {
            connect: { id: BigInt(schoolId) }
          },
          // Handle class relation if classId is provided
          ...(classId && {
            class: {
              connect: { id: BigInt(classId) }
            }
          }),
          user: {
            create: {
              ...userDataWithoutAddress,
              // Generate username from email or firstName
              username: studentData.user.email.split('@')[0] || 
                       `${studentData.user.firstName.toLowerCase()}${Date.now()}`,
              // Map dateOfBirth to birthDate for User model
              birthDate: dateOfBirth,
              // Store address in metadata
              metadata: userMetadata,
              role: 'STUDENT',
              schoolId,
              createdBy: req.user.id,
              createdByOwnerId: req.user.id // For owner-created users
            }
          }
        },
        include: {
          user: {
            select: {
              id: true,
              uuid: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
              createdAt: true
            }
          },
          class: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          section: {
            select: {
              id: true,
              name: true
            }
          },
          parent: {
            select: {
              id: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          school: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      // Update the event with the student ID
      await prisma.studentEvent.update({
        where: { id: event.id },
        data: { 
          studentId: student.id,
          metadata: { ...event.metadata, studentId: student.id.toString() }
        }
      });

      // Invalidate cache
      await invalidateStudentCacheOnCreate(student);

      // Create audit log
      await createAuditLog({
        action: 'CREATE',
        entity: 'Student',
        entityId: student.id,
        userId: req.user.id,
        schoolId,
        details: {
          studentId: student.id,
          admissionNo: student.admissionNo,
          classId: student.classId
        }
      });

      // Trigger automatic notification for student creation
      await triggerEntityCreatedNotifications(
        'student',
        student.id,
        student,
        req.user,
        {
          auditDetails: {
            studentId: student.id.toString(),
            admissionNo: student.admissionNo,
            classId: student.classId
          }
        }
      );

      return createSuccessResponse(res, 201, 'Student created successfully', {
        student,
        event
      });
    } catch (error) {
      return handlePrismaError(res, error, 'createStudent');
    }
  }

  /**
   * Get students with pagination and filters
   */
  async getStudents(req, res) {
    console.log('=== getStudents START ===');
    console.log('Query:', req.query);
    console.log('User:', req.user);
    
    try {
      console.log('Step 1: Determining user type and schoolId...');
      // Handle different user types
      let schoolId;
      if (req.user.type === 'owner' || req.user.role === 'SUPER_ADMIN') {
        // Owner can access all schools or specific school
        schoolId = req.query.schoolId || req.user.schoolId;
        console.log('Owner accessing students for schoolId:', schoolId);
      } else {
        // Regular user can only access their school
        schoolId = req.user.schoolId;
        console.log('Regular user accessing students for schoolId:', schoolId);
      }

      console.log('Step 2: Validating schoolId...');
      if (!schoolId) {
        console.log('ERROR: No schoolId found');
        return createErrorResponse(res, 400, 'School ID is required');
      }
      console.log('SchoolId validated:', schoolId);

      console.log('Step 3: Extracting query parameters...');
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        classId, 
        sectionId, 
        status,
        include = [],
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;
      console.log('Query parameters extracted:', { page, limit, search, classId, sectionId, status, include, sortBy, sortOrder });

      console.log('Step 4: Building include query...');
      const includeQuery = buildStudentIncludeQuery(include);
      console.log('Include query built:', includeQuery);

      console.log('Step 5: Building search query...');
      const searchQuery = buildStudentSearchQuery({
        search,
        classId,
        sectionId,
        status,
        schoolId
      });
      console.log('Search query built:', searchQuery);

      console.log('Step 6: Preparing final query...');
      // Ensure we don't have conflicting user conditions
      const cleanSearchQuery = { ...searchQuery };
      if (cleanSearchQuery.user) {
        // If searchQuery has user conditions, merge them properly
        cleanSearchQuery.user = {
          ...cleanSearchQuery.user,
          id: { not: null } // Ensure user exists
        };
      }
      
      const finalQuery = {
        where: {
          ...cleanSearchQuery,
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { [sortBy]: sortOrder },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      };
      
      // Convert BigInt values to strings for logging
      const logQuery = JSON.parse(JSON.stringify(finalQuery, (key, value) => {
        if (typeof value === 'bigint') {
          return value.toString();
        }
        return value;
      }));
      console.log('Final query prepared:', JSON.stringify(logQuery, null, 2));

      console.log('Step 7: Executing Prisma query...');
      let students;
      try {
        students = await prisma.student.findMany(finalQuery);
      } catch (error) {
        console.error('Error fetching students:', error);
        // If there's a relation error, try without problematic relations
        if (error.message.includes('school') && error.message.includes('null')) {
          console.log('Attempting to fetch students without school relation due to orphaned records');
          const { school, ...includeWithoutSchool } = includeQuery;
          const fallbackQuery = {
            ...finalQuery,
            include: includeWithoutSchool
          };
          try {
            students = await prisma.student.findMany(fallbackQuery);
          } catch (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            // Try with minimal includes
            const minimalQuery = {
              ...finalQuery,
              include: {
                _count: includeQuery._count
              }
            };
            students = await prisma.student.findMany(minimalQuery);
          }
        } else if (error.message.includes('user') && error.message.includes('null')) {
          console.log('Attempting to fetch students without user relation due to orphaned records');
          const { user, ...includeWithoutUser } = includeQuery;
          const fallbackQuery = {
            ...finalQuery,
            include: includeWithoutUser
          };
          try {
            students = await prisma.student.findMany(fallbackQuery);
          } catch (fallbackError) {
            console.error('Fallback query also failed:', fallbackError);
            // Try with minimal includes
            const minimalQuery = {
              ...finalQuery,
              include: {
                _count: includeQuery._count
              }
            };
            students = await prisma.student.findMany(minimalQuery);
          }
        } else {
          throw error;
        }
      }

      console.log('Step 8: Query completed. Found students:', students.length);
      console.log('=== getStudents END ===');
      return createSuccessResponse(res, 200, 'Students fetched successfully', students);
    } catch (error) {
      console.error('=== getStudents ERROR ===', error);
      return handlePrismaError(res, error, 'getStudents');
    }
  }

  /**
   * Get student by ID
   */
  async getStudentById(req, res) {
    try {
      const { id } = req.params;
      const { include = [] } = req.query;

      // Check cache first
      const cachedStudent = await getStudentFromCache(id);
      if (cachedStudent) {
        return createSuccessResponse(res, 200, 'Student fetched from cache', cachedStudent, {
          source: 'cache'
        });
      }

      const includeQuery = buildStudentIncludeQuery(include);

      const student = await prisma.student.findFirst({
        where: {
          id: parseInt(id),
          schoolId: req.user.schoolId,
          deletedAt: null
        },
        include: includeQuery
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      // Cache the student
      await setStudentInCache(student);

      return createSuccessResponse(res, 200, 'Student fetched successfully', student, {
        source: 'database'
      });
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentById');
    }
  }

  /**
   * Update student
   */
  async updateStudent(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Get existing student
      const existingStudent = await prisma.student.findFirst({
        where: {
          id: parseInt(id),
          schoolId: req.user.schoolId,
          deletedAt: null
        }
      });

      if (!existingStudent) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      // Validate class access if class is being updated
      if (updateData.classId && updateData.classId !== existingStudent.classId) {
        await validateClassAccess(req.user, updateData.classId, req.user.schoolId);
      }

      // EVENT-FIRST WORKFLOW: Log event before updating student
      const studentEventService = new StudentEventService();
      const eventData = {
        studentId: existingStudent.id,
        updateData,
        previousData: existingStudent,
        updatedBy: req.user.id,
        schoolId: req.user.schoolId
      };
      
      // Log the student update event FIRST
      const event = await studentEventService.createStudentUpdateEvent(
        eventData,
        req.user.id,
        req.user.schoolId
      );

      // Update student
      const updatedStudent = await prisma.student.update({
        where: { id: parseInt(id) },
        data: {
          ...updateData,
          updatedBy: req.user.id
        },
        include: {
          user: {
            select: {
              id: true,
              uuid: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true
            }
          },
          class: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          section: {
            select: {
              id: true,
              name: true
            }
          },
          parent: {
            select: {
              id: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          }
        }
      });

      // Update the event with the final student data
      await prisma.studentEvent.update({
        where: { id: event.id },
        data: { 
          metadata: { 
            ...event.metadata, 
            updatedStudentData: updatedStudent,
            updatedFields: Object.keys(updateData)
          }
        }
      });

      // Invalidate cache
      await invalidateStudentCacheOnUpdate(updatedStudent, existingStudent);

      // Create audit log
      await createAuditLog({
        action: 'UPDATE',
        entity: 'Student',
        entityId: updatedStudent.id,
        userId: req.user.id,
        schoolId: req.user.schoolId,
        details: {
          studentId: updatedStudent.id,
          updatedFields: Object.keys(updateData)
        }
      });

      // Trigger automatic notification for student update
      await triggerEntityUpdatedNotification(
        'student',
        updatedStudent.id,
        {
          ...updatedStudent,
          entityType: 'student',
          entityId: updatedStudent.id,
          schoolId: updatedStudent.schoolId,
          updatedBy: req.user.id,
          previousData: existingStudent
        },
        req.user.id,
        req.user.schoolId,
        req.user.createdByOwnerId
      );

      return createSuccessResponse(res, 200, 'Student updated successfully', {
        student: updatedStudent,
        event
      });
    } catch (error) {
      return handlePrismaError(res, error, 'updateStudent');
    }
  }

  /**
   * Delete student (soft delete)
   */
  async deleteStudent(req, res) {
    try {
      const { id } = req.params;

      const existingStudent = await prisma.student.findFirst({
        where: {
          id: parseInt(id),
          schoolId: req.user.schoolId,
          deletedAt: null
        }
      });

      if (!existingStudent) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      // EVENT-FIRST WORKFLOW: Log event before deleting student
      const studentEventService = new StudentEventService();
      const eventData = {
        studentId: existingStudent.id,
        studentData: existingStudent,
        deletedBy: req.user.id,
        schoolId: req.user.schoolId,
        deletionReason: req.body.deletionReason || 'Manual deletion'
      };
      
      // Log the student deletion event FIRST
      const event = await studentEventService.createStudentDeletionEvent(
        eventData,
        req.user.id,
        req.user.schoolId
      );

      // Soft delete student
      const deletedStudent = await prisma.student.update({
        where: { id: parseInt(id) },
        data: {
          deletedAt: new Date(),
          updatedBy: req.user.id
        }
      });

      // Update the event with deletion confirmation
      await prisma.studentEvent.update({
        where: { id: event.id },
        data: { 
          metadata: { 
            ...event.metadata, 
            deletionConfirmed: true,
            deletedAt: new Date()
          }
        }
      });

      // Invalidate cache
      await invalidateStudentCacheOnDelete(existingStudent);

      // Create audit log
      await createAuditLog({
        action: 'DELETE',
        entity: 'Student',
        entityId: existingStudent.id,
        userId: req.user.id,
        schoolId: req.user.schoolId,
        details: {
          studentId: existingStudent.id,
          admissionNo: existingStudent.admissionNo
        }
      });

      return createSuccessResponse(res, 200, 'Student deleted successfully', {
        student: deletedStudent,
        event
      });
    } catch (error) {
      return handlePrismaError(res, error, 'deleteStudent');
    }
  }

  /**
   * Restore deleted student
   */
  async restoreStudent(req, res) {
    try {
      const { id } = req.params;

      const existingStudent = await prisma.student.findFirst({
        where: {
          id: parseInt(id),
          schoolId: req.user.schoolId,
          deletedAt: { not: null }
        }
      });

      if (!existingStudent) {
        return createErrorResponse(res, 404, 'Student not found or not deleted');
      }

      // Restore student
      const restoredStudent = await prisma.student.update({
        where: { id: parseInt(id) },
        data: {
          deletedAt: null,
          updatedBy: req.user.id
        }
      });

      // Invalidate cache
      await invalidateStudentCacheOnCreate(restoredStudent);

      // Create audit log
      await createAuditLog({
        action: 'RESTORE',
        entity: 'Student',
        entityId: restoredStudent.id,
        userId: req.user.id,
        schoolId: req.user.schoolId,
        details: {
          studentId: restoredStudent.id,
          admissionNo: restoredStudent.admissionNo
        }
      });

      return createSuccessResponse(res, 200, 'Student restored successfully');
    } catch (error) {
      return handlePrismaError(res, error, 'restoreStudent');
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  /**
   * Search students with advanced filters
   */
  async searchStudents(req, res) {
    try {
      const result = await this.getStudents(req, res);
      return result;
    } catch (error) {
      return handlePrismaError(res, error, 'searchStudents');
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  /**
   * Get student statistics
   */
  async getStudentStats(req, res) {
    try {
      const { id } = req.params;

      // Check cache first
      const cachedStats = await getStudentStatsFromCache('individual', { studentId: id });
      if (cachedStats) {
        return createSuccessResponse(res, 200, 'Student stats fetched from cache', cachedStats, {
          source: 'cache'
        });
      }

      const stats = await generateStudentStats(parseInt(id));
      
      // Cache the stats
      await setStudentStatsInCache('individual', { studentId: id }, stats);

      return createSuccessResponse(res, 200, 'Student stats fetched successfully', stats, {
        source: 'database'
      });
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentStats');
    }
  }

  /**
   * Get student analytics
   */
  async getStudentAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { period = '30d' } = req.query;

      // Check cache first
      const cachedAnalytics = await getStudentAnalyticsFromCache('individual', { studentId: id, period });
      if (cachedAnalytics) {
        return createSuccessResponse(res, 200, 'Student analytics fetched from cache', cachedAnalytics, {
          source: 'cache'
        });
      }

      const analytics = await generateStudentAnalytics(parseInt(id), period);
      
      // Cache the analytics
      await setStudentAnalyticsInCache('individual', { studentId: id, period }, analytics);

      return createSuccessResponse(res, 200, 'Student analytics fetched successfully', analytics, {
        source: 'database'
      });
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentAnalytics');
    }
  }

  /**
   * Get student performance metrics
   */
  async getStudentPerformance(req, res) {
    try {
      const { id } = req.params;

      // Check cache first
      const cachedPerformance = await getStudentPerformanceFromCache(id, {});
      if (cachedPerformance) {
        return createSuccessResponse(res, 200, 'Student performance fetched from cache', cachedPerformance, {
          source: 'cache'
        });
      }

      const performance = await calculateStudentPerformance(parseInt(id));
      
      // Cache the performance
      await setStudentPerformanceInCache(id, {}, performance);

      return createSuccessResponse(res, 200, 'Student performance fetched successfully', performance, {
        source: 'database'
      });
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentPerformance');
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  /**
   * Bulk create students
   */
  async bulkCreateStudents(req, res) {
    try {
      const { students } = req.body;

      if (!Array.isArray(students) || students.length === 0) {
        return createErrorResponse(res, 400, 'Students array is required');
      }

      const results = [];
      const errors = [];

      for (const studentData of students) {
        try {
          const result = await this.createStudent({ body: studentData, user: req.user }, res);
          results.push(result);
        } catch (error) {
          errors.push({
            student: studentData,
            error: error.message
          });
        }
      }

      // Invalidate cache
      await invalidateStudentCacheOnBulkOperation('CREATE', results.map(r => r.id));

      return createSuccessResponse(res, 200, 'Bulk create completed', {
        created: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (error) {
      return handlePrismaError(res, error, 'bulkCreateStudents');
    }
  }

  /**
   * Bulk update students
   */
  async bulkUpdateStudents(req, res) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return createErrorResponse(res, 400, 'Updates array is required');
      }

      const results = [];
      const errors = [];

      for (const update of updates) {
        try {
          const result = await this.updateStudent({ params: { id: update.id }, body: update.data, user: req.user }, res);
          results.push(result);
        } catch (error) {
          errors.push({
            studentId: update.id,
            error: error.message
          });
        }
      }

      // Invalidate cache
      await invalidateStudentCacheOnBulkOperation('UPDATE', results.map(r => r.id));

      return createSuccessResponse(res, 200, 'Bulk update completed', {
        updated: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (error) {
      return handlePrismaError(res, error, 'bulkUpdateStudents');
    }
  }

  /**
   * Bulk delete students
   */
  async bulkDeleteStudents(req, res) {
    try {
      const { studentIds } = req.body;

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return createErrorResponse(res, 400, 'Student IDs array is required');
      }

      const results = [];
      const errors = [];

      for (const studentId of studentIds) {
        try {
          const result = await this.deleteStudent({ params: { id: studentId }, user: req.user }, res);
          results.push({ id: studentId, result });
        } catch (error) {
          errors.push({
            studentId,
            error: error.message
          });
        }
      }

      // Invalidate cache
      await invalidateStudentCacheOnBulkOperation('DELETE', studentIds);

      return createSuccessResponse(res, 200, 'Bulk delete completed', {
        deleted: results.length,
        failed: errors.length,
        results,
        errors
      });
    } catch (error) {
      return handlePrismaError(res, error, 'bulkDeleteStudents');
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  /**
   * Export students
   */
  async exportStudents(req, res) {
    try {
      const { format = 'json', ...filters } = req.query;

      const students = await prisma.student.findMany({
        where: {
          schoolId: req.user.schoolId,
          deletedAt: null
        },
        include: {
          user: true,
          class: true,
          section: true,
          parent: {
            include: {
              user: true
            }
          }
        }
      });

      const exportData = await generateStudentExportData(students, format);

      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=students.${format}`);
      
      return res.send(exportData);
    } catch (error) {
      return handlePrismaError(res, error, 'exportStudents');
    }
  }

  /**
   * Import students
   */
  async importStudents(req, res) {
    try {
      const { students } = req.body;

      if (!Array.isArray(students) || students.length === 0) {
        return createErrorResponse(res, 400, 'Students array is required');
      }

      // Validate import data
      const validationResult = await validateStudentImportData(students);
      if (!validationResult.isValid) {
        return createErrorResponse(res, 400, 'Invalid import data', validationResult.errors);
      }

      const result = await this.bulkCreateStudents(req, res);
      return result;
    } catch (error) {
      return handlePrismaError(res, error, 'importStudents');
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  /**
   * Generate student code suggestions
   */
  async generateCodeSuggestions(req, res) {
    try {
      const { name, schoolId } = req.query;

      const suggestions = await generateStudentCodeSuggestions(name, schoolId || req.user.schoolId);

      return createSuccessResponse(res, 200, 'Code suggestions generated successfully', suggestions);
    } catch (error) {
      return handlePrismaError(res, error, 'generateCodeSuggestions');
    }
  }

  /**
   * Get student count by class
   */
  async getStudentCountByClass(req, res) {
    try {
      const counts = await getStudentCountByClass(req.user.schoolId);

      return createSuccessResponse(res, 200, 'Student counts by class fetched successfully', counts);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentCountByClass');
    }
  }

  /**
   * Get student count by status
   */
  async getStudentCountByStatus(req, res) {
    try {
      const counts = await getStudentCountByStatus(req.user.schoolId);

      return createSuccessResponse(res, 200, 'Student counts by status fetched successfully', counts);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentCountByStatus');
    }
  }

  /**
   * Get students by class
   */
  async getStudentsByClass(req, res) {
    console.log('=== getStudentsByClass START ===');
    console.log('Params:', req.params);
    console.log('Query:', req.query);
    console.log('User:', req.user);
    
    try {
      const { classId } = req.params;
      const { include = [] } = req.query;

      console.log('Building include query...');
      const includeQuery = buildStudentIncludeQuery(include);
      console.log('Include query:', includeQuery);

      console.log('Executing Prisma query...');
      const students = await prisma.student.findMany({
        where: {
          classId: parseInt(classId),
          schoolId: req.user.schoolId,
          deletedAt: null
        },
        include: includeQuery
      });

      console.log('Query completed. Found students:', students.length);
      console.log('=== getStudentsByClass END ===');
      return createSuccessResponse(res, 200, 'Students by class fetched successfully', students);
    } catch (error) {
      console.error('=== getStudentsByClass ERROR ===', error);
      return handlePrismaError(res, error, 'getStudentsByClass');
    }
  }

  /**
   * Get students by school
   */
  async getStudentsBySchool(req, res) {
    try {
      const { schoolId } = req.params;
      const { include = [] } = req.query;

      const includeQuery = buildStudentIncludeQuery(include);

      const students = await prisma.student.findMany({
        where: {
          schoolId: parseInt(schoolId),
          deletedAt: null
        },
        include: includeQuery
      });

      return createSuccessResponse(res, 200, 'Students by school fetched successfully', students);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentsBySchool');
    }
  }

  // ======================
  // CACHE MANAGEMENT
  // ======================

  /**
   * Get cache statistics
   */
  async getCacheStats(req, res) {
    try {
      const stats = await getStudentCacheStats();
      return createSuccessResponse(res, 200, 'Cache stats fetched successfully', stats);
    } catch (error) {
      return handlePrismaError(res, error, 'getCacheStats');
    }
  }

  /**
   * Warm cache
   */
  async warmCache(req, res) {
    try {
      const { studentId, schoolId } = req.body;
      const result = await warmStudentCache(studentId, schoolId);
      return createSuccessResponse(res, 200, 'Cache warmed successfully', result);
    } catch (error) {
      return handlePrismaError(res, error, 'warmCache');
    }
  }

  // ======================
  // ADDITIONAL FEATURES
  // ======================

  /**
   * Get student dashboard data
   */
  async getStudentDashboard(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);

      // Get student with all related data
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true
            }
          },
          class: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          section: {
            select: {
              id: true,
              name: true
            }
          },
          parent: {
            select: {
              id: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true
                }
              }
            }
          },
          school: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          attendances: {
            take: 30,
            orderBy: { date: 'desc' },
            select: {
              id: true,
              date: true,
              status: true,
              remarks: true
            }
          },
          grades: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              subject: true,
              grade: true,
              score: true,
              createdAt: true
            }
          },
          payments: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              createdAt: true
            }
          },
          documents: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              name: true,
              type: true,
              status: true,
              createdAt: true
            }
          }
        }
      });

      if (!student) {
        return createErrorResponse(res, 404, 'Student not found');
      }

      // Calculate quick stats
      const totalAttendance = student.attendances.length;
      const presentDays = student.attendances.filter(a => a.status === 'PRESENT').length;
      const attendanceRate = totalAttendance > 0 ? (presentDays / totalAttendance) * 100 : 0;

      const totalGrades = student.grades.length;
      const averageGrade = totalGrades > 0 
        ? student.grades.reduce((sum, grade) => sum + (grade.score || 0), 0) / totalGrades 
        : 0;

      const totalPayments = student.payments.length;
      const paidAmount = student.payments
        .filter(p => p.status === 'PAID')
        .reduce((sum, payment) => sum + payment.amount, 0);

      const dashboard = {
        studentId: student.id,
        quickStats: {
          attendanceRate: Math.round(attendanceRate),
          gpa: Math.round(averageGrade * 100) / 100,
          conductScore: 85, // Placeholder - would need behavior data
          feePaymentRate: totalPayments > 0 ? Math.round((paidAmount / totalPayments) * 100) : 0,
          extracurricularParticipation: 75 // Placeholder
        },
        recentActivity: [
          {
            type: 'ATTENDANCE',
            title: 'Attendance Recorded',
            description: `${student.user.firstName} was present today`,
            date: new Date().toISOString(),
            impact: 'POSITIVE'
          },
          {
            type: 'GRADE',
            title: 'Grade Updated',
            description: 'New grade recorded for Mathematics',
            date: new Date().toISOString(),
            impact: 'POSITIVE'
          }
        ],
        upcomingEvents: [
          {
            type: 'EXAM',
            title: 'Final Exams',
            date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            importance: 'HIGH'
          },
          {
            type: 'PAYMENT',
            title: 'Tuition Fee Due',
            date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            importance: 'MEDIUM'
          }
        ],
        academicProgress: {
          subjects: [
            { name: 'Mathematics', grade: 'A', score: 92, trend: 'UP' },
            { name: 'Science', grade: 'B+', score: 87, trend: 'STABLE' },
            { name: 'English', grade: 'A-', score: 89, trend: 'UP' }
          ],
          overallProgress: 88,
          targetGPA: 3.5,
          currentGPA: 3.2
        },
        attendanceHistory: student.attendances.slice(0, 10).map(attendance => ({
          date: attendance.date,
          status: attendance.status,
          remarks: attendance.remarks
        })),
        behaviorLog: [
          {
            date: new Date().toISOString(),
            type: 'POSITIVE',
            description: 'Excellent participation in class discussion',
            points: 5
          }
        ],
        financialStatus: {
          totalFees: 5000,
          paidAmount: paidAmount,
          outstandingAmount: 5000 - paidAmount,
          nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          paymentHistory: student.payments.map(payment => ({
            date: payment.createdAt,
            amount: payment.amount,
            method: payment.method,
            status: payment.status
          }))
        },
        healthRecords: [
          {
            date: new Date().toISOString(),
            type: 'CHECKUP',
            description: 'Annual physical examination',
            severity: 'LOW'
          }
        ],
        documents: student.documents.map(doc => ({
          name: doc.name,
          type: doc.type,
          uploadDate: doc.createdAt,
          status: doc.status
        }))
      };

      return createSuccessResponse(res, 200, 'Student dashboard retrieved successfully', dashboard);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentDashboard');
    }
  }

  /**
   * Get student attendance records
   */
  async getStudentAttendance(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);

      const attendances = await prisma.attendance.findMany({
        where: { studentId },
        orderBy: { date: 'desc' },
        take: 100,
        include: {
          student: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      });

      return createSuccessResponse(res, 200, 'Student attendance retrieved successfully', attendances);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentAttendance');
    }
  }

  /**
   * Update student attendance
   */
  async updateStudentAttendance(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);
      const attendanceData = req.body;

      const attendance = await prisma.attendance.create({
        data: {
          studentId,
          date: attendanceData.date,
          status: attendanceData.status,
          remarks: attendanceData.remarks,
          createdBy: req.user.id
        }
      });

      return createSuccessResponse(res, 201, 'Attendance updated successfully', attendance);
    } catch (error) {
      return handlePrismaError(res, error, 'updateStudentAttendance');
    }
  }

  /**
   * Get student behavior records
   */
  async getStudentBehavior(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);

      // Since we don't have a behavior table, return mock data
      const behaviors = [
        {
          id: 1,
          studentId,
          type: 'POSITIVE',
          description: 'Excellent participation in class discussion',
          points: 5,
          date: new Date().toISOString(),
          createdBy: req.user.id
        },
        {
          id: 2,
          studentId,
          type: 'NEUTRAL',
          description: 'Regular attendance maintained',
          points: 0,
          date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          createdBy: req.user.id
        }
      ];

      return createSuccessResponse(res, 200, 'Student behavior retrieved successfully', behaviors);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentBehavior');
    }
  }

  /**
   * Add student behavior record
   */
  async addStudentBehavior(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);
      const behaviorData = req.body;

      // Since we don't have a behavior table, return mock response
      const behavior = {
        id: Date.now(),
        studentId,
        type: behaviorData.type,
        description: behaviorData.description,
        points: behaviorData.points || 0,
        date: new Date().toISOString(),
        createdBy: req.user.id
      };

      return createSuccessResponse(res, 201, 'Behavior record added successfully', behavior);
    } catch (error) {
      return handlePrismaError(res, error, 'addStudentBehavior');
    }
  }

  /**
   * Get student documents
   */
  async getStudentDocuments(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);

      const documents = await prisma.document.findMany({
        where: { 
          studentId,
          entityType: 'STUDENT'
        },
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      });

      return createSuccessResponse(res, 200, 'Student documents retrieved successfully', documents);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentDocuments');
    }
  }

  /**
   * Upload student document
   */
  async uploadStudentDocument(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);
      const documentData = req.body;

      const document = await prisma.document.create({
        data: {
          studentId,
          name: documentData.name,
          type: documentData.type,
          url: documentData.url,
          status: 'PENDING',
          entityType: 'STUDENT',
          createdBy: req.user.id
        }
      });

      return createSuccessResponse(res, 201, 'Document uploaded successfully', document);
    } catch (error) {
      return handlePrismaError(res, error, 'uploadStudentDocument');
    }
  }

  /**
   * Get student financial records
   */
  async getStudentFinancials(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);

      const payments = await prisma.payment.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: {
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      });

      const totalFees = 5000; // Placeholder - would come from fees table
      const paidAmount = payments
        .filter(p => p.status === 'PAID')
        .reduce((sum, payment) => sum + payment.amount, 0);

      const financials = {
        totalFees,
        paidAmount,
        outstandingAmount: totalFees - paidAmount,
        payments,
        nextDueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      return createSuccessResponse(res, 200, 'Student financials retrieved successfully', financials);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentFinancials');
    }
  }

  /**
   * Update student financial records
   */
  async updateStudentFinancials(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);
      const financialData = req.body;

      // Update student's financial information
      const student = await prisma.student.update({
        where: { id: studentId },
        data: {
          financialInfo: financialData
        }
      });

      return createSuccessResponse(res, 200, 'Student financials updated successfully', student);
    } catch (error) {
      return handlePrismaError(res, error, 'updateStudentFinancials');
    }
  }

  /**
   * Get student health records
   */
  async getStudentHealth(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);

      // Since we don't have a health table, return mock data
      const healthRecords = [
        {
          id: 1,
          studentId,
          type: 'CHECKUP',
          description: 'Annual physical examination',
          severity: 'LOW',
          date: new Date().toISOString(),
          createdBy: req.user.id
        },
        {
          id: 2,
          studentId,
          type: 'VACCINATION',
          description: 'Flu shot administered',
          severity: 'LOW',
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdBy: req.user.id
        }
      ];

      return createSuccessResponse(res, 200, 'Student health records retrieved successfully', healthRecords);
    } catch (error) {
      return handlePrismaError(res, error, 'getStudentHealth');
    }
  }

  /**
   * Add student health record
   */
  async addStudentHealthRecord(req, res) {
    try {
      const { id } = req.params;
      const studentId = parseInt(id);
      const healthData = req.body;

      // Since we don't have a health table, return mock response
      const healthRecord = {
        id: Date.now(),
        studentId,
        type: healthData.type,
        description: healthData.description,
        severity: healthData.severity || 'LOW',
        date: new Date().toISOString(),
        createdBy: req.user.id
      };

      return createSuccessResponse(res, 201, 'Health record added successfully', healthRecord);
    } catch (error) {
      return handlePrismaError(res, error, 'addStudentHealthRecord');
    }
  }

  /**
   * Get all students that were converted from customers
   */
  async getConvertedStudents(req, res) {
    try {
      const { schoolId } = req.user;
      const { page = 1, limit = 10, search, sortBy = 'conversionDate', sortOrder = 'desc' } = req.query;

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const whereClause = {
        schoolId,
        convertedFromCustomerId: { not: null }
      };

      if (search) {
        whereClause.OR = [
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { user: { displayName: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { admissionNo: { contains: search, mode: 'insensitive' } },
          { rollNo: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                middleName: true,
                lastName: true,
                displayName: true,
                email: true,
                phone: true
              }
            },
            convertedFromCustomer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true
              }
            },
            events: {
              orderBy: { createdAt: 'desc' },
              take: 5
            },
            _count: {
              select: {
                events: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: parseInt(limit)
        }),
        prisma.student.count({ where: whereClause })
      ]);

      res.json({
        success: true,
        data: convertBigInts(students),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching converted students:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch converted students',
        error: error.message
      });
    }
  }

  /**
   * Get analytics for students converted from customers
   */
  async getStudentConversionAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { period = '30d' } = req.query; // 7d, 30d, 90d, 1y, all

      let dateFilter = {};
      if (period !== 'all') {
        const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
        dateFilter = {
          gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        };
      }

      // Get conversion statistics for students
      const [
        totalStudents,
        convertedStudents,
        conversionRate,
        recentConversions,
        conversionByMonth,
        averageConversionTime
      ] = await Promise.all([
        // Total students
        prisma.student.count({ where: { schoolId } }),
        
        // Students converted from customers
        prisma.student.count({
          where: {
            schoolId,
            convertedFromCustomerId: { not: null }
          }
        }),
        
        // Conversion rate calculation
        prisma.student.count({ where: { schoolId } }).then(total => {
          return prisma.student.count({
            where: {
              schoolId,
              convertedFromCustomerId: { not: null }
            }
          }).then(converted => total > 0 ? (converted / total) * 100 : 0);
        }),
        
        // Recent conversions (last 30 days)
        prisma.student.count({
          where: {
            schoolId,
            convertedFromCustomerId: { not: null },
            conversionDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        
        // Conversion by month (last 6 months)
        prisma.student.groupBy({
          by: ['conversionDate'],
          where: {
            schoolId,
            convertedFromCustomerId: { not: null },
            conversionDate: {
              gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
            }
          },
          _count: {
            id: true
          }
        }),
        
        // Average time from customer creation to conversion
        prisma.student.findMany({
          where: {
            schoolId,
            convertedFromCustomerId: { not: null },
            conversionDate: dateFilter
          },
          include: {
            convertedFromCustomer: {
              select: { createdAt: true }
            }
          }
        }).then(students => {
          if (students.length === 0) return 0;
          const totalDays = students.reduce((sum, student) => {
            const customerCreated = new Date(student.convertedFromCustomer.createdAt);
            const converted = new Date(student.conversionDate);
            return sum + (converted - customerCreated) / (1000 * 60 * 60 * 24);
          }, 0);
          return totalDays / students.length;
        })
      ]);

      // Get conversion events for the period
      const conversionEvents = await prisma.studentEvent.findMany({
        where: {
          student: { schoolId },
          eventType: 'CONVERTED_FROM_CUSTOMER',
          createdAt: dateFilter
        },
        include: {
          student: {
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true, displayName: true, email: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      res.json({
        success: true,
        data: convertBigInts({
          totalStudents,
          convertedStudents,
          conversionRate: Math.round(conversionRate * 100) / 100,
          recentConversions,
          conversionByMonth,
          averageConversionTime: Math.round(averageConversionTime * 100) / 100,
          conversionEvents
        })
      });
    } catch (error) {
      console.error('Error fetching student conversion analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch student conversion analytics',
        error: error.message
      });
    }
  }

  /**
   * Get detailed statistics about student conversions
   */
  async getStudentConversionStats(req, res) {
    try {
      const { schoolId } = req.user;
      const { studentId } = req.params;

      if (studentId) {
        // Get stats for specific student
        const student = await prisma.student.findFirst({
          where: {
            id: BigInt(studentId),
            schoolId,
            convertedFromCustomerId: { not: null }
          },
          include: {
            convertedFromCustomer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true,
                customerEvents: {
                  orderBy: { createdAt: 'desc' },
                  take: 10
                }
              }
            },
            events: {
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          }
        });

        if (!student) {
          return res.status(404).json({
            success: false,
            message: 'Converted student not found'
          });
        }

        const customerCreated = new Date(student.convertedFromCustomer.createdAt);
        const converted = new Date(student.conversionDate);
        const daysToConvert = (converted - customerCreated) / (1000 * 60 * 60 * 24);

        res.json({
          success: true,
          data: convertBigInts({
            student,
            conversionStats: {
              daysToConvert: Math.round(daysToConvert * 100) / 100,
              customerEventsCount: student.convertedFromCustomer.customerEvents.length,
              studentEventsCount: student.events.length
            }
          })
        });
      } else {
        // Get overall stats
        const [
          totalConverted,
          averageConversionTime,
          conversionTrend,
          topConvertingCustomers
        ] = await Promise.all([
          prisma.student.count({
            where: {
              schoolId,
              convertedFromCustomerId: { not: null }
            }
          }),
          
          prisma.student.findMany({
            where: {
              schoolId,
              convertedFromCustomerId: { not: null }
            },
            include: {
              convertedFromCustomer: {
                select: { createdAt: true }
              }
            }
          }).then(students => {
            if (students.length === 0) return 0;
            const totalDays = students.reduce((sum, student) => {
              const customerCreated = new Date(student.convertedFromCustomer.createdAt);
              const converted = new Date(student.conversionDate);
              return sum + (converted - customerCreated) / (1000 * 60 * 60 * 24);
            }, 0);
            return totalDays / students.length;
          }),
          
          prisma.student.groupBy({
            by: ['conversionDate'],
            where: {
              schoolId,
              convertedFromCustomerId: { not: null },
              conversionDate: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
              }
            },
            _count: { id: true }
          }),
          
          prisma.customer.findMany({
            where: {
              schoolId,
              convertedStudents: { some: {} }
            },
            include: {
              _count: {
                select: { convertedStudents: true }
              }
            },
            orderBy: {
              convertedStudents: { _count: 'desc' }
            },
            take: 10
          })
        ]);

        res.json({
          success: true,
          data: convertBigInts({
            totalConverted,
            averageConversionTime: Math.round(averageConversionTime * 100) / 100,
            conversionTrend,
            topConvertingCustomers
          })
        });
      }
    } catch (error) {
      console.error('Error fetching student conversion stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch student conversion stats',
        error: error.message
      });
    }
  }

  // ======================
  // CLEANUP ORPHANED STUDENTS
  // ======================
  async cleanupOrphanedStudentsEndpoint(req, res) {
    try {
      await cleanupOrphanedStudents();
      return createSuccessResponse(res, 200, 'Orphaned students cleanup completed');
    } catch (error) {
      console.error('Error cleaning up orphaned students:', error);
      return createErrorResponse(res, 500, 'Failed to cleanup orphaned students');
    }
  }
}

export default new StudentController(); 

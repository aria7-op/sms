import { PrismaClient } from '../generated/prisma/client.js';
import { 
  generateSubjectCode, 
  validateSubjectConstraints, 
  generateSubjectStats, 
  generateSubjectAnalytics, 
  calculateSubjectPerformance,
  buildSubjectSearchQuery,
  buildSubjectIncludeQuery,
  generateSubjectExportData,
  validateSubjectImportData,
  generateSubjectCodeSuggestions,
  getSubjectCountByDepartment,
  getSubjectCountByCreditHours
} from '../utils/subjectUtils.js';
import { 
  SubjectCreateSchema, 
  SubjectUpdateSchema, 
  SubjectSearchSchema 
} from '../utils/subjectUtils.js';
import { cacheManager } from '../cache/cacheManager.js';
import { ValidationError } from '../middleware/validation.js';
import { convertBigIntToString } from '../utils/responseUtils.js';

const prisma = new PrismaClient();

class SubjectController {
  // ======================
  // CRUD OPERATIONS
  // ======================

  /**
   * Create a new subject
   */
  async createSubject(req, res) {
    try {
      const validatedData = req.body;
      let { schoolId, code, departmentId } = validatedData;

      // Handle schoolId for owners (similar to class controller)
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
          return res.status(400).json({
            success: false,
            error: 'No schools found for this owner. Please create a school first.',
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        }

        schoolId = owner.schools[0].id;
        validatedData.schoolId = schoolId;
        console.log('Set schoolId to:', schoolId);
      } else if (!schoolId) {
        // For non-owners, schoolId is required
        return res.status(400).json({
          success: false,
          error: 'schoolId is required for non-owner users.',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Validate constraints
      const constraints = await validateSubjectConstraints(schoolId, code, departmentId);
      if (!constraints.isValid) {
        throw new ValidationError('Subject constraints validation failed', constraints.errors);
      }

      // Generate code if not provided
      if (!validatedData.code) {
        const existingCodes = await prisma.subject.findMany({
          where: { schoolId: BigInt(schoolId), deletedAt: null },
          select: { code: true }
        });
        validatedData.code = await generateSubjectCode(
          validatedData.name,
          schoolId,
          existingCodes.map(c => c.code)
        );
      }

      // Create subject with proper createdBy and schoolId
      const subjectData = await prisma.subject.create({
        data: {
          ...validatedData,
          schoolId: BigInt(schoolId),
          departmentId: validatedData.departmentId ? BigInt(validatedData.departmentId) : null,
          createdBy: BigInt(req.user.id),
          updatedBy: BigInt(req.user.id)
        },
        include: {
          school: true,
          department: true
        }
      });

      // Clear cache
      await cacheManager.invalidatePattern(`subject:${schoolId}:*`);
      await cacheManager.invalidatePattern(`school:${schoolId}:stats`);

      res.status(201).json({
        success: true,
        message: 'Subject created successfully',
        data: convertBigIntToString(subjectData),
        meta: {
          timestamp: new Date().toISOString(),
          createdBy: req.user.id
        }
      });
    } catch (error) {
      console.error('Create subject error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to create subject',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get subjects with pagination and filters
   */
  async getSubjects(req, res) {
    try {
      console.log('🔍 getSubjects controller called');
      const validatedData = req.query;
      const { page, limit, sort, order, include } = validatedData;
      const { schoolId } = req.user;

      // Build search query with user's schoolId
      const where = buildSubjectSearchQuery(validatedData, schoolId);
      const includeQuery = buildSubjectIncludeQuery(include);

      const [subjects, total] = await Promise.all([
        prisma.subject.findMany({
          where,
          include: includeQuery,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sort]: order }
        }),
        prisma.subject.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      console.log('✅ About to send response with', subjects.length, 'subjects');
      res.status(200).json({
        success: true,
        data: convertBigIntToString(subjects),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        meta: {
          timestamp: new Date().toISOString(),
          filters: validatedData
        }
      });
    } catch (error) {
      console.error('Get subjects error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subjects',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get subject by ID
   */
  async getSubjectById(req, res) {
    try {
      const { id } = req.params;
      const { include } = req.query;

      const includeQuery = buildSubjectIncludeQuery(include);

      const subjectData = await prisma.subject.findUnique({
        where: { id: BigInt(id) },
        include: includeQuery
      });

      if (!subjectData) {
        return res.status(404).json({
          success: false,
          error: 'Subject not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(200).json({
        success: true,
        data: convertBigIntToString(subjectData),
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Get subject by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subject',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Update subject
   */
  async updateSubject(req, res) {
    try {
      const { id } = req.params;
      const validatedData = req.body;

      // Check if subject exists
      const existingSubject = await prisma.subject.findUnique({
        where: { id: BigInt(id) }
      });

      if (!existingSubject) {
        return res.status(404).json({
          success: false,
          error: 'Subject not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Validate constraints if code or department is being updated
      if (validatedData.code || validatedData.departmentId) {
        const constraints = await validateSubjectConstraints(
          existingSubject.schoolId.toString(),
          validatedData.code || existingSubject.code,
          validatedData.departmentId || existingSubject.departmentId?.toString(),
          id
        );
        if (!constraints.isValid) {
          throw new ValidationError('Subject constraints validation failed', constraints.errors);
        }
      }

      // Update subject
      const updatedSubject = await prisma.subject.update({
        where: { id: BigInt(id) },
        data: {
          ...validatedData,
          departmentId: validatedData.departmentId ? BigInt(validatedData.departmentId) : undefined,
          updatedBy: BigInt(req.user.id)
        },
        include: {
          school: true,
          department: true
        }
      });

      // Clear cache
      await cacheManager.invalidatePattern(`subject:${existingSubject.schoolId}:*`);
      await cacheManager.invalidatePattern(`school:${existingSubject.schoolId}:stats`);

      res.status(200).json({
        success: true,
        message: 'Subject updated successfully',
        data: convertBigIntToString(updatedSubject),
        meta: {
          timestamp: new Date().toISOString(),
          updatedBy: req.user.id
        }
      });
    } catch (error) {
      console.error('Update subject error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to update subject',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Delete subject (soft delete)
   */
  async deleteSubject(req, res) {
    try {
      const { id } = req.params;

      const existingSubject = await prisma.subject.findUnique({
        where: { id: BigInt(id) }
      });

      if (!existingSubject) {
        return res.status(404).json({
          success: false,
          error: 'Subject not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Soft delete
      await prisma.subject.update({
        where: { id: BigInt(id) },
        data: {
          deletedAt: new Date(),
          updatedBy: BigInt(req.user.id)
        }
      });

      // Clear cache
      await cacheManager.invalidatePattern(`subject:${existingSubject.schoolId}:*`);
      await cacheManager.invalidatePattern(`school:${existingSubject.schoolId}:stats`);

      res.status(200).json({
        success: true,
        message: 'Subject deleted successfully',
        meta: {
          timestamp: new Date().toISOString(),
          deletedBy: req.user.id
        }
      });
    } catch (error) {
      console.error('Delete subject error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete subject',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Restore deleted subject
   */
  async restoreSubject(req, res) {
    try {
      const { id } = req.params;

      const existingSubject = await prisma.subject.findUnique({
        where: { id: BigInt(id) },
        include: { deletedAt: true }
      });

      if (!existingSubject) {
        return res.status(404).json({
          success: false,
          error: 'Subject not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      if (!existingSubject.deletedAt) {
        return res.status(400).json({
          success: false,
          error: 'Subject is not deleted',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Restore subject
      const restoredSubject = await prisma.subject.update({
        where: { id: BigInt(id) },
        data: {
          deletedAt: null,
          updatedBy: BigInt(req.user.id)
        },
        include: {
          school: true,
          department: true
        }
      });

      // Clear cache
      await cacheManager.invalidatePattern(`subject:${restoredSubject.schoolId}:*`);
      await cacheManager.invalidatePattern(`school:${restoredSubject.schoolId}:stats`);

      res.status(200).json({
        success: true,
        message: 'Subject restored successfully',
        data: restoredSubject,
        meta: {
          timestamp: new Date().toISOString(),
          restoredBy: req.user.id
        }
      });
    } catch (error) {
      console.error('Restore subject error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restore subject',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  /**
   * Get subject statistics
   */
  async getSubjectStats(req, res) {
    try {
      const { id } = req.params;

      const stats = await generateSubjectStats(id);

      res.status(200).json({
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          subjectId: id
        }
      });
    } catch (error) {
      console.error('Get subject stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subject statistics',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get subject analytics
   */
  async getSubjectAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const analytics = await generateSubjectAnalytics(id, period);

      res.status(200).json({
        success: true,
        data: analytics,
        meta: {
          timestamp: new Date().toISOString(),
          subjectId: id,
          period
        }
      });
    } catch (error) {
      console.error('Get subject analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subject analytics',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get subject performance
   */
  async getSubjectPerformance(req, res) {
    try {
      const { id } = req.params;

      const performance = await calculateSubjectPerformance(id);

      res.status(200).json({
        success: true,
        data: performance,
        meta: {
          timestamp: new Date().toISOString(),
          subjectId: id
        }
      });
    } catch (error) {
      console.error('Get subject performance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subject performance',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  /**
   * Bulk create subjects
   */
  async bulkCreateSubjects(req, res) {
    try {
      const { subjects } = req.body;

      if (!Array.isArray(subjects) || subjects.length === 0) {
        throw new ValidationError('Subjects array is required and cannot be empty');
      }

      // Handle default schoolId for owners
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
          return res.status(400).json({
            success: false,
            error: 'No schools found for this owner. Please create a school first.',
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        }

        defaultSchoolId = owner.schools[0].id;
        console.log('Set default schoolId to:', defaultSchoolId);
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < subjects.length; i++) {
        try {
          const subjectData = subjects[i];
          
          // Use default schoolId if not provided and user is owner
          const schoolId = subjectData.schoolId || defaultSchoolId;
          
          if (!schoolId) {
            errors.push({
              index: i,
              error: 'schoolId is required for non-owner users',
            });
            continue;
          }
          
          // Validate each subject
          const validation = SubjectCreateSchema.safeParse(subjectData);
          if (!validation.success) {
            errors.push({
              index: i,
              errors: validation.error.errors
            });
            continue;
          }

          // Validate constraints
          const constraints = await validateSubjectConstraints(
            schoolId,
            subjectData.code,
            subjectData.departmentId
          );
          if (!constraints.isValid) {
            errors.push({
              index: i,
              errors: constraints.errors
            });
            continue;
          }

          // Generate code if not provided
          if (!subjectData.code) {
            const existingCodes = await prisma.subject.findMany({
              where: { schoolId: BigInt(schoolId), deletedAt: null },
              select: { code: true }
            });
            subjectData.code = await generateSubjectCode(
              subjectData.name,
              schoolId,
              existingCodes.map(c => c.code)
            );
          }

          // Create subject with proper createdBy and schoolId
          const createdSubject = await prisma.subject.create({
            data: {
              ...subjectData,
              schoolId: BigInt(schoolId),
              departmentId: subjectData.departmentId ? BigInt(subjectData.departmentId) : null,
              createdBy: BigInt(req.user.id),
              updatedBy: BigInt(req.user.id)
            }
          });

          results.push(createdSubject);
        } catch (error) {
          errors.push({
            index: i,
            error: error.message
          });
        }
      }

      // Clear cache for affected schools
      const schoolIds = [...new Set(subjects.map(s => s.schoolId))];
      for (const schoolId of schoolIds) {
        await cacheManager.invalidatePattern(`subject:${schoolId}:*`);
        await cacheManager.invalidatePattern(`school:${schoolId}:stats`);
      }

      res.status(200).json({
        success: true,
        message: `Bulk create completed. ${results.length} subjects created, ${errors.length} failed.`,
        data: {
          created: results,
          errors
        },
        meta: {
          timestamp: new Date().toISOString(),
          total: subjects.length,
          successful: results.length,
          failed: errors.length
        }
      });
    } catch (error) {
      console.error('Bulk create subjects error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to bulk create subjects',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Bulk update subjects
   */
  async bulkUpdateSubjects(req, res) {
    try {
      const { updates } = req.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        throw new ValidationError('Updates array is required and cannot be empty');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < updates.length; i++) {
        try {
          const update = updates[i];
          
          if (!update.id) {
            errors.push({
              index: i,
              error: 'ID is required for each update'
            });
            continue;
          }

          // Validate update data
          const validation = SubjectUpdateSchema.safeParse(update);
          if (!validation.success) {
            errors.push({
              index: i,
              errors: validation.error.errors
            });
            continue;
          }

          // Check if subject exists
          const existingSubject = await prisma.subject.findUnique({
            where: { id: BigInt(update.id) }
          });

          if (!existingSubject) {
            errors.push({
              index: i,
              error: 'Subject not found'
            });
            continue;
          }

          // Validate constraints if code or department is being updated
          if (update.code || update.departmentId) {
            const constraints = await validateSubjectConstraints(
              existingSubject.schoolId.toString(),
              update.code || existingSubject.code,
              update.departmentId || existingSubject.departmentId?.toString(),
              update.id
            );
            if (!constraints.isValid) {
              errors.push({
                index: i,
                errors: constraints.errors
              });
              continue;
            }
          }

          // Update subject
          const updatedSubject = await prisma.subject.update({
            where: { id: BigInt(update.id) },
            data: {
              ...update,
              departmentId: update.departmentId ? BigInt(update.departmentId) : undefined,
              updatedBy: BigInt(req.user.id)
            }
          });

          results.push(updatedSubject);
        } catch (error) {
          errors.push({
            index: i,
            error: error.message
          });
        }
      }

      // Clear cache for affected schools
      const schoolIds = [...new Set(results.map(s => s.schoolId.toString()))];
      for (const schoolId of schoolIds) {
        await cacheManager.invalidatePattern(`subject:${schoolId}:*`);
        await cacheManager.invalidatePattern(`school:${schoolId}:stats`);
      }

      res.status(200).json({
        success: true,
        message: `Bulk update completed. ${results.length} subjects updated, ${errors.length} failed.`,
        data: {
          updated: results,
          errors
        },
        meta: {
          timestamp: new Date().toISOString(),
          total: updates.length,
          successful: results.length,
          failed: errors.length
        }
      });
    } catch (error) {
      console.error('Bulk update subjects error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to bulk update subjects',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Bulk delete subjects
   */
  async bulkDeleteSubjects(req, res) {
    try {
      const { subjectIds } = req.body;

      if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
        throw new ValidationError('Subject IDs array is required and cannot be empty');
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < subjectIds.length; i++) {
        try {
          const subjectId = subjectIds[i];

          const existingSubject = await prisma.subject.findUnique({
            where: { id: BigInt(subjectId) }
          });

          if (!existingSubject) {
            errors.push({
              index: i,
              subjectId,
              error: 'Subject not found'
            });
            continue;
          }

          // Soft delete
          await prisma.subject.update({
            where: { id: BigInt(subjectId) },
            data: {
              deletedAt: new Date(),
              updatedBy: BigInt(req.user.id)
            }
          });

          results.push({ id: subjectId, name: existingSubject.name });
        } catch (error) {
          errors.push({
            index: i,
            subjectId: subjectIds[i],
            error: error.message
          });
        }
      }

      // Clear cache for affected schools
      const schoolIds = [...new Set(results.map(s => s.schoolId))];
      for (const schoolId of schoolIds) {
        await cacheManager.invalidatePattern(`subject:${schoolId}:*`);
        await cacheManager.invalidatePattern(`school:${schoolId}:stats`);
      }

      res.status(200).json({
        success: true,
        message: `Bulk delete completed. ${results.length} subjects deleted, ${errors.length} failed.`,
        data: {
          deleted: results,
          errors
        },
        meta: {
          timestamp: new Date().toISOString(),
          total: subjectIds.length,
          successful: results.length,
          failed: errors.length
        }
      });
    } catch (error) {
      console.error('Bulk delete subjects error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to bulk delete subjects',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  /**
   * Search subjects with advanced filters
   */
  async searchSubjects(req, res) {
    try {
      const validatedData = req.query;
      const { page, limit, sort, order, include } = validatedData;
      const { schoolId } = req.user;

      // Build search query with user's schoolId
      const where = buildSubjectSearchQuery(validatedData, schoolId);
      const includeQuery = buildSubjectIncludeQuery(include);

      const [subjects, total] = await Promise.all([
        prisma.subject.findMany({
          where,
          include: includeQuery,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { [sort]: order }
        }),
        prisma.subject.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: subjects,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        meta: {
          timestamp: new Date().toISOString(),
          filters: validatedData
        }
      });
    } catch (error) {
      console.error('Search subjects error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search subjects',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  /**
   * Export subjects data
   */
  async exportSubjects(req, res) {
    try {
      const { format = 'json', ...filters } = req.query;
      const { schoolId } = req.user;

      // Build search query with user's schoolId
      const where = buildSubjectSearchQuery(filters, schoolId);
      const includeQuery = buildSubjectIncludeQuery('school,department');

      const subjects = await prisma.subject.findMany({
        where,
        include: includeQuery
      });

      const exportData = await generateSubjectExportData(subjects, format);

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="subjects.csv"');
        return res.send(exportData);
      }

      res.status(200).json({
        success: true,
        data: exportData,
        meta: {
          timestamp: new Date().toISOString(),
          format,
          total: subjects.length
        }
      });
    } catch (error) {
      console.error('Export subjects error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export subjects',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Import subjects data
   */
  async importSubjects(req, res) {
    try {
      const { subjects } = req.body;

      if (!Array.isArray(subjects) || subjects.length === 0) {
        throw new ValidationError('Subjects array is required and cannot be empty');
      }

      // Handle default schoolId for owners
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
          return res.status(400).json({
            success: false,
            error: 'No schools found for this owner. Please create a school first.',
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        }

        defaultSchoolId = owner.schools[0].id;
        console.log('Set default schoolId to:', defaultSchoolId);
      }

      // Validate import data
      const validationErrors = validateSubjectImportData(subjects);
      if (validationErrors.length > 0) {
        throw new ValidationError('Import validation failed', validationErrors);
      }

      const results = [];
      const errors = [];

      for (let i = 0; i < subjects.length; i++) {
        try {
          const subjectData = subjects[i];
          
          // Use default schoolId if not provided and user is owner
          const schoolId = subjectData.schoolId || defaultSchoolId;
          
          if (!schoolId) {
            errors.push({
              index: i,
              error: 'schoolId is required for non-owner users',
            });
            continue;
          }
          
          // Validate constraints
          const constraints = await validateSubjectConstraints(
            schoolId,
            subjectData.code,
            subjectData.departmentId
          );
          if (!constraints.isValid) {
            errors.push({
              index: i,
              errors: constraints.errors
            });
            continue;
          }

          // Generate code if not provided
          if (!subjectData.code) {
            const existingCodes = await prisma.subject.findMany({
              where: { schoolId: BigInt(schoolId), deletedAt: null },
              select: { code: true }
            });
            subjectData.code = await generateSubjectCode(
              subjectData.name,
              schoolId,
              existingCodes.map(c => c.code)
            );
          }

          // Create subject with proper createdBy and schoolId
          const createdSubject = await prisma.subject.create({
            data: {
              ...subjectData,
              schoolId: BigInt(schoolId),
              departmentId: subjectData.departmentId ? BigInt(subjectData.departmentId) : null,
              createdBy: BigInt(req.user.id),
              updatedBy: BigInt(req.user.id)
            }
          });

          results.push(createdSubject);
        } catch (error) {
          errors.push({
            index: i,
            error: error.message
          });
        }
      }

      // Clear cache for affected schools
      const schoolIds = [...new Set(subjects.map(s => s.schoolId))];
      for (const schoolId of schoolIds) {
        await cacheManager.invalidatePattern(`subject:${schoolId}:*`);
        await cacheManager.invalidatePattern(`school:${schoolId}:stats`);
      }

      res.status(200).json({
        success: true,
        message: `Import completed. ${results.length} subjects imported, ${errors.length} failed.`,
        data: {
          imported: results,
          errors
        },
        meta: {
          timestamp: new Date().toISOString(),
          total: subjects.length,
          successful: results.length,
          failed: errors.length
        }
      });
    } catch (error) {
      console.error('Import subjects error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to import subjects',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  /**
   * Generate subject code suggestions
   */
  async generateCodeSuggestions(req, res) {
    try {
      const { name, schoolId } = req.query;

      if (!name || !schoolId) {
        return res.status(400).json({
          success: false,
          error: 'Name and schoolId are required',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      const school = await prisma.school.findUnique({
        where: { id: BigInt(schoolId) },
        select: { code: true }
      });

      if (!school) {
        return res.status(404).json({
          success: false,
          error: 'School not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      const suggestions = generateSubjectCodeSuggestions(name, school.code);

      res.status(200).json({
        success: true,
        data: suggestions,
        meta: {
          timestamp: new Date().toISOString(),
          name,
          schoolId
        }
      });
    } catch (error) {
      console.error('Generate code suggestions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate code suggestions',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get subject count by department
   */
  async getSubjectCountByDepartment(req, res) {
    try {
      const { schoolId } = req.query;

      const data = await getSubjectCountByDepartment(schoolId);

      res.status(200).json({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId
        }
      });
    } catch (error) {
      console.error('Get subject count by department error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subject count by department',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get subject count by credit hours
   */
  async getSubjectCountByCreditHours(req, res) {
    try {
      const { schoolId } = req.query;

      const data = await getSubjectCountByCreditHours(schoolId);

      res.status(200).json({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId
        }
      });
    } catch (error) {
      console.error('Get subject count by credit hours error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subject count by credit hours',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get subjects by school
   */
  async getSubjectsBySchool(req, res) {
    try {
      const { schoolId } = req.params;
      const { include } = req.query;

      const includeQuery = buildSubjectIncludeQuery(include);

      const subjects = await prisma.subject.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: includeQuery,
        orderBy: [
          { name: 'asc' }
        ]
      });

      res.status(200).json({
        success: true,
        data: subjects,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId,
          total: subjects.length
        }
      });
    } catch (error) {
      console.error('Get subjects by school error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subjects by school',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get subjects by department
   */
  async getSubjectsByDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const { include } = req.query;
      const { schoolId } = req.user;

      const includeQuery = buildSubjectIncludeQuery(include);

      const subjects = await prisma.subject.findMany({
        where: {
          departmentId: BigInt(departmentId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: includeQuery,
        orderBy: [
          { name: 'asc' }
        ]
      });

      res.status(200).json({
        success: true,
        data: subjects,
        meta: {
          timestamp: new Date().toISOString(),
          departmentId,
          total: subjects.length
        }
      });
    } catch (error) {
      console.error('Get subjects by department error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch subjects by department',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
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
      const stats = await cacheManager.getStats();

      res.status(200).json({
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Get cache stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch cache statistics',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Warm up cache
   */
  async warmCache(req, res) {
    try {
      const { subjectId, schoolId } = req.body;

      if (subjectId) {
        // Warm cache for specific subject
        await generateSubjectStats(subjectId);
        await generateSubjectAnalytics(subjectId);
        await calculateSubjectPerformance(subjectId);
      } else if (schoolId) {
        // Warm cache for all subjects in school
        const subjects = await prisma.subject.findMany({
          where: {
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          select: { id: true }
        });

        for (const subject of subjects) {
          await generateSubjectStats(subject.id.toString());
        }
      } else {
        // Warm cache for all subjects
        const subjects = await prisma.subject.findMany({
          where: { deletedAt: null },
          select: { id: true },
          take: 100 // Limit to prevent timeout
        });

        for (const subject of subjects) {
          await generateSubjectStats(subject.id.toString());
        }
      }

      res.status(200).json({
        success: true,
        message: 'Cache warming completed',
        meta: {
          timestamp: new Date().toISOString(),
          subjectId,
          schoolId
        }
      });
    } catch (error) {
      console.error('Warm cache error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to warm cache',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export default new SubjectController(); 
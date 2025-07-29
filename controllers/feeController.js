import { PrismaClient } from '../generated/prisma/client.js';
import {
  validateFeeStructureData,
  validateFeeItemData,
  validateFeeAssignmentData,
  validateFeeBulkCreateData,
  validateFeeBulkUpdateData,
  validateFeeBulkDeleteData
} from '../validators/feeValidator.js';
import {
  createFeeLog,
  cacheFeeStructure,
  invalidateFeeCache,
  generateFeeStructureCode,
  analyzeFeeStructure,
  exportFeeStructure,
  importFeeStructure
} from '../utils/feeUtils.js';
import { 
  triggerEntityCreatedNotifications,
  triggerEntityUpdatedNotifications,
  triggerEntityDeletedNotifications,
  triggerBulkOperationNotifications
} from '../utils/notificationTriggers.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

class FeeController {
  /**
   * Create a new fee structure
   */
  async createFeeStructure(req, res) {
    try {
      const { error, value } = validateFeeStructureData(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false, 
          message: error.details[0].message 
        });
      }

      const { schoolId, id: userId } = req.user;
      const feeData = { 
        ...value, 
        schoolId: BigInt(schoolId), 
        createdBy: BigInt(userId),
        code: await generateFeeStructureCode(schoolId)
      };

      // Check for existing default structure if this is being set as default
      if (feeData.isDefault) {
        const existingDefault = await prisma.feeStructure.findFirst({
          where: {
            schoolId: BigInt(schoolId),
            classId: feeData.classId ? BigInt(feeData.classId) : null,
            isDefault: true,
            deletedAt: null
          }
        });

        if (existingDefault) {
          return res.status(400).json({
            success: false,
            message: 'A default fee structure already exists for this class/school'
          });
        }
      }

      const feeStructure = await prisma.feeStructure.create({
        data: feeData,
        include: {
          school: true,
          class: true,
          createdByUser: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      // Create audit log
      await createFeeLog(
        feeStructure.id,
        'created',
        null,
        feeStructure,
        req.ip,
        req.get('User-Agent'),
        schoolId,
        userId
      );

      // Trigger automatic notification for fee structure creation
      await triggerEntityCreatedNotifications(
        'fee_structure',
        feeStructure.id.toString(),
        feeStructure,
        req.user,
        {
          auditDetails: {
            feeStructureId: feeStructure.id.toString(),
            feeStructureName: feeStructure.name,
            feeStructureCode: feeStructure.code,
            isDefault: feeStructure.isDefault
          }
        }
      );

      // Cache the new fee structure
      await cacheFeeStructure(feeStructure);

      res.status(201).json({
        success: true,
        message: 'Fee structure created successfully',
        data: feeStructure
      });
    } catch (error) {
      logger.error(`Create fee structure error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create fee structure' 
      });
    }
  }

  /**
   * Get all fee structures with filtering and pagination
   */
  async getFeeStructures(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        isDefault,
        classId,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { 
        schoolId: BigInt(schoolId),
        deletedAt: null 
      };

      // Apply filters
      if (isDefault !== undefined) where.isDefault = isDefault === 'true';
      if (classId) where.classId = BigInt(classId);
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [feeStructures, total] = await Promise.all([
        prisma.feeStructure.findMany({
          where,
          include: {
            school: { select: { id: true, name: true } },
            class: { select: { id: true, name: true } },
            _count: { select: { items: true, assignments: true } }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.feeStructure.count({ where })
      ]);

      res.json({
        success: true,
        data: feeStructures,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error(`Get fee structures error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch fee structures' 
      });
    }
  }

  /**
   * Get fee structure by ID
   */
  async getFeeStructureById(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const feeStructure = await prisma.feeStructure.findFirst({
        where: { 
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        },
        include: {
          school: true,
          class: true,
          items: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' }
          },
          assignments: {
            include: {
              class: true,
              student: true
            }
          },
          createdByUser: {
            select: { id: true, firstName: true, lastName: true }
          },
          updatedByUser: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      if (!feeStructure) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee structure not found' 
        });
      }

      res.json({ 
        success: true, 
        data: feeStructure 
      });
    } catch (error) {
      logger.error(`Get fee structure error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch fee structure' 
      });
    }
  }

  /**
   * Update fee structure
   */
  async updateFeeStructure(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const { error, value } = validateFeeStructureData(req.body, true);

      if (error) {
        return res.status(400).json({ 
          success: false, 
          message: error.details[0].message 
        });
      }

      // Check if fee structure exists
      const existingStructure = await prisma.feeStructure.findFirst({
        where: { 
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        }
      });

      if (!existingStructure) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee structure not found' 
        });
      }

      // Check for default structure conflict if updating isDefault
      if (value.isDefault && value.isDefault !== existingStructure.isDefault) {
        const existingDefault = await prisma.feeStructure.findFirst({
          where: {
            schoolId: BigInt(schoolId),
            classId: value.classId ? BigInt(value.classId) : existingStructure.classId,
            isDefault: true,
            deletedAt: null,
            NOT: { id: BigInt(id) }
          }
        });

        if (existingDefault) {
          return res.status(400).json({
            success: false,
            message: 'A default fee structure already exists for this class/school'
          });
        }
      }

      const updateData = {
        ...value,
        updatedBy: BigInt(userId),
        updatedAt: new Date()
      };

      const updatedStructure = await prisma.feeStructure.update({
        where: { id: BigInt(id) },
        data: updateData,
        include: {
          school: true,
          class: true,
          updatedByUser: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      // Create audit log
      await createFeeLog(
        id,
        'updated',
        existingStructure,
        updatedStructure,
        req.ip,
        req.get('User-Agent'),
        schoolId,
        userId
      );

      // Trigger automatic notification for fee structure update
      await triggerEntityUpdatedNotifications(
        'fee_structure',
        updatedStructure.id.toString(),
        updatedStructure,
        existingStructure,
        req.user,
        {
          auditDetails: {
            feeStructureId: updatedStructure.id.toString(),
            feeStructureName: updatedStructure.name,
            updatedFields: Object.keys(value)
          }
        }
      );

      // Update cache
      await cacheFeeStructure(updatedStructure);

      res.json({
        success: true,
        message: 'Fee structure updated successfully',
        data: updatedStructure
      });
    } catch (error) {
      logger.error(`Update fee structure error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update fee structure' 
      });
    }
  }

  /**
   * Delete fee structure (soft delete)
   */
  async deleteFeeStructure(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;

      // Check if fee structure exists
      const feeStructure = await prisma.feeStructure.findFirst({
        where: { 
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        }
      });

      if (!feeStructure) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee structure not found' 
        });
      }

      // Check for associated payments
      const paymentCount = await prisma.payment.count({
        where: { 
          feeStructureId: BigInt(id),
          deletedAt: null 
        }
      });

      if (paymentCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete fee structure with associated payments'
        });
      }

      await prisma.feeStructure.update({
        where: { id: BigInt(id) },
        data: { 
          deletedAt: new Date(),
          updatedBy: BigInt(userId) 
        }
      });

      // Create audit log
      await createFeeLog(
        id,
        'deleted',
        feeStructure,
        null,
        req.ip,
        req.get('User-Agent'),
        schoolId,
        userId
      );

      // Trigger automatic notification for fee structure deletion
      await triggerEntityDeletedNotifications(
        'fee_structure',
        feeStructure.id.toString(),
        feeStructure,
        req.user,
        {
          auditDetails: {
            feeStructureId: feeStructure.id.toString(),
            feeStructureName: feeStructure.name
          }
        }
      );

      // Invalidate cache
      await invalidateFeeCache(id, schoolId);

      res.json({ 
        success: true, 
        message: 'Fee structure deleted successfully' 
      });
    } catch (error) {
      logger.error(`Delete fee structure error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete fee structure' 
      });
    }
  }

  /**
   * Add item to fee structure
   */
  async addFeeItem(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const { error, value } = validateFeeItemData(req.body);

      if (error) {
        return res.status(400).json({ 
          success: false, 
          message: error.details[0].message 
        });
      }

      // Check if fee structure exists
      const feeStructure = await prisma.feeStructure.findFirst({
        where: { 
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        }
      });

      if (!feeStructure) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee structure not found' 
        });
      }

      const feeItem = await prisma.feeItem.create({
        data: {
          ...value,
          feeStructureId: BigInt(id),
          createdBy: BigInt(userId)
        }
      });

      // Create audit log
      await createFeeLog(
        id,
        'item_added',
        null,
        feeItem,
        req.ip,
        req.get('User-Agent'),
        schoolId,
        userId
      );

      // Invalidate cache to reflect changes
      await invalidateFeeCache(id, schoolId);

      res.status(201).json({
        success: true,
        message: 'Fee item added successfully',
        data: feeItem
      });
    } catch (error) {
      logger.error(`Add fee item error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to add fee item' 
      });
    }
  }

  /**
   * Update fee item
   */
  async updateFeeItem(req, res) {
    try {
      const { itemId } = req.params;
      const { schoolId, id: userId } = req.user;
      const { error, value } = validateFeeItemData(req.body, true);

      if (error) {
        return res.status(400).json({ 
          success: false, 
          message: error.details[0].message 
        });
      }

      // Check if fee item exists
      const feeItem = await prisma.feeItem.findFirst({
        where: { 
          id: BigInt(itemId),
          feeStructure: {
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          deletedAt: null
        }
      });

      if (!feeItem) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee item not found' 
        });
      }

      const oldItem = { ...feeItem };
      const updatedItem = await prisma.feeItem.update({
        where: { id: BigInt(itemId) },
        data: {
          ...value,
          updatedBy: BigInt(userId)
        }
      });

      // Create audit log
      await createFeeLog(
        feeItem.feeStructureId.toString(),
        'item_updated',
        oldItem,
        updatedItem,
        req.ip,
        req.get('User-Agent'),
        schoolId,
        userId
      );

      // Invalidate cache to reflect changes
      await invalidateFeeCache(feeItem.feeStructureId.toString(), schoolId);

      res.json({
        success: true,
        message: 'Fee item updated successfully',
        data: updatedItem
      });
    } catch (error) {
      logger.error(`Update fee item error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to update fee item' 
      });
    }
  }

  /**
   * Delete fee item (soft delete)
   */
  async deleteFeeItem(req, res) {
    try {
      const { itemId } = req.params;
      const { schoolId, id: userId } = req.user;

      // Check if fee item exists
      const feeItem = await prisma.feeItem.findFirst({
        where: { 
          id: BigInt(itemId),
          feeStructure: {
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          deletedAt: null
        }
      });

      if (!feeItem) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee item not found' 
        });
      }

      await prisma.feeItem.update({
        where: { id: BigInt(itemId) },
        data: { 
          deletedAt: new Date(),
          updatedBy: BigInt(userId)
        }
      });

      // Create audit log
      await createFeeLog(
        feeItem.feeStructureId.toString(),
        'item_deleted',
        feeItem,
        null,
        req.ip,
        req.get('User-Agent'),
        schoolId,
        userId
      );

      // Invalidate cache to reflect changes
      await invalidateFeeCache(feeItem.feeStructureId.toString(), schoolId);

      res.json({ 
        success: true, 
        message: 'Fee item deleted successfully' 
      });
    } catch (error) {
      logger.error(`Delete fee item error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete fee item' 
      });
    }
  }

  /**
   * Assign fee structure to class or student
   */
  async assignFeeStructure(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;

      // Remove keys with null or undefined values before validation
      const filteredBody = {};
      for (const key in req.body) {
        if (req.body[key] !== undefined && req.body[key] !== null) {
          filteredBody[key] = req.body[key];
        }
      }

      // Pre-validation check for exactly one of classId or studentId
      const hasClassId = filteredBody.classId !== undefined;
      const hasStudentId = filteredBody.studentId !== undefined;
      if ((hasClassId && hasStudentId) || (!hasClassId && !hasStudentId)) {
        return res.status(400).json({
          success: false,
          message: 'Must specify exactly one of classId or studentId'
        });
      }

      const { error, value } = validateFeeAssignmentData(filteredBody);

      if (error) {
        return res.status(400).json({
          success: false,
          message: error.details.map(detail => detail.message).join(', ')
        });
      }

      // Check if fee structure exists
      const feeStructure = await prisma.feeStructure.findFirst({
        where: { 
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        }
      });

      if (!feeStructure) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee structure not found' 
        });
      }

      // Check if class or student exists
      if (value.classId) {
        const classExists = await prisma.class.findFirst({
          where: { 
            id: BigInt(value.classId),
            schoolId: BigInt(schoolId),
            deletedAt: null 
          }
        });

        if (!classExists) {
          return res.status(404).json({ 
            success: false, 
            message: 'Class not found' 
          });
        }
      } else if (value.studentId) {
        const studentExists = await prisma.student.findFirst({
          where: { 
            id: BigInt(value.studentId),
            schoolId: BigInt(schoolId),
            deletedAt: null 
          }
        });

        if (!studentExists) {
          return res.status(404).json({ 
            success: false, 
            message: 'Student not found' 
          });
        }
      }

      // Check for existing assignment
      const existingAssignment = await prisma.feeAssignment.findFirst({
        where: {
          feeStructureId: BigInt(id),
          classId: value.classId ? BigInt(value.classId) : null,
          studentId: value.studentId ? BigInt(value.studentId) : null,
          deletedAt: null
        }
      });

      if (existingAssignment) {
        return res.status(400).json({
          success: false,
          message: 'Fee structure already assigned to this class/student'
        });
      }

      const assignment = await prisma.feeAssignment.create({
        data: {
          feeStructureId: BigInt(id),
          classId: value.classId ? BigInt(value.classId) : null,
          studentId: value.studentId ? BigInt(value.studentId) : null,
          createdBy: BigInt(userId),
          effectiveFrom: value.effectiveFrom ? new Date(value.effectiveFrom) : new Date(),
          effectiveUntil: value.effectiveUntil ? new Date(value.effectiveUntil) : null
        },
        include: {
          class: true,
          student: true
        }
      });

      // Create audit log
      await createFeeLog(
        id,
        'assigned',
        null,
        assignment,
        req.ip,
        req.get('User-Agent'),
        schoolId,
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Fee structure assigned successfully',
        data: assignment
      });
    } catch (error) {
      logger.error(`Assign fee structure error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to assign fee structure' 
      });
    }
  }

  /**
   * Remove fee structure assignment
   */
  async removeAssignment(req, res) {
    try {
      const { assignmentId } = req.params;
      const { schoolId, id: userId } = req.user;

      // Check if assignment exists
      const assignment = await prisma.feeAssignment.findFirst({
        where: { 
          id: BigInt(assignmentId),
          feeStructure: {
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          deletedAt: null
        }
      });

      if (!assignment) {
        return res.status(404).json({ 
          success: false, 
          message: 'Assignment not found' 
        });
      }

      await prisma.feeAssignment.update({
        where: { id: BigInt(assignmentId) },
        data: { 
          deletedAt: new Date(),
          updatedBy: BigInt(userId)
        }
      });

      // Create audit log
      await createFeeLog(
        assignment.feeStructureId.toString(),
        'unassigned',
        assignment,
        null,
        req.ip,
        req.get('User-Agent'),
        schoolId,
        userId
      );

      res.json({ 
        success: true, 
        message: 'Assignment removed successfully' 
      });
    } catch (error) {
      logger.error(`Remove assignment error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to remove assignment' 
      });
    }
  }

  /**
   * Get applicable fee structures for a student
   */
  async getStudentFeeStructures(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;

      // Get student's class
      const student = await prisma.student.findFirst({
        where: { 
          id: BigInt(studentId),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        },
        select: { classId: true }
      });

      if (!student) {
        return res.status(404).json({ 
          success: false, 
          message: 'Student not found' 
        });
      }

      const now = new Date();

      // Get fee structures assigned to student or their class
      const feeStructures = await prisma.feeStructure.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          OR: [
            // Structures assigned directly to student
            {
              assignments: {
                some: {
                  studentId: BigInt(studentId),
                  OR: [
                    { effectiveUntil: null },
                    { effectiveUntil: { gte: now } }
                  ],
                  effectiveFrom: { lte: now },
                  deletedAt: null
                }
              }
            },
            // Structures assigned to student's class
            {
              assignments: {
                some: {
                  classId: student.classId,
                  studentId: null,
                  OR: [
                    { effectiveUntil: null },
                    { effectiveUntil: { gte: now } }
                  ],
                  effectiveFrom: { lte: now },
                  deletedAt: null
                }
              }
            },
            // Default structures for the school
            {
              isDefault: true,
              classId: null,
              assignments: {
                none: {
                  OR: [
                    { classId: { not: null } },
                    { studentId: { not: null } }
                  ],
                  deletedAt: null
                }
              }
            }
          ]
        },
        include: {
          items: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' }
          },
          _count: {
            select: { assignments: true }
          }
        }
      });

      res.json({ 
        success: true, 
        data: feeStructures 
      });
    } catch (error) {
      logger.error(`Get student fee structures error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get student fee structures' 
      });
    }
  }

  /**
   * Get fee structure analytics
   */
  async getFeeAnalytics(req, res) {
    try {
      const { schoolId } = req.user;

      const [
        totalStructures,
        defaultStructures,
        classSpecificStructures,
        structuresWithItems,
        totalItems,
        averageItems,
        assignmentsCount,
        monthlyCreated
      ] = await Promise.all([
        prisma.feeStructure.count({ 
          where: { schoolId: BigInt(schoolId), deletedAt: null }
        }),
        prisma.feeStructure.count({
          where: { 
            schoolId: BigInt(schoolId), 
            isDefault: true,
            deletedAt: null 
          }
        }),
        prisma.feeStructure.count({
          where: { 
            schoolId: BigInt(schoolId), 
            classId: { not: null },
            deletedAt: null 
          }
        }),
        prisma.feeStructure.count({
          where: {
            schoolId: BigInt(schoolId),
            deletedAt: null,
            items: {
              some: { deletedAt: null }
            }
          }
        }),
        prisma.feeItem.count({
          where: { 
            feeStructure: {
              schoolId: BigInt(schoolId),
              deletedAt: null
            },
            deletedAt: null 
          }
        }),
        prisma.feeStructure.aggregate({
          where: { schoolId: BigInt(schoolId), deletedAt: null },
          _avg: { items: true }
        }),
        prisma.feeAssignment.count({
          where: { 
            feeStructure: {
              schoolId: BigInt(schoolId),
              deletedAt: null
            },
            deletedAt: null 
          }
        }),
        prisma.$queryRaw`
          SELECT 
            DATE_TRUNC('month', "createdAt") as month,
            COUNT(*) as count
          FROM "FeeStructure"
          WHERE "schoolId" = ${BigInt(schoolId)}
          AND "deletedAt" IS NULL
          GROUP BY DATE_TRUNC('month', "createdAt")
          ORDER BY month DESC
          LIMIT 12
        `
      ]);

      res.json({
        success: true,
        data: {
          totalStructures,
          defaultStructures,
          classSpecificStructures,
          structuresWithItems,
          structuresWithoutItems: totalStructures - structuresWithItems,
          totalItems,
          averageItems: averageItems._avg.items || 0,
          assignmentsCount,
          monthlyCreated
        }
      });
    } catch (error) {
      logger.error(`Get fee analytics error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get fee analytics' 
      });
    }
  }

  /**
   * Restore a soft-deleted fee structure
   */
  async restoreFeeStructure(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      // Restore the fee structure (assuming soft delete uses a deletedAt field)
      const feeStructure = await prisma.feeStructure.update({
        where: { id: BigInt(id), schoolId: BigInt(schoolId) },
        data: { deletedAt: null }
      });

      res.json({
        success: true,
        message: 'Fee structure restored successfully',
        data: feeStructure
      });
    } catch (error) {
      logger.error(`Restore fee structure error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to restore fee structure'
      });
    }
  }

  /**
   * Get all assignments for a given fee structure
   */
  async getFeeAssignments(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      // Fetch assignments for the given fee structure
      const assignments = await prisma.feeAssignment.findMany({
        where: {
          feeStructureId: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: {
          class: true,
          student: true
        }
      });

      res.json({
        success: true,
        data: assignments
      });
    } catch (error) {
      logger.error(`Get fee assignments error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch fee assignments'
      });
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStatistics(req, res) {
    try {
      // Example: Return some cache stats, adjust as needed
      const stats = {
        keys: 100,
        hits: 500,
        misses: 50,
        uptime: process.uptime()
      };
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error(`Get cache statistics error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get cache statistics'
      });
    }
  }

  /**
   * Generate fee structure code suggestions
   */
  async generateCodeSuggestions(req, res) {
    try {
      const { name } = req.query;
      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Name query parameter is required'
        });
      }
      // Example: Generate code suggestions based on name
      const suggestions = [
        name.toUpperCase().replace(/\s+/g, '_'),
        name.toLowerCase().replace(/\s+/g, '-'),
        `${name.substring(0, 3).toUpperCase()}-${Date.now()}`
      ];
      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error(`Generate code suggestions error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to generate code suggestions'
      });
    }
  }

  /**
   * Get all fee items
   */
  async getAllFeeItems(req, res) {
    try {
      const { schoolId } = req.user;
      const items = await prisma.feeItem.findMany({
        where: {
          feeStructure: {
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          deletedAt: null
        },
        orderBy: { createdAt: 'asc' }
      });
      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      logger.error(`Get all fee items error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to get fee items'
      });
    }
  }

  /**
   * Generate comprehensive fee report
   */
  async generateFeeReport(req, res) {
    try {
      const { schoolId } = req.user;
      const filters = req.query;

      // Example: Fetch fee structures and related data based on filters
      const feeStructures = await prisma.feeStructure.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          // Add filter conditions based on filters if needed
        },
        include: {
          items: true,
          assignments: true
        }
      });

      // Example: Aggregate or process data for report
      const report = feeStructures.map(fs => ({
        id: fs.id,
        name: fs.name,
        totalItems: fs.items.length,
        totalAssignments: fs.assignments.length
      }));

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error(`Generate fee report error: ${error.message}`);
      res.status(500).json({
        success: false,
        message: 'Failed to generate fee report'
      });
    }
  }

  // Get statistics for a single fee structure
  async getFeeStats(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const feeStructure = await prisma.feeStructure.findUnique({
        where: { id: BigInt(id) },
        include: { items: true }
      });
      if (!feeStructure || feeStructure.schoolId.toString() !== schoolId.toString()) {
        return res.status(404).json({ success: false, message: 'Fee structure not found' });
      }
      const stats = analyzeFeeStructure(feeStructure);
      res.json({ success: true, data: stats });
    } catch (error) {
      logger.error(`Get fee stats error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to get fee stats' });
    }
  }

  // Get analytics for all fee structures in a school
  async getSchoolFeeAnalytics(req, res) {
    try {
      const { schoolId } = req.params;
      const structures = await prisma.feeStructure.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        include: { items: true }
      });
      const summary = structures.map(analyzeFeeStructure);
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error(`Get school fee analytics error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to get school fee analytics' });
    }
  }

  // Bulk create fee structures
  async bulkCreateStructures(req, res) {
    try {
      const { error, value } = validateFeeBulkCreateData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details.map(e => e.message).join(', ') });
      }
      const { schoolId, structures } = value;
      const created = await Promise.all(structures.map(async (structure) => {
        return prisma.feeStructure.create({
          data: {
            ...structure,
            schoolId: BigInt(schoolId),
            items: { create: structure.items }
          },
          include: { items: true }
        });
      }));

      // Trigger bulk operation notification
      await triggerBulkOperationNotifications(
        'fee_structure',
        created.map(s => s.id.toString()),
        'CREATE',
        req.user,
        {
          auditDetails: {
            operation: 'bulk_create',
            count: created.length,
            total: structures.length
          }
        }
      );

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      logger.error(`Bulk create structures error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to bulk create fee structures' });
    }
  }

  // Bulk update fee structures
  async bulkUpdateStructures(req, res) {
    try {
      const { error, value } = validateFeeBulkUpdateData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details.map(e => e.message).join(', ') });
      }
      const { schoolId, updates } = value;
      const results = [];
      const updatedIds = [];
      for (const update of updates) {
        const { feeStructureId, data } = update;
        const structure = await prisma.feeStructure.findUnique({ where: { id: BigInt(feeStructureId) } });
        if (!structure || structure.schoolId.toString() !== schoolId.toString()) {
          results.push({ feeStructureId, error: 'Not found or not in school' });
          continue;
        }
        // Update main structure fields
        const updated = await prisma.feeStructure.update({
          where: { id: BigInt(feeStructureId) },
          data: { ...data }
        });
        // Handle items if present
        if (data.items) {
          for (const item of data.items) {
            if (item.action === 'update' && item.id) {
              await prisma.feeItem.update({ where: { id: BigInt(item.id) }, data: item.data });
            } else if (item.action === 'create') {
              await prisma.feeItem.create({ data: { ...item.data, feeStructureId: BigInt(feeStructureId) } });
            } else if (item.action === 'delete' && item.id) {
              await prisma.feeItem.delete({ where: { id: BigInt(item.id) } });
            }
          }
        }
        results.push({ feeStructureId, updated: true });
        updatedIds.push(feeStructureId);
      }

      // Trigger bulk operation notification
      await triggerBulkOperationNotifications(
        'fee_structure',
        updatedIds,
        'UPDATE',
        req.user,
        {
          auditDetails: {
            operation: 'bulk_update',
            count: updatedIds.length,
            total: updates.length
          }
        }
      );

      res.json({ success: true, data: results });
    } catch (error) {
      logger.error(`Bulk update structures error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to bulk update fee structures' });
    }
  }

  // Bulk delete fee structures
  async bulkDeleteStructures(req, res) {
    try {
      const { error, value } = validateFeeBulkDeleteData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details.map(e => e.message).join(', ') });
      }
      const { schoolId, feeStructureIds } = value;
      const results = [];
      const deletedIds = [];
      for (const id of feeStructureIds) {
        const structure = await prisma.feeStructure.findUnique({ where: { id: BigInt(id) } });
        if (!structure || structure.schoolId.toString() !== schoolId.toString()) {
          results.push({ id, error: 'Not found or not in school' });
          continue;
        }
        await prisma.feeStructure.update({ where: { id: BigInt(id) }, data: { deletedAt: new Date() } });
        results.push({ id, deleted: true });
        deletedIds.push(id);
      }

      // Trigger bulk operation notification
      await triggerBulkOperationNotifications(
        'fee_structure',
        deletedIds,
        'DELETE',
        req.user,
        {
          auditDetails: {
            operation: 'bulk_delete',
            count: deletedIds.length,
            total: feeStructureIds.length
          }
        }
      );

      res.json({ success: true, data: results });
    } catch (error) {
      logger.error(`Bulk delete structures error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to bulk delete fee structures' });
    }
  }

  // Export fee structures as JSON
  async exportFeeStructures(req, res) {
    try {
      const { schoolId } = req.user;
      const structures = await prisma.feeStructure.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        include: { items: true }
      });
      const exported = structures.map(exportFeeStructure);
      res.setHeader('Content-Disposition', 'attachment; filename=fee_structures.json');
      res.json({ success: true, data: exported });
    } catch (error) {
      logger.error(`Export fee structures error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to export fee structures' });
    }
  }

  // Import fee structures from JSON
  async importFeeStructures(req, res) {
    try {
      const { schoolId } = req.user;
      const { structures } = req.body;
      if (!Array.isArray(structures)) {
        return res.status(400).json({ success: false, message: 'Invalid structures array' });
      }
      const created = await Promise.all(structures.map(data => importFeeStructure(data, schoolId)));
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      logger.error(`Import fee structures error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to import fee structures' });
    }
  }

  // Stub for warming up cache
  async warmFeeCache(req, res) {
    res.status(501).json({ success: false, message: 'Not implemented' });
  }

  // Stub for clearing cache
  async clearFeeCache(req, res) {
    res.status(501).json({ success: false, message: 'Not implemented' });
  }
}

// Export as a singleton instance
export default new FeeController();

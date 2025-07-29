import { PrismaClient } from '../generated/prisma/client.js';
import { 
  validateFeeItemCreateData,
  validateFeeItemUpdateData,
  validateFeeItemBulkCreate,
  validateFeeItemBulkUpdate
} from '../validators/feeItemValidator.js';
import {
  createFeeItemAuditLog,
  calculateFeeItemTotal,
  groupFeeItemsByOptionalStatus,
  exportFeeItems,
  importFeeItems
} from '../utils/feeItemUtils.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

class FeeItemController {
  /**
   * Create a new fee item
   */
  async createFeeItem(req, res) {
    try {
      const { error, value } = validateFeeItemCreateData(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false, 
          message: error.details[0].message 
        });
      }

      const { schoolId, id: userId } = req.user;
      const feeItemData = { 
        ...value,
        schoolId: BigInt(schoolId),
        createdBy: BigInt(userId)
      };

      // Verify fee structure exists and belongs to the same school
      const feeStructure = await prisma.feeStructure.findFirst({
        where: {
          id: BigInt(feeItemData.feeStructureId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!feeStructure) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee structure not found or does not belong to this school' 
        });
      }

      const feeItem = await prisma.feeItem.create({
        data: feeItemData,
        include: {
          feeStructure: true,
          school: true,
          createdByUser: {
            select: { id: true, firstName: true, lastName: true }
          }
        }
      });

      // Create audit log
      await createFeeItemAuditLog(
        feeItem.id,
        'created',
        null,
        feeItem,
        schoolId,
        userId,
        req.ip,
        req.get('User-Agent')
      );

      res.status(201).json({
        success: true,
        message: 'Fee item created successfully',
        data: feeItem
      });
    } catch (error) {
      logger.error(`Create fee item error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create fee item' 
      });
    }
  }

  /**
   * Get fee item by ID
   */
  async getFeeItemById(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const feeItem = await prisma.feeItem.findFirst({
        where: { 
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        },
        include: {
          feeStructure: true,
          school: true,
          createdByUser: {
            select: { id: true, firstName: true, lastName: true }
          },
          updatedByUser: {
            select: { id: true, firstName: true, lastName: true }
          },
          paymentItems: {
            where: { deletedAt: null },
            include: {
              payment: true
            }
          }
        }
      });

      if (!feeItem) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee item not found' 
        });
      }

      res.json({ 
        success: true, 
        data: feeItem 
      });
    } catch (error) {
      logger.error(`Get fee item error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch fee item' 
      });
    }
  }

  /**
   * Update fee item
   */
  async updateFeeItem(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const { error, value } = validateFeeItemUpdateData(req.body);

      if (error) {
        return res.status(400).json({ 
          success: false, 
          message: error.details[0].message 
        });
      }

      // Check if fee item exists
      const existingItem = await prisma.feeItem.findFirst({
        where: { 
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        }
      });

      if (!existingItem) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee item not found' 
        });
      }

      // Verify fee structure if being updated
      if (value.feeStructureId) {
        const feeStructure = await prisma.feeStructure.findFirst({
          where: {
            id: BigInt(value.feeStructureId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          }
        });

        if (!feeStructure) {
          return res.status(404).json({ 
            success: false, 
            message: 'Fee structure not found or does not belong to this school' 
          });
        }
      }

      const updatedItem = await prisma.feeItem.update({
        where: { id: BigInt(id) },
        data: {
          ...value,
          updatedBy: BigInt(userId),
          updatedAt: new Date()
        },
        include: {
          feeStructure: true,
          school: true
        }
      });

      // Create audit log
      await createFeeItemAuditLog(
        id,
        'updated',
        existingItem,
        updatedItem,
        schoolId,
        userId,
        req.ip,
        req.get('User-Agent')
      );

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
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;

      // Check if fee item exists
      const feeItem = await prisma.feeItem.findFirst({
        where: { 
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: null 
        }
      });

      if (!feeItem) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee item not found' 
        });
      }

      // Check for associated payment items
      const paymentItemsCount = await prisma.paymentItem.count({
        where: { 
          feeItemId: BigInt(id),
          deletedAt: null 
        }
      });

      if (paymentItemsCount > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete fee item with associated payment items'
        });
      }

      await prisma.feeItem.update({
        where: { id: BigInt(id) },
        data: { 
          deletedAt: new Date(),
          updatedBy: BigInt(userId)
        }
      });

      // Create audit log
      await createFeeItemAuditLog(
        id,
        'deleted',
        feeItem,
        null,
        schoolId,
        userId,
        req.ip,
        req.get('User-Agent')
      );

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
   * Get all fee items with filtering and pagination
   */
  async getFeeItems(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        feeStructureId,
        isOptional,
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
      if (feeStructureId) where.feeStructureId = BigInt(feeStructureId);
      if (isOptional !== undefined) where.isOptional = isOptional === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { feeStructure: { name: { contains: search, mode: 'insensitive' } } }
        ];
      }

      const [feeItems, total] = await Promise.all([
        prisma.feeItem.findMany({
          where,
          include: {
            feeStructure: true,
            school: true,
            _count: { select: { paymentItems: true } }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.feeItem.count({ where })
      ]);

      res.json({
        success: true,
        data: feeItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error(`Get fee items error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch fee items' 
      });
    }
  }

  /**
   * Get fee items by fee structure
   */
  async getFeeItemsByStructure(req, res) {
    try {
      const { structureId } = req.params;
      const { schoolId } = req.user;

      // Verify fee structure belongs to school
      const feeStructure = await prisma.feeStructure.findFirst({
        where: { 
          id: BigInt(structureId),
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

      const feeItems = await prisma.feeItem.findMany({
        where: { 
          feeStructureId: BigInt(structureId),
          deletedAt: null 
        },
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { paymentItems: true } }
        }
      });

      res.json({ 
        success: true, 
        data: feeItems 
      });
    } catch (error) {
      logger.error(`Get fee items by structure error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch fee items' 
      });
    }
  }

  /**
   * Get fee items by school with optional filters
   */
  async getFeeItemsBySchool(req, res) {
    try {
      const { schoolId } = req.user;
      const { isOptional, dueDate } = req.query;

      const where = { 
        schoolId: BigInt(schoolId),
        deletedAt: null 
      };

      // Apply filters
      if (isOptional !== undefined) where.isOptional = isOptional === 'true';
      if (dueDate) where.dueDate = new Date(dueDate);

      const feeItems = await prisma.feeItem.findMany({
        where,
        orderBy: { name: 'asc' },
        include: {
          feeStructure: {
            include: {
              class: true
            }
          },
          _count: { select: { paymentItems: true } }
        }
      });

      res.json({ 
        success: true, 
        data: feeItems 
      });
    } catch (error) {
      logger.error(`Get fee items by school error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch fee items' 
      });
    }
  }

  /**
   * Get upcoming due fee items
   */
  async getUpcomingDueItems(req, res) {
    try {
      const { schoolId } = req.user;
      const days = parseInt(req.query.days) || 30;

      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + days);

      const feeItems = await prisma.feeItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          dueDate: {
            gte: today,
            lte: endDate
          },
          deletedAt: null
        },
        orderBy: { dueDate: 'asc' },
        include: {
          feeStructure: {
            include: {
              class: true
            }
          }
        }
      });

      res.json({ 
        success: true, 
        data: feeItems 
      });
    } catch (error) {
      logger.error(`Get upcoming due fee items error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch upcoming due fee items' 
      });
    }
  }

  /**
   * Get overdue fee items
   */
  async getOverdueItems(req, res) {
    try {
      const { schoolId } = req.user;
      const today = new Date();

      const feeItems = await prisma.feeItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          dueDate: {
            lt: today,
            not: null
          },
          deletedAt: null
        },
        orderBy: { dueDate: 'asc' },
        include: {
          feeStructure: {
            include: {
              class: true
            }
          }
        }
      });

      res.json({ 
        success: true, 
        data: feeItems 
      });
    } catch (error) {
      logger.error(`Get overdue fee items error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch overdue fee items' 
      });
    }
  }

  /**
   * Get fee item statistics
   */
  async getFeeItemStatistics(req, res) {
    try {
      const { schoolId } = req.user;

      const [
        totalItems,
        optionalItems,
        itemsWithDueDate,
        itemsWithoutDueDate,
        totalAmount,
        averageAmount
      ] = await Promise.all([
        prisma.feeItem.count({ 
          where: { schoolId: BigInt(schoolId), deletedAt: null }
        }),
        prisma.feeItem.count({
          where: { 
            schoolId: BigInt(schoolId), 
            isOptional: true,
            deletedAt: null 
          }
        }),
        prisma.feeItem.count({
          where: { 
            schoolId: BigInt(schoolId), 
            dueDate: { not: null },
            deletedAt: null 
          }
        }),
        prisma.feeItem.count({
          where: { 
            schoolId: BigInt(schoolId), 
            dueDate: null,
            deletedAt: null 
          }
        }),
        prisma.feeItem.aggregate({
          where: { schoolId: BigInt(schoolId), deletedAt: null },
          _sum: { amount: true }
        }),
        prisma.feeItem.aggregate({
          where: { schoolId: BigInt(schoolId), deletedAt: null },
          _avg: { amount: true }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalItems,
          optionalItems,
          requiredItems: totalItems - optionalItems,
          itemsWithDueDate,
          itemsWithoutDueDate,
          totalAmount: totalAmount._sum.amount || 0,
          averageAmount: averageAmount._avg.amount || 0
        }
      });
    } catch (error) {
      logger.error(`Get fee item statistics error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch fee item statistics' 
      });
    }
  }

  /**
   * Bulk create fee items
   */
  async bulkCreateItems(req, res) {
    try {
      const { error, value } = validateFeeItemBulkCreate(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false, 
          message: error.details[0].message 
        });
      }

      const { schoolId, id: userId } = req.user;
      const { items } = value;

      // Verify all fee structures belong to the school
      const structureIds = [...new Set(items.map(item => item.feeStructureId))];
      const structuresCount = await prisma.feeStructure.count({
        where: {
          id: { in: structureIds.map(id => BigInt(id)) },
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (structuresCount !== structureIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more fee structures not found or do not belong to this school'
        });
      }

      const createdItems = await prisma.$transaction(
        items.map(item => 
          prisma.feeItem.create({
            data: {
              ...item,
              schoolId: BigInt(schoolId),
              createdBy: BigInt(userId)
            },
            include: {
              feeStructure: true
            }
          })
        )
      );

      // Create audit logs
      await Promise.all(
        createdItems.map(item => 
          createFeeItemAuditLog(
            item.id,
            'bulk_created',
            null,
            item,
            schoolId,
            userId,
            req.ip,
            req.get('User-Agent')
          )
        )
      );

      res.status(201).json({
        success: true,
        message: `${createdItems.length} fee items created successfully`,
        data: createdItems
      });
    } catch (error) {
      logger.error(`Bulk create fee items error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to bulk create fee items' 
      });
    }
  }

  /**
   * Bulk update fee items
   */
  async bulkUpdateItems(req, res) {
    try {
      const { error, value } = validateFeeItemBulkUpdate(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false, 
          message: error.details[0].message 
        });
      }

      const { schoolId, id: userId } = req.user;
      const { updates } = value;

      const results = [];
      for (const update of updates) {
        try {
          // Check if fee item exists and belongs to school
          const feeItem = await prisma.feeItem.findFirst({
            where: {
              id: BigInt(update.id),
              schoolId: BigInt(schoolId),
              deletedAt: null
            }
          });

          if (!feeItem) {
            results.push({
              id: update.id,
              success: false,
              message: 'Fee item not found'
            });
            continue;
          }

          // Verify fee structure if being updated
          if (update.data.feeStructureId) {
            const feeStructure = await prisma.feeStructure.findFirst({
              where: {
                id: BigInt(update.data.feeStructureId),
                schoolId: BigInt(schoolId),
                deletedAt: null
              }
            });

            if (!feeStructure) {
              results.push({
                id: update.id,
                success: false,
                message: 'Fee structure not found'
              });
              continue;
            }
          }

          const updatedItem = await prisma.feeItem.update({
            where: { id: BigInt(update.id) },
            data: {
              ...update.data,
              updatedBy: BigInt(userId),
              updatedAt: new Date()
            }
          });

          // Create audit log
          await createFeeItemAuditLog(
            update.id,
            'bulk_updated',
            feeItem,
            updatedItem,
            schoolId,
            userId,
            req.ip,
            req.get('User-Agent')
          );

          results.push({
            id: update.id,
            success: true,
            message: 'Updated successfully'
          });
        } catch (error) {
          results.push({
            id: update.id,
            success: false,
            message: error.message
          });
        }
      }

      res.json({
        success: true,
        message: 'Bulk update completed',
        data: results
      });
    } catch (error) {
      logger.error(`Bulk update fee items error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to bulk update fee items' 
      });
    }
  }

  /**
   * Export fee items
   */
  async exportFeeItems(req, res) {
    try {
      const { schoolId } = req.user;
      const { format = 'json' } = req.query;

      const feeItems = await prisma.feeItem.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: {
          feeStructure: true,
          school: true
        }
      });

      const exportedData = exportFeeItems(feeItems);

      if (format === 'csv') {
        // Convert to CSV (simplified example)
        const headers = Object.keys(exportedData[0]).join(',');
        const csvRows = exportedData.map(item => 
          Object.values(item).map(val => 
            typeof val === 'object' ? JSON.stringify(val) : val
          ).join(',')
        );
        const csv = [headers, ...csvRows].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=fee_items.csv');
        return res.send(csv);
      }

      // Default to JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=fee_items.json');
      res.json(exportedData);
    } catch (error) {
      logger.error(`Export fee items error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to export fee items' 
      });
    }
  }

  /**
   * Import fee items
   */
  async importFeeItems(req, res) {
    try {
      const { schoolId, id: userId } = req.user;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid items format' 
        });
      }

      // Verify all fee structures belong to the school
      const structureIds = [...new Set(items.map(item => item.feeStructureId))];
      const structuresCount = await prisma.feeStructure.count({
        where: {
          id: { in: structureIds.map(id => BigInt(id)) },
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (structuresCount !== structureIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more fee structures not found or do not belong to this school'
        });
      }

      const importedItems = await importFeeItems(items, schoolId, userId);

      // Create audit logs
      await Promise.all(
        importedItems.map(item => 
          createFeeItemAuditLog(
            item.id,
            'imported',
            null,
            item,
            schoolId,
            userId,
            req.ip,
            req.get('User-Agent')
          )
        )
      );

      res.status(201).json({
        success: true,
        message: `${importedItems.length} fee items imported successfully`,
        data: importedItems
      });
    } catch (error) {
      logger.error(`Import fee items error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to import fee items' 
      });
    }
  }

  /**
   * Get fee item history
   */
  async getFeeItemHistory(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      // Check if fee item exists and belongs to school
      const feeItem = await prisma.feeItem.findFirst({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId)
        }
      });

      if (!feeItem) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee item not found' 
        });
      }

      const history = await prisma.feeItemAuditLog.findMany({
        where: {
          feeItemId: BigInt(id)
        },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { firstName: true, lastName: true }
          }
        }
      });

      res.json({ 
        success: true, 
        data: history 
      });
    } catch (error) {
      logger.error(`Get fee item history error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch fee item history' 
      });
    }
  }

  /**
   * Calculate totals for fee items
   */
  async calculateFeeItemTotals(req, res) {
    try {
      const { schoolId } = req.user;
      const { feeItemIds } = req.body;

      if (!Array.isArray(feeItemIds)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid fee item IDs format' 
        });
      }

      const feeItems = await prisma.feeItem.findMany({
        where: {
          id: { in: feeItemIds.map(id => BigInt(id)) },
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (feeItems.length !== feeItemIds.length) {
        return res.status(400).json({
          success: false,
          message: 'One or more fee items not found or do not belong to this school'
        });
      }

      const total = calculateFeeItemTotal(feeItems);
      const grouped = groupFeeItemsByOptionalStatus(feeItems);

      res.json({
        success: true,
        data: {
          total,
          optionalTotal: calculateFeeItemTotal(grouped.optional),
          requiredTotal: calculateFeeItemTotal(grouped.required),
          itemCount: feeItems.length,
          optionalCount: grouped.optional.length,
          requiredCount: grouped.required.length
        }
      });
    } catch (error) {
      logger.error(`Calculate fee item totals error: ${error.message}`);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to calculate fee item totals' 
      });
    }
  }

  /**
   * Restore deleted fee item
   */
  async restoreFeeItem(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      // Find the soft-deleted fee item
      const feeItem = await prisma.feeItem.findFirst({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId),
          deletedAt: { not: null }
        }
      });
      if (!feeItem) {
        return res.status(404).json({ success: false, message: 'Fee item not found or not deleted' });
      }
      // Restore the fee item
      const restored = await prisma.feeItem.update({
        where: { id: BigInt(id) },
        data: { deletedAt: null, updatedBy: BigInt(userId), updatedAt: new Date() }
      });
      res.json({ success: true, message: 'Fee item restored successfully', data: restored });
    } catch (error) {
      logger.error(`Restore fee item error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to restore fee item' });
    }
  }

  /**
   * Bulk delete fee items
   */
  async bulkDeleteItems(req, res) {
    try {
      const { schoolId, id: userId } = req.user;
      const { feeItemIds } = req.body;
      if (!Array.isArray(feeItemIds) || feeItemIds.length === 0) {
        return res.status(400).json({ success: false, message: 'feeItemIds must be a non-empty array' });
      }
      const results = [];
      for (const id of feeItemIds) {
        try {
          const feeItem = await prisma.feeItem.findFirst({
            where: { id: BigInt(id), schoolId: BigInt(schoolId), deletedAt: null }
          });
          if (!feeItem) {
            results.push({ id, success: false, message: 'Fee item not found' });
            continue;
          }
          await prisma.feeItem.update({
            where: { id: BigInt(id) },
            data: { deletedAt: new Date(), updatedBy: BigInt(userId), updatedAt: new Date() }
          });
          results.push({ id, success: true, message: 'Deleted successfully' });
        } catch (error) {
          results.push({ id, success: false, message: error.message });
        }
      }
      res.json({ success: true, data: results });
    } catch (error) {
      logger.error(`Bulk delete fee items error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to bulk delete fee items' });
    }
  }

  /**
   * Get due date summary
   */
  async getDueDateSummary(req, res) {
    try {
      const { schoolId } = req.query;
      const { structureId } = req.query;
      if (!schoolId && !structureId) {
        return res.status(400).json({ success: false, message: 'schoolId or structureId is required' });
      }
      const where = { deletedAt: null };
      if (schoolId) where.schoolId = BigInt(schoolId);
      if (structureId) where.feeStructureId = BigInt(structureId);
      const items = await prisma.feeItem.findMany({
        where,
        select: { dueDate: true, id: true }
      });
      const summary = items.reduce((acc, item) => {
        const key = item.dueDate ? item.dueDate.toISOString().split('T')[0] : 'no_due_date';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error(`Get due date summary error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to get due date summary' });
    }
  }

  /**
   * Get optional items summary
   */
  async getOptionalItemsSummary(req, res) {
    try {
      const { schoolId } = req.query;
      const { structureId } = req.query;
      if (!schoolId && !structureId) {
        return res.status(400).json({ success: false, message: 'schoolId or structureId is required' });
      }
      const where = { deletedAt: null, isOptional: true };
      if (schoolId) where.schoolId = BigInt(schoolId);
      if (structureId) where.feeStructureId = BigInt(structureId);
      const items = await prisma.feeItem.findMany({
        where,
        select: { id: true, name: true, amount: true, dueDate: true }
      });
      res.json({ success: true, data: items });
    } catch (error) {
      logger.error(`Get optional items summary error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to get optional items summary' });
    }
  }

  /**
   * Warm up fee item cache
   */
  async warmFeeItemCache(req, res) {
    try {
      const { structureId } = req.body;
      if (structureId) {
        // Warm cache for a specific structure
        const items = await prisma.feeItem.findMany({
          where: { feeStructureId: BigInt(structureId), deletedAt: null },
        });
        await setFeeItemsByStructureInCache(structureId, items);
      } else {
        // Warm cache for all structures
        const structures = await prisma.feeStructure.findMany({ where: { deletedAt: null }, select: { id: true } });
        for (const s of structures) {
          const items = await prisma.feeItem.findMany({ where: { feeStructureId: s.id, deletedAt: null } });
          await setFeeItemsByStructureInCache(s.id, items);
        }
      }
      res.json({ success: true, message: 'Fee item cache warmed up' });
    } catch (error) {
      logger.error(`Warm fee item cache error: ${error.message}`);
      res.status(500).json({ success: false, message: 'Failed to warm fee item cache' });
    }
  }
}

// Export as a singleton instance
export default new FeeItemController();
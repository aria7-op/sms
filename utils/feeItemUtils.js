import Joi from 'joi';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

// Fee Item validation schemas
const feeItemCreateSchema = Joi.object({
  feeStructureId: Joi.number().positive().required()
    .messages({
      'number.base': 'Fee Structure ID must be a number',
      'number.positive': 'Fee Structure ID must be positive',
      'any.required': 'Fee Structure ID is required'
    }),
  name: Joi.string().max(100).required()
    .messages({
      'string.base': 'Name must be a string',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
  amount: Joi.number().positive().precision(2).required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be positive',
      'any.required': 'Amount is required'
    }),
  isOptional: Joi.boolean().default(false)
    .messages({
      'boolean.base': 'Optional flag must be true or false'
    }),
  dueDate: Joi.date().iso().optional()
    .messages({
      'date.base': 'Due date must be a valid date',
      'date.format': 'Due date must be in ISO format'
    }),
  schoolId: Joi.number().positive().required()
    .messages({
      'number.base': 'School ID must be a number',
      'number.positive': 'School ID must be positive',
      'any.required': 'School ID is required'
    }),
  createdBy: Joi.number().positive().required()
    .messages({
      'number.base': 'Created By must be a number',
      'number.positive': 'Created By must be positive',
      'any.required': 'Created By is required'
    })
});

const feeItemUpdateSchema = Joi.object({
  name: Joi.string().max(100).optional()
    .messages({
      'string.base': 'Name must be a string',
      'string.max': 'Name cannot exceed 100 characters'
    }),
  amount: Joi.number().positive().precision(2).optional()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be positive'
    }),
  isOptional: Joi.boolean().optional()
    .messages({
      'boolean.base': 'Optional flag must be true or false'
    }),
  dueDate: Joi.date().iso().optional()
    .messages({
      'date.base': 'Due date must be a valid date',
      'date.format': 'Due date must be in ISO format'
    }),
  updatedBy: Joi.number().positive().optional()
    .messages({
      'number.base': 'Updated By must be a number',
      'number.positive': 'Updated By must be positive'
    })
}).min(1)
  .messages({
    'object.min': 'At least one field must be provided for update'
  });

// Validation functions
export const validateFeeItemCreate = (data) => {
  return feeItemCreateSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
};

export const validateFeeItemUpdate = (data) => {
  return feeItemUpdateSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
};

// Fee Item utilities
export const calculateFeeItemTotal = (feeItems) => {
  return feeItems.reduce((total, item) => total + parseFloat(item.amount), 0);
};

export const groupFeeItemsByOptionalStatus = (feeItems) => {
  return feeItems.reduce((acc, item) => {
    const key = item.isOptional ? 'optional' : 'required';
    acc[key].push(item);
    return acc;
  }, { optional: [], required: [] });
};

export const getFeeItemsByDueDateRange = async (schoolId, startDate, endDate) => {
  try {
    return await prisma.feeItem.findMany({
      where: {
        schoolId: BigInt(schoolId),
        dueDate: {
          gte: new Date(startDate),
          lte: new Date(endDate)
        },
        deletedAt: null
      },
      orderBy: { dueDate: 'asc' },
      include: {
        feeStructure: {
          select: {
            id: true,
            name: true,
            class: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting fee items by date range: ${error.message}`);
    throw error;
  }
};

export const getUpcomingDueFeeItems = async (schoolId, days = 30) => {
  try {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + days);

    return await prisma.feeItem.findMany({
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
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting upcoming due fee items: ${error.message}`);
    throw error;
  }
};

export const getOverdueFeeItems = async (schoolId) => {
  try {
    const today = new Date();

    return await prisma.feeItem.findMany({
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
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting overdue fee items: ${error.message}`);
    throw error;
  }
};

export const calculateFeeItemStatistics = async (schoolId) => {
  try {
    const where = {
      schoolId: BigInt(schoolId),
      deletedAt: null
    };

    const [
      totalFeeItems,
      optionalFeeItems,
      feeItemsWithDueDate,
      feeItemsWithoutDueDate
    ] = await Promise.all([
      prisma.feeItem.count({ where }),
      prisma.feeItem.count({
        where: { ...where, isOptional: true }
      }),
      prisma.feeItem.count({
        where: { ...where, dueDate: { not: null } }
      }),
      prisma.feeItem.count({
        where: { ...where, dueDate: null }
      })
    ]);

    return {
      totalFeeItems,
      optionalFeeItems,
      requiredFeeItems: totalFeeItems - optionalFeeItems,
      feeItemsWithDueDate,
      feeItemsWithoutDueDate
    };
  } catch (error) {
    logger.error(`Error calculating fee item statistics: ${error.message}`);
    throw error;
  }
};

export const cloneFeeItems = async (sourceFeeStructureId, targetFeeStructureId, schoolId, createdBy) => {
  try {
    const feeItems = await prisma.feeItem.findMany({
      where: {
        feeStructureId: BigInt(sourceFeeStructureId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (feeItems.length === 0) {
      return [];
    }

    const createdItems = await prisma.$transaction(
      feeItems.map(item => prisma.feeItem.create({
        data: {
          feeStructureId: BigInt(targetFeeStructureId),
          name: item.name,
          amount: item.amount,
          isOptional: item.isOptional,
          dueDate: item.dueDate,
          schoolId: BigInt(schoolId),
          createdBy: BigInt(createdBy)
        }
      }))
    );

    return createdItems;
  } catch (error) {
    logger.error(`Error cloning fee items: ${error.message}`);
    throw error;
  }
};

export const generateFeeItemCode = async (schoolId, prefix = 'FEEITEM') => {
  try {
    const count = await prisma.feeItem.count({
      where: {
        schoolId: BigInt(schoolId)
      }
    });

    return `${prefix}-${(count + 1).toString().padStart(4, '0')}`;
  } catch (error) {
    logger.error(`Error generating fee item code: ${error.message}`);
    throw error;
  }
};

export const validateFeeItemAssignment = async (feeItemId, schoolId) => {
  try {
    const feeItem = await prisma.feeItem.findFirst({
      where: {
        id: BigInt(feeItemId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (!feeItem) {
      throw new Error('Fee item not found or does not belong to this school');
    }

    return feeItem;
  } catch (error) {
    logger.error(`Error validating fee item assignment: ${error.message}`);
    throw error;
  }
};

export const getFeeItemsByStructure = async (feeStructureId, schoolId) => {
  try {
    return await prisma.feeItem.findMany({
      where: {
        feeStructureId: BigInt(feeStructureId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      orderBy: { name: 'asc' }
    });
  } catch (error) {
    logger.error(`Error getting fee items by structure: ${error.message}`);
    throw error;
  }
};

export const getFeeItemsBySchool = async (schoolId, filters = {}) => {
  try {
    const { isOptional, dueDate } = filters;

    return await prisma.feeItem.findMany({
      where: {
        schoolId: BigInt(schoolId),
        deletedAt: null,
        ...(isOptional !== undefined && { isOptional }),
        ...(dueDate && { dueDate: new Date(dueDate) })
      },
      orderBy: { name: 'asc' },
      include: {
        feeStructure: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting fee items by school: ${error.message}`);
    throw error;
  }
};

export const searchFeeItems = async (schoolId, searchTerm, limit = 20) => {
  try {
    return await prisma.feeItem.findMany({
      where: {
        schoolId: BigInt(schoolId),
        deletedAt: null,
        name: {
          contains: searchTerm,
          mode: 'insensitive'
        }
      },
      take: parseInt(limit),
      orderBy: { name: 'asc' },
      include: {
        feeStructure: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  } catch (error) {
    logger.error(`Error searching fee items: ${error.message}`);
    throw error;
  }
};

export const checkFeeItemUsage = async (feeItemId) => {
  try {
    const paymentItemsCount = await prisma.paymentItem.count({
      where: {
        feeItemId: BigInt(feeItemId),
        deletedAt: null
      }
    });

    return paymentItemsCount > 0;
  } catch (error) {
    logger.error(`Error checking fee item usage: ${error.message}`);
    throw error;
  }
};

export const bulkUpdateFeeItems = async (updates, schoolId, updatedBy) => {
  try {
    return await prisma.$transaction(
      updates.map(update => prisma.feeItem.update({
        where: {
          id: BigInt(update.id),
          schoolId: BigInt(schoolId)
        },
        data: {
          ...update.data,
          updatedBy: BigInt(updatedBy),
          updatedAt: new Date()
        }
      }))
    );
  } catch (error) {
    logger.error(`Error in bulk updating fee items: ${error.message}`);
    throw error;
  }
};

export const bulkDeleteFeeItems = async (feeItemIds, schoolId, deletedBy) => {
  try {
    return await prisma.$transaction(
      feeItemIds.map(id => prisma.feeItem.update({
        where: {
          id: BigInt(id),
          schoolId: BigInt(schoolId)
        },
        data: {
          deletedAt: new Date(),
          updatedBy: BigInt(deletedBy)
        }
      }))
    );
  } catch (error) {
    logger.error(`Error in bulk deleting fee items: ${error.message}`);
    throw error;
  }
};

export const exportFeeItems = async (feeItemIds, schoolId) => {
  try {
    const feeItems = await prisma.feeItem.findMany({
      where: {
        id: { in: feeItemIds.map(id => BigInt(id)) },
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        feeStructure: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return feeItems.map(item => ({
      id: item.id.toString(),
      name: item.name,
      amount: item.amount.toString(),
      isOptional: item.isOptional,
      dueDate: item.dueDate?.toISOString() || null,
      feeStructure: {
        id: item.feeStructure.id.toString(),
        name: item.feeStructure.name
      },
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString()
    }));
  } catch (error) {
    logger.error(`Error exporting fee items: ${error.message}`);
    throw error;
  }
};

export const importFeeItems = async (items, feeStructureId, schoolId, createdBy) => {
  try {
    return await prisma.$transaction(
      items.map(item => prisma.feeItem.create({
        data: {
          feeStructureId: BigInt(feeStructureId),
          name: item.name,
          amount: parseFloat(item.amount),
          isOptional: item.isOptional || false,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          schoolId: BigInt(schoolId),
          createdBy: BigInt(createdBy)
        }
      }))
    );
  } catch (error) {
    logger.error(`Error importing fee items: ${error.message}`);
    throw error;
  }
};

export const createFeeItemAuditLog = async (
  feeItemId,
  action,
  oldData,
  newData,
  schoolId,
  userId,
  ipAddress,
  userAgent
) => {
  try {
    await prisma.feeItemAuditLog.create({
      data: {
        feeItemId: BigInt(feeItemId),
        action,
        oldData: oldData ? JSON.stringify(oldData) : null,
        newData: newData ? JSON.stringify(newData) : null,
        schoolId: BigInt(schoolId),
        userId: BigInt(userId),
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    logger.error(`Error creating fee item audit log: ${error.message}`);
    // Fail silently as audit logs shouldn't break main operations
  }
};

export const getFeeItemHistory = async (feeItemId, schoolId) => {
  try {
    return await prisma.feeItemAuditLog.findMany({
      where: {
        feeItemId: BigInt(feeItemId),
        schoolId: BigInt(schoolId)
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
  } catch (error) {
    logger.error(`Error getting fee item history: ${error.message}`);
    throw error;
  }
};

export const validateFeeItemBulkCreate = (data) => {
  const schema = Joi.array().items(
    Joi.object({
      name: Joi.string().max(100).required(),
      amount: Joi.number().positive().precision(2).required(),
      isOptional: Joi.boolean().default(false),
      dueDate: Joi.date().iso().optional(),
      feeStructureId: Joi.number().positive().required(),
      schoolId: Joi.number().positive().required(),
      createdBy: Joi.number().positive().required()
    })
  ).min(1);

  return schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
};

export const validateFeeItemBulkUpdate = (data) => {
  const schema = Joi.array().items(
    Joi.object({
      id: Joi.number().positive().required(),
      data: Joi.object({
        name: Joi.string().max(100).optional(),
        amount: Joi.number().positive().precision(2).optional(),
        isOptional: Joi.boolean().optional(),
        dueDate: Joi.date().iso().optional(),
        updatedBy: Joi.number().positive().required()
      }).min(1)
    })
  ).min(1);

  return schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  });
};

// Bulk create schema
export const FeeItemBulkCreateSchema = Joi.array().items(
  Joi.object({
    name: Joi.string().max(100).required(),
    amount: Joi.number().positive().precision(2).required(),
    isOptional: Joi.boolean().default(false),
    dueDate: Joi.date().iso().optional(),
    feeStructureId: Joi.number().positive().required(),
    schoolId: Joi.number().positive().required(),
    createdBy: Joi.number().positive().required()
  })
).min(1);

// Bulk update schema
export const FeeItemBulkUpdateSchema = Joi.array().items(
  Joi.object({
    id: Joi.number().positive().required(),
    data: Joi.object({
      name: Joi.string().max(100).optional(),
      amount: Joi.number().positive().precision(2).optional(),
      isOptional: Joi.boolean().optional(),
      dueDate: Joi.date().iso().optional(),
      updatedBy: Joi.number().positive().required()
    }).min(1)
  })
).min(1);

// Bulk delete schema
export const FeeItemBulkDeleteSchema = Joi.object({
  schoolId: Joi.number().positive().required(),
  feeItemIds: Joi.array().items(Joi.number().positive().required()).min(1).required(),
  deletedBy: Joi.number().positive().required()
});

export const FeeItemCreateSchema = feeItemCreateSchema;
export const FeeItemUpdateSchema = feeItemUpdateSchema;

// Fee Item search schema
export const FeeItemSearchSchema = Joi.object({
  name: Joi.string().max(100).optional(),
  amount: Joi.number().positive().precision(2).optional(),
  dueDate: Joi.date().iso().optional(),
  feeStructureId: Joi.number().positive().optional(),
  schoolId: Joi.number().positive().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

export default {
  validateFeeItemCreate,
  validateFeeItemUpdate,
  calculateFeeItemTotal,
  groupFeeItemsByOptionalStatus,
  getFeeItemsByDueDateRange,
  getUpcomingDueFeeItems,
  getOverdueFeeItems,
  calculateFeeItemStatistics,
  cloneFeeItems,
  generateFeeItemCode,
  validateFeeItemAssignment,
  getFeeItemsByStructure,
  getFeeItemsBySchool,
  searchFeeItems,
  checkFeeItemUsage,
  bulkUpdateFeeItems,
  bulkDeleteFeeItems,
  exportFeeItems,
  importFeeItems,
  createFeeItemAuditLog,
  getFeeItemHistory,
  validateFeeItemBulkCreate,
  validateFeeItemBulkUpdate,
  FeeItemBulkCreateSchema,
  FeeItemBulkUpdateSchema,
  FeeItemBulkDeleteSchema,
  FeeItemSearchSchema
};
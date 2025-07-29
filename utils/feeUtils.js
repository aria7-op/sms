import Joi from 'joi';
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Redis client (disabled for now)
let redisClient = null;
let logger = {
  error: (...args) => console.error(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  debug: (...args) => console.log(...args)
}; // Simple logger fallback

// Fee Structure validation schemas
const feeStructureSchema = Joi.object({
  name: Joi.string().max(100).required(),
  description: Joi.string().max(500).optional(),
  classId: Joi.number().positive().optional(),
  isDefault: Joi.boolean().default(false),
  schoolId: Joi.number().positive().required(),
  items: Joi.array().items(
    Joi.object({
      name: Joi.string().max(100).required(),
      amount: Joi.number().positive().required(),
      taxRate: Joi.number().min(0).max(100).default(0),
      discountable: Joi.boolean().default(false),
      optional: Joi.boolean().default(false),
      frequency: Joi.string().valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER').required(),
      dueDate: Joi.date().optional(),
      lateFee: Joi.object({
        type: Joi.string().valid('FIXED', 'PERCENTAGE').required(),
        value: Joi.number().positive().required(),
        cap: Joi.number().positive().optional()
      }).optional()
    }).min(1)
  ).required()
});

const feeItemSchema = Joi.object({
  name: Joi.string().max(100).required(),
  amount: Joi.number().positive().required(),
  taxRate: Joi.number().min(0).max(100).default(0),
  discountable: Joi.boolean().default(false),
  optional: Joi.boolean().default(false),
  frequency: Joi.string().valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER').required(),
  dueDate: Joi.date().optional(),
  lateFee: Joi.object({
    type: Joi.string().valid('FIXED', 'PERCENTAGE').required(),
    value: Joi.number().positive().required(),
    cap: Joi.number().positive().optional()
  }).optional()
});

// Validation functions
export const validateFeeStructure = (data, isUpdate = false) => {
  const schema = isUpdate ? 
    feeStructureSchema.fork(['schoolId', 'items'], (field) => field.optional()) : 
    feeStructureSchema;
  return schema.validate(data);
};

export const validateFeeItem = (data) => {
  return feeItemSchema.validate(data);
};

// Fee calculation utilities
export const calculateFeeTotal = (items) => {
  return items.reduce((total, item) => {
    const itemTotal = item.amount * (1 + (item.taxRate / 100));
    return total + itemTotal;
  }, 0);
};

export const calculateInstallmentAmounts = (totalAmount, installments) => {
  const baseAmount = Math.floor(totalAmount / installments);
  const remainder = totalAmount % installments;
  
  return Array(installments).fill().map((_, i) => 
    baseAmount + (i < remainder ? 1 : 0)
  );
};

// Frequency calculations
export const getNextDueDate = (frequency, startDate = new Date()) => {
  const date = new Date(startDate);
  switch(frequency) {
    case 'MONTHLY':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'QUARTERLY':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'SEMESTER':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'YEARLY':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default: // ONE_TIME
      return null;
  }
  return date;
};

// Default structure management
export const setDefaultFeeStructure = async (schoolId, feeStructureId) => {
  // Clear previous default
  await prisma.feeStructure.updateMany({
    where: { 
      schoolId: BigInt(schoolId),
      isDefault: true 
    },
    data: { isDefault: false }
  });

  // Set new default
  return prisma.feeStructure.update({
    where: { id: BigInt(feeStructureId) },
    data: { isDefault: true }
  });
};

// Fee structure cloning
export const cloneFeeStructure = async (sourceId, newName, schoolId) => {
  const source = await prisma.feeStructure.findUnique({
    where: { id: BigInt(sourceId) },
    include: { items: true }
  });

  if (!source) throw new Error('Source fee structure not found');

  return prisma.feeStructure.create({
    data: {
      name: newName,
      description: `Cloned from ${source.name}`,
      schoolId: BigInt(schoolId),
      classId: source.classId ? BigInt(source.classId) : null,
      items: {
        create: source.items.map(item => ({
          name: item.name,
          amount: item.amount,
          taxRate: item.taxRate,
          discountable: item.discountable,
          optional: item.optional,
          frequency: item.frequency,
          dueDate: item.dueDate,
          lateFee: item.lateFee
        }))
      }
    }
  });
};

// Fee structure comparison
export const compareFeeStructures = (structureA, structureB) => {
  const itemsA = structureA.items.sort((a, b) => a.name.localeCompare(b.name));
  const itemsB = structureB.items.sort((a, b) => a.name.localeCompare(b.name));

  if (itemsA.length !== itemsB.length) return false;

  return itemsA.every((itemA, index) => {
    const itemB = itemsB[index];
    return (
      itemA.name === itemB.name &&
      itemA.amount === itemB.amount &&
      itemA.frequency === itemB.frequency
    );
  });
};

// Bulk fee assignment
export const assignFeeToClasses = async (feeStructureId, classIds) => {
  const structure = await prisma.feeStructure.findUnique({
    where: { id: BigInt(feeStructureId) },
    include: { items: true }
  });

  if (!structure) throw new Error('Fee structure not found');

  return Promise.all(classIds.map(classId => 
    prisma.feeStructure.create({
      data: {
        name: `${structure.name} (Class ${classId})`,
        description: structure.description,
        schoolId: structure.schoolId,
        classId: BigInt(classId),
        items: {
          create: structure.items.map(item => ({
            name: item.name,
            amount: item.amount,
            taxRate: item.taxRate,
            discountable: item.discountable,
            optional: item.optional,
            frequency: item.frequency,
            dueDate: item.dueDate,
            lateFee: item.lateFee
          }))
        }
      }
    })
  ));
};

// Fee structure analysis
export const analyzeFeeStructure = (feeStructure) => {
  const items = feeStructure.items || [];
  
  return {
    totalItems: items.length,
    totalAmount: calculateFeeTotal(items),
    mandatoryItems: items.filter(i => !i.optional).length,
    discountableItems: items.filter(i => i.discountable).length,
    taxSummary: items.reduce((acc, item) => {
      const key = `${item.taxRate}%`;
      acc[key] = (acc[key] || 0) + item.amount;
      return acc;
    }, {}),
    frequencyDistribution: items.reduce((acc, item) => {
      acc[item.frequency] = (acc[item.frequency] || 0) + 1;
      return acc;
    }, {})
  };
};

// Fee structure export/import
export const exportFeeStructure = (feeStructure) => {
  return {
    meta: {
      name: feeStructure.name,
      description: feeStructure.description,
      isDefault: feeStructure.isDefault,
      createdAt: feeStructure.createdAt,
      updatedAt: feeStructure.updatedAt
    },
    items: (feeStructure.items || []).map(item => ({
      name: item.name,
      amount: item.amount,
      taxRate: item.taxRate,
      discountable: item.discountable,
      optional: item.optional,
      frequency: item.frequency,
      dueDate: item.dueDate,
      lateFee: item.lateFee
    }))
  };
};

export const importFeeStructure = async (data, schoolId) => {
  return prisma.feeStructure.create({
    data: {
      name: data.meta.name,
      description: data.meta.description,
      schoolId: BigInt(schoolId),
      items: {
        create: data.items.map(item => ({
          name: item.name,
          amount: item.amount,
          taxRate: item.taxRate,
          discountable: item.discountable,
          optional: item.optional,
          frequency: item.frequency,
          dueDate: item.dueDate,
          lateFee: item.lateFee
        }))
      }
    }
  });
};

// Fee structure versioning
export const createFeeStructureVersion = async (feeStructureId) => {
  const structure = await prisma.feeStructure.findUnique({
    where: { id: BigInt(feeStructureId) },
    include: { items: true }
  });

  if (!structure) throw new Error('Fee structure not found');

  return prisma.feeStructureVersion.create({
    data: {
      name: structure.name,
      description: structure.description,
      versionDate: new Date(),
      feeStructureId: BigInt(feeStructureId),
      items: structure.items.map(item => ({
        name: item.name,
        amount: item.amount,
        taxRate: item.taxRate,
        discountable: item.discountable,
        optional: item.optional,
        frequency: item.frequency,
        dueDate: item.dueDate,
        lateFee: item.lateFee
      }))
    }
  });
};

// Fee structure utilities
export const getApplicableFeeStructures = async (studentId) => {
  const student = await prisma.student.findUnique({
    where: { id: BigInt(studentId) },
    include: { class: true }
  });

  if (!student) throw new Error('Student not found');

  return prisma.feeStructure.findMany({
    where: {
      schoolId: student.schoolId,
      OR: [
        { classId: null }, // School-wide structures
        { classId: student.classId } // Class-specific structures
      ],
      deletedAt: null
    },
    include: { items: true }
  });
};

export const getFeeStructureSummary = async (schoolId) => {
  const structures = await prisma.feeStructure.findMany({
    where: { schoolId: BigInt(schoolId), deletedAt: null },
    include: { items: true }
  });

  return structures.map(structure => ({
    id: structure.id,
    name: structure.name,
    classId: structure.classId,
    isDefault: structure.isDefault,
    totalItems: structure.items.length,
    totalAmount: calculateFeeTotal(structure.items),
    lastUpdated: structure.updatedAt
  }));
};


/**
 * Cache a fee structure in Redis
 * @param {Object} feeStructure - The fee structure to cache
 * @returns {Promise<void>}
 */
export async function cacheFeeStructure(feeStructure) {
  if (!redisClient || !redisClient.isOpen) {
    logger.warn('Redis client not connected, skipping cache operation');
    return;
  }

  try {
    const cacheKey = `fee:structure:${feeStructure.schoolId}:${feeStructure.id}`;
    const cacheData = {
      ...feeStructure,
      id: feeStructure.id.toString(),
      schoolId: feeStructure.schoolId.toString(),
      classId: feeStructure.classId?.toString() || null,
      createdAt: feeStructure.createdAt.toISOString(),
      updatedAt: feeStructure.updatedAt?.toISOString() || null
    };

    // Cache for 24 hours (86400 seconds)
    await redisClient.setEx(
      cacheKey,
      86400,
      JSON.stringify(cacheData)
    );

    // Add to school's fee structure set
    await redisClient.sAdd(
      `fee:structures:${feeStructure.schoolId}`,
      feeStructure.id.toString()
    );

  } catch (error) {
    logger.error(`Failed to cache fee structure: ${error.message}`);
  }
}

/**
 * Creates an audit log for fee structure changes
 * @param {string|bigint} feeStructureId - ID of the fee structure being modified
 * @param {string} action - Action performed ('created', 'updated', 'deleted', etc.)
 * @param {Object|null} oldData - Previous state of the data (for updates/deletes)
 * @param {Object|null} newData - New state of the data (for creates/updates)
 * @param {string} ipAddress - IP address of the requester
 * @param {string} userAgent - User agent string
 * @param {string|bigint} schoolId - School ID
 * @param {string|bigint} userId - User ID who performed the action
 * @returns {Promise<void>}
 */
export async function createFeeLog(
  feeStructureId,
  action,
  oldData,
  newData,
  ipAddress,
  userAgent,
  schoolId,
  userId
) {
  try {
    // Create log in database
    await prisma.feeAuditLog.create({
      data: {
        action,
        oldData: oldData ? JSON.stringify(oldData) : null,
        newData: newData ? JSON.stringify(newData) : null,
        ipAddress,
        userAgent,
        feeStructureId: BigInt(feeStructureId),
        schoolId: BigInt(schoolId),
        userId: BigInt(userId),
      }
    });

    // Also cache in Redis for quick access (optional)
    if (redisClient.isOpen) {
      const logKey = `fee:audit:${feeStructureId}:${Date.now()}`;
      await redisClient.setEx(
        logKey,
        604800, // 7 days
        JSON.stringify({
          action,
          timestamp: new Date().toISOString(),
          userId: userId.toString()
        })
      );
    }

  } catch (error) {
    logger.error(`Failed to create fee audit log: ${error.message}`);
    // Fail silently as audit logs shouldn't break main operations
  }
}


/**
 * Generates a unique fee structure code
 * @param {string|bigint} schoolId - The school ID
 * @returns {Promise<string>} - Generated fee structure code (format: FEE-{YYYYMM}-{SEQ})
 */
export async function generateFeeStructureCode(schoolId) {
  try {
    const schoolIdBigInt = BigInt(schoolId);
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    // 1. Try Redis first if available
    if (redisClient?.isOpen) {
      const redisKey = `fee:code:${schoolId}:${monthPrefix}`;
      const sequence = await redisClient.incr(redisKey);
      await redisClient.expire(redisKey, 2678400); // Expire in 31 days
      return `FEE-${monthPrefix}-${sequence.toString().padStart(4, '0')}`;
    }

    // 2. Fallback to database query
    const lastCode = await prisma.feeStructure.findFirst({
      where: {
        schoolId: schoolIdBigInt,
        code: { startsWith: `FEE-${monthPrefix}-` }
      },
      orderBy: { code: 'desc' },
      select: { code: true }
    });

    const lastSequence = lastCode 
      ? parseInt(lastCode.code.split('-').pop(), 10) 
      : 0;
    const newSequence = lastSequence + 1;

    return `FEE-${monthPrefix}-${newSequence.toString().padStart(4, '0')}`;

  } catch (error) {
    logger.error(`Failed to generate fee code: ${error.message}`);
    
    // 3. Ultimate fallback - timestamp based
    return `FEE-${Date.now().toString(36).toUpperCase()}`;
  }
}

/**
 * Invalidates cached fee structure data
 * @param {string|bigint} feeStructureId - ID of the fee structure to invalidate
 * @param {string|bigint} schoolId - Associated school ID
 * @returns {Promise<void>}
 */
export async function invalidateFeeCache(feeStructureId, schoolId) {
  if (!redisClient?.isOpen) {
    logger.warn('Redis client not available for cache invalidation');
    return;
  }

  try {
    const idStr = feeStructureId.toString();
    const schoolStr = schoolId.toString();
    
    // 1. Delete the main fee structure cache
    const structureKey = `fee:structure:${schoolStr}:${idStr}`;
    await redisClient.del(structureKey);

    // 2. Remove from school's fee structure set
    const schoolStructuresKey = `fee:structures:${schoolStr}`;
    await redisClient.sRem(schoolStructuresKey, idStr);

    // 3. Invalidate any related cached calculations
    const calculationKeys = await redisClient.keys(`fee:calculations:*${idStr}*`);
    if (calculationKeys.length > 0) {
      await redisClient.del(calculationKeys);
    }

    logger.debug(`Invalidated cache for fee structure ${idStr} in school ${schoolStr}`);
  } catch (error) {
    logger.error(`Cache invalidation failed for fee ${feeStructureId}: ${error.message}`);
    // Fail silently to not break main operations
  }
}


/**
 * Fee Assignment Validation Schema
 * Matches the usage in feeController.js
 */
export const FeeAssignmentSchema = Joi.object({
  // Either classId OR studentId must be provided (but not both)
  classId: Joi.number().integer().positive().optional(),
  studentId: Joi.number().integer().positive().optional(),
  // Effective date range validation
  effectiveFrom: Joi.date().iso().default(new Date()),
  effectiveUntil: Joi.date().iso()
    .min(Joi.ref('effectiveFrom'))
    .allow(null)
    .optional()
    .messages({
      'date.min': 'End date must be after start date'
    }),
  // Optional metadata
  notes: Joi.string().max(500).allow('', null).optional(),
  isActive: Joi.boolean().default(true)
})
.xor('classId', 'studentId') // Requires exactly one of classId or studentId
.messages({
  'object.xor': 'Must specify either classId or studentId, but not both',
  'object.missing': 'Must specify either classId or studentId'
});

/**
 * Validates fee assignment data
 * @param {Object} data - Data to validate
 * @returns {Joi.ValidationResult}
 */
export function validateFeeAssignmentData(data) {
  return FeeAssignmentSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false
  });
}


/**
 * Schema for bulk creation of fee structures
 * Handles both structure and items validation
 */
export const FeeBulkCreateSchema = Joi.object({
  schoolId: Joi.number().integer().positive().required(),
  templateId: Joi.number().integer().positive().optional()
    .description('Existing fee structure ID to use as template'),
  structures: Joi.array().items(
    Joi.object({
      name: Joi.string().max(100).required(),
      description: Joi.string().max(500).optional(),
      classId: Joi.number().integer().positive().optional(),
      isDefault: Joi.boolean().default(false),
      items: Joi.array().items(
        Joi.object({
          name: Joi.string().max(100).required(),
          amount: Joi.number().positive().precision(2).required(),
          taxRate: Joi.number().min(0).max(100).precision(2).default(0),
          discountable: Joi.boolean().default(false),
          optional: Joi.boolean().default(false),
          frequency: Joi.string()
            .valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER')
            .required(),
          dueDate: Joi.date().iso().optional(),
          lateFee: Joi.object({
            type: Joi.string().valid('FIXED', 'PERCENTAGE').required(),
            value: Joi.number().positive().required(),
            cap: Joi.number().positive().optional()
          }).optional()
        }).min(1)
      ).min(1).required()
    })
  ).min(1).required(),
  options: Joi.object({
    overwriteExisting: Joi.boolean().default(false),
    notificationPrefs: Joi.object({
      email: Joi.boolean().default(false),
      inApp: Joi.boolean().default(true)
    }).default({ email: false, inApp: true })
  }).default({})
});

/**
 * Validates bulk fee creation data
 * @param {Object} data - Data to validate
 * @returns {Joi.ValidationResult}
 */
export function validateFeeBulkCreateData(data) {
  return FeeBulkCreateSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false,
    convert: true // Auto-convert string numbers to numbers
  });
}


/**
 * Schema for bulk deletion of fee structures
 */
export const FeeBulkDeleteSchema = Joi.object({
  schoolId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'School ID must be a number',
      'number.positive': 'School ID must be positive'
    }),
  
  feeStructureIds: Joi.array()
    .items(
      Joi.number().integer().positive()
        .messages({
          'number.base': 'Each fee structure ID must be a number',
          'number.positive': 'Each fee structure ID must be positive'
        })
    )
    .min(1)
    .required()
    .messages({
      'array.base': 'Fee structure IDs must be provided as an array',
      'array.min': 'At least one fee structure ID must be provided'
    }),
  
  options: Joi.object({
    forceDelete: Joi.boolean().default(false)
      .description('Force delete even if structures have associated payments'),
    auditLog: Joi.boolean().default(true)
      .description('Create audit log entries for deletions'),
    deleteAssignments: Joi.boolean().default(true)
      .description('Automatically delete related fee assignments')
  }).default({})
});

/**
 * Validates bulk fee deletion data
 * @param {Object} data - Data to validate
 * @returns {Joi.ValidationResult}
 */
export function validateFeeBulkDeleteData(data) {
  return FeeBulkDeleteSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true // Auto-convert string numbers to numbers
  });
}


/**
 * Schema for bulk updates of fee structures
 */
export const FeeBulkUpdateSchema = Joi.object({
  schoolId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'School ID must be a number',
      'number.positive': 'School ID must be positive'
    }),

  updates: Joi.array().items(
    Joi.object({
      feeStructureId: Joi.number().integer().positive().required()
        .messages({
          'number.base': 'Fee structure ID must be a number',
          'number.positive': 'Fee structure ID must be positive'
        }),

      data: Joi.object({
        name: Joi.string().max(100).optional(),
        description: Joi.string().max(500).optional().allow(null),
        status: Joi.string().valid('active', 'inactive').optional(),
        isDefault: Joi.boolean().optional(),

        // For nested item updates
        items: Joi.array().items(
          Joi.object({
            id: Joi.number().integer().positive().optional(), // For existing items
            tempId: Joi.string().max(50).optional(), // For new items in bulk update
            action: Joi.string().valid('update', 'create', 'delete').required(),
            data: Joi.when('action', {
              switch: [
                {
                  is: 'update',
                  then: Joi.object({
                    name: Joi.string().max(100).optional(),
                    amount: Joi.number().positive().precision(2).optional(),
                    taxRate: Joi.number().min(0).max(100).precision(2).optional(),
                    discountable: Joi.boolean().optional(),
                    optional: Joi.boolean().optional(),
                    frequency: Joi.string()
                      .valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER')
                      .optional(),
                    dueDate: Joi.date().iso().optional().allow(null),
                    lateFee: Joi.object({
                      type: Joi.string().valid('FIXED', 'PERCENTAGE').optional(),
                      value: Joi.number().positive().optional(),
                      cap: Joi.number().positive().optional()
                    }).optional()
                  }).min(1)
                },
                {
                  is: 'create',
                  then: Joi.object({
                    name: Joi.string().max(100).required(),
                    amount: Joi.number().positive().precision(2).required(),
                    // ... include all required fields for new items
                  }).required()
                },
                {
                  is: 'delete',
                  then: Joi.object().optional() // No data needed for delete
                }
              ]
            })
          })
        ).optional()
      }).min(1).required() // At least one field must be updated
    })
  ).min(1).required(), // At least one update must be specified

  options: Joi.object({
    validateOnly: Joi.boolean().default(false),
    skipSameValues: Joi.boolean().default(true),
    conflictResolution: Joi.string()
      .valid('abort', 'skip', 'overwrite')
      .default('abort')
  }).default({})
});

/**
 * Validates bulk fee update data
 * @param {Object} data - Data to validate
 * @returns {Joi.ValidationResult}
 */
export function validateFeeBulkUpdateData(data) {
  return FeeBulkUpdateSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    context: { isBulkUpdate: true }
  });
}


/**
 * Schema for creating fee items
 */
export const FeeItemCreateSchema = Joi.object({
  feeStructureId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Fee structure ID must be a number',
      'number.positive': 'Fee structure ID must be positive',
      'any.required': 'Fee structure ID is required'
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

  taxRate: Joi.number().min(0).max(100).precision(2).default(0)
    .messages({
      'number.base': 'Tax rate must be a number',
      'number.min': 'Tax rate cannot be negative',
      'number.max': 'Tax rate cannot exceed 100%'
    }),

  discountable: Joi.boolean().default(false)
    .messages({
      'boolean.base': 'Discountable must be true or false'
    }),

  optional: Joi.boolean().default(false)
    .messages({
      'boolean.base': 'Optional must be true or false'
    }),

  frequency: Joi.string()
    .valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER')
    .required()
    .messages({
      'string.base': 'Frequency must be a string',
      'any.only': 'Invalid frequency value',
      'any.required': 'Frequency is required'
    }),

  dueDate: Joi.date().iso().optional()
    .messages({
      'date.base': 'Due date must be a valid date',
      'date.format': 'Due date must be in ISO format'
    }),

  lateFee: Joi.object({
    type: Joi.string().valid('FIXED', 'PERCENTAGE').required()
      .messages({
        'string.base': 'Late fee type must be a string',
        'any.only': 'Invalid late fee type',
        'any.required': 'Late fee type is required'
      }),
    value: Joi.number().positive().required()
      .messages({
        'number.base': 'Late fee value must be a number',
        'number.positive': 'Late fee value must be positive',
        'any.required': 'Late fee value is required'
      }),
    cap: Joi.number().positive().optional()
      .messages({
        'number.base': 'Late fee cap must be a number',
        'number.positive': 'Late fee cap must be positive'
      })
  }).optional(),

  metadata: Joi.object().pattern(
    Joi.string().max(50),
    Joi.any()
  ).optional()
}).options({
  abortEarly: false,
  stripUnknown: true
});

/**
 * Validates fee item creation data
 * @param {Object} data - Data to validate
 * @returns {Joi.ValidationResult}
 */
export function validateFeeItemCreateData(data) {
  return FeeItemCreateSchema.validate(data, {
    convert: true,
    allowUnknown: false
  });
}


/**
 * Schema for updating fee items
 */
export const FeeItemUpdateSchema = Joi.object({
  feeStructureId: Joi.number().integer().positive().optional()
    .messages({
      'number.base': 'Fee structure ID must be a number',
      'number.positive': 'Fee structure ID must be positive'
    }),

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

  taxRate: Joi.number().min(0).max(100).precision(2).optional()
    .messages({
      'number.base': 'Tax rate must be a number',
      'number.min': 'Tax rate cannot be negative',
      'number.max': 'Tax rate cannot exceed 100%'
    }),

  discountable: Joi.boolean().optional()
    .messages({
      'boolean.base': 'Discountable must be true or false'
    }),

  optional: Joi.boolean().optional()
    .messages({
      'boolean.base': 'Optional must be true or false'
    }),

  frequency: Joi.string()
    .valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER')
    .optional()
    .messages({
      'string.base': 'Frequency must be a string',
      'any.only': 'Invalid frequency value'
    }),

  dueDate: Joi.date().iso().optional()
    .messages({
      'date.base': 'Due date must be a valid date',
      'date.format': 'Due date must be in ISO format'
    }),

  lateFee: Joi.alternatives().try(
    Joi.object({
      type: Joi.string().valid('FIXED', 'PERCENTAGE').required()
        .messages({
          'string.base': 'Late fee type must be a string',
          'any.only': 'Invalid late fee type',
          'any.required': 'Late fee type is required'
        }),
      value: Joi.number().positive().required()
        .messages({
          'number.base': 'Late fee value must be a number',
          'number.positive': 'Late fee value must be positive',
          'any.required': 'Late fee value is required'
        }),
      cap: Joi.number().positive().optional()
        .messages({
          'number.base': 'Late fee cap must be a number',
          'number.positive': 'Late fee cap must be positive'
        })
    }),
    Joi.object().pattern(Joi.string(), Joi.any()).allow(null) // Allow clearing lateFee
  ).optional(),

  metadata: Joi.object().pattern(
    Joi.string().max(50),
    Joi.any()
  ).optional()
})
.min(1) // At least one field must be provided
.messages({
  'object.min': 'At least one field must be provided for update'
})
.options({
  abortEarly: false,
  stripUnknown: true
});

/**
 * Validates fee item update data
 * @param {Object} data - Data to validate
 * @returns {Joi.ValidationResult}
 */
export function validateFeeItemUpdateData(data) {
  return FeeItemUpdateSchema.validate(data, {
    convert: true,
    allowUnknown: false
  });
}


/**
 * Schema for searching fees
 */
export const FeeSearchSchema = Joi.object({
  // Basic filters
  schoolId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'School ID must be a number',
      'number.positive': 'School ID must be positive',
      'any.required': 'School ID is required'
    }),

  query: Joi.string().max(200).trim().optional()
    .messages({
      'string.max': 'Search query cannot exceed 200 characters'
    }),

  // Status filters
  status: Joi.string().valid('active', 'inactive', 'archived').optional()
    .messages({
      'any.only': 'Status must be active, inactive, or archived'
    }),

  // Date ranges
  createdAfter: Joi.date().iso().optional()
    .messages({
      'date.base': 'Created after must be a valid date',
      'date.format': 'Created after must be in ISO format'
    }),
  createdBefore: Joi.date().iso().optional()
    .messages({
      'date.base': 'Created before must be a valid date',
      'date.format': 'Created before must be in ISO format'
    }),
  updatedAfter: Joi.date().iso().optional()
    .messages({
      'date.base': 'Updated after must be a valid date',
      'date.format': 'Updated after must be in ISO format'
    }),

  // Amount ranges
  minAmount: Joi.number().positive().precision(2).optional()
    .messages({
      'number.base': 'Minimum amount must be a number',
      'number.positive': 'Minimum amount must be positive'
    }),
  maxAmount: Joi.number().positive().precision(2).optional()
    .messages({
      'number.base': 'Maximum amount must be a number',
      'number.positive': 'Maximum amount must be positive'
    }),

  // Type filters
  feeType: Joi.string().valid('TUITION', 'LIBRARY', 'TRANSPORT', 'HOSTEL', 'OTHER')
    .optional()
    .messages({
      'any.only': 'Invalid fee type specified'
    }),

  // Structural filters
  classId: Joi.number().integer().positive().optional()
    .messages({
      'number.base': 'Class ID must be a number',
      'number.positive': 'Class ID must be positive'
    }),
  isDefault: Joi.boolean().optional()
    .messages({
      'boolean.base': 'Default filter must be true or false'
    }),

  // Item-specific filters
  hasLateFees: Joi.boolean().optional()
    .messages({
      'boolean.base': 'Late fee filter must be true or false'
    }),
  hasDiscounts: Joi.boolean().optional()
    .messages({
      'boolean.base': 'Discount filter must be true or false'
    }),

  // Pagination
  page: Joi.number().integer().min(1).default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number().integer().min(1).max(100).default(20)
    .messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),

  // Sorting
  sortBy: Joi.string()
    .valid('name', 'amount', 'createdAt', 'updatedAt', 'dueDate')
    .default('name')
    .messages({
      'any.only': 'Invalid sort field specified'
    }),
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('asc')
    .messages({
      'any.only': 'Sort order must be asc or desc'
    }),

  // Advanced options
  includeItems: Joi.boolean().default(false)
    .messages({
      'boolean.base': 'Include items must be true or false'
    }),
  includeAssignments: Joi.boolean().default(false)
    .messages({
      'boolean.base': 'Include assignments must be true or false'
    })
})
.options({
  abortEarly: false,
  stripUnknown: true,
  allowUnknown: false
});

/**
 * Validates fee search parameters
 * @param {Object} data - Search parameters to validate
 * @returns {Joi.ValidationResult}
 */
export function validateFeeSearchData(data) {
  return FeeSearchSchema.validate(data, {
    convert: true
  });
}


/**
 * Schema for creating fee structures
 */
export const FeeStructureCreateSchema = Joi.object({
  schoolId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'School ID must be a number',
      'number.positive': 'School ID must be positive',
      'any.required': 'School ID is required'
    }),

  name: Joi.string().max(100).required()
    .messages({
      'string.base': 'Name must be a string',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),

  description: Joi.string().max(500).optional().allow(null, '')
    .messages({
      'string.base': 'Description must be a string',
      'string.max': 'Description cannot exceed 500 characters'
    }),

  classId: Joi.number().integer().positive().optional().allow(null)
    .messages({
      'number.base': 'Class ID must be a number',
      'number.positive': 'Class ID must be positive'
    }),

  academicYearId: Joi.number().integer().positive().optional().allow(null)
    .messages({
      'number.base': 'Academic Year ID must be a number',
      'number.positive': 'Academic Year ID must be positive'
    }),

  isDefault: Joi.boolean().default(false)
    .messages({
      'boolean.base': 'Default flag must be true or false'
    }),

  status: Joi.string().valid('DRAFT', 'ACTIVE', 'ARCHIVED').default('DRAFT')
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be DRAFT, ACTIVE, or ARCHIVED'
    }),

  items: Joi.array().items(
    Joi.object({
      name: Joi.string().max(100).required()
        .messages({
          'string.base': 'Item name must be a string',
          'string.max': 'Item name cannot exceed 100 characters',
          'any.required': 'Item name is required'
        }),
      amount: Joi.number().positive().precision(2).required()
        .messages({
          'number.base': 'Amount must be a number',
          'number.positive': 'Amount must be positive',
          'any.required': 'Amount is required'
        }),
      taxRate: Joi.number().min(0).max(100).precision(2).default(0)
        .messages({
          'number.base': 'Tax rate must be a number',
          'number.min': 'Tax rate cannot be negative',
          'number.max': 'Tax rate cannot exceed 100%'
        }),
      discountable: Joi.boolean().default(false)
        .messages({
          'boolean.base': 'Discountable must be true or false'
        }),
      optional: Joi.boolean().default(false)
        .messages({
          'boolean.base': 'Optional must be true or false'
        }),
      frequency: Joi.string()
        .valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMESTERLY', 'YEARLY')
        .required()
        .messages({
          'string.base': 'Frequency must be a string',
          'any.only': 'Invalid frequency value',
          'any.required': 'Frequency is required'
        }),
      dueDate: Joi.date().iso().optional().allow(null)
        .messages({
          'date.base': 'Due date must be a valid date',
          'date.format': 'Due date must be in ISO format'
        }),
      lateFee: Joi.object({
        type: Joi.string().valid('FIXED', 'PERCENTAGE').required()
          .messages({
            'string.base': 'Late fee type must be a string',
            'any.only': 'Invalid late fee type',
            'any.required': 'Late fee type is required'
          }),
        value: Joi.number().positive().required()
          .messages({
            'number.base': 'Late fee value must be a number',
            'number.positive': 'Late fee value must be positive',
            'any.required': 'Late fee value is required'
          }),
        cap: Joi.number().positive().optional()
          .messages({
            'number.base': 'Late fee cap must be a number',
            'number.positive': 'Late fee cap must be positive'
          })
      }).optional()
    }).min(1)
  ).min(1).required()
    .messages({
      'array.base': 'Items must be an array',
      'array.min': 'At least one fee item is required',
      'any.required': 'Fee items are required'
    }),

  metadata: Joi.object().pattern(
    Joi.string().max(50),
    Joi.any()
  ).optional()
})
.options({
  abortEarly: false,
  stripUnknown: true,
  allowUnknown: false
});

/**
 * Validates fee structure creation data
 * @param {Object} data - Data to validate
 * @returns {Joi.ValidationResult}
 */
export function validateFeeStructureCreateData(data) {
  return FeeStructureCreateSchema.validate(data, {
    convert: true
  });
}

/**
 * Schema for updating fee structures
 * - Supports partial updates of fee structure fields
 * - Handles nested item operations (create/update/delete)
 * - Validates financial values and date formats
 * - Requires at least one field to be updated
 */

export const FeeStructureUpdateSchema = Joi.object({
  name: Joi.string().max(100).optional()
    .messages({
      'string.base': 'Name must be a string',
      'string.max': 'Name cannot exceed 100 characters'
    }),

  description: Joi.string().max(500).optional().allow(null, '')
    .messages({
      'string.base': 'Description must be a string',
      'string.max': 'Description cannot exceed 500 characters'
    }),

  classId: Joi.number().integer().positive().optional().allow(null)
    .messages({
      'number.base': 'Class ID must be a number',
      'number.positive': 'Class ID must be positive'
    }),

  academicYearId: Joi.number().integer().positive().optional().allow(null)
    .messages({
      'number.base': 'Academic Year ID must be a number',
      'number.positive': 'Academic Year ID must be positive'
    }),

  isDefault: Joi.boolean().optional()
    .messages({
      'boolean.base': 'Default flag must be true or false'
    }),

  status: Joi.string().valid('DRAFT', 'ACTIVE', 'ARCHIVED').optional()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be DRAFT, ACTIVE, or ARCHIVED'
    }),

  items: Joi.array().items(
    Joi.object({
      id: Joi.number().integer().positive().optional()
        .messages({
          'number.base': 'Item ID must be a number',
          'number.positive': 'Item ID must be positive'
        }),
      action: Joi.string().valid('CREATE', 'UPDATE', 'DELETE').required()
        .messages({
          'string.base': 'Action must be a string',
          'any.only': 'Action must be CREATE, UPDATE, or DELETE',
          'any.required': 'Action is required'
        }),
      data: Joi.when('action', {
        is: 'DELETE',
        then: Joi.object().optional(),
        otherwise: Joi.object({
          name: Joi.string().max(100).optional()
            .messages({
              'string.base': 'Item name must be a string',
              'string.max': 'Item name cannot exceed 100 characters'
            }),
          amount: Joi.number().positive().precision(2).optional()
            .messages({
              'number.base': 'Amount must be a number',
              'number.positive': 'Amount must be positive'
            }),
          taxRate: Joi.number().min(0).max(100).precision(2).optional()
            .messages({
              'number.base': 'Tax rate must be a number',
              'number.min': 'Tax rate cannot be negative',
              'number.max': 'Tax rate cannot exceed 100%'
            }),
          discountable: Joi.boolean().optional()
            .messages({
              'boolean.base': 'Discountable must be true or false'
            }),
          optional: Joi.boolean().optional()
            .messages({
              'boolean.base': 'Optional must be true or false'
            }),
          frequency: Joi.string()
            .valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'SEMESTERLY', 'YEARLY')
            .optional()
            .messages({
              'string.base': 'Frequency must be a string',
              'any.only': 'Invalid frequency value'
            }),
          dueDate: Joi.date().iso().optional().allow(null)
            .messages({
              'date.base': 'Due date must be a valid date',
              'date.format': 'Due date must be in ISO format'
            }),
          lateFee: Joi.alternatives().try(
            Joi.object({
              type: Joi.string().valid('FIXED', 'PERCENTAGE').required()
                .messages({
                  'string.base': 'Late fee type must be a string',
                  'any.only': 'Invalid late fee type',
                  'any.required': 'Late fee type is required'
                }),
              value: Joi.number().positive().required()
                .messages({
                  'number.base': 'Late fee value must be a number',
                  'number.positive': 'Late fee value must be positive',
                  'any.required': 'Late fee value is required'
                }),
              cap: Joi.number().positive().optional()
                .messages({
                  'number.base': 'Late fee cap must be a number',
                  'number.positive': 'Late fee cap must be positive'
                })
            }),
            Joi.object().pattern(Joi.string(), Joi.any()).allow(null)
          ).optional()
        }).min(1)
      })
    })
  ).optional(),

  metadata: Joi.object().pattern(
    Joi.string().max(50),
    Joi.any()
  ).optional()
})
.min(1)
.messages({
  'object.min': 'At least one field must be provided for update'
})
.options({
  abortEarly: false,
  stripUnknown: true
});

/**
 * Validates fee structure update data
 * @param {Object} data - Update data to validate
 * @returns {Joi.ValidationResult} - Validation result with value/error
 */
export function validateFeeStructureUpdateData(data) {
  return FeeStructureUpdateSchema.validate(data, {
    convert: true,
    allowUnknown: false
  });
}
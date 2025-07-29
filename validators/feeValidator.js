import Joi from 'joi';

/**
 * Validate fee structure data
 * @param {Object} data - Fee structure data to validate
 * @param {boolean} [isUpdate=false] - Whether this is for an update operation
 * @returns {Object} - Joi validation result
 */
export function validateFeeStructureData(data, isUpdate = false) {
  const schema = Joi.object({
    name: isUpdate 
      ? Joi.string().trim().min(3).max(100).optional()
      : Joi.string().trim().min(3).max(100).required(),
    description: Joi.string().trim().max(500).allow('', null).optional(),
    classId: Joi.number().integer().positive().allow(null).optional(),
    isDefault: Joi.boolean().optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
    items: Joi.array().items(Joi.object()).optional(), // Actual items validated separately
    ...(isUpdate ? {} : { code: Joi.string().optional() }) // Code is auto-generated if not provided
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
}

/**
 * Validate fee item data
 * @param {Object} data - Fee item data to validate
 * @param {boolean} [isUpdate=false] - Whether this is for an update operation
 * @returns {Object} - Joi validation result
 */
export function validateFeeItemData(data, isUpdate = false) {
  const schema = Joi.object({
    name: isUpdate 
      ? Joi.string().trim().min(2).max(100).optional()
      : Joi.string().trim().min(2).max(100).required(),
    description: Joi.string().trim().max(500).allow('', null).optional(),
    amount: isUpdate
      ? Joi.number().positive().precision(2).optional()
      : Joi.number().positive().precision(2).required(),
    taxRate: Joi.number().min(0).max(100).precision(2).default(0).optional(),
    isRecurring: Joi.boolean().default(false).optional(),
    frequency: Joi.when('isRecurring', {
      is: true,
      then: Joi.string().valid('monthly', 'quarterly', 'yearly').required(),
      otherwise: Joi.string().valid('monthly', 'quarterly', 'yearly').allow(null).optional()
    }),
    dueDate: Joi.date().iso().allow(null).optional(),
    discountable: Joi.boolean().default(false).optional(),
    status: Joi.string().valid('active', 'inactive').default('active').optional()
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
}

/**
 * Validate fee assignment data
 * @param {Object} data - Fee assignment data to validate
 * @returns {Object} - Joi validation result
 */
export function validateFeeAssignmentData(data) {
  const schema = Joi.object({
    classId: Joi.number().integer().positive(),
    studentId: Joi.number().integer().positive(),
    effectiveFrom: Joi.date().iso().default(new Date()).optional(),
    effectiveUntil: Joi.date().iso().min(Joi.ref('effectiveFrom')).allow(null).optional()
  }).xor('classId', 'studentId') // Must have either classId or studentId but not both
    .messages({
      'object.xor': 'Must specify either classId or studentId, but not both'
    });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
}

// Bulk create schema
const FeeBulkCreateSchema = Joi.object({
  schoolId: Joi.number().integer().positive().required(),
  templateId: Joi.number().integer().positive().optional(),
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
          frequency: Joi.string().valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER').required(),
          dueDate: Joi.date().optional(),
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

export function validateFeeBulkCreateData(data) {
  return FeeBulkCreateSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false,
    convert: true
  });
}

// Bulk update schema
const FeeBulkUpdateSchema = Joi.object({
  schoolId: Joi.number().integer().positive().required(),
  updates: Joi.array().items(
    Joi.object({
      feeStructureId: Joi.number().integer().positive().required(),
      data: Joi.object({
        name: Joi.string().max(100).optional(),
        description: Joi.string().max(500).optional().allow(null),
        status: Joi.string().valid('active', 'inactive').optional(),
        isDefault: Joi.boolean().optional(),
        items: Joi.array().items(
          Joi.object({
            id: Joi.number().integer().positive().optional(),
            tempId: Joi.string().max(50).optional(),
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
                    frequency: Joi.string().valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER').optional(),
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
                    frequency: Joi.string().valid('ONE_TIME', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'SEMESTER').required()
                  }).required()
                },
                {
                  is: 'delete',
                  then: Joi.object().optional()
                }
              ]
            })
          })
        ).optional()
      }).min(1).required()
    })
  ).min(1).required(),
  options: Joi.object({
    validateOnly: Joi.boolean().default(false),
    skipSameValues: Joi.boolean().default(true),
    conflictResolution: Joi.string().valid('abort', 'skip', 'overwrite').default('abort')
  }).default({})
});

export function validateFeeBulkUpdateData(data) {
  return FeeBulkUpdateSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
    context: { isBulkUpdate: true }
  });
}

// Bulk delete schema
const FeeBulkDeleteSchema = Joi.object({
  schoolId: Joi.number().integer().positive().required(),
  feeStructureIds: Joi.array().items(
    Joi.number().integer().positive()
  ).min(1).required(),
  options: Joi.object({
    forceDelete: Joi.boolean().default(false),
    auditLog: Joi.boolean().default(true),
    deleteAssignments: Joi.boolean().default(true)
  }).default({})
});

export function validateFeeBulkDeleteData(data) {
  return FeeBulkDeleteSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
}

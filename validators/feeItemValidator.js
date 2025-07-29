import Joi from 'joi';
import { BadRequestError } from '../utils/error.js';

// Common validation for IDs
const idValidation = Joi.string().pattern(/^\d+$/).required()
  .messages({
    'string.pattern.base': 'ID must be a numeric string',
    'any.required': 'ID is required'
  });

// Base fee item schema
const baseFeeItemSchema = Joi.object({
  feeStructureId: idValidation,
  name: Joi.string().min(2).max(100).required()
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 100 characters',
      'any.required': 'Name is required'
    }),
  amount: Joi.number().positive().precision(2).required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.positive': 'Amount must be positive',
      'number.precision': 'Amount can have max 2 decimal places',
      'any.required': 'Amount is required'
    }),
  isOptional: Joi.boolean().default(false),
  dueDate: Joi.date().iso().allow(null).optional()
    .messages({
      'date.base': 'Due date must be a valid date',
      'date.format': 'Due date must be in ISO format (YYYY-MM-DD)'
    }),
  schoolId: idValidation
});

/**
 * Validate fee item creation data
 */
export const validateFeeItemCreateData = (data) => {
  const schema = baseFeeItemSchema.keys({
    feeStructureId: idValidation,
    schoolId: idValidation
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false
  });
};

/**
 * Validate fee item update data
 */
export const validateFeeItemUpdateData = (data) => {
  const schema = baseFeeItemSchema.keys({
    id: idValidation
  }).min(1); // At least one field to update

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false
  });
};

/**
 * Validate bulk fee item creation
 */
export const validateFeeItemBulkCreate = (data) => {
  const schema = Joi.object({
    items: Joi.array().items(baseFeeItemSchema).min(1).required()
      .messages({
        'array.base': 'Items must be an array',
        'array.min': 'At least one item is required',
        'any.required': 'Items are required'
      })
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Validate bulk fee item update
 */
export const validateFeeItemBulkUpdate = (data) => {
  const itemSchema = Joi.object({
    id: idValidation,
    data: baseFeeItemSchema.min(1) // At least one field to update
  });

  const schema = Joi.object({
    updates: Joi.array().items(itemSchema).min(1).required()
      .messages({
        'array.base': 'Updates must be an array',
        'array.min': 'At least one update is required',
        'any.required': 'Updates are required'
      })
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Validate fee item query parameters
 */
export const validateFeeItemQuery = (query) => {
  const schema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    feeStructureId: idValidation.optional(),
    isOptional: Joi.boolean().optional(),
    search: Joi.string().optional(),
    sortBy: Joi.string().valid(
      'name', 'amount', 'dueDate', 'createdAt', 'updatedAt'
    ).default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  });

  return schema.validate(query, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Validate fee item export parameters
 */
export const validateFeeItemExport = (query) => {
  const schema = Joi.object({
    format: Joi.string().valid('json', 'csv').default('json'),
    feeStructureId: idValidation.optional(),
    isOptional: Joi.boolean().optional(),
    includeDeleted: Joi.boolean().default(false)
  });

  return schema.validate(query, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Validate fee item import data
 */
export const validateFeeItemImport = (data) => {
  const schema = Joi.object({
    items: Joi.array().items(
      baseFeeItemSchema.keys({
        feeStructureId: idValidation,
        schoolId: idValidation
      })
    ).min(1).required()
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Validate fee item calculation request
 */
export const validateFeeItemCalculation = (data) => {
  const schema = Joi.object({
    feeItemIds: Joi.array().items(idValidation).min(1).required()
      .messages({
        'array.base': 'Fee item IDs must be an array',
        'array.min': 'At least one fee item ID is required',
        'any.required': 'Fee item IDs are required'
      })
  });

  return schema.validate(data, { 
    abortEarly: false,
    stripUnknown: true
  });
};

/**
 * Middleware to validate fee item operations
 */
export const validateFeeItemOperation = (validator) => {
  return (req, res, next) => {
    const { error, value } = validator(req.body || req.query);
    
    if (error) {
      const details = error.details.map(detail => ({
        message: detail.message,
        path: detail.path
      }));
      
      throw new BadRequestError('Validation failed', details);
    }

    // Replace the body/query with validated data
    if (req.body) req.body = value;
    if (req.query) req.query = value;
    
    next();
  };
};
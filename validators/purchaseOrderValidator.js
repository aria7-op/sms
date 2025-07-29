import Joi from 'joi';

// Validation schema for purchase order
const purchaseOrderSchema = Joi.object({
  supplierId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Supplier ID must be a number',
      'number.integer': 'Supplier ID must be an integer',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    }),
  
  orderDate: Joi.date().iso().required()
    .messages({
      'date.base': 'Order date must be a valid date',
      'date.format': 'Order date must be in ISO format',
      'any.required': 'Order date is required'
    }),
  
  expectedDeliveryDate: Joi.date().iso().greater(Joi.ref('orderDate')).optional()
    .messages({
      'date.base': 'Expected delivery date must be a valid date',
      'date.format': 'Expected delivery date must be in ISO format',
      'date.greater': 'Expected delivery date must be after order date'
    }),
  
  status: Joi.string().valid('DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED').optional()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be one of: DRAFT, PENDING, APPROVED, ORDERED, RECEIVED, CANCELLED'
    }),
  
  subtotal: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Subtotal must be a number',
      'number.precision': 'Subtotal can have maximum 2 decimal places',
      'number.min': 'Subtotal cannot be negative'
    }),
  
  taxAmount: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Tax amount must be a number',
      'number.precision': 'Tax amount can have maximum 2 decimal places',
      'number.min': 'Tax amount cannot be negative'
    }),
  
  discountAmount: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Discount amount must be a number',
      'number.precision': 'Discount amount can have maximum 2 decimal places',
      'number.min': 'Discount amount cannot be negative'
    }),
  
  totalAmount: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Total amount must be a number',
      'number.precision': 'Total amount can have maximum 2 decimal places',
      'number.min': 'Total amount cannot be negative'
    }),
  
  currency: Joi.string().length(3).uppercase().optional()
    .messages({
      'string.base': 'Currency must be a string',
      'string.length': 'Currency must be exactly 3 characters',
      'string.uppercase': 'Currency must be in uppercase'
    }),
  
  paymentTerms: Joi.string().max(100).optional()
    .messages({
      'string.base': 'Payment terms must be a string',
      'string.max': 'Payment terms cannot exceed 100 characters'
    }),
  
  deliveryAddress: Joi.string().max(1000).optional()
    .messages({
      'string.base': 'Delivery address must be a string',
      'string.max': 'Delivery address cannot exceed 1000 characters'
    }),
  
  notes: Joi.string().max(1000).optional()
    .messages({
      'string.base': 'Notes must be a string',
      'string.max': 'Notes cannot exceed 1000 characters'
    }),
  
  items: Joi.array().items(Joi.object({
    itemId: Joi.number().integer().positive().required()
      .messages({
        'number.base': 'Item ID must be a number',
        'number.integer': 'Item ID must be an integer',
        'number.positive': 'Item ID must be positive',
        'any.required': 'Item ID is required'
      }),
    
    quantity: Joi.number().integer().positive().required()
      .messages({
        'number.base': 'Quantity must be a number',
        'number.integer': 'Quantity must be an integer',
        'number.positive': 'Quantity must be positive',
        'any.required': 'Quantity is required'
      }),
    
    unitPrice: Joi.number().precision(2).positive().required()
      .messages({
        'number.base': 'Unit price must be a number',
        'number.precision': 'Unit price can have maximum 2 decimal places',
        'number.positive': 'Unit price must be positive',
        'any.required': 'Unit price is required'
      }),
    
    remarks: Joi.string().max(255).optional()
      .messages({
        'string.base': 'Remarks must be a string',
        'string.max': 'Remarks cannot exceed 255 characters'
      })
  })).optional()
    .messages({
      'array.base': 'Items must be an array',
      'array.items': 'Each item must be a valid purchase order item'
    })
});

// Validation schema for purchase order item
const purchaseOrderItemSchema = Joi.object({
  itemId: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Item ID must be a number',
      'number.integer': 'Item ID must be an integer',
      'number.positive': 'Item ID must be positive',
      'any.required': 'Item ID is required'
    }),
  
  quantity: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'Quantity must be a number',
      'number.integer': 'Quantity must be an integer',
      'number.positive': 'Quantity must be positive',
      'any.required': 'Quantity is required'
    }),
  
  unitPrice: Joi.number().precision(2).positive().required()
    .messages({
      'number.base': 'Unit price must be a number',
      'number.precision': 'Unit price can have maximum 2 decimal places',
      'number.positive': 'Unit price must be positive',
      'any.required': 'Unit price is required'
    }),
  
  remarks: Joi.string().max(255).optional()
    .messages({
      'string.base': 'Remarks must be a string',
      'string.max': 'Remarks cannot exceed 255 characters'
    })
});

// Validation schema for updating purchase order
const updatePurchaseOrderSchema = Joi.object({
  supplierId: Joi.number().integer().positive().optional()
    .messages({
      'number.base': 'Supplier ID must be a number',
      'number.integer': 'Supplier ID must be an integer',
      'number.positive': 'Supplier ID must be positive'
    }),
  
  orderDate: Joi.date().iso().optional()
    .messages({
      'date.base': 'Order date must be a valid date',
      'date.format': 'Order date must be in ISO format'
    }),
  
  expectedDeliveryDate: Joi.date().iso().optional()
    .messages({
      'date.base': 'Expected delivery date must be a valid date',
      'date.format': 'Expected delivery date must be in ISO format'
    }),
  
  status: Joi.string().valid('DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED').optional()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be one of: DRAFT, PENDING, APPROVED, ORDERED, RECEIVED, CANCELLED'
    }),
  
  subtotal: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Subtotal must be a number',
      'number.precision': 'Subtotal can have maximum 2 decimal places',
      'number.min': 'Subtotal cannot be negative'
    }),
  
  taxAmount: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Tax amount must be a number',
      'number.precision': 'Tax amount can have maximum 2 decimal places',
      'number.min': 'Tax amount cannot be negative'
    }),
  
  discountAmount: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Discount amount must be a number',
      'number.precision': 'Discount amount can have maximum 2 decimal places',
      'number.min': 'Discount amount cannot be negative'
    }),
  
  totalAmount: Joi.number().precision(2).min(0).optional()
    .messages({
      'number.base': 'Total amount must be a number',
      'number.precision': 'Total amount can have maximum 2 decimal places',
      'number.min': 'Total amount cannot be negative'
    }),
  
  currency: Joi.string().length(3).uppercase().optional()
    .messages({
      'string.base': 'Currency must be a string',
      'string.length': 'Currency must be exactly 3 characters',
      'string.uppercase': 'Currency must be in uppercase'
    }),
  
  paymentTerms: Joi.string().max(100).optional()
    .messages({
      'string.base': 'Payment terms must be a string',
      'string.max': 'Payment terms cannot exceed 100 characters'
    }),
  
  deliveryAddress: Joi.string().max(1000).optional()
    .messages({
      'string.base': 'Delivery address must be a string',
      'string.max': 'Delivery address cannot exceed 1000 characters'
    }),
  
  notes: Joi.string().max(1000).optional()
    .messages({
      'string.base': 'Notes must be a string',
      'string.max': 'Notes cannot exceed 1000 characters'
    }),
  
  items: Joi.array().items(purchaseOrderItemSchema).optional()
    .messages({
      'array.base': 'Items must be an array',
      'array.items': 'Each item must be a valid purchase order item'
    })
});

// Validation schema for status update
const statusUpdateSchema = Joi.object({
  status: Joi.string().valid('DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED').required()
    .messages({
      'string.base': 'Status must be a string',
      'any.only': 'Status must be one of: DRAFT, PENDING, APPROVED, ORDERED, RECEIVED, CANCELLED',
      'any.required': 'Status is required'
    })
});

// Validation functions
const validatePurchaseOrder = (data) => {
  return purchaseOrderSchema.validate(data, { abortEarly: false });
};

const validatePurchaseOrderItem = (data) => {
  return purchaseOrderItemSchema.validate(data, { abortEarly: false });
};

const validateUpdatePurchaseOrder = (data) => {
  return updatePurchaseOrderSchema.validate(data, { abortEarly: false });
};

const validateStatusUpdate = (data) => {
  return statusUpdateSchema.validate(data, { abortEarly: false });
};

// Custom validation functions
const validatePurchaseOrderTotals = (data) => {
  const { subtotal = 0, taxAmount = 0, discountAmount = 0, totalAmount = 0, items = [] } = data;
  
  // Calculate expected totals
  const calculatedSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const calculatedTotal = calculatedSubtotal + taxAmount - discountAmount;
  
  const errors = [];
  
  if (Math.abs(calculatedSubtotal - subtotal) > 0.01) {
    errors.push('Subtotal does not match calculated value from items');
  }
  
  if (Math.abs(calculatedTotal - totalAmount) > 0.01) {
    errors.push('Total amount does not match calculated value');
  }
  
  if (discountAmount > subtotal) {
    errors.push('Discount amount cannot exceed subtotal');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

const validatePurchaseOrderStatusTransition = (currentStatus, newStatus) => {
  const validTransitions = {
    'DRAFT': ['PENDING', 'CANCELLED'],
    'PENDING': ['APPROVED', 'CANCELLED'],
    'APPROVED': ['ORDERED', 'CANCELLED'],
    'ORDERED': ['RECEIVED', 'CANCELLED'],
    'RECEIVED': [],
    'CANCELLED': []
  };
  
  const allowedTransitions = validTransitions[currentStatus] || [];
  
  return {
    isValid: allowedTransitions.includes(newStatus),
    allowedTransitions,
    error: allowedTransitions.includes(newStatus) ? null : 
           `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`
  };
};

export {
  validatePurchaseOrder,
  validatePurchaseOrderItem,
  validateUpdatePurchaseOrder,
  validateStatusUpdate,
  validatePurchaseOrderTotals,
  validatePurchaseOrderStatusTransition,
  purchaseOrderSchema,
  purchaseOrderItemSchema,
  updatePurchaseOrderSchema,
  statusUpdateSchema
};
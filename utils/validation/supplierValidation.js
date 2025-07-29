import Joi from 'joi';

// Base supplier validation schema
const baseSupplierSchema = {
  name: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Supplier name must be at least 2 characters long',
      'string.max': 'Supplier name cannot exceed 100 characters',
      'any.required': 'Supplier name is required'
    }),

  code: Joi.string()
    .max(20)
    .pattern(/^[A-Z0-9_-]+$/)
    .optional()
    .messages({
      'string.max': 'Supplier code cannot exceed 20 characters',
      'string.pattern.base': 'Supplier code can only contain uppercase letters, numbers, hyphens, and underscores'
    }),

  contactPerson: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Contact person name cannot exceed 100 characters'
    }),

  email: Joi.string()
    .email()
    .max(100)
    .optional()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email address cannot exceed 100 characters'
    }),

  phone: Joi.string()
    .max(20)
    .pattern(/^[\+]?[1-9][\d]{0,15}$/)
    .optional()
    .messages({
      'string.max': 'Phone number cannot exceed 20 characters',
      'string.pattern.base': 'Please provide a valid phone number'
    }),

  address: Joi.string()
    .max(500)
    .optional()
    .messages({
      'string.max': 'Address cannot exceed 500 characters'
    }),

  city: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'City name cannot exceed 50 characters'
    }),

  state: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'State name cannot exceed 50 characters'
    }),

  country: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Country name cannot exceed 50 characters'
    }),

  postalCode: Joi.string()
    .max(20)
    .optional()
    .messages({
      'string.max': 'Postal code cannot exceed 20 characters'
    }),

  website: Joi.string()
    .uri()
    .max(255)
    .optional()
    .messages({
      'string.uri': 'Please provide a valid website URL',
      'string.max': 'Website URL cannot exceed 255 characters'
    }),

  taxId: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Tax ID cannot exceed 50 characters'
    }),

  bankDetails: Joi.object({
    accountNumber: Joi.string().max(50),
    bankName: Joi.string().max(100),
    branchName: Joi.string().max(100),
    ifscCode: Joi.string().max(20),
    accountType: Joi.string().valid('savings', 'current', 'business')
  }).optional(),

  paymentTerms: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Payment terms cannot exceed 100 characters'
    }),

  creditLimit: Joi.number()
    .positive()
    .max(999999999.99)
    .precision(2)
    .optional()
    .messages({
      'number.positive': 'Credit limit must be a positive number',
      'number.max': 'Credit limit cannot exceed 999,999,999.99',
      'number.precision': 'Credit limit can have maximum 2 decimal places'
    }),

  rating: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .optional()
    .messages({
      'number.integer': 'Rating must be a whole number',
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating cannot exceed 5'
    }),

  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')
    .optional()
    .messages({
      'any.only': 'Invalid supplier status'
    })
};

// Create supplier validation schema
const createSupplierSchema = Joi.object({
  ...baseSupplierSchema,
  name: baseSupplierSchema.name,
  email: baseSupplierSchema.email.required(),
  phone: baseSupplierSchema.phone.required()
});

// Update supplier validation schema
const updateSupplierSchema = Joi.object({
  ...baseSupplierSchema,
  name: baseSupplierSchema.name.optional(),
  email: baseSupplierSchema.email.optional(),
  phone: baseSupplierSchema.phone.optional()
});

// Get supplier by ID validation schema
const getSupplierByIdSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Supplier ID must be a whole number',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    })
});

// Delete supplier validation schema
const deleteSupplierSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Supplier ID must be a whole number',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    })
});

// Get suppliers with filters validation schema
const getSuppliersSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .default(1)
    .messages({
      'number.integer': 'Page must be a whole number',
      'number.min': 'Page must be at least 1'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .messages({
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),

  search: Joi.string()
    .max(100)
    .optional()
    .messages({
      'string.max': 'Search term cannot exceed 100 characters'
    }),

  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')
    .optional()
    .messages({
      'any.only': 'Invalid supplier status'
    }),

  rating: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .optional()
    .messages({
      'number.integer': 'Rating must be a whole number',
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating cannot exceed 5'
    }),

  categoryId: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.integer': 'Category ID must be a whole number',
      'number.positive': 'Category ID must be positive'
    }),

  sortBy: Joi.string()
    .valid('name', 'code', 'rating', 'status', 'createdAt', 'updatedAt')
    .optional()
    .default('createdAt')
    .messages({
      'any.only': 'Invalid sort field'
    }),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .optional()
    .default('desc')
    .messages({
      'any.only': 'Sort order must be either "asc" or "desc"'
    })
});

// Bulk update suppliers validation schema
const bulkUpdateSuppliersSchema = Joi.object({
  supplierIds: Joi.array()
    .items(
      Joi.number()
        .integer()
        .positive()
        .messages({
          'number.integer': 'Supplier ID must be a whole number',
          'number.positive': 'Supplier ID must be positive'
        })
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one supplier ID is required',
      'array.max': 'Cannot update more than 100 suppliers at once',
      'any.required': 'Supplier IDs array is required'
    }),

  updates: Joi.object({
    status: Joi.string()
      .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')
      .optional(),
    rating: Joi.number()
      .integer()
      .min(1)
      .max(5)
      .optional(),
    paymentTerms: Joi.string()
      .max(100)
      .optional(),
    creditLimit: Joi.number()
      .positive()
      .max(999999999.99)
      .precision(2)
      .optional()
  })
    .min(1)
    .required()
    .messages({
      'object.min': 'At least one update field is required',
      'any.required': 'Updates object is required'
    })
});

// Import suppliers validation schema
const importSuppliersSchema = Joi.object({
  suppliers: Joi.array()
    .items(
      Joi.object({
        name: Joi.string()
          .min(2)
          .max(100)
          .required(),
        code: Joi.string()
          .max(20)
          .optional(),
        contactPerson: Joi.string()
          .max(100)
          .optional(),
        email: Joi.string()
          .email()
          .max(100)
          .optional(),
        phone: Joi.string()
          .max(20)
          .optional(),
        address: Joi.string()
          .max(500)
          .optional(),
        city: Joi.string()
          .max(50)
          .optional(),
        state: Joi.string()
          .max(50)
          .optional(),
        country: Joi.string()
          .max(50)
          .optional(),
        postalCode: Joi.string()
          .max(20)
          .optional(),
        website: Joi.string()
          .uri()
          .max(255)
          .optional(),
        taxId: Joi.string()
          .max(50)
          .optional(),
        paymentTerms: Joi.string()
          .max(100)
          .optional(),
        creditLimit: Joi.number()
          .positive()
          .max(999999999.99)
          .precision(2)
          .optional(),
        rating: Joi.number()
          .integer()
          .min(1)
          .max(5)
          .optional(),
        status: Joi.string()
          .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')
          .optional()
      })
    )
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one supplier is required',
      'array.max': 'Cannot import more than 1000 suppliers at once',
      'any.required': 'Suppliers array is required'
    })
});

// Export suppliers validation schema
const exportSuppliersSchema = Joi.object({
  format: Joi.string()
    .valid('csv', 'excel', 'json')
    .optional()
    .default('csv')
    .messages({
      'any.only': 'Export format must be csv, excel, or json'
    }),

  startDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date'
    }),

  endDate: Joi.date()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date'
    }),

  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')
    .optional()
    .messages({
      'any.only': 'Invalid supplier status'
    }),

  categoryId: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.integer': 'Category ID must be a whole number',
      'number.positive': 'Category ID must be positive'
    })
});

// Search suppliers validation schema
const searchSuppliersSchema = Joi.object({
  q: Joi.string()
    .min(2)
    .max(100)
    .required()
    .messages({
      'string.min': 'Search query must be at least 2 characters long',
      'string.max': 'Search query cannot exceed 100 characters',
      'any.required': 'Search query is required'
    }),

  categoryId: Joi.number()
    .integer()
    .positive()
    .optional()
    .messages({
      'number.integer': 'Category ID must be a whole number',
      'number.positive': 'Category ID must be positive'
    }),

  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')
    .optional()
    .messages({
      'any.only': 'Invalid supplier status'
    }),

  rating: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .optional()
    .messages({
      'number.integer': 'Rating must be a whole number',
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating cannot exceed 5'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .messages({
      'number.integer': 'Limit must be a whole number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
});

// Update supplier status validation schema
const updateSupplierStatusSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Supplier ID must be a whole number',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    }),

  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')
    .required()
    .messages({
      'any.only': 'Invalid supplier status',
      'any.required': 'Status is required'
    })
});

// Get supplier performance validation schema
const getSupplierPerformanceSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Supplier ID must be a whole number',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    }),

  startDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date'
    }),

  endDate: Joi.date()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date'
    })
});

// Additional validation schemas for specialized routes
const getSuppliersByCategorySchema = Joi.object({
  categoryId: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Category ID must be a whole number',
      'number.positive': 'Category ID must be positive',
      'any.required': 'Category ID is required'
    })
});

const getSuppliersByStatusSchema = Joi.object({
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED')
    .required()
    .messages({
      'any.only': 'Invalid supplier status',
      'any.required': 'Status is required'
    })
});

const getSuppliersByRatingSchema = Joi.object({
  rating: Joi.number()
    .integer()
    .min(1)
    .max(5)
    .required()
    .messages({
      'number.integer': 'Rating must be a whole number',
      'number.min': 'Rating must be at least 1',
      'number.max': 'Rating cannot exceed 5',
      'any.required': 'Rating is required'
    })
});

const getSupplierContactSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Supplier ID must be a whole number',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    })
});

const getSupplierPurchaseHistorySchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Supplier ID must be a whole number',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    }),

  startDate: Joi.date()
    .optional()
    .messages({
      'date.base': 'Start date must be a valid date'
    }),

  endDate: Joi.date()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date'
    })
});

const getSupplierItemsSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Supplier ID must be a whole number',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    })
});

const getSupplierPurchaseOrdersSchema = Joi.object({
  id: Joi.number()
    .integer()
    .positive()
    .required()
    .messages({
      'number.integer': 'Supplier ID must be a whole number',
      'number.positive': 'Supplier ID must be positive',
      'any.required': 'Supplier ID is required'
    })
});

const generateSupplierReportSchema = Joi.object({
  format: Joi.string()
    .valid('csv', 'excel', 'json', 'pdf')
    .optional()
    .default('pdf')
    .messages({
      'any.only': 'Report format must be csv, excel, json, or pdf'
    }),

  startDate: Joi.date()
    .required()
    .messages({
      'any.required': 'Start date is required',
      'date.base': 'Start date must be a valid date'
    }),

  endDate: Joi.date()
    .min(Joi.ref('startDate'))
    .required()
    .messages({
      'any.required': 'End date is required',
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date'
    }),

  supplierIds: Joi.array()
    .items(
      Joi.number()
        .integer()
        .positive()
        .messages({
          'number.integer': 'Supplier ID must be a whole number',
          'number.positive': 'Supplier ID must be positive'
        })
    )
    .optional()
    .messages({
      'array.base': 'Supplier IDs must be an array'
    })
});

const generateSupplierComparisonSchema = Joi.object({
  format: Joi.string()
    .valid('csv', 'excel', 'json', 'pdf')
    .optional()
    .default('pdf')
    .messages({
      'any.only': 'Report format must be csv, excel, json, or pdf'
    }),

  supplierIds: Joi.array()
    .items(
      Joi.number()
        .integer()
        .positive()
        .messages({
          'number.integer': 'Supplier ID must be a whole number',
          'number.positive': 'Supplier ID must be positive'
        })
    )
    .min(2)
    .max(10)
    .required()
    .messages({
      'array.min': 'At least 2 suppliers are required for comparison',
      'array.max': 'Cannot compare more than 10 suppliers at once',
      'any.required': 'Supplier IDs array is required'
    }),

  startDate: Joi.date()
    .required()
    .messages({
      'any.required': 'Start date is required',
      'date.base': 'Start date must be a valid date'
    }),

  endDate: Joi.date()
    .min(Joi.ref('startDate'))
    .required()
    .messages({
      'any.required': 'End date is required',
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date'
    })
});

// Export all validation schemas
export const supplierValidationSchemas = {
  createSupplier: createSupplierSchema,
  updateSupplier: updateSupplierSchema,
  getSupplierById: getSupplierByIdSchema,
  deleteSupplier: deleteSupplierSchema,
  getSuppliers: getSuppliersSchema,
  bulkUpdateSuppliers: bulkUpdateSuppliersSchema,
  importSuppliers: importSuppliersSchema,
  exportSuppliers: exportSuppliersSchema,
  searchSuppliers: searchSuppliersSchema,
  updateSupplierStatus: updateSupplierStatusSchema,
  getSupplierPerformance: getSupplierPerformanceSchema,
  getSuppliersByCategory: getSuppliersByCategorySchema,
  getSuppliersByStatus: getSuppliersByStatusSchema,
  getSuppliersByRating: getSuppliersByRatingSchema,
  getSupplierContact: getSupplierContactSchema,
  getSupplierPurchaseHistory: getSupplierPurchaseHistorySchema,
  getSupplierItems: getSupplierItemsSchema,
  getSupplierPurchaseOrders: getSupplierPurchaseOrdersSchema,
  generateSupplierReport: generateSupplierReportSchema,
  generateSupplierComparison: generateSupplierComparisonSchema
};  
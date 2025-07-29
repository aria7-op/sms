import Joi from 'joi';

/**
 * Equipment categories
 */
export const EQUIPMENT_CATEGORIES = [
    'COMPUTER',
    'ELECTRONICS',
    'FURNITURE',
    'SPORTS',
    'MUSICAL_INSTRUMENTS',
    'LABORATORY',
    'AUDIO_VISUAL',
    'OFFICE_SUPPLIES',
    'TRANSPORT',
    'KITCHEN',
    'MEDICAL',
    'SECURITY',
    'MAINTENANCE',
    'OTHER'
];

/**
 * Equipment subcategories
 */
export const EQUIPMENT_SUBCATEGORIES = {
    COMPUTER: ['DESKTOP', 'LAPTOP', 'TABLET', 'SERVER', 'NETWORK_DEVICE', 'PRINTER', 'SCANNER'],
    ELECTRONICS: ['PROJECTOR', 'TELEVISION', 'CAMERA', 'MICROPHONE', 'SPEAKER', 'AMPLIFIER'],
    FURNITURE: ['DESK', 'CHAIR', 'CABINET', 'SHELF', 'TABLE', 'BED', 'SOFA'],
    SPORTS: ['BALL', 'NET', 'RACKET', 'BAT', 'GOAL_POST', 'TRACK_EQUIPMENT'],
    MUSICAL_INSTRUMENTS: ['PIANO', 'GUITAR', 'DRUM', 'VIOLIN', 'FLUTE', 'TRUMPET'],
    LABORATORY: ['MICROSCOPE', 'BEAKER', 'TEST_TUBE', 'BALANCE', 'BUNSEN_BURNER'],
    AUDIO_VISUAL: ['PROJECTOR', 'SCREEN', 'SOUND_SYSTEM', 'LIGHTING', 'CAMERA'],
    OFFICE_SUPPLIES: ['PEN', 'PAPER', 'STAPLER', 'FILE_CABINET', 'WHITEBOARD'],
    TRANSPORT: ['BUS', 'VAN', 'CAR', 'MOTORCYCLE', 'BICYCLE'],
    KITCHEN: ['REFRIGERATOR', 'STOVE', 'MICROWAVE', 'DISHWASHER', 'BLENDER'],
    MEDICAL: ['FIRST_AID_KIT', 'THERMOMETER', 'BLOOD_PRESSURE_MONITOR'],
    SECURITY: ['CAMERA', 'ALARM', 'LOCK', 'SAFE', 'ACCESS_CONTROL'],
    MAINTENANCE: ['TOOL', 'LADDER', 'GENERATOR', 'PUMP', 'COMPRESSOR'],
    OTHER: ['MISCELLANEOUS']
};

/**
 * Equipment statuses
 */
export const EQUIPMENT_STATUSES = [
    'AVAILABLE',
    'ASSIGNED',
    'IN_USE',
    'MAINTENANCE',
    'DAMAGED',
    'RETIRED',
    'LOST',
    'STOLEN'
];

/**
 * Equipment conditions
 */
export const EQUIPMENT_CONDITIONS = [
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
    'DAMAGED',
    'NEEDS_MAINTENANCE'
];

/**
 * Payment methods
 */
export const PAYMENT_METHODS = [
    'CASH',
    'CARD',
    'BANK_TRANSFER',
    'CHECK',
    'MOBILE_PAYMENT',
    'CRYPTO'
];

/**
 * Equipment types
 */
export const EQUIPMENT_TYPES = [
    'TUITION_FEE',
    'TRANSPORT_FEE',
    'LIBRARY_FEE',
    'LABORATORY_FEE',
    'SPORTS_FEE',
    'EXAM_FEE',
    'HOSTEL_FEE',
    'OTHER'
];

/**
 * Validation schema for creating equipment
 */
const createEquipmentSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(255)
        .required()
        .messages({
            'string.min': 'Equipment name must be at least 2 characters long',
            'string.max': 'Equipment name cannot exceed 255 characters',
            'any.required': 'Equipment name is required'
        }),

    description: Joi.string()
        .max(1000)
        .optional()
        .messages({
            'string.max': 'Description cannot exceed 1000 characters'
        }),

    category: Joi.string()
        .valid(...EQUIPMENT_CATEGORIES)
        .required()
        .messages({
            'any.only': 'Invalid equipment category',
            'any.required': 'Equipment category is required'
        }),

    subcategory: Joi.string()
        .when('category', {
            is: Joi.string().valid(...EQUIPMENT_CATEGORIES),
            then: Joi.valid(...(EQUIPMENT_SUBCATEGORIES[Joi.ref('category')] || ['OTHER'])),
            otherwise: Joi.forbidden()
        })
        .optional()
        .messages({
            'any.only': 'Invalid subcategory for the selected category',
            'any.forbidden': 'Subcategory is not allowed for this category'
        }),

    brand: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Brand name cannot exceed 100 characters'
        }),

    model: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Model name cannot exceed 100 characters'
        }),

    serialNumber: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Serial number cannot exceed 100 characters'
        }),

    assetTag: Joi.string()
        .max(50)
        .optional()
        .messages({
            'string.max': 'Asset tag cannot exceed 50 characters'
        }),

    purchaseDate: Joi.date()
        .max('now')
        .optional()
        .messages({
            'date.max': 'Purchase date cannot be in the future'
        }),

    purchasePrice: Joi.number()
        .min(0)
        .precision(2)
        .optional()
        .messages({
            'number.min': 'Purchase price cannot be negative',
            'number.precision': 'Purchase price must have at most 2 decimal places'
        }),

    currentValue: Joi.number()
        .min(0)
        .precision(2)
        .optional()
        .messages({
            'number.min': 'Current value cannot be negative',
            'number.precision': 'Current value must have at most 2 decimal places'
        }),

    warrantyExpiry: Joi.date()
        .min('now')
        .optional()
        .messages({
            'date.min': 'Warranty expiry date must be in the future'
        }),

    location: Joi.string()
        .max(255)
        .optional()
        .messages({
            'string.max': 'Location cannot exceed 255 characters'
        }),

    status: Joi.string()
        .valid(...EQUIPMENT_STATUSES)
        .default('AVAILABLE')
        .messages({
            'any.only': 'Invalid equipment status'
        }),

    condition: Joi.string()
        .valid(...EQUIPMENT_CONDITIONS)
        .default('EXCELLENT')
        .messages({
            'any.only': 'Invalid equipment condition'
        }),

    specifications: Joi.object()
        .optional()
        .messages({
            'object.base': 'Specifications must be an object'
        }),

    supplier: Joi.string()
        .max(255)
        .optional()
        .messages({
            'string.max': 'Supplier name cannot exceed 255 characters'
        }),

    supplierContact: Joi.object({
        name: Joi.string().max(100).optional(),
        email: Joi.string().email().optional(),
        phone: Joi.string().max(20).optional(),
        address: Joi.string().max(500).optional()
    })
    .optional()
    .messages({
        'object.base': 'Supplier contact must be an object'
    }),

    maintenanceSchedule: Joi.string()
        .valid('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'AS_NEEDED')
        .optional()
        .messages({
            'any.only': 'Invalid maintenance schedule'
        }),

    lastMaintenanceDate: Joi.date()
        .max('now')
        .optional()
        .messages({
            'date.max': 'Last maintenance date cannot be in the future'
        }),

    nextMaintenanceDate: Joi.date()
        .min('now')
        .optional()
        .messages({
            'date.min': 'Next maintenance date must be in the future'
        }),

    usageInstructions: Joi.string()
        .max(2000)
        .optional()
        .messages({
            'string.max': 'Usage instructions cannot exceed 2000 characters'
        }),

    safetyNotes: Joi.string()
        .max(1000)
        .optional()
        .messages({
            'string.max': 'Safety notes cannot exceed 1000 characters'
        }),

    isPortable: Joi.boolean()
        .default(false)
        .messages({
            'boolean.base': 'Is portable must be a boolean value'
        }),

    requiresTraining: Joi.boolean()
        .default(false)
        .messages({
            'boolean.base': 'Requires training must be a boolean value'
        }),

    maxUsers: Joi.number()
        .integer()
        .min(1)
        .optional()
        .messages({
            'number.base': 'Max users must be a number',
            'number.integer': 'Max users must be an integer',
            'number.min': 'Max users must be at least 1'
        }),

    powerRequirements: Joi.object({
        voltage: Joi.number().positive().optional(),
        wattage: Joi.number().positive().optional(),
        amperage: Joi.number().positive().optional(),
        frequency: Joi.number().positive().optional()
    })
    .optional()
    .messages({
        'object.base': 'Power requirements must be an object'
    }),

    dimensions: Joi.object({
        length: Joi.number().positive().optional(),
        width: Joi.number().positive().optional(),
        height: Joi.number().positive().optional(),
        unit: Joi.string().valid('CM', 'INCH', 'METER', 'FEET').optional()
    })
    .optional()
    .messages({
        'object.base': 'Dimensions must be an object'
    }),

    weight: Joi.object({
        value: Joi.number().positive().optional(),
        unit: Joi.string().valid('KG', 'POUND', 'GRAM').optional()
    })
    .optional()
    .messages({
        'object.base': 'Weight must be an object'
    }),

    color: Joi.string()
        .max(50)
        .optional()
        .messages({
            'string.max': 'Color cannot exceed 50 characters'
        }),

    barcode: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Barcode cannot exceed 100 characters'
        }),

    qrCode: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'QR code cannot exceed 100 characters'
        }),

    imageUrl: Joi.string()
        .uri()
        .optional()
        .messages({
            'string.uri': 'Image URL must be a valid URI'
        }),

    documents: Joi.array()
        .items(Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            type: Joi.string().valid('MANUAL', 'WARRANTY', 'INVOICE', 'CERTIFICATE', 'OTHER').required()
        }))
        .optional()
        .messages({
            'array.base': 'Documents must be an array'
        }),

    tags: Joi.array()
        .items(Joi.string().max(50))
        .max(20)
        .optional()
        .messages({
            'array.base': 'Tags must be an array',
            'array.max': 'Cannot have more than 20 tags'
        }),

    metadata: Joi.object()
        .optional()
        .messages({
            'object.base': 'Metadata must be an object'
        }),

    departmentId: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.base': 'Department ID must be a number',
            'number.integer': 'Department ID must be an integer',
            'number.positive': 'Department ID must be positive'
        }),

    assignedTo: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.base': 'Assigned to must be a number',
            'number.integer': 'Assigned to must be an integer',
            'number.positive': 'Assigned to must be positive'
        }),

    notes: Joi.string()
        .max(1000)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 1000 characters'
        }),

    isActive: Joi.boolean()
        .default(true)
        .messages({
            'boolean.base': 'Is active must be a boolean value'
        })
});

/**
 * Validation schema for updating equipment
 */
const updateEquipmentSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(255)
        .optional()
        .messages({
            'string.min': 'Equipment name must be at least 2 characters long',
            'string.max': 'Equipment name cannot exceed 255 characters'
        }),

    description: Joi.string()
        .max(1000)
        .optional()
        .messages({
            'string.max': 'Description cannot exceed 1000 characters'
        }),

    category: Joi.string()
        .valid(...EQUIPMENT_CATEGORIES)
        .optional()
        .messages({
            'any.only': 'Invalid equipment category'
        }),

    subcategory: Joi.string()
        .when('category', {
            is: Joi.string().valid(...EQUIPMENT_CATEGORIES),
            then: Joi.valid(...(EQUIPMENT_SUBCATEGORIES[Joi.ref('category')] || ['OTHER'])),
            otherwise: Joi.forbidden()
        })
        .optional()
        .messages({
            'any.only': 'Invalid subcategory for the selected category',
            'any.forbidden': 'Subcategory is not allowed for this category'
        }),

    brand: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Brand name cannot exceed 100 characters'
        }),

    model: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Model name cannot exceed 100 characters'
        }),

    serialNumber: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Serial number cannot exceed 100 characters'
        }),

    assetTag: Joi.string()
        .max(50)
        .optional()
        .messages({
            'string.max': 'Asset tag cannot exceed 50 characters'
        }),

    purchaseDate: Joi.date()
        .max('now')
        .optional()
        .messages({
            'date.max': 'Purchase date cannot be in the future'
        }),

    purchasePrice: Joi.number()
        .min(0)
        .precision(2)
        .optional()
        .messages({
            'number.min': 'Purchase price cannot be negative',
            'number.precision': 'Purchase price must have at most 2 decimal places'
        }),

    currentValue: Joi.number()
        .min(0)
        .precision(2)
        .optional()
        .messages({
            'number.min': 'Current value cannot be negative',
            'number.precision': 'Current value must have at most 2 decimal places'
        }),

    warrantyExpiry: Joi.date()
        .optional()
        .messages({
            'date.base': 'Invalid warranty expiry date'
        }),

    location: Joi.string()
        .max(255)
        .optional()
        .messages({
            'string.max': 'Location cannot exceed 255 characters'
        }),

    status: Joi.string()
        .valid(...EQUIPMENT_STATUSES)
        .optional()
        .messages({
            'any.only': 'Invalid equipment status'
        }),

    condition: Joi.string()
        .valid(...EQUIPMENT_CONDITIONS)
        .optional()
        .messages({
            'any.only': 'Invalid equipment condition'
        }),

    specifications: Joi.object()
        .optional()
        .messages({
            'object.base': 'Specifications must be an object'
        }),

    supplier: Joi.string()
        .max(255)
        .optional()
        .messages({
            'string.max': 'Supplier name cannot exceed 255 characters'
        }),

    supplierContact: Joi.object({
        name: Joi.string().max(100).optional(),
        email: Joi.string().email().optional(),
        phone: Joi.string().max(20).optional(),
        address: Joi.string().max(500).optional()
    })
    .optional()
    .messages({
        'object.base': 'Supplier contact must be an object'
    }),

    maintenanceSchedule: Joi.string()
        .valid('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUALLY', 'ANNUALLY', 'AS_NEEDED')
        .optional()
        .messages({
            'any.only': 'Invalid maintenance schedule'
        }),

    lastMaintenanceDate: Joi.date()
        .max('now')
        .optional()
        .messages({
            'date.max': 'Last maintenance date cannot be in the future'
        }),

    nextMaintenanceDate: Joi.date()
        .optional()
        .messages({
            'date.base': 'Invalid next maintenance date'
        }),

    usageInstructions: Joi.string()
        .max(2000)
        .optional()
        .messages({
            'string.max': 'Usage instructions cannot exceed 2000 characters'
        }),

    safetyNotes: Joi.string()
        .max(1000)
        .optional()
        .messages({
            'string.max': 'Safety notes cannot exceed 1000 characters'
        }),

    isPortable: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'Is portable must be a boolean value'
        }),

    requiresTraining: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'Requires training must be a boolean value'
        }),

    maxUsers: Joi.number()
        .integer()
        .min(1)
        .optional()
        .messages({
            'number.base': 'Max users must be a number',
            'number.integer': 'Max users must be an integer',
            'number.min': 'Max users must be at least 1'
        }),

    powerRequirements: Joi.object({
        voltage: Joi.number().positive().optional(),
        wattage: Joi.number().positive().optional(),
        amperage: Joi.number().positive().optional(),
        frequency: Joi.number().positive().optional()
    })
    .optional()
    .messages({
        'object.base': 'Power requirements must be an object'
    }),

    dimensions: Joi.object({
        length: Joi.number().positive().optional(),
        width: Joi.number().positive().optional(),
        height: Joi.number().positive().optional(),
        unit: Joi.string().valid('CM', 'INCH', 'METER', 'FEET').optional()
    })
    .optional()
    .messages({
        'object.base': 'Dimensions must be an object'
    }),

    weight: Joi.object({
        value: Joi.number().positive().optional(),
        unit: Joi.string().valid('KG', 'POUND', 'GRAM').optional()
    })
    .optional()
    .messages({
        'object.base': 'Weight must be an object'
    }),

    color: Joi.string()
        .max(50)
        .optional()
        .messages({
            'string.max': 'Color cannot exceed 50 characters'
        }),

    barcode: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'Barcode cannot exceed 100 characters'
        }),

    qrCode: Joi.string()
        .max(100)
        .optional()
        .messages({
            'string.max': 'QR code cannot exceed 100 characters'
        }),

    imageUrl: Joi.string()
        .uri()
        .optional()
        .messages({
            'string.uri': 'Image URL must be a valid URI'
        }),

    documents: Joi.array()
        .items(Joi.object({
            name: Joi.string().required(),
            url: Joi.string().uri().required(),
            type: Joi.string().valid('MANUAL', 'WARRANTY', 'INVOICE', 'CERTIFICATE', 'OTHER').required()
        }))
        .optional()
        .messages({
            'array.base': 'Documents must be an array'
        }),

    tags: Joi.array()
        .items(Joi.string().max(50))
        .max(20)
        .optional()
        .messages({
            'array.base': 'Tags must be an array',
            'array.max': 'Cannot have more than 20 tags'
        }),

    metadata: Joi.object()
        .optional()
        .messages({
            'object.base': 'Metadata must be an object'
        }),

    departmentId: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.base': 'Department ID must be a number',
            'number.integer': 'Department ID must be an integer',
            'number.positive': 'Department ID must be positive'
        }),

    assignedTo: Joi.number()
        .integer()
        .positive()
        .optional()
        .messages({
            'number.base': 'Assigned to must be a number',
            'number.integer': 'Assigned to must be an integer',
            'number.positive': 'Assigned to must be positive'
        }),

    notes: Joi.string()
        .max(1000)
        .optional()
        .messages({
            'string.max': 'Notes cannot exceed 1000 characters'
        }),

    isActive: Joi.boolean()
        .optional()
        .messages({
            'boolean.base': 'Is active must be a boolean value'
        })
});

/**
 * Validate equipment creation data
 */
export const validateEquipment = (data) => {
    const { error, value } = createEquipmentSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

/**
 * Validate equipment update data
 */
export const validateEquipmentUpdate = (data) => {
    const { error, value } = updateEquipmentSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

/**
 * Validate equipment assignment
 */
export const validateEquipmentAssignment = (data) => {
    const schema = Joi.object({
        userId: Joi.number()
            .integer()
            .positive()
            .required()
            .messages({
                'number.base': 'User ID must be a number',
                'number.integer': 'User ID must be an integer',
                'number.positive': 'User ID must be positive',
                'any.required': 'User ID is required'
            }),

        notes: Joi.string()
            .max(1000)
            .optional()
            .messages({
                'string.max': 'Notes cannot exceed 1000 characters'
            })
    });

    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

/**
 * Validate bulk update data
 */
export const validateBulkUpdate = (data) => {
    const schema = Joi.object({
        equipmentIds: Joi.array()
            .items(Joi.number().integer().positive())
            .min(1)
            .max(100)
            .required()
            .messages({
                'array.base': 'Equipment IDs must be an array',
                'array.min': 'At least one equipment ID is required',
                'array.max': 'Cannot update more than 100 equipment items at once',
                'any.required': 'Equipment IDs are required'
            }),

        updateData: Joi.object()
            .min(1)
            .required()
            .messages({
                'object.base': 'Update data must be an object',
                'object.min': 'At least one field must be provided for update',
                'any.required': 'Update data is required'
            })
    });

    const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

// Export all the constants and functions
export default {
    validateEquipment,
    validateEquipmentUpdate,
    validateEquipmentAssignment,
    validateBulkUpdate,
    EQUIPMENT_CATEGORIES,
    EQUIPMENT_SUBCATEGORIES,
    EQUIPMENT_STATUSES,
    EQUIPMENT_CONDITIONS,
    PAYMENT_METHODS,
    EQUIPMENT_TYPES
};
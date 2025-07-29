import Joi from 'joi';

// Hostel types
export const HOSTEL_TYPES = [
    'BOYS',
    'GIRLS',
    'COED',
    'FAMILY',
    'STAFF',
    'GUEST'
];

// Hostel statuses
export const HOSTEL_STATUSES = [
    'ACTIVE',
    'INACTIVE',
    'MAINTENANCE',
    'CLOSED',
    'RENOVATION'
];

// Room types
export const ROOM_TYPES = [
    'SINGLE',
    'DOUBLE',
    'TRIPLE',
    'QUAD',
    'SUITE',
    'DELUXE',
    'STANDARD'
];

// Room conditions
export const ROOM_CONDITIONS = [
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
    'MAINTENANCE',
    'RENOVATION'
];

// Maintenance statuses
export const MAINTENANCE_STATUSES = [
    'NONE',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'URGENT'
];

// Resident statuses
export const RESIDENT_STATUSES = [
    'ACTIVE',
    'INACTIVE',
    'CHECKED_OUT',
    'SUSPENDED',
    'EXPIRED'
];

// Payment statuses
export const PAYMENT_STATUSES = [
    'PENDING',
    'PAID',
    'PARTIAL',
    'OVERDUE',
    'WAIVED'
];

// Payment methods
export const PAYMENT_METHODS = [
    'MONTHLY',
    'QUARTERLY',
    'SEMESTER',
    'ANNUAL',
    'CUSTOM'
];

// Meal plans
export const MEAL_PLANS = [
    'NO_MEALS',
    'BREAKFAST_ONLY',
    'LUNCH_ONLY',
    'DINNER_ONLY',
    'BREAKFAST_LUNCH',
    'LUNCH_DINNER',
    'THREE_MEALS',
    'ALL_MEALS'
];

// Visitor policies
export const VISITOR_POLICIES = [
    'ALLOWED',
    'RESTRICTED',
    'NOT_ALLOWED',
    'APPROVAL_REQUIRED'
];

// Hostel validation schema
const hostelSchema = Joi.object({
    name: Joi.string().min(1).max(200).required(),
    code: Joi.string().max(20).optional(),
    address: Joi.string().max(500).required(),
    city: Joi.string().max(100).required(),
    state: Joi.string().max(100).optional(),
    country: Joi.string().max(100).optional(),
    postalCode: Joi.string().max(20).optional(),
    phone: Joi.string().max(20).optional(),
    email: Joi.string().email().optional(),
    website: Joi.string().uri().optional(),
    description: Joi.string().max(2000).optional(),
    type: Joi.string().valid(...HOSTEL_TYPES).default('BOYS'),
    capacity: Joi.number().integer().min(1).required(),
    occupiedCapacity: Joi.number().integer().min(0).optional(),
    availableCapacity: Joi.number().integer().min(0).optional(),
    totalFloors: Joi.number().integer().min(1).optional(),
    totalRooms: Joi.number().integer().min(0).optional(),
    totalBeds: Joi.number().integer().min(0).optional(),
    occupiedBeds: Joi.number().integer().min(0).optional(),
    availableBeds: Joi.number().integer().min(0).optional(),
    wardenName: Joi.string().max(100).optional(),
    wardenPhone: Joi.string().max(20).optional(),
    wardenEmail: Joi.string().email().optional(),
    assistantWardenName: Joi.string().max(100).optional(),
    assistantWardenPhone: Joi.string().max(20).optional(),
    assistantWardenEmail: Joi.string().email().optional(),
    checkInTime: Joi.string().max(10).optional(),
    checkOutTime: Joi.string().max(10).optional(),
    curfewTime: Joi.string().max(10).optional(),
    mealPlan: Joi.string().valid(...MEAL_PLANS).default('THREE_MEALS'),
    wifiAvailable: Joi.boolean().default(false),
    wifiPassword: Joi.string().max(50).optional(),
    laundryAvailable: Joi.boolean().default(false),
    gymAvailable: Joi.boolean().default(false),
    libraryAvailable: Joi.boolean().default(false),
    parkingAvailable: Joi.boolean().default(false),
    securityAvailable: Joi.boolean().default(true),
    medicalFacility: Joi.boolean().default(false),
    transportAvailable: Joi.boolean().default(false),
    monthlyRent: Joi.number().positive().precision(2).optional(),
    securityDeposit: Joi.number().positive().precision(2).optional(),
    maintenanceFee: Joi.number().positive().precision(2).default(0),
    utilityFee: Joi.number().positive().precision(2).default(0),
    mealFee: Joi.number().positive().precision(2).default(0),
    otherFees: Joi.number().positive().precision(2).default(0),
    totalMonthlyFee: Joi.number().positive().precision(2).optional(),
    paymentDueDate: Joi.number().integer().min(1).max(31).optional(),
    lateFeePercentage: Joi.number().positive().precision(2).default(5),
    status: Joi.string().valid(...HOSTEL_STATUSES).default('ACTIVE'),
    amenities: Joi.array().items(Joi.string()).optional(),
    rules: Joi.array().items(Joi.string()).optional(),
    policies: Joi.array().items(Joi.string()).optional(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    location: Joi.object({
        latitude: Joi.number().min(-90).max(90),
        longitude: Joi.number().min(-180).max(180)
    }).optional(),
    coordinates: Joi.string().optional(),
    isActive: Joi.boolean().default(true),
    notes: Joi.string().max(1000).optional()
});

// Room validation schema
const roomSchema = Joi.object({
    roomNumber: Joi.string().max(20).required(),
    floorNumber: Joi.number().integer().min(1).required(),
    hostelId: Joi.number().integer().positive().required(),
    type: Joi.string().valid(...ROOM_TYPES).default('SINGLE'),
    capacity: Joi.number().integer().min(1).default(1),
    occupiedCapacity: Joi.number().integer().min(0).optional(),
    availableCapacity: Joi.number().integer().min(0).optional(),
    totalBeds: Joi.number().integer().min(1).default(1),
    occupiedBeds: Joi.number().integer().min(0).optional(),
    availableBeds: Joi.number().integer().min(0).optional(),
    roomSize: Joi.string().max(50).optional(),
    roomArea: Joi.number().positive().optional(),
    hasAttachedBathroom: Joi.boolean().default(false),
    hasBalcony: Joi.boolean().default(false),
    hasAC: Joi.boolean().default(false),
    hasHeater: Joi.boolean().default(false),
    hasWifi: Joi.boolean().default(false),
    hasTV: Joi.boolean().default(false),
    hasRefrigerator: Joi.boolean().default(false),
    hasWardrobe: Joi.boolean().default(true),
    hasStudyTable: Joi.boolean().default(true),
    hasChair: Joi.boolean().default(true),
    hasBed: Joi.boolean().default(true),
    hasFan: Joi.boolean().default(true),
    hasLight: Joi.boolean().default(true),
    hasCurtains: Joi.boolean().default(true),
    hasCarpet: Joi.boolean().default(false),
    hasMirror: Joi.boolean().default(false),
    hasShoeRack: Joi.boolean().default(false),
    hasLaundryBasket: Joi.boolean().default(false),
    roomCondition: Joi.string().valid(...ROOM_CONDITIONS).default('GOOD'),
    maintenanceStatus: Joi.string().valid(...MAINTENANCE_STATUSES).default('NONE'),
    lastMaintenanceDate: Joi.date().max('now').optional(),
    nextMaintenanceDate: Joi.date().optional(),
    monthlyRent: Joi.number().positive().precision(2).optional(),
    securityDeposit: Joi.number().positive().precision(2).optional(),
    maintenanceFee: Joi.number().positive().precision(2).default(0),
    utilityFee: Joi.number().positive().precision(2).default(0),
    otherFees: Joi.number().positive().precision(2).default(0),
    totalMonthlyFee: Joi.number().positive().precision(2).optional(),
    status: Joi.string().valid('AVAILABLE', 'OCCUPIED', 'FULL', 'MAINTENANCE', 'RESERVED').default('AVAILABLE'),
    isActive: Joi.boolean().default(true),
    notes: Joi.string().max(1000).optional(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    floorPlan: Joi.string().uri().optional()
});

// Resident validation schema
const residentSchema = Joi.object({
    roomId: Joi.number().integer().positive().required(),
    studentId: Joi.number().integer().positive().required(),
    hostelId: Joi.number().integer().positive().required(),
    checkInDate: Joi.date().max('now').default(new Date()),
    checkOutDate: Joi.date().optional(),
    expectedCheckOutDate: Joi.date().optional(),
    status: Joi.string().valid(...RESIDENT_STATUSES).default('ACTIVE'),
    bedNumber: Joi.number().integer().min(1).optional(),
    emergencyContactName: Joi.string().max(100).optional(),
    emergencyContactPhone: Joi.string().max(20).optional(),
    emergencyContactEmail: Joi.string().email().optional(),
    emergencyContactRelationship: Joi.string().max(50).optional(),
    medicalConditions: Joi.array().items(Joi.string()).optional(),
    allergies: Joi.array().items(Joi.string()).optional(),
    dietaryRestrictions: Joi.array().items(Joi.string()).optional(),
    specialNeeds: Joi.array().items(Joi.string()).optional(),
    guardianName: Joi.string().max(100).optional(),
    guardianPhone: Joi.string().max(20).optional(),
    guardianEmail: Joi.string().email().optional(),
    guardianAddress: Joi.string().max(500).optional(),
    paymentMethod: Joi.string().valid(...PAYMENT_METHODS).default('MONTHLY'),
    paymentStatus: Joi.string().valid(...PAYMENT_STATUSES).default('PENDING'),
    monthlyRent: Joi.number().positive().precision(2).optional(),
    securityDeposit: Joi.number().positive().precision(2).optional(),
    maintenanceFee: Joi.number().positive().precision(2).default(0),
    utilityFee: Joi.number().positive().precision(2).default(0),
    mealFee: Joi.number().positive().precision(2).default(0),
    otherFees: Joi.number().positive().precision(2).default(0),
    totalMonthlyFee: Joi.number().positive().precision(2).optional(),
    lastPaymentDate: Joi.date().max('now').optional(),
    nextPaymentDate: Joi.date().optional(),
    outstandingAmount: Joi.number().positive().precision(2).default(0),
    lateFees: Joi.number().positive().precision(2).default(0),
    mealPlan: Joi.string().valid(...MEAL_PLANS).default('THREE_MEALS'),
    wifiAccess: Joi.boolean().default(true),
    laundryAccess: Joi.boolean().default(true),
    gymAccess: Joi.boolean().default(false),
    libraryAccess: Joi.boolean().default(true),
    parkingAccess: Joi.boolean().default(false),
    visitorPolicy: Joi.string().valid(...VISITOR_POLICIES).default('ALLOWED'),
    curfewTime: Joi.string().max(10).optional(),
    notes: Joi.string().max(1000).optional(),
    metadata: Joi.object().optional()
});

// Floor validation schema
const floorSchema = Joi.object({
    floorNumber: Joi.number().integer().min(1).required(),
    name: Joi.string().max(100).optional(),
    hostelId: Joi.number().integer().positive().required(),
    description: Joi.string().max(1000).optional(),
    totalRooms: Joi.number().integer().min(0).default(0),
    occupiedRooms: Joi.number().integer().min(0).default(0),
    availableRooms: Joi.number().integer().min(0).default(0),
    totalBeds: Joi.number().integer().min(0).default(0),
    occupiedBeds: Joi.number().integer().min(0).default(0),
    availableBeds: Joi.number().integer().min(0).default(0),
    capacity: Joi.number().integer().min(0).default(0),
    occupiedCapacity: Joi.number().integer().min(0).default(0),
    availableCapacity: Joi.number().integer().min(0).default(0),
    hasElevator: Joi.boolean().default(false),
    hasStairs: Joi.boolean().default(true),
    hasFireExit: Joi.boolean().default(true),
    hasSecurityCamera: Joi.boolean().default(false),
    hasCommonBathroom: Joi.boolean().default(false),
    hasCommonKitchen: Joi.boolean().default(false),
    hasCommonLounge: Joi.boolean().default(false),
    hasStudyRoom: Joi.boolean().default(false),
    hasLaundryRoom: Joi.boolean().default(false),
    hasStorageRoom: Joi.boolean().default(false),
    hasVendingMachine: Joi.boolean().default(false),
    hasWaterCooler: Joi.boolean().default(true),
    hasFirstAidKit: Joi.boolean().default(true),
    hasFireExtinguisher: Joi.boolean().default(true),
    floorPlan: Joi.string().uri().optional(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'MAINTENANCE').default('ACTIVE'),
    isActive: Joi.boolean().default(true),
    notes: Joi.string().max(1000).optional()
});

// Search validation schema
const searchSchema = Joi.object({
    query: Joi.string().min(1).max(200).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    type: Joi.string().valid(...HOSTEL_TYPES).optional(),
    status: Joi.string().valid(...HOSTEL_STATUSES).optional(),
    available: Joi.boolean().optional(),
    sortBy: Joi.string().valid('relevance', 'name', 'capacity', 'monthlyRent', 'occupiedCapacity').default('relevance'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Analytics validation schema
const analyticsSchema = Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    type: Joi.string().valid(...HOSTEL_TYPES).optional(),
    city: Joi.string().max(100).optional(),
    groupBy: Joi.string().valid('day', 'week', 'month', 'year').default('month')
});

// Validation functions
export const validateHostel = (data) => {
    const { error, value } = hostelSchema.validate(data, {
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

export const validateRoom = (data) => {
    const { error, value } = roomSchema.validate(data, {
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

export const validateResident = (data) => {
    const { error, value } = residentSchema.validate(data, {
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

export const validateFloor = (data) => {
    const { error, value } = floorSchema.validate(data, {
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

export const validateSearch = (data) => {
    const { error, value } = searchSchema.validate(data, {
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

export const validateAnalytics = (data) => {
    const { error, value } = analyticsSchema.validate(data, {
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

// Business logic validation
export const validateHostelAvailability = (hostel, requestedCapacity = 1) => {
    if (!hostel) {
        return {
            success: false,
            error: 'Hostel not found',
            message: 'Hostel not found'
        };
    }

    if (hostel.availableCapacity < requestedCapacity) {
        return {
            success: false,
            error: 'Insufficient capacity',
            message: `Only ${hostel.availableCapacity} capacity available, ${requestedCapacity} requested`
        };
    }

    if (hostel.status !== 'ACTIVE') {
        return {
            success: false,
            error: 'Hostel not available',
            message: `Hostel is currently ${hostel.status.toLowerCase()}`
        };
    }

    return {
        success: true,
        data: hostel
    };
};

export const validateRoomAvailability = (room, requestedBeds = 1) => {
    if (!room) {
        return {
            success: false,
            error: 'Room not found',
            message: 'Room not found'
        };
    }

    if (room.availableBeds < requestedBeds) {
        return {
            success: false,
            error: 'Insufficient beds',
            message: `Only ${room.availableBeds} beds available, ${requestedBeds} requested`
        };
    }

    if (room.status !== 'AVAILABLE') {
        return {
            success: false,
            error: 'Room not available',
            message: `Room is currently ${room.status.toLowerCase()}`
        };
    }

    return {
        success: true,
        data: room
    };
};

export const validateResidentEligibility = (student, currentResidence, maxResidences = 1) => {
    if (!student) {
        return {
            success: false,
            error: 'Student not found',
            message: 'Student not found'
        };
    }

    if (currentResidence && currentResidence.length >= maxResidences) {
        return {
            success: false,
            error: 'Residence limit reached',
            message: `Maximum ${maxResidences} residence can be occupied at a time`
        };
    }

    return {
        success: true,
        data: { student, currentResidence }
    };
};

export const calculateLateFees = (outstandingAmount, dueDate, lateFeePercentage = 5) => {
    const now = new Date();
    const due = new Date(dueDate);
    
    if (now <= due) {
        return 0;
    }

    const daysLate = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
    return (outstandingAmount * lateFeePercentage * daysLate) / 100;
};

export const validateCheckOutData = (resident, checkOutData) => {
    if (!resident) {
        return {
            success: false,
            error: 'Resident not found',
            message: 'Resident not found'
        };
    }

    if (resident.status === 'INACTIVE') {
        return {
            success: false,
            error: 'Already checked out',
            message: 'This resident has already checked out'
        };
    }

    const checkOutDate = checkOutData.checkOutDate || new Date();
    const outstandingAmount = checkOutData.outstandingAmount || resident.outstandingAmount;

    return {
        success: true,
        data: {
            checkOutDate,
            outstandingAmount
        }
    };
};
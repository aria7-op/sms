import Joi from 'joi';

// Vehicle types
const VEHICLE_TYPES = [
    'SCHOOL_BUS',
    'MINI_BUS',
    'VAN',
    'CAR',
    'TRUCK',
    'AMBULANCE',
    'OTHER'
];

// Vehicle statuses
const VEHICLE_STATUSES = [
    'ACTIVE',
    'MAINTENANCE',
    'RETIRED',
    'DAMAGED',
    'OUT_OF_SERVICE'
];

// Vehicle conditions
const VEHICLE_CONDITIONS = [
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
    'DAMAGED'
];

// Fuel types
const FUEL_TYPES = [
    'PETROL',
    'DIESEL',
    'ELECTRIC',
    'HYBRID',
    'CNG',
    'LPG'
];

// Driver statuses
const DRIVER_STATUSES = [
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'ON_LEAVE',
    'TERMINATED'
];

// Employment types
const EMPLOYMENT_TYPES = [
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'TEMPORARY'
];

// License types
const LICENSE_TYPES = [
    'HEAVY_VEHICLE',
    'LIGHT_VEHICLE',
    'MOTORCYCLE',
    'COMMERCIAL',
    'PRIVATE'
];

// Route types
const ROUTE_TYPES = [
    'SCHOOL_BUS',
    'EXCURSION',
    'FIELD_TRIP',
    'SPECIAL_EVENT',
    'OTHER'
];

// Route directions
const ROUTE_DIRECTIONS = [
    'INBOUND',
    'OUTBOUND',
    'BOTH'
];

// Trip types
const TRIP_TYPES = [
    'REGULAR',
    'SPECIAL',
    'EXCURSION',
    'FIELD_TRIP',
    'EMERGENCY'
];

// Trip statuses
const TRIP_STATUSES = [
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'DELAYED'
];

// Vehicle validation schema
const vehicleSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    type: Joi.string().valid(...VEHICLE_TYPES).required(),
    brand: Joi.string().max(100).optional(),
    model: Joi.string().max(100).optional(),
    year: Joi.number().integer().min(1900).max(new Date().getFullYear() + 1).optional(),
    registrationNumber: Joi.string().max(50).optional(),
    licensePlate: Joi.string().max(20).optional(),
    chassisNumber: Joi.string().max(50).optional(),
    engineNumber: Joi.string().max(50).optional(),
    color: Joi.string().max(50).optional(),
    capacity: Joi.number().integer().min(1).optional(),
    seatingCapacity: Joi.number().integer().min(1).optional(),
    standingCapacity: Joi.number().integer().min(0).optional(),
    totalCapacity: Joi.number().integer().min(1).optional(),
    fuelType: Joi.string().valid(...FUEL_TYPES).optional(),
    fuelCapacity: Joi.number().positive().optional(),
    mileage: Joi.number().positive().optional(),
    purchaseDate: Joi.date().max('now').optional(),
    purchasePrice: Joi.number().min(0).precision(2).optional(),
    currentValue: Joi.number().min(0).precision(2).optional(),
    insuranceNumber: Joi.string().max(100).optional(),
    insuranceExpiry: Joi.date().optional(),
    permitNumber: Joi.string().max(100).optional(),
    permitExpiry: Joi.date().optional(),
    fitnessCertificate: Joi.string().max(100).optional(),
    fitnessExpiry: Joi.date().optional(),
    pollutionCertificate: Joi.string().max(100).optional(),
    pollutionExpiry: Joi.date().optional(),
    status: Joi.string().valid(...VEHICLE_STATUSES).default('ACTIVE'),
    condition: Joi.string().valid(...VEHICLE_CONDITIONS).default('EXCELLENT'),
    location: Joi.string().max(255).optional(),
    assignedDriver: Joi.number().integer().positive().optional(),
    maintenanceSchedule: Joi.string().valid('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY').optional(),
    lastMaintenanceDate: Joi.date().max('now').optional(),
    nextMaintenanceDate: Joi.date().optional(),
    lastServiceDate: Joi.date().max('now').optional(),
    nextServiceDate: Joi.date().optional(),
    fuelEfficiency: Joi.number().positive().optional(),
    averageSpeed: Joi.number().positive().optional(),
    maxSpeed: Joi.number().positive().optional(),
    specifications: Joi.object().optional(),
    features: Joi.array().items(Joi.string()).optional(),
    documents: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        url: Joi.string().uri().required(),
        type: Joi.string().valid('MANUAL', 'WARRANTY', 'INSURANCE', 'PERMIT', 'FITNESS', 'POLLUTION', 'OTHER').required()
    })).optional(),
    images: Joi.array().items(Joi.string().uri()).optional(),
    gpsDevice: Joi.boolean().default(false),
    gpsDeviceId: Joi.string().max(100).optional(),
    trackingEnabled: Joi.boolean().default(false),
    isActive: Joi.boolean().default(true),
    notes: Joi.string().max(1000).optional()
});

// Driver validation schema
const driverSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().optional(),
    phone: Joi.string().max(20).required(),
    address: Joi.string().max(500).optional(),
    dateOfBirth: Joi.date().max('now').optional(),
    gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').optional(),
    licenseNumber: Joi.string().max(50).required(),
    licenseType: Joi.string().valid(...LICENSE_TYPES).required(),
    licenseExpiry: Joi.date().required(),
    licenseIssuedDate: Joi.date().max('now').optional(),
    licenseIssuingAuthority: Joi.string().max(100).optional(),
    permitNumber: Joi.string().max(50).optional(),
    permitExpiry: Joi.date().optional(),
    permitType: Joi.string().max(50).optional(),
    experience: Joi.number().integer().min(0).optional(),
    joiningDate: Joi.date().max('now').optional(),
    salary: Joi.number().positive().precision(2).optional(),
    status: Joi.string().valid(...DRIVER_STATUSES).default('ACTIVE'),
    employmentType: Joi.string().valid(...EMPLOYMENT_TYPES).default('FULL_TIME'),
    designation: Joi.string().max(100).default('DRIVER'),
    department: Joi.string().max(100).optional(),
    supervisor: Joi.string().max(100).optional(),
    emergencyContact: Joi.string().max(100).optional(),
    emergencyPhone: Joi.string().max(20).optional(),
    emergencyRelationship: Joi.string().max(50).optional(),
    bloodGroup: Joi.string().max(10).optional(),
    medicalCertificate: Joi.string().max(100).optional(),
    medicalExpiry: Joi.date().optional(),
    trainingCertificates: Joi.array().items(Joi.string()).optional(),
    performanceRating: Joi.number().min(0).max(5).optional(),
    safetyRecord: Joi.object().optional(),
    violations: Joi.array().items(Joi.object({
        date: Joi.date().required(),
        description: Joi.string().required(),
        penalty: Joi.string().optional()
    })).optional(),
    accidents: Joi.array().items(Joi.object({
        date: Joi.date().required(),
        description: Joi.string().required(),
        severity: Joi.string().valid('MINOR', 'MODERATE', 'MAJOR').required()
    })).optional(),
    awards: Joi.array().items(Joi.object({
        date: Joi.date().required(),
        title: Joi.string().required(),
        description: Joi.string().optional()
    })).optional(),
    documents: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        url: Joi.string().uri().required(),
        type: Joi.string().valid('LICENSE', 'PERMIT', 'MEDICAL', 'TRAINING', 'OTHER').required()
    })).optional(),
    image: Joi.string().uri().optional(),
    isActive: Joi.boolean().default(true),
    notes: Joi.string().max(1000).optional()
});

// Route validation schema
const routeSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    code: Joi.string().max(20).optional(),
    description: Joi.string().max(1000).optional(),
    type: Joi.string().valid(...ROUTE_TYPES).default('SCHOOL_BUS'),
    direction: Joi.string().valid(...ROUTE_DIRECTIONS).default('BOTH'),
    startLocation: Joi.string().max(255).required(),
    endLocation: Joi.string().max(255).required(),
    totalDistance: Joi.number().positive().optional(),
    estimatedDuration: Joi.number().positive().optional(),
    maxCapacity: Joi.number().integer().min(1).required(),
    currentCapacity: Joi.number().integer().min(0).default(0),
    stops: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        location: Joi.string().required(),
        pickupTime: Joi.string().optional(),
        dropoffTime: Joi.string().optional(),
        order: Joi.number().integer().min(1).required()
    })).optional(),
    schedule: Joi.object({
        monday: Joi.array().items(Joi.string()).optional(),
        tuesday: Joi.array().items(Joi.string()).optional(),
        wednesday: Joi.array().items(Joi.string()).optional(),
        thursday: Joi.array().items(Joi.string()).optional(),
        friday: Joi.array().items(Joi.string()).optional(),
        saturday: Joi.array().items(Joi.string()).optional(),
        sunday: Joi.array().items(Joi.string()).optional()
    }).optional(),
    pickupTime: Joi.string().optional(),
    dropoffTime: Joi.string().optional(),
    returnPickupTime: Joi.string().optional(),
    returnDropoffTime: Joi.string().optional(),
    vehicleId: Joi.number().integer().positive().optional(),
    driverId: Joi.number().integer().positive().optional(),
    conductorId: Joi.number().integer().positive().optional(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'MAINTENANCE').default('ACTIVE'),
    isActive: Joi.boolean().default(true),
    fare: Joi.number().positive().precision(2).optional(),
    monthlyFare: Joi.number().positive().precision(2).optional(),
    yearlyFare: Joi.number().positive().precision(2).optional(),
    paymentType: Joi.string().valid('MONTHLY', 'QUARTERLY', 'YEARLY', 'PER_TRIP').default('MONTHLY'),
    notes: Joi.string().max(1000).optional()
});

// Trip validation schema
const tripSchema = Joi.object({
    routeId: Joi.number().integer().positive().required(),
    vehicleId: Joi.number().integer().positive().required(),
    driverId: Joi.number().integer().positive().required(),
    conductorId: Joi.number().integer().positive().optional(),
    tripNumber: Joi.string().max(50).optional(),
    type: Joi.string().valid(...TRIP_TYPES).default('REGULAR'),
    direction: Joi.string().valid('INBOUND', 'OUTBOUND').default('OUTBOUND'),
    startTime: Joi.date().required(),
    endTime: Joi.date().optional(),
    actualStartTime: Joi.date().optional(),
    actualEndTime: Joi.date().optional(),
    scheduledStartTime: Joi.date().required(),
    scheduledEndTime: Joi.date().required(),
    delay: Joi.number().integer().min(0).default(0),
    distance: Joi.number().positive().optional(),
    duration: Joi.number().positive().optional(),
    fuelConsumed: Joi.number().positive().optional(),
    fuelCost: Joi.number().positive().precision(2).optional(),
    status: Joi.string().valid(...TRIP_STATUSES).default('SCHEDULED'),
    weather: Joi.string().max(100).optional(),
    traffic: Joi.string().valid('LIGHT', 'MODERATE', 'HEAVY').optional(),
    incidents: Joi.array().items(Joi.object({
        time: Joi.date().required(),
        description: Joi.string().required(),
        severity: Joi.string().valid('MINOR', 'MODERATE', 'MAJOR').required()
    })).optional(),
    notes: Joi.string().max(1000).optional(),
    metadata: Joi.object().optional()
});

// Attendance validation schema
const attendanceSchema = Joi.object({
    studentId: Joi.number().integer().positive().required(),
    status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').default('PRESENT'),
    pickupTime: Joi.date().optional(),
    dropoffTime: Joi.date().optional(),
    notes: Joi.string().max(500).optional()
});

// Validation functions
const validateVehicle = (data) => {
    const { error, value } = vehicleSchema.validate(data, {
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

const validateDriver = (data) => {
    const { error, value } = driverSchema.validate(data, {
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

const validateRoute = (data) => {
    const { error, value } = routeSchema.validate(data, {
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

const validateTrip = (data) => {
    const { error, value } = tripSchema.validate(data, {
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

const validateAttendance = (data) => {
    const { error, value } = attendanceSchema.validate(data, {
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

export default {
    validateVehicle,
    validateDriver,
    validateRoute,
    validateTrip,
    validateAttendance,
    VEHICLE_TYPES,
    VEHICLE_STATUSES,
    VEHICLE_CONDITIONS,
    FUEL_TYPES,
    DRIVER_STATUSES,
    EMPLOYMENT_TYPES,
    LICENSE_TYPES,
    ROUTE_TYPES,
    ROUTE_DIRECTIONS,
    TRIP_TYPES,
    TRIP_STATUSES
}; 
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class Vehicle {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new vehicle
     */
    async create(data) {
        try {
            const vehicle = await this.prisma.vehicle.create({
                data: {
                    name: data.name,
                    type: data.type,
                    brand: data.brand,
                    model: data.model,
                    year: data.year,
                    registrationNumber: data.registrationNumber,
                    licensePlate: data.licensePlate,
                    chassisNumber: data.chassisNumber,
                    engineNumber: data.engineNumber,
                    color: data.color,
                    capacity: data.capacity,
                    seatingCapacity: data.seatingCapacity,
                    standingCapacity: data.standingCapacity,
                    totalCapacity: data.totalCapacity,
                    fuelType: data.fuelType,
                    fuelCapacity: data.fuelCapacity,
                    mileage: data.mileage,
                    purchaseDate: data.purchaseDate,
                    purchasePrice: data.purchasePrice,
                    currentValue: data.currentValue,
                    insuranceNumber: data.insuranceNumber,
                    insuranceExpiry: data.insuranceExpiry,
                    permitNumber: data.permitNumber,
                    permitExpiry: data.permitExpiry,
                    fitnessCertificate: data.fitnessCertificate,
                    fitnessExpiry: data.fitnessExpiry,
                    pollutionCertificate: data.pollutionCertificate,
                    pollutionExpiry: data.pollutionExpiry,
                    status: data.status || 'ACTIVE',
                    condition: data.condition || 'EXCELLENT',
                    location: data.location,
                    assignedDriver: data.assignedDriver,
                    assignedDate: data.assignedDate,
                    maintenanceSchedule: data.maintenanceSchedule,
                    lastMaintenanceDate: data.lastMaintenanceDate,
                    nextMaintenanceDate: data.nextMaintenanceDate,
                    lastServiceDate: data.lastServiceDate,
                    nextServiceDate: data.nextServiceDate,
                    fuelEfficiency: data.fuelEfficiency,
                    averageSpeed: data.averageSpeed,
                    maxSpeed: data.maxSpeed,
                    specifications: data.specifications,
                    features: data.features,
                    documents: data.documents,
                    images: data.images,
                    gpsDevice: data.gpsDevice,
                    gpsDeviceId: data.gpsDeviceId,
                    trackingEnabled: data.trackingEnabled || false,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    notes: data.notes,
                    schoolId: data.schoolId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    driver: true,
                    trips: true,
                    maintenanceLogs: true,
                    fuelLogs: true
                }
            });

            return {
                success: true,
                data: vehicle,
                message: 'Vehicle created successfully'
            };
        } catch (error) {
            console.error('Error creating vehicle:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create vehicle'
            };
        }
    }

    /**
     * Get vehicle by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                school: true,
                driver: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        licenseNumber: true,
                        status: true
                    }
                },
                trips: {
                    orderBy: { startTime: 'desc' },
                    take: 10,
                    include: {
                        route: true,
                        driver: true
                    }
                },
                maintenanceLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                },
                fuelLogs: {
                    orderBy: { date: 'desc' },
                    take: 10
                }
            } : {};

            const vehicle = await this.prisma.vehicle.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!vehicle) {
                return {
                    success: false,
                    error: 'Vehicle not found',
                    message: 'Vehicle not found'
                };
            }

            return {
                success: true,
                data: vehicle,
                message: 'Vehicle retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting vehicle:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve vehicle'
            };
        }
    }

    /**
     * Get all vehicles with advanced filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                type,
                brand,
                status,
                condition,
                fuelType,
                assignedDriver,
                isActive,
                minCapacity,
                maxCapacity,
                minYear,
                maxYear,
                minPrice,
                maxPrice,
                purchaseDateFrom,
                purchaseDateTo,
                insuranceExpiryFrom,
                insuranceExpiryTo,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Search functionality
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { brand: { contains: search, mode: 'insensitive' } },
                    { model: { contains: search, mode: 'insensitive' } },
                    { registrationNumber: { contains: search, mode: 'insensitive' } },
                    { licensePlate: { contains: search, mode: 'insensitive' } },
                    { chassisNumber: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Filter by type
            if (type) {
                where.type = type;
            }

            // Filter by brand
            if (brand) {
                where.brand = brand;
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by condition
            if (condition) {
                where.condition = condition;
            }

            // Filter by fuel type
            if (fuelType) {
                where.fuelType = fuelType;
            }

            // Filter by assigned driver
            if (assignedDriver) {
                where.assignedDriver = parseInt(assignedDriver);
            }

            // Filter by active status
            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            // Filter by capacity range
            if (minCapacity || maxCapacity) {
                where.capacity = {};
                if (minCapacity) where.capacity.gte = parseInt(minCapacity);
                if (maxCapacity) where.capacity.lte = parseInt(maxCapacity);
            }

            // Filter by year range
            if (minYear || maxYear) {
                where.year = {};
                if (minYear) where.year.gte = parseInt(minYear);
                if (maxYear) where.year.lte = parseInt(maxYear);
            }

            // Filter by price range
            if (minPrice || maxPrice) {
                where.currentValue = {};
                if (minPrice) where.currentValue.gte = parseFloat(minPrice);
                if (maxPrice) where.currentValue.lte = parseFloat(maxPrice);
            }

            // Filter by purchase date range
            if (purchaseDateFrom || purchaseDateTo) {
                where.purchaseDate = {};
                if (purchaseDateFrom) where.purchaseDate.gte = new Date(purchaseDateFrom);
                if (purchaseDateTo) where.purchaseDate.lte = new Date(purchaseDateTo);
            }

            // Filter by insurance expiry range
            if (insuranceExpiryFrom || insuranceExpiryTo) {
                where.insuranceExpiry = {};
                if (insuranceExpiryFrom) where.insuranceExpiry.gte = new Date(insuranceExpiryFrom);
                if (insuranceExpiryTo) where.insuranceExpiry.lte = new Date(insuranceExpiryTo);
            }

            const skip = (page - 1) * limit;

            const [vehicles, total] = await Promise.all([
                this.prisma.vehicle.findMany({
                    where,
                    include: {
                        school: true,
                        driver: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                status: true
                            }
                        },
                        _count: {
                            select: {
                                trips: true,
                                maintenanceLogs: true,
                                fuelLogs: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.vehicle.count({ where })
            ]);

            return {
                success: true,
                data: {
                    vehicles,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Vehicles retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting vehicles:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve vehicles'
            };
        }
    }

    /**
     * Update vehicle
     */
    async update(id, data) {
        try {
            const vehicle = await this.prisma.vehicle.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    driver: true
                }
            });

            return {
                success: true,
                data: vehicle,
                message: 'Vehicle updated successfully'
            };
        } catch (error) {
            console.error('Error updating vehicle:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update vehicle'
            };
        }
    }

    /**
     * Delete vehicle (soft delete)
     */
    async delete(id) {
        try {
            const vehicle = await this.prisma.vehicle.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: vehicle,
                message: 'Vehicle deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting vehicle:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete vehicle'
            };
        }
    }

    /**
     * Assign driver to vehicle
     */
    async assignDriver(vehicleId, driverId, assignmentData = {}) {
        try {
            const vehicle = await this.prisma.vehicle.update({
                where: { id: parseInt(vehicleId) },
                data: {
                    assignedDriver: parseInt(driverId),
                    assignedDate: new Date(),
                    notes: assignmentData.notes,
                    updatedAt: new Date()
                },
                include: {
                    driver: true
                }
            });

            return {
                success: true,
                data: vehicle,
                message: 'Driver assigned successfully'
            };
        } catch (error) {
            console.error('Error assigning driver:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to assign driver'
            };
        }
    }

    /**
     * Unassign driver from vehicle
     */
    async unassignDriver(vehicleId) {
        try {
            const vehicle = await this.prisma.vehicle.update({
                where: { id: parseInt(vehicleId) },
                data: {
                    assignedDriver: null,
                    assignedDate: null,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: vehicle,
                message: 'Driver unassigned successfully'
            };
        } catch (error) {
            console.error('Error unassigning driver:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to unassign driver'
            };
        }
    }

    /**
     * Get vehicle analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                type,
                fuelType,
                groupBy = 'month'
            } = filters;

            const where = {};
            if (startDate && endDate) {
                where.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            if (type) where.type = type;
            if (fuelType) where.fuelType = fuelType;

            // Vehicle count by type
            const typeCounts = await this.prisma.vehicle.groupBy({
                by: ['type'],
                where,
                _count: { type: true },
                _sum: { currentValue: true }
            });

            // Vehicle count by status
            const statusCounts = await this.prisma.vehicle.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Vehicle count by condition
            const conditionCounts = await this.prisma.vehicle.groupBy({
                by: ['condition'],
                where,
                _count: { condition: true }
            });

            // Total value and count
            const totalStats = await this.prisma.vehicle.aggregate({
                where,
                _sum: { currentValue: true },
                _count: true,
                _avg: { capacity: true }
            });

            // Vehicles added over time
            const timeSeriesData = await this.prisma.vehicle.groupBy({
                by: [groupBy === 'month' ? 'createdAt' : 'createdAt'],
                where,
                _count: true
            });

            return {
                success: true,
                data: {
                    typeCounts,
                    statusCounts,
                    conditionCounts,
                    totalValue: totalStats._sum.currentValue || 0,
                    totalCount: totalStats._count || 0,
                    averageCapacity: totalStats._avg.capacity || 0,
                    timeSeriesData
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting vehicle analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Get vehicle maintenance schedule
     */
    async getMaintenanceSchedule(filters = {}) {
        try {
            const {
                startDate = new Date(),
                endDate,
                status = 'PENDING'
            } = filters;

            const where = {
                nextMaintenanceDate: {
                    gte: startDate
                }
            };

            if (endDate) {
                where.nextMaintenanceDate.lte = new Date(endDate);
            }

            const vehicles = await this.prisma.vehicle.findMany({
                where,
                include: {
                    driver: {
                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }
                    }
                },
                orderBy: { nextMaintenanceDate: 'asc' }
            });

            return {
                success: true,
                data: vehicles,
                message: 'Maintenance schedule retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting maintenance schedule:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve maintenance schedule'
            };
        }
    }

    /**
     * Get vehicles with expiring documents
     */
    async getExpiringDocuments(days = 30) {
        try {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + days);

            const vehicles = await this.prisma.vehicle.findMany({
                where: {
                    OR: [
                        {
                            insuranceExpiry: {
                                lte: expiryDate,
                                gte: new Date()
                            }
                        },
                        {
                            permitExpiry: {
                                lte: expiryDate,
                                gte: new Date()
                            }
                        },
                        {
                            fitnessExpiry: {
                                lte: expiryDate,
                                gte: new Date()
                            }
                        },
                        {
                            pollutionExpiry: {
                                lte: expiryDate,
                                gte: new Date()
                            }
                        }
                    ]
                },
                include: {
                    driver: {
                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }
                    }
                },
                orderBy: { insuranceExpiry: 'asc' }
            });

            return {
                success: true,
                data: vehicles,
                message: 'Vehicles with expiring documents retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting expiring documents:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve expiring documents'
            };
        }
    }

    /**
     * Get available vehicles
     */
    async getAvailableVehicles(filters = {}) {
        try {
            const {
                type,
                minCapacity,
                maxCapacity,
                fuelType
            } = filters;

            const where = {
                status: 'ACTIVE',
                isActive: true
            };

            if (type) where.type = type;
            if (fuelType) where.fuelType = fuelType;
            if (minCapacity || maxCapacity) {
                where.capacity = {};
                if (minCapacity) where.capacity.gte = parseInt(minCapacity);
                if (maxCapacity) where.capacity.lte = parseInt(maxCapacity);
            }

            const vehicles = await this.prisma.vehicle.findMany({
                where,
                include: {
                    driver: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            status: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            });

            return {
                success: true,
                data: vehicles,
                message: 'Available vehicles retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting available vehicles:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve available vehicles'
            };
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(vehicleIds, updateData) {
        try {
            const result = await this.prisma.vehicle.updateMany({
                where: {
                    id: { in: vehicleIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} vehicles`
            };
        } catch (error) {
            console.error('Error bulk updating vehicles:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update vehicles'
            };
        }
    }

    /**
     * Import vehicles from file
     */
    async importFromFile(fileData, schoolId) {
        try {
            const vehicleData = fileData.map(item => ({
                ...item,
                schoolId: parseInt(schoolId),
                purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : null,
                insuranceExpiry: item.insuranceExpiry ? new Date(item.insuranceExpiry) : null,
                permitExpiry: item.permitExpiry ? new Date(item.permitExpiry) : null,
                fitnessExpiry: item.fitnessExpiry ? new Date(item.fitnessExpiry) : null,
                pollutionExpiry: item.pollutionExpiry ? new Date(item.pollutionExpiry) : null,
                year: item.year ? parseInt(item.year) : null,
                capacity: item.capacity ? parseInt(item.capacity) : null,
                seatingCapacity: item.seatingCapacity ? parseInt(item.seatingCapacity) : null,
                standingCapacity: item.standingCapacity ? parseInt(item.standingCapacity) : null,
                totalCapacity: item.totalCapacity ? parseInt(item.totalCapacity) : null,
                purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : 0,
                currentValue: item.currentValue ? parseFloat(item.currentValue) : 0,
                mileage: item.mileage ? parseFloat(item.mileage) : 0,
                fuelCapacity: item.fuelCapacity ? parseFloat(item.fuelCapacity) : 0,
                fuelEfficiency: item.fuelEfficiency ? parseFloat(item.fuelEfficiency) : 0,
                averageSpeed: item.averageSpeed ? parseFloat(item.averageSpeed) : 0,
                maxSpeed: item.maxSpeed ? parseFloat(item.maxSpeed) : 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            const result = await this.prisma.vehicle.createMany({
                data: vehicleData,
                skipDuplicates: true
            });

            return {
                success: true,
                data: result,
                message: `Imported ${result.count} vehicles`
            };
        } catch (error) {
            console.error('Error importing vehicles:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to import vehicles'
            };
        }
    }

    /**
     * Export vehicle data
     */
    async exportData(filters = {}) {
        try {
            const vehicles = await this.getAll(filters, { page: 1, limit: 10000 });
            
            if (!vehicles.success) {
                return vehicles;
            }

            const exportData = vehicles.data.vehicles.map(item => ({
                id: item.id,
                name: item.name,
                type: item.type,
                brand: item.brand,
                model: item.model,
                year: item.year,
                registrationNumber: item.registrationNumber,
                licensePlate: item.licensePlate,
                color: item.color,
                capacity: item.capacity,
                seatingCapacity: item.seatingCapacity,
                standingCapacity: item.standingCapacity,
                totalCapacity: item.totalCapacity,
                fuelType: item.fuelType,
                mileage: item.mileage,
                purchaseDate: item.purchaseDate,
                purchasePrice: item.purchasePrice,
                currentValue: item.currentValue,
                insuranceNumber: item.insuranceNumber,
                insuranceExpiry: item.insuranceExpiry,
                permitNumber: item.permitNumber,
                permitExpiry: item.permitExpiry,
                status: item.status,
                condition: item.condition,
                assignedDriver: item.driver?.name || '',
                createdAt: item.createdAt
            }));

            return {
                success: true,
                data: exportData,
                message: 'Vehicle data exported successfully'
            };
        } catch (error) {
            console.error('Error exporting vehicle data:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to export vehicle data'
            };
        }
    }
}

export default Vehicle; 
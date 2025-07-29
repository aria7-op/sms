import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class TransportRoute {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new transport route
     */
    async create(data) {
        try {
            const route = await this.prisma.transportRoute.create({
                data: {
                    name: data.name,
                    code: data.code,
                    description: data.description,
                    type: data.type || 'SCHOOL_BUS',
                    direction: data.direction || 'BOTH',
                    startLocation: data.startLocation,
                    endLocation: data.endLocation,
                    totalDistance: data.totalDistance,
                    estimatedDuration: data.estimatedDuration,
                    maxCapacity: data.maxCapacity,
                    currentCapacity: data.currentCapacity || 0,
                    stops: data.stops,
                    schedule: data.schedule,
                    pickupTime: data.pickupTime,
                    dropoffTime: data.dropoffTime,
                    returnPickupTime: data.returnPickupTime,
                    returnDropoffTime: data.returnDropoffTime,
                    vehicleId: data.vehicleId,
                    driverId: data.driverId,
                    conductorId: data.conductorId,
                    status: data.status || 'ACTIVE',
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    fare: data.fare,
                    monthlyFare: data.monthlyFare,
                    yearlyFare: data.yearlyFare,
                    paymentType: data.paymentType || 'MONTHLY',
                    notes: data.notes,
                    schoolId: data.schoolId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    vehicle: true,
                    driver: true,
                    conductor: true,
                    students: true,
                    trips: true
                }
            });

            return {
                success: true,
                data: route,
                message: 'Transport route created successfully'
            };
        } catch (error) {
            console.error('Error creating transport route:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create transport route'
            };
        }
    }

    /**
     * Get route by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                school: true,
                vehicle: {
                    include: {
                        driver: true
                    }
                },
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
                conductor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        status: true
                    }
                },
                students: {
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                grade: true,
                                section: true
                            }
                        }
                    }
                },
                trips: {
                    orderBy: { startTime: 'desc' },
                    take: 10,
                    include: {
                        vehicle: true,
                        driver: true
                    }
                }
            } : {};

            const route = await this.prisma.transportRoute.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!route) {
                return {
                    success: false,
                    error: 'Transport route not found',
                    message: 'Transport route not found'
                };
            }

            return {
                success: true,
                data: route,
                message: 'Transport route retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting transport route:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve transport route'
            };
        }
    }

    /**
     * Get all routes with advanced filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                type,
                direction,
                status,
                vehicleId,
                driverId,
                isActive,
                minDistance,
                maxDistance,
                minCapacity,
                maxCapacity,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Search functionality
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { startLocation: { contains: search, mode: 'insensitive' } },
                    { endLocation: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Filter by type
            if (type) {
                where.type = type;
            }

            // Filter by direction
            if (direction) {
                where.direction = direction;
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by vehicle
            if (vehicleId) {
                where.vehicleId = parseInt(vehicleId);
            }

            // Filter by driver
            if (driverId) {
                where.driverId = parseInt(driverId);
            }

            // Filter by active status
            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            // Filter by distance range
            if (minDistance || maxDistance) {
                where.totalDistance = {};
                if (minDistance) where.totalDistance.gte = parseFloat(minDistance);
                if (maxDistance) where.totalDistance.lte = parseFloat(maxDistance);
            }

            // Filter by capacity range
            if (minCapacity || maxCapacity) {
                where.maxCapacity = {};
                if (minCapacity) where.maxCapacity.gte = parseInt(minCapacity);
                if (maxCapacity) where.maxCapacity.lte = parseInt(maxCapacity);
            }

            const skip = (page - 1) * limit;

            const [routes, total] = await Promise.all([
                this.prisma.transportRoute.findMany({
                    where,
                    include: {
                        school: true,
                        vehicle: {
                            select: {
                                id: true,
                                name: true,
                                type: true,
                                capacity: true,
                                status: true
                            }
                        },
                        driver: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                status: true
                            }
                        },
                        conductor: {
                            select: {
                                id: true,
                                name: true,
                                phone: true,
                                status: true
                            }
                        },
                        _count: {
                            select: {
                                students: true,
                                trips: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.transportRoute.count({ where })
            ]);

            return {
                success: true,
                data: {
                    routes,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Transport routes retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting transport routes:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve transport routes'
            };
        }
    }

    /**
     * Update route
     */
    async update(id, data) {
        try {
            const route = await this.prisma.transportRoute.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    vehicle: true,
                    driver: true,
                    conductor: true
                }
            });

            return {
                success: true,
                data: route,
                message: 'Transport route updated successfully'
            };
        } catch (error) {
            console.error('Error updating transport route:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update transport route'
            };
        }
    }

    /**
     * Delete route (soft delete)
     */
    async delete(id) {
        try {
            const route = await this.prisma.transportRoute.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: route,
                message: 'Transport route deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting transport route:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete transport route'
            };
        }
    }

    /**
     * Assign vehicle to route
     */
    async assignVehicle(routeId, vehicleId, assignmentData = {}) {
        try {
            const route = await this.prisma.transportRoute.update({
                where: { id: parseInt(routeId) },
                data: {
                    vehicleId: parseInt(vehicleId),
                    notes: assignmentData.notes,
                    updatedAt: new Date()
                },
                include: {
                    vehicle: true
                }
            });

            return {
                success: true,
                data: route,
                message: 'Vehicle assigned successfully'
            };
        } catch (error) {
            console.error('Error assigning vehicle:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to assign vehicle'
            };
        }
    }

    /**
     * Assign driver to route
     */
    async assignDriver(routeId, driverId, assignmentData = {}) {
        try {
            const route = await this.prisma.transportRoute.update({
                where: { id: parseInt(routeId) },
                data: {
                    driverId: parseInt(driverId),
                    notes: assignmentData.notes,
                    updatedAt: new Date()
                },
                include: {
                    driver: true
                }
            });

            return {
                success: true,
                data: route,
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
     * Add student to route
     */
    async addStudent(routeId, studentId, data = {}) {
        try {
            const studentRoute = await this.prisma.studentTransport.create({
                data: {
                    routeId: parseInt(routeId),
                    studentId: parseInt(studentId),
                    pickupLocation: data.pickupLocation,
                    dropoffLocation: data.dropoffLocation,
                    pickupTime: data.pickupTime,
                    dropoffTime: data.dropoffTime,
                    fare: data.fare,
                    paymentType: data.paymentType || 'MONTHLY',
                    status: data.status || 'ACTIVE',
                    startDate: data.startDate || new Date(),
                    endDate: data.endDate,
                    notes: data.notes,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    route: true,
                    student: {
                        select: {
                            id: true,
                            name: true,
                            grade: true,
                            section: true
                        }
                    }
                }
            });

            // Update route capacity
            await this.updateCapacity(routeId);

            return {
                success: true,
                data: studentRoute,
                message: 'Student added to route successfully'
            };
        } catch (error) {
            console.error('Error adding student to route:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to add student to route'
            };
        }
    }

    /**
     * Remove student from route
     */
    async removeStudent(routeId, studentId) {
        try {
            await this.prisma.studentTransport.deleteMany({
                where: {
                    routeId: parseInt(routeId),
                    studentId: parseInt(studentId)
                }
            });

            // Update route capacity
            await this.updateCapacity(routeId);

            return {
                success: true,
                message: 'Student removed from route successfully'
            };
        } catch (error) {
            console.error('Error removing student from route:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to remove student from route'
            };
        }
    }

    /**
     * Update route capacity
     */
    async updateCapacity(routeId) {
        try {
            const studentCount = await this.prisma.studentTransport.count({
                where: {
                    routeId: parseInt(routeId),
                    status: 'ACTIVE'
                }
            });

            await this.prisma.transportRoute.update({
                where: { id: parseInt(routeId) },
                data: {
                    currentCapacity: studentCount,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: { currentCapacity: studentCount }
            };
        } catch (error) {
            console.error('Error updating route capacity:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get route analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                type,
                direction,
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
            if (direction) where.direction = direction;

            // Route count by type
            const typeCounts = await this.prisma.transportRoute.groupBy({
                by: ['type'],
                where,
                _count: { type: true },
                _sum: { totalDistance: true }
            });

            // Route count by direction
            const directionCounts = await this.prisma.transportRoute.groupBy({
                by: ['direction'],
                where,
                _count: { direction: true }
            });

            // Route count by status
            const statusCounts = await this.prisma.transportRoute.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Total distance and count
            const totalStats = await this.prisma.transportRoute.aggregate({
                where,
                _sum: { totalDistance: true },
                _count: true,
                _avg: { maxCapacity: true }
            });

            // Routes added over time
            const timeSeriesData = await this.prisma.transportRoute.groupBy({
                by: [groupBy === 'month' ? 'createdAt' : 'createdAt'],
                where,
                _count: true
            });

            return {
                success: true,
                data: {
                    typeCounts,
                    directionCounts,
                    statusCounts,
                    totalDistance: totalStats._sum.totalDistance || 0,
                    totalCount: totalStats._count || 0,
                    averageCapacity: totalStats._avg.maxCapacity || 0,
                    timeSeriesData
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting route analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Get available routes
     */
    async getAvailableRoutes(filters = {}) {
        try {
            const {
                type,
                direction,
                minCapacity,
                maxCapacity
            } = filters;

            const where = {
                status: 'ACTIVE',
                isActive: true
            };

            if (type) where.type = type;
            if (direction) where.direction = direction;
            if (minCapacity || maxCapacity) {
                where.maxCapacity = {};
                if (minCapacity) where.maxCapacity.gte = parseInt(minCapacity);
                if (maxCapacity) where.maxCapacity.lte = parseInt(maxCapacity);
            }

            const routes = await this.prisma.transportRoute.findMany({
                where,
                include: {
                    vehicle: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            capacity: true,
                            status: true
                        }
                    },
                    driver: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            status: true
                        }
                    },
                    _count: {
                        select: {
                            students: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            });

            return {
                success: true,
                data: routes,
                message: 'Available routes retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting available routes:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve available routes'
            };
        }
    }

    /**
     * Get route schedule
     */
    async getRouteSchedule(routeId, date = new Date()) {
        try {
            const route = await this.prisma.transportRoute.findUnique({
                where: { id: parseInt(routeId) },
                include: {
                    vehicle: true,
                    driver: true,
                    conductor: true,
                    students: {
                        include: {
                            student: {
                                select: {
                                    id: true,
                                    name: true,
                                    grade: true,
                                    section: true
                                }
                            }
                        }
                    }
                }
            });

            if (!route) {
                return {
                    success: false,
                    error: 'Route not found',
                    message: 'Route not found'
                };
            }

            // Get trips for the specified date
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const trips = await this.prisma.transportTrip.findMany({
                where: {
                    routeId: parseInt(routeId),
                    startTime: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                },
                include: {
                    vehicle: true,
                    driver: true,
                    attendance: true
                },
                orderBy: { startTime: 'asc' }
            });

            return {
                success: true,
                data: {
                    route,
                    trips,
                    schedule: route.schedule
                },
                message: 'Route schedule retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting route schedule:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve route schedule'
            };
        }
    }
}

export default TransportRoute; 
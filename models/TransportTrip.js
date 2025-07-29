import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class TransportTrip {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new transport trip
     */
    async create(data) {
        try {
            const trip = await this.prisma.transportTrip.create({
                data: {
                    routeId: data.routeId,
                    vehicleId: data.vehicleId,
                    driverId: data.driverId,
                    conductorId: data.conductorId,
                    tripNumber: data.tripNumber,
                    type: data.type || 'REGULAR',
                    direction: data.direction || 'OUTBOUND',
                    startTime: data.startTime,
                    endTime: data.endTime,
                    actualStartTime: data.actualStartTime,
                    actualEndTime: data.actualEndTime,
                    scheduledStartTime: data.scheduledStartTime,
                    scheduledEndTime: data.scheduledEndTime,
                    delay: data.delay || 0,
                    distance: data.distance,
                    duration: data.duration,
                    fuelConsumed: data.fuelConsumed,
                    fuelCost: data.fuelCost,
                    status: data.status || 'SCHEDULED',
                    weather: data.weather,
                    traffic: data.traffic,
                    incidents: data.incidents,
                    notes: data.notes,
                    metadata: data.metadata,
                    schoolId: data.schoolId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    route: true,
                    vehicle: true,
                    driver: true,
                    conductor: true,
                    attendance: true
                }
            });

            return {
                success: true,
                data: trip,
                message: 'Transport trip created successfully'
            };
        } catch (error) {
            console.error('Error creating transport trip:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create transport trip'
            };
        }
    }

    /**
     * Get trip by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                school: true,
                route: {
                    include: {
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
                },
                vehicle: {
                    include: {
                        driver: true
                    }
                },
                driver: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        licenseNumber: true
                    }
                },
                conductor: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                attendance: {
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
            } : {};

            const trip = await this.prisma.transportTrip.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!trip) {
                return {
                    success: false,
                    error: 'Transport trip not found',
                    message: 'Transport trip not found'
                };
            }

            return {
                success: true,
                data: trip,
                message: 'Transport trip retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting transport trip:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve transport trip'
            };
        }
    }

    /**
     * Get all trips with advanced filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                routeId,
                vehicleId,
                driverId,
                type,
                direction,
                status,
                startDate,
                endDate,
                minDistance,
                maxDistance,
                minDelay,
                maxDelay,
                sortBy = 'startTime',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Filter by route
            if (routeId) {
                where.routeId = parseInt(routeId);
            }

            // Filter by vehicle
            if (vehicleId) {
                where.vehicleId = parseInt(vehicleId);
            }

            // Filter by driver
            if (driverId) {
                where.driverId = parseInt(driverId);
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

            // Filter by date range
            if (startDate || endDate) {
                where.startTime = {};
                if (startDate) where.startTime.gte = new Date(startDate);
                if (endDate) where.startTime.lte = new Date(endDate);
            }

            // Filter by distance range
            if (minDistance || maxDistance) {
                where.distance = {};
                if (minDistance) where.distance.gte = parseFloat(minDistance);
                if (maxDistance) where.distance.lte = parseFloat(maxDistance);
            }

            // Filter by delay range
            if (minDelay || maxDelay) {
                where.delay = {};
                if (minDelay) where.delay.gte = parseInt(minDelay);
                if (maxDelay) where.delay.lte = parseInt(maxDelay);
            }

            const skip = (page - 1) * limit;

            const [trips, total] = await Promise.all([
                this.prisma.transportTrip.findMany({
                    where,
                    include: {
                        school: true,
                        route: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        },
                        vehicle: {
                            select: {
                                id: true,
                                name: true,
                                type: true,
                                licensePlate: true
                            }
                        },
                        driver: {
                            select: {
                                id: true,
                                name: true,
                                phone: true
                            }
                        },
                        conductor: {
                            select: {
                                id: true,
                                name: true,
                                phone: true
                            }
                        },
                        _count: {
                            select: {
                                attendance: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.transportTrip.count({ where })
            ]);

            return {
                success: true,
                data: {
                    trips,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Transport trips retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting transport trips:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve transport trips'
            };
        }
    }

    /**
     * Update trip
     */
    async update(id, data) {
        try {
            const trip = await this.prisma.transportTrip.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    route: true,
                    vehicle: true,
                    driver: true,
                    conductor: true
                }
            });

            return {
                success: true,
                data: trip,
                message: 'Transport trip updated successfully'
            };
        } catch (error) {
            console.error('Error updating transport trip:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update transport trip'
            };
        }
    }

    /**
     * Start trip
     */
    async startTrip(id, startData = {}) {
        try {
            const actualStartTime = new Date();
            const trip = await this.prisma.transportTrip.update({
                where: { id: parseInt(id) },
                data: {
                    actualStartTime,
                    status: 'IN_PROGRESS',
                    weather: startData.weather,
                    traffic: startData.traffic,
                    notes: startData.notes,
                    updatedAt: new Date()
                },
                include: {
                    route: true,
                    vehicle: true,
                    driver: true
                }
            });

            return {
                success: true,
                data: trip,
                message: 'Trip started successfully'
            };
        } catch (error) {
            console.error('Error starting trip:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to start trip'
            };
        }
    }

    /**
     * End trip
     */
    async endTrip(id, endData = {}) {
        try {
            const actualEndTime = new Date();
            const trip = await this.prisma.transportTrip.findUnique({
                where: { id: parseInt(id) }
            });

            if (!trip) {
                return {
                    success: false,
                    error: 'Trip not found',
                    message: 'Trip not found'
                };
            }

            // Calculate duration and delay
            const duration = actualEndTime - trip.actualStartTime;
            const scheduledDuration = trip.scheduledEndTime - trip.scheduledStartTime;
            const delay = duration - scheduledDuration;

            const updatedTrip = await this.prisma.transportTrip.update({
                where: { id: parseInt(id) },
                data: {
                    actualEndTime,
                    status: 'COMPLETED',
                    duration: Math.round(duration / (1000 * 60)), // Convert to minutes
                    delay: Math.round(delay / (1000 * 60)), // Convert to minutes
                    distance: endData.distance,
                    fuelConsumed: endData.fuelConsumed,
                    fuelCost: endData.fuelCost,
                    incidents: endData.incidents,
                    notes: endData.notes,
                    updatedAt: new Date()
                },
                include: {
                    route: true,
                    vehicle: true,
                    driver: true
                }
            });

            return {
                success: true,
                data: updatedTrip,
                message: 'Trip ended successfully'
            };
        } catch (error) {
            console.error('Error ending trip:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to end trip'
            };
        }
    }

    /**
     * Cancel trip
     */
    async cancelTrip(id, cancelData = {}) {
        try {
            const trip = await this.prisma.transportTrip.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'CANCELLED',
                    notes: cancelData.reason,
                    updatedAt: new Date()
                },
                include: {
                    route: true,
                    vehicle: true,
                    driver: true
                }
            });

            return {
                success: true,
                data: trip,
                message: 'Trip cancelled successfully'
            };
        } catch (error) {
            console.error('Error cancelling trip:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to cancel trip'
            };
        }
    }

    /**
     * Mark student attendance for trip
     */
    async markAttendance(tripId, attendanceData) {
        try {
            const { studentId, status, pickupTime, dropoffTime, notes } = attendanceData;

            const attendance = await this.prisma.transportAttendance.create({
                data: {
                    tripId: parseInt(tripId),
                    studentId: parseInt(studentId),
                    status: status || 'PRESENT',
                    pickupTime: pickupTime || new Date(),
                    dropoffTime: dropoffTime,
                    notes: notes,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    trip: true,
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

            return {
                success: true,
                data: attendance,
                message: 'Attendance marked successfully'
            };
        } catch (error) {
            console.error('Error marking attendance:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to mark attendance'
            };
        }
    }

    /**
     * Get trip attendance
     */
    async getTripAttendance(tripId) {
        try {
            const attendance = await this.prisma.transportAttendance.findMany({
                where: { tripId: parseInt(tripId) },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            grade: true,
                            section: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            return {
                success: true,
                data: attendance,
                message: 'Trip attendance retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting trip attendance:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve trip attendance'
            };
        }
    }

    /**
     * Get trip analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                routeId,
                vehicleId,
                driverId,
                type,
                direction,
                groupBy = 'day'
            } = filters;

            const where = {};
            if (startDate && endDate) {
                where.startTime = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            if (routeId) where.routeId = parseInt(routeId);
            if (vehicleId) where.vehicleId = parseInt(vehicleId);
            if (driverId) where.driverId = parseInt(driverId);
            if (type) where.type = type;
            if (direction) where.direction = direction;

            // Trip count by status
            const statusCounts = await this.prisma.transportTrip.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Trip count by type
            const typeCounts = await this.prisma.transportTrip.groupBy({
                by: ['type'],
                where,
                _count: { type: true }
            });

            // Trip count by direction
            const directionCounts = await this.prisma.transportTrip.groupBy({
                by: ['direction'],
                where,
                _count: { direction: true }
            });

            // Total statistics
            const totalStats = await this.prisma.transportTrip.aggregate({
                where,
                _count: true,
                _sum: { distance: true, duration: true, delay: true, fuelConsumed: true },
                _avg: { distance: true, duration: true, delay: true }
            });

            // Time series data
            const timeSeriesData = await this.prisma.transportTrip.groupBy({
                by: [groupBy === 'day' ? 'startTime' : 'startTime'],
                where,
                _count: true,
                _sum: { distance: true, duration: true }
            });

            return {
                success: true,
                data: {
                    statusCounts,
                    typeCounts,
                    directionCounts,
                    totalTrips: totalStats._count || 0,
                    totalDistance: totalStats._sum.distance || 0,
                    totalDuration: totalStats._sum.duration || 0,
                    totalDelay: totalStats._sum.delay || 0,
                    totalFuelConsumed: totalStats._sum.fuelConsumed || 0,
                    averageDistance: totalStats._avg.distance || 0,
                    averageDuration: totalStats._avg.duration || 0,
                    averageDelay: totalStats._avg.delay || 0,
                    timeSeriesData
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting trip analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Get today's trips
     */
    async getTodayTrips(filters = {}) {
        try {
            const {
                routeId,
                vehicleId,
                driverId,
                status
            } = filters;

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const where = {
                startTime: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            };

            if (routeId) where.routeId = parseInt(routeId);
            if (vehicleId) where.vehicleId = parseInt(vehicleId);
            if (driverId) where.driverId = parseInt(driverId);
            if (status) where.status = status;

            const trips = await this.prisma.transportTrip.findMany({
                where,
                include: {
                    route: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    vehicle: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            licensePlate: true
                        }
                    },
                    driver: {
                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }
                    },
                    conductor: {
                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }
                    },
                    _count: {
                        select: {
                            attendance: true
                        }
                    }
                },
                orderBy: { startTime: 'asc' }
            });

            return {
                success: true,
                data: trips,
                message: 'Today\'s trips retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting today\'s trips:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve today\'s trips'
            };
        }
    }

    /**
     * Get upcoming trips
     */
    async getUpcomingTrips(hours = 24) {
        try {
            const startTime = new Date();
            const endTime = new Date();
            endTime.setHours(endTime.getHours() + hours);

            const trips = await this.prisma.transportTrip.findMany({
                where: {
                    startTime: {
                        gte: startTime,
                        lte: endTime
                    },
                    status: { in: ['SCHEDULED', 'IN_PROGRESS'] }
                },
                include: {
                    route: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    vehicle: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            licensePlate: true
                        }
                    },
                    driver: {
                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }
                    }
                },
                orderBy: { startTime: 'asc' }
            });

            return {
                success: true,
                data: trips,
                message: 'Upcoming trips retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting upcoming trips:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve upcoming trips'
            };
        }
    }
}

export default TransportTrip; 
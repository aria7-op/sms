import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class Driver {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new driver
     */
    async create(data) {
        try {
            const driver = await this.prisma.driver.create({
                data: {
                    name: data.name,
                    email: data.email,
                    phone: data.phone,
                    address: data.address,
                    dateOfBirth: data.dateOfBirth,
                    gender: data.gender,
                    licenseNumber: data.licenseNumber,
                    licenseType: data.licenseType,
                    licenseExpiry: data.licenseExpiry,
                    licenseIssuedDate: data.licenseIssuedDate,
                    licenseIssuingAuthority: data.licenseIssuingAuthority,
                    permitNumber: data.permitNumber,
                    permitExpiry: data.permitExpiry,
                    permitType: data.permitType,
                    experience: data.experience,
                    joiningDate: data.joiningDate,
                    salary: data.salary,
                    status: data.status || 'ACTIVE',
                    employmentType: data.employmentType || 'FULL_TIME',
                    designation: data.designation || 'DRIVER',
                    department: data.department,
                    supervisor: data.supervisor,
                    emergencyContact: data.emergencyContact,
                    emergencyPhone: data.emergencyPhone,
                    emergencyRelationship: data.emergencyRelationship,
                    bloodGroup: data.bloodGroup,
                    medicalCertificate: data.medicalCertificate,
                    medicalExpiry: data.medicalExpiry,
                    trainingCertificates: data.trainingCertificates,
                    performanceRating: data.performanceRating,
                    safetyRecord: data.safetyRecord,
                    violations: data.violations,
                    accidents: data.accidents,
                    awards: data.awards,
                    documents: data.documents,
                    image: data.image,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    notes: data.notes,
                    schoolId: data.schoolId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    vehicles: true,
                    routes: true,
                    trips: true
                }
            });

            return {
                success: true,
                data: driver,
                message: 'Driver created successfully'
            };
        } catch (error) {
            console.error('Error creating driver:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create driver'
            };
        }
    }

    /**
     * Get driver by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                school: true,
                vehicles: {
                    include: {
                        trips: {
                            orderBy: { startTime: 'desc' },
                            take: 5
                        }
                    }
                },
                routes: {
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
                trips: {
                    orderBy: { startTime: 'desc' },
                    take: 10,
                    include: {
                        route: true,
                        vehicle: true,
                        attendance: true
                    }
                }
            } : {};

            const driver = await this.prisma.driver.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!driver) {
                return {
                    success: false,
                    error: 'Driver not found',
                    message: 'Driver not found'
                };
            }

            return {
                success: true,
                data: driver,
                message: 'Driver retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting driver:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve driver'
            };
        }
    }

    /**
     * Get all drivers with advanced filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                status,
                employmentType,
                licenseType,
                permitType,
                department,
                isActive,
                minExperience,
                maxExperience,
                minSalary,
                maxSalary,
                licenseExpiryFrom,
                licenseExpiryTo,
                medicalExpiryFrom,
                medicalExpiryTo,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Search functionality
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } },
                    { licenseNumber: { contains: search, mode: 'insensitive' } },
                    { permitNumber: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by employment type
            if (employmentType) {
                where.employmentType = employmentType;
            }

            // Filter by license type
            if (licenseType) {
                where.licenseType = licenseType;
            }

            // Filter by permit type
            if (permitType) {
                where.permitType = permitType;
            }

            // Filter by department
            if (department) {
                where.department = department;
            }

            // Filter by active status
            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            // Filter by experience range
            if (minExperience || maxExperience) {
                where.experience = {};
                if (minExperience) where.experience.gte = parseInt(minExperience);
                if (maxExperience) where.experience.lte = parseInt(maxExperience);
            }

            // Filter by salary range
            if (minSalary || maxSalary) {
                where.salary = {};
                if (minSalary) where.salary.gte = parseFloat(minSalary);
                if (maxSalary) where.salary.lte = parseFloat(maxSalary);
            }

            // Filter by license expiry range
            if (licenseExpiryFrom || licenseExpiryTo) {
                where.licenseExpiry = {};
                if (licenseExpiryFrom) where.licenseExpiry.gte = new Date(licenseExpiryFrom);
                if (licenseExpiryTo) where.licenseExpiry.lte = new Date(licenseExpiryTo);
            }

            // Filter by medical expiry range
            if (medicalExpiryFrom || medicalExpiryTo) {
                where.medicalExpiry = {};
                if (medicalExpiryFrom) where.medicalExpiry.gte = new Date(medicalExpiryFrom);
                if (medicalExpiryTo) where.medicalExpiry.lte = new Date(medicalExpiryTo);
            }

            const skip = (page - 1) * limit;

            const [drivers, total] = await Promise.all([
                this.prisma.driver.findMany({
                    where,
                    include: {
                        school: true,
                        vehicles: {
                            select: {
                                id: true,
                                name: true,
                                type: true,
                                status: true
                            }
                        },
                        routes: {
                            select: {
                                id: true,
                                name: true,
                                status: true
                            }
                        },
                        _count: {
                            select: {
                                vehicles: true,
                                routes: true,
                                trips: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.driver.count({ where })
            ]);

            return {
                success: true,
                data: {
                    drivers,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Drivers retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting drivers:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve drivers'
            };
        }
    }

    /**
     * Update driver
     */
    async update(id, data) {
        try {
            const driver = await this.prisma.driver.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    vehicles: true,
                    routes: true
                }
            });

            return {
                success: true,
                data: driver,
                message: 'Driver updated successfully'
            };
        } catch (error) {
            console.error('Error updating driver:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update driver'
            };
        }
    }

    /**
     * Delete driver (soft delete)
     */
    async delete(id) {
        try {
            const driver = await this.prisma.driver.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: driver,
                message: 'Driver deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting driver:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete driver'
            };
        }
    }

    /**
     * Get drivers with expiring licenses
     */
    async getExpiringLicenses(days = 30) {
        try {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + days);

            const drivers = await this.prisma.driver.findMany({
                where: {
                    licenseExpiry: {
                        lte: expiryDate,
                        gte: new Date()
                    },
                    isActive: true
                },
                include: {
                    vehicles: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    },
                    routes: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: { licenseExpiry: 'asc' }
            });

            return {
                success: true,
                data: drivers,
                message: 'Drivers with expiring licenses retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting expiring licenses:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve expiring licenses'
            };
        }
    }

    /**
     * Get drivers with expiring medical certificates
     */
    async getExpiringMedicalCertificates(days = 30) {
        try {
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + days);

            const drivers = await this.prisma.driver.findMany({
                where: {
                    medicalExpiry: {
                        lte: expiryDate,
                        gte: new Date()
                    },
                    isActive: true
                },
                include: {
                    vehicles: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    }
                },
                orderBy: { medicalExpiry: 'asc' }
            });

            return {
                success: true,
                data: drivers,
                message: 'Drivers with expiring medical certificates retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting expiring medical certificates:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve expiring medical certificates'
            };
        }
    }

    /**
     * Get available drivers
     */
    async getAvailableDrivers(filters = {}) {
        try {
            const {
                licenseType,
                permitType,
                minExperience
            } = filters;

            const where = {
                status: 'ACTIVE',
                isActive: true
            };

            if (licenseType) where.licenseType = licenseType;
            if (permitType) where.permitType = permitType;
            if (minExperience) where.experience = { gte: parseInt(minExperience) };

            const drivers = await this.prisma.driver.findMany({
                where,
                include: {
                    vehicles: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            status: true
                        }
                    },
                    routes: {
                        select: {
                            id: true,
                            name: true,
                            status: true
                        }
                    }
                },
                orderBy: { name: 'asc' }
            });

            return {
                success: true,
                data: drivers,
                message: 'Available drivers retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting available drivers:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve available drivers'
            };
        }
    }

    /**
     * Get driver performance analytics
     */
    async getPerformanceAnalytics(driverId, filters = {}) {
        try {
            const {
                startDate,
                endDate,
                groupBy = 'month'
            } = filters;

            const where = { driverId: parseInt(driverId) };
            if (startDate && endDate) {
                where.startTime = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }

            // Get trips data
            const trips = await this.prisma.transportTrip.findMany({
                where,
                include: {
                    route: true,
                    vehicle: true,
                    attendance: true
                },
                orderBy: { startTime: 'desc' }
            });

            // Calculate performance metrics
            const totalTrips = trips.length;
            const completedTrips = trips.filter(trip => trip.status === 'COMPLETED').length;
            const onTimeTrips = trips.filter(trip => trip.status === 'COMPLETED' && !trip.delay).length;
            const totalDistance = trips.reduce((sum, trip) => sum + (trip.distance || 0), 0);
            const totalDuration = trips.reduce((sum, trip) => sum + (trip.duration || 0), 0);

            // Calculate attendance metrics
            const totalStudents = trips.reduce((sum, trip) => {
                return sum + (trip.attendance?.length || 0);
            }, 0);

            const presentStudents = trips.reduce((sum, trip) => {
                return sum + (trip.attendance?.filter(att => att.status === 'PRESENT').length || 0);
            }, 0);

            const attendanceRate = totalStudents > 0 ? (presentStudents / totalStudents) * 100 : 0;

            // Performance rating calculation
            const performanceRating = totalTrips > 0 ? 
                ((completedTrips / totalTrips) * 0.4 + (onTimeTrips / totalTrips) * 0.3 + (attendanceRate / 100) * 0.3) * 5 : 0;

            return {
                success: true,
                data: {
                    totalTrips,
                    completedTrips,
                    onTimeTrips,
                    completionRate: totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0,
                    onTimeRate: totalTrips > 0 ? (onTimeTrips / totalTrips) * 100 : 0,
                    totalDistance,
                    totalDuration,
                    averageDistance: totalTrips > 0 ? totalDistance / totalTrips : 0,
                    averageDuration: totalTrips > 0 ? totalDuration / totalTrips : 0,
                    totalStudents,
                    presentStudents,
                    attendanceRate,
                    performanceRating: Math.round(performanceRating * 10) / 10,
                    trips
                },
                message: 'Performance analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting performance analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve performance analytics'
            };
        }
    }

    /**
     * Get driver schedule
     */
    async getDriverSchedule(driverId, date = new Date()) {
        try {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const trips = await this.prisma.transportTrip.findMany({
                where: {
                    driverId: parseInt(driverId),
                    startTime: {
                        gte: startOfDay,
                        lte: endOfDay
                    }
                },
                include: {
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
                    vehicle: true,
                    attendance: true
                },
                orderBy: { startTime: 'asc' }
            });

            return {
                success: true,
                data: trips,
                message: 'Driver schedule retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting driver schedule:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve driver schedule'
            };
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(driverIds, updateData) {
        try {
            const result = await this.prisma.driver.updateMany({
                where: {
                    id: { in: driverIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} drivers`
            };
        } catch (error) {
            console.error('Error bulk updating drivers:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update drivers'
            };
        }
    }
}

export default Driver; 
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class Hostel {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new hostel
     */
    async create(data) {
        try {
            const hostel = await this.prisma.hostel.create({
                data: {
                    name: data.name,
                    code: data.code,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    country: data.country,
                    postalCode: data.postalCode,
                    phone: data.phone,
                    email: data.email,
                    website: data.website,
                    description: data.description,
                    type: data.type || 'BOYS',
                    capacity: data.capacity,
                    occupiedCapacity: data.occupiedCapacity || 0,
                    availableCapacity: data.availableCapacity || data.capacity,
                    totalFloors: data.totalFloors,
                    totalRooms: data.totalRooms,
                    totalBeds: data.totalBeds,
                    occupiedBeds: data.occupiedBeds || 0,
                    availableBeds: data.availableBeds || data.totalBeds,
                    wardenName: data.wardenName,
                    wardenPhone: data.wardenPhone,
                    wardenEmail: data.wardenEmail,
                    assistantWardenName: data.assistantWardenName,
                    assistantWardenPhone: data.assistantWardenPhone,
                    assistantWardenEmail: data.assistantWardenEmail,
                    checkInTime: data.checkInTime,
                    checkOutTime: data.checkOutTime,
                    curfewTime: data.curfewTime,
                    mealPlan: data.mealPlan || 'THREE_MEALS',
                    wifiAvailable: data.wifiAvailable || false,
                    wifiPassword: data.wifiPassword,
                    laundryAvailable: data.laundryAvailable || false,
                    gymAvailable: data.gymAvailable || false,
                    libraryAvailable: data.libraryAvailable || false,
                    parkingAvailable: data.parkingAvailable || false,
                    securityAvailable: data.securityAvailable || true,
                    medicalFacility: data.medicalFacility || false,
                    transportAvailable: data.transportAvailable || false,
                    monthlyRent: data.monthlyRent,
                    securityDeposit: data.securityDeposit,
                    maintenanceFee: data.maintenanceFee || 0,
                    utilityFee: data.utilityFee || 0,
                    mealFee: data.mealFee || 0,
                    otherFees: data.otherFees || 0,
                    totalMonthlyFee: data.totalMonthlyFee,
                    paymentDueDate: data.paymentDueDate,
                    lateFeePercentage: data.lateFeePercentage || 5,
                    status: data.status || 'ACTIVE',
                    amenities: data.amenities,
                    rules: data.rules,
                    policies: data.policies,
                    images: data.images,
                    location: data.location,
                    coordinates: data.coordinates,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    notes: data.notes,
                    schoolId: data.schoolId,
                    createdBy: data.createdBy,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    creator: true,
                    floors: true,
                    rooms: true,
                    residents: true
                }
            });

            return {
                success: true,
                data: hostel,
                message: 'Hostel created successfully'
            };
        } catch (error) {
            console.error('Error creating hostel:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create hostel'
            };
        }
    }

    /**
     * Get hostel by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                school: true,
                creator: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                floors: {
                    include: {
                        rooms: {
                            include: {
                                residents: {
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
                rooms: {
                    include: {
                        floor: true,
                        residents: {
                            select: {
                                id: true,
                                name: true,
                                grade: true,
                                section: true
                            }
                        }
                    }
                },
                residents: {
                    select: {
                        id: true,
                        name: true,
                        grade: true,
                        section: true,
                        checkInDate: true,
                        checkOutDate: true,
                        status: true
                    }
                }
            } : {};

            const hostel = await this.prisma.hostel.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!hostel) {
                return {
                    success: false,
                    error: 'Hostel not found',
                    message: 'Hostel not found'
                };
            }

            return {
                success: true,
                data: hostel,
                message: 'Hostel retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting hostel:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve hostel'
            };
        }
    }

    /**
     * Get all hostels with advanced filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                type,
                status,
                city,
                state,
                country,
                mealPlan,
                wifiAvailable,
                laundryAvailable,
                gymAvailable,
                libraryAvailable,
                parkingAvailable,
                securityAvailable,
                medicalFacility,
                transportAvailable,
                minCapacity,
                maxCapacity,
                minRent,
                maxRent,
                isActive,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Search functionality
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { code: { contains: search, mode: 'insensitive' } },
                    { address: { contains: search, mode: 'insensitive' } },
                    { city: { contains: search, mode: 'insensitive' } },
                    { wardenName: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Filter by type
            if (type) {
                where.type = type;
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by location
            if (city) where.city = city;
            if (state) where.state = state;
            if (country) where.country = country;

            // Filter by meal plan
            if (mealPlan) {
                where.mealPlan = mealPlan;
            }

            // Filter by amenities
            if (wifiAvailable !== undefined) where.wifiAvailable = wifiAvailable;
            if (laundryAvailable !== undefined) where.laundryAvailable = laundryAvailable;
            if (gymAvailable !== undefined) where.gymAvailable = gymAvailable;
            if (libraryAvailable !== undefined) where.libraryAvailable = libraryAvailable;
            if (parkingAvailable !== undefined) where.parkingAvailable = parkingAvailable;
            if (securityAvailable !== undefined) where.securityAvailable = securityAvailable;
            if (medicalFacility !== undefined) where.medicalFacility = medicalFacility;
            if (transportAvailable !== undefined) where.transportAvailable = transportAvailable;

            // Filter by capacity range
            if (minCapacity || maxCapacity) {
                where.capacity = {};
                if (minCapacity) where.capacity.gte = parseInt(minCapacity);
                if (maxCapacity) where.capacity.lte = parseInt(maxCapacity);
            }

            // Filter by rent range
            if (minRent || maxRent) {
                where.monthlyRent = {};
                if (minRent) where.monthlyRent.gte = parseFloat(minRent);
                if (maxRent) where.monthlyRent.lte = parseFloat(maxRent);
            }

            // Filter by active status
            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            const skip = (page - 1) * limit;

            const [hostels, total] = await Promise.all([
                this.prisma.hostel.findMany({
                    where,
                    include: {
                        school: true,
                        creator: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        _count: {
                            select: {
                                floors: true,
                                rooms: true,
                                residents: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostel.count({ where })
            ]);

            return {
                success: true,
                data: {
                    hostels,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Hostels retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting hostels:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve hostels'
            };
        }
    }

    /**
     * Update hostel
     */
    async update(id, data) {
        try {
            const hostel = await this.prisma.hostel.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    creator: true
                }
            });

            return {
                success: true,
                data: hostel,
                message: 'Hostel updated successfully'
            };
        } catch (error) {
            console.error('Error updating hostel:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update hostel'
            };
        }
    }

    /**
     * Delete hostel (soft delete)
     */
    async delete(id) {
        try {
            const hostel = await this.prisma.hostel.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: hostel,
                message: 'Hostel deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting hostel:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete hostel'
            };
        }
    }

    /**
     * Get hostel analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                type,
                city,
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
            if (city) where.city = city;

            // Hostel count by type
            const typeCounts = await this.prisma.hostel.groupBy({
                by: ['type'],
                where,
                _count: { type: true },
                _sum: { capacity: true, occupiedCapacity: true }
            });

            // Hostel count by city
            const cityCounts = await this.prisma.hostel.groupBy({
                by: ['city'],
                where,
                _count: { city: true }
            });

            // Hostel count by status
            const statusCounts = await this.prisma.hostel.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Total statistics
            const totalStats = await this.prisma.hostel.aggregate({
                where,
                _count: true,
                _sum: { 
                    capacity: true, 
                    occupiedCapacity: true, 
                    availableCapacity: true,
                    totalBeds: true,
                    occupiedBeds: true,
                    availableBeds: true,
                    monthlyRent: true
                },
                _avg: { monthlyRent: true }
            });

            // Hostels added over time
            const timeSeriesData = await this.prisma.hostel.groupBy({
                by: [groupBy === 'month' ? 'createdAt' : 'createdAt'],
                where,
                _count: true
            });

            // Most occupied hostels
            const mostOccupiedHostels = await this.prisma.hostel.findMany({
                where,
                orderBy: { occupiedCapacity: 'desc' },
                take: 10,
                select: {
                    id: true,
                    name: true,
                    type: true,
                    capacity: true,
                    occupiedCapacity: true,
                    availableCapacity: true,
                    monthlyRent: true
                }
            });

            // Occupancy rate by hostel
            const occupancyRates = await this.prisma.hostel.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    capacity: true,
                    occupiedCapacity: true,
                    availableCapacity: true
                }
            });

            const occupancyWithRates = occupancyRates.map(hostel => ({
                ...hostel,
                occupancyRate: hostel.capacity > 0 ? (hostel.occupiedCapacity / hostel.capacity) * 100 : 0
            }));

            return {
                success: true,
                data: {
                    typeCounts,
                    cityCounts,
                    statusCounts,
                    totalHostels: totalStats._count || 0,
                    totalCapacity: totalStats._sum.capacity || 0,
                    totalOccupiedCapacity: totalStats._sum.occupiedCapacity || 0,
                    totalAvailableCapacity: totalStats._sum.availableCapacity || 0,
                    totalBeds: totalStats._sum.totalBeds || 0,
                    totalOccupiedBeds: totalStats._sum.occupiedBeds || 0,
                    totalAvailableBeds: totalStats._sum.availableBeds || 0,
                    averageRent: totalStats._avg.monthlyRent || 0,
                    timeSeriesData,
                    mostOccupiedHostels,
                    occupancyRates: occupancyWithRates
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting hostel analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Search hostels
     */
    async searchHostels(query, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                type,
                city,
                status,
                available,
                sortBy = 'relevance',
                sortOrder = 'desc'
            } = filters;

            const where = {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { code: { contains: query, mode: 'insensitive' } },
                    { address: { contains: query, mode: 'insensitive' } },
                    { city: { contains: query, mode: 'insensitive' } },
                    { wardenName: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } }
                ]
            };

            if (type) where.type = type;
            if (city) where.city = city;
            if (status) where.status = status;
            if (available !== undefined) {
                if (available) {
                    where.availableCapacity = { gt: 0 };
                } else {
                    where.availableCapacity = 0;
                }
            }

            const skip = (page - 1) * limit;

            const [hostels, total] = await Promise.all([
                this.prisma.hostel.findMany({
                    where,
                    include: {
                        _count: {
                            select: {
                                floors: true,
                                rooms: true,
                                residents: true
                            }
                        }
                    },
                    orderBy: sortBy === 'relevance' ? { occupiedCapacity: 'desc' } : { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostel.count({ where })
            ]);

            return {
                success: true,
                data: {
                    hostels,
                    query,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Search completed successfully'
            };
        } catch (error) {
            console.error('Error searching hostels:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to search hostels'
            };
        }
    }

    /**
     * Get available hostels
     */
    async getAvailableHostels(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                type,
                city,
                minCapacity,
                maxRent,
                amenities
            } = filters;

            const where = {
                isActive: true,
                status: 'ACTIVE',
                availableCapacity: { gt: 0 }
            };

            if (type) where.type = type;
            if (city) where.city = city;
            if (minCapacity) where.capacity = { gte: parseInt(minCapacity) };
            if (maxRent) where.monthlyRent = { lte: parseFloat(maxRent) };

            // Filter by amenities
            if (amenities) {
                if (amenities.wifi) where.wifiAvailable = true;
                if (amenities.laundry) where.laundryAvailable = true;
                if (amenities.gym) where.gymAvailable = true;
                if (amenities.library) where.libraryAvailable = true;
                if (amenities.parking) where.parkingAvailable = true;
                if (amenities.medical) where.medicalFacility = true;
                if (amenities.transport) where.transportAvailable = true;
            }

            const skip = (page - 1) * limit;

            const [hostels, total] = await Promise.all([
                this.prisma.hostel.findMany({
                    where,
                    include: {
                        _count: {
                            select: {
                                floors: true,
                                rooms: true,
                                residents: true
                            }
                        }
                    },
                    orderBy: { availableCapacity: 'desc' },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostel.count({ where })
            ]);

            return {
                success: true,
                data: {
                    hostels,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Available hostels retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting available hostels:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve available hostels'
            };
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(hostelIds, updateData) {
        try {
            const result = await this.prisma.hostel.updateMany({
                where: {
                    id: { in: hostelIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} hostels`
            };
        } catch (error) {
            console.error('Error bulk updating hostels:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update hostels'
            };
        }
    }

    /**
     * Import hostels from file
     */
    async importFromFile(fileData, schoolId, createdBy) {
        try {
            const hostelData = fileData.map(item => ({
                ...item,
                schoolId: parseInt(schoolId),
                createdBy: parseInt(createdBy),
                capacity: item.capacity ? parseInt(item.capacity) : 0,
                occupiedCapacity: item.occupiedCapacity ? parseInt(item.occupiedCapacity) : 0,
                availableCapacity: item.availableCapacity ? parseInt(item.availableCapacity) : (item.capacity || 0),
                totalFloors: item.totalFloors ? parseInt(item.totalFloors) : 1,
                totalRooms: item.totalRooms ? parseInt(item.totalRooms) : 0,
                totalBeds: item.totalBeds ? parseInt(item.totalBeds) : 0,
                occupiedBeds: item.occupiedBeds ? parseInt(item.occupiedBeds) : 0,
                availableBeds: item.availableBeds ? parseInt(item.availableBeds) : (item.totalBeds || 0),
                monthlyRent: item.monthlyRent ? parseFloat(item.monthlyRent) : 0,
                securityDeposit: item.securityDeposit ? parseFloat(item.securityDeposit) : 0,
                maintenanceFee: item.maintenanceFee ? parseFloat(item.maintenanceFee) : 0,
                utilityFee: item.utilityFee ? parseFloat(item.utilityFee) : 0,
                mealFee: item.mealFee ? parseFloat(item.mealFee) : 0,
                otherFees: item.otherFees ? parseFloat(item.otherFees) : 0,
                totalMonthlyFee: item.totalMonthlyFee ? parseFloat(item.totalMonthlyFee) : 0,
                lateFeePercentage: item.lateFeePercentage ? parseFloat(item.lateFeePercentage) : 5,
                wifiAvailable: item.wifiAvailable === 'true' || item.wifiAvailable === true,
                laundryAvailable: item.laundryAvailable === 'true' || item.laundryAvailable === true,
                gymAvailable: item.gymAvailable === 'true' || item.gymAvailable === true,
                libraryAvailable: item.libraryAvailable === 'true' || item.libraryAvailable === true,
                parkingAvailable: item.parkingAvailable === 'true' || item.parkingAvailable === true,
                securityAvailable: item.securityAvailable !== 'false' && item.securityAvailable !== false,
                medicalFacility: item.medicalFacility === 'true' || item.medicalFacility === true,
                transportAvailable: item.transportAvailable === 'true' || item.transportAvailable === true,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            const result = await this.prisma.hostel.createMany({
                data: hostelData,
                skipDuplicates: true
            });

            return {
                success: true,
                data: result,
                message: `Imported ${result.count} hostels`
            };
        } catch (error) {
            console.error('Error importing hostels:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to import hostels'
            };
        }
    }

    /**
     * Export hostel data
     */
    async exportData(filters = {}) {
        try {
            const hostels = await this.getAll(filters, { page: 1, limit: 10000 });
            
            if (!hostels.success) {
                return hostels;
            }

            const exportData = hostels.data.hostels.map(item => ({
                id: item.id,
                name: item.name,
                code: item.code,
                address: item.address,
                city: item.city,
                state: item.state,
                country: item.country,
                postalCode: item.postalCode,
                phone: item.phone,
                email: item.email,
                type: item.type,
                capacity: item.capacity,
                occupiedCapacity: item.occupiedCapacity,
                availableCapacity: item.availableCapacity,
                totalFloors: item.totalFloors,
                totalRooms: item.totalRooms,
                totalBeds: item.totalBeds,
                occupiedBeds: item.occupiedBeds,
                availableBeds: item.availableBeds,
                wardenName: item.wardenName,
                wardenPhone: item.wardenPhone,
                wardenEmail: item.wardenEmail,
                mealPlan: item.mealPlan,
                monthlyRent: item.monthlyRent,
                securityDeposit: item.securityDeposit,
                totalMonthlyFee: item.totalMonthlyFee,
                status: item.status,
                createdAt: item.createdAt
            }));

            return {
                success: true,
                data: exportData,
                message: 'Hostel data exported successfully'
            };
        } catch (error) {
            console.error('Error exporting hostel data:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to export hostel data'
            };
        }
    }
}

export default Hostel;
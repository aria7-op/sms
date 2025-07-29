import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class HostelFloor {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new hostel floor
     */
    async create(data) {
        try {
            const floor = await this.prisma.hostelFloor.create({
                data: {
                    floorNumber: data.floorNumber,
                    name: data.name,
                    hostelId: data.hostelId,
                    description: data.description,
                    totalRooms: data.totalRooms || 0,
                    occupiedRooms: data.occupiedRooms || 0,
                    availableRooms: data.availableRooms || data.totalRooms || 0,
                    totalBeds: data.totalBeds || 0,
                    occupiedBeds: data.occupiedBeds || 0,
                    availableBeds: data.availableBeds || data.totalBeds || 0,
                    capacity: data.capacity || 0,
                    occupiedCapacity: data.occupiedCapacity || 0,
                    availableCapacity: data.availableCapacity || data.capacity || 0,
                    hasElevator: data.hasElevator || false,
                    hasStairs: data.hasStairs || true,
                    hasFireExit: data.hasFireExit || true,
                    hasSecurityCamera: data.hasSecurityCamera || false,
                    hasCommonBathroom: data.hasCommonBathroom || false,
                    hasCommonKitchen: data.hasCommonKitchen || false,
                    hasCommonLounge: data.hasCommonLounge || false,
                    hasStudyRoom: data.hasStudyRoom || false,
                    hasLaundryRoom: data.hasLaundryRoom || false,
                    hasStorageRoom: data.hasStorageRoom || false,
                    hasVendingMachine: data.hasVendingMachine || false,
                    hasWaterCooler: data.hasWaterCooler || true,
                    hasFirstAidKit: data.hasFirstAidKit || true,
                    hasFireExtinguisher: data.hasFireExtinguisher || true,
                    floorPlan: data.floorPlan,
                    images: data.images,
                    status: data.status || 'ACTIVE',
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    notes: data.notes,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    hostel: true,
                    rooms: true,
                    residents: true
                }
            });

            return {
                success: true,
                data: floor,
                message: 'Hostel floor created successfully'
            };
        } catch (error) {
            console.error('Error creating hostel floor:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create hostel floor'
            };
        }
    }

    /**
     * Get floor by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                hostel: true,
                rooms: {
                    include: {
                        residents: {
                            select: {
                                id: true,
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
                residents: {
                    select: {
                        id: true,
                        student: {
                            select: {
                                id: true,
                                name: true,
                                grade: true,
                                section: true
                            }
                        },
                        checkInDate: true,
                        status: true
                    }
                }
            } : {};

            const floor = await this.prisma.hostelFloor.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!floor) {
                return {
                    success: false,
                    error: 'Floor not found',
                    message: 'Floor not found'
                };
            }

            return {
                success: true,
                data: floor,
                message: 'Floor retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting floor:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve floor'
            };
        }
    }

    /**
     * Get all floors with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                hostelId,
                floorNumber,
                status,
                hasElevator,
                hasCommonBathroom,
                hasCommonKitchen,
                hasStudyRoom,
                minRooms,
                maxRooms,
                minCapacity,
                maxCapacity,
                isActive,
                sortBy = 'floorNumber',
                sortOrder = 'asc'
            } = filters;

            const where = {};

            // Filter by hostel
            if (hostelId) {
                where.hostelId = parseInt(hostelId);
            }

            // Filter by floor number
            if (floorNumber) {
                where.floorNumber = parseInt(floorNumber);
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by amenities
            if (hasElevator !== undefined) where.hasElevator = hasElevator;
            if (hasCommonBathroom !== undefined) where.hasCommonBathroom = hasCommonBathroom;
            if (hasCommonKitchen !== undefined) where.hasCommonKitchen = hasCommonKitchen;
            if (hasStudyRoom !== undefined) where.hasStudyRoom = hasStudyRoom;

            // Filter by room count range
            if (minRooms || maxRooms) {
                where.totalRooms = {};
                if (minRooms) where.totalRooms.gte = parseInt(minRooms);
                if (maxRooms) where.totalRooms.lte = parseInt(maxRooms);
            }

            // Filter by capacity range
            if (minCapacity || maxCapacity) {
                where.capacity = {};
                if (minCapacity) where.capacity.gte = parseInt(minCapacity);
                if (maxCapacity) where.capacity.lte = parseInt(maxCapacity);
            }

            // Filter by active status
            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            const skip = (page - 1) * limit;

            const [floors, total] = await Promise.all([
                this.prisma.hostelFloor.findMany({
                    where,
                    include: {
                        hostel: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        },
                        _count: {
                            select: {
                                rooms: true,
                                residents: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostelFloor.count({ where })
            ]);

            return {
                success: true,
                data: {
                    floors,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Floors retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting floors:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve floors'
            };
        }
    }

    /**
     * Update floor
     */
    async update(id, data) {
        try {
            const floor = await this.prisma.hostelFloor.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    hostel: true
                }
            });

            return {
                success: true,
                data: floor,
                message: 'Floor updated successfully'
            };
        } catch (error) {
            console.error('Error updating floor:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update floor'
            };
        }
    }

    /**
     * Delete floor (soft delete)
     */
    async delete(id) {
        try {
            const floor = await this.prisma.hostelFloor.findUnique({
                where: { id: parseInt(id) },
                include: {
                    rooms: {
                        where: { isActive: true }
                    }
                }
            });

            if (!floor) {
                return {
                    success: false,
                    error: 'Floor not found',
                    message: 'Floor not found'
                };
            }

            if (floor.rooms.length > 0) {
                return {
                    success: false,
                    error: 'Floor has active rooms',
                    message: 'Cannot delete floor that has active rooms'
                };
            }

            const deletedFloor = await this.prisma.hostelFloor.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: deletedFloor,
                message: 'Floor deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting floor:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete floor'
            };
        }
    }

    /**
     * Get floor analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                hostelId,
                startDate,
                endDate,
                groupBy = 'month'
            } = filters;

            const where = {};
            if (hostelId) where.hostelId = parseInt(hostelId);
            if (startDate && endDate) {
                where.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }

            // Floor count by amenities
            const amenityCounts = {
                hasElevator: await this.prisma.hostelFloor.count({ where: { ...where, hasElevator: true } }),
                hasCommonBathroom: await this.prisma.hostelFloor.count({ where: { ...where, hasCommonBathroom: true } }),
                hasCommonKitchen: await this.prisma.hostelFloor.count({ where: { ...where, hasCommonKitchen: true } }),
                hasStudyRoom: await this.prisma.hostelFloor.count({ where: { ...where, hasStudyRoom: true } }),
                hasLaundryRoom: await this.prisma.hostelFloor.count({ where: { ...where, hasLaundryRoom: true } })
            };

            // Floor count by status
            const statusCounts = await this.prisma.hostelFloor.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Total statistics
            const totalStats = await this.prisma.hostelFloor.aggregate({
                where,
                _count: true,
                _sum: { 
                    totalRooms: true,
                    occupiedRooms: true,
                    availableRooms: true,
                    totalBeds: true,
                    occupiedBeds: true,
                    availableBeds: true,
                    capacity: true,
                    occupiedCapacity: true,
                    availableCapacity: true
                }
            });

            // Floors added over time
            const timeSeriesData = await this.prisma.hostelFloor.groupBy({
                by: [groupBy === 'month' ? 'createdAt' : 'createdAt'],
                where,
                _count: true
            });

            // Most occupied floors
            const mostOccupiedFloors = await this.prisma.hostelFloor.findMany({
                where,
                orderBy: { occupiedCapacity: 'desc' },
                take: 10,
                include: {
                    hostel: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                select: {
                    id: true,
                    floorNumber: true,
                    name: true,
                    capacity: true,
                    occupiedCapacity: true,
                    availableCapacity: true,
                    totalRooms: true,
                    occupiedRooms: true
                }
            });

            // Occupancy rate by floor
            const occupancyRates = await this.prisma.hostelFloor.findMany({
                where,
                select: {
                    id: true,
                    floorNumber: true,
                    name: true,
                    capacity: true,
                    occupiedCapacity: true,
                    availableCapacity: true
                }
            });

            const occupancyWithRates = occupancyRates.map(floor => ({
                ...floor,
                occupancyRate: floor.capacity > 0 ? (floor.occupiedCapacity / floor.capacity) * 100 : 0
            }));

            return {
                success: true,
                data: {
                    amenityCounts,
                    statusCounts,
                    totalFloors: totalStats._count || 0,
                    totalRooms: totalStats._sum.totalRooms || 0,
                    totalOccupiedRooms: totalStats._sum.occupiedRooms || 0,
                    totalAvailableRooms: totalStats._sum.availableRooms || 0,
                    totalBeds: totalStats._sum.totalBeds || 0,
                    totalOccupiedBeds: totalStats._sum.occupiedBeds || 0,
                    totalAvailableBeds: totalStats._sum.availableBeds || 0,
                    totalCapacity: totalStats._sum.capacity || 0,
                    totalOccupiedCapacity: totalStats._sum.occupiedCapacity || 0,
                    totalAvailableCapacity: totalStats._sum.availableCapacity || 0,
                    timeSeriesData,
                    mostOccupiedFloors,
                    occupancyRates: occupancyWithRates
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting floor analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Search floors
     */
    async searchFloors(query, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                hostelId,
                status,
                sortBy = 'relevance',
                sortOrder = 'desc'
            } = filters;

            const where = {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { notes: { contains: query, mode: 'insensitive' } }
                ]
            };

            if (hostelId) where.hostelId = parseInt(hostelId);
            if (status) where.status = status;

            const skip = (page - 1) * limit;

            const [floors, total] = await Promise.all([
                this.prisma.hostelFloor.findMany({
                    where,
                    include: {
                        hostel: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        },
                        _count: {
                            select: {
                                rooms: true,
                                residents: true
                            }
                        }
                    },
                    orderBy: sortBy === 'relevance' ? { occupiedCapacity: 'desc' } : { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostelFloor.count({ where })
            ]);

            return {
                success: true,
                data: {
                    floors,
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
            console.error('Error searching floors:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to search floors'
            };
        }
    }

    /**
     * Get floor by number
     */
    async getByFloorNumber(hostelId, floorNumber) {
        try {
            const floor = await this.prisma.hostelFloor.findFirst({
                where: {
                    hostelId: parseInt(hostelId),
                    floorNumber: parseInt(floorNumber),
                    isActive: true
                },
                include: {
                    hostel: true,
                    rooms: {
                        include: {
                            residents: {
                                select: {
                                    id: true,
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
                    }
                }
            });

            if (!floor) {
                return {
                    success: false,
                    error: 'Floor not found',
                    message: 'Floor not found'
                };
            }

            return {
                success: true,
                data: floor,
                message: 'Floor retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting floor by number:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve floor'
            };
        }
    }

    /**
     * Update floor capacity
     */
    async updateFloorCapacity(floorId) {
        try {
            const rooms = await this.prisma.hostelRoom.findMany({
                where: { 
                    floorId: parseInt(floorId),
                    isActive: true
                },
                select: {
                    capacity: true,
                    occupiedCapacity: true,
                    availableCapacity: true,
                    totalBeds: true,
                    occupiedBeds: true,
                    availableBeds: true
                }
            });

            const totalRooms = rooms.length;
            const occupiedRooms = rooms.filter(room => room.occupiedCapacity > 0).length;
            const availableRooms = totalRooms - occupiedRooms;
            const totalBeds = rooms.reduce((sum, room) => sum + room.totalBeds, 0);
            const occupiedBeds = rooms.reduce((sum, room) => sum + room.occupiedBeds, 0);
            const availableBeds = rooms.reduce((sum, room) => sum + room.availableBeds, 0);
            const capacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
            const occupiedCapacity = rooms.reduce((sum, room) => sum + room.occupiedCapacity, 0);
            const availableCapacity = rooms.reduce((sum, room) => sum + room.availableCapacity, 0);

            await this.prisma.hostelFloor.update({
                where: { id: parseInt(floorId) },
                data: {
                    totalRooms: totalRooms,
                    occupiedRooms: occupiedRooms,
                    availableRooms: availableRooms,
                    totalBeds: totalBeds,
                    occupiedBeds: occupiedBeds,
                    availableBeds: availableBeds,
                    capacity: capacity,
                    occupiedCapacity: occupiedCapacity,
                    availableCapacity: availableCapacity,
                    updatedAt: new Date()
                }
            });
        } catch (error) {
            console.error('Error updating floor capacity:', error);
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(floorIds, updateData) {
        try {
            const result = await this.prisma.hostelFloor.updateMany({
                where: {
                    id: { in: floorIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} floors`
            };
        } catch (error) {
            console.error('Error bulk updating floors:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update floors'
            };
        }
    }
}

export default HostelFloor;
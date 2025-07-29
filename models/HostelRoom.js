import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class HostelRoom {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new hostel room
     */
    async create(data) {
        try {
            const room = await this.prisma.hostelRoom.create({
                data: {
                    roomNumber: data.roomNumber,
                    floorNumber: data.floorNumber,
                    hostelId: data.hostelId,
                    type: data.type || 'SINGLE',
                    capacity: data.capacity || 1,
                    occupiedCapacity: data.occupiedCapacity || 0,
                    availableCapacity: data.availableCapacity || data.capacity || 1,
                    totalBeds: data.totalBeds || 1,
                    occupiedBeds: data.occupiedBeds || 0,
                    availableBeds: data.availableBeds || data.totalBeds || 1,
                    roomSize: data.roomSize,
                    roomArea: data.roomArea,
                    hasAttachedBathroom: data.hasAttachedBathroom || false,
                    hasBalcony: data.hasBalcony || false,
                    hasAC: data.hasAC || false,
                    hasHeater: data.hasHeater || false,
                    hasWifi: data.hasWifi || false,
                    hasTV: data.hasTV || false,
                    hasRefrigerator: data.hasRefrigerator || false,
                    hasWardrobe: data.hasWardrobe || true,
                    hasStudyTable: data.hasStudyTable || true,
                    hasChair: data.hasChair || true,
                    hasBed: data.hasBed || true,
                    hasFan: data.hasFan || true,
                    hasLight: data.hasLight || true,
                    hasCurtains: data.hasCurtains || true,
                    hasCarpet: data.hasCarpet || false,
                    hasMirror: data.hasMirror || false,
                    hasShoeRack: data.hasShoeRack || false,
                    hasLaundryBasket: data.hasLaundryBasket || false,
                    roomCondition: data.roomCondition || 'GOOD',
                    maintenanceStatus: data.maintenanceStatus || 'NONE',
                    lastMaintenanceDate: data.lastMaintenanceDate,
                    nextMaintenanceDate: data.nextMaintenanceDate,
                    monthlyRent: data.monthlyRent,
                    securityDeposit: data.securityDeposit,
                    maintenanceFee: data.maintenanceFee || 0,
                    utilityFee: data.utilityFee || 0,
                    otherFees: data.otherFees || 0,
                    totalMonthlyFee: data.totalMonthlyFee,
                    status: data.status || 'AVAILABLE',
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    notes: data.notes,
                    images: data.images,
                    floorPlan: data.floorPlan,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    hostel: true,
                    floor: true,
                    residents: true,
                    maintenanceRecords: true
                }
            });

            // Update hostel capacity
            await this.updateHostelCapacity(data.hostelId);

            return {
                success: true,
                data: room,
                message: 'Hostel room created successfully'
            };
        } catch (error) {
            console.error('Error creating hostel room:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create hostel room'
            };
        }
    }

    /**
     * Get room by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                hostel: true,
                floor: true,
                residents: {
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                grade: true,
                                section: true,
                                profileImage: true
                            }
                        }
                    }
                },
                maintenanceRecords: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                }
            } : {};

            const room = await this.prisma.hostelRoom.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!room) {
                return {
                    success: false,
                    error: 'Room not found',
                    message: 'Room not found'
                };
            }

            return {
                success: true,
                data: room,
                message: 'Room retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting room:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve room'
            };
        }
    }

    /**
     * Get all rooms with advanced filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                hostelId,
                floorNumber,
                type,
                status,
                roomCondition,
                maintenanceStatus,
                hasAttachedBathroom,
                hasAC,
                hasWifi,
                hasBalcony,
                minCapacity,
                maxCapacity,
                minRent,
                maxRent,
                available,
                isActive,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Filter by hostel
            if (hostelId) {
                where.hostelId = parseInt(hostelId);
            }

            // Filter by floor
            if (floorNumber) {
                where.floorNumber = parseInt(floorNumber);
            }

            // Filter by type
            if (type) {
                where.type = type;
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by room condition
            if (roomCondition) {
                where.roomCondition = roomCondition;
            }

            // Filter by maintenance status
            if (maintenanceStatus) {
                where.maintenanceStatus = maintenanceStatus;
            }

            // Filter by amenities
            if (hasAttachedBathroom !== undefined) where.hasAttachedBathroom = hasAttachedBathroom;
            if (hasAC !== undefined) where.hasAC = hasAC;
            if (hasWifi !== undefined) where.hasWifi = hasWifi;
            if (hasBalcony !== undefined) where.hasBalcony = hasBalcony;

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

            // Filter by availability
            if (available !== undefined) {
                if (available) {
                    where.availableCapacity = { gt: 0 };
                } else {
                    where.availableCapacity = 0;
                }
            }

            // Filter by active status
            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            const skip = (page - 1) * limit;

            const [rooms, total] = await Promise.all([
                this.prisma.hostelRoom.findMany({
                    where,
                    include: {
                        hostel: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        },
                        floor: {
                            select: {
                                id: true,
                                floorNumber: true,
                                name: true
                            }
                        },
                        _count: {
                            select: {
                                residents: true,
                                maintenanceRecords: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostelRoom.count({ where })
            ]);

            return {
                success: true,
                data: {
                    rooms,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Rooms retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting rooms:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve rooms'
            };
        }
    }

    /**
     * Update room
     */
    async update(id, data) {
        try {
            const room = await this.prisma.hostelRoom.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    hostel: true,
                    floor: true
                }
            });

            // Update hostel capacity if room capacity changed
            if (data.capacity || data.occupiedCapacity) {
                await this.updateHostelCapacity(room.hostelId);
            }

            return {
                success: true,
                data: room,
                message: 'Room updated successfully'
            };
        } catch (error) {
            console.error('Error updating room:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update room'
            };
        }
    }

    /**
     * Delete room (soft delete)
     */
    async delete(id) {
        try {
            const room = await this.prisma.hostelRoom.findUnique({
                where: { id: parseInt(id) },
                select: { hostelId: true, occupiedCapacity: true }
            });

            if (!room) {
                return {
                    success: false,
                    error: 'Room not found',
                    message: 'Room not found'
                };
            }

            if (room.occupiedCapacity > 0) {
                return {
                    success: false,
                    error: 'Room is occupied',
                    message: 'Cannot delete room that has residents'
                };
            }

            const deletedRoom = await this.prisma.hostelRoom.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            // Update hostel capacity
            await this.updateHostelCapacity(room.hostelId);

            return {
                success: true,
                data: deletedRoom,
                message: 'Room deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting room:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete room'
            };
        }
    }

    /**
     * Assign student to room
     */
    async assignStudent(roomId, studentId, assignmentData = {}) {
        try {
            const room = await this.prisma.hostelRoom.findUnique({
                where: { id: parseInt(roomId) }
            });

            if (!room) {
                return {
                    success: false,
                    error: 'Room not found',
                    message: 'Room not found'
                };
            }

            if (room.availableCapacity <= 0) {
                return {
                    success: false,
                    error: 'Room is full',
                    message: 'No available capacity in this room'
                };
            }

            if (room.status !== 'AVAILABLE') {
                return {
                    success: false,
                    error: 'Room not available',
                    message: `Room is currently ${room.status.toLowerCase()}`
                };
            }

            // Check if student is already assigned to a room
            const existingAssignment = await this.prisma.hostelResident.findFirst({
                where: {
                    studentId: parseInt(studentId),
                    status: 'ACTIVE'
                }
            });

            if (existingAssignment) {
                return {
                    success: false,
                    error: 'Student already assigned',
                    message: 'Student is already assigned to another room'
                };
            }

            const assignment = await this.prisma.hostelResident.create({
                data: {
                    roomId: parseInt(roomId),
                    studentId: parseInt(studentId),
                    hostelId: room.hostelId,
                    checkInDate: assignmentData.checkInDate || new Date(),
                    checkOutDate: assignmentData.checkOutDate,
                    status: 'ACTIVE',
                    bedNumber: assignmentData.bedNumber,
                    notes: assignmentData.notes,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    room: true,
                    student: true,
                    hostel: true
                }
            });

            // Update room capacity
            await this.prisma.hostelRoom.update({
                where: { id: parseInt(roomId) },
                data: {
                    occupiedCapacity: room.occupiedCapacity + 1,
                    availableCapacity: room.availableCapacity - 1,
                    occupiedBeds: room.occupiedBeds + 1,
                    availableBeds: room.availableBeds - 1,
                    status: room.availableCapacity - 1 === 0 ? 'FULL' : 'AVAILABLE',
                    updatedAt: new Date()
                }
            });

            // Update hostel capacity
            await this.updateHostelCapacity(room.hostelId);

            return {
                success: true,
                data: assignment,
                message: 'Student assigned to room successfully'
            };
        } catch (error) {
            console.error('Error assigning student to room:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to assign student to room'
            };
        }
    }

    /**
     * Remove student from room
     */
    async removeStudent(roomId, studentId, removalData = {}) {
        try {
            const assignment = await this.prisma.hostelResident.findFirst({
                where: {
                    roomId: parseInt(roomId),
                    studentId: parseInt(studentId),
                    status: 'ACTIVE'
                },
                include: { room: true }
            });

            if (!assignment) {
                return {
                    success: false,
                    error: 'Assignment not found',
                    message: 'Student is not assigned to this room'
                };
            }

            const updatedAssignment = await this.prisma.hostelResident.update({
                where: { id: assignment.id },
                data: {
                    checkOutDate: removalData.checkOutDate || new Date(),
                    status: 'INACTIVE',
                    notes: removalData.notes,
                    updatedAt: new Date()
                },
                include: {
                    room: true,
                    student: true,
                    hostel: true
                }
            });

            // Update room capacity
            await this.prisma.hostelRoom.update({
                where: { id: parseInt(roomId) },
                data: {
                    occupiedCapacity: assignment.room.occupiedCapacity - 1,
                    availableCapacity: assignment.room.availableCapacity + 1,
                    occupiedBeds: assignment.room.occupiedBeds - 1,
                    availableBeds: assignment.room.availableBeds + 1,
                    status: 'AVAILABLE',
                    updatedAt: new Date()
                }
            });

            // Update hostel capacity
            await this.updateHostelCapacity(assignment.room.hostelId);

            return {
                success: true,
                data: updatedAssignment,
                message: 'Student removed from room successfully'
            };
        } catch (error) {
            console.error('Error removing student from room:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to remove student from room'
            };
        }
    }

    /**
     * Get room analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                hostelId,
                floorNumber,
                startDate,
                endDate,
                groupBy = 'month'
            } = filters;

            const where = {};
            if (hostelId) where.hostelId = parseInt(hostelId);
            if (floorNumber) where.floorNumber = parseInt(floorNumber);
            if (startDate && endDate) {
                where.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }

            // Room count by type
            const typeCounts = await this.prisma.hostelRoom.groupBy({
                by: ['type'],
                where,
                _count: { type: true },
                _sum: { capacity: true, occupiedCapacity: true, availableCapacity: true }
            });

            // Room count by status
            const statusCounts = await this.prisma.hostelRoom.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Room count by condition
            const conditionCounts = await this.prisma.hostelRoom.groupBy({
                by: ['roomCondition'],
                where,
                _count: { roomCondition: true }
            });

            // Total statistics
            const totalStats = await this.prisma.hostelRoom.aggregate({
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

            // Rooms added over time
            const timeSeriesData = await this.prisma.hostelRoom.groupBy({
                by: [groupBy === 'month' ? 'createdAt' : 'createdAt'],
                where,
                _count: true
            });

            // Most occupied rooms
            const mostOccupiedRooms = await this.prisma.hostelRoom.findMany({
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
                    roomNumber: true,
                    type: true,
                    capacity: true,
                    occupiedCapacity: true,
                    availableCapacity: true,
                    monthlyRent: true
                }
            });

            // Occupancy rate by room
            const occupancyRates = await this.prisma.hostelRoom.findMany({
                where,
                select: {
                    id: true,
                    roomNumber: true,
                    capacity: true,
                    occupiedCapacity: true,
                    availableCapacity: true
                }
            });

            const occupancyWithRates = occupancyRates.map(room => ({
                ...room,
                occupancyRate: room.capacity > 0 ? (room.occupiedCapacity / room.capacity) * 100 : 0
            }));

            return {
                success: true,
                data: {
                    typeCounts,
                    statusCounts,
                    conditionCounts,
                    totalRooms: totalStats._count || 0,
                    totalCapacity: totalStats._sum.capacity || 0,
                    totalOccupiedCapacity: totalStats._sum.occupiedCapacity || 0,
                    totalAvailableCapacity: totalStats._sum.availableCapacity || 0,
                    totalBeds: totalStats._sum.totalBeds || 0,
                    totalOccupiedBeds: totalStats._sum.occupiedBeds || 0,
                    totalAvailableBeds: totalStats._sum.availableBeds || 0,
                    averageRent: totalStats._avg.monthlyRent || 0,
                    timeSeriesData,
                    mostOccupiedRooms,
                    occupancyRates: occupancyWithRates
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting room analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Search rooms
     */
    async searchRooms(query, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                hostelId,
                type,
                status,
                available,
                sortBy = 'relevance',
                sortOrder = 'desc'
            } = filters;

            const where = {
                OR: [
                    { roomNumber: { contains: query, mode: 'insensitive' } },
                    { notes: { contains: query, mode: 'insensitive' } }
                ]
            };

            if (hostelId) where.hostelId = parseInt(hostelId);
            if (type) where.type = type;
            if (status) where.status = status;
            if (available !== undefined) {
                if (available) {
                    where.availableCapacity = { gt: 0 };
                } else {
                    where.availableCapacity = 0;
                }
            }

            const skip = (page - 1) * limit;

            const [rooms, total] = await Promise.all([
                this.prisma.hostelRoom.findMany({
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
                                residents: true,
                                maintenanceRecords: true
                            }
                        }
                    },
                    orderBy: sortBy === 'relevance' ? { occupiedCapacity: 'desc' } : { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostelRoom.count({ where })
            ]);

            return {
                success: true,
                data: {
                    rooms,
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
            console.error('Error searching rooms:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to search rooms'
            };
        }
    }

    /**
     * Get available rooms
     */
    async getAvailableRooms(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                hostelId,
                type,
                minCapacity,
                maxRent,
                amenities
            } = filters;

            const where = {
                isActive: true,
                status: 'AVAILABLE',
                availableCapacity: { gt: 0 }
            };

            if (hostelId) where.hostelId = parseInt(hostelId);
            if (type) where.type = type;
            if (minCapacity) where.capacity = { gte: parseInt(minCapacity) };
            if (maxRent) where.monthlyRent = { lte: parseFloat(maxRent) };

            // Filter by amenities
            if (amenities) {
                if (amenities.attachedBathroom) where.hasAttachedBathroom = true;
                if (amenities.ac) where.hasAC = true;
                if (amenities.wifi) where.hasWifi = true;
                if (amenities.balcony) where.hasBalcony = true;
                if (amenities.tv) where.hasTV = true;
                if (amenities.refrigerator) where.hasRefrigerator = true;
            }

            const skip = (page - 1) * limit;

            const [rooms, total] = await Promise.all([
                this.prisma.hostelRoom.findMany({
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
                                residents: true
                            }
                        }
                    },
                    orderBy: { availableCapacity: 'desc' },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostelRoom.count({ where })
            ]);

            return {
                success: true,
                data: {
                    rooms,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Available rooms retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting available rooms:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve available rooms'
            };
        }
    }

    /**
     * Update hostel capacity
     */
    async updateHostelCapacity(hostelId) {
        try {
            const rooms = await this.prisma.hostelRoom.findMany({
                where: { 
                    hostelId: parseInt(hostelId),
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

            const totalCapacity = rooms.reduce((sum, room) => sum + room.capacity, 0);
            const totalOccupiedCapacity = rooms.reduce((sum, room) => sum + room.occupiedCapacity, 0);
            const totalAvailableCapacity = rooms.reduce((sum, room) => sum + room.availableCapacity, 0);
            const totalBeds = rooms.reduce((sum, room) => sum + room.totalBeds, 0);
            const totalOccupiedBeds = rooms.reduce((sum, room) => sum + room.occupiedBeds, 0);
            const totalAvailableBeds = rooms.reduce((sum, room) => sum + room.availableBeds, 0);

            await this.prisma.hostel.update({
                where: { id: parseInt(hostelId) },
                data: {
                    capacity: totalCapacity,
                    occupiedCapacity: totalOccupiedCapacity,
                    availableCapacity: totalAvailableCapacity,
                    totalBeds: totalBeds,
                    occupiedBeds: totalOccupiedBeds,
                    availableBeds: totalAvailableBeds,
                    updatedAt: new Date()
                }
            });
        } catch (error) {
            console.error('Error updating hostel capacity:', error);
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(roomIds, updateData) {
        try {
            const result = await this.prisma.hostelRoom.updateMany({
                where: {
                    id: { in: roomIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} rooms`
            };
        } catch (error) {
            console.error('Error bulk updating rooms:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update rooms'
            };
        }
    }
}

export default HostelRoom;
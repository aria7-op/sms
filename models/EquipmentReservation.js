import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class EquipmentReservation {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create equipment reservation
     */
    async create(data) {
        try {
            // Check for conflicts
            const conflicts = await this.checkConflicts(data.equipmentId, data.startDate, data.endDate);
            if (conflicts.length > 0) {
                return {
                    success: false,
                    error: 'Time slot conflicts with existing reservations',
                    data: conflicts,
                    message: 'Reservation conflicts with existing bookings'
                };
            }

            const reservation = await this.prisma.equipmentReservation.create({
                data: {
                    equipmentId: data.equipmentId,
                    userId: data.userId,
                    title: data.title,
                    description: data.description,
                    startDate: new Date(data.startDate),
                    endDate: new Date(data.endDate),
                    purpose: data.purpose,
                    location: data.location,
                    attendees: data.attendees,
                    priority: data.priority || 'NORMAL',
                    status: data.status || 'PENDING',
                    approvedBy: data.approvedBy,
                    approvedAt: data.approvedAt,
                    rejectionReason: data.rejectionReason,
                    notes: data.notes,
                    recurring: data.recurring || false,
                    recurringPattern: data.recurringPattern,
                    recurringEndDate: data.recurringEndDate,
                    reminderSent: data.reminderSent || false,
                    reminderSentAt: data.reminderSentAt,
                    metadata: data.metadata,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    equipment: {
                        include: {
                            department: true,
                            assignedUser: true
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    approver: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            return {
                success: true,
                data: reservation,
                message: 'Reservation created successfully'
            };
        } catch (error) {
            console.error('Error creating reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create reservation'
            };
        }
    }

    /**
     * Check for reservation conflicts
     */
    async checkConflicts(equipmentId, startDate, endDate, excludeId = null) {
        try {
            const where = {
                equipmentId: parseInt(equipmentId),
                status: { in: ['PENDING', 'APPROVED'] },
                OR: [
                    {
                        startDate: { lt: new Date(endDate) },
                        endDate: { gt: new Date(startDate) }
                    }
                ]
            };

            if (excludeId) {
                where.id = { not: parseInt(excludeId) };
            }

            const conflicts = await this.prisma.equipmentReservation.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: { startDate: 'asc' }
            });

            return conflicts;
        } catch (error) {
            console.error('Error checking conflicts:', error);
            return [];
        }
    }

    /**
     * Get reservation by ID
     */
    async getById(id) {
        try {
            const reservation = await this.prisma.equipmentReservation.findUnique({
                where: { id: parseInt(id) },
                include: {
                    equipment: {
                        include: {
                            department: true,
                            assignedUser: true
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    approver: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            });

            if (!reservation) {
                return {
                    success: false,
                    error: 'Reservation not found',
                    message: 'Reservation not found'
                };
            }

            return {
                success: true,
                data: reservation,
                message: 'Reservation retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve reservation'
            };
        }
    }

    /**
     * Get all reservations with filtering
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                equipmentId,
                userId,
                status,
                startDate,
                endDate,
                purpose,
                location,
                priority,
                approvedBy,
                sortBy = 'startDate',
                sortOrder = 'asc'
            } = filters;

            const where = {};

            if (equipmentId) where.equipmentId = parseInt(equipmentId);
            if (userId) where.userId = parseInt(userId);
            if (status) where.status = status;
            if (purpose) where.purpose = { contains: purpose, mode: 'insensitive' };
            if (location) where.location = { contains: location, mode: 'insensitive' };
            if (priority) where.priority = priority;
            if (approvedBy) where.approvedBy = parseInt(approvedBy);

            if (startDate || endDate) {
                where.OR = [];
                if (startDate && endDate) {
                    where.OR.push({
                        startDate: { gte: new Date(startDate) },
                        endDate: { lte: new Date(endDate) }
                    });
                } else if (startDate) {
                    where.startDate = { gte: new Date(startDate) };
                } else if (endDate) {
                    where.endDate = { lte: new Date(endDate) };
                }
            }

            const skip = (page - 1) * limit;

            const [reservations, total] = await Promise.all([
                this.prisma.equipmentReservation.findMany({
                    where,
                    include: {
                        equipment: {
                            select: {
                                id: true,
                                name: true,
                                category: true,
                                status: true
                            }
                        },
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        },
                        approver: {
                            select: {
                                id: true,
                                name: true,
                                email: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.equipmentReservation.count({ where })
            ]);

            return {
                success: true,
                data: {
                    reservations,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Reservations retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting reservations:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve reservations'
            };
        }
    }

    /**
     * Update reservation
     */
    async update(id, data) {
        try {
            // Check for conflicts if dates are being updated
            if (data.startDate || data.endDate) {
                const currentReservation = await this.getById(id);
                if (!currentReservation.success) {
                    return currentReservation;
                }

                const startDate = data.startDate || currentReservation.data.startDate;
                const endDate = data.endDate || currentReservation.data.endDate;

                const conflicts = await this.checkConflicts(
                    currentReservation.data.equipmentId,
                    startDate,
                    endDate,
                    id
                );

                if (conflicts.length > 0) {
                    return {
                        success: false,
                        error: 'Time slot conflicts with existing reservations',
                        data: conflicts,
                        message: 'Updated reservation conflicts with existing bookings'
                    };
                }
            }

            const reservation = await this.prisma.equipmentReservation.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    startDate: data.startDate ? new Date(data.startDate) : undefined,
                    endDate: data.endDate ? new Date(data.endDate) : undefined,
                    approvedAt: data.status === 'APPROVED' ? new Date() : undefined,
                    updatedAt: new Date()
                },
                include: {
                    equipment: true,
                    user: true,
                    approver: true
                }
            });

            return {
                success: true,
                data: reservation,
                message: 'Reservation updated successfully'
            };
        } catch (error) {
            console.error('Error updating reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update reservation'
            };
        }
    }

    /**
     * Approve reservation
     */
    async approve(id, approverId, notes = '') {
        try {
            const reservation = await this.prisma.equipmentReservation.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'APPROVED',
                    approvedBy: parseInt(approverId),
                    approvedAt: new Date(),
                    notes: notes,
                    updatedAt: new Date()
                },
                include: {
                    equipment: true,
                    user: true,
                    approver: true
                }
            });

            return {
                success: true,
                data: reservation,
                message: 'Reservation approved successfully'
            };
        } catch (error) {
            console.error('Error approving reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to approve reservation'
            };
        }
    }

    /**
     * Reject reservation
     */
    async reject(id, approverId, reason) {
        try {
            const reservation = await this.prisma.equipmentReservation.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'REJECTED',
                    approvedBy: parseInt(approverId),
                    approvedAt: new Date(),
                    rejectionReason: reason,
                    updatedAt: new Date()
                },
                include: {
                    equipment: true,
                    user: true,
                    approver: true
                }
            });

            return {
                success: true,
                data: reservation,
                message: 'Reservation rejected successfully'
            };
        } catch (error) {
            console.error('Error rejecting reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to reject reservation'
            };
        }
    }

    /**
     * Cancel reservation
     */
    async cancel(id, userId, reason = '') {
        try {
            const reservation = await this.prisma.equipmentReservation.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'CANCELLED',
                    notes: reason,
                    updatedAt: new Date()
                },
                include: {
                    equipment: true,
                    user: true
                }
            });

            return {
                success: true,
                data: reservation,
                message: 'Reservation cancelled successfully'
            };
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to cancel reservation'
            };
        }
    }

    /**
     * Delete reservation
     */
    async delete(id) {
        try {
            await this.prisma.equipmentReservation.delete({
                where: { id: parseInt(id) }
            });

            return {
                success: true,
                message: 'Reservation deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete reservation'
            };
        }
    }

    /**
     * Get equipment availability
     */
    async getEquipmentAvailability(equipmentId, startDate, endDate) {
        try {
            const reservations = await this.prisma.equipmentReservation.findMany({
                where: {
                    equipmentId: parseInt(equipmentId),
                    status: { in: ['PENDING', 'APPROVED'] },
                    startDate: { lte: new Date(endDate) },
                    endDate: { gte: new Date(startDate) }
                },
                orderBy: { startDate: 'asc' }
            });

            // Generate availability slots
            const availability = [];
            let currentDate = new Date(startDate);

            while (currentDate <= new Date(endDate)) {
                const dayReservations = reservations.filter(r => {
                    const reservationStart = new Date(r.startDate);
                    const reservationEnd = new Date(r.endDate);
                    return currentDate >= reservationStart && currentDate <= reservationEnd;
                });

                availability.push({
                    date: new Date(currentDate),
                    available: dayReservations.length === 0,
                    reservations: dayReservations
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }

            return {
                success: true,
                data: availability,
                message: 'Equipment availability retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting equipment availability:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve equipment availability'
            };
        }
    }

    /**
     * Get user reservations
     */
    async getUserReservations(userId, filters = {}) {
        try {
            const {
                status,
                startDate,
                endDate,
                page = 1,
                limit = 10
            } = filters;

            const where = { userId: parseInt(userId) };

            if (status) where.status = status;
            if (startDate || endDate) {
                where.OR = [];
                if (startDate && endDate) {
                    where.OR.push({
                        startDate: { gte: new Date(startDate) },
                        endDate: { lte: new Date(endDate) }
                    });
                } else if (startDate) {
                    where.startDate = { gte: new Date(startDate) };
                } else if (endDate) {
                    where.endDate = { lte: new Date(endDate) };
                }
            }

            const skip = (page - 1) * limit;

            const [reservations, total] = await Promise.all([
                this.prisma.equipmentReservation.findMany({
                    where,
                    include: {
                        equipment: {
                            select: {
                                id: true,
                                name: true,
                                category: true,
                                status: true
                            }
                        }
                    },
                    orderBy: { startDate: 'asc' },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.equipmentReservation.count({ where })
            ]);

            return {
                success: true,
                data: {
                    reservations,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'User reservations retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting user reservations:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve user reservations'
            };
        }
    }

    /**
     * Get pending approvals
     */
    async getPendingApprovals(approverId = null) {
        try {
            const where = { status: 'PENDING' };
            if (approverId) where.approvedBy = parseInt(approverId);

            const pendingReservations = await this.prisma.equipmentReservation.findMany({
                where,
                include: {
                    equipment: {
                        include: {
                            department: true
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                },
                orderBy: { createdAt: 'asc' }
            });

            return {
                success: true,
                data: pendingReservations,
                message: 'Pending approvals retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting pending approvals:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve pending approvals'
            };
        }
    }

    /**
     * Get upcoming reservations
     */
    async getUpcomingReservations(equipmentId = null, days = 7) {
        try {
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + days);

            const where = {
                status: 'APPROVED',
                startDate: { gte: startDate, lte: endDate }
            };

            if (equipmentId) where.equipmentId = parseInt(equipmentId);

            const upcomingReservations = await this.prisma.equipmentReservation.findMany({
                where,
                include: {
                    equipment: {
                        select: {
                            id: true,
                            name: true,
                            category: true
                        }
                    },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: { startDate: 'asc' }
            });

            return {
                success: true,
                data: upcomingReservations,
                message: 'Upcoming reservations retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting upcoming reservations:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve upcoming reservations'
            };
        }
    }
}


export default EquipmentReservation;
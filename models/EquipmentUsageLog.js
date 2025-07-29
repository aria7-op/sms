import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class EquipmentUsageLog {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create usage log entry
     */
    async create(data) {
        try {
            const usageLog = await this.prisma.equipmentUsageLog.create({
                data: {
                    equipmentId: data.equipmentId,
                    userId: data.userId,
                    type: data.type || 'CHECKOUT',
                    startTime: data.startTime || new Date(),
                    endTime: data.endTime,
                    duration: data.duration,
                    purpose: data.purpose,
                    location: data.location,
                    notes: data.notes,
                    status: data.status || 'ACTIVE',
                    approvedBy: data.approvedBy,
                    approvedAt: data.approvedAt,
                    returnedAt: data.returnedAt,
                    returnCondition: data.returnCondition,
                    returnNotes: data.notes,
                    damageReported: data.damageReported || false,
                    damageDescription: data.damageDescription,
                    maintenanceRequired: data.maintenanceRequired || false,
                    maintenanceNotes: data.maintenanceNotes,
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
                data: usageLog,
                message: 'Usage log created successfully'
            };
        } catch (error) {
            console.error('Error creating usage log:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create usage log'
            };
        }
    }

    /**
     * Get usage log by ID
     */
    async getById(id) {
        try {
            const usageLog = await this.prisma.equipmentUsageLog.findUnique({
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

            if (!usageLog) {
                return {
                    success: false,
                    error: 'Usage log not found',
                    message: 'Usage log not found'
                };
            }

            return {
                success: true,
                data: usageLog,
                message: 'Usage log retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting usage log:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve usage log'
            };
        }
    }

    /**
     * Get all usage logs with filtering
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                equipmentId,
                userId,
                type,
                status,
                startDate,
                endDate,
                purpose,
                location,
                approvedBy,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            if (equipmentId) where.equipmentId = parseInt(equipmentId);
            if (userId) where.userId = parseInt(userId);
            if (type) where.type = type;
            if (status) where.status = status;
            if (purpose) where.purpose = { contains: purpose, mode: 'insensitive' };
            if (location) where.location = { contains: location, mode: 'insensitive' };
            if (approvedBy) where.approvedBy = parseInt(approvedBy);

            if (startDate || endDate) {
                where.startTime = {};
                if (startDate) where.startTime.gte = new Date(startDate);
                if (endDate) where.startTime.lte = new Date(endDate);
            }

            const skip = (page - 1) * limit;

            const [usageLogs, total] = await Promise.all([
                this.prisma.equipmentUsageLog.findMany({
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
                this.prisma.equipmentUsageLog.count({ where })
            ]);

            return {
                success: true,
                data: {
                    usageLogs,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Usage logs retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting usage logs:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve usage logs'
            };
        }
    }

    /**
     * Update usage log
     */
    async update(id, data) {
        try {
            const usageLog = await this.prisma.equipmentUsageLog.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
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
                data: usageLog,
                message: 'Usage log updated successfully'
            };
        } catch (error) {
            console.error('Error updating usage log:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update usage log'
            };
        }
    }

    /**
     * Return equipment
     */
    async returnEquipment(id, returnData) {
        try {
            const usageLog = await this.prisma.equipmentUsageLog.update({
                where: { id: parseInt(id) },
                data: {
                    endTime: new Date(),
                    returnedAt: new Date(),
                    returnCondition: returnData.condition,
                    returnNotes: returnData.notes,
                    damageReported: returnData.damageReported || false,
                    damageDescription: returnData.damageDescription,
                    maintenanceRequired: returnData.maintenanceRequired || false,
                    maintenanceNotes: returnData.maintenanceNotes,
                    status: 'RETURNED',
                    updatedAt: new Date()
                },
                include: {
                    equipment: true,
                    user: true
                }
            });

            // Update equipment status if needed
            if (returnData.damageReported || returnData.maintenanceRequired) {
                await this.prisma.equipment.update({
                    where: { id: usageLog.equipmentId },
                    data: {
                        status: returnData.damageReported ? 'DAMAGED' : 'MAINTENANCE',
                        condition: returnData.damageReported ? 'DAMAGED' : 'NEEDS_MAINTENANCE',
                        updatedAt: new Date()
                    }
                });
            } else {
                await this.prisma.equipment.update({
                    where: { id: usageLog.equipmentId },
                    data: {
                        status: 'AVAILABLE',
                        updatedAt: new Date()
                    }
                });
            }

            return {
                success: true,
                data: usageLog,
                message: 'Equipment returned successfully'
            };
        } catch (error) {
            console.error('Error returning equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to return equipment'
            };
        }
    }

    /**
     * Get active checkouts
     */
    async getActiveCheckouts(filters = {}) {
        try {
            const {
                equipmentId,
                userId,
                location
            } = filters;

            const where = {
                status: 'ACTIVE',
                endTime: null
            };

            if (equipmentId) where.equipmentId = parseInt(equipmentId);
            if (userId) where.userId = parseInt(userId);
            if (location) where.location = { contains: location, mode: 'insensitive' };

            const checkouts = await this.prisma.equipmentUsageLog.findMany({
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
                orderBy: { startTime: 'asc' }
            });

            return {
                success: true,
                data: checkouts,
                message: 'Active checkouts retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting active checkouts:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve active checkouts'
            };
        }
    }

    /**
     * Get overdue checkouts
     */
    async getOverdueCheckouts() {
        try {
            const overdueCheckouts = await this.prisma.equipmentUsageLog.findMany({
                where: {
                    status: 'ACTIVE',
                    endTime: null,
                    startTime: {
                        lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // More than 24 hours ago
                    }
                },
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
                orderBy: { startTime: 'asc' }
            });

            return {
                success: true,
                data: overdueCheckouts,
                message: 'Overdue checkouts retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting overdue checkouts:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve overdue checkouts'
            };
        }
    }

    /**
     * Get usage analytics
     */
    async getUsageAnalytics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                equipmentId,
                userId,
                groupBy = 'day'
            } = filters;

            const where = {};
            if (startDate && endDate) {
                where.startTime = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            if (equipmentId) where.equipmentId = parseInt(equipmentId);
            if (userId) where.userId = parseInt(userId);

            // Usage by equipment
            const usageByEquipment = await this.prisma.equipmentUsageLog.groupBy({
                by: ['equipmentId'],
                where,
                _count: { equipmentId: true },
                _sum: { duration: true }
            });

            // Usage by user
            const usageByUser = await this.prisma.equipmentUsageLog.groupBy({
                by: ['userId'],
                where,
                _count: { userId: true },
                _sum: { duration: true }
            });

            // Usage by type
            const usageByType = await this.prisma.equipmentUsageLog.groupBy({
                by: ['type'],
                where,
                _count: { type: true }
            });

            // Time series data
            const timeSeriesData = await this.prisma.equipmentUsageLog.groupBy({
                by: [groupBy === 'day' ? 'startTime' : 'startTime'],
                where,
                _count: true,
                _sum: { duration: true }
            });

            return {
                success: true,
                data: {
                    usageByEquipment,
                    usageByUser,
                    usageByType,
                    timeSeriesData
                },
                message: 'Usage analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting usage analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve usage analytics'
            };
        }
    }

    /**
     * Get user usage history
     */
    async getUserUsageHistory(userId, filters = {}) {
        try {
            const {
                startDate,
                endDate,
                equipmentId,
                type,
                page = 1,
                limit = 10
            } = filters;

            const where = { userId: parseInt(userId) };

            if (startDate && endDate) {
                where.startTime = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            if (equipmentId) where.equipmentId = parseInt(equipmentId);
            if (type) where.type = type;

            const skip = (page - 1) * limit;

            const [usageHistory, total] = await Promise.all([
                this.prisma.equipmentUsageLog.findMany({
                    where,
                    include: {
                        equipment: {
                            select: {
                                id: true,
                                name: true,
                                category: true,
                                brand: true,
                                model: true
                            }
                        }
                    },
                    orderBy: { startTime: 'desc' },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.equipmentUsageLog.count({ where })
            ]);

            return {
                success: true,
                data: {
                    usageHistory,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'User usage history retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting user usage history:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve user usage history'
            };
        }
    }

    /**
     * Get equipment usage history
     */
    async getEquipmentUsageHistory(equipmentId, filters = {}) {
        try {
            const {
                startDate,
                endDate,
                userId,
                type,
                page = 1,
                limit = 10
            } = filters;

            const where = { equipmentId: parseInt(equipmentId) };

            if (startDate && endDate) {
                where.startTime = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            if (userId) where.userId = parseInt(userId);
            if (type) where.type = type;

            const skip = (page - 1) * limit;

            const [usageHistory, total] = await Promise.all([
                this.prisma.equipmentUsageLog.findMany({
                    where,
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        }
                    },
                    orderBy: { startTime: 'desc' },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.equipmentUsageLog.count({ where })
            ]);

            return {
                success: true,
                data: {
                    usageHistory,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Equipment usage history retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting equipment usage history:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve equipment usage history'
            };
        }
    }
}

export default EquipmentUsageLog;
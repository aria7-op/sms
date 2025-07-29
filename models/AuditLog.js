// models/AuditLog.js
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class AuditLog {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create a new audit log entry
     */
    async create(data) {
        try {
            const auditLog = await this.prisma.auditLog.create({
                data: {
                    action: data.action,
                    entityType: data.entityType,
                    entityId: data.entityId,
                    oldData: data.oldData,
                    newData: data.newData,
                    ipAddress: data.ipAddress,
                    userAgent: data.userAgent,
                    ownerId: data.ownerId,
                    schoolId: data.schoolId,
                    userId: data.userId,
                    customerId: data.customerId
                }
            });

            return {
                success: true,
                data: auditLog,
                message: 'Audit log created successfully'
            };
        } catch (error) {
            console.error('Error creating audit log:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create audit log'
            };
        }
    }

    /**
     * Get audit log by ID
     */
    async getById(id) {
        try {
            const auditLog = await this.prisma.auditLog.findUnique({
                where: { id: BigInt(id) },
                include: {
                    owner: true,
                    school: true,
                    user: true,
                    customer: true
                }
            });

            if (!auditLog) {
                return {
                    success: false,
                    error: 'Audit log not found',
                    message: 'Audit log not found'
                };
            }

            return {
                success: true,
                data: auditLog,
                message: 'Audit log retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting audit log:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve audit log'
            };
        }
    }

    /**
     * Get all audit logs with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                action,
                entityType,
                entityId,
                ownerId,
                schoolId,
                userId,
                customerId,
                startDate,
                endDate,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            if (action) where.action = action;
            if (entityType) where.entityType = entityType;
            if (entityId) where.entityId = BigInt(entityId);
            if (ownerId) where.ownerId = BigInt(ownerId);
            if (schoolId) where.schoolId = BigInt(schoolId);
            if (userId) where.userId = BigInt(userId);
            if (customerId) where.customerId = BigInt(customerId);

            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) where.createdAt.gte = new Date(startDate);
                if (endDate) where.createdAt.lte = new Date(endDate);
            }

            const skip = (page - 1) * limit;

            const [logs, total] = await Promise.all([
                this.prisma.auditLog.findMany({
                    where,
                    include: {
                        owner: { select: { id: true, name: true } },
                        school: { select: { id: true, name: true } },
                        user: { select: { id: true, name: true, email: true } },
                        customer: { select: { id: true, name: true } }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.auditLog.count({ where })
            ]);

            return {
                success: true,
                data: {
                    logs,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Audit logs retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting audit logs:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve audit logs'
            };
        }
    }

    /**
     * Search audit logs
     */
    async search(searchTerm, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                startDate,
                endDate
            } = filters;

            const where = {
                OR: [
                    { action: { contains: searchTerm, mode: 'insensitive' } },
                    { entityType: { contains: searchTerm, mode: 'insensitive' } },
                    { ipAddress: { contains: searchTerm, mode: 'insensitive' } }
                ]
            };

            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) where.createdAt.gte = new Date(startDate);
                if (endDate) where.createdAt.lte = new Date(endDate);
            }

            const skip = (page - 1) * limit;

            const [logs, total] = await Promise.all([
                this.prisma.auditLog.findMany({
                    where,
                    include: {
                        owner: { select: { id: true, name: true } },
                        user: { select: { id: true, name: true } }
                    },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.auditLog.count({ where })
            ]);

            return {
                success: true,
                data: {
                    logs,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Audit logs search completed'
            };
        } catch (error) {
            console.error('Error searching audit logs:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to search audit logs'
            };
        }
    }
}

export default AuditLog;
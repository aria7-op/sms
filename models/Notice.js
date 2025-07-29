import { PrismaClient } from '../generated/prisma/client.js';
import { validateMessage } from '../validators/messageValidator.js';
import logger from '../config/logger.js';

class Notice {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new notice
     */
    async create(data) {
        try {
            // Validate input data
            const validation = validateNotice(data);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if dates are valid
            if (new Date(data.startDate) >= new Date(data.endDate)) {
                throw new Error('End date must be after start date');
            }

            // Create notice
            const notice = await this.prisma.notice.create({
                data: {
                    title: data.title,
                    content: data.content,
                    startDate: new Date(data.startDate),
                    endDate: new Date(data.endDate),
                    isPublished: data.isPublished || false,
                    priority: data.priority || 'medium',
                    targetRoles: data.targetRoles || [],
                    classIds: data.classIds || [],
                    schoolId: data.schoolId,
                    createdBy: data.createdBy,
                    updatedBy: data.updatedBy
                },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            logger.info(`Notice created: ${notice.id} by user: ${data.createdBy}`);
            return { success: true, data: notice };

        } catch (error) {
            logger.error(`Error creating notice: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get notice by ID
     */
    async getById(id, schoolId) {
        try {
            const notice = await this.prisma.notice.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            if (!notice) {
                throw new Error('Notice not found');
            }

            return { success: true, data: notice };

        } catch (error) {
            logger.error(`Error getting notice: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all notices with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isPublished,
                priority,
                targetRole,
                classId,
                startDate,
                endDate,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            // Build where clause
            const where = {
                deletedAt: null,
                ...(filters.schoolId && { schoolId: parseInt(filters.schoolId) }),
                ...(isPublished !== undefined && { isPublished }),
                ...(priority && { priority }),
                ...(targetRole && { targetRoles: { has: targetRole } }),
                ...(classId && { classIds: { has: parseInt(classId) } }),
                ...(startDate && endDate && {
                    OR: [
                        {
                            startDate: {
                                gte: new Date(startDate),
                                lte: new Date(endDate)
                            }
                        },
                        {
                            endDate: {
                                gte: new Date(startDate),
                                lte: new Date(endDate)
                            }
                        }
                    ]
                }),
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.notice.count({ where });

            // Get notices
            const notices = await this.prisma.notice.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: notices,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting notices: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get published notices for specific user role and class
     */
    async getPublishedNotices(schoolId, userRole, classId = null) {
        try {
            const now = new Date();
            
            const where = {
                schoolId: parseInt(schoolId),
                isPublished: true,
                deletedAt: null,
                startDate: { lte: now },
                endDate: { gte: now },
                OR: [
                    { targetRoles: { has: userRole } },
                    { targetRoles: { isEmpty: true } }
                ]
            };

            // Add class filter if provided
            if (classId) {
                where.OR.push({ classIds: { has: parseInt(classId) } });
            }

            const notices = await this.prisma.notice.findMany({
                where,
                orderBy: [
                    { priority: 'desc' },
                    { createdAt: 'desc' }
                ],
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                }
            });

            return { success: true, data: notices };

        } catch (error) {
            logger.error(`Error getting published notices: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update notice
     */
    async update(id, data, schoolId) {
        try {
            // Check if notice exists
            const existingNotice = await this.prisma.notice.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingNotice) {
                throw new Error('Notice not found');
            }

            // Validate update data
            const validation = validateNotice(data, true);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if dates are valid
            if (data.startDate && data.endDate) {
                if (new Date(data.startDate) >= new Date(data.endDate)) {
                    throw new Error('End date must be after start date');
                }
            }

            // Update notice
            const notice = await this.prisma.notice.update({
                where: { id: parseInt(id) },
                data: {
                    ...(data.title && { title: data.title }),
                    ...(data.content && { content: data.content }),
                    ...(data.startDate && { startDate: new Date(data.startDate) }),
                    ...(data.endDate && { endDate: new Date(data.endDate) }),
                    ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
                    ...(data.priority && { priority: data.priority }),
                    ...(data.targetRoles && { targetRoles: data.targetRoles }),
                    ...(data.classIds && { classIds: data.classIds }),
                    updatedBy: data.updatedBy,
                    updatedAt: new Date()
                },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            logger.info(`Notice updated: ${id}`);
            return { success: true, data: notice };

        } catch (error) {
            logger.error(`Error updating notice: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update notice publication status
     */
    async updatePublicationStatus(id, isPublished, schoolId, updatedBy) {
        try {
            const notice = await this.prisma.notice.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!notice) {
                throw new Error('Notice not found');
            }

            const updatedNotice = await this.prisma.notice.update({
                where: { id: parseInt(id) },
                data: {
                    isPublished,
                    updatedBy,
                    updatedAt: new Date()
                },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    }
                }
            });

            logger.info(`Notice publication status updated: ${id} to ${isPublished}`);
            return { success: true, data: updatedNotice };

        } catch (error) {
            logger.error(`Error updating notice publication status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete notice (soft delete)
     */
    async delete(id, schoolId, deletedBy) {
        try {
            const notice = await this.prisma.notice.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!notice) {
                throw new Error('Notice not found');
            }

            await this.prisma.notice.update({
                where: { id: parseInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: deletedBy
                }
            });

            logger.info(`Notice deleted: ${id}`);
            return { success: true, message: 'Notice deleted successfully' };

        } catch (error) {
            logger.error(`Error deleting notice: ${error.message}`);
            throw error;
        }
    }

    /**
     * Bulk publish/unpublish notices
     */
    async bulkUpdatePublicationStatus(noticeIds, isPublished, schoolId, updatedBy) {
        try {
            const result = await this.prisma.notice.updateMany({
                where: {
                    id: { in: noticeIds.map(id => parseInt(id)) },
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                },
                data: {
                    isPublished,
                    updatedBy,
                    updatedAt: new Date()
                }
            });

            logger.info(`Bulk notice publication status updated: ${result.count} notices`);
            return { 
                success: true, 
                message: `${result.count} notices updated successfully`,
                count: result.count
            };

        } catch (error) {
            logger.error(`Error bulk updating notice publication status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get notice statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, isPublished } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }),
                ...(isPublished !== undefined && { isPublished })
            };

            const [
                totalNotices,
                publishedNotices,
                draftNotices,
                highPriorityNotices,
                mediumPriorityNotices,
                lowPriorityNotices,
                activeNotices
            ] = await Promise.all([
                this.prisma.notice.count({ where }),
                this.prisma.notice.count({
                    where: { ...where, isPublished: true }
                }),
                this.prisma.notice.count({
                    where: { ...where, isPublished: false }
                }),
                this.prisma.notice.count({
                    where: { ...where, priority: 'high' }
                }),
                this.prisma.notice.count({
                    where: { ...where, priority: 'medium' }
                }),
                this.prisma.notice.count({
                    where: { ...where, priority: 'low' }
                }),
                this.prisma.notice.count({
                    where: {
                        ...where,
                        isPublished: true,
                        startDate: { lte: new Date() },
                        endDate: { gte: new Date() }
                    }
                })
            ]);

            return {
                success: true,
                data: {
                    totalNotices,
                    publishedNotices,
                    draftNotices,
                    highPriorityNotices,
                    mediumPriorityNotices,
                    lowPriorityNotices,
                    activeNotices
                }
            };

        } catch (error) {
            logger.error(`Error getting notice statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get notice analytics
     */
    async getAnalytics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, groupBy = 'month' } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                })
            };

            // Get notices by priority
            const priorityAnalytics = await this.prisma.notice.groupBy({
                by: ['priority'],
                where,
                _count: { id: true }
            });

            // Get notices by publication status
            const publicationAnalytics = await this.prisma.notice.groupBy({
                by: ['isPublished'],
                where,
                _count: { id: true }
            });

            // Get notices by month
            const monthlyAnalytics = await this.prisma.$queryRaw`
                SELECT 
                    DATE_TRUNC('month', "createdAt") as month,
                    COUNT(*) as count,
                    COUNT(CASE WHEN "isPublished" = true THEN 1 END) as published_count
                FROM notices 
                WHERE "schoolId" = ${parseInt(schoolId)} 
                AND "deletedAt" IS NULL
                ${startDate ? `AND "createdAt" >= ${new Date(startDate)}` : ''}
                ${endDate ? `AND "createdAt" <= ${new Date(endDate)}` : ''}
                GROUP BY DATE_TRUNC('month', "createdAt")
                ORDER BY month DESC
            `;

            return {
                success: true,
                data: {
                    priorityAnalytics,
                    publicationAnalytics,
                    monthlyAnalytics
                }
            };

        } catch (error) {
            logger.error(`Error getting notice analytics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search notices
     */
    async searchNotices(schoolId, searchTerm, filters = {}) {
        try {
            const {
                isPublished,
                priority,
                targetRole,
                classId,
                limit = 20
            } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                OR: [
                    { title: { contains: searchTerm, mode: 'insensitive' } },
                    { content: { contains: searchTerm, mode: 'insensitive' } }
                ],
                ...(isPublished !== undefined && { isPublished }),
                ...(priority && { priority }),
                ...(targetRole && { targetRoles: { has: targetRole } }),
                ...(classId && { classIds: { has: parseInt(classId) } })
            };

            const notices = await this.prisma.notice.findMany({
                where,
                take: parseInt(limit),
                orderBy: [
                    { priority: 'desc' },
                    { createdAt: 'desc' }
                ],
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                }
            });

            return { success: true, data: notices };

        } catch (error) {
            logger.error(`Error searching notices: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get upcoming notices
     */
    async getUpcomingNotices(schoolId, limit = 10) {
        try {
            const now = new Date();
            
            const notices = await this.prisma.notice.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    isPublished: true,
                    deletedAt: null,
                    startDate: { gt: now }
                },
                take: parseInt(limit),
                orderBy: [
                    { startDate: 'asc' },
                    { priority: 'desc' }
                ],
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                }
            });

            return { success: true, data: notices };

        } catch (error) {
            logger.error(`Error getting upcoming notices: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get expired notices
     */
    async getExpiredNotices(schoolId, limit = 10) {
        try {
            const now = new Date();
            
            const notices = await this.prisma.notice.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    deletedAt: null,
                    endDate: { lt: now }
                },
                take: parseInt(limit),
                orderBy: [
                    { endDate: 'desc' },
                    { priority: 'desc' }
                ],
                include: {
                    createdByUser: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                }
            });

            return { success: true, data: notices };

        } catch (error) {
            logger.error(`Error getting expired notices: ${error.message}`);
            throw error;
        }
    }
}

export default Notice; 
import { PrismaClient } from '../generated/prisma/client.js';
import { validateEvent } from '../validators/eventValidator.js';
import logger from '../config/logger.js';
class Event {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new event
     */
    async create(data) {
        try {
            // Validate input data
            const validation = validateEvent(data);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if dates are valid
            if (new Date(data.startDateTime) >= new Date(data.endDateTime)) {
                throw new Error('End date/time must be after start date/time');
            }

            // Create event
            const event = await this.prisma.event.create({
                data: {
                    title: data.title,
                    description: data.description,
                    startDateTime: new Date(data.startDateTime),
                    endDateTime: new Date(data.endDateTime),
                    location: data.location,
                    isPublished: data.isPublished || false,
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
                    }
                }
            });

            logger.info(`Event created: ${event.id} by user: ${data.createdBy}`);
            return { success: true, data: event };

        } catch (error) {
            logger.error(`Error creating event: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get event by ID
     */
    async getById(id, schoolId) {
        try {
            const event = await this.prisma.event.findFirst({
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
                    }
                }
            });

            if (!event) {
                throw new Error('Event not found');
            }

            return { success: true, data: event };

        } catch (error) {
            logger.error(`Error getting event: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all events with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isPublished,
                targetRole,
                classId,
                startDate,
                endDate,
                search,
                sortBy = 'startDateTime',
                sortOrder = 'asc'
            } = filters;

            const skip = (page - 1) * limit;

            // Build where clause
            const where = {
                deletedAt: null,
                ...(filters.schoolId && { schoolId: parseInt(filters.schoolId) }),
                ...(isPublished !== undefined && { isPublished }),
                ...(targetRole && { targetRoles: { has: targetRole } }),
                ...(classId && { classIds: { has: parseInt(classId) } }),
                ...(startDate && endDate && {
                    OR: [
                        {
                            startDateTime: {
                                gte: new Date(startDate),
                                lte: new Date(endDate)
                            }
                        },
                        {
                            endDateTime: {
                                gte: new Date(startDate),
                                lte: new Date(endDate)
                            }
                        }
                    ]
                }),
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
                        { location: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.event.count({ where });

            // Get events
            const events = await this.prisma.event.findMany({
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
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: events,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting events: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get published events for specific user role and class
     */
    async getPublishedEvents(schoolId, userRole, classId = null) {
        try {
            const now = new Date();
            
            const where = {
                schoolId: parseInt(schoolId),
                isPublished: true,
                deletedAt: null,
                endDateTime: { gte: now },
                OR: [
                    { targetRoles: { has: userRole } },
                    { targetRoles: { isEmpty: true } }
                ]
            };

            // Add class filter if provided
            if (classId) {
                where.OR.push({ classIds: { has: parseInt(classId) } });
            }

            const events = await this.prisma.event.findMany({
                where,
                orderBy: { startDateTime: 'asc' },
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

            return { success: true, data: events };

        } catch (error) {
            logger.error(`Error getting published events: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update event
     */
    async update(id, data, schoolId) {
        try {
            // Check if event exists
            const existingEvent = await this.prisma.event.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingEvent) {
                throw new Error('Event not found');
            }

            // Validate update data
            const validation = validateEvent(data, true);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if dates are valid
            if (data.startDateTime && data.endDateTime) {
                if (new Date(data.startDateTime) >= new Date(data.endDateTime)) {
                    throw new Error('End date/time must be after start date/time');
                }
            }

            // Update event
            const event = await this.prisma.event.update({
                where: { id: parseInt(id) },
                data: {
                    ...(data.title && { title: data.title }),
                    ...(data.description && { description: data.description }),
                    ...(data.startDateTime && { startDateTime: new Date(data.startDateTime) }),
                    ...(data.endDateTime && { endDateTime: new Date(data.endDateTime) }),
                    ...(data.location && { location: data.location }),
                    ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
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
                    }
                }
            });

            logger.info(`Event updated: ${id}`);
            return { success: true, data: event };

        } catch (error) {
            logger.error(`Error updating event: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update event publication status
     */
    async updatePublicationStatus(id, isPublished, schoolId, updatedBy) {
        try {
            const event = await this.prisma.event.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!event) {
                throw new Error('Event not found');
            }

            const updatedEvent = await this.prisma.event.update({
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

            logger.info(`Event publication status updated: ${id} to ${isPublished}`);
            return { success: true, data: updatedEvent };

        } catch (error) {
            logger.error(`Error updating event publication status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete event (soft delete)
     */
    async delete(id, schoolId, deletedBy) {
        try {
            const event = await this.prisma.event.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!event) {
                throw new Error('Event not found');
            }

            await this.prisma.event.update({
                where: { id: parseInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: deletedBy
                }
            });

            logger.info(`Event deleted: ${id}`);
            return { success: true, message: 'Event deleted successfully' };

        } catch (error) {
            logger.error(`Error deleting event: ${error.message}`);
            throw error;
        }
    }

    /**
     * Bulk publish/unpublish events
     */
    async bulkUpdatePublicationStatus(eventIds, isPublished, schoolId, updatedBy) {
        try {
            const result = await this.prisma.event.updateMany({
                where: {
                    id: { in: eventIds.map(id => parseInt(id)) },
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                },
                data: {
                    isPublished,
                    updatedBy,
                    updatedAt: new Date()
                }
            });

            logger.info(`Bulk event publication status updated: ${result.count} events`);
            return { 
                success: true, 
                message: `${result.count} events updated successfully`,
                count: result.count
            };

        } catch (error) {
            logger.error(`Error bulk updating event publication status: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get event statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, isPublished } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    startDateTime: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }),
                ...(isPublished !== undefined && { isPublished })
            };

            const [
                totalEvents,
                publishedEvents,
                draftEvents,
                upcomingEvents,
                ongoingEvents,
                pastEvents
            ] = await Promise.all([
                this.prisma.event.count({ where }),
                this.prisma.event.count({
                    where: { ...where, isPublished: true }
                }),
                this.prisma.event.count({
                    where: { ...where, isPublished: false }
                }),
                this.prisma.event.count({
                    where: {
                        ...where,
                        isPublished: true,
                        startDateTime: { gt: new Date() }
                    }
                }),
                this.prisma.event.count({
                    where: {
                        ...where,
                        isPublished: true,
                        startDateTime: { lte: new Date() },
                        endDateTime: { gte: new Date() }
                    }
                }),
                this.prisma.event.count({
                    where: {
                        ...where,
                        isPublished: true,
                        endDateTime: { lt: new Date() }
                    }
                })
            ]);

            return {
                success: true,
                data: {
                    totalEvents,
                    publishedEvents,
                    draftEvents,
                    upcomingEvents,
                    ongoingEvents,
                    pastEvents
                }
            };

        } catch (error) {
            logger.error(`Error getting event statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get event analytics
     */
    async getAnalytics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, groupBy = 'month' } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    startDateTime: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                })
            };

            // Get events by publication status
            const publicationAnalytics = await this.prisma.event.groupBy({
                by: ['isPublished'],
                where,
                _count: { id: true }
            });

            // Get events by month
            const monthlyAnalytics = await this.prisma.$queryRaw`
                SELECT 
                    DATE_TRUNC('month', "startDateTime") as month,
                    COUNT(*) as count,
                    COUNT(CASE WHEN "isPublished" = true THEN 1 END) as published_count
                FROM events 
                WHERE "schoolId" = ${parseInt(schoolId)} 
                AND "deletedAt" IS NULL
                ${startDate ? `AND "startDateTime" >= ${new Date(startDate)}` : ''}
                ${endDate ? `AND "startDateTime" <= ${new Date(endDate)}` : ''}
                GROUP BY DATE_TRUNC('month', "startDateTime")
                ORDER BY month DESC
            `;

            return {
                success: true,
                data: {
                    publicationAnalytics,
                    monthlyAnalytics
                }
            };

        } catch (error) {
            logger.error(`Error getting event analytics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search events
     */
    async searchEvents(schoolId, searchTerm, filters = {}) {
        try {
            const {
                isPublished,
                targetRole,
                classId,
                limit = 20
            } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                OR: [
                    { title: { contains: searchTerm, mode: 'insensitive' } },
                    { description: { contains: searchTerm, mode: 'insensitive' } },
                    { location: { contains: searchTerm, mode: 'insensitive' } }
                ],
                ...(isPublished !== undefined && { isPublished }),
                ...(targetRole && { targetRoles: { has: targetRole } }),
                ...(classId && { classIds: { has: parseInt(classId) } })
            };

            const events = await this.prisma.event.findMany({
                where,
                take: parseInt(limit),
                orderBy: { startDateTime: 'asc' },
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

            return { success: true, data: events };

        } catch (error) {
            logger.error(`Error searching events: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get upcoming events
     */
    async getUpcomingEvents(schoolId, limit = 10) {
        try {
            const now = new Date();
            
            const events = await this.prisma.event.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    isPublished: true,
                    deletedAt: null,
                    startDateTime: { gt: now }
                },
                take: parseInt(limit),
                orderBy: { startDateTime: 'asc' },
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

            return { success: true, data: events };

        } catch (error) {
            logger.error(`Error getting upcoming events: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get ongoing events
     */
    async getOngoingEvents(schoolId, limit = 10) {
        try {
            const now = new Date();
            
            const events = await this.prisma.event.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    isPublished: true,
                    deletedAt: null,
                    startDateTime: { lte: now },
                    endDateTime: { gte: now }
                },
                take: parseInt(limit),
                orderBy: { startDateTime: 'asc' },
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

            return { success: true, data: events };

        } catch (error) {
            logger.error(`Error getting ongoing events: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get past events
     */
    async getPastEvents(schoolId, limit = 10) {
        try {
            const now = new Date();
            
            const events = await this.prisma.event.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    deletedAt: null,
                    endDateTime: { lt: now }
                },
                take: parseInt(limit),
                orderBy: { endDateTime: 'desc' },
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

            return { success: true, data: events };

        } catch (error) {
            logger.error(`Error getting past events: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get events by date range
     */
    async getEventsByDateRange(schoolId, startDate, endDate, filters = {}) {
        try {
            const {
                isPublished,
                targetRole,
                classId,
                limit = 50
            } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                OR: [
                    {
                        startDateTime: {
                            gte: new Date(startDate),
                            lte: new Date(endDate)
                        }
                    },
                    {
                        endDateTime: {
                            gte: new Date(startDate),
                            lte: new Date(endDate)
                        }
                    }
                ],
                ...(isPublished !== undefined && { isPublished }),
                ...(targetRole && { targetRoles: { has: targetRole } }),
                ...(classId && { classIds: { has: parseInt(classId) } })
            };

            const events = await this.prisma.event.findMany({
                where,
                take: parseInt(limit),
                orderBy: { startDateTime: 'asc' },
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

            return { success: true, data: events };

        } catch (error) {
            logger.error(`Error getting events by date range: ${error.message}`);
            throw error;
        }
    }
}
 
export default Event;
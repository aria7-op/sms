import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
class AssignmentAttachment {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new assignment attachment
     */
    async create(data) {
        try {
            const attachment = await this.prisma.assignmentAttachment.create({
                data: {
                    assignmentId: BigInt(data.assignmentId),
                    name: data.name,
                    path: data.path,
                    mimeType: data.mimeType,
                    size: data.size || 0,
                    schoolId: BigInt(data.schoolId)
                },
                include: {
                    assignment: {
                        select: {
                            id: true,
                            title: true,
                            teacher: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            return {
                success: true,
                data: attachment
            };

        } catch (error) {
            logger.error(`Error creating assignment attachment: ${error.message}`);
            throw new Error(`Failed to create attachment: ${error.message}`);
        }
    }

    /**
     * Get attachment by ID
     */
    async getById(id, userId, schoolId, userRole) {
        try {
            const attachment = await this.prisma.assignmentAttachment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    assignment: {
                        include: {
                            teacher: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            class: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            },
                            subject: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            if (!attachment) {
                throw new Error('Attachment not found');
            }

            // Check access permissions based on user role
            if (userRole === 'STUDENT') {
                // Students can only access attachments for assignments in their class
                const student = await this.prisma.student.findFirst({
                    where: { userId: BigInt(userId) }
                });
                
                if (!student || student.classId !== attachment.assignment.classId) {
                    throw new Error('Access denied');
                }
            } else if (userRole === 'TEACHER') {
                // Teachers can only access their own assignment attachments
                if (attachment.assignment.teacherId !== BigInt(userId)) {
                    throw new Error('Access denied');
                }
            }

            return {
                success: true,
                data: attachment
            };

        } catch (error) {
            logger.error(`Error getting assignment attachment: ${error.message}`);
            throw new Error(`Failed to get attachment: ${error.message}`);
        }
    }

    /**
     * Get all attachments for an assignment
     */
    async getByAssignment(assignmentId, schoolId, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

            const where = {
                assignmentId: BigInt(assignmentId),
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            const [attachments, total] = await Promise.all([
                this.prisma.assignmentAttachment.findMany({
                    where,
                    include: {
                        assignment: {
                            select: {
                                id: true,
                                title: true,
                                teacher: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.assignmentAttachment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: attachments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting assignment attachments: ${error.message}`);
            throw new Error(`Failed to get attachments: ${error.message}`);
        }
    }

    /**
     * Get all attachments with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                assignmentId,
                mimeType,
                minSize,
                maxSize,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                schoolId
            } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(assignmentId && { assignmentId: BigInt(assignmentId) }),
                ...(mimeType && { mimeType }),
                ...(minSize && { size: { gte: parseInt(minSize) } }),
                ...(maxSize && { size: { lte: parseInt(maxSize) } }),
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { assignment: { title: { contains: search, mode: 'insensitive' } } }
                    ]
                })
            };

            const [attachments, total] = await Promise.all([
                this.prisma.assignmentAttachment.findMany({
                    where,
                    include: {
                        assignment: {
                            select: {
                                id: true,
                                title: true,
                                teacher: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                class: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                subject: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.assignmentAttachment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: attachments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all attachments: ${error.message}`);
            throw new Error(`Failed to get attachments: ${error.message}`);
        }
    }

    /**
     * Update attachment
     */
    async update(id, updateData, userId, schoolId) {
        try {
            // Check if attachment exists and user has access
            const existingAttachment = await this.prisma.assignmentAttachment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    assignment: {
                        select: {
                            teacherId: true
                        }
                    }
                }
            });

            if (!existingAttachment) {
                throw new Error('Attachment not found');
            }

            // Check if user has permission to update
            if (existingAttachment.assignment.teacherId !== BigInt(userId)) {
                throw new Error('Access denied');
            }

            const updatedAttachment = await this.prisma.assignmentAttachment.update({
                where: { id: BigInt(id) },
                data: {
                    name: updateData.name,
                    path: updateData.path,
                    mimeType: updateData.mimeType,
                    size: updateData.size,
                    updatedAt: new Date()
                },
                include: {
                    assignment: {
                        select: {
                            id: true,
                            title: true,
                            teacher: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            return {
                success: true,
                data: updatedAttachment
            };

        } catch (error) {
            logger.error(`Error updating assignment attachment: ${error.message}`);
            throw new Error(`Failed to update attachment: ${error.message}`);
        }
    }

    /**
     * Delete attachment
     */
    async delete(id, userId, schoolId) {
        try {
            // Check if attachment exists and user has access
            const existingAttachment = await this.prisma.assignmentAttachment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    assignment: {
                        select: {
                            teacherId: true
                        }
                    }
                }
            });

            if (!existingAttachment) {
                throw new Error('Attachment not found');
            }

            // Check if user has permission to delete
            if (existingAttachment.assignment.teacherId !== BigInt(userId)) {
                throw new Error('Access denied');
            }

            await this.prisma.assignmentAttachment.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date()
                }
            });

            return {
                success: true,
                message: 'Attachment deleted successfully'
            };

        } catch (error) {
            logger.error(`Error deleting assignment attachment: ${error.message}`);
            throw new Error(`Failed to delete attachment: ${error.message}`);
        }
    }

    /**
     * Bulk delete attachments
     */
    async bulkDelete(attachmentIds, userId, schoolId) {
        try {
            const attachments = await this.prisma.assignmentAttachment.findMany({
                where: {
                    id: { in: attachmentIds.map(id => BigInt(id)) },
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    assignment: {
                        select: {
                            teacherId: true
                        }
                    }
                }
            });

            // Check if user has permission to delete all attachments
            const unauthorizedAttachments = attachments.filter(
                attachment => attachment.assignment.teacherId !== BigInt(userId)
            );

            if (unauthorizedAttachments.length > 0) {
                throw new Error('Access denied for some attachments');
            }

            await this.prisma.assignmentAttachment.updateMany({
                where: {
                    id: { in: attachmentIds.map(id => BigInt(id)) }
                },
                data: {
                    deletedAt: new Date()
                }
            });

            return {
                success: true,
                message: `${attachments.length} attachments deleted successfully`
            };

        } catch (error) {
            logger.error(`Error bulk deleting attachments: ${error.message}`);
            throw new Error(`Failed to delete attachments: ${error.message}`);
        }
    }

    /**
     * Get attachment statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, assignmentId } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }),
                ...(assignmentId && { assignmentId: BigInt(assignmentId) })
            };

            const [
                totalAttachments,
                totalSize,
                attachmentsByType,
                attachmentsByAssignment,
                recentAttachments
            ] = await Promise.all([
                this.prisma.assignmentAttachment.count({ where }),
                this.prisma.assignmentAttachment.aggregate({
                    where,
                    _sum: { size: true }
                }),
                this.prisma.assignmentAttachment.groupBy({
                    by: ['mimeType'],
                    where,
                    _count: { id: true },
                    _sum: { size: true }
                }),
                this.prisma.assignmentAttachment.groupBy({
                    by: ['assignmentId'],
                    where,
                    _count: { id: true },
                    _sum: { size: true },
                    include: {
                        assignment: {
                            select: {
                                title: true
                            }
                        }
                    }
                }),
                this.prisma.assignmentAttachment.findMany({
                    where,
                    include: {
                        assignment: {
                            select: {
                                title: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                })
            ]);

            return {
                success: true,
                data: {
                    totalAttachments,
                    totalSize: totalSize.size || 0,
                    averageSize: totalAttachments > 0 ? (totalSize.size || 0) / totalAttachments : 0,
                    attachmentsByType,
                    attachmentsByAssignment,
                    recentAttachments
                }
            };

        } catch (error) {
            logger.error(`Error getting attachment statistics: ${error.message}`);
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    /**
     * Search attachments
     */
    async searchAttachments(schoolId, searchTerm, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { assignment: { title: { contains: searchTerm, mode: 'insensitive' } } },
                    { assignment: { description: { contains: searchTerm, mode: 'insensitive' } } }
                ]
            };

            const [attachments, total] = await Promise.all([
                this.prisma.assignmentAttachment.findMany({
                    where,
                    include: {
                        assignment: {
                            select: {
                                id: true,
                                title: true,
                                teacher: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                class: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                subject: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.assignmentAttachment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: attachments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error searching attachments: ${error.message}`);
            throw new Error(`Failed to search attachments: ${error.message}`);
        }
    }

    /**
     * Get attachments by file type
     */
    async getByFileType(schoolId, mimeType, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                mimeType,
                deletedAt: null
            };

            const [attachments, total] = await Promise.all([
                this.prisma.assignmentAttachment.findMany({
                    where,
                    include: {
                        assignment: {
                            select: {
                                id: true,
                                title: true,
                                teacher: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.assignmentAttachment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: attachments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting attachments by file type: ${error.message}`);
            throw new Error(`Failed to get attachments: ${error.message}`);
        }
    }
}
 
export default AssignmentAttachment;
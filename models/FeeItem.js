import { PrismaClient } from '../generated/prisma/client.js';
import { validateFeeItem } from '../validators/feeItemValidator.js';
import { logger } from '../config/logger.js';

class FeeItem {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new fee item
     */
    async create(data) {
        try {
            // Validate input data
            const validation = validateFeeItem(data);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if fee structure exists
            const feeStructure = await this.prisma.feeStructure.findFirst({
                where: {
                    id: parseInt(data.feeStructureId),
                    schoolId: parseInt(data.schoolId),
                    deletedAt: null
                }
            });

            if (!feeStructure) {
                throw new Error('Fee structure not found or does not belong to this school');
            }

            // Create fee item
            const feeItem = await this.prisma.feeItem.create({
                data: {
                    feeStructureId: parseInt(data.feeStructureId),
                    name: data.name,
                    amount: parseFloat(data.amount),
                    isOptional: data.isOptional || false,
                    dueDate: data.dueDate ? new Date(data.dueDate) : null,
                    schoolId: parseInt(data.schoolId),
                    createdBy: parseInt(data.createdBy),
                    updatedBy: data.updatedBy ? parseInt(data.updatedBy) : null
                },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true
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

            logger.info(`Fee item created: ${feeItem.id} by user: ${data.createdBy}`);
            return { success: true, data: feeItem };

        } catch (error) {
            logger.error(`Error creating fee item: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee item by ID
     */
    async getById(id, schoolId) {
        try {
            const feeItem = await this.prisma.feeItem.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            if (!feeItem) {
                throw new Error('Fee item not found');
            }

            return { success: true, data: feeItem };

        } catch (error) {
            logger.error(`Error getting fee item: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all fee items with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                feeStructureId,
                isOptional,
                schoolId,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            // Build where clause
            const where = {
                deletedAt: null,
                ...(schoolId && { schoolId: parseInt(schoolId) }),
                ...(feeStructureId && { feeStructureId: parseInt(feeStructureId) }),
                ...(isOptional !== undefined && { isOptional }),
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.feeItem.count({ where });

            // Get fee items
            const feeItems = await this.prisma.feeItem.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true
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

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: feeItems,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting fee items: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee items by fee structure
     */
    async getByFeeStructure(feeStructureId, schoolId) {
        try {
            const feeItems = await this.prisma.feeItem.findMany({
                where: {
                    feeStructureId: parseInt(feeStructureId),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                },
                orderBy: { name: 'asc' },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            return { success: true, data: feeItems };

        } catch (error) {
            logger.error(`Error getting fee items by fee structure: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee items by school
     */
    async getBySchool(schoolId, filters = {}) {
        try {
            const { isOptional, dueDate } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(isOptional !== undefined && { isOptional }),
                ...(dueDate && { dueDate: new Date(dueDate) })
            };

            const feeItems = await this.prisma.feeItem.findMany({
                where,
                orderBy: { name: 'asc' },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true,
                            class: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            return { success: true, data: feeItems };

        } catch (error) {
            logger.error(`Error getting fee items by school: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update fee item
     */
    async update(id, data, schoolId) {
        try {
            // Check if fee item exists
            const existingFeeItem = await this.prisma.feeItem.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingFeeItem) {
                throw new Error('Fee item not found');
            }

            // Validate update data
            const validation = validateFeeItem(data, true);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if fee structure exists if being updated
            if (data.feeStructureId) {
                const feeStructure = await this.prisma.feeStructure.findFirst({
                    where: {
                        id: parseInt(data.feeStructureId),
                        schoolId: parseInt(schoolId),
                        deletedAt: null
                    }
                });

                if (!feeStructure) {
                    throw new Error('Fee structure not found or does not belong to this school');
                }
            }

            // Update fee item
            const feeItem = await this.prisma.feeItem.update({
                where: { id: parseInt(id) },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.amount && { amount: parseFloat(data.amount) }),
                    ...(data.isOptional !== undefined && { isOptional: data.isOptional }),
                    ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
                    ...(data.feeStructureId && { feeStructureId: parseInt(data.feeStructureId) }),
                    updatedBy: data.updatedBy ? parseInt(data.updatedBy) : null,
                    updatedAt: new Date()
                },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true
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

            logger.info(`Fee item updated: ${id}`);
            return { success: true, data: feeItem };

        } catch (error) {
            logger.error(`Error updating fee item: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete fee item (soft delete)
     */
    async delete(id, schoolId, deletedBy) {
        try {
            const feeItem = await this.prisma.feeItem.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!feeItem) {
                throw new Error('Fee item not found');
            }

            // Check if there are any payment items associated with this fee item
            const paymentItemsCount = await this.prisma.paymentItem.count({
                where: {
                    feeItemId: parseInt(id),
                    deletedAt: null
                }
            });

            if (paymentItemsCount > 0) {
                throw new Error('Cannot delete fee item with associated payment items');
            }

            await this.prisma.feeItem.update({
                where: { id: parseInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: parseInt(deletedBy)
                }
            });

            logger.info(`Fee item deleted: ${id}`);
            return { success: true, message: 'Fee item deleted successfully' };

        } catch (error) {
            logger.error(`Error deleting fee item: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee item statistics
     */
    async getStatistics(schoolId) {
        try {
            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null
            };

            const [
                totalFeeItems,
                optionalFeeItems,
                feeItemsWithDueDate,
                feeItemsWithoutDueDate
            ] = await Promise.all([
                this.prisma.feeItem.count({ where }),
                this.prisma.feeItem.count({
                    where: { ...where, isOptional: true }
                }),
                this.prisma.feeItem.count({
                    where: { ...where, dueDate: { not: null } }
                }),
                this.prisma.feeItem.count({
                    where: { ...where, dueDate: null }
                })
            ]);

            return {
                success: true,
                data: {
                    totalFeeItems,
                    optionalFeeItems,
                    requiredFeeItems: totalFeeItems - optionalFeeItems,
                    feeItemsWithDueDate,
                    feeItemsWithoutDueDate
                }
            };

        } catch (error) {
            logger.error(`Error getting fee item statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search fee items
     */
    async searchFeeItems(schoolId, searchTerm, filters = {}) {
        try {
            const {
                feeStructureId,
                isOptional,
                limit = 20
            } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } }
                ],
                ...(feeStructureId && { feeStructureId: parseInt(feeStructureId) }),
                ...(isOptional !== undefined && { isOptional })
            };

            const feeItems = await this.prisma.feeItem.findMany({
                where,
                take: parseInt(limit),
                orderBy: { name: 'asc' },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            return { success: true, data: feeItems };

        } catch (error) {
            logger.error(`Error searching fee items: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee items by due date range
     */
    async getByDueDateRange(schoolId, startDate, endDate) {
        try {
            const feeItems = await this.prisma.feeItem.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    deletedAt: null,
                    dueDate: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                },
                orderBy: { dueDate: 'asc' },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true,
                            class: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            return { success: true, data: feeItems };

        } catch (error) {
            logger.error(`Error getting fee items by due date range: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get upcoming due fee items
     */
    async getUpcomingDueItems(schoolId, days = 30) {
        try {
            const today = new Date();
            const endDate = new Date();
            endDate.setDate(today.getDate() + days);

            const feeItems = await this.prisma.feeItem.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    deletedAt: null,
                    dueDate: {
                        gte: today,
                        lte: endDate
                    }
                },
                orderBy: { dueDate: 'asc' },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true,
                            class: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            return { success: true, data: feeItems };

        } catch (error) {
            logger.error(`Error getting upcoming due fee items: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get overdue fee items
     */
    async getOverdueItems(schoolId) {
        try {
            const today = new Date();

            const feeItems = await this.prisma.feeItem.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    deletedAt: null,
                    dueDate: {
                        lt: today,
                        not: null
                    }
                },
                orderBy: { dueDate: 'asc' },
                include: {
                    feeStructure: {
                        select: {
                            id: true,
                            name: true,
                            class: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    }
                }
            });

            return { success: true, data: feeItems };

        } catch (error) {
            logger.error(`Error getting overdue fee items: ${error.message}`);
            throw error;
        }
    }
}

export default FeeItem;
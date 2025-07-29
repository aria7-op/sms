import { PrismaClient } from '../generated/prisma/client.js';
import { validateFeeStructure } from '../validators/feeValidator.js';
import { logger } from '../config/logger.js';

class Fee {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new fee structure
     */
    async create(data) {
        try {
            // Validate input data
            const validation = validateFeeStructure(data);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if default structure already exists for this class/school
            if (data.isDefault) {
                const existingDefault = await this.prisma.feeStructure.findFirst({
                    where: {
                        schoolId: data.schoolId,
                        ...(data.classId && { classId: data.classId }),
                        isDefault: true,
                        deletedAt: null
                    }
                });

                if (existingDefault) {
                    throw new Error('A default fee structure already exists for this class/school');
                }
            }

            // Create fee structure
            const feeStructure = await this.prisma.feeStructure.create({
                data: {
                    name: data.name,
                    description: data.description,
                    classId: data.classId ? parseInt(data.classId) : null,
                    isDefault: data.isDefault || false,
                    schoolId: parseInt(data.schoolId),
                    createdBy: parseInt(data.createdBy),
                    updatedBy: data.updatedBy ? parseInt(data.updatedBy) : null
                },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    class: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            logger.info(`Fee structure created: ${feeStructure.id} by user: ${data.createdBy}`);
            return { success: true, data: feeStructure };

        } catch (error) {
            logger.error(`Error creating fee structure: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee structure by ID
     */
    async getById(id, schoolId) {
        try {
            const feeStructure = await this.prisma.feeStructure.findFirst({
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
                    class: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    items: {
                        where: {
                            deletedAt: null
                        },
                        orderBy: {
                            name: 'asc'
                        }
                    }
                }
            });

            if (!feeStructure) {
                throw new Error('Fee structure not found');
            }

            return { success: true, data: feeStructure };

        } catch (error) {
            logger.error(`Error getting fee structure: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all fee structures with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isDefault,
                classId,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            // Build where clause
            const where = {
                deletedAt: null,
                ...(filters.schoolId && { schoolId: parseInt(filters.schoolId) }),
                ...(isDefault !== undefined && { isDefault }),
                ...(classId && { classId: parseInt(classId) }),
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.feeStructure.count({ where });

            // Get fee structures
            const feeStructures = await this.prisma.feeStructure.findMany({
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
                    class: {
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
                data: feeStructures,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting fee structures: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get default fee structure for a class or school
     */
    async getDefaultFeeStructure(schoolId, classId = null) {
        try {
            const where = {
                schoolId: parseInt(schoolId),
                isDefault: true,
                deletedAt: null,
                ...(classId && { classId: parseInt(classId) })
            };

            const feeStructure = await this.prisma.feeStructure.findFirst({
                where,
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    class: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    items: {
                        where: {
                            deletedAt: null
                        },
                        orderBy: {
                            name: 'asc'
                        }
                    }
                }
            });

            if (!feeStructure) {
                throw new Error('Default fee structure not found');
            }

            return { success: true, data: feeStructure };

        } catch (error) {
            logger.error(`Error getting default fee structure: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update fee structure
     */
    async update(id, data, schoolId) {
        try {
            // Check if fee structure exists
            const existingFeeStructure = await this.prisma.feeStructure.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingFeeStructure) {
                throw new Error('Fee structure not found');
            }

            // Validate update data
            const validation = validateFeeStructure(data, true);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if trying to set as default and another default already exists
            if (data.isDefault && data.isDefault !== existingFeeStructure.isDefault) {
                const existingDefault = await this.prisma.feeStructure.findFirst({
                    where: {
                        schoolId: parseInt(schoolId),
                        classId: data.classId ? parseInt(data.classId) : existingFeeStructure.classId,
                        isDefault: true,
                        deletedAt: null,
                        NOT: { id: parseInt(id) }
                    }
                });

                if (existingDefault) {
                    throw new Error('A default fee structure already exists for this class/school');
                }
            }

            // Update fee structure
            const feeStructure = await this.prisma.feeStructure.update({
                where: { id: parseInt(id) },
                data: {
                    ...(data.name && { name: data.name }),
                    ...(data.description && { description: data.description }),
                    ...(data.classId !== undefined && { classId: data.classId ? parseInt(data.classId) : null }),
                    ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
                    updatedBy: data.updatedBy ? parseInt(data.updatedBy) : null,
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
                    class: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            logger.info(`Fee structure updated: ${id}`);
            return { success: true, data: feeStructure };

        } catch (error) {
            logger.error(`Error updating fee structure: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete fee structure (soft delete)
     */
    async delete(id, schoolId, deletedBy) {
        try {
            const feeStructure = await this.prisma.feeStructure.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!feeStructure) {
                throw new Error('Fee structure not found');
            }

            // Check if there are any payments associated with this fee structure
            const paymentsCount = await this.prisma.payment.count({
                where: {
                    feeStructureId: parseInt(id),
                    deletedAt: null
                }
            });

            if (paymentsCount > 0) {
                throw new Error('Cannot delete fee structure with associated payments');
            }

            await this.prisma.feeStructure.update({
                where: { id: parseInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: parseInt(deletedBy)
                }
            });

            logger.info(`Fee structure deleted: ${id}`);
            return { success: true, message: 'Fee structure deleted successfully' };

        } catch (error) {
            logger.error(`Error deleting fee structure: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee structure statistics
     */
    async getStatistics(schoolId) {
        try {
            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null
            };

            const [
                totalFeeStructures,
                defaultFeeStructures,
                classSpecificFeeStructures,
                feeStructuresWithItems
            ] = await Promise.all([
                this.prisma.feeStructure.count({ where }),
                this.prisma.feeStructure.count({
                    where: { ...where, isDefault: true }
                }),
                this.prisma.feeStructure.count({
                    where: { ...where, classId: { not: null } }
                }),
                this.prisma.feeStructure.count({
                    where: {
                        ...where,
                        items: {
                            some: {
                                deletedAt: null
                            }
                        }
                    }
                })
            ]);

            return {
                success: true,
                data: {
                    totalFeeStructures,
                    defaultFeeStructures,
                    classSpecificFeeStructures,
                    feeStructuresWithItems,
                    feeStructuresWithoutItems: totalFeeStructures - feeStructuresWithItems
                }
            };

        } catch (error) {
            logger.error(`Error getting fee structure statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search fee structures
     */
    async searchFeeStructures(schoolId, searchTerm, filters = {}) {
        try {
            const {
                isDefault,
                classId,
                limit = 20
            } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { description: { contains: searchTerm, mode: 'insensitive' } }
                ],
                ...(isDefault !== undefined && { isDefault }),
                ...(classId && { classId: parseInt(classId) })
            };

            const feeStructures = await this.prisma.feeStructure.findMany({
                where,
                take: parseInt(limit),
                orderBy: { name: 'asc' },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    class: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            return { success: true, data: feeStructures };

        } catch (error) {
            logger.error(`Error searching fee structures: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee structures by class
     */
    async getByClass(schoolId, classId) {
        try {
            const feeStructures = await this.prisma.feeStructure.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    classId: parseInt(classId),
                    deletedAt: null
                },
                orderBy: { name: 'asc' },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    class: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    items: {
                        where: {
                            deletedAt: null
                        },
                        orderBy: {
                            name: 'asc'
                        }
                    }
                }
            });

            return { success: true, data: feeStructures };

        } catch (error) {
            logger.error(`Error getting fee structures by class: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get fee structures that apply to a specific class
     * (both class-specific and default school-wide structures)
     */
    async getApplicableFeeStructures(schoolId, classId) {
        try {
            const feeStructures = await this.prisma.feeStructure.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    deletedAt: null,
                    OR: [
                        { classId: parseInt(classId) },
                        { isDefault: true, classId: null }
                    ]
                },
                orderBy: [
                    { isDefault: 'asc' }, // Class-specific first
                    { name: 'asc' }
                ],
                include: {
                    items: {
                        where: {
                            deletedAt: null
                        },
                        orderBy: {
                            name: 'asc'
                        }
                    }
                }
            });

            return { success: true, data: feeStructures };

        } catch (error) {
            logger.error(`Error getting applicable fee structures: ${error.message}`);
            throw error;
        }
    }
}

export default Fee;
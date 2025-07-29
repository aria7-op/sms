import { PrismaClient } from '../generated/prisma/client.js';
import { validateParent } from '../validators/parentValidator.js';
import logger from '../config/logger.js';

class Parent {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new parent
     */
    async create(data) {
        try {
            // Validate input data
            const validation = validateParent(data);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if user exists and is of appropriate type
            const user = await this.prisma.user.findUnique({
                where: { id: data.userId }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Check if school exists
            const school = await this.prisma.school.findUnique({
                where: { id: data.schoolId }
            });

            if (!school) {
                throw new Error('School not found');
            }

            // Create parent
            const parent = await this.prisma.parent.create({
                data: {
                    userId: data.userId,
                    occupation: data.occupation,
                    annualIncome: data.annualIncome,
                    education: data.education,
                    schoolId: data.schoolId,
                    createdBy: data.createdBy,
                    updatedBy: data.updatedBy
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            role: true
                        }
                    },
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
                            email: true
                        }
                    }
                }
            });

            logger.info(`Parent created: ${parent.id} for user ${data.userId}`);
            return { success: true, data: parent };

        } catch (error) {
            logger.error(`Error creating parent: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get parent by ID
     */
    async getById(id, userId, schoolId, userRole) {
        try {
            let where = {
                id: parseInt(id),
                schoolId: parseInt(schoolId),
                deletedAt: null
            };

            // Role-based access control
            if (userRole === 'PARENT') {
                // Parents can only see their own record
                where.userId = parseInt(userId);
            }
            // ADMIN, OWNER, and TEACHER can see all parents

            const parent = await this.prisma.parent.findFirst({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            role: true,
                            status: true
                        }
                    },
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
                            email: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    students: {
                        where: { deletedAt: null },
                        select: {
                            id: true,
                            name: true,
                            rollNumber: true,
                            class: {
                                select: {
                                    id: true,
                                    name: true,
                                    code: true
                                }
                            }
                        }
                    },
                    payments: {
                        where: { deletedAt: null },
                        select: {
                            id: true,
                            amount: true,
                            paymentDate: true,
                            paymentMethod: true,
                            status: true,
                            invoice: {
                                select: {
                                    id: true,
                                    invoiceNumber: true
                                }
                            }
                        }
                    }
                }
            });

            if (!parent) {
                throw new Error('Parent not found');
            }

            return { success: true, data: parent };

        } catch (error) {
            logger.error(`Error getting parent: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all parents with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                education,
                minIncome,
                maxIncome
            } = filters;

            const skip = (page - 1) * limit;

            // Build where clause
            const where = {
                deletedAt: null,
                ...(filters.schoolId && { schoolId: parseInt(filters.schoolId) }),
                ...(education && { education }),
                ...(minIncome && { annualIncome: { gte: parseFloat(minIncome) } }),
                ...(maxIncome && { annualIncome: { lte: parseFloat(maxIncome) } }),
                ...(search && {
                    OR: [
                        { 
                            user: {
                                name: { contains: search, mode: 'insensitive' }
                            }
                        },
                        { 
                            user: {
                                email: { contains: search, mode: 'insensitive' }
                            }
                        },
                        { occupation: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.parent.count({ where });

            // Get parents
            const parents = await this.prisma.parent.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            role: true
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    _count: {
                        select: {
                            students: true,
                            payments: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: parents,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting parents: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get parents by school
     */
    async getBySchool(schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(search && {
                    OR: [
                        { 
                            user: {
                                name: { contains: search, mode: 'insensitive' }
                            }
                        },
                        { 
                            user: {
                                email: { contains: search, mode: 'insensitive' }
                            }
                        }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.parent.count({ where });

            // Get parents
            const parents = await this.prisma.parent.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true
                        }
                    },
                    _count: {
                        select: {
                            students: true,
                            payments: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: parents,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting parents by school: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get parents by student
     */
    async getByStudent(studentId, schoolId) {
        try {
            // Check if student exists
            const student = await this.prisma.student.findFirst({
                where: {
                    id: parseInt(studentId),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!student) {
                throw new Error('Student not found');
            }

            // Get parents for this student
            const parents = await this.prisma.parent.findMany({
                where: {
                    students: {
                        some: {
                            id: parseInt(studentId)
                        }
                    },
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true
                        }
                    }
                }
            });

            return { success: true, data: parents };

        } catch (error) {
            logger.error(`Error getting parents by student: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update parent
     */
    async update(id, data, userId, schoolId) {
        try {
            // Check if parent exists and user has permission
            const existingParent = await this.prisma.parent.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingParent) {
                throw new Error('Parent not found');
            }

            // Validate update data
            const validation = validateParent(data, true);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Update parent
            const parent = await this.prisma.parent.update({
                where: { id: parseInt(id) },
                data: {
                    ...(data.occupation && { occupation: data.occupation }),
                    ...(data.annualIncome && { annualIncome: data.annualIncome }),
                    ...(data.education && { education: data.education }),
                    updatedBy: parseInt(userId),
                    updatedAt: new Date()
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    }
                }
            });

            logger.info(`Parent updated: ${id}`);
            return { success: true, data: parent };

        } catch (error) {
            logger.error(`Error updating parent: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete parent (soft delete)
     */
    async delete(id, userId, schoolId) {
        try {
            const parent = await this.prisma.parent.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!parent) {
                throw new Error('Parent not found');
            }

            // Check if parent has any active students
            const activeStudents = await this.prisma.student.count({
                where: {
                    parentId: parseInt(id),
                    deletedAt: null
                }
            });

            if (activeStudents > 0) {
                throw new Error('Cannot delete parent with active students');
            }

            await this.prisma.parent.update({
                where: { id: parseInt(id) },
                data: { deletedAt: new Date() }
            });

            logger.info(`Parent deleted: ${id}`);
            return { success: true, message: 'Parent deleted successfully' };

        } catch (error) {
            logger.error(`Error deleting parent: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get parent statistics
     */
    async getStatistics(schoolId) {
        try {
            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null
            };

            const [
                totalParents,
                parentsWithStudents,
                parentsWithPayments
            ] = await Promise.all([
                this.prisma.parent.count({ where }),
                this.prisma.parent.count({
                    where: {
                        ...where,
                        students: { some: {} }
                    }
                }),
                this.prisma.parent.count({
                    where: {
                        ...where,
                        payments: { some: {} }
                    }
                })
            ]);

            return {
                success: true,
                data: {
                    totalParents,
                    parentsWithStudents,
                    parentsWithPayments,
                    parentsWithoutStudents: totalParents - parentsWithStudents
                }
            };

        } catch (error) {
            logger.error(`Error getting parent statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get parent analytics
     */
    async getAnalytics(schoolId, filters = {}) {
        try {
            const { startDate, endDate } = filters;

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

            // Get parents by education level
            const educationAnalytics = await this.prisma.parent.groupBy({
                by: ['education'],
                where,
                _count: { id: true },
                orderBy: {
                    _count: {
                        id: 'desc'
                    }
                }
            });

            // Get parents by income range
            const incomeAnalytics = await this.prisma.$queryRaw`
                SELECT 
                    CASE
                        WHEN "annualIncome" < 30000 THEN 'Under 30k'
                        WHEN "annualIncome" >= 30000 AND "annualIncome" < 60000 THEN '30k-60k'
                        WHEN "annualIncome" >= 60000 AND "annualIncome" < 100000 THEN '60k-100k'
                        WHEN "annualIncome" >= 100000 THEN 'Over 100k'
                        ELSE 'Not specified'
                    END as income_range,
                    COUNT(*) as count
                FROM parents
                WHERE "schoolId" = ${parseInt(schoolId)} 
                AND "deletedAt" IS NULL
                ${startDate ? `AND "createdAt" >= ${new Date(startDate)}` : ''}
                ${endDate ? `AND "createdAt" <= ${new Date(endDate)}` : ''}
                GROUP BY income_range
                ORDER BY count DESC
            `;

            return {
                success: true,
                data: {
                    educationAnalytics,
                    incomeAnalytics
                }
            };

        } catch (error) {
            logger.error(`Error getting parent analytics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search parents
     */
    async searchParents(schoolId, searchTerm, filters = {}) {
        try {
            const {
                limit = 20
            } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                OR: [
                    { 
                        user: {
                            name: { contains: searchTerm, mode: 'insensitive' }
                        }
                    },
                    { 
                        user: {
                            email: { contains: searchTerm, mode: 'insensitive' }
                        }
                    },
                    { occupation: { contains: searchTerm, mode: 'insensitive' } }
                ]
            };

            const parents = await this.prisma.parent.findMany({
                where,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true
                        }
                    },
                    _count: {
                        select: {
                            students: true
                        }
                    }
                }
            });

            return { success: true, data: parents };

        } catch (error) {
            logger.error(`Error searching parents: ${error.message}`);
            throw error;
        }
    }

    /**
     * Add student to parent
     */
    async addStudent(parentId, studentId, userId, schoolId) {
        try {
            // Check if parent exists
            const parent = await this.prisma.parent.findFirst({
                where: {
                    id: parseInt(parentId),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!parent) {
                throw new Error('Parent not found');
            }

            // Check if student exists
            const student = await this.prisma.student.findFirst({
                where: {
                    id: parseInt(studentId),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!student) {
                throw new Error('Student not found');
            }

            // Check if relationship already exists
            const existingRelationship = await this.prisma.student.findFirst({
                where: {
                    id: parseInt(studentId),
                    parentId: parseInt(parentId)
                }
            });

            if (existingRelationship) {
                throw new Error('Student is already associated with this parent');
            }

            // Add student to parent
            await this.prisma.student.update({
                where: { id: parseInt(studentId) },
                data: {
                    parentId: parseInt(parentId),
                    updatedBy: parseInt(userId)
                }
            });

            logger.info(`Student ${studentId} added to parent ${parentId}`);
            return { success: true, message: 'Student added to parent successfully' };

        } catch (error) {
            logger.error(`Error adding student to parent: ${error.message}`);
            throw error;
        }
    }

    /**
     * Remove student from parent
     */
    async removeStudent(parentId, studentId, userId, schoolId) {
        try {
            // Check if parent exists
            const parent = await this.prisma.parent.findFirst({
                where: {
                    id: parseInt(parentId),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!parent) {
                throw new Error('Parent not found');
            }

            // Check if student exists
            const student = await this.prisma.student.findFirst({
                where: {
                    id: parseInt(studentId),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!student) {
                throw new Error('Student not found');
            }

            // Check if relationship exists
            if (student.parentId !== parseInt(parentId)) {
                throw new Error('Student is not associated with this parent');
            }

            // Remove student from parent
            await this.prisma.student.update({
                where: { id: parseInt(studentId) },
                data: {
                    parentId: null,
                    updatedBy: parseInt(userId)
                }
            });

            logger.info(`Student ${studentId} removed from parent ${parentId}`);
            return { success: true, message: 'Student removed from parent successfully' };

        } catch (error) {
            logger.error(`Error removing student from parent: ${error.message}`);
            throw error;
        }
    }
}

module.exports = Parent;
import { PrismaClient } from '../generated/prisma/client.js';
import { validateAssignment } from '../validators/assignmentValidator.js';
import logger from '../config/logger.js';
class Assignment {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new assignment
     */
    async create(data) {
        try {
            // Validate input data
            const validation = validateAssignment(data);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if teacher exists
            const teacher = await this.prisma.user.findUnique({
                where: { id: data.teacherId },
                include: { school: true }
            });

            if (!teacher) {
                throw new Error('Teacher not found');
            }

            // Check if class exists (if provided)
            if (data.classId) {
                const classExists = await this.prisma.class.findUnique({
                    where: { id: data.classId }
                });
                if (!classExists) {
                    throw new Error('Class not found');
                }
            }

            // Check if subject exists (if provided)
            if (data.subjectId) {
                const subjectExists = await this.prisma.subject.findUnique({
                    where: { id: data.subjectId }
                });
                if (!subjectExists) {
                    throw new Error('Subject not found');
                }
            }

            // Create assignment
            const assignment = await this.prisma.assignment.create({
                data: {
                    title: data.title,
                    description: data.description,
                    dueDate: new Date(data.dueDate),
                    maxScore: data.maxScore,
                    classId: data.classId,
                    subjectId: data.subjectId,
                    teacherId: data.teacherId,
                    schoolId: data.schoolId,
                    createdBy: data.createdBy,
                    updatedBy: data.updatedBy
                },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
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
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    }
                }
            });

            logger.info(`Assignment created: ${assignment.id} by teacher ${data.teacherId}`);
            return { success: true, data: assignment };

        } catch (error) {
            logger.error(`Error creating assignment: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get assignment by ID
     */
    async getById(id, userId, schoolId, userRole) {
        try {
            let where = {
                id: parseInt(id),
                schoolId: parseInt(schoolId),
                deletedAt: null
            };

            // Role-based access control
            if (userRole === 'STUDENT') {
                // Students can only see assignments for their class
                const student = await this.prisma.student.findFirst({
                    where: { userId: parseInt(userId) }
                });
                if (student && student.classId) {
                    where.classId = student.classId;
                }
            } else if (userRole === 'TEACHER') {
                // Teachers can see their own assignments
                where.teacherId = parseInt(userId);
            }
            // ADMIN and OWNER can see all assignments

            const assignment = await this.prisma.assignment.findFirst({
                where,
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
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
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    updatedByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    attachments: {
                        where: { deletedAt: null },
                        select: {
                            id: true,
                            name: true,
                            path: true,
                            mimeType: true,
                            size: true
                        }
                    },
                    submissions: {
                        where: { deletedAt: null },
                        include: {
                            student: {
                                select: {
                                    id: true,
                                    name: true,
                                    rollNumber: true
                                }
                            },
                            attachments: {
                                where: { deletedAt: null },
                                select: {
                                    id: true,
                                    name: true,
                                    path: true,
                                    mimeType: true,
                                    size: true
                                }
                            }
                        }
                    }
                }
            });

            if (!assignment) {
                throw new Error('Assignment not found');
            }

            return { success: true, data: assignment };

        } catch (error) {
            logger.error(`Error getting assignment: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all assignments with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                classId,
                subjectId,
                teacherId,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                status,
                dueDateFrom,
                dueDateTo
            } = filters;

            const skip = (page - 1) * limit;

            // Build where clause
            const where = {
                deletedAt: null,
                ...(filters.schoolId && { schoolId: parseInt(filters.schoolId) }),
                ...(classId && { classId: parseInt(classId) }),
                ...(subjectId && { subjectId: parseInt(subjectId) }),
                ...(teacherId && { teacherId: parseInt(teacherId) }),
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } }
                    ]
                }),
                ...(dueDateFrom && dueDateTo && {
                    dueDate: {
                        gte: new Date(dueDateFrom),
                        lte: new Date(dueDateTo)
                    }
                })
            };

            // Get total count
            const total = await this.prisma.assignment.count({ where });

            // Get assignments
            const assignments = await this.prisma.assignment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    },
                    createdByUser: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true
                        }
                    },
                    _count: {
                        select: {
                            submissions: true,
                            attachments: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: assignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting assignments: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get assignments by teacher
     */
    async getByTeacher(teacherId, schoolId, filters = {}) {
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
                teacherId: parseInt(teacherId),
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.assignment.count({ where });

            // Get assignments
            const assignments = await this.prisma.assignment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    _count: {
                        select: {
                            submissions: true,
                            attachments: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: assignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting assignments by teacher: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get assignments by class
     */
    async getByClass(classId, schoolId, filters = {}) {
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
                classId: parseInt(classId),
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.assignment.count({ where });

            // Get assignments
            const assignments = await this.prisma.assignment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    },
                    _count: {
                        select: {
                            submissions: true,
                            attachments: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: assignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting assignments by class: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get assignments by subject
     */
    async getBySubject(subjectId, schoolId, filters = {}) {
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
                subjectId: parseInt(subjectId),
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.assignment.count({ where });

            // Get assignments
            const assignments = await this.prisma.assignment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    },
                    _count: {
                        select: {
                            submissions: true,
                            attachments: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: assignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting assignments by subject: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get student assignments
     */
    async getStudentAssignments(studentId, schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                sortBy = 'dueDate',
                sortOrder = 'asc'
            } = filters;

            const skip = (page - 1) * limit;

            // Get student's class
            const student = await this.prisma.student.findFirst({
                where: { id: parseInt(studentId) }
            });

            if (!student || !student.classId) {
                return {
                    success: true,
                    data: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: 0,
                        totalPages: 0
                    }
                };
            }

            const where = {
                classId: student.classId,
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(search && {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.assignment.count({ where });

            // Get assignments
            const assignments = await this.prisma.assignment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    },
                    submissions: {
                        where: { studentId: parseInt(studentId) },
                        select: {
                            id: true,
                            submittedAt: true,
                            score: true,
                            feedback: true
                        }
                    },
                    _count: {
                        select: {
                            submissions: true,
                            attachments: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: assignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting student assignments: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update assignment
     */
    async update(id, data, userId, schoolId) {
        try {
            // Check if assignment exists and user has permission
            const existingAssignment = await this.prisma.assignment.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    teacherId: parseInt(userId),
                    deletedAt: null
                }
            });

            if (!existingAssignment) {
                throw new Error('Assignment not found or you do not have permission to edit it');
            }

            // Validate update data
            const validation = validateAssignment(data, true);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Update assignment
            const assignment = await this.prisma.assignment.update({
                where: { id: parseInt(id) },
                data: {
                    ...(data.title && { title: data.title }),
                    ...(data.description && { description: data.description }),
                    ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
                    ...(data.maxScore && { maxScore: data.maxScore }),
                    ...(data.classId && { classId: data.classId }),
                    ...(data.subjectId && { subjectId: data.subjectId }),
                    updatedBy: parseInt(userId),
                    updatedAt: new Date()
                },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            logger.info(`Assignment updated: ${id}`);
            return { success: true, data: assignment };

        } catch (error) {
            logger.error(`Error updating assignment: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete assignment (soft delete)
     */
    async delete(id, userId, schoolId) {
        try {
            const assignment = await this.prisma.assignment.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    teacherId: parseInt(userId),
                    deletedAt: null
                }
            });

            if (!assignment) {
                throw new Error('Assignment not found or you do not have permission to delete it');
            }

            await this.prisma.assignment.update({
                where: { id: parseInt(id) },
                data: { deletedAt: new Date() }
            });

            logger.info(`Assignment deleted: ${id}`);
            return { success: true, message: 'Assignment deleted successfully' };

        } catch (error) {
            logger.error(`Error deleting assignment: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get assignment statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { teacherId, classId, subjectId, startDate, endDate } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                ...(teacherId && { teacherId: parseInt(teacherId) }),
                ...(classId && { classId: parseInt(classId) }),
                ...(subjectId && { subjectId: parseInt(subjectId) }),
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                })
            };

            const [
                totalAssignments,
                assignmentsWithSubmissions,
                overdueAssignments,
                upcomingAssignments
            ] = await Promise.all([
                this.prisma.assignment.count({ where }),
                this.prisma.assignment.count({
                    where: {
                        ...where,
                        submissions: { some: {} }
                    }
                }),
                this.prisma.assignment.count({
                    where: {
                        ...where,
                        dueDate: { lt: new Date() }
                    }
                }),
                this.prisma.assignment.count({
                    where: {
                        ...where,
                        dueDate: { gte: new Date() }
                    }
                })
            ]);

            return {
                success: true,
                data: {
                    totalAssignments,
                    assignmentsWithSubmissions,
                    overdueAssignments,
                    upcomingAssignments
                }
            };

        } catch (error) {
            logger.error(`Error getting assignment statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get assignment analytics
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

            // Get assignments by month
            const monthlyAnalytics = await this.prisma.$queryRaw`
                SELECT 
                    DATE_TRUNC('month', "createdAt") as month,
                    COUNT(*) as total_assignments,
                    COUNT(CASE WHEN "dueDate" < NOW() THEN 1 END) as overdue_assignments
                FROM assignments 
                WHERE "schoolId" = ${parseInt(schoolId)} 
                AND "deletedAt" IS NULL
                ${startDate ? `AND "createdAt" >= ${new Date(startDate)}` : ''}
                ${endDate ? `AND "createdAt" <= ${new Date(endDate)}` : ''}
                GROUP BY DATE_TRUNC('month', "createdAt")
                ORDER BY month DESC
            `;

            // Get assignments by subject
            const subjectAnalytics = await this.prisma.assignment.groupBy({
                by: ['subjectId'],
                where,
                _count: { id: true },
                include: {
                    subject: {
                        select: {
                            name: true,
                            code: true
                        }
                    }
                }
            });

            return {
                success: true,
                data: {
                    monthlyAnalytics,
                    subjectAnalytics
                }
            };

        } catch (error) {
            logger.error(`Error getting assignment analytics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search assignments
     */
    async searchAssignments(schoolId, searchTerm, filters = {}) {
        try {
            const {
                limit = 20
            } = filters;

            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                OR: [
                    { title: { contains: searchTerm, mode: 'insensitive' } },
                    { description: { contains: searchTerm, mode: 'insensitive' } }
                ]
            };

            const assignments = await this.prisma.assignment.findMany({
                where,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            return { success: true, data: assignments };

        } catch (error) {
            logger.error(`Error searching assignments: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get overdue assignments
     */
    async getOverdueAssignments(schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                teacherId,
                classId
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                schoolId: parseInt(schoolId),
                dueDate: { lt: new Date() },
                deletedAt: null,
                ...(teacherId && { teacherId: parseInt(teacherId) }),
                ...(classId && { classId: parseInt(classId) })
            };

            const total = await this.prisma.assignment.count({ where });

            const assignments = await this.prisma.assignment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { dueDate: 'asc' },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    },
                    _count: {
                        select: {
                            submissions: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: assignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting overdue assignments: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get upcoming assignments
     */
    async getUpcomingAssignments(schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                teacherId,
                classId,
                days = 7
            } = filters;

            const skip = (page - 1) * limit;
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + parseInt(days));

            const where = {
                schoolId: parseInt(schoolId),
                dueDate: {
                    gte: new Date(),
                    lte: endDate
                },
                deletedAt: null,
                ...(teacherId && { teacherId: parseInt(teacherId) }),
                ...(classId && { classId: parseInt(classId) })
            };

            const total = await this.prisma.assignment.count({ where });

            const assignments = await this.prisma.assignment.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { dueDate: 'asc' },
                include: {
                    class: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    subject: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    },
                    teacher: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            email: true,
                            role: true
                        }
                    },
                    _count: {
                        select: {
                            submissions: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: assignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting upcoming assignments: ${error.message}`);
            throw error;
        }
    }
}

export default Assignment;
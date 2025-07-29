import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

class AssignmentSubmission {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new assignment submission
     */
    async create(data) {
        try {
            const submission = await this.prisma.assignmentSubmission.create({
                data: {
                    assignmentId: BigInt(data.assignmentId),
                    studentId: BigInt(data.studentId),
                    content: data.content,
                    submittedAt: data.submittedAt || new Date(),
                    status: data.status || 'SUBMITTED',
                    score: data.score || null,
                    feedback: data.feedback || null,
                    gradedAt: data.gradedAt || null,
                    gradedBy: data.gradedBy ? BigInt(data.gradedBy) : null,
                    schoolId: BigInt(data.schoolId)
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            user: {
                                select: {
                                    id: true,
                                    email: true
                                }
                            }
                        }
                    },
                    assignment: {
                        select: {
                            id: true,
                            title: true,
                            dueDate: true,
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
                data: submission
            };

        } catch (error) {
            logger.error(`Error creating assignment submission: ${error.message}`);
            throw new Error(`Failed to create submission: ${error.message}`);
        }
    }

    /**
     * Get submission by ID
     */
    async getById(id, userId, schoolId, userRole) {
        try {
            const submission = await this.prisma.assignmentSubmission.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    student: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    email: true
                                }
                            },
                            class: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
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

            if (!submission) {
                throw new Error('Submission not found');
            }

            // Check access permissions based on user role
            if (userRole === 'STUDENT') {
                // Students can only access their own submissions
                if (submission.studentId !== BigInt(userId)) {
                    throw new Error('Access denied');
                }
            } else if (userRole === 'TEACHER') {
                // Teachers can only access submissions for their assignments
                if (submission.assignment.teacherId !== BigInt(userId)) {
                    throw new Error('Access denied');
                }
            } else if (userRole === 'PARENT') {
                // Parents can only access their children's submissions
                const parent = await this.prisma.parent.findFirst({
                    where: {
                        userId: BigInt(userId),
                        students: {
                            some: { id: submission.studentId }
                        }
                    }
                });
                
                if (!parent) {
                    throw new Error('Access denied');
                }
            }

            return {
                success: true,
                data: submission
            };

        } catch (error) {
            logger.error(`Error getting assignment submission: ${error.message}`);
            throw new Error(`Failed to get submission: ${error.message}`);
        }
    }

    /**
     * Get all submissions for an assignment
     */
    async getByAssignment(assignmentId, schoolId, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'submittedAt', sortOrder = 'desc', status, graded } = filters;

            const where = {
                assignmentId: BigInt(assignmentId),
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (status) {
                where.status = status;
            }

            if (graded !== undefined) {
                if (graded === 'true') {
                    where.score = { not: null };
                } else {
                    where.score = null;
                }
            }

            const [submissions, total] = await Promise.all([
                this.prisma.assignmentSubmission.findMany({
                    where,
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                user: {
                                    select: {
                                        id: true,
                                        email: true
                                    }
                                }
                            }
                        },
                        assignment: {
                            select: {
                                id: true,
                                title: true,
                                dueDate: true
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.assignmentSubmission.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: submissions,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting assignment submissions: ${error.message}`);
            throw new Error(`Failed to get submissions: ${error.message}`);
        }
    }

    /**
     * Get submissions by student
     */
    async getByStudent(studentId, schoolId, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'submittedAt', sortOrder = 'desc', status, assignmentId } = filters;

            const where = {
                studentId: BigInt(studentId),
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (status) {
                where.status = status;
            }

            if (assignmentId) {
                where.assignmentId = BigInt(assignmentId);
            }

            const [submissions, total] = await Promise.all([
                this.prisma.assignmentSubmission.findMany({
                    where,
                    include: {
                        assignment: {
                            include: {
                                teacher: {
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
                this.prisma.assignmentSubmission.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: submissions,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting student submissions: ${error.message}`);
            throw new Error(`Failed to get student submissions: ${error.message}`);
        }
    }

    /**
     * Get all submissions with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                assignmentId,
                studentId,
                status,
                graded,
                startDate,
                endDate,
                minScore,
                maxScore,
                sortBy = 'submittedAt',
                sortOrder = 'desc'
            } = filters;

            const where = {
                deletedAt: null
            };

            if (assignmentId) {
                where.assignmentId = BigInt(assignmentId);
            }

            if (studentId) {
                where.studentId = BigInt(studentId);
            }

            if (status) {
                where.status = status;
            }

            if (graded !== undefined) {
                if (graded === 'true') {
                    where.score = { not: null };
                } else {
                    where.score = null;
                }
            }

            if (startDate || endDate) {
                where.submittedAt = {};
                if (startDate) {
                    where.submittedAt.gte = new Date(startDate);
                }
                if (endDate) {
                    where.submittedAt.lte = new Date(endDate);
                }
            }

            if (minScore !== undefined || maxScore !== undefined) {
                where.score = {};
                if (minScore !== undefined) {
                    where.score.gte = parseFloat(minScore);
                }
                if (maxScore !== undefined) {
                    where.score.lte = parseFloat(maxScore);
                }
            }

            const [submissions, total] = await Promise.all([
                this.prisma.assignmentSubmission.findMany({
                    where,
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                user: {
                                    select: {
                                        id: true,
                                        email: true
                                    }
                                }
                            }
                        },
                        assignment: {
                            select: {
                                id: true,
                                title: true,
                                dueDate: true,
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
                this.prisma.assignmentSubmission.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: submissions,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all submissions: ${error.message}`);
            throw new Error(`Failed to get submissions: ${error.message}`);
        }
    }

    /**
     * Update submission
     */
    async update(id, updateData, userId, schoolId) {
        try {
            const submission = await this.prisma.assignmentSubmission.findFirst({
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

            if (!submission) {
                throw new Error('Submission not found');
            }

            // Check if user has permission to update
            if (submission.assignment.teacherId !== BigInt(userId)) {
                throw new Error('Access denied');
            }

            const updatedSubmission = await this.prisma.assignmentSubmission.update({
                where: { id: BigInt(id) },
                data: {
                    content: updateData.content,
                    status: updateData.status,
                    score: updateData.score,
                    feedback: updateData.feedback,
                    gradedAt: updateData.score ? new Date() : null,
                    gradedBy: updateData.score ? BigInt(userId) : null
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            user: {
                                select: {
                                    id: true,
                                    email: true
                                }
                            }
                        }
                    },
                    assignment: {
                        select: {
                            id: true,
                            title: true,
                            dueDate: true
                        }
                    }
                }
            });

            return {
                success: true,
                data: updatedSubmission
            };

        } catch (error) {
            logger.error(`Error updating submission: ${error.message}`);
            throw new Error(`Failed to update submission: ${error.message}`);
        }
    }

    /**
     * Grade submission
     */
    async grade(id, gradeData, userId, schoolId) {
        try {
            const submission = await this.prisma.assignmentSubmission.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    assignment: {
                        select: {
                            teacherId: true,
                            maxScore: true
                        }
                    },
                    student: {
                        select: {
                            id: true,
                            name: true,
                            user: {
                                select: {
                                    id: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            });

            if (!submission) {
                throw new Error('Submission not found');
            }

            // Check if user has permission to grade
            if (submission.assignment.teacherId !== BigInt(userId)) {
                throw new Error('Access denied');
            }

            // Validate score
            if (gradeData.score < 0 || gradeData.score > submission.assignment.maxScore) {
                throw new Error(`Score must be between 0 and ${submission.assignment.maxScore}`);
            }

            const updatedSubmission = await this.prisma.assignmentSubmission.update({
                where: { id: BigInt(id) },
                data: {
                    score: gradeData.score,
                    feedback: gradeData.feedback,
                    status: 'GRADED',
                    gradedAt: new Date(),
                    gradedBy: BigInt(userId)
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            user: {
                                select: {
                                    id: true,
                                    email: true
                                }
                            }
                        }
                    },
                    assignment: {
                        select: {
                            id: true,
                            title: true,
                            dueDate: true
                        }
                    }
                }
            });

            return {
                success: true,
                data: updatedSubmission
            };

        } catch (error) {
            logger.error(`Error grading submission: ${error.message}`);
            throw new Error(`Failed to grade submission: ${error.message}`);
        }
    }

    /**
     * Delete submission
     */
    async delete(id, userId, schoolId) {
        try {
            const submission = await this.prisma.assignmentSubmission.findFirst({
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

            if (!submission) {
                throw new Error('Submission not found');
            }

            // Check if user has permission to delete
            if (submission.assignment.teacherId !== BigInt(userId)) {
                throw new Error('Access denied');
            }

            const deletedSubmission = await this.prisma.assignmentSubmission.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date()
                }
            });

            return {
                success: true,
                data: deletedSubmission
            };

        } catch (error) {
            logger.error(`Error deleting submission: ${error.message}`);
            throw new Error(`Failed to delete submission: ${error.message}`);
        }
    }

    /**
     * Bulk grade submissions
     */
    async bulkGrade(submissions, userId, schoolId) {
        try {
            const results = [];
            const errors = [];

            for (const submissionData of submissions) {
                try {
                    const result = await this.grade(submissionData.id, {
                        score: submissionData.score,
                        feedback: submissionData.feedback
                    }, userId, schoolId);
                    results.push(result.data);
                } catch (error) {
                    errors.push({
                        submissionId: submissionData.id,
                        error: error.message
                    });
                }
            }

            return {
                success: true,
                data: results,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            logger.error(`Error bulk grading submissions: ${error.message}`);
            throw new Error(`Failed to bulk grade submissions: ${error.message}`);
        }
    }

    /**
     * Get submission statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, assignmentId, teacherId } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (startDate || endDate) {
                where.submittedAt = {};
                if (startDate) {
                    where.submittedAt.gte = new Date(startDate);
                }
                if (endDate) {
                    where.submittedAt.lte = new Date(endDate);
                }
            }

            if (assignmentId) {
                where.assignmentId = BigInt(assignmentId);
            }

            if (teacherId) {
                where.assignment = {
                    teacherId: BigInt(teacherId)
                };
            }

            const [
                totalSubmissions,
                gradedSubmissions,
                pendingSubmissions,
                averageScore,
                highestScore,
                lowestScore,
                submissionsByStatus,
                submissionsByMonth
            ] = await Promise.all([
                this.prisma.assignmentSubmission.count({ where }),
                this.prisma.assignmentSubmission.count({
                    where: { ...where, score: { not: null } }
                }),
                this.prisma.assignmentSubmission.count({
                    where: { ...where, score: null }
                }),
                this.prisma.assignmentSubmission.aggregate({
                    where: { ...where, score: { not: null } },
                    _avg: { score: true }
                }),
                this.prisma.assignmentSubmission.aggregate({
                    where: { ...where, score: { not: null } },
                    _max: { score: true }
                }),
                this.prisma.assignmentSubmission.aggregate({
                    where: { ...where, score: { not: null } },
                    _min: { score: true }
                }),
                this.prisma.assignmentSubmission.groupBy({
                    by: ['status'],
                    where,
                    _count: { status: true }
                }),
                this.prisma.assignmentSubmission.groupBy({
                    by: ['submittedAt'],
                    where,
                    _count: { submittedAt: true }
                })
            ]);

            return {
                success: true,
                data: {
                    totalSubmissions,
                    gradedSubmissions,
                    pendingSubmissions,
                    gradingRate: totalSubmissions > 0 ? (gradedSubmissions / totalSubmissions) * 100 : 0,
                    averageScore: averageScore.score || 0,
                    highestScore: highestScore.score || 0,
                    lowestScore: lowestScore.score || 0,
                    submissionsByStatus,
                    submissionsByMonth
                }
            };

        } catch (error) {
            logger.error(`Error getting submission statistics: ${error.message}`);
            throw new Error(`Failed to get submission statistics: ${error.message}`);
        }
    }

    /**
     * Search submissions
     */
    async searchSubmissions(schoolId, searchTerm, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'submittedAt', sortOrder = 'desc' } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                OR: [
                    {
                        content: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        feedback: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        student: {
                            name: {
                                contains: searchTerm,
                                mode: 'insensitive'
                            }
                        }
                    },
                    {
                        assignment: {
                            title: {
                                contains: searchTerm,
                                mode: 'insensitive'
                            }
                        }
                    }
                ]
            };

            const [submissions, total] = await Promise.all([
                this.prisma.assignmentSubmission.findMany({
                    where,
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        assignment: {
                            select: {
                                id: true,
                                title: true
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.assignmentSubmission.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: submissions,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error searching submissions: ${error.message}`);
            throw new Error(`Failed to search submissions: ${error.message}`);
        }
    }
}

export default AssignmentSubmission;
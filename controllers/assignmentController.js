import Assignment from '../models/Assignment.js';
import AssignmentAttachment from '../models/AssignmentAttachment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import { validateAssignment } from '../validators/assignmentValidator.js';
import AssignmentAttachmentValidator from '../validators/assignmentAttachmentValidator.js';
import AssignmentSubmissionValidator from '../validators/assignmentSubmissionValidator.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { uploadFile, deleteFile } from '../utils/fileUpload.js';
import { sendNotification } from '../utils/notifications.js';
import { PrismaClient } from '../generated/prisma/client.js';
class AssignmentController {
    constructor() {
        this.assignmentModel = new Assignment();
        this.attachmentModel = new AssignmentAttachment();
        this.submissionModel = new AssignmentSubmission();
        this.prisma = new PrismaClient();
    }

    /**
     * Create assignment with attachments in one API call
     */
    async createAssignmentWithAttachments(req, res) {
        try {
            const { schoolId } = req.user;
            const { attachments, ...assignmentData } = req.body;

            // Validate assignment data
            const validatedAssignment = validateAssignment({
                ...assignmentData,
                createdBy: req.user.id,
                schoolId
            });

            // Start transaction
            const result = await this.prisma.$transaction(async (prisma) => {
                // Create assignment
                const assignment = await prisma.assignment.create({
                    data: validatedAssignment,
                    include: {
                        teacher: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                role: true
                            }
                        },
                        class: {
                            select: { id: true, name: true }
                        },
                        subject: {
                            select: { id: true, name: true }
                        }
                    }
                });

                // Create attachments if provided
                let createdAttachments = [];
                if (attachments && Array.isArray(attachments) && attachments.length > 0) {
                    for (const attachmentData of attachments) {
                        // Validate attachment data
                        const validatedAttachment = AssignmentAttachmentValidator.validateAndSanitize({
                            ...attachmentData,
                            assignmentId: assignment.id,
                            schoolId: parseInt(schoolId)
                        }, 'create');

                        const attachment = await prisma.assignmentAttachment.create({
                            data: {
                                assignmentId: assignment.id,
                                name: validatedAttachment.name,
                                path: validatedAttachment.path,
                                mimeType: validatedAttachment.mimeType,
                                size: validatedAttachment.size || 0,
                                schoolId: BigInt(schoolId)
                            }
                        });
                        createdAttachments.push(attachment);
                    }
                }

                return { assignment, attachments: createdAttachments };
            });

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'CREATE',
                resource: 'ASSIGNMENT_WITH_ATTACHMENTS',
                resourceId: result.assignment.id,
                details: {
                    assignmentId: result.assignment.id,
                    attachmentCount: result.attachments.length,
                    attachments: result.attachments.map(a => ({ id: a.id, name: a.name }))
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Send notifications
            await this.sendAssignmentNotifications(result.assignment, result.attachments);

            logger.info(`Assignment created with ${result.attachments.length} attachments: ${result.assignment.id}`);

            return res.status(201).json({
                success: true,
                message: 'Assignment created successfully with attachments',
                data: {
                    assignment: result.assignment,
                    attachments: result.attachments
                }
            });

        } catch (error) {
            logger.error(`Error creating assignment with attachments: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Upload assignment with file attachments
     */
    async uploadAssignmentWithFiles(req, res) {
        try {
            const { schoolId } = req.user;
            const { assignmentData, ...formData } = req.body;
            const files = req.files;

            // Parse assignment data
            const assignment = JSON.parse(assignmentData || '{}');

            // Validate assignment data
            const validatedAssignment = validateAssignment({
                ...assignment,
                createdBy: req.user.id,
                schoolId
            });

            // Start transaction
            const result = await this.prisma.$transaction(async (prisma) => {
                // Create assignment
                const createdAssignment = await prisma.assignment.create({
                    data: validatedAssignment,
                    include: {
                        teacher: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                email: true,
                                role: true
                            }
                        },
                        class: {
                            select: { id: true, name: true }
                        },
                        subject: {
                            select: { id: true, name: true }
                        }
                    }
                });

                // Upload and create attachments
                let createdAttachments = [];
                if (files && files.length > 0) {
                    for (const file of files) {
                        // Validate file
                        AssignmentAttachmentValidator.validateAndSanitize(file.size, 'fileSize');
                        AssignmentAttachmentValidator.validateAndSanitize(file.mimetype, 'mimeType');

                        // Upload file
                        const uploadResult = await uploadFile(file, 'assignments');

                        // Create attachment record
                        const attachment = await prisma.assignmentAttachment.create({
                            data: {
                                assignmentId: createdAssignment.id,
                                name: file.originalname,
                                path: uploadResult.path,
                                mimeType: file.mimetype,
                                size: file.size,
                                schoolId: BigInt(schoolId)
                            }
                        });
                        createdAttachments.push(attachment);
                    }
                }

                return { assignment: createdAssignment, attachments: createdAttachments };
            });

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'UPLOAD',
                resource: 'ASSIGNMENT_WITH_FILES',
                resourceId: result.assignment.id,
                details: {
                    assignmentId: result.assignment.id,
                    fileCount: result.attachments.length,
                    files: result.attachments.map(a => ({ id: a.id, name: a.name, size: a.size }))
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Send notifications
            await this.sendAssignmentNotifications(result.assignment, result.attachments);

            logger.info(`Assignment uploaded with ${result.attachments.length} files: ${result.assignment.id}`);

            return res.status(201).json({
                success: true,
                message: 'Assignment uploaded successfully with files',
                data: {
                    assignment: result.assignment,
                    attachments: result.attachments
                }
            });

        } catch (error) {
            logger.error(`Error uploading assignment with files: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Submit assignment with attachments
     */
    async submitAssignmentWithAttachments(req, res) {
        try {
            const { schoolId } = req.user;
            const { assignmentId, attachments, ...submissionData } = req.body;

            // Validate submission data
            const validatedSubmission = AssignmentSubmissionValidator.validateAndSanitize({
                ...submissionData,
                assignmentId: parseInt(assignmentId),
                studentId: req.user.id,
                schoolId: parseInt(schoolId)
            }, 'create');

            // Check if assignment exists and student has access
            const assignment = await this.prisma.assignment.findFirst({
                where: {
                    id: BigInt(assignmentId),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    class: {
                        include: {
                            students: {
                                where: { userId: BigInt(req.user.id) }
                            }
                        }
                    }
                }
            });

            if (!assignment) {
                return res.status(404).json({
                    success: false,
                    message: 'Assignment not found'
                });
            }

            if (assignment.class.students.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not enrolled in this class'
                });
            }

            // Check if already submitted
            const existingSubmission = await this.prisma.assignmentSubmission.findFirst({
                where: {
                    assignmentId: BigInt(assignmentId),
                    studentId: BigInt(req.user.id)
                }
            });

            if (existingSubmission) {
                return res.status(400).json({
                    success: false,
                    message: 'Assignment already submitted'
                });
            }

            // Start transaction
            const result = await this.prisma.$transaction(async (prisma) => {
                // Create submission
                const submission = await prisma.assignmentSubmission.create({
                    data: {
                        assignmentId: BigInt(assignmentId),
                        studentId: BigInt(req.user.id),
                        content: validatedSubmission.content,
                        submittedAt: new Date(),
                        status: 'SUBMITTED',
                        schoolId: BigInt(schoolId)
                    },
                    include: {
                        student: {
                            select: { id: true, firstName: true, lastName: true }
                        },
                        assignment: {
                            select: { id: true, title: true }
                        }
                    }
                });

                // Create submission attachments if provided
                let createdAttachments = [];
                if (attachments && Array.isArray(attachments) && attachments.length > 0) {
                    for (const attachmentData of attachments) {
                        // Validate attachment data
                        const validatedAttachment = AssignmentAttachmentValidator.validateAndSanitize({
                            ...attachmentData,
                            assignmentId: assignmentId,
                            schoolId: parseInt(schoolId)
                        }, 'create');

                        const attachment = await prisma.assignmentAttachment.create({
                            data: {
                                assignmentId: BigInt(assignmentId),
                                name: validatedAttachment.name,
                                path: validatedAttachment.path,
                                mimeType: validatedAttachment.mimeType,
                                size: validatedAttachment.size || 0,
                                schoolId: BigInt(schoolId)
                            }
                        });
                        createdAttachments.push(attachment);
                    }
                }

                return { submission, attachments: createdAttachments };
            });

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'SUBMIT',
                resource: 'ASSIGNMENT_SUBMISSION',
                resourceId: result.submission.id,
                details: {
                    assignmentId: assignmentId,
                    submissionId: result.submission.id,
                    attachmentCount: result.attachments.length
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Send notification to teacher
            await sendNotification({
                userId: assignment.teacherId,
                title: 'New Assignment Submission',
                message: `${result.submission.student.firstName} ${result.submission.student.lastName} submitted assignment "${assignment.title}"`,
                type: 'ASSIGNMENT',
                data: {
                    assignmentId: assignmentId,
                    submissionId: result.submission.id,
                    studentId: req.user.id
                }
            });

            logger.info(`Assignment submitted with ${result.attachments.length} attachments: ${result.submission.id}`);

            return res.status(201).json({
                success: true,
                message: 'Assignment submitted successfully with attachments',
                data: {
                    submission: result.submission,
                    attachments: result.attachments
                }
            });

        } catch (error) {
            logger.error(`Error submitting assignment with attachments: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Upload assignment submission with files
     */
    async uploadAssignmentSubmissionWithFiles(req, res) {
        try {
            const { schoolId } = req.user;
            const { assignmentId, submissionData, ...formData } = req.body;
            const files = req.files;

            // Parse submission data
            const submission = JSON.parse(submissionData || '{}');

            // Validate submission data
            const validatedSubmission = AssignmentSubmissionValidator.validateAndSanitize({
                ...submission,
                assignmentId: parseInt(assignmentId),
                studentId: req.user.id,
                schoolId: parseInt(schoolId)
            }, 'create');

            // Check assignment and access
            const assignment = await this.prisma.assignment.findFirst({
                where: {
                    id: BigInt(assignmentId),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    class: {
                        include: {
                            students: {
                                where: { userId: BigInt(req.user.id) }
                            }
                        }
                    }
                }
            });

            if (!assignment) {
                return res.status(404).json({
                    success: false,
                    message: 'Assignment not found'
                });
            }

            if (assignment.class.students.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: 'You are not enrolled in this class'
                });
            }

            // Check if already submitted
            const existingSubmission = await this.prisma.assignmentSubmission.findFirst({
                where: {
                    assignmentId: BigInt(assignmentId),
                    studentId: BigInt(req.user.id)
                }
            });

            if (existingSubmission) {
                return res.status(400).json({
                    success: false,
                    message: 'Assignment already submitted'
                });
            }

            // Start transaction
            const result = await this.prisma.$transaction(async (prisma) => {
                // Create submission
                const createdSubmission = await prisma.assignmentSubmission.create({
                    data: {
                        assignmentId: BigInt(assignmentId),
                        studentId: BigInt(req.user.id),
                        content: validatedSubmission.content,
                        submittedAt: new Date(),
                        status: 'SUBMITTED',
                        schoolId: BigInt(schoolId)
                    },
                    include: {
                        student: {
                            select: { id: true, firstName: true, lastName: true }
                        },
                        assignment: {
                            select: { id: true, title: true }
                        }
                    }
                });

                // Upload and create submission attachments
                let createdAttachments = [];
                if (files && files.length > 0) {
                    for (const file of files) {
                        // Validate file
                        AssignmentAttachmentValidator.validateAndSanitize(file.size, 'fileSize');
                        AssignmentAttachmentValidator.validateAndSanitize(file.mimetype, 'mimeType');

                        // Upload file
                        const uploadResult = await uploadFile(file, 'submissions');

                        // Create attachment record
                        const attachment = await prisma.assignmentAttachment.create({
                            data: {
                                assignmentId: BigInt(assignmentId),
                                name: file.originalname,
                                path: uploadResult.path,
                                mimeType: file.mimetype,
                                size: file.size,
                                schoolId: BigInt(schoolId)
                            }
                        });
                        createdAttachments.push(attachment);
                    }
                }

                return { submission: createdSubmission, attachments: createdAttachments };
            });

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'UPLOAD_SUBMISSION',
                resource: 'ASSIGNMENT_SUBMISSION',
                resourceId: result.submission.id,
                details: {
                    assignmentId: assignmentId,
                    submissionId: result.submission.id,
                    fileCount: result.attachments.length
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Send notification to teacher
            await sendNotification({
                userId: assignment.teacherId,
                title: 'New Assignment Submission',
                message: `${result.submission.student.firstName} ${result.submission.student.lastName} submitted assignment "${assignment.title}" with ${result.attachments.length} files`,
                type: 'ASSIGNMENT',
                data: {
                    assignmentId: assignmentId,
                    submissionId: result.submission.id,
                    studentId: req.user.id
                }
            });

            logger.info(`Assignment submission uploaded with ${result.attachments.length} files: ${result.submission.id}`);

            return res.status(201).json({
                success: true,
                message: 'Assignment submission uploaded successfully with files',
                data: {
                    submission: result.submission,
                    attachments: result.attachments
                }
            });

        } catch (error) {
            logger.error(`Error uploading assignment submission with files: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get comprehensive assignment details with attachments and submissions
     */
    async getAssignmentDetails(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            // Get assignment with basic info
            const assignment = await this.assignmentModel.getById(id, req.user.id, schoolId, req.user.role);

            // Get attachments
            const attachments = await this.attachmentModel.getByAssignment(id, schoolId, { limit: 50 });

            // Get submissions (if teacher or admin)
            let submissions = null;
            if (req.user.role === 'TEACHER' || req.user.role === 'ADMIN') {
                submissions = await this.submissionModel.getByAssignment(id, schoolId, { limit: 50 });
            }

            // Get submission stats
            const submissionStats = await this.getAssignmentSubmissionStats(parseInt(id));

            // Get analytics
            const analytics = await this.getAdvancedAssignmentStatistics(schoolId, { assignmentId: parseInt(id) });

            const comprehensiveData = {
                assignment: assignment.data,
                attachments: attachments.data,
                submissions: submissions ? submissions.data : null,
                statistics: submissionStats,
                analytics: analytics,
                pagination: {
                    attachments: attachments.pagination,
                    submissions: submissions ? submissions.pagination : null
                }
            };

            logger.info(`Comprehensive assignment details retrieved: ${id}`);

            return res.status(200).json({
                success: true,
                data: comprehensiveData
            });

        } catch (error) {
            logger.error(`Error getting assignment details: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async createAssignment(req, res) {
        try {
            const { schoolId } = req.user;
            const assignmentData = {
                ...req.body,
                createdBy: req.user.id,
                schoolId
            };

            const result = await this.assignmentModel.create(assignmentData);

            await createAuditLog({
                action: 'CREATE',
                entityType: 'ASSIGNMENT',
                entityId: result.data.id,
                newData: result.data,
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            await this.sendAssignmentNotifications(result.data);

            res.status(201).json({
                success: true,
                message: 'Assignment created successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in createAssignment: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async createBulkAssignments(req, res) {
        try {
            const { schoolId } = req.user;
            const { assignments } = req.body;

            if (!Array.isArray(assignments) || assignments.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Assignments array is required and cannot be empty'
                });
            }

            const createdAssignments = [];
            const errors = [];

            for (const assignmentData of assignments) {
                try {
                    const data = {
                        ...assignmentData,
                        createdBy: req.user.id,
                        schoolId
                    };

                    const result = await this.assignmentModel.create(data);
                    createdAssignments.push(result.data);
                    await this.sendAssignmentNotifications(result.data);

                } catch (error) {
                    errors.push({
                        assignment: assignmentData.title,
                        error: error.message
                    });
                }
            }

            await createAuditLog({
                action: 'BULK_CREATE',
                entityType: 'ASSIGNMENT',
                entityId: null,
                newData: { count: createdAssignments.length, assignments: createdAssignments },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(201).json({
                success: true,
                message: `Created ${createdAssignments.length} assignments successfully`,
                data: createdAssignments,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            logger.error(`Error in createBulkAssignments: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getAssignmentById(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.assignmentModel.getById(id, req.user.id, schoolId, req.user.role);
            const submissionStats = await this.getAssignmentSubmissionStats(parseInt(id));

            const enhancedData = {
                ...result.data,
                statistics: submissionStats
            };

            res.status(200).json({
                success: true,
                data: enhancedData
            });

        } catch (error) {
            logger.error(`Error in getAssignmentById: ${error.message}`);
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }

    async getAssignmentSubmissionStats(assignmentId) {
        try {
            const [
                totalStudents,
                submittedCount,
                gradedCount,
                averageScore,
                highestScore,
                lowestScore
            ] = await Promise.all([
                this.prisma.student.count({
                    where: {
                        class: {
                            assignments: {
                                some: { id: assignmentId }
                            }
                        }
                    }
                }),
                this.prisma.assignmentSubmission.count({
                    where: { assignmentId }
                }),
                this.prisma.assignmentSubmission.count({
                    where: {
                        assignmentId,
                        score: { not: null }
                    }
                }),
                this.prisma.assignmentSubmission.aggregate({
                    where: {
                        assignmentId,
                        score: { not: null }
                    },
                    _avg: { score: true }
                }),
                this.prisma.assignmentSubmission.aggregate({
                    where: {
                        assignmentId,
                        score: { not: null }
                    },
                    _max: { score: true }
                }),
                this.prisma.assignmentSubmission.aggregate({
                    where: {
                        assignmentId,
                        score: { not: null }
                    },
                    _min: { score: true }
                })
            ]);

            return {
                totalStudents,
                submittedCount,
                gradedCount,
                submissionRate: totalStudents > 0 ? (submittedCount / totalStudents) * 100 : 0,
                averageScore: averageScore.score || 0,
                highestScore: highestScore.score || 0,
                lowestScore: lowestScore.score || 0
            };

        } catch (error) {
            logger.error(`Error getting assignment submission stats: ${error.message}`);
            return {};
        }
    }

    async getAllAssignments(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                schoolId
            };

            const result = await this.assignmentModel.getAll(filters);

            const enhancedData = await Promise.all(
                result.data.map(async (assignment) => {
                    const stats = await this.getAssignmentSubmissionStats(assignment.id);
                    return {
                        ...assignment,
                        submissionStats: stats
                    };
                })
            );

            res.status(200).json({
                success: true,
                data: enhancedData,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getAllAssignments: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving assignments'
            });
        }
    }

    async getAssignmentsByTeacher(req, res) {
        try {
            const { teacherId } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getByTeacher(teacherId, schoolId, filters);

            const enhancedData = await Promise.all(
                result.data.map(async (assignment) => {
                    const stats = await this.getAssignmentSubmissionStats(assignment.id);
                    return {
                        ...assignment,
                        submissionStats: stats
                    };
                })
            );

            res.status(200).json({
                success: true,
                data: enhancedData,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getAssignmentsByTeacher: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving assignments by teacher'
            });
        }
    }

    async getAssignmentsByClass(req, res) {
        try {
            const { classId } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getByClass(classId, schoolId, filters);

            const students = await this.prisma.student.findMany({
                where: { classId: parseInt(classId) },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    rollNumber: true
                }
            });

            const enhancedData = await Promise.all(
                result.data.map(async (assignment) => {
                    const studentProgress = await Promise.all(
                        students.map(async (student) => {
                            const submission = await this.prisma.assignmentSubmission.findUnique({
                                where: {
                                    assignmentId_studentId: {
                                        assignmentId: assignment.id,
                                        studentId: student.id
                                    }
                                },
                                select: {
                                    id: true,
                                    submittedAt: true,
                                    score: true,
                                    feedback: true
                                }
                            });

                            return {
                                student,
                                submission,
                                status: submission ? 'SUBMITTED' : 'PENDING',
                                isOverdue: !submission && new Date(assignment.dueDate) < new Date()
                            };
                        })
                    );

                    return {
                        ...assignment,
                        studentProgress
                    };
                })
            );

            res.status(200).json({
                success: true,
                data: enhancedData,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getAssignmentsByClass: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving assignments by class'
            });
        }
    }

    async getAssignmentsBySubject(req, res) {
        try {
            const { subjectId } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getBySubject(subjectId, schoolId, filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getAssignmentsBySubject: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving assignments by subject'
            });
        }
    }

    async getStudentAssignments(req, res) {
        try {
            const { studentId } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getStudentAssignments(studentId, schoolId, filters);

            const enhancedData = result.data.map(assignment => {
                const submission = assignment.submissions[0];
                return {
                    ...assignment,
                    submission,
                    status: submission ? 'SUBMITTED' : 'PENDING',
                    isOverdue: !submission && new Date(assignment.dueDate) < new Date(),
                    daysRemaining: Math.ceil((new Date(assignment.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
                };
            });

            res.status(200).json({
                success: true,
                data: enhancedData,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getStudentAssignments: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving student assignments'
            });
        }
    }

    async updateAssignment(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;
            const updateData = req.body;

            const result = await this.assignmentModel.update(id, updateData, req.user.id, schoolId);

            if (updateData.dueDate) {
                await this.sendAssignmentUpdateNotifications(result.data);
            }

            await createAuditLog({
                action: 'UPDATE',
                entityType: 'ASSIGNMENT',
                entityId: parseInt(id),
                newData: result.data,
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: 'Assignment updated successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in updateAssignment: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async bulkUpdateAssignments(req, res) {
        try {
            const { assignmentIds, updateData } = req.body;
            const { schoolId } = req.user;

            if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Assignment IDs array is required'
                });
            }

            const updatedAssignments = [];
            const errors = [];

            for (const assignmentId of assignmentIds) {
                try {
                    const result = await this.assignmentModel.update(assignmentId, updateData, req.user.id, schoolId);
                    updatedAssignments.push(result.data);
                } catch (error) {
                    errors.push({
                        assignmentId,
                        error: error.message
                    });
                }
            }

            await createAuditLog({
                action: 'BULK_UPDATE',
                entityType: 'ASSIGNMENT',
                entityId: null,
                newData: { assignmentIds, updateData, count: updatedAssignments.length },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: `Updated ${updatedAssignments.length} assignments successfully`,
                data: updatedAssignments,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            logger.error(`Error in bulkUpdateAssignments: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async deleteAssignment(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.assignmentModel.delete(id, req.user.id, schoolId);

            await createAuditLog({
                action: 'DELETE',
                entityType: 'ASSIGNMENT',
                entityId: parseInt(id),
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: result.message
            });

        } catch (error) {
            logger.error(`Error in deleteAssignment: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async bulkDeleteAssignments(req, res) {
        try {
            const { assignmentIds } = req.body;
            const { schoolId } = req.user;

            if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Assignment IDs array is required'
                });
            }

            let deletedCount = 0;
            const errors = [];

            for (const assignmentId of assignmentIds) {
                try {
                    await this.assignmentModel.delete(assignmentId, req.user.id, schoolId);
                    deletedCount++;
                } catch (error) {
                    errors.push({
                        assignmentId,
                        error: error.message
                    });
                }
            }

            await createAuditLog({
                action: 'BULK_DELETE',
                entityType: 'ASSIGNMENT',
                entityId: null,
                newData: { assignmentIds, count: deletedCount },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: `Deleted ${deletedCount} assignments successfully`,
                deletedCount,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            logger.error(`Error in bulkDeleteAssignments: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async getAssignmentStatistics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getStatistics(schoolId, filters);
            const advancedStats = await this.getAdvancedAssignmentStatistics(schoolId, filters);

            const enhancedData = {
                ...result.data,
                ...advancedStats
            };

            res.status(200).json({
                success: true,
                data: enhancedData
            });

        } catch (error) {
            logger.error(`Error in getAssignmentStatistics: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving assignment statistics'
            });
        }
    }

    async getAdvancedAssignmentStatistics(schoolId, filters = {}) {
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
                totalSubmissions,
                gradedSubmissions,
                averageSubmissionScore,
                onTimeSubmissions,
                lateSubmissions
            ] = await Promise.all([
                this.prisma.assignmentSubmission.count({
                    where: {
                        assignment: where
                    }
                }),
                this.prisma.assignmentSubmission.count({
                    where: {
                        assignment: where,
                        score: { not: null }
                    }
                }),
                this.prisma.assignmentSubmission.aggregate({
                    where: {
                        assignment: where,
                        score: { not: null }
                    },
                    _avg: { score: true }
                }),
                this.prisma.assignmentSubmission.count({
                    where: {
                        assignment: where,
                        submittedAt: {
                            lte: this.prisma.assignment.fields.dueDate
                        }
                    }
                }),
                this.prisma.assignmentSubmission.count({
                    where: {
                        assignment: where,
                        submittedAt: {
                            gt: this.prisma.assignment.fields.dueDate
                        }
                    }
                })
            ]);

            return {
                totalSubmissions,
                gradedSubmissions,
                averageSubmissionScore: averageSubmissionScore.score || 0,
                onTimeSubmissions,
                lateSubmissions,
                onTimeRate: totalSubmissions > 0 ? (onTimeSubmissions / totalSubmissions) * 100 : 0,
                gradingRate: totalSubmissions > 0 ? (gradedSubmissions / totalSubmissions) * 100 : 0
            };

        } catch (error) {
            logger.error(`Error getting advanced assignment statistics: ${error.message}`);
            return {};
        }
    }

    async getAssignmentAnalytics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getAnalytics(schoolId, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getAssignmentAnalytics: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving assignment analytics'
            });
        }
    }

    async searchAssignments(req, res) {
        try {
            const { schoolId } = req.user;
            const { q: searchTerm, ...filters } = req.query;

            const result = await this.assignmentModel.searchAssignments(schoolId, searchTerm, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in searchAssignments: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error searching assignments'
            });
        }
    }

    async getOverdueAssignments(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getOverdueAssignments(schoolId, filters);

            const enhancedData = await Promise.all(
                result.data.map(async (assignment) => {
                    const submissionStats = await this.getAssignmentSubmissionStats(assignment.id);
                    const overdueDays = Math.ceil((new Date() - new Date(assignment.dueDate)) / (1000 * 60 * 60 * 24));
                    
                    return {
                        ...assignment,
                        submissionStats,
                        overdueDays
                    };
                })
            );

            res.status(200).json({
                success: true,
                data: enhancedData,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getOverdueAssignments: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving overdue assignments'
            });
        }
    }

    async getUpcomingAssignments(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getUpcomingAssignments(schoolId, filters);

            const enhancedData = result.data.map(assignment => {
                const daysUntilDue = Math.ceil((new Date(assignment.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
                const urgency = daysUntilDue <= 1 ? 'URGENT' : daysUntilDue <= 3 ? 'HIGH' : daysUntilDue <= 7 ? 'MEDIUM' : 'LOW';
                
                return {
                    ...assignment,
                    daysUntilDue,
                    urgency
                };
            });

            res.status(200).json({
                success: true,
                data: enhancedData,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getUpcomingAssignments: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving upcoming assignments'
            });
        }
    }

    async getMyAssignments(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.assignmentModel.getByTeacher(req.user.id, schoolId, filters);

            const enhancedData = await Promise.all(
                result.data.map(async (assignment) => {
                    const stats = await this.getAssignmentSubmissionStats(assignment.id);
                    return {
                        ...assignment,
                        submissionStats: stats
                    };
                })
            );

            res.status(200).json({
                success: true,
                data: enhancedData,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMyAssignments: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving your assignments'
            });
        }
    }

    async getMyClassAssignments(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const student = await this.prisma.student.findFirst({
                where: { userId: req.user.id }
            });

            if (!student || !student.classId) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    pagination: {
                        page: 1,
                        limit: 10,
                        total: 0,
                        totalPages: 0
                    }
                });
            }

            const result = await this.assignmentModel.getByClass(student.classId, schoolId, filters);

            const enhancedData = result.data.map(assignment => {
                const submission = assignment.submissions[0];
                return {
                    ...assignment,
                    submission,
                    status: submission ? 'SUBMITTED' : 'PENDING',
                    isOverdue: !submission && new Date(assignment.dueDate) < new Date(),
                    daysRemaining: Math.ceil((new Date(assignment.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
                };
            });

            res.status(200).json({
                success: true,
                data: enhancedData,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getMyClassAssignments: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving class assignments'
            });
        }
    }

    async sendAssignmentNotifications(assignment, attachments = []) {
        try {
            // Get students in the class
            const students = await this.prisma.student.findMany({
                where: { classId: assignment.classId },
                include: { user: true }
            });

            const attachmentInfo = attachments.length > 0 
                ? ` with ${attachments.length} attachment${attachments.length > 1 ? 's' : ''}`
                : '';

            for (const student of students) {
                await sendNotification({
                    userId: student.userId,
                    title: 'New Assignment',
                    message: `A new assignment "${assignment.title}"${attachmentInfo} has been assigned to your class`,
                    type: 'ASSIGNMENT',
                    data: {
                        assignmentId: assignment.id,
                        assignmentTitle: assignment.title,
                        dueDate: assignment.dueDate,
                        attachmentCount: attachments.length
                    }
                });
            }

            // Notify parents
            const parents = await this.prisma.parent.findMany({
                where: {
                    students: {
                        some: { classId: assignment.classId }
                    }
                },
                include: { user: true }
            });

            for (const parent of parents) {
                await sendNotification({
                    userId: parent.userId,
                    title: 'New Assignment for Your Child',
                    message: `A new assignment "${assignment.title}"${attachmentInfo} has been assigned to your child's class`,
                    type: 'ASSIGNMENT',
                    data: {
                        assignmentId: assignment.id,
                        assignmentTitle: assignment.title,
                        dueDate: assignment.dueDate,
                        attachmentCount: attachments.length
                    }
                });
            }

        } catch (error) {
            logger.error(`Error sending assignment notifications: ${error.message}`);
        }
    }

    async sendAssignmentUpdateNotifications(assignment) {
        try {
            const students = await this.prisma.student.findMany({
                where: {
                    classId: assignment.classId,
                    submissions: {
                        none: {
                            assignmentId: assignment.id
                        }
                    }
                },
                include: { user: true }
            });

            for (const student of students) {
                await this.prisma.message.create({
                    data: {
                        sender: { connect: { id: assignment.teacherId } },
                        receiver: { connect: { id: student.userId } },
                        subject: `Assignment Updated: ${assignment.title}`,
                        content: `The assignment "${assignment.title}" has been updated. New due date: ${new Date(assignment.dueDate).toLocaleDateString()}`,
                        type: 'ACADEMIC',
                        category: 'ASSIGNMENT',
                        priority: 'HIGH',
                        school: { connect: { id: assignment.schoolId } },
                        createdByUser: { connect: { id: assignment.teacherId } }
                    }
                });
            }

            logger.info(`Sent assignment update notifications to ${students.length} students`);
        } catch (error) {
            logger.error(`Error sending assignment update notifications: ${error.message}`);
        }
    }

    /**
     * Get integrated assignment analytics
     */
    async getIntegratedAssignmentAnalytics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            // Get assignment analytics
            const assignmentAnalytics = await this.getAdvancedAssignmentStatistics(schoolId, filters);

            // Get attachment analytics
            const attachmentStats = await this.attachmentModel.getStatistics(schoolId, filters);

            // Get submission analytics
            const submissionStats = await this.submissionModel.getStatistics(schoolId, filters);

            const integratedAnalytics = {
                assignments: assignmentAnalytics,
                attachments: attachmentStats.data,
                submissions: submissionStats.data,
                summary: {
                    totalAssignments: assignmentAnalytics.totalAssignments,
                    totalAttachments: attachmentStats.data.totalAttachments,
                    totalSubmissions: submissionStats.data.totalSubmissions,
                    averageSubmissionRate: assignmentAnalytics.averageSubmissionRate,
                    averageScore: assignmentAnalytics.averageScore
                }
            };

            logger.info(`Integrated assignment analytics retrieved for school: ${schoolId}`);

            return res.status(200).json({
                success: true,
                data: integratedAnalytics
            });

        } catch (error) {
            logger.error(`Error getting integrated assignment analytics: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Bulk create assignments with attachments
     */
    async createBulkAssignmentsWithAttachments(req, res) {
        try {
            const { schoolId } = req.user;
            const { assignments } = req.body;

            if (!Array.isArray(assignments) || assignments.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Assignments array is required and cannot be empty'
                });
            }

            const results = [];
            const errors = [];

            for (const assignmentData of assignments) {
                try {
                    const { attachments, ...assignment } = assignmentData;

                    // Validate assignment data
                    const validatedAssignment = validateAssignment({
                        ...assignment,
                        createdBy: req.user.id,
                        schoolId
                    });

                    // Create assignment with attachments in transaction
                    const result = await this.prisma.$transaction(async (prisma) => {
                        const createdAssignment = await prisma.assignment.create({
                            data: validatedAssignment,
                            include: {
                                teacher: { select: { id: true, firstName: true, lastName: true } },
                                class: { select: { id: true, name: true } },
                                subject: { select: { id: true, name: true } }
                            }
                        });

                        let createdAttachments = [];
                        if (attachments && Array.isArray(attachments)) {
                            for (const attachmentData of attachments) {
                                const validatedAttachment = AssignmentAttachmentValidator.validateAndSanitize({
                                    ...attachmentData,
                                    assignmentId: createdAssignment.id,
                                    schoolId: parseInt(schoolId)
                                }, 'create');

                                const attachment = await prisma.assignmentAttachment.create({
                                    data: {
                                        assignmentId: createdAssignment.id,
                                        name: validatedAttachment.name,
                                        path: validatedAttachment.path,
                                        mimeType: validatedAttachment.mimeType,
                                        size: validatedAttachment.size || 0,
                                        schoolId: BigInt(schoolId)
                                    }
                                });
                                createdAttachments.push(attachment);
                            }
                        }

                        return { assignment: createdAssignment, attachments: createdAttachments };
                    });

                    results.push(result);
                    await this.sendAssignmentNotifications(result.assignment, result.attachments);

                } catch (error) {
                    errors.push({
                        assignment: assignmentData.title || 'Unknown',
                        error: error.message
                    });
                }
            }

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'BULK_CREATE_WITH_ATTACHMENTS',
                resource: 'ASSIGNMENT',
                resourceId: null,
                details: {
                    createdCount: results.length,
                    errorCount: errors.length,
                    assignments: results.map(r => ({ id: r.assignment.id, title: r.assignment.title }))
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Bulk created ${results.length} assignments with attachments`);

            return res.status(201).json({
                success: true,
                message: `Created ${results.length} assignments successfully`,
                data: results,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            logger.error(`Error in bulk create assignments with attachments: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get assignment dashboard with integrated data
     */
    async getAssignmentDashboard(req, res) {
        try {
            const { schoolId } = req.user;
            const { role } = req.user;

            // Get recent assignments
            const recentAssignments = await this.assignmentModel.getAll({
                page: 1,
                limit: 5,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            // Get upcoming assignments
            const upcomingAssignments = await this.getUpcomingAssignments(req, res);

            // Get overdue assignments
            const overdueAssignments = await this.getOverdueAssignments(req, res);

            // Get submission statistics
            const submissionStats = await this.getAssignmentSubmissionStats();

            // Get attachment statistics
            const attachmentStats = await this.attachmentModel.getStatistics(schoolId);

            // Role-specific data
            let roleSpecificData = {};
            if (role === 'TEACHER') {
                const myAssignments = await this.getMyAssignments(req, res);
                roleSpecificData = {
                    myAssignments: myAssignments.data,
                    pendingSubmissions: await this.getPendingSubmissions(req.user.id, schoolId)
                };
            } else if (role === 'STUDENT') {
                const mySubmissions = await this.submissionModel.getByStudent(req.user.id, schoolId, { limit: 10 });
                roleSpecificData = {
                    mySubmissions: mySubmissions.data,
                    upcomingDeadlines: await this.getStudentUpcomingDeadlines(req.user.id, schoolId)
                };
            }

            const dashboardData = {
                recentAssignments: recentAssignments.data,
                upcomingAssignments: upcomingAssignments.data,
                overdueAssignments: overdueAssignments.data,
                statistics: {
                    submissions: submissionStats,
                    attachments: attachmentStats.data
                },
                roleSpecific: roleSpecificData
            };

            logger.info(`Assignment dashboard retrieved for user: ${req.user.id}`);

            return res.status(200).json({
                success: true,
                data: dashboardData
            });

        } catch (error) {
            logger.error(`Error getting assignment dashboard: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get pending submissions for teacher
     */
    async getPendingSubmissions(teacherId, schoolId) {
        try {
            const pendingSubmissions = await this.prisma.assignmentSubmission.findMany({
                where: {
                    assignment: {
                        teacherId: BigInt(teacherId),
                        schoolId: BigInt(schoolId)
                    },
                    status: 'SUBMITTED',
                    score: null
                },
                include: {
                    student: {
                        select: { id: true, firstName: true, lastName: true }
                    },
                    assignment: {
                        select: { id: true, title: true }
                    }
                },
                orderBy: { submittedAt: 'asc' },
                take: 10
            });

            return pendingSubmissions;
        } catch (error) {
            logger.error(`Error getting pending submissions: ${error.message}`);
            return [];
        }
    }

    /**
     * Get student upcoming deadlines
     */
    async getStudentUpcomingDeadlines(studentId, schoolId) {
        try {
            const upcomingDeadlines = await this.prisma.assignment.findMany({
                where: {
                    class: {
                        students: {
                            some: { userId: BigInt(studentId) }
                        }
                    },
                    schoolId: BigInt(schoolId),
                    dueDate: {
                        gte: new Date(),
                        lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // Next 7 days
                    },
                    deletedAt: null
                },
                include: {
                    subject: { select: { name: true } },
                    class: { select: { name: true } }
                },
                orderBy: { dueDate: 'asc' },
                take: 10
            });

            return upcomingDeadlines;
        } catch (error) {
            logger.error(`Error getting student upcoming deadlines: ${error.message}`);
            return [];
        }
    }
}


export default AssignmentController;
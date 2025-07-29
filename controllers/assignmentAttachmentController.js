import AssignmentAttachment from '../models/AssignmentAttachment.js';
import AssignmentAttachmentValidator from '../validators/assignmentAttachmentValidator.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { uploadFile, deleteFile } from '../utils/fileUpload.js';
import { sendNotification } from '../utils/notifications.js';
import fs from 'fs';
import path from 'path';

class AssignmentAttachmentController {
    constructor() {
        this.assignmentAttachment = new AssignmentAttachment();
    }

    /**
     * Create new assignment attachment
     */
    async create(req, res) {
        try {
            const { assignmentId, schoolId } = req.body;
            const userId = req.user.id;

            // Validate input
            const validatedData = AssignmentAttachmentValidator.validateAndSanitize({
                ...req.body,
                schoolId: parseInt(schoolId)
            }, 'create');

            // Check if assignment exists and user has access
            const assignment = await this.assignmentAttachment.prisma.assignment.findFirst({
                where: {
                    id: BigInt(assignmentId),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    teacher: true,
                    class: true
                }
            });

            if (!assignment) {
                return res.status(404).json({
                    success: false,
                    message: 'Assignment not found'
                });
            }

            // Check permissions based on user role
            if (req.user.role === 'TEACHER' && assignment.teacherId !== BigInt(userId)) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only add attachments to your own assignments'
                });
            }

            // Create attachment
            const result = await this.assignmentAttachment.create(validatedData);

            // Create audit log
            await createAuditLog({
                userId: BigInt(userId),
                schoolId: BigInt(schoolId),
                action: 'CREATE',
                resource: 'ASSIGNMENT_ATTACHMENT',
                resourceId: result.data.id,
                details: {
                    assignmentId: assignmentId,
                    fileName: validatedData.name,
                    fileSize: validatedData.size
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Send notification to students in the class
            if (assignment.classId) {
                const students = await this.assignmentAttachment.prisma.student.findMany({
                    where: { classId: assignment.classId },
                    include: { user: true }
                });

                for (const student of students) {
                    await sendNotification({
                        userId: student.userId,
                        title: 'New Assignment Attachment',
                        message: `A new attachment "${validatedData.name}" has been added to assignment "${assignment.title}"`,
                        type: 'ASSIGNMENT_ATTACHMENT',
                        data: {
                            assignmentId: assignmentId,
                            attachmentId: result.data.id
                        }
                    });
                }
            }

            logger.info(`Assignment attachment created: ${result.data.id} by user: ${userId}`);

            return res.status(201).json({
                success: true,
                message: 'Attachment created successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error creating assignment attachment: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Upload file and create attachment
     */
    async uploadFile(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const { assignmentId, schoolId } = req.body;
            const userId = req.user.id;

            // Validate file upload data
            const validatedData = AssignmentAttachmentValidator.validateAndSanitize({
                assignmentId: parseInt(assignmentId),
                schoolId: parseInt(schoolId),
                file: req.file
            }, 'fileUpload');

            // Validate file size
            AssignmentAttachmentValidator.validateAndSanitize(req.file.size, 'fileSize');

            // Validate MIME type
            AssignmentAttachmentValidator.validateAndSanitize(req.file.mimetype, 'mimeType');

            // Check if assignment exists and user has access
            const assignment = await this.assignmentAttachment.prisma.assignment.findFirst({
                where: {
                    id: BigInt(assignmentId),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    teacher: true,
                    class: true
                }
            });

            if (!assignment) {
                return res.status(404).json({
                    success: false,
                    message: 'Assignment not found'
                });
            }

            // Check permissions
            if (req.user.role === 'TEACHER' && assignment.teacherId !== BigInt(userId)) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only add attachments to your own assignments'
                });
            }

            // Upload file to storage
            const uploadResult = await uploadFile(req.file, 'assignments');

            // Create attachment record
            const attachmentData = {
                assignmentId: parseInt(assignmentId),
                name: req.file.originalname,
                path: uploadResult.path,
                mimeType: req.file.mimetype,
                size: req.file.size,
                schoolId: parseInt(schoolId)
            };

            const result = await this.assignmentAttachment.create(attachmentData);

            // Create audit log
            await createAuditLog({
                userId: BigInt(userId),
                schoolId: BigInt(schoolId),
                action: 'UPLOAD',
                resource: 'ASSIGNMENT_ATTACHMENT',
                resourceId: result.data.id,
                details: {
                    assignmentId: assignmentId,
                    fileName: req.file.originalname,
                    fileSize: req.file.size,
                    mimeType: req.file.mimetype
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Send notification to students
            if (assignment.classId) {
                const students = await this.assignmentAttachment.prisma.student.findMany({
                    where: { classId: assignment.classId },
                    include: { user: true }
                });

                for (const student of students) {
                    await sendNotification({
                        userId: student.userId,
                        title: 'New Assignment File',
                        message: `A new file "${req.file.originalname}" has been uploaded for assignment "${assignment.title}"`,
                        type: 'ASSIGNMENT_ATTACHMENT',
                        data: {
                            assignmentId: assignmentId,
                            attachmentId: result.data.id
                        }
                    });
                }
            }

            logger.info(`File uploaded for assignment: ${assignmentId}, attachment: ${result.data.id}`);

            return res.status(201).json({
                success: true,
                message: 'File uploaded successfully',
                data: {
                    ...result.data,
                    downloadUrl: uploadResult.downloadUrl
                }
            });

        } catch (error) {
            logger.error(`Error uploading assignment file: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get attachment by ID
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const schoolId = req.user.schoolId;

            // Validate ID
            AssignmentAttachmentValidator.validateAndSanitize(parseInt(id), 'id');

            const result = await this.assignmentAttachment.getById(id, userId, schoolId, req.user.role);

            logger.info(`Assignment attachment retrieved: ${id} by user: ${userId}`);

            return res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error getting assignment attachment: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Attachment not found'
                });
            }

            if (error.message.includes('Access denied')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get all attachments for an assignment
     */
    async getByAssignment(req, res) {
        try {
            const { assignmentId } = req.params;
            const schoolId = req.user.schoolId;
            const filters = req.query;

            // Validate assignment ID
            AssignmentAttachmentValidator.validateAndSanitize(parseInt(assignmentId), 'assignmentId');

            // Validate filters
            const validatedFilters = AssignmentAttachmentValidator.validateAndSanitize(filters, 'search');

            const result = await this.assignmentAttachment.getByAssignment(assignmentId, schoolId, validatedFilters);

            logger.info(`Assignment attachments retrieved for assignment: ${assignmentId}`);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting assignment attachments: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get all attachments with filtering
     */
    async getAll(req, res) {
        try {
            const schoolId = req.user.schoolId;
            const filters = req.query;

            // Validate filters
            const validatedFilters = AssignmentAttachmentValidator.validateAndSanitize(filters, 'search');

            const result = await this.assignmentAttachment.getAll(validatedFilters);

            logger.info(`All assignment attachments retrieved with filters`);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting all assignment attachments: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Update attachment
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const schoolId = req.user.schoolId;

            // Validate ID
            AssignmentAttachmentValidator.validateAndSanitize(parseInt(id), 'id');

            // Validate update data
            const validatedData = AssignmentAttachmentValidator.validateAndSanitize(req.body, 'update');

            const result = await this.assignmentAttachment.update(id, validatedData, userId, schoolId);

            // Create audit log
            await createAuditLog({
                userId: BigInt(userId),
                schoolId: BigInt(schoolId),
                action: 'UPDATE',
                resource: 'ASSIGNMENT_ATTACHMENT',
                resourceId: BigInt(id),
                details: {
                    updatedFields: Object.keys(validatedData)
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Assignment attachment updated: ${id} by user: ${userId}`);

            return res.status(200).json({
                success: true,
                message: 'Attachment updated successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error updating assignment attachment: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Attachment not found'
                });
            }

            if (error.message.includes('Access denied')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Delete attachment
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const schoolId = req.user.schoolId;

            // Validate ID
            AssignmentAttachmentValidator.validateAndSanitize(parseInt(id), 'id');

            const result = await this.assignmentAttachment.delete(id, userId, schoolId);

            // Delete file from storage
            if (result.data.path) {
                await deleteFile(result.data.path);
            }

            // Create audit log
            await createAuditLog({
                userId: BigInt(userId),
                schoolId: BigInt(schoolId),
                action: 'DELETE',
                resource: 'ASSIGNMENT_ATTACHMENT',
                resourceId: BigInt(id),
                details: {
                    fileName: result.data.name,
                    fileSize: result.data.size
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Assignment attachment deleted: ${id} by user: ${userId}`);

            return res.status(200).json({
                success: true,
                message: 'Attachment deleted successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error deleting assignment attachment: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Attachment not found'
                });
            }

            if (error.message.includes('Access denied')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Bulk delete attachments
     */
    async bulkDelete(req, res) {
        try {
            const userId = req.user.id;
            const schoolId = req.user.schoolId;

            // Validate bulk delete data
            const validatedData = AssignmentAttachmentValidator.validateAndSanitize(req.body, 'bulkDelete');

            const result = await this.assignmentAttachment.bulkDelete(validatedData.attachmentIds, userId, schoolId);

            // Delete files from storage
            for (const attachment of result.data) {
                if (attachment.path) {
                    await deleteFile(attachment.path);
                }
            }

            // Create audit log
            await createAuditLog({
                userId: BigInt(userId),
                schoolId: BigInt(schoolId),
                action: 'BULK_DELETE',
                resource: 'ASSIGNMENT_ATTACHMENT',
                resourceId: null,
                details: {
                    deletedCount: result.data.length,
                    attachmentIds: validatedData.attachmentIds
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Bulk delete attachments: ${validatedData.attachmentIds.length} attachments by user: ${userId}`);

            return res.status(200).json({
                success: true,
                message: `${result.data.length} attachments deleted successfully`,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error bulk deleting attachments: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get attachment statistics
     */
    async getStatistics(req, res) {
        try {
            const schoolId = req.user.schoolId;
            const filters = req.query;

            // Validate statistics filters
            const validatedFilters = AssignmentAttachmentValidator.validateAndSanitize(filters, 'statistics');

            const result = await this.assignmentAttachment.getStatistics(schoolId, validatedFilters);

            logger.info(`Attachment statistics retrieved for school: ${schoolId}`);

            return res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error getting attachment statistics: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Search attachments
     */
    async search(req, res) {
        try {
            const schoolId = req.user.schoolId;
            const { searchTerm, ...filters } = req.query;

            if (!searchTerm) {
                return res.status(400).json({
                    success: false,
                    message: 'Search term is required'
                });
            }

            // Validate search filters
            const validatedFilters = AssignmentAttachmentValidator.validateAndSanitize(filters, 'search');

            const result = await this.assignmentAttachment.searchAttachments(schoolId, searchTerm, validatedFilters);

            logger.info(`Attachment search performed: "${searchTerm}"`);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error searching attachments: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get attachments by file type
     */
    async getByFileType(req, res) {
        try {
            const schoolId = req.user.schoolId;
            const { mimeType, ...filters } = req.query;

            if (!mimeType) {
                return res.status(400).json({
                    success: false,
                    message: 'MIME type is required'
                });
            }

            // Validate file type filter
            const validatedFilters = AssignmentAttachmentValidator.validateAndSanitize({
                mimeType,
                ...filters
            }, 'fileType');

            const result = await this.assignmentAttachment.getByFileType(schoolId, mimeType, validatedFilters);

            logger.info(`Attachments retrieved by file type: ${mimeType}`);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting attachments by file type: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Download attachment
     */
    async download(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const schoolId = req.user.schoolId;

            // Validate ID
            AssignmentAttachmentValidator.validateAndSanitize(parseInt(id), 'id');

            const result = await this.assignmentAttachment.getById(id, userId, schoolId, req.user.role);

            // Create audit log for download
            await createAuditLog({
                userId: BigInt(userId),
                schoolId: BigInt(schoolId),
                action: 'DOWNLOAD',
                resource: 'ASSIGNMENT_ATTACHMENT',
                resourceId: BigInt(id),
                details: {
                    fileName: result.data.name,
                    fileSize: result.data.size
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Attachment downloaded: ${id} by user: ${userId}`);

            // Set response headers for file download
            res.setHeader('Content-Type', result.data.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${result.data.name}"`);
            res.setHeader('Content-Length', result.data.size);

            // Return file path for download
            return res.status(200).json({
                success: true,
                data: {
                    downloadUrl: `/api/assignments/attachments/${id}/file`,
                    fileName: result.data.name,
                    fileSize: result.data.size,
                    mimeType: result.data.mimeType
                }
            });

        } catch (error) {
            logger.error(`Error downloading attachment: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Attachment not found'
                });
            }

            if (error.message.includes('Access denied')) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Stream file content
     */
    async streamFile(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const schoolId = req.user.schoolId;

            // Validate ID
            AssignmentAttachmentValidator.validateAndSanitize(parseInt(id), 'id');

            const result = await this.assignmentAttachment.getById(id, userId, schoolId, req.user.role);

            // Stream file content
            
            const filePath = path.join(process.cwd(), result.data.path);
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: 'File not found on server'
                });
            }

            // Set response headers
            res.setHeader('Content-Type', result.data.mimeType);
            res.setHeader('Content-Disposition', `inline; filename="${result.data.name}"`);
            res.setHeader('Content-Length', result.data.size);

            // Stream file
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);

        } catch (error) {
            logger.error(`Error streaming file: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

export default AssignmentAttachmentController; 
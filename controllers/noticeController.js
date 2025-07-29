import Notice from '../models/Notice.js';
import { validateNotice, validateNoticeFilters, validateNoticeSearch } from '../validators/noticeValidator.js';
import logger  from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

class NoticeController {
    constructor() {
        this.noticeModel = new Notice();
    }

    /**
     * Create new notice
     */
    async createNotice(req, res) {
        try {
            const { schoolId } = req.user;
            const noticeData = {
                ...req.body,
                schoolId,
                createdBy: req.user.id,
                updatedBy: req.user.id
            };

            const result = await this.noticeModel.create(noticeData);

            // Create audit log
            await createAuditLog({
                action: 'CREATE',
                entityType: 'NOTICE',
                entityId: result.data.id,
                newData: result.data,
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(201).json({
                success: true,
                message: 'Notice created successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in createNotice: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get notice by ID
     */
    async getNoticeById(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.noticeModel.getById(id, schoolId);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getNoticeById: ${error.message}`);
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get all notices with filtering and pagination
     */
    async getAllNotices(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                schoolId
            };

            // Validate filters
            const filterValidation = validateNoticeFilters(filters);
            if (!filterValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Filter validation failed: ${filterValidation.errors.join(', ')}`
                });
            }

            const result = await this.noticeModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getAllNotices: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving notices'
            });
        }
    }

    /**
     * Get published notices for current user
     */
    async getPublishedNotices(req, res) {
        try {
            const { schoolId, role } = req.user;
            const { classId } = req.query;

            const result = await this.noticeModel.getPublishedNotices(schoolId, role, classId);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getPublishedNotices: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving published notices'
            });
        }
    }

    /**
     * Update notice
     */
    async updateNotice(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;
            const updateData = {
                ...req.body,
                updatedBy: req.user.id
            };

            const result = await this.noticeModel.update(id, updateData, schoolId);

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entityType: 'NOTICE',
                entityId: parseInt(id),
                newData: result.data,
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: 'Notice updated successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in updateNotice: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Update notice publication status
     */
    async updateNoticePublicationStatus(req, res) {
        try {
            const { id } = req.params;
            const { isPublished } = req.body;
            const { schoolId } = req.user;

            const result = await this.noticeModel.updatePublicationStatus(
                id, 
                isPublished, 
                schoolId, 
                req.user.id
            );

            // Create audit log
            await createAuditLog({
                action: 'UPDATE_STATUS',
                entityType: 'NOTICE',
                entityId: parseInt(id),
                newData: { isPublished },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: `Notice ${isPublished ? 'published' : 'unpublished'} successfully`,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in updateNoticePublicationStatus: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Delete notice
     */
    async deleteNotice(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.noticeModel.delete(id, schoolId, req.user.id);

            // Create audit log
            await createAuditLog({
                action: 'DELETE',
                entityType: 'NOTICE',
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
            logger.error(`Error in deleteNotice: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Bulk update notice publication status
     */
    async bulkUpdatePublicationStatus(req, res) {
        try {
            const { noticeIds, isPublished } = req.body;
            const { schoolId } = req.user;

            if (!Array.isArray(noticeIds) || noticeIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Notice IDs array is required'
                });
            }

            const result = await this.noticeModel.bulkUpdatePublicationStatus(
                noticeIds,
                isPublished,
                schoolId,
                req.user.id
            );

            // Create audit log for bulk operation
            await createAuditLog({
                action: 'BULK_UPDATE_STATUS',
                entityType: 'NOTICE',
                entityId: null,
                newData: { noticeIds, isPublished, count: result.count },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: result.message,
                count: result.count
            });

        } catch (error) {
            logger.error(`Error in bulkUpdatePublicationStatus: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get notice statistics
     */
    async getNoticeStatistics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.noticeModel.getStatistics(schoolId, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getNoticeStatistics: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving notice statistics'
            });
        }
    }

    /**
     * Get notice analytics
     */
    async getNoticeAnalytics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.noticeModel.getAnalytics(schoolId, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getNoticeAnalytics: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving notice analytics'
            });
        }
    }

    /**
     * Search notices
     */
    async searchNotices(req, res) {
        try {
            const { schoolId } = req.user;
            const { q: searchTerm, ...filters } = req.query;

            // Validate search parameters
            const searchValidation = validateNoticeSearch(searchTerm, filters);
            if (!searchValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Search validation failed: ${searchValidation.errors.join(', ')}`
                });
            }

            const result = await this.noticeModel.searchNotices(schoolId, searchTerm, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in searchNotices: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error searching notices'
            });
        }
    }

    /**
     * Get upcoming notices
     */
    async getUpcomingNotices(req, res) {
        try {
            const { schoolId } = req.user;
            const { limit = 10 } = req.query;

            const result = await this.noticeModel.getUpcomingNotices(schoolId, limit);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getUpcomingNotices: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving upcoming notices'
            });
        }
    }

    /**
     * Get expired notices
     */
    async getExpiredNotices(req, res) {
        try {
            const { schoolId } = req.user;
            const { limit = 10 } = req.query;

            const result = await this.noticeModel.getExpiredNotices(schoolId, limit);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getExpiredNotices: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving expired notices'
            });
        }
    }

    /**
     * Get notices by priority
     */
    async getNoticesByPriority(req, res) {
        try {
            const { schoolId } = req.user;
            const { priority } = req.params;
            const filters = {
                ...req.query,
                schoolId,
                priority
            };

            const result = await this.noticeModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getNoticesByPriority: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving notices by priority'
            });
        }
    }

    /**
     * Get notices by target role
     */
    async getNoticesByTargetRole(req, res) {
        try {
            const { schoolId } = req.user;
            const { role } = req.params;
            const filters = {
                ...req.query,
                schoolId,
                targetRole: role
            };

            const result = await this.noticeModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getNoticesByTargetRole: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving notices by target role'
            });
        }
    }

    /**
     * Get notices by class
     */
    async getNoticesByClass(req, res) {
        try {
            const { schoolId } = req.user;
            const { classId } = req.params;
            const filters = {
                ...req.query,
                schoolId,
                classId
            };

            const result = await this.noticeModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getNoticesByClass: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving notices by class'
            });
        }
    }
}

export default NoticeController;
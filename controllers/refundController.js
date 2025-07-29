import Refund from '../models/Refund.js';
import RefundValidator from '../validators/refundValidator.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { sendNotification } from '../utils/notifications.js';

class RefundController {
    constructor() {
        this.refundModel = new Refund();
    }

    /**
     * Create new refund
     */
    async createRefund(req, res) {
        try {
            const { schoolId } = req.user;
            const refundData = {
                ...req.body,
                createdBy: req.user.id,
                schoolId
            };

            // Validate input
            const validatedData = RefundValidator.validateAndSanitize(refundData, 'create');

            const result = await this.refundModel.create(validatedData);

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'CREATE',
                resource: 'REFUND',
                resourceId: result.data.id,
                details: {
                    paymentId: validatedData.paymentId,
                    amount: validatedData.amount,
                    reason: validatedData.reason,
                    status: validatedData.status
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Refund created: ${result.data.id} by user: ${req.user.id}`);

            return res.status(201).json({
                success: true,
                message: 'Refund created successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error creating refund: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get refund by ID
     */
    async getRefundById(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            // Validate ID
            RefundValidator.validateAndSanitize(parseInt(id), 'id');

            const result = await this.refundModel.getById(id, req.user.id, schoolId, req.user.role);

            logger.info(`Refund retrieved: ${id} by user: ${req.user.id}`);

            return res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error getting refund: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Refund not found'
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
     * Get all refunds for a payment
     */
    async getRefundsByPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            // Validate payment ID
            RefundValidator.validateAndSanitize(parseInt(paymentId), 'paymentId');

            // Validate filters
            const validatedFilters = RefundValidator.validateAndSanitize(filters, 'search');

            const result = await this.refundModel.getByPayment(paymentId, schoolId, validatedFilters);

            logger.info(`Payment refunds retrieved for payment: ${paymentId}`);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting payment refunds: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get all refunds with filtering
     */
    async getAllRefunds(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            // Validate filters
            const validatedFilters = RefundValidator.validateAndSanitize(filters, 'search');

            const result = await this.refundModel.getAll(validatedFilters);

            logger.info(`All refunds retrieved with filters`);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting all refunds: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Update refund
     */
    async updateRefund(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            // Validate ID
            RefundValidator.validateAndSanitize(parseInt(id), 'id');

            // Validate update data
            const validatedData = RefundValidator.validateAndSanitize(req.body, 'update');

            const result = await this.refundModel.update(id, validatedData, req.user.id, schoolId);

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'UPDATE',
                resource: 'REFUND',
                resourceId: BigInt(id),
                details: {
                    updatedFields: Object.keys(validatedData),
                    newStatus: validatedData.status
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Refund updated: ${id} by user: ${req.user.id}`);

            return res.status(200).json({
                success: true,
                message: 'Refund updated successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error updating refund: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Refund not found'
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Process refund
     */
    async processRefund(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            // Validate ID
            RefundValidator.validateAndSanitize(parseInt(id), 'id');

            const result = await this.refundModel.processRefund(id, req.user.id, schoolId);

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'PROCESS',
                resource: 'REFUND',
                resourceId: BigInt(id),
                details: {
                    newStatus: result.data.status,
                    gatewayResult: result.gatewayResult
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Refund processed: ${id} by user: ${req.user.id}`);

            return res.status(200).json({
                success: true,
                message: 'Refund processed successfully',
                data: result.data,
                gatewayResult: result.gatewayResult
            });

        } catch (error) {
            logger.error(`Error processing refund: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Refund not found'
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Cancel refund
     */
    async cancelRefund(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;
            const { reason } = req.body;

            // Validate ID
            RefundValidator.validateAndSanitize(parseInt(id), 'id');

            // Validate reason
            const validatedReason = RefundValidator.validateAndSanitize(reason, 'reason');

            const result = await this.refundModel.cancelRefund(id, req.user.id, schoolId, validatedReason);

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'CANCEL',
                resource: 'REFUND',
                resourceId: BigInt(id),
                details: {
                    reason: validatedReason,
                    newStatus: 'CANCELLED'
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Refund cancelled: ${id} by user: ${req.user.id}`);

            return res.status(200).json({
                success: true,
                message: 'Refund cancelled successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error cancelling refund: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Refund not found'
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Delete refund
     */
    async deleteRefund(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            // Validate ID
            RefundValidator.validateAndSanitize(parseInt(id), 'id');

            const result = await this.refundModel.delete(id, req.user.id, schoolId);

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'DELETE',
                resource: 'REFUND',
                resourceId: BigInt(id),
                details: {
                    refundAmount: result.data.amount,
                    refundStatus: result.data.status
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Refund deleted: ${id} by user: ${req.user.id}`);

            return res.status(200).json({
                success: true,
                message: 'Refund deleted successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error deleting refund: ${error.message}`);
            
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    message: 'Refund not found'
                });
            }

            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Bulk update refunds
     */
    async bulkUpdateRefunds(req, res) {
        try {
            const { schoolId } = req.user;

            // Validate bulk update data
            const validatedData = RefundValidator.validateAndSanitize(req.body, 'bulkUpdate');

            const result = await this.refundModel.bulkUpdate(validatedData.refundIds, validatedData.updates, req.user.id, schoolId);

            // Create audit log
            await createAuditLog({
                userId: BigInt(req.user.id),
                schoolId: BigInt(schoolId),
                action: 'BULK_UPDATE',
                resource: 'REFUND',
                resourceId: null,
                details: {
                    refundIds: validatedData.refundIds,
                    updates: validatedData.updates,
                    successCount: result.data.length,
                    errorCount: result.errors ? result.errors.length : 0
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            logger.info(`Bulk update refunds: ${validatedData.refundIds.length} refunds by user: ${req.user.id}`);

            return res.status(200).json({
                success: true,
                message: `Updated ${result.data.length} refunds successfully`,
                data: result.data,
                errors: result.errors
            });

        } catch (error) {
            logger.error(`Error bulk updating refunds: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get refund statistics
     */
    async getRefundStatistics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            // Validate statistics filters
            const validatedFilters = RefundValidator.validateAndSanitize(filters, 'statistics');

            const result = await this.refundModel.getStatistics(schoolId, validatedFilters);

            logger.info(`Refund statistics retrieved for school: ${schoolId}`);

            return res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error getting refund statistics: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Search refunds
     */
    async searchRefunds(req, res) {
        try {
            const { schoolId } = req.user;
            const { searchTerm, ...filters } = req.query;

            if (!searchTerm) {
                return res.status(400).json({
                    success: false,
                    message: 'Search term is required'
                });
            }

            // Validate search filters
            const validatedFilters = RefundValidator.validateAndSanitize(filters, 'search');

            const result = await this.refundModel.searchRefunds(schoolId, searchTerm, validatedFilters);

            logger.info(`Refund search performed: "${searchTerm}"`);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error searching refunds: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get refund dashboard
     */
    async getRefundDashboard(req, res) {
        try {
            const { schoolId } = req.user;
            const { role } = req.user;

            // Get recent refunds
            const recentRefunds = await this.refundModel.getAll({
                page: 1,
                limit: 10,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });

            // Get refund statistics
            const statistics = await this.refundModel.getStatistics(schoolId);

            // Get pending refunds
            const pendingRefunds = await this.refundModel.getAll({
                page: 1,
                limit: 10,
                status: 'PENDING',
                sortBy: 'createdAt',
                sortOrder: 'asc'
            });

            // Role-specific data
            let roleSpecificData = {};
            if (role === 'ACCOUNTANT' || role === 'SCHOOL_ADMIN') {
                const processingRefunds = await this.refundModel.getAll({
                    page: 1,
                    limit: 10,
                    status: 'PROCESSING',
                    sortBy: 'createdAt',
                    sortOrder: 'asc'
                });
                roleSpecificData = {
                    processingRefunds: processingRefunds.data
                };
            }

            const dashboardData = {
                recentRefunds: recentRefunds.data,
                pendingRefunds: pendingRefunds.data,
                statistics: statistics.data,
                roleSpecific: roleSpecificData
            };

            logger.info(`Refund dashboard retrieved for user: ${req.user.id}`);

            return res.status(200).json({
                success: true,
                data: dashboardData
            });

        } catch (error) {
            logger.error(`Error getting refund dashboard: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get refund analytics
     */
    async getRefundAnalytics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            // Validate analytics filters
            const validatedFilters = RefundValidator.validateAndSanitize(filters, 'statistics');

            const result = await this.refundModel.getStatistics(schoolId, validatedFilters);

            // Calculate additional analytics
            const analytics = {
                ...result.data,
                trends: {
                    daily: await this.getDailyTrends(schoolId, validatedFilters),
                    monthly: await this.getMonthlyTrends(schoolId, validatedFilters),
                    yearly: await this.getYearlyTrends(schoolId, validatedFilters)
                },
                topReasons: await this.getTopReasons(schoolId, validatedFilters),
                successRateByGateway: await this.getSuccessRateByGateway(schoolId, validatedFilters)
            };

            logger.info(`Refund analytics retrieved for school: ${schoolId}`);

            return res.status(200).json({
                success: true,
                data: analytics
            });

        } catch (error) {
            logger.error(`Error getting refund analytics: ${error.message}`);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get daily trends
     */
    async getDailyTrends(schoolId, filters) {
        try {
            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (filters.startDate || filters.endDate) {
                where.createdAt = {};
                if (filters.startDate) {
                    where.createdAt.gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    where.createdAt.lte = new Date(filters.endDate);
                }
            }

            const trends = await this.refundModel.prisma.refund.groupBy({
                by: ['createdAt'],
                where,
                _count: { createdAt: true },
                _sum: { amount: true }
            });

            return trends;
        } catch (error) {
            logger.error(`Error getting daily trends: ${error.message}`);
            return [];
        }
    }

    /**
     * Get monthly trends
     */
    async getMonthlyTrends(schoolId, filters) {
        try {
            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (filters.startDate || filters.endDate) {
                where.createdAt = {};
                if (filters.startDate) {
                    where.createdAt.gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    where.createdAt.lte = new Date(filters.endDate);
                }
            }

            const trends = await this.refundModel.prisma.refund.groupBy({
                by: ['createdAt'],
                where,
                _count: { createdAt: true },
                _sum: { amount: true }
            });

            return trends;
        } catch (error) {
            logger.error(`Error getting monthly trends: ${error.message}`);
            return [];
        }
    }

    /**
     * Get yearly trends
     */
    async getYearlyTrends(schoolId, filters) {
        try {
            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (filters.startDate || filters.endDate) {
                where.createdAt = {};
                if (filters.startDate) {
                    where.createdAt.gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    where.createdAt.lte = new Date(filters.endDate);
                }
            }

            const trends = await this.refundModel.prisma.refund.groupBy({
                by: ['createdAt'],
                where,
                _count: { createdAt: true },
                _sum: { amount: true }
            });

            return trends;
        } catch (error) {
            logger.error(`Error getting yearly trends: ${error.message}`);
            return [];
        }
    }

    /**
     * Get top reasons
     */
    async getTopReasons(schoolId, filters) {
        try {
            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (filters.startDate || filters.endDate) {
                where.createdAt = {};
                if (filters.startDate) {
                    where.createdAt.gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    where.createdAt.lte = new Date(filters.endDate);
                }
            }

            const reasons = await this.refundModel.prisma.refund.groupBy({
                by: ['reason'],
                where,
                _count: { reason: true },
                _sum: { amount: true }
            });

            return reasons.sort((a, b) => b._count.reason - a._count.reason).slice(0, 10);
        } catch (error) {
            logger.error(`Error getting top reasons: ${error.message}`);
            return [];
        }
    }

    /**
     * Get success rate by gateway
     */
    async getSuccessRateByGateway(schoolId, filters) {
        try {
            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (filters.startDate || filters.endDate) {
                where.createdAt = {};
                if (filters.startDate) {
                    where.createdAt.gte = new Date(filters.startDate);
                }
                if (filters.endDate) {
                    where.createdAt.lte = new Date(filters.endDate);
                }
            }

            const gatewayStats = await this.refundModel.prisma.refund.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            return gatewayStats;
        } catch (error) {
            logger.error(`Error getting success rate by gateway: ${error.message}`);
            return [];
        }
    }
}

export default RefundController;
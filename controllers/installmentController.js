import Installment from '../models/Installment.js';
import InstallmentValidator from '../validators/installmentValidator.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { sendNotification } from '../utils/notifications.js';
import { cacheManager } from '../cache/cacheManager.js';
class InstallmentController {
    constructor() {
        this.installmentModel = new Installment();
    }

    /**
     * Create new installment
     */
    async createInstallment(req, res) {
        try {
            const { error, value } = InstallmentValidator.validateCreate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const sanitizedData = InstallmentValidator.sanitizeData(value);
            const { schoolId, userId } = req.user;

            // Check business rules
            const existingInstallments = await this.installmentModel.getByPayment(
                sanitizedData.paymentId,
                schoolId
            );

            const businessErrors = InstallmentValidator.validateBusinessRules(
                sanitizedData,
                existingInstallments.data || []
            );

            if (businessErrors.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Business rule validation failed',
                    errors: businessErrors
                });
            }

            const result = await this.installmentModel.create({
                ...sanitizedData,
                schoolId: parseInt(schoolId)
            });

            // Clear cache
            await cacheManager.clearPattern('installment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'CREATE',
                resource: 'INSTALLMENT',
                resourceId: result.data.id,
                details: `Created installment #${result.data.installmentNumber} for payment ${result.data.paymentId}`,
                ipAddress: req.ip
            });

            logger.info(`Installment created: ${result.data.id} by user: ${userId}`);

            return res.status(201).json({
                success: true,
                message: 'Installment created successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error creating installment: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get installment by ID
     */
    async getInstallmentById(req, res) {
        try {
            const { id } = req.params;
            const { error } = InstallmentValidator.validateId(parseInt(id));
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid installment ID',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const { schoolId, userId, role } = req.user;
            const result = await this.installmentModel.getById(
                parseInt(id),
                parseInt(userId),
                parseInt(schoolId),
                role
            );

            return res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error getting installment: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get installments by payment ID
     */
    async getInstallmentsByPayment(req, res) {
        try {
            const { paymentId } = req.params;
            const { error } = InstallmentValidator.validatePaymentId(parseInt(paymentId));
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment ID',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const { schoolId } = req.user;
            const filters = req.query;

            // Validate filters
            const { error: filterError } = InstallmentValidator.validateFilters(filters);
            if (filterError) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid filter parameters',
                    errors: filterError.details.map(detail => detail.message)
                });
            }

            const result = await this.installmentModel.getByPayment(
                parseInt(paymentId),
                parseInt(schoolId),
                filters
            );

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting payment installments: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get all installments with filtering
     */
    async getAllInstallments(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            // Validate filters
            const { error: filterError } = InstallmentValidator.validateFilters(filters);
            if (filterError) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid filter parameters',
                    errors: filterError.details.map(detail => detail.message)
                });
            }

            const result = await this.installmentModel.getAll(filters);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting all installments: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Update installment
     */
    async updateInstallment(req, res) {
        try {
            const { id } = req.params;
            const { error: idError } = InstallmentValidator.validateId(parseInt(id));
            if (idError) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid installment ID',
                    errors: idError.details.map(detail => detail.message)
                });
            }

            const { error, value } = InstallmentValidator.validateUpdate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const sanitizedData = InstallmentValidator.sanitizeData(value);
            const { schoolId, userId } = req.user;

            const result = await this.installmentModel.update(
                parseInt(id),
                sanitizedData,
                parseInt(userId),
                parseInt(schoolId)
            );

            // Clear cache
            await cacheManager.clearPattern('installment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'UPDATE',
                resource: 'INSTALLMENT',
                resourceId: parseInt(id),
                details: `Updated installment ${id}`,
                ipAddress: req.ip
            });

            logger.info(`Installment updated: ${id} by user: ${userId}`);

            return res.status(200).json({
                success: true,
                message: 'Installment updated successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error updating installment: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Mark installment as paid
     */
    async markAsPaid(req, res) {
        try {
            const { id } = req.params;
            const { error: idError } = InstallmentValidator.validateId(parseInt(id));
            if (idError) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid installment ID',
                    errors: idError.details.map(detail => detail.message)
                });
            }

            const { error, value } = InstallmentValidator.validatePayment(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const { schoolId, userId } = req.user;

            const result = await this.installmentModel.markAsPaid(
                parseInt(id),
                parseInt(userId),
                parseInt(schoolId),
                value
            );

            // Clear cache
            await cacheManager.clearPattern('installment:*');
            await cacheManager.clearPattern('payment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'PAY',
                resource: 'INSTALLMENT',
                resourceId: parseInt(id),
                details: `Marked installment ${id} as paid`,
                ipAddress: req.ip
            });

            logger.info(`Installment marked as paid: ${id} by user: ${userId}`);

            return res.status(200).json({
                success: true,
                message: 'Installment marked as paid successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error marking installment as paid: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Mark installment as overdue
     */
    async markAsOverdue(req, res) {
        try {
            const { id } = req.params;
            const { error: idError } = InstallmentValidator.validateId(parseInt(id));
            if (idError) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid installment ID',
                    errors: idError.details.map(detail => detail.message)
                });
            }

            const { schoolId, userId } = req.user;

            const result = await this.installmentModel.markAsOverdue(
                parseInt(id),
                parseInt(userId),
                parseInt(schoolId)
            );

            // Clear cache
            await cacheManager.clearPattern('installment:*');
            await cacheManager.clearPattern('payment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'OVERDUE',
                resource: 'INSTALLMENT',
                resourceId: parseInt(id),
                details: `Marked installment ${id} as overdue`,
                ipAddress: req.ip
            });

            logger.info(`Installment marked as overdue: ${id} by user: ${userId}`);

            return res.status(200).json({
                success: true,
                message: 'Installment marked as overdue successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error marking installment as overdue: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Delete installment
     */
    async deleteInstallment(req, res) {
        try {
            const { id } = req.params;
            const { error: idError } = InstallmentValidator.validateId(parseInt(id));
            if (idError) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid installment ID',
                    errors: idError.details.map(detail => detail.message)
                });
            }

            const { schoolId, userId } = req.user;

            const result = await this.installmentModel.delete(
                parseInt(id),
                parseInt(userId),
                parseInt(schoolId)
            );

            // Clear cache
            await cacheManager.clearPattern('installment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'DELETE',
                resource: 'INSTALLMENT',
                resourceId: parseInt(id),
                details: `Deleted installment ${id}`,
                ipAddress: req.ip
            });

            logger.info(`Installment deleted: ${id} by user: ${userId}`);

            return res.status(200).json({
                success: true,
                message: 'Installment deleted successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error deleting installment: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Bulk create installments
     */
    async bulkCreateInstallments(req, res) {
        try {
            const { error, value } = InstallmentValidator.validateBulkCreate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: error.details.map(detail => detail.message)
                });
            }

            const { schoolId, userId } = req.user;

            const result = await this.installmentModel.bulkCreate(
                value.installments,
                parseInt(userId),
                parseInt(schoolId)
            );

            // Clear cache
            await cacheManager.clearPattern('installment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'BULK_CREATE',
                resource: 'INSTALLMENT',
                resourceId: null,
                details: `Bulk created ${result.data.length} installments`,
                ipAddress: req.ip
            });

            logger.info(`Bulk installments created: ${result.data.length} by user: ${userId}`);

            return res.status(201).json({
                success: true,
                message: `Successfully created ${result.data.length} installments`,
                data: result.data,
                errors: result.errors
            });

        } catch (error) {
            logger.error(`Error bulk creating installments: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get installment statistics
     */
    async getInstallmentStatistics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            // Validate filters
            const { error: filterError } = InstallmentValidator.validateStatisticsFilters(filters);
            if (filterError) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid filter parameters',
                    errors: filterError.details.map(detail => detail.message)
                });
            }

            const result = await this.installmentModel.getStatistics(
                parseInt(schoolId),
                filters
            );

            return res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error getting installment statistics: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Search installments
     */
    async searchInstallments(req, res) {
        try {
            const { searchTerm } = req.params;
            const { schoolId } = req.user;
            const filters = req.query;

            // Validate search
            const { error: searchError } = InstallmentValidator.validateSearch(searchTerm, filters);
            if (searchError) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid search parameters',
                    errors: searchError.details.map(detail => detail.message)
                });
            }

            const result = await this.installmentModel.searchInstallments(
                parseInt(schoolId),
                searchTerm,
                filters
            );

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error searching installments: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get overdue installments
     */
    async getOverdueInstallments(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                overdue: 'true'
            };

            const result = await this.installmentModel.getAll(filters);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting overdue installments: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get upcoming installments
     */
    async getUpcomingInstallments(req, res) {
        try {
            const { schoolId } = req.user;
            const { days = 30 } = req.query;

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + parseInt(days));

            const filters = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
                status: 'PENDING'
            };

            const result = await this.installmentModel.getAll(filters);

            return res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error getting upcoming installments: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get installment dashboard summary
     */
    async getDashboardSummary(req, res) {
        try {
            const { schoolId } = req.user;

            // Get statistics for current month
            const currentDate = new Date();
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

            const [monthlyStats, overdueStats, upcomingStats] = await Promise.all([
                this.installmentModel.getStatistics(parseInt(schoolId), {
                    startDate: startOfMonth.toISOString(),
                    endDate: endOfMonth.toISOString()
                }),
                this.installmentModel.getStatistics(parseInt(schoolId), {
                    status: 'OVERDUE'
                }),
                this.installmentModel.getAll({
                    status: 'PENDING',
                    startDate: new Date().toISOString(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    limit: 5
                })
            ]);

            const summary = {
                monthly: monthlyStats.data,
                overdue: overdueStats.data,
                upcoming: upcomingStats.data,
                totalOverdueAmount: overdueStats.data.overdueAmount,
                totalUpcomingAmount: upcomingStats.data?.reduce((sum, inst) => sum + parseFloat(inst.amount), 0) || 0
            };

            return res.status(200).json({
                success: true,
                data: summary
            });

        } catch (error) {
            logger.error(`Error getting installment dashboard summary: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

export { InstallmentController };
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { sendNotification } from '../utils/notifications.js';

class Refund {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new refund
     */
    async create(data) {
        try {
            // Check if payment exists and is eligible for refund
            const payment = await this.prisma.payment.findFirst({
                where: {
                    id: BigInt(data.paymentId),
                    schoolId: BigInt(data.schoolId),
                    deletedAt: null
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
                    parent: {
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

            if (!payment) {
                throw new Error('Payment not found');
            }

            // Check if payment is eligible for refund
            if (payment.status !== 'PAID' && payment.status !== 'PARTIALLY_PAID') {
                throw new Error('Payment is not eligible for refund');
            }

            // Check if refund amount is valid
            const totalRefunded = await this.prisma.refund.aggregate({
                where: {
                    paymentId: BigInt(data.paymentId),
                    status: { in: ['COMPLETED', 'PROCESSING'] }
                },
                _sum: { amount: true }
            });

            const alreadyRefunded = totalRefunded._sum.amount || 0;
            const refundableAmount = parseFloat(payment.total) - parseFloat(alreadyRefunded);

            if (parseFloat(data.amount) > refundableAmount) {
                throw new Error(`Refund amount cannot exceed refundable amount: ${refundableAmount}`);
            }

            const refund = await this.prisma.refund.create({
                data: {
                    paymentId: BigInt(data.paymentId),
                    amount: data.amount,
                    reason: data.reason,
                    status: data.status || 'PENDING',
                    processedDate: data.processedDate || null,
                    gatewayRefundId: data.gatewayRefundId || null,
                    remarks: data.remarks || null,
                    schoolId: BigInt(data.schoolId),
                    createdBy: BigInt(data.createdBy)
                },
                include: {
                    payment: {
                        select: {
                            id: true,
                            total: true,
                            status: true,
                            method: true,
                            gateway: true,
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
                            parent: {
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
                            name: true,
                            email: true
                        }
                    }
                }
            });

            return {
                success: true,
                data: refund
            };

        } catch (error) {
            logger.error(`Error creating refund: ${error.message}`);
            throw new Error(`Failed to create refund: ${error.message}`);
        }
    }

    /**
     * Get refund by ID
     */
    async getById(id, userId, schoolId, userRole) {
        try {
            const refund = await this.prisma.refund.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    payment: {
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
                            parent: {
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
                    }
                }
            });

            if (!refund) {
                throw new Error('Refund not found');
            }

            // Check access permissions based on user role
            if (userRole === 'STUDENT') {
                // Students can only access refunds for their own payments
                if (refund.payment.studentId && refund.payment.student.userId !== BigInt(userId)) {
                    throw new Error('Access denied');
                }
            } else if (userRole === 'PARENT') {
                // Parents can only access refunds for their children's payments
                if (refund.payment.parentId && refund.payment.parent.userId !== BigInt(userId)) {
                    throw new Error('Access denied');
                }
            } else if (userRole === 'TEACHER') {
                // Teachers cannot access refund information
                throw new Error('Access denied');
            }

            return {
                success: true,
                data: refund
            };

        } catch (error) {
            logger.error(`Error getting refund: ${error.message}`);
            throw new Error(`Failed to get refund: ${error.message}`);
        }
    }

    /**
     * Get all refunds for a payment
     */
    async getByPayment(paymentId, schoolId, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

            const where = {
                paymentId: BigInt(paymentId),
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            const [refunds, total] = await Promise.all([
                this.prisma.refund.findMany({
                    where,
                    include: {
                        payment: {
                            select: {
                                id: true,
                                total: true,
                                status: true,
                                method: true
                            }
                        },
                        createdByUser: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.refund.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: refunds,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting payment refunds: ${error.message}`);
            throw new Error(`Failed to get payment refunds: ${error.message}`);
        }
    }

    /**
     * Get all refunds with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                paymentId,
                status,
                startDate,
                endDate,
                minAmount,
                maxAmount,
                reason,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {
                deletedAt: null
            };

            if (paymentId) {
                where.paymentId = BigInt(paymentId);
            }

            if (status) {
                where.status = status;
            }

            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) {
                    where.createdAt.gte = new Date(startDate);
                }
                if (endDate) {
                    where.createdAt.lte = new Date(endDate);
                }
            }

            if (minAmount !== undefined || maxAmount !== undefined) {
                where.amount = {};
                if (minAmount !== undefined) {
                    where.amount.gte = parseFloat(minAmount);
                }
                if (maxAmount !== undefined) {
                    where.amount.lte = parseFloat(maxAmount);
                }
            }

            if (reason) {
                where.reason = {
                    contains: reason,
                    mode: 'insensitive'
                };
            }

            const [refunds, total] = await Promise.all([
                this.prisma.refund.findMany({
                    where,
                    include: {
                        payment: {
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
                                parent: {
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
                        },
                        createdByUser: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.refund.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: refunds,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all refunds: ${error.message}`);
            throw new Error(`Failed to get refunds: ${error.message}`);
        }
    }

    /**
     * Update refund
     */
    async update(id, updateData, userId, schoolId) {
        try {
            const refund = await this.prisma.refund.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!refund) {
                throw new Error('Refund not found');
            }

            // Only allow updates if refund is not completed
            if (refund.status === 'COMPLETED') {
                throw new Error('Cannot update completed refund');
            }

            const updatedRefund = await this.prisma.refund.update({
                where: { id: BigInt(id) },
                data: {
                    status: updateData.status,
                    processedDate: updateData.processedDate,
                    gatewayRefundId: updateData.gatewayRefundId,
                    remarks: updateData.remarks,
                    updatedBy: BigInt(userId)
                },
                include: {
                    payment: {
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
                            parent: {
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

            return {
                success: true,
                data: updatedRefund
            };

        } catch (error) {
            logger.error(`Error updating refund: ${error.message}`);
            throw new Error(`Failed to update refund: ${error.message}`);
        }
    }

    /**
     * Process refund
     */
    async processRefund(id, userId, schoolId) {
        try {
            const refund = await this.prisma.refund.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    payment: {
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
                            parent: {
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
                    }
                }
            });

            if (!refund) {
                throw new Error('Refund not found');
            }

            if (refund.status !== 'PENDING') {
                throw new Error('Refund is not in pending status');
            }

            // Process refund through payment gateway
            const gatewayResult = await this.processGatewayRefund(refund);

            const updatedRefund = await this.prisma.refund.update({
                where: { id: BigInt(id) },
                data: {
                    status: gatewayResult.success ? 'COMPLETED' : 'FAILED',
                    processedDate: new Date(),
                    gatewayRefundId: gatewayResult.gatewayRefundId,
                    remarks: gatewayResult.message,
                    updatedBy: BigInt(userId)
                },
                include: {
                    payment: {
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
                            parent: {
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
                    }
                }
            });

            // Send notification
            await this.sendRefundNotification(updatedRefund);

            return {
                success: true,
                data: updatedRefund,
                gatewayResult
            };

        } catch (error) {
            logger.error(`Error processing refund: ${error.message}`);
            throw new Error(`Failed to process refund: ${error.message}`);
        }
    }

    /**
     * Cancel refund
     */
    async cancelRefund(id, userId, schoolId, reason) {
        try {
            const refund = await this.prisma.refund.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!refund) {
                throw new Error('Refund not found');
            }

            if (refund.status !== 'PENDING') {
                throw new Error('Only pending refunds can be cancelled');
            }

            const updatedRefund = await this.prisma.refund.update({
                where: { id: BigInt(id) },
                data: {
                    status: 'CANCELLED',
                    remarks: reason,
                    updatedBy: BigInt(userId)
                },
                include: {
                    payment: {
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
                            parent: {
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
                    }
                }
            });

            return {
                success: true,
                data: updatedRefund
            };

        } catch (error) {
            logger.error(`Error cancelling refund: ${error.message}`);
            throw new Error(`Failed to cancel refund: ${error.message}`);
        }
    }

    /**
     * Delete refund
     */
    async delete(id, userId, schoolId) {
        try {
            const refund = await this.prisma.refund.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!refund) {
                throw new Error('Refund not found');
            }

            // Only allow deletion of pending or cancelled refunds
            if (refund.status === 'COMPLETED' || refund.status === 'PROCESSING') {
                throw new Error('Cannot delete completed or processing refunds');
            }

            const deletedRefund = await this.prisma.refund.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date()
                }
            });

            return {
                success: true,
                data: deletedRefund
            };

        } catch (error) {
            logger.error(`Error deleting refund: ${error.message}`);
            throw new Error(`Failed to delete refund: ${error.message}`);
        }
    }

    /**
     * Bulk update refunds
     */
    async bulkUpdate(refundIds, updateData, userId, schoolId) {
        try {
            const results = [];
            const errors = [];

            for (const refundId of refundIds) {
                try {
                    const result = await this.update(refundId, updateData, userId, schoolId);
                    results.push(result.data);
                } catch (error) {
                    errors.push({
                        refundId: refundId,
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
            logger.error(`Error bulk updating refunds: ${error.message}`);
            throw new Error(`Failed to bulk update refunds: ${error.message}`);
        }
    }

    /**
     * Get refund statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, status, paymentId } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) {
                    where.createdAt.gte = new Date(startDate);
                }
                if (endDate) {
                    where.createdAt.lte = new Date(endDate);
                }
            }

            if (status) {
                where.status = status;
            }

            if (paymentId) {
                where.paymentId = BigInt(paymentId);
            }

            const [
                totalRefunds,
                totalAmount,
                pendingRefunds,
                completedRefunds,
                failedRefunds,
                cancelledRefunds,
                refundsByStatus,
                refundsByMonth,
                averageRefundAmount
            ] = await Promise.all([
                this.prisma.refund.count({ where }),
                this.prisma.refund.aggregate({
                    where,
                    _sum: { amount: true }
                }),
                this.prisma.refund.count({
                    where: { ...where, status: 'PENDING' }
                }),
                this.prisma.refund.count({
                    where: { ...where, status: 'COMPLETED' }
                }),
                this.prisma.refund.count({
                    where: { ...where, status: 'FAILED' }
                }),
                this.prisma.refund.count({
                    where: { ...where, status: 'CANCELLED' }
                }),
                this.prisma.refund.groupBy({
                    by: ['status'],
                    where,
                    _count: { status: true },
                    _sum: { amount: true }
                }),
                this.prisma.refund.groupBy({
                    by: ['createdAt'],
                    where,
                    _count: { createdAt: true },
                    _sum: { amount: true }
                }),
                this.prisma.refund.aggregate({
                    where,
                    _avg: { amount: true }
                })
            ]);

            return {
                success: true,
                data: {
                    totalRefunds,
                    totalAmount: totalAmount._sum.amount || 0,
                    pendingRefunds,
                    completedRefunds,
                    failedRefunds,
                    cancelledRefunds,
                    successRate: totalRefunds > 0 ? (completedRefunds / totalRefunds) * 100 : 0,
                    averageRefundAmount: averageRefundAmount._avg.amount || 0,
                    refundsByStatus,
                    refundsByMonth
                }
            };

        } catch (error) {
            logger.error(`Error getting refund statistics: ${error.message}`);
            throw new Error(`Failed to get refund statistics: ${error.message}`);
        }
    }

    /**
     * Search refunds
     */
    async searchRefunds(schoolId, searchTerm, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                OR: [
                    {
                        reason: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        remarks: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        gatewayRefundId: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        payment: {
                            student: {
                                name: {
                                    contains: searchTerm,
                                    mode: 'insensitive'
                                }
                            }
                        }
                    },
                    {
                        payment: {
                            parent: {
                                name: {
                                    contains: searchTerm,
                                    mode: 'insensitive'
                                }
                            }
                        }
                    }
                ]
            };

            const [refunds, total] = await Promise.all([
                this.prisma.refund.findMany({
                    where,
                    include: {
                        payment: {
                            include: {
                                student: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                parent: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        },
                        createdByUser: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.refund.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: refunds,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error searching refunds: ${error.message}`);
            throw new Error(`Failed to search refunds: ${error.message}`);
        }
    }

    /**
     * Process refund through payment gateway
     */
    async processGatewayRefund(refund) {
        try {
            // This is a placeholder for actual payment gateway integration
            // In a real implementation, you would integrate with Stripe, PayPal, etc.
            
            const payment = await this.prisma.payment.findFirst({
                where: { id: refund.paymentId }
            });

            // Simulate gateway processing
            const success = Math.random() > 0.1; // 90% success rate for demo
            
            if (success) {
                return {
                    success: true,
                    gatewayRefundId: `ref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    message: 'Refund processed successfully'
                };
            } else {
                return {
                    success: false,
                    message: 'Gateway processing failed'
                };
            }

        } catch (error) {
            logger.error(`Error processing gateway refund: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Send refund notification
     */
    async sendRefundNotification(refund) {
        try {
            const notificationData = {
                title: 'Refund Status Update',
                message: `Your refund of $${refund.amount} has been ${refund.status.toLowerCase()}.`,
                type: 'REFUND_STATUS',
                data: {
                    refundId: refund.id,
                    amount: refund.amount,
                    status: refund.status
                }
            };

            // Send to student if exists
            if (refund.payment.student && refund.payment.student.user) {
                await sendNotification({
                    userId: refund.payment.student.user.id,
                    ...notificationData
                });
            }

            // Send to parent if exists
            if (refund.payment.parent && refund.payment.parent.user) {
                await sendNotification({
                    userId: refund.payment.parent.user.id,
                    ...notificationData
                });
            }

        } catch (error) {
            logger.error(`Error sending refund notification: ${error.message}`);
        }
    }
}

export default Refund;

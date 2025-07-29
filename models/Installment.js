import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { sendNotification } from '../utils/notifications.js';

class Installment {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new installment
     */
    async create(data) {
        try {
            // Check if payment exists
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

            // Check if installment number is unique for this payment
            const existingInstallment = await this.prisma.installment.findFirst({
                where: {
                    paymentId: BigInt(data.paymentId),
                    installmentNumber: data.installmentNumber
                }
            });

            if (existingInstallment) {
                throw new Error(`Installment number ${data.installmentNumber} already exists for this payment`);
            }

            // Calculate total installments for this payment
            const totalInstallments = await this.prisma.installment.count({
                where: { paymentId: BigInt(data.paymentId) }
            });

            // Validate installment amount
            const totalInstallmentAmount = await this.prisma.installment.aggregate({
                where: { paymentId: BigInt(data.paymentId) },
                _sum: { amount: true }
            });

            const currentTotal = totalInstallmentAmount._sum.amount || 0;
            const paymentTotal = parseFloat(payment.total);

            if (currentTotal + parseFloat(data.amount) > paymentTotal) {
                throw new Error(`Total installment amount cannot exceed payment total: ${paymentTotal}`);
            }

            const installment = await this.prisma.installment.create({
                data: {
                    paymentId: BigInt(data.paymentId),
                    installmentNumber: data.installmentNumber,
                    amount: data.amount,
                    dueDate: data.dueDate,
                    paidDate: data.paidDate || null,
                    status: data.status || 'PENDING',
                    lateFee: data.lateFee || 0,
                    remarks: data.remarks || null,
                    schoolId: BigInt(data.schoolId)
                },
                include: {
                    payment: {
                        select: {
                            id: true,
                            total: true,
                            status: true,
                            method: true,
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
                    }
                }
            });

            return {
                success: true,
                data: installment
            };

        } catch (error) {
            logger.error(`Error creating installment: ${error.message}`);
            throw new Error(`Failed to create installment: ${error.message}`);
        }
    }

    /**
     * Get installment by ID
     */
    async getById(id, userId, schoolId, userRole) {
        try {
            const installment = await this.prisma.installment.findFirst({
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
                    }
                }
            });

            if (!installment) {
                throw new Error('Installment not found');
            }

            // Check access permissions based on user role
            if (userRole === 'STUDENT') {
                // Students can only access installments for their own payments
                if (installment.payment.studentId && installment.payment.student.userId !== BigInt(userId)) {
                    throw new Error('Access denied');
                }
            } else if (userRole === 'PARENT') {
                // Parents can only access installments for their children's payments
                if (installment.payment.parentId && installment.payment.parent.userId !== BigInt(userId)) {
                    throw new Error('Access denied');
                }
            } else if (userRole === 'TEACHER') {
                // Teachers cannot access installment information
                throw new Error('Access denied');
            }

            return {
                success: true,
                data: installment
            };

        } catch (error) {
            logger.error(`Error getting installment: ${error.message}`);
            throw new Error(`Failed to get installment: ${error.message}`);
        }
    }

    /**
     * Get all installments for a payment
     */
    async getByPayment(paymentId, schoolId, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'dueDate', sortOrder = 'asc' } = filters;

            const where = {
                paymentId: BigInt(paymentId),
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            const [installments, total] = await Promise.all([
                this.prisma.installment.findMany({
                    where,
                    include: {
                        payment: {
                            select: {
                                id: true,
                                total: true,
                                status: true,
                                method: true
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.installment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: installments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting payment installments: ${error.message}`);
            throw new Error(`Failed to get payment installments: ${error.message}`);
        }
    }

    /**
     * Get all installments with filtering
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
                overdue,
                sortBy = 'dueDate',
                sortOrder = 'asc'
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
                where.dueDate = {};
                if (startDate) {
                    where.dueDate.gte = new Date(startDate);
                }
                if (endDate) {
                    where.dueDate.lte = new Date(endDate);
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

            if (overdue === 'true') {
                where.AND = [
                    { dueDate: { lt: new Date() } },
                    { status: { not: 'PAID' } }
                ];
            }

            const [installments, total] = await Promise.all([
                this.prisma.installment.findMany({
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
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.installment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: installments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all installments: ${error.message}`);
            throw new Error(`Failed to get installments: ${error.message}`);
        }
    }

    /**
     * Update installment
     */
    async update(id, updateData, userId, schoolId) {
        try {
            const installment = await this.prisma.installment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!installment) {
                throw new Error('Installment not found');
            }

            // Only allow updates if installment is not paid
            if (installment.status === 'PAID') {
                throw new Error('Cannot update paid installment');
            }

            const updatedInstallment = await this.prisma.installment.update({
                where: { id: BigInt(id) },
                data: {
                    amount: updateData.amount,
                    dueDate: updateData.dueDate,
                    status: updateData.status,
                    lateFee: updateData.lateFee,
                    remarks: updateData.remarks
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
                data: updatedInstallment
            };

        } catch (error) {
            logger.error(`Error updating installment: ${error.message}`);
            throw new Error(`Failed to update installment: ${error.message}`);
        }
    }

    /**
     * Mark installment as paid
     */
    async markAsPaid(id, userId, schoolId, paymentData = {}) {
        try {
            const installment = await this.prisma.installment.findFirst({
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

            if (!installment) {
                throw new Error('Installment not found');
            }

            if (installment.status === 'PAID') {
                throw new Error('Installment is already paid');
            }

            const updatedInstallment = await this.prisma.installment.update({
                where: { id: BigInt(id) },
                data: {
                    status: 'PAID',
                    paidDate: new Date(),
                    remarks: paymentData.remarks || 'Marked as paid'
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

            // Check if all installments are paid and update payment status
            await this.updatePaymentStatus(installment.paymentId);

            // Send notification
            await this.sendInstallmentPaidNotification(updatedInstallment);

            return {
                success: true,
                data: updatedInstallment
            };

        } catch (error) {
            logger.error(`Error marking installment as paid: ${error.message}`);
            throw new Error(`Failed to mark installment as paid: ${error.message}`);
        }
    }

    /**
     * Mark installment as overdue
     */
    async markAsOverdue(id, userId, schoolId) {
        try {
            const installment = await this.prisma.installment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!installment) {
                throw new Error('Installment not found');
            }

            if (installment.status === 'PAID') {
                throw new Error('Cannot mark paid installment as overdue');
            }

            // Calculate late fee if not already calculated
            let lateFee = installment.lateFee;
            if (installment.dueDate < new Date() && installment.lateFee === 0) {
                // Calculate 5% late fee
                lateFee = parseFloat(installment.amount) * 0.05;
            }

            const updatedInstallment = await this.prisma.installment.update({
                where: { id: BigInt(id) },
                data: {
                    status: 'OVERDUE',
                    lateFee: lateFee
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

            // Send overdue notification
            await this.sendOverdueNotification(updatedInstallment);

            return {
                success: true,
                data: updatedInstallment
            };

        } catch (error) {
            logger.error(`Error marking installment as overdue: ${error.message}`);
            throw new Error(`Failed to mark installment as overdue: ${error.message}`);
        }
    }

    /**
     * Delete installment
     */
    async delete(id, userId, schoolId) {
        try {
            const installment = await this.prisma.installment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!installment) {
                throw new Error('Installment not found');
            }

            // Only allow deletion of pending installments
            if (installment.status === 'PAID') {
                throw new Error('Cannot delete paid installment');
            }

            const deletedInstallment = await this.prisma.installment.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date()
                }
            });

            return {
                success: true,
                data: deletedInstallment
            };

        } catch (error) {
            logger.error(`Error deleting installment: ${error.message}`);
            throw new Error(`Failed to delete installment: ${error.message}`);
        }
    }

    /**
     * Bulk create installments
     */
    async bulkCreate(installments, userId, schoolId) {
        try {
            const results = [];
            const errors = [];

            for (const installmentData of installments) {
                try {
                    const data = {
                        ...installmentData,
                        schoolId: parseInt(schoolId)
                    };

                    const result = await this.create(data);
                    results.push(result.data);
                } catch (error) {
                    errors.push({
                        installmentNumber: installmentData.installmentNumber,
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
            logger.error(`Error bulk creating installments: ${error.message}`);
            throw new Error(`Failed to bulk create installments: ${error.message}`);
        }
    }

    /**
     * Get installment statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, paymentId, status } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null
            };

            if (startDate || endDate) {
                where.dueDate = {};
                if (startDate) {
                    where.dueDate.gte = new Date(startDate);
                }
                if (endDate) {
                    where.dueDate.lte = new Date(endDate);
                }
            }

            if (paymentId) {
                where.paymentId = BigInt(paymentId);
            }

            if (status) {
                where.status = status;
            }

            const [
                totalInstallments,
                paidInstallments,
                pendingInstallments,
                overdueInstallments,
                totalAmount,
                paidAmount,
                pendingAmount,
                overdueAmount,
                totalLateFees,
                installmentsByStatus,
                installmentsByMonth
            ] = await Promise.all([
                this.prisma.installment.count({ where }),
                this.prisma.installment.count({
                    where: { ...where, status: 'PAID' }
                }),
                this.prisma.installment.count({
                    where: { ...where, status: 'PENDING' }
                }),
                this.prisma.installment.count({
                    where: { ...where, status: 'OVERDUE' }
                }),
                this.prisma.installment.aggregate({
                    where,
                    _sum: { amount: true }
                }),
                this.prisma.installment.aggregate({
                    where: { ...where, status: 'PAID' },
                    _sum: { amount: true }
                }),
                this.prisma.installment.aggregate({
                    where: { ...where, status: 'PENDING' },
                    _sum: { amount: true }
                }),
                this.prisma.installment.aggregate({
                    where: { ...where, status: 'OVERDUE' },
                    _sum: { amount: true }
                }),
                this.prisma.installment.aggregate({
                    where: { ...where, status: 'OVERDUE' },
                    _sum: { lateFee: true }
                }),
                this.prisma.installment.groupBy({
                    by: ['status'],
                    where,
                    _count: { status: true },
                    _sum: { amount: true }
                }),
                this.prisma.installment.groupBy({
                    by: ['dueDate'],
                    where,
                    _count: { dueDate: true },
                    _sum: { amount: true }
                })
            ]);

            return {
                success: true,
                data: {
                    totalInstallments,
                    paidInstallments,
                    pendingInstallments,
                    overdueInstallments,
                    paymentRate: totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0,
                    totalAmount: totalAmount._sum.amount || 0,
                    paidAmount: paidAmount._sum.amount || 0,
                    pendingAmount: pendingAmount._sum.amount || 0,
                    overdueAmount: overdueAmount._sum.amount || 0,
                    totalLateFees: totalLateFees._sum.lateFee || 0,
                    installmentsByStatus,
                    installmentsByMonth
                }
            };

        } catch (error) {
            logger.error(`Error getting installment statistics: ${error.message}`);
            throw new Error(`Failed to get installment statistics: ${error.message}`);
        }
    }

    /**
     * Search installments
     */
    async searchInstallments(schoolId, searchTerm, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'dueDate', sortOrder = 'asc' } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                OR: [
                    {
                        remarks: {
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

            const [installments, total] = await Promise.all([
                this.prisma.installment.findMany({
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
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.installment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: installments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error searching installments: ${error.message}`);
            throw new Error(`Failed to search installments: ${error.message}`);
        }
    }

    /**
     * Update payment status based on installments
     */
    async updatePaymentStatus(paymentId) {
        try {
            const installments = await this.prisma.installment.findMany({
                where: {
                    paymentId: BigInt(paymentId),
                    deletedAt: null
                }
            });

            if (installments.length === 0) {
                return;
            }

            const totalInstallments = installments.length;
            const paidInstallments = installments.filter(i => i.status === 'PAID').length;
            const overdueInstallments = installments.filter(i => i.status === 'OVERDUE').length;

            let paymentStatus = 'PENDING';

            if (paidInstallments === totalInstallments) {
                paymentStatus = 'PAID';
            } else if (overdueInstallments > 0) {
                paymentStatus = 'OVERDUE';
            } else if (paidInstallments > 0) {
                paymentStatus = 'PARTIALLY_PAID';
            }

            await this.prisma.payment.update({
                where: { id: BigInt(paymentId) },
                data: { status: paymentStatus }
            });

        } catch (error) {
            logger.error(`Error updating payment status: ${error.message}`);
        }
    }

    /**
     * Send installment paid notification
     */
    async sendInstallmentPaidNotification(installment) {
        try {
            const notificationData = {
                title: 'Installment Paid',
                message: `Installment #${installment.installmentNumber} of $${installment.amount} has been paid successfully.`,
                type: 'INSTALLMENT_PAID',
                data: {
                    installmentId: installment.id,
                    amount: installment.amount,
                    installmentNumber: installment.installmentNumber
                }
            };

            // Send to student if exists
            if (installment.payment.student && installment.payment.student.user) {
                await sendNotification({
                    userId: installment.payment.student.user.id,
                    ...notificationData
                });
            }

            // Send to parent if exists
            if (installment.payment.parent && installment.payment.parent.user) {
                await sendNotification({
                    userId: installment.payment.parent.user.id,
                    ...notificationData
                });
            }

        } catch (error) {
            logger.error(`Error sending installment paid notification: ${error.message}`);
        }
    }

    /**
     * Send overdue notification
     */
    async sendOverdueNotification(installment) {
        try {
            const notificationData = {
                title: 'Installment Overdue',
                message: `Installment #${installment.installmentNumber} of $${installment.amount} is overdue. Late fee: $${installment.lateFee}`,
                type: 'INSTALLMENT_OVERDUE',
                data: {
                    installmentId: installment.id,
                    amount: installment.amount,
                    lateFee: installment.lateFee,
                    installmentNumber: installment.installmentNumber
                }
            };

            // Send to student if exists
            if (installment.payment.student && installment.payment.student.user) {
                await sendNotification({
                    userId: installment.payment.student.user.id,
                    ...notificationData
                });
            }

            // Send to parent if exists
            if (installment.payment.parent && installment.payment.parent.user) {
                await sendNotification({
                    userId: installment.payment.parent.user.id,
                    ...notificationData
                });
            }

        } catch (error) {
            logger.error(`Error sending overdue notification: ${error.message}`);
        }
    }
}
export default Installment; 
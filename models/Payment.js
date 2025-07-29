import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

class Payment {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create a new payment
     */
    async create(data) {
        try {
            // Calculate total if not provided
            const total = data.total || (data.amount - data.discount + data.fine);

            const payment = await this.prisma.payment.create({
                data: {
                    amount: data.amount,
                    discount: data.discount || 0,
                    fine: data.fine || 0,
                    total: total,
                    paymentDate: data.paymentDate || new Date(),
                    dueDate: data.dueDate,
                    status: data.status,
                    method: data.method,
                    type: data.type,
                    gateway: data.gateway,
                    transactionId: data.transactionId,
                    gatewayTransactionId: data.gatewayTransactionId,
                    receiptNumber: data.receiptNumber,
                    remarks: data.remarks,
                    metadata: data.metadata,
                    isRecurring: data.isRecurring || false,
                    recurringFrequency: data.recurringFrequency,
                    nextPaymentDate: data.nextPaymentDate,
                    studentId: data.studentId ? BigInt(data.studentId) : null,
                    parentId: data.parentId ? BigInt(data.parentId) : null,
                    feeStructureId: data.feeStructureId ? BigInt(data.feeStructureId) : null,
                    schoolId: BigInt(data.schoolId),
                    createdBy: BigInt(data.createdBy),
                    items: data.items ? {
                        createMany: {
                            data: data.items.map(item => ({
                                name: item.name,
                                amount: item.amount,
                                description: item.description,
                                feeItemId: item.feeItemId ? BigInt(item.feeItemId) : null,
                                schoolId: BigInt(data.schoolId)
                            }))
                        }
                    } : undefined
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            rollNumber: true
                        }
                    },
                    parent: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    feeStructure: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    items: true
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'CREATE',
                entity: 'PAYMENT',
                entityId: payment.id.toString(),
                details: `Payment created with amount ${payment.amount}`,
                userId: data.createdBy,
                schoolId: data.schoolId
            });

            return {
                success: true,
                data: payment
            };

        } catch (error) {
            logger.error(`Error creating payment: ${error.message}`);
            throw new Error(`Failed to create payment: ${error.message}`);
        }
    }

    /**
     * Get payment by ID
     */
    async getById(id, userId, schoolId, userRole) {
        try {
            const payment = await this.prisma.payment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            rollNumber: true,
                            class: {
                                select: {
                                    id: true,
                                    name: true
                                }
                            }
                        }
                    },
                    parent: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    feeStructure: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    items: true,
                    refunds: true,
                    installments: true,
                    paymentLogs: true
                }
            });

            if (!payment) {
                throw new Error('Payment not found');
            }

            // Check access permissions based on user role
            if (userRole === 'STUDENT') {
                // Students can only access their own payments
                if (payment.studentId && payment.student.userId !== BigInt(userId)) {
                    throw new Error('Access denied');
                }
            } else if (userRole === 'PARENT') {
                // Parents can only access payments for their children
                const parent = await this.prisma.parent.findFirst({
                    where: { userId: BigInt(userId) },
                    include: { children: true }
                });
                
                if (!parent || (payment.studentId && !parent.children.some(child => child.id === payment.studentId))) {
                    throw new Error('Access denied');
                }
            }

            return {
                success: true,
                data: payment
            };

        } catch (error) {
            logger.error(`Error getting payment: ${error.message}`);
            throw new Error(`Failed to get payment: ${error.message}`);
        }
    }

    /**
     * Get all payments with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                studentId,
                parentId,
                feeStructureId,
                status,
                method,
                type,
                gateway,
                minAmount,
                maxAmount,
                startDate,
                endDate,
                search,
                sortBy = 'paymentDate',
                sortOrder = 'desc',
                schoolId
            } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(studentId && { studentId: BigInt(studentId) }),
                ...(parentId && { parentId: BigInt(parentId) }),
                ...(feeStructureId && { feeStructureId: BigInt(feeStructureId) }),
                ...(status && { status }),
                ...(method && { method }),
                ...(type && { type }),
                ...(gateway && { gateway }),
                ...(minAmount && { amount: { gte: parseFloat(minAmount) } }),
                ...(maxAmount && { amount: { lte: parseFloat(maxAmount) } }),
                ...(startDate && endDate && {
                    paymentDate: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }),
                ...(search && {
                    OR: [
                        { receiptNumber: { contains: search, mode: 'insensitive' } },
                        { transactionId: { contains: search, mode: 'insensitive' } },
                        { gatewayTransactionId: { contains: search, mode: 'insensitive' } },
                        { student: { name: { contains: search, mode: 'insensitive' } } },
                        { parent: { name: { contains: search, mode: 'insensitive' } } }
                    ]
                })
            };

            const [payments, total] = await Promise.all([
                this.prisma.payment.findMany({
                    where,
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                rollNumber: true
                            }
                        },
                        parent: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        feeStructure: {
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
                this.prisma.payment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: payments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all payments: ${error.message}`);
            throw new Error(`Failed to get payments: ${error.message}`);
        }
    }

    /**
     * Update payment
     */
    async update(id, updateData, userId, schoolId) {
        try {
            // Check if payment exists and user has access
            const existingPayment = await this.prisma.payment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingPayment) {
                throw new Error('Payment not found');
            }

            // Only allow updating certain fields
            const allowedFields = [
                'status', 'remarks', 'metadata', 'gatewayTransactionId', 
                'receiptNumber', 'nextPaymentDate', 'isRecurring', 'recurringFrequency'
            ];
            
            const updatePayload = {};
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    updatePayload[field] = updateData[field];
                }
            }

            const updatedPayment = await this.prisma.payment.update({
                where: { id: BigInt(id) },
                data: {
                    ...updatePayload,
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                },
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
            });

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entity: 'PAYMENT',
                entityId: updatedPayment.id.toString(),
                details: `Payment updated`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedPayment
            };

        } catch (error) {
            logger.error(`Error updating payment: ${error.message}`);
            throw new Error(`Failed to update payment: ${error.message}`);
        }
    }

    /**
     * Delete payment (soft delete)
     */
    async delete(id, userId, schoolId) {
        try {
            // Check if payment exists and user has access
            const existingPayment = await this.prisma.payment.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingPayment) {
                throw new Error('Payment not found');
            }

            await this.prisma.payment.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: BigInt(userId)
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'DELETE',
                entity: 'PAYMENT',
                entityId: id.toString(),
                details: `Payment deleted`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                message: 'Payment deleted successfully'
            };

        } catch (error) {
            logger.error(`Error deleting payment: ${error.message}`);
            throw new Error(`Failed to delete payment: ${error.message}`);
        }
    }

    /**
     * Get payment statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, status, method, type } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    paymentDate: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }),
                ...(status && { status }),
                ...(method && { method }),
                ...(type && { type })
            };

            const [
                totalPayments,
                totalAmount,
                paymentsByStatus,
                paymentsByMethod,
                recentPayments
            ] = await Promise.all([
                this.prisma.payment.count({ where }),
                this.prisma.payment.aggregate({
                    where,
                    _sum: { amount: true }
                }),
                this.prisma.payment.groupBy({
                    by: ['status'],
                    where,
                    _count: { id: true },
                    _sum: { amount: true }
                }),
                this.prisma.payment.groupBy({
                    by: ['method'],
                    where,
                    _count: { id: true },
                    _sum: { amount: true }
                }),
                this.prisma.payment.findMany({
                    where,
                    include: {
                        student: {
                            select: {
                                name: true
                            }
                        }
                    },
                    orderBy: { paymentDate: 'desc' },
                    take: 10
                })
            ]);

            return {
                success: true,
                data: {
                    totalPayments,
                    totalAmount: totalAmount._sum.amount || 0,
                    averageAmount: totalPayments > 0 ? (totalAmount._sum.amount || 0) / totalPayments : 0,
                    paymentsByStatus,
                    paymentsByMethod,
                    recentPayments
                }
            };

        } catch (error) {
            logger.error(`Error getting payment statistics: ${error.message}`);
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    /**
     * Process payment webhook
     */
    async processWebhook(data) {
        try {
            // Validate webhook data
            if (!data.gateway || !data.gatewayTransactionId || !data.status) {
                throw new Error('Invalid webhook data');
            }

            // Find payment by gateway transaction ID
            const payment = await this.prisma.payment.findFirst({
                where: {
                    gatewayTransactionId: data.gatewayTransactionId,
                    gateway: data.gateway
                }
            });

            if (!payment) {
                throw new Error('Payment not found');
            }

            // Update payment status
            const updatedPayment = await this.prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: data.status,
                    metadata: data.metadata || payment.metadata,
                    updatedAt: new Date()
                }
            });

            // Create payment log
            await this.prisma.paymentLog.create({
                data: {
                    paymentId: payment.id,
                    status: data.status,
                    details: data.message || 'Payment status updated via webhook',
                    metadata: data.metadata
                }
            });

            return {
                success: true,
                data: updatedPayment
            };

        } catch (error) {
            logger.error(`Error processing payment webhook: ${error.message}`);
            throw new Error(`Failed to process webhook: ${error.message}`);
        }
    }

    /**
     * Generate payment receipt
     */
    async generateReceipt(id, userId, schoolId) {
        try {
            const payment = await this.getById(id, userId, schoolId);
            
            // In a real implementation, you would generate a PDF or other format
            // Here we just return the payment data in a receipt-like format
            return {
                success: true,
                data: {
                    receiptNumber: payment.data.receiptNumber,
                    date: payment.data.paymentDate,
                    amount: payment.data.amount,
                    discount: payment.data.discount,
                    fine: payment.data.fine,
                    total: payment.data.total,
                    student: payment.data.student,
                    items: payment.data.items,
                    school: payment.data.school
                }
            };

        } catch (error) {
            logger.error(`Error generating payment receipt: ${error.message}`);
            throw new Error(`Failed to generate receipt: ${error.message}`);
        }
    }

    /**
     * Search payments
     */
    async searchPayments(schoolId, searchTerm, filters = {}) {
        try {
            const { page = 1, limit = 10, sortBy = 'paymentDate', sortOrder = 'desc' } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                OR: [
                    { receiptNumber: { contains: searchTerm, mode: 'insensitive' } },
                    { transactionId: { contains: searchTerm, mode: 'insensitive' } },
                    { gatewayTransactionId: { contains: searchTerm, mode: 'insensitive' } },
                    { student: { name: { contains: searchTerm, mode: 'insensitive' } } },
                    { student: { rollNumber: { contains: searchTerm, mode: 'insensitive' } } },
                    { parent: { name: { contains: searchTerm, mode: 'insensitive' } } }
                ]
            };

            const [payments, total] = await Promise.all([
                this.prisma.payment.findMany({
                    where,
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                rollNumber: true
                            }
                        },
                        parent: {
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
                this.prisma.payment.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: payments,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error searching payments: ${error.message}`);
            throw new Error(`Failed to search payments: ${error.message}`);
        }
    }
}

export default Payment;

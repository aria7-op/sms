import Payment from '../models/Payment.js';
import Refund from '../models/Refund.js';
import Installment from '../models/Installment.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { sendNotification } from '../utils/notifications.js';
import { cacheManager } from '../cache/cacheManager.js';

export class IntegratedPaymentController {
    constructor() {
        this.paymentModel = new Payment();
        this.refundModel = new Refund();
        this.installmentModel = new Installment();
    }

    /**
     * Create payment with installments
     */
    async createPaymentWithInstallments(req, res) {
        try {
            const { payment, installments } = req.body;
            const { schoolId, userId } = req.user;

            // Create payment first
            const paymentData = {
                ...payment,
                schoolId: parseInt(schoolId)
            };

            const paymentResult = await this.paymentModel.create(paymentData);

            if (!paymentResult.success) {
                throw new Error('Failed to create payment');
            }

            const createdPayment = paymentResult.data;

            // Create installments if provided
            let createdInstallments = [];
            if (installments && installments.length > 0) {
                const installmentData = installments.map(inst => ({
                    ...inst,
                    paymentId: createdPayment.id,
                    schoolId: parseInt(schoolId)
                }));

                const installmentResult = await this.installmentModel.bulkCreate(
                    installmentData,
                    parseInt(userId),
                    parseInt(schoolId)
                );

                createdInstallments = installmentResult.data;
            }

            // Clear cache
            await cacheManager.clearPattern('payment:*');
            await cacheManager.clearPattern('installment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'CREATE',
                resource: 'PAYMENT_WITH_INSTALLMENTS',
                resourceId: createdPayment.id,
                details: `Created payment with ${createdInstallments.length} installments`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: 'Payment with installments created successfully',
                data: {
                    payment: createdPayment,
                    installments: createdInstallments
                }
            });

        } catch (error) {
            logger.error(`Error creating payment with installments: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get complete payment details with refunds and installments
     */
    async getCompletePaymentDetails(req, res) {
        try {
            const { paymentId } = req.params;
            const { schoolId, userId, role } = req.user;

            // Get payment details
            const paymentResult = await this.paymentModel.getById(
                parseInt(paymentId),
                parseInt(userId),
                parseInt(schoolId),
                role
            );

            if (!paymentResult.success) {
                throw new Error('Payment not found');
            }

            const payment = paymentResult.data;

            // Get refunds for this payment
            const refundsResult = await this.refundModel.getByPayment(
                parseInt(paymentId),
                parseInt(schoolId)
            );

            // Get installments for this payment
            const installmentsResult = await this.installmentModel.getByPayment(
                parseInt(paymentId),
                parseInt(schoolId)
            );

            // Calculate summary
            const totalRefunded = refundsResult.data.reduce((sum, refund) => sum + parseFloat(refund.amount), 0);
            const totalInstallments = installmentsResult.data.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
            const paidInstallments = installmentsResult.data
                .filter(inst => inst.status === 'PAID')
                .reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
            const pendingInstallments = installmentsResult.data
                .filter(inst => inst.status === 'PENDING')
                .reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
            const overdueInstallments = installmentsResult.data
                .filter(inst => inst.status === 'OVERDUE')
                .reduce((sum, inst) => sum + parseFloat(inst.amount), 0);

            const summary = {
                paymentAmount: parseFloat(payment.total),
                totalRefunded,
                netAmount: parseFloat(payment.total) - totalRefunded,
                totalInstallments,
                paidInstallments,
                pendingInstallments,
                overdueInstallments,
                remainingAmount: parseFloat(payment.total) - totalRefunded - paidInstallments
            };

            return res.status(200).json({
                success: true,
                data: {
                    payment,
                    refunds: refundsResult.data,
                    installments: installmentsResult.data,
                    summary
                }
            });

        } catch (error) {
            logger.error(`Error getting complete payment details: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Process refund for payment
     */
    async processRefund(req, res) {
        try {
            const { paymentId } = req.params;
            const refundData = req.body;
            const { schoolId, userId } = req.user;

            // Validate refund amount against payment
            const paymentResult = await this.paymentModel.getById(
                parseInt(paymentId),
                parseInt(userId),
                parseInt(schoolId),
                'ADMIN'
            );

            if (!paymentResult.success) {
                throw new Error('Payment not found');
            }

            const payment = paymentResult.data;

            // Get existing refunds
            const existingRefunds = await this.refundModel.getByPayment(
                parseInt(paymentId),
                parseInt(schoolId)
            );

            const totalRefunded = existingRefunds.data.reduce((sum, refund) => sum + parseFloat(refund.amount), 0);
            const remainingRefundable = parseFloat(payment.total) - totalRefunded;

            if (parseFloat(refundData.amount) > remainingRefundable) {
                throw new Error(`Refund amount cannot exceed remaining refundable amount: $${remainingRefundable}`);
            }

            // Create refund
            const refundResult = await this.refundModel.create({
                ...refundData,
                paymentId: parseInt(paymentId),
                schoolId: parseInt(schoolId)
            });

            // Clear cache
            await cacheManager.clearPattern('payment:*');
            await cacheManager.clearPattern('refund:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'REFUND',
                resource: 'PAYMENT',
                resourceId: parseInt(paymentId),
                details: `Processed refund of $${refundData.amount} for payment ${paymentId}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: 'Refund processed successfully',
                data: refundResult.data
            });

        } catch (error) {
            logger.error(`Error processing refund: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Mark installment as paid and update payment status
     */
    async payInstallment(req, res) {
        try {
            const { installmentId } = req.params;
            const paymentData = req.body;
            const { schoolId, userId } = req.user;

            // Mark installment as paid
            const installmentResult = await this.installmentModel.markAsPaid(
                parseInt(installmentId),
                parseInt(userId),
                parseInt(schoolId),
                paymentData
            );

            // Get payment details to update status
            const installment = installmentResult.data;
            const payment = await this.paymentModel.getById(
                installment.paymentId,
                parseInt(userId),
                parseInt(schoolId),
                'ADMIN'
            );

            // Clear cache
            await cacheManager.clearPattern('payment:*');
            await cacheManager.clearPattern('installment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'PAY_INSTALLMENT',
                resource: 'INSTALLMENT',
                resourceId: parseInt(installmentId),
                details: `Paid installment #${installment.installmentNumber} for payment ${installment.paymentId}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: 'Installment paid successfully',
                data: {
                    installment: installmentResult.data,
                    payment: payment.data
                }
            });

        } catch (error) {
            logger.error(`Error paying installment: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get comprehensive payment analytics
     */
    async getPaymentAnalytics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            // Get payment statistics
            const paymentStats = await this.paymentModel.getStatistics(
                parseInt(schoolId),
                filters
            );

            // Get refund statistics
            const refundStats = await this.refundModel.getStatistics(
                parseInt(schoolId),
                filters
            );

            // Get installment statistics
            const installmentStats = await this.installmentModel.getStatistics(
                parseInt(schoolId),
                filters
            );

            // Calculate comprehensive analytics
            const analytics = {
                payments: paymentStats.data,
                refunds: refundStats.data,
                installments: installmentStats.data,
                summary: {
                    totalRevenue: paymentStats.data.totalAmount,
                    totalRefunded: refundStats.data.totalAmount,
                    netRevenue: paymentStats.data.totalAmount - refundStats.data.totalAmount,
                    totalInstallments: installmentStats.data.totalInstallments,
                    paidInstallments: installmentStats.data.paidInstallments,
                    pendingInstallments: installmentStats.data.pendingInstallments,
                    overdueInstallments: installmentStats.data.overdueInstallments,
                    paymentRate: installmentStats.data.paymentRate,
                    refundRate: (refundStats.data.totalAmount / paymentStats.data.totalAmount) * 100
                }
            };

            return res.status(200).json({
                success: true,
                data: analytics
            });

        } catch (error) {
            logger.error(`Error getting payment analytics: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get payment dashboard with all related data
     */
    async getPaymentDashboard(req, res) {
        try {
            const { schoolId } = req.user;

            // Get payment dashboard
            const paymentDashboard = await this.paymentModel.getDashboardSummary(req, res);
            const paymentData = JSON.parse(paymentDashboard._getData());

            // Get installment dashboard
            const installmentDashboard = await this.installmentModel.getDashboardSummary(req, res);
            const installmentData = JSON.parse(installmentDashboard._getData());

            // Get refund summary
            const refundStats = await this.refundModel.getStatistics(parseInt(schoolId));

            const dashboard = {
                payments: paymentData.data,
                installments: installmentData.data,
                refunds: refundStats.data,
                overview: {
                    totalPayments: paymentData.data.totalPayments,
                    totalAmount: paymentData.data.totalAmount,
                    pendingPayments: paymentData.data.pendingPayments,
                    overduePayments: paymentData.data.overduePayments,
                    totalInstallments: installmentData.data.monthly.totalInstallments,
                    paidInstallments: installmentData.data.monthly.paidInstallments,
                    overdueInstallments: installmentData.data.monthly.overdueInstallments,
                    totalRefunds: refundStats.data.totalRefunds,
                    totalRefunded: refundStats.data.totalAmount
                }
            };

            return res.status(200).json({
                success: true,
                data: dashboard
            });

        } catch (error) {
            logger.error(`Error getting payment dashboard: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Generate comprehensive payment report
     */
    async generatePaymentReport(req, res) {
        try {
            const { schoolId } = req.user;
            const { startDate, endDate, format = 'json' } = req.query;

            // Get all payment data
            const [payments, refunds, installments] = await Promise.all([
                this.paymentModel.getAll({ startDate, endDate }),
                this.refundModel.getAll({ startDate, endDate }),
                this.installmentModel.getAll({ startDate, endDate })
            ]);

            // Calculate summary
            const totalPayments = payments.data.length;
            const totalAmount = payments.data.reduce((sum, payment) => sum + parseFloat(payment.total), 0);
            const totalRefunded = refunds.data.reduce((sum, refund) => sum + parseFloat(refund.amount), 0);
            const totalInstallments = installments.data.length;
            const paidInstallments = installments.data.filter(inst => inst.status === 'PAID').length;

            const report = {
                period: {
                    startDate,
                    endDate
                },
                summary: {
                    totalPayments,
                    totalAmount,
                    totalRefunded,
                    netAmount: totalAmount - totalRefunded,
                    totalInstallments,
                    paidInstallments,
                    paymentRate: totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0
                },
                payments: payments.data,
                refunds: refunds.data,
                installments: installments.data
            };

            if (format === 'csv') {
                // Convert to CSV format
                const csvData = this.convertToCSV(report);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=payment-report-${startDate}-${endDate}.csv`);
                return res.send(csvData);
            }

            return res.status(200).json({
                success: true,
                data: report
            });

        } catch (error) {
            logger.error(`Error generating payment report: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Convert report data to CSV
     */
    convertToCSV(report) {
        const headers = [
            'Payment ID',
            'Student Name',
            'Parent Name',
            'Amount',
            'Status',
            'Method',
            'Date',
            'Installments',
            'Refunds'
        ];

        const rows = report.payments.map(payment => {
            const installments = report.installments.filter(inst => inst.paymentId === payment.id);
            const refunds = report.refunds.filter(ref => ref.paymentId === payment.id);
            
            return [
                payment.id,
                payment.student?.name || '',
                payment.parent?.name || '',
                payment.total,
                payment.status,
                payment.method,
                payment.paymentDate,
                installments.length,
                refunds.length
            ].join(',');
        });

        return [headers.join(','), ...rows].join('\n');
    }

    /**
     * Bulk operations for payments
     */
    async bulkPaymentOperations(req, res) {
        try {
            const { operation, data } = req.body;
            const { schoolId, userId } = req.user;

            let result;

            switch (operation) {
                case 'create_payments':
                    result = await this.paymentModel.bulkCreate(data.payments, parseInt(userId), parseInt(schoolId));
                    break;
                case 'update_status':
                    result = await this.paymentModel.bulkUpdateStatus(data.paymentIds, data.status, parseInt(userId), parseInt(schoolId));
                    break;
                case 'create_installments':
                    result = await this.installmentModel.bulkCreate(data.installments, parseInt(userId), parseInt(schoolId));
                    break;
                case 'process_refunds':
                    result = await this.refundModel.bulkCreate(data.refunds, parseInt(userId), parseInt(schoolId));
                    break;
                default:
                    throw new Error('Invalid operation');
            }

            // Clear cache
            await cacheManager.clearPattern('payment:*');
            await cacheManager.clearPattern('installment:*');
            await cacheManager.clearPattern('refund:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: `BULK_${operation.toUpperCase()}`,
                resource: 'PAYMENT_SYSTEM',
                resourceId: null,
                details: `Bulk operation: ${operation}`,
                ipAddress: req.ip
            });

            return res.status(200).json({
                success: true,
                message: `Bulk operation ${operation} completed successfully`,
                data: result
            });

        } catch (error) {
            logger.error(`Error in bulk payment operations: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

export default IntegratedPaymentController;
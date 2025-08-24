import Payment from '../models/Payment.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { sendNotification } from '../utils/notifications.js';
import { cacheManager } from '../cache/cacheManager.js';

export class IntegratedPaymentController {
    constructor() {
        this.paymentModel = new Payment();
    }

    /**
     * Create payment
     */
    async createPayment(req, res) {
        try {
            const { payment } = req.body;
            const { schoolId, userId } = req.user;

            // Create payment
            const paymentData = {
                ...payment,
                schoolId: parseInt(schoolId)
            };

            const paymentResult = await this.paymentModel.create(paymentData);

            if (!paymentResult.success) {
                throw new Error('Failed to create payment');
            }

            const createdPayment = paymentResult.data;

            // Clear cache
            await cacheManager.clearPattern('payment:*');

            // Create audit log
            await createAuditLog({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action: 'CREATE',
                resource: 'PAYMENT',
                resourceId: createdPayment.id,
                details: `Created payment with amount ${createdPayment.amount}`,
                ipAddress: req.ip
            });

            return res.status(201).json({
                success: true,
                message: 'Payment created successfully',
                data: {
                    payment: createdPayment
                }
            });

        } catch (error) {
            logger.error(`Error creating payment: ${error.message}`);
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

            // Get payment statistics only
            const paymentStats = await this.paymentModel.getStatistics(
                parseInt(schoolId),
                filters
            );

            // Return simplified analytics with just payment data
            const analytics = {
                payments: paymentStats.data,
                summary: {
                    totalRevenue: paymentStats.data.totalAmount,
                    totalPayments: paymentStats.data.totalPayments,
                    averageAmount: paymentStats.data.averageAmount,
                    paymentsByStatus: paymentStats.data.paymentsByStatus,
                    paymentsByMethod: paymentStats.data.paymentsByMethod,
                    recentPayments: paymentStats.data.recentPayments
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
     * Get payment dashboard with payment data only
     */
    async getPaymentDashboard(req, res) {
        try {
            const { schoolId } = req.user;

            // Get payment statistics only
            const paymentStats = await this.paymentModel.getStatistics(parseInt(schoolId));

            const dashboard = {
                payments: paymentStats.data,
                overview: {
                    totalPayments: paymentStats.data.totalPayments,
                    totalAmount: paymentStats.data.totalAmount,
                    averageAmount: paymentStats.data.averageAmount,
                    paymentsByStatus: paymentStats.data.paymentsByStatus,
                    paymentsByMethod: paymentStats.data.paymentsByMethod,
                    recentPayments: paymentStats.data.recentPayments
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

            // Get payment data only
            const payments = await this.paymentModel.getAll({ startDate, endDate });

            // Calculate summary
            const totalPayments = payments.data.length;
            const totalAmount = payments.data.reduce((sum, payment) => sum + parseFloat(payment.total), 0);

            const report = {
                period: {
                    startDate,
                    endDate
                },
                summary: {
                    totalPayments,
                    totalAmount,
                    averageAmount: totalPayments > 0 ? totalAmount / totalPayments : 0
                },
                payments: payments.data
            };

            if (format === 'csv') {
                // Convert to CSV format
                const csvData = this.convertToCSV(payments.data);
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
    convertToCSV(payments) {
        const headers = [
            'Payment ID',
            'Student Name',
            'Parent Name',
            'Amount',
            'Status',
            'Method',
            'Date'
        ];

        const rows = payments.map(payment => {
            return [
                payment.id,
                payment.student?.user?.firstName + ' ' + payment.student?.user?.lastName || '',
                payment.parent?.user?.firstName + ' ' + payment.parent?.user?.lastName || '',
                payment.total,
                payment.status,
                payment.method,
                payment.paymentDate
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
                default:
                    throw new Error('Invalid operation');
            }

            // Clear cache
            await cacheManager.clearPattern('payment:*');

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

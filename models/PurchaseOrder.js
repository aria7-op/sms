import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

class PurchaseOrder {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create a new purchase order
     */
    async create(data) {
        try {
            // Calculate totals if not provided
            const subtotal = data.subtotal || (data.items?.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) || 0);
            const totalAmount = data.totalAmount || (subtotal + (data.taxAmount || 0) - (data.discountAmount || 0));

            const poNumber = data.poNumber || await this.generatePONumber(data.schoolId);

            const purchaseOrder = await this.prisma.purchaseOrder.create({
                data: {
                    uuid: data.uuid,
                    poNumber,
                    supplierId: BigInt(data.supplierId),
                    orderDate: data.orderDate || new Date(),
                    expectedDeliveryDate: data.expectedDeliveryDate,
                    status: data.status || 'DRAFT',
                    subtotal,
                    taxAmount: data.taxAmount || 0,
                    discountAmount: data.discountAmount || 0,
                    totalAmount,
                    currency: data.currency || 'USD',
                    paymentTerms: data.paymentTerms,
                    deliveryAddress: data.deliveryAddress,
                    notes: data.notes,
                    schoolId: BigInt(data.schoolId),
                    createdBy: BigInt(data.createdBy),
                    items: data.items ? {
                        createMany: {
                            data: data.items.map(item => ({
                                productId: item.productId ? BigInt(item.productId) : null,
                                productName: item.productName,
                                description: item.description,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                totalPrice: item.quantity * item.unitPrice,
                                taxRate: item.taxRate || 0,
                                schoolId: BigInt(data.schoolId)
                            }))
                        }
                    } : undefined
                },
                include: {
                    supplier: true,
                    items: true,
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    creator: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'CREATE',
                entity: 'PURCHASE_ORDER',
                entityId: purchaseOrder.id.toString(),
                details: `Purchase order ${poNumber} created`,
                userId: data.createdBy,
                schoolId: data.schoolId
            });

            return {
                success: true,
                data: purchaseOrder
            };

        } catch (error) {
            logger.error(`Error creating purchase order: ${error.message}`);
            throw new Error(`Failed to create purchase order: ${error.message}`);
        }
    }

    /**
     * Get purchase order by ID
     */
    async getById(id, userId, schoolId, userRole) {
        try {
            const purchaseOrder = await this.prisma.purchaseOrder.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    supplier: true,
                    items: true,
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    creator: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    approver: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    updater: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            if (!purchaseOrder) {
                throw new Error('Purchase order not found');
            }

            // Add permission checks based on user role if needed

            return {
                success: true,
                data: purchaseOrder
            };

        } catch (error) {
            logger.error(`Error getting purchase order: ${error.message}`);
            throw new Error(`Failed to get purchase order: ${error.message}`);
        }
    }

    /**
     * Get all purchase orders with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                supplierId,
                status,
                minAmount,
                maxAmount,
                startDate,
                endDate,
                search,
                sortBy = 'orderDate',
                sortOrder = 'desc',
                schoolId
            } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(supplierId && { supplierId: BigInt(supplierId) }),
                ...(status && { status }),
                ...(minAmount && { totalAmount: { gte: parseFloat(minAmount) } }),
                ...(maxAmount && { totalAmount: { lte: parseFloat(maxAmount) } }),
                ...(startDate && endDate && {
                    orderDate: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }),
                ...(search && {
                    OR: [
                        { poNumber: { contains: search, mode: 'insensitive' } },
                        { supplier: { name: { contains: search, mode: 'insensitive' } } },
                        { notes: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const [purchaseOrders, total] = await Promise.all([
                this.prisma.purchaseOrder.findMany({
                    where,
                    include: {
                        supplier: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        creator: {
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
                this.prisma.purchaseOrder.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: purchaseOrders,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all purchase orders: ${error.message}`);
            throw new Error(`Failed to get purchase orders: ${error.message}`);
        }
    }

    /**
     * Update purchase order
     */
    async update(id, updateData, userId, schoolId) {
        try {
            // Check if purchase order exists and user has access
            const existingPO = await this.prisma.purchaseOrder.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingPO) {
                throw new Error('Purchase order not found');
            }

            // Only allow updating certain fields based on status
            let allowedFields = ['notes', 'metadata'];
            
            if (existingPO.status === 'DRAFT') {
                allowedFields = [
                    ...allowedFields,
                    'supplierId',
                    'orderDate',
                    'expectedDeliveryDate',
                    'paymentTerms',
                    'deliveryAddress',
                    'items'
                ];
            } else if (existingPO.status === 'PENDING') {
                allowedFields = [...allowedFields, 'notes'];
            }

            const updatePayload = {};
            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    updatePayload[field] = updateData[field];
                }
            }

            // Handle items update if needed
            if (updateData.items && allowedFields.includes('items')) {
                // First delete existing items
                await this.prisma.purchaseOrderItem.deleteMany({
                    where: { purchaseOrderId: BigInt(id) }
                });

                // Then create new items
                updatePayload.items = {
                    createMany: {
                        data: updateData.items.map(item => ({
                            productId: item.productId ? BigInt(item.productId) : null,
                            productName: item.productName,
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalPrice: item.quantity * item.unitPrice,
                            taxRate: item.taxRate || 0,
                            schoolId: BigInt(schoolId)
                        }))
                    }
                };

                // Recalculate totals
                const subtotal = updateData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                updatePayload.subtotal = subtotal;
                updatePayload.totalAmount = subtotal + (existingPO.taxAmount || 0) - (existingPO.discountAmount || 0);
            }

            const updatedPO = await this.prisma.purchaseOrder.update({
                where: { id: BigInt(id) },
                data: {
                    ...updatePayload,
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                },
                include: {
                    supplier: true,
                    items: true
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entity: 'PURCHASE_ORDER',
                entityId: updatedPO.id.toString(),
                details: `Purchase order ${updatedPO.poNumber} updated`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedPO
            };

        } catch (error) {
            logger.error(`Error updating purchase order: ${error.message}`);
            throw new Error(`Failed to update purchase order: ${error.message}`);
        }
    }

    /**
     * Delete purchase order (soft delete)
     */
    async delete(id, userId, schoolId) {
        try {
            // Check if purchase order exists and user has access
            const existingPO = await this.prisma.purchaseOrder.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingPO) {
                throw new Error('Purchase order not found');
            }

            // Only allow deletion of DRAFT or PENDING orders
            if (!['DRAFT', 'PENDING'].includes(existingPO.status)) {
                throw new Error('Only DRAFT or PENDING purchase orders can be deleted');
            }

            await this.prisma.purchaseOrder.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: BigInt(userId)
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'DELETE',
                entity: 'PURCHASE_ORDER',
                entityId: id.toString(),
                details: `Purchase order ${existingPO.poNumber} deleted`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                message: 'Purchase order deleted successfully'
            };

        } catch (error) {
            logger.error(`Error deleting purchase order: ${error.message}`);
            throw new Error(`Failed to delete purchase order: ${error.message}`);
        }
    }

    /**
     * Approve purchase order
     */
    async approve(id, approvedBy, schoolId) {
        try {
            const po = await this.prisma.purchaseOrder.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!po) {
                throw new Error('Purchase order not found');
            }

            if (po.status !== 'PENDING') {
                throw new Error('Only PENDING purchase orders can be approved');
            }

            const updatedPO = await this.prisma.purchaseOrder.update({
                where: { id: BigInt(id) },
                data: {
                    status: 'APPROVED',
                    approvedBy: BigInt(approvedBy),
                    approvedAt: new Date(),
                    updatedBy: BigInt(approvedBy),
                    updatedAt: new Date()
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'APPROVE',
                entity: 'PURCHASE_ORDER',
                entityId: updatedPO.id.toString(),
                details: `Purchase order ${updatedPO.poNumber} approved`,
                userId: approvedBy,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedPO
            };

        } catch (error) {
            logger.error(`Error approving purchase order: ${error.message}`);
            throw new Error(`Failed to approve purchase order: ${error.message}`);
        }
    }

    /**
     * Mark purchase order as ordered
     */
    async markAsOrdered(id, userId, schoolId) {
        try {
            const po = await this.prisma.purchaseOrder.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!po) {
                throw new Error('Purchase order not found');
            }

            if (po.status !== 'APPROVED') {
                throw new Error('Only APPROVED purchase orders can be marked as ORDERED');
            }

            const updatedPO = await this.prisma.purchaseOrder.update({
                where: { id: BigInt(id) },
                data: {
                    status: 'ORDERED',
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'ORDER',
                entity: 'PURCHASE_ORDER',
                entityId: updatedPO.id.toString(),
                details: `Purchase order ${updatedPO.poNumber} marked as ordered`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedPO
            };

        } catch (error) {
            logger.error(`Error marking purchase order as ordered: ${error.message}`);
            throw new Error(`Failed to mark purchase order as ordered: ${error.message}`);
        }
    }

    /**
     * Mark purchase order as received
     */
    async markAsReceived(id, userId, schoolId) {
        try {
            const po = await this.prisma.purchaseOrder.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!po) {
                throw new Error('Purchase order not found');
            }

            if (po.status !== 'ORDERED') {
                throw new Error('Only ORDERED purchase orders can be marked as RECEIVED');
            }

            const updatedPO = await this.prisma.purchaseOrder.update({
                where: { id: BigInt(id) },
                data: {
                    status: 'RECEIVED',
                    deliveryDate: new Date(),
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'RECEIVE',
                entity: 'PURCHASE_ORDER',
                entityId: updatedPO.id.toString(),
                details: `Purchase order ${updatedPO.poNumber} marked as received`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedPO
            };

        } catch (error) {
            logger.error(`Error marking purchase order as received: ${error.message}`);
            throw new Error(`Failed to mark purchase order as received: ${error.message}`);
        }
    }

    /**
     * Cancel purchase order
     */
    async cancel(id, userId, schoolId) {
        try {
            const po = await this.prisma.purchaseOrder.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!po) {
                throw new Error('Purchase order not found');
            }

            if (!['DRAFT', 'PENDING', 'APPROVED', 'ORDERED'].includes(po.status)) {
                throw new Error('Purchase order cannot be cancelled in its current status');
            }

            const updatedPO = await this.prisma.purchaseOrder.update({
                where: { id: BigInt(id) },
                data: {
                    status: 'CANCELLED',
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'CANCEL',
                entity: 'PURCHASE_ORDER',
                entityId: updatedPO.id.toString(),
                details: `Purchase order ${updatedPO.poNumber} cancelled`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedPO
            };

        } catch (error) {
            logger.error(`Error cancelling purchase order: ${error.message}`);
            throw new Error(`Failed to cancel purchase order: ${error.message}`);
        }
    }

    /**
     * Get purchase order statistics
     */
    async getStatistics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, status, supplierId } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    orderDate: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                }),
                ...(status && { status }),
                ...(supplierId && { supplierId: BigInt(supplierId) })
            };

            const [
                totalOrders,
                totalAmount,
                ordersByStatus,
                ordersBySupplier,
                recentOrders,
                overdueOrders
            ] = await Promise.all([
                this.prisma.purchaseOrder.count({ where }),
                this.prisma.purchaseOrder.aggregate({
                    where,
                    _sum: { totalAmount: true }
                }),
                this.prisma.purchaseOrder.groupBy({
                    by: ['status'],
                    where,
                    _count: { id: true },
                    _sum: { totalAmount: true }
                }),
                this.prisma.purchaseOrder.groupBy({
                    by: ['supplierId'],
                    where,
                    _count: { id: true },
                    _sum: { totalAmount: true },
                    include: {
                        supplier: {
                            select: {
                                name: true
                            }
                        }
                    }
                }),
                this.prisma.purchaseOrder.findMany({
                    where,
                    include: {
                        supplier: {
                            select: {
                                name: true
                            }
                        }
                    },
                    orderBy: { orderDate: 'desc' },
                    take: 10
                }),
                this.prisma.purchaseOrder.findMany({
                    where: {
                        ...where,
                        expectedDeliveryDate: {
                            lt: new Date()
                        },
                        status: {
                            in: ['APPROVED', 'ORDERED']
                        }
                    },
                    include: {
                        supplier: {
                            select: {
                                name: true
                            }
                        }
                    }
                })
            ]);

            return {
                success: true,
                data: {
                    totalOrders,
                    totalAmount: totalAmount._sum.totalAmount || 0,
                    averageAmount: totalOrders > 0 ? (totalAmount._sum.totalAmount || 0) / totalOrders : 0,
                    ordersByStatus,
                    ordersBySupplier,
                    recentOrders,
                    overdueOrders: overdueOrders.length
                }
            };

        } catch (error) {
            logger.error(`Error getting purchase order statistics: ${error.message}`);
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    /**
     * Generate PO number
     */
    async generatePONumber(schoolId) {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `PO-${schoolId}-${timestamp}-${random}`;
    }

    /**
     * Find overdue purchase orders
     */
    async findOverdue(schoolId) {
        try {
            const overdueOrders = await this.prisma.purchaseOrder.findMany({
                where: {
                    schoolId: BigInt(schoolId),
                    expectedDeliveryDate: {
                        lt: new Date()
                    },
                    status: {
                        in: ['PENDING', 'APPROVED', 'ORDERED']
                    },
                    deletedAt: null
                },
                include: {
                    supplier: {
                        select: {
                            name: true,
                            contactEmail: true
                        }
                    }
                }
            });

            return {
                success: true,
                data: overdueOrders
            };

        } catch (error) {
            logger.error(`Error finding overdue purchase orders: ${error.message}`);
            throw new Error(`Failed to find overdue purchase orders: ${error.message}`);
        }
    }
}

export default PurchaseOrder;
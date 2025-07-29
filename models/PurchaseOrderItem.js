import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

class PurchaseOrderItem {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create a new purchase order item
     */
    async create(data) {
        try {
            // Calculate total price
            const totalPrice = data.quantity * data.unitPrice;

            const item = await this.prisma.purchaseOrderItem.create({
                data: {
                    uuid: data.uuid,
                    purchaseOrderId: BigInt(data.purchaseOrderId),
                    productId: data.productId ? BigInt(data.productId) : null,
                    productName: data.productName,
                    description: data.description,
                    quantity: data.quantity,
                    unitPrice: data.unitPrice,
                    totalPrice,
                    receivedQuantity: data.receivedQuantity || 0,
                    remarks: data.remarks,
                    schoolId: BigInt(data.schoolId)
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'CREATE',
                entity: 'PURCHASE_ORDER_ITEM',
                entityId: item.id.toString(),
                details: `Item added to PO ${data.purchaseOrderId}`,
                userId: data.createdBy,
                schoolId: data.schoolId
            });

            return {
                success: true,
                data: item
            };

        } catch (error) {
            logger.error(`Error creating purchase order item: ${error.message}`);
            throw new Error(`Failed to create purchase order item: ${error.message}`);
        }
    }

    /**
     * Get purchase order item by ID
     */
    async getById(id, schoolId) {
        try {
            const item = await this.prisma.purchaseOrderItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId)
                }
            });

            if (!item) {
                throw new Error('Purchase order item not found');
            }

            return {
                success: true,
                data: item
            };

        } catch (error) {
            logger.error(`Error getting purchase order item: ${error.message}`);
            throw new Error(`Failed to get purchase order item: ${error.message}`);
        }
    }

    /**
     * Get all items for a purchase order
     */
    async getByPurchaseOrder(purchaseOrderId, schoolId) {
        try {
            const items = await this.prisma.purchaseOrderItem.findMany({
                where: {
                    purchaseOrderId: BigInt(purchaseOrderId),
                    schoolId: BigInt(schoolId)
                },
                include: {
                    product: true
                }
            });

            return {
                success: true,
                data: items
            };

        } catch (error) {
            logger.error(`Error getting purchase order items: ${error.message}`);
            throw new Error(`Failed to get purchase order items: ${error.message}`);
        }
    }

    /**
     * Update purchase order item
     */
    async update(id, updateData, userId, schoolId) {
        try {
            const existingItem = await this.prisma.purchaseOrderItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId)
                }
            });

            if (!existingItem) {
                throw new Error('Purchase order item not found');
            }

            // Recalculate total if quantity or unit price changes
            if (updateData.quantity || updateData.unitPrice) {
                const quantity = updateData.quantity || existingItem.quantity;
                const unitPrice = updateData.unitPrice || existingItem.unitPrice;
                updateData.totalPrice = quantity * unitPrice;
            }

            const updatedItem = await this.prisma.purchaseOrderItem.update({
                where: { id: BigInt(id) },
                data: updateData
            });

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entity: 'PURCHASE_ORDER_ITEM',
                entityId: updatedItem.id.toString(),
                details: `Item ${id} updated in PO ${updatedItem.purchaseOrderId}`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedItem
            };

        } catch (error) {
            logger.error(`Error updating purchase order item: ${error.message}`);
            throw new Error(`Failed to update purchase order item: ${error.message}`);
        }
    }

    /**
     * Delete purchase order item
     */
    async delete(id, userId, schoolId) {
        try {
            const existingItem = await this.prisma.purchaseOrderItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId)
                }
            });

            if (!existingItem) {
                throw new Error('Purchase order item not found');
            }

            await this.prisma.purchaseOrderItem.delete({
                where: { id: BigInt(id) }
            });

            // Create audit log
            await createAuditLog({
                action: 'DELETE',
                entity: 'PURCHASE_ORDER_ITEM',
                entityId: id.toString(),
                details: `Item removed from PO ${existingItem.purchaseOrderId}`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                message: 'Purchase order item deleted successfully'
            };

        } catch (error) {
            logger.error(`Error deleting purchase order item: ${error.message}`);
            throw new Error(`Failed to delete purchase order item: ${error.message}`);
        }
    }

    /**
     * Receive quantity for an item
     */
    async receiveQuantity(id, quantity, userId, schoolId) {
        try {
            const item = await this.prisma.purchaseOrderItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId)
                }
            });

            if (!item) {
                throw new Error('Purchase order item not found');
            }

            const newReceivedQuantity = item.receivedQuantity + quantity;
            if (newReceivedQuantity > item.quantity) {
                throw new Error('Received quantity cannot exceed ordered quantity');
            }

            const updatedItem = await this.prisma.purchaseOrderItem.update({
                where: { id: BigInt(id) },
                data: {
                    receivedQuantity: newReceivedQuantity,
                    updatedAt: new Date()
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'RECEIVE',
                entity: 'PURCHASE_ORDER_ITEM',
                entityId: updatedItem.id.toString(),
                details: `Received ${quantity} of item ${id} in PO ${item.purchaseOrderId}`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedItem
            };

        } catch (error) {
            logger.error(`Error receiving quantity for item: ${error.message}`);
            throw new Error(`Failed to receive quantity: ${error.message}`);
        }
    }

    /**
     * Get remaining quantity to be received
     */
    async getRemainingQuantity(id, schoolId) {
        try {
            const item = await this.prisma.purchaseOrderItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId)
                }
            });

            if (!item) {
                throw new Error('Purchase order item not found');
            }

            return {
                success: true,
                data: item.quantity - item.receivedQuantity
            };

        } catch (error) {
            logger.error(`Error getting remaining quantity: ${error.message}`);
            throw new Error(`Failed to get remaining quantity: ${error.message}`);
        }
    }

    /**
     * Check if item is fully received
     */
    async isFullyReceived(id, schoolId) {
        try {
            const item = await this.prisma.purchaseOrderItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId)
                }
            });

            if (!item) {
                throw new Error('Purchase order item not found');
            }

            return {
                success: true,
                data: item.receivedQuantity >= item.quantity
            };

        } catch (error) {
            logger.error(`Error checking if item is fully received: ${error.message}`);
            throw new Error(`Failed to check receipt status: ${error.message}`);
        }
    }

    /**
     * Find items pending receipt
     */
    async findPendingReceipt(schoolId) {
        try {
            const items = await this.prisma.purchaseOrderItem.findMany({
                where: {
                    schoolId: BigInt(schoolId),
                    receivedQuantity: {
                        lt: this.prisma.raw('quantity')
                    }
                },
                include: {
                    purchaseOrder: true,
                    product: true
                }
            });

            return {
                success: true,
                data: items
            };

        } catch (error) {
            logger.error(`Error finding items pending receipt: ${error.message}`);
            throw new Error(`Failed to find pending items: ${error.message}`);
        }
    }

    /**
     * Get receipt summary for a purchase order
     */
    async getReceiptSummary(purchaseOrderId, schoolId) {
        try {
            const summary = await this.prisma.$queryRaw`
                SELECT 
                    productId,
                    SUM(quantity) as totalOrdered,
                    SUM(receivedQuantity) as totalReceived,
                    SUM(totalPrice) as totalValue
                FROM purchase_order_items
                WHERE purchaseOrderId = ${BigInt(purchaseOrderId)}
                AND schoolId = ${BigInt(schoolId)}
                GROUP BY productId
            `;

            const formattedSummary = summary.map(item => ({
                productId: item.productId,
                totalOrdered: Number(item.totalOrdered),
                totalReceived: Number(item.totalReceived),
                remaining: Number(item.totalOrdered) - Number(item.totalReceived),
                totalValue: parseFloat(item.totalValue)
            }));

            return {
                success: true,
                data: formattedSummary
            };

        } catch (error) {
            logger.error(`Error getting receipt summary: ${error.message}`);
            throw new Error(`Failed to get receipt summary: ${error.message}`);
        }
    }
}

export default PurchaseOrderItem;
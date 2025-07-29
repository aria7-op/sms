import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

class InventoryItem {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create a new inventory item
     */
    async create(data) {
        try {
            // Calculate available quantity
            const availableQuantity = data.quantity - (data.reservedQuantity || 0);

            const item = await this.prisma.inventoryItem.create({
                data: {
                    name: data.name,
                    description: data.description,
                    sku: data.sku,
                    barcode: data.barcode,
                    categoryId: data.categoryId ? BigInt(data.categoryId) : null,
                    quantity: data.quantity || 0,
                    minQuantity: data.minQuantity || 0,
                    maxQuantity: data.maxQuantity,
                    reservedQuantity: data.reservedQuantity || 0,
                    unit: data.unit || 'PIECE',
                    price: data.price,
                    costPrice: data.costPrice,
                    sellingPrice: data.sellingPrice,
                    supplierId: data.supplierId ? BigInt(data.supplierId) : null,
                    location: data.location,
                    shelfNumber: data.shelfNumber,
                    expiryDate: data.expiryDate,
                    warrantyExpiry: data.warrantyExpiry,
                    status: data.status || 'AVAILABLE',
                    condition: data.condition,
                    brand: data.brand,
                    model: data.model,
                    serialNumber: data.serialNumber,
                    specifications: data.specifications,
                    images: data.images || [],
                    documents: data.documents || [],
                    tags: data.tags || [],
                    isActive: data.isActive !== false,
                    isTrackable: data.isTrackable || false,
                    isExpirable: data.isExpirable || false,
                    isMaintainable: data.isMaintainable || false,
                    lastAuditDate: data.lastAuditDate,
                    nextAuditDate: data.nextAuditDate,
                    lastMaintenanceDate: data.lastMaintenanceDate,
                    nextMaintenanceDate: data.nextMaintenanceDate,
                    metadata: data.metadata,
                    schoolId: BigInt(data.schoolId),
                    createdBy: BigInt(data.createdBy),
                    availableQuantity: availableQuantity
                },
                include: {
                    category: true,
                    supplier: true,
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    createdByUser: {
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
                entity: 'INVENTORY_ITEM',
                entityId: item.id.toString(),
                details: `Item ${item.name} created with quantity ${item.quantity}`,
                userId: data.createdBy,
                schoolId: data.schoolId
            });

            // Create initial inventory log
            await this.prisma.inventoryLog.create({
                data: {
                    itemId: item.id,
                    type: 'INITIAL',
                    quantity: item.quantity,
                    previousQuantity: 0,
                    newQuantity: item.quantity,
                    reference: 'Initial stock',
                    userId: BigInt(data.createdBy),
                    schoolId: BigInt(data.schoolId)
                }
            });

            return {
                success: true,
                data: item
            };

        } catch (error) {
            logger.error(`Error creating inventory item: ${error.message}`);
            throw new Error(`Failed to create inventory item: ${error.message}`);
        }
    }

    /**
     * Get item by ID
     */
    async getById(id, schoolId) {
        try {
            const item = await this.prisma.inventoryItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    category: true,
                    supplier: true,
                    school: {
                        select: {
                            id: true,
                            name: true
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
                    },
                    inventoryLogs: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 10
                    },
                    maintenanceLogs: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 5
                    },
                    alerts: {
                        where: {
                            resolved: false
                        },
                        orderBy: {
                            createdAt: 'desc'
                        }
                    }
                }
            });

            if (!item) {
                throw new Error('Inventory item not found');
            }

            // Calculate available quantity if not already calculated
            const availableQuantity = item.quantity - item.reservedQuantity;

            return {
                success: true,
                data: {
                    ...item,
                    availableQuantity
                }
            };

        } catch (error) {
            logger.error(`Error getting inventory item: ${error.message}`);
            throw new Error(`Failed to get inventory item: ${error.message}`);
        }
    }

    /**
     * Get all items with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                categoryId,
                supplierId,
                status,
                minQuantity,
                maxQuantity,
                isActive,
                isTrackable,
                isExpirable,
                isMaintainable,
                sortBy = 'name',
                sortOrder = 'asc',
                schoolId
            } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(categoryId && { categoryId: BigInt(categoryId) }),
                ...(supplierId && { supplierId: BigInt(supplierId) }),
                ...(status && { status }),
                ...(isActive !== undefined && { isActive: isActive === 'true' }),
                ...(isTrackable !== undefined && { isTrackable: isTrackable === 'true' }),
                ...(isExpirable !== undefined && { isExpirable: isExpirable === 'true' }),
                ...(isMaintainable !== undefined && { isMaintainable: isMaintainable === 'true' }),
                ...(minQuantity && { quantity: { gte: parseInt(minQuantity) } }),
                ...(maxQuantity && { quantity: { lte: parseInt(maxQuantity) } }),
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { sku: { contains: search, mode: 'insensitive' } },
                        { barcode: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } },
                        { brand: { contains: search, mode: 'insensitive' } },
                        { model: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const [items, total] = await Promise.all([
                this.prisma.inventoryItem.findMany({
                    where,
                    include: {
                        category: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        supplier: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        _count: {
                            select: {
                                inventoryLogs: true,
                                maintenanceLogs: true,
                                alerts: {
                                    where: {
                                        resolved: false
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
                this.prisma.inventoryItem.count({ where })
            ]);

            // Calculate available quantity for each item
            const itemsWithAvailableQuantity = items.map(item => ({
                ...item,
                availableQuantity: item.quantity - item.reservedQuantity
            }));

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: itemsWithAvailableQuantity,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all inventory items: ${error.message}`);
            throw new Error(`Failed to get inventory items: ${error.message}`);
        }
    }

    /**
     * Update inventory item
     */
    async update(id, updateData, userId, schoolId) {
        try {
            const existingItem = await this.prisma.inventoryItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingItem) {
                throw new Error('Inventory item not found');
            }

            // Calculate available quantity if quantity or reservedQuantity is being updated
            let availableQuantity;
            if (updateData.quantity !== undefined || updateData.reservedQuantity !== undefined) {
                const newQuantity = updateData.quantity !== undefined ? updateData.quantity : existingItem.quantity;
                const newReserved = updateData.reservedQuantity !== undefined ? updateData.reservedQuantity : existingItem.reservedQuantity;
                availableQuantity = newQuantity - newReserved;
            }

            const updatedItem = await this.prisma.inventoryItem.update({
                where: { id: BigInt(id) },
                data: {
                    ...updateData,
                    ...(updateData.categoryId && { categoryId: BigInt(updateData.categoryId) }),
                    ...(updateData.supplierId && { supplierId: BigInt(updateData.supplierId) }),
                    ...(updateData.quantity !== undefined && { quantity: parseInt(updateData.quantity) }),
                    ...(updateData.minQuantity !== undefined && { minQuantity: parseInt(updateData.minQuantity) }),
                    ...(updateData.maxQuantity !== undefined && { maxQuantity: parseInt(updateData.maxQuantity) }),
                    ...(updateData.reservedQuantity !== undefined && { reservedQuantity: parseInt(updateData.reservedQuantity) }),
                    ...(updateData.price !== undefined && { price: parseFloat(updateData.price) }),
                    ...(updateData.costPrice !== undefined && { costPrice: parseFloat(updateData.costPrice) }),
                    ...(updateData.sellingPrice !== undefined && { sellingPrice: parseFloat(updateData.sellingPrice) }),
                    ...(availableQuantity !== undefined && { availableQuantity }),
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                },
                include: {
                    category: true,
                    supplier: true
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entity: 'INVENTORY_ITEM',
                entityId: updatedItem.id.toString(),
                details: `Item ${updatedItem.name} updated`,
                userId: userId,
                schoolId: schoolId
            });

            // Create inventory log if quantity changed
            if (updateData.quantity !== undefined) {
                await this.prisma.inventoryLog.create({
                    data: {
                        itemId: updatedItem.id,
                        type: 'ADJUSTMENT',
                        quantity: updatedItem.quantity - existingItem.quantity,
                        previousQuantity: existingItem.quantity,
                        newQuantity: updatedItem.quantity,
                        reference: 'Manual adjustment',
                        userId: BigInt(userId),
                        schoolId: BigInt(schoolId)
                    }
                });
            }

            return {
                success: true,
                data: updatedItem
            };

        } catch (error) {
            logger.error(`Error updating inventory item: ${error.message}`);
            throw new Error(`Failed to update inventory item: ${error.message}`);
        }
    }

    /**
     * Delete inventory item (soft delete)
     */
    async delete(id, userId, schoolId) {
        try {
            const existingItem = await this.prisma.inventoryItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingItem) {
                throw new Error('Inventory item not found');
            }

            // Check if item has associated records
            const [logsCount, maintenanceCount, alertsCount] = await Promise.all([
                this.prisma.inventoryLog.count({
                    where: {
                        itemId: BigInt(id)
                    }
                }),
                this.prisma.inventoryMaintenanceLog.count({
                    where: {
                        itemId: BigInt(id)
                    }
                }),
                this.prisma.inventoryAlert.count({
                    where: {
                        itemId: BigInt(id),
                        resolved: false
                    }
                })
            ]);

            if (logsCount > 0 || maintenanceCount > 0 || alertsCount > 0) {
                throw new Error('Cannot delete item with associated logs, maintenance records, or unresolved alerts');
            }

            await this.prisma.inventoryItem.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: BigInt(userId)
                }
            });

            await createAuditLog({
                action: 'DELETE',
                entity: 'INVENTORY_ITEM',
                entityId: id.toString(),
                details: `Item ${existingItem.name} deleted`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                message: 'Inventory item deleted successfully'
            };

        } catch (error) {
            logger.error(`Error deleting inventory item: ${error.message}`);
            throw new Error(`Failed to delete inventory item: ${error.message}`);
        }
    }

    /**
     * Get item statistics
     */
    async getStatistics(schoolId) {
        try {
            const [
                totalItems,
                itemsByStatus,
                lowStockItems,
                expiredItems,
                itemsByCategory,
                recentItems
            ] = await Promise.all([
                this.prisma.inventoryItem.count({
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null
                    }
                }),
                this.prisma.inventoryItem.groupBy({
                    by: ['status'],
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null
                    },
                    _count: { id: true }
                }),
                this.prisma.inventoryItem.count({
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null,
                        quantity: {
                            lt: this.prisma.inventoryItem.fields.minQuantity
                        }
                    }
                }),
                this.prisma.inventoryItem.count({
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null,
                        expiryDate: {
                            lt: new Date()
                        }
                    }
                }),
                this.prisma.inventoryItem.groupBy({
                    by: ['categoryId'],
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null,
                        categoryId: {
                            not: null
                        }
                    },
                    _count: { id: true },
                    _sum: { quantity: true }
                }),
                this.prisma.inventoryItem.findMany({
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 5,
                    include: {
                        category: {
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
                    totalItems,
                    itemsByStatus,
                    lowStockItems,
                    expiredItems,
                    itemsByCategory,
                    recentItems
                }
            };

        } catch (error) {
            logger.error(`Error getting inventory statistics: ${error.message}`);
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    /**
     * Adjust item quantity
     */
    async adjustQuantity(id, adjustment, userId, schoolId, reference = 'Manual adjustment') {
        try {
            const item = await this.prisma.inventoryItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!item) {
                throw new Error('Inventory item not found');
            }

            const newQuantity = item.quantity + adjustment;
            if (newQuantity < 0) {
                throw new Error('Cannot adjust quantity below zero');
            }

            const updatedItem = await this.prisma.inventoryItem.update({
                where: { id: BigInt(id) },
                data: {
                    quantity: newQuantity,
                    availableQuantity: newQuantity - item.reservedQuantity,
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                }
            });

            // Create inventory log
            await this.prisma.inventoryLog.create({
                data: {
                    itemId: item.id,
                    type: adjustment > 0 ? 'INCREMENT' : 'DECREMENT',
                    quantity: adjustment,
                    previousQuantity: item.quantity,
                    newQuantity: updatedItem.quantity,
                    reference,
                    userId: BigInt(userId),
                    schoolId: BigInt(schoolId)
                }
            });

            // Check for low stock alert
            if (updatedItem.quantity < updatedItem.minQuantity) {
                await this.checkLowStockAlert(updatedItem, userId, schoolId);
            }

            return {
                success: true,
                data: updatedItem
            };

        } catch (error) {
            logger.error(`Error adjusting inventory quantity: ${error.message}`);
            throw new Error(`Failed to adjust quantity: ${error.message}`);
        }
    }

    /**
     * Reserve item quantity
     */
    async reserveQuantity(id, quantity, userId, schoolId, reference = 'Reservation') {
        try {
            const item = await this.prisma.inventoryItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!item) {
                throw new Error('Inventory item not found');
            }

            const availableQuantity = item.quantity - item.reservedQuantity;
            if (quantity > availableQuantity) {
                throw new Error(`Not enough available quantity. Available: ${availableQuantity}`);
            }

            const newReservedQuantity = item.reservedQuantity + quantity;

            const updatedItem = await this.prisma.inventoryItem.update({
                where: { id: BigInt(id) },
                data: {
                    reservedQuantity: newReservedQuantity,
                    availableQuantity: item.quantity - newReservedQuantity,
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                }
            });

            // Create inventory log
            await this.prisma.inventoryLog.create({
                data: {
                    itemId: item.id,
                    type: 'RESERVATION',
                    quantity: quantity,
                    previousQuantity: item.reservedQuantity,
                    newQuantity: updatedItem.reservedQuantity,
                    reference,
                    userId: BigInt(userId),
                    schoolId: BigInt(schoolId)
                }
            });

            return {
                success: true,
                data: updatedItem
            };

        } catch (error) {
            logger.error(`Error reserving inventory quantity: ${error.message}`);
            throw new Error(`Failed to reserve quantity: ${error.message}`);
        }
    }

    /**
     * Release reserved quantity
     */
    async releaseReservedQuantity(id, quantity, userId, schoolId, reference = 'Release reservation') {
        try {
            const item = await this.prisma.inventoryItem.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!item) {
                throw new Error('Inventory item not found');
            }

            if (quantity > item.reservedQuantity) {
                throw new Error(`Cannot release more than reserved quantity. Reserved: ${item.reservedQuantity}`);
            }

            const newReservedQuantity = item.reservedQuantity - quantity;

            const updatedItem = await this.prisma.inventoryItem.update({
                where: { id: BigInt(id) },
                data: {
                    reservedQuantity: newReservedQuantity,
                    availableQuantity: item.quantity - newReservedQuantity,
                    updatedBy: BigInt(userId),
                    updatedAt: new Date()
                }
            });

            // Create inventory log
            await this.prisma.inventoryLog.create({
                data: {
                    itemId: item.id,
                    type: 'RELEASE',
                    quantity: quantity,
                    previousQuantity: item.reservedQuantity,
                    newQuantity: updatedItem.reservedQuantity,
                    reference,
                    userId: BigInt(userId),
                    schoolId: BigInt(schoolId)
                }
            });

            return {
                success: true,
                data: updatedItem
            };

        } catch (error) {
            logger.error(`Error releasing reserved quantity: ${error.message}`);
            throw new Error(`Failed to release reserved quantity: ${error.message}`);
        }
    }

    /**
     * Check and create low stock alert if needed
     */
    async checkLowStockAlert(item, userId, schoolId) {
        try {
            const existingAlert = await this.prisma.inventoryAlert.findFirst({
                where: {
                    itemId: item.id,
                    type: 'LOW_STOCK',
                    resolved: false
                }
            });

            if (!existingAlert && item.quantity < item.minQuantity) {
                await this.prisma.inventoryAlert.create({
                    data: {
                        itemId: item.id,
                        type: 'LOW_STOCK',
                        message: `Low stock alert for ${item.name}. Current quantity: ${item.quantity}, Minimum: ${item.minQuantity}`,
                        severity: 'HIGH',
                        schoolId: BigInt(schoolId),
                        createdBy: BigInt(userId)
                    }
                });
            }
        } catch (error) {
            logger.error(`Error checking low stock alert: ${error.message}`);
        }
    }

    /**
     * Get item logs
     */
    async getLogs(itemId, schoolId, filters = {}) {
        try {
            const { page = 1, limit = 10, type, startDate, endDate } = filters;

            const where = {
                itemId: BigInt(itemId),
                schoolId: BigInt(schoolId),
                ...(type && { type }),
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                })
            };

            const [logs, total] = await Promise.all([
                this.prisma.inventoryLog.findMany({
                    where,
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.inventoryLog.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: logs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting inventory logs: ${error.message}`);
            throw new Error(`Failed to get inventory logs: ${error.message}`);
        }
    }

    /**
     * Import items from CSV/Excel
     */
    async import(data, userId, schoolId) {
        try {
            if (!Array.isArray(data)) {
                throw new Error('Invalid import data format');
            }

            const results = [];
            const errors = [];

            for (const [index, row] of data.entries()) {
                try {
                    // Validate required fields
                    if (!row.name) {
                        throw new Error('Name is required');
                    }

                    // Check for duplicate SKU
                    if (row.sku) {
                        const existing = await this.prisma.inventoryItem.findFirst({
                            where: {
                                sku: row.sku,
                                schoolId: BigInt(schoolId),
                                deletedAt: null
                            }
                        });
                        if (existing) {
                            throw new Error(`Item with SKU ${row.sku} already exists`);
                        }
                    }

                    // Check for duplicate barcode
                    if (row.barcode) {
                        const existing = await this.prisma.inventoryItem.findFirst({
                            where: {
                                barcode: row.barcode,
                                schoolId: BigInt(schoolId),
                                deletedAt: null
                            }
                        });
                        if (existing) {
                            throw new Error(`Item with barcode ${row.barcode} already exists`);
                        }
                    }

                    const item = await this.prisma.inventoryItem.create({
                        data: {
                            name: row.name,
                            description: row.description,
                            sku: row.sku,
                            barcode: row.barcode,
                            categoryId: row.categoryId ? BigInt(row.categoryId) : null,
                            quantity: row.quantity ? parseInt(row.quantity) : 0,
                            minQuantity: row.minQuantity ? parseInt(row.minQuantity) : 0,
                            maxQuantity: row.maxQuantity ? parseInt(row.maxQuantity) : null,
                            unit: row.unit || 'PIECE',
                            price: row.price ? parseFloat(row.price) : null,
                            costPrice: row.costPrice ? parseFloat(row.costPrice) : null,
                            sellingPrice: row.sellingPrice ? parseFloat(row.sellingPrice) : null,
                            supplierId: row.supplierId ? BigInt(row.supplierId) : null,
                            location: row.location,
                            shelfNumber: row.shelfNumber,
                            expiryDate: row.expiryDate,
                            warrantyExpiry: row.warrantyExpiry,
                            status: row.status || 'AVAILABLE',
                            condition: row.condition,
                            brand: row.brand,
                            model: row.model,
                            serialNumber: row.serialNumber,
                            specifications: row.specifications ? JSON.parse(row.specifications) : null,
                            images: row.images ? row.images.split(',') : [],
                            documents: row.documents ? row.documents.split(',') : [],
                            tags: row.tags ? row.tags.split(',') : [],
                            isActive: row.isActive !== 'false',
                            isTrackable: row.isTrackable === 'true',
                            isExpirable: row.isExpirable === 'true',
                            isMaintainable: row.isMaintainable === 'true',
                            schoolId: BigInt(schoolId),
                            createdBy: BigInt(userId),
                            availableQuantity: row.quantity ? parseInt(row.quantity) : 0
                        }
                    });

                    results.push({
                        row: index + 1,
                        success: true,
                        id: item.id,
                        name: item.name
                    });
                } catch (error) {
                    errors.push({
                        row: index + 1,
                        success: false,
                        error: error.message,
                        data: row
                    });
                }
            }

            await createAuditLog({
                action: 'IMPORT',
                entity: 'INVENTORY_ITEM',
                entityId: 'BULK_IMPORT',
                details: `Imported ${results.length} items, ${errors.length} failed`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                imported: results.length,
                failed: errors.length,
                results,
                errors
            };

        } catch (error) {
            logger.error(`Error importing inventory items: ${error.message}`);
            throw new Error(`Failed to import items: ${error.message}`);
        }
    }

    /**
     * Export items to CSV/Excel
     */
    async export(schoolId, format = 'csv') {
        try {
            const items = await this.prisma.inventoryItem.findMany({
                where: {
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    category: true,
                    supplier: true
                }
            });

            if (format === 'json') {
                return {
                    success: true,
                    data: items
                };
            }

            // Convert to CSV format
            const csvData = items.map(item => ({
                'ID': item.id,
                'Name': item.name,
                'Description': item.description || '',
                'SKU': item.sku || '',
                'Barcode': item.barcode || '',
                'Category': item.category?.name || '',
                'Quantity': item.quantity,
                'Min Quantity': item.minQuantity,
                'Max Quantity': item.maxQuantity || '',
                'Unit': item.unit,
                'Price': item.price || '',
                'Cost Price': item.costPrice || '',
                'Selling Price': item.sellingPrice || '',
                'Supplier': item.supplier?.name || '',
                'Location': item.location || '',
                'Shelf Number': item.shelfNumber || '',
                'Status': item.status,
                'Condition': item.condition || '',
                'Brand': item.brand || '',
                'Model': item.model || '',
                'Serial Number': item.serialNumber || '',
                'Is Active': item.isActive,
                'Is Trackable': item.isTrackable,
                'Is Expirable': item.isExpirable,
                'Is Maintainable': item.isMaintainable,
                'Created At': item.createdAt
            }));

            return {
                success: true,
                data: csvData
            };

        } catch (error) {
            logger.error(`Error exporting inventory items: ${error.message}`);
            throw new Error(`Failed to export items: ${error.message}`);
        }
    }
}

export default InventoryItem;
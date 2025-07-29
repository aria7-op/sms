import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

class InventorySupplier {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create a new supplier
     */
    async create(data) {
        try {
            const supplier = await this.prisma.inventorySupplier.create({
                data: {
                    name: data.name,
                    code: data.code,
                    contactPerson: data.contactPerson,
                    email: data.email,
                    phone: data.phone,
                    address: data.address,
                    city: data.city,
                    state: data.state,
                    country: data.country,
                    postalCode: data.postalCode,
                    website: data.website,
                    taxId: data.taxId,
                    bankDetails: data.bankDetails,
                    paymentTerms: data.paymentTerms,
                    creditLimit: data.creditLimit,
                    rating: data.rating,
                    status: data.status || 'ACTIVE',
                    schoolId: BigInt(data.schoolId),
                    createdBy: BigInt(data.createdBy),
                    categories: data.categoryIds ? {
                        connect: data.categoryIds.map(id => ({ id: BigInt(id) }))
                    } : undefined
                },
                include: {
                    categories: true,
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

            await createAuditLog({
                action: 'CREATE',
                entity: 'INVENTORY_SUPPLIER',
                entityId: supplier.id.toString(),
                details: `Supplier ${supplier.name} created`,
                userId: data.createdBy,
                schoolId: data.schoolId
            });

            return {
                success: true,
                data: supplier
            };

        } catch (error) {
            logger.error(`Error creating supplier: ${error.message}`);
            throw new Error(`Failed to create supplier: ${error.message}`);
        }
    }

    /**
     * Get supplier by ID
     */
    async getById(id, schoolId) {
        try {
            const supplier = await this.prisma.inventorySupplier.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    categories: true,
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
                    items: {
                        include: {
                            category: true
                        }
                    },
                    purchaseOrders: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 5,
                        include: {
                            items: true
                        }
                    }
                }
            });

            if (!supplier) {
                throw new Error('Supplier not found');
            }

            return {
                success: true,
                data: supplier
            };

        } catch (error) {
            logger.error(`Error getting supplier: ${error.message}`);
            throw new Error(`Failed to get supplier: ${error.message}`);
        }
    }

    /**
     * Get all suppliers with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                status,
                rating,
                categoryId,
                sortBy = 'name',
                sortOrder = 'asc',
                schoolId
            } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(status && { status }),
                ...(rating && { rating: { gte: parseInt(rating) } }),
                ...(categoryId && {
                    categories: {
                        some: {
                            id: BigInt(categoryId)
                        }
                    }
                }),
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { code: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { contactPerson: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const [suppliers, total] = await Promise.all([
                this.prisma.inventorySupplier.findMany({
                    where,
                    include: {
                        categories: true,
                        _count: {
                            select: {
                                items: true,
                                purchaseOrders: true
                            }
                        }
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.inventorySupplier.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: suppliers,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all suppliers: ${error.message}`);
            throw new Error(`Failed to get suppliers: ${error.message}`);
        }
    }

    /**
     * Update supplier
     */
    async update(id, updateData, userId, schoolId) {
        try {
            const existingSupplier = await this.prisma.inventorySupplier.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingSupplier) {
                throw new Error('Supplier not found');
            }

            const updatedSupplier = await this.prisma.inventorySupplier.update({
                where: { id: BigInt(id) },
                data: {
                    ...updateData,
                    ...(updateData.creditLimit && { creditLimit: parseFloat(updateData.creditLimit) }),
                    ...(updateData.rating && { rating: parseInt(updateData.rating) }),
                    updatedBy: BigInt(userId),
                    categories: updateData.categoryIds ? {
                        set: updateData.categoryIds.map(id => ({ id: BigInt(id) }))
                    } : undefined
                },
                include: {
                    categories: true,
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            await createAuditLog({
                action: 'UPDATE',
                entity: 'INVENTORY_SUPPLIER',
                entityId: updatedSupplier.id.toString(),
                details: `Supplier ${updatedSupplier.name} updated`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                data: updatedSupplier
            };

        } catch (error) {
            logger.error(`Error updating supplier: ${error.message}`);
            throw new Error(`Failed to update supplier: ${error.message}`);
        }
    }

    /**
     * Delete supplier (soft delete)
     */
    async delete(id, userId, schoolId) {
        try {
            const existingSupplier = await this.prisma.inventorySupplier.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                }
            });

            if (!existingSupplier) {
                throw new Error('Supplier not found');
            }

            // Check if supplier has associated items or purchase orders
            const [itemsCount, poCount] = await Promise.all([
                this.prisma.inventoryItem.count({
                    where: {
                        supplierId: BigInt(id),
                        deletedAt: null
                    }
                }),
                this.prisma.purchaseOrder.count({
                    where: {
                        supplierId: BigInt(id),
                        deletedAt: null
                    }
                })
            ]);

            if (itemsCount > 0 || poCount > 0) {
                throw new Error('Cannot delete supplier with associated items or purchase orders');
            }

            await this.prisma.inventorySupplier.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: BigInt(userId)
                }
            });

            await createAuditLog({
                action: 'DELETE',
                entity: 'INVENTORY_SUPPLIER',
                entityId: id.toString(),
                details: `Supplier ${existingSupplier.name} deleted`,
                userId: userId,
                schoolId: schoolId
            });

            return {
                success: true,
                message: 'Supplier deleted successfully'
            };

        } catch (error) {
            logger.error(`Error deleting supplier: ${error.message}`);
            throw new Error(`Failed to delete supplier: ${error.message}`);
        }
    }

    /**
     * Get supplier statistics
     */
    async getStatistics(schoolId) {
        try {
            const [
                totalSuppliers,
                suppliersByStatus,
                topSuppliers,
                recentSuppliers
            ] = await Promise.all([
                this.prisma.inventorySupplier.count({
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null
                    }
                }),
                this.prisma.inventorySupplier.groupBy({
                    by: ['status'],
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null
                    },
                    _count: { id: true }
                }),
                this.prisma.inventorySupplier.findMany({
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null
                    },
                    orderBy: {
                        purchaseOrders: {
                            _count: 'desc'
                        }
                    },
                    take: 5,
                    include: {
                        _count: {
                            select: {
                                purchaseOrders: true,
                                items: true
                            }
                        }
                    }
                }),
                this.prisma.inventorySupplier.findMany({
                    where: {
                        schoolId: BigInt(schoolId),
                        deletedAt: null
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 5
                })
            ]);

            return {
                success: true,
                data: {
                    totalSuppliers,
                    suppliersByStatus,
                    topSuppliers,
                    recentSuppliers
                }
            };

        } catch (error) {
            logger.error(`Error getting supplier statistics: ${error.message}`);
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    /**
     * Get supplier items
     */
    async getItems(supplierId, schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                categoryId,
                status,
                sortBy = 'name',
                sortOrder = 'asc'
            } = filters;

            const where = {
                supplierId: BigInt(supplierId),
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(status && { status }),
                ...(categoryId && { categoryId: BigInt(categoryId) }),
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { code: { contains: search, mode: 'insensitive' } },
                        { description: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const [items, total] = await Promise.all([
                this.prisma.inventoryItem.findMany({
                    where,
                    include: {
                        category: true
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.inventoryItem.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: items,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting supplier items: ${error.message}`);
            throw new Error(`Failed to get supplier items: ${error.message}`);
        }
    }

    /**
     * Get supplier purchase orders
     */
    async getPurchaseOrders(supplierId, schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                startDate,
                endDate,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {
                supplierId: BigInt(supplierId),
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(status && { status }),
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                })
            };

            const [orders, total] = await Promise.all([
                this.prisma.purchaseOrder.findMany({
                    where,
                    include: {
                        items: true,
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
                this.prisma.purchaseOrder.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: orders,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting supplier purchase orders: ${error.message}`);
            throw new Error(`Failed to get purchase orders: ${error.message}`);
        }
    }

    /**
     * Import suppliers from CSV/Excel
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

                    // Check for duplicate code
                    if (row.code) {
                        const existing = await this.prisma.inventorySupplier.findFirst({
                            where: {
                                code: row.code,
                                schoolId: BigInt(schoolId),
                                deletedAt: null
                            }
                        });
                        if (existing) {
                            throw new Error(`Supplier with code ${row.code} already exists`);
                        }
                    }

                    const supplier = await this.prisma.inventorySupplier.create({
                        data: {
                            name: row.name,
                            code: row.code,
                            contactPerson: row.contactPerson,
                            email: row.email,
                            phone: row.phone,
                            address: row.address,
                            city: row.city,
                            state: row.state,
                            country: row.country,
                            postalCode: row.postalCode,
                            website: row.website,
                            taxId: row.taxId,
                            bankDetails: row.bankDetails ? JSON.parse(row.bankDetails) : undefined,
                            paymentTerms: row.paymentTerms,
                            creditLimit: row.creditLimit ? parseFloat(row.creditLimit) : undefined,
                            rating: row.rating ? parseInt(row.rating) : undefined,
                            status: row.status || 'ACTIVE',
                            schoolId: BigInt(schoolId),
                            createdBy: BigInt(userId)
                        }
                    });

                    results.push({
                        row: index + 1,
                        success: true,
                        id: supplier.id,
                        name: supplier.name
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
                entity: 'INVENTORY_SUPPLIER',
                entityId: 'BULK_IMPORT',
                details: `Imported ${results.length} suppliers, ${errors.length} failed`,
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
            logger.error(`Error importing suppliers: ${error.message}`);
            throw new Error(`Failed to import suppliers: ${error.message}`);
        }
    }

    /**
     * Export suppliers to CSV/Excel
     */
    async export(schoolId, format = 'csv') {
        try {
            const suppliers = await this.prisma.inventorySupplier.findMany({
                where: {
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                include: {
                    categories: true
                }
            });

            if (format === 'json') {
                return {
                    success: true,
                    data: suppliers
                };
            }

            // Convert to CSV format
            const csvData = suppliers.map(supplier => ({
                'ID': supplier.id,
                'Name': supplier.name,
                'Code': supplier.code || '',
                'Contact Person': supplier.contactPerson || '',
                'Email': supplier.email || '',
                'Phone': supplier.phone || '',
                'Address': supplier.address || '',
                'City': supplier.city || '',
                'State': supplier.state || '',
                'Country': supplier.country || '',
                'Postal Code': supplier.postalCode || '',
                'Website': supplier.website || '',
                'Tax ID': supplier.taxId || '',
                'Payment Terms': supplier.paymentTerms || '',
                'Credit Limit': supplier.creditLimit || '',
                'Rating': supplier.rating || '',
                'Status': supplier.status,
                'Categories': supplier.categories.map(c => c.name).join(', '),
                'Created At': supplier.createdAt
            }));

            return {
                success: true,
                data: csvData
            };

        } catch (error) {
            logger.error(`Error exporting suppliers: ${error.message}`);
            throw new Error(`Failed to export suppliers: ${error.message}`);
        }
    }
}

export default InventorySupplier;
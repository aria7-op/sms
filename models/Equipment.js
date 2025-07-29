import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class Equipment {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new equipment
     */
    async create(data) {
        try {
            const equipment = await this.prisma.equipment.create({
                data: {
                    name: data.name,
                    description: data.description,
                    category: data.category,
                    subcategory: data.subcategory,
                    brand: data.brand,
                    model: data.model,
                    serialNumber: data.serialNumber,
                    assetTag: data.assetTag,
                    purchaseDate: data.purchaseDate,
                    purchasePrice: data.purchasePrice,
                    currentValue: data.currentValue,
                    warrantyExpiry: data.warrantyExpiry,
                    location: data.location,
                    status: data.status || 'AVAILABLE',
                    condition: data.condition || 'EXCELLENT',
                    specifications: data.specifications,
                    supplier: data.supplier,
                    supplierContact: data.supplierContact,
                    maintenanceSchedule: data.maintenanceSchedule,
                    lastMaintenanceDate: data.lastMaintenanceDate,
                    nextMaintenanceDate: data.nextMaintenanceDate,
                    usageInstructions: data.usageInstructions,
                    safetyNotes: data.safetyNotes,
                    isPortable: data.isPortable || false,
                    requiresTraining: data.requiresTraining || false,
                    maxUsers: data.maxUsers,
                    powerRequirements: data.powerRequirements,
                    dimensions: data.dimensions,
                    weight: data.weight,
                    color: data.color,
                    barcode: data.barcode,
                    qrCode: data.qrCode,
                    imageUrl: data.imageUrl,
                    documents: data.documents,
                    tags: data.tags,
                    metadata: data.metadata,
                    schoolId: data.schoolId,
                    departmentId: data.departmentId,
                    assignedTo: data.assignedTo,
                    assignedDate: data.assignedDate,
                    notes: data.notes,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    department: true,
                    assignedUser: true,
                    maintenanceLogs: true,
                    usageLogs: true,
                    reservations: true
                }
            });

            return {
                success: true,
                data: equipment,
                message: 'Equipment created successfully'
            };
        } catch (error) {
            console.error('Error creating equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create equipment'
            };
        }
    }

    /**
     * Get equipment by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                school: true,
                department: true,
                assignedUser: true,
                maintenanceLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                },
                usageLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10
                },
                reservations: {
                    where: { 
                        startDate: { gte: new Date() },
                        status: { in: ['PENDING', 'APPROVED'] }
                    },
                    orderBy: { startDate: 'asc' }
                },
                checkouts: {
                    where: { returnDate: null },
                    include: { user: true }
                }
            } : {};

            const equipment = await this.prisma.equipment.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!equipment) {
                return {
                    success: false,
                    error: 'Equipment not found',
                    message: 'Equipment not found'
                };
            }

            return {
                success: true,
                data: equipment,
                message: 'Equipment retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve equipment'
            };
        }
    }

    /**
     * Get all equipment with advanced filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                category,
                subcategory,
                status,
                condition,
                location,
                departmentId,
                assignedTo,
                isActive,
                minPrice,
                maxPrice,
                purchaseDateFrom,
                purchaseDateTo,
                warrantyExpiryFrom,
                warrantyExpiryTo,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Search functionality
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { brand: { contains: search, mode: 'insensitive' } },
                    { model: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { assetTag: { contains: search, mode: 'insensitive' } },
                    { barcode: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Filter by category
            if (category) {
                where.category = category;
            }

            // Filter by subcategory
            if (subcategory) {
                where.subcategory = subcategory;
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by condition
            if (condition) {
                where.condition = condition;
            }

            // Filter by location
            if (location) {
                where.location = { contains: location, mode: 'insensitive' };
            }

            // Filter by department
            if (departmentId) {
                where.departmentId = parseInt(departmentId);
            }

            // Filter by assigned user
            if (assignedTo) {
                where.assignedTo = parseInt(assignedTo);
            }

            // Filter by active status
            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            // Filter by price range
            if (minPrice || maxPrice) {
                where.currentValue = {};
                if (minPrice) where.currentValue.gte = parseFloat(minPrice);
                if (maxPrice) where.currentValue.lte = parseFloat(maxPrice);
            }

            // Filter by purchase date range
            if (purchaseDateFrom || purchaseDateTo) {
                where.purchaseDate = {};
                if (purchaseDateFrom) where.purchaseDate.gte = new Date(purchaseDateFrom);
                if (purchaseDateTo) where.purchaseDate.lte = new Date(purchaseDateTo);
            }

            // Filter by warranty expiry range
            if (warrantyExpiryFrom || warrantyExpiryTo) {
                where.warrantyExpiry = {};
                if (warrantyExpiryFrom) where.warrantyExpiry.gte = new Date(warrantyExpiryFrom);
                if (warrantyExpiryTo) where.warrantyExpiry.lte = new Date(warrantyExpiryTo);
            }

            const skip = (page - 1) * limit;

            const [equipment, total] = await Promise.all([
                this.prisma.equipment.findMany({
                    where,
                    include: {
                        school: true,
                        department: true,
                        assignedUser: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        },
                        _count: {
                            select: {
                                maintenanceLogs: true,
                                usageLogs: true,
                                reservations: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.equipment.count({ where })
            ]);

            return {
                success: true,
                data: {
                    equipment,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Equipment retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve equipment'
            };
        }
    }

    /**
     * Update equipment
     */
    async update(id, data) {
        try {
            const equipment = await this.prisma.equipment.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    department: true,
                    assignedUser: true
                }
            });

            return {
                success: true,
                data: equipment,
                message: 'Equipment updated successfully'
            };
        } catch (error) {
            console.error('Error updating equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update equipment'
            };
        }
    }

    /**
     * Delete equipment (soft delete)
     */
    async delete(id) {
        try {
            const equipment = await this.prisma.equipment.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: equipment,
                message: 'Equipment deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete equipment'
            };
        }
    }

    /**
     * Hard delete equipment
     */
    async hardDelete(id) {
        try {
            await this.prisma.equipment.delete({
                where: { id: parseInt(id) }
            });

            return {
                success: true,
                message: 'Equipment permanently deleted'
            };
        } catch (error) {
            console.error('Error hard deleting equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to permanently delete equipment'
            };
        }
    }

    /**
     * Assign equipment to user
     */
    async assignToUser(equipmentId, userId, assignmentData = {}) {
        try {
            const equipment = await this.prisma.equipment.update({
                where: { id: parseInt(equipmentId) },
                data: {
                    assignedTo: parseInt(userId),
                    assignedDate: new Date(),
                    status: 'ASSIGNED',
                    notes: assignmentData.notes,
                    updatedAt: new Date()
                },
                include: {
                    assignedUser: true
                }
            });

            return {
                success: true,
                data: equipment,
                message: 'Equipment assigned successfully'
            };
        } catch (error) {
            console.error('Error assigning equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to assign equipment'
            };
        }
    }

    /**
     * Unassign equipment
     */
    async unassign(equipmentId) {
        try {
            const equipment = await this.prisma.equipment.update({
                where: { id: parseInt(equipmentId) },
                data: {
                    assignedTo: null,
                    assignedDate: null,
                    status: 'AVAILABLE',
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: equipment,
                message: 'Equipment unassigned successfully'
            };
        } catch (error) {
            console.error('Error unassigning equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to unassign equipment'
            };
        }
    }

    /**
     * Get equipment analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                category,
                departmentId,
                groupBy = 'month'
            } = filters;

            const where = {};
            if (startDate && endDate) {
                where.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            if (category) where.category = category;
            if (departmentId) where.departmentId = parseInt(departmentId);

            // Equipment count by status
            const statusCounts = await this.prisma.equipment.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Equipment count by condition
            const conditionCounts = await this.prisma.equipment.groupBy({
                by: ['condition'],
                where,
                _count: { condition: true }
            });

            // Equipment count by category
            const categoryCounts = await this.prisma.equipment.groupBy({
                by: ['category'],
                where,
                _count: { category: true },
                _sum: { currentValue: true }
            });

            // Total value
            const totalValue = await this.prisma.equipment.aggregate({
                where,
                _sum: { currentValue: true },
                _count: true
            });

            // Equipment added over time
            const timeSeriesData = await this.prisma.equipment.groupBy({
                by: [groupBy === 'month' ? 'createdAt' : 'createdAt'],
                where,
                _count: true
            });

            return {
                success: true,
                data: {
                    statusCounts,
                    conditionCounts,
                    categoryCounts,
                    totalValue: totalValue._sum.currentValue || 0,
                    totalCount: totalValue._count || 0,
                    timeSeriesData
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting equipment analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Get equipment maintenance schedule
     */
    async getMaintenanceSchedule(filters = {}) {
        try {
            const {
                startDate = new Date(),
                endDate,
                status = 'PENDING'
            } = filters;

            const where = {
                nextMaintenanceDate: {
                    gte: startDate
                }
            };

            if (endDate) {
                where.nextMaintenanceDate.lte = new Date(endDate);
            }

            const equipment = await this.prisma.equipment.findMany({
                where,
                include: {
                    department: true,
                    assignedUser: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: { nextMaintenanceDate: 'asc' }
            });

            return {
                success: true,
                data: equipment,
                message: 'Maintenance schedule retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting maintenance schedule:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve maintenance schedule'
            };
        }
    }

    /**
     * Get equipment usage statistics
     */
    async getUsageStatistics(equipmentId, period = 'month') {
        try {
            const startDate = new Date();
            if (period === 'week') {
                startDate.setDate(startDate.getDate() - 7);
            } else if (period === 'month') {
                startDate.setMonth(startDate.getMonth() - 1);
            } else if (period === 'year') {
                startDate.setFullYear(startDate.getFullYear() - 1);
            }

            const usageLogs = await this.prisma.equipmentUsageLog.findMany({
                where: {
                    equipmentId: parseInt(equipmentId),
                    createdAt: { gte: startDate }
                },
                orderBy: { createdAt: 'desc' }
            });

            const totalUsage = usageLogs.reduce((sum, log) => sum + (log.duration || 0), 0);
            const averageUsage = usageLogs.length > 0 ? totalUsage / usageLogs.length : 0;

            return {
                success: true,
                data: {
                    totalUsage,
                    averageUsage,
                    usageCount: usageLogs.length,
                    usageLogs
                },
                message: 'Usage statistics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting usage statistics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve usage statistics'
            };
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(equipmentIds, updateData) {
        try {
            const result = await this.prisma.equipment.updateMany({
                where: {
                    id: { in: equipmentIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} equipment items`
            };
        } catch (error) {
            console.error('Error bulk updating equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update equipment'
            };
        }
    }

    /**
     * Import equipment from CSV/Excel
     */
    async importFromFile(fileData, schoolId) {
        try {
            const equipmentData = fileData.map(item => ({
                ...item,
                schoolId: parseInt(schoolId),
                purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : null,
                warrantyExpiry: item.warrantyExpiry ? new Date(item.warrantyExpiry) : null,
                purchasePrice: parseFloat(item.purchasePrice) || 0,
                currentValue: parseFloat(item.currentValue) || 0,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            const result = await this.prisma.equipment.createMany({
                data: equipmentData,
                skipDuplicates: true
            });

            return {
                success: true,
                data: result,
                message: `Imported ${result.count} equipment items`
            };
        } catch (error) {
            console.error('Error importing equipment:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to import equipment'
            };
        }
    }

    /**
     * Export equipment data
     */
    async exportData(filters = {}) {
        try {
            const equipment = await this.getAll(filters, { page: 1, limit: 10000 });
            
            if (!equipment.success) {
                return equipment;
            }

            const exportData = equipment.data.equipment.map(item => ({
                id: item.id,
                name: item.name,
                description: item.description,
                category: item.category,
                subcategory: item.subcategory,
                brand: item.brand,
                model: item.model,
                serialNumber: item.serialNumber,
                assetTag: item.assetTag,
                purchaseDate: item.purchaseDate,
                purchasePrice: item.purchasePrice,
                currentValue: item.currentValue,
                warrantyExpiry: item.warrantyExpiry,
                location: item.location,
                status: item.status,
                condition: item.condition,
                supplier: item.supplier,
                assignedTo: item.assignedUser?.name || '',
                department: item.department?.name || '',
                createdAt: item.createdAt
            }));

            return {
                success: true,
                data: exportData,
                message: 'Equipment data exported successfully'
            };
        } catch (error) {
            console.error('Error exporting equipment data:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to export equipment data'
            };
        }
    }
}

export default Equipment;

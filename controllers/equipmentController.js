import Equipment from '../models/Equipment.js';
import EquipmentUsageLog from '../models/EquipmentUsageLog.js';
import EquipmentReservation from '../models/EquipmentReservation.js';
import { validateEquipment, validateEquipmentUpdate } from '../validators/equipmentValidator.js';
// import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
// import { generateQRCode, generateBarcode } from '../utils/barcodeGenerator.js';
import { sendNotification } from '../utils/notifications.js';
import { createAuditLog } from '../middleware/audit.js';
import { cacheData, getCachedData, clearCache } from '../cache/cacheManager.js';

class EquipmentController {
    constructor() {
        this.equipment = new Equipment();
        this.usageLog = new EquipmentUsageLog();
        this.reservation = new EquipmentReservation();
    }

    /**
     * Create new equipment
     */
    async createEquipment(req, res) {
        try {
            // Validate request data
            const validation = validateEquipment(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: validation.error,
                    message: 'Validation failed'
                });
            }

            // Handle file upload if image is provided
            let imageUrl = null;
            if (req.file) {
                const uploadResult = await uploadToCloudinary(req.file.path, 'equipment');
                imageUrl = uploadResult.secure_url;
            }

            // Generate QR code and barcode if not provided
            let qrCode = req.body.qrCode;
            let barcode = req.body.barcode;
            
            if (!qrCode) {
                qrCode = await generateQRCode(`EQUIPMENT_${Date.now()}`);
            }
            if (!barcode) {
                barcode = await generateBarcode(`EQ${Date.now()}`);
            }

            const equipmentData = {
                ...req.body,
                imageUrl,
                qrCode,
                barcode,
                schoolId: req.user.schoolId,
                createdBy: req.user.id
            };

            const result = await this.equipment.create(equipmentData);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'EQUIPMENT',
                    resourceId: result.data.id,
                    details: `Created equipment: ${result.data.name}`,
                    ipAddress: req.ip
                });

                // Clear cache
                await clearCache('equipment');

                // Send notification to relevant users
                await sendNotification({
                    type: 'EQUIPMENT_ADDED',
                    title: 'New Equipment Added',
                    message: `New equipment "${result.data.name}" has been added to the inventory`,
                    recipients: ['ADMIN', 'INVENTORY_MANAGER'],
                    schoolId: req.user.schoolId,
                    data: { equipmentId: result.data.id }
                });

                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Get equipment by ID
     */
    async getEquipmentById(req, res) {
        try {
            const { id } = req.params;
            const includeRelated = req.query.include !== 'false';

            // Check cache first
            const cacheKey = `equipment_${id}_${includeRelated}`;
            const cachedData = await getCachedData(cacheKey);
            if (cachedData) {
                return res.json(cachedData);
            }

            const result = await this.equipment.getById(id, includeRelated);

            if (result.success) {
                // Cache the result
                await cacheData(cacheKey, result, 300); // 5 minutes cache
                return res.json(result);
            } else {
                return res.status(404).json(result);
            }
        } catch (error) {
            console.error('Error getting equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Get all equipment with advanced filtering
     */
    async getAllEquipment(req, res) {
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
            } = req.query;

            const filters = {
                page: parseInt(page),
                limit: parseInt(limit),
                search,
                category,
                subcategory,
                status,
                condition,
                location,
                departmentId,
                assignedTo,
                isActive: isActive === 'true',
                minPrice,
                maxPrice,
                purchaseDateFrom,
                purchaseDateTo,
                warrantyExpiryFrom,
                warrantyExpiryTo,
                sortBy,
                sortOrder
            };

            // Add school filter
            filters.schoolId = req.user.schoolId;

            // Check cache first
            const cacheKey = `equipment_list_${JSON.stringify(filters)}`;
            const cachedData = await getCachedData(cacheKey);
            if (cachedData) {
                return res.json(cachedData);
            }

            const result = await this.equipment.getAll(filters);

            if (result.success) {
                // Cache the result
                await cacheData(cacheKey, result, 180); // 3 minutes cache
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Update equipment
     */
    async updateEquipment(req, res) {
        try {
            const { id } = req.params;

            // Validate request data
            const validation = validateEquipmentUpdate(req.body);
            if (!validation.success) {
                return res.status(400).json({
                    success: false,
                    error: validation.error,
                    message: 'Validation failed'
                });
            }

            // Get current equipment data for audit
            const currentEquipment = await this.equipment.getById(id);
            if (!currentEquipment.success) {
                return res.status(404).json(currentEquipment);
            }

            // Handle file upload if new image is provided
            let imageUrl = currentEquipment.data.imageUrl;
            if (req.file) {
                // Delete old image if exists
                if (currentEquipment.data.imageUrl) {
                    await deleteFromCloudinary(currentEquipment.data.imageUrl);
                }
                
                const uploadResult = await uploadToCloudinary(req.file.path, 'equipment');
                imageUrl = uploadResult.secure_url;
            }

            const updateData = {
                ...req.body,
                imageUrl,
                updatedBy: req.user.id
            };

            const result = await this.equipment.update(id, updateData);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    resource: 'EQUIPMENT',
                    resourceId: parseInt(id),
                    details: `Updated equipment: ${result.data.name}`,
                    previousData: currentEquipment.data,
                    newData: result.data,
                    ipAddress: req.ip
                });

                // Clear cache
                await clearCache('equipment');

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error updating equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Delete equipment (soft delete)
     */
    async deleteEquipment(req, res) {
        try {
            const { id } = req.params;

            // Get equipment data for audit
            const currentEquipment = await this.equipment.getById(id);
            if (!currentEquipment.success) {
                return res.status(404).json(currentEquipment);
            }

            const result = await this.equipment.delete(id);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    resource: 'EQUIPMENT',
                    resourceId: parseInt(id),
                    details: `Deleted equipment: ${currentEquipment.data.name}`,
                    previousData: currentEquipment.data,
                    ipAddress: req.ip
                });

                // Clear cache
                await clearCache('equipment');

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error deleting equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Assign equipment to user
     */
    async assignEquipment(req, res) {
        try {
            const { id } = req.params;
            const { userId, notes } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'User ID is required',
                    message: 'User ID is required'
                });
            }

            const result = await this.equipment.assignToUser(id, userId, { notes });

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'ASSIGN',
                    resource: 'EQUIPMENT',
                    resourceId: parseInt(id),
                    details: `Assigned equipment to user: ${userId}`,
                    ipAddress: req.ip
                });

                // Send notification to assigned user
                await sendNotification({
                    type: 'EQUIPMENT_ASSIGNED',
                    title: 'Equipment Assigned',
                    message: `Equipment "${result.data.name}" has been assigned to you`,
                    recipients: [userId],
                    schoolId: req.user.schoolId,
                    data: { equipmentId: result.data.id }
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error assigning equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Unassign equipment
     */
    async unassignEquipment(req, res) {
        try {
            const { id } = req.params;

            const result = await this.equipment.unassign(id);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UNASSIGN',
                    resource: 'EQUIPMENT',
                    resourceId: parseInt(id),
                    details: `Unassigned equipment`,
                    ipAddress: req.ip
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error unassigning equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Get equipment analytics
     */
    async getEquipmentAnalytics(req, res) {
        try {
            const {
                startDate,
                endDate,
                category,
                departmentId,
                groupBy = 'month'
            } = req.query;

            const filters = {
                startDate,
                endDate,
                category,
                departmentId,
                groupBy
            };

            // Add school filter
            filters.schoolId = req.user.schoolId;

            // Check cache first
            const cacheKey = `equipment_analytics_${JSON.stringify(filters)}`;
            const cachedData = await getCachedData(cacheKey);
            if (cachedData) {
                return res.json(cachedData);
            }

            const result = await this.equipment.getAnalytics(filters);

            if (result.success) {
                // Cache the result
                await cacheData(cacheKey, result, 600); // 10 minutes cache
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting equipment analytics:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Get maintenance schedule
     */
    async getMaintenanceSchedule(req, res) {
        try {
            const {
                startDate = new Date(),
                endDate,
                status = 'PENDING'
            } = req.query;

            const filters = {
                startDate: new Date(startDate),
                endDate: endDate ? new Date(endDate) : null,
                status
            };

            // Add school filter
            filters.schoolId = req.user.schoolId;

            const result = await this.equipment.getMaintenanceSchedule(filters);

            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting maintenance schedule:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Get equipment usage statistics
     */
    async getUsageStatistics(req, res) {
        try {
            const { id } = req.params;
            const { period = 'month' } = req.query;

            const result = await this.equipment.getUsageStatistics(id, period);

            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting usage statistics:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Bulk update equipment
     */
    async bulkUpdateEquipment(req, res) {
        try {
            const { equipmentIds, updateData } = req.body;

            if (!equipmentIds || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Equipment IDs array is required',
                    message: 'Equipment IDs array is required'
                });
            }

            const result = await this.equipment.bulkUpdate(equipmentIds, updateData);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'BULK_UPDATE',
                    resource: 'EQUIPMENT',
                    details: `Bulk updated ${result.data.count} equipment items`,
                    ipAddress: req.ip
                });

                // Clear cache
                await clearCache('equipment');

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error bulk updating equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Import equipment from file
     */
    async importEquipment(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: 'File is required',
                    message: 'Please upload a file'
                });
            }

            // Parse file data (CSV/Excel)
            const fileData = await this.parseImportFile(req.file);
            if (!fileData.success) {
                return res.status(400).json(fileData);
            }

            const result = await this.equipment.importFromFile(fileData.data, req.user.schoolId);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'IMPORT',
                    resource: 'EQUIPMENT',
                    details: `Imported ${result.data.count} equipment items`,
                    ipAddress: req.ip
                });

                // Clear cache
                await clearCache('equipment');

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error importing equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Export equipment data
     */
    async exportEquipment(req, res) {
        try {
            const filters = req.query;

            // Add school filter
            filters.schoolId = req.user.schoolId;

            const result = await this.equipment.exportData(filters);

            if (result.success) {
                // Set response headers for file download
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', 'attachment; filename=equipment_export.json');
                
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error exporting equipment:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Get equipment by QR code
     */
    async getEquipmentByQR(req, res) {
        try {
            const { qrCode } = req.params;

            const equipment = await this.equipment.prisma.equipment.findFirst({
                where: { qrCode },
                include: {
                    school: true,
                    department: true,
                    assignedUser: true,
                    maintenanceLogs: {
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    }
                }
            });

            if (!equipment) {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found',
                    message: 'Equipment not found'
                });
            }

            return res.json({
                success: true,
                data: equipment,
                message: 'Equipment retrieved successfully'
            });
        } catch (error) {
            console.error('Error getting equipment by QR:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Get equipment by barcode
     */
    async getEquipmentByBarcode(req, res) {
        try {
            const { barcode } = req.params;

            const equipment = await this.equipment.prisma.equipment.findFirst({
                where: { barcode },
                include: {
                    school: true,
                    department: true,
                    assignedUser: true
                }
            });

            if (!equipment) {
                return res.status(404).json({
                    success: false,
                    error: 'Equipment not found',
                    message: 'Equipment not found'
                });
            }

            return res.json({
                success: true,
                data: equipment,
                message: 'Equipment retrieved successfully'
            });
        } catch (error) {
            console.error('Error getting equipment by barcode:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    /**
     * Parse import file (CSV/Excel)
     */
    async parseImportFile(file) {
        try {
            // This is a placeholder - implement actual file parsing logic
            // based on your file format (CSV, Excel, etc.)
            
            const fileExtension = file.originalname.split('.').pop().toLowerCase();
            
            if (fileExtension === 'csv') {
                // Parse CSV file
                return this.parseCSVFile(file.path);
            } else if (['xlsx', 'xls'].includes(fileExtension)) {
                // Parse Excel file
                return this.parseExcelFile(file.path);
            } else {
                return {
                    success: false,
                    error: 'Unsupported file format',
                    message: 'Only CSV and Excel files are supported'
                };
            }
        } catch (error) {
            console.error('Error parsing import file:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to parse import file'
            };
        }
    }

    /**
     * Parse CSV file
     */
    async parseCSVFile(filePath) {
        // Implement CSV parsing logic
        // This is a placeholder implementation
        return {
            success: true,
            data: []
        };
    }

    /**
     * Parse Excel file
     */
    async parseExcelFile(filePath) {
        // Implement Excel parsing logic
        // This is a placeholder implementation
        return {
            success: true,
            data: []
        };
    }
}

export default EquipmentController;

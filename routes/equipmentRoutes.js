import express from 'express';
const router = express.Router();
import equipmentController from '../controllers/equipmentController.js';
import { authenticate, authorizeRoles, authorize } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { validateRequest } from '../middleware/validation.js';
import { upload } from '../middleware/upload.js';
import { createAuditLog } from '../middleware/audit.js';
import { cacheData, getCachedData, clearCache } from '../cache/cacheManager.js';


// Rate limiting
const equipmentRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many equipment requests from this IP, please try again later.'
});

// Apply rate limiting to all equipment routes
router.use(equipmentRateLimit);

/**
 * @route   POST /api/equipment
 * @desc    Create new equipment
 * @access  Private (Admin, Inventory Manager)
 */
router.post('/',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    upload.single('image'),
    async (req, res) => {
        try {
            const result = await equipmentController.createEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in equipment creation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment
 * @desc    Get all equipment with filtering and pagination
 * @access  Private (All authenticated users)
 */
router.get('/',
    authenticate,
    async (req, res) => {
        try {
            const result = await equipmentController.getAllEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in get all equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/:id
 * @desc    Get equipment by ID
 * @access  Private (All authenticated users)
 */
router.get('/:id',
    authenticate,
    async (req, res) => {
        try {
            const result = await equipmentController.getEquipmentById(req, res);
            return result;
        } catch (error) {
            console.error('Error in get equipment by ID route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   PUT /api/equipment/:id
 * @desc    Update equipment
 * @access  Private (Admin, Inventory Manager)
 */
router.put('/:id',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    upload.single('image'),
    async (req, res) => {
        try {
            const result = await equipmentController.updateEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in update equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   DELETE /api/equipment/:id
 * @desc    Delete equipment (soft delete)
 * @access  Private (Admin, Inventory Manager)
 */
router.delete('/:id',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    async (req, res) => {
        try {
            const result = await equipmentController.deleteEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in delete equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/equipment/:id/assign
 * @desc    Assign equipment to user
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.post('/:id/assign',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const result = await equipmentController.assignEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in assign equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/equipment/:id/unassign
 * @desc    Unassign equipment
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.post('/:id/unassign',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const result = await equipmentController.unassignEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in unassign equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/analytics/summary
 * @desc    Get equipment analytics summary
 * @access  Private (Admin, Inventory Manager)
 */
router.get('/analytics/summary',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    async (req, res) => {
        try {
            const result = await equipmentController.getEquipmentAnalytics(req, res);
            return result;
        } catch (error) {
            console.error('Error in equipment analytics route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/maintenance/schedule
 * @desc    Get equipment maintenance schedule
 * @access  Private (Admin, Inventory Manager, Maintenance Staff)
 */
router.get('/maintenance/schedule',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'MAINTENANCE_STAFF']),
    async (req, res) => {
        try {
            const result = await equipmentController.getMaintenanceSchedule(req, res);
            return result;
        } catch (error) {
            console.error('Error in maintenance schedule route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/:id/usage/statistics
 * @desc    Get equipment usage statistics
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.get('/:id/usage/statistics',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const result = await equipmentController.getUsageStatistics(req, res);
            return result;
        } catch (error) {
            console.error('Error in usage statistics route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/equipment/bulk/update
 * @desc    Bulk update equipment
 * @access  Private (Admin, Inventory Manager)
 */
router.post('/bulk/update',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    async (req, res) => {
        try {
            const result = await equipmentController.bulkUpdateEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in bulk update equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/equipment/import
 * @desc    Import equipment from file
 * @access  Private (Admin, Inventory Manager)
 */
router.post('/import',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    upload.single('file'),
    async (req, res) => {
        try {
            const result = await equipmentController.importEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in import equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/export
 * @desc    Export equipment data
 * @access  Private (Admin, Inventory Manager)
 */
router.get('/export',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    async (req, res) => {
        try {
            const result = await equipmentController.exportEquipment(req, res);
            return result;
        } catch (error) {
            console.error('Error in export equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/qr/:qrCode
 * @desc    Get equipment by QR code
 * @access  Private (All authenticated users)
 */
router.get('/qr/:qrCode',
    authenticate,
    async (req, res) => {
        try {
            const result = await equipmentController.getEquipmentByQR(req, res);
            return result;
        } catch (error) {
            console.error('Error in get equipment by QR route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/barcode/:barcode
 * @desc    Get equipment by barcode
 * @access  Private (All authenticated users)
 */
router.get('/barcode/:barcode',
    authenticate,
    async (req, res) => {
        try {
            const result = await equipmentController.getEquipmentByBarcode(req, res);
            return result;
        } catch (error) {
            console.error('Error in get equipment by barcode route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Equipment Usage Logs Routes
/**
 * @route   POST /api/equipment/:id/usage/log
 * @desc    Create usage log entry
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.post('/:id/usage/log',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const usageData = {
                ...req.body,
                equipmentId: parseInt(id),
                userId: req.user.id
            };

            const result = await equipmentController.usageLog.create(usageData);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'USAGE_LOG_CREATE',
                    resource: 'EQUIPMENT_USAGE',
                    resourceId: result.data.id,
                    details: `Created usage log for equipment ID: ${id}`,
                    ipAddress: req.ip
                });

                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in create usage log route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/:id/usage/logs
 * @desc    Get equipment usage logs
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.get('/:id/usage/logs',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const filters = {
                ...req.query,
                equipmentId: id
            };

            const result = await equipmentController.usageLog.getAll(filters);

            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in get usage logs route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/equipment/:id/usage/return
 * @desc    Return equipment
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.post('/:id/usage/return',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const returnData = req.body;

            // Find active usage log for this equipment
            const activeLogs = await equipmentController.usageLog.getActiveCheckouts({
                equipmentId: id
            });

            if (!activeLogs.success || activeLogs.data.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No active usage found',
                    message: 'No active usage found for this equipment'
                });
            }

            // Return the most recent active log
            const activeLog = activeLogs.data[0];
            const result = await equipmentController.usageLog.returnEquipment(activeLog.id, returnData);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'EQUIPMENT_RETURN',
                    resource: 'EQUIPMENT_USAGE',
                    resourceId: activeLog.id,
                    details: `Returned equipment ID: ${id}`,
                    ipAddress: req.ip
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in return equipment route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Equipment Reservations Routes
/**
 * @route   POST /api/equipment/:id/reservations
 * @desc    Create equipment reservation
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.post('/:id/reservations',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const reservationData = {
                ...req.body,
                equipmentId: parseInt(id),
                userId: req.user.id
            };

            const result = await equipmentController.reservation.create(reservationData);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'RESERVATION_CREATE',
                    resource: 'EQUIPMENT_RESERVATION',
                    resourceId: result.data.id,
                    details: `Created reservation for equipment ID: ${id}`,
                    ipAddress: req.ip
                });

                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in create reservation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/:id/reservations
 * @desc    Get equipment reservations
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.get('/:id/reservations',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const filters = {
                ...req.query,
                equipmentId: id
            };

            const result = await equipmentController.reservation.getAll(filters);

            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in get reservations route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/:id/availability
 * @desc    Get equipment availability
 * @access  Private (All authenticated users)
 */
router.get('/:id/availability',
    authenticate,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { startDate, endDate } = req.query;

            const result = await equipmentController.reservation.getEquipmentAvailability(
                id,
                startDate || new Date(),
                endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
            );

            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in get availability route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/equipment/reservations/:id/approve
 * @desc    Approve equipment reservation
 * @access  Private (Admin, Inventory Manager)
 */
router.post('/reservations/:id/approve',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { notes } = req.body;

            const result = await equipmentController.reservation.approve(id, req.user.id, notes);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'RESERVATION_APPROVE',
                    resource: 'EQUIPMENT_RESERVATION',
                    resourceId: parseInt(id),
                    details: `Approved reservation ID: ${id}`,
                    ipAddress: req.ip
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in approve reservation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/equipment/reservations/:id/reject
 * @desc    Reject equipment reservation
 * @access  Private (Admin, Inventory Manager)
 */
router.post('/reservations/:id/reject',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            if (!reason) {
                return res.status(400).json({
                    success: false,
                    error: 'Rejection reason is required',
                    message: 'Please provide a reason for rejection'
                });
            }

            const result = await equipmentController.reservation.reject(id, req.user.id, reason);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'RESERVATION_REJECT',
                    resource: 'EQUIPMENT_RESERVATION',
                    resourceId: parseInt(id),
                    details: `Rejected reservation ID: ${id}, Reason: ${reason}`,
                    ipAddress: req.ip
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in reject reservation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/equipment/reservations/:id/cancel
 * @desc    Cancel equipment reservation
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.post('/reservations/:id/cancel',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;

            const result = await equipmentController.reservation.cancel(id, req.user.id, reason);

            if (result.success) {
                // Create audit log
                await createAuditLog({
                    userId: req.user.id,
                    action: 'RESERVATION_CANCEL',
                    resource: 'EQUIPMENT_RESERVATION',
                    resourceId: parseInt(id),
                    details: `Cancelled reservation ID: ${id}`,
                    ipAddress: req.ip
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in cancel reservation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Dashboard and Monitoring Routes
/**
 * @route   GET /api/equipment/dashboard/summary
 * @desc    Get equipment dashboard summary
 * @access  Private (Admin, Inventory Manager)
 */
router.get('/dashboard/summary',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    async (req, res) => {
        try {
            // Check cache first
            const cacheKey = `equipment_dashboard_summary_${req.user.schoolId}`;
            const cachedData = await getCachedData(cacheKey);
            if (cachedData) {
                return res.json(cachedData);
            }

            // Get analytics data
            const analyticsResult = await equipmentController.getEquipmentAnalytics(req, res);
            
            // Get active checkouts
            const activeCheckouts = await equipmentController.usageLog.getActiveCheckouts();
            
            // Get pending reservations
            const pendingReservations = await equipmentController.reservation.getPendingApprovals();
            
            // Get upcoming maintenance
            const maintenanceSchedule = await equipmentController.getMaintenanceSchedule(req, res);

            const dashboardData = {
                success: true,
                data: {
                    analytics: analyticsResult.success ? analyticsResult.data : {},
                    activeCheckouts: activeCheckouts.success ? activeCheckouts.data : [],
                    pendingReservations: pendingReservations.success ? pendingReservations.data : [],
                    maintenanceSchedule: maintenanceSchedule.success ? maintenanceSchedule.data : []
                },
                message: 'Dashboard summary retrieved successfully'
            };

            // Cache the result
            await cacheData(cacheKey, dashboardData, 300); // 5 minutes cache

            return res.json(dashboardData);
        } catch (error) {
            console.error('Error in dashboard summary route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/overdue/list
 * @desc    Get overdue equipment checkouts
 * @access  Private (Admin, Inventory Manager)
 */
router.get('/overdue/list',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER']),
    async (req, res) => {
        try {
            const result = await equipmentController.usageLog.getOverdueCheckouts();

            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in overdue checkouts route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/equipment/upcoming/reservations
 * @desc    Get upcoming equipment reservations
 * @access  Private (Admin, Inventory Manager, Teacher)
 */
router.get('/upcoming/reservations',
    authenticate,
    authorize(['ADMIN', 'INVENTORY_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const { days = 7 } = req.query;
            const result = await equipmentController.reservation.getUpcomingReservations(null, parseInt(days));

            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error in upcoming reservations route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

export default router;

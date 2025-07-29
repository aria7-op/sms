import express from 'express';
const router = express.Router();
import * as purchaseOrderController from '../controllers/purchaseOrderController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { validatePurchaseOrder, validateUpdatePurchaseOrder, validateStatusUpdate } from '../validators/purchaseOrderValidator.js';

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Create a new purchase order
// POST /api/purchase-orders
router.post('/', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER']),
  async (req, res, next) => {
    try {
      const { error } = validatePurchaseOrder(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  purchaseOrderController.createPurchaseOrder
);

// Get all purchase orders with filtering and pagination
// GET /api/purchase-orders
router.get('/', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER', 'VIEWER']),
  purchaseOrderController.getPurchaseOrders
);

// Get purchase order by ID
// GET /api/purchase-orders/:id
router.get('/:id', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER', 'VIEWER']),
  purchaseOrderController.getPurchaseOrderById
);

// Update purchase order
// PUT /api/purchase-orders/:id
router.put('/:id', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER']),
  async (req, res, next) => {
    try {
      const { error } = validateUpdatePurchaseOrder(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  purchaseOrderController.updatePurchaseOrder
);

// Update purchase order status
// PATCH /api/purchase-orders/:id/status
router.patch('/:id/status', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER']),
  async (req, res, next) => {
    try {
      const { error } = validateStatusUpdate(req.body);
      if (error) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.details.map(detail => detail.message)
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  purchaseOrderController.updatePurchaseOrderStatus
);

// Delete purchase order
// DELETE /api/purchase-orders/:id
router.delete('/:id', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER']),
  purchaseOrderController.deletePurchaseOrder
);

// Get purchase order dashboard stats
// GET /api/purchase-orders/dashboard/stats
router.get('/dashboard/stats', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER', 'VIEWER']),
  purchaseOrderController.getPurchaseOrderStats
);

// Get overdue purchase orders
// GET /api/purchase-orders/overdue/list
router.get('/overdue/list', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER', 'VIEWER']),
  purchaseOrderController.getOverduePurchaseOrders
);

// Get purchase orders by status
// GET /api/purchase-orders/status/:status
router.get('/status/:status', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER', 'VIEWER']),
  async (req, res) => {
    try {
      const { status } = req.params;
      const { page = 1, limit = 10 } = req.query;
      
      const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED'];
      if (!validStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: DRAFT, PENDING, APPROVED, ORDERED, RECEIVED, CANCELLED'
        });
      }
      
      req.query.status = status.toUpperCase();
      return purchaseOrderController.getPurchaseOrders(req, res);
    } catch (error) {
      console.error('Error fetching purchase orders by status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch purchase orders by status',
        error: error.message
      });
    }
  }
);

// Get purchase orders by supplier
// GET /api/purchase-orders/supplier/:supplierId
router.get('/supplier/:supplierId', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER', 'VIEWER']),
  async (req, res) => {
    try {
      const { supplierId } = req.params;
      
      if (!supplierId || isNaN(supplierId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid supplier ID is required'
        });
      }
      
      req.query.supplierId = supplierId;
      return purchaseOrderController.getPurchaseOrders(req, res);
    } catch (error) {
      console.error('Error fetching purchase orders by supplier:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch purchase orders by supplier',
        error: error.message
      });
    }
  }
);

// Get purchase orders within date range
// GET /api/purchase-orders/date-range
router.get('/date-range', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER', 'VIEWER']),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Both startDate and endDate are required'
        });
      }
      
      // Validate date format
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use ISO format (YYYY-MM-DD)'
        });
      }
      
      if (start > end) {
        return res.status(400).json({
          success: false,
          message: 'Start date cannot be after end date'
        });
      }
      
      return purchaseOrderController.getPurchaseOrders(req, res);
    } catch (error) {
      console.error('Error fetching purchase orders by date range:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch purchase orders by date range',
        error: error.message
      });
    }
  }
);

// Bulk operations
// POST /api/purchase-orders/bulk/update-status
router.post('/bulk/update-status', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER']),
  async (req, res) => {
    try {
      const { purchaseOrderIds, status } = req.body;
      
      if (!purchaseOrderIds || !Array.isArray(purchaseOrderIds) || purchaseOrderIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Purchase order IDs array is required'
        });
      }
      
      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }
      
      const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'ORDERED', 'RECEIVED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }
      
      // Update all purchase orders
      const results = [];
      for (const id of purchaseOrderIds) {
        try {
          req.params = { id };
          req.body = { status };
          await purchaseOrderController.updatePurchaseOrderStatus(req, {
            json: (data) => results.push({ id, success: true, data }),
            status: (code) => results.push({ id, success: false, statusCode: code })
          });
        } catch (error) {
          results.push({ id, success: false, error: error.message });
        }
      }
      
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      
      res.json({
        success: true,
        message: `Bulk status update completed. ${successful.length} successful, ${failed.length} failed`,
        data: {
          successful,
          failed
        }
      });
    } catch (error) {
      console.error('Error in bulk status update:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk status update',
        error: error.message
      });
    }
  }
);

// Export purchase orders
// GET /api/purchase-orders/export
router.get('/export', 
  authorizeRoles(['ADMIN', 'INVENTORY_MANAGER', 'PURCHASE_MANAGER']),
  async (req, res) => {
    try {
      const { format = 'json', startDate, endDate, status } = req.query;
      
      if (!['json', 'csv'].includes(format)) {
        return res.status(400).json({
          success: false,
          message: 'Format must be either json or csv'
        });
      }
      
      // Set a higher limit for export
      req.query.limit = 1000;
      if (startDate) req.query.startDate = startDate;
      if (endDate) req.query.endDate = endDate;
      if (status) req.query.status = status;
      
      const result = await purchaseOrderController.getPurchaseOrders(req, res);
      
      if (format === 'csv') {
        // Convert to CSV format
        const csvData = result.data.purchaseOrders.map(po => ({
          'PO Number': po.poNumber,
          'Supplier': po.supplier?.name || '',
          'Order Date': po.orderDate,
          'Expected Delivery': po.expectedDeliveryDate,
          'Status': po.status,
          'Subtotal': po.subtotal,
          'Tax Amount': po.taxAmount,
          'Discount Amount': po.discountAmount,
          'Total Amount': po.totalAmount,
          'Currency': po.currency,
          'Notes': po.notes || ''
        }));
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=purchase-orders.csv');
        
        // Convert to CSV string
        const csvString = [
          Object.keys(csvData[0]).join(','),
          ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
        ].join('\n');
        
        return res.send(csvString);
      }
      
      return result;
    } catch (error) {
      console.error('Error exporting purchase orders:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export purchase orders',
        error: error.message
      });
    }
  }
);

export default router;

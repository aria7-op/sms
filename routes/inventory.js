import express from 'express';
const router = express.Router();
import inventoryController from '../controllers/inventoryController.js';
import {authenticateToken, authorizeRoles} from '../middleware/auth.js';

import inventoryUtils from '../utils/inventoryUtils.js';

// Category routes
router.post('/categories', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.createCategory);
router.get('/categories', authenticateToken, inventoryController.getCategories);

// Item routes
router.post('/items', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.createItem);
router.get('/items', authenticateToken, inventoryController.getItems);
router.get('/items/:id', authenticateToken, inventoryController.getItemById);
router.put('/items/:id', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.updateItem);
router.delete('/items/:id', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.deleteItem);

// Transaction routes
router.post('/transactions', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.createTransaction);

// Supplier routes
router.post('/suppliers', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.createSupplier);
router.get('/suppliers', authenticateToken, inventoryController.getSuppliers);

// Purchase order routes
router.post('/purchase-orders', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.createPurchaseOrder);
router.get('/purchase-orders', authenticateToken, inventoryController.getPurchaseOrders);
router.patch('/purchase-orders/:id/approve', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.approvePurchaseOrder);

// Search and discovery
router.get('/search', authenticateToken, inventoryController.searchItems);

// Analytics and reporting
router.get('/analytics/summary', authenticateToken, inventoryController.getInventoryAnalytics);
router.get('/report/generate', authenticateToken, authorizeRoles(['INVENTORY_MANAGER', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), inventoryController.generateInventoryReport);

export default router; 
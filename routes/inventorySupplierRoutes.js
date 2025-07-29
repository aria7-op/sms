import express from 'express';
import authMiddleware from '../middleware/auth.js';
import roleMiddleware from '../middleware/auth.js';
import validationMiddleware from '../middleware/validation.js';
import rateLimiter from '../middleware/rateLimiter.js';
import cacheMiddleware from '../middleware/auth.js';
import { supplierValidationSchemas } from '../utils/validation/supplierValidation.js';
function createInventorySupplierRoutes(supplierController) {
  const router = express.Router();

  // Apply authentication middleware to all routes
  router.use(authMiddleware);

  // Apply role-based access control
  const allowedRoles = ['SCHOOL_ADMIN', 'STAFF', 'ACCOUNTANT'];

  // Create supplier
  router.post(
    '/',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.createSupplier),
    rateLimiter.createLimit('create_supplier', 10, 60), // 10 requests per minute
    supplierController.createSupplier
  );

  // Get all suppliers with filtering and pagination
  router.get(
    '/',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('suppliers_list', 300), // 5 minutes cache
    supplierController.getSuppliers
  );

  // Get supplier by ID
  router.get(
    '/:id',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSupplierById),
    cacheMiddleware.createCache('supplier_detail', 600), // 10 minutes cache
    supplierController.getSupplierById
  );

  // Update supplier
  router.put(
    '/:id',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.updateSupplier),
    rateLimiter.createLimit('update_supplier', 20, 60), // 20 requests per minute
    supplierController.updateSupplier
  );

  // Delete supplier (soft delete)
  router.delete(
    '/:id',
    roleMiddleware(['SCHOOL_ADMIN']), // Only school admin can delete
    validationMiddleware(supplierValidationSchemas.deleteSupplier),
    rateLimiter.createLimit('delete_supplier', 5, 60), // 5 requests per minute
    supplierController.deleteSupplier
  );

  // Get supplier analytics and performance metrics
  router.get(
    '/analytics/summary',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('supplier_analytics', 1800), // 30 minutes cache
    supplierController.getSupplierAnalytics
  );

  // Get supplier performance metrics for specific supplier
  router.get(
    '/:id/performance',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSupplierPerformance),
    cacheMiddleware.createCache('supplier_performance', 900), // 15 minutes cache
    supplierController.getSupplierPerformance
  );

  // Bulk operations
  router.post(
    '/bulk/update',
    roleMiddleware(['SCHOOL_ADMIN', 'STAFF']),
    validationMiddleware(supplierValidationSchemas.bulkUpdateSuppliers),
    rateLimiter.createLimit('bulk_update_suppliers', 5, 60), // 5 requests per minute
    supplierController.bulkUpdateSuppliers
  );

  // Import suppliers from file
  router.post(
    '/import',
    roleMiddleware(['SCHOOL_ADMIN', 'STAFF']),
    validationMiddleware(supplierValidationSchemas.importSuppliers),
    rateLimiter.createLimit('import_suppliers', 3, 60), // 3 requests per minute
    supplierController.importSuppliers
  );

  // Export suppliers to file
  router.get(
    '/export',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.exportSuppliers),
    rateLimiter.createLimit('export_suppliers', 10, 60), // 10 requests per minute
    supplierController.exportSuppliers
  );

  // Search suppliers with advanced filtering
  router.get(
    '/search',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.searchSuppliers),
    cacheMiddleware.createCache('supplier_search', 300), // 5 minutes cache
    supplierController.searchSuppliers
  );

  // Get supplier categories
  router.get(
    '/categories',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('supplier_categories', 3600), // 1 hour cache
    supplierController.getSupplierCategories
  );

  // Update supplier status
  router.patch(
    '/:id/status',
    roleMiddleware(['SCHOOL_ADMIN', 'STAFF']),
    validationMiddleware(supplierValidationSchemas.updateSupplierStatus),
    rateLimiter.createLimit('update_supplier_status', 30, 60), // 30 requests per minute
    supplierController.updateSupplierStatus
  );

  // Additional specialized routes

  // Get suppliers by category
  router.get(
    '/category/:categoryId',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSuppliersByCategory),
    cacheMiddleware.createCache('suppliers_by_category', 600), // 10 minutes cache
    supplierController.getSuppliers
  );

  // Get suppliers by status
  router.get(
    '/status/:status',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSuppliersByStatus),
    cacheMiddleware.createCache('suppliers_by_status', 600), // 10 minutes cache
    supplierController.getSuppliers
  );

  // Get suppliers by rating
  router.get(
    '/rating/:rating',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSuppliersByRating),
    cacheMiddleware.createCache('suppliers_by_rating', 600), // 10 minutes cache
    supplierController.getSuppliers
  );

  // Get top performing suppliers
  router.get(
    '/top-performing',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('top_performing_suppliers', 1800), // 30 minutes cache
    supplierController.getSupplierAnalytics
  );

  // Get suppliers with low stock items
  router.get(
    '/low-stock-alerts',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('suppliers_low_stock', 900), // 15 minutes cache
    supplierController.getSuppliers
  );

  // Get suppliers with overdue payments
  router.get(
    '/overdue-payments',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('suppliers_overdue_payments', 900), // 15 minutes cache
    supplierController.getSuppliers
  );

  // Get supplier contact information
  router.get(
    '/:id/contact',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSupplierContact),
    cacheMiddleware.createCache('supplier_contact', 3600), // 1 hour cache
    supplierController.getSupplierById
  );

  // Get supplier purchase history
  router.get(
    '/:id/purchase-history',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSupplierPurchaseHistory),
    cacheMiddleware.createCache('supplier_purchase_history', 1800), // 30 minutes cache
    supplierController.getSupplierPerformance
  );

  // Get supplier items
  router.get(
    '/:id/items',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSupplierItems),
    cacheMiddleware.createCache('supplier_items', 900), // 15 minutes cache
    supplierController.getSupplierById
  );

  // Get supplier purchase orders
  router.get(
    '/:id/purchase-orders',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.getSupplierPurchaseOrders),
    cacheMiddleware.createCache('supplier_purchase_orders', 900), // 15 minutes cache
    supplierController.getSupplierById
  );

  // Dashboard routes
  router.get(
    '/dashboard/summary',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('supplier_dashboard_summary', 900), // 15 minutes cache
    supplierController.getSupplierAnalytics
  );

  router.get(
    '/dashboard/recent-activity',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('supplier_recent_activity', 300), // 5 minutes cache
    supplierController.getSupplierAnalytics
  );

  router.get(
    '/dashboard/alerts',
    roleMiddleware(allowedRoles),
    cacheMiddleware.createCache('supplier_alerts', 300), // 5 minutes cache
    supplierController.getSuppliers
  );

  // Report routes
  router.get(
    '/reports/supplier-performance',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.generateSupplierReport),
    rateLimiter.createLimit('generate_supplier_report', 5, 60), // 5 requests per minute
    supplierController.exportSuppliers
  );

  router.get(
    '/reports/supplier-comparison',
    roleMiddleware(allowedRoles),
    validationMiddleware(supplierValidationSchemas.generateSupplierComparison),
    rateLimiter.createLimit('generate_supplier_comparison', 5, 60), // 5 requests per minute
    supplierController.exportSuppliers
  );

  // API documentation route
  router.get(
    '/docs',
    (req, res) => {
      res.json({
        message: 'Inventory Supplier API Documentation',
        endpoints: {
          'POST /': 'Create a new supplier',
          'GET /': 'Get all suppliers with filtering and pagination',
          'GET /:id': 'Get supplier by ID',
          'PUT /:id': 'Update supplier',
          'DELETE /:id': 'Delete supplier (soft delete)',
          'GET /analytics/summary': 'Get supplier analytics',
          'GET /:id/performance': 'Get supplier performance metrics',
          'POST /bulk/update': 'Bulk update suppliers',
          'POST /import': 'Import suppliers from file',
          'GET /export': 'Export suppliers to file',
          'GET /search': 'Search suppliers',
          'GET /categories': 'Get supplier categories',
          'PATCH /:id/status': 'Update supplier status'
        }
      });
    }
  );

  return router;
}

export default createInventorySupplierRoutes;
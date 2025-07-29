const { ValidationError, NotFoundError, BusinessLogicError } = require('../utils/errors');
const logger = require('../utils/logger');
const rateLimiter = require('../middleware/rateLimiter');
const auditLogger = require('../utils/auditLogger');

class InventorySupplierController {
  constructor(supplierService) {
    this.supplierService = supplierService;
  }

  /**
   * Create a new supplier
   * POST /api/inventory/suppliers
   */
  createSupplier = async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const supplierData = req.body;

      // Rate limiting check
      await rateLimiter.checkLimit(req, 'create_supplier', 10, 60); // 10 requests per minute

      const supplier = await this.supplierService.createSupplier(supplierData, schoolId, userId);

      // Audit logging
      await auditLogger.log({
        action: 'SUPPLIER_CREATED',
        resource: 'InventorySupplier',
        resourceId: supplier.id,
        userId,
        schoolId,
        details: { supplierName: supplier.name, supplierCode: supplier.code }
      });

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: supplier
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all suppliers with filtering and pagination
   * GET /api/inventory/suppliers
   */
  getSuppliers = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        search,
        status,
        rating,
        categoryId,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const filters = {
        page: Number(page),
        limit: Number(limit),
        search: search,
        status: status,
        rating: rating ? Number(rating) : undefined,
        categoryId: categoryId ? Number(categoryId) : undefined,
        sortBy: sortBy,
        sortOrder: sortOrder
      };

      const result = await this.supplierService.getSuppliers(schoolId, filters);

      res.status(200).json({
        success: true,
        message: 'Suppliers retrieved successfully',
        data: result.suppliers,
        pagination: result.pagination,
        total: result.total
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get supplier by ID
   * GET /api/inventory/suppliers/:id
   */
  getSupplierById = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;

      const supplier = await this.supplierService.getSupplierById(Number(id), schoolId);

      res.status(200).json({
        success: true,
        message: 'Supplier retrieved successfully',
        data: supplier
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update supplier
   * PUT /api/inventory/suppliers/:id
   */
  updateSupplier = async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;
      const updateData = req.body;

      // Rate limiting check
      await rateLimiter.checkLimit(req, 'update_supplier', 20, 60); // 20 requests per minute

      const supplier = await this.supplierService.updateSupplier(
        Number(id),
        updateData,
        schoolId,
        userId
      );

      // Audit logging
      await auditLogger.log({
        action: 'SUPPLIER_UPDATED',
        resource: 'InventorySupplier',
        resourceId: supplier.id,
        userId,
        schoolId,
        details: { supplierName: supplier.name, updatedFields: Object.keys(updateData) }
      });

      res.status(200).json({
        success: true,
        message: 'Supplier updated successfully',
        data: supplier
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete supplier (soft delete)
   * DELETE /api/inventory/suppliers/:id
   */
  deleteSupplier = async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;

      // Rate limiting check
      await rateLimiter.checkLimit(req, 'delete_supplier', 5, 60); // 5 requests per minute

      await this.supplierService.deleteSupplier(Number(id), schoolId, userId);

      // Audit logging
      await auditLogger.log({
        action: 'SUPPLIER_DELETED',
        resource: 'InventorySupplier',
        resourceId: Number(id),
        userId,
        schoolId,
        details: { supplierId: id }
      });

      res.status(200).json({
        success: true,
        message: 'Supplier deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get supplier analytics and performance metrics
   * GET /api/inventory/suppliers/analytics/summary
   */
  getSupplierAnalytics = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate, supplierId } = req.query;

      const filters = {
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate: endDate ? new Date(endDate) : new Date(),
        supplierId: supplierId ? Number(supplierId) : undefined
      };

      const analytics = await this.supplierService.getSupplierAnalytics(schoolId, filters);

      res.status(200).json({
        success: true,
        message: 'Supplier analytics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Bulk update suppliers
   * POST /api/inventory/suppliers/bulk/update
   */
  bulkUpdateSuppliers = async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const { supplierIds, updates } = req.body;

      if (!Array.isArray(supplierIds) || supplierIds.length === 0) {
        throw new ValidationError('Supplier IDs array is required');
      }

      if (!updates || typeof updates !== 'object') {
        throw new ValidationError('Updates object is required');
      }

      // Rate limiting check
      await rateLimiter.checkLimit(req, 'bulk_update_suppliers', 5, 60); // 5 requests per minute

      const result = await this.supplierService.bulkUpdateSuppliers(supplierIds, updates, schoolId, userId);

      // Audit logging
      await auditLogger.log({
        action: 'SUPPLIERS_BULK_UPDATED',
        resource: 'InventorySupplier',
        userId,
        schoolId,
        details: { 
          supplierIds, 
          updatedFields: Object.keys(updates),
          updated: result.updated,
          failed: result.failed
        }
      });

      res.status(200).json({
        success: true,
        message: 'Bulk update completed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Import suppliers from file
   * POST /api/inventory/suppliers/import
   */
  importSuppliers = async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const { suppliers } = req.body;

      if (!Array.isArray(suppliers) || suppliers.length === 0) {
        throw new ValidationError('Suppliers array is required');
      }

      // Rate limiting check
      await rateLimiter.checkLimit(req, 'import_suppliers', 3, 60); // 3 requests per minute

      const result = await this.supplierService.importSuppliers(suppliers, schoolId, userId);

      // Audit logging
      await auditLogger.log({
        action: 'SUPPLIERS_IMPORTED',
        resource: 'InventorySupplier',
        userId,
        schoolId,
        details: { 
          imported: result.imported,
          failed: result.failed,
          total: suppliers.length
        }
      });

      res.status(200).json({
        success: true,
        message: 'Suppliers import completed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Export suppliers to file
   * GET /api/inventory/suppliers/export
   */
  exportSuppliers = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { format = 'csv', ...filters } = req.query;

      if (!['csv', 'excel', 'json'].includes(format)) {
        throw new ValidationError('Invalid export format. Supported formats: csv, excel, json');
      }

      // Rate limiting check
      await rateLimiter.checkLimit(req, 'export_suppliers', 10, 60); // 10 requests per minute

      const data = await this.supplierService.exportSuppliers(schoolId, format, filters);

      // Set appropriate headers for file download
      const filename = `suppliers_export_${new Date().toISOString().split('T')[0]}.${format}`;
      
      res.setHeader('Content-Type', this.getContentType(format));
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      res.status(200).send(data);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get supplier performance metrics
   * GET /api/inventory/suppliers/:id/performance
   */
  getSupplierPerformance = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const { startDate, endDate } = req.query;

      const filters = {
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        endDate: endDate ? new Date(endDate) : new Date(),
        supplierId: Number(id)
      };

      const analytics = await this.supplierService.getSupplierAnalytics(schoolId, filters);

      res.status(200).json({
        success: true,
        message: 'Supplier performance metrics retrieved successfully',
        data: analytics
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Search suppliers with advanced filtering
   * GET /api/inventory/suppliers/search
   */
  searchSuppliers = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { q, categoryId, status, rating, limit = 20 } = req.query;

      if (!q || typeof q !== 'string') {
        throw new ValidationError('Search query is required');
      }

      const filters = {
        search: q,
        categoryId: categoryId ? Number(categoryId) : undefined,
        status: status,
        rating: rating ? Number(rating) : undefined,
        limit: Number(limit)
      };

      const result = await this.supplierService.getSuppliers(schoolId, filters);

      res.status(200).json({
        success: true,
        message: 'Supplier search completed',
        data: result.suppliers,
        total: result.total
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get supplier categories
   * GET /api/inventory/suppliers/categories
   */
  getSupplierCategories = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { supplierId } = req.query;

      // This would typically call a method in the service to get categories
      // For now, we'll return a placeholder response
      res.status(200).json({
        success: true,
        message: 'Supplier categories retrieved successfully',
        data: []
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update supplier status
   * PATCH /api/inventory/suppliers/:id/status
   */
  updateSupplierStatus = async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const { id } = req.params;
      const { status } = req.body;

      if (!status) {
        throw new ValidationError('Status is required');
      }

      const supplier = await this.supplierService.updateSupplier(
        Number(id),
        { status },
        schoolId,
        userId
      );

      // Audit logging
      await auditLogger.log({
        action: 'SUPPLIER_STATUS_UPDATED',
        resource: 'InventorySupplier',
        resourceId: supplier.id,
        userId,
        schoolId,
        details: { 
          supplierName: supplier.name,
          oldStatus: supplier.status,
          newStatus: status
        }
      });

      res.status(200).json({
        success: true,
        message: 'Supplier status updated successfully',
        data: supplier
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Helper method to get content type for file downloads
   */
  getContentType(format) {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'json':
        return 'application/json';
      default:
        return 'text/plain';
    }
  }
}

module.exports = InventorySupplierController; 
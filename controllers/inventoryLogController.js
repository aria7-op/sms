const logger = require('../utils/logger');
const rateLimiter = require('../middleware/rateLimiter');
const auditLogger = require('../utils/auditLogger');

class InventoryLogController {
  constructor(logService) {
    this.logService = logService;
  }

  // Create a new inventory log
  createLog = async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const logData = req.body;
      await rateLimiter.checkLimit(req, 'create_inventory_log', 20, 60);
      const log = await this.logService.createInventoryLog(logData, schoolId, userId);
      await auditLogger.log({
        action: 'INVENTORY_LOG_CREATED',
        resource: 'InventoryLog',
        resourceId: log.id,
        userId,
        schoolId,
        details: { type: log.type, itemId: log.itemId }
      });
      res.status(201).json({ success: true, message: 'Inventory log created', data: log });
    } catch (error) { next(error); }
  };

  // Get logs with filtering/pagination
  getLogs = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const filters = { ...req.query };
      const result = await this.logService.getInventoryLogs(schoolId, filters);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  };

  // Get log by ID
  getLogById = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { id } = req.params;
      const log = await this.logService.getInventoryLogById(Number(id), schoolId);
      res.status(200).json({ success: true, data: log });
    } catch (error) { next(error); }
  };

  // Get logs by item
  getLogsByItem = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const { itemId } = req.params;
      const filters = { ...req.query };
      const result = await this.logService.getInventoryLogsByItem(Number(itemId), schoolId, filters);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  };

  // Analytics summary
  getAnalytics = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const filters = { ...req.query };
      const analytics = await this.logService.getInventoryAnalytics(schoolId, filters);
      res.status(200).json({ success: true, data: analytics });
    } catch (error) { next(error); }
  };

  // Transaction history (export)
  getTransactionHistory = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const filters = { ...req.query };
      const data = await this.logService.getTransactionHistory(schoolId, filters);
      if (filters.format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_logs.csv"');
        return res.status(200).send(data);
      }
      if (filters.format === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="inventory_logs.xlsx"');
        return res.status(200).send(data);
      }
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };

  // Bulk import logs
  bulkImport = async (req, res, next) => {
    try {
      const { schoolId, userId } = req.user;
      const { logs } = req.body;
      await rateLimiter.checkLimit(req, 'bulk_import_inventory_logs', 5, 60);
      const result = await this.logService.bulkImportInventoryLogs(logs, schoolId, userId);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  };

  // Low stock alerts
  getLowStockAlerts = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const alerts = await this.logService.getLowStockAlerts(schoolId);
      res.status(200).json({ success: true, data: alerts });
    } catch (error) { next(error); }
  };

  // Movement summary
  getMovementSummary = async (req, res, next) => {
    try {
      const { schoolId } = req.user;
      const filters = { ...req.query };
      const summary = await this.logService.getInventoryMovementSummary(schoolId, filters);
      res.status(200).json({ success: true, data: summary });
    } catch (error) { next(error); }
  };
}

module.exports = InventoryLogController; 
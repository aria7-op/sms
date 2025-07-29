// utils/auditLogger.js
import AuditLog from '../models/AuditLog.js';
import logger from '../config/logger.js';

class AuditLogger {
    /**
     * Create an audit log entry
     * @param {Object} params - Audit log parameters
     * @param {number} params.userId - ID of the user performing the action
     * @param {number} params.schoolId - ID of the school/tenant
     * @param {string} params.action - Action performed (CREATE, UPDATE, DELETE, etc.)
     * @param {string} params.resource - Resource type being acted upon
     * @param {number|null} params.resourceId - ID of the resource being acted upon
     * @param {string} params.details - Detailed description of the action
     * @param {string} params.ipAddress - IP address of the requester
     * @param {Object|null} params.metadata - Additional metadata about the action
     * @returns {Promise<Object>} - Result of the audit log creation
     */
    static async createAuditLog({
        userId,
        schoolId,
        action,
        resource,
        resourceId = null,
        details = '',
        ipAddress = '',
        metadata = null
    }) {
        try {
            // Validate required parameters
            if (!userId || !schoolId || !action || !resource) {
                throw new Error('Missing required audit log parameters');
            }

            // Standardize action to uppercase
            action = action.toUpperCase();

            // Create the audit log entry
            const auditLog = new AuditLog();
            const result = await auditLog.create({
                userId: parseInt(userId),
                schoolId: parseInt(schoolId),
                action,
                resource,
                resourceId: resourceId ? parseInt(resourceId) : null,
                details,
                ipAddress,
                metadata: metadata ? JSON.stringify(metadata) : null,
                createdAt: new Date()
            });

            logger.info(`Audit log created for ${resource} ${action} action by user ${userId}`);

            return {
                success: true,
                data: result.data
            };
        } catch (error) {
            logger.error(`Failed to create audit log: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Get audit logs with filtering
     * @param {Object} filters - Filter criteria
     * @param {number} [filters.userId] - Filter by user ID
     * @param {number} [filters.schoolId] - Filter by school ID
     * @param {string} [filters.resource] - Filter by resource type
     * @param {number} [filters.resourceId] - Filter by resource ID
     * @param {string} [filters.action] - Filter by action type
     * @param {string} [filters.startDate] - Start date for date range
     * @param {string} [filters.endDate] - End date for date range
     * @param {number} [filters.limit] - Number of records to return
     * @param {number} [filters.offset] - Offset for pagination
     * @returns {Promise<Object>} - Filtered audit logs with pagination info
     */
    static async getAuditLogs(filters = {}) {
        try {
            const auditLog = new AuditLog();
            const result = await auditLog.getAll(filters);

            return {
                success: true,
                data: result.data,
                pagination: result.pagination
            };
        } catch (error) {
            logger.error(`Failed to get audit logs: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Get audit log by ID
     * @param {number} id - Audit log ID
     * @param {number} schoolId - School ID for authorization
     * @returns {Promise<Object>} - Audit log details
     */
    static async getAuditLogById(id, schoolId) {
        try {
            const auditLog = new AuditLog();
            const result = await auditLog.getById(parseInt(id), parseInt(schoolId));

            if (!result.data) {
                throw new Error('Audit log not found or access denied');
            }

            return {
                success: true,
                data: result.data
            };
        } catch (error) {
            logger.error(`Failed to get audit log by ID: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Search audit logs
     * @param {string} searchTerm - Search term
     * @param {Object} filters - Additional filters
     * @returns {Promise<Object>} - Search results with pagination info
     */
    static async searchAuditLogs(searchTerm, filters = {}) {
        try {
            const auditLog = new AuditLog();
            const result = await auditLog.search(searchTerm, filters);

            return {
                success: true,
                data: result.data,
                pagination: result.pagination
            };
        } catch (error) {
            logger.error(`Failed to search audit logs: ${error.message}`);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

// Export as both named and default exports for maximum compatibility
export const createAuditLog = AuditLogger.createAuditLog;
export const getAuditLogs = AuditLogger.getAuditLogs;
export const getAuditLogById = AuditLogger.getAuditLogById;
export const searchAuditLogs = AuditLogger.searchAuditLogs;

export default AuditLogger;
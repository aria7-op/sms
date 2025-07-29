import Event from '../models/Event.js';
import { 
  validateEvent, 
  validateEventFilters, 
  validateEventSearch, 
  validateDateRange 
} from '../validators/eventValidator.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';

class EventController {
    constructor() {
        this.eventModel = new Event();
    }

    /**
     * Create new event
     */
    async createEvent(req, res) {
        try {
            const { schoolId } = req.user;
            const eventData = {
                ...req.body,
                schoolId,
                createdBy: req.user.id,
                updatedBy: req.user.id
            };

            const result = await this.eventModel.create(eventData);

            // Create audit log
            await createAuditLog({
                action: 'CREATE',
                entityType: 'EVENT',
                entityId: result.data.id,
                newData: result.data,
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(201).json({
                success: true,
                message: 'Event created successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in createEvent: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get event by ID
     */
    async getEventById(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.eventModel.getById(id, schoolId);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getEventById: ${error.message}`);
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get all events with filtering and pagination
     */
    async getAllEvents(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = {
                ...req.query,
                schoolId
            };

            // Validate filters
            const filterValidation = validateEventFilters(filters);
            if (!filterValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Filter validation failed: ${filterValidation.errors.join(', ')}`
                });
            }

            const result = await this.eventModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getAllEvents: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving events'
            });
        }
    }

    /**
     * Get published events for current user
     */
    async getPublishedEvents(req, res) {
        try {
            const { schoolId, role } = req.user;
            const { classId } = req.query;

            const result = await this.eventModel.getPublishedEvents(schoolId, role, classId);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getPublishedEvents: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving published events'
            });
        }
    }

    /**
     * Update event
     */
    async updateEvent(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;
            const updateData = {
                ...req.body,
                updatedBy: req.user.id
            };

            const result = await this.eventModel.update(id, updateData, schoolId);

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entityType: 'EVENT',
                entityId: parseInt(id),
                newData: result.data,
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: 'Event updated successfully',
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in updateEvent: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Update event publication status
     */
    async updateEventPublicationStatus(req, res) {
        try {
            const { id } = req.params;
            const { isPublished } = req.body;
            const { schoolId } = req.user;

            const result = await this.eventModel.updatePublicationStatus(
                id, 
                isPublished, 
                schoolId, 
                req.user.id
            );

            // Create audit log
            await createAuditLog({
                action: 'UPDATE_STATUS',
                entityType: 'EVENT',
                entityId: parseInt(id),
                newData: { isPublished },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: `Event ${isPublished ? 'published' : 'unpublished'} successfully`,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in updateEventPublicationStatus: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Delete event
     */
    async deleteEvent(req, res) {
        try {
            const { id } = req.params;
            const { schoolId } = req.user;

            const result = await this.eventModel.delete(id, schoolId, req.user.id);

            // Create audit log
            await createAuditLog({
                action: 'DELETE',
                entityType: 'EVENT',
                entityId: parseInt(id),
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: result.message
            });

        } catch (error) {
            logger.error(`Error in deleteEvent: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Bulk update event publication status
     */
    async bulkUpdatePublicationStatus(req, res) {
        try {
            const { eventIds, isPublished } = req.body;
            const { schoolId } = req.user;

            if (!Array.isArray(eventIds) || eventIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Event IDs array is required'
                });
            }

            const result = await this.eventModel.bulkUpdatePublicationStatus(
                eventIds,
                isPublished,
                schoolId,
                req.user.id
            );

            // Create audit log for bulk operation
            await createAuditLog({
                action: 'BULK_UPDATE_STATUS',
                entityType: 'EVENT',
                entityId: null,
                newData: { eventIds, isPublished, count: result.count },
                userId: req.user.id,
                schoolId,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.status(200).json({
                success: true,
                message: result.message,
                count: result.count
            });

        } catch (error) {
            logger.error(`Error in bulkUpdatePublicationStatus: ${error.message}`);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Get event statistics
     */
    async getEventStatistics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.eventModel.getStatistics(schoolId, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getEventStatistics: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving event statistics'
            });
        }
    }

    /**
     * Get event analytics
     */
    async getEventAnalytics(req, res) {
        try {
            const { schoolId } = req.user;
            const filters = req.query;

            const result = await this.eventModel.getAnalytics(schoolId, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getEventAnalytics: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving event analytics'
            });
        }
    }

    /**
     * Search events
     */
    async searchEvents(req, res) {
        try {
            const { schoolId } = req.user;
            const { q: searchTerm, ...filters } = req.query;

            // Validate search parameters
            const searchValidation = validateEventSearch(searchTerm, filters);
            if (!searchValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Search validation failed: ${searchValidation.errors.join(', ')}`
                });
            }

            const result = await this.eventModel.searchEvents(schoolId, searchTerm, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in searchEvents: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error searching events'
            });
        }
    }

    /**
     * Get upcoming events
     */
    async getUpcomingEvents(req, res) {
        try {
            const { schoolId } = req.user;
            const { limit = 10 } = req.query;

            const result = await this.eventModel.getUpcomingEvents(schoolId, limit);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getUpcomingEvents: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving upcoming events'
            });
        }
    }

    /**
     * Get ongoing events
     */
    async getOngoingEvents(req, res) {
        try {
            const { schoolId } = req.user;
            const { limit = 10 } = req.query;

            const result = await this.eventModel.getOngoingEvents(schoolId, limit);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getOngoingEvents: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving ongoing events'
            });
        }
    }

    /**
     * Get past events
     */
    async getPastEvents(req, res) {
        try {
            const { schoolId } = req.user;
            const { limit = 10 } = req.query;

            const result = await this.eventModel.getPastEvents(schoolId, limit);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getPastEvents: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving past events'
            });
        }
    }

    /**
     * Get events by date range
     */
    async getEventsByDateRange(req, res) {
        try {
            const { schoolId } = req.user;
            const { startDate, endDate, ...filters } = req.query;

            // Validate date range
            const dateValidation = validateDateRange(startDate, endDate);
            if (!dateValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: `Date validation failed: ${dateValidation.errors.join(', ')}`
                });
            }

            const result = await this.eventModel.getEventsByDateRange(
                schoolId, 
                startDate, 
                endDate, 
                filters
            );

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getEventsByDateRange: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving events by date range'
            });
        }
    }

    /**
     * Get events by target role
     */
    async getEventsByTargetRole(req, res) {
        try {
            const { schoolId } = req.user;
            const { role } = req.params;
            const filters = {
                ...req.query,
                schoolId,
                targetRole: role
            };

            const result = await this.eventModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getEventsByTargetRole: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving events by target role'
            });
        }
    }

    /**
     * Get events by class
     */
    async getEventsByClass(req, res) {
        try {
            const { schoolId } = req.user;
            const { classId } = req.params;
            const filters = {
                ...req.query,
                schoolId,
                classId
            };

            const result = await this.eventModel.getAll(filters);

            res.status(200).json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });

        } catch (error) {
            logger.error(`Error in getEventsByClass: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving events by class'
            });
        }
    }

    /**
     * Get events by location
     */
    async getEventsByLocation(req, res) {
        try {
            const { schoolId } = req.user;
            const { location } = req.params;
            const filters = {
                ...req.query,
                schoolId,
                search: location
            };

            const result = await this.eventModel.searchEvents(schoolId, location, filters);

            res.status(200).json({
                success: true,
                data: result.data
            });

        } catch (error) {
            logger.error(`Error in getEventsByLocation: ${error.message}`);
            res.status(500).json({
                success: false,
                message: 'Error retrieving events by location'
            });
        }
    }
}

export default EventController;
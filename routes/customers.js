import express from 'express';
import * as customerController from '../controllers/customerController.js';
import * as interactionController from
'../controllers/customerInteractionController.js';
import * as ticketController from '../controllers/customerTicketController.js';
import * as analyticsController from
'../controllers/customerAnalyticsController.js';
import * as pipelineController from
'../controllers/customerPipelineController.js';
import * as segmentController from
'../controllers/customerSegmentController.js';
import * as cacheController from '../controllers/customerCacheController.js';
import * as bulkController from '../controllers/customerBulkController.js';
import * as importExportController from
'../controllers/customerImportExportController.js';
import * as searchController from '../controllers/customerSearchController.js';
import * as notificationController from
'../controllers/customerNotificationController.js';
import * as workflowController from
'../controllers/customerWorkflowController.js';
import * as integrationController from
'../controllers/customerIntegrationController.js';
import { authenticateToken } from '../middleware/auth.js';
import { 
  getAllCustomers, 
  getCustomerById, 
  createCustomer, 
  updateCustomer, 
  partialUpdateCustomer, 
  deleteCustomer,
  getCustomerAnalytics,
  getCustomerPerformance,
  getCustomerDashboard,
  getCustomerReports,
  getCustomerComparisons,
  bulkCreateCustomers,
  bulkUpdateCustomers,
  bulkDeleteCustomers,
  clearCache,
  getCacheStats,
  getCustomerSuggestions,
  getCustomerIdSuggestion,
  exportCustomers,
  importCustomers,
  getCustomerAutomations,
  createAutomation,
  getAutomationTemplates,
  getCustomerCollaborations,
  createCollaboration,
  getCollaborationFeed,
  getCustomerDocuments,
  uploadDocument,
  getDocumentAnalytics,

  getAnalyticsDashboard,
  getAnalyticsReports,
  getAnalyticsTrends,
  getForecastingAnalytics,
  exportAnalytics,
  getEngagementAnalytics,
  getLifetimeValueAnalytics,
  convertCustomerToStudent,
  getUnconvertedCustomers,
  getConversionAnalytics,
  getConversionHistory,
  getConversionRates
} from '../controllers/customerController.js';

const router = express.Router();

// Temporarily disable authentication for testing
// router.use(authenticateToken);

// Test route without authentication
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Customers test route working without authentication',
    timestamp: new Date().toISOString()
  });
});

// ======================
// STATIC ROUTES FIRST
// ======================
// IMPORT/EXPORT
router.get('/export', importExportController.exportCustomers);
router.post('/import', importExportController.importCustomers);
router.get('/import/templates', importExportController.getImportTemplates);
router.post('/import/validate', importExportController.validateImport);
router.get('/import/status/:jobId', importExportController.getImportStatus);
router.get('/export/formats', importExportController.getExportFormats);
router.post('/export/schedule', importExportController.scheduleExport);

// CACHE MANAGEMENT
router.get('/cache/stats', cacheController.getCacheStats);
router.post('/cache/clear', cacheController.clearCache);
router.post('/cache/warm', cacheController.warmCache);
router.get('/cache/keys', cacheController.getCacheKeys);
router.delete('/cache/keys/:pattern', cacheController.deleteCacheKeys);
router.post('/cache/optimize', cacheController.optimizeCache);

// SEARCH & FILTERS
router.get('/search/advanced', searchController.advancedSearch);
router.get('/search/suggestions', searchController.getSearchSuggestions);
router.get('/search/autocomplete', searchController.getAutocomplete);
router.post('/search/save', searchController.saveSearch);
router.get('/search/saved', searchController.getSavedSearches);
router.delete('/search/saved/:searchId', searchController.deleteSavedSearch);
router.get('/filters', searchController.getAvailableFilters);
router.post('/filters/custom', searchController.createCustomFilter);

// SEGMENTS
router.get('/segments', segmentController.getSegments);
router.post('/segments', segmentController.createSegment);
router.get('/segments/:segmentId', segmentController.getSegmentById);
router.put('/segments/:segmentId', segmentController.updateSegment);
router.delete('/segments/:segmentId', segmentController.deleteSegment);
router.get('/segments/:segmentId/customers',
segmentController.getCustomersInSegment);
router.post('/segments/:segmentId/customers',
segmentController.addCustomerToSegment);
router.delete('/segments/:segmentId/customers/:customerId',
segmentController.removeCustomerFromSegment);
router.get('/segments/analytics', segmentController.getSegmentAnalytics);
router.post('/segments/auto-segment', segmentController.autoSegmentCustomers);

// PIPELINE
router.get('/pipeline', pipelineController.getPipeline);
router.get('/pipeline/stages', pipelineController.getPipelineStages);
router.get('/pipeline/:stageId', pipelineController.getCustomersByStage);
router.post('/pipeline/:stageId/move', pipelineController.moveCustomerToStage);
router.get('/pipeline/analytics', pipelineController.getPipelineAnalytics);
router.get('/pipeline/forecast', pipelineController.getPipelineForecast);
router.post('/pipeline/stages', pipelineController.createPipelineStage);
router.put('/pipeline/stages/:stageId', pipelineController.updatePipelineStage);
router.delete('/pipeline/stages/:stageId',
pipelineController.deletePipelineStage);

// BULK OPERATIONS
router.post('/bulk/create', bulkController.bulkCreateCustomers);
router.post('/bulk/update', bulkController.bulkUpdateCustomers);
router.post('/bulk/delete', bulkController.bulkDeleteCustomers);
router.post('/bulk/import', bulkController.bulkImportCustomers);
router.post('/bulk/export', bulkController.bulkExportCustomers);
router.post('/bulk/merge', bulkController.bulkMergeCustomers);
router.post('/bulk/duplicate', bulkController.bulkDuplicateCustomers);
router.post('/bulk/assign', bulkController.bulkAssignCustomers);
router.post('/bulk/tag', bulkController.bulkTagCustomers);
router.get('/bulk/status/:jobId', bulkController.getBulkJobStatus);

// ANALYTICS
router.get('/analytics/dashboard', analyticsController.getAnalyticsDashboard);
router.get('/analytics/reports', analyticsController.getAnalyticsReports);
router.get('/analytics/trends', analyticsController.getAnalyticsTrends);
router.get('/analytics/forecasting',
analyticsController.getForecastingAnalytics);
router.post('/analytics/export', analyticsController.exportAnalytics);

// NOTIFICATIONS
router.get('/notifications', notificationController.getNotifications);
router.post('/notifications/mark-read',
notificationController.markNotificationsAsRead);
router.post('/notifications/settings',
notificationController.updateNotificationSettings);
router.get('/notifications/settings',
notificationController.getNotificationSettings);
router.post('/notifications/test', notificationController.testNotification);

// WORKFLOWS
router.get('/workflows', workflowController.getWorkflows);
router.post('/workflows', workflowController.createWorkflow);
router.get('/workflows/:workflowId', workflowController.getWorkflowById);
router.put('/workflows/:workflowId', workflowController.updateWorkflow);
router.delete('/workflows/:workflowId', workflowController.deleteWorkflow);
router.post('/workflows/:workflowId/execute',
workflowController.executeWorkflow);
router.get('/workflows/analytics', workflowController.getWorkflowAnalytics);

// INTEGRATIONS
router.get('/integrations', integrationController.getIntegrations);
router.post('/integrations', integrationController.createIntegration);
router.get('/integrations/:integrationId',
integrationController.getIntegrationById);
router.put('/integrations/:integrationId',
integrationController.updateIntegration);
router.delete('/integrations/:integrationId',
integrationController.deleteIntegration);
router.post('/integrations/:integrationId/sync',
integrationController.syncIntegration);
router.get('/integrations/analytics',
integrationController.getIntegrationAnalytics);

// ANALYTICS (STATIC ROUTES - must come before dynamic routes)
router.get('/unconverted', authenticateToken, getUnconvertedCustomers);
router.get('/conversion-analytics', authenticateToken, getConversionAnalytics);
router.get('/conversion-history', authenticateToken, getConversionHistory);
router.get('/conversion-rates', authenticateToken, getConversionRates);

// ======================
// CORE CUSTOMER CRUD (DYNAMIC ROUTES LAST)
// ======================
router.get('/', customerController.getAllCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);
router.patch('/:id', customerController.partialUpdateCustomer);

// Conversion endpoint
router.post('/:id/convert-to-student', authenticateToken, convertCustomerToStudent);

// CUSTOMER INTERACTIONS
router.get('/:id/interactions', interactionController.getCustomerInteractions);
router.post('/:id/interactions', interactionController.createInteraction);
router.get('/:id/interactions/:interactionId',
interactionController.getInteractionById);
router.put('/:id/interactions/:interactionId',
interactionController.updateInteraction);
router.delete('/:id/interactions/:interactionId',
interactionController.deleteInteraction);
router.get('/interactions/analytics',
interactionController.getInteractionAnalytics);
router.get('/interactions/timeline',
interactionController.getInteractionTimeline);
router.post('/interactions/bulk', interactionController.bulkCreateInteractions);

// CUSTOMER DOCUMENTS
router.get('/:id/documents', customerController.getCustomerDocuments);
router.post('/:id/documents', customerController.uploadDocument);
router.get('/documents/analytics', customerController.getDocumentAnalytics);

// CUSTOMER TICKETS
router.get('/:id/tickets', ticketController.getCustomerTickets);
router.post('/:id/tickets', ticketController.createTicket);
router.get('/:id/tickets/:ticketId', ticketController.getTicketById);
router.put('/:id/tickets/:ticketId', ticketController.updateTicket);
router.delete('/:id/tickets/:ticketId', ticketController.deleteTicket);
router.post('/:id/tickets/:ticketId/assign', ticketController.assignTicket);
router.post('/:id/tickets/:ticketId/resolve', ticketController.resolveTicket);
router.post('/:id/tickets/:ticketId/escalate', ticketController.escalateTicket);
router.get('/tickets/dashboard', ticketController.getTicketDashboard);
router.get('/tickets/analytics', ticketController.getTicketAnalytics);
router.get('/tickets/sla', ticketController.getSLAAnalytics);



// CUSTOMER AUTOMATIONS
router.get('/:id/automations', customerController.getCustomerAutomations);
router.post('/:id/automations', customerController.createAutomation);
router.get('/automations/templates', customerController.getAutomationTemplates);

// CUSTOMER COLLABORATION
router.get('/:id/collaborations', customerController.getCustomerCollaborations);
router.post('/:id/collaborations', customerController.createCollaboration);
router.get('/collaborations/feed', customerController.getCollaborationFeed);

// CUSTOMER ANALYTICS (PER CUSTOMER)
router.get('/:id/analytics', customerController.getCustomerAnalytics);
router.get('/:id/analytics/performance',
customerController.getCustomerPerformance);
router.get('/:id/analytics/engagement',
customerController.getEngagementAnalytics);
router.get('/:id/analytics/conversion',
customerController.getConversionAnalytics);
router.get('/:id/analytics/lifetime-value',
customerController.getLifetimeValueAnalytics);

export default router;

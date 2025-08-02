console.log('customerController.js loaded');

import express from 'express';
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { validateCustomerData } from '../utils/customerUtils.js';
import { upload } from '../middleware/upload.js';
import { authenticateToken } from '../middleware/auth.js';
import { customerService } from '../services/customerService.js';
import { customerUtils } from '../utils/customerUtils.js';
import { validateCustomerFilters } from '../validators/customerValidator.js';
import { 
  createAuditLog, 
  createNotification
} from '../services/notificationService.js';
import { 
  triggerEntityDeletedNotifications,
  triggerEntityCreatedNotifications,
  triggerEntityUpdatedNotifications,
  triggerBulkOperationNotifications
} from '../utils/notificationTriggers.js';
import CustomerEventService from '../services/customerEventService.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import mysql from 'mysql2/promise';

const prisma = new PrismaClient();

// Database connection for fallback queries
let dbPool;

// Initialize database connection for fallback
async function initializeDbPool() {
  if (!dbPool) {
    try {
      const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'mohammad1_ahmadi1',
        password: process.env.DB_PASSWORD || 'mohammad112_',
        database: process.env.DB_NAME || 'mohammad1_school',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        acquireTimeout: 30000,
        connectTimeout: 30000
      };
      
      dbPool = mysql.createPool(dbConfig);
      console.log('Database pool initialized for customer controller fallback');
    } catch (error) {
      console.error('Failed to initialize database pool:', error);
    }
  }
  return dbPool;
}

// Fallback query function
async function fallbackQuery(sql, params = []) {
  const pool = await initializeDbPool();
  if (!pool) {
    throw new Error('Database not connected');
  }
  
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Fallback query failed:', error);
    throw error;
  }
}

// ======================
// BASIC CRUD OPERATIONS
// ======================

// Helper to convert all BigInt fields to strings and Date objects to ISO strings
function convertBigInts(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  } else if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (typeof obj[key] === 'bigint') {
        newObj[key] = obj[key].toString();
      } else if (obj[key] instanceof Date) {
        newObj[key] = obj[key].toISOString();
      } else {
        newObj[key] = convertBigInts(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export const getAllCustomers = async (req, res) => {
  try {
    console.log('=== getAllCustomers START ===');
    console.log('Query params:', req.query);
    
    // Convert BigInt values in user object for logging
    const logUser = JSON.parse(JSON.stringify(req.user, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));
    console.log('User:', logUser);
    
    const { 
      page, 
      limit, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      search,
      status,
      type,
      minValue,
      maxValue,
      dateFrom,
      dateTo,
      tags,
      include
    } = req.query;
    
    // Check if pagination is requested
    const isPaginationRequested = page !== undefined || limit !== undefined;
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    
    const { schoolId } = req.user;
    
    console.log('SchoolId from user:', schoolId);
    console.log('SchoolId type:', typeof schoolId);

    // Validate schoolId
    if (!schoolId) {
      console.error('No schoolId found in user object');
      return res.status(400).json({
        success: false,
        message: 'School ID is required',
        error: 'MISSING_SCHOOL_ID'
      });
    }

    // Build where clause - simple filter without datetime constraints
    const whereClause = { 
      schoolId: BigInt(schoolId)
    };
    
    // Convert BigInt values to strings for logging
    const logWhereClause = JSON.parse(JSON.stringify(whereClause, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));
    console.log('Where clause:', logWhereClause);
    
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    if (type) {
      console.log('Type filter:', type);
      whereClause.type = type;
    }
    
    // Note: Customer model doesn't have a 'status' field in Prisma schema
    // Status filtering is not available for customers
    if (status) {
      console.log('Status filter requested but not available:', status);
      // Remove status from whereClause since it doesn't exist
    }
    
    if (minValue || maxValue) {
      whereClause.totalSpent = {};
      if (minValue) whereClause.totalSpent.gte = parseFloat(minValue);
      if (maxValue) whereClause.totalSpent.lte = parseFloat(maxValue);
    }
    if (dateFrom || dateTo) {
      whereClause.createdAt = {};
      if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom);
      if (dateTo) whereClause.createdAt.lte = new Date(dateTo);
    }

    // Build include clause
    const includeClause = {};
    if (include) {
      const includes = include.split(',');
      if (includes.includes('user')) includeClause.user = true;
      if (includes.includes('school')) includeClause.school = true;
    }

    // Build query options - avoid datetime fields in orderBy
    const queryOptions = {
      where: whereClause,
      include: includeClause
    };
    
    // Only add orderBy if it's not a datetime field
    if (sortBy !== 'createdAt' && sortBy !== 'updatedAt') {
      queryOptions.orderBy = { [sortBy]: sortOrder.toLowerCase() };
    } else {
      // Default to id ordering to avoid datetime issues
      queryOptions.orderBy = { id: 'desc' };
    }
    
    // Only apply pagination if requested
    if (isPaginationRequested) {
      queryOptions.skip = (pageNum - 1) * limitNum;
      queryOptions.take = limitNum;
    }
    
    // Convert BigInt values to strings for JSON serialization
    const logQueryOptions = JSON.parse(JSON.stringify(queryOptions, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));
    console.log('Final query options:', JSON.stringify(logQueryOptions, null, 2));
    
    let customers, total;
    
    try {
      // Try Prisma first
      [customers, total] = await Promise.all([
        prisma.customer.findMany(queryOptions),
        prisma.customer.count({ where: whereClause })
      ]);
    } catch (prismaError) {
      console.error('Prisma error, using raw SQL fallback:', prismaError.message);
      
      // Fallback to raw SQL to avoid datetime issues
      const offset = isPaginationRequested ? (pageNum - 1) * limitNum : 0;
      const limit = isPaginationRequested ? limitNum : 1000;
      
      const sqlQuery = `
        SELECT id, uuid, name, serialNumber, email, phone, gender, source, purpose, 
               department, referredTo, referredById, metadata, ownerId, schoolId, 
               createdBy, updatedBy, userId, totalSpent, orderCount, type, 
               pipelineStageId, rermark, priority
        FROM customers 
        WHERE schoolId = ? AND deletedAt IS NULL
        ORDER BY id DESC
        ${isPaginationRequested ? 'LIMIT ? OFFSET ?' : ''}
      `;
      
      const sqlParams = isPaginationRequested ? [schoolId, limit, offset] : [schoolId];
      
      customers = await fallbackQuery(sqlQuery, sqlParams);
      const countResult = await fallbackQuery(
        'SELECT COUNT(*) as total FROM customers WHERE schoolId = ? AND deletedAt IS NULL',
        [schoolId]
      );
      total = countResult[0].total;
      
      console.log('Raw SQL fallback successful, found customers:', customers.length);
    }
    
    console.log('Query results:', { customersCount: customers.length, total });

    // Patch: Map null uuid to empty string for compatibility
    const patchedCustomers = customers.map(c => ({
      ...c,
      uuid: c.uuid === null ? '' : c.uuid
    }));

    const result = {
      success: true,
      message: status ? 
        'Customers retrieved successfully (status filter ignored - not available in Customer model)' : 
        'Customers retrieved successfully',
      data: convertBigInts(patchedCustomers),
      meta: {
        total,
        filters: {
          search,
          status: status ? 'not_available' : undefined, // Status field doesn't exist in Customer model
          type,
          minValue: minValue ? parseFloat(minValue) : undefined,
          maxValue: maxValue ? parseFloat(maxValue) : undefined,
          dateFrom,
          dateTo,
          tags: tags ? tags.split(',') : undefined
        },
        availableFilters: [
          'search', 'type', 'minValue', 'maxValue', 'dateFrom', 'dateTo', 'tags'
        ],
        unavailableFilters: ['status'] // Status field doesn't exist in Customer model
      }
    };
    
    // Only include pagination info if pagination was requested
    if (isPaginationRequested) {
      result.pagination = {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      };
    }

    logger.info(`Retrieved ${customers.length} customers`);
    res.json(result);
  } catch (error) {
    console.error('=== getAllCustomers ERROR ===');
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage,
      stack: error.stack
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve customers',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      } : undefined
    });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const { include } = req.query;
    const { schoolId } = req.user;

    // Build include clause
    const includeClause = {};
    if (include) {
      const includes = include.split(',');
      if (includes.includes('user')) includeClause.user = true;
      if (includes.includes('school')) includeClause.school = true;
    }

    const customer = await prisma.customer.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      },
      include: includeClause
    });
    
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found' 
      });
    }

    res.json({
      success: true,
      message: 'Customer retrieved successfully',
      data: convertBigInts(customer)
    });
  } catch (error) {
    logger.error('Error getting customer by ID:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve customer',
      error: error.message 
    });
  }
};

export const createCustomer = async (req, res) => {
  console.log('createCustomer controller called');
  try {
    const customerData = req.body;
    const { schoolId, id: createdBy } = req.user;

    // Log the values of schoolId and createdBy
    console.log('schoolId:', schoolId, 'createdBy:', createdBy);

    // Defensive checks for required IDs
    if (!schoolId) {
      console.log('No schoolId found for user:', req.user);
      return res.status(400).json({ success: false, message: 'No schoolId found for user' });
    }
    if (!createdBy) {
      console.log('No user id found for createdBy:', req.user);
      return res.status(400).json({ success: false, message: 'No user id found for createdBy' });
    }

    // Log the data being validated
    console.log('customerData:', customerData);

    // Validate input
    const validation = await validateCustomerData(customerData);
    console.log('validation result:', validation);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Only allow fields that exist in the Prisma Customer model
    const validFields = [
      'name', 'email', 'phone', 'gender', 'source', 'purpose', 'department', 'metadata', 'createdBy', 'updatedBy',
      'serialNumber', 'totalSpent', 'orderCount', 'type', 'referredTo', 'referredById',
      'schoolId', 'ownerId', 'pipelineStageId', 'createdAt', 'updatedAt', 'deletedAt', 'userId'
    ];
    const filteredCustomerData = {};
    for (const key of Object.keys(customerData)) {
      if (validFields.includes(key)) {
        // Handle referredTo field specifically
        if (key === 'referredTo') {
          const validReferralTargets = ['OWNER', 'ADMIN', 'FINANCE', 'ACADEMIC', 'SUPPORT', 'OTHER'];
          if (validReferralTargets.includes(customerData[key])) {
            filteredCustomerData[key] = customerData[key];
          } else {
            // Set to 'OTHER' if invalid value provided
            filteredCustomerData[key] = 'OTHER';
            console.log(`Invalid referredTo value "${customerData[key]}" changed to "OTHER"`);
          }
        } else {
          filteredCustomerData[key] = customerData[key];
        }
      }
    }

    const serialNumber = `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Convert metadata object to JSON string if it's an object (temporary fix until DB column is JSON)
    if (filteredCustomerData.metadata && typeof filteredCustomerData.metadata === 'object') {
      filteredCustomerData.metadata = JSON.stringify(filteredCustomerData.metadata);
    }
    
    // Create the customer first
    const customer = await prisma.customer.create({
      data: {
        ...filteredCustomerData,
        serialNumber,
        schoolId: BigInt(schoolId),
        createdBy: BigInt(createdBy),
        updatedBy: BigInt(createdBy)
      }
    });

    // EVENT-FIRST WORKFLOW: Log event after creating customer
    const customerEventService = new CustomerEventService();
    const event = await customerEventService.createCustomerCreatedEvent(
      customer,
      createdBy,
      schoolId
    );



    // Create audit log
    await createAuditLog({
      action: 'CREATE',
      entity: 'Customer',
      entityId: customer.id.toString(),
      userId: createdBy,
      schoolId: schoolId,
      details: {
        customerId: customer.id.toString(),
        serialNumber: customer.serialNumber,
        customerName: customer.name
      }
    });

    // Trigger automatic notification for customer creation
    await triggerEntityCreatedNotifications(
      'customer',
      customer.id.toString(),
      customer,
      req.user,
      {
        auditDetails: {
          customerId: customer.id.toString(),
          customerName: customer.name,
          serialNumber: customer.serialNumber
        }
      }
    );

    logger.info(`Customer created: ${customer.id}`);
    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: convertBigInts(customer),
      event: convertBigInts(event)
    });
  } catch (error) {
    logger.error('Error creating customer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create customer',
      error: error.message 
    });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const updateData = req.body;
    // Forcefully remove 'mobile' field if present
    if (updateData && typeof updateData === 'object' && 'mobile' in updateData) {
      delete updateData.mobile;
    }
    const { schoolId, id: updatedBy } = req.user;

    console.log('[updateCustomer] Starting update for customer:', id);
    console.log('[updateCustomer] Update data:', JSON.stringify(updateData, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));

    // Get existing customer for comparison
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    console.log('[updateCustomer] Found existing customer:', existingCustomer.id.toString());

    // Validate input
    const validation = await validateCustomerData(updateData, true);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    console.log('[updateCustomer] Validation passed');

    // EVENT-FIRST WORKFLOW: Log event before updating customer
    const customerEventService = new CustomerEventService();
    
    console.log('[updateCustomer] Creating event...');
    // Log the customer update event FIRST
    const event = await customerEventService.createCustomerUpdatedEvent(
      existingCustomer,
      updateData,
      updatedBy,
      schoolId
    );
    console.log('[updateCustomer] Event created:', event?.id?.toString());

    console.log('[updateCustomer] Updating customer in database...');
    // Only allow fields that exist in the Prisma Customer model for updates (skip referredById, ownerId, schoolId, and createdBy)
    const validFields = [
      'name', 'email', 'phone', 'gender', 'source', 'purpose', 'department', 'metadata', 'updatedBy',
      'serialNumber', 'totalSpent', 'orderCount', 'type', 'referredTo',
      'pipelineStageId', 'createdAt', 'updatedAt', 'deletedAt', 'userId', 'rermark', 'priority'
    ];
    const filteredUpdateData = {};
    for (const key of Object.keys(updateData)) {
      if (validFields.includes(key)) {
        filteredUpdateData[key] = updateData[key];
      }
    }
    // Always set updatedBy to the logged-in user's id
    filteredUpdateData.updatedBy = BigInt(updatedBy);
    filteredUpdateData.updatedAt = new Date();
    
    // Convert metadata object to JSON string if it's an object (temporary fix until DB column is JSON)
    if (filteredUpdateData.metadata && typeof filteredUpdateData.metadata === 'object') {
      filteredUpdateData.metadata = JSON.stringify(filteredUpdateData.metadata);
    }
    // Now update the customer
    const customer = await prisma.customer.update({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      },
      data: filteredUpdateData
    });
    console.log('[updateCustomer] Customer updated in database');

    console.log('[updateCustomer] Creating audit log...');
    // Create audit log
    await createAuditLog({
      action: 'UPDATE',
      entity: 'Customer',
      entityId: customer.id.toString(),
      userId: updatedBy,
      schoolId: schoolId,
      details: {
        customerId: customer.id.toString(),
        updatedFields: Object.keys(updateData)
      }
    });
    console.log('[updateCustomer] Audit log created');

    console.log('[updateCustomer] Triggering notifications...');
    // Trigger automatic notification for customer update
    await triggerEntityUpdatedNotifications(
      'customer',
      customer.id.toString(),
      customer,
      existingCustomer,
      req.user,
      {
        auditDetails: {
          customerId: customer.id.toString(),
          updatedFields: Object.keys(updateData)
        }
      }
    );
    console.log('[updateCustomer] Notifications triggered');

    logger.info(`Customer updated: ${id}`);
    // Deeply convert all BigInts in the response
    const safeEvent = event?.data ? convertBigInts(event.data) : convertBigInts(event);
    const responseObj = {
      success: true,
      message: 'Customer updated successfully',
      data: convertBigInts(customer),
      event: safeEvent
    };
    console.log('[updateCustomer] Final response:', JSON.stringify(responseObj, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(responseObj, (key, value) => typeof value === 'bigint' ? value.toString() : value));
  } catch (error) {
    console.error('[updateCustomer] ERROR:', error);
    console.error('[updateCustomer] Error stack:', error.stack);
    console.error('[updateCustomer] Error message:', error.message);
    logger.error('Error updating customer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update customer',
      error: error.message 
    });
  }
};

export const partialUpdateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const updateData = req.body;
    const { schoolId, id: updatedBy } = req.user;

    // For partial updates, we don't validate all fields
    const customer = await prisma.customer.update({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      },
      data: {
        ...updateData,
        updatedBy: BigInt(updatedBy),
        updatedAt: new Date()
      }
    });

    logger.info(`Customer partially updated: ${id}`);
    res.json({
      success: true,
      message: 'Customer partially updated successfully',
      data: convertBigInts(customer)
    });
  } catch (error) {
    logger.error('Error partially updating customer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to partially update customer',
      error: error.message 
    });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const { schoolId, id: deletedBy } = req.user;

    // Get existing customer for notification and event logging
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // EVENT-FIRST WORKFLOW: Log event before deleting customer
    const customerEventService = new CustomerEventService();
    const eventData = {
      customerId: existingCustomer.id,
      customerData: existingCustomer,
      deletedBy,
      schoolId,
      deletionReason: req.body.deletionReason || 'Manual deletion'
    };
    
    // Log the customer deletion event FIRST
    const event = await customerEventService.createCustomerDeletionEvent(
      eventData,
      deletedBy,
      schoolId
    );

    // Now delete the customer
    const customer = await prisma.customer.delete({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      }
    });

    // Update the event with deletion confirmation
    await prisma.customerEvent.update({
      where: { id: event.id },
      data: { 
        metadata: { 
          ...event.metadata, 
          deletionConfirmed: true,
          deletedAt: new Date()
        }
      }
    });

    // Trigger automatic notification for customer deletion
    await triggerEntityDeletedNotifications(
      'customer',
      customer.id.toString(),
      customer,
      req.user,
      {
        auditDetails: {
          customerId: customer.id.toString(),
          customerName: customer.name,
          serialNumber: customer.serialNumber
        }
      }
    );

    logger.info(`Customer deleted: ${id}`);
    res.json({
      success: true,
      message: 'Customer deleted successfully',
      data: convertBigInts(customer),
      event: convertBigInts(event)
    });
  } catch (error) {
    logger.error('Error deleting customer:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete customer',
      error: error.message 
    });
  }
};

// ======================
// ADVANCED CRM FEATURES
// ======================

export const getCustomerAnalytics = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { period = 'monthly', dateFrom, dateTo } = req.query;
    const schoolId = req.user?.schoolId;

    const cacheKey = `customer_analytics:${customerId}:${period}:${dateFrom}:${dateTo}`;
    const cachedAnalytics = await customerCache.get(cacheKey);
    
    if (cachedAnalytics) {
      return res.json(cachedAnalytics);
    }

    const analytics = await customerService.getCustomerAnalytics(
      BigInt(customerId), 
      schoolId, 
      period, 
      dateFrom, 
      dateTo
    );

    await customerCache.set(cacheKey, analytics, 1800); // 30 minutes

    res.json(analytics);
  } catch (error) {
    logger.error('Error getting customer analytics:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get customer analytics',
      error: error.message 
    });
  }
};

export const getCustomerPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const { schoolId } = req.user;

    const customer = await prisma.customer.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Calculate performance metrics
    const performance = {
      customerId: parseInt(id),
      totalSpent: customer.totalSpent || 0,
      orderCount: customer.orderCount || 0,
      averageOrderValue: customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0,
      lastActivity: customer.lastActivity,
      customerSince: customer.createdAt,
      status: customer.status,
      type: customer.type
    };

    res.json({
      success: true,
      message: 'Customer performance retrieved successfully',
      data: convertBigInts(performance),
      meta: { customerId: parseInt(id) }
    });

  } catch (error) {
    logger.error('Error getting customer performance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get customer performance',
      error: error.message 
    });
  }
};

export const getCustomerDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const { schoolId } = req.user;

    const customer = await prisma.customer.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get customer dashboard data
    const dashboard = {
      customerId: parseInt(id),
      customer: {
        id: parseInt(id),
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        status: customer.status,
        type: customer.type,
        totalSpent: customer.totalSpent || 0,
        orderCount: customer.orderCount || 0,
        createdAt: customer.createdAt,
        lastActivity: customer.lastActivity
      },
      metrics: {
        totalSpent: customer.totalSpent || 0,
        orderCount: customer.orderCount || 0,
        averageOrderValue: customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0,
        customerAge: Math.floor((new Date() - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24))
      }
    };

    res.json({
      success: true,
      message: 'Customer dashboard retrieved successfully',
      data: convertBigInts(dashboard),
      meta: { customerId: parseInt(id) }
    });

  } catch (error) {
    logger.error('Error getting customer dashboard:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get customer dashboard',
      error: error.message 
    });
  }
};

export const getCustomerReports = async (req, res) => {
  try {
    const { 
      reportType = 'summary',
      dateFrom, 
      dateTo, 
      groupBy = 'status',
      filters 
    } = req.query;
    const { schoolId } = req.user;

    const whereClause = { schoolId: BigInt(schoolId) };
    
    if (dateFrom && dateTo) {
      whereClause.createdAt = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo)
      };
    }

    let report = {};

    if (reportType === 'summary') {
      const [totalCustomers, customersByStatus, customersByType, totalRevenue] = await Promise.all([
        prisma.customer.count({ where: whereClause }),
        prisma.customer.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { status: true }
        }),
        prisma.customer.groupBy({
          by: ['type'],
          where: whereClause,
          _count: { type: true }
        }),
        prisma.customer.aggregate({
          where: whereClause,
          _sum: { totalSpent: true }
        })
      ]);

      report = {
        totalCustomers,
        totalRevenue: totalRevenue._sum.totalSpent || 0,
        byStatus: customersByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {}),
        byType: customersByType.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {})
      };
    } else if (reportType === 'detailed') {
      const customers = await prisma.customer.findMany({
        where: whereClause,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          type: true,
          totalSpent: true,
          orderCount: true,
          createdAt: true,
          lastActivity: true
        }
      });

      report = {
        customers,
        summary: {
          total: customers.length,
          totalRevenue: customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0),
          averageOrderValue: customers.length > 0 
            ? customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0) / customers.length 
            : 0
        }
      };
    }

    res.json({
      success: true,
      message: 'Customer report generated successfully',
      data: convertBigInts(report),
      meta: { 
        reportType, 
        dateFrom, 
        dateTo, 
        groupBy,
        filters: filters ? JSON.parse(filters) : {}
      }
    });

  } catch (error) {
    logger.error('Error generating customer report:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate customer report',
      error: error.message 
    });
  }
};

export const getCustomerComparisons = async (req, res) => {
  try {
    const { customerIds, metrics = 'all' } = req.query;
    const { schoolId } = req.user;

    if (!customerIds) {
      return res.status(400).json({
        success: false,
        message: 'Customer IDs are required'
      });
    }

    const ids = customerIds.split(',').map(id => BigInt(id));
    
    const customers = await prisma.customer.findMany({
      where: {
        id: { in: ids },
        schoolId: BigInt(schoolId)
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
        type: true,
        totalSpent: true,
        orderCount: true,
        createdAt: true,
        lastActivity: true
      }
    });

    const comparison = customers.map(customer => ({
      id: parseInt(customer.id),
      name: `${customer.firstName} ${customer.lastName}`,
      email: customer.email,
      status: customer.status,
      type: customer.type,
      totalSpent: customer.totalSpent || 0,
      orderCount: customer.orderCount || 0,
      averageOrderValue: customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0,
      customerAge: Math.floor((new Date() - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24)),
      lastActivity: customer.lastActivity
    }));

    res.json({
      success: true,
      message: 'Customer comparison retrieved successfully',
      data: convertBigInts(comparison),
      meta: { 
        customerIds: ids.map(id => parseInt(id)),
        metrics,
        totalCustomers: comparison.length
      }
    });

  } catch (error) {
    logger.error('Error comparing customers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to compare customers',
      error: error.message 
    });
  }
};

// ======================
// BULK OPERATIONS
// ======================

export const bulkCreateCustomers = async (req, res) => {
  try {
    const { customers, options = {} } = req.body;
    const { schoolId, id: createdBy } = req.user;

    if (!customers || !Array.isArray(customers)) {
      return res.status(400).json({
        success: false,
        message: 'Customers array is required'
      });
    }

    const customersToCreate = customers.map(customer => ({
      ...customer,
      schoolId: BigInt(schoolId),
      createdBy: BigInt(createdBy),
      totalSpent: customer.totalSpent || 0,
      orderCount: customer.orderCount || 0,
      status: customer.status || 'active',
      type: customer.type || 'individual'
    }));

    const result = await prisma.customer.createMany({
      data: customersToCreate,
      skipDuplicates: options.skipDuplicates || false
    });

    // Trigger bulk operation notification
    await triggerBulkOperationNotifications(
      'customer',
      customers.map((_, index) => `bulk-${Date.now()}-${index}`),
      'CREATE',
      req.user,
      {
        auditDetails: {
          operation: 'bulk_create',
          count: result.count,
          total: customers.length
        }
      }
    );

    logger.info(`Bulk created ${result.count} customers`);
    res.json({
      success: true,
      message: 'Bulk creation completed',
      data: {
        created: result.count,
        total: customers.length
      }
    });

  } catch (error) {
    logger.error('Error in bulk customer creation:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk create customers',
      error: error.message 
    });
  }
};

export const bulkUpdateCustomers = async (req, res) => {
  try {
    const { updates } = req.body;
    const { schoolId, id: updatedBy } = req.user;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: 'Updates array is required'
      });
    }

    let updatedCount = 0;
    const updatedIds = [];

    for (const update of updates) {
      if (!update.id) {
        continue;
      }

      const result = await prisma.customer.updateMany({
        where: {
          id: BigInt(update.id),
          schoolId: BigInt(schoolId)
        },
        data: {
          ...update.data,
          updatedBy: BigInt(updatedBy),
          updatedAt: new Date()
        }
      });

      if (result.count > 0) {
        updatedCount += result.count;
        updatedIds.push(update.id);
      }
    }

    // Trigger bulk operation notification
    await triggerBulkOperationNotifications(
      'customer',
      updatedIds,
      'UPDATE',
      req.user,
      {
        auditDetails: {
          operation: 'bulk_update',
          count: updatedCount,
          total: updates.length
        }
      }
    );

    logger.info(`Bulk updated ${updatedCount} customers`);
    res.json({
      success: true,
      message: 'Bulk update completed',
      data: {
        updated: updatedCount,
        total: updates.length
      }
    });

  } catch (error) {
    logger.error('Error in bulk customer update:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk update customers',
      error: error.message 
    });
  }
};

export const bulkDeleteCustomers = async (req, res) => {
  try {
    const { customerIds, softDelete = true } = req.body;
    const { schoolId } = req.user;

    if (!customerIds || !Array.isArray(customerIds)) {
      return res.status(400).json({
        success: false,
        message: 'Customer IDs array is required'
      });
    }

    const ids = customerIds.map(id => BigInt(id));

    let result;
    if (softDelete) {
      result = await prisma.customer.updateMany({
        where: {
          id: { in: ids },
          schoolId: BigInt(schoolId)
        },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        }
      });
    } else {
      result = await prisma.customer.deleteMany({
        where: {
          id: { in: ids },
          schoolId: BigInt(schoolId)
        }
      });
    }

    // Trigger bulk operation notification
    await triggerBulkOperationNotifications(
      'customer',
      customerIds,
      'DELETE',
      req.user,
      {
        auditDetails: {
          operation: `bulk_${softDelete ? 'soft_delete' : 'delete'}`,
          count: result.count,
          total: customerIds.length,
          softDelete
        }
      }
    );

    logger.info(`Bulk ${softDelete ? 'soft deleted' : 'deleted'} ${result.count} customers`);
    res.json({
      success: true,
      message: `Bulk ${softDelete ? 'soft delete' : 'delete'} completed`,
      data: {
        deleted: result.count,
        total: customerIds.length,
        softDelete
      }
    });

  } catch (error) {
    logger.error('Error in bulk customer deletion:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to bulk delete customers',
      error: error.message 
    });
  }
};

// ======================
// CACHE MANAGEMENT
// ======================

export const clearCache = async (req, res) => {
  try {
    const { pattern = '*' } = req.query;
    
    const cleared = await customerCache.clearPattern(pattern);
    
    logger.info(`Cleared cache pattern: ${pattern}`);
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      data: { cleared }
    });
  } catch (error) {
    logger.error('Error clearing cache:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to clear cache',
      error: error.message 
    });
  }
};

export const getCacheStats = async (req, res) => {
  try {
    const stats = await customerCache.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting cache stats:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get cache stats',
      error: error.message 
    });
  }
};

// ======================
// UTILITY ENDPOINTS
// ======================

export const getCustomerSuggestions = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;
    const schoolId = req.user?.schoolId;

    const suggestions = await customerService.getCustomerSuggestions(
      query,
      schoolId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    logger.error('Error getting customer suggestions:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get customer suggestions',
      error: error.message 
    });
  }
};

export const getCustomerIdSuggestion = async (req, res) => {
  try {
    const { pattern, prefix } = req.query;
    const schoolId = req.user?.schoolId;

    const suggestion = await customerUtils.generateCustomerIdSuggestion(
      schoolId,
      pattern,
      prefix
    );

    res.json({
      success: true,
      data: suggestion
    });
  } catch (error) {
    logger.error('Error getting customer ID suggestion:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to get customer ID suggestion',
      error: error.message 
    });
  }
};

export const exportCustomers = async (req, res) => {
  try {
    const { format = 'json', filters } = req.query;
    const schoolId = req.user?.schoolId;

    const exportData = await customerService.exportCustomers(
      schoolId,
      format,
      filters ? JSON.parse(filters) : {}
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=customers_export.${format}`);
    res.json(exportData);
  } catch (error) {
    logger.error('Error exporting customers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export customers',
      error: error.message 
    });
  }
};

export const importCustomers = async (req, res) => {
  try {
    const { customers, options = {} } = req.body;
    const schoolId = req.user?.schoolId;
    const importedBy = req.user?.id;

    const result = await customerService.importCustomers(
      customers,
      schoolId,
      importedBy,
      options
    );

    // Clear caches
    await customerCache.clearPattern('customers:*');
    await customerCache.clearPattern('customer_stats:*');

    logger.info(`Imported ${result.imported} customers`);
    res.json({
      success: true,
      message: 'Import completed successfully',
      data: result
    });
  } catch (error) {
    logger.error('Error importing customers:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to import customers',
      error: error.message 
    });
  }
};

// ======================
// AUTOMATION METHODS
// ======================

export const getCustomerAutomations = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;
    const { status, type, active } = req.query;

    const whereClause = {
      customerId: BigInt(id),
      schoolId: BigInt(schoolId)
    };

    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (active !== undefined) whereClause.isActive = active === 'true';

    const automations = await prisma.customerAutomation.findMany({
      where: whereClause,
      include: {
        triggers: true,
        actions: true,
        customer: {
          include: {
            user: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      message: 'Customer automations retrieved successfully',
      data: automations,
      meta: {
        total: automations.length,
        customerId: parseInt(id)
      }
    });

  } catch (error) {
    logger.error('Get customer automations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve automations',
      error: error.message 
    });
  }
};

export const createAutomation = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId, id: userId } = req.user;
    const automationData = req.body;

    if (!automationData.name || !automationData.type || !automationData.triggers || !automationData.actions) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, type, triggers, actions'
      });
    }

    const automation = await prisma.$transaction(async (tx) => {
      const automation = await tx.customerAutomation.create({
        data: {
          customerId: BigInt(id),
          schoolId: BigInt(schoolId),
          name: automationData.name,
          description: automationData.description,
          type: automationData.type,
          status: automationData.status || 'ACTIVE',
          isActive: automationData.isActive !== false,
          priority: automationData.priority || 'MEDIUM',
          conditions: automationData.conditions || {},
          settings: automationData.settings || {},
          createdBy: BigInt(userId)
        }
      });

      if (automationData.triggers && automationData.triggers.length > 0) {
        const triggers = automationData.triggers.map(trigger => ({
          automationId: automation.id,
          type: trigger.type,
          condition: trigger.condition,
          schedule: trigger.schedule,
          parameters: trigger.parameters || {},
          isActive: trigger.isActive !== false
        }));

        await tx.automationTrigger.createMany({ data: triggers });
      }

      if (automationData.actions && automationData.actions.length > 0) {
        const actions = automationData.actions.map(action => ({
          automationId: automation.id,
          type: action.type,
          parameters: action.parameters || {},
          order: action.order || 1,
          isActive: action.isActive !== false,
          delay: action.delay || 0
        }));

        await tx.automationAction.createMany({ data: actions });
      }

      return automation;
    });

    const completeAutomation = await prisma.customerAutomation.findUnique({
      where: { id: automation.id },
      include: {
        triggers: true,
        actions: true,
        customer: {
          include: { user: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Automation created successfully',
      data: convertBigInts(completeAutomation),
      meta: {
        automationId: automation.id,
        customerId: parseInt(id)
      }
    });

  } catch (error) {
    logger.error('Create automation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create automation',
      error: error.message 
    });
  }
};

export const getAutomationTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: 'enrollment_welcome',
        name: 'Welcome New Student',
        description: 'Automatically send welcome message and enrollment confirmation',
        category: 'enrollment',
        type: 'enrollment_confirmation',
        triggers: [
          {
            type: 'on_enrollment',
            condition: 'customer.status === "enrolled"'
          }
        ],
        actions: [
          {
            type: 'send_email',
            parameters: {
              template: 'welcome_email',
              subject: 'Welcome to Our School!'
            },
            order: 1
          }
        ]
      },
      {
        id: 'payment_reminder',
        name: 'Payment Reminder',
        description: 'Send payment reminders before due date',
        category: 'payment',
        type: 'payment_reminder',
        triggers: [
          {
            type: 'custom_schedule',
            schedule: '0 10 * * *',
            condition: 'payment.dueDate <= 7 && payment.status !== "paid"'
          }
        ],
        actions: [
          {
            type: 'send_email',
            parameters: {
              template: 'payment_reminder',
              subject: 'Payment Due Soon'
            },
            order: 1
          }
        ]
      }
    ];

    res.json({
      success: true,
      message: 'Automation templates retrieved successfully',
      data: templates,
      meta: {
        total: templates.length,
        categories: [...new Set(templates.map(t => t.category))]
      }
    });

  } catch (error) {
    logger.error('Get automation templates error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve templates',
      error: error.message 
    });
  }
};

// ======================
// COLLABORATION METHODS
// ======================

export const getCustomerCollaborations = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;
    const { status, type, priority, assignedTo } = req.query;

    const whereClause = {
      customerId: BigInt(id),
      schoolId: BigInt(schoolId)
    };

    if (status) whereClause.status = status;
    if (type) whereClause.type = type;
    if (priority) whereClause.priority = priority;
    if (assignedTo) whereClause.assignedTo = BigInt(assignedTo);

    const collaborations = await prisma.customerCollaboration.findMany({
      where: whereClause,
      include: {
        customer: {
          include: { user: true }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        _count: {
          select: {
            messages: true,
            participants: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    res.json({
      success: true,
      message: 'Customer collaborations retrieved successfully',
      data: convertBigInts(collaborations),
      meta: {
        total: collaborations.length,
        customerId: parseInt(id)
      }
    });

  } catch (error) {
    logger.error('Get customer collaborations error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve collaborations',
      error: error.message 
    });
  }
};

export const createCollaboration = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId, id: userId } = req.user;
    const collaborationData = req.body;

    if (!collaborationData.title || !collaborationData.type) {
      return res.status(400).json({
        success: false,
        message: 'Title and type are required'
      });
    }

    const collaboration = await prisma.$transaction(async (tx) => {
      const collaboration = await tx.customerCollaboration.create({
        data: {
          customerId: BigInt(id),
          schoolId: BigInt(schoolId),
          title: collaborationData.title,
          description: collaborationData.description,
          type: collaborationData.type,
          status: collaborationData.status || 'active',
          priority: collaborationData.priority || 'medium',
          dueDate: collaborationData.dueDate ? new Date(collaborationData.dueDate) : null,
          assignedTo: collaborationData.assignedTo ? BigInt(collaborationData.assignedTo) : null,
          settings: collaborationData.settings || {},
          metadata: collaborationData.metadata || {},
          createdBy: BigInt(userId)
        }
      });

      if (collaborationData.participants && collaborationData.participants.length > 0) {
        const participants = collaborationData.participants.map(participantId => ({
          collaborationId: collaboration.id,
          userId: BigInt(participantId),
          role: 'participant',
          joinedAt: new Date()
        }));

        await tx.collaborationParticipant.createMany({ data: participants });
      }

      await tx.collaborationParticipant.create({
        data: {
          collaborationId: collaboration.id,
          userId: BigInt(userId),
          role: 'owner',
          joinedAt: new Date()
        }
      });

      return collaboration;
    });

    const completeCollaboration = await prisma.customerCollaboration.findUnique({
      where: { id: collaboration.id },
      include: {
        customer: { include: { user: true } },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Collaboration created successfully',
      data: convertBigInts(completeCollaboration),
      meta: {
        collaborationId: collaboration.id,
        customerId: parseInt(id)
      }
    });

  } catch (error) {
    logger.error('Create collaboration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create collaboration',
      error: error.message 
    });
  }
};

export const getCollaborationFeed = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { page = 1, limit = 20, type, status } = req.query;

    const whereClause = { schoolId: BigInt(schoolId) };
    if (type) whereClause.type = type;
    if (status) whereClause.status = status;

    const collaborations = await prisma.customerCollaboration.findMany({
      where: whereClause,
      include: {
        customer: { include: { user: true } },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true }
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        },
        _count: {
          select: { messages: true, participants: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    const total = await prisma.customerCollaboration.count({ where: whereClause });

    res.json({
      success: true,
      message: 'Collaboration feed retrieved successfully',
      data: convertBigInts(collaborations),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Get collaboration feed error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve collaboration feed',
      error: error.message 
    });
  }
};

// ======================
// DOCUMENT METHODS
// ======================

export const getCustomerDocuments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const { schoolId } = req.user;
    const { type, category, status, search, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = req.query;

    const whereClause = {
      customerId: BigInt(id),
      schoolId: BigInt(schoolId)
    };

    if (type) whereClause.type = type;
    if (category) whereClause.category = category;
    if (status) whereClause.status = status;
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } }
      ];
    }

    const documents = await prisma.customerDocument.findMany({
      where: whereClause,
      include: {
        customer: { include: { user: true } },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        },
        _count: {
          select: { versions: true, shares: true, comments: true }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    const total = await prisma.customerDocument.count({ where: whereClause });

    res.json({
      success: true,
      message: 'Customer documents retrieved successfully',
      data: convertBigInts(documents),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      meta: { customerId: parseInt(id) }
    });

  } catch (error) {
    logger.error('Get customer documents error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve documents',
      error: error.message 
    });
  }
};

export const uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const { schoolId, id: userId } = req.user;
    const documentData = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    if (!documentData.title || !documentData.type) {
      return res.status(400).json({
        success: false,
        message: 'Title and type are required'
      });
    }

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExtension}`;
    const filePath = path.join('uploads', 'documents', fileName);

    // Ensure upload directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Move file to destination
    await fs.rename(file.path, filePath);

    const document = await prisma.$transaction(async (tx) => {
      const document = await tx.customerDocument.create({
        data: {
          customerId: BigInt(id),
          schoolId: BigInt(schoolId),
          title: documentData.title,
          description: documentData.description,
          type: documentData.type,
          category: documentData.category || getCategoryFromType(documentData.type),
          status: documentData.status || 'draft',
          tags: documentData.tags || [],
          metadata: documentData.metadata || {},
          expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate) : null,
          isPublic: documentData.isPublic || false,
          isConfidential: documentData.isConfidential || false,
          uploadedBy: BigInt(userId)
        }
      });

      await tx.documentVersion.create({
        data: {
          documentId: document.id,
          versionNumber: 1,
          fileName: fileName,
          originalName: file.originalname,
          filePath: filePath,
          fileSize: file.size,
          mimeType: file.mimetype,
          uploadedBy: BigInt(userId),
          changeLog: 'Initial version'
        }
      });

      return document;
    });

    const completeDocument = await prisma.customerDocument.findUnique({
      where: { id: document.id },
      include: {
        customer: { include: { user: true } },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      data: convertBigInts(completeDocument),
      meta: {
        documentId: document.id,
        customerId: parseInt(id)
      }
    });

  } catch (error) {
    logger.error('Upload document error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload document',
      error: error.message 
    });
  }
};

export const getDocumentAnalytics = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { period = '30d', customerId } = req.query;

    const whereClause = { schoolId: BigInt(schoolId) };
    if (customerId) whereClause.customerId = BigInt(customerId);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));
    whereClause.createdAt = { gte: startDate, lte: endDate };

    const [totalDocuments, documentsByType, documentsByStatus, storageUsage] = await Promise.all([
      prisma.customerDocument.count({ where: whereClause }),
      prisma.customerDocument.groupBy({
        by: ['type'],
        where: whereClause,
        _count: { type: true }
      }),
      prisma.customerDocument.groupBy({
        by: ['status'],
        where: whereClause,
        _count: { status: true }
      }),
      prisma.documentVersion.aggregate({
        where: { document: whereClause },
        _sum: { fileSize: true }
      })
    ]);

    const analytics = {
      total: totalDocuments,
      byType: documentsByType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {}),
      byStatus: documentsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      storageUsage: storageUsage._sum.fileSize || 0
    };

    res.json({
      success: true,
      message: 'Document analytics retrieved successfully',
      data: convertBigInts(analytics),
      meta: { period, customerId: customerId ? parseInt(customerId) : null }
    });

  } catch (error) {
    logger.error('Get document analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve document analytics',
      error: error.message 
    });
  }
};

// Helper function
const getCategoryFromType = (type) => {
  const categoryMap = {
    'enrollment_form': 'academic',
    'academic_record': 'academic',
    'transcript': 'academic',
    'certificate': 'academic',
    'report_card': 'academic',
    'id_proof': 'administrative',
    'birth_certificate': 'administrative',
    'medical_record': 'medical',
    'fee_structure': 'financial',
    'payment_receipt': 'financial',
    'contract': 'legal',
    'letter': 'communication',
    'photo': 'personal'
  };
  return categoryMap[type] || 'other';
};

// ======================
// TASK METHODS
// ======================







// ======================
// ANALYTICS ENDPOINTS
// ======================

export const getAnalyticsDashboard = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { period = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const whereClause = {
      schoolId: BigInt(schoolId),
      createdAt: { gte: startDate, lte: endDate }
    };

    const [
      totalCustomers,
      newCustomers,
      activeCustomers,
      customersByStatus,
      customersByType,
      topCustomers,
      customerGrowth
    ] = await Promise.all([
      prisma.customer.count({ where: { schoolId: BigInt(schoolId) } }),
      prisma.customer.count({ where: whereClause }),
      prisma.customer.count({
        where: {
          schoolId: BigInt(schoolId),
          lastActivity: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.customer.groupBy({
        by: ['status'],
        where: { schoolId: BigInt(schoolId) },
        _count: { status: true }
      }),
      prisma.customer.groupBy({
        by: ['type'],
        where: { schoolId: BigInt(schoolId) },
        _count: { type: true }
      }),
      prisma.customer.findMany({
        where: { schoolId: BigInt(schoolId) },
        orderBy: { totalSpent: 'desc' },
        take: 10,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          totalSpent: true,
          orderCount: true
        }
      }),
      prisma.customer.groupBy({
        by: ['createdAt'],
        where: whereClause,
        _count: { createdAt: true }
      })
    ]);

    const dashboard = {
      overview: {
        total: totalCustomers,
        new: newCustomers,
        active: activeCustomers,
        growthRate: totalCustomers > 0 ? ((newCustomers / totalCustomers) * 100).toFixed(2) : 0
      },
      byStatus: customersByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      }, {}),
      byType: customersByType.reduce((acc, item) => {
        acc[item.type] = item._count.type;
        return acc;
      }, {}),
      topCustomers,
      growth: customerGrowth.map(item => ({
        date: item.createdAt,
        count: item._count.createdAt
      }))
    };

    res.json({
      success: true,
      message: 'Analytics dashboard retrieved successfully',
      data: convertBigInts(dashboard),
      meta: { period }
    });

  } catch (error) {
    logger.error('Get analytics dashboard error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve analytics dashboard',
      error: error.message 
    });
  }
};

export const getAnalyticsReports = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { type = 'all', period = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const whereClause = {
      schoolId: BigInt(schoolId),
      createdAt: { gte: startDate, lte: endDate }
    };

    let reports = {};

    if (type === 'all' || type === 'customer') {
      const customerReport = await prisma.customer.groupBy({
        by: ['createdAt'],
        where: whereClause,
        _count: { createdAt: true },
        _sum: { totalSpent: true }
      });

      reports.customer = customerReport.map(item => ({
        date: item.createdAt,
        newCustomers: item._count.createdAt,
        revenue: item._sum.totalSpent || 0
      }));
    }

    if (type === 'all' || type === 'engagement') {
      const engagementReport = await prisma.customer.groupBy({
        by: ['lastActivity'],
        where: {
          schoolId: BigInt(schoolId),
          lastActivity: { gte: startDate, lte: endDate }
        },
        _count: { lastActivity: true }
      });

      reports.engagement = engagementReport.map(item => ({
        date: item.lastActivity,
        activeCustomers: item._count.lastActivity
      }));
    }

    if (type === 'all' || type === 'revenue') {
      const revenueReport = await prisma.customer.groupBy({
        by: ['createdAt'],
        where: whereClause,
        _sum: { totalSpent: true }
      });

      reports.revenue = revenueReport.map(item => ({
        date: item.createdAt,
        revenue: item._sum.totalSpent || 0
      }));
    }

    res.json({
      success: true,
      message: 'Analytics reports retrieved successfully',
      data: convertBigInts(reports),
      meta: { type, period }
    });

  } catch (error) {
    logger.error('Get analytics reports error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve analytics reports',
      error: error.message 
    });
  }
};

export const getAnalyticsTrends = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { metric = 'customers', period = '90d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    let trends = {};

    if (metric === 'customers' || metric === 'all') {
      const customerTrends = await prisma.customer.groupBy({
        by: ['createdAt'],
        where: {
          schoolId: BigInt(schoolId),
          createdAt: { gte: startDate, lte: endDate }
        },
        _count: { createdAt: true }
      });

      trends.customers = customerTrends.map(item => ({
        date: item.createdAt,
        count: item._count.createdAt
      }));
    }

    if (metric === 'revenue' || metric === 'all') {
      const revenueTrends = await prisma.customer.groupBy({
        by: ['createdAt'],
        where: {
          schoolId: BigInt(schoolId),
          createdAt: { gte: startDate, lte: endDate }
        },
        _sum: { totalSpent: true }
      });

      trends.revenue = revenueTrends.map(item => ({
        date: item.createdAt,
        amount: item._sum.totalSpent || 0
      }));
    }

    if (metric === 'engagement' || metric === 'all') {
      const engagementTrends = await prisma.customer.groupBy({
        by: ['lastActivity'],
        where: {
          schoolId: BigInt(schoolId),
          lastActivity: { gte: startDate, lte: endDate }
        },
        _count: { lastActivity: true }
      });

      trends.engagement = engagementTrends.map(item => ({
        date: item.lastActivity,
        count: item._count.lastActivity
      }));
    }

    res.json({
      success: true,
      message: 'Analytics trends retrieved successfully',
      data: convertBigInts(trends),
      meta: { metric, period }
    });

  } catch (error) {
    logger.error('Get analytics trends error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve analytics trends',
      error: error.message 
    });
  }
};

export const getForecastingAnalytics = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { forecastPeriod = '30d' } = req.query;

    // Get historical data for forecasting
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Use 90 days of historical data

    const historicalData = await prisma.customer.groupBy({
      by: ['createdAt'],
      where: {
        schoolId: BigInt(schoolId),
        createdAt: { gte: startDate, lte: endDate }
      },
      _count: { createdAt: true },
      _sum: { totalSpent: true }
    });

    // Simple forecasting based on average growth
    const dailyAverages = historicalData.reduce((acc, item) => {
      acc.customers += item._count.createdAt;
      acc.revenue += item._sum.totalSpent || 0;
      return acc;
    }, { customers: 0, revenue: 0 });

    const daysInPeriod = historicalData.length || 1;
    const avgDailyCustomers = dailyAverages.customers / daysInPeriod;
    const avgDailyRevenue = dailyAverages.revenue / daysInPeriod;

    const forecastDays = parseInt(forecastPeriod);
    const forecast = {
      customers: {
        daily: Math.round(avgDailyCustomers),
        total: Math.round(avgDailyCustomers * forecastDays)
      },
      revenue: {
        daily: avgDailyRevenue,
        total: avgDailyRevenue * forecastDays
      },
      period: forecastPeriod
    };

    res.json({
      success: true,
      message: 'Forecasting analytics retrieved successfully',
      data: convertBigInts(forecast),
      meta: { 
        forecastPeriod,
        historicalDataPoints: historicalData.length,
        confidence: 'medium'
      }
    });

  } catch (error) {
    logger.error('Get forecasting analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve forecasting analytics',
      error: error.message 
    });
  }
};

export const exportAnalytics = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { format = 'json', period = '30d' } = req.body;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const whereClause = {
      schoolId: BigInt(schoolId),
      createdAt: { gte: startDate, lte: endDate }
    };

    const analyticsData = await prisma.customer.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        status: true,
        type: true,
        totalSpent: true,
        orderCount: true,
        createdAt: true,
        lastActivity: true
      }
    });

    const summary = {
      totalCustomers: analyticsData.length,
      totalRevenue: analyticsData.reduce((sum, customer) => sum + (customer.totalSpent || 0), 0),
      averageOrderValue: analyticsData.length > 0 
        ? analyticsData.reduce((sum, customer) => sum + (customer.totalSpent || 0), 0) / analyticsData.length 
        : 0,
      period: period
    };

    const exportData = {
      summary,
      customers: analyticsData,
      exportedAt: new Date().toISOString()
    };

    if (format === 'csv') {
      // For CSV export, you would need to implement CSV generation
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="customer-analytics-${period}.csv"`);
      res.send('CSV export not implemented yet');
    } else {
      res.json({
        success: true,
        message: 'Analytics exported successfully',
        data: convertBigInts(exportData),
        meta: { format, period }
      });
    }

  } catch (error) {
    logger.error('Export analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export analytics',
      error: error.message 
    });
  }
};

export const getEngagementAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const { schoolId } = req.user;
    const { period = '30d' } = req.query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const customer = await prisma.customer.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get engagement metrics
    const engagementData = await prisma.customer.findMany({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId),
        lastActivity: { gte: startDate, lte: endDate }
      },
      select: {
        lastActivity: true,
        orderCount: true,
        totalSpent: true
      }
    });

    const engagement = {
      customerId: parseInt(id),
      period: period,
      lastActivity: customer.lastActivity,
      totalOrders: customer.orderCount || 0,
      totalSpent: customer.totalSpent || 0,
      activityFrequency: engagementData.length,
      averageOrderValue: customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0
    };

    res.json({
      success: true,
      message: 'Engagement analytics retrieved successfully',
      data: convertBigInts(engagement),
      meta: { customerId: parseInt(id), period }
    });

  } catch (error) {
    logger.error('Get engagement analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve engagement analytics',
      error: error.message 
    });
  }
};



export const getLifetimeValueAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9]+$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID' });
    }
    const { schoolId } = req.user;
    const { period = 'all' } = req.query;

    const customer = await prisma.customer.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId)
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Calculate lifetime value metrics
    const customerLifetimeValue = customer.totalSpent || 0;
    const averageOrderValue = customer.orderCount > 0 ? customer.totalSpent / customer.orderCount : 0;
    const customerAge = Math.floor((new Date() - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24));
    const purchaseFrequency = customerAge > 0 ? customer.orderCount / customerAge : 0;

    const lifetimeValue = {
      customerId: parseInt(id),
      customerLifetimeValue: customerLifetimeValue,
      averageOrderValue: averageOrderValue,
      totalOrders: customer.orderCount || 0,
      customerAge: customerAge,
      purchaseFrequency: purchaseFrequency,
      firstPurchaseDate: customer.createdAt,
      lastPurchaseDate: customer.lastActivity,
      retentionRate: customerAge > 30 ? 100 : 0 // Simplified calculation
    };

    res.json({
      success: true,
      message: 'Lifetime value analytics retrieved successfully',
      data: convertBigInts(lifetimeValue),
      meta: { customerId: parseInt(id), period }
    });

  } catch (error) {
    logger.error('Get lifetime value analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve lifetime value analytics',
      error: error.message 
    });
  }
};

/**
 * Convert a customer to a student (event-driven, advanced)
 */
export const convertCustomerToStudent = async (req, res) => {
  try {
    const { id } = req.params; // customerId
    const { schoolId, id: userId } = req.user;
    const studentData = req.body;
    const customerId = BigInt(id);

    // 1. Fetch the customer
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, schoolId: BigInt(schoolId) }
    });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    // 2. Check if already converted
    const existingStudent = await prisma.student.findFirst({
      where: { convertedFromCustomerId: customerId }
    });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: 'Customer already converted to student' });
    }

    // 3. Log event FIRST
    const eventService = new CustomerEventService();
    const conversionData = {
      reason: studentData.conversionReason || 'Manual conversion',
      method: studentData.conversionMethod || 'manual',
      classId: studentData.classId,
      sectionId: studentData.sectionId,
      admissionNo: studentData.admissionNo,
      rollNo: studentData.rollNo,
      previousCustomerData: customer
    };
    const event = await eventService.createCustomerConversionEvent(
      customerId,
      null, // studentId not known yet
      conversionData,
      userId,
      schoolId
    );

    // 4. Create the student (with conversion tracking)
    const now = new Date();
    
    // Filter out invalid fields and only use valid Student model fields
    const validStudentFields = [
      'admissionNo', 'rollNo', 'admissionDate', 'bloodGroup', 'nationality', 
      'religion', 'caste', 'aadharNo', 'bankAccountNo', 'bankName', 'ifscCode', 
      'previousSchool', 'classId', 'sectionId', 'parentId'
    ];
    
    const filteredStudentData = {};
    for (const key of Object.keys(studentData)) {
      if (validStudentFields.includes(key)) {
        filteredStudentData[key] = studentData[key];
      }
    }
    
    const student = await prisma.student.create({
      data: {
        ...filteredStudentData,
        convertedFromCustomer: {
          connect: { id: customerId }
        },
        conversionDate: now,
        createdBy: userId,
        school: {
          connect: { id: BigInt(schoolId) }
        },
        user: {
          create: {
            ...studentData.user,
            username: (studentData.user?.email?.split('@')[0] || `student`) + Date.now(),
            role: 'STUDENT',
            schoolId: BigInt(schoolId),
            createdBy: userId,
            createdByOwnerId: userId,
            password: 'changeme123'
          }
        }
      },
      include: { user: true }
    });

    // 5. Update the event with the studentId
    await prisma.customerEvent.update({
      where: { id: event.data.id },
      data: { metadata: { ...event.data.metadata, studentId: student.id } }
    });

    // 6. Log a StudentEvent for conversion
    const StudentEventService = (await import('../services/studentEventService.js')).default;
    const studentEventService = new StudentEventService();
    await studentEventService.createStudentEnrollmentEvent(
      student,
      userId,
      BigInt(schoolId)
    );

    res.status(201).json({
      success: true,
      message: 'Customer converted to student successfully',
      data: convertBigInts({ student, event })
    });
  } catch (error) {
    logger.error('Error converting customer to student:', error);
    res.status(500).json({ success: false, message: 'Failed to convert customer to student', error: error.message });
  }
};

/**
 * Get all customers that haven't been converted to students yet
 */
export const getUnconvertedCustomers = async (req, res) => {
  try {
    const schoolId = BigInt(req.user.schoolId);
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Use a safer approach to find unconverted customers
    // First, get all customer IDs that have converted students
    const convertedCustomerIds = await prisma.student.findMany({
      where: {
        schoolId,
        convertedFromCustomerId: { not: null }
      },
      select: {
        convertedFromCustomerId: true
      }
    });

    const convertedIds = convertedCustomerIds
      .map(s => s.convertedFromCustomerId)
      .filter(id => id !== null);

    // Find customers that are not in the converted list
    const whereClause = {
      schoolId,
      id: {
        notIn: convertedIds.length > 0 ? convertedIds : undefined
      }
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Use a safer sorting approach to avoid datetime issues
    const safeSortBy = sortBy === 'updatedAt' ? 'createdAt' : sortBy;

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where: whereClause,
        select: {
          id: true,
          uuid: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          city: true,
          state: true,
          country: true,
          postalCode: true,
          status: true,
          source: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          // Only include events if they exist and have valid dates
          events: {
            where: {
              createdAt: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              eventType: true,
              title: true,
              description: true,
              createdAt: true
            }
          },
          _count: {
            select: {
              events: true
            }
          }
        },
        orderBy: { [safeSortBy]: sortOrder },
        skip,
        take: parseInt(limit)
      }),
      prisma.customer.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: convertBigInts(customers),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching unconverted customers:', error);
    
    // If the main query fails, try a fallback approach
    try {
      console.log('Attempting fallback query for unconverted customers...');
      
      const schoolId = BigInt(req.user.schoolId);
      const { page = 1, limit = 10 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Simple fallback query without complex relations
      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where: { schoolId },
          select: {
            id: true,
            uuid: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            state: true,
            country: true,
            postalCode: true,
            status: true,
            source: true,
            priority: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: parseInt(limit)
        }),
        prisma.customer.count({ where: { schoolId } })
      ]);

      res.json({
        success: true,
        data: convertBigInts(customers),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        note: 'Fallback query used due to data integrity issues'
      });
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch unconverted customers',
        error: 'Database query failed due to data integrity issues'
      });
    }
  }
};

/**
 * Get conversion analytics and statistics
 */
export const getConversionAnalytics = async (req, res) => {
  try {
    const schoolId = BigInt(req.user.schoolId);
    const { period = '30d' } = req.query; // 7d, 30d, 90d, 1y, all

    let dateFilter = {};
    if (period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365;
      dateFilter = {
        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      };
    }

    // Get conversion statistics
    const [
      totalCustomers,
      convertedCustomers,
      unconvertedCustomers,
      conversionRate,
      recentConversions,
      conversionTrend
    ] = await Promise.all([
      // Total customers
      prisma.customer.count({ where: { schoolId } }),
      
      // Converted customers (have at least one converted student)
      prisma.customer.count({
        where: {
          schoolId,
          convertedStudents: { some: {} }
        }
      }),
      
      // Unconverted customers
      prisma.customer.count({
        where: {
          schoolId,
          convertedStudents: { none: {} }
        }
      }),
      
      // Conversion rate calculation
      prisma.customer.count({ where: { schoolId } }).then(total => {
        return prisma.customer.count({
          where: {
            schoolId,
            convertedStudents: { some: {} }
          }
        }).then(converted => total > 0 ? (converted / total) * 100 : 0);
      }),
      
      // Recent conversions (last 30 days)
      prisma.student.count({
        where: {
          schoolId,
          convertedFromCustomerId: { not: null },
          conversionDate: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Conversion trend (monthly for last 6 months)
      prisma.student.groupBy({
        by: ['conversionDate'],
        where: {
          schoolId,
          convertedFromCustomerId: { not: null },
          conversionDate: {
            gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
          }
        },
        _count: {
          id: true
        }
      })
    ]);

    // Get conversion events for the period
    const conversionEvents = await prisma.customerEvent.findMany({
      where: {
        customer: { schoolId },
        eventType: 'CUSTOMER_CONVERTED_TO_STUDENT',
        createdAt: dateFilter
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.json({
      success: true,
      data: convertBigInts({
        totalCustomers,
        convertedCustomers,
        unconvertedCustomers,
        conversionRate: Math.round(conversionRate * 100) / 100,
        recentConversions,
        conversionTrend,
        conversionEvents
      })
    });
  } catch (error) {
    console.error('Error fetching conversion analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversion analytics',
      error: error.message
    });
  }
};

/**
 * Get detailed conversion history
 */
export const getConversionHistory = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { page = 1, limit = 10, customerId } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const whereClause = {
      schoolId,
      convertedFromCustomerId: { not: null }
    };

    if (customerId) {
      if (!/^[0-9]+$/.test(customerId)) {
        return res.status(400).json({ success: false, message: 'Invalid customer ID' });
      }
      whereClause.convertedFromCustomerId = BigInt(customerId);
    }

    const [conversions, total] = await Promise.all([
      prisma.student.findMany({
        where: whereClause,
        include: {
          convertedFromCustomer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true
            }
          },
          events: {
            where: {
              eventType: 'STUDENT_CREATED_FROM_CONVERSION'
            },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        },
        orderBy: { conversionDate: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.student.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: conversions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching conversion history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversion history',
      error: error.message
    });
  }
};

/**
 * Get conversion rates and trends
 */
export const getConversionRates = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { period = 'monthly' } = req.query; // daily, weekly, monthly, yearly

    const now = new Date();
    const periods = {
      daily: 30,
      weekly: 12,
      monthly: 12,
      yearly: 5
    };

    const dataPoints = periods[period];
    const interval = period === 'daily' ? 24 * 60 * 60 * 1000 : 
                    period === 'weekly' ? 7 * 24 * 60 * 60 * 1000 :
                    period === 'monthly' ? 30 * 24 * 60 * 60 * 1000 : 
                    365 * 24 * 60 * 60 * 1000;

    const rates = [];

    for (let i = 0; i < dataPoints; i++) {
      const endDate = new Date(now.getTime() - (i * interval));
      const startDate = new Date(endDate.getTime() - interval);

      const [customersInPeriod, conversionsInPeriod] = await Promise.all([
        prisma.customer.count({
          where: {
            schoolId,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }),
        prisma.student.count({
          where: {
            schoolId,
            convertedFromCustomerId: { not: null },
            conversionDate: {
              gte: startDate,
              lte: endDate
            }
          }
        })
      ]);

      const rate = customersInPeriod > 0 ? (conversionsInPeriod / customersInPeriod) * 100 : 0;
      
      rates.unshift({
        period: endDate.toISOString().split('T')[0],
        customers: customersInPeriod,
        conversions: conversionsInPeriod,
        rate: Math.round(rate * 100) / 100
      });
    }

    res.json({
      success: true,
      data: {
        period,
        rates,
        averageRate: rates.length > 0 ? 
          Math.round((rates.reduce((sum, r) => sum + r.rate, 0) / rates.length) * 100) / 100 : 0
      }
    });
  } catch (error) {
    console.error('Error fetching conversion rates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversion rates',
      error: error.message
    });
  }
};

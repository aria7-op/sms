import Joi from 'joi';
import {PrismaClient} from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Inventory validation schemas
const categorySchema = Joi.object({
  name: Joi.string().max(100).required(),
  description: Joi.string().optional(),
  code: Joi.string().max(20).optional(),
  parentId: Joi.number().optional(),
  level: Joi.number().integer().min(1).default(1),
  sortOrder: Joi.number().integer().min(0).default(0),
  isActive: Joi.boolean().default(true),
  metadata: Joi.object().optional()
});

const inventoryItemSchema = Joi.object({
  name: Joi.string().max(100).required(),
  description: Joi.string().optional(),
  sku: Joi.string().max(50).optional(),
  barcode: Joi.string().max(50).optional(),
  categoryId: Joi.number().optional(),
  quantity: Joi.number().integer().min(0).default(0),
  minQuantity: Joi.number().integer().min(0).default(0),
  maxQuantity: Joi.number().integer().min(0).optional(),
  reservedQuantity: Joi.number().integer().min(0).default(0),
  unit: Joi.string().valid('PIECE', 'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER', 'METER', 'CENTIMETER', 'SQUARE_METER', 'CUBIC_METER', 'DOZEN', 'PACK', 'BOX', 'BOTTLE', 'CAN', 'ROLL', 'SET', 'PAIR', 'UNIT', 'BAG', 'CONTAINER').default('PIECE'),
  price: Joi.number().positive().optional(),
  costPrice: Joi.number().positive().optional(),
  sellingPrice: Joi.number().positive().optional(),
  supplier: Joi.string().max(100).optional(),
  supplierId: Joi.number().optional(),
  location: Joi.string().max(100).optional(),
  shelfNumber: Joi.string().max(20).optional(),
  expiryDate: Joi.date().optional(),
  warrantyExpiry: Joi.date().optional(),
  status: Joi.string().valid('AVAILABLE', 'LOW_STOCK', 'OUT_OF_STOCK', 'DISCONTINUED', 'UNDER_MAINTENANCE', 'RESERVED', 'DAMAGED', 'EXPIRED').default('AVAILABLE'),
  condition: Joi.string().max(50).optional(),
  brand: Joi.string().max(100).optional(),
  model: Joi.string().max(100).optional(),
  serialNumber: Joi.string().max(100).optional(),
  specifications: Joi.object().optional(),
  images: Joi.array().items(Joi.string()).default([]),
  documents: Joi.array().items(Joi.string()).default([]),
  tags: Joi.array().items(Joi.string()).default([]),
  isActive: Joi.boolean().default(true),
  isTrackable: Joi.boolean().default(false),
  isExpirable: Joi.boolean().default(false),
  isMaintainable: Joi.boolean().default(false),
  lastAuditDate: Joi.date().optional(),
  nextAuditDate: Joi.date().optional(),
  lastMaintenanceDate: Joi.date().optional(),
  nextMaintenanceDate: Joi.date().optional(),
  metadata: Joi.object().optional()
});

const supplierSchema = Joi.object({
  name: Joi.string().max(100).required(),
  code: Joi.string().max(20).optional(),
  contactPerson: Joi.string().max(100).optional(),
  email: Joi.string().email().max(100).optional(),
  phone: Joi.string().max(20).optional(),
  address: Joi.string().optional(),
  city: Joi.string().max(50).optional(),
  state: Joi.string().max(50).optional(),
  country: Joi.string().max(50).optional(),
  postalCode: Joi.string().max(20).optional(),
  website: Joi.string().max(255).optional(),
  taxId: Joi.string().max(50).optional(),
  bankDetails: Joi.object().optional(),
  paymentTerms: Joi.string().max(100).optional(),
  creditLimit: Joi.number().positive().optional(),
  rating: Joi.number().integer().min(1).max(5).optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BLACKLISTED', 'PENDING_APPROVAL').default('ACTIVE')
});

const purchaseOrderSchema = Joi.object({
  supplierId: Joi.number().required(),
  orderDate: Joi.date().required(),
  expectedDeliveryDate: Joi.date().optional(),
  deliveryDate: Joi.date().optional(),
  status: Joi.string().valid('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', 'COMPLETED').default('DRAFT'),
  subtotal: Joi.number().positive().default(0),
  taxAmount: Joi.number().positive().default(0),
  discountAmount: Joi.number().positive().default(0),
  totalAmount: Joi.number().positive().default(0),
  currency: Joi.string().max(3).default('USD'),
  paymentTerms: Joi.string().max(100).optional(),
  deliveryAddress: Joi.string().optional(),
  notes: Joi.string().optional(),
  items: Joi.array().items(Joi.object({
    itemId: Joi.number().required(),
    quantity: Joi.number().integer().positive().required(),
    unitPrice: Joi.number().positive().required(),
    remarks: Joi.string().max(255).optional()
  })).min(1).required()
});

// Validation functions
const validateCategoryData = (data, isUpdate = false) => {
  const schema = isUpdate ? categorySchema.fork(['name'], (schema) => schema.optional()) : categorySchema;
  return schema.validate(data);
};

const validateInventoryItemData = (data, isUpdate = false) => {
  const schema = isUpdate ? inventoryItemSchema.fork(['name', 'quantity'], (schema) => schema.optional()) : inventoryItemSchema;
  return schema.validate(data);
};

const validateSupplierData = (data, isUpdate = false) => {
  const schema = isUpdate ? supplierSchema.fork(['name'], (schema) => schema.optional()) : supplierSchema;
  return schema.validate(data);
};

const validatePurchaseOrderData = (data, isUpdate = false) => {
  const schema = isUpdate ? purchaseOrderSchema.fork(['supplierId', 'items'], (schema) => schema.optional()) : purchaseOrderSchema;
  return schema.validate(data);
};

// SKU generation
const generateSKU = async (prefix, schoolId) => {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const skuPrefix = `${prefix}-${year}${month}-`;
  
  // Get the last item for this school and month
  const lastItem = await prisma.inventoryItem.findFirst({
    where: {
      schoolId: BigInt(schoolId),
      sku: { startsWith: skuPrefix },
      deletedAt: null
    },
    orderBy: { sku: 'desc' }
  });

  let sequence = 1;
  if (lastItem && lastItem.sku) {
    const lastSequence = parseInt(lastItem.sku.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${skuPrefix}${sequence.toString().padStart(4, '0')}`;
};

// Barcode generation
const generateBarcode = async (schoolId) => {
  const prefix = 'INV';
  const year = new Date().getFullYear();
  const skuPrefix = `${prefix}${year}`;
  
  // Get the last item for this school and year
  const lastItem = await prisma.inventoryItem.findFirst({
    where: {
      schoolId: BigInt(schoolId),
      barcode: { startsWith: skuPrefix },
      deletedAt: null
    },
    orderBy: { barcode: 'desc' }
  });

  let sequence = 1;
  if (lastItem && lastItem.barcode) {
    const lastSequence = parseInt(lastItem.barcode.substring(skuPrefix.length));
    sequence = lastSequence + 1;
  }

  return `${skuPrefix}${sequence.toString().padStart(6, '0')}`;
};

// Calculate inventory value
const calculateInventoryValue = async (schoolId) => {
  const items = await prisma.inventoryItem.findMany({
    where: { schoolId: BigInt(schoolId), deletedAt: null },
    select: { quantity: true, costPrice: true }
  });

  return items.reduce((total, item) => {
    return total + (item.costPrice || 0) * item.quantity;
  }, 0);
};

// Check low stock items
const checkLowStockItems = async (schoolId) => {
  const lowStockItems = await prisma.inventoryItem.findMany({
    where: {
      schoolId: BigInt(schoolId),
      deletedAt: null,
      quantity: {
        lte: { minQuantity: true }
      },
      status: { not: 'DISCONTINUED' }
    },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } }
    }
  });

  return lowStockItems;
};

// Check expiring items
const checkExpiringItems = async (schoolId, days = 30) => {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  const expiringItems = await prisma.inventoryItem.findMany({
    where: {
      schoolId: BigInt(schoolId),
      deletedAt: null,
      expiryDate: {
        gte: new Date(),
        lte: expiryDate
      },
      isExpirable: true
    },
    include: {
      category: { select: { name: true } }
    }
  });

  return expiringItems;
};

// Check overdue maintenance
const checkOverdueMaintenance = async (schoolId) => {
  const overdueItems = await prisma.inventoryItem.findMany({
    where: {
      schoolId: BigInt(schoolId),
      deletedAt: null,
      nextMaintenanceDate: {
        lte: new Date()
      },
      isMaintainable: true,
      status: { not: 'DISCONTINUED' }
    },
    include: {
      category: { select: { name: true } }
    }
  });

  return overdueItems;
};

// Generate alerts
const generateAlerts = async (schoolId) => {
  const alerts = [];

  // Low stock alerts
  const lowStockItems = await checkLowStockItems(schoolId);
  for (const item of lowStockItems) {
    alerts.push({
      itemId: item.id,
      type: 'LOW_STOCK',
      title: 'Low Stock Alert',
      message: `${item.name} is running low on stock. Current quantity: ${item.quantity}`,
      severity: item.quantity === 0 ? 'critical' : 'high'
    });
  }

  // Expiry alerts
  const expiringItems = await checkExpiringItems(schoolId);
  for (const item of expiringItems) {
    const daysUntilExpiry = Math.ceil((new Date(item.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
    alerts.push({
      itemId: item.id,
      type: 'EXPIRY_WARNING',
      title: 'Expiry Warning',
      message: `${item.name} will expire in ${daysUntilExpiry} days`,
      severity: daysUntilExpiry <= 7 ? 'critical' : daysUntilExpiry <= 14 ? 'high' : 'medium'
    });
  }

  // Maintenance alerts
  const overdueMaintenance = await checkOverdueMaintenance(schoolId);
  for (const item of overdueMaintenance) {
    alerts.push({
      itemId: item.id,
      type: 'MAINTENANCE_DUE',
      title: 'Maintenance Due',
      message: `${item.name} is overdue for maintenance`,
      severity: 'high'
    });
  }

  return alerts;
};

// Inventory search functionality
const searchInventoryItemsAdvanced = async (schoolId, searchParams) => {
  const { query, categoryId, supplierId, status, available, unit, minPrice, maxPrice } = searchParams;
  
  const where = { schoolId: BigInt(schoolId), deletedAt: null };

  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { sku: { contains: query, mode: 'insensitive' } },
      { barcode: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { brand: { contains: query, mode: 'insensitive' } },
      { model: { contains: query, mode: 'insensitive' } }
    ];
  }

  if (categoryId) where.categoryId = BigInt(categoryId);
  if (supplierId) where.supplierId = BigInt(supplierId);
  if (status) where.status = status;
  if (unit) where.unit = unit;
  if (available === 'true') where.quantity = { gt: 0 };
  if (minPrice || maxPrice) {
    where.costPrice = {};
    if (minPrice) where.costPrice.gte = parseFloat(minPrice);
    if (maxPrice) where.costPrice.lte = parseFloat(maxPrice);
  }

  return await prisma.inventoryItem.findMany({
    where,
    include: {
      category: { select: { id: true, uuid: true, name: true } },
      supplier: { select: { id: true, uuid: true, name: true } },
      _count: {
        select: {
          inventoryLogs: true,
          maintenanceLogs: true,
          alerts: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });
};

// Get inventory analytics
const getInventoryAnalyticsForSchool = async (schoolId, startDate, endDate) => {
  const where = { schoolId: BigInt(schoolId), deletedAt: null };
  const transactionWhere = { schoolId: BigInt(schoolId), deletedAt: null };

  if (startDate || endDate) {
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    
    where.createdAt = dateFilter;
    transactionWhere.createdAt = dateFilter;
  }

  const [
    totalItems,
    totalValue,
    lowStockCount,
    outOfStockCount,
    categoryStats,
    transactionStats,
    topItems,
    recentTransactions
  ] = await Promise.all([
    prisma.inventoryItem.count({ where }),
    calculateInventoryValue(schoolId),
    prisma.inventoryItem.count({ where: { ...where, status: 'LOW_STOCK' } }),
    prisma.inventoryItem.count({ where: { ...where, status: 'OUT_OF_STOCK' } }),
    prisma.inventoryItem.groupBy({
      by: ['categoryId'],
      where,
      _count: { categoryId: true },
      _sum: { quantity: true }
    }),
    prisma.inventoryLog.groupBy({
      by: ['type'],
      where: transactionWhere,
      _count: { type: true },
      _sum: { quantity: true }
    }),
    prisma.inventoryItem.findMany({
      where,
      include: {
        category: { select: { name: true } },
        _count: { select: { inventoryLogs: true } }
      },
      orderBy: { inventoryLogs: { _count: 'desc' } },
      take: 10
    }),
    prisma.inventoryLog.findMany({
      where: transactionWhere,
      include: {
        item: { select: { id: true, uuid: true, name: true, sku: true } },
        createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })
  ]);

  return {
    totalItems,
    totalValue,
    lowStockCount,
    outOfStockCount,
    categoryStats,
    transactionStats,
    topItems,
    recentTransactions,
    availabilityRate: totalItems > 0 ? ((totalItems - outOfStockCount) / totalItems) * 100 : 0
  };
};

// Calculate stock turnover
const calculateStockTurnover = async (schoolId, itemId, period = 365) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - period);

  const transactions = await prisma.inventoryLog.findMany({
    where: {
      itemId: BigInt(itemId),
      schoolId: BigInt(schoolId),
      type: { in: ['SALE', 'PURCHASE'] },
      createdAt: { gte: startDate },
      deletedAt: null
    },
    orderBy: { createdAt: 'asc' }
  });

  let totalSold = 0;
  let totalPurchased = 0;

  for (const transaction of transactions) {
    if (transaction.type === 'SALE') {
      totalSold += transaction.quantity;
    } else if (transaction.type === 'PURCHASE') {
      totalPurchased += transaction.quantity;
    }
  }

  const averageStock = (totalPurchased + totalSold) / 2;
  return averageStock > 0 ? totalSold / averageStock : 0;
};

// Export all utilities
export default {
  validateCategoryData,
  validateInventoryItemData,
  validateSupplierData,
  validatePurchaseOrderData,
  generateSKU,
  generateBarcode,
  calculateInventoryValue,
  checkLowStockItems,
  checkExpiringItems,
  checkOverdueMaintenance,
  generateAlerts,
  searchInventoryItemsAdvanced,
  getInventoryAnalyticsForSchool,
  calculateStockTurnover
}; 
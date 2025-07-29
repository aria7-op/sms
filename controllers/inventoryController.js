import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();
import inventoryUtils from '../utils/inventoryUtils.js';
import { cacheInventoryItem, invalidateInventoryCache } from '../cache/inventoryCache.js';
import inventoryService from '../services/inventoryService.js';

class InventoryController {
  // Create inventory category
  async createCategory(req, res) {
    try {
      const { error, value } = inventoryUtils.validateCategoryData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId, id: userId } = req.user;
      const categoryData = { ...value, schoolId, createdBy: userId };

      // Generate code if not provided
      if (!categoryData.code) {
        categoryData.code = await inventoryUtils.generateSKU('CAT', schoolId);
      }

      const category = await prisma.inventoryCategory.create({
        data: categoryData,
        include: {
          parent: { select: { id: true, uuid: true, name: true } },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Inventory category created successfully',
        data: category
      });
    } catch (error) {
      console.error('Category creation error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get all categories
  async getCategories(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        parentId,
        isActive,
        search,
        sortBy = 'name',
        sortOrder = 'asc'
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { schoolId: BigInt(schoolId), deletedAt: null };

      if (parentId) where.parentId = BigInt(parentId);
      if (isActive !== undefined) where.isActive = isActive === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [categories, total] = await Promise.all([
        prisma.inventoryCategory.findMany({
          where,
          include: {
            parent: { select: { id: true, uuid: true, name: true } },
            children: { select: { id: true, uuid: true, name: true } },
            _count: {
              select: {
                items: true,
                children: true
              }
            },
            createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.inventoryCategory.count({ where })
      ]);

      res.json({
        success: true,
        data: categories,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get categories error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create inventory item
  async createItem(req, res) {
    try {
      const { error, value } = inventoryUtils.validateInventoryItemData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId, id: userId } = req.user;
      const itemData = { ...value, schoolId, createdBy: userId };

      // Generate SKU and barcode if not provided
      if (!itemData.sku) {
        itemData.sku = await inventoryUtils.generateSKU('INV', schoolId);
      }
      if (!itemData.barcode) {
        itemData.barcode = await inventoryUtils.generateBarcode(schoolId);
      }

      // Set initial status
      itemData.status = itemData.quantity > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK';

      const item = await prisma.inventoryItem.create({
        data: itemData,
        include: {
          category: { select: { id: true, uuid: true, name: true } },
          supplier: { select: { id: true, uuid: true, name: true } },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      // Cache item
      await cacheInventoryItem(item);

      res.status(201).json({
        success: true,
        message: 'Inventory item created successfully',
        data: item
      });
    } catch (error) {
      console.error('Item creation error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get all inventory items
  async getItems(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        categoryId,
        supplierId,
        status,
        unit,
        minPrice,
        maxPrice,
        search,
        sortBy = 'name',
        sortOrder = 'asc',
        lowStock = false,
        expiring = false
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { schoolId: BigInt(schoolId), deletedAt: null };

      // Apply filters
      if (categoryId) where.categoryId = BigInt(categoryId);
      if (supplierId) where.supplierId = BigInt(supplierId);
      if (status) where.status = status;
      if (unit) where.unit = unit;
      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price.gte = parseFloat(minPrice);
        if (maxPrice) where.price.lte = parseFloat(maxPrice);
      }
      if (lowStock === 'true') where.quantity = { lte: { minQuantity: true } };
      if (expiring === 'true') {
        where.expiryDate = { 
          gte: new Date(),
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        };
      }
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { brand: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [items, total] = await Promise.all([
        prisma.inventoryItem.findMany({
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
            },
            createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.inventoryItem.count({ where })
      ]);

      res.json({
        success: true,
        data: items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get items error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get item by ID
  async getItemById(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const item = await prisma.inventoryItem.findFirst({
        where: { id: BigInt(id), schoolId: BigInt(schoolId), deletedAt: null },
        include: {
          category: { select: { id: true, uuid: true, name: true } },
          supplier: { select: { id: true, uuid: true, name: true } },
          inventoryLogs: {
            include: {
              createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          maintenanceLogs: {
            include: {
              createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          alerts: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          updatedByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      if (!item) {
        return res.status(404).json({ success: false, message: 'Inventory item not found' });
      }

      res.json({ success: true, data: item });
    } catch (error) {
      console.error('Get item error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Update inventory item
  async updateItem(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const updateData = req.body;

      const existingItem = await prisma.inventoryItem.findFirst({
        where: { id: BigInt(id), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!existingItem) {
        return res.status(404).json({ success: false, message: 'Inventory item not found' });
      }

      // Validate update data
      const { error } = inventoryUtils.validateInventoryItemData(updateData, true);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      // Update status based on quantity
      if (updateData.quantity !== undefined) {
        if (updateData.quantity <= 0) {
          updateData.status = 'OUT_OF_STOCK';
        } else if (updateData.quantity <= existingItem.minQuantity) {
          updateData.status = 'LOW_STOCK';
        } else {
          updateData.status = 'AVAILABLE';
        }
      }

      const updatedItem = await prisma.inventoryItem.update({
        where: { id: BigInt(id) },
        data: { ...updateData, updatedBy: userId },
        include: {
          category: { select: { id: true, uuid: true, name: true } },
          supplier: { select: { id: true, uuid: true, name: true } },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          updatedByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      // Update cache
      await cacheInventoryItem(updatedItem);

      res.json({
        success: true,
        message: 'Inventory item updated successfully',
        data: updatedItem
      });
    } catch (error) {
      console.error('Update item error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Delete inventory item (soft delete)
  async deleteItem(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;

      const item = await prisma.inventoryItem.findFirst({
        where: { id: BigInt(id), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!item) {
        return res.status(404).json({ success: false, message: 'Inventory item not found' });
      }

      await prisma.inventoryItem.update({
        where: { id: BigInt(id) },
        data: { deletedAt: new Date(), updatedBy: userId }
      });

      // Invalidate cache
      await invalidateInventoryCache(id, schoolId);

      res.json({ success: true, message: 'Inventory item deleted successfully' });
    } catch (error) {
      console.error('Delete item error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create inventory transaction
  async createTransaction(req, res) {
    try {
      const { itemId, quantity, type, unitPrice, location, remarks } = req.body;
      const { schoolId, id: userId } = req.user;

      const item = await prisma.inventoryItem.findFirst({
        where: { id: BigInt(itemId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!item) {
        return res.status(404).json({ success: false, message: 'Inventory item not found' });
      }

      const previousQuantity = item.quantity;
      let newQuantity = previousQuantity;

      // Calculate new quantity based on transaction type
      switch (type) {
        case 'PURCHASE':
        case 'RETURN':
          newQuantity += quantity;
          break;
        case 'SALE':
        case 'DAMAGE':
        case 'LOSS':
        case 'EXPIRY':
          if (quantity > previousQuantity) {
            return res.status(400).json({ success: false, message: 'Insufficient stock' });
          }
          newQuantity -= quantity;
          break;
        case 'ADJUSTMENT':
          newQuantity = quantity;
          break;
        default:
          return res.status(400).json({ success: false, message: 'Invalid transaction type' });
      }

      // Create transaction log
      const transaction = await prisma.inventoryLog.create({
        data: {
          itemId: BigInt(itemId),
          quantity,
          type,
          unitPrice: unitPrice || item.costPrice,
          totalAmount: (unitPrice || item.costPrice) * quantity,
          previousQuantity,
          newQuantity,
          location,
          remarks,
          schoolId: BigInt(schoolId),
          createdBy: userId
        },
        include: {
          item: { select: { id: true, uuid: true, name: true, sku: true } },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      // Update item quantity
      await prisma.inventoryItem.update({
        where: { id: BigInt(itemId) },
        data: { 
          quantity: newQuantity,
          status: newQuantity <= 0 ? 'OUT_OF_STOCK' : 
                  newQuantity <= item.minQuantity ? 'LOW_STOCK' : 'AVAILABLE'
        }
      });

      res.status(201).json({
        success: true,
        message: 'Inventory transaction created successfully',
        data: transaction
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create supplier
  async createSupplier(req, res) {
    try {
      const { error, value } = inventoryUtils.validateSupplierData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId, id: userId } = req.user;
      const supplierData = { ...value, schoolId, createdBy: userId };

      // Generate code if not provided
      if (!supplierData.code) {
        supplierData.code = await inventoryUtils.generateSKU('SUP', schoolId);
      }

      const supplier = await prisma.inventorySupplier.create({
        data: supplierData,
        include: {
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: supplier
      });
    } catch (error) {
      console.error('Supplier creation error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get all suppliers
  async getSuppliers(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        status,
        search,
        sortBy = 'name',
        sortOrder = 'asc'
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { schoolId: BigInt(schoolId), deletedAt: null };

      if (status) where.status = status;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { contactPerson: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [suppliers, total] = await Promise.all([
        prisma.inventorySupplier.findMany({
          where,
          include: {
            _count: {
              select: {
                items: true,
                purchaseOrders: true
              }
            },
            createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.inventorySupplier.count({ where })
      ]);

      res.json({
        success: true,
        data: suppliers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get suppliers error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create purchase order
  async createPurchaseOrder(req, res) {
    try {
      const { error, value } = inventoryUtils.validatePurchaseOrderData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId, id: userId } = req.user;
      const { items, ...orderData } = value;

      // Generate PO number
      const poNumber = await inventoryUtils.generateSKU('PO', schoolId);

      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          ...orderData,
          poNumber,
          schoolId: BigInt(schoolId),
          createdBy: userId,
          items: {
            create: items.map(item => ({
              itemId: BigInt(item.itemId),
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              remarks: item.remarks,
              schoolId: BigInt(schoolId)
            }))
          }
        },
        include: {
          supplier: { select: { id: true, uuid: true, name: true } },
          items: {
            include: {
              item: { select: { id: true, uuid: true, name: true, sku: true } }
            }
          },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Purchase order created successfully',
        data: purchaseOrder
      });
    } catch (error) {
      console.error('Purchase order creation error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get purchase orders
  async getPurchaseOrders(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        status,
        supplierId,
        startDate,
        endDate,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { schoolId: BigInt(schoolId), deletedAt: null };

      if (status) where.status = status;
      if (supplierId) where.supplierId = BigInt(supplierId);
      if (startDate || endDate) {
        where.orderDate = {};
        if (startDate) where.orderDate.gte = new Date(startDate);
        if (endDate) where.orderDate.lte = new Date(endDate);
      }
      if (search) {
        where.OR = [
          { poNumber: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [orders, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
          where,
          include: {
            supplier: { select: { id: true, uuid: true, name: true } },
            items: {
              include: {
                item: { select: { id: true, uuid: true, name: true, sku: true } }
              }
            },
            createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } },
            approvedByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.purchaseOrder.count({ where })
      ]);

      res.json({
        success: true,
        data: orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get purchase orders error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Approve purchase order
  async approvePurchaseOrder(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;

      const order = await prisma.purchaseOrder.findFirst({
        where: { id: BigInt(id), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!order) {
        return res.status(404).json({ success: false, message: 'Purchase order not found' });
      }

      if (order.status !== 'PENDING_APPROVAL') {
        return res.status(400).json({ success: false, message: 'Purchase order cannot be approved' });
      }

      const updatedOrder = await prisma.purchaseOrder.update({
        where: { id: BigInt(id) },
        data: {
          status: 'APPROVED',
          approvedBy: userId,
          approvedAt: new Date(),
          updatedBy: userId
        },
        include: {
          supplier: { select: { id: true, uuid: true, name: true } },
          items: {
            include: {
              item: { select: { id: true, uuid: true, name: true, sku: true } }
            }
          },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          approvedByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      res.json({
        success: true,
        message: 'Purchase order approved successfully',
        data: updatedOrder
      });
    } catch (error) {
      console.error('Approve purchase order error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Search inventory items
  async searchItems(req, res) {
    try {
      const { schoolId } = req.user;
      const { query, categoryId, supplierId, status, available } = req.query;

      const searchResults = await inventoryService.searchInventoryItems(schoolId, {
        query,
        categoryId,
        supplierId,
        status,
        available: available === 'true'
      });

      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      console.error('Search items error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get inventory analytics
  async getInventoryAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate } = req.query;

      const analytics = await inventoryService.getInventoryAnalytics(schoolId, {
        startDate,
        endDate
      });

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get inventory analytics error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Generate inventory report
  async generateInventoryReport(req, res) {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate, format = 'json' } = req.query;

      const where = { schoolId: BigInt(schoolId), deletedAt: null };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const items = await prisma.inventoryItem.findMany({
        where,
        include: {
          category: { select: { name: true } },
          supplier: { select: { name: true } },
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

      const totalValue = await inventoryUtils.calculateInventoryValue(schoolId);

      if (format === 'csv') {
        // Generate CSV report
        const csvData = items.map(item => ({
          'Name': item.name,
          'SKU': item.sku || 'N/A',
          'Category': item.category?.name || 'N/A',
          'Supplier': item.supplier?.name || 'N/A',
          'Quantity': item.quantity,
          'Unit': item.unit,
          'Status': item.status,
          'Cost Price': item.costPrice || 0,
          'Selling Price': item.sellingPrice || 0,
          'Total Value': (item.costPrice || 0) * item.quantity,
          'Location': item.location || 'N/A',
          'Last Updated': item.updatedAt
        }));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=inventory-report.csv');
        // Convert to CSV string and send
        res.send(csvData);
      } else {
        res.json({
          success: true,
          data: items,
          summary: {
            totalItems: items.length,
            totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
            totalValue,
            lowStockItems: items.filter(item => item.status === 'LOW_STOCK').length,
            outOfStockItems: items.filter(item => item.status === 'OUT_OF_STOCK').length
          }
        });
      }
    } catch (error) {
      console.error('Generate inventory report error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export default new InventoryController(); 
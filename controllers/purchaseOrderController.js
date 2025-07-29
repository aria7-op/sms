import PurchaseOrder from '../models/PurchaseOrder.js';
import PurchaseOrderItem from '../models/PurchaseOrderItem.js';
import InventorySupplier from '../models/InventorySupplier.js';
import InventoryItem from '../models/InventoryItem.js';
import User from '../models/User.js';
import { Op } from 'sequelize';
import { validatePurchaseOrder, validatePurchaseOrderItem } from '../validators/purchaseOrderValidator.js';

// Create a new purchase order
const createPurchaseOrder = async (req, res) => {
  try {
    const { error } = validatePurchaseOrder(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => detail.message)
      });
    }

    const {
      supplierId,
      orderDate,
      expectedDeliveryDate,
      status,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
      currency,
      paymentTerms,
      deliveryAddress,
      notes,
      items
    } = req.body;

    // Generate PO number
    const poNumber = PurchaseOrder.generatePONumber(req.user.schoolId);

    // Create purchase order
    const purchaseOrder = await PurchaseOrder.create({
      poNumber,
      supplierId,
      orderDate: new Date(orderDate),
      expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
      status: status || 'DRAFT',
      subtotal: subtotal || 0,
      taxAmount: taxAmount || 0,
      discountAmount: discountAmount || 0,
      totalAmount: totalAmount || 0,
      currency: currency || 'USD',
      paymentTerms,
      deliveryAddress,
      notes,
      schoolId: req.user.schoolId,
      createdBy: req.user.id
    });

    // Create purchase order items if provided
    if (items && items.length > 0) {
      const orderItems = items.map(item => ({
        purchaseOrderId: purchaseOrder.id,
        itemId: item.itemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.quantity * item.unitPrice,
        remarks: item.remarks,
        schoolId: req.user.schoolId
      }));

      await PurchaseOrderItem.bulkCreate(orderItems);
      
      // Recalculate totals
      await purchaseOrder.calculateTotals();
      await purchaseOrder.save();
    }

    // Fetch the created purchase order with relations
    const createdOrder = await PurchaseOrder.findByPk(purchaseOrder.id, {
      include: [
        {
          model: InventorySupplier,
          as: 'supplier',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: PurchaseOrderItem,
          as: 'items',
          include: [
            {
              model: InventoryItem,
              as: 'item',
              attributes: ['id', 'name', 'sku', 'unit']
            }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: createdOrder
    });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create purchase order',
      error: error.message
    });
  }
};

// Get all purchase orders with filtering and pagination
const getPurchaseOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      supplierId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {
      schoolId: req.user.schoolId
    };

    // Add filters
    if (status) {
      whereClause.status = status;
    }
    if (supplierId) {
      whereClause.supplierId = supplierId;
    }
    if (startDate && endDate) {
      whereClause.orderDate = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    if (minAmount || maxAmount) {
      whereClause.totalAmount = {};
      if (minAmount) whereClause.totalAmount[Op.gte] = minAmount;
      if (maxAmount) whereClause.totalAmount[Op.lte] = maxAmount;
    }
    if (search) {
      whereClause[Op.or] = [
        { poNumber: { [Op.iLike]: `%${search}%` } },
        { notes: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: InventorySupplier,
          as: 'supplier',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: PurchaseOrderItem,
          as: 'items',
          include: [
            {
              model: InventoryItem,
              as: 'item',
              attributes: ['id', 'name', 'sku']
            }
          ]
        },
        {
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'approvedByUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      message: 'Purchase orders retrieved successfully',
      data: {
        purchaseOrders: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase orders',
      error: error.message
    });
  }
};

// Get purchase order by ID
const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [
        {
          model: InventorySupplier,
          as: 'supplier',
          attributes: ['id', 'name', 'email', 'phone', 'address']
        },
        {
          model: PurchaseOrderItem,
          as: 'items',
          include: [
            {
              model: InventoryItem,
              as: 'item',
              attributes: ['id', 'name', 'sku', 'unit', 'description']
            }
          ]
        },
        {
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'approvedByUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: User,
          as: 'updatedByUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }
      ]
    });

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (purchaseOrder.schoolId !== req.user.schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      message: 'Purchase order retrieved successfully',
      data: purchaseOrder
    });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase order',
      error: error.message
    });
  }
};

// Update purchase order
const updatePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const purchaseOrder = await PurchaseOrder.findByPk(id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (purchaseOrder.schoolId !== req.user.schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Prevent updates if order is already received or cancelled
    if (['RECEIVED', 'CANCELLED'].includes(purchaseOrder.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot update purchase order in current status'
      });
    }

    // Update the purchase order
    await purchaseOrder.update({
      ...updateData,
      updatedBy: req.user.id
    });

    // Recalculate totals if items were updated
    if (updateData.items) {
      await purchaseOrder.calculateTotals();
      await purchaseOrder.save();
    }

    const updatedOrder = await PurchaseOrder.findByPk(id, {
      include: [
        {
          model: InventorySupplier,
          as: 'supplier',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: PurchaseOrderItem,
          as: 'items',
          include: [
            {
              model: InventoryItem,
              as: 'item',
              attributes: ['id', 'name', 'sku', 'unit']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update purchase order',
      error: error.message
    });
  }
};

// Update purchase order status
const updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const purchaseOrder = await PurchaseOrder.findByPk(id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (purchaseOrder.schoolId !== req.user.schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate status transition
    const validTransitions = {
      'DRAFT': ['PENDING', 'CANCELLED'],
      'PENDING': ['APPROVED', 'CANCELLED'],
      'APPROVED': ['ORDERED', 'CANCELLED'],
      'ORDERED': ['RECEIVED', 'CANCELLED'],
      'RECEIVED': [],
      'CANCELLED': []
    };

    if (!validTransitions[purchaseOrder.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${purchaseOrder.status} to ${status}`
      });
    }

    // Update status based on the new status
    switch (status) {
      case 'APPROVED':
        await purchaseOrder.approve(req.user.id);
        break;
      case 'ORDERED':
        await purchaseOrder.markAsOrdered();
        break;
      case 'RECEIVED':
        await purchaseOrder.markAsReceived();
        break;
      case 'CANCELLED':
        await purchaseOrder.cancel();
        break;
      default:
        purchaseOrder.status = status;
    }

    await purchaseOrder.save();

    res.json({
      success: true,
      message: 'Purchase order status updated successfully',
      data: purchaseOrder
    });
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update purchase order status',
      error: error.message
    });
  }
};

// Delete purchase order
const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrder.findByPk(id);
    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: 'Purchase order not found'
      });
    }

    if (purchaseOrder.schoolId !== req.user.schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Only allow deletion of draft orders
    if (purchaseOrder.status !== 'DRAFT') {
      return res.status(400).json({
        success: false,
        message: 'Only draft purchase orders can be deleted'
      });
    }

    await purchaseOrder.destroy();

    res.json({
      success: true,
      message: 'Purchase order deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete purchase order',
      error: error.message
    });
  }
};

// Get purchase order dashboard stats
const getPurchaseOrderStats = async (req, res) => {
  try {
    const stats = await PurchaseOrder.getDashboardStats(req.user.schoolId);
    
    // Get overdue orders count
    const overdueCount = await PurchaseOrder.count({
      where: {
        schoolId: req.user.schoolId,
        expectedDeliveryDate: {
          [Op.lt]: new Date()
        },
        status: {
          [Op.in]: ['PENDING', 'APPROVED', 'ORDERED']
        }
      }
    });

    // Get recent orders
    const recentOrders = await PurchaseOrder.findAll({
      where: { schoolId: req.user.schoolId },
      include: [
        {
          model: InventorySupplier,
          as: 'supplier',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      message: 'Purchase order stats retrieved successfully',
      data: {
        stats,
        overdueCount,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Error fetching purchase order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase order stats',
      error: error.message
    });
  }
};

// Get overdue purchase orders
const getOverduePurchaseOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where: {
        schoolId: req.user.schoolId,
        expectedDeliveryDate: {
          [Op.lt]: new Date()
        },
        status: {
          [Op.in]: ['PENDING', 'APPROVED', 'ORDERED']
        }
      },
      include: [
        {
          model: InventorySupplier,
          as: 'supplier',
          attributes: ['id', 'name', 'email', 'phone']
        }
      ],
      order: [['expectedDeliveryDate', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      message: 'Overdue purchase orders retrieved successfully',
      data: {
        purchaseOrders: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching overdue purchase orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overdue purchase orders',
      error: error.message
    });
  }
};

export {
  createPurchaseOrder,
  getPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  getPurchaseOrderStats,
  getOverduePurchaseOrders
};

import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
const InventoryMaintenanceLog = sequelize.define('InventoryMaintenanceLog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  uuid: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    unique: true,
    allowNull: false
  },
  itemId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'inventory_items',
      key: 'id'
    }
  },
  maintenanceType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['preventive', 'corrective', 'emergency']]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  performedBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  performedAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  nextMaintenanceDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: {
      isIn: [['scheduled', 'in_progress', 'completed', 'cancelled']]
    }
  },
  remarks: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  attachments: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    allowNull: false
  },
  schoolId: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'schools',
      key: 'id'
    }
  },
  createdBy: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updatedBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'inventory_maintenance_logs',
  timestamps: true,
  paranoid: true,
  indexes: [
    {
      fields: ['itemId']
    },
    {
      fields: ['maintenanceType']
    },
    {
      fields: ['status']
    },
    {
      fields: ['performedAt']
    },
    {
      fields: ['schoolId']
    }
  ]
});

// Instance methods
InventoryMaintenanceLog.prototype.scheduleNextMaintenance = function(daysFromNow = 30) {
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + daysFromNow);
  this.nextMaintenanceDate = nextDate;
  return this;
};

InventoryMaintenanceLog.prototype.markAsInProgress = function() {
  this.status = 'in_progress';
  return this;
};

InventoryMaintenanceLog.prototype.markAsCompleted = function() {
  this.status = 'completed';
  return this;
};

InventoryMaintenanceLog.prototype.cancel = function() {
  this.status = 'cancelled';
  return this;
};

InventoryMaintenanceLog.prototype.addAttachment = function(attachmentUrl) {
  if (!this.attachments) {
    this.attachments = [];
  }
  this.attachments.push(attachmentUrl);
  return this;
};

InventoryMaintenanceLog.prototype.removeAttachment = function(attachmentUrl) {
  if (this.attachments) {
    this.attachments = this.attachments.filter(url => url !== attachmentUrl);
  }
  return this;
};

// Static methods
InventoryMaintenanceLog.findByItem = function(itemId, options = {}) {
  return this.findAll({
    where: { itemId },
    order: [['performedAt', 'DESC']],
    ...options
  });
};

InventoryMaintenanceLog.findByType = function(maintenanceType, options = {}) {
  return this.findAll({
    where: { maintenanceType },
    ...options
  });
};

InventoryMaintenanceLog.findByStatus = function(status, options = {}) {
  return this.findAll({
    where: { status },
    ...options
  });
};

InventoryMaintenanceLog.findScheduled = function(options = {}) {
  return this.findAll({
    where: {
      status: 'scheduled',
      nextMaintenanceDate: {
        [sequelize.Op.lte]: new Date()
      }
    },
    ...options
  });
};

InventoryMaintenanceLog.findOverdue = function(options = {}) {
  return this.findAll({
    where: {
      status: 'scheduled',
      nextMaintenanceDate: {
        [sequelize.Op.lt]: new Date()
      }
    },
    ...options
  });
};

InventoryMaintenanceLog.getMaintenanceStats = async function(schoolId) {
  const stats = await this.findAll({
    where: { schoolId },
    attributes: [
      'maintenanceType',
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('cost')), 'totalCost']
    ],
    group: ['maintenanceType', 'status'],
    raw: true
  });
  
  return stats.reduce((acc, stat) => {
    if (!acc[stat.maintenanceType]) {
      acc[stat.maintenanceType] = {};
    }
    acc[stat.maintenanceType][stat.status] = {
      count: parseInt(stat.count),
      totalCost: parseFloat(stat.totalCost) || 0
    };
    return acc;
  }, {});
};

InventoryMaintenanceLog.getUpcomingMaintenance = async function(schoolId, days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.findAll({
    where: {
      schoolId,
      status: 'scheduled',
      nextMaintenanceDate: {
        [sequelize.Op.between]: [new Date(), futureDate]
      }
    },
    include: [
      {
        model: require('./InventoryItem'),
        as: 'item',
        attributes: ['id', 'name', 'sku', 'location']
      }
    ],
    order: [['nextMaintenanceDate', 'ASC']]
  });
};

module.exports = InventoryMaintenanceLog; 
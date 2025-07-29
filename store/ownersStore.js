import crypto from 'crypto';

// In-memory store for owners
let owners = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: '$2a$12$..1HWgy7cInmExGHQtfu3u7AGmUScGyxsZb45jmNNx8QwN8vHGc7S', // "testpassword123"
    phone: '+1234567890',
    status: 'ACTIVE',
    timezone: 'America/New_York',
    locale: 'en-US',
    emailVerified: true,
    createdAt: '2024-01-15T10:30:00.000Z',
    updatedAt: '2024-01-15T10:30:00.000Z',
    metadata: {
      department: 'Administration',
      location: 'New York',
      preferences: {
        theme: 'light',
        notifications: true
      }
    },
    _count: {
      schools: 3,
      createdUsers: 15
    }
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    password: '$2a$12$..1HWgy7cInmExGHQtfu3u7AGmUScGyxsZb45jmNNx8QwN8vHGc7S', // "testpassword123"
    phone: '+1987654321',
    status: 'ACTIVE',
    timezone: 'America/Los_Angeles',
    locale: 'en-US',
    emailVerified: true,
    createdAt: '2024-01-20T14:45:00.000Z',
    updatedAt: '2024-01-20T14:45:00.000Z',
    metadata: {
      department: 'IT',
      location: 'Los Angeles',
      preferences: {
        theme: 'dark',
        notifications: false
      }
    },
    _count: {
      schools: 2,
      createdUsers: 8
    }
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    password: '$2a$12$..1HWgy7cInmExGHQtfu3u7AGmUScGyxsZb45jmNNx8QwN8vHGc7S', // "testpassword123"
    phone: '+1555123456',
    status: 'INACTIVE',
    timezone: 'America/Chicago',
    locale: 'en-US',
    emailVerified: false,
    createdAt: '2024-02-01T09:15:00.000Z',
    updatedAt: '2024-02-01T09:15:00.000Z',
    metadata: {
      department: 'Finance',
      location: 'Chicago',
      preferences: {
        theme: 'light',
        notifications: true
      }
    },
    _count: {
      schools: 1,
      createdUsers: 3
    }
  },
  {
    id: '4',
    name: 'Alice Brown',
    email: 'alice.brown@example.com',
    password: '$2a$12$..1HWgy7cInmExGHQtfu3u7AGmUScGyxsZb45jmNNx8QwN8vHGc7S', // "testpassword123"
    phone: '+1444333222',
    status: 'SUSPENDED',
    timezone: 'America/Denver',
    locale: 'en-US',
    emailVerified: true,
    createdAt: '2024-02-10T16:20:00.000Z',
    updatedAt: '2024-02-10T16:20:00.000Z',
    metadata: {
      department: 'Marketing',
      location: 'Denver',
      preferences: {
        theme: 'dark',
        notifications: true
      }
    },
    _count: {
      schools: 0,
      createdUsers: 0
    }
  }
];

// In-memory store for sessions
let sessions = [];

// In-memory store for audit logs
let auditLogs = [];

class OwnersStore {
  // Get all owners with pagination and filtering
  getAllOwners(options = {}) {
    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      search = '',
      status = '',
      emailVerified = null,
      include = ''
    } = options;

    let filteredOwners = [...owners];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredOwners = filteredOwners.filter(owner =>
        owner.name.toLowerCase().includes(searchLower) ||
        owner.email.toLowerCase().includes(searchLower) ||
        (owner.phone && owner.phone.includes(search))
      );
    }

    // Apply status filter
    if (status) {
      filteredOwners = filteredOwners.filter(owner => owner.status === status);
    }

    // Apply email verification filter
    if (emailVerified !== null) {
      filteredOwners = filteredOwners.filter(owner => owner.emailVerified === emailVerified);
    }

    // Apply sorting
    filteredOwners.sort((a, b) => {
      let aValue = a[sort];
      let bValue = b[sort];

      if (sort === 'createdAt' || sort === 'updatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (order === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOwners = filteredOwners.slice(startIndex, endIndex);

    // Remove password from response
    const ownersWithoutPassword = paginatedOwners.map(owner => {
      const { password, ...ownerWithoutPassword } = owner;
      return ownerWithoutPassword;
    });

    return {
      items: ownersWithoutPassword,
      pagination: {
        page,
        limit,
        total: filteredOwners.length,
        totalPages: Math.ceil(filteredOwners.length / limit)
      }
    };
  }

  // Get owner by ID
  getOwnerById(id, include = '') {
    const owner = owners.find(o => o.id === id);
    if (!owner) return null;

    const { password, ...ownerWithoutPassword } = owner;
    return ownerWithoutPassword;
  }

  // Create new owner
  createOwner(ownerData) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const newOwner = {
      id,
      ...ownerData,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      metadata: ownerData.metadata || {},
      _count: {
        schools: 0,
        createdUsers: 0
      }
    };
    
    owners.push(newOwner);
    
    // Remove password from response
    const { password, ...ownerWithoutPassword } = newOwner;
    return ownerWithoutPassword;
  }

  // Create test owner with known password for testing
  createTestOwner() {
    const testOwner = {
      name: 'Test Owner',
      email: 'test@example.com',
      password: '$2a$12$..1HWgy7cInmExGHQtfu3u7AGmUScGyxsZb45jmNNx8QwN8vHGc7S', // "testpassword123"
      phone: '+1234567890',
      status: 'ACTIVE',
      timezone: 'UTC',
      locale: 'en-US',
      emailVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        department: 'Testing',
        location: 'Test Location'
      },
      _count: {
        schools: 0,
        createdUsers: 0
      }
    };
    
    // Check if test owner already exists
    const existingTestOwner = owners.find(o => o.email === 'test@example.com');
    if (existingTestOwner) {
      return existingTestOwner;
    }
    
    testOwner.id = crypto.randomUUID();
    owners.push(testOwner);
    
    // Return without password
    const { password, ...ownerWithoutPassword } = testOwner;
    return ownerWithoutPassword;
  }

  // Update owner
  updateOwner(id, updateData) {
    const ownerIndex = owners.findIndex(o => o.id === id);
    if (ownerIndex === -1) return null;

    const updatedOwner = {
      ...owners[ownerIndex],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    owners[ownerIndex] = updatedOwner;

    // Add audit log
    this.addAuditLog(id, 'UPDATE', `Updated owner: ${updatedOwner.name}`);

    const { password, ...ownerWithoutPassword } = updatedOwner;
    return ownerWithoutPassword;
  }

  // Delete owner
  deleteOwner(id) {
    const ownerIndex = owners.findIndex(o => o.id === id);
    if (ownerIndex === -1) return false;

    const deletedOwner = owners[ownerIndex];
    owners.splice(ownerIndex, 1);

    // Add audit log
    this.addAuditLog(id, 'DELETE', `Deleted owner: ${deletedOwner.name}`);

    return true;
  }

  // Find owner by email
  findByEmail(email) {
    return owners.find(o => o.email === email);
  }

  // Get owner statistics
  getStats() {
    const total = owners.length;
    const active = owners.filter(o => o.status === 'ACTIVE').length;
    const inactive = owners.filter(o => o.status === 'INACTIVE').length;
    const suspended = owners.filter(o => o.status === 'SUSPENDED').length;

    const distribution = {
      'ACTIVE': active,
      'INACTIVE': inactive,
      'SUSPENDED': suspended
    };

    return {
      total,
      active,
      inactive,
      suspended,
      distribution
    };
  }

  // Session management
  createSession(userId, accessToken, refreshToken, expiresIn) {
    const session = {
      id: crypto.randomUUID(),
      userId,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      createdAt: new Date().toISOString()
    };

    sessions.push(session);
    return session;
  }

  getSessionByToken(token) {
    return sessions.find(s => s.accessToken === token || s.refreshToken === token);
  }

  deleteSession(token) {
    const sessionIndex = sessions.findIndex(s => s.accessToken === token || s.refreshToken === token);
    if (sessionIndex !== -1) {
      sessions.splice(sessionIndex, 1);
      return true;
    }
    return false;
  }

  // Audit logs
  getAuditLogs(entityId = null) {
    if (entityId) {
      return auditLogs.filter(log => log.entityId === entityId);
    }
    return auditLogs;
  }

  // Health check
  healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      store: {
        owners: owners.length,
        sessions: sessions.length,
        auditLogs: auditLogs.length
      }
    };
  }

  // Audit logging
  addAuditLog(entityId, action, description, metadata = {}) {
    const log = {
      id: crypto.randomUUID(),
      entityId,
      action,
      description,
      metadata,
      timestamp: new Date().toISOString()
    };

    auditLogs.push(log);
    return log;
  }
}

// Create and export a singleton instance
const ownersStore = new OwnersStore();
export default ownersStore; 
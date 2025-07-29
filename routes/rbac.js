import express from 'express';
import rbacController from '../controllers/rbacController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// Utility function to convert BigInt values to strings for JSON serialization
function convertBigInts(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  }
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = convertBigInts(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

const router = express.Router();

// ======================
// POLICY MANAGEMENT ROUTES
// ======================

/**
 * @route   POST /api/rbac/policies
 * @desc    Create a new policy
 * @access  Private (Admin)
 */
router.post('/policies', authenticateToken, authorizeRoles(['ADMIN']), rbacController.createPolicy);

/**
 * @route   PUT /api/rbac/policies/:id
 * @desc    Update a policy
 * @access  Private (Admin)
 */
router.put('/policies/:id', authenticateToken, authorizeRoles(['ADMIN']), rbacController.updatePolicy);

/**
 * @route   DELETE /api/rbac/policies/:id
 * @desc    Delete a policy
 * @access  Private (Admin)
 */
router.delete('/policies/:id', authenticateToken, authorizeRoles(['ADMIN']), rbacController.deletePolicy);

/**
 * @route   POST /api/rbac/policies/assign
 * @desc    Assign a policy to a principal
 * @access  Private (Admin)
 */
router.post('/policies/assign', authenticateToken, authorizeRoles(['ADMIN']), rbacController.assignPolicy);

/**
 * @route   POST /api/rbac/policies/evaluate
 * @desc    Evaluate a policy
 * @access  Private
 */
router.post('/policies/evaluate', authenticateToken, rbacController.evaluatePolicy);

// ======================
// COMPONENT PERMISSION ROUTES
// ======================

/**
 * @route   POST /api/rbac/components/permissions
 * @desc    Create component permission
 * @access  Private (Admin)
 */
router.post('/components/permissions', authenticateToken, authorizeRoles(['ADMIN']), rbacController.createComponentPermission);

/**
 * @route   GET /api/rbac/components/permissions/:id
 * @desc    Get component permission by ID
 * @access  Private
 */
router.get('/components/permissions/:id', authenticateToken, rbacController.getComponentPermissionById);

/**
 * @route   PUT /api/rbac/components/permissions/:id
 * @desc    Update component permission
 * @access  Private (Admin)
 */
router.put('/components/permissions/:id', authenticateToken, authorizeRoles(['ADMIN']), rbacController.updateComponentPermission);

/**
 * @route   DELETE /api/rbac/components/permissions/:id
 * @desc    Delete component permission
 * @access  Private (Admin)
 */
router.delete('/components/permissions/:id', authenticateToken, authorizeRoles(['ADMIN']), rbacController.deleteComponentPermission);

// ======================
// FILE ACCESS CONTROL ROUTES
// ======================

/**
 * @route   POST /api/rbac/files/policies
 * @desc    Create file access policy
 * @access  Private (Admin)
 */
router.post('/files/policies', authenticateToken, authorizeRoles(['ADMIN']), rbacController.createFilePolicy);

/**
 * @route   POST /api/rbac/files/:fileId/check/:action
 * @desc    Check file access permission
 * @access  Private
 */
router.post('/files/:fileId/check/:action', authenticateToken, rbacController.checkFileAccessEndpoint);

// ======================
// ACCESS CONTROL ROUTES
// ======================

/**
 * @route   POST /api/rbac/access/token
 * @desc    Generate frontend access token
 * @access  Private
 */
router.post('/access/token', authenticateToken, rbacController.generateAccessToken);

/**
 * @route   POST /api/rbac/access/check
 * @desc    Check access permission
 * @access  Private
 */
router.post('/access/check', authenticateToken, rbacController.checkAccess);

// ======================
// ROLES MANAGEMENT ROUTES
// ======================

/**
 * @route   GET /api/rbac/roles
 * @desc    Get all available roles
 * @access  Private
 */
router.get('/roles', authenticateToken, rbacController.getRoles);

/**
 * @route   POST /api/rbac/roles
 * @desc    Create a new role
 * @access  Private (SUPER_ADMIN)
 */
router.post('/roles', authenticateToken, authorizeRoles(['SUPER_ADMIN']), rbacController.createRole);

/**
 * @route   PUT /api/rbac/roles/:id
 * @desc    Update a role
 * @access  Private (SUPER_ADMIN)
 */
router.put('/roles/:id', authenticateToken, authorizeRoles(['SUPER_ADMIN']), rbacController.updateRole);

/**
 * @route   DELETE /api/rbac/roles/:id
 * @desc    Delete a role
 * @access  Private (SUPER_ADMIN)
 */
router.delete('/roles/:id', authenticateToken, authorizeRoles(['SUPER_ADMIN']), rbacController.deleteRole);

// ======================
// COMPONENTS MANAGEMENT ROUTES
// ======================

/**
 * @route   GET /api/rbac/components
 * @desc    Get all available components
 * @access  Private
 */
router.get('/components', authenticateToken, rbacController.getComponents);

/**
 * @route   POST /api/rbac/components
 * @desc    Create a new component
 * @access  Private (SUPER_ADMIN)
 */
router.post('/components', authenticateToken, authorizeRoles(['SUPER_ADMIN']), rbacController.createComponent);

/**
 * @route   PUT /api/rbac/components/:id
 * @desc    Update a component
 * @access  Private (SUPER_ADMIN)
 */
router.put('/components/:id', authenticateToken, authorizeRoles(['SUPER_ADMIN']), rbacController.updateComponent);

/**
 * @route   DELETE /api/rbac/components/:id
 * @desc    Delete a component
 * @access  Private (SUPER_ADMIN)
 */
router.delete('/components/:id', authenticateToken, authorizeRoles(['SUPER_ADMIN']), rbacController.deleteComponent);

// ======================
// BASIC PERMISSION ROUTES
// ======================

/**
 * @route   GET /api/rbac/permissions
 * @desc    Get all permissions
 * @access  Private (Admin)
 */
router.get('/permissions', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const permissions = await prisma.permission.findMany({
      include: {
        assignments: {
          include: {
            user: true,
            role: true,
            group: true
          }
        }
      }
    });

    res.json({ success: true, data: convertBigInts(permissions) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/rbac/permissions
 * @desc    Create a new permission
 * @access  Private (Admin)
 */
router.post('/permissions', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { name, description, resourceType, resourceId, action, conditions, schoolId, ownerId } = req.body;

    const permission = await prisma.permission.create({
      data: {
        name,
        description,
        resourceType,
        resourceId,
        action,
        conditions,
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null,
        createdBy: BigInt(req.user.id)
      }
    });

    res.json({ success: true, data: convertBigInts(permission) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ======================
// ADVANCED PERMISSION ASSIGNMENT ROUTES
// ======================

/**
 * @route   POST /api/rbac/permissions/assign
 * @desc    Assign permission to user, role, or group
 * @access  Private (Admin)
 */
router.post('/permissions/assign', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { userId, roleId, groupId, permissionId, scope, resource, action, conditions, priority, expiresAt } = req.body;

    const assignment = await prisma.permissionAssignment.create({
      data: {
        userId: userId ? BigInt(userId) : null,
        roleId: roleId ? BigInt(roleId) : null,
        groupId: groupId ? BigInt(groupId) : null,
        permissionId: BigInt(permissionId),
        scope,
        resource,
        action,
        conditions,
        priority,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        assignedBy: BigInt(req.user.id)
      }
    });

    res.json({ success: true, data: convertBigInts(assignment) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/rbac/permissions/assign/bulk
 * @desc    Bulk assign permissions
 * @access  Private (Admin)
 */
router.post('/permissions/assign/bulk', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { assignments } = req.body;

    const results = await prisma.permissionAssignment.createMany({
      data: assignments.map(assignment => ({
        userId: assignment.userId ? BigInt(assignment.userId) : null,
        roleId: assignment.roleId ? BigInt(assignment.roleId) : null,
        groupId: assignment.groupId ? BigInt(assignment.groupId) : null,
        permissionId: BigInt(assignment.permissionId),
        scope: assignment.scope || 'global',
        resource: assignment.resource,
        action: assignment.action,
        conditions: assignment.conditions,
        priority: assignment.priority || 1,
        expiresAt: assignment.expiresAt ? new Date(assignment.expiresAt) : null,
        assignedBy: BigInt(req.user.id)
      }))
    });

    res.json({ success: true, data: convertBigInts(results) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/rbac/permissions/assign/:assignmentId
 * @desc    Remove permission assignment
 * @access  Private (Admin)
 */
router.delete('/permissions/assign/:assignmentId', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { assignmentId } = req.params;

    await prisma.permissionAssignment.delete({
      where: { id: BigInt(assignmentId) }
    });

    res.json({ success: true, message: 'Permission assignment removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/rbac/permissions/user/:userId/effective
 * @desc    Get user's effective permissions (direct + role-inherited)
 * @access  Private
 */
router.get('/permissions/user/:userId/effective', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // 1. Get all active roles for the user
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: { userId: BigInt(userId), isActive: true },
      select: { roleId: true }
    });
    const roleIds = userRoles.map(r => r.roleId);

    // 2. Get all permissions for those roles from permission_assignments table
    let rolePermissions = [];
    if (roleIds.length > 0) {
      rolePermissions = await prisma.permissionAssignment.findMany({
        where: {
          roleId: { in: roleIds },
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: { permission: true, role: true }
      });
    }

    // 3. Get all permissions for those roles from permissions table (direct role permissions)
    let directRolePermissions = [];
    if (roleIds.length > 0) {
      directRolePermissions = await prisma.permission.findMany({
        where: {
          rolePermissions: {
            some: {
              roleId: { in: roleIds }
            }
          },
          isActive: true
        }
      });
    }

    // 4. Get direct user permissions from permission_assignments
    const userPermissions = await prisma.permissionAssignment.findMany({
      where: {
        userId: BigInt(userId),
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: { permission: true }
    });

    // 5. Get direct user permissions from permissions table
    const directUserPermissions = await prisma.permission.findMany({
      where: {
        userPermissions: {
          some: {
            userId: BigInt(userId),
            isGranted: true
          }
        },
        isActive: true
      }
    });

    // 6. Get group permissions
    const userGroups = await prisma.group.findMany({
      where: {
        users: { some: { id: BigInt(userId) } }
      },
      select: { id: true }
    });
    const groupIds = userGroups.map(g => g.id);
    let groupPermissions = [];
    if (groupIds.length > 0) {
      groupPermissions = await prisma.permissionAssignment.findMany({
        where: {
          groupId: { in: groupIds },
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: { permission: true, group: true }
      });
    }

    // 7. Combine all permissions and format them cleanly
    const allPermissions = [
      ...rolePermissions,
      ...userPermissions,
      ...groupPermissions,
      // Convert direct permissions to clean format
      ...directRolePermissions.map(perm => ({
        id: `direct_role_${perm.id}`,
        permissionId: perm.id,
        permissionName: perm.name,
        action: perm.action,
        resourceType: perm.resourceType,
        resourceId: perm.resourceId,
        scope: perm.scope,
        description: perm.description,
        source: 'role',
        roleId: roleIds[0]
      })),
      ...directUserPermissions.map(perm => ({
        id: `direct_user_${perm.id}`,
        permissionId: perm.id,
        permissionName: perm.name,
        action: perm.action,
        resourceType: perm.resourceType,
        resourceId: perm.resourceId,
        scope: perm.scope,
        description: perm.description,
        source: 'user'
      }))
    ];

    // Clean up assignment-based permissions
    const cleanPermissions = allPermissions.map(perm => {
      if (perm.permission) {
        return {
          id: perm.id?.toString(),
          permissionId: perm.permissionId?.toString(),
          permissionName: perm.permission.name,
          action: perm.permission.action,
          resourceType: perm.permission.resourceType,
          resourceId: perm.permission.resourceId,
          scope: perm.permission.scope,
          description: perm.permission.description,
          source: perm.roleId ? 'role' : perm.groupId ? 'group' : 'user',
          roleId: perm.roleId?.toString(),
          groupId: perm.groupId?.toString()
        };
      }
      return {
        ...perm,
        id: perm.id?.toString(),
        permissionId: perm.permissionId?.toString(),
        roleId: perm.roleId?.toString(),
        groupId: perm.groupId?.toString()
      };
    });

    res.json({ success: true, data: cleanPermissions });
  } catch (error) {
    console.error('Effective permissions error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/rbac/permissions/assignments
 * @desc    Get all permission assignments
 * @access  Private (Admin)
 */
router.get('/permissions/assignments', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const assignments = await prisma.permissionAssignment.findMany({
      include: {
        user: true,
        role: true,
        group: true,
        permission: true
      },
      orderBy: { assignedAt: 'desc' }
    });

    res.json({ success: true, data: convertBigInts(assignments) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/rbac/roles/:roleId/inherit
 * @desc    Set role inheritance
 * @access  Private (Admin)
 */
router.post('/roles/:roleId/inherit', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { roleId } = req.params;
    const { parentRoleId, inheritanceType, conditions } = req.body;

    const inheritance = await prisma.roleInheritance.create({
      data: {
        inheritingRoleId: BigInt(roleId),
        parentRoleId: BigInt(parentRoleId),
        createdBy: BigInt(req.user.id)
      }
    });

    res.json({ success: true, data: inheritance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/rbac/roles/:roleId/hierarchy
 * @desc    Get role hierarchy
 * @access  Private
 */
router.get('/roles/:roleId/hierarchy', authenticateToken, async (req, res) => {
  try {
    const { roleId } = req.params;

    const hierarchy = await prisma.roleInheritance.findMany({
      where: {
        OR: [
          { inheritingRoleId: BigInt(roleId) },
          { parentRoleId: BigInt(roleId) }
        ]
      },
      include: {
        inheritingRole: true,
        parentRole: true
      }
    });

    res.json({ success: true, data: hierarchy });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/rbac/groups
 * @desc    Create a new group
 * @access  Private (Admin)
 */
router.post('/groups', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { name, description, type, schoolId, ownerId } = req.body;

    const group = await prisma.group.create({
      data: {
        name,
        description,
        type,
        schoolId: schoolId ? BigInt(schoolId) : null,
        ownerId: ownerId ? BigInt(ownerId) : null,
        createdBy: BigInt(req.user.id)
      }
    });

    res.json({ success: true, data: convertBigInts(group) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/rbac/groups
 * @desc    Get all groups
 * @access  Private
 */
router.get('/groups', authenticateToken, async (req, res) => {
  try {
    const groups = await prisma.group.findMany({
      where: { isActive: true },
      include: {
        users: true,
        permissionAssignments: {
          include: {
            permission: true
          }
        }
      }
    });

    res.json({ success: true, data: convertBigInts(groups) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   POST /api/rbac/groups/:groupId/users
 * @desc    Add user to group
 * @access  Private (Admin)
 */
router.post('/groups/:groupId/users', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { userId } = req.body;

    await prisma.group.update({
      where: { id: BigInt(groupId) },
      data: {
        users: {
          connect: { id: BigInt(userId) }
        }
      }
    });

    res.json({ success: true, message: 'User added to group' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   DELETE /api/rbac/groups/:groupId/users/:userId
 * @desc    Remove user from group
 * @access  Private (Admin)
 */
router.delete('/groups/:groupId/users/:userId', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    await prisma.group.update({
      where: { id: BigInt(groupId) },
      data: {
        users: {
          disconnect: { id: BigInt(userId) }
        }
      }
    });

    res.json({ success: true, message: 'User removed from group' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/rbac/permissions/analytics
 * @desc    Get permission analytics
 * @access  Private (Admin)
 */
router.get('/permissions/analytics', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const analytics = await prisma.permissionAssignment.groupBy({
      by: ['permissionId', 'scope'],
      _count: {
        id: true
      },
      where: {
        isActive: true
      }
    });

    res.json({ success: true, data: convertBigInts(analytics) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * @route   GET /api/rbac/permissions/audit
 * @desc    Get permission audit logs
 * @access  Private (Admin)
 */
router.get('/permissions/audit', authenticateToken, authorizeRoles(['ADMIN', 'SUPER_ADMIN']), async (req, res) => {
  try {
    const { startDate, endDate, userId, action } = req.query;

    const where = {
      resource: 'Permission'
    };

    if (startDate) where.timestamp = { gte: new Date(startDate) };
    if (endDate) where.timestamp = { ...where.timestamp, lte: new Date(endDate) };
    if (userId) where.userId = BigInt(userId);
    if (action) where.action = action;

    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    res.json({ success: true, data: auditLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router; 
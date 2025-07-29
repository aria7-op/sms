import { PrismaClient } from '../generated/prisma/client.js';
import { createSuccessResponse, createErrorResponse } from '../utils/responseUtils.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Disable Redis for now - use memory cache only
console.log('RBAC Controller: Redis disabled - using memory cache only');
let redis = {
  setex: async () => true,
  get: async () => null,
  del: async () => true,
  keys: async () => [],
  info: async () => 'memory',
  memory: async () => ({ used_memory: 0 }),
  dbsize: async () => 0,
  ping: async () => 'PONG'
};

// In-memory cache fallback
const memoryCache = new Map();

class AdvancedAccessControlController {
  
  // ======================
  // HYBRID RBAC + ABAC ENGINE
  // ======================

  /**
   * Advanced policy evaluation engine
   */
  async evaluateAccessPolicy(user, resource, action, context = {}) {
    try {
      const policyResult = {
        allowed: false,
        reason: '',
        policies: [],
        attributes: {},
        conditions: {}
      };

      // 1. RBAC Evaluation
      const rbacResult = await this.evaluateRBAC(user, resource, action);
      policyResult.policies.push({ type: 'RBAC', result: rbacResult });

      // 2. ABAC Evaluation
      const abacResult = await this.evaluateABAC(user, resource, action, context);
      policyResult.policies.push({ type: 'ABAC', result: abacResult });

      // 3. Dynamic Conditions Evaluation
      const dynamicResult = await this.evaluateDynamicConditions(user, resource, action, context);
      policyResult.policies.push({ type: 'DYNAMIC', result: dynamicResult });

      // 4. Risk-based Access Control
      const riskResult = await this.evaluateRiskBasedAccess(user, resource, action, context);
      policyResult.policies.push({ type: 'RISK', result: riskResult });

      // 5. Composite Decision
      policyResult.allowed = this.combinePolicyResults([
        rbacResult.allowed,
        abacResult.allowed,
        dynamicResult.allowed,
        riskResult.allowed
      ]);

      policyResult.attributes = {
        ...rbacResult.attributes,
        ...abacResult.attributes,
        ...dynamicResult.attributes,
        ...riskResult.attributes
      };

      return policyResult;
    } catch (error) {
      console.error('Policy evaluation error:', error);
      return { allowed: false, reason: 'Policy evaluation failed' };
    }
  }

  /**
   * RBAC Evaluation
   */
  async evaluateRBAC(user, resource, action) {
    const userPermissions = await this.getUserPermissionsWithInheritance(user.id);
    const requiredPermission = `${resource.type}:${resource.id}:${action}`;
    
    const hasPermission = userPermissions.some(perm => 
      perm.permission.name === requiredPermission
    );

    return {
      allowed: hasPermission,
      attributes: {
        roles: user.roles,
        permissions: userPermissions.map(p => p.permission.name)
      }
    };
  }

  /**
   * ABAC Evaluation
   */
  async evaluateABAC(user, resource, action, context) {
    const policies = await prisma.accessPolicy.findMany({
      where: {
        resourceType: resource.type,
        action: action,
        isActive: true
      },
      include: {
        conditions: true,
        attributes: true
      }
    });

    let allowed = false;
    const attributes = {};

    for (const policy of policies) {
      const conditionsMet = await this.evaluatePolicyConditions(policy, user, resource, context);
      if (conditionsMet) {
        allowed = policy.effect === 'ALLOW';
        attributes[policy.name] = policy.attributes;
      }
    }

    return { allowed, attributes };
  }

  /**
   * Dynamic Conditions Evaluation
   */
  async evaluateDynamicConditions(user, resource, action, context) {
    const conditions = [
      // Time-based conditions
      this.evaluateTimeConditions(context),
      // Location-based conditions
      this.evaluateLocationConditions(user, context),
      // Device-based conditions
      this.evaluateDeviceConditions(context),
      // Network-based conditions
      this.evaluateNetworkConditions(context),
      // Behavioral conditions
      await this.evaluateBehavioralConditions(user, context)
    ];

    const allConditionsMet = conditions.every(condition => condition.met);
    
    return {
      allowed: allConditionsMet,
      attributes: {
        timeCondition: conditions[0],
        locationCondition: conditions[1],
        deviceCondition: conditions[2],
        networkCondition: conditions[3],
        behavioralCondition: conditions[4]
      }
    };
  }

  /**
   * Risk-based Access Control
   */
  async evaluateRiskBasedAccess(user, resource, action, context) {
    const riskScore = await this.calculateRiskScore(user, resource, action, context);
    const threshold = await this.getRiskThreshold(resource.type, action);
    
    return {
      allowed: riskScore <= threshold,
      attributes: {
        riskScore,
        threshold,
        riskFactors: await this.getRiskFactors(user, context)
      }
    };
  }

  // ======================
  // FRONTEND COMPONENT SECURITY
  // ======================

  /**
   * Generate secure frontend access token
   */
  async generateFrontendAccessToken(userId, context = {}) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: BigInt(userId) },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: { permission: true }
                  }
                }
              }
            }
          }
        }
      });

      // Get user's accessible components
      const accessibleComponents = await this.getUserAccessibleComponents(userId);
      
      // Get user's file access permissions
      const filePermissions = await this.getUserFilePermissions(userId);
      
      // Get user's data access scopes
      const dataScopes = await this.getUserDataScopes(userId);

      const accessToken = jwt.sign({
        userId: user.id,
        accessibleComponents,
        filePermissions,
        dataScopes,
        context,
        iat: Date.now(),
        exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }, process.env.JWT_SECRET);

      return accessToken;
    } catch (error) {
      console.error('Error generating frontend access token:', error);
      throw error;
    }
  }

  /**
   * Get user's accessible frontend components
   */
  async getUserAccessibleComponents(userId) {
    const userPermissions = await this.getUserPermissionsWithInheritance(userId);
    const components = await prisma.frontendComponent.findMany({
      where: { isActive: true },
      include: {
        permissions: {
          include: { permission: true }
        }
      }
    });

    const accessibleComponents = components.filter(component => {
      if (component.permissions.length === 0) return true;
      
      return component.permissions.some(cp => {
        const permissionName = `${cp.permission.category}:${cp.permission.entity}:${cp.permission.action}`;
        return userPermissions.some(up => 
          up.permission.name === permissionName
        );
      });
    });

    return accessibleComponents.map(component => ({
      id: component.id,
      name: component.name,
      path: component.path,
      type: component.type,
      permissions: component.permissions.map(cp => cp.permission.name)
    }));
  }

  /**
   * Get user's file access permissions
   */
  async getUserFilePermissions(userId) {
    const userPermissions = await this.getUserPermissionsWithInheritance(userId);
    const filePermissions = await prisma.filePermission.findMany({
      where: {
        userId: BigInt(userId),
        isActive: true
      },
      include: {
        file: true,
        conditions: true
      }
    });

    return filePermissions.map(fp => ({
      fileId: fp.fileId,
      fileName: fp.file.name,
      filePath: fp.file.path,
      permissions: fp.permissions,
      conditions: fp.conditions
    }));
  }

  /**
   * Get user's data access scopes
   */
  async getUserDataScopes(userId) {
    const user = await prisma.user.findUnique({
      where: { id: BigInt(userId) },
      include: {
        roles: {
          include: {
            role: {
              include: {
                dataScopes: true
              }
            }
          }
        }
      }
    });

    const dataScopes = new Set();
    user.roles.forEach(userRole => {
      userRole.role.dataScopes.forEach(scope => {
        dataScopes.add(scope.name);
      });
    });

    return Array.from(dataScopes);
  }

  // ======================
  // FILE ACCESS CONTROL
  // ======================

  /**
   * Create file access policy
   */
  async createFileAccessPolicy(req, res) {
    try {
      const {
        fileId,
        userId,
        permissions,
        conditions = {},
        expirationDate,
        metadata = {}
      } = req.body;

      const filePermission = await prisma.filePermission.create({
        data: {
          fileId: BigInt(fileId),
          userId: BigInt(userId),
          permissions,
          conditions,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          metadata,
          createdBy: req.user.id
        }
      });

      return createSuccessResponse(res, 201, 'File access policy created successfully', filePermission);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error creating file access policy', error.message);
    }
  }

  /**
   * Check file access permission
   */
  async checkFileAccess(req, res) {
    try {
      const { fileId, action } = req.params;
      const { context = {} } = req.body;

      const filePermission = await prisma.filePermission.findFirst({
        where: {
          fileId: BigInt(fileId),
          userId: BigInt(req.user.id),
          isActive: true
        },
        include: {
          file: true,
          conditions: true
        }
      });

      if (!filePermission) {
        return createErrorResponse(res, 403, 'No file access permission found');
      }

      // Check if action is allowed
      if (!filePermission.permissions.includes(action)) {
        return createErrorResponse(res, 403, 'Action not permitted on this file');
      }

      // Evaluate conditions
      const conditionsMet = await this.evaluateFileConditions(filePermission.conditions, context);
      if (!conditionsMet) {
        return createErrorResponse(res, 403, 'File access conditions not met');
      }

      // Check expiration
      if (filePermission.expirationDate && new Date() > filePermission.expirationDate) {
        return createErrorResponse(res, 403, 'File access permission has expired');
      }

      return createSuccessResponse(res, 200, 'File access granted', {
        fileId,
        action,
        permissions: filePermission.permissions,
        conditions: filePermission.conditions
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error checking file access', error.message);
    }
  }

  // ======================
  // CONTEXT-AWARE ACCESS
  // ======================

  /**
   * Evaluate time-based conditions
   */
  evaluateTimeConditions(context) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    // Check business hours (9 AM - 5 PM)
    const businessHours = currentHour >= 9 && currentHour <= 17;
    
    // Check business days (Monday - Friday)
    const businessDays = currentDay >= 1 && currentDay <= 5;

    return {
      met: businessHours && businessDays,
      details: {
        currentHour,
        currentDay,
        businessHours,
        businessDays
      }
    };
  }

  /**
   * Evaluate location-based conditions
   */
  evaluateLocationConditions(user, context) {
    const userLocation = context.location || user.lastKnownLocation;
    const allowedLocations = context.allowedLocations || ['office', 'home'];

    return {
      met: allowedLocations.includes(userLocation),
      details: {
        userLocation,
        allowedLocations
      }
    };
  }

  /**
   * Evaluate device-based conditions
   */
  evaluateDeviceConditions(context) {
    const deviceType = context.deviceType || 'unknown';
    const allowedDevices = context.allowedDevices || ['desktop', 'laptop', 'mobile'];

    return {
      met: allowedDevices.includes(deviceType),
      details: {
        deviceType,
        allowedDevices
      }
    };
  }

  /**
   * Evaluate network-based conditions
   */
  evaluateNetworkConditions(context) {
    const networkType = context.networkType || 'unknown';
    const allowedNetworks = context.allowedNetworks || ['wifi', 'ethernet'];

    return {
      met: allowedNetworks.includes(networkType),
      details: {
        networkType,
        allowedNetworks
      }
    };
  }

  /**
   * Evaluate behavioral conditions
   */
  async evaluateBehavioralConditions(user, context) {
    // Get user's recent activity patterns
    const recentActivity = await prisma.userActivity.findMany({
      where: {
        userId: BigInt(user.id),
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // Analyze behavior patterns
    const behaviorScore = this.calculateBehaviorScore(recentActivity, context);

    return {
      met: behaviorScore >= 0.7, // 70% confidence threshold
      details: {
        behaviorScore,
        recentActivityCount: recentActivity.length
      }
    };
  }

  // ======================
  // UTILITY METHODS
  // ======================

  /**
   * Combine policy results using different strategies
   */
  combinePolicyResults(results, strategy = 'ALL') {
    switch (strategy) {
      case 'ALL':
        return results.every(Boolean);
      case 'ANY':
        return results.some(Boolean);
      case 'MAJORITY':
        return results.filter(Boolean).length > results.length / 2;
      case 'WEIGHTED':
        return results.filter(Boolean).length >= 2;
      default:
        return results.every(Boolean);
    }
  }

  /**
   * Calculate behavior score
   */
  calculateBehaviorScore(activities, context) {
    const normalPatterns = activities.filter(a => 
      a.action === 'read' || a.action === 'view'
    ).length;

    const totalActivities = activities.length;
    return totalActivities > 0 ? normalPatterns / totalActivities : 0;
  }

  /**
   * Calculate risk score for access decision
   */
  async calculateRiskScore(user, resource, action, context) {
    let riskScore = 0;

    // User risk factors
    riskScore += await this.calculateUserRisk(user);
    
    // Resource risk factors
    riskScore += await this.calculateResourceRisk(resource);
    
    // Action risk factors
    riskScore += await this.calculateActionRisk(action);
    
    // Context risk factors
    riskScore += await this.calculateContextRisk(context);

    return Math.min(riskScore, 100);
  }

  /**
   * Calculate user risk factors
   */
  async calculateUserRisk(user) {
    let risk = 0;

    // Check user's recent failed login attempts
    const failedLogins = await prisma.loginAttempt.findMany({
      where: {
        userId: BigInt(user.id),
        success: false,
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    risk += failedLogins.length * 5;

    // Check user's role sensitivity
    const sensitiveRoles = ['ADMIN', 'SUPER_ADMIN', 'FINANCE'];
    if (sensitiveRoles.includes(user.role)) {
      risk += 20;
    }

    return risk;
  }

  /**
   * Calculate resource risk factors
   */
  async calculateResourceRisk(resource) {
    let risk = 0;

    // Check resource sensitivity
    const sensitiveResources = ['financial', 'personal', 'confidential'];
    if (sensitiveResources.includes(resource.sensitivity)) {
      risk += 25;
    }

    return risk;
  }

  /**
   * Calculate action risk factors
   */
  async calculateActionRisk(action) {
    const actionRiskMap = {
      'read': 5,
      'write': 15,
      'delete': 25,
      'admin': 30,
      'export': 20,
      'share': 15
    };

    return actionRiskMap[action] || 10;
  }

  /**
   * Calculate context risk factors
   */
  async calculateContextRisk(context) {
    let risk = 0;

    // Time-based risk
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      risk += 15;
    }

    // Location-based risk
    if (context.location === 'unknown' || !context.location) {
      risk += 20;
    }

    // Device-based risk
    if (context.deviceType === 'mobile' || context.deviceType === 'tablet') {
      risk += 10;
    }

    return risk;
  }

  /**
   * Get risk threshold for resource and action
   */
  async getRiskThreshold(resourceType, action) {
    const thresholds = {
      'financial': 30,
      'personal': 40,
      'confidential': 50,
      'public': 70
    };

    return thresholds[resourceType] || 60;
  }

  /**
   * Get risk factors
   */
  async getRiskFactors(user, context) {
    return {
      userRole: user.role,
      location: context.location,
      device: context.deviceType,
      time: new Date().toISOString()
    };
  }

  // ======================
  // API ENDPOINTS
  // ======================

  /**
   * Generate frontend access token
   */
  async generateAccessToken(req, res) {
    try {
      const { context = {} } = req.body;
      const token = await this.generateFrontendAccessToken(req.user.id, context);
      
      return createSuccessResponse(res, 200, 'Access token generated successfully', { token });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error generating access token', error.message);
    }
  }

  /**
   * Check access permission
   */
  async checkAccess(req, res) {
    try {
      const { resource, action } = req.body;
      const { context = {} } = req.body;

      const result = await this.evaluateAccessPolicy(req.user, resource, action, context);
      
      return createSuccessResponse(res, 200, 'Access check completed', result);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error checking access', error.message);
    }
  }

  /**
   * Create file access policy
   */
  async createFilePolicy(req, res) {
    return await this.createFileAccessPolicy(req, res);
  }

  /**
   * Check file access
   */
  async checkFileAccessEndpoint(req, res) {
    return await this.checkFileAccess(req, res);
  }

  // ======================
  // LEGACY RBAC METHODS (for backward compatibility)
  // ======================

  async cacheUserPermissions(userId, permissions) {
    try {
      const cacheKey = `user_permissions:${userId}`;
      if (redis) {
        await redis.setex(cacheKey, 3600, JSON.stringify(permissions));
      } else {
        // Use memory cache as fallback
        memoryCache.set(cacheKey, {
          data: JSON.stringify(permissions),
          expires: Date.now() + (3600 * 1000)
        });
      }
      return true;
    } catch (error) {
      console.error('Error caching user permissions:', error);
      return false;
    }
  }

  async getCachedUserPermissions(userId) {
    try {
      const cacheKey = `user_permissions:${userId}`;
      if (redis) {
        const cached = await redis.get(cacheKey);
        return cached ? JSON.parse(cached) : null;
      } else {
        // Use memory cache as fallback
        const cached = memoryCache.get(cacheKey);
        if (cached && cached.expires > Date.now()) {
          return JSON.parse(cached.data);
        }
        memoryCache.delete(cacheKey);
        return null;
      }
    } catch (error) {
      console.error('Error getting cached permissions:', error);
      return null;
    }
  }

  async invalidateUserPermissionCache(userId) {
    try {
      const cacheKey = `user_permissions:${userId}`;
      if (redis) {
        await redis.del(cacheKey);
      } else {
        memoryCache.delete(cacheKey);
      }
      return true;
    } catch (error) {
      console.error('Error invalidating cache:', error);
      return false;
    }
  }

  // Placeholder for existing methods - you would copy all the existing RBAC methods here
  async getUserPermissionsWithInheritance(userId) {
    // Implementation would go here
    return [];
  }

  async evaluatePolicyConditions(policy, user, resource, context) {
    // Implementation would go here
    return true;
  }

  async evaluateFileConditions(conditions, context) {
    // Implementation would go here
    return true;
  }

  /**
   * Create a new policy
   */
  async createPolicy(req, res) {
    try {
      const { name, description, isActive = true, isSystem = false, conditions, effect = 'allow', metadata = {} } = req.body;
      const policy = await prisma.policy.create({
        data: {
          name,
          description,
          isActive,
          isSystem,
          conditions,
          effect,
          metadata,
          createdBy: req.user.id
        }
      });
      return createSuccessResponse(res, 201, 'Policy created successfully', policy);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error creating policy', error.message);
    }
  }

  /**
   * Update a policy
   */
  async updatePolicy(req, res) {
    try {
      const { id } = req.params;
      const { name, description, isActive, isSystem, conditions, effect, metadata } = req.body;
      const policy = await prisma.policy.update({
        where: { id: BigInt(id) },
        data: {
          name,
          description,
          isActive,
          isSystem,
          conditions,
          effect,
          metadata,
          updatedBy: req.user.id
        }
      });
      return createSuccessResponse(res, 200, 'Policy updated successfully', policy);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error updating policy', error.message);
    }
  }

  /**
   * Delete a policy
   */
  async deletePolicy(req, res) {
    try {
      const { id } = req.params;
      await prisma.policy.update({
        where: { id: BigInt(id) },
        data: { deletedAt: new Date() }
      });
      return createSuccessResponse(res, 200, 'Policy deleted successfully');
    } catch (error) {
      return createErrorResponse(res, 500, 'Error deleting policy', error.message);
    }
  }

  /**
   * Assign a policy to a principal (user, role, resource)
   */
  async assignPolicy(req, res) {
    try {
      const { policyId, principalType, principalId, resourceType, resourceId, expiresAt, metadata = {} } = req.body;
      const assignment = await prisma.policyAssignment.create({
        data: {
          policyId: BigInt(policyId),
          principalType,
          principalId: BigInt(principalId),
          resourceType,
          resourceId,
          isActive: true,
          assignedBy: req.user.id,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          metadata
        }
      });
      return createSuccessResponse(res, 201, 'Policy assigned successfully', assignment);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error assigning policy', error.message);
    }
  }

  /**
   * Evaluate a policy for a user/resource/action/context
   */
  async evaluatePolicy(req, res) {
    try {
      const { userId, resource, action, context = {} } = req.body;
      // Find all active policy assignments for this user/role/resource
      const assignments = await prisma.policyAssignment.findMany({
        where: {
          principalId: BigInt(userId),
          isActive: true
        },
        include: { policy: true }
      });
      // Evaluate each policy's conditions (assume conditions is JSON logic)
      let allowed = false;
      let matchedPolicy = null;
      for (const assignment of assignments) {
        // For demo: just check if effect is allow and isActive
        if (assignment.policy.isActive && assignment.policy.effect === 'allow') {
          // TODO: Evaluate JSON logic in assignment.policy.conditions
          allowed = true;
          matchedPolicy = assignment.policy;
          break;
        }
      }
      return createSuccessResponse(res, 200, 'Policy evaluation completed', { allowed, matchedPolicy });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error evaluating policy', error.message);
    }
  }

  /**
   * Create component permission
   */
  async createComponentPermission(req, res) {
    try {
      const { componentId, roleId, userId, permission, isGranted = true, conditions = {}, createdBy } = req.body;
      const componentPermission = await prisma.componentPermission.create({
        data: {
          componentId: BigInt(componentId),
          roleId: roleId ? BigInt(roleId) : null,
          userId: userId ? BigInt(userId) : null,
          permission,
          isGranted,
          conditions,
          createdBy: createdBy || req.user.id
        }
      });
      return createSuccessResponse(res, 201, 'Component permission created successfully', componentPermission);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error creating component permission', error.message);
    }
  }

  /**
   * Get component permission by ID
   */
  async getComponentPermissionById(req, res) {
    try {
      const { id } = req.params;
      const componentPermission = await prisma.componentPermission.findUnique({
        where: { id: BigInt(id) },
        include: { component: true, role: true, user: true }
      });
      if (!componentPermission) return createErrorResponse(res, 404, 'Component permission not found');
      return createSuccessResponse(res, 200, 'Component permission fetched', componentPermission);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error fetching component permission', error.message);
    }
  }

  /**
   * Update component permission
   */
  async updateComponentPermission(req, res) {
    try {
      const { id } = req.params;
      const { permission, isGranted, conditions } = req.body;
      const componentPermission = await prisma.componentPermission.update({
        where: { id: BigInt(id) },
        data: { permission, isGranted, conditions }
      });
      return createSuccessResponse(res, 200, 'Component permission updated', componentPermission);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error updating component permission', error.message);
    }
  }

  /**
   * Delete component permission
   */
  async deleteComponentPermission(req, res) {
    try {
      const { id } = req.params;
      await prisma.componentPermission.delete({ where: { id: BigInt(id) } });
      return createSuccessResponse(res, 200, 'Component permission deleted');
    } catch (error) {
      return createErrorResponse(res, 500, 'Error deleting component permission', error.message);
    }
  }

  // ======================
  // ROLES MANAGEMENT
  // ======================

  /**
   * Get all available roles
   */
  async getRoles(req, res) {
    try {
      const roles = [
        {
          id: 'SUPER_ADMIN',
          name: 'Super Administrator',
          description: 'Full system access and control',
          permissions: ['*'],
          level: 1
        },
        {
          id: 'SCHOOL_ADMIN',
          name: 'School Administrator',
          description: 'School-level administration',
          permissions: ['school:manage', 'user:manage', 'class:manage', 'teacher:manage'],
          level: 2
        },
        {
          id: 'TEACHER',
          name: 'Teacher',
          description: 'Class and student management',
          permissions: ['class:view', 'student:manage', 'grade:manage', 'attendance:manage'],
          level: 3
        },
        {
          id: 'STUDENT',
          name: 'Student',
          description: 'Student access to courses and grades',
          permissions: ['course:view', 'grade:view', 'attendance:view'],
          level: 4
        },
        {
          id: 'STAFF',
          name: 'Staff',
          description: 'General staff access',
          permissions: ['general:view', 'report:view'],
          level: 3
        },
        {
          id: 'PARENT',
          name: 'Parent',
          description: 'Parent access to child information',
          permissions: ['child:view', 'grade:view', 'attendance:view'],
          level: 4
        },
        {
          id: 'ACCOUNTANT',
          name: 'Accountant',
          description: 'Financial management access',
          permissions: ['payment:manage', 'fee:manage', 'report:financial'],
          level: 3
        },
        {
          id: 'LIBRARIAN',
          name: 'Librarian',
          description: 'Library management access',
          permissions: ['library:manage', 'book:manage'],
          level: 3
        },
        {
          id: 'CRM_MANAGER',
          name: 'CRM Manager',
          description: 'Customer relationship management',
          permissions: ['crm:manage', 'contact:manage', 'lead:manage'],
          level: 3
        }
      ];

      return createSuccessResponse(res, 200, 'Roles retrieved successfully', roles);
    } catch (error) {
      return createErrorResponse(res, 500, 'Failed to retrieve roles', error.message);
    }
  }

  /**
   * Create a new role
   */
  async createRole(req, res) {
    try {
      const { name, description, type, permissions } = req.body;
      
      // Validate required fields
      if (!name || !type) {
        return createErrorResponse(res, 400, 'Name and type are required');
      }

      // Check if role already exists
      const existingRole = await prisma.role.findFirst({
        where: { name }
      });

      if (existingRole) {
        return createErrorResponse(res, 400, 'Role already exists');
      }

      const role = await prisma.role.create({
        data: {
          name,
          description,
          type,
          createdBy: BigInt(req.user.id)
        }
      });

      // If permissions are provided, create role-permission relationships
      if (permissions && permissions.length > 0) {
        const rolePermissions = permissions.map(permissionId => ({
          roleId: role.id,
          permissionId: BigInt(permissionId),
          createdBy: BigInt(req.user.id)
        }));

        await prisma.rolePermission.createMany({
          data: rolePermissions
        });
      }

      return createSuccessResponse(res, 201, 'Role created successfully', role);
    } catch (error) {
      return createErrorResponse(res, 500, 'Failed to create role', error.message);
    }
  }

  /**
   * Update a role
   */
  async updateRole(req, res) {
    try {
      const { id } = req.params;
      const { name, description, permissions, level } = req.body;

      const role = await prisma.role.update({
        where: { id: BigInt(id) },
        data: {
          name,
          description,
          permissions: permissions,
          level,
          updatedBy: BigInt(req.user.id)
        }
      });

      return createSuccessResponse(res, 200, 'Role updated successfully', role);
    } catch (error) {
      return createErrorResponse(res, 500, 'Failed to update role', error.message);
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(req, res) {
    try {
      const { id } = req.params;

      // Check if role is in use
      const usersWithRole = await prisma.userRole.findMany({
        where: { roleId: BigInt(id) }
      });

      if (usersWithRole.length > 0) {
        return createErrorResponse(res, 400, 'Cannot delete role that is assigned to users');
      }

      await prisma.role.delete({
        where: { id: BigInt(id) }
      });

      return createSuccessResponse(res, 200, 'Role deleted successfully');
    } catch (error) {
      return createErrorResponse(res, 500, 'Failed to delete role', error.message);
    }
  }

  // ======================
  // COMPONENTS MANAGEMENT
  // ======================

  /**
   * Get all available components
   */
  async getComponents(req, res) {
    try {
      const components = [
        {
          id: 'dashboard',
          name: 'Dashboard',
          description: 'Main dashboard component',
          category: 'navigation',
          permissions: ['dashboard:view'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STUDENT', 'STAFF', 'PARENT', 'ACCOUNTANT', 'LIBRARIAN', 'CRM_MANAGER']
        },
        {
          id: 'user-management',
          name: 'User Management',
          description: 'User administration component',
          category: 'administration',
          permissions: ['user:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN']
        },
        {
          id: 'class-management',
          name: 'Class Management',
          description: 'Class and course management',
          category: 'academic',
          permissions: ['class:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']
        },
        {
          id: 'student-management',
          name: 'Student Management',
          description: 'Student information management',
          category: 'academic',
          permissions: ['student:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']
        },
        {
          id: 'grade-management',
          name: 'Grade Management',
          description: 'Grade and assessment management',
          category: 'academic',
          permissions: ['grade:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']
        },
        {
          id: 'attendance-management',
          name: 'Attendance Management',
          description: 'Student attendance tracking',
          category: 'academic',
          permissions: ['attendance:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER']
        },
        {
          id: 'payment-management',
          name: 'Payment Management',
          description: 'Fee and payment management',
          category: 'financial',
          permissions: ['payment:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']
        },
        {
          id: 'fee-management',
          name: 'Fee Management',
          description: 'Fee structure management',
          category: 'financial',
          permissions: ['fee:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT']
        },
        {
          id: 'library-management',
          name: 'Library Management',
          description: 'Library and book management',
          category: 'academic',
          permissions: ['library:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'LIBRARIAN']
        },
        {
          id: 'crm-management',
          name: 'CRM Management',
          description: 'Customer relationship management',
          category: 'business',
          permissions: ['crm:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'CRM_MANAGER']
        },
        {
          id: 'reports',
          name: 'Reports',
          description: 'Analytics and reporting',
          category: 'analytics',
          permissions: ['report:view'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'STAFF', 'ACCOUNTANT']
        },
        {
          id: 'settings',
          name: 'Settings',
          description: 'System configuration',
          category: 'administration',
          permissions: ['settings:manage'],
          roles: ['SUPER_ADMIN', 'SCHOOL_ADMIN']
        }
      ];

      return createSuccessResponse(res, 200, 'Components retrieved successfully', components);
    } catch (error) {
      return createErrorResponse(res, 500, 'Failed to retrieve components', error.message);
    }
  }

  /**
   * Create a new component
   */
  async createComponent(req, res) {
    try {
      const { name, description, category, permissions, roles } = req.body;
      
      // Validate required fields
      if (!name || !category || !permissions) {
        return createErrorResponse(res, 400, 'Name, category, and permissions are required');
      }

      // Check if component already exists
      const existingComponent = await prisma.component.findFirst({
        where: { name }
      });

      if (existingComponent) {
        return createErrorResponse(res, 400, 'Component already exists');
      }

      const component = await prisma.component.create({
        data: {
          name,
          description,
          category,
          permissions: permissions,
          roles: roles,
          createdBy: BigInt(req.user.id)
        }
      });

      return createSuccessResponse(res, 201, 'Component created successfully', component);
    } catch (error) {
      return createErrorResponse(res, 500, 'Failed to create component', error.message);
    }
  }

  /**
   * Update a component
   */
  async updateComponent(req, res) {
    try {
      const { id } = req.params;
      const { name, description, category, permissions, roles } = req.body;

      const component = await prisma.component.update({
        where: { id: BigInt(id) },
        data: {
          name,
          description,
          category,
          permissions: permissions,
          roles,
          updatedBy: BigInt(req.user.id)
        }
      });

      return createSuccessResponse(res, 200, 'Component updated successfully', component);
    } catch (error) {
      return createErrorResponse(res, 500, 'Failed to update component', error.message);
    }
  }

  /**
   * Delete a component
   */
  async deleteComponent(req, res) {
    try {
      const { id } = req.params;

      // Check if component is in use
      const componentInUse = await prisma.componentPermission.findMany({
        where: { componentId: BigInt(id) }
      });

      if (componentInUse.length > 0) {
        return createErrorResponse(res, 400, 'Cannot delete component that has permissions assigned');
      }

      await prisma.component.delete({
        where: { id: BigInt(id) }
      });

      return createSuccessResponse(res, 200, 'Component deleted successfully');
    } catch (error) {
      return createErrorResponse(res, 500, 'Failed to delete component', error.message);
    }
  }

}

export default new AdvancedAccessControlController(); 
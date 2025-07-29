import { PrismaClient } from '../generated/prisma/client.js';
import { createSuccessResponse, createErrorResponse } from '../utils/responseUtils.js';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Disable Redis for now - use memory cache only
console.log('PBAC Controller: Redis disabled - using memory cache only');
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

class AdvancedPBACController {
  
  // ======================
  // POLICY MANAGEMENT
  // ======================

  /**
   * Create a new policy with flexible conditions
   */
  async createPolicy(req, res) {
    try {
      const {
        name,
        description,
        conditions,
        effect = 'allow',
        metadata = {},
        isSystem = false
      } = req.body;

      // Validate required fields
      if (!name || !conditions) {
        return createErrorResponse(res, 400, 'Policy name and conditions are required');
      }

      // Validate conditions format
      if (!this.validatePolicyConditions(conditions)) {
        return createErrorResponse(res, 400, 'Invalid policy conditions format');
      }

      const policy = await prisma.policy.create({
        data: {
          name,
          description,
          conditions,
          effect,
          metadata,
          isSystem,
          createdBy: req.user.id
        }
      });



      return createSuccessResponse(res, 201, 'Policy created successfully', policy);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error creating policy', error.message);
    }
  }

  /**
   * Get all policies with filtering and pagination
   */
  async getAllPolicies(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        search, 
        effect, 
        isSystem, 
        isActive 
      } = req.query;

      const whereClause = {
        deletedAt: null
      };

      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      if (effect) {
        whereClause.effect = effect;
      }

      if (isSystem !== undefined) {
        whereClause.isSystem = isSystem === 'true';
      }

      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }

      const policies = await prisma.policy.findMany({
        where: whereClause,
        include: {
          assignments: {
            include: {
              policy: true
            }
          },
          _count: {
            select: {
              assignments: true
            }
          }
        },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      });

      const total = await prisma.policy.count({ where: whereClause });

      return createSuccessResponse(res, 200, 'Policies retrieved successfully', {
        policies,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error retrieving policies', error.message);
    }
  }

  /**
   * Get policy by ID with full details
   */
  async getPolicyById(req, res) {
    try {
      const { id } = req.params;

      const policy = await prisma.policy.findUnique({
        where: { id: BigInt(id) },
        include: {
          assignments: {
            include: {
              assignedByUser: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true
                }
              }
            }
          },
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          updatedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      if (!policy) {
        return createErrorResponse(res, 404, 'Policy not found');
      }

      return createSuccessResponse(res, 200, 'Policy retrieved successfully', policy);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error retrieving policy', error.message);
    }
  }

  /**
   * Update policy
   */
  async updatePolicy(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate conditions if provided
      if (updateData.conditions && !this.validatePolicyConditions(updateData.conditions)) {
        return createErrorResponse(res, 400, 'Invalid policy conditions format');
      }

      const policy = await prisma.policy.update({
        where: { id: BigInt(id) },
        data: {
          ...updateData,
          updatedBy: req.user.id
        }
      });

      // Invalidate policy cache
      await this.invalidatePolicyCache();

      return createSuccessResponse(res, 200, 'Policy updated successfully', policy);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error updating policy', error.message);
    }
  }

  /**
   * Delete policy (soft delete)
   */
  async deletePolicy(req, res) {
    try {
      const { id } = req.params;

      // Check if policy has active assignments
      const activeAssignments = await prisma.policyAssignment.count({
        where: {
          policyId: BigInt(id),
          isActive: true
        }
      });

      if (activeAssignments > 0) {
        return createErrorResponse(res, 400, `Cannot delete policy with ${activeAssignments} active assignments`);
      }

      const policy = await prisma.policy.update({
        where: { id: BigInt(id) },
        data: { deletedAt: new Date() }
      });

      return createSuccessResponse(res, 200, 'Policy deleted successfully', policy);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error deleting policy', error.message);
    }
  }

  // ======================
  // POLICY ASSIGNMENT
  // ======================

  /**
   * Assign policy to principal (user, role, or resource)
   */
  async assignPolicy(req, res) {
    try {
      const {
        policyId,
        principalType, // USER, ROLE, RESOURCE
        principalId,
        resourceType,
        resourceId,
        expiresAt,
        metadata = {}
      } = req.body;

      // Validate principal type
      const validPrincipalTypes = ['USER', 'ROLE', 'RESOURCE'];
      if (!validPrincipalTypes.includes(principalType)) {
        return createErrorResponse(res, 400, 'Invalid principal type');
      }

      // Check if assignment already exists
      const existingAssignment = await prisma.policyAssignment.findFirst({
        where: {
          policyId: BigInt(policyId),
          principalType,
          principalId: BigInt(principalId),
          resourceType,
          resourceId,
          isActive: true
        }
      });

      if (existingAssignment) {
        return createErrorResponse(res, 400, 'Policy assignment already exists');
      }

      const assignment = await prisma.policyAssignment.create({
        data: {
          policyId: BigInt(policyId),
          principalType,
          principalId: BigInt(principalId),
          resourceType,
          resourceId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          metadata,
          assignedBy: req.user.id
        }
      });

      // Invalidate policy cache
      await this.invalidatePolicyCache();

      return createSuccessResponse(res, 201, 'Policy assigned successfully', assignment);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error assigning policy', error.message);
    }
  }

  /**
   * Get policy assignments with filtering
   */
  async getPolicyAssignments(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        policyId, 
        principalType, 
        principalId,
        resourceType,
        resourceId,
        isActive 
      } = req.query;

      const whereClause = {};

      if (policyId) {
        whereClause.policyId = BigInt(policyId);
      }

      if (principalType) {
        whereClause.principalType = principalType;
      }

      if (principalId) {
        whereClause.principalId = BigInt(principalId);
      }

      if (resourceType) {
        whereClause.resourceType = resourceType;
      }

      if (resourceId) {
        whereClause.resourceId = resourceId;
      }

      if (isActive !== undefined) {
        whereClause.isActive = isActive === 'true';
      }

      const assignments = await prisma.policyAssignment.findMany({
        where: whereClause,
        include: {
          policy: true,
          assignedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        orderBy: { assignedAt: 'desc' }
      });

      const total = await prisma.policyAssignment.count({ where: whereClause });

      return createSuccessResponse(res, 200, 'Policy assignments retrieved successfully', {
        assignments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error retrieving policy assignments', error.message);
    }
  }

  /**
   * Remove policy assignment
   */
  async removePolicyAssignment(req, res) {
    try {
      const { id } = req.params;

      const assignment = await prisma.policyAssignment.update({
        where: { id: BigInt(id) },
        data: { isActive: false }
      });

      // Invalidate policy cache
      await this.invalidatePolicyCache();

      return createSuccessResponse(res, 200, 'Policy assignment removed successfully', assignment);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error removing policy assignment', error.message);
    }
  }

  // ======================
  // POLICY EVALUATION
  // ======================

  /**
   * Evaluate policies for a user and action
   */
  async evaluatePolicies(req, res) {
    try {
      const { userId, action, resourceType, resourceId, context = {} } = req.body;

      if (!userId || !action) {
        return createErrorResponse(res, 400, 'User ID and action are required');
      }

      // Get user's policies (direct and role-based)
      const userPolicies = await this.getUserPolicies(userId, resourceType, resourceId);

      // Evaluate each policy
      const evaluationResults = [];
      let finalDecision = 'deny'; // Default deny

      for (const policy of userPolicies) {
        const result = await this.evaluatePolicy(policy, {
          user: { id: userId, ...context.user },
          action,
          resource: { type: resourceType, id: resourceId, ...context.resource },
          context
        });

        evaluationResults.push({
          policyId: policy.id,
          policyName: policy.name,
          effect: policy.effect,
          result,
          conditions: policy.conditions
        });

        // If any policy denies, final decision is deny
        if (policy.effect === 'deny' && result) {
          finalDecision = 'deny';
          break;
        }

        // If policy allows and evaluates to true, allow
        if (policy.effect === 'allow' && result) {
          finalDecision = 'allow';
        }
      }

      return createSuccessResponse(res, 200, 'Policy evaluation completed', {
        userId,
        action,
        resourceType,
        resourceId,
        finalDecision,
        evaluationResults,
        policiesEvaluated: userPolicies.length
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error evaluating policies', error.message);
    }
  }

  /**
   * Test policy conditions with sample data
   */
  async testPolicyConditions(req, res) {
    try {
      const { conditions, testData } = req.body;

      if (!conditions || !testData) {
        return createErrorResponse(res, 400, 'Conditions and test data are required');
      }

      // Validate conditions format
      if (!this.validatePolicyConditions(conditions)) {
        return createErrorResponse(res, 400, 'Invalid policy conditions format');
      }

      const result = await this.evaluatePolicyConditions(conditions, testData);

      return createSuccessResponse(res, 200, 'Policy conditions tested successfully', {
        conditions,
        testData,
        result,
        isValid: this.validatePolicyConditions(conditions)
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error testing policy conditions', error.message);
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  /**
   * Validate policy conditions format
   */
  validatePolicyConditions(conditions) {
    try {
      // Check if conditions is a valid JSON object or string
      if (typeof conditions === 'string') {
        JSON.parse(conditions);
        return true;
      }
      
      if (typeof conditions === 'object' && conditions !== null) {
        return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user's policies (direct and role-based)
   */
  async getUserPolicies(userId, resourceType, resourceId) {
    const policies = [];

    // Get direct user policy assignments
    const userAssignments = await prisma.policyAssignment.findMany({
      where: {
        principalType: 'USER',
        principalId: BigInt(userId),
        isActive: true,
        expiresAt: { gte: new Date() }
      },
      include: {
        policy: {
          where: { isActive: true, deletedAt: null }
        }
      }
    });

    // Get role-based policy assignments
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId: BigInt(userId),
        isActive: true,
        expiresAt: { gte: new Date() }
      }
    });

    const roleIds = userRoles.map(ur => ur.roleId);
    const roleAssignments = await prisma.policyAssignment.findMany({
      where: {
        principalType: 'ROLE',
        principalId: { in: roleIds },
        isActive: true,
        expiresAt: { gte: new Date() }
      },
      include: {
        policy: {
          where: { isActive: true, deletedAt: null }
        }
      }
    });

    // Add valid policies to the list
    userAssignments.forEach(assignment => {
      if (assignment.policy) {
        policies.push(assignment.policy);
      }
    });

    roleAssignments.forEach(assignment => {
      if (assignment.policy) {
        policies.push(assignment.policy);
      }
    });

    return policies;
  }

  /**
   * Evaluate a single policy
   */
  async evaluatePolicy(policy, context) {
    try {
      const conditions = policy.conditions;
      
      if (typeof conditions === 'string') {
        // Simple string expression evaluation
        return this.evaluateStringExpression(conditions, context);
      } else if (typeof conditions === 'object') {
        // JSON logic evaluation
        return this.evaluateJsonLogic(conditions, context);
      }
      
      return false;
    } catch (error) {
      console.error('Error evaluating policy:', error);
      return false;
    }
  }

  /**
   * Evaluate string expression (simple DSL)
   */
  evaluateStringExpression(expression, context) {
    try {
      // Simple variable substitution
      let evalExpression = expression;
      
      // Replace variables with context values
      evalExpression = evalExpression.replace(/\buser\.(\w+)\b/g, (match, prop) => {
        return context.user && context.user[prop] ? JSON.stringify(context.user[prop]) : 'null';
      });
      
      evalExpression = evalExpression.replace(/\bresource\.(\w+)\b/g, (match, prop) => {
        return context.resource && context.resource[prop] ? JSON.stringify(context.resource[prop]) : 'null';
      });
      
      evalExpression = evalExpression.replace(/\bcontext\.(\w+)\b/g, (match, prop) => {
        return context.context && context.context[prop] ? JSON.stringify(context.context[prop]) : 'null';
      });
      
      // Simple evaluation (be careful with this in production)
      return eval(evalExpression);
    } catch (error) {
      console.error('Error evaluating string expression:', error);
      return false;
    }
  }

  /**
   * Evaluate JSON logic
   */
  evaluateJsonLogic(logic, context) {
    try {
      // Simple JSON logic evaluation
      if (logic.if) {
        const [condition, trueValue, falseValue] = logic.if;
        const conditionResult = this.evaluateJsonCondition(condition, context);
        return conditionResult ? trueValue : falseValue;
      }
      
      if (logic.and) {
        return logic.and.every(condition => this.evaluateJsonCondition(condition, context));
      }
      
      if (logic.or) {
        return logic.or.some(condition => this.evaluateJsonCondition(condition, context));
      }
      
      if (logic.not) {
        return !this.evaluateJsonCondition(logic.not, context);
      }
      
      return this.evaluateJsonCondition(logic, context);
    } catch (error) {
      console.error('Error evaluating JSON logic:', error);
      return false;
    }
  }

  /**
   * Evaluate JSON condition
   */
  evaluateJsonCondition(condition, context) {
    try {
      if (condition['==']) {
        const [left, right] = condition['=='];
        const leftValue = this.getContextValue(left, context);
        const rightValue = this.getContextValue(right, context);
        return leftValue === rightValue;
      }
      
      if (condition['!=']) {
        const [left, right] = condition['!='];
        const leftValue = this.getContextValue(left, context);
        const rightValue = this.getContextValue(right, context);
        return leftValue !== rightValue;
      }
      
      if (condition['>']) {
        const [left, right] = condition['>'];
        const leftValue = this.getContextValue(left, context);
        const rightValue = this.getContextValue(right, context);
        return leftValue > rightValue;
      }
      
      if (condition['<']) {
        const [left, right] = condition['<'];
        const leftValue = this.getContextValue(left, context);
        const rightValue = this.getContextValue(right, context);
        return leftValue < rightValue;
      }
      
      if (condition['in']) {
        const [value, array] = condition['in'];
        const valueToCheck = this.getContextValue(value, context);
        const arrayToCheck = this.getContextValue(array, context);
        return Array.isArray(arrayToCheck) && arrayToCheck.includes(valueToCheck);
      }
      
      return false;
    } catch (error) {
      console.error('Error evaluating JSON condition:', error);
      return false;
    }
  }

  /**
   * Get value from context
   */
  getContextValue(reference, context) {
    if (typeof reference === 'string') {
      if (reference.startsWith('user.')) {
        const prop = reference.substring(5);
        return context.user ? context.user[prop] : undefined;
      }
      
      if (reference.startsWith('resource.')) {
        const prop = reference.substring(9);
        return context.resource ? context.resource[prop] : undefined;
      }
      
      if (reference.startsWith('context.')) {
        const prop = reference.substring(8);
        return context.context ? context.context[prop] : undefined;
      }
      
      return reference;
    }
    
    return reference;
  }

  /**
   * Invalidate policy cache
   */
  async invalidatePolicyCache() {
    try {
      const keys = await redis.keys('policy:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Error invalidating policy cache:', error);
      return false;
    }
  }

  // ======================
  // ANALYTICS & REPORTING
  // ======================

  /**
   * Get policy analytics
   */
  async getPolicyAnalytics(req, res) {
    try {
      const { timeframe = '30d' } = req.query;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeframe));

      // Policy usage analytics
      const policyUsage = await prisma.policyAssignment.groupBy({
        by: ['policyId'],
        where: {
          assignedAt: { gte: startDate }
        },
        _count: true,
        include: {
          policy: {
            select: {
              name: true,
              effect: true
            }
          }
        }
      });

      // Policy effect distribution
      const effectDistribution = await prisma.policy.groupBy({
        by: ['effect'],
        where: { isActive: true },
        _count: true
      });

      // Recent policy assignments
      const recentAssignments = await prisma.policyAssignment.findMany({
        where: {
          assignedAt: { gte: startDate }
        },
        include: {
          policy: true,
          assignedByUser: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { assignedAt: 'desc' },
        take: 10
      });

      return createSuccessResponse(res, 200, 'Policy analytics retrieved successfully', {
        timeframe,
        policyUsage,
        effectDistribution,
        recentAssignments,
        summary: {
          totalPolicies: await prisma.policy.count({ where: { isActive: true } }),
          totalAssignments: await prisma.policyAssignment.count({ where: { isActive: true } }),
          activePolicies: await prisma.policy.count({ where: { isActive: true, deletedAt: null } })
        }
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error retrieving policy analytics', error.message);
    }
  }
}

export default new AdvancedPBACController(); 
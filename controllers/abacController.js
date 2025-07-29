import { PrismaClient } from '../generated/prisma/client.js';
import { createSuccessResponse, createErrorResponse } from '../utils/responseUtils.js';
import Redis from 'ioredis';

const prisma = new PrismaClient();

// Disable Redis for now - use memory cache only
console.log('ABAC Controller: Redis disabled - using memory cache only');
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

class AdvancedABACController {
  
  // ======================
  // ATTRIBUTE RULE MANAGEMENT
  // ======================

  /**
   * Create a new attribute rule
   */
  async createAttributeRule(req, res) {
    try {
      const {
        name,
        description,
        targetType, // USER, RESOURCE, etc.
        attribute,
        operator, // ==, !=, >, <, in, etc.
        value,
        effect = 'allow',
        metadata = {},
        isSystem = false
      } = req.body;

      // Validate required fields
      if (!name || !targetType || !attribute || !operator || value === undefined) {
        return createErrorResponse(res, 400, 'Name, targetType, attribute, operator, and value are required');
      }

      // Validate operator
      const validOperators = ['==', '!=', '>', '<', '>=', '<=', 'in', 'not_in', 'contains', 'starts_with', 'ends_with'];
      if (!validOperators.includes(operator)) {
        return createErrorResponse(res, 400, 'Invalid operator');
      }

      const attributeRule = await prisma.attributeRule.create({
        data: {
          name,
          description,
          targetType,
          attribute,
          operator,
          value: String(value),
          effect,
          metadata,
          isSystem,
          createdBy: req.user.id
        }
      });



      return createSuccessResponse(res, 201, 'Attribute rule created successfully', attributeRule);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error creating attribute rule', error.message);
    }
  }

  /**
   * Get all attribute rules with filtering
   */
  async getAllAttributeRules(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        search, 
        targetType, 
        attribute, 
        operator, 
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

      if (targetType) {
        whereClause.targetType = targetType;
      }

      if (attribute) {
        whereClause.attribute = attribute;
      }

      if (operator) {
        whereClause.operator = operator;
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

      const attributeRules = await prisma.attributeRule.findMany({
        where: whereClause,
        include: {
          assignments: {
            include: {
              attributeRule: true
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

      const total = await prisma.attributeRule.count({ where: whereClause });

      return createSuccessResponse(res, 200, 'Attribute rules retrieved successfully', {
        attributeRules,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error retrieving attribute rules', error.message);
    }
  }

  /**
   * Get attribute rule by ID
   */
  async getAttributeRuleById(req, res) {
    try {
      const { id } = req.params;

      const attributeRule = await prisma.attributeRule.findUnique({
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

      if (!attributeRule) {
        return createErrorResponse(res, 404, 'Attribute rule not found');
      }

      return createSuccessResponse(res, 200, 'Attribute rule retrieved successfully', attributeRule);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error retrieving attribute rule', error.message);
    }
  }

  /**
   * Update attribute rule
   */
  async updateAttributeRule(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // Validate operator if provided
      if (updateData.operator) {
        const validOperators = ['==', '!=', '>', '<', '>=', '<=', 'in', 'not_in', 'contains', 'starts_with', 'ends_with'];
        if (!validOperators.includes(updateData.operator)) {
          return createErrorResponse(res, 400, 'Invalid operator');
        }
      }

      const attributeRule = await prisma.attributeRule.update({
        where: { id: BigInt(id) },
        data: {
          ...updateData,
          updatedBy: req.user.id
        }
      });

      // Invalidate attribute rule cache
      await this.invalidateAttributeRuleCache();

      return createSuccessResponse(res, 200, 'Attribute rule updated successfully', attributeRule);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error updating attribute rule', error.message);
    }
  }

  /**
   * Delete attribute rule (soft delete)
   */
  async deleteAttributeRule(req, res) {
    try {
      const { id } = req.params;

      // Check if rule has active assignments
      const activeAssignments = await prisma.attributeAssignment.count({
        where: {
          attributeRuleId: BigInt(id),
          isActive: true
        }
      });

      if (activeAssignments > 0) {
        return createErrorResponse(res, 400, `Cannot delete attribute rule with ${activeAssignments} active assignments`);
      }

      const attributeRule = await prisma.attributeRule.update({
        where: { id: BigInt(id) },
        data: { deletedAt: new Date() }
      });

      return createSuccessResponse(res, 200, 'Attribute rule deleted successfully', attributeRule);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error deleting attribute rule', error.message);
    }
  }

  // ======================
  // ATTRIBUTE ASSIGNMENT
  // ======================

  /**
   * Assign attribute rule to principal
   */
  async assignAttributeRule(req, res) {
    try {
      const {
        attributeRuleId,
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
      const existingAssignment = await prisma.attributeAssignment.findFirst({
        where: {
          attributeRuleId: BigInt(attributeRuleId),
          principalType,
          principalId: BigInt(principalId),
          resourceType,
          resourceId,
          isActive: true
        }
      });

      if (existingAssignment) {
        return createErrorResponse(res, 400, 'Attribute rule assignment already exists');
      }

      const assignment = await prisma.attributeAssignment.create({
        data: {
          attributeRuleId: BigInt(attributeRuleId),
          principalType,
          principalId: BigInt(principalId),
          resourceType,
          resourceId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          metadata,
          assignedBy: req.user.id
        }
      });

      // Invalidate attribute rule cache
      await this.invalidateAttributeRuleCache();

      return createSuccessResponse(res, 201, 'Attribute rule assigned successfully', assignment);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error assigning attribute rule', error.message);
    }
  }

  /**
   * Get attribute rule assignments
   */
  async getAttributeAssignments(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        attributeRuleId, 
        principalType, 
        principalId,
        resourceType,
        resourceId,
        isActive 
      } = req.query;

      const whereClause = {};

      if (attributeRuleId) {
        whereClause.attributeRuleId = BigInt(attributeRuleId);
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

      const assignments = await prisma.attributeAssignment.findMany({
        where: whereClause,
        include: {
          attributeRule: true,
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

      const total = await prisma.attributeAssignment.count({ where: whereClause });

      return createSuccessResponse(res, 200, 'Attribute assignments retrieved successfully', {
        assignments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error retrieving attribute assignments', error.message);
    }
  }

  /**
   * Remove attribute rule assignment
   */
  async removeAttributeAssignment(req, res) {
    try {
      const { id } = req.params;

      const assignment = await prisma.attributeAssignment.update({
        where: { id: BigInt(id) },
        data: { isActive: false }
      });

      // Invalidate attribute rule cache
      await this.invalidateAttributeRuleCache();

      return createSuccessResponse(res, 200, 'Attribute assignment removed successfully', assignment);
    } catch (error) {
      return createErrorResponse(res, 500, 'Error removing attribute assignment', error.message);
    }
  }

  // ======================
  // ATTRIBUTE EVALUATION
  // ======================

  /**
   * Evaluate attribute rules for a user and resource
   */
  async evaluateAttributeRules(req, res) {
    try {
      const { userId, resourceType, resourceId, context = {} } = req.body;

      if (!userId) {
        return createErrorResponse(res, 400, 'User ID is required');
      }

      // Get user's attribute rules (direct and role-based)
      const userAttributeRules = await this.getUserAttributeRules(userId, resourceType, resourceId);

      // Evaluate each attribute rule
      const evaluationResults = [];
      let finalDecision = 'allow'; // Default allow

      for (const rule of userAttributeRules) {
        const result = await this.evaluateAttributeRule(rule, {
          user: { id: userId, ...context.user },
          resource: { type: resourceType, id: resourceId, ...context.resource },
          context
        });

        evaluationResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          targetType: rule.targetType,
          attribute: rule.attribute,
          operator: rule.operator,
          value: rule.value,
          effect: rule.effect,
          result
        });

        // If any rule denies, final decision is deny
        if (rule.effect === 'deny' && result) {
          finalDecision = 'deny';
          break;
        }

        // If rule allows and evaluates to true, allow
        if (rule.effect === 'allow' && result) {
          finalDecision = 'allow';
        }
      }

      return createSuccessResponse(res, 200, 'Attribute rules evaluation completed', {
        userId,
        resourceType,
        resourceId,
        finalDecision,
        evaluationResults,
        rulesEvaluated: userAttributeRules.length
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error evaluating attribute rules', error.message);
    }
  }

  /**
   * Test attribute rule with sample data
   */
  async testAttributeRule(req, res) {
    try {
      const { targetType, attribute, operator, value, testData } = req.body;

      if (!targetType || !attribute || !operator || value === undefined || !testData) {
        return createErrorResponse(res, 400, 'All fields are required');
      }

      // Validate operator
      const validOperators = ['==', '!=', '>', '<', '>=', '<=', 'in', 'not_in', 'contains', 'starts_with', 'ends_with'];
      if (!validOperators.includes(operator)) {
        return createErrorResponse(res, 400, 'Invalid operator');
      }

      const result = await this.evaluateAttributeCondition(targetType, attribute, operator, value, testData);

      return createSuccessResponse(res, 200, 'Attribute rule tested successfully', {
        targetType,
        attribute,
        operator,
        value,
        testData,
        result
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error testing attribute rule', error.message);
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  /**
   * Get user's attribute rules (direct and role-based)
   */
  async getUserAttributeRules(userId, resourceType, resourceId) {
    const rules = [];

    // Get direct user attribute rule assignments
    const userAssignments = await prisma.attributeAssignment.findMany({
      where: {
        principalType: 'USER',
        principalId: BigInt(userId),
        isActive: true,
        expiresAt: { gte: new Date() }
      },
      include: {
        attributeRule: {
          where: { isActive: true, deletedAt: null }
        }
      }
    });

    // Get role-based attribute rule assignments
    const userRoles = await prisma.userRoleAssignment.findMany({
      where: {
        userId: BigInt(userId),
        isActive: true,
        expiresAt: { gte: new Date() }
      }
    });

    const roleIds = userRoles.map(ur => ur.roleId);
    const roleAssignments = await prisma.attributeAssignment.findMany({
      where: {
        principalType: 'ROLE',
        principalId: { in: roleIds },
        isActive: true,
        expiresAt: { gte: new Date() }
      },
      include: {
        attributeRule: {
          where: { isActive: true, deletedAt: null }
        }
      }
    });

    // Add valid rules to the list
    userAssignments.forEach(assignment => {
      if (assignment.attributeRule) {
        rules.push(assignment.attributeRule);
      }
    });

    roleAssignments.forEach(assignment => {
      if (assignment.attributeRule) {
        rules.push(assignment.attributeRule);
      }
    });

    return rules;
  }

  /**
   * Evaluate a single attribute rule
   */
  async evaluateAttributeRule(rule, context) {
    try {
      const { targetType, attribute, operator, value } = rule;
      
      let targetValue;
      
      if (targetType === 'USER') {
        targetValue = context.user[attribute];
      } else if (targetType === 'RESOURCE') {
        targetValue = context.resource[attribute];
      } else {
        targetValue = context.context[attribute];
      }
      
      return this.evaluateAttributeCondition(targetType, attribute, operator, value, { [attribute]: targetValue });
    } catch (error) {
      console.error('Error evaluating attribute rule:', error);
      return false;
    }
  }

  /**
   * Evaluate attribute condition
   */
  async evaluateAttributeCondition(targetType, attribute, operator, expectedValue, actualData) {
    try {
      const actualValue = actualData[attribute];
      
      switch (operator) {
        case '==':
          return actualValue == expectedValue;
        
        case '!=':
          return actualValue != expectedValue;
        
        case '>':
          return Number(actualValue) > Number(expectedValue);
        
        case '<':
          return Number(actualValue) < Number(expectedValue);
        
        case '>=':
          return Number(actualValue) >= Number(expectedValue);
        
        case '<=':
          return Number(actualValue) <= Number(expectedValue);
        
        case 'in':
          const expectedArray = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
          return expectedArray.includes(actualValue);
        
        case 'not_in':
          const notInArray = Array.isArray(expectedValue) ? expectedValue : [expectedValue];
          return !notInArray.includes(actualValue);
        
        case 'contains':
          return String(actualValue).includes(String(expectedValue));
        
        case 'starts_with':
          return String(actualValue).startsWith(String(expectedValue));
        
        case 'ends_with':
          return String(actualValue).endsWith(String(expectedValue));
        
        default:
          return false;
      }
    } catch (error) {
      console.error('Error evaluating attribute condition:', error);
      return false;
    }
  }

  /**
   * Invalidate attribute rule cache
   */
  async invalidateAttributeRuleCache() {
    try {
      const keys = await redis.keys('attribute_rule:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('Error invalidating attribute rule cache:', error);
      return false;
    }
  }

  // ======================
  // ANALYTICS & REPORTING
  // ======================

  /**
   * Get attribute rule analytics
   */
  async getAttributeRuleAnalytics(req, res) {
    try {
      const { timeframe = '30d' } = req.query;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(timeframe));

      // Attribute rule usage analytics
      const ruleUsage = await prisma.attributeAssignment.groupBy({
        by: ['attributeRuleId'],
        where: {
          assignedAt: { gte: startDate }
        },
        _count: true,
        include: {
          attributeRule: {
            select: {
              name: true,
              targetType: true,
              attribute: true,
              effect: true
            }
          }
        }
      });

      // Target type distribution
      const targetTypeDistribution = await prisma.attributeRule.groupBy({
        by: ['targetType'],
        where: { isActive: true },
        _count: true
      });

      // Operator distribution
      const operatorDistribution = await prisma.attributeRule.groupBy({
        by: ['operator'],
        where: { isActive: true },
        _count: true
      });

      // Recent assignments
      const recentAssignments = await prisma.attributeAssignment.findMany({
        where: {
          assignedAt: { gte: startDate }
        },
        include: {
          attributeRule: true,
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

      return createSuccessResponse(res, 200, 'Attribute rule analytics retrieved successfully', {
        timeframe,
        ruleUsage,
        targetTypeDistribution,
        operatorDistribution,
        recentAssignments,
        summary: {
          totalRules: await prisma.attributeRule.count({ where: { isActive: true } }),
          totalAssignments: await prisma.attributeAssignment.count({ where: { isActive: true } }),
          activeRules: await prisma.attributeRule.count({ where: { isActive: true, deletedAt: null } })
        }
      });
    } catch (error) {
      return createErrorResponse(res, 500, 'Error retrieving attribute rule analytics', error.message);
    }
  }
}

export default new AdvancedABACController(); 
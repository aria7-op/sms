import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { validateFeeStructure } from '../validators/feeValidator.js';
import { logger } from '../config/logger.js';
import prisma from '../config/prisma.js';

class FeeMiddleware {
  /**
   * Authentication Middleware
   * Verifies JWT token and checks user role permissions
   */
  async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication token required' 
        });
      }

      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check if user exists and has required role
      const user = await prisma.user.findUnique({
        where: { id: BigInt(decoded.userId) },
        select: { 
          id: true,
          role: true,
          status: true
        }
      });

      if (!user || user.status !== 'ACTIVE') {
        return res.status(401).json({ 
          success: false, 
          message: 'Unauthorized access' 
        });
      }

      // Attach user to request
      req.user = {
        id: user.id.toString(),
        role: user.role
      };

      logger.info(`User authenticated: ${user.id}`);
      next();
    } catch (error) {
      logger.error(`Authentication error: ${error.message}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
  }

  /**
   * Role-Based Access Control Middleware
   * Checks if user has required role to access the endpoint
   */
  authorize(requiredRoles = []) {
    return (req, res, next) => {
      if (!requiredRoles.includes(req.user.role)) {
        logger.warn(`Unauthorized access attempt by user ${req.user.id} with role ${req.user.role}`);
        return res.status(403).json({ 
          success: false, 
          message: 'Insufficient permissions' 
        });
      }
      next();
    };
  }

  /**
   * Rate Limiting Middleware
   * Limits the number of requests to fee-related endpoints
   */
  rateLimiter() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        success: false,
        message: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
  }

  /**
   * Validation Middleware
   * Validates fee structure data before processing
   */
  validateFeeStructure(req, res, next) {
    const validation = validateFeeStructure(req.body);
    
    if (!validation.isValid) {
      logger.warn(`Validation failed: ${validation.errors.join(', ')}`);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Convert string IDs to BigInt if needed
    if (req.body.classId) req.body.classId = BigInt(req.body.classId);
    if (req.body.schoolId) req.body.schoolId = BigInt(req.body.schoolId);
    if (req.body.createdBy) req.body.createdBy = BigInt(req.body.createdBy);
    if (req.body.updatedBy) req.body.updatedBy = BigInt(req.body.updatedBy);

    next();
  }

  /**
   * School Ownership Check Middleware
   * Verifies the user belongs to the school they're trying to modify
   */
  async checkSchoolAccess(req, res, next) {
    try {
      const schoolId = req.params.schoolId || req.body.schoolId;
      
      if (!schoolId) {
        return next(); // No school ID to check
      }

      const userSchool = await prisma.user.findUnique({
        where: { id: BigInt(req.user.id) },
        select: { schoolId: true }
      });

      // Allow admin users to bypass school check
      if (req.user.role === 'ADMIN') {
        return next();
      }

      if (!userSchool || userSchool.schoolId.toString() !== schoolId.toString()) {
        logger.warn(`User ${req.user.id} attempted to access unauthorized school ${schoolId}`);
        return res.status(403).json({ 
          success: false, 
          message: 'Access to this school is denied' 
        });
      }

      next();
    } catch (error) {
      logger.error(`School access check error: ${error.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Fee Structure Existence Check
   * Verifies the fee structure exists and belongs to the correct school
   */
  async checkFeeStructure(req, res, next) {
    try {
      const feeStructureId = req.params.id;
      const schoolId = req.params.schoolId || req.body.schoolId;

      const feeStructure = await prisma.feeStructure.findFirst({
        where: {
          id: BigInt(feeStructureId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!feeStructure) {
        return res.status(404).json({ 
          success: false, 
          message: 'Fee structure not found' 
        });
      }

      // Attach fee structure to request for later use
      req.feeStructure = feeStructure;
      next();
    } catch (error) {
      logger.error(`Fee structure check error: ${error.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Default Structure Conflict Check
   * Prevents multiple default fee structures for the same class/school
   */
  async checkDefaultConflict(req, res, next) {
    try {
      if (!req.body.isDefault) {
        return next(); // Only check if setting as default
      }

      const schoolId = req.params.schoolId || req.body.schoolId;
      const classId = req.body.classId || null;
      const excludeId = req.params.id || null;

      const where = {
        schoolId: BigInt(schoolId),
        isDefault: true,
        deletedAt: null,
        ...(classId && { classId: BigInt(classId) }),
        ...(excludeId && { NOT: { id: BigInt(excludeId) } })
      };

      const existingDefault = await prisma.feeStructure.findFirst({ where });

      if (existingDefault) {
        return res.status(409).json({ 
          success: false, 
          message: 'A default fee structure already exists for this class/school' 
        });
      }

      next();
    } catch (error) {
      logger.error(`Default conflict check error: ${error.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Payment Association Check
   * Prevents deletion of fee structures with associated payments
   */
  async checkPaymentAssociation(req, res, next) {
    try {
      const feeStructureId = req.params.id;

      const paymentCount = await prisma.payment.count({
        where: {
          feeStructureId: BigInt(feeStructureId),
          deletedAt: null
        }
      });

      if (paymentCount > 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot delete fee structure with associated payments' 
        });
      }

      next();
    } catch (error) {
      logger.error(`Payment association check error: ${error.message}`);
      return res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }
}

// Export as a singleton instance
export default new FeeMiddleware();
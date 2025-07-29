import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();
import userService from '../services/userService.js';
import { 
  UserCreateSchema, 
  UserCreateNestedSchema,
  UserUpdateSchema, 
  UserSearchSchema,
  UserAuthSchema,
  UserPasswordChangeSchema,
  UserProfileUpdateSchema,
  UserBulkCreateSchema,
  UserBulkUpdateSchema,
  UserImportSchema,
  UserExportSchema,
  UserAnalyticsSchema,
  UserPerformanceSchema,
} from '../utils/userSchemas.js';
import { auditLog } from '../middleware/auth.js';

export const getAllUsers = async (req, res) => {
  const users = await prisma.user.findMany({
    include: { teacher: true, student: true, staff: true, school: true, owner: true }
  });
  res.json(users);
};

export const getUsers = async (req, res) => {
  try {
    const result = await userService.getUsers(req.query, req.query.include);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUserById = async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(req.params.id) },
    include: { teacher: true, student: true, staff: true, school: true, owner: true }
  });
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
};

export const createUser = async (req, res) => {
  try {
    // Debug logging
    console.log('=== DEBUG: createUser ===');
    console.log('req.body:', JSON.stringify(req.body, null, 2));
    console.log('req.body.user:', req.body.user);
    console.log('req.body.staff:', req.body.staff);
    console.log('req.body.teacher:', req.body.teacher);
    
    let user, staff, teacher;
    
    // Check if this is the new two-part payload format
    if (req.body.user && typeof req.body.user === 'object') {
      // New format: { user: {...}, staff: {...}, teacher: {...} }
      console.log('Using new two-part format');
      
      // Validate the nested payload
      const validatedData = UserCreateNestedSchema.parse(req.body);
      user = validatedData.user;
      staff = validatedData.staff || null;
      teacher = validatedData.teacher || null;
    } else {
      // Old format: flat payload with all fields in req.body
      console.log('Using old flat format');
      
      // Validate the flat payload
      const validatedData = UserCreateSchema.parse(req.body);
      user = validatedData;
      staff = null;
      teacher = null;
    }
    
    console.log('Extracted user:', JSON.stringify(user, null, 2));
    console.log('Extracted staff:', JSON.stringify(staff, null, 2));
    console.log('Extracted teacher:', JSON.stringify(teacher, null, 2));
    console.log('=== END DEBUG ===');
    
    const result = await userService.createUser(user, req.user?.id, staff, teacher);
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_CREATE', 'User created', {
        userId: result.data.id,
        username: result.data.username,
        email: result.data.email,
        role: result.data.role,
      });
      res.status(201).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await userService.updateUser(id, req.body, req.user?.id);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_UPDATE', 'User updated', {
        userId: id,
        updatedFields: Object.keys(req.body),
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await userService.deleteUser(id, req.user?.id);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_DELETE', 'User deleted', {
        userId: id,
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const restoreUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await userService.restoreUser(id, req.user?.id);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_RESTORE', 'User restored', {
        userId: id,
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const loginUser = async (req, res) => {
  try {
    const deviceInfo = {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      deviceType: req.get('Device-Type') || 'unknown',
    };
    
    const result = await userService.loginUser(req.body, deviceInfo);
    
    if (result.success) {
      // Audit log
      await auditLog(result.data.user.id, 'USER_LOGIN', 'User logged in', {
        userId: result.data.user.id,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(401).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 401
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    const result = await userService.logoutUser(req.user?.id, sessionId);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_LOGOUT', 'User logged out', {
        userId: req.user?.id,
        sessionId,
      });
      
      res.status(200).json({
        success: true,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const changePassword = async (req, res) => {
  try {
    const result = await userService.changePassword(req.user?.id, req.body);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_PASSWORD_CHANGE', 'Password changed', {
        userId: req.user?.id,
      });
      
      res.status(200).json({
        success: true,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const bulkCreateUsers = async (req, res) => {
  try {
    const result = await userService.bulkCreateUsers(req.body.users, req.user?.id);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_BULK_CREATE', 'Bulk users created', {
        total: result.data.summary.total,
        successful: result.data.summary.successful,
        failed: result.data.summary.failed,
      });
      
      res.status(201).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const bulkUpdateUsers = async (req, res) => {
  try {
    const result = await userService.bulkUpdateUsers(req.body.updates, req.user?.id);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_BULK_UPDATE', 'Bulk users updated', {
        total: result.data.summary.total,
        successful: result.data.summary.successful,
        failed: result.data.summary.failed,
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const bulkDeleteUsers = async (req, res) => {
  try {
    const result = await userService.bulkDeleteUsers(req.body.userIds, req.user?.id);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_BULK_DELETE', 'Bulk users deleted', {
        total: result.data.summary.total,
        successful: result.data.summary.successful,
        failed: result.data.summary.failed,
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await userService.getUserStats(id);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 404
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUserAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { period } = req.query;
    
    const result = await userService.getUserAnalytics(id, period);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database',
          period: period || '30d'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 404
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUserPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await userService.getUserPerformance(id);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 404
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const result = await userService.searchUsers(req.query);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database',
          filters: req.query
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const exportUsers = async (req, res) => {
  try {
    const { format = 'json', includeSensitiveData = false, ...filters } = req.query;
    
    const result = await userService.exportUsers(filters, format, includeSensitiveData === 'true');
    
    if (result.success) {
      // Set appropriate headers for download
      res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="users-export-${Date.now()}.${format}"`);
      
      res.status(200).json({
        success: true,
        data: result.data,
        format,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const importUsers = async (req, res) => {
  try {
    const result = await userService.importUsers(req.body.data, req.user?.id);
    
    if (result.success) {
      // Audit log
      await auditLog(req.user?.id, 'USER_IMPORT', 'Users imported', {
        total: result.data.summary.total,
        successful: result.data.summary.successful,
        failed: result.data.summary.failed,
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        message: result.message,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        details: result.details,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const generateUsernameSuggestions = async (req, res) => {
  try {
    const { firstName, lastName } = req.query;
    
    const result = await userService.generateUsernameSuggestions(firstName, lastName);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUserCountByRole = async (req, res) => {
  try {
    const result = await userService.getUserCountByRole();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUserCountByStatus = async (req, res) => {
  try {
    const result = await userService.getUserCountByStatus();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database'
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUsersBySchool = async (req, res) => {
  try {
    const { schoolId } = req.params;
    const { include } = req.query;
    
    const result = await userService.getUsersBySchool(schoolId, include);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database',
          schoolId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const { include } = req.query;
    
    const result = await userService.getUsersByRole(role, include);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database',
          role
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
};

export const getUsersByStatus = async (req, res) => {
  try {
    const { status } = req.params;
    const { include } = req.query;
    
    const result = await userService.getUsersByStatus(status, include);
    
    if (result.success) {
      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          timestamp: new Date().toISOString(),
          source: result.source || 'database',
          status
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          timestamp: new Date().toISOString(),
          statusCode: 400
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      meta: {
        timestamp: new Date().toISOString(),
        statusCode: 500
      }
    });
  }
}; 
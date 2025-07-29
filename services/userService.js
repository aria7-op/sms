import { PrismaClient } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { 
  UserCreateSchema, 
  UserUpdateSchema, 
  UserSearchSchema,
  UserAuthSchema,
  UserPasswordChangeSchema,
  UserProfileUpdateSchema,
  generateUsername,
  generateStudentId,
  generateRollNumber,
  formatPhoneNumber,
  validatePasswordStrength,
  generateUserStats,
  generateUserAnalytics,
  buildUserSearchQuery,
  buildUserIncludeQuery,
  generateUserExportData,
  validateUserImportData,
  generateUsernameSuggestions,
  calculateUserPerformance,
} from '../utils/userSchemas.js';
import {
  getUserFromCache,
  setUserInCache,
  getUsersFromCache,
  setUsersInCache,
  getUserCountFromCache,
  setUserCountInCache,
  getUserStatsFromCache,
  setUserStatsInCache,
  getUserAnalyticsFromCache,
  setUserAnalyticsInCache,
  getUserPerformanceFromCache,
  setUserPerformanceInCache,
  getUserSearchFromCache,
  setUserSearchFromCache,
  getUserExportFromCache,
  setUserExportFromCache,
  invalidateUserCacheOnCreate,
  invalidateUserCacheOnUpdate,
  invalidateUserCacheOnDelete,
  invalidateUserCacheOnBulkOperation,
} from '../cache/userCache.js';
import { getUserPermissions } from '../middleware/auth.js';

const prisma = new PrismaClient();

// ======================
// JWT CONFIGURATION
// ======================

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// ======================
// USER SERVICE CLASS
// ======================

class UserService {
  constructor() {
    this.prisma = prisma;
  }

  // ======================
  // CRUD OPERATIONS
  // ======================

  /**
   * Create a new user (supports two-part payload: userData, staffData, teacherData)
   */
  async createUser(userData, createdBy, staffData = null, teacherData = null) {
    const prisma = this.prisma;
    try {
      // Validate input data
      const validatedData = UserCreateSchema.parse(userData);
      // Check if username already exists
      const existingUsername = await prisma.user.findUnique({
        where: { username: validatedData.username }
      });
      if (existingUsername) {
        throw new Error('Username already exists');
      }
      // Check if email already exists
      const existingEmail = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });
      if (existingEmail) {
        throw new Error('Email already exists');
      }
      // Hash password with separate salt
      const saltRounds = 12;
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(validatedData.password, salt);
      // Format phone number
      if (validatedData.phone) {
        validatedData.phone = formatPhoneNumber(validatedData.phone);
      }
      // Generate student ID if needed
      if (validatedData.role === 'STUDENT' && !validatedData.studentId) {
        const school = await prisma.school.findUnique({
          where: { id: BigInt(validatedData.schoolId) },
          select: { code: true }
        });
        if (school) {
          const currentYear = new Date().getFullYear();
          const studentCount = await prisma.user.count({
            where: {
              role: 'STUDENT',
              schoolId: BigInt(validatedData.schoolId),
              createdAt: {
                gte: new Date(currentYear, 0, 1),
                lt: new Date(currentYear + 1, 0, 1)
              }
            }
          });
          validatedData.studentId = generateStudentId(school.code, currentYear, studentCount + 1);
        }
      }
      // Generate roll number if needed
      if (validatedData.role === 'STUDENT' && validatedData.classId && !validatedData.rollNumber) {
        const classStudentCount = await prisma.user.count({
          where: {
            role: 'STUDENT',
            classId: BigInt(validatedData.classId)
          }
        });
        validatedData.rollNumber = generateRollNumber(validatedData.classId, classStudentCount + 1);
      }
      // --- Begin Transaction ---
      const result = await prisma.$transaction(async (tx) => {
        // Create a copy of validatedData for user creation (without staff/teacher fields)
        const {
          departmentId,
          employeeId,
          designation,
          qualification,
          specialization,
          joiningDate,
          experience,
          salary,
          isClassTeacher,
          accountNumber,
          bankName,
          ifscCode,
          ...userData
        } = validatedData;
        
        // 1. Create the user
        const user = await tx.user.create({
          data: {
            ...userData,
            password: hashedPassword,
            salt,
            schoolId: validatedData.schoolId ? BigInt(validatedData.schoolId) : null,
            createdByOwnerId: BigInt(validatedData.createdByOwnerId),
            createdBy: createdBy ? BigInt(createdBy) : null,
          },
          include: {
            school: true,
            sessions: {
              take: 5,
              orderBy: { createdAt: 'desc' }
            },
          }
        });
        // 2. If role is TEACHER, create teacher record
        if (user.role === 'TEACHER') {
          // Merge teacherData and validatedData for required fields
          const tData = { ...validatedData, ...(teacherData || {}) };
          if (!tData.departmentId || !tData.schoolId || !tData.employeeId) {
            throw new Error('departmentId, schoolId, and employeeId are required for TEACHER');
          }
          await tx.teacher.create({
            data: {
              userId: user.id,
              employeeId: tData.employeeId,
              departmentId: BigInt(tData.departmentId),
              schoolId: BigInt(tData.schoolId),
              qualification: tData.qualification || '',
              specialization: tData.specialization || '',
              joiningDate: tData.joiningDate ? new Date(tData.joiningDate) : undefined,
              experience: tData.experience || 0,
              salary: tData.salary ? tData.salary : undefined,
              isClassTeacher: tData.isClassTeacher || false,
              createdBy: createdBy ? BigInt(createdBy) : null,
            }
          });
        }
        // 3. If role is STAFF, CRM_MANAGER, ACCOUNTANT, LIBRARIAN, create staff record
        if ([
          'STAFF',
          'CRM_MANAGER',
          'ACCOUNTANT',
          'LIBRARIAN'
        ].includes(user.role)) {
          // Merge staffData and validatedData for required fields
          const sData = { ...validatedData, ...(staffData || {}) };
          console.log('=== DEBUG: Staff Creation ===');
          console.log('validatedData:', JSON.stringify(validatedData, null, 2));
          console.log('staffData:', JSON.stringify(staffData, null, 2));
          console.log('sData:', JSON.stringify(sData, null, 2));
          console.log('Required fields check:');
          console.log('- departmentId:', sData.departmentId);
          console.log('- schoolId:', sData.schoolId);
          console.log('- employeeId:', sData.employeeId);
          console.log('- designation:', sData.designation);
          console.log('=== END DEBUG ===');
          
          if (!sData.departmentId || !sData.schoolId || !sData.employeeId || !sData.designation) {
            throw new Error('departmentId, schoolId, employeeId, and designation are required for STAFF/CRM_MANAGER/ACCOUNTANT/LIBRARIAN');
          }
          await tx.staff.create({
            data: {
              userId: user.id,
              employeeId: sData.employeeId,
              departmentId: BigInt(sData.departmentId),
              designation: sData.designation,
              joiningDate: sData.joiningDate ? new Date(sData.joiningDate) : undefined,
              salary: sData.salary ? sData.salary : undefined,
              accountNumber: sData.accountNumber || undefined,
              bankName: sData.bankName || undefined,
              ifscCode: sData.ifscCode || undefined,
              schoolId: BigInt(sData.schoolId),
              createdBy: createdBy ? BigInt(createdBy) : null,
            }
          });
        }
        return user;
      });
      
      // Convert BigInt values to strings for JSON serialization
      const convertBigIntToString = (obj) => {
        if (Array.isArray(obj)) {
          return obj.map(convertBigIntToString);
        } else if (obj && typeof obj === 'object') {
          return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, convertBigIntToString(v)])
          );
        } else if (typeof obj === 'bigint') {
          return obj.toString();
        }
        return obj;
      };
      
      // Invalidate cache
      invalidateUserCacheOnCreate(validatedData.createdByOwnerId);
      // Set in cache
      setUserInCache(result.id.toString(), result);
      return {
        success: true,
        data: convertBigIntToString(result),
        message: 'User created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.errors || null
      };
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId, include = null) {
    try {
      // Check cache first
      const cachedUser = getUserFromCache(userId);
      if (cachedUser) {
        return {
          success: true,
          data: cachedUser,
          source: 'cache'
        };
      }
      
      // Build include query
      const includeQuery = buildUserIncludeQuery(include);
      
      // Get from database
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        include: includeQuery
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Set in cache
      setUserInCache(userId, user);
      
      return {
        success: true,
        data: user,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get users with pagination and filters
   */
  async getUsers(filters = {}, include = null) {
    try {
      // Validate filters
      const validatedFilters = UserSearchSchema.parse(filters);
      
      // Check cache first
      const cachedUsers = getUsersFromCache(validatedFilters);
      if (cachedUsers) {
        return {
          success: true,
          data: cachedUsers,
          source: 'cache'
        };
      }
      
      // Build queries
      const where = buildUserSearchQuery(validatedFilters);
      const includeQuery = buildUserIncludeQuery(include);
      
      // Calculate pagination
      const page = validatedFilters.page;
      const limit = validatedFilters.limit;
      const skip = (page - 1) * limit;
      
      // Get users and count
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          include: includeQuery,
          orderBy: { [validatedFilters.sortBy]: validatedFilters.sortOrder },
          skip,
          take: limit,
        }),
        this.prisma.user.count({ where })
      ]);
      
      const result = {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        }
      };
      
      // Set in cache
      setUsersInCache(validatedFilters, result);
      
      return {
        success: true,
        data: result,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.errors || null
      };
    }
  }

  /**
   * Update user
   */
  async updateUser(userId, updateData, updatedBy) {
    try {
      // Validate input data
      const validatedData = UserUpdateSchema.parse(updateData);
      
      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) }
      });
      
      if (!existingUser) {
        throw new Error('User not found');
      }
      
      // Check for unique constraints
      if (validatedData.username) {
        const existingUsername = await this.prisma.user.findFirst({
          where: {
            username: validatedData.username,
            id: { not: BigInt(userId) }
          }
        });
        
        if (existingUsername) {
          throw new Error('Username already exists');
        }
      }
      
      if (validatedData.email) {
        const existingEmail = await this.prisma.user.findFirst({
          where: {
            email: validatedData.email,
            id: { not: BigInt(userId) }
          }
        });
        
        if (existingEmail) {
          throw new Error('Email already exists');
        }
      }
      
      // Hash password if provided
      let hashedPassword = undefined;
      let salt = undefined;
      if (validatedData.password) {
        const saltRounds = 12;
        salt = await bcrypt.genSalt(saltRounds);
        hashedPassword = await bcrypt.hash(validatedData.password, salt);
      }
      
      // Format phone number
      if (validatedData.phone) {
        validatedData.phone = formatPhoneNumber(validatedData.phone);
      }
      
      // Update user
      const user = await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: {
          ...validatedData,
          password: hashedPassword,
          salt,
          schoolId: validatedData.schoolId ? BigInt(validatedData.schoolId) : undefined,
          departmentId: validatedData.departmentId ? BigInt(validatedData.departmentId) : undefined,
          classId: validatedData.classId ? BigInt(validatedData.classId) : undefined,
          updatedBy: updatedBy ? BigInt(updatedBy) : undefined,
        },
        include: {
          school: true,
          department: true,
          class: true,
          sessions: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          },
        }
      });
      
      // Invalidate cache
      invalidateUserCacheOnUpdate(userId, user.createdByOwnerId.toString());
      
      // Set in cache
      setUserInCache(userId, user);
      
      return {
        success: true,
        data: user,
        message: 'User updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.errors || null
      };
    }
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId, deletedBy) {
    try {
      // Check if user exists
      const existingUser = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) }
      });
      
      if (!existingUser) {
        throw new Error('User not found');
      }
      
      // Soft delete
      const user = await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: {
          deletedAt: new Date(),
          updatedBy: deletedBy ? BigInt(deletedBy) : undefined,
        }
      });
      
      // Invalidate cache
      invalidateUserCacheOnDelete(userId, user.createdByOwnerId.toString());
      
      return {
        success: true,
        data: user,
        message: 'User deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Restore deleted user
   */
  async restoreUser(userId, restoredBy) {
    try {
      // Check if user exists and is deleted
      const existingUser = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) }
      });
      
      if (!existingUser) {
        throw new Error('User not found');
      }
      
      if (!existingUser.deletedAt) {
        throw new Error('User is not deleted');
      }
      
      // Restore user
      const user = await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: {
          deletedAt: null,
          updatedBy: restoredBy ? BigInt(restoredBy) : undefined,
        },
        include: {
          school: true,
          department: true,
          class: true,
          sessions: {
            take: 5,
            orderBy: { createdAt: 'desc' }
          },
        }
      });
      
      // Invalidate cache
      invalidateUserCacheOnUpdate(userId, user.createdByOwnerId.toString());
      
      // Set in cache
      setUserInCache(userId, user);
      
      return {
        success: true,
        data: user,
        message: 'User restored successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // AUTHENTICATION OPERATIONS
  // ======================

  /**
   * Universal login for both users and owners
   */
  async loginUser(loginData, deviceInfo = {}) {
    try {
      // Validate login data
      const validatedData = UserAuthSchema.parse(loginData);
      
      console.log('🔍 Login attempt for username:', validatedData.username);
      
      // First, try to find user by username
      let user = await this.prisma.user.findUnique({
        where: { username: validatedData.username }
      });
      
      console.log('👤 User found in user table:', user ? 'YES' : 'NO');
      
      let isOwner = false;
      
      // If no user found, check if it's an owner
      if (!user) {
        console.log('🔍 Checking owner table for username:', validatedData.username);
        
        const owner = await this.prisma.owner.findUnique({
          where: { username: validatedData.username }
        });
        
        console.log('👑 Owner found:', owner ? 'YES' : 'NO');
        
        if (owner) {
          console.log('👑 Owner status:', owner.status);
          
          // Check if owner is active
          if (owner.status !== 'ACTIVE') {
            throw new Error('Account is not active. Please contact administrator.');
          }
          
          // Verify owner password using stored salt
          let isPasswordValid = false;
          if (owner.salt) {
            // Use the stored salt to hash the provided password and compare
            const hashedPassword = await bcrypt.hash(validatedData.password, owner.salt);
            isPasswordValid = hashedPassword === owner.password;
            console.log('🔐 Password validation (with salt):', isPasswordValid);
          } else {
            // Fallback to bcrypt.compare for backward compatibility
            isPasswordValid = await bcrypt.compare(validatedData.password, owner.password);
            console.log('🔐 Password validation (bcrypt.compare):', isPasswordValid);
          }
          
          if (!isPasswordValid) {
            throw new Error('Invalid username or password');
          }
          
          // Create a user-like object for owner
          user = {
            id: owner.id,
            email: owner.email,
            role: 'SUPER_ADMIN',
            status: owner.status,
            name: owner.name,
            timezone: owner.timezone,
            locale: owner.locale,
            emailVerified: owner.emailVerified,
            createdAt: owner.createdAt,
            metadata: owner.metadata,
            school: null,
            department: null,
            class: null,
          };
          
          isOwner = true;
          console.log('✅ Owner login successful');
        } else {
          console.log('❌ No user or owner found with username:', validatedData.username);
          throw new Error('Invalid username or password');
        }
      } else {
        console.log('👤 User status:', user.status);
        
        // Check if user is active
        if (user.status !== 'ACTIVE') {
          throw new Error('Account is not active. Please contact administrator.');
        }
        
        // Verify user password using stored salt
        let isPasswordValid = false;
        if (user.salt) {
          // Use the stored salt to hash the provided password and compare
          const hashedPassword = await bcrypt.hash(validatedData.password, user.salt);
          isPasswordValid = hashedPassword === user.password;
          console.log('🔐 User password validation (with salt):', isPasswordValid);
        } else {
          // Fallback to bcrypt.compare for backward compatibility
          isPasswordValid = await bcrypt.compare(validatedData.password, user.password);
          console.log('🔐 User password validation (bcrypt.compare):', isPasswordValid);
        }
        
        if (!isPasswordValid) {
          throw new Error('Invalid username or password');
        }
        
        console.log('✅ User login successful');
      }
      
      // Generate JWT token
      const tokenPayload = {
        userId: user.id.toString(),
        email: user.email,
        role: user.role,
        schoolId: user.schoolId?.toString(),
        name: user.name,
      };
      
      const token = jwt.sign(tokenPayload, JWT_SECRET, {
        expiresIn: validatedData.rememberMe ? '30d' : '24h',
      });
      
      // Create session
      const session = await this.prisma.session.create({
        data: {
          token,
          status: 'ACTIVE',
          ipAddress: deviceInfo.ipAddress || 'unknown',
          userAgent: deviceInfo.userAgent || 'unknown',
          deviceType: deviceInfo.deviceType || 'unknown',
          userId: user.id,
          expiresAt: new Date(Date.now() + (validatedData.rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000),
        }
      });
      
      // Update last login based on type
      if (isOwner) {
        await this.prisma.owner.update({
          where: { id: user.id },
          data: {
            lastLogin: new Date(),
            lastIp: deviceInfo.ipAddress || 'unknown',
          }
        });
      } else {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            lastLogin: new Date(),
            lastIp: deviceInfo.ipAddress || 'unknown',
          }
        });
      }
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      // Convert BigInt values to strings for JSON serialization
      const convertBigIntToString = (obj) => {
        if (Array.isArray(obj)) {
          return obj.map(convertBigIntToString);
        } else if (obj && typeof obj === 'object') {
          return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, convertBigIntToString(v)])
          );
        } else if (typeof obj === 'bigint') {
          return obj.toString();
        }
        return obj;
      };

      // Get permissions for the user's role
      const userPermissions = getUserPermissions(user.role);

      return {
        success: true,
        data: {
          user: convertBigIntToString(userWithoutPassword),
          token,
          sessionId: convertBigIntToString(session.id),
          expiresAt: session.expiresAt,
          permissions: userPermissions
        },
        message: isOwner ? 'Owner login successful' : 'Login successful'
      };
    } catch (error) {
      console.error('❌ Login error:', error.message);
      console.error('❌ Error stack:', error.stack);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * User logout
   */
  async logoutUser(userId, sessionId) {
    try {
      // Invalidate session
      await this.prisma.session.update({
        where: { id: BigInt(sessionId) },
        data: {
          status: 'INACTIVE',
          updatedAt: new Date(),
        }
      });
      
      return {
        success: true,
        message: 'Logout successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId, passwordData) {
    try {
      // Validate password data
      const validatedData = UserPasswordChangeSchema.parse(passwordData);
      
      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Verify current password using stored salt
      let isCurrentPasswordValid = false;
      if (user.salt) {
        // Use the stored salt to hash the provided password and compare
        const hashedPassword = await bcrypt.hash(validatedData.currentPassword, user.salt);
        isCurrentPasswordValid = hashedPassword === user.password;
      } else {
        // Fallback to bcrypt.compare for backward compatibility
        isCurrentPasswordValid = await bcrypt.compare(validatedData.currentPassword, user.password);
      }
      
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }
      
      // Validate new password strength
      const passwordStrength = validatePasswordStrength(validatedData.newPassword);
      
      if (!passwordStrength.isValid) {
        throw new Error('Password does not meet strength requirements');
      }
      
      // Hash new password with separate salt
      const saltRounds = 12;
      const salt = await bcrypt.genSalt(saltRounds);
      const hashedPassword = await bcrypt.hash(validatedData.newPassword, salt);
      
      // Update password
      await this.prisma.user.update({
        where: { id: BigInt(userId) },
        data: {
          password: hashedPassword,
          salt,
          updatedAt: new Date(),
        }
      });
      
      // Invalidate all user sessions
      await this.prisma.session.updateMany({
        where: { userId: BigInt(userId), status: 'ACTIVE' },
        data: {
          status: 'INACTIVE',
          updatedAt: new Date(),
        }
      });
      
      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // BULK OPERATIONS
  // ======================

  /**
   * Bulk create users
   */
  async bulkCreateUsers(usersData, createdBy) {
    try {
      const results = [];
      const errors = [];
      
      for (let i = 0; i < usersData.length; i++) {
        const userData = usersData[i];
        const result = await this.createUser(userData, createdBy);
        
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push({
            index: i,
            data: userData,
            error: result.error
          });
        }
      }
      
      // Invalidate cache for all affected owners
      const ownerIds = [...new Set(usersData.map(u => u.createdByOwnerId))];
      invalidateUserCacheOnBulkOperation(ownerIds);
      
      return {
        success: true,
        data: {
          created: results,
          errors,
          summary: {
            total: usersData.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: `Bulk operation completed. ${results.length} users created, ${errors.length} failed.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Bulk update users
   */
  async bulkUpdateUsers(updates, updatedBy) {
    try {
      const results = [];
      const errors = [];
      
      for (const update of updates) {
        const { id, ...updateData } = update;
        const result = await this.updateUser(id, updateData, updatedBy);
        
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push({
            id,
            data: updateData,
            error: result.error
          });
        }
      }
      
      return {
        success: true,
        data: {
          updated: results,
          errors,
          summary: {
            total: updates.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: `Bulk operation completed. ${results.length} users updated, ${errors.length} failed.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Bulk delete users
   */
  async bulkDeleteUsers(userIds, deletedBy) {
    try {
      const results = [];
      const errors = [];
      
      for (const userId of userIds) {
        const result = await this.deleteUser(userId, deletedBy);
        
        if (result.success) {
          results.push(result.data);
        } else {
          errors.push({
            id: userId,
            error: result.error
          });
        }
      }
      
      return {
        success: true,
        data: {
          deleted: results,
          errors,
          summary: {
            total: userIds.length,
            successful: results.length,
            failed: errors.length
          }
        },
        message: `Bulk operation completed. ${results.length} users deleted, ${errors.length} failed.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // STATISTICS & ANALYTICS
  // ======================

  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    try {
      // Check cache first
      const cachedStats = getUserStatsFromCache(userId);
      if (cachedStats) {
        return {
          success: true,
          data: cachedStats,
          source: 'cache'
        };
      }
      
      // Get user with relations
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        include: {
          sessions: true,
          documents: true,
          sentMessages: true,
          receivedMessages: true,
          payments: true,
          attendance: true,
          grades: true,
          assignments: true,
          submissions: true,
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generate stats
      const stats = generateUserStats(user);
      
      // Set in cache
      setUserStatsInCache(userId, stats);
      
      return {
        success: true,
        data: stats,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId, period = '30d') {
    try {
      // Check cache first
      const cachedAnalytics = getUserAnalyticsFromCache(userId, period);
      if (cachedAnalytics) {
        return {
          success: true,
          data: cachedAnalytics,
          source: 'cache'
        };
      }
      
      // Get user with relations
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        include: {
          sessions: true,
          payments: true,
          attendance: true,
          grades: true,
          submissions: true,
          sentMessages: true,
          receivedMessages: true,
          documents: true,
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generate analytics
      const analytics = generateUserAnalytics(user, period);
      
      // Set in cache
      setUserAnalyticsInCache(userId, period, analytics);
      
      return {
        success: true,
        data: analytics,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user performance metrics
   */
  async getUserPerformance(userId) {
    try {
      // Check cache first
      const cachedPerformance = getUserPerformanceFromCache(userId);
      if (cachedPerformance) {
        return {
          success: true,
          data: cachedPerformance,
          source: 'cache'
        };
      }
      
      // Get user with relations
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(userId) },
        include: {
          attendance: true,
          grades: true,
          payments: true,
          sessions: true,
        }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Calculate performance
      const performance = calculateUserPerformance(user);
      
      // Set in cache
      setUserPerformanceInCache(userId, performance);
      
      return {
        success: true,
        data: performance,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // SEARCH & FILTER
  // ======================

  /**
   * Search users with advanced filters
   */
  async searchUsers(searchParams) {
    try {
      // Check cache first
      const cachedResults = getUserSearchFromCache(searchParams);
      if (cachedResults) {
        return {
          success: true,
          data: cachedResults,
          source: 'cache'
        };
      }
      
      // Validate search parameters
      const validatedParams = UserSearchSchema.parse(searchParams);
      
      // Build search query
      const where = buildUserSearchQuery(validatedParams);
      const includeQuery = buildUserIncludeQuery(validatedParams.include);
      
      // Calculate pagination
      const page = validatedParams.page;
      const limit = validatedParams.limit;
      const skip = (page - 1) * limit;
      
      // Execute search
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          include: includeQuery,
          orderBy: { [validatedParams.sortBy]: validatedParams.sortOrder },
          skip,
          take: limit,
        }),
        this.prisma.user.count({ where })
      ]);
      
      const result = {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
        filters: validatedParams
      };
      
      // Set in cache
      setUserSearchFromCache(searchParams, result);
      
      return {
        success: true,
        data: result,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.errors || null
      };
    }
  }

  // ======================
  // EXPORT & IMPORT
  // ======================

  /**
   * Export users data
   */
  async exportUsers(filters = {}, format = 'json', includeSensitiveData = false) {
    try {
      // Check cache first
      const cachedExport = getUserExportFromCache(filters, format);
      if (cachedExport) {
        return {
          success: true,
          data: cachedExport,
          source: 'cache'
        };
      }
      
      // Get users
      const usersResult = await this.getUsers(filters);
      
      if (!usersResult.success) {
        throw new Error(usersResult.error);
      }
      
      // Generate export data
      const exportData = generateUserExportData(usersResult.data.users, format, includeSensitiveData);
      
      // Set in cache
      setUserExportFromCache(filters, format, exportData);
      
      return {
        success: true,
        data: exportData,
        format,
        source: 'database'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Import users data
   */
  async importUsers(importData, createdBy) {
    try {
      // Validate import data
      const validation = validateUserImportData(importData);
      
      if (validation.errors.length > 0) {
        return {
          success: false,
          error: 'Import validation failed',
          details: validation.errors
        };
      }
      
      // Bulk create users
      const result = await this.bulkCreateUsers(validation.valid, createdBy);
      
      return {
        success: true,
        data: result.data,
        message: `Import completed. ${result.data.summary.successful} users imported, ${result.data.summary.failed} failed.`
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  /**
   * Generate username suggestions
   */
  async generateUsernameSuggestions(firstName, lastName) {
    try {
      const suggestions = generateUsernameSuggestions(firstName, lastName);
      
      // Check which suggestions are available
      const existingUsernames = await this.prisma.user.findMany({
        where: { username: { in: suggestions } },
        select: { username: true }
      });
      
      const existingUsernameSet = new Set(existingUsernames.map(u => u.username));
      const availableSuggestions = suggestions.filter(username => !existingUsernameSet.has(username));
      
      return {
        success: true,
        data: {
          suggestions: availableSuggestions,
          allSuggestions: suggestions,
          existingUsernames: Array.from(existingUsernameSet)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user count by role
   */
  async getUserCountByRole() {
    try {
      const counts = await this.prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { id: true }
      });
      
      const result = counts.reduce((acc, item) => {
        acc[item.role] = item._count.id;
        return acc;
      }, {});
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get user count by status
   */
  async getUserCountByStatus() {
    try {
      const counts = await this.prisma.user.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true }
      });
      
      const result = counts.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {});
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get users by school
   */
  async getUsersBySchool(schoolId, include = null) {
    try {
      const includeQuery = buildUserIncludeQuery(include);
      
      const users = await this.prisma.user.findMany({
        where: { 
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });
      
      return {
        success: true,
        data: users
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role, include = null) {
    try {
      const includeQuery = buildUserIncludeQuery(include);
      
      const users = await this.prisma.user.findMany({
        where: { 
          role,
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });
      
      return {
        success: true,
        data: users
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get users by status
   */
  async getUsersByStatus(status, include = null) {
    try {
      const includeQuery = buildUserIncludeQuery(include);
      
      const users = await this.prisma.user.findMany({
        where: { 
          status,
          deletedAt: null
        },
        include: includeQuery,
        orderBy: { createdAt: 'desc' }
      });
      
      return {
        success: true,
        data: users
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// ======================
// SERVICE INSTANCE
// ======================

const userService = new UserService();

export default userService; 
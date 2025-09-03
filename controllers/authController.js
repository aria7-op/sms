import { PrismaClient } from '../generated/prisma/index.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import staffStore from '../store/staffStore.js';
import crypto from 'crypto';
import { safeResponse } from '../utils/jsonHelpers.js';
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'd3d396366d5d7b3ba7192922ad7b987274df547f4eb435c996fad48e6251cb8';

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Generate a secure random token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate a temporary password
 */
function generateTempPassword(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * Hash password with bcrypt
 */
async function hashPassword(password) {
  const saltRounds = 12;
  const salt = await bcrypt.genSalt(saltRounds);
  const hashedPassword = await bcrypt.hash(password, salt);
  return { hashedPassword, salt };
}

export const register = async (req, res) => {
  const { name, email, password, role, schoolId, created_by_owner_id, relational_id } = req.body;
  
  // For SUPER_ADMIN, schoolId and relational_id are optional
  if (role !== 'SUPER_ADMIN') {
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    if (!relational_id) return res.status(400).json({ error: 'relational_id is required' });
  }

  // Map numeric or string role to enum string
  const roleMap = {
    '1': 'TEACHER',
    '2': 'STUDENT',
    '3': 'STAFF',
    '4': 'SUPER_ADMIN',
    TEACHER: 'TEACHER',
    STUDENT: 'STUDENT',
    STAFF: 'STAFF',
    SUPER_ADMIN: 'SUPER_ADMIN'
  };
  const mappedRole = roleMap[role];
  if (!mappedRole) return res.status(400).json({ error: 'Invalid role value' });

  // Check if email already exists (only if email is provided and email column exists)
  if (email) {
    try {
      const existingUser = await prisma.user.findFirst({ where: { email } });
      if (existingUser) return res.status(400).json({ error: 'Email already in use' });
    } catch (_) {
      // email field not present; skip uniqueness check
    }
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  
  // Generate username from name
  const username = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  
  // Prepare user data
  const userData = {
    name,
    username,
    password: hashedPassword,
    role: mappedRole
  };
  
  // Only add email if provided
  if (email) {
    userData.email = email;
  }

  // Add optional fields for non-SUPER_ADMIN users
  if (mappedRole !== 'SUPER_ADMIN') {
    userData.schoolId = BigInt(schoolId);
    userData.created_by_owner_id = BigInt(created_by_owner_id);
    userData.relational_id = BigInt(relational_id);
  }

  const user = await prisma.user.create({
    data: userData
  });
  
  res.status(201).json({ id: user.id.toString(), email: user.email });
};

export const login = async (req, res) => {
  const { email } = req.body;
  const user = staffStore.getAllStaff().staff.find(u => u.email === email);
  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'Invalid credentials or inactive user' });
  }
  // For testing, skip password verification
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
};

// New database-based login function
export const loginDb = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in database
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        school: {
          select: {
            id: true,
            name: true,
            shortName: true,
            code: true,
            logo: true,
            themeColor: true,
            timezone: true,
            locale: true,
            currency: true,
            status: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Debug: Log user object to see what we're getting
    const userForLogging = safeResponse({
      ...user,
      id: user.id ? user.id.toString() : null,
      schoolId: user.schoolId ? user.schoolId.toString() : null
    });
    console.log('User found:', JSON.stringify(userForLogging, null, 2));

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User account is not active' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if required fields exist
    if (!user.id) {
      console.error('User ID is null:', user);
      return res.status(500).json({ error: 'User record is corrupted - missing ID' });
    }

    if (!user.firstName || !user.lastName) {
      console.error('User name fields are missing:', user);
      return res.status(500).json({ error: 'User record is corrupted - missing name fields' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id.toString(), 
        email: user.email, 
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        schoolId: user.schoolId ? user.schoolId.toString() : null
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    // Serialize the response to handle any remaining BigInt values
    const responseData = safeResponse({
      success: true,
      token,
      user: {
        id: user.id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        schoolId: user.schoolId ? user.schoolId.toString() : null,
        school: user.school
      }
    });

    res.json(responseData);

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
};

export const loginTest = async (req, res) => {
  const { email } = req.body;
  const user = staffStore.getAllStaff().staff.find(u => u.email === email);
  if (!user || user.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'Invalid credentials or inactive user' });
  }
  // For testing, skip password verification
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
};

// ======================
// PASSWORD RESET METHODS
// ======================

/**
 * Forgot Password - Request password reset
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Store reset token in user metadata
    const metadata = user.metadata || {};
    metadata.resetToken = resetToken;
    metadata.resetTokenExpiry = resetTokenExpiry.toISOString();

    // Update user with reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        metadata: metadata
      }
    });

    // In production, send email here
    // For now, return the token directly
    res.json({
      success: true,
      message: 'Password reset token generated successfully',
      data: {
        resetToken: resetToken,
        expiresAt: resetTokenExpiry,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Reset Password - Use reset token to set new password
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email, reset token, and new password are required'
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if reset token exists and is valid
    const metadata = user.metadata || {};
    if (!metadata.resetToken || metadata.resetToken !== resetToken) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reset token'
      });
    }

    // Check if token is expired
    if (new Date(metadata.resetTokenExpiry) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password and clear reset token
    const updatedMetadata = { ...metadata };
    delete updatedMetadata.resetToken;
    delete updatedMetadata.resetTokenExpiry;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        metadata: updatedMetadata
      }
    });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

/**
 * Admin Reset Password - Admin can reset any user's password
 */
export const adminResetPassword = async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    const adminUser = req.user; // From auth middleware

    // Check if admin has permission
    if (!adminUser || !['SUPER_ADMIN', 'OWNER'].includes(adminUser.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'User ID and new password are required'
      });
    }

    // Find user by ID
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword
      }
    });

    res.json({
      success: true,
      message: 'Password reset successfully by admin',
      data: {
        userId: userId,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

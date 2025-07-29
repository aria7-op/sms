import { PrismaClient } from '../generated/prisma/client.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import staffStore from '../store/staffStore.js';
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

export const register = async (req, res) => {
  const { name, email, password, role, schoolId, created_by_owner_id, relational_id } = req.body;
  if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
  if (!relational_id) return res.status(400).json({ error: 'relational_id is required' });

  // Map numeric or string role to enum string
  const roleMap = {
    '1': 'TEACHER',
    '2': 'STUDENT',
    '3': 'STAFF',
    TEACHER: 'TEACHER',
    STUDENT: 'STUDENT',
    STAFF: 'STAFF'
  };
  const mappedRole = roleMap[role];
  if (!mappedRole) return res.status(400).json({ error: 'Invalid role value' });

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return res.status(400).json({ error: 'Email already in use' });

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, role: mappedRole, schoolId: BigInt(schoolId), created_by_owner_id: BigInt(created_by_owner_id), relational_id: BigInt(relational_id) }
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
        school: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'User account is not active' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id.toString(), 
        email: user.email, 
        role: user.role,
        name: user.name,
        schoolId: user.schoolId.toString()
      }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({ 
      success: true,
      token,
      user: {
        id: user.id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.schoolId.toString()
      }
    });

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

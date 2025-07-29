import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import compression from 'compression';
import helmet from 'helmet';
import mysql from 'mysql2/promise';
import CryptoJS from 'crypto-js';

// Import all route modules
import authRoutes from './routes/auth.js';
import abacRoutes from './routes/abac.js';
import assignmentAttachmentRoutes from './routes/assignmentAttachments.js';
import assignmentRoutes from './routes/assignments.js';
import attendanceRoutes from './routes/attendances.js';
import budgetRoutes from './routes/budgets.js';
import classRoutes from './routes/classes.js';
import conversationRoutes from './routes/conversations.js';
import cqrsStudentRoutes from './routes/cqrsStudents.js';
import cqrsTeacherRoutes from './routes/cqrsTeachers.js';
import customerEventRoutes from './routes/customerEventRoutes.js';
import customerRoutes from './routes/customers.js';
import documentRoutes from './routes/documents.js';
import equipmentRoutes from './routes/equipmentRoutes.js';
import eventRoutes from './routes/events.js';
import examTimetableRoutes from './routes/examTimetables.js';
import examinationRoutes from './routes/examinations.js';
import expenseRoutes from './routes/expenses.js';
import feeItemRoutes from './routes/feeItem.js';
import feeRoutes from './routes/fees.js';
import fileRoutes from './routes/files.js';
import googleDriveRoutes from './routes/googleDrive.js';
import gradeRoutes from './routes/grades.js';
import hostelRoutes from './routes/hostelRoutes.js';
import incomeRoutes from './routes/incomes.js';
import installmentRoutes from './routes/installments.js';
import integratedPaymentRoutes from './routes/integratedPayments.js';
import inventoryRoutes from './routes/inventory.js';
import inventorySupplierRoutes from './routes/inventorySupplierRoutes.js';
import libraryRoutes from './routes/library.js';
import libraryManagementRoutes from './routes/libraryRoutes.js';
import messageRoutes from './routes/messages.js';
import monthlyTestRoutes from './routes/monthlyTests.js';
import noticeRoutes from './routes/notices.js';
import notificationRoutes from './routes/notifications.js';
import ownerRoutes from './routes/owners.js';
import parentRoutes from './routes/parents.js';
import passwordResetTokenRoutes from './routes/passwordResetTokens.js';
import paymentRoutes from './routes/payments.js';
import payrollRoutes from './routes/payrolls.js';
import pbacRoutes from './routes/pbac.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import rbacRoutes from './routes/rbac.js';
import refundRoutes from './routes/refunds.js';
import schoolRoutes from './routes/schools.js';
import sectionRoutes from './routes/sections.js';
import staffRoutes from './routes/staff.js';
import staffsRoutes from './routes/staffs.js';
import studentEventRoutes from './routes/studentEventRoutes.js';
import studentRoutes from './routes/students.js';
import subjectRoutes from './routes/subjects.js';
import teacherClassSubjectRoutes from './routes/teacherClassSubjectRoutes.js';
import teacherRoutes from './routes/teachers.js';
import timetableAIRoutes from './routes/timetableAIRoutes.js';
import transportRoutes from './routes/transportRoutes.js';
import userRoutes from './routes/users.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// Database connection pool
let dbPool;

// Parse DATABASE_URL from environment
function parseDatabaseUrl(url) {
  if (!url) return null;
  
  try {
    // Remove mysql:// prefix
    const cleanUrl = url.replace('mysql://', '');
    
    // Split into parts
    const [credentials, hostAndDb] = cleanUrl.split('@');
    const [user, password] = credentials.split(':');
    const [host, database] = hostAndDb.split('/');
    
    return {
      host: host.split(':')[0],
      port: host.split(':')[1] || 3306,
      user: user,
      password: password,
      database: database
    };
  } catch (error) {
    console.error('Error parsing DATABASE_URL:', error);
    return null;
  }
}

// Initialize database connection
async function initializeDatabase() {
  try {
    let dbConfig;
    
    // Try to parse DATABASE_URL first
    if (process.env.DATABASE_URL) {
      dbConfig = parseDatabaseUrl(process.env.DATABASE_URL);
      console.log('📋 Using DATABASE_URL from environment');
    }
    
    // If DATABASE_URL parsing failed or not available, use individual env vars
    if (!dbConfig) {
      dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'school',
        password: process.env.DB_PASSWORD || 'YourName123!',
        database: process.env.DB_NAME || 'school'
      };
      console.log('📋 Using individual environment variables');
    }
    
    console.log('🔧 Attempting database connection with:', {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      database: dbConfig.database
    });
    
    // For cPanel, try both localhost and 127.0.0.1
    const connectionOptions = {
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 12000000, // 120 seconds (2 minutes)
      timeout: 12000000, // 120 seconds (2 minutes)
      reconnect: true,
      connectTimeout: 12000000, // 120 seconds for initial connection
      acquireTimeoutMillis: 12000000, // 120 seconds for acquiring connection
      timeoutMillis: 12000000 // 120 seconds for query timeout
    };
    
    console.log('🔧 Connection options:', {
      host: connectionOptions.host,
      port: connectionOptions.port,
      user: connectionOptions.user,
      database: connectionOptions.database
    });
    
    dbPool = mysql.createPool(connectionOptions);

    // Test connection
    const connection = await dbPool.getConnection();
    console.log('✅ Database connected successfully');
    console.log(`📊 Connected to: ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔍 Error details:', error);
    
    // Try alternative connection if localhost fails
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')) {
      console.log('🔄 Trying with 127.0.0.1 instead of localhost...');
      try {
        const altDbConfig = parseDatabaseUrl(process.env.DATABASE_URL.replace('localhost', '127.0.0.1'));
        if (altDbConfig) {
          dbPool = mysql.createPool({
            host: altDbConfig.host,
            port: altDbConfig.port,
            user: altDbConfig.user,
            password: altDbConfig.password,
            database: altDbConfig.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            acquireTimeout: 120000, // 120 seconds (2 minutes)
            timeout: 120000, // 120 seconds (2 minutes)
            reconnect: true,
            connectTimeout: 120000, // 120 seconds for initial connection
            acquireTimeoutMillis: 120000, // 120 seconds for acquiring connection
            timeoutMillis: 120000 // 120 seconds for query timeout
          });
          
          const connection = await dbPool.getConnection();
          console.log('✅ Database connected successfully with 127.0.0.1');
          connection.release();
          return;
        }
      } catch (altError) {
        console.error('❌ Alternative connection also failed:', altError.message);
      }
    }
    
    console.error('💡 Database connection troubleshooting:');
    console.error('💡 1. Check if MySQL is running on the server');
    console.error('💡 2. Verify database credentials in cPanel');
    console.error('💡 3. Check if the database exists');
    console.error('💡 4. Verify user permissions');
    // Continue without database for basic functionality
  }
}

// Security middleware
app.use(helmet());
app.use(compression());

// Enhanced memory settings for 2GB RAM
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure req.body is always an object
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// Enhanced error handling for JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format in request body',
      error: 'JSON_PARSE_ERROR'
    });
  }
  next();
});

// Encryption middleware for handling encrypted API requests and responses
app.use((req, res, next) => {
  try {
    // Skip encryption check for file uploads and health checks
    if (req.path.includes('/upload') || req.path.includes('/health')) {
      return next();
    }

    // Check if request body contains encrypted data
    if (req.body && req.body.encryptedData) {
      const encryptionKey = process.env.API_ENCRYPTION_KEY;
      
      if (!encryptionKey) {
        console.error('❌ API_ENCRYPTION_KEY not found in environment variables');
        return res.status(500).json({
          success: false,
          message: 'Server encryption configuration error',
          error: 'ENCRYPTION_KEY_MISSING'
        });
      }

      try {
        // Decrypt the data
        const bytes = CryptoJS.AES.decrypt(req.body.encryptedData, encryptionKey);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedData) {
          return res.status(400).json({
            success: false,
            message: 'Invalid encrypted data',
            error: 'INVALID_ENCRYPTED_DATA'
          });
        }

        // Parse the decrypted JSON
        const parsedData = JSON.parse(decryptedData);
        
        // Replace the request body with decrypted data
        req.body = parsedData;
        
        console.log('🔓 Successfully decrypted API request');
      } catch (decryptError) {
        console.error('❌ Decryption failed:', decryptError.message);
        return res.status(400).json({
          success: false,
          message: 'Failed to decrypt request data',
          error: 'DECRYPTION_FAILED'
        });
      }
    }

    // Store original send and json methods
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override send method to encrypt responses
    res.send = function(data) {
      try {
        // Skip encryption for error responses or non-JSON data
        if (res.statusCode >= 400 || typeof data !== 'string' || !data.startsWith('{')) {
          return originalSend.call(this, data);
        }

        const encryptionKey = process.env.API_ENCRYPTION_KEY;
        if (!encryptionKey) {
          return originalSend.call(this, data);
        }

        // Parse the response data
        let responseData;
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          return originalSend.call(this, data);
        }

        // Encrypt the response
        const encryptedResponse = CryptoJS.AES.encrypt(
          JSON.stringify(responseData), 
          encryptionKey
        ).toString();

        // Send encrypted response
        const encryptedData = {
          encryptedData: encryptedResponse
        };

        return originalSend.call(this, JSON.stringify(encryptedData));
      } catch (error) {
        console.error('❌ Response encryption failed:', error);
        return originalSend.call(this, data);
      }
    };

    // Override json method to encrypt responses
    res.json = function(data) {
      try {
        // Skip encryption for error responses
        if (res.statusCode >= 400) {
          return originalJson.call(this, data);
        }

        const encryptionKey = process.env.API_ENCRYPTION_KEY;
        if (!encryptionKey) {
          return originalJson.call(this, data);
        }

        // Encrypt the response
        const encryptedResponse = CryptoJS.AES.encrypt(
          JSON.stringify(data), 
          encryptionKey
        ).toString();

        // Send encrypted response
        const encryptedData = {
          encryptedData: encryptedResponse
        };

        return originalJson.call(this, encryptedData);
      } catch (error) {
        console.error('❌ Response encryption failed:', error);
        return originalJson.call(this, data);
      }
    };
    
    next();
  } catch (error) {
    console.error('❌ Encryption middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error in encryption middleware',
      error: 'ENCRYPTION_MIDDLEWARE_ERROR'
    });
  }
});

// Enable CORS for frontend
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-client-version', 'x-device-type', 'x-request-id', 'x-request-timestamp']
}));

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
  // Always set CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-client-version, x-device-type, x-request-id, x-request-timestamp');
  res.header('Access-Control-Allow-Credentials', 'true');
    
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  } else {
    next();
  }
});

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Database helper functions
async function query(sql, params = []) {
  if (!dbPool) {
    throw new Error('Database not connected');
  }
  
  // Add timeout to database queries
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Database query timeout')), 1200000); // 2 minutes
  });
  
  const queryPromise = dbPool.execute(sql, params);
  
  try {
    const [rows] = await Promise.race([queryPromise, timeoutPromise]);
    return rows;
  } catch (error) {
    console.error('Database query failed:', error.message);
    throw error;
  }
}

// Basic routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'School Management API is running',
    version: '2.0 MySQL2',
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    database: dbPool ? 'Connected' : 'Not connected'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    },
    uptime: `${Math.round(process.uptime())}s`,
    database: dbPool ? 'Connected' : 'Not connected',
    encryption: process.env.API_ENCRYPTION_KEY ? 'Enabled' : 'Disabled',
    cors: 'Enabled'
  });
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    cors: 'Enabled'
  });
});

// File upload route
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }
  
  res.json({
    success: true,
    message: 'File uploaded successfully',
    data: {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });
});

// Database status endpoint
app.get('/api/database/status', async (req, res) => {
  try {
    if (!dbPool) {
      return res.json({
        success: false,
        connected: false,
        message: 'Database not connected',
        error: 'No database pool available'
      });
    }
    
    // Test a simple query
    const result = await query('SELECT 1 as test');
    
    res.json({
      success: true,
      connected: true,
      message: 'Database connected and responding',
      test: result[0]
    });
  } catch (error) {
    res.json({
      success: false,
      connected: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// API Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'API endpoints are available',
    database: dbPool ? 'Connected' : 'Not connected',
    endpoints: [
      '/api/auth',
      '/api/abac',
      '/api/assignments',
      '/api/assignment-attachments',
      '/api/attendances',
      '/api/budgets',
      '/api/classes',
      '/api/conversations',
      '/api/cqrs/students',
      '/api/cqrs/teachers',
      '/api/customer-events',
      '/api/customers',
      '/api/documents',
      '/api/equipment',
      '/api/events',
      '/api/exam-timetables',
      '/api/examinations',
      '/api/expenses',
      '/api/fee-items',
      '/api/fees',
      '/api/files',
      '/api/google-drive',
      '/api/grades',
      '/api/hostels',
      '/api/incomes',
      '/api/installments',
      '/api/integrated-payments',
      '/api/inventory',
      '/api/inventory-suppliers',
      '/api/library',
      '/api/library-management',
      '/api/messages',
      '/api/monthly-tests',
      '/api/notices',
      '/api/notifications',
      '/api/owners',
      '/api/parents',
      '/api/password-reset-tokens',
      '/api/payments',
      '/api/payrolls',
      '/api/pbac',
      '/api/purchase-orders',
      '/api/rbac',
      '/api/refunds',
      '/api/schools',
      '/api/sections',
      '/api/staff',
      '/api/staffs',
      '/api/student-events',
      '/api/students',
      '/api/subjects',
      '/api/teacher-class-subjects',
      '/api/teachers',
      '/api/timetable-ai',
      '/api/transport',
      '/api/users',
      '/api/upload',
      '/api/database/status'
    ]
  });
});

// ======================
// ROUTE REGISTRATION
// ======================

// Authentication routes
app.use('/api/auth', authRoutes);

// Authorization routes
app.use('/api/abac', abacRoutes);
app.use('/api/pbac', pbacRoutes);
app.use('/api/rbac', rbacRoutes);

// Assignment routes
app.use('/api/assignments', assignmentRoutes);
app.use('/api/assignment-attachments', assignmentAttachmentRoutes);

// Attendance routes
app.use('/api/attendances', attendanceRoutes);

// Budget routes
app.use('/api/budgets', budgetRoutes);

// Class routes
app.use('/api/classes', classRoutes);

// Conversation routes
app.use('/api/conversations', conversationRoutes);

// CQRS routes
app.use('/api/cqrs/students', cqrsStudentRoutes);
app.use('/api/cqrs/teachers', cqrsTeacherRoutes);

// Customer routes
app.use('/api/customers', customerRoutes);
app.use('/api/customer-events', customerEventRoutes);

// Document routes
app.use('/api/documents', documentRoutes);

// Equipment routes
app.use('/api/equipment', equipmentRoutes);

// Event routes
app.use('/api/events', eventRoutes);

// Examination routes
app.use('/api/examinations', examinationRoutes);
app.use('/api/exam-timetables', examTimetableRoutes);

// Expense routes
app.use('/api/expenses', expenseRoutes);

// Fee routes
app.use('/api/fees', feeRoutes);
app.use('/api/fee-items', feeItemRoutes);

// File routes
app.use('/api/files', fileRoutes);

// Google Drive routes
app.use('/api/google-drive', googleDriveRoutes);

// Grade routes
app.use('/api/grades', gradeRoutes);

// Hostel routes
app.use('/api/hostels', hostelRoutes);

// Income routes
app.use('/api/incomes', incomeRoutes);

// Installment routes
app.use('/api/installments', installmentRoutes);

// Integrated Payment routes
app.use('/api/integrated-payments', integratedPaymentRoutes);

// Inventory routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory-suppliers', inventorySupplierRoutes);

// Library routes
app.use('/api/library', libraryRoutes);
app.use('/api/library-management', libraryManagementRoutes);

// Message routes
app.use('/api/messages', messageRoutes);

// Monthly Test routes
app.use('/api/monthly-tests', monthlyTestRoutes);

// Notice routes
app.use('/api/notices', noticeRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Owner routes
app.use('/api/owners', ownerRoutes);

// Parent routes
app.use('/api/parents', parentRoutes);

// Password Reset Token routes
app.use('/api/password-reset-tokens', passwordResetTokenRoutes);

// Payment routes
app.use('/api/payments', paymentRoutes);

// Payroll routes
app.use('/api/payrolls', payrollRoutes);

// Purchase Order routes
app.use('/api/purchase-orders', purchaseOrderRoutes);

// Refund routes
app.use('/api/refunds', refundRoutes);

// School routes
app.use('/api/schools', schoolRoutes);

// Section routes
app.use('/api/sections', sectionRoutes);

// Staff routes
app.use('/api/staff', staffRoutes);
app.use('/api/staffs', staffsRoutes);

// Student routes
app.use('/api/students', studentRoutes);
app.use('/api/student-events', studentEventRoutes);

// Subject routes
app.use('/api/subjects', subjectRoutes);

// Teacher routes
app.use('/api/teachers', teacherRoutes);
app.use('/api/teacher-class-subjects', teacherClassSubjectRoutes);

// Timetable AI routes
app.use('/api/timetable-ai', timetableAIRoutes);

// Transport routes
app.use('/api/transport', transportRoutes);

// User routes
app.use('/api/users', userRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🚀 Starting School Management API...');
    console.log(`🔧 Port: ${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    await initializeDatabase();
    
    // Set server timeout to 2 minutes
    server.timeout = 12000000; // 120 seconds
    server.keepAliveTimeout = 12000000; // 120 seconds
    
    server.listen(PORT, () => {
      const memUsage = process.memoryUsage();
      console.log(`🚀 School Management API is running on port ${PORT}`);
      console.log(`📊 Memory Usage:`);
      console.log(`   RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB`);
      console.log(`   Heap Total: ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`);
      console.log(`   Heap Used: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      console.log(`   External: ${Math.round(memUsage.external / 1024 / 1024)}MB`);
      console.log(`⏰ Uptime: ${Math.round(process.uptime())}s`);
      console.log(`🔧 Features: MySQL2 Database, Authentication, File Upload, Encryption`);
      console.log(`💾 Database: ${dbPool ? 'Connected' : 'Not connected'}`);
      console.log(`🔐 Encryption: ${process.env.API_ENCRYPTION_KEY ? 'Enabled' : 'Disabled'}`);
      console.log(`📡 Routes: All routes from routes folder are now registered`);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch((error) => {
  console.error('❌ Critical error during startup:', error);
  process.exit(1);
});

// Export for testing
export { app, server }; 

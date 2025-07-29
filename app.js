import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import helmet from 'helmet';
import mysql from 'mysql2/promise';
import CryptoJS from 'crypto-js';
import multer from 'multer';

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
const PORT = process.env.PORT || 4000;

// Database connection pool
let dbPool;

// Initialize database connection
async function initializeDatabase() {
  try {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'school',
      password: process.env.DB_PASSWORD || 'YourName123!',
      database: process.env.DB_NAME || 'school',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      acquireTimeout: 60000,
      timeout: 60000,
      reconnect: true
    };
    
    console.log('🔧 Connecting to database...');
    dbPool = mysql.createPool(dbConfig);

    // Test connection
    const connection = await dbPool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('💡 Please check your database credentials in .env file');
  }
}

// ======================
// MIDDLEWARE SETUP
// ======================

// Security middleware
app.use(helmet());
app.use(compression());

// Enhanced CORS configuration
app.use(cors({
  origin: '*',
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['*'],
  exposedHeaders: ['*'],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Additional CORS headers for all requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Credentials', 'false');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure req.body is always an object
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

// JSON parsing error handler
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

// Encryption middleware (simplified)
app.use((req, res, next) => {
  try {
    // Skip encryption for file uploads and health checks
    if (req.path.includes('/upload') || req.path.includes('/health')) {
      return next();
    }

    // Handle encrypted requests
    if (req.body && req.body.encryptedData) {
      const encryptionKey = process.env.API_ENCRYPTION_KEY;
      
      if (!encryptionKey) {
        return res.status(500).json({
          success: false,
          message: 'Server encryption configuration error'
        });
      }

      try {
        const bytes = CryptoJS.AES.decrypt(req.body.encryptedData, encryptionKey);
        const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedData) {
          return res.status(400).json({
            success: false,
            message: 'Invalid encrypted data'
          });
        }

        req.body = JSON.parse(decryptedData);
      } catch (decryptError) {
        return res.status(400).json({
          success: false,
          message: 'Failed to decrypt request data'
        });
      }
    }

    // Handle encrypted responses
    const originalJson = res.json;
    res.json = function(data) {
      try {
        if (res.statusCode >= 400) {
          return originalJson.call(this, data);
        }

        const encryptionKey = process.env.API_ENCRYPTION_KEY;
        if (!encryptionKey) {
          return originalJson.call(this, data);
        }

        const encryptedResponse = CryptoJS.AES.encrypt(
          JSON.stringify(data), 
          encryptionKey
        ).toString();

        return originalJson.call(this, { encryptedData: encryptedResponse });
      } catch (error) {
        return originalJson.call(this, data);
      }
    };
    
    next();
  } catch (error) {
    console.error('❌ Encryption middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// File upload configuration
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ======================
// BASIC ROUTES
// ======================

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'School Management API is running',
    version: '2.0',
    timestamp: new Date().toISOString(),
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
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
    },
    uptime: `${Math.round(process.uptime())}s`,
    database: dbPool ? 'Connected' : 'Not connected'
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
        message: 'Database not connected'
      });
    }
    
    const result = await dbPool.execute('SELECT 1 as test');
    
    res.json({
      success: true,
      connected: true,
      message: 'Database connected and responding',
      test: result[0][0]
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

// ======================
// ROUTE REGISTRATION
// ======================

// Authentication & Authorization
app.use('/api/auth', authRoutes);
app.use('/api/abac', abacRoutes);
app.use('/api/pbac', pbacRoutes);
app.use('/api/rbac', rbacRoutes);

// Core entities
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/staffs', staffsRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/owners', ownerRoutes);

// Academic management
app.use('/api/classes', classRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/teacher-class-subjects', teacherClassSubjectRoutes);

// Assignments & Assessments
app.use('/api/assignments', assignmentRoutes);
app.use('/api/assignment-attachments', assignmentAttachmentRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/examinations', examinationRoutes);
app.use('/api/exam-timetables', examTimetableRoutes);
app.use('/api/monthly-tests', monthlyTestRoutes);

// Financial management
app.use('/api/fees', feeRoutes);
app.use('/api/fee-items', feeItemRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/integrated-payments', integratedPaymentRoutes);
app.use('/api/refunds', refundRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/incomes', incomeRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/payrolls', payrollRoutes);

// School management
app.use('/api/schools', schoolRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/notifications', notificationRoutes);

// Library management
app.use('/api/library', libraryRoutes);
app.use('/api/library-management', libraryManagementRoutes);

// Inventory management
app.use('/api/inventory', inventoryRoutes);
app.use('/api/inventory-suppliers', inventorySupplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);

// Equipment & Transport
app.use('/api/equipment', equipmentRoutes);
app.use('/api/transport', transportRoutes);

// Hostel management
app.use('/api/hostels', hostelRoutes);

// Customer management
app.use('/api/customers', customerRoutes);
app.use('/api/customer-events', customerEventRoutes);

// Communication
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// Documents & Files
app.use('/api/documents', documentRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/google-drive', googleDriveRoutes);

// CQRS patterns
app.use('/api/cqrs/students', cqrsStudentRoutes);
app.use('/api/cqrs/teachers', cqrsTeacherRoutes);

// Student events
app.use('/api/student-events', studentEventRoutes);

// Password management
app.use('/api/password-reset-tokens', passwordResetTokenRoutes);

// Timetable AI
app.use('/api/timetable-ai', timetableAIRoutes);

// ======================
// ERROR HANDLING
// ======================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ======================
// SERVER STARTUP
// ======================

async function startServer() {
  try {
    console.log('🚀 Starting School Management API...');
    console.log(`🔧 Port: ${PORT}`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    await initializeDatabase();
    
    app.listen(PORT, () => {
      const memUsage = process.memoryUsage();
      console.log(`🚀 School Management API is running on port ${PORT}`);
      console.log(`📊 Memory Usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      console.log(`💾 Database: ${dbPool ? 'Connected' : 'Not connected'}`);
      console.log(`🔐 Encryption: ${process.env.API_ENCRYPTION_KEY ? 'Enabled' : 'Disabled'}`);
      console.log(`📡 CORS: Enabled for multiple origins`);
      console.log(`📡 Routes: All API routes registered successfully`);
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

export { app }; 
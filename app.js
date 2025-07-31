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
import usersRoutes from './routes/users.js';
import studentsRoutes from './routes/students.js';
import customersRoutes from './routes/customers.js';
import classesRoutes from './routes/classes.js';
import teachersRoutes from './routes/teachers.js';
import parentsRoutes from './routes/parents.js';
import schoolsRoutes from './routes/schools.js';
import staffRoutes from './routes/staff.js';
import subjectsRoutes from './routes/subjects.js';
import gradesRoutes from './routes/grades.js';
import attendancesRoutes from './routes/attendances.js';
import paymentsRoutes from './routes/payments.js';
import feesRoutes from './routes/fees.js';
import noticesRoutes from './routes/notices.js';
import messagesRoutes from './routes/messages.js';
import eventsRoutes from './routes/events.js';
import assignmentsRoutes from './routes/assignments.js';
import libraryRoutes from './routes/libraryRoutes.js';
// import inventoryRoutes from './routes/inventory.js';
// import transportRoutes from './routes/transportRoutes.js';
// import hostelRoutes from './routes/hostelRoutes.js';
// import equipmentRoutes from './routes/equipmentRoutes.js';
import authRoutes from './routes/auth.js';
import notificationsRoutes from './routes/notifications.js';
import documentsRoutes from './routes/documents.js';
import filesRoutes from './routes/files.js';

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
          user: process.env.DB_USER || 'mohammad1_ahmadi1',
          password: process.env.DB_PASSWORD || 'mohammad112_',
          database: process.env.DB_NAME || 'mohammad1_school'
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
        acquireTimeout: 30000, // 30 seconds
        connectTimeout: 30000 // 30 seconds for initial connection
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
              acquireTimeout: 30000, // 30 seconds
              connectTimeout: 30000 // 30 seconds for initial connection
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

  // Enhanced CORS configuration for frontend
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Allow all origins in development
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // Production: Allow specific domains
    const allowedOrigins = [
      'https://khwanzay.school',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      process.env.FRONTEND_URL,
      process.env.DOMAIN_URL
    ].filter(Boolean);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // Allow all for now, remove this in production
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'x-client-version', 
    'x-device-type', 
    'x-request-id', 
    'x-request-timestamp',
    'Accept',
    'Origin',
    'X-Forwarded-For'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
}));

// Ensure CORS headers are always set, even on errors
app.use((req, res, next) => {
  // Set CORS headers for all responses
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, x-client-version, x-device-type, x-request-id, x-request-timestamp, Accept, Origin, X-Forwarded-For');
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  }
  
  next();
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
      setTimeout(() => reject(new Error('Database query timeout')), 30000); // 30 seconds
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

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, username, password } = req.body;
      
      // Use either email or username
      const loginIdentifier = email || username;
      
      if (!loginIdentifier || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email/username and password are required'
        });
      }
      
      if (!dbPool) {
        // Mock authentication if database not available
        if (loginIdentifier === 'admin@school.com' && password === 'password') {
          const token = jwt.sign(
            { userId: 1, email: loginIdentifier, role: 'admin' },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
          );
          
          return res.json({
            success: true,
            message: 'Login successful',
            token,
            user: { id: 1, email: loginIdentifier, role: 'admin' }
          });
        }
      } else {
        // Database authentication - check both email and username fields
        const users = await query(
          'SELECT * FROM users WHERE (email = ? OR username = ?) AND status = "ACTIVE"',
          [loginIdentifier, loginIdentifier]
        );
        
        if (users.length > 0) {
          const user = users[0];
          const isValidPassword = await bcryptjs.compare(password, user.password);
          
          if (isValidPassword) {
            const token = jwt.sign(
              { userId: user.id, email: user.email, role: user.role },
              process.env.JWT_SECRET || 'your-secret-key',
              { expiresIn: '24h' }
            );
            
            return res.json({
              success: true,
              message: 'Login successful',
              token,
              user: { id: user.id, email: user.email, role: user.role }
            });
          }
        }
      }
      
      res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  });

// ============================================================================
// API ROUTES - Using route modules from ./routes/ folder
// ============================================================================

// Mount all route modules
app.use('/api/users', usersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/teachers', teachersRoutes);
app.use('/api/parents', parentsRoutes);
app.use('/api/schools', schoolsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/grades', gradesRoutes);
app.use('/api/attendances', attendancesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/fees', feesRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/library', libraryRoutes);
// app.use('/api/inventory', inventoryRoutes);
// app.use('/api/transport', transportRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/files', filesRoutes);

// ============================================================================
// LEGACY INLINE ROUTES (TO BE REMOVED - KEEPING FOR BACKUP)
// ============================================================================

  // User management routes
  app.get('/api/users-legacy', async (req, res) => {
    try {
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Users endpoint available (database not connected)',
          data: []
        });
      }
      
      const users = await query('SELECT id, username, email, role, status, createdAt FROM users WHERE deletedAt IS NULL');
      
      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: users
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        error: error.message
      });
    }
  });

  app.post('/api/users', async (req, res) => {
    try {
      const { username, email, password, role } = req.body;
      
      if (!dbPool) {
        // Mock user creation
        const hashedPassword = await bcryptjs.hash(password, 10);
        return res.json({
          success: true,
          message: 'User created successfully (mock)',
          data: { username, email, role, hashedPassword }
        });
      }
      
      // Check if user exists
      const existingUsers = await query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'User with this email or username already exists'
        });
      }
      
      // Hash password
      const hashedPassword = await bcryptjs.hash(password, 10);
      
      // Insert user
      const result = await query(
        'INSERT INTO users (username, email, password, role, status) VALUES (?, ?, ?, ?, "ACTIVE")',
        [username, email, hashedPassword, role]
      );
      
      res.json({
        success: true,
        message: 'User created successfully',
        data: { id: result.insertId, username, email, role }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'User creation failed',
        error: error.message
      });
    }
  });

  // Student routes
  app.get('/api/students-legacy', async (req, res) => {
    try {
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Students endpoint available (database not connected)',
          data: []
        });
      }
      
      const students = await query(`
        SELECT s.*, u.name as parentName, u.email as parentEmail 
        FROM students s 
        LEFT JOIN users u ON s.parentId = u.id 
        WHERE s.deletedAt IS NULL
      `);
      
      res.json({
        success: true,
        message: 'Students retrieved successfully',
        data: students
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve students',
        error: error.message
      });
    }
  });

  app.post('/api/students', async (req, res) => {
    try {
      const { name, email, grade, parentId, address, phone } = req.body;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Student created successfully (mock)',
          data: { name, email, grade, parentId, address, phone }
        });
      }
      
      const result = await query(
        'INSERT INTO students (name, email, grade, parentId, address, phone, status) VALUES (?, ?, ?, ?, ?, ?, "ACTIVE")',
        [name, email, grade, parentId, address, phone]
      );
      
      res.json({
        success: true,
        message: 'Student created successfully',
        data: { id: result.insertId, name, email, grade }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Student creation failed',
        error: error.message
      });
    }
  });

  // Teacher routes
  app.get('/api/teachers-legacy', async (req, res) => {
    try {
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Teachers endpoint available (database not connected)',
          data: []
        });
      }
      
      const teachers = await query(`
        SELECT t.*, u.name, u.email 
        FROM teachers t 
        LEFT JOIN users u ON t.userId = u.id 
        WHERE t.deletedAt IS NULL
      `);
      
      res.json({
        success: true,
        message: 'Teachers retrieved successfully',
        data: teachers
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve teachers',
        error: error.message
      });
    }
  });

  // Class routes
  app.get('/api/classes-legacy', async (req, res) => {
    try {
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Classes endpoint available (database not connected)',
          data: []
        });
      }
      
      const classes = await query(`
        SELECT c.*, t.name as teacherName, s.name as subjectName
        FROM classes c 
        LEFT JOIN teachers t ON c.teacherId = t.id
        LEFT JOIN subjects s ON c.subjectId = s.id
        WHERE c.deletedAt IS NULL
      `);
      
      res.json({
        success: true,
        message: 'Classes retrieved successfully',
        data: classes
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve classes',
        error: error.message
      });
    }
  });

  // Payment routes
  app.get('/api/payments-legacy', async (req, res) => {
    try {
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Payments endpoint available (database not connected)',
          data: []
        });
      }
      
      const payments = await query(`
        SELECT p.*, s.name as studentName, u.name as payerName
        FROM payments p 
        LEFT JOIN students s ON p.studentId = s.id
        LEFT JOIN users u ON p.payerId = u.id
        WHERE p.deletedAt IS NULL
        ORDER BY p.createdAt DESC
      `);
      
      res.json({
        success: true,
        message: 'Payments retrieved successfully',
        data: payments
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve payments',
        error: error.message
      });
    }
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

  // Customer routes
  app.get('/api/customers-legacy', async (req, res) => {
    try {
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Customers endpoint available (database not connected)',
          data: []
        });
      }
      
      const customers = await query(`
        SELECT * FROM customers 
        WHERE deletedAt IS NULL 
        ORDER BY createdAt DESC
      `);
      
      res.json({
        success: true,
        message: 'Customers retrieved successfully',
        data: customers
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve customers',
        error: error.message
      });
    }
  });

  app.post('/api/customers', async (req, res) => {
    try {
      const { 
        name, 
        email, 
        phone, 
        gender = 'Male',
        source = '',
        purpose = '',
        department = 'Academic',
        serialNumber = null,
        uuid = null,
        referredTo = null,
        referredById = null,
        metadata = '',
        status = 'ACTIVE'
      } = req.body;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Customer created successfully (mock)',
          data: { name, email, phone, gender, source, purpose, department }
        });
      }
      
      // Set default values for required fields to avoid undefined
      const customerData = {
        name: name || '',
        email: email || null,
        phone: phone || '',
        gender: gender || 'Male',
        source: source || '',
        purpose: purpose || '',
        department: department || 'Academic',
        serialNumber: serialNumber || null,
        uuid: uuid || null,
        referredTo: referredTo || null,
        referredById: referredById || null,
        metadata: metadata || '',
        ownerId: 1,
        schoolId: 1,
        createdBy: 1
      };
      
      const result = await query(
        `INSERT INTO customers (
          name, email, phone, gender, source, purpose, department, 
          serialNumber, uuid, referredTo, referredById, metadata,
          ownerId, schoolId, createdBy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          customerData.name,
          customerData.email,
          customerData.phone,
          customerData.gender,
          customerData.source,
          customerData.purpose,
          customerData.department,
          customerData.serialNumber,
          customerData.uuid,
          customerData.referredTo,
          customerData.referredById,
          customerData.metadata,
          customerData.ownerId,
          customerData.schoolId,
          customerData.createdBy
        ]
      );
      
      res.json({
        success: true,
        message: 'Customer created successfully',
        data: { 
          id: result.insertId, 
          name: customerData.name, 
          email: customerData.email, 
          phone: customerData.phone,
          gender: customerData.gender,
          source: customerData.source,
          purpose: customerData.purpose,
          department: customerData.department
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Customer creation failed',
        error: error.message
      });
    }
  });

  // Customer Analytics Endpoints (matching routes/customers.js structure)
  app.get('/api/customers-legacy/conversion-analytics', async (req, res) => {
    try {
      const { period = '30d' } = req.query;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Conversion analytics available (mock data)',
          data: {
            period,
            totalCustomers: 150,
            convertedCustomers: 45,
            conversionRate: 30,
            trend: [
              { date: '2024-01-01', conversions: 5 },
              { date: '2024-01-02', conversions: 8 },
              { date: '2024-01-03', conversions: 12 }
            ]
          }
        });
      }
      
      // Mock analytics data for now
      res.json({
        success: true,
        message: 'Conversion analytics retrieved successfully',
        data: {
          period,
          totalCustomers: 150,
          convertedCustomers: 45,
          conversionRate: 30,
          trend: [
            { date: '2024-01-01', conversions: 5 },
            { date: '2024-01-02', conversions: 8 },
            { date: '2024-01-03', conversions: 12 }
          ]
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversion analytics',
        error: error.message
      });
    }
  });

  app.get('/api/customers-legacy/conversion-rates', async (req, res) => {
    try {
      const { period = 'monthly' } = req.query;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Conversion rates available (mock data)',
          data: {
            period,
            rates: [
              { month: 'January', rate: 25 },
              { month: 'February', rate: 30 },
              { month: 'March', rate: 35 }
            ],
            averageRate: 30
          }
        });
      }
      
      res.json({
        success: true,
        message: 'Conversion rates retrieved successfully',
        data: {
          period,
          rates: [
            { month: 'January', rate: 25 },
            { month: 'February', rate: 30 },
            { month: 'March', rate: 35 }
          ],
          averageRate: 30
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve conversion rates',
        error: error.message
      });
    }
  });

  app.get('/api/customers-legacy/analytics/reports', async (req, res) => {
    try {
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Analytics reports available (mock data)',
          data: {
            totalCustomers: 150,
            activeCustomers: 120,
            newCustomers: 25,
            revenue: 45000,
            reports: [
              {
                id: 1,
                name: 'Monthly Conversion Report',
                type: 'conversion',
                date: '2024-01-15'
              },
              {
                id: 2,
                name: 'Customer Growth Report',
                type: 'growth',
                date: '2024-01-10'
              }
            ]
          }
        });
      }
      
      res.json({
        success: true,
        message: 'Analytics reports retrieved successfully',
        data: {
          totalCustomers: 150,
          activeCustomers: 120,
          newCustomers: 25,
          revenue: 45000,
          reports: [
            {
              id: 1,
              name: 'Monthly Conversion Report',
              type: 'conversion',
              date: '2024-01-15'
            },
            {
              id: 2,
              name: 'Customer Growth Report',
              type: 'growth',
              date: '2024-01-10'
            }
          ]
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics reports',
        error: error.message
      });
    }
  });

  // Additional customer endpoints from routes/customers.js
  app.get('/api/customers-legacy/analytics/dashboard', async (req, res) => {
    try {
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Analytics dashboard available (mock data)',
          data: {
            totalCustomers: 150,
            activeCustomers: 120,
            conversionRate: 30,
            revenue: 45000,
            recentActivity: [
              { type: 'new_customer', customer: 'John Doe', time: '2 hours ago' },
              { type: 'conversion', customer: 'Jane Smith', time: '4 hours ago' }
            ]
          }
        });
      }
      
      res.json({
        success: true,
        message: 'Analytics dashboard retrieved successfully',
        data: {
          totalCustomers: 150,
          activeCustomers: 120,
          conversionRate: 30,
          revenue: 45000,
          recentActivity: [
            { type: 'new_customer', customer: 'John Doe', time: '2 hours ago' },
            { type: 'conversion', customer: 'Jane Smith', time: '4 hours ago' }
          ]
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics dashboard',
        error: error.message
      });
    }
  });

  app.get('/api/customers-legacy/unconverted', async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Unconverted customers available (mock data)',
          data: {
            customers: [
              { id: 1, name: 'John Doe', email: 'john@example.com', status: 'LEAD' },
              { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'PROSPECT' }
            ],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 25,
              totalPages: 1
            }
          }
        });
      }
      
      const customers = await query(`
        SELECT * FROM customers 
        WHERE status IN ('LEAD', 'PROSPECT') AND deletedAt IS NULL
        ORDER BY createdAt DESC
        LIMIT ? OFFSET ?
      `, [parseInt(limit), offset]);
      
      const totalResult = await query(`
        SELECT COUNT(*) as total FROM customers 
        WHERE status IN ('LEAD', 'PROSPECT') AND deletedAt IS NULL
      `);
      
      const total = totalResult[0].total;
      
      res.json({
        success: true,
        message: 'Unconverted customers retrieved successfully',
        data: {
          customers,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve unconverted customers',
        error: error.message
      });
    }
  });

  app.get('/api/customers-legacy/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Customer endpoint available (database not connected)',
          data: null
        });
      }
      
      const customers = await query(
        'SELECT * FROM customers WHERE id = ? AND deletedAt IS NULL',
        [id]
      );
      
      if (customers.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Customer retrieved successfully',
        data: customers[0]
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve customer',
        error: error.message
      });
    }
  });

  app.put('/api/customers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, phone, address, status, notes } = req.body;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Customer updated successfully (mock)',
          data: { id, name, email, phone, address, status, notes }
        });
      }
      
      const result = await query(
        'UPDATE customers SET name = ?, email = ?, phone = ?, address = ?, status = ?, notes = ?, updatedAt = NOW() WHERE id = ?',
        [name, email, phone, address, status, notes, id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: { id, name, email, phone, address, status }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Customer update failed',
        error: error.message
      });
    }
  });

  app.delete('/api/customers/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Customer deleted successfully (mock)',
          data: { id }
        });
      }
      
      const result = await query(
        'UPDATE customers SET deletedAt = NOW() WHERE id = ?',
        [id]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({
          success: false,
          message: 'Customer not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Customer deleted successfully',
        data: { id }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Customer deletion failed',
        error: error.message
      });
    }
  });

  // Student Analytics Endpoints
  app.get('/api/students-legacy/converted', async (req, res) => {
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      if (!dbPool) {
        return res.json({
          success: true,
          message: 'Converted students available (mock data)',
          data: {
            students: [
              {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                convertedAt: '2024-01-15',
                conversionSource: 'Website'
              },
              {
                id: 2,
                name: 'Jane Smith',
                email: 'jane@example.com',
                convertedAt: '2024-01-14',
                conversionSource: 'Referral'
              }
            ],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 25,
              totalPages: 1
            }
          }
        });
      }
      
      try {
        // Get converted students (students who became customers)
        const students = await query(`
          SELECT s.*, c.convertedAt, c.conversionSource
          FROM students s
          LEFT JOIN customers c ON s.email = c.email
          WHERE c.convertedAt IS NOT NULL
          ORDER BY c.convertedAt DESC
          LIMIT ? OFFSET ?
        `, [parseInt(limit), offset]);
        
        // Get total count
        const totalResult = await query(`
          SELECT COUNT(*) as total
          FROM students s
          LEFT JOIN customers c ON s.email = c.email
          WHERE c.convertedAt IS NOT NULL
        `);
        
        const total = totalResult[0].total;
        
        res.json({
          success: true,
          message: 'Converted students retrieved successfully',
          data: {
            students,
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total,
              totalPages: Math.ceil(total / limit)
            }
          }
        });
      } catch (dbError) {
        // If database query fails, return mock data
        console.error('Database query failed:', dbError.message);
        return res.json({
          success: true,
          message: 'Converted students available (mock data due to database issue)',
          data: {
            students: [
              {
                id: 1,
                name: 'John Doe',
                email: 'john@example.com',
                convertedAt: '2024-01-15',
                conversionSource: 'Website'
              },
              {
                id: 2,
                name: 'Jane Smith',
                email: 'jane@example.com',
                convertedAt: '2024-01-14',
                conversionSource: 'Referral'
              }
            ],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 25,
              totalPages: 1
            }
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve converted students',
        error: error.message
      });
    }
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
        '/api/auth/login',
        '/api/users',
        '/api/students',
        '/api/teachers',
        '/api/classes',
        '/api/payments',
        '/api/customers',
        '/api/upload',
        '/api/database/status'
      ]
    });
  });

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
      
      // Set server timeout to 30 seconds
server.timeout = 30000; // 30 seconds
server.keepAliveTimeout = 30000; // 30 seconds
      
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

import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();
import { validatePaymentData, validateRefundData, createPaymentLog, generateReceiptNumber, calculateFines } from '../utils/paymentUtils.js';

// BigInt conversion utility
function convertBigInts(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  }
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        newObj[key] = convertBigInts(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}
import paymentCache from '../cache/paymentCache.js';
import paymentGatewayService from '../services/paymentGatewayService.js';
import fileGenerationService from '../services/fileGenerationService.js';
import googleDriveService from '../services/googleDriveService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/payments';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, PDF, and document files are allowed!'));
    }
  }
});

// Generate bill number
const generateBillNumber = async (schoolId) => {
  const year = new Date().getFullYear();
  const prefix = `BILL-${year}-`;
  
  const lastBill = await prisma.bill.findFirst({
    where: {
      schoolId: BigInt(schoolId),
      billNumber: { startsWith: prefix },
      deletedAt: null
    },
    orderBy: { billNumber: 'desc' }
  });

  let sequence = 1;
  if (lastBill && lastBill.billNumber) {
    const lastSequence = parseInt(lastBill.billNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(6, '0')}`;
};

class PaymentController {
  // Create new payment with file upload support
  async createPayment(req, res) {
    try {
      // Handle file upload first
      upload.array('files', 5)(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ success: false, message: err.message });
        }

        try {
          const { error, value } = validatePaymentData(req.body);
          if (error) {
            return res.status(400).json({ success: false, message: error.details[0].message });
          }

          const { schoolId, id: userId } = req.user;
          const { items, ...paymentData } = value; // Extract items from the data
          paymentData.schoolId = schoolId;
          paymentData.createdBy = userId;

          // Generate receipt number
          paymentData.receiptNumber = await generateReceiptNumber(schoolId);

          // Calculate fines if overdue
          if (paymentData.dueDate && new Date() > new Date(paymentData.dueDate)) {
            paymentData.fine = await calculateFines(paymentData.dueDate, paymentData.amount);
          }

          // Process payment through gateway if applicable
          if (paymentData.gateway && paymentData.gateway !== 'CASH') {
            const gatewayResult = await paymentGatewayService.processPaymentGateway(paymentData);
            if (!gatewayResult.success) {
              return res.status(400).json({ success: false, message: gatewayResult.message });
            }
            paymentData.gatewayTransactionId = gatewayResult.transactionId;
            paymentData.status = 'PROCESSING';
          }

          // Prepare the create data with nested items if provided
          const createData = {
            ...paymentData,
            studentId: paymentData.studentId ? BigInt(paymentData.studentId) : null,
            parentId: paymentData.parentId ? BigInt(paymentData.parentId) : null,
            feeStructureId: paymentData.feeStructureId ? BigInt(paymentData.feeStructureId) : null,
            schoolId: BigInt(schoolId),
            createdBy: BigInt(userId),
            ...(items && items.length > 0 && {
              items: {
                create: items.map(item => ({
                  ...item,
                  feeItemId: BigInt(item.feeItemId),
                  schoolId: BigInt(schoolId)
                }))
              }
            })
          };

          const payment = await prisma.payment.create({
            data: createData,
            include: {
              student: { 
                select: { 
                  id: true, 
                  uuid: true, 
                  user: { select: { firstName: true, lastName: true } }
                } 
              },
              parent: { 
                select: { 
                  id: true, 
                  uuid: true, 
                  user: { select: { firstName: true, lastName: true } }
                } 
              },
              feeStructure: { select: { id: true, uuid: true, name: true } },
              items: true
            }
          });

          // Create bill for the payment
          const billNumber = await generateBillNumber(schoolId);
          const bill = await prisma.bill.create({
            data: {
              billNumber,
              paymentId: payment.id,
              totalAmount: payment.total,
              status: payment.status === 'PAID' ? 'PAID' : 'ISSUED',
              description: `Bill for payment ${payment.receiptNumber}`,
              remarks: payment.remarks,
              schoolId: BigInt(schoolId),
              createdBy: BigInt(userId)
            },
            include: {
              payment: {
                select: {
                  id: true,
                  receiptNumber: true,
                  amount: true,
                  total: true,
                  method: true,
                  type: true,
                  status: true,
                  paymentDate: true
                }
              },
              school: {
                select: {
                  id: true,
                  name: true,
                  address: true,
                  phone: true,
                  email: true
                }
              }
            }
          });

          // Get school information for file generation
          const school = await prisma.school.findFirst({
            where: { id: BigInt(schoolId) },
            select: { id: true, name: true, address: true, phone: true, email: true }
          });

          // Get student and parent information for file generation
          const student = payment.studentId ? await prisma.student.findFirst({
            where: { id: payment.studentId },
            include: { user: { select: { firstName: true, lastName: true } } }
          }) : null;

          const parent = payment.parentId ? await prisma.parent.findFirst({
            where: { id: payment.parentId },
            include: { user: { select: { firstName: true, lastName: true } } }
          }) : null;

          // Handle manual file uploads if any
          const uploadedFiles = [];
          if (req.files && req.files.length > 0) {
            for (const file of req.files) {
              const fileRecord = await prisma.file.create({
                data: {
                  filename: file.filename,
                  originalName: file.originalname,
                  filePath: file.path,
                  fileSize: BigInt(file.size),
                  mimeType: file.mimetype,
                  fileType: path.extname(file.originalname).toLowerCase().substring(1),
                  entityType: 'bill',
                  entityId: bill.id,
                  description: `File uploaded with payment ${payment.receiptNumber}`,
                  tags: ['payment', 'bill'],
                  isPublic: false,
                  schoolId: BigInt(schoolId),
                  createdBy: BigInt(userId)
                }
              });
              uploadedFiles.push(fileRecord);
            }
          }

          // Generate files (PDF and Excel from Google Drive template)
          const generatedFiles = [];
          try {
            // Check if Google Drive template is available
            const hasGoogleDriveTemplate = await googleDriveService.hasBillTemplate(schoolId);
            
            if (hasGoogleDriveTemplate) {
              // Generate Excel bill from Google Drive template
              try {
                const excelBill = await googleDriveService.generateBillFromTemplate(
                  schoolId, 
                  payment, 
                  bill
                );

                const excelFileRecord = await prisma.file.create({
                  data: {
                    filename: excelBill.filename,
                    originalName: excelBill.filename,
                    filePath: excelBill.filePath,
                    fileSize: BigInt(excelBill.fileSize),
                    mimeType: excelBill.mimeType,
                    fileType: 'xlsx',
                    entityType: 'bill',
                    entityId: bill.id,
                    description: `Excel bill generated from Google Drive template for payment ${payment.receiptNumber}`,
                    tags: ['payment', 'bill', 'excel', 'google-drive'],
                    isPublic: false,
                    schoolId: BigInt(schoolId),
                    createdBy: BigInt(userId)
                  }
                });
                generatedFiles.push(excelFileRecord);
              } catch (excelError) {
                console.error('Error generating Excel bill from Google Drive template:', excelError);
                // Continue with PDF generation even if Excel fails
              }
            }

            // Always generate PDF files (receipt and invoice)
            const autoGeneratedFiles = await fileGenerationService.generatePaymentFiles(
              payment, 
              bill, 
              school, 
              student, 
              parent
            );

            for (const fileInfo of autoGeneratedFiles) {
              const fileRecord = await prisma.file.create({
                data: {
                  filename: fileInfo.filename,
                  originalName: fileInfo.originalName,
                  filePath: fileInfo.filePath,
                  fileSize: BigInt(fileInfo.fileSize),
                  mimeType: fileInfo.mimeType,
                  fileType: fileInfo.fileType,
                  entityType: fileInfo.entityType,
                  entityId: bill.id,
                  description: fileInfo.description,
                  tags: fileInfo.tags,
                  isPublic: false,
                  schoolId: BigInt(schoolId),
                  createdBy: BigInt(userId)
                }
              });
              generatedFiles.push(fileRecord);
            }
          } catch (error) {
            console.error('Error generating automatic files:', error);
            // Don't fail the payment creation if file generation fails
          }

          // Create payment log
          await createPaymentLog(payment.id, 'created', null, payment, req.ip, req.get('User-Agent'), schoolId, userId);

          // Cache payment
          await paymentCache.cachePayment(payment);

          // Convert BigInt values to strings for JSON serialization
          const paymentResponse = JSON.parse(JSON.stringify(payment, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));

          const billResponse = JSON.parse(JSON.stringify(bill, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));

          // Read and encode PDF files for frontend
          const filesWithContent = [];
          for (const file of generatedFiles) {
            try {
              const fileBuffer = await fs.readFile(file.filePath);
              const base64Content = fileBuffer.toString('base64');
              filesWithContent.push({
                id: file.id.toString(),
                filename: file.filename,
                originalName: file.originalName,
                fileSize: file.fileSize.toString(),
                mimeType: file.mimeType,
                type: 'generated',
                content: base64Content,
                contentLength: fileBuffer.length
              });
            } catch (error) {
              console.error(`Error reading file ${file.filename}:`, error);
              // Include file info without content if reading fails
              filesWithContent.push({
                id: file.id.toString(),
                filename: file.filename,
                originalName: file.originalName,
                fileSize: file.fileSize.toString(),
                mimeType: file.mimeType,
                type: 'generated',
                error: 'Failed to read file content'
              });
            }
          }

          res.status(201).json({
            success: true,
            message: 'Payment and bill created successfully',
            data: {
              payment: paymentResponse,
              bill: billResponse,
              uploadedFiles: uploadedFiles.map(file => ({
                id: file.id.toString(),
                filename: file.filename,
                originalName: file.originalName,
                fileSize: file.fileSize.toString(),
                mimeType: file.mimeType,
                type: 'uploaded'
              })),
              generatedFiles: filesWithContent,
              totalFiles: uploadedFiles.length + generatedFiles.length
            }
          });
        } catch (error) {
          console.error('Payment creation error:', error);
          res.status(500).json({ success: false, message: 'Internal server error' });
        }
      });
    } catch (error) {
      console.error('Payment creation error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Check Google Drive setup for payment creation
   */
  async checkGoogleDriveSetup(req, res) {
    try {
      const { schoolId } = req.user;
      
      const isConnected = await googleDriveService.isConnected(schoolId);
      const hasTemplate = await googleDriveService.hasBillTemplate(schoolId);
      
      let setupStatus = 'ready';
      let message = 'Google Drive is ready for bill generation';
      let needsAction = null;
      
      if (!isConnected) {
        setupStatus = 'needs_auth';
        message = 'Google Drive authentication required for bill generation';
        needsAction = {
          type: 'authenticate',
          description: 'Connect to Google Drive to access bill templates',
          authUrl: googleDriveService.generateAuthUrl(schoolId)
        };
      } else if (!hasTemplate) {
        setupStatus = 'needs_template';
        message = 'Bill template not configured';
        needsAction = {
          type: 'select_template',
          description: 'Select an Excel file from Google Drive to use as bill template',
          filesUrl: '/api/google/files',
          setTemplateUrl: '/api/google/set-template'
        };
      }
      
      res.json({
        success: true,
        data: {
          setupStatus,
          message,
          isConnected,
          hasTemplate,
          needsAction,
          canProceed: setupStatus === 'ready'
        }
      });
    } catch (error) {
      console.error('Check Google Drive setup error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to check Google Drive setup' 
      });
    }
  }

  // Get all payments with advanced filtering
  async getPayments(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        status,
        method,
        type,
        studentId,
        parentId,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { schoolId, deletedAt: null };

      // Apply filters
      if (status) where.status = status;
      if (method) where.method = method;
      if (type) where.type = type;
      if (studentId) where.studentId = BigInt(studentId);
      if (parentId) where.parentId = BigInt(parentId);
      if (startDate || endDate) {
        where.paymentDate = {};
        if (startDate) where.paymentDate.gte = new Date(startDate);
        if (endDate) where.paymentDate.lte = new Date(endDate);
      }
      if (minAmount || maxAmount) {
        where.total = {};
        if (minAmount) where.total.gte = parseFloat(minAmount);
        if (maxAmount) where.total.lte = parseFloat(maxAmount);
      }
      if (search) {
        where.OR = [
          { transactionId: { contains: search, mode: 'insensitive' } },
          { receiptNumber: { contains: search, mode: 'insensitive' } },
          { remarks: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: {
            student: { 
              select: { 
                id: true, 
                uuid: true, 
                user: { select: { firstName: true, lastName: true } }
              } 
            },
            parent: { 
              select: { 
                id: true, 
                uuid: true, 
                user: { select: { firstName: true, lastName: true } }
              } 
            },
            feeStructure: { select: { id: true, uuid: true, name: true } },
            items: { include: { feeItem: true } }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.payment.count({ where })
      ]);

      res.json({
        success: true,
        data: payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get payment by ID
  async getPaymentById(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const payment = await prisma.payment.findFirst({
        where: { id: BigInt(id), schoolId, deletedAt: null },
                  include: {
            student: { 
              select: { 
                id: true, 
                uuid: true, 
                user: { select: { firstName: true, lastName: true } }
              } 
            },
            parent: { 
              select: { 
                id: true, 
                uuid: true, 
                user: { select: { firstName: true, lastName: true } }
              } 
            },
            feeStructure: { select: { id: true, uuid: true, name: true } },
            items: { include: { feeItem: true } },
            refunds: true,
            installments: true,
            paymentLogs: { orderBy: { createdAt: 'desc' } }
          }
      });

      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      res.json({ success: true, data: convertBigInts(payment) });
    } catch (error) {
      console.error('Get payment error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Update payment
  async updatePayment(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const updateData = req.body;

      const existingPayment = await prisma.payment.findFirst({
        where: { id: BigInt(id), schoolId, deletedAt: null }
      });

      if (!existingPayment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      // Validate update data
      const { error } = validatePaymentData(updateData, true);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      // Store old values for logging
      const oldValues = { ...existingPayment };

      const updatedPayment = await prisma.payment.update({
        where: { id: BigInt(id) },
        data: { ...updateData, updatedBy: userId },
        include: {
          student: { 
            select: { 
              id: true, 
              uuid: true, 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          parent: { 
            select: { 
              id: true, 
              uuid: true, 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          feeStructure: { select: { id: true, uuid: true, name: true } },
          items: { include: { feeItem: true } }
        }
      });

      // Create payment log
      await createPaymentLog(id, 'updated', oldValues, updatedPayment, req.ip, req.get('User-Agent'), schoolId, userId);

      // Update cache
      await paymentCache.invalidatePaymentCache(id, schoolId);

      res.json({
        success: true,
        message: 'Payment updated successfully',
        data: updatedPayment
      });
    } catch (error) {
      console.error('Update payment error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Delete payment (soft delete)
  async deletePayment(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;

      const payment = await prisma.payment.findFirst({
        where: { id: BigInt(id), schoolId, deletedAt: null }
      });

      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      await prisma.payment.update({
        where: { id: BigInt(id) },
        data: { deletedAt: new Date(), updatedBy: userId }
      });

      // Create payment log
      await createPaymentLog(id, 'deleted', payment, null, req.ip, req.get('User-Agent'), schoolId, userId);

      // Invalidate cache
      await paymentCache.invalidatePaymentCache(id, schoolId);

      res.json({ success: true, message: 'Payment deleted successfully' });
    } catch (error) {
      console.error('Delete payment error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Process payment status update
  async updatePaymentStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const { schoolId, id: userId } = req.user;

      const payment = await prisma.payment.findFirst({
        where: { id: BigInt(id), schoolId, deletedAt: null }
      });

      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      const oldStatus = payment.status;
      const updatedPayment = await prisma.payment.update({
        where: { id: BigInt(id) },
        data: { status, updatedBy: userId },
        include: {
          student: { 
            select: { 
              id: true, 
              uuid: true, 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          parent: { 
            select: { 
              id: true, 
              uuid: true, 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          feeStructure: { select: { id: true, uuid: true, name: true } },
          items: { include: { feeItem: true } }
        }
      });

      // Create payment log
      await createPaymentLog(id, 'status_changed', { status: oldStatus }, { status }, req.ip, req.get('User-Agent'), schoolId, userId);

      // Update cache
      await paymentCache.invalidatePaymentCache(id, schoolId);

      res.json({
        success: true,
        message: 'Payment status updated successfully',
        data: updatedPayment
      });
    } catch (error) {
      console.error('Update payment status error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create refund
  async createRefund(req, res) {
    try {
      const { error, value } = validateRefundData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId, id: userId } = req.user;
      const refundData = { ...value, schoolId, createdBy: userId };

      // Check if payment exists and belongs to school
      const payment = await prisma.payment.findFirst({
        where: { id: BigInt(value.paymentId), schoolId, deletedAt: null }
      });

      if (!payment) {
        return res.status(404).json({ success: false, message: 'Payment not found' });
      }

      // Check if refund amount is valid
      if (refundData.amount > payment.total) {
        return res.status(400).json({ success: false, message: 'Refund amount cannot exceed payment total' });
      }

      // Check existing refunds
      const existingRefunds = await prisma.refund.findMany({
        where: { paymentId: BigInt(value.paymentId), status: { not: 'CANCELLED' } }
      });

      const totalRefunded = existingRefunds.reduce((sum, refund) => sum + parseFloat(refund.amount), 0);
      if (totalRefunded + refundData.amount > payment.total) {
        return res.status(400).json({ success: false, message: 'Total refund amount cannot exceed payment total' });
      }

      const refund = await prisma.refund.create({
        data: refundData,
        include: {
          payment: { select: { id: true, uuid: true, amount: true, total: true } }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Refund created successfully',
        data: refund
      });
    } catch (error) {
      console.error('Create refund error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get payment analytics
  async getPaymentAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate, groupBy = 'month' } = req.query;

      const where = { schoolId, deletedAt: null };
      if (startDate || endDate) {
        where.paymentDate = {};
        if (startDate) where.paymentDate.gte = new Date(startDate);
        if (endDate) where.paymentDate.lte = new Date(endDate);
      }

      // Get payment statistics
      const [
        totalPayments,
        totalAmount,
        statusCounts,
        methodCounts,
        monthlyData,
        overduePayments,
        recentPayments
      ] = await Promise.all([
        prisma.payment.count({ where }),
        prisma.payment.aggregate({
          where: { ...where, status: 'PAID' },
          _sum: { total: true }
        }),
        prisma.payment.groupBy({
          by: ['status'],
          where,
          _count: { status: true },
          _sum: { total: true }
        }),
        prisma.payment.groupBy({
          by: ['method'],
          where,
          _count: { method: true },
          _sum: { total: true }
        }),
        prisma.payment.groupBy({
          by: ['paymentDate'],
          where,
          _count: { id: true },
          _sum: { total: true }
        }),
        prisma.payment.count({
          where: { ...where, status: 'OVERDUE' }
        }),
        prisma.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            student: { 
            select: { 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
            parent: { select: { firstName: true, lastName: true } }
          }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalPayments,
          totalAmount: totalAmount._sum.total || 0,
          statusCounts,
          methodCounts,
          monthlyData,
          overduePayments,
          recentPayments
        }
      });
    } catch (error) {
      console.error('Get payment analytics error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Generate payment report
  async generatePaymentReport(req, res) {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate, format = 'json' } = req.query;

      const where = { schoolId, deletedAt: null };
      if (startDate || endDate) {
        where.paymentDate = {};
        if (startDate) where.paymentDate.gte = new Date(startDate);
        if (endDate) where.paymentDate.lte = new Date(endDate);
      }

      const payments = await prisma.payment.findMany({
        where,
        include: {
          student: { 
            select: { 
              uuid: true,
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          parent: { select: { firstName: true, lastName: true, uuid: true } },
          feeStructure: { select: { name: true } },
          items: { include: { feeItem: true } },
          refunds: true,
          installments: true
        },
        orderBy: { paymentDate: 'desc' }
      });

      if (format === 'csv') {
        // Generate CSV report
        const csvData = payments.map(payment => ({
          'Receipt Number': payment.receiptNumber,
          'Student': payment.student ? `${payment.student.user.firstName} ${payment.student.user.lastName}` : 'N/A',
          'Parent': payment.parent ? `${payment.parent.firstName} ${payment.parent.lastName}` : 'N/A',
          'Amount': payment.amount,
          'Total': payment.total,
          'Status': payment.status,
          'Method': payment.method,
          'Payment Date': payment.paymentDate,
          'Due Date': payment.dueDate
        }));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=payment-report.csv');
        // Convert to CSV string and send
        res.send(csvData);
      } else {
        res.json({
          success: true,
          data: payments,
          summary: {
            totalPayments: payments.length,
            totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.total), 0),
            paidAmount: payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + parseFloat(p.total), 0),
            pendingAmount: payments.filter(p => p.status === 'PENDING').reduce((sum, p) => sum + parseFloat(p.total), 0)
          }
        });
      }
    } catch (error) {
      console.error('Generate payment report error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get payment refunds
  async getPaymentRefunds(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const refunds = await prisma.refund.findMany({
        where: { paymentId: BigInt(id), schoolId: BigInt(schoolId) },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: convertBigInts(refunds) });
    } catch (error) {
      console.error('Get payment refunds error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create installment
  async createInstallment(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = validateInstallmentData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId } = req.user;
      const installmentData = { ...value, paymentId: BigInt(id), schoolId: BigInt(schoolId) };

      const installment = await prisma.installment.create({
        data: installmentData,
        include: {
          payment: { select: { id: true, uuid: true, amount: true, total: true } }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Installment created successfully',
        data: installment
      });
    } catch (error) {
      console.error('Create installment error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get payment installments
  async getPaymentInstallments(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const installments = await prisma.installment.findMany({
        where: { paymentId: BigInt(id), schoolId: BigInt(schoolId) },
        orderBy: { installmentNumber: 'asc' }
      });

      res.json({ success: true, data: convertBigInts(installments) });
    } catch (error) {
      console.error('Get payment installments error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Update installment status
  async updateInstallmentStatus(req, res) {
    try {
      const { installmentId } = req.params;
      const { status } = req.body;
      const { schoolId, id: userId } = req.user;

      const installment = await prisma.installment.findFirst({
        where: { id: BigInt(installmentId), schoolId: BigInt(schoolId) }
      });

      if (!installment) {
        return res.status(404).json({ success: false, message: 'Installment not found' });
      }

      const updatedInstallment = await prisma.installment.update({
        where: { id: BigInt(installmentId) },
        data: { 
          status,
          paidDate: status === 'PAID' ? new Date() : null,
          updatedAt: new Date()
        }
      });

      res.json({
        success: true,
        message: 'Installment status updated successfully',
        data: updatedInstallment
      });
    } catch (error) {
      console.error('Update installment status error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create bulk payments
  async createBulkPayments(req, res) {
    try {
      const { payments } = req.body;
      const { schoolId, id: userId } = req.user;

      if (!Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ success: false, message: 'Payments array is required' });
      }

      const createdPayments = [];
      const errors = [];

      for (let i = 0; i < payments.length; i++) {
        try {
          const paymentData = payments[i];
          const { error, value } = validatePaymentData(paymentData);
          
          if (error) {
            errors.push({ index: i, error: error.details[0].message });
            continue;
          }

          const payment = { ...value, schoolId, createdBy: userId };
          payment.receiptNumber = await generateReceiptNumber(schoolId);

          const createdPayment = await prisma.payment.create({
            data: payment,
            include: {
              student: { 
                select: { 
                  id: true, 
                  uuid: true, 
                  user: { select: { firstName: true, lastName: true } }
                } 
              },
              parent: { 
                select: { 
                  id: true, 
                  uuid: true, 
                  user: { select: { firstName: true, lastName: true } }
                } 
              }
            }
          });

          createdPayments.push(createdPayment);
        } catch (error) {
          errors.push({ index: i, error: error.message });
        }
      }

      res.status(201).json({
        success: true,
        message: `Created ${createdPayments.length} payments successfully`,
        data: { createdPayments, errors }
      });
    } catch (error) {
      console.error('Create bulk payments error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Bulk update status
  async bulkUpdateStatus(req, res) {
    try {
      const { paymentIds, status } = req.body;
      const { schoolId, id: userId } = req.user;

      if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
        return res.status(400).json({ success: false, message: 'Payment IDs array is required' });
      }

      const updatedPayments = await prisma.payment.updateMany({
        where: {
          id: { in: paymentIds.map(id => BigInt(id)) },
          schoolId: BigInt(schoolId)
        },
        data: { status, updatedBy: userId }
      });

      res.json({
        success: true,
        message: `Updated ${updatedPayments.count} payments successfully`,
        data: { updatedCount: updatedPayments.count }
      });
    } catch (error) {
      console.error('Bulk update status error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Handle webhook
  async handleWebhook(req, res) {
    try {
      const { gateway } = req.params;
      const { processWebhook } = require('../services/paymentGatewayService');
      
      const result = await processWebhook(gateway, req.body, req.headers['stripe-signature']);
      
      if (result.success) {
        res.status(200).json({ success: true, message: 'Webhook processed successfully' });
      } else {
        res.status(400).json({ success: false, message: result.message });
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
  }

  // Get gateway status
  async getGatewayStatus(req, res) {
    try {
      const { transactionId } = req.params;
      const { gateway } = req.query;
      const { schoolId } = req.user;

      const { verifyPaymentStatus } = require('../services/paymentGatewayService');
      const result = await verifyPaymentStatus(transactionId, gateway, schoolId);

      res.json({ success: true, data: convertBigInts(result) });
    } catch (error) {
      console.error('Get gateway status error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get student payments
  async getStudentPayments(req, res) {
    try {
      const { studentId } = req.params;
      const { schoolId } = req.user;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: { studentId: BigInt(studentId), schoolId: BigInt(schoolId), deletedAt: null },
          include: {
            feeStructure: { select: { id: true, uuid: true, name: true } },
            items: { include: { feeItem: true } },
            refunds: true,
            installments: true
          },
          orderBy: { paymentDate: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.payment.count({
          where: { studentId: BigInt(studentId), schoolId: BigInt(schoolId), deletedAt: null }
        })
      ]);

      res.json({
        success: true,
        data: payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get student payments error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get parent payments
  async getParentPayments(req, res) {
    try {
      const { parentId } = req.params;
      const { schoolId } = req.user;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: { parentId: BigInt(parentId), schoolId: BigInt(schoolId), deletedAt: null },
          include: {
            student: { 
              select: { 
                id: true, 
                uuid: true, 
                user: { select: { firstName: true, lastName: true } }
              } 
            },
            feeStructure: { select: { id: true, uuid: true, name: true } },
            items: { include: { feeItem: true } },
            refunds: true,
            installments: true
          },
          orderBy: { paymentDate: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.payment.count({
          where: { parentId: BigInt(parentId), schoolId: BigInt(schoolId), deletedAt: null }
        })
      ]);

      res.json({
        success: true,
        data: payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get parent payments error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get overdue payments
  async getOverduePayments(req, res) {
    try {
      const { schoolId } = req.user;
      const { page = 1, limit = 10 } = req.query;

      const skip = (page - 1) * limit;
      const today = new Date();

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where: {
            schoolId: BigInt(schoolId),
            dueDate: { lt: today },
            status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
            deletedAt: null
          },
          include: {
            student: { 
              select: { 
                id: true, 
                uuid: true, 
                user: { select: { firstName: true, lastName: true } }
              } 
            },
            parent: { 
              select: { 
                id: true, 
                uuid: true, 
                user: { select: { firstName: true, lastName: true } }
              } 
            },
            feeStructure: { select: { id: true, uuid: true, name: true } }
          },
          orderBy: { dueDate: 'asc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.payment.count({
          where: {
            schoolId: BigInt(schoolId),
            dueDate: { lt: today },
            status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
            deletedAt: null
          }
        })
      ]);

      res.json({
        success: true,
        data: convertBigInts(payments),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get overdue payments error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get dashboard summary
  async getDashboardSummary(req, res) {
    try {
      const { schoolId } = req.user;
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const [
        totalPayments,
        monthlyPayments,
        overduePayments,
        pendingPayments,
        totalAmount,
        monthlyAmount,
        overdueAmount,
        pendingAmount
      ] = await Promise.all([
        prisma.payment.count({ where: { schoolId: BigInt(schoolId), deletedAt: null } }),
        prisma.payment.count({
          where: {
            schoolId: BigInt(schoolId),
            paymentDate: { gte: startOfMonth, lte: endOfMonth },
            deletedAt: null
          }
        }),
        prisma.payment.count({
          where: {
            schoolId: BigInt(schoolId),
            dueDate: { lt: today },
            status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
            deletedAt: null
          }
        }),
        prisma.payment.count({
          where: {
            schoolId: BigInt(schoolId),
            status: 'PENDING',
            deletedAt: null
          }
        }),
        prisma.payment.aggregate({
          where: { schoolId: BigInt(schoolId), status: 'PAID', deletedAt: null },
          _sum: { total: true }
        }),
        prisma.payment.aggregate({
          where: {
            schoolId: BigInt(schoolId),
            paymentDate: { gte: startOfMonth, lte: endOfMonth },
            status: 'PAID',
            deletedAt: null
          },
          _sum: { total: true }
        }),
        prisma.payment.aggregate({
          where: {
            schoolId: BigInt(schoolId),
            dueDate: { lt: today },
            status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
            deletedAt: null
          },
          _sum: { total: true }
        }),
        prisma.payment.aggregate({
          where: {
            schoolId: BigInt(schoolId),
            status: 'PENDING',
            deletedAt: null
          },
          _sum: { total: true }
        })
      ]);

      res.json({
        success: true,
        data: {
          totalPayments,
          monthlyPayments,
          overduePayments,
          pendingPayments,
          totalAmount: totalAmount._sum.total || 0,
          monthlyAmount: monthlyAmount._sum.total || 0,
          overdueAmount: overdueAmount._sum.total || 0,
          pendingAmount: pendingAmount._sum.total || 0
        }
      });
    } catch (error) {
      console.error('Get dashboard summary error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get recent payments
  async getRecentPayments(req, res) {
    try {
      const { schoolId } = req.user;
      const { limit = 10 } = req.query;

      const payments = await prisma.payment.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        include: {
          student: { 
            select: { 
              id: true, 
              uuid: true, 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          parent: { 
            select: { 
              id: true, 
              uuid: true, 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          feeStructure: { select: { id: true, uuid: true, name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      });

      res.json({ success: true, data: convertBigInts(payments) });
    } catch (error) {
      console.error('Get recent payments error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get upcoming payments
  async getUpcomingPayments(req, res) {
    try {
      const { schoolId } = req.user;
      const { limit = 10 } = req.query;
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const payments = await prisma.payment.findMany({
        where: {
          schoolId: BigInt(schoolId),
          dueDate: { gte: today, lte: nextWeek },
          status: { in: ['UNPAID', 'PARTIALLY_PAID'] },
          deletedAt: null
        },
        include: {
          student: { 
            select: { 
              id: true, 
              uuid: true, 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          parent: { 
            select: { 
              id: true, 
              uuid: true, 
              user: { select: { firstName: true, lastName: true } }
            } 
          },
          feeStructure: { select: { id: true, uuid: true, name: true } }
        },
        orderBy: { dueDate: 'asc' },
        take: parseInt(limit)
      });

      res.json({ success: true, data: convertBigInts(payments) });
    } catch (error) {
      console.error('Get upcoming payments error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export default new PaymentController(); 
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { formatResponse, handleError } from '../utils/responseUtils.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ======================
// DOCUMENT TYPES FOR SCHOOLS
// ======================
const DOCUMENT_TYPES = {
  // Academic Documents
  ENROLLMENT_FORM: 'enrollment_form',
  ACADEMIC_RECORD: 'academic_record',
  TRANSCRIPT: 'transcript',
  CERTIFICATE: 'certificate',
  REPORT_CARD: 'report_card',
  ASSIGNMENT: 'assignment',
  PROJECT: 'project',
  
  // Administrative Documents
  ID_PROOF: 'id_proof',
  BIRTH_CERTIFICATE: 'birth_certificate',
  MEDICAL_RECORD: 'medical_record',
  IMMUNIZATION_RECORD: 'immunization_record',
  EMERGENCY_CONTACT: 'emergency_contact',
  CONSENT_FORM: 'consent_form',
  POLICY_DOCUMENT: 'policy_document',
  
  // Financial Documents
  FEE_STRUCTURE: 'fee_structure',
  PAYMENT_RECEIPT: 'payment_receipt',
  INVOICE: 'invoice',
  SCHOLARSHIP_DOCUMENT: 'scholarship_document',
  FINANCIAL_AID: 'financial_aid',
  
  // Communication Documents
  LETTER: 'letter',
  NOTICE: 'notice',
  ANNOUNCEMENT: 'announcement',
  NEWSLETTER: 'newsletter',
  SURVEY: 'survey',
  
  // Legal Documents
  CONTRACT: 'contract',
  AGREEMENT: 'agreement',
  WAIVER: 'waiver',
  COMPLAINT: 'complaint',
  
  // Other Documents
  PHOTO: 'photo',
  VIDEO: 'video',
  AUDIO: 'audio',
  PRESENTATION: 'presentation',
  SPREADSHEET: 'spreadsheet',
  OTHER: 'other'
};

// ======================
// DOCUMENT STATUS
// ======================
const DOCUMENT_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  ARCHIVED: 'archived'
};

// ======================
// DOCUMENT CATEGORIES
// ======================
const DOCUMENT_CATEGORIES = {
  ACADEMIC: 'academic',
  ADMINISTRATIVE: 'administrative',
  FINANCIAL: 'financial',
  COMMUNICATION: 'communication',
  LEGAL: 'legal',
  MEDICAL: 'medical',
  PERSONAL: 'personal',
  OTHER: 'other'
};

class CustomerDocumentController {
  // ======================
  // GET CUSTOMER DOCUMENTS
  // ======================
  async getCustomerDocuments(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const { 
        type, 
        category, 
        status, 
        search, 
        sortBy = 'createdAt', 
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = req.query;

      const whereClause = {
        customerId: BigInt(id),
        schoolId: BigInt(schoolId)
      };

      if (type) whereClause.type = type;
      if (category) whereClause.category = category;
      if (status) whereClause.status = status;
      if (search) {
        whereClause.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } }
        ];
      }

      const documents = await prisma.customerDocument.findMany({
        where: whereClause,
        include: {
          customer: {
            include: {
              user: true
            }
          },
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1
          },
          _count: {
            select: {
              versions: true,
              shares: true,
              comments: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      });

      const total = await prisma.customerDocument.count({
        where: whereClause
      });

      return formatResponse(res, {
        success: true,
        message: 'Customer documents retrieved successfully',
        data: documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        },
        meta: {
          customerId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get customer documents error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // UPLOAD DOCUMENT
  // ======================
  async uploadDocument(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const documentData = req.body;
      const file = req.file;

      if (!file) {
        return formatResponse(res, {
          success: false,
          message: 'No file uploaded',
          data: null
        }, 400);
      }

      // Validate required fields
      if (!documentData.title || !documentData.type) {
        return formatResponse(res, {
          success: false,
          message: 'Title and type are required',
          data: null
        }, 400);
      }

      // Generate unique filename
      const fileExtension = path.extname(file.originalname);
      const fileName = `${uuidv4()}${fileExtension}`;
      const filePath = path.join('uploads', 'documents', fileName);

      // Ensure upload directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Move file to destination
      await fs.rename(file.path, filePath);

      // Create document record
      const document = await prisma.$transaction(async (tx) => {
        // Create main document
        const document = await tx.customerDocument.create({
          data: {
            customerId: BigInt(id),
            schoolId: BigInt(schoolId),
            title: documentData.title,
            description: documentData.description,
            type: documentData.type,
            category: documentData.category || this.getCategoryFromType(documentData.type),
            status: documentData.status || DOCUMENT_STATUS.DRAFT,
            tags: documentData.tags || [],
            metadata: documentData.metadata || {},
            expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate) : null,
            isPublic: documentData.isPublic || false,
            isConfidential: documentData.isConfidential || false,
            uploadedBy: BigInt(userId)
          }
        });

        // Create initial version
        await tx.documentVersion.create({
          data: {
            documentId: document.id,
            versionNumber: 1,
            fileName: fileName,
            originalName: file.originalname,
            filePath: filePath,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedBy: BigInt(userId),
            changeLog: 'Initial version'
          }
        });

        return document;
      });

      // Get complete document data
      const completeDocument = await prisma.customerDocument.findUnique({
        where: { id: document.id },
        include: {
          customer: {
            include: {
              user: true
            }
          },
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1
          }
        }
      });

      return formatResponse(res, {
        success: true,
        message: 'Document uploaded successfully',
        data: completeDocument,
        meta: {
          documentId: document.id,
          customerId: parseInt(id)
        }
      }, 201);

    } catch (error) {
      logger.error('Upload document error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET DOCUMENT BY ID
  // ======================
  async getDocumentById(req, res) {
    try {
      const { id, documentId } = req.params;
      const { schoolId } = req.user;

      const document = await prisma.customerDocument.findFirst({
        where: {
          id: BigInt(documentId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        },
        include: {
          customer: {
            include: {
              user: true
            }
          },
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          shares: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          comments: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          }
        }
      });

      if (!document) {
        return formatResponse(res, {
          success: false,
          message: 'Document not found',
          data: null
        }, 404);
      }

      return formatResponse(res, {
        success: true,
        message: 'Document retrieved successfully',
        data: document
      });

    } catch (error) {
      logger.error('Get document by ID error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // UPDATE DOCUMENT
  // ======================
  async updateDocument(req, res) {
    try {
      const { id, documentId } = req.params;
      const { schoolId, id: userId } = req.user;
      const updateData = req.body;
      const file = req.file;

      // Check if document exists
      const existingDocument = await prisma.customerDocument.findFirst({
        where: {
          id: BigInt(documentId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        }
      });

      if (!existingDocument) {
        return formatResponse(res, {
          success: false,
          message: 'Document not found',
          data: null
        }, 404);
      }

      // Update document
      const document = await prisma.$transaction(async (tx) => {
        // Update main document
        const updatedDocument = await tx.customerDocument.update({
          where: { id: BigInt(documentId) },
          data: {
            title: updateData.title,
            description: updateData.description,
            type: updateData.type,
            category: updateData.category,
            status: updateData.status,
            tags: updateData.tags,
            metadata: updateData.metadata,
            expiryDate: updateData.expiryDate ? new Date(updateData.expiryDate) : null,
            isPublic: updateData.isPublic,
            isConfidential: updateData.isConfidential,
            updatedBy: BigInt(userId)
          }
        });

        // If new file is uploaded, create new version
        if (file) {
          // Get current version number
          const currentVersion = await tx.documentVersion.findFirst({
            where: { documentId: BigInt(documentId) },
            orderBy: { versionNumber: 'desc' }
          });

          const newVersionNumber = (currentVersion?.versionNumber || 0) + 1;

          // Generate unique filename
          const fileExtension = path.extname(file.originalname);
          const fileName = `${uuidv4()}${fileExtension}`;
          const filePath = path.join('uploads', 'documents', fileName);

          // Ensure upload directory exists
          await fs.mkdir(path.dirname(filePath), { recursive: true });

          // Move file to destination
          await fs.rename(file.path, filePath);

          // Create new version
          await tx.documentVersion.create({
            data: {
              documentId: BigInt(documentId),
              versionNumber: newVersionNumber,
              fileName: fileName,
              originalName: file.originalname,
              filePath: filePath,
              fileSize: file.size,
              mimeType: file.mimetype,
              uploadedBy: BigInt(userId),
              changeLog: updateData.changeLog || `Version ${newVersionNumber} uploaded`
            }
          });
        }

        return updatedDocument;
      });

      return formatResponse(res, {
        success: true,
        message: 'Document updated successfully',
        data: document
      });

    } catch (error) {
      logger.error('Update document error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // DELETE DOCUMENT
  // ======================
  async deleteDocument(req, res) {
    try {
      const { id, documentId } = req.params;
      const { schoolId } = req.user;

      const document = await prisma.customerDocument.findFirst({
        where: {
          id: BigInt(documentId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        },
        include: {
          versions: true
        }
      });

      if (!document) {
        return formatResponse(res, {
          success: false,
          message: 'Document not found',
          data: null
        }, 404);
      }

      // Delete document and related data
      await prisma.$transaction(async (tx) => {
        // Delete file versions
        for (const version of document.versions) {
          try {
            await fs.unlink(version.filePath);
          } catch (error) {
            logger.warn(`Failed to delete file: ${version.filePath}`, error);
          }
        }

        await tx.documentActivity.deleteMany({
          where: { documentId: BigInt(documentId) }
        });
        await tx.documentComment.deleteMany({
          where: { documentId: BigInt(documentId) }
        });
        await tx.documentShare.deleteMany({
          where: { documentId: BigInt(documentId) }
        });
        await tx.documentVersion.deleteMany({
          where: { documentId: BigInt(documentId) }
        });
        await tx.customerDocument.delete({
          where: { id: BigInt(documentId) }
        });
      });

      return formatResponse(res, {
        success: true,
        message: 'Document deleted successfully',
        data: null
      });

    } catch (error) {
      logger.error('Delete document error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // DOWNLOAD DOCUMENT
  // ======================
  async downloadDocument(req, res) {
    try {
      const { id, documentId } = req.params;
      const { schoolId } = req.user;
      const { version } = req.query;

      // Get document with latest version
      const document = await prisma.customerDocument.findFirst({
        where: {
          id: BigInt(documentId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' }
          }
        }
      });

      if (!document) {
        return formatResponse(res, {
          success: false,
          message: 'Document not found',
          data: null
        }, 404);
      }

      // Get specific version or latest
      const documentVersion = version 
        ? document.versions.find(v => v.versionNumber === parseInt(version))
        : document.versions[0];

      if (!documentVersion) {
        return formatResponse(res, {
          success: false,
          message: 'Document version not found',
          data: null
        }, 404);
      }

      // Check if file exists
      try {
        await fs.access(documentVersion.filePath);
      } catch (error) {
        return formatResponse(res, {
          success: false,
          message: 'Document file not found',
          data: null
        }, 404);
      }

      // Log download activity
      await prisma.documentActivity.create({
        data: {
          documentId: BigInt(documentId),
          userId: BigInt(req.user.id),
          type: 'download',
          description: `Downloaded version ${documentVersion.versionNumber}`,
          metadata: {
            versionNumber: documentVersion.versionNumber,
            fileName: documentVersion.fileName
          }
        }
      });

      // Set response headers
      res.setHeader('Content-Type', documentVersion.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${documentVersion.originalName}"`);
      res.setHeader('Content-Length', documentVersion.fileSize);

      // Send file
      const fileStream = fs.createReadStream(documentVersion.filePath);
      fileStream.pipe(res);

    } catch (error) {
      logger.error('Download document error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // SHARE DOCUMENT
  // ======================
  async shareDocument(req, res) {
    try {
      const { id, documentId } = req.params;
      const { schoolId, id: userId } = req.user;
      const { userIds, permissions, message } = req.body;

      // Check if document exists
      const document = await prisma.customerDocument.findFirst({
        where: {
          id: BigInt(documentId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        }
      });

      if (!document) {
        return formatResponse(res, {
          success: false,
          message: 'Document not found',
          data: null
        }, 404);
      }

      // Create shares
      const shares = await prisma.$transaction(async (tx) => {
        const sharePromises = userIds.map(shareUserId => 
          tx.documentShare.create({
            data: {
              documentId: BigInt(documentId),
              userId: BigInt(shareUserId),
              sharedBy: BigInt(userId),
              permissions: permissions || ['view'],
              message: message,
              expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null
            }
          })
        );

        return Promise.all(sharePromises);
      });

      // Log share activity
      await prisma.documentActivity.create({
        data: {
          documentId: BigInt(documentId),
          userId: BigInt(userId),
          type: 'share',
          description: `Shared document with ${userIds.length} user(s)`,
          metadata: {
            sharedWith: userIds,
            permissions
          }
        }
      });

      return formatResponse(res, {
        success: true,
        message: 'Document shared successfully',
        data: shares
      });

    } catch (error) {
      logger.error('Share document error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET DOCUMENT ANALYTICS
  // ======================
  async getDocumentAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { period = '30d', customerId } = req.query;

      const whereClause = {
        schoolId: BigInt(schoolId)
      };

      if (customerId) {
        whereClause.customerId = BigInt(customerId);
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      whereClause.createdAt = {
        gte: startDate,
        lte: endDate
      };

      // Get document statistics
      const [
        totalDocuments,
        documentsByType,
        documentsByStatus,
        documentsByCategory,
        topUploaders,
        recentUploads,
        storageUsage
      ] = await Promise.all([
        // Total documents
        prisma.customerDocument.count({ where: whereClause }),
        
        // Documents by type
        prisma.customerDocument.groupBy({
          by: ['type'],
          where: whereClause,
          _count: { type: true }
        }),
        
        // Documents by status
        prisma.customerDocument.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { status: true }
        }),
        
        // Documents by category
        prisma.customerDocument.groupBy({
          by: ['category'],
          where: whereClause,
          _count: { category: true }
        }),
        
        // Top uploaders
        prisma.customerDocument.groupBy({
          by: ['uploadedBy'],
          where: whereClause,
          _count: { uploadedBy: true }
        }),
        
        // Recent uploads
        prisma.customerDocument.findMany({
          where: whereClause,
          include: {
            customer: {
              select: {
                id: true,
                name: true
              }
            },
            uploadedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }),
        
        // Storage usage
        prisma.documentVersion.aggregate({
          where: {
            document: whereClause
          },
          _sum: {
            fileSize: true
          }
        })
      ]);

      const analytics = {
        total: totalDocuments,
        byType: documentsByType.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {}),
        byStatus: documentsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {}),
        byCategory: documentsByCategory.reduce((acc, item) => {
          acc[item.category] = item._count.category;
          return acc;
        }, {}),
        topUploaders: topUploaders
          .sort((a, b) => b._count.uploadedBy - a._count.uploadedBy)
          .slice(0, 10),
        recentUploads,
        storageUsage: storageUsage._sum.fileSize || 0
      };

      return formatResponse(res, {
        success: true,
        message: 'Document analytics retrieved successfully',
        data: analytics,
        meta: {
          period,
          customerId: customerId ? parseInt(customerId) : null
        }
      });

    } catch (error) {
      logger.error('Get document analytics error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // BULK UPLOAD DOCUMENTS
  // ======================
  async bulkUploadDocuments(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const { documents } = req.body;
      const files = req.files;

      if (!documents || !Array.isArray(documents) || documents.length === 0) {
        return formatResponse(res, {
          success: false,
          message: 'No documents provided',
          data: null
        }, 400);
      }

      const uploadedDocuments = [];
      const errors = [];

      // Process each document
      for (let i = 0; i < documents.length; i++) {
        try {
          const documentData = documents[i];
          const file = files ? files[i] : null;

          if (!file) {
            errors.push({
              index: i,
              error: 'No file provided'
            });
            continue;
          }

          // Generate unique filename
          const fileExtension = path.extname(file.originalname);
          const fileName = `${uuidv4()}${fileExtension}`;
          const filePath = path.join('uploads', 'documents', fileName);

          // Ensure upload directory exists
          await fs.mkdir(path.dirname(filePath), { recursive: true });

          // Move file to destination
          await fs.rename(file.path, filePath);

          // Create document record
          const document = await prisma.$transaction(async (tx) => {
            // Create main document
            const document = await tx.customerDocument.create({
              data: {
                customerId: BigInt(id),
                schoolId: BigInt(schoolId),
                title: documentData.title,
                description: documentData.description,
                type: documentData.type,
                category: documentData.category || this.getCategoryFromType(documentData.type),
                status: documentData.status || DOCUMENT_STATUS.DRAFT,
                tags: documentData.tags || [],
                metadata: documentData.metadata || {},
                expiryDate: documentData.expiryDate ? new Date(documentData.expiryDate) : null,
                isPublic: documentData.isPublic || false,
                isConfidential: documentData.isConfidential || false,
                uploadedBy: BigInt(userId)
              }
            });

            // Create initial version
            await tx.documentVersion.create({
              data: {
                documentId: document.id,
                versionNumber: 1,
                fileName: fileName,
                originalName: file.originalname,
                filePath: filePath,
                fileSize: file.size,
                mimeType: file.mimetype,
                uploadedBy: BigInt(userId),
                changeLog: 'Initial version'
              }
            });

            return document;
          });

          uploadedDocuments.push(document);

        } catch (error) {
          errors.push({
            index: i,
            error: error.message
          });
        }
      }

      return formatResponse(res, {
        success: true,
        message: 'Bulk upload completed',
        data: {
          uploaded: uploadedDocuments,
          errors
        },
        meta: {
          total: documents.length,
          successful: uploadedDocuments.length,
          failed: errors.length,
          customerId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Bulk upload documents error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // HELPER METHODS
  // ======================
  getCategoryFromType(type) {
    const categoryMap = {
      // Academic
      [DOCUMENT_TYPES.ENROLLMENT_FORM]: DOCUMENT_CATEGORIES.ACADEMIC,
      [DOCUMENT_TYPES.ACADEMIC_RECORD]: DOCUMENT_CATEGORIES.ACADEMIC,
      [DOCUMENT_TYPES.TRANSCRIPT]: DOCUMENT_CATEGORIES.ACADEMIC,
      [DOCUMENT_TYPES.CERTIFICATE]: DOCUMENT_CATEGORIES.ACADEMIC,
      [DOCUMENT_TYPES.REPORT_CARD]: DOCUMENT_CATEGORIES.ACADEMIC,
      [DOCUMENT_TYPES.ASSIGNMENT]: DOCUMENT_CATEGORIES.ACADEMIC,
      [DOCUMENT_TYPES.PROJECT]: DOCUMENT_CATEGORIES.ACADEMIC,
      
      // Administrative
      [DOCUMENT_TYPES.ID_PROOF]: DOCUMENT_CATEGORIES.ADMINISTRATIVE,
      [DOCUMENT_TYPES.BIRTH_CERTIFICATE]: DOCUMENT_CATEGORIES.ADMINISTRATIVE,
      [DOCUMENT_TYPES.CONSENT_FORM]: DOCUMENT_CATEGORIES.ADMINISTRATIVE,
      [DOCUMENT_TYPES.POLICY_DOCUMENT]: DOCUMENT_CATEGORIES.ADMINISTRATIVE,
      
      // Financial
      [DOCUMENT_TYPES.FEE_STRUCTURE]: DOCUMENT_CATEGORIES.FINANCIAL,
      [DOCUMENT_TYPES.PAYMENT_RECEIPT]: DOCUMENT_CATEGORIES.FINANCIAL,
      [DOCUMENT_TYPES.INVOICE]: DOCUMENT_CATEGORIES.FINANCIAL,
      [DOCUMENT_TYPES.SCHOLARSHIP_DOCUMENT]: DOCUMENT_CATEGORIES.FINANCIAL,
      [DOCUMENT_TYPES.FINANCIAL_AID]: DOCUMENT_CATEGORIES.FINANCIAL,
      
      // Communication
      [DOCUMENT_TYPES.LETTER]: DOCUMENT_CATEGORIES.COMMUNICATION,
      [DOCUMENT_TYPES.NOTICE]: DOCUMENT_CATEGORIES.COMMUNICATION,
      [DOCUMENT_TYPES.ANNOUNCEMENT]: DOCUMENT_CATEGORIES.COMMUNICATION,
      [DOCUMENT_TYPES.NEWSLETTER]: DOCUMENT_CATEGORIES.COMMUNICATION,
      [DOCUMENT_TYPES.SURVEY]: DOCUMENT_CATEGORIES.COMMUNICATION,
      
      // Legal
      [DOCUMENT_TYPES.CONTRACT]: DOCUMENT_CATEGORIES.LEGAL,
      [DOCUMENT_TYPES.AGREEMENT]: DOCUMENT_CATEGORIES.LEGAL,
      [DOCUMENT_TYPES.WAIVER]: DOCUMENT_CATEGORIES.LEGAL,
      [DOCUMENT_TYPES.COMPLAINT]: DOCUMENT_CATEGORIES.LEGAL,
      
      // Medical
      [DOCUMENT_TYPES.MEDICAL_RECORD]: DOCUMENT_CATEGORIES.MEDICAL,
      [DOCUMENT_TYPES.IMMUNIZATION_RECORD]: DOCUMENT_CATEGORIES.MEDICAL,
      [DOCUMENT_TYPES.EMERGENCY_CONTACT]: DOCUMENT_CATEGORIES.MEDICAL,
      
      // Personal
      [DOCUMENT_TYPES.PHOTO]: DOCUMENT_CATEGORIES.PERSONAL,
      [DOCUMENT_TYPES.VIDEO]: DOCUMENT_CATEGORIES.PERSONAL,
      [DOCUMENT_TYPES.AUDIO]: DOCUMENT_CATEGORIES.PERSONAL
    };

    return categoryMap[type] || DOCUMENT_CATEGORIES.OTHER;
  }
}

export default new CustomerDocumentController(); 
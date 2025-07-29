import express from 'express';
import AssignmentAttachmentController from '../controllers/assignmentAttachmentController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Initialize controller
const assignmentAttachmentController = new AssignmentAttachmentController();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/assignments/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    // Allow specific file types
    const allowedTypes = [
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv',
        // Images
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        // Audio
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        // Video
        'video/mp4',
        'video/webm',
        'video/ogg',
        // Archives
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

// Apply rate limiting to all routes
router.use(rateLimiter);

// Apply authentication to all routes
router.use(authenticateToken);

// ========================================
// CRUD Operations
// ========================================

/**
 * @route   POST /api/assignments/attachments
 * @desc    Create new assignment attachment
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/', 
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentAttachmentController.create(req, res);
    }
);

/**
 * @route   POST /api/assignments/attachments/upload
 * @desc    Upload file and create attachment
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/upload',
    authorizeRoles(['ADMIN', 'TEACHER']),
    upload.single('file'),
    async (req, res) => {
        await assignmentAttachmentController.uploadFile(req, res);
    }
);

/**
 * @route   GET /api/assignments/attachments
 * @desc    Get all attachments with filtering
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentAttachmentController.getAll(req, res);
    }
);

/**
 * @route   GET /api/assignments/attachments/:id
 * @desc    Get attachment by ID
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/:id',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentAttachmentController.getById(req, res);
    }
);

/**
 * @route   PUT /api/assignments/attachments/:id
 * @desc    Update attachment
 * @access  Private (ADMIN, TEACHER)
 */
router.put('/:id',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentAttachmentController.update(req, res);
    }
);

/**
 * @route   DELETE /api/assignments/attachments/:id
 * @desc    Delete attachment
 * @access  Private (ADMIN, TEACHER)
 */
router.delete('/:id',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentAttachmentController.delete(req, res);
    }
);

// ========================================
// Assignment-specific Operations
// ========================================

/**
 * @route   GET /api/assignments/:assignmentId/attachments
 * @desc    Get all attachments for a specific assignment
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/assignment/:assignmentId',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentAttachmentController.getByAssignment(req, res);
    }
);

// ========================================
// Bulk Operations
// ========================================

/**
 * @route   POST /api/assignments/attachments/bulk/delete
 * @desc    Bulk delete attachments
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/bulk/delete',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentAttachmentController.bulkDelete(req, res);
    }
);

// ========================================
// Search and Filtering
// ========================================

/**
 * @route   GET /api/assignments/attachments/search
 * @desc    Search attachments
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/search',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentAttachmentController.search(req, res);
    }
);

/**
 * @route   GET /api/assignments/attachments/type
 * @desc    Get attachments by file type
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/type',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentAttachmentController.getByFileType(req, res);
    }
);

// ========================================
// Analytics and Statistics
// ========================================

/**
 * @route   GET /api/assignments/attachments/statistics
 * @desc    Get attachment statistics
 * @access  Private (ADMIN, TEACHER)
 */
router.get('/statistics',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentAttachmentController.getStatistics(req, res);
    }
);

// ========================================
// File Operations
// ========================================

/**
 * @route   GET /api/assignments/attachments/:id/download
 * @desc    Download attachment
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/:id/download',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentAttachmentController.download(req, res);
    }
);

/**
 * @route   GET /api/assignments/attachments/:id/file
 * @desc    Stream file content
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/:id/file',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentAttachmentController.streamFile(req, res);
    }
);

// ========================================
// Error Handling Middleware
// ========================================

// Handle multer errors
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 100MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files uploaded.'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Unexpected file field.'
            });
        }
    }

    if (error.message === 'File type not allowed') {
        return res.status(400).json({
            success: false,
            message: 'File type not allowed. Please upload a valid file type.'
        });
    }

    next(error);
});

export default router; 
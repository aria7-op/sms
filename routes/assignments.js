import express from 'express';
import AssignmentController from '../controllers/assignmentController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/rateLimit.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Initialize controller
const assignmentController = new AssignmentController();

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
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 10 // Max 10 files
    }
});

// Apply rate limiting to all routes
router.use(rateLimiter);

// Apply authentication to all routes
router.use(authenticateToken);

// ========================================
// Integrated Assignment Operations
// ========================================

/**
 * @route   POST /api/assignments/with-attachments
 * @desc    Create assignment with attachments in one API call
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/with-attachments',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.createAssignmentWithAttachments(req, res);
    }
);

/**
 * @route   POST /api/assignments/upload-with-files
 * @desc    Upload assignment with file attachments
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/upload-with-files',
    authorizeRoles(['ADMIN', 'TEACHER']),
    upload.array('files', 10),
    async (req, res) => {
        await assignmentController.uploadAssignmentWithFiles(req, res);
    }
);

/**
 * @route   POST /api/assignments/:id/submit-with-attachments
 * @desc    Submit assignment with attachments
 * @access  Private (STUDENT)
 */
router.post('/:id/submit-with-attachments',
    authorizeRoles(['STUDENT']),
    async (req, res) => {
        await assignmentController.submitAssignmentWithAttachments(req, res);
    }
);

/**
 * @route   POST /api/assignments/:id/upload-submission-with-files
 * @desc    Upload assignment submission with files
 * @access  Private (STUDENT)
 */
router.post('/:id/upload-submission-with-files',
    authorizeRoles(['STUDENT']),
    upload.array('files', 10),
    async (req, res) => {
        await assignmentController.uploadAssignmentSubmissionWithFiles(req, res);
    }
);

/**
 * @route   GET /api/assignments/:id/details
 * @desc    Get comprehensive assignment details with attachments and submissions
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/:id/details',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.getAssignmentDetails(req, res);
    }
);

/**
 * @route   GET /api/assignments/dashboard
 * @desc    Get assignment dashboard with integrated data
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/dashboard',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.getAssignmentDashboard(req, res);
    }
);

/**
 * @route   GET /api/assignments/analytics/integrated
 * @desc    Get integrated assignment analytics
 * @access  Private (ADMIN, TEACHER)
 */
router.get('/analytics/integrated',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.getIntegratedAssignmentAnalytics(req, res);
    }
);

/**
 * @route   POST /api/assignments/bulk/with-attachments
 * @desc    Bulk create assignments with attachments
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/bulk/with-attachments',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.createBulkAssignmentsWithAttachments(req, res);
    }
);

// ========================================
// Standard Assignment CRUD Operations
// ========================================

/**
 * @route   POST /api/assignments
 * @desc    Create new assignment
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.createAssignment(req, res);
    }
);

/**
 * @route   GET /api/assignments
 * @desc    Get all assignments with filtering
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.getAllAssignments(req, res);
    }
);

/**
 * @route   GET /api/assignments/:id
 * @desc    Get assignment by ID
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/:id',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.getAssignmentById(req, res);
    }
);

/**
 * @route   PUT /api/assignments/:id
 * @desc    Update assignment
 * @access  Private (ADMIN, TEACHER)
 */
router.put('/:id',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.updateAssignment(req, res);
    }
);

/**
 * @route   DELETE /api/assignments/:id
 * @desc    Delete assignment
 * @access  Private (ADMIN, TEACHER)
 */
router.delete('/:id',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.deleteAssignment(req, res);
    }
);

// ========================================
// Bulk Operations
// ========================================

/**
 * @route   POST /api/assignments/bulk/create
 * @desc    Bulk create assignments
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/bulk/create',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.createBulkAssignments(req, res);
    }
);

/**
 * @route   POST /api/assignments/bulk/update
 * @desc    Bulk update assignments
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/bulk/update',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.bulkUpdateAssignments(req, res);
    }
);

/**
 * @route   POST /api/assignments/bulk/delete
 * @desc    Bulk delete assignments
 * @access  Private (ADMIN, TEACHER)
 */
router.post('/bulk/delete',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.bulkDeleteAssignments(req, res);
    }
);

// ========================================
// Role-specific Operations
// ========================================

/**
 * @route   GET /api/assignments/teacher/:teacherId
 * @desc    Get assignments by teacher
 * @access  Private (ADMIN, TEACHER)
 */
router.get('/teacher/:teacherId',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.getAssignmentsByTeacher(req, res);
    }
);

/**
 * @route   GET /api/assignments/class/:classId
 * @desc    Get assignments by class
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/class/:classId',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.getAssignmentsByClass(req, res);
    }
);

/**
 * @route   GET /api/assignments/subject/:subjectId
 * @desc    Get assignments by subject
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/subject/:subjectId',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.getAssignmentsBySubject(req, res);
    }
);

/**
 * @route   GET /api/assignments/student/:studentId
 * @desc    Get assignments for a specific student
 * @access  Private (ADMIN, TEACHER, PARENT)
 */
router.get('/student/:studentId',
    authorizeRoles(['ADMIN', 'TEACHER', 'PARENT']),
    async (req, res) => {
        await assignmentController.getStudentAssignments(req, res);
    }
);

/**
 * @route   GET /api/assignments/my-assignments
 * @desc    Get current user's assignments (teacher)
 * @access  Private (TEACHER)
 */
router.get('/my-assignments',
    authorizeRoles(['TEACHER']),
    async (req, res) => {
        await assignmentController.getMyAssignments(req, res);
    }
);

/**
 * @route   GET /api/assignments/my-class-assignments
 * @desc    Get assignments for current user's class (student)
 * @access  Private (STUDENT)
 */
router.get('/my-class-assignments',
    authorizeRoles(['STUDENT']),
    async (req, res) => {
        await assignmentController.getMyClassAssignments(req, res);
    }
);

// ========================================
// Analytics and Reporting
// ========================================

/**
 * @route   GET /api/assignments/analytics
 * @desc    Get assignment analytics
 * @access  Private (ADMIN, TEACHER)
 */
router.get('/analytics',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.getAssignmentAnalytics(req, res);
    }
);

/**
 * @route   GET /api/assignments/statistics
 * @desc    Get assignment statistics
 * @access  Private (ADMIN, TEACHER)
 */
router.get('/statistics',
    authorizeRoles(['ADMIN', 'TEACHER']),
    async (req, res) => {
        await assignmentController.getAssignmentStatistics(req, res);
    }
);

// ========================================
// Search and Filtering
// ========================================

/**
 * @route   GET /api/assignments/search
 * @desc    Search assignments
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/search',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.searchAssignments(req, res);
    }
);

/**
 * @route   GET /api/assignments/overdue
 * @desc    Get overdue assignments
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/overdue',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.getOverdueAssignments(req, res);
    }
);

/**
 * @route   GET /api/assignments/upcoming
 * @desc    Get upcoming assignments
 * @access  Private (ADMIN, TEACHER, STUDENT, PARENT)
 */
router.get('/upcoming',
    authorizeRoles(['ADMIN', 'TEACHER', 'STUDENT', 'PARENT']),
    async (req, res) => {
        await assignmentController.getUpcomingAssignments(req, res);
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
                message: 'File size too large. Maximum size is 100MB per file.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files uploaded. Maximum is 10 files.'
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
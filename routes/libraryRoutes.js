import express from 'express';
import { Router } from 'express';
import LibraryController from '../controllers/libraryController.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { upload } from '../middleware/upload.js';
import { createAuditLog } from '../middleware/audit.js';

const router = Router();
// const libraryController = new LibraryController();



// Rate limiting
const libraryRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many library requests from this IP, please try again later.'
});

// Apply rate limiting to all library routes
router.use(libraryRateLimit);

// Book Management Routes
/**
 * @route   POST /api/library/books
 * @desc    Create new book
 * @access  Private (Admin, Librarian)
 */
router.post('/books',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    upload.single('coverImage'),
    async (req, res) => {
        try {
            const result = await libraryController.createBook(req, res);
            return result;
        } catch (error) {
            console.error('Error in book creation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/books
 * @desc    Get all books with filtering
 * @access  Private (All authenticated users)
 */
router.get('/books',
    authenticate,
    async (req, res) => {
        try {
            const result = await libraryController.getAllBooks(req, res);
            return result;
        } catch (error) {
            console.error('Error in get all books route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/books/:id
 * @desc    Get book by ID
 * @access  Private (All authenticated users)
 */
router.get('/books/:id',
    authenticate,
    async (req, res) => {
        try {
            const result = await libraryController.getBookById(req, res);
            return result;
        } catch (error) {
            console.error('Error in get book by ID route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   PUT /api/library/books/:id
 * @desc    Update book
 * @access  Private (Admin, Librarian)
 */
router.put('/books/:id',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    upload.single('coverImage'),
    async (req, res) => {
        try {
            const result = await libraryController.updateBook(req, res);
            return result;
        } catch (error) {
            console.error('Error in update book route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   DELETE /api/library/books/:id
 * @desc    Delete book
 * @access  Private (Admin, Librarian)
 */
router.delete('/books/:id',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.deleteBook(req, res);
            return result;
        } catch (error) {
            console.error('Error in delete book route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Book Borrowing Routes
/**
 * @route   POST /api/library/books/:bookId/borrow
 * @desc    Borrow book
 * @access  Private (Admin, Librarian, Student, Teacher)
 */
router.post('/books/:bookId/borrow',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN', 'STUDENT', 'TEACHER']),
    async (req, res) => {
        try {
            const result = await libraryController.borrowBook(req, res);
            return result;
        } catch (error) {
            console.error('Error in borrow book route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/library/borrowings/:borrowingId/return
 * @desc    Return book
 * @access  Private (Admin, Librarian)
 */
router.post('/borrowings/:borrowingId/return',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.returnBook(req, res);
            return result;
        } catch (error) {
            console.error('Error in return book route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/library/borrowings/:borrowingId/pay-fine
 * @desc    Pay fine for overdue book
 * @access  Private (Admin, Librarian)
 */
router.post('/borrowings/:borrowingId/pay-fine',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.payFine(req, res);
            return result;
        } catch (error) {
            console.error('Error in pay fine route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Book Reservation Routes
/**
 * @route   POST /api/library/books/:bookId/reserve
 * @desc    Reserve book
 * @access  Private (Admin, Librarian, Student, Teacher)
 */
router.post('/books/:bookId/reserve',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN', 'STUDENT', 'TEACHER']),
    async (req, res) => {
        try {
            const result = await libraryController.reserveBook(req, res);
            return result;
        } catch (error) {
            console.error('Error in reserve book route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/library/reservations/:reservationId/cancel
 * @desc    Cancel reservation
 * @access  Private (Admin, Librarian, Student, Teacher)
 */
router.post('/reservations/:reservationId/cancel',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN', 'STUDENT', 'TEACHER']),
    async (req, res) => {
        try {
            const result = await libraryController.cancelReservation(req, res);
            return result;
        } catch (error) {
            console.error('Error in cancel reservation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/library/reservations/:reservationId/complete
 * @desc    Complete reservation (book picked up)
 * @access  Private (Admin, Librarian)
 */
router.post('/reservations/:reservationId/complete',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.completeReservation(req, res);
            return result;
        } catch (error) {
            console.error('Error in complete reservation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Borrowing Management Routes
/**
 * @route   GET /api/library/borrowings
 * @desc    Get all borrowings with filtering
 * @access  Private (Admin, Librarian)
 */
router.get('/borrowings',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getAllBorrowings(req, res);
            return result;
        } catch (error) {
            console.error('Error in get all borrowings route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/borrowings/:id
 * @desc    Get borrowing by ID
 * @access  Private (Admin, Librarian)
 */
router.get('/borrowings/:id',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getBorrowingById(req, res);
            return result;
        } catch (error) {
            console.error('Error in get borrowing by ID route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/borrowers/:borrowerId/history
 * @desc    Get borrower history
 * @access  Private (Admin, Librarian, Student, Teacher)
 */
router.get('/borrowers/:borrowerId/history',
    authenticate,
    async (req, res) => {
        try {
            const result = await libraryController.getBorrowerHistory(req, res);
            return result;
        } catch (error) {
            console.error('Error in get borrower history route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Reservation Management Routes
/**
 * @route   GET /api/library/reservations
 * @desc    Get all reservations with filtering
 * @access  Private (Admin, Librarian)
 */
router.get('/reservations',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getAllReservations(req, res);
            return result;
        } catch (error) {
            console.error('Error in get all reservations route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/reservations/:id
 * @desc    Get reservation by ID
 * @access  Private (Admin, Librarian)
 */
router.get('/reservations/:id',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getReservationById(req, res);
            return result;
        } catch (error) {
            console.error('Error in get reservation by ID route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/reservers/:reserverId/history
 * @desc    Get reserver history
 * @access  Private (Admin, Librarian, Student, Teacher)
 */
router.get('/reservers/:reserverId/history',
    authenticate,
    async (req, res) => {
        try {
            const result = await libraryController.getReserverHistory(req, res);
            return result;
        } catch (error) {
            console.error('Error in get reserver history route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Search and Analytics Routes
/**
 * @route   GET /api/library/search
 * @desc    Search books
 * @access  Private (All authenticated users)
 */
router.get('/search',
    authenticate,
    async (req, res) => {
        try {
            const result = await libraryController.searchBooks(req, res);
            return result;
        } catch (error) {
            console.error('Error in search books route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/analytics
 * @desc    Get library analytics
 * @access  Private (Admin, Librarian)
 */
router.get('/analytics',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getLibraryAnalytics(req, res);
            return result;
        } catch (error) {
            console.error('Error in library analytics route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Overdue and Expired Management Routes
/**
 * @route   GET /api/library/books/overdue
 * @desc    Get overdue books
 * @access  Private (Admin, Librarian)
 */
router.get('/books/overdue',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getOverdueBooks(req, res);
            return result;
        } catch (error) {
            console.error('Error in get overdue books route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/borrowings/overdue
 * @desc    Get overdue borrowings
 * @access  Private (Admin, Librarian)
 */
router.get('/borrowings/overdue',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getOverdueBorrowings(req, res);
            return result;
        } catch (error) {
            console.error('Error in get overdue borrowings route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/reservations/expired
 * @desc    Get expired reservations
 * @access  Private (Admin, Librarian)
 */
router.get('/reservations/expired',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getExpiredReservations(req, res);
            return result;
        } catch (error) {
            console.error('Error in get expired reservations route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Notifications and Automation Routes
/**
 * @route   POST /api/library/notifications/overdue-reminders
 * @desc    Send overdue reminders
 * @access  Private (Admin, Librarian)
 */
router.post('/notifications/overdue-reminders',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.sendOverdueReminders(req, res);
            return result;
        } catch (error) {
            console.error('Error in send overdue reminders route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/library/notifications/reservation-notifications
 * @desc    Send reservation notifications
 * @access  Private (Admin, Librarian)
 */
router.post('/notifications/reservation-notifications',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.sendReservationNotifications(req, res);
            return result;
        } catch (error) {
            console.error('Error in send reservation notifications route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/library/automation/cancel-expired-reservations
 * @desc    Auto-cancel expired reservations
 * @access  Private (Admin, Librarian)
 */
router.post('/automation/cancel-expired-reservations',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.autoCancelExpiredReservations(req, res);
            return result;
        } catch (error) {
            console.error('Error in auto-cancel expired reservations route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Dashboard Routes
/**
 * @route   GET /api/library/dashboard
 * @desc    Get library dashboard
 * @access  Private (Admin, Librarian)
 */
router.get('/dashboard',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.getLibraryDashboard(req, res);
            return result;
        } catch (error) {
            console.error('Error in library dashboard route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Bulk Operations Routes
/**
 * @route   PUT /api/library/books/bulk-update
 * @desc    Bulk update books
 * @access  Private (Admin, Librarian)
 */
router.put('/books/bulk-update',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.bulkUpdateBooks(req, res);
            return result;
        } catch (error) {
            console.error('Error in bulk update books route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/library/books/import
 * @desc    Import books from file
 * @access  Private (Admin, Librarian)
 */
router.post('/books/import',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.importBooks(req, res);
            return result;
        } catch (error) {
            console.error('Error in import books route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/books/export
 * @desc    Export books data
 * @access  Private (Admin, Librarian)
 */
router.get('/books/export',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const result = await libraryController.exportBooks(req, res);
            return result;
        } catch (error) {
            console.error('Error in export books route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Additional Book Routes
/**
 * @route   GET /api/library/books/:id/borrowings
 * @desc    Get book borrowing history
 * @access  Private (Admin, Librarian)
 */
router.get('/books/:id/borrowings',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const filters = { ...req.query, bookId: id };
            const result = await libraryController.getAllBorrowings({ query: filters }, res);
            return result;
        } catch (error) {
            console.error('Error in get book borrowings route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/books/:id/reservations
 * @desc    Get book reservation history
 * @access  Private (Admin, Librarian)
 */
router.get('/books/:id/reservations',
    authenticate,
    authorize(['ADMIN', 'LIBRARIAN']),
    async (req, res) => {
        try {
            const { id } = req.params;
            const filters = { ...req.query, bookId: id };
            const result = await libraryController.getAllReservations({ query: filters }, res);
            return result;
        } catch (error) {
            console.error('Error in get book reservations route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Student/Teacher Specific Routes
/**
 * @route   GET /api/library/my-borrowings
 * @desc    Get current user's borrowings
 * @access  Private (Student, Teacher)
 */
router.get('/my-borrowings',
    authenticate,
    authorize(['STUDENT', 'TEACHER']),
    async (req, res) => {
        try {
            const filters = { ...req.query, borrowerId: req.user.id };
            const result = await libraryController.getAllBorrowings({ query: filters }, res);
            return result;
        } catch (error) {
            console.error('Error in get my borrowings route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/library/my-reservations
 * @desc    Get current user's reservations
 * @access  Private (Student, Teacher)
 */
router.get('/my-reservations',
    authenticate,
    authorize(['STUDENT', 'TEACHER']),
    async (req, res) => {
        try {
            const filters = { ...req.query, reserverId: req.user.id };
            const result = await libraryController.getAllReservations({ query: filters }, res);
            return result;
        } catch (error) {
            console.error('Error in get my reservations route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);


export default router;
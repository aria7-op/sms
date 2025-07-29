import express from 'express';
const router = express.Router();
import libraryController from '../controllers/libraryController.js';
import {authenticateToken, authorizeRoles} from '../middleware/auth.js';

import { validateBookData, validateBookIssueData, validateReservationData, validateReviewData } from '../utils/libraryUtils.js';

// Book CRUD routes
router.post('/books', authenticateToken, authorizeRoles(['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), libraryController.createBook);
router.get('/books', authenticateToken, libraryController.getBooks);
router.get('/books/:id', authenticateToken, libraryController.getBookById);
router.put('/books/:id', authenticateToken, authorizeRoles(['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), libraryController.updateBook);
router.delete('/books/:id', authenticateToken, authorizeRoles(['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), libraryController.deleteBook);

// Book issue and return routes
router.post('/books/issue', authenticateToken, authorizeRoles(['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), libraryController.issueBook);
router.patch('/books/return/:issueId', authenticateToken, authorizeRoles(['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), libraryController.returnBook);
router.patch('/books/extend/:issueId', authenticateToken, authorizeRoles(['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), libraryController.extendBook);

// Book reservation routes
router.post('/books/reservations', authenticateToken, libraryController.createReservation);

// Book review routes
router.post('/books/reviews', authenticateToken, libraryController.createReview);

// Search and recommendations
router.get('/books/search', authenticateToken, libraryController.searchBooks);
router.get('/books/recommendations', authenticateToken, libraryController.getBookRecommendations);

// Analytics and reporting
router.get('/analytics/summary', authenticateToken, libraryController.getLibraryAnalytics);
router.get('/report/generate', authenticateToken, authorizeRoles(['LIBRARIAN', 'SCHOOL_ADMIN', 'SUPER_ADMIN']), libraryController.generateLibraryReport);

export default router; 
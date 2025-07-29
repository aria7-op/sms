import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Import from libraryUtils
import { 
  validateBookData,
  validateBookIssueData, 
  validateReservationData,
  validateReviewData,
  createBookLog,
  calculateFine,
  generateBarcode
} from '../utils/libraryUtils.js';

// Import other utilities and services
import { cacheBook, invalidateBookCache } from '../cache/libraryCache.js';
import { searchBooks, getBookRecommendations } from '../services/libraryService.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { sendNotification } from '../utils/notifications.js';
import { cacheData, getCachedData, clearCache } from '../cache/cacheManager.js';

// Import models
import Book from '../models/Book.js';
import BookBorrowing from '../models/BookBorrowing.js';
import BookReservation from '../models/BookReservation.js';

// Import validators
import { 
  validateBook, 
  validateBorrowing, 
  validateReservation 
} from '../validators/libraryValidator.js';

// Import middleware
import { createAuditLog } from '../middleware/audit.js';

class LibraryController {
  constructor() {
    this.book = new Book();
    this.borrowing = new BookBorrowing();
    this.reservation = new BookReservation();
  }

  // Create new book
  async createBook(req, res) {
    try {
      let coverImageUrl = null;
      if (req.file) {
        const uploadResult = await uploadToCloudinary(req.file.path, 'books');
        coverImageUrl = uploadResult.secure_url;
      }

      const bookData = {
        ...req.body,
        coverImage: coverImageUrl,
        schoolId: req.user.schoolId,
        createdBy: req.user.id
      };

      const result = await this.book.create(bookData);

      if (result.success) {
        await createAuditLog({
          userId: req.user.id,
          action: 'CREATE',
          resource: 'BOOK',
          resourceId: result.data.id,
          details: `Created book: ${result.data.title}`,
          ipAddress: req.ip
        });

        await clearCache('book');
        return res.status(201).json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error creating book:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Internal server error'
      });
    }
  }

  // Get all books with advanced filtering
  async getBooks(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        page = 1,
        limit = 10,
        status,
        category,
        condition,
        subjectId,
        author,
        publisher,
        language,
        minPrice,
        maxPrice,
        search,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        available = false
      } = req.query;

      const skip = (page - 1) * limit;
      const where = { schoolId: BigInt(schoolId), deletedAt: null };

      // Apply filters
      if (status) where.status = status;
      if (category) where.category = category;
      if (condition) where.condition = condition;
      if (subjectId) where.subjectId = BigInt(subjectId);
      if (author) where.author = { contains: author, mode: 'insensitive' };
      if (publisher) where.publisher = { contains: publisher, mode: 'insensitive' };
      if (language) where.language = language;
      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price.gte = parseFloat(minPrice);
        if (maxPrice) where.price.lte = parseFloat(maxPrice);
      }
      if (available === 'true') where.available = { gt: 0 };
      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { author: { contains: search, mode: 'insensitive' } },
          { isbn: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { keywords: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [books, total] = await Promise.all([
        prisma.book.findMany({
          where,
          include: {
            subject: { select: { id: true, uuid: true, name: true } },
            createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } },
            _count: {
              select: {
                bookIssues: true,
                reservations: true,
                bookReviews: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.book.count({ where })
      ]);

      res.json({
        success: true,
        data: books,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Get books error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get book by ID
  async getBookById(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const book = await prisma.book.findFirst({
        where: { id: BigInt(id), schoolId: BigInt(schoolId), deletedAt: null },
        include: {
          subject: { select: { id: true, uuid: true, name: true } },
          bookIssues: {
            include: {
              student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
              staff: { select: { id: true, uuid: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          reservations: {
            include: {
              student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
              staff: { select: { id: true, uuid: true, firstName: true, lastName: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          bookReviews: {
            include: {
              student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
              staff: { select: { id: true, uuid: true, firstName: true, lastName: true } }
            },
            where: { isApproved: true },
            orderBy: { createdAt: 'desc' }
          },
          bookLogs: { orderBy: { createdAt: 'desc' }, take: 10 },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          updatedByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      if (!book) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }

      res.json({ success: true, data: book });
    } catch (error) {
      console.error('Get book error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Update book
  async updateBook(req, res) {
    try {
      const { id } = req.params;
      let coverImageUrl = null;
      
      if (req.file) {
        const uploadResult = await uploadToCloudinary(req.file.path, 'books');
        coverImageUrl = uploadResult.secure_url;
      }

      const updateData = { ...req.body };
      if (coverImageUrl) {
        updateData.coverImage = coverImageUrl;
      }

      const result = await this.book.update(id, updateData);
      
      if (result.success) {
        await createAuditLog({
          userId: req.user.id,
          action: 'UPDATE',
          resource: 'BOOK',
          resourceId: parseInt(id),
          details: `Updated book: ${result.data.title}`,
          ipAddress: req.ip
        });

        await clearCache('book');
        return res.json(result);
      } else {
        return res.status(400).json(result);
      }
    } catch (error) {
      console.error('Error updating book:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
        message: 'Internal server error'
      });
    }
  }

  // Delete book (soft delete)
  async deleteBook(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;

      const book = await prisma.book.findFirst({
        where: { id: BigInt(id), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!book) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }

      await prisma.book.update({
        where: { id: BigInt(id) },
        data: { deletedAt: new Date(), updatedBy: userId }
      });

      // Create book log
      await createBookLog(id, null, 'deleted', book, null, req.ip, req.get('User-Agent'), schoolId, userId);

      // Invalidate cache
      await invalidateBookCache(id, schoolId);

      res.json({ success: true, message: 'Book deleted successfully' });
    } catch (error) {
      console.error('Delete book error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Issue book
  async issueBook(req, res) {
    try {
      const { error, value } = validateBookIssueData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId, id: userId } = req.user;
      const { bookId, studentId, staffId, dueDate } = value;

      // Check if book exists and is available
      const book = await prisma.book.findFirst({
        where: { id: BigInt(bookId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!book) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }

      if (book.available <= 0) {
        return res.status(400).json({ success: false, message: 'Book is not available for issue' });
      }

      // Check if user already has this book issued
      const existingIssue = await prisma.bookIssue.findFirst({
        where: {
          bookId: BigInt(bookId),
          OR: [
            { studentId: studentId ? BigInt(studentId) : null },
            { staffId: staffId ? BigInt(staffId) : null }
          ],
          status: { in: ['ISSUED', 'EXTENDED'] },
          deletedAt: null
        }
      });

      if (existingIssue) {
        return res.status(400).json({ success: false, message: 'User already has this book issued' });
      }

      // Create book issue
      const bookIssue = await prisma.bookIssue.create({
        data: {
          bookId: BigInt(bookId),
          studentId: studentId ? BigInt(studentId) : null,
          staffId: staffId ? BigInt(staffId) : null,
          issueDate: new Date(),
          dueDate: new Date(dueDate),
          status: 'ISSUED',
          schoolId: BigInt(schoolId),
          createdBy: userId
        },
        include: {
          book: { select: { id: true, uuid: true, title: true, author: true } },
          student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          staff: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      // Update book availability
      await prisma.book.update({
        where: { id: BigInt(bookId) },
        data: { available: book.available - 1 }
      });

      // Create book log
      await createBookLog(bookId, bookIssue.id, 'issued', null, bookIssue, req.ip, req.get('User-Agent'), schoolId, userId);

      res.status(201).json({
        success: true,
        message: 'Book issued successfully',
        data: bookIssue
      });
    } catch (error) {
      console.error('Issue book error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Return book
  async returnBook(req, res) {
    try {
      const { issueId } = req.params;
      const { schoolId, id: userId } = req.user;
      const { condition, remarks } = req.body;

      const bookIssue = await prisma.bookIssue.findFirst({
        where: { id: BigInt(issueId), schoolId: BigInt(schoolId), deletedAt: null },
        include: {
          book: true,
          student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          staff: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      if (!bookIssue) {
        return res.status(404).json({ success: false, message: 'Book issue not found' });
      }

      if (bookIssue.status === 'RETURNED') {
        return res.status(400).json({ success: false, message: 'Book already returned' });
      }

      // Calculate fine if overdue
      let fineAmount = 0;
      if (new Date() > new Date(bookIssue.dueDate)) {
        fineAmount = await calculateFine(bookIssue.dueDate);
      }

      // Update book issue
      const updatedIssue = await prisma.bookIssue.update({
        where: { id: BigInt(issueId) },
        data: {
          returnDate: new Date(),
          status: 'RETURNED',
          fineAmount,
          returnCondition: condition || bookIssue.condition,
          remarks,
          updatedBy: userId
        },
        include: {
          book: { select: { id: true, uuid: true, title: true, author: true } },
          student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          staff: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          updatedByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      // Update book availability
      await prisma.book.update({
        where: { id: bookIssue.bookId },
        data: { available: bookIssue.book.available + 1 }
      });

      // Create book log
      await createBookLog(bookIssue.bookId, issueId, 'returned', bookIssue, updatedIssue, req.ip, req.get('User-Agent'), schoolId, userId);

      res.json({
        success: true,
        message: 'Book returned successfully',
        data: updatedIssue
      });
    } catch (error) {
      console.error('Return book error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Extend book due date
  async extendBook(req, res) {
    try {
      const { issueId } = req.params;
      const { extendedDate } = req.body;
      const { schoolId, id: userId } = req.user;

      const bookIssue = await prisma.bookIssue.findFirst({
        where: { id: BigInt(issueId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!bookIssue) {
        return res.status(404).json({ success: false, message: 'Book issue not found' });
      }

      if (bookIssue.status !== 'ISSUED' && bookIssue.status !== 'EXTENDED') {
        return res.status(400).json({ success: false, message: 'Book cannot be extended' });
      }

      const updatedIssue = await prisma.bookIssue.update({
        where: { id: BigInt(issueId) },
        data: {
          extendedDate: new Date(extendedDate),
          status: 'EXTENDED',
          updatedBy: userId
        },
        include: {
          book: { select: { id: true, uuid: true, title: true, author: true } },
          student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          staff: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      // Create book log
      await createBookLog(bookIssue.bookId, issueId, 'extended', bookIssue, updatedIssue, req.ip, req.get('User-Agent'), schoolId, userId);

      res.json({
        success: true,
        message: 'Book due date extended successfully',
        data: updatedIssue
      });
    } catch (error) {
      console.error('Extend book error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create book reservation
  async createReservation(req, res) {
    try {
      const { error, value } = validateReservationData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId, id: userId } = req.user;
      const { bookId, studentId, staffId, expiryDate } = value;

      // Check if book exists
      const book = await prisma.book.findFirst({
        where: { id: BigInt(bookId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!book) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }

      // Check if user already has a reservation for this book
      const existingReservation = await prisma.bookReservation.findFirst({
        where: {
          bookId: BigInt(bookId),
          OR: [
            { studentId: studentId ? BigInt(studentId) : null },
            { staffId: staffId ? BigInt(staffId) : null }
          ],
          status: { in: ['PENDING', 'APPROVED'] },
          deletedAt: null
        }
      });

      if (existingReservation) {
        return res.status(400).json({ success: false, message: 'User already has a reservation for this book' });
      }

      const reservation = await prisma.bookReservation.create({
        data: {
          bookId: BigInt(bookId),
          studentId: studentId ? BigInt(studentId) : null,
          staffId: staffId ? BigInt(staffId) : null,
          reservationDate: new Date(),
          expiryDate: new Date(expiryDate),
          status: 'PENDING',
          schoolId: BigInt(schoolId),
          createdBy: userId
        },
        include: {
          book: { select: { id: true, uuid: true, title: true, author: true } },
          student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          staff: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Book reservation created successfully',
        data: reservation
      });
    } catch (error) {
      console.error('Create reservation error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Create book review
  async createReview(req, res) {
    try {
      const { error, value } = validateReviewData(req.body);
      if (error) {
        return res.status(400).json({ success: false, message: error.details[0].message });
      }

      const { schoolId, id: userId } = req.user;
      const { bookId, studentId, staffId, rating, review, isAnonymous } = value;

      // Check if book exists
      const book = await prisma.book.findFirst({
        where: { id: BigInt(bookId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!book) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }

      // Check if user already reviewed this book
      const existingReview = await prisma.bookReview.findFirst({
        where: {
          bookId: BigInt(bookId),
          OR: [
            { studentId: studentId ? BigInt(studentId) : null },
            { staffId: staffId ? BigInt(staffId) : null }
          ],
          deletedAt: null
        }
      });

      if (existingReview) {
        return res.status(400).json({ success: false, message: 'User already reviewed this book' });
      }

      const bookReview = await prisma.bookReview.create({
        data: {
          bookId: BigInt(bookId),
          studentId: studentId ? BigInt(studentId) : null,
          staffId: staffId ? BigInt(staffId) : null,
          rating,
          review,
          isAnonymous,
          schoolId: BigInt(schoolId),
          createdBy: userId
        },
        include: {
          book: { select: { id: true, uuid: true, title: true, author: true } },
          student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          staff: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          createdByUser: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        }
      });

      res.status(201).json({
        success: true,
        message: 'Book review created successfully',
        data: bookReview
      });
    } catch (error) {
      console.error('Create review error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Search books
  async searchBooks(req, res) {
    try {
      const { schoolId } = req.user;
      const { query, category, subjectId, author, publisher, available } = req.query;

      const searchResults = await searchBooks(schoolId, {
        query,
        category,
        subjectId,
        author,
        publisher,
        available: available === 'true'
      });

      res.json({
        success: true,
        data: searchResults
      });
    } catch (error) {
      console.error('Search books error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get book recommendations
  async getBookRecommendations(req, res) {
    try {
      const { schoolId } = req.user;
      const { studentId, staffId, limit = 10 } = req.query;

      const recommendations = await getBookRecommendations(schoolId, {
        studentId: studentId ? BigInt(studentId) : null,
        staffId: staffId ? BigInt(staffId) : null,
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      console.error('Get recommendations error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Get library analytics
  async getLibraryAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate } = req.query;

      const where = { schoolId: BigInt(schoolId), deletedAt: null };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [
        totalBooks,
        totalIssues,
        totalReservations,
        totalReviews,
        categoryStats,
        popularBooks,
        overdueBooks,
        recentIssues
      ] = await Promise.all([
        prisma.book.count({ where }),
        prisma.bookIssue.count({ where: { ...where, status: { in: ['ISSUED', 'EXTENDED'] } } }),
        prisma.bookReservation.count({ where: { ...where, status: { in: ['PENDING', 'APPROVED'] } } }),
        prisma.bookReview.count({ where: { ...where, isApproved: true } }),
        prisma.book.groupBy({
          by: ['category'],
          where,
          _count: { category: true },
          _sum: { quantity: true, available: true }
        }),
        prisma.book.findMany({
          where,
          include: {
            _count: { select: { bookIssues: true } }
          },
          orderBy: { bookIssues: { _count: 'desc' } },
          take: 10
        }),
        prisma.bookIssue.count({
          where: {
            schoolId: BigInt(schoolId),
            dueDate: { lt: new Date() },
            status: { in: ['ISSUED', 'EXTENDED'] },
            deletedAt: null
          }
        }),
        prisma.bookIssue.findMany({
          where: { schoolId: BigInt(schoolId), deletedAt: null },
          include: {
            book: { select: { id: true, uuid: true, title: true, author: true } },
            student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
            staff: { select: { id: true, uuid: true, firstName: true, lastName: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      ]);

      res.json({
        success: true,
        data: {
          totalBooks,
          totalIssues,
          totalReservations,
          totalReviews,
          categoryStats,
          popularBooks,
          overdueBooks,
          recentIssues
        }
      });
    } catch (error) {
      console.error('Get library analytics error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  // Generate library report
  async generateLibraryReport(req, res) {
    try {
      const { schoolId } = req.user;
      const { startDate, endDate, format = 'json' } = req.query;

      const where = { schoolId: BigInt(schoolId), deletedAt: null };
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const books = await prisma.book.findMany({
        where,
        include: {
          subject: { select: { name: true } },
          _count: {
            select: {
              bookIssues: true,
              reservations: true,
              bookReviews: true
            }
          }
        },
        orderBy: { title: 'asc' }
      });

      if (format === 'csv') {
        // Generate CSV report
        const csvData = books.map(book => ({
          'Title': book.title,
          'Author': book.author,
          'ISBN': book.isbn || 'N/A',
          'Category': book.category,
          'Subject': book.subject?.name || 'N/A',
          'Quantity': book.quantity,
          'Available': book.available,
          'Status': book.status,
          'Condition': book.condition,
          'Total Issues': book._count.bookIssues,
          'Total Reservations': book._count.reservations,
          'Total Reviews': book._count.bookReviews
        }));

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=library-report.csv');
        // Convert to CSV string and send
        res.send(csvData);
      } else {
        res.json({
          success: true,
          data: books,
          summary: {
            totalBooks: books.length,
            totalQuantity: books.reduce((sum, book) => sum + book.quantity, 0),
            totalAvailable: books.reduce((sum, book) => sum + book.available, 0),
            totalIssues: books.reduce((sum, book) => sum + book._count.bookIssues, 0)
          }
        });
      }
    } catch (error) {
      console.error('Generate library report error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export default new LibraryController();
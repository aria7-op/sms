import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class LibraryService {
  constructor() {
    this.maxSearchResults = 100;
    this.recommendationLimit = 10;
  }

  // Advanced book search
  async searchBooks(schoolId, searchParams) {
    try {
      const {
        query,
        category,
        subjectId,
        author,
        publisher,
        available,
        status,
        language,
        minPrice,
        maxPrice,
        condition,
        sortBy = 'title',
        sortOrder = 'asc',
        limit = this.maxSearchResults
      } = searchParams;

      const where = { schoolId: BigInt(schoolId), deletedAt: null };

      // Text search
      if (query) {
        where.OR = [
          { title: { contains: query, mode: 'insensitive' } },
          { author: { contains: query, mode: 'insensitive' } },
          { isbn: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { keywords: { contains: query, mode: 'insensitive' } }
        ];
      }

      // Filter by category
      if (category) where.category = category;

      // Filter by subject
      if (subjectId) where.subjectId = BigInt(subjectId);

      // Filter by author
      if (author) where.author = { contains: author, mode: 'insensitive' };

      // Filter by publisher
      if (publisher) where.publisher = { contains: publisher, mode: 'insensitive' };

      // Filter by availability
      if (available === 'true') where.available = { gt: 0 };

      // Filter by status
      if (status) where.status = status;

      // Filter by language
      if (language) where.language = language;

      // Filter by price range
      if (minPrice || maxPrice) {
        where.price = {};
        if (minPrice) where.price.gte = parseFloat(minPrice);
        if (maxPrice) where.price.lte = parseFloat(maxPrice);
      }

      // Filter by condition
      if (condition) where.condition = condition;

      const books = await prisma.book.findMany({
        where,
        include: {
          subject: { select: { id: true, uuid: true, name: true } },
          _count: {
            select: {
              bookIssues: true,
              reservations: true,
              bookReviews: true
            }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        take: parseInt(limit)
      });

      return books;
    } catch (error) {
      console.error('Search books error:', error);
      throw error;
    }
  }

  // Get book recommendations
  async getBookRecommendations(schoolId, params) {
    try {
      const { studentId, staffId, limit = this.recommendationLimit } = params;

      // Get user's reading history
      const userIssues = await prisma.bookIssue.findMany({
        where: {
          OR: [
            { studentId: studentId ? BigInt(studentId) : null },
            { staffId: staffId ? BigInt(staffId) : null }
          ],
          schoolId: BigInt(schoolId),
          status: 'RETURNED',
          deletedAt: null
        },
        include: {
          book: { select: { id: true, category: true, subjectId: true } }
        }
      });

      if (userIssues.length === 0) {
        // If no history, return popular books
        return await this.getPopularBooks(schoolId, limit);
      }

      // Get categories and subjects the user has read
      const userCategories = [...new Set(userIssues.map(issue => issue.book.category))];
      const userSubjects = [...new Set(userIssues.map(issue => issue.book.subjectId).filter(Boolean))];

      // Find books in similar categories/subjects
      const recommendations = await prisma.book.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          available: { gt: 0 },
          status: 'AVAILABLE',
          OR: [
            { category: { in: userCategories } },
            { subjectId: { in: userSubjects } }
          ]
        },
        include: {
          subject: { select: { id: true, uuid: true, name: true } },
          _count: {
            select: {
              bookIssues: true,
              bookReviews: true
            }
          }
        },
        orderBy: [
          { _count: { bookIssues: 'desc' } },
          { _count: { bookReviews: 'desc' } }
        ],
        take: parseInt(limit)
      });

      return recommendations;
    } catch (error) {
      console.error('Get book recommendations error:', error);
      throw error;
    }
  }

  // Get popular books
  async getPopularBooks(schoolId, limit = 10) {
    try {
      const books = await prisma.book.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          available: { gt: 0 }
        },
        include: {
          subject: { select: { id: true, uuid: true, name: true } },
          _count: {
            select: {
              bookIssues: true,
              bookReviews: true
            }
          }
        },
        orderBy: { bookIssues: { _count: 'desc' } },
        take: parseInt(limit)
      });

      return books;
    } catch (error) {
      console.error('Get popular books error:', error);
      throw error;
    }
  }

  // Get recent books
  async getRecentBooks(schoolId, limit = 10) {
    try {
      const books = await prisma.book.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: {
          subject: { select: { id: true, uuid: true, name: true } },
          _count: {
            select: {
              bookIssues: true,
              reservations: true,
              bookReviews: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit)
      });

      return books;
    } catch (error) {
      console.error('Get recent books error:', error);
      throw error;
    }
  }

  // Get overdue books
  async getOverdueBooks(schoolId, limit = 50) {
    try {
      const overdueIssues = await prisma.bookIssue.findMany({
        where: {
          schoolId: BigInt(schoolId),
          dueDate: { lt: new Date() },
          status: { in: ['ISSUED', 'EXTENDED'] },
          deletedAt: null
        },
        include: {
          book: { select: { id: true, uuid: true, title: true, author: true } },
          student: { select: { id: true, uuid: true, firstName: true, lastName: true } },
          staff: { select: { id: true, uuid: true, firstName: true, lastName: true } }
        },
        orderBy: { dueDate: 'asc' },
        take: parseInt(limit)
      });

      return overdueIssues;
    } catch (error) {
      console.error('Get overdue books error:', error);
      throw error;
    }
  }

  // Get library analytics
  async getLibraryAnalytics(schoolId, startDate, endDate) {
    try {
      const where = { schoolId: BigInt(schoolId), deletedAt: null };
      const issueWhere = { schoolId: BigInt(schoolId), deletedAt: null };

      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        
        where.createdAt = dateFilter;
        issueWhere.issueDate = dateFilter;
      }

      const [
        totalBooks,
        totalIssues,
        totalReturns,
        totalReservations,
        totalReviews,
        categoryStats,
        monthlyStats,
        popularCategories,
        topBooks,
        overdueCount
      ] = await Promise.all([
        prisma.book.count({ where }),
        prisma.bookIssue.count({ where: { ...issueWhere, status: { in: ['ISSUED', 'EXTENDED'] } } }),
        prisma.bookIssue.count({ where: { ...issueWhere, status: 'RETURNED' } }),
        prisma.bookReservation.count({ where: { ...where, status: { in: ['PENDING', 'APPROVED'] } } }),
        prisma.bookReview.count({ where: { ...where, isApproved: true } }),
        prisma.book.groupBy({
          by: ['category'],
          where,
          _count: { category: true },
          _sum: { quantity: true, available: true }
        }),
        prisma.bookIssue.groupBy({
          by: ['issueDate'],
          where: issueWhere,
          _count: { id: true }
        }),
        prisma.book.groupBy({
          by: ['category'],
          where,
          _count: { bookIssues: true }
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
        })
      ]);

      return {
        totalBooks,
        totalIssues,
        totalReturns,
        totalReservations,
        totalReviews,
        categoryStats,
        monthlyStats,
        popularCategories,
        topBooks,
        overdueCount,
        returnRate: totalIssues > 0 ? (totalReturns / totalIssues) * 100 : 0,
        averageRating: await this.getAverageRating(schoolId)
      };
    } catch (error) {
      console.error('Get library analytics error:', error);
      throw error;
    }
  }

  // Get average rating
  async getAverageRating(schoolId) {
    try {
      const result = await prisma.bookReview.aggregate({
        where: {
          schoolId: BigInt(schoolId),
          isApproved: true,
          deletedAt: null
        },
        _avg: { rating: true }
      });

      return result._avg.rating || 0;
    } catch (error) {
      console.error('Get average rating error:', error);
      return 0;
    }
  }

  // Generate library report
  async generateLibraryReport(schoolId, startDate, endDate, format = 'json') {
    try {
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

      const summary = {
        totalBooks: books.length,
        totalQuantity: books.reduce((sum, book) => sum + book.quantity, 0),
        totalAvailable: books.reduce((sum, book) => sum + book.available, 0),
        totalIssues: books.reduce((sum, book) => sum + book._count.bookIssues, 0),
        totalReservations: books.reduce((sum, book) => sum + book._count.reservations, 0),
        totalReviews: books.reduce((sum, book) => sum + book._count.bookReviews, 0),
        availabilityRate: books.length > 0 ? 
          (books.reduce((sum, book) => sum + (book.available / book.quantity), 0) / books.length) * 100 : 0
      };

      if (format === 'csv') {
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

        return { data: csvData, summary };
      }

      return { data: books, summary };
    } catch (error) {
      console.error('Generate library report error:', error);
      throw error;
    }
  }

  // Check book availability
  async checkBookAvailability(bookId, schoolId) {
    try {
      const book = await prisma.book.findFirst({
        where: { id: BigInt(bookId), schoolId: BigInt(schoolId), deletedAt: null }
      });

      if (!book) {
        return { available: false, message: 'Book not found' };
      }

      if (book.status !== 'AVAILABLE') {
        return { available: false, message: `Book is ${book.status.toLowerCase()}` };
      }

      if (book.available <= 0) {
        return { available: false, message: 'No copies available' };
      }

      return { available: true, book };
    } catch (error) {
      console.error('Check book availability error:', error);
      throw error;
    }
  }

  // Check user issue limit
  async checkUserIssueLimit(studentId, staffId, schoolId) {
    try {
      const maxIssues = 5; // Maximum books a user can have issued
      
      const currentIssues = await prisma.bookIssue.count({
        where: {
          OR: [
            { studentId: studentId ? BigInt(studentId) : null },
            { staffId: staffId ? BigInt(staffId) : null }
          ],
          status: { in: ['ISSUED', 'EXTENDED'] },
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      return {
        canIssue: currentIssues < maxIssues,
        currentIssues,
        maxIssues,
        remainingIssues: maxIssues - currentIssues
      };
    } catch (error) {
      console.error('Check user issue limit error:', error);
      throw error;
    }
  }

  // Check user overdue books
  async checkUserOverdueBooks(studentId, staffId, schoolId) {
    try {
      const overdueBooks = await prisma.bookIssue.findMany({
        where: {
          OR: [
            { studentId: studentId ? BigInt(studentId) : null },
            { staffId: staffId ? BigInt(staffId) : null }
          ],
          dueDate: { lt: new Date() },
          status: { in: ['ISSUED', 'EXTENDED'] },
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: {
          book: { select: { id: true, title: true, author: true } }
        }
      });

      return {
        hasOverdue: overdueBooks.length > 0,
        overdueCount: overdueBooks.length,
        overdueBooks
      };
    } catch (error) {
      console.error('Check user overdue books error:', error);
      throw error;
    }
  }

  // Calculate due date
  calculateDueDate(issueDate, days = 14) {
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }

  // Calculate fine
  async calculateFine(dueDate) {
    const today = new Date();
    const due = new Date(dueDate);
    
    if (today <= due) return 0;
    
    const daysLate = Math.ceil((today - due) / (1000 * 60 * 60 * 24));
    const fineRate = 0.50; // $0.50 per day
    const fine = daysLate * fineRate;
    
    return Math.min(fine, 50); // Cap at $50
  }
}

// Export individual functions as named exports
export const searchBooks = (schoolId, searchParams) => new LibraryService().searchBooks(schoolId, searchParams);
export const getBookRecommendations = (schoolId, params) => new LibraryService().getBookRecommendations(schoolId, params);
export const getPopularBooks = (schoolId, limit) => new LibraryService().getPopularBooks(schoolId, limit);
export const getRecentBooks = (schoolId, limit) => new LibraryService().getRecentBooks(schoolId, limit);
export const getOverdueBooks = (schoolId, limit) => new LibraryService().getOverdueBooks(schoolId, limit);
export const getLibraryAnalytics = (schoolId, startDate, endDate) => new LibraryService().getLibraryAnalytics(schoolId, startDate, endDate);
export const generateLibraryReport = (schoolId, startDate, endDate, format) => new LibraryService().generateLibraryReport(schoolId, startDate, endDate, format);
export const checkBookAvailability = (bookId, schoolId) => new LibraryService().checkBookAvailability(bookId, schoolId);
export const checkUserIssueLimit = (studentId, staffId, schoolId) => new LibraryService().checkUserIssueLimit(studentId, staffId, schoolId);
export const checkUserOverdueBooks = (studentId, staffId, schoolId) => new LibraryService().checkUserOverdueBooks(studentId, staffId, schoolId);

// Also export the class itself as default
export default LibraryService;
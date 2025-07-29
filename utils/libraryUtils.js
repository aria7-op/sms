import Joi from 'joi';
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Library validation schemas
const bookSchema = Joi.object({
  title: Joi.string().max(255).required(),
  author: Joi.string().max(100).required(),
  isbn: Joi.string().max(20).optional(),
  publisher: Joi.string().max(100).optional(),
  edition: Joi.string().max(50).optional(),
  category: Joi.string().valid('FICTION', 'NON_FICTION', 'REFERENCE', 'TEXTBOOK', 'MAGAZINE', 'NEWSPAPER', 'JOURNAL', 'ENCYCLOPEDIA', 'DICTIONARY', 'ATLAS', 'BIOGRAPHY', 'AUTOBIOGRAPHY', 'POETRY', 'DRAMA', 'SCIENCE_FICTION', 'MYSTERY', 'ROMANCE', 'HISTORY', 'SCIENCE', 'MATHEMATICS', 'LITERATURE', 'PHILOSOPHY', 'RELIGION', 'ART', 'MUSIC', 'SPORTS', 'COOKING', 'TRAVEL', 'OTHER').default('OTHER'),
  subjectId: Joi.number().optional(),
  quantity: Joi.number().integer().min(1).default(1),
  available: Joi.number().integer().min(0).optional(),
  reserved: Joi.number().integer().min(0).default(0),
  shelfNumber: Joi.string().max(20).optional(),
  price: Joi.number().positive().optional(),
  language: Joi.string().max(50).optional(),
  pages: Joi.number().integer().positive().optional(),
  publishYear: Joi.number().integer().min(1800).max(new Date().getFullYear()).optional(),
  condition: Joi.string().valid('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'LOST').default('GOOD'),
  status: Joi.string().valid('AVAILABLE', 'ISSUED', 'RESERVED', 'LOST', 'DAMAGED', 'UNDER_MAINTENANCE', 'RETIRED').default('AVAILABLE'),
  coverImage: Joi.string().max(255).optional(),
  description: Joi.string().optional(),
  keywords: Joi.string().max(500).optional(),
  metadata: Joi.object().optional(),
  isDigital: Joi.boolean().default(false),
  digitalUrl: Joi.string().max(255).optional()
});

const bookIssueSchema = Joi.object({
  bookId: Joi.number().required(),
  studentId: Joi.number().optional(),
  staffId: Joi.number().optional(),
  dueDate: Joi.date().greater('now').required()
});

const reservationSchema = Joi.object({
  bookId: Joi.number().required(),
  studentId: Joi.number().optional(),
  staffId: Joi.number().optional(),
  expiryDate: Joi.date().greater('now').required()
});

const reviewSchema = Joi.object({
  bookId: Joi.number().required(),
  studentId: Joi.number().optional(),
  staffId: Joi.number().optional(),
  rating: Joi.number().integer().min(1).max(5).required(),
  review: Joi.string().optional(),
  isAnonymous: Joi.boolean().default(false)
});

// Validation functions
export const validateBookData = (data, isUpdate = false) => {
  const schema = isUpdate ? bookSchema.fork(['title', 'author', 'quantity'], (schema) => schema.optional()) : bookSchema;
  return schema.validate(data);
};

export const validateBookIssueData = (data) => {
  return bookIssueSchema.validate(data);
};

export const validateReservationData = (data) => {
  return reservationSchema.validate(data);
};

export const validateReviewData = (data) => {
  return reviewSchema.validate(data);
};

// Barcode generation
export const generateBarcode = async (schoolId) => {
  const year = new Date().getFullYear();
  const prefix = `ISBN-${year}-`;
  
  // Get the last book for this school and year
  const lastBook = await prisma.book.findFirst({
    where: {
      schoolId: BigInt(schoolId),
      isbn: { startsWith: prefix },
      deletedAt: null
    },
    orderBy: { isbn: 'desc' }
  });

  let sequence = 1;
  if (lastBook && lastBook.isbn) {
    const lastSequence = parseInt(lastBook.isbn.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(6, '0')}`;
};

// Fine calculation
export const calculateFine = async (dueDate) => {
  const today = new Date();
  const due = new Date(dueDate);
  
  if (today <= due) return 0;
  
  const daysLate = Math.ceil((today - due) / (1000 * 60 * 60 * 24));
  const fineRate = 0.50; // $0.50 per day
  const fine = daysLate * fineRate;
  
  return Math.min(fine, 50); // Cap at $50
};

// Book log creation
export const createBookLog = async (bookId, bookIssueId, action, oldValue, newValue, ipAddress, userAgent, schoolId, userId) => {
  try {
    await prisma.bookLog.create({
      data: {
        bookId: bookId ? BigInt(bookId) : null,
        bookIssueId: bookIssueId ? BigInt(bookIssueId) : null,
        action,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        ipAddress,
        userAgent,
        schoolId: BigInt(schoolId),
        createdBy: userId ? BigInt(userId) : null
      }
    });
  } catch (error) {
    console.error('Error creating book log:', error);
  }
};

// Book availability check
export const checkBookAvailability = async (bookId, schoolId) => {
  const book = await prisma.book.findFirst({
    where: { id: BigInt(bookId), schoolId: BigInt(schoolId), deletedAt: null }
  });

  if (!book) return { available: false, message: 'Book not found' };
  if (book.status !== 'AVAILABLE') return { available: false, message: `Book is ${book.status.toLowerCase()}` };
  if (book.available <= 0) return { available: false, message: 'No copies available' };

  return { available: true, book };
};

// Check if user can issue more books
export const checkUserIssueLimit = async (studentId, staffId, schoolId) => {
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

  return currentIssues < maxIssues;
};

// Check if user has overdue books
export const checkUserOverdueBooks = async (studentId, staffId, schoolId) => {
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
    }
  });

  return overdueBooks.length === 0;
};

// Calculate due date
export const calculateDueDate = (issueDate, days = 14) => {
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + days);
  return dueDate;
};

// Book search functionality
export const searchBooksAdvanced = async (schoolId, searchParams) => {
  const { query, category, subjectId, author, publisher, available, status } = searchParams;
  
  const where = { schoolId: BigInt(schoolId), deletedAt: null };

  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { author: { contains: query, mode: 'insensitive' } },
      { isbn: { contains: query, mode: 'insensitive' } },
      { description: { contains: query, mode: 'insensitive' } },
      { keywords: { contains: query, mode: 'insensitive' } }
    ];
  }

  if (category) where.category = category;
  if (subjectId) where.subjectId = BigInt(subjectId);
  if (author) where.author = { contains: author, mode: 'insensitive' };
  if (publisher) where.publisher = { contains: publisher, mode: 'insensitive' };
  if (available === 'true') where.available = { gt: 0 };
  if (status) where.status = status;

  return await prisma.book.findMany({
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
    orderBy: { title: 'asc' }
  });
};

// Get book recommendations
export const getBookRecommendationsForUser = async (schoolId, userId, userType, limit = 10) => {
  // Get user's reading history
  const userIssues = await prisma.bookIssue.findMany({
    where: {
      OR: [
        { studentId: userType === 'student' ? BigInt(userId) : null },
        { staffId: userType === 'staff' ? BigInt(userId) : null }
      ],
      schoolId: BigInt(schoolId),
      status: 'RETURNED',
      deletedAt: null
    },
    include: {
      book: { select: { id: true, category: true, subjectId: true } }
    }
  });

  // Get categories and subjects the user has read
  const userCategories = [...new Set(userIssues.map(issue => issue.book.category))];
  const userSubjects = [...new Set(userIssues.map(issue => issue.book.subjectId).filter(Boolean))];

  // Find books in similar categories/subjects
  const recommendations = await prisma.book.findMany({
    where: {
      schoolId: BigInt(schoolId),
      deletedAt: null,
      available: { gt: 0 },
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
    take: limit
  });

  return recommendations;
};

// Calculate book statistics
export const calculateBookStats = (books) => {
  return books.reduce((stats, book) => {
    stats.totalBooks++;
    stats.totalQuantity += book.quantity;
    stats.totalAvailable += book.available;
    stats.totalReserved += book.reserved;
    
    if (book.quantity > 0) {
      stats.availabilityRate += (book.available / book.quantity);
    }
    
    return stats;
  }, {
    totalBooks: 0,
    totalQuantity: 0,
    totalAvailable: 0,
    totalReserved: 0,
    availabilityRate: 0
  });
};

// Check book condition
export const assessBookCondition = (returnCondition, originalCondition) => {
  const conditionOrder = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED', 'LOST'];
  const originalIndex = conditionOrder.indexOf(originalCondition);
  const returnIndex = conditionOrder.indexOf(returnCondition);
  
  if (returnIndex > originalIndex) {
    return { degraded: true, severity: returnIndex - originalIndex };
  }
  
  return { degraded: false, severity: 0 };
};

// Generate library report data
export const generateLibraryReportData = async (schoolId, startDate, endDate) => {
  const where = { schoolId: BigInt(schoolId), deletedAt: null };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [
    books,
    issues,
    returns,
    reservations,
    reviews
  ] = await Promise.all([
    prisma.book.findMany({ where }),
    prisma.bookIssue.findMany({
      where: { ...where, status: { in: ['ISSUED', 'EXTENDED'] } }
    }),
    prisma.bookIssue.findMany({
      where: { ...where, status: 'RETURNED' }
    }),
    prisma.bookReservation.findMany({
      where: { ...where, status: { in: ['PENDING', 'APPROVED'] } }
    }),
    prisma.bookReview.findMany({
      where: { ...where, isApproved: true }
    })
  ]);

  return {
    books,
    issues,
    returns,
    reservations,
    reviews,
    summary: {
      totalBooks: books.length,
      totalIssues: issues.length,
      totalReturns: returns.length,
      totalReservations: reservations.length,
      totalReviews: reviews.length
    }
  };
};
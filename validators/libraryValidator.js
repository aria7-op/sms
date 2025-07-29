import Joi from 'joi';

// Book formats
export const BOOK_FORMATS = [
    'HARDCOVER',
    'PAPERBACK',
    'EBOOK',
    'AUDIOBOOK',
    'MAGAZINE',
    'JOURNAL',
    'NEWSPAPER',
    'OTHER'
];

// Book conditions
export const BOOK_CONDITIONS = [
    'NEW',
    'EXCELLENT',
    'GOOD',
    'FAIR',
    'POOR',
    'DAMAGED'
];

// Book statuses
export const BOOK_STATUSES = [
    'ACTIVE',
    'INACTIVE',
    'MAINTENANCE',
    'LOST',
    'DAMAGED'
];

// Borrowing statuses
export const BORROWING_STATUSES = [
    'BORROWED',
    'RETURNED',
    'OVERDUE',
    'LOST',
    'DAMAGED'
];

// Reservation statuses
export const RESERVATION_STATUSES = [
    'ACTIVE',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED'
];

// Book categories
export const BOOK_CATEGORIES = [
    'FICTION',
    'NON_FICTION',
    'REFERENCE',
    'TEXTBOOK',
    'MAGAZINE',
    'JOURNAL',
    'NEWSPAPER',
    'ENCYCLOPEDIA',
    'DICTIONARY',
    'ATLAS',
    'BIOGRAPHY',
    'AUTOBIOGRAPHY',
    'HISTORY',
    'SCIENCE',
    'TECHNOLOGY',
    'MATHEMATICS',
    'LITERATURE',
    'POETRY',
    'DRAMA',
    'PHILOSOPHY',
    'RELIGION',
    'ART',
    'MUSIC',
    'SPORTS',
    'COOKING',
    'TRAVEL',
    'SELF_HELP',
    'BUSINESS',
    'ECONOMICS',
    'POLITICS',
    'LAW',
    'MEDICINE',
    'EDUCATION',
    'CHILDREN',
    'YOUNG_ADULT',
    'ADULT',
    'OTHER'
];

// Book validation schema
const bookSchema = Joi.object({
    title: Joi.string().min(1).max(500).required(),
    author: Joi.string().min(1).max(200).required(),
    isbn: Joi.string().max(20).optional(),
    publisher: Joi.string().max(200).optional(),
    publicationYear: Joi.number().integer().min(1800).max(new Date().getFullYear() + 1).optional(),
    edition: Joi.string().max(50).optional(),
    language: Joi.string().max(50).optional(),
    category: Joi.string().valid(...BOOK_CATEGORIES).optional(),
    subcategory: Joi.string().max(100).optional(),
    subject: Joi.string().max(100).optional(),
    grade: Joi.string().max(20).optional(),
    description: Joi.string().max(2000).optional(),
    summary: Joi.string().max(1000).optional(),
    keywords: Joi.string().max(500).optional(),
    coverImage: Joi.string().uri().optional(),
    pages: Joi.number().integer().min(1).optional(),
    format: Joi.string().valid(...BOOK_FORMATS).default('HARDCOVER'),
    condition: Joi.string().valid(...BOOK_CONDITIONS).default('NEW'),
    location: Joi.string().max(200).optional(),
    shelfNumber: Joi.string().max(50).optional(),
    rowNumber: Joi.string().max(50).optional(),
    columnNumber: Joi.string().max(50).optional(),
    totalCopies: Joi.number().integer().min(1).default(1),
    availableCopies: Joi.number().integer().min(0).optional(),
    borrowedCopies: Joi.number().integer().min(0).default(0),
    reservedCopies: Joi.number().integer().min(0).default(0),
    lostCopies: Joi.number().integer().min(0).default(0),
    damagedCopies: Joi.number().integer().min(0).default(0),
    price: Joi.number().positive().precision(2).optional(),
    purchaseDate: Joi.date().max('now').optional(),
    purchasePrice: Joi.number().positive().precision(2).optional(),
    supplier: Joi.string().max(200).optional(),
    status: Joi.string().valid(...BOOK_STATUSES).default('ACTIVE'),
    isReference: Joi.boolean().default(false),
    isTextbook: Joi.boolean().default(false),
    isFiction: Joi.boolean().default(false),
    isNonFiction: Joi.boolean().default(false),
    isDigital: Joi.boolean().default(false),
    digitalUrl: Joi.string().uri().optional(),
    rating: Joi.number().min(0).max(5).precision(1).optional(),
    reviewCount: Joi.number().integer().min(0).default(0),
    popularity: Joi.number().integer().min(0).default(0),
    lastBorrowed: Joi.date().max('now').optional(),
    metadata: Joi.object().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    isActive: Joi.boolean().default(true),
    notes: Joi.string().max(1000).optional()
});

// Borrowing validation schema
const borrowingSchema = Joi.object({
    bookId: Joi.number().integer().positive().required(),
    borrowerId: Joi.number().integer().positive().required(),
    librarianId: Joi.number().integer().positive().optional(),
    borrowedDate: Joi.date().max('now').default(new Date()),
    dueDate: Joi.date().greater('now').required(),
    returnDate: Joi.date().optional(),
    status: Joi.string().valid(...BORROWING_STATUSES).default('BORROWED'),
    overdueDays: Joi.number().integer().min(0).default(0),
    fine: Joi.number().positive().precision(2).default(0),
    finePaid: Joi.boolean().default(false),
    finePaidDate: Joi.date().max('now').optional(),
    notes: Joi.string().max(500).optional(),
    metadata: Joi.object().optional()
});

// Reservation validation schema
const reservationSchema = Joi.object({
    bookId: Joi.number().integer().positive().required(),
    reserverId: Joi.number().integer().positive().required(),
    librarianId: Joi.number().integer().positive().optional(),
    reservedDate: Joi.date().max('now').default(new Date()),
    expiryDate: Joi.date().greater('now').required(),
    pickupDate: Joi.date().optional(),
    status: Joi.string().valid(...RESERVATION_STATUSES).default('ACTIVE'),
    priority: Joi.number().integer().min(1).max(10).default(1),
    notes: Joi.string().max(500).optional(),
    metadata: Joi.object().optional()
});

// Attendance validation schema
const attendanceSchema = Joi.object({
    studentId: Joi.number().integer().positive().required(),
    status: Joi.string().valid('PRESENT', 'ABSENT', 'LATE', 'EXCUSED').default('PRESENT'),
    pickupTime: Joi.date().optional(),
    dropoffTime: Joi.date().optional(),
    notes: Joi.string().max(500).optional()
});

// Search validation schema
const searchSchema = Joi.object({
    query: Joi.string().min(1).max(200).required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    category: Joi.string().valid(...BOOK_CATEGORIES).optional(),
    subject: Joi.string().max(100).optional(),
    grade: Joi.string().max(20).optional(),
    available: Joi.boolean().optional(),
    sortBy: Joi.string().valid('relevance', 'title', 'author', 'publicationYear', 'rating', 'popularity').default('relevance'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

// Analytics validation schema
const analyticsSchema = Joi.object({
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    category: Joi.string().valid(...BOOK_CATEGORIES).optional(),
    subject: Joi.string().max(100).optional(),
    grade: Joi.string().max(20).optional(),
    groupBy: Joi.string().valid('day', 'week', 'month', 'year').default('month')
});

// Validation functions
export const validateBook = (data) => {
    const { error, value } = bookSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

export const validateBorrowing = (data) => {
    const { error, value } = borrowingSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

export const validateReservation = (data) => {
    const { error, value } = reservationSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

export const validateAttendance = (data) => {
    const { error, value } = attendanceSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

export const validateSearch = (data) => {
    const { error, value } = searchSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

export const validateAnalytics = (data) => {
    const { error, value } = analyticsSchema.validate(data, {
        abortEarly: false,
        stripUnknown: true
    });

    if (error) {
        const errors = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
        }));

        return {
            success: false,
            error: 'Validation failed',
            details: errors
        };
    }

    return {
        success: true,
        data: value
    };
};

// Business logic validation
export const validateBookAvailability = (book, requestedCopies = 1) => {
    if (!book) {
        return {
            success: false,
            error: 'Book not found',
            message: 'Book not found'
        };
    }

    if (book.availableCopies < requestedCopies) {
        return {
            success: false,
            error: 'Insufficient copies',
            message: `Only ${book.availableCopies} copies available, ${requestedCopies} requested`
        };
    }

    if (book.status !== 'ACTIVE') {
        return {
            success: false,
            error: 'Book not available',
            message: `Book is currently ${book.status.toLowerCase()}`
        };
    }

    return {
        success: true,
        data: book
    };
};

export const validateBorrowingEligibility = (borrower, currentBorrowings, maxBorrowings = 5) => {
    if (!borrower) {
        return {
            success: false,
            error: 'Borrower not found',
            message: 'Borrower not found'
        };
    }

    if (currentBorrowings.length >= maxBorrowings) {
        return {
            success: false,
            error: 'Borrowing limit reached',
            message: `Maximum ${maxBorrowings} books can be borrowed at a time`
        };
    }

    // Check for overdue books
    const overdueBooks = currentBorrowings.filter(borrowing => 
        borrowing.status === 'BORROWED' && new Date(borrowing.dueDate) < new Date()
    );

    if (overdueBooks.length > 0) {
        return {
            success: false,
            error: 'Overdue books',
            message: `You have ${overdueBooks.length} overdue book(s). Please return them before borrowing more.`
        };
    }

    return {
        success: true,
        data: { borrower, currentBorrowings }
    };
};

export const validateReservationEligibility = (reserver, currentReservations, maxReservations = 3) => {
    if (!reserver) {
        return {
            success: false,
            error: 'Reserver not found',
            message: 'Reserver not found'
        };
    }

    if (currentReservations.length >= maxReservations) {
        return {
            success: false,
            error: 'Reservation limit reached',
            message: `Maximum ${maxReservations} books can be reserved at a time`
        };
    }

    return {
        success: true,
        data: { reserver, currentReservations }
    };
};

export const calculateFine = (dueDate, returnDate = new Date()) => {
    const due = new Date(dueDate);
    const returned = new Date(returnDate);
    
    if (returned <= due) {
        return 0;
    }

    const daysOverdue = Math.ceil((returned - due) / (1000 * 60 * 60 * 24));
    const dailyRate = 1; // $1 per day
    return daysOverdue * dailyRate;
};

export const validateReturnData = (borrowing, returnData) => {
    if (!borrowing) {
        return {
            success: false,
            error: 'Borrowing record not found',
            message: 'Borrowing record not found'
        };
    }

    if (borrowing.status === 'RETURNED') {
        return {
            success: false,
            error: 'Already returned',
            message: 'This book has already been returned'
        };
    }

    const returnDate = returnData.returnDate || new Date();
    const fine = calculateFine(borrowing.dueDate, returnDate);

    return {
        success: true,
        data: {
            returnDate,
            fine,
            overdueDays: Math.ceil((returnDate - new Date(borrowing.dueDate)) / (1000 * 60 * 60 * 24))
        }
    };
};
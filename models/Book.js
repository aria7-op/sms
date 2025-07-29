import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class Book {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new book
     */
    async create(data) {
        try {
            const book = await this.prisma.book.create({
                data: {
                    title: data.title,
                    author: data.author,
                    isbn: data.isbn,
                    publisher: data.publisher,
                    publicationYear: data.publicationYear,
                    edition: data.edition,
                    language: data.language,
                    category: data.category,
                    subcategory: data.subcategory,
                    subject: data.subject,
                    grade: data.grade,
                    description: data.description,
                    summary: data.summary,
                    keywords: data.keywords,
                    coverImage: data.coverImage,
                    pages: data.pages,
                    format: data.format || 'HARDCOVER',
                    condition: data.condition || 'NEW',
                    location: data.location,
                    shelfNumber: data.shelfNumber,
                    rowNumber: data.rowNumber,
                    columnNumber: data.columnNumber,
                    totalCopies: data.totalCopies || 1,
                    availableCopies: data.availableCopies || data.totalCopies || 1,
                    borrowedCopies: data.borrowedCopies || 0,
                    reservedCopies: data.reservedCopies || 0,
                    lostCopies: data.lostCopies || 0,
                    damagedCopies: data.damagedCopies || 0,
                    price: data.price,
                    purchaseDate: data.purchaseDate,
                    purchasePrice: data.purchasePrice,
                    supplier: data.supplier,
                    status: data.status || 'ACTIVE',
                    isReference: data.isReference || false,
                    isTextbook: data.isTextbook || false,
                    isFiction: data.isFiction || false,
                    isNonFiction: data.isNonFiction || false,
                    isDigital: data.isDigital || false,
                    digitalUrl: data.digitalUrl,
                    rating: data.rating,
                    reviewCount: data.reviewCount || 0,
                    popularity: data.popularity || 0,
                    lastBorrowed: data.lastBorrowed,
                    metadata: data.metadata,
                    tags: data.tags,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    notes: data.notes,
                    schoolId: data.schoolId,
                    createdBy: data.createdBy,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    creator: true,
                    borrowings: true,
                    reservations: true,
                    reviews: true
                }
            });

            return {
                success: true,
                data: book,
                message: 'Book created successfully'
            };
        } catch (error) {
            console.error('Error creating book:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create book'
            };
        }
    }

    /**
     * Get book by ID with all related data
     */
    async getById(id, includeRelated = true) {
        try {
            const include = includeRelated ? {
                school: true,
                creator: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },
                borrowings: {
                    orderBy: { borrowedDate: 'desc' },
                    take: 10,
                    include: {
                        borrower: {
                            select: {
                                id: true,
                                name: true,
                                grade: true,
                                section: true
                            }
                        }
                    }
                },
                reservations: {
                    orderBy: { reservedDate: 'desc' },
                    take: 5,
                    include: {
                        reserver: {
                            select: {
                                id: true,
                                name: true,
                                grade: true,
                                section: true
                            }
                        }
                    }
                },
                reviews: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        reviewer: {
                            select: {
                                id: true,
                                name: true,
                                grade: true,
                                section: true
                            }
                        }
                    }
                }
            } : {};

            const book = await this.prisma.book.findUnique({
                where: { id: parseInt(id) },
                include
            });

            if (!book) {
                return {
                    success: false,
                    error: 'Book not found',
                    message: 'Book not found'
                };
            }

            return {
                success: true,
                data: book,
                message: 'Book retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting book:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve book'
            };
        }
    }

    /**
     * Get all books with advanced filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                author,
                publisher,
                category,
                subcategory,
                subject,
                grade,
                format,
                condition,
                status,
                isReference,
                isTextbook,
                isFiction,
                isNonFiction,
                isDigital,
                isActive,
                minYear,
                maxYear,
                minPrice,
                maxPrice,
                minRating,
                maxRating,
                available,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Search functionality
            if (search) {
                where.OR = [
                    { title: { contains: search, mode: 'insensitive' } },
                    { author: { contains: search, mode: 'insensitive' } },
                    { isbn: { contains: search, mode: 'insensitive' } },
                    { publisher: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { keywords: { contains: search, mode: 'insensitive' } }
                ];
            }

            // Filter by author
            if (author) {
                where.author = { contains: author, mode: 'insensitive' };
            }

            // Filter by publisher
            if (publisher) {
                where.publisher = { contains: publisher, mode: 'insensitive' };
            }

            // Filter by category
            if (category) {
                where.category = category;
            }

            // Filter by subcategory
            if (subcategory) {
                where.subcategory = subcategory;
            }

            // Filter by subject
            if (subject) {
                where.subject = subject;
            }

            // Filter by grade
            if (grade) {
                where.grade = grade;
            }

            // Filter by format
            if (format) {
                where.format = format;
            }

            // Filter by condition
            if (condition) {
                where.condition = condition;
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by book type
            if (isReference !== undefined) where.isReference = isReference;
            if (isTextbook !== undefined) where.isTextbook = isTextbook;
            if (isFiction !== undefined) where.isFiction = isFiction;
            if (isNonFiction !== undefined) where.isNonFiction = isNonFiction;
            if (isDigital !== undefined) where.isDigital = isDigital;

            // Filter by active status
            if (isActive !== undefined) {
                where.isActive = isActive;
            }

            // Filter by publication year range
            if (minYear || maxYear) {
                where.publicationYear = {};
                if (minYear) where.publicationYear.gte = parseInt(minYear);
                if (maxYear) where.publicationYear.lte = parseInt(maxYear);
            }

            // Filter by price range
            if (minPrice || maxPrice) {
                where.price = {};
                if (minPrice) where.price.gte = parseFloat(minPrice);
                if (maxPrice) where.price.lte = parseFloat(maxPrice);
            }

            // Filter by rating range
            if (minRating || maxRating) {
                where.rating = {};
                if (minRating) where.rating.gte = parseFloat(minRating);
                if (maxRating) where.rating.lte = parseFloat(maxRating);
            }

            // Filter by availability
            if (available !== undefined) {
                if (available) {
                    where.availableCopies = { gt: 0 };
                } else {
                    where.availableCopies = 0;
                }
            }

            const skip = (page - 1) * limit;

            const [books, total] = await Promise.all([
                this.prisma.book.findMany({
                    where,
                    include: {
                        school: true,
                        creator: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        _count: {
                            select: {
                                borrowings: true,
                                reservations: true,
                                reviews: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.book.count({ where })
            ]);

            return {
                success: true,
                data: {
                    books,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Books retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting books:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve books'
            };
        }
    }

    /**
     * Update book
     */
    async update(id, data) {
        try {
            const book = await this.prisma.book.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    school: true,
                    creator: true
                }
            });

            return {
                success: true,
                data: book,
                message: 'Book updated successfully'
            };
        } catch (error) {
            console.error('Error updating book:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update book'
            };
        }
    }

    /**
     * Delete book (soft delete)
     */
    async delete(id) {
        try {
            const book = await this.prisma.book.update({
                where: { id: parseInt(id) },
                data: {
                    isActive: false,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: book,
                message: 'Book deleted successfully'
            };
        } catch (error) {
            console.error('Error deleting book:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to delete book'
            };
        }
    }

    /**
     * Borrow book
     */
    async borrowBook(bookId, borrowerId, borrowData = {}) {
        try {
            const book = await this.prisma.book.findUnique({
                where: { id: parseInt(bookId) }
            });

            if (!book) {
                return {
                    success: false,
                    error: 'Book not found',
                    message: 'Book not found'
                };
            }

            if (book.availableCopies <= 0) {
                return {
                    success: false,
                    error: 'No copies available',
                    message: 'No copies of this book are available for borrowing'
                };
            }

            const borrowing = await this.prisma.bookBorrowing.create({
                data: {
                    bookId: parseInt(bookId),
                    borrowerId: parseInt(borrowerId),
                    borrowedDate: new Date(),
                    dueDate: borrowData.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days default
                    returnDate: null,
                    status: 'BORROWED',
                    notes: borrowData.notes,
                    librarianId: borrowData.librarianId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    book: true,
                    borrower: true,
                    librarian: true
                }
            });

            // Update book availability
            await this.prisma.book.update({
                where: { id: parseInt(bookId) },
                data: {
                    availableCopies: book.availableCopies - 1,
                    borrowedCopies: book.borrowedCopies + 1,
                    lastBorrowed: new Date(),
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: borrowing,
                message: 'Book borrowed successfully'
            };
        } catch (error) {
            console.error('Error borrowing book:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to borrow book'
            };
        }
    }

    /**
     * Return book
     */
    async returnBook(borrowingId, returnData = {}) {
        try {
            const borrowing = await this.prisma.bookBorrowing.findUnique({
                where: { id: parseInt(borrowingId) },
                include: { book: true }
            });

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
                    error: 'Book already returned',
                    message: 'This book has already been returned'
                };
            }

            const returnDate = new Date();
            const dueDate = new Date(borrowing.dueDate);
            const isOverdue = returnDate > dueDate;
            const overdueDays = isOverdue ? Math.ceil((returnDate - dueDate) / (1000 * 60 * 60 * 24)) : 0;

            const updatedBorrowing = await this.prisma.bookBorrowing.update({
                where: { id: parseInt(borrowingId) },
                data: {
                    returnDate: returnDate,
                    status: 'RETURNED',
                    overdueDays: overdueDays,
                    fine: returnData.fine || 0,
                    notes: returnData.notes,
                    updatedAt: new Date()
                },
                include: {
                    book: true,
                    borrower: true,
                    librarian: true
                }
            });

            // Update book availability
            await this.prisma.book.update({
                where: { id: borrowing.bookId },
                data: {
                    availableCopies: borrowing.book.availableCopies + 1,
                    borrowedCopies: borrowing.book.borrowedCopies - 1,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: updatedBorrowing,
                message: 'Book returned successfully'
            };
        } catch (error) {
            console.error('Error returning book:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to return book'
            };
        }
    }

    /**
     * Reserve book
     */
    async reserveBook(bookId, reserverId, reserveData = {}) {
        try {
            const book = await this.prisma.book.findUnique({
                where: { id: parseInt(bookId) }
            });

            if (!book) {
                return {
                    success: false,
                    error: 'Book not found',
                    message: 'Book not found'
                };
            }

            if (book.availableCopies > 0) {
                return {
                    success: false,
                    error: 'Book is available',
                    message: 'This book is currently available and does not need to be reserved'
                };
            }

            const reservation = await this.prisma.bookReservation.create({
                data: {
                    bookId: parseInt(bookId),
                    reserverId: parseInt(reserverId),
                    reservedDate: new Date(),
                    expiryDate: reserveData.expiryDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
                    status: 'ACTIVE',
                    notes: reserveData.notes,
                    librarianId: reserveData.librarianId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    book: true,
                    reserver: true,
                    librarian: true
                }
            });

            // Update book reservation count
            await this.prisma.book.update({
                where: { id: parseInt(bookId) },
                data: {
                    reservedCopies: book.reservedCopies + 1,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: reservation,
                message: 'Book reserved successfully'
            };
        } catch (error) {
            console.error('Error reserving book:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to reserve book'
            };
        }
    }

    /**
     * Get book analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                category,
                subject,
                grade,
                groupBy = 'month'
            } = filters;

            const where = {};
            if (startDate && endDate) {
                where.createdAt = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }
            if (category) where.category = category;
            if (subject) where.subject = subject;
            if (grade) where.grade = grade;

            // Book count by category
            const categoryCounts = await this.prisma.book.groupBy({
                by: ['category'],
                where,
                _count: { category: true },
                _sum: { totalCopies: true, borrowedCopies: true }
            });

            // Book count by subject
            const subjectCounts = await this.prisma.book.groupBy({
                by: ['subject'],
                where,
                _count: { subject: true }
            });

            // Book count by format
            const formatCounts = await this.prisma.book.groupBy({
                by: ['format'],
                where,
                _count: { format: true }
            });

            // Total statistics
            const totalStats = await this.prisma.book.aggregate({
                where,
                _count: true,
                _sum: { totalCopies: true, availableCopies: true, borrowedCopies: true, reservedCopies: true },
                _avg: { rating: true, price: true }
            });

            // Books added over time
            const timeSeriesData = await this.prisma.book.groupBy({
                by: [groupBy === 'month' ? 'createdAt' : 'createdAt'],
                where,
                _count: true
            });

            // Most popular books
            const popularBooks = await this.prisma.book.findMany({
                where,
                orderBy: { popularity: 'desc' },
                take: 10,
                select: {
                    id: true,
                    title: true,
                    author: true,
                    popularity: true,
                    rating: true,
                    borrowedCopies: true
                }
            });

            return {
                success: true,
                data: {
                    categoryCounts,
                    subjectCounts,
                    formatCounts,
                    totalBooks: totalStats._count || 0,
                    totalCopies: totalStats._sum.totalCopies || 0,
                    availableCopies: totalStats._sum.availableCopies || 0,
                    borrowedCopies: totalStats._sum.borrowedCopies || 0,
                    reservedCopies: totalStats._sum.reservedCopies || 0,
                    averageRating: totalStats._avg.rating || 0,
                    averagePrice: totalStats._avg.price || 0,
                    timeSeriesData,
                    popularBooks
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting book analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Search books
     */
    async searchBooks(query, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                category,
                subject,
                grade,
                available,
                sortBy = 'relevance',
                sortOrder = 'desc'
            } = filters;

            const where = {
                OR: [
                    { title: { contains: query, mode: 'insensitive' } },
                    { author: { contains: query, mode: 'insensitive' } },
                    { isbn: { contains: query, mode: 'insensitive' } },
                    { publisher: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { keywords: { contains: query, mode: 'insensitive' } }
                ]
            };

            if (category) where.category = category;
            if (subject) where.subject = subject;
            if (grade) where.grade = grade;
            if (available !== undefined) {
                if (available) {
                    where.availableCopies = { gt: 0 };
                } else {
                    where.availableCopies = 0;
                }
            }

            const skip = (page - 1) * limit;

            const [books, total] = await Promise.all([
                this.prisma.book.findMany({
                    where,
                    include: {
                        _count: {
                            select: {
                                borrowings: true,
                                reservations: true,
                                reviews: true
                            }
                        }
                    },
                    orderBy: sortBy === 'relevance' ? { popularity: 'desc' } : { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.book.count({ where })
            ]);

            return {
                success: true,
                data: {
                    books,
                    query,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Search completed successfully'
            };
        } catch (error) {
            console.error('Error searching books:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to search books'
            };
        }
    }

    /**
     * Get overdue books
     */
    async getOverdueBooks(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                daysOverdue
            } = filters;

            const where = {
                status: 'BORROWED',
                dueDate: {
                    lt: new Date()
                }
            };

            if (daysOverdue) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);
                where.dueDate.lt = cutoffDate;
            }

            const skip = (page - 1) * limit;

            const [borrowings, total] = await Promise.all([
                this.prisma.bookBorrowing.findMany({
                    where,
                    include: {
                        book: true,
                        borrower: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                grade: true,
                                section: true
                            }
                        },
                        librarian: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: { dueDate: 'asc' },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.bookBorrowing.count({ where })
            ]);

            return {
                success: true,
                data: {
                    overdueBooks: borrowings,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Overdue books retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting overdue books:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve overdue books'
            };
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(bookIds, updateData) {
        try {
            const result = await this.prisma.book.updateMany({
                where: {
                    id: { in: bookIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} books`
            };
        } catch (error) {
            console.error('Error bulk updating books:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update books'
            };
        }
    }

    /**
     * Import books from file
     */
    async importFromFile(fileData, schoolId, createdBy) {
        try {
            const bookData = fileData.map(item => ({
                ...item,
                schoolId: parseInt(schoolId),
                createdBy: parseInt(createdBy),
                publicationYear: item.publicationYear ? parseInt(item.publicationYear) : null,
                pages: item.pages ? parseInt(item.pages) : null,
                totalCopies: item.totalCopies ? parseInt(item.totalCopies) : 1,
                availableCopies: item.availableCopies ? parseInt(item.availableCopies) : (item.totalCopies || 1),
                borrowedCopies: item.borrowedCopies ? parseInt(item.borrowedCopies) : 0,
                reservedCopies: item.reservedCopies ? parseInt(item.reservedCopies) : 0,
                lostCopies: item.lostCopies ? parseInt(item.lostCopies) : 0,
                damagedCopies: item.damagedCopies ? parseInt(item.damagedCopies) : 0,
                price: item.price ? parseFloat(item.price) : 0,
                purchasePrice: item.purchasePrice ? parseFloat(item.purchasePrice) : 0,
                rating: item.rating ? parseFloat(item.rating) : 0,
                popularity: item.popularity ? parseInt(item.popularity) : 0,
                purchaseDate: item.purchaseDate ? new Date(item.purchaseDate) : null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            const result = await this.prisma.book.createMany({
                data: bookData,
                skipDuplicates: true
            });

            return {
                success: true,
                data: result,
                message: `Imported ${result.count} books`
            };
        } catch (error) {
            console.error('Error importing books:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to import books'
            };
        }
    }

    /**
     * Export book data
     */
    async exportData(filters = {}) {
        try {
            const books = await this.getAll(filters, { page: 1, limit: 10000 });
            
            if (!books.success) {
                return books;
            }

            const exportData = books.data.books.map(item => ({
                id: item.id,
                title: item.title,
                author: item.author,
                isbn: item.isbn,
                publisher: item.publisher,
                publicationYear: item.publicationYear,
                edition: item.edition,
                language: item.language,
                category: item.category,
                subcategory: item.subcategory,
                subject: item.subject,
                grade: item.grade,
                description: item.description,
                format: item.format,
                condition: item.condition,
                location: item.location,
                shelfNumber: item.shelfNumber,
                totalCopies: item.totalCopies,
                availableCopies: item.availableCopies,
                borrowedCopies: item.borrowedCopies,
                price: item.price,
                rating: item.rating,
                status: item.status,
                createdAt: item.createdAt
            }));

            return {
                success: true,
                data: exportData,
                message: 'Book data exported successfully'
            };
        } catch (error) {
            console.error('Error exporting book data:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to export book data'
            };
        }
    }
}

export default Book;
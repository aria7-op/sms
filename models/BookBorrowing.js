import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class BookBorrowing {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new book borrowing
     */
    async create(data) {
        try {
            const borrowing = await this.prisma.bookBorrowing.create({
                data: {
                    bookId: data.bookId,
                    borrowerId: data.borrowerId,
                    librarianId: data.librarianId,
                    borrowedDate: data.borrowedDate || new Date(),
                    dueDate: data.dueDate,
                    returnDate: data.returnDate,
                    status: data.status || 'BORROWED',
                    overdueDays: data.overdueDays || 0,
                    fine: data.fine || 0,
                    finePaid: data.finePaid || false,
                    finePaidDate: data.finePaidDate,
                    notes: data.notes,
                    metadata: data.metadata,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    book: true,
                    borrower: true,
                    librarian: true
                }
            });

            return {
                success: true,
                data: borrowing,
                message: 'Book borrowing created successfully'
            };
        } catch (error) {
            console.error('Error creating book borrowing:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create book borrowing'
            };
        }
    }

    /**
     * Get borrowing by ID
     */
    async getById(id) {
        try {
            const borrowing = await this.prisma.bookBorrowing.findUnique({
                where: { id: parseInt(id) },
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
                            name: true,
                            email: true
                        }
                    }
                }
            });

            if (!borrowing) {
                return {
                    success: false,
                    error: 'Borrowing record not found',
                    message: 'Borrowing record not found'
                };
            }

            return {
                success: true,
                data: borrowing,
                message: 'Borrowing record retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting borrowing:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve borrowing record'
            };
        }
    }

    /**
     * Get all borrowings with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                bookId,
                borrowerId,
                librarianId,
                status,
                startDate,
                endDate,
                overdue,
                finePaid,
                sortBy = 'borrowedDate',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Filter by book
            if (bookId) {
                where.bookId = parseInt(bookId);
            }

            // Filter by borrower
            if (borrowerId) {
                where.borrowerId = parseInt(borrowerId);
            }

            // Filter by librarian
            if (librarianId) {
                where.librarianId = parseInt(librarianId);
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by date range
            if (startDate || endDate) {
                where.borrowedDate = {};
                if (startDate) where.borrowedDate.gte = new Date(startDate);
                if (endDate) where.borrowedDate.lte = new Date(endDate);
            }

            // Filter by overdue status
            if (overdue !== undefined) {
                if (overdue) {
                    where.AND = [
                        { status: 'BORROWED' },
                        { dueDate: { lt: new Date() } }
                    ];
                } else {
                    where.OR = [
                        { status: 'RETURNED' },
                        { dueDate: { gte: new Date() } }
                    ];
                }
            }

            // Filter by fine paid status
            if (finePaid !== undefined) {
                where.finePaid = finePaid;
            }

            const skip = (page - 1) * limit;

            const [borrowings, total] = await Promise.all([
                this.prisma.bookBorrowing.findMany({
                    where,
                    include: {
                        book: {
                            select: {
                                id: true,
                                title: true,
                                author: true,
                                isbn: true,
                                coverImage: true
                            }
                        },
                        borrower: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
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
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.bookBorrowing.count({ where })
            ]);

            return {
                success: true,
                data: {
                    borrowings,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Borrowings retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting borrowings:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve borrowings'
            };
        }
    }

    /**
     * Update borrowing
     */
    async update(id, data) {
        try {
            const borrowing = await this.prisma.bookBorrowing.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    book: true,
                    borrower: true,
                    librarian: true
                }
            });

            return {
                success: true,
                data: borrowing,
                message: 'Borrowing updated successfully'
            };
        } catch (error) {
            console.error('Error updating borrowing:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update borrowing'
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

            // Calculate fine if overdue
            const dailyFineRate = 1; // $1 per day
            const fine = isOverdue ? overdueDays * dailyFineRate : 0;

            const updatedBorrowing = await this.prisma.bookBorrowing.update({
                where: { id: parseInt(borrowingId) },
                data: {
                    returnDate: returnDate,
                    status: 'RETURNED',
                    overdueDays: overdueDays,
                    fine: fine,
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
     * Pay fine
     */
    async payFine(borrowingId, paymentData = {}) {
        try {
            const borrowing = await this.prisma.bookBorrowing.findUnique({
                where: { id: parseInt(borrowingId) }
            });

            if (!borrowing) {
                return {
                    success: false,
                    error: 'Borrowing record not found',
                    message: 'Borrowing record not found'
                };
            }

            if (borrowing.finePaid) {
                return {
                    success: false,
                    error: 'Fine already paid',
                    message: 'Fine for this borrowing has already been paid'
                };
            }

            const updatedBorrowing = await this.prisma.bookBorrowing.update({
                where: { id: parseInt(borrowingId) },
                data: {
                    finePaid: true,
                    finePaidDate: new Date(),
                    notes: paymentData.notes,
                    updatedAt: new Date()
                },
                include: {
                    book: true,
                    borrower: true,
                    librarian: true
                }
            });

            return {
                success: true,
                data: updatedBorrowing,
                message: 'Fine paid successfully'
            };
        } catch (error) {
            console.error('Error paying fine:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to pay fine'
            };
        }
    }

    /**
     * Get borrower history
     */
    async getBorrowerHistory(borrowerId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                startDate,
                endDate,
                sortBy = 'borrowedDate',
                sortOrder = 'desc'
            } = filters;

            const where = { borrowerId: parseInt(borrowerId) };

            if (status) where.status = status;
            if (startDate || endDate) {
                where.borrowedDate = {};
                if (startDate) where.borrowedDate.gte = new Date(startDate);
                if (endDate) where.borrowedDate.lte = new Date(endDate);
            }

            const skip = (page - 1) * limit;

            const [borrowings, total] = await Promise.all([
                this.prisma.bookBorrowing.findMany({
                    where,
                    include: {
                        book: {
                            select: {
                                id: true,
                                title: true,
                                author: true,
                                isbn: true,
                                coverImage: true,
                                category: true,
                                subject: true
                            }
                        },
                        librarian: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.bookBorrowing.count({ where })
            ]);

            return {
                success: true,
                data: {
                    borrowings,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Borrower history retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting borrower history:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve borrower history'
            };
        }
    }

    /**
     * Get overdue borrowings
     */
    async getOverdueBorrowings(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                daysOverdue,
                sortBy = 'dueDate',
                sortOrder = 'asc'
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
                        book: {
                            select: {
                                id: true,
                                title: true,
                                author: true,
                                isbn: true,
                                coverImage: true
                            }
                        },
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
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.bookBorrowing.count({ where })
            ]);

            return {
                success: true,
                data: {
                    overdueBorrowings: borrowings,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Overdue borrowings retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting overdue borrowings:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve overdue borrowings'
            };
        }
    }

    /**
     * Get borrowing analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                startDate,
                endDate,
                groupBy = 'month'
            } = filters;

            const where = {};
            if (startDate && endDate) {
                where.borrowedDate = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }

            // Borrowing count by status
            const statusCounts = await this.prisma.bookBorrowing.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Borrowing count by month
            const monthlyCounts = await this.prisma.bookBorrowing.groupBy({
                by: [groupBy === 'month' ? 'borrowedDate' : 'borrowedDate'],
                where,
                _count: true
            });

            // Total statistics
            const totalStats = await this.prisma.bookBorrowing.aggregate({
                where,
                _count: true,
                _sum: { fine: true, overdueDays: true },
                _avg: { overdueDays: true }
            });

            // Overdue statistics
            const overdueStats = await this.prisma.bookBorrowing.aggregate({
                where: {
                    ...where,
                    status: 'BORROWED',
                    dueDate: { lt: new Date() }
                },
                _count: true,
                _sum: { fine: true, overdueDays: true }
            });

            // Most borrowed books
            const mostBorrowedBooks = await this.prisma.bookBorrowing.groupBy({
                by: ['bookId'],
                where,
                _count: { bookId: true },
                orderBy: { _count: { bookId: 'desc' } },
                take: 10
            });

            // Most active borrowers
            const mostActiveBorrowers = await this.prisma.bookBorrowing.groupBy({
                by: ['borrowerId'],
                where,
                _count: { borrowerId: true },
                orderBy: { _count: { borrowerId: 'desc' } },
                take: 10
            });

            return {
                success: true,
                data: {
                    statusCounts,
                    monthlyCounts,
                    totalBorrowings: totalStats._count || 0,
                    totalFines: totalStats._sum.fine || 0,
                    totalOverdueDays: totalStats._sum.overdueDays || 0,
                    averageOverdueDays: totalStats._avg.overdueDays || 0,
                    overdueBorrowings: overdueStats._count || 0,
                    overdueFines: overdueStats._sum.fine || 0,
                    mostBorrowedBooks,
                    mostActiveBorrowers
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting borrowing analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Send overdue reminders
     */
    async sendOverdueReminders() {
        try {
            const overdueBorrowings = await this.prisma.bookBorrowing.findMany({
                where: {
                    status: 'BORROWED',
                    dueDate: { lt: new Date() }
                },
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true
                        }
                    },
                    borrower: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true
                        }
                    }
                }
            });

            const reminders = [];
            for (const borrowing of overdueBorrowings) {
                const overdueDays = Math.ceil((new Date() - new Date(borrowing.dueDate)) / (1000 * 60 * 60 * 24));
                
                reminders.push({
                    borrowingId: borrowing.id,
                    borrowerId: borrowing.borrowerId,
                    borrowerName: borrowing.borrower.name,
                    borrowerEmail: borrowing.borrower.email,
                    borrowerPhone: borrowing.borrower.phone,
                    bookTitle: borrowing.book.title,
                    bookAuthor: borrowing.book.author,
                    dueDate: borrowing.dueDate,
                    overdueDays: overdueDays,
                    fine: overdueDays * 1 // $1 per day
                });
            }

            return {
                success: true,
                data: reminders,
                message: `Generated ${reminders.length} overdue reminders`
            };
        } catch (error) {
            console.error('Error sending overdue reminders:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send overdue reminders'
            };
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(borrowingIds, updateData) {
        try {
            const result = await this.prisma.bookBorrowing.updateMany({
                where: {
                    id: { in: borrowingIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} borrowings`
            };
        } catch (error) {
            console.error('Error bulk updating borrowings:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update borrowings'
            };
        }
    }
}

export default BookBorrowing;
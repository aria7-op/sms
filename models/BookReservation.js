import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class BookReservation {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new book reservation
     */
    async create(data) {
        try {
            const reservation = await this.prisma.bookReservation.create({
                data: {
                    bookId: data.bookId,
                    reserverId: data.reserverId,
                    librarianId: data.librarianId,
                    reservedDate: data.reservedDate || new Date(),
                    expiryDate: data.expiryDate,
                    pickupDate: data.pickupDate,
                    status: data.status || 'ACTIVE',
                    priority: data.priority || 1,
                    notes: data.notes,
                    metadata: data.metadata,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    book: true,
                    reserver: true,
                    librarian: true
                }
            });

            return {
                success: true,
                data: reservation,
                message: 'Book reservation created successfully'
            };
        } catch (error) {
            console.error('Error creating book reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create book reservation'
            };
        }
    }

    /**
     * Get reservation by ID
     */
    async getById(id) {
        try {
            const reservation = await this.prisma.bookReservation.findUnique({
                where: { id: parseInt(id) },
                include: {
                    book: true,
                    reserver: {
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

            if (!reservation) {
                return {
                    success: false,
                    error: 'Reservation not found',
                    message: 'Reservation not found'
                };
            }

            return {
                success: true,
                data: reservation,
                message: 'Reservation retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve reservation'
            };
        }
    }

    /**
     * Get all reservations with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                bookId,
                reserverId,
                librarianId,
                status,
                startDate,
                endDate,
                expired,
                sortBy = 'reservedDate',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Filter by book
            if (bookId) {
                where.bookId = parseInt(bookId);
            }

            // Filter by reserver
            if (reserverId) {
                where.reserverId = parseInt(reserverId);
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
                where.reservedDate = {};
                if (startDate) where.reservedDate.gte = new Date(startDate);
                if (endDate) where.reservedDate.lte = new Date(endDate);
            }

            // Filter by expired status
            if (expired !== undefined) {
                if (expired) {
                    where.AND = [
                        { status: 'ACTIVE' },
                        { expiryDate: { lt: new Date() } }
                    ];
                } else {
                    where.OR = [
                        { status: 'COMPLETED' },
                        { status: 'CANCELLED' },
                        { expiryDate: { gte: new Date() } }
                    ];
                }
            }

            const skip = (page - 1) * limit;

            const [reservations, total] = await Promise.all([
                this.prisma.bookReservation.findMany({
                    where,
                    include: {
                        book: {
                            select: {
                                id: true,
                                title: true,
                                author: true,
                                isbn: true,
                                coverImage: true,
                                availableCopies: true
                            }
                        },
                        reserver: {
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
                this.prisma.bookReservation.count({ where })
            ]);

            return {
                success: true,
                data: {
                    reservations,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Reservations retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting reservations:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve reservations'
            };
        }
    }

    /**
     * Update reservation
     */
    async update(id, data) {
        try {
            const reservation = await this.prisma.bookReservation.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    book: true,
                    reserver: true,
                    librarian: true
                }
            });

            return {
                success: true,
                data: reservation,
                message: 'Reservation updated successfully'
            };
        } catch (error) {
            console.error('Error updating reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update reservation'
            };
        }
    }

    /**
     * Cancel reservation
     */
    async cancelReservation(reservationId, cancelData = {}) {
        try {
            const reservation = await this.prisma.bookReservation.findUnique({
                where: { id: parseInt(reservationId) },
                include: { book: true }
            });

            if (!reservation) {
                return {
                    success: false,
                    error: 'Reservation not found',
                    message: 'Reservation not found'
                };
            }

            if (reservation.status !== 'ACTIVE') {
                return {
                    success: false,
                    error: 'Reservation cannot be cancelled',
                    message: 'This reservation cannot be cancelled'
                };
            }

            const updatedReservation = await this.prisma.bookReservation.update({
                where: { id: parseInt(reservationId) },
                data: {
                    status: 'CANCELLED',
                    notes: cancelData.reason,
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
                where: { id: reservation.bookId },
                data: {
                    reservedCopies: reservation.book.reservedCopies - 1,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: updatedReservation,
                message: 'Reservation cancelled successfully'
            };
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to cancel reservation'
            };
        }
    }

    /**
     * Complete reservation (book picked up)
     */
    async completeReservation(reservationId, completeData = {}) {
        try {
            const reservation = await this.prisma.bookReservation.findUnique({
                where: { id: parseInt(reservationId) },
                include: { book: true }
            });

            if (!reservation) {
                return {
                    success: false,
                    error: 'Reservation not found',
                    message: 'Reservation not found'
                };
            }

            if (reservation.status !== 'ACTIVE') {
                return {
                    success: false,
                    error: 'Reservation cannot be completed',
                    message: 'This reservation cannot be completed'
                };
            }

            const updatedReservation = await this.prisma.bookReservation.update({
                where: { id: parseInt(reservationId) },
                data: {
                    status: 'COMPLETED',
                    pickupDate: new Date(),
                    notes: completeData.notes,
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
                where: { id: reservation.bookId },
                data: {
                    reservedCopies: reservation.book.reservedCopies - 1,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: updatedReservation,
                message: 'Reservation completed successfully'
            };
        } catch (error) {
            console.error('Error completing reservation:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to complete reservation'
            };
        }
    }

    /**
     * Get reserver history
     */
    async getReserverHistory(reserverId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                startDate,
                endDate,
                sortBy = 'reservedDate',
                sortOrder = 'desc'
            } = filters;

            const where = { reserverId: parseInt(reserverId) };

            if (status) where.status = status;
            if (startDate || endDate) {
                where.reservedDate = {};
                if (startDate) where.reservedDate.gte = new Date(startDate);
                if (endDate) where.reservedDate.lte = new Date(endDate);
            }

            const skip = (page - 1) * limit;

            const [reservations, total] = await Promise.all([
                this.prisma.bookReservation.findMany({
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
                this.prisma.bookReservation.count({ where })
            ]);

            return {
                success: true,
                data: {
                    reservations,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Reserver history retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting reserver history:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve reserver history'
            };
        }
    }

    /**
     * Get expired reservations
     */
    async getExpiredReservations(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                daysExpired,
                sortBy = 'expiryDate',
                sortOrder = 'asc'
            } = filters;

            const where = {
                status: 'ACTIVE',
                expiryDate: {
                    lt: new Date()
                }
            };

            if (daysExpired) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysExpired);
                where.expiryDate.lt = cutoffDate;
            }

            const skip = (page - 1) * limit;

            const [reservations, total] = await Promise.all([
                this.prisma.bookReservation.findMany({
                    where,
                    include: {
                        book: {
                            select: {
                                id: true,
                                title: true,
                                author: true,
                                isbn: true,
                                coverImage: true,
                                availableCopies: true
                            }
                        },
                        reserver: {
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
                this.prisma.bookReservation.count({ where })
            ]);

            return {
                success: true,
                data: {
                    expiredReservations: reservations,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Expired reservations retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting expired reservations:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve expired reservations'
            };
        }
    }

    /**
     * Get reservation analytics
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
                where.reservedDate = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }

            // Reservation count by status
            const statusCounts = await this.prisma.bookReservation.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Reservation count by month
            const monthlyCounts = await this.prisma.bookReservation.groupBy({
                by: [groupBy === 'month' ? 'reservedDate' : 'reservedDate'],
                where,
                _count: true
            });

            // Total statistics
            const totalStats = await this.prisma.bookReservation.aggregate({
                where,
                _count: true
            });

            // Expired reservations
            const expiredStats = await this.prisma.bookReservation.aggregate({
                where: {
                    ...where,
                    status: 'ACTIVE',
                    expiryDate: { lt: new Date() }
                },
                _count: true
            });

            // Most reserved books
            const mostReservedBooks = await this.prisma.bookReservation.groupBy({
                by: ['bookId'],
                where,
                _count: { bookId: true },
                orderBy: { _count: { bookId: 'desc' } },
                take: 10
            });

            // Most active reservers
            const mostActiveReservers = await this.prisma.bookReservation.groupBy({
                by: ['reserverId'],
                where,
                _count: { reserverId: true },
                orderBy: { _count: { reserverId: 'desc' } },
                take: 10
            });

            return {
                success: true,
                data: {
                    statusCounts,
                    monthlyCounts,
                    totalReservations: totalStats._count || 0,
                    expiredReservations: expiredStats._count || 0,
                    mostReservedBooks,
                    mostActiveReservers
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting reservation analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Send reservation notifications
     */
    async sendReservationNotifications() {
        try {
            const activeReservations = await this.prisma.bookReservation.findMany({
                where: {
                    status: 'ACTIVE',
                    expiryDate: { gte: new Date() }
                },
                include: {
                    book: {
                        select: {
                            id: true,
                            title: true,
                            author: true,
                            availableCopies: true
                        }
                    },
                    reserver: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true
                        }
                    }
                }
            });

            const notifications = [];
            for (const reservation of activeReservations) {
                // Check if book is now available
                if (reservation.book.availableCopies > 0) {
                    notifications.push({
                        type: 'BOOK_AVAILABLE',
                        reservationId: reservation.id,
                        reserverId: reservation.reserverId,
                        reserverName: reservation.reserver.name,
                        reserverEmail: reservation.reserver.email,
                        reserverPhone: reservation.reserver.phone,
                        bookTitle: reservation.book.title,
                        bookAuthor: reservation.book.author,
                        availableCopies: reservation.book.availableCopies,
                        expiryDate: reservation.expiryDate
                    });
                }

                // Check if reservation is expiring soon (within 24 hours)
                const expiryDate = new Date(reservation.expiryDate);
                const now = new Date();
                const hoursUntilExpiry = (expiryDate - now) / (1000 * 60 * 60);

                if (hoursUntilExpiry <= 24 && hoursUntilExpiry > 0) {
                    notifications.push({
                        type: 'RESERVATION_EXPIRING',
                        reservationId: reservation.id,
                        reserverId: reservation.reserverId,
                        reserverName: reservation.reserver.name,
                        reserverEmail: reservation.reserver.email,
                        reserverPhone: reservation.reserver.phone,
                        bookTitle: reservation.book.title,
                        bookAuthor: reservation.book.author,
                        expiryDate: reservation.expiryDate,
                        hoursUntilExpiry: Math.ceil(hoursUntilExpiry)
                    });
                }
            }

            return {
                success: true,
                data: notifications,
                message: `Generated ${notifications.length} reservation notifications`
            };
        } catch (error) {
            console.error('Error sending reservation notifications:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send reservation notifications'
            };
        }
    }

    /**
     * Auto-cancel expired reservations
     */
    async autoCancelExpiredReservations() {
        try {
            const expiredReservations = await this.prisma.bookReservation.findMany({
                where: {
                    status: 'ACTIVE',
                    expiryDate: { lt: new Date() }
                },
                include: { book: true }
            });

            let cancelledCount = 0;
            for (const reservation of expiredReservations) {
                await this.cancelReservation(reservation.id, {
                    reason: 'Automatically cancelled due to expiry'
                });
                cancelledCount++;
            }

            return {
                success: true,
                data: { cancelledCount },
                message: `Auto-cancelled ${cancelledCount} expired reservations`
            };
        } catch (error) {
            console.error('Error auto-cancelling expired reservations:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to auto-cancel expired reservations'
            };
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(reservationIds, updateData) {
        try {
            const result = await this.prisma.bookReservation.updateMany({
                where: {
                    id: { in: reservationIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} reservations`
            };
        } catch (error) {
            console.error('Error bulk updating reservations:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update reservations'
            };
        }
    }
}

export default BookReservation;
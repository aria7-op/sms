import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class HostelResident {
    constructor() {
        this.prisma = prisma;
    }

    /**
     * Create new hostel resident
     */
    async create(data) {
        try {
            const resident = await this.prisma.hostelResident.create({
                data: {
                    roomId: data.roomId,
                    studentId: data.studentId,
                    hostelId: data.hostelId,
                    checkInDate: data.checkInDate || new Date(),
                    checkOutDate: data.checkOutDate,
                    expectedCheckOutDate: data.expectedCheckOutDate,
                    status: data.status || 'ACTIVE',
                    bedNumber: data.bedNumber,
                    emergencyContactName: data.emergencyContactName,
                    emergencyContactPhone: data.emergencyContactPhone,
                    emergencyContactEmail: data.emergencyContactEmail,
                    emergencyContactRelationship: data.emergencyContactRelationship,
                    medicalConditions: data.medicalConditions,
                    allergies: data.allergies,
                    dietaryRestrictions: data.dietaryRestrictions,
                    specialNeeds: data.specialNeeds,
                    guardianName: data.guardianName,
                    guardianPhone: data.guardianPhone,
                    guardianEmail: data.guardianEmail,
                    guardianAddress: data.guardianAddress,
                    paymentMethod: data.paymentMethod || 'MONTHLY',
                    paymentStatus: data.paymentStatus || 'PENDING',
                    monthlyRent: data.monthlyRent,
                    securityDeposit: data.securityDeposit,
                    maintenanceFee: data.maintenanceFee || 0,
                    utilityFee: data.utilityFee || 0,
                    mealFee: data.mealFee || 0,
                    otherFees: data.otherFees || 0,
                    totalMonthlyFee: data.totalMonthlyFee,
                    lastPaymentDate: data.lastPaymentDate,
                    nextPaymentDate: data.nextPaymentDate,
                    outstandingAmount: data.outstandingAmount || 0,
                    lateFees: data.lateFees || 0,
                    mealPlan: data.mealPlan || 'THREE_MEALS',
                    wifiAccess: data.wifiAccess || true,
                    laundryAccess: data.laundryAccess || true,
                    gymAccess: data.gymAccess || false,
                    libraryAccess: data.libraryAccess || true,
                    parkingAccess: data.parkingAccess || false,
                    visitorPolicy: data.visitorPolicy || 'ALLOWED',
                    curfewTime: data.curfewTime,
                    notes: data.notes,
                    metadata: data.metadata,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                include: {
                    room: true,
                    student: true,
                    hostel: true,
                    payments: true,
                    complaints: true,
                    maintenanceRequests: true
                }
            });

            return {
                success: true,
                data: resident,
                message: 'Hostel resident created successfully'
            };
        } catch (error) {
            console.error('Error creating hostel resident:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to create hostel resident'
            };
        }
    }

    /**
     * Get resident by ID
     */
    async getById(id) {
        try {
            const resident = await this.prisma.hostelResident.findUnique({
                where: { id: parseInt(id) },
                include: {
                    room: {
                        include: {
                            hostel: true,
                            floor: true
                        }
                    },
                    student: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            grade: true,
                            section: true,
                            profileImage: true,
                            dateOfBirth: true,
                            gender: true
                        }
                    },
                    hostel: true,
                    payments: {
                        orderBy: { paymentDate: 'desc' },
                        take: 10
                    },
                    complaints: {
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    },
                    maintenanceRequests: {
                        orderBy: { createdAt: 'desc' },
                        take: 5
                    }
                }
            });

            if (!resident) {
                return {
                    success: false,
                    error: 'Resident not found',
                    message: 'Resident not found'
                };
            }

            return {
                success: true,
                data: resident,
                message: 'Resident retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting resident:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve resident'
            };
        }
    }

    /**
     * Get all residents with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                hostelId,
                roomId,
                studentId,
                status,
                paymentStatus,
                mealPlan,
                startDate,
                endDate,
                overdue,
                sortBy = 'checkInDate',
                sortOrder = 'desc'
            } = filters;

            const where = {};

            // Filter by hostel
            if (hostelId) {
                where.hostelId = parseInt(hostelId);
            }

            // Filter by room
            if (roomId) {
                where.roomId = parseInt(roomId);
            }

            // Filter by student
            if (studentId) {
                where.studentId = parseInt(studentId);
            }

            // Filter by status
            if (status) {
                where.status = status;
            }

            // Filter by payment status
            if (paymentStatus) {
                where.paymentStatus = paymentStatus;
            }

            // Filter by meal plan
            if (mealPlan) {
                where.mealPlan = mealPlan;
            }

            // Filter by date range
            if (startDate || endDate) {
                where.checkInDate = {};
                if (startDate) where.checkInDate.gte = new Date(startDate);
                if (endDate) where.checkInDate.lte = new Date(endDate);
            }

            // Filter by overdue payments
            if (overdue !== undefined) {
                if (overdue) {
                    where.AND = [
                        { paymentStatus: 'PENDING' },
                        { nextPaymentDate: { lt: new Date() } }
                    ];
                } else {
                    where.OR = [
                        { paymentStatus: 'PAID' },
                        { nextPaymentDate: { gte: new Date() } }
                    ];
                }
            }

            const skip = (page - 1) * limit;

            const [residents, total] = await Promise.all([
                this.prisma.hostelResident.findMany({
                    where,
                    include: {
                        room: {
                            select: {
                                id: true,
                                roomNumber: true,
                                type: true
                            }
                        },
                        student: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                grade: true,
                                section: true
                            }
                        },
                        hostel: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        },
                        _count: {
                            select: {
                                payments: true,
                                complaints: true,
                                maintenanceRequests: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostelResident.count({ where })
            ]);

            return {
                success: true,
                data: {
                    residents,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Residents retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting residents:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve residents'
            };
        }
    }

    /**
     * Update resident
     */
    async update(id, data) {
        try {
            const resident = await this.prisma.hostelResident.update({
                where: { id: parseInt(id) },
                data: {
                    ...data,
                    updatedAt: new Date()
                },
                include: {
                    room: true,
                    student: true,
                    hostel: true
                }
            });

            return {
                success: true,
                data: resident,
                message: 'Resident updated successfully'
            };
        } catch (error) {
            console.error('Error updating resident:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to update resident'
            };
        }
    }

    /**
     * Check out resident
     */
    async checkOut(id, checkOutData = {}) {
        try {
            const resident = await this.prisma.hostelResident.findUnique({
                where: { id: parseInt(id) },
                include: { room: true }
            });

            if (!resident) {
                return {
                    success: false,
                    error: 'Resident not found',
                    message: 'Resident not found'
                };
            }

            if (resident.status === 'INACTIVE') {
                return {
                    success: false,
                    error: 'Already checked out',
                    message: 'Resident has already checked out'
                };
            }

            const checkOutDate = checkOutData.checkOutDate || new Date();
            const outstandingAmount = checkOutData.outstandingAmount || resident.outstandingAmount;

            const updatedResident = await this.prisma.hostelResident.update({
                where: { id: parseInt(id) },
                data: {
                    checkOutDate: checkOutDate,
                    status: 'INACTIVE',
                    outstandingAmount: outstandingAmount,
                    notes: checkOutData.notes,
                    updatedAt: new Date()
                },
                include: {
                    room: true,
                    student: true,
                    hostel: true
                }
            });

            // Update room capacity
            await this.updateRoomCapacity(resident.roomId);

            return {
                success: true,
                data: updatedResident,
                message: 'Resident checked out successfully'
            };
        } catch (error) {
            console.error('Error checking out resident:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to check out resident'
            };
        }
    }

    /**
     * Extend stay
     */
    async extendStay(id, extensionData) {
        try {
            const resident = await this.prisma.hostelResident.findUnique({
                where: { id: parseInt(id) }
            });

            if (!resident) {
                return {
                    success: false,
                    error: 'Resident not found',
                    message: 'Resident not found'
                };
            }

            if (resident.status !== 'ACTIVE') {
                return {
                    success: false,
                    error: 'Resident not active',
                    message: 'Only active residents can extend their stay'
                };
            }

            const updatedResident = await this.prisma.hostelResident.update({
                where: { id: parseInt(id) },
                data: {
                    expectedCheckOutDate: extensionData.newCheckOutDate,
                    notes: extensionData.notes,
                    updatedAt: new Date()
                },
                include: {
                    room: true,
                    student: true,
                    hostel: true
                }
            });

            return {
                success: true,
                data: updatedResident,
                message: 'Stay extended successfully'
            };
        } catch (error) {
            console.error('Error extending stay:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to extend stay'
            };
        }
    }

    /**
     * Get resident history
     */
    async getResidentHistory(studentId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                startDate,
                endDate,
                sortBy = 'checkInDate',
                sortOrder = 'desc'
            } = filters;

            const where = { studentId: parseInt(studentId) };

            if (status) where.status = status;
            if (startDate || endDate) {
                where.checkInDate = {};
                if (startDate) where.checkInDate.gte = new Date(startDate);
                if (endDate) where.checkInDate.lte = new Date(endDate);
            }

            const skip = (page - 1) * limit;

            const [residents, total] = await Promise.all([
                this.prisma.hostelResident.findMany({
                    where,
                    include: {
                        room: {
                            include: {
                                hostel: true,
                                floor: true
                            }
                        },
                        hostel: true,
                        payments: {
                            orderBy: { paymentDate: 'desc' },
                            take: 5
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostelResident.count({ where })
            ]);

            return {
                success: true,
                data: {
                    residents,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Resident history retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting resident history:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve resident history'
            };
        }
    }

    /**
     * Get overdue residents
     */
    async getOverdueResidents(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                daysOverdue,
                sortBy = 'nextPaymentDate',
                sortOrder = 'asc'
            } = filters;

            const where = {
                paymentStatus: 'PENDING',
                nextPaymentDate: { lt: new Date() }
            };

            if (daysOverdue) {
                const cutoffDate = new Date();
                cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);
                where.nextPaymentDate.lt = cutoffDate;
            }

            const skip = (page - 1) * limit;

            const [residents, total] = await Promise.all([
                this.prisma.hostelResident.findMany({
                    where,
                    include: {
                        room: {
                            select: {
                                id: true,
                                roomNumber: true,
                                type: true
                            }
                        },
                        student: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                                grade: true,
                                section: true
                            }
                        },
                        hostel: {
                            select: {
                                id: true,
                                name: true,
                                code: true
                            }
                        }
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip,
                    take: parseInt(limit)
                }),
                this.prisma.hostelResident.count({ where })
            ]);

            return {
                success: true,
                data: {
                    overdueResidents: residents,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total,
                        pages: Math.ceil(total / limit)
                    }
                },
                message: 'Overdue residents retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting overdue residents:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve overdue residents'
            };
        }
    }

    /**
     * Get resident analytics
     */
    async getAnalytics(filters = {}) {
        try {
            const {
                hostelId,
                startDate,
                endDate,
                groupBy = 'month'
            } = filters;

            const where = {};
            if (hostelId) where.hostelId = parseInt(hostelId);
            if (startDate && endDate) {
                where.checkInDate = {
                    gte: new Date(startDate),
                    lte: new Date(endDate)
                };
            }

            // Resident count by status
            const statusCounts = await this.prisma.hostelResident.groupBy({
                by: ['status'],
                where,
                _count: { status: true }
            });

            // Resident count by payment status
            const paymentStatusCounts = await this.prisma.hostelResident.groupBy({
                by: ['paymentStatus'],
                where,
                _count: { paymentStatus: true }
            });

            // Resident count by meal plan
            const mealPlanCounts = await this.prisma.hostelResident.groupBy({
                by: ['mealPlan'],
                where,
                _count: { mealPlan: true }
            });

            // Total statistics
            const totalStats = await this.prisma.hostelResident.aggregate({
                where,
                _count: true,
                _sum: { 
                    monthlyRent: true,
                    securityDeposit: true,
                    outstandingAmount: true,
                    lateFees: true
                },
                _avg: { monthlyRent: true }
            });

            // Residents added over time
            const timeSeriesData = await this.prisma.hostelResident.groupBy({
                by: [groupBy === 'month' ? 'checkInDate' : 'checkInDate'],
                where,
                _count: true
            });

            // Most expensive residents
            const mostExpensiveResidents = await this.prisma.hostelResident.findMany({
                where,
                orderBy: { monthlyRent: 'desc' },
                take: 10,
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            grade: true,
                            section: true
                        }
                    },
                    hostel: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                select: {
                    id: true,
                    monthlyRent: true,
                    totalMonthlyFee: true,
                    outstandingAmount: true
                }
            });

            return {
                success: true,
                data: {
                    statusCounts,
                    paymentStatusCounts,
                    mealPlanCounts,
                    totalResidents: totalStats._count || 0,
                    totalMonthlyRent: totalStats._sum.monthlyRent || 0,
                    totalSecurityDeposit: totalStats._sum.securityDeposit || 0,
                    totalOutstandingAmount: totalStats._sum.outstandingAmount || 0,
                    totalLateFees: totalStats._sum.lateFees || 0,
                    averageRent: totalStats._avg.monthlyRent || 0,
                    timeSeriesData,
                    mostExpensiveResidents
                },
                message: 'Analytics retrieved successfully'
            };
        } catch (error) {
            console.error('Error getting resident analytics:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to retrieve analytics'
            };
        }
    }

    /**
     * Send payment reminders
     */
    async sendPaymentReminders() {
        try {
            const overdueResidents = await this.prisma.hostelResident.findMany({
                where: {
                    paymentStatus: 'PENDING',
                    nextPaymentDate: { lt: new Date() },
                    status: 'ACTIVE'
                },
                include: {
                    student: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true
                        }
                    },
                    hostel: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    }
                }
            });

            const reminders = [];
            for (const resident of overdueResidents) {
                const daysOverdue = Math.ceil((new Date() - new Date(resident.nextPaymentDate)) / (1000 * 60 * 60 * 24));
                const lateFee = (resident.outstandingAmount * resident.hostel.lateFeePercentage) / 100;
                
                reminders.push({
                    residentId: resident.id,
                    studentId: resident.studentId,
                    studentName: resident.student.name,
                    studentEmail: resident.student.email,
                    studentPhone: resident.student.phone,
                    hostelName: resident.hostel.name,
                    hostelCode: resident.hostel.code,
                    outstandingAmount: resident.outstandingAmount,
                    lateFee: lateFee,
                    daysOverdue: daysOverdue,
                    nextPaymentDate: resident.nextPaymentDate
                });
            }

            return {
                success: true,
                data: reminders,
                message: `Generated ${reminders.length} payment reminders`
            };
        } catch (error) {
            console.error('Error sending payment reminders:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to send payment reminders'
            };
        }
    }

    /**
     * Update room capacity
     */
    async updateRoomCapacity(roomId) {
        try {
            const residents = await this.prisma.hostelResident.findMany({
                where: { 
                    roomId: parseInt(roomId),
                    status: 'ACTIVE'
                }
            });

            const occupiedCapacity = residents.length;

            const room = await this.prisma.hostelRoom.findUnique({
                where: { id: parseInt(roomId) }
            });

            if (room) {
                await this.prisma.hostelRoom.update({
                    where: { id: parseInt(roomId) },
                    data: {
                        occupiedCapacity: occupiedCapacity,
                        availableCapacity: room.capacity - occupiedCapacity,
                        occupiedBeds: occupiedCapacity,
                        availableBeds: room.totalBeds - occupiedCapacity,
                        status: occupiedCapacity >= room.capacity ? 'FULL' : 'AVAILABLE',
                        updatedAt: new Date()
                    }
                });
            }
        } catch (error) {
            console.error('Error updating room capacity:', error);
        }
    }

    /**
     * Bulk operations
     */
    async bulkUpdate(residentIds, updateData) {
        try {
            const result = await this.prisma.hostelResident.updateMany({
                where: {
                    id: { in: residentIds.map(id => parseInt(id)) }
                },
                data: {
                    ...updateData,
                    updatedAt: new Date()
                }
            });

            return {
                success: true,
                data: result,
                message: `Updated ${result.count} residents`
            };
        } catch (error) {
            console.error('Error bulk updating residents:', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to bulk update residents'
            };
        }
    }
}
 
export default HostelResident;
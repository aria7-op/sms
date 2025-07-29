import Hostel from '../models/Hostel';
import HostelRoom from '../models/HostelRoom';
import HostelResident from '../models/HostelResident';
import HostelFloor from '../models/HostelFloor';
import {sendNotification} from '../utils/notifications';
import {generatePDF} from '../utils/pdfGenerator';
import {sendEmail} from '../utils/emailService';
import {calculateLateFees, validateHostelAvailability, validateRoomAvailability} from '../validators/hostelValidator';
import {cacheData, getCachedData, clearCache} from '../cache/cacheManager';
import {createAuditLog} from '../middleware/audit';

class HostelService {
    constructor() {
        this.hostel = new Hostel();
        this.room = new HostelRoom();
        this.resident = new HostelResident();
        this.floor = new HostelFloor();
    }

    /**
     * Create hostel with business logic
     */
    async createHostel(hostelData, userId, schoolId) {
        try {
            // Check if hostel with same name/code already exists
            const existingHostel = await this.hostel.getByCode(hostelData.code, schoolId);
            if (existingHostel.success) {
                return {
                    success: false,
                    error: 'Hostel already exists',
                    message: 'A hostel with this code already exists'
                };
            }

            // Calculate total monthly fee
            const totalMonthlyFee = this.calculateTotalMonthlyFee(hostelData);
            hostelData.totalMonthlyFee = totalMonthlyFee;

            // Create hostel
            const result = await this.hostel.create({
                ...hostelData,
                schoolId,
                createdBy: userId
            });

            if (result.success) {
                // Send notification to admins
                await this.notifyHostelCreation(result.data, schoolId);

                // Create audit log
                await createAuditLog({
                    userId,
                    action: 'CREATE',
                    resource: 'HOSTEL',
                    resourceId: result.data.id,
                    details: `Created hostel: ${result.data.name}`,
                    schoolId
                });

                // Clear cache
                await clearCache('hostel');
            }

            return result;
        } catch (error) {
            console.error('Error in hostel service - createHostel:', error);
            throw error;
        }
    }

    /**
     * Update hostel with business logic
     */
    async updateHostel(id, updateData, userId) {
        try {
            // Get current hostel data
            const currentHostel = await this.hostel.getById(id);
            if (!currentHostel.success) {
                return currentHostel;
            }

            // Check if code is being changed and if it conflicts
            if (updateData.code && updateData.code !== currentHostel.data.code) {
                const existingHostel = await this.hostel.getByCode(updateData.code, currentHostel.data.schoolId);
                if (existingHostel.success) {
                    return {
                        success: false,
                        error: 'Code already exists',
                        message: 'A hostel with this code already exists'
                    };
                }
            }

            // Calculate total monthly fee if fees are being updated
            if (updateData.monthlyRent || updateData.maintenanceFee || updateData.utilityFee || updateData.mealFee) {
                const totalMonthlyFee = this.calculateTotalMonthlyFee({
                    ...currentHostel.data,
                    ...updateData
                });
                updateData.totalMonthlyFee = totalMonthlyFee;
            }

            // Update hostel
            const result = await this.hostel.update(id, updateData);

            if (result.success) {
                // Notify residents if important changes
                if (updateData.monthlyRent || updateData.rules || updateData.policies) {
                    await this.notifyHostelUpdates(result.data, updateData);
                }

                // Create audit log
                await createAuditLog({
                    userId,
                    action: 'UPDATE',
                    resource: 'HOSTEL',
                    resourceId: parseInt(id),
                    details: `Updated hostel: ${result.data.name}`,
                    schoolId: result.data.schoolId
                });

                // Clear cache
                await clearCache('hostel');
            }

            return result;
        } catch (error) {
            console.error('Error in hostel service - updateHostel:', error);
            throw error;
        }
    }

    /**
     * Assign student to room with business logic
     */
    async assignStudentToRoom(roomId, studentId, assignmentData, userId) {
        try {
            // Validate room availability
            const room = await this.room.getById(roomId);
            if (!room.success) {
                return room;
            }

            const roomValidation = validateRoomAvailability(room.data, 1);
            if (!roomValidation.success) {
                return roomValidation;
            }

            // Check if student is already assigned
            const existingResident = await this.resident.getByStudentId(studentId);
            if (existingResident.success && existingResident.data.status === 'ACTIVE') {
                return {
                    success: false,
                    error: 'Student already assigned',
                    message: 'Student is already assigned to another room'
                };
            }

            // Calculate fees
            const fees = this.calculateResidentFees(room.data, assignmentData);

            // Create resident
            const residentData = {
                roomId: parseInt(roomId),
                studentId: parseInt(studentId),
                hostelId: room.data.hostelId,
                checkInDate: assignmentData.checkInDate || new Date(),
                expectedCheckOutDate: assignmentData.expectedCheckOutDate,
                bedNumber: assignmentData.bedNumber,
                monthlyRent: fees.monthlyRent,
                securityDeposit: fees.securityDeposit,
                maintenanceFee: fees.maintenanceFee,
                utilityFee: fees.utilityFee,
                mealFee: fees.mealFee,
                totalMonthlyFee: fees.totalMonthlyFee,
                emergencyContactName: assignmentData.emergencyContactName,
                emergencyContactPhone: assignmentData.emergencyContactPhone,
                emergencyContactEmail: assignmentData.emergencyContactEmail,
                medicalConditions: assignmentData.medicalConditions,
                allergies: assignmentData.allergies,
                notes: assignmentData.notes
            };

            const result = await this.resident.create(residentData);

            if (result.success) {
                // Send welcome notification
                await this.sendWelcomeNotification(result.data);

                // Create audit log
                await createAuditLog({
                    userId,
                    action: 'ASSIGN_ROOM',
                    resource: 'HOSTEL_RESIDENT',
                    resourceId: result.data.id,
                    details: `Assigned student to room ${room.data.roomNumber}`,
                    schoolId: room.data.schoolId
                });

                // Clear cache
                await clearCache('room');
                await clearCache('resident');
            }

            return result;
        } catch (error) {
            console.error('Error in hostel service - assignStudentToRoom:', error);
            throw error;
        }
    }

    /**
     * Check out resident with business logic
     */
    async checkOutResident(residentId, checkOutData, userId) {
        try {
            // Get resident data
            const resident = await this.resident.getById(residentId);
            if (!resident.success) {
                return resident;
            }

            // Calculate outstanding amount and late fees
            const outstandingAmount = checkOutData.outstandingAmount || resident.data.outstandingAmount;
            const lateFees = calculateLateFees(outstandingAmount, resident.data.nextPaymentDate, resident.data.hostel.lateFeePercentage);

            // Update resident
            const updateData = {
                checkOutDate: checkOutData.checkOutDate || new Date(),
                status: 'INACTIVE',
                outstandingAmount: outstandingAmount + lateFees,
                notes: checkOutData.notes
            };

            const result = await this.resident.update(residentId, updateData);

            if (result.success) {
                // Send checkout notification
                await this.sendCheckOutNotification(result.data);

                // Generate checkout report
                const checkoutReport = await this.generateCheckOutReport(result.data);

                // Create audit log
                await createAuditLog({
                    userId,
                    action: 'CHECKOUT',
                    resource: 'HOSTEL_RESIDENT',
                    resourceId: parseInt(residentId),
                    details: `Checked out resident from room ${result.data.room.roomNumber}`,
                    schoolId: result.data.hostel.schoolId
                });

                // Clear cache
                await clearCache('room');
                await clearCache('resident');

                return {
                    ...result,
                    checkoutReport
                };
            }

            return result;
        } catch (error) {
            console.error('Error in hostel service - checkOutResident:', error);
            throw error;
        }
    }

    /**
     * Process payment with business logic
     */
    async processPayment(residentId, paymentData, userId) {
        try {
            // Get resident data
            const resident = await this.resident.getById(residentId);
            if (!resident.success) {
                return resident;
            }

            // Calculate late fees
            const lateFees = calculateLateFees(
                resident.data.outstandingAmount,
                resident.data.nextPaymentDate,
                resident.data.hostel.lateFeePercentage
            );

            // Create payment record
            const payment = {
                residentId: parseInt(residentId),
                amount: paymentData.amount,
                paymentDate: paymentData.paymentDate || new Date(),
                method: paymentData.method,
                transactionId: paymentData.transactionId,
                notes: paymentData.notes
            };

            // Update resident payment status
            const totalPaid = resident.data.totalPaid + paymentData.amount;
            const outstandingAmount = Math.max(0, resident.data.totalMonthlyFee - totalPaid);
            const paymentStatus = outstandingAmount === 0 ? 'PAID' : 'PARTIAL';

            const updateData = {
                outstandingAmount,
                paymentStatus,
                lastPaymentDate: payment.paymentDate,
                nextPaymentDate: this.calculateNextPaymentDate(payment.paymentDate, resident.data.paymentMethod)
            };

            const result = await this.resident.update(residentId, updateData);

            if (result.success) {
                // Send payment confirmation
                await this.sendPaymentConfirmation(result.data, payment);

                // Create audit log
                await createAuditLog({
                    userId,
                    action: 'PAYMENT',
                    resource: 'HOSTEL_RESIDENT',
                    resourceId: parseInt(residentId),
                    details: `Processed payment of ${paymentData.amount}`,
                    schoolId: result.data.hostel.schoolId
                });
            }

            return result;
        } catch (error) {
            console.error('Error in hostel service - processPayment:', error);
            throw error;
        }
    }

    /**
     * Generate comprehensive analytics
     */
    async generateAnalytics(filters = {}) {
        try {
            const cacheKey = `hostel_analytics_${JSON.stringify(filters)}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return cachedData;
            }

            const [hostelAnalytics, roomAnalytics, residentAnalytics, floorAnalytics] = await Promise.all([
                this.hostel.getAnalytics(filters),
                this.room.getAnalytics(filters),
                this.resident.getAnalytics(filters),
                this.floor.getAnalytics(filters)
            ]);

            // Calculate additional metrics
            const additionalMetrics = this.calculateAdditionalMetrics(
                hostelAnalytics.data,
                roomAnalytics.data,
                residentAnalytics.data,
                floorAnalytics.data
            );

            const analytics = {
                success: true,
                data: {
                    hostels: hostelAnalytics.success ? hostelAnalytics.data : {},
                    rooms: roomAnalytics.success ? roomAnalytics.data : {},
                    residents: residentAnalytics.success ? residentAnalytics.data : {},
                    floors: floorAnalytics.success ? floorAnalytics.data : {},
                    additionalMetrics
                },
                message: 'Analytics generated successfully'
            };

            await cacheData(cacheKey, analytics, 600);
            return analytics;
        } catch (error) {
            console.error('Error in hostel service - generateAnalytics:', error);
            throw error;
        }
    }

    /**
     * Send automated notifications
     */
    async sendAutomatedNotifications() {
        try {
            const notifications = [];

            // Payment reminders
            const overdueResidents = await this.resident.getOverdueResidents({ limit: 100 });
            if (overdueResidents.success) {
                for (const resident of overdueResidents.data.overdueResidents) {
                    const notification = await this.sendPaymentReminder(resident);
                    notifications.push(notification);
                }
            }

            // Maintenance reminders
            const maintenanceRooms = await this.room.getAll({ maintenanceStatus: 'SCHEDULED' });
            if (maintenanceRooms.success) {
                for (const room of maintenanceRooms.data.rooms) {
                    const notification = await this.sendMaintenanceReminder(room);
                    notifications.push(notification);
                }
            }

            // Check-in reminders
            const upcomingCheckIns = await this.resident.getAll({ 
                checkInDate: { gte: new Date() },
                status: 'ACTIVE'
            });
            if (upcomingCheckIns.success) {
                for (const resident of upcomingCheckIns.data.residents) {
                    const notification = await this.sendCheckInReminder(resident);
                    notifications.push(notification);
                }
            }

            return {
                success: true,
                data: { notifications },
                message: `Sent ${notifications.length} automated notifications`
            };
        } catch (error) {
            console.error('Error in hostel service - sendAutomatedNotifications:', error);
            throw error;
        }
    }

    /**
     * Generate reports
     */
    async generateReport(reportType, filters = {}) {
        try {
            let reportData;

            switch (reportType) {
                case 'occupancy':
                    reportData = await this.generateOccupancyReport(filters);
                    break;
                case 'financial':
                    reportData = await this.generateFinancialReport(filters);
                    break;
                case 'maintenance':
                    reportData = await this.generateMaintenanceReport(filters);
                    break;
                case 'residents':
                    reportData = await this.generateResidentsReport(filters);
                    break;
                default:
                    return {
                        success: false,
                        error: 'Invalid report type',
                        message: 'Please specify a valid report type'
                    };
            }

            // Generate PDF
            const pdfBuffer = await generatePDF(reportData);

            return {
                success: true,
                data: {
                    report: reportData,
                    pdf: pdfBuffer,
                    filename: `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`
                },
                message: 'Report generated successfully'
            };
        } catch (error) {
            console.error('Error in hostel service - generateReport:', error);
            throw error;
        }
    }

    // Helper methods
    calculateTotalMonthlyFee(hostelData) {
        return (
            (hostelData.monthlyRent || 0) +
            (hostelData.maintenanceFee || 0) +
            (hostelData.utilityFee || 0) +
            (hostelData.mealFee || 0) +
            (hostelData.otherFees || 0)
        );
    }

    calculateResidentFees(room, assignmentData) {
        const hostel = room.hostel;
        return {
            monthlyRent: room.monthlyRent || hostel.monthlyRent || 0,
            securityDeposit: room.securityDeposit || hostel.securityDeposit || 0,
            maintenanceFee: room.maintenanceFee || hostel.maintenanceFee || 0,
            utilityFee: room.utilityFee || hostel.utilityFee || 0,
            mealFee: hostel.mealFee || 0,
            totalMonthlyFee: this.calculateTotalMonthlyFee({
                monthlyRent: room.monthlyRent || hostel.monthlyRent,
                maintenanceFee: room.maintenanceFee || hostel.maintenanceFee,
                utilityFee: room.utilityFee || hostel.utilityFee,
                mealFee: hostel.mealFee,
                otherFees: hostel.otherFees
            })
        };
    }

    calculateNextPaymentDate(lastPaymentDate, paymentMethod) {
        const date = new Date(lastPaymentDate);
        switch (paymentMethod) {
            case 'MONTHLY':
                date.setMonth(date.getMonth() + 1);
                break;
            case 'QUARTERLY':
                date.setMonth(date.getMonth() + 3);
                break;
            case 'SEMESTER':
                date.setMonth(date.getMonth() + 6);
                break;
            case 'ANNUAL':
                date.setFullYear(date.getFullYear() + 1);
                break;
            default:
                date.setMonth(date.getMonth() + 1);
        }
        return date;
    }

    calculateAdditionalMetrics(hostelData, roomData, residentData, floorData) {
        return {
            occupancyRate: hostelData.totalCapacity > 0 ? 
                (hostelData.totalOccupiedCapacity / hostelData.totalCapacity) * 100 : 0,
            revenuePerMonth: residentData.totalMonthlyRent || 0,
            averageRent: residentData.averageRent || 0,
            maintenanceCost: roomData.maintenanceRooms * 100, // Estimated cost
            collectionRate: residentData.totalResidents > 0 ? 
                ((residentData.totalResidents - residentData.overdueResidents) / residentData.totalResidents) * 100 : 0
        };
    }

    // Notification methods
    async notifyHostelCreation(hostel, schoolId) {
        const message = `New hostel "${hostel.name}" has been created. Capacity: ${hostel.capacity}`;
        await sendNotification({
            type: 'CREATION',
            title: 'New Hostel Created',
            message,
            recipients: ['admin', 'manager'],
            schoolId,
            data: { hostelId: hostel.id }
        });
    }

    async notifyHostelUpdates(hostel, updates) {
        const message = `Hostel "${hostel.name}" has been updated. Changes: ${Object.keys(updates).join(', ')}`;
        await sendNotification({
            type: 'UPDATE',
            title: 'Hostel Updated',
            message,
            recipients: ['admin', 'manager'],
            schoolId: hostel.schoolId,
            data: { hostelId: hostel.id, updates }
        });
    }

    async sendWelcomeNotification(resident) {
        const message = `Welcome to ${resident.hostel.name}! Your room is ${resident.room.roomNumber}. Check-in date: ${resident.checkInDate}`;
        await sendNotification({
            type: 'HOSTEL',
            title: 'Welcome to Hostel',
            message,
            recipients: [resident.student.id],
            schoolId: resident.hostel.schoolId,
            data: { residentId: resident.id }
        });
    }

    async sendCheckOutNotification(resident) {
        const message = `Check-out completed for ${resident.student.name}. Outstanding amount: ${resident.outstandingAmount}`;
        await sendNotification({
            type: 'HOSTEL',
            title: 'Check-out Completed',
            message,
            recipients: ['admin', 'manager'],
            schoolId: resident.hostel.schoolId,
            data: { residentId: resident.id }
        });
    }

    async sendPaymentConfirmation(resident, payment) {
        const message = `Payment of ${payment.amount} received for ${resident.student.name}. Outstanding: ${resident.outstandingAmount}`;
        await sendNotification({
            type: 'PAYMENT',
            title: 'Payment Confirmed',
            message,
            recipients: [resident.student.id],
            schoolId: resident.hostel.schoolId,
            data: { residentId: resident.id, payment }
        });
    }

    async sendPaymentReminder(resident) {
        const message = `Payment reminder: ${resident.outstandingAmount} due for ${resident.student.name}`;
        return await sendNotification({
            type: 'REMINDER',
            title: 'Payment Reminder',
            message,
            recipients: [resident.student.id],
            schoolId: resident.hostel.schoolId,
            data: { residentId: resident.id }
        });
    }

    async sendMaintenanceReminder(room) {
        const message = `Maintenance scheduled for room ${room.roomNumber} on ${room.nextMaintenanceDate}`;
        return await sendNotification({
            type: 'REMINDER',
            title: 'Maintenance Reminder',
            message,
            recipients: ['admin', 'manager'],
            schoolId: room.schoolId,
            data: { roomId: room.id }
        });
    }

    async sendCheckInReminder(resident) {
        const message = `Check-in reminder: ${resident.student.name} is scheduled to check in on ${resident.checkInDate}`;
        return await sendNotification({
            type: 'REMINDER',
            title: 'Check-in Reminder',
            message,
            recipients: ['admin', 'manager'],
            schoolId: resident.hostel.schoolId,
            data: { residentId: resident.id }
        });
    }

    // Report generation methods
    async generateOccupancyReport(filters) {
        const analytics = await this.generateAnalytics(filters);
        return {
            title: 'Hostel Occupancy Report',
            data: analytics.data,
            generatedAt: new Date(),
            filters
        };
    }

    async generateFinancialReport(filters) {
        const residents = await this.resident.getAll(filters);
        const financialData = {
            totalRevenue: 0,
            totalOutstanding: 0,
            totalLateFees: 0,
            paymentBreakdown: {}
        };

        if (residents.success) {
            residents.data.residents.forEach(resident => {
                financialData.totalRevenue += resident.totalPaid || 0;
                financialData.totalOutstanding += resident.outstandingAmount || 0;
                financialData.totalLateFees += resident.lateFees || 0;
            });
        }

        return {
            title: 'Financial Report',
            data: financialData,
            generatedAt: new Date(),
            filters
        };
    }

    async generateMaintenanceReport(filters) {
        const rooms = await this.room.getAll({ ...filters, maintenanceStatus: 'SCHEDULED' });
        return {
            title: 'Maintenance Report',
            data: rooms.data,
            generatedAt: new Date(),
            filters
        };
    }

    async generateResidentsReport(filters) {
        const residents = await this.resident.getAll(filters);
        return {
            title: 'Residents Report',
            data: residents.data,
            generatedAt: new Date(),
            filters
        };
    }

    async generateCheckOutReport(resident) {
        return {
            title: 'Check-out Report',
            data: {
                resident: resident,
                checkOutDate: new Date(),
                outstandingAmount: resident.outstandingAmount,
                lateFees: resident.lateFees
            },
            generatedAt: new Date()
        };
    }
}

export default HostelService; 
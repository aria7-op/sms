import Hostel from '../models/Hostel.js';
import HostelRoom from '../models/HostelRoom.js';
import HostelResident from '../models/HostelResident.js';
import HostelFloor from '../models/HostelFloor.js';
import { 
  validateHostel, 
  validateRoom, 
  validateResident, 
  validateFloor 
} from '../validators/hostelValidator.js';
import { 
  uploadToCloudinary, 
  deleteFromCloudinary 
} from '../utils/cloudinary.js';
import { sendNotification } from '../utils/notifications.js';
import { createAuditLog } from '../middleware/audit.js';
import { 
  cacheData, 
  getCachedData, 
  clearCache 
} from '../cache/cacheManager.js';

class HostelController {
    constructor() {
        this.hostel = new Hostel();
        this.room = new HostelRoom();
        this.resident = new HostelResident();
        this.floor = new HostelFloor();
    }

    // Hostel Management
    async createHostel(req, res) {
        try {
            let images = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const uploadResult = await uploadToCloudinary(file.path, 'hostels');
                    images.push(uploadResult.secure_url);
                }
            }

            const hostelData = {
                ...req.body,
                images: images,
                schoolId: req.user.schoolId,
                createdBy: req.user.id
            };

            const result = await this.hostel.create(hostelData);

            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'HOSTEL',
                    resourceId: result.data.id,
                    details: `Created hostel: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('hostel');
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating hostel:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getAllHostels(req, res) {
        try {
            const filters = { ...req.query, schoolId: req.user.schoolId };
            const cacheKey = `hostels_${JSON.stringify(filters)}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return res.json(cachedData);
            }

            const result = await this.hostel.getAll(filters);
            
            if (result.success) {
                await cacheData(cacheKey, result, 180);
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting hostels:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getHostelById(req, res) {
        try {
            const { id } = req.params;
            const includeRelated = req.query.include !== 'false';
            
            const cacheKey = `hostel_${id}_${includeRelated}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return res.json(cachedData);
            }

            const result = await this.hostel.getById(id, includeRelated);
            
            if (result.success) {
                await cacheData(cacheKey, result, 300);
                return res.json(result);
            } else {
                return res.status(404).json(result);
            }
        } catch (error) {
            console.error('Error getting hostel:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async updateHostel(req, res) {
        try {
            const { id } = req.params;
            let images = [];
            
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const uploadResult = await uploadToCloudinary(file.path, 'hostels');
                    images.push(uploadResult.secure_url);
                }
            }

            const updateData = { ...req.body };
            if (images.length > 0) {
                updateData.images = images;
            }

            const result = await this.hostel.update(id, updateData);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    resource: 'HOSTEL',
                    resourceId: parseInt(id),
                    details: `Updated hostel: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('hostel');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error updating hostel:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async deleteHostel(req, res) {
        try {
            const { id } = req.params;
            const result = await this.hostel.delete(id);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    resource: 'HOSTEL',
                    resourceId: parseInt(id),
                    details: `Deleted hostel: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('hostel');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error deleting hostel:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Room Management
    async createRoom(req, res) {
        try {
            let images = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const uploadResult = await uploadToCloudinary(file.path, 'rooms');
                    images.push(uploadResult.secure_url);
                }
            }

            const roomData = {
                ...req.body,
                images: images
            };

            const result = await this.room.create(roomData);

            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'HOSTEL_ROOM',
                    resourceId: result.data.id,
                    details: `Created room: ${result.data.roomNumber}`,
                    ipAddress: req.ip
                });

                await clearCache('room');
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating room:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getAllRooms(req, res) {
        try {
            const filters = { ...req.query };
            const result = await this.room.getAll(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting rooms:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getRoomById(req, res) {
        try {
            const { id } = req.params;
            const result = await this.room.getById(id);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(404).json(result);
            }
        } catch (error) {
            console.error('Error getting room:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async updateRoom(req, res) {
        try {
            const { id } = req.params;
            let images = [];
            
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const uploadResult = await uploadToCloudinary(file.path, 'rooms');
                    images.push(uploadResult.secure_url);
                }
            }

            const updateData = { ...req.body };
            if (images.length > 0) {
                updateData.images = images;
            }

            const result = await this.room.update(id, updateData);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    resource: 'HOSTEL_ROOM',
                    resourceId: parseInt(id),
                    details: `Updated room: ${result.data.roomNumber}`,
                    ipAddress: req.ip
                });

                await clearCache('room');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error updating room:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async deleteRoom(req, res) {
        try {
            const { id } = req.params;
            const result = await this.room.delete(id);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    resource: 'HOSTEL_ROOM',
                    resourceId: parseInt(id),
                    details: `Deleted room: ${result.data.roomNumber}`,
                    ipAddress: req.ip
                });

                await clearCache('room');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error deleting room:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Resident Management
    async createResident(req, res) {
        try {
            const residentData = {
                ...req.body,
                createdBy: req.user.id
            };

            const result = await this.resident.create(residentData);

            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'HOSTEL_RESIDENT',
                    resourceId: result.data.id,
                    details: `Created resident for student: ${result.data.student.name}`,
                    ipAddress: req.ip
                });

                await clearCache('resident');
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating resident:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getAllResidents(req, res) {
        try {
            const filters = { ...req.query };
            const result = await this.resident.getAll(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting residents:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getResidentById(req, res) {
        try {
            const { id } = req.params;
            const result = await this.resident.getById(id);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(404).json(result);
            }
        } catch (error) {
            console.error('Error getting resident:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async updateResident(req, res) {
        try {
            const { id } = req.params;
            const result = await this.resident.update(id, req.body);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    resource: 'HOSTEL_RESIDENT',
                    resourceId: parseInt(id),
                    details: `Updated resident: ${result.data.student.name}`,
                    ipAddress: req.ip
                });

                await clearCache('resident');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error updating resident:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async checkOutResident(req, res) {
        try {
            const { id } = req.params;
            const result = await this.resident.checkOut(id, req.body);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CHECKOUT',
                    resource: 'HOSTEL_RESIDENT',
                    resourceId: parseInt(id),
                    details: `Checked out resident: ${result.data.student.name}`,
                    ipAddress: req.ip
                });

                await clearCache('resident');
                await clearCache('room');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error checking out resident:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async extendStay(req, res) {
        try {
            const { id } = req.params;
            const result = await this.resident.extendStay(id, req.body);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'EXTEND_STAY',
                    resource: 'HOSTEL_RESIDENT',
                    resourceId: parseInt(id),
                    details: `Extended stay for resident: ${result.data.student.name}`,
                    ipAddress: req.ip
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error extending stay:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Floor Management
    async createFloor(req, res) {
        try {
            let images = [];
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const uploadResult = await uploadToCloudinary(file.path, 'floors');
                    images.push(uploadResult.secure_url);
                }
            }

            const floorData = {
                ...req.body,
                images: images
            };

            const result = await this.floor.create(floorData);

            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'HOSTEL_FLOOR',
                    resourceId: result.data.id,
                    details: `Created floor: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('floor');
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating floor:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getAllFloors(req, res) {
        try {
            const filters = { ...req.query };
            const result = await this.floor.getAll(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting floors:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getFloorById(req, res) {
        try {
            const { id } = req.params;
            const result = await this.floor.getById(id);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(404).json(result);
            }
        } catch (error) {
            console.error('Error getting floor:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async updateFloor(req, res) {
        try {
            const { id } = req.params;
            let images = [];
            
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    const uploadResult = await uploadToCloudinary(file.path, 'floors');
                    images.push(uploadResult.secure_url);
                }
            }

            const updateData = { ...req.body };
            if (images.length > 0) {
                updateData.images = images;
            }

            const result = await this.floor.update(id, updateData);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'UPDATE',
                    resource: 'HOSTEL_FLOOR',
                    resourceId: parseInt(id),
                    details: `Updated floor: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('floor');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error updating floor:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async deleteFloor(req, res) {
        try {
            const { id } = req.params;
            const result = await this.floor.delete(id);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'DELETE',
                    resource: 'HOSTEL_FLOOR',
                    resourceId: parseInt(id),
                    details: `Deleted floor: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('floor');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error deleting floor:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Room Assignment
    async assignStudentToRoom(req, res) {
        try {
            const { roomId } = req.params;
            const result = await this.room.assignStudent(roomId, req.body);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'ASSIGN_ROOM',
                    resource: 'HOSTEL_ROOM',
                    resourceId: parseInt(roomId),
                    details: `Assigned student to room`,
                    ipAddress: req.ip
                });

                await clearCache('room');
                await clearCache('resident');
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error assigning student to room:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async removeStudentFromRoom(req, res) {
        try {
            const { roomId, studentId } = req.params;
            const result = await this.room.removeStudent(roomId, studentId, req.body);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'REMOVE_ROOM',
                    resource: 'HOSTEL_ROOM',
                    resourceId: parseInt(roomId),
                    details: `Removed student from room`,
                    ipAddress: req.ip
                });

                await clearCache('room');
                await clearCache('resident');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error removing student from room:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Search and Analytics
    async searchHostels(req, res) {
        try {
            const { query } = req.query;
            const filters = { ...req.query };
            delete filters.query;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Search query is required',
                    message: 'Please provide a search query'
                });
            }

            const result = await this.hostel.searchHostels(query, filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error searching hostels:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async searchRooms(req, res) {
        try {
            const { query } = req.query;
            const filters = { ...req.query };
            delete filters.query;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Search query is required',
                    message: 'Please provide a search query'
                });
            }

            const result = await this.room.searchRooms(query, filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error searching rooms:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getHostelAnalytics(req, res) {
        try {
            const filters = { ...req.query, schoolId: req.user.schoolId };
            const cacheKey = `hostel_analytics_${JSON.stringify(filters)}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return res.json(cachedData);
            }

            const [hostelAnalytics, roomAnalytics, residentAnalytics, floorAnalytics] = await Promise.all([
                this.hostel.getAnalytics(filters),
                this.room.getAnalytics(filters),
                this.resident.getAnalytics(filters),
                this.floor.getAnalytics(filters)
            ]);

            const analytics = {
                success: true,
                data: {
                    hostels: hostelAnalytics.success ? hostelAnalytics.data : {},
                    rooms: roomAnalytics.success ? roomAnalytics.data : {},
                    residents: residentAnalytics.success ? residentAnalytics.data : {},
                    floors: floorAnalytics.success ? floorAnalytics.data : {}
                },
                message: 'Hostel analytics retrieved successfully'
            };

            await cacheData(cacheKey, analytics, 600);
            return res.json(analytics);
        } catch (error) {
            console.error('Error getting hostel analytics:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Available Resources
    async getAvailableHostels(req, res) {
        try {
            const filters = { ...req.query };
            const result = await this.hostel.getAvailableHostels(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting available hostels:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getAvailableRooms(req, res) {
        try {
            const filters = { ...req.query };
            const result = await this.room.getAvailableRooms(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting available rooms:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Resident History
    async getResidentHistory(req, res) {
        try {
            const { studentId } = req.params;
            const filters = { ...req.query };
            const result = await this.resident.getResidentHistory(studentId, filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting resident history:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Overdue Management
    async getOverdueResidents(req, res) {
        try {
            const filters = { ...req.query };
            const result = await this.resident.getOverdueResidents(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting overdue residents:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Notifications and Automation
    async sendPaymentReminders(req, res) {
        try {
            const result = await this.resident.sendPaymentReminders();
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error sending payment reminders:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Dashboard
    async getHostelDashboard(req, res) {
        try {
            const cacheKey = `hostel_dashboard_${req.user.schoolId}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return res.json(cachedData);
            }

            const [availableHostels, availableRooms, overdueResidents, recentResidents, popularHostels] = await Promise.all([
                this.hostel.getAvailableHostels({ limit: 10 }),
                this.room.getAvailableRooms({ limit: 10 }),
                this.resident.getOverdueResidents({ limit: 10 }),
                this.resident.getAll({ limit: 10 }),
                this.hostel.getAll({ sortBy: 'occupiedCapacity', sortOrder: 'desc', limit: 10 })
            ]);

            const dashboard = {
                success: true,
                data: {
                    availableHostels: availableHostels.success ? availableHostels.data.hostels : [],
                    availableRooms: availableRooms.success ? availableRooms.data.rooms : [],
                    overdueResidents: overdueResidents.success ? overdueResidents.data.overdueResidents : [],
                    recentResidents: recentResidents.success ? recentResidents.data.residents : [],
                    popularHostels: popularHostels.success ? popularHostels.data.hostels : []
                },
                message: 'Hostel dashboard retrieved successfully'
            };

            await cacheData(cacheKey, dashboard, 300);
            return res.json(dashboard);
        } catch (error) {
            console.error('Error getting hostel dashboard:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Bulk Operations
    async bulkUpdateHostels(req, res) {
        try {
            const { hostelIds, updateData } = req.body;
            const result = await this.hostel.bulkUpdate(hostelIds, updateData);
            
            if (result.success) {
                await clearCache('hostel');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error bulk updating hostels:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async bulkUpdateRooms(req, res) {
        try {
            const { roomIds, updateData } = req.body;
            const result = await this.room.bulkUpdate(roomIds, updateData);
            
            if (result.success) {
                await clearCache('room');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error bulk updating rooms:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Import/Export
    async importHostels(req, res) {
        try {
            const { fileData } = req.body;
            const result = await this.hostel.importFromFile(fileData, req.user.schoolId, req.user.id);
            
            if (result.success) {
                await clearCache('hostel');
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error importing hostels:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async exportHostels(req, res) {
        try {
            const filters = { ...req.query, schoolId: req.user.schoolId };
            const result = await this.hostel.exportData(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error exporting hostels:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
}

export default HostelController;
import Vehicle from '../models/Vehicle.js';
import TransportRoute from '../models/TransportRoute.js';
import Driver from '../models/Driver.js';
import TransportTrip from '../models/TransportTrip.js';
import transportValidator from '../validators/transportValidator.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../utils/cloudinary.js';
import { sendNotification } from '../utils/notifications.js';
import { createAuditLog } from '../middleware/audit.js';
import { cacheData, getCachedData, clearCache } from '../cache/cacheManager.js';

class TransportController {
    constructor() {
        this.vehicle = new Vehicle();
        this.route = new TransportRoute();
        this.driver = new Driver();
        this.trip = new TransportTrip();
    }

    // Vehicle Management
    async createVehicle(req, res) {
        try {
            let imageUrl = null;
            if (req.file) {
                const uploadResult = await uploadToCloudinary(req.file.path, 'vehicles');
                imageUrl = uploadResult.secure_url;
            }

            const vehicleData = {
                ...req.body,
                imageUrl,
                schoolId: req.user.schoolId,
                createdBy: req.user.id
            };

            const result = await this.vehicle.create(vehicleData);

            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'VEHICLE',
                    resourceId: result.data.id,
                    details: `Created vehicle: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('vehicle');
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating vehicle:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getAllVehicles(req, res) {
        try {
            const filters = { ...req.query, schoolId: req.user.schoolId };
            const cacheKey = `vehicles_${JSON.stringify(filters)}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return res.json(cachedData);
            }

            const result = await this.vehicle.getAll(filters);
            
            if (result.success) {
                await cacheData(cacheKey, result, 180);
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting vehicles:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getVehicleById(req, res) {
        try {
            const { id } = req.params;
            const includeRelated = req.query.include !== 'false';
            
            const cacheKey = `vehicle_${id}_${includeRelated}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return res.json(cachedData);
            }

            const result = await this.vehicle.getById(id, includeRelated);
            
            if (result.success) {
                await cacheData(cacheKey, result, 300);
                return res.json(result);
            } else {
                return res.status(404).json(result);
            }
        } catch (error) {
            console.error('Error getting vehicle:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Driver Management
    async createDriver(req, res) {
        try {
            let imageUrl = null;
            if (req.file) {
                const uploadResult = await uploadToCloudinary(req.file.path, 'drivers');
                imageUrl = uploadResult.secure_url;
            }

            const driverData = {
                ...req.body,
                image: imageUrl,
                schoolId: req.user.schoolId
            };

            const result = await this.driver.create(driverData);

            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'DRIVER',
                    resourceId: result.data.id,
                    details: `Created driver: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('driver');
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating driver:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getAllDrivers(req, res) {
        try {
            const filters = { ...req.query, schoolId: req.user.schoolId };
            const result = await this.driver.getAll(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting drivers:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Route Management
    async createRoute(req, res) {
        try {
            const routeData = {
                ...req.body,
                schoolId: req.user.schoolId
            };

            const result = await this.route.create(routeData);

            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'TRANSPORT_ROUTE',
                    resourceId: result.data.id,
                    details: `Created route: ${result.data.name}`,
                    ipAddress: req.ip
                });

                await clearCache('route');
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getAllRoutes(req, res) {
        try {
            const filters = { ...req.query, schoolId: req.user.schoolId };
            const result = await this.route.getAll(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting routes:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async addStudentToRoute(req, res) {
        try {
            const { routeId } = req.params;
            const result = await this.route.addStudent(routeId, req.body);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'ADD_STUDENT',
                    resource: 'TRANSPORT_ROUTE',
                    resourceId: parseInt(routeId),
                    details: `Added student to route`,
                    ipAddress: req.ip
                });

                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error adding student to route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Trip Management
    async createTrip(req, res) {
        try {
            const tripData = {
                ...req.body,
                schoolId: req.user.schoolId
            };

            const result = await this.trip.create(tripData);

            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'CREATE',
                    resource: 'TRANSPORT_TRIP',
                    resourceId: result.data.id,
                    details: `Created trip: ${result.data.tripNumber}`,
                    ipAddress: req.ip
                });

                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error creating trip:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async startTrip(req, res) {
        try {
            const { id } = req.params;
            const result = await this.trip.startTrip(id, req.body);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'START_TRIP',
                    resource: 'TRANSPORT_TRIP',
                    resourceId: parseInt(id),
                    details: `Started trip`,
                    ipAddress: req.ip
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error starting trip:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async endTrip(req, res) {
        try {
            const { id } = req.params;
            const result = await this.trip.endTrip(id, req.body);
            
            if (result.success) {
                await createAuditLog({
                    userId: req.user.id,
                    action: 'END_TRIP',
                    resource: 'TRANSPORT_TRIP',
                    resourceId: parseInt(id),
                    details: `Ended trip`,
                    ipAddress: req.ip
                });

                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error ending trip:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async markAttendance(req, res) {
        try {
            const { tripId } = req.params;
            const result = await this.trip.markAttendance(tripId, req.body);
            
            if (result.success) {
                return res.status(201).json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error marking attendance:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Analytics & Reporting
    async getTransportAnalytics(req, res) {
        try {
            const filters = { ...req.query, schoolId: req.user.schoolId };
            const cacheKey = `transport_analytics_${JSON.stringify(filters)}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return res.json(cachedData);
            }

            const [vehicleAnalytics, routeAnalytics, tripAnalytics] = await Promise.all([
                this.vehicle.getAnalytics(filters),
                this.route.getAnalytics(filters),
                this.trip.getAnalytics(filters)
            ]);

            const analytics = {
                success: true,
                data: {
                    vehicles: vehicleAnalytics.success ? vehicleAnalytics.data : {},
                    routes: routeAnalytics.success ? routeAnalytics.data : {},
                    trips: tripAnalytics.success ? tripAnalytics.data : {}
                },
                message: 'Transport analytics retrieved successfully'
            };

            await cacheData(cacheKey, analytics, 600);
            return res.json(analytics);
        } catch (error) {
            console.error('Error getting transport analytics:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getTodayTrips(req, res) {
        try {
            const filters = { ...req.query, schoolId: req.user.schoolId };
            const result = await this.trip.getTodayTrips(filters);
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting today\'s trips:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    async getUpcomingTrips(req, res) {
        try {
            const { hours = 24 } = req.query;
            const result = await this.trip.getUpcomingTrips(parseInt(hours));
            
            if (result.success) {
                return res.json(result);
            } else {
                return res.status(400).json(result);
            }
        } catch (error) {
            console.error('Error getting upcoming trips:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }

    // Dashboard
    async getTransportDashboard(req, res) {
        try {
            const cacheKey = `transport_dashboard_${req.user.schoolId}`;
            const cachedData = await getCachedData(cacheKey);
            
            if (cachedData) {
                return res.json(cachedData);
            }

            const [availableVehicles, availableDrivers, availableRoutes, todayTrips, expiringLicenses, expiringDocuments] = await Promise.all([
                this.vehicle.getAvailableVehicles(),
                this.driver.getAvailableDrivers(),
                this.route.getAvailableRoutes(),
                this.trip.getTodayTrips(),
                this.driver.getExpiringLicenses(),
                this.vehicle.getExpiringDocuments()
            ]);

            const dashboard = {
                success: true,
                data: {
                    availableVehicles: availableVehicles.success ? availableVehicles.data : [],
                    availableDrivers: availableDrivers.success ? availableDrivers.data : [],
                    availableRoutes: availableRoutes.success ? availableRoutes.data : [],
                    todayTrips: todayTrips.success ? todayTrips.data : [],
                    expiringLicenses: expiringLicenses.success ? expiringLicenses.data : [],
                    expiringDocuments: expiringDocuments.success ? expiringDocuments.data : []
                },
                message: 'Transport dashboard retrieved successfully'
            };

            await cacheData(cacheKey, dashboard, 300);
            return res.json(dashboard);
        } catch (error) {
            console.error('Error getting transport dashboard:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
}

export default TransportController; 
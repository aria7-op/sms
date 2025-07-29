import express from 'express';
const router = express.Router();
import TransportController from '../controllers/transportController.js';
import {authenticate, authorize} from '../middleware/auth.js';
import {rateLimit} from '../middleware/rateLimit.js';
import {upload} from '../middleware/upload.js';
import {createAuditLog} from '../middleware/audit.js';

const transportController = new TransportController();

// Rate limiting
const transportRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many transport requests from this IP, please try again later.'
});

// Apply rate limiting to all transport routes
router.use(transportRateLimit);

// Vehicle Routes
/**
 * @route   POST /api/transport/vehicles
 * @desc    Create new vehicle
 * @access  Private (Admin, Transport Manager)
 */
router.post('/vehicles',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    upload.single('image'),
    async (req, res) => {
        try {
            const result = await transportController.createVehicle(req, res);
            return result;
        } catch (error) {
            console.error('Error in vehicle creation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/vehicles
 * @desc    Get all vehicles with filtering
 * @access  Private (All authenticated users)
 */
router.get('/vehicles',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getAllVehicles(req, res);
            return result;
        } catch (error) {
            console.error('Error in get all vehicles route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/vehicles/:id
 * @desc    Get vehicle by ID
 * @access  Private (All authenticated users)
 */
router.get('/vehicles/:id',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getVehicleById(req, res);
            return result;
        } catch (error) {
            console.error('Error in get vehicle by ID route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Driver Routes
/**
 * @route   POST /api/transport/drivers
 * @desc    Create new driver
 * @access  Private (Admin, Transport Manager)
 */
router.post('/drivers',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    upload.single('image'),
    async (req, res) => {
        try {
            const result = await transportController.createDriver(req, res);
            return result;
        } catch (error) {
            console.error('Error in driver creation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/drivers
 * @desc    Get all drivers with filtering
 * @access  Private (All authenticated users)
 */
router.get('/drivers',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getAllDrivers(req, res);
            return result;
        } catch (error) {
            console.error('Error in get all drivers route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/drivers/:id
 * @desc    Get driver by ID
 * @access  Private (All authenticated users)
 */
router.get('/drivers/:id',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getDriverById(req, res);
            return result;
        } catch (error) {
            console.error('Error in get driver by ID route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Route Routes
/**
 * @route   POST /api/transport/routes
 * @desc    Create new transport route
 * @access  Private (Admin, Transport Manager)
 */
router.post('/routes',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.createRoute(req, res);
            return result;
        } catch (error) {
            console.error('Error in route creation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/routes
 * @desc    Get all routes with filtering
 * @access  Private (All authenticated users)
 */
router.get('/routes',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getAllRoutes(req, res);
            return result;
        } catch (error) {
            console.error('Error in get all routes route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/routes/:id
 * @desc    Get route by ID
 * @access  Private (All authenticated users)
 */
router.get('/routes/:id',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getRouteById(req, res);
            return result;
        } catch (error) {
            console.error('Error in get route by ID route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/transport/routes/:routeId/students
 * @desc    Add student to route
 * @access  Private (Admin, Transport Manager, Teacher)
 */
router.post('/routes/:routeId/students',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER', 'TEACHER']),
    async (req, res) => {
        try {
            const result = await transportController.addStudentToRoute(req, res);
            return result;
        } catch (error) {
            console.error('Error in add student to route route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Trip Routes
/**
 * @route   POST /api/transport/trips
 * @desc    Create new transport trip
 * @access  Private (Admin, Transport Manager)
 */
router.post('/trips',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.createTrip(req, res);
            return result;
        } catch (error) {
            console.error('Error in trip creation route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/trips
 * @desc    Get all trips with filtering
 * @access  Private (All authenticated users)
 */
router.get('/trips',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getAllTrips(req, res);
            return result;
        } catch (error) {
            console.error('Error in get all trips route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/trips/:id
 * @desc    Get trip by ID
 * @access  Private (All authenticated users)
 */
router.get('/trips/:id',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getTripById(req, res);
            return result;
        } catch (error) {
            console.error('Error in get trip by ID route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/transport/trips/:id/start
 * @desc    Start trip
 * @access  Private (Admin, Transport Manager, Driver)
 */
router.post('/trips/:id/start',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER', 'DRIVER']),
    async (req, res) => {
        try {
            const result = await transportController.startTrip(req, res);
            return result;
        } catch (error) {
            console.error('Error in start trip route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/transport/trips/:id/end
 * @desc    End trip
 * @access  Private (Admin, Transport Manager, Driver)
 */
router.post('/trips/:id/end',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER', 'DRIVER']),
    async (req, res) => {
        try {
            const result = await transportController.endTrip(req, res);
            return result;
        } catch (error) {
            console.error('Error in end trip route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/transport/trips/:tripId/attendance
 * @desc    Mark student attendance for trip
 * @access  Private (Admin, Transport Manager, Driver, Conductor)
 */
router.post('/trips/:tripId/attendance',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER', 'DRIVER', 'CONDUCTOR']),
    async (req, res) => {
        try {
            const result = await transportController.markAttendance(req, res);
            return result;
        } catch (error) {
            console.error('Error in mark attendance route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/trips/:tripId/attendance
 * @desc    Get trip attendance
 * @access  Private (All authenticated users)
 */
router.get('/trips/:tripId/attendance',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getTripAttendance(req, res);
            return result;
        } catch (error) {
            console.error('Error in get trip attendance route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Analytics & Reporting Routes
/**
 * @route   GET /api/transport/analytics
 * @desc    Get transport analytics
 * @access  Private (Admin, Transport Manager)
 */
router.get('/analytics',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.getTransportAnalytics(req, res);
            return result;
        } catch (error) {
            console.error('Error in transport analytics route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/trips/today
 * @desc    Get today's trips
 * @access  Private (All authenticated users)
 */
router.get('/trips/today',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getTodayTrips(req, res);
            return result;
        } catch (error) {
            console.error('Error in today\'s trips route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/trips/upcoming
 * @desc    Get upcoming trips
 * @access  Private (All authenticated users)
 */
router.get('/trips/upcoming',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getUpcomingTrips(req, res);
            return result;
        } catch (error) {
            console.error('Error in upcoming trips route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Dashboard Routes
/**
 * @route   GET /api/transport/dashboard
 * @desc    Get transport dashboard
 * @access  Private (Admin, Transport Manager)
 */
router.get('/dashboard',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.getTransportDashboard(req, res);
            return result;
        } catch (error) {
            console.error('Error in transport dashboard route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Additional Vehicle Routes
/**
 * @route   PUT /api/transport/vehicles/:id
 * @desc    Update vehicle
 * @access  Private (Admin, Transport Manager)
 */
router.put('/vehicles/:id',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    upload.single('image'),
    async (req, res) => {
        try {
            const result = await transportController.updateVehicle(req, res);
            return result;
        } catch (error) {
            console.error('Error in update vehicle route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   DELETE /api/transport/vehicles/:id
 * @desc    Delete vehicle
 * @access  Private (Admin, Transport Manager)
 */
router.delete('/vehicles/:id',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.deleteVehicle(req, res);
            return result;
        } catch (error) {
            console.error('Error in delete vehicle route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   POST /api/transport/vehicles/:id/assign-driver
 * @desc    Assign driver to vehicle
 * @access  Private (Admin, Transport Manager)
 */
router.post('/vehicles/:id/assign-driver',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.assignDriverToVehicle(req, res);
            return result;
        } catch (error) {
            console.error('Error in assign driver to vehicle route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Additional Driver Routes
/**
 * @route   PUT /api/transport/drivers/:id
 * @desc    Update driver
 * @access  Private (Admin, Transport Manager)
 */
router.put('/drivers/:id',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    upload.single('image'),
    async (req, res) => {
        try {
            const result = await transportController.updateDriver(req, res);
            return result;
        } catch (error) {
            console.error('Error in update driver route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   DELETE /api/transport/drivers/:id
 * @desc    Delete driver
 * @access  Private (Admin, Transport Manager)
 */
router.delete('/drivers/:id',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.deleteDriver(req, res);
            return result;
        } catch (error) {
            console.error('Error in delete driver route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/drivers/:id/performance
 * @desc    Get driver performance analytics
 * @access  Private (Admin, Transport Manager)
 */
router.get('/drivers/:id/performance',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.getDriverPerformance(req, res);
            return result;
        } catch (error) {
            console.error('Error in driver performance route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/drivers/:id/schedule
 * @desc    Get driver schedule
 * @access  Private (Admin, Transport Manager, Driver)
 */
router.get('/drivers/:id/schedule',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER', 'DRIVER']),
    async (req, res) => {
        try {
            const result = await transportController.getDriverSchedule(req, res);
            return result;
        } catch (error) {
            console.error('Error in driver schedule route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

// Additional Route Routes
/**
 * @route   PUT /api/transport/routes/:id
 * @desc    Update route
 * @access  Private (Admin, Transport Manager)
 */
router.put('/routes/:id',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.updateRoute(req, res);
            return result;
        } catch (error) {
            console.error('Error in update route route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   DELETE /api/transport/routes/:id
 * @desc    Delete route
 * @access  Private (Admin, Transport Manager)
 */
router.delete('/routes/:id',
    authenticate,
    authorize(['ADMIN', 'TRANSPORT_MANAGER']),
    async (req, res) => {
        try {
            const result = await transportController.deleteRoute(req, res);
            return result;
        } catch (error) {
            console.error('Error in delete route route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

/**
 * @route   GET /api/transport/routes/:id/schedule
 * @desc    Get route schedule
 * @access  Private (All authenticated users)
 */
router.get('/routes/:id/schedule',
    authenticate,
    async (req, res) => {
        try {
            const result = await transportController.getRouteSchedule(req, res);
            return result;
        } catch (error) {
            console.error('Error in route schedule route:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: 'Internal server error'
            });
        }
    }
);

export default router; 
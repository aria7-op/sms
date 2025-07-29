import express from 'express';
import HostelController from '../controllers/hostelController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { 
  validateHostel, 
  validateRoom, 
  validateResident, 
  validateFloor, 
  validateSearch, 
  validateAnalytics 
} from '../validators/hostelValidator.js';
import { upload } from '../middleware/upload.js';
import { rateLimit } from '../middleware/rateLimit.js';

const router = express.Router();
const hostelController = new HostelController();

// Your routes would go here...



// Apply rate limiting to all routes
router.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
}));

// Apply authentication to all routes
router.use(authenticateToken);

// Hostel Management Routes
router.post('/hostels', 
    authorizeRoles(['admin', 'manager']),
    upload.array('images', 10),
    async (req, res) => {
        const validation = validateHostel(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.createHostel(req, res);
    }
);

router.get('/hostels',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getAllHostels(req, res);
    }
);

router.get('/hostels/search',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        const validation = validateSearch(req.query);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.searchHostels(req, res);
    }
);

router.get('/hostels/available',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getAvailableHostels(req, res);
    }
);

router.get('/hostels/:id',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getHostelById(req, res);
    }
);

router.put('/hostels/:id',
    authorizeRoles(['admin', 'manager']),
    upload.array('images', 10),
    async (req, res) => {
        const validation = validateHostel(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.updateHostel(req, res);
    }
);

router.delete('/hostels/:id',
    authorizeRoles(['admin']),
    async (req, res) => {
        await hostelController.deleteHostel(req, res);
    }
);

// Room Management Routes
router.post('/rooms',
    authorizeRoles(['admin', 'manager']),
    upload.array('images', 10),
    async (req, res) => {
        const validation = validateRoom(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.createRoom(req, res);
    }
);

router.get('/rooms',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getAllRooms(req, res);
    }
);

router.get('/rooms/search',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        const validation = validateSearch(req.query);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.searchRooms(req, res);
    }
);

router.get('/rooms/available',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getAvailableRooms(req, res);
    }
);

router.get('/rooms/:id',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getRoomById(req, res);
    }
);

router.put('/rooms/:id',
    authorizeRoles(['admin', 'manager']),
    upload.array('images', 10),
    async (req, res) => {
        const validation = validateRoom(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.updateRoom(req, res);
    }
);

router.delete('/rooms/:id',
    authorizeRoles(['admin']),
    async (req, res) => {
        await hostelController.deleteRoom(req, res);
    }
);

// Room Assignment Routes
router.post('/rooms/:roomId/assign',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        const validation = validateResident(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.assignStudentToRoom(req, res);
    }
);

router.delete('/rooms/:roomId/remove/:studentId',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        await hostelController.removeStudentFromRoom(req, res);
    }
);

// Resident Management Routes
router.post('/residents',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        const validation = validateResident(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.createResident(req, res);
    }
);

router.get('/residents',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getAllResidents(req, res);
    }
);

router.get('/residents/overdue',
    authorizeRoles(['admin', 'manager', 'staff']),
    async (req, res) => {
        await hostelController.getOverdueResidents(req, res);
    }
);

router.get('/residents/:id',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getResidentById(req, res);
    }
);

router.put('/residents/:id',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        const validation = validateResident(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.updateResident(req, res);
    }
);

router.post('/residents/:id/checkout',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        await hostelController.checkOutResident(req, res);
    }
);

router.post('/residents/:id/extend',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        await hostelController.extendStay(req, res);
    }
);

router.get('/residents/student/:studentId/history',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getResidentHistory(req, res);
    }
);

// Floor Management Routes
router.post('/floors',
    authorizeRoles(['admin', 'manager']),
    upload.array('images', 10),
    async (req, res) => {
        const validation = validateFloor(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.createFloor(req, res);
    }
);

router.get('/floors',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getAllFloors(req, res);
    }
);

router.get('/floors/:id',
    authorizeRoles(['admin', 'manager', 'staff', 'teacher']),
    async (req, res) => {
        await hostelController.getFloorById(req, res);
    }
);

router.put('/floors/:id',
    authorizeRoles(['admin', 'manager']),
    upload.array('images', 10),
    async (req, res) => {
        const validation = validateFloor(req.body);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.updateFloor(req, res);
    }
);

router.delete('/floors/:id',
    authorizeRoles(['admin']),
    async (req, res) => {
        await hostelController.deleteFloor(req, res);
    }
);

// Analytics and Reporting Routes
router.get('/analytics',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        const validation = validateAnalytics(req.query);
        if (!validation.success) {
            return res.status(400).json(validation);
        }
        await hostelController.getHostelAnalytics(req, res);
    }
);

router.get('/dashboard',
    authorizeRoles(['admin', 'manager', 'staff']),
    async (req, res) => {
        await hostelController.getHostelDashboard(req, res);
    }
);

// Notifications and Automation Routes
router.post('/notifications/payment-reminders',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        await hostelController.sendPaymentReminders(req, res);
    }
);

// Bulk Operations Routes
router.post('/bulk/hostels',
    authorizeRoles(['admin']),
    async (req, res) => {
        await hostelController.bulkUpdateHostels(req, res);
    }
);

router.post('/bulk/rooms',
    authorizeRoles(['admin']),
    async (req, res) => {
        await hostelController.bulkUpdateRooms(req, res);
    }
);

// Import/Export Routes
router.post('/import',
    authorizeRoles(['admin']),
    async (req, res) => {
        await hostelController.importHostels(req, res);
    }
);

router.get('/export',
    authorizeRoles(['admin', 'manager']),
    async (req, res) => {
        await hostelController.exportHostels(req, res);
    }
);

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Hostel route error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
    });
});

export default router;
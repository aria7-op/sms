import { Router } from 'express';
import { InstallmentController } from '../controllers/installmentController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { generalLimiter } from '../middleware/rateLimit.js';

const router = Router();
const installmentController = new InstallmentController();

// Apply middleware to all routes
router.use(generalLimiter);
router.use(authenticateToken);

// Installment CRUD Operations
router.post('/', 
  authorizeRoles(['ADMIN', 'OWNER']),
  installmentController.createInstallment.bind(installmentController)
);

router.get('/', 
  authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
  installmentController.getAllInstallments.bind(installmentController)
);

router.get('/:id', 
  authorizeRoles(['ADMIN', 'OWNER', 'TEACHER', 'STUDENT', 'PARENT']),
  installmentController.getInstallmentById.bind(installmentController)
);

router.put('/:id', 
  authorizeRoles(['ADMIN', 'OWNER']),
  installmentController.updateInstallment.bind(installmentController)
);

router.delete('/:id', 
  authorizeRoles(['ADMIN', 'OWNER']),
  installmentController.deleteInstallment.bind(installmentController)
);

// Payment Status Operations
router.patch('/:id/pay', 
  authorizeRoles(['ADMIN', 'OWNER']),
  installmentController.markAsPaid.bind(installmentController)
);

router.patch('/:id/overdue', 
  authorizeRoles(['ADMIN', 'OWNER']),
  installmentController.markAsOverdue.bind(installmentController)
);

// Payment-related Installments
router.get('/payment/:paymentId', 
  authorizeRoles(['ADMIN', 'OWNER', 'TEACHER', 'STUDENT', 'PARENT']),
  installmentController.getInstallmentsByPayment.bind(installmentController)
);

// Bulk Operations
router.post('/bulk/create', 
  authorizeRoles(['ADMIN', 'OWNER']),
  installmentController.bulkCreateInstallments.bind(installmentController)
);

// Search and Filtering
router.get('/search/:searchTerm', 
  authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
  installmentController.searchInstallments.bind(installmentController)
);

// Dashboard and Reporting
router.get('/statistics', 
  authorizeRoles(['ADMIN', 'OWNER']),
  installmentController.getInstallmentStatistics.bind(installmentController)
);

router.get('/dashboard/summary', 
  authorizeRoles(['ADMIN', 'OWNER']),
  installmentController.getDashboardSummary.bind(installmentController)
);

// Specialized Queries
router.get('/overdue', 
  authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
  installmentController.getOverdueInstallments.bind(installmentController)
);

router.get('/upcoming', 
  authorizeRoles(['ADMIN', 'OWNER', 'TEACHER']),
  installmentController.getUpcomingInstallments.bind(installmentController)
);

export default router;
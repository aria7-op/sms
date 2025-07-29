import express from 'express';
import pbacController from '../controllers/pbacController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ======================
// POLICY MANAGEMENT ROUTES
// ======================

router.post('/policies', authenticateToken, authorizeRoles(['ADMIN']), pbacController.createPolicy);
router.get('/policies', authenticateToken, pbacController.getAllPolicies);
router.get('/policies/:id', authenticateToken, pbacController.getPolicyById);
router.put('/policies/:id', authenticateToken, authorizeRoles(['ADMIN']), pbacController.updatePolicy);
router.delete('/policies/:id', authenticateToken, authorizeRoles(['ADMIN']), pbacController.deletePolicy);

// ======================
// POLICY ASSIGNMENT ROUTES
// ======================

router.post('/assignments', authenticateToken, authorizeRoles(['ADMIN']), pbacController.assignPolicy);
router.get('/assignments', authenticateToken, pbacController.getPolicyAssignments);
router.delete('/assignments/:id', authenticateToken, authorizeRoles(['ADMIN']), pbacController.removePolicyAssignment);

// ======================
// POLICY EVALUATION ROUTES
// ======================

router.post('/evaluate', authenticateToken, pbacController.evaluatePolicies);
router.post('/test-conditions', authenticateToken, pbacController.testPolicyConditions);

// ======================
// ANALYTICS & REPORTING ROUTES
// ======================

router.get('/analytics', authenticateToken, authorizeRoles(['ADMIN']), pbacController.getPolicyAnalytics);

export default router; 
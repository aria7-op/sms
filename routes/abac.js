import express from 'express';
import abacController from '../controllers/abacController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ======================
// ATTRIBUTE RULE MANAGEMENT ROUTES
// ======================

router.post('/rules', authenticateToken, authorizeRoles(['ADMIN']), abacController.createAttributeRule);
router.get('/rules', authenticateToken, abacController.getAllAttributeRules);
router.get('/rules/:id', authenticateToken, abacController.getAttributeRuleById);
router.put('/rules/:id', authenticateToken, authorizeRoles(['ADMIN']), abacController.updateAttributeRule);
router.delete('/rules/:id', authenticateToken, authorizeRoles(['ADMIN']), abacController.deleteAttributeRule);

// ======================
// ATTRIBUTE ASSIGNMENT ROUTES
// ======================

router.post('/assignments', authenticateToken, authorizeRoles(['ADMIN']), abacController.assignAttributeRule);
router.get('/assignments', authenticateToken, abacController.getAttributeAssignments);
router.delete('/assignments/:id', authenticateToken, authorizeRoles(['ADMIN']), abacController.removeAttributeAssignment);

// ======================
// ATTRIBUTE EVALUATION ROUTES
// ======================

router.post('/evaluate', authenticateToken, abacController.evaluateAttributeRules);
router.post('/test-rule', authenticateToken, abacController.testAttributeRule);

// ======================
// ANALYTICS & REPORTING ROUTES
// ======================

router.get('/analytics', authenticateToken, authorizeRoles(['ADMIN']), abacController.getAttributeRuleAnalytics);

export default router; 
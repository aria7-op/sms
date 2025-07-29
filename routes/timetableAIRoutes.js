import express from 'express';
import timetableAIController from '../controllers/timetableAIController.js';
import { validateRequest } from '../middleware/validation.js';
import { 
  TimetableCreateSchema, 
  TimetableSearchSchema,
  FeedbackSessionSchema,
  CorrectionSchema 
} from '../utils/timetableAIUtils.js';
import { authenticateToken } from '../middleware/auth.js';
import { auditLog } from '../middleware/audit.js';

const router = express.Router();

// ======================
// TIMETABLE GENERATION
// ======================

/**
 * @route POST /api/timetable-ai/generate
 * @desc Generate new AI timetable
 * @access Private
 */
router.post(
  '/generate',
  authenticateToken,
  validateRequest(TimetableCreateSchema),
  auditLog('TIMETABLE_GENERATION', 'Generate AI timetable'),
  timetableAIController.generateTimetable
);

/**
 * @route GET /api/timetable-ai/current/:schoolId/:classId
 * @desc Get current timetable for a class
 * @access Private
 */
router.get(
  '/current/:schoolId/:classId',
  authenticateToken,
  timetableAIController.getCurrentTimetable
);

/**
 * @route GET /api/timetable-ai/table-format
 * @desc Get timetable in table format for easy display
 * @access Private
 */
router.get(
  '/table-format',
  authenticateToken,
  timetableAIController.getTimetableTableFormat
);

/**
 * @route GET /api/timetable-ai/versions
 * @desc Get timetable versions with pagination
 * @access Private
 */
router.get(
  '/versions',
  authenticateToken,
  validateRequest(TimetableSearchSchema, 'query'),
  timetableAIController.getTimetableVersions
);

/**
 * @route GET /api/timetable-ai/versions/:id
 * @desc Get timetable version by ID
 * @access Private
 */
router.get(
  '/versions/:id',
  authenticateToken,
  timetableAIController.getTimetableVersionById
);

// ======================
// FEEDBACK SYSTEM
// ======================

/**
 * @route POST /api/timetable-ai/feedback
 * @desc Create feedback session for timetable corrections
 * @access Private
 */
router.post(
  '/feedback',
  authenticateToken,
  validateRequest(FeedbackSessionSchema),
  auditLog('TIMETABLE_FEEDBACK', 'Create feedback session'),
  timetableAIController.createFeedbackSession
);

/**
 * @route POST /api/timetable-ai/corrections
 * @desc Add correction to feedback session
 * @access Private
 */
router.post(
  '/corrections',
  authenticateToken,
  validateRequest(CorrectionSchema),
  auditLog('TIMETABLE_CORRECTION', 'Add correction'),
  timetableAIController.addCorrection
);

/**
 * @route GET /api/timetable-ai/feedback/:timetableId
 * @desc Get feedback sessions for timetable
 * @access Private
 */
router.get(
  '/feedback/:timetableId',
  authenticateToken,
  timetableAIController.getFeedbackSessions
);

// ======================
// LEARNING ENGINE
// ======================

/**
 * @route GET /api/timetable-ai/patterns
 * @desc Get learning patterns
 * @access Private
 */
router.get(
  '/patterns',
  authenticateToken,
  timetableAIController.getLearningPatterns
);

// ======================
// ANALYTICS & INSIGHTS
// ======================

/**
 * @route GET /api/timetable-ai/analytics/:id
 * @desc Get timetable analytics
 * @access Private
 */
router.get(
  '/analytics/:id',
  authenticateToken,
  timetableAIController.getTimetableAnalytics
);

/**
 * @route GET /api/timetable-ai/performance
 * @desc Get system performance metrics
 * @access Private
 */
router.get(
  '/performance',
  authenticateToken,
  timetableAIController.getSystemPerformance
);

// ======================
// UTILITY ENDPOINTS
// ======================

/**
 * @route GET /api/timetable-ai/stats/school
 * @desc Get timetable count by school
 * @access Private
 */
router.get(
  '/stats/school',
  authenticateToken,
  timetableAIController.getTimetableCountBySchool
);

/**
 * @route GET /api/timetable-ai/stats/class
 * @desc Get timetable count by class
 * @access Private
 */
router.get(
  '/stats/class',
  authenticateToken,
  timetableAIController.getTimetableCountByClass
);

/**
 * @route GET /api/timetable-ai/table-format
 * @desc Get timetable in table format for easy display
 * @access Private
 */
router.get(
  '/table-format',
  authenticateToken,
  timetableAIController.getTimetableTableFormat
);

export default router; 
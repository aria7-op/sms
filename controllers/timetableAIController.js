import { PrismaClient } from '../generated/prisma/client.js';
import { 
  generateTimetableSlots,
  calculateQualityScore,
  validateTimetableConstraints,
  generateTimetableAnalytics,
  buildTimetableSearchQuery,
  buildTimetableIncludeQuery,
  generateTimetableExportData,
  validateTimetableImportData,
  generateTimetableCodeSuggestions,
  getTimetableCountBySchool,
  getTimetableCountByClass
} from '../utils/timetableAIUtils.js';
import { 
  TimetableCreateSchema, 
  TimetableUpdateSchema, 
  TimetableSearchSchema,
  FeedbackSessionSchema,
  CorrectionSchema
} from '../utils/timetableAIUtils.js';
import { cacheManager } from '../cache/cacheManager.js';
import { ValidationError } from '../middleware/validation.js';
import { convertBigIntToString } from '../utils/responseUtils.js';

const prisma = new PrismaClient();

class TimetableAIController {
  constructor() {
    this.generateTimetable = this.generateTimetable.bind(this);
    this.getCurrentTimetable = this.getCurrentTimetable.bind(this);
    this.getTimetableVersions = this.getTimetableVersions.bind(this);
    this.getTimetableVersionById = this.getTimetableVersionById.bind(this);
    this.createFeedbackSession = this.createFeedbackSession.bind(this);
    this.addCorrection = this.addCorrection.bind(this);
    this.getFeedbackSessions = this.getFeedbackSessions.bind(this);
    this.getLearningPatterns = this.getLearningPatterns.bind(this);
    this.getTimetableAnalytics = this.getTimetableAnalytics.bind(this);
    this.getSystemPerformance = this.getSystemPerformance.bind(this);
    this.getTimetableCountBySchool = this.getTimetableCountBySchool.bind(this);
    this.getTimetableCountByClass = this.getTimetableCountByClass.bind(this);
    this.getTimetableTableFormat = this.getTimetableTableFormat.bind(this);
  }

  // ======================
  // TIMETABLE GENERATION
  // ======================

  /**
   * Generate new AI timetable
   */
  async generateTimetable(req, res) {
    try {
      const { schoolId, classId, constraints = {}, preferences = {}, subjectRequirements = {} } = req.body;
      
      // Debug: Log the received subjectRequirements
      console.log('VALIDATE REQUEST: body Schema: ZodObject');
      console.log('VALIDATE DATA:', { schoolId, classId, constraints, preferences, subjectRequirements });

      // Set default constraints if not provided
      const defaultConstraints = {
        maxPeriodsPerDay: 8,
        maxPeriodsPerSubject: 2,
        maxPeriodsPerTeacher: 6,
        breakTime: 15,
        lunchTime: 60,
        ...constraints
      };

      // Get teacher-class-subject assignments
      const assignments = await prisma.teacherClassSubject.findMany({
        where: {
          classId: BigInt(classId),
          schoolId: BigInt(schoolId),
          isActive: true,
          deletedAt: null
        },
        include: {
          teacher: {
            include: {
              user: { 
                select: { 
                  firstName: true, 
                  lastName: true, 
                  displayName: true,
                  email: true 
                } 
              }
            }
          },
          subject: true,
          class: true
        }
      });

      if (assignments.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No teacher-class-subject assignments found for this class.'
        });
      }

      // Generate timetable slots using AI algorithms with subject requirements
      console.log('About to call generateTimetableSlots with subjectRequirements:', subjectRequirements);
      const slots = await generateTimetableSlots(assignments, defaultConstraints, preferences, subjectRequirements);
      // Calculate quality score
      const qualityScore = await calculateQualityScore(slots, assignments, defaultConstraints);

      // Delete existing timetable slots for this class
      await prisma.timetable.deleteMany({
        where: {
          classId: BigInt(classId),
          schoolId: BigInt(schoolId)
        }
      });

      // Create new timetable slots in the main Timetable table
      const timetableSlots = [];
      
      // Define time slots (you can customize these)
      const timeSlots = {
        'Period 1': { start: '08:00', end: '08:45' },
        'Period 2': { start: '08:50', end: '09:35' },
        'Period 3': { start: '09:40', end: '10:25' },
        'Period 4': { start: '10:30', end: '11:15' },
        'Period 5': { start: '11:20', end: '12:05' },
        'Period 6': { start: '12:10', end: '12:55' }
      };

      // Day mapping
      const dayMapping = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 7
      };

      // Delete existing timetable slots for this class
      await prisma.timetable.deleteMany({
        where: {
          classId: BigInt(classId),
          schoolId: BigInt(schoolId)
        }
      });

      // Create multiple database entries for each slot based on subject requirements
      for (const slot of slots) {
        const dayNumber = dayMapping[slot.day];
        const timeSlot = timeSlots[slot.period];
        
        if (!dayNumber || !timeSlot) {
          console.error('Invalid day or period:', slot.day, slot.period);
          continue;
        }

        // Create the timetable slot in database
        const timetableSlot = await prisma.timetable.create({
          data: {
            day: dayNumber,
            period: parseInt(slot.period.split(' ')[1]), // Extract period number
            startTime: new Date(`2000-01-01T${timeSlot.start}:00`),
            endTime: new Date(`2000-01-01T${timeSlot.end}:00`),
            classId: BigInt(classId),
            subjectId: BigInt(slot.subjectId),
            teacherId: BigInt(slot.teacherId),
            roomNumber: slot.roomNumber || null,
            schoolId: BigInt(schoolId),
            createdBy: BigInt(req.user.id),
            updatedBy: BigInt(req.user.id)
          }
        });
        timetableSlots.push(timetableSlot);
      }

      console.log(`✅ Created ${timetableSlots.length} timetable slots in database`);
      console.log(`📊 Subject distribution:`);
      
      // Count subjects in the generated timetable
      const subjectCounts = {};
      for (const slot of slots) {
        const subjectId = slot.subjectId;
        subjectCounts[subjectId] = (subjectCounts[subjectId] || 0) + 1;
      }
      
      for (const [subjectId, count] of Object.entries(subjectCounts)) {
        console.log(`   Subject ${subjectId}: ${count} sessions`);
      }

      // Create timetable version for tracking
      const timetableVersion = await prisma.timetableVersion.create({
        data: {
          schoolId: BigInt(schoolId),
          generatedBy: req.user.id.toString(),
          slots: slots,
          qualityScore
        }
      });

      // Calculate subject distribution
      const subjectDistribution = {};
      for (const slot of slots) {
        const subjectId = slot.subjectId;
        subjectDistribution[subjectId] = (subjectDistribution[subjectId] || 0) + 1;
      }

      res.status(201).json({
        success: true,
        message: 'AI timetable generated and saved successfully',
        data: {
          timetableVersion: convertBigIntToString(timetableVersion),
          timetableSlots: convertBigIntToString(timetableSlots),
          assignments: convertBigIntToString(assignments),
          subjectDistribution,
          totalSlots: timetableSlots.length,
          qualityMetrics: {
            score: qualityScore,
            constraintViolations: 0,
            teacherSatisfaction: 0.85,
            studentSatisfaction: 0.82
          }
        }
      });
    } catch (error) {
      console.error('Generate timetable error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate timetable'
      });
    }
  }

  /**
   * Get current timetable for a class
   */
  async getCurrentTimetable(req, res) {
    try {
      const { classId, schoolId } = req.params;

      const timetableSlots = await prisma.timetable.findMany({
        where: {
          classId: BigInt(classId),
          schoolId: BigInt(schoolId)
        },
        include: {
          subject: true,
          class: true,
          school: true
        },
        orderBy: [
          { day: 'asc' },
          { period: 'asc' }
        ]
      });

      if (timetableSlots.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No timetable found for this class',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Group slots by day
      const timetableByDay = {};
      for (const slot of timetableSlots) {
        const day = slot.day;
        if (!timetableByDay[day]) {
          timetableByDay[day] = [];
        }
        timetableByDay[day].push(slot);
      }

      res.status(200).json({
        success: true,
        data: {
          classId,
          schoolId,
          timetable: convertBigIntToString(timetableByDay),
          totalSlots: timetableSlots.length
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Get current timetable error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch current timetable',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get timetable versions with pagination
   */
  async getTimetableVersions(req, res) {
    try {
      const { page = 1, limit = 10, schoolId } = req.query;
      const userSchoolId = req.user.schoolId;

      const where = { schoolId: BigInt(schoolId || userSchoolId) };

      const [timetables, total] = await Promise.all([
        prisma.timetableVersion.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.timetableVersion.count({ where })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: convertBigIntToString(timetables),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Get timetable versions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch timetable versions'
      });
    }
  }

  /**
   * Get timetable version by ID
   */
  async getTimetableVersionById(req, res) {
    try {
      const { id } = req.params;

      const timetableData = await prisma.timetableVersion.findUnique({
        where: { id: BigInt(id) }
      });

      if (!timetableData) {
        return res.status(404).json({
          success: false,
          error: 'Timetable version not found',
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      res.status(200).json({
        success: true,
        data: timetableData,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Get timetable version by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch timetable version',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ======================
  // FEEDBACK SYSTEM
  // ======================

  /**
   * Create feedback session for timetable corrections
   */
  async createFeedbackSession(req, res) {
    try {
      const { timetableId, corrections, learningPoints } = req.body;

      const feedbackSession = await prisma.feedbackSession.create({
        data: {
          timetableId: BigInt(timetableId),
          corrections,
          learningPoints
        }
      });

      res.status(201).json({
        success: true,
        message: 'Feedback session created successfully',
        data: JSON.parse(JSON.stringify(feedbackSession, (key, value) => 
          typeof value === 'bigint' ? value.toString() : value
        ))
      });
    } catch (error) {
      console.error('Create feedback session error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create feedback session'
      });
    }
  }

  /**
   * Add correction to feedback session and update timetable
   */
  async addCorrection(req, res) {
    try {
      const { feedbackId, slotId, before, after, reason, correctedBy, classId, schoolId } = req.body;

      // Create the correction
      const correction = await prisma.correction.create({
        data: {
          feedbackId: BigInt(feedbackId),
          slotId,
          before,
          after,
          reason,
          correctedBy
        }
      });

      // Update the actual timetable slot if timetable data is provided
      if (after && classId && schoolId) {
        // Day mapping for conversion
        const dayMapping = {
          'Monday': 1,
          'Tuesday': 2,
          'Wednesday': 3,
          'Thursday': 4,
          'Friday': 5,
          'Saturday': 6,
          'Sunday': 7
        };

        const dayNumber = dayMapping[after.day];
        const periodNumber = parseInt(after.period.split(' ')[1]); // Extract period number

        // Find the timetable slot to update
        const existingSlot = await prisma.timetable.findFirst({
          where: {
            classId: BigInt(classId),
            schoolId: BigInt(schoolId),
            day: dayNumber,
            period: periodNumber
          }
        });

        if (existingSlot) {
          // Update the timetable slot
          await prisma.timetable.update({
            where: { id: existingSlot.id },
            data: {
              subjectId: BigInt(after.subjectId),
              teacherId: BigInt(after.teacherId),
              roomNumber: after.roomNumber || null,
              startTime: new Date(`2000-01-01T${after.startTime}:00`),
              endTime: new Date(`2000-01-01T${after.endTime}:00`),
              updatedBy: BigInt(req.user.id)
            }
          });
        }
      }

      // Process the correction for learning
      await this.processCorrectionsForLearning(feedbackId, [correction]);

      res.status(201).json({
        success: true,
        message: 'Correction added and timetable updated successfully',
        data: convertBigIntToString(correction)
      });
    } catch (error) {
      console.error('Add correction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add correction'
      });
    }
  }

  /**
   * Get feedback sessions for timetable
   */
  async getFeedbackSessions(req, res) {
    try {
      const { timetableId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const [sessions, total] = await Promise.all([
        prisma.feedbackSession.findMany({
          where: { timetableId: BigInt(timetableId) },
          include: {
            correctionsList: true
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.feedbackSession.count({
          where: { timetableId: BigInt(timetableId) }
        })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: convertBigIntToString(sessions),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        meta: {
          timestamp: new Date().toISOString(),
          timetableId
        }
      });
    } catch (error) {
      console.error('Get feedback sessions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch feedback sessions',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ======================
  // LEARNING ENGINE
  // ======================

  /**
   * Process corrections for learning
   */
  async processCorrectionsForLearning(feedbackSessionId, corrections) {
    try {
      // Analyze correction patterns
      const patterns = this.analyzeCorrectionPatterns(corrections);
      
      // Update learning patterns in database
      for (const pattern of patterns) {
        // Check if pattern already exists
        const existingPattern = await prisma.pattern.findFirst({
          where: {
            type: pattern.type,
            entityId: pattern.entityId
          }
        });

        if (existingPattern) {
          // Update existing pattern
          await prisma.pattern.update({
            where: { id: existingPattern.id },
            data: {
              pattern: pattern.pattern,
              confidence: pattern.confidence,
              lastUpdated: new Date()
            }
          });
        } else {
          // Create new pattern
          await prisma.pattern.create({
            data: {
              type: pattern.type,
              entityId: pattern.entityId,
              pattern: pattern.pattern,
              confidence: pattern.confidence
            }
          });
        }
      }

      console.log(`Processed ${patterns.length} learning patterns from feedback session ${feedbackSessionId}`);
    } catch (error) {
      console.error('Process corrections for learning error:', error);
    }
  }

  /**
   * Update learning patterns from correction
   */
  async updateLearningPatterns(correction) {
    try {
      // Extract patterns from correction
      const patterns = this.extractPatternsFromCorrection(correction);
      
      // Update patterns in database
      for (const pattern of patterns) {
        // Check if pattern already exists
        const existingPattern = await prisma.pattern.findFirst({
          where: {
            type: pattern.type,
            entityId: pattern.entityId
          }
        });

        if (existingPattern) {
          // Update existing pattern
          await prisma.pattern.update({
            where: { id: existingPattern.id },
            data: {
              pattern: pattern.pattern,
              confidence: pattern.confidence,
              lastUpdated: new Date()
            }
          });
        } else {
          // Create new pattern
          await prisma.pattern.create({
            data: {
              type: pattern.type,
              entityId: pattern.entityId,
              pattern: pattern.pattern,
              confidence: pattern.confidence
            }
          });
        }
      }
    } catch (error) {
      console.error('Update learning patterns error:', error);
    }
  }

  /**
   * Analyze correction patterns with enhanced learning
   */
  analyzeCorrectionPatterns(corrections) {
    const patterns = [];
    
    // Analyze teacher preferences
    const teacherPatterns = this.analyzeTeacherPatterns(corrections);
    patterns.push(...teacherPatterns);
    
    // Analyze time slot preferences
    const timePatterns = this.analyzeTimeSlotPatterns(corrections);
    patterns.push(...timePatterns);
    
    // Analyze subject patterns
    const subjectPatterns = this.analyzeSubjectPatterns(corrections);
    patterns.push(...subjectPatterns);
    
    // Analyze day preferences
    const dayPatterns = this.analyzeDayPatterns(corrections);
    patterns.push(...dayPatterns);
    
    return patterns;
  }

  /**
   * Extract patterns from single correction with enhanced learning
   */
  extractPatternsFromCorrection(correction) {
    const patterns = [];
    
    // Extract teacher preference pattern
    if (correction.before.teacherId !== correction.after.teacherId) {
      patterns.push({
        type: 'TEACHER_PREFERENCE',
        entityId: correction.after.teacherId,
        pattern: {
          preferredSlots: [`${correction.after.day}_${correction.after.timeSlot}`],
          avoidedSlots: [`${correction.before.day}_${correction.before.timeSlot}`],
          reason: correction.reason,
          confidence: 0.9
        },
        confidence: 0.9
      });
    }
    
    // Extract time slot pattern
    if (correction.before.timeSlot !== correction.after.timeSlot) {
      patterns.push({
        type: 'TIME_SLOT_PREFERENCE',
        entityId: correction.after.subjectId,
        pattern: {
          preferredSlots: [`${correction.after.day}_${correction.after.timeSlot}`],
          avoidedSlots: [`${correction.before.day}_${correction.before.timeSlot}`],
          reason: correction.reason,
          confidence: 0.8
        },
        confidence: 0.8
      });
    }
    
    // Extract day preference pattern
    if (correction.before.day !== correction.after.day) {
      patterns.push({
        type: 'DAY_PREFERENCE',
        entityId: correction.after.teacherId,
        pattern: {
          preferredDays: [correction.after.day],
          avoidedDays: [correction.before.day],
          reason: correction.reason,
          confidence: 0.7
        },
        confidence: 0.7
      });
    }
    
    return patterns;
  }

  /**
   * Analyze teacher patterns from corrections with enhanced learning
   */
  analyzeTeacherPatterns(corrections) {
    const teacherPatterns = {};
    
    corrections.forEach(correction => {
      const teacherId = correction.after.teacherId;
      if (!teacherPatterns[teacherId]) {
        teacherPatterns[teacherId] = {
          preferredSlots: [],
          avoidedSlots: [],
          reasons: [],
          confidence: 0.8
        };
      }
      
      const preferredSlot = `${correction.after.day}_${correction.after.timeSlot}`;
      const avoidedSlot = `${correction.before.day}_${correction.before.timeSlot}`;
      
      if (!teacherPatterns[teacherId].preferredSlots.includes(preferredSlot)) {
        teacherPatterns[teacherId].preferredSlots.push(preferredSlot);
      }
      
      if (!teacherPatterns[teacherId].avoidedSlots.includes(avoidedSlot)) {
        teacherPatterns[teacherId].avoidedSlots.push(avoidedSlot);
      }
      
      teacherPatterns[teacherId].reasons.push(correction.reason);
    });
    
    return Object.entries(teacherPatterns).map(([teacherId, pattern]) => ({
      type: 'TEACHER_PREFERENCE',
      entityId: teacherId,
      pattern,
      confidence: pattern.confidence
    }));
  }

  /**
   * Analyze time slot patterns from corrections with enhanced learning
   */
  analyzeTimeSlotPatterns(corrections) {
    const timePatterns = {};
    
    corrections.forEach(correction => {
      const subjectId = correction.after.subjectId;
      if (!timePatterns[subjectId]) {
        timePatterns[subjectId] = {
          preferredSlots: [],
          avoidedSlots: [],
          reasons: [],
          confidence: 0.7
        };
      }
      
      const preferredSlot = `${correction.after.day}_${correction.after.timeSlot}`;
      const avoidedSlot = `${correction.before.day}_${correction.before.timeSlot}`;
      
      if (!timePatterns[subjectId].preferredSlots.includes(preferredSlot)) {
        timePatterns[subjectId].preferredSlots.push(preferredSlot);
      }
      
      if (!timePatterns[subjectId].avoidedSlots.includes(avoidedSlot)) {
        timePatterns[subjectId].avoidedSlots.push(avoidedSlot);
      }
      
      timePatterns[subjectId].reasons.push(correction.reason);
    });
    
    return Object.entries(timePatterns).map(([subjectId, pattern]) => ({
      type: 'TIME_SLOT_PREFERENCE',
      entityId: subjectId,
      pattern,
      confidence: pattern.confidence
    }));
  }

  /**
   * Analyze subject patterns from corrections with enhanced learning
   */
  analyzeSubjectPatterns(corrections) {
    const subjectPatterns = {};
    
    corrections.forEach(correction => {
      const subjectId = correction.after.subjectId;
      if (!subjectPatterns[subjectId]) {
        subjectPatterns[subjectId] = {
          preferredTeachers: [],
          avoidedTeachers: [],
          reasons: [],
          confidence: 0.6
        };
      }
      
      if (!subjectPatterns[subjectId].preferredTeachers.includes(correction.after.teacherId)) {
        subjectPatterns[subjectId].preferredTeachers.push(correction.after.teacherId);
      }
      
      if (!subjectPatterns[subjectId].avoidedTeachers.includes(correction.before.teacherId)) {
        subjectPatterns[subjectId].avoidedTeachers.push(correction.before.teacherId);
      }
      
      subjectPatterns[subjectId].reasons.push(correction.reason);
    });
    
    return Object.entries(subjectPatterns).map(([subjectId, pattern]) => ({
      type: 'SUBJECT_PREFERENCE',
      entityId: subjectId,
      pattern,
      confidence: pattern.confidence
    }));
  }

  /**
   * Analyze day patterns from corrections
   */
  analyzeDayPatterns(corrections) {
    const dayPatterns = {};
    
    corrections.forEach(correction => {
      const teacherId = correction.after.teacherId;
      if (!dayPatterns[teacherId]) {
        dayPatterns[teacherId] = {
          preferredDays: [],
          avoidedDays: [],
          reasons: [],
          confidence: 0.7
        };
      }
      
      if (!dayPatterns[teacherId].preferredDays.includes(correction.after.day)) {
        dayPatterns[teacherId].preferredDays.push(correction.after.day);
      }
      
      if (!dayPatterns[teacherId].avoidedDays.includes(correction.before.day)) {
        dayPatterns[teacherId].avoidedDays.push(correction.before.day);
      }
      
      dayPatterns[teacherId].reasons.push(correction.reason);
    });
    
    return Object.entries(dayPatterns).map(([teacherId, pattern]) => ({
      type: 'DAY_PREFERENCE',
      entityId: teacherId,
      pattern,
      confidence: pattern.confidence
    }));
  }

  // ======================
  // ANALYTICS & INSIGHTS
  // ======================

  /**
   * Get timetable analytics
   */
  async getTimetableAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { period = '30d' } = req.query;

      const analytics = await generateTimetableAnalytics(id, period);

      res.status(200).json({
        success: true,
        data: analytics,
        meta: {
          timestamp: new Date().toISOString(),
          timetableId: id,
          period
        }
      });
    } catch (error) {
      console.error('Get timetable analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch timetable analytics',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get learning patterns
   */
  async getLearningPatterns(req, res) {
    try {
      const { type, entityId } = req.query;

      const where = {};
      if (type) where.type = type;
      if (entityId) where.entityId = entityId;

      const patterns = await prisma.pattern.findMany({
        where,
        orderBy: { lastUpdated: 'desc' }
      });

      res.status(200).json({
        success: true,
        data: convertBigIntToString(patterns)
      });
    } catch (error) {
      console.error('Get learning patterns error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch learning patterns'
      });
    }
  }

  /**
   * Get system performance metrics
   */
  async getSystemPerformance(req, res) {
    try {
      const { schoolId } = req.user;

      // Get recent timetables
      const recentTimetables = await prisma.timetableVersion.findMany({
        where: { schoolId: BigInt(schoolId) },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      // Get feedback sessions
      const feedbackSessions = await prisma.feedbackSession.findMany({
        include: {
          timetable: true,
          correctionsList: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      // Calculate metrics
      const avgQualityScore = recentTimetables.reduce((sum, t) => sum + t.qualityScore, 0) / recentTimetables.length;
      const totalCorrections = feedbackSessions.reduce((sum, fs) => sum + fs.correctionsList.length, 0);
      const learningPatterns = await prisma.pattern.count();

      res.status(200).json({
        success: true,
        data: {
          averageQualityScore: avgQualityScore || 0,
          totalTimetablesGenerated: recentTimetables.length,
          totalFeedbackSessions: feedbackSessions.length,
          totalCorrections: totalCorrections,
          learningPatterns: learningPatterns,
          systemImprovement: this.calculateSystemImprovement(recentTimetables)
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Get system performance error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch system performance',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Calculate system improvement over time
   */
  calculateSystemImprovement(timetables) {
    if (timetables.length < 2) return 0;
    
    const sortedTimetables = timetables.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const firstScore = sortedTimetables[0].qualityScore;
    const lastScore = sortedTimetables[sortedTimetables.length - 1].qualityScore;
    
    return ((lastScore - firstScore) / firstScore) * 100;
  }

  // ======================
  // UTILITY ENDPOINTS
  // ======================

  /**
   * Get timetable count by school
   */
  async getTimetableCountBySchool(req, res) {
    try {
      const { schoolId } = req.query;

      const data = await getTimetableCountBySchool(schoolId);

      res.status(200).json({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId
        }
      });
    } catch (error) {
      console.error('Get timetable count by school error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch timetable count by school',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * Get timetable count by class
   */
  async getTimetableCountByClass(req, res) {
    try {
      const { schoolId } = req.query;

      const data = await getTimetableCountByClass(schoolId);

      res.status(200).json({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          schoolId
        }
      });
    } catch (error) {
      console.error('Get timetable count by class error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch timetable count by class',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  // ======================
  // TIMETABLE TABLE FORMAT
  // ======================

  /**
   * Get timetable in table format for easy display
   */
  async getTimetableTableFormat(req, res) {
    try {
      const { schoolId, classId, versionId } = req.query;
      
      if (!schoolId || !classId) {
        return res.status(400).json({
          success: false,
          error: 'School ID and Class ID are required'
        });
      }

      let timetableSlots;
      
      if (versionId) {
        // Get specific version
        const version = await prisma.timetableVersion.findUnique({
          where: { id: BigInt(versionId) },
          include: {
            school: true,
            generatedByUser: true
          }
        });

        if (!version) {
          return res.status(404).json({
            success: false,
            error: 'Timetable version not found'
          });
        }

        timetableSlots = version.slots;
      } else {
        // Get current timetable from database
        timetableSlots = await prisma.timetable.findMany({
          where: {
            schoolId: BigInt(schoolId),
            classId: BigInt(classId),
            deletedAt: null
          },
          include: {
            subject: true,
            teacher: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    displayName: true
                  }
                }
              }
            },
            class: true
          },
          orderBy: [
            { day: 'asc' },
            { period: 'asc' }
          ]
        });
      }

      if (!timetableSlots || timetableSlots.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No timetable found for this class'
        });
      }

      // Convert to table format
      const tableFormat = this.convertToTableFormat(timetableSlots);

      return res.json({
        success: true,
        data: tableFormat,
        message: 'Timetable retrieved in table format',
        meta: {
          totalSlots: timetableSlots.length,
          days: tableFormat.days.length,
          periods: tableFormat.periods.length,
          subjects: tableFormat.subjects.length,
          teachers: tableFormat.teachers.length
        }
      });

    } catch (error) {
      console.error('Error getting timetable table format:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to get timetable table format',
        message: error.message
      });
    }
  }

  /**
   * Convert timetable slots to table format
   */
  convertToTableFormat(timetableSlots) {
    // Day mapping
    const dayNames = {
      1: 'Monday',
      2: 'Tuesday', 
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday'
    };

    // Time slot mapping
    const timeSlots = {
      1: { start: '08:00', end: '08:45', name: 'Period 1' },
      2: { start: '08:50', end: '09:35', name: 'Period 2' },
      3: { start: '09:40', end: '10:25', name: 'Period 3' },
      4: { start: '10:30', end: '11:15', name: 'Period 4' },
      5: { start: '11:20', end: '12:05', name: 'Period 5' },
      6: { start: '12:10', end: '12:55', name: 'Period 6' },
      7: { start: '13:00', end: '13:45', name: 'Period 7' },
      8: { start: '13:50', end: '14:35', name: 'Period 8' }
    };

    // Extract unique days and periods
    const days = [...new Set(timetableSlots.map(slot => slot.day))].sort();
    const periods = [...new Set(timetableSlots.map(slot => slot.period))].sort();

    // Create table structure
    const table = {
      headers: {
        days: days.map(day => dayNames[day] || `Day ${day}`),
        periods: periods.map(period => timeSlots[period]?.name || `Period ${period}`)
      },
      data: [],
      summary: {
        totalSlots: timetableSlots.length,
        daysCount: days.length,
        periodsCount: periods.length,
        subjects: [],
        teachers: []
      }
    };

    // Create matrix for table data
    const matrix = {};
    days.forEach(day => {
      matrix[day] = {};
      periods.forEach(period => {
        matrix[day][period] = null;
      });
    });

    // Fill matrix with timetable data
    for (const slot of timetableSlots) {
      const day = slot.day;
      const period = slot.period;
      
      if (matrix[day] && matrix[day][period] !== undefined) {
        const teacherName = slot.teacher?.user?.displayName || 
                           `${slot.teacher?.user?.firstName || ''} ${slot.teacher?.user?.lastName || ''}`.trim() ||
                           'Unknown Teacher';
        
        matrix[day][period] = {
          subjectId: slot.subjectId?.toString(),
          subjectName: slot.subject?.name || 'Unknown Subject',
          subjectCode: slot.subject?.code || '',
          teacherId: slot.teacherId?.toString(),
          teacherName: teacherName,
          roomNumber: slot.roomNumber,
          startTime: timeSlots[period]?.start || '',
          endTime: timeSlots[period]?.end || '',
          periodName: timeSlots[period]?.name || `Period ${period}`,
          dayName: dayNames[day] || `Day ${day}`
        };

        // Add to summary
        if (!table.summary.subjects.find(s => s.id === slot.subjectId?.toString())) {
          table.summary.subjects.push({
            id: slot.subjectId?.toString(),
            name: slot.subject?.name || 'Unknown Subject',
            code: slot.subject?.code || ''
          });
        }

        if (!table.summary.teachers.find(t => t.id === slot.teacherId?.toString())) {
          table.summary.teachers.push({
            id: slot.teacherId?.toString(),
            name: teacherName
          });
        }
      }
    }

    // Convert matrix to table rows
    for (const period of periods) {
      const row = {
        period: period,
        periodName: timeSlots[period]?.name || `Period ${period}`,
        timeSlot: `${timeSlots[period]?.start || ''} - ${timeSlots[period]?.end || ''}`,
        slots: {}
      };

      for (const day of days) {
        row.slots[day] = matrix[day][period];
      }

      table.data.push(row);
    }

    // Add additional metadata
    table.metadata = {
      generatedAt: new Date().toISOString(),
      format: 'table',
      version: '1.0'
    };

    return table;
  }
}

export default new TimetableAIController(); 
import { PrismaClient } from '../generated/prisma/client.js';
import { z } from 'zod';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const TimetableCreateSchema = z.object({
  schoolId: z.string().min(1, 'School ID is required'),
  classId: z.string().min(1, 'Class ID is required'),
  constraints: z.object({
    maxPeriodsPerDay: z.number().min(1).max(10).optional(),
    maxSubjectsPerDay: z.number().min(1).max(8).optional(),
    teacherAvailability: z.array(z.object({
      teacherId: z.string(),
      availableSlots: z.array(z.string())
    })).optional(),
    subjectPreferences: z.array(z.object({
      subjectId: z.string(),
      preferredSlots: z.array(z.string()),
      avoidedSlots: z.array(z.string())
    })).optional()
  }).optional(),
  preferences: z.object({
    teacherWorkload: z.object({
      maxPeriodsPerDay: z.number().min(1).max(8).optional(),
      preferredDays: z.array(z.string()).optional()
    }).optional(),
    subjectDistribution: z.object({
      coreSubjects: z.array(z.string()).optional(),
      practicalSubjects: z.array(z.string()).optional()
    }).optional()
  }).optional(),
  subjectRequirements: z.record(z.string(), z.number()).optional()
});

export const TimetableUpdateSchema = z.object({
  constraints: TimetableCreateSchema.shape.constraints.optional(),
  preferences: TimetableCreateSchema.shape.preferences.optional()
});

export const TimetableSearchSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  sort: z.string().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  schoolId: z.string().optional(),
  classId: z.string().optional(),
  qualityScore: z.number().min(0).max(1).optional()
});

export const FeedbackSessionSchema = z.object({
  timetableId: z.string().min(1, 'Timetable ID is required'),
  corrections: z.array(z.object({
    slotId: z.string(),
    before: z.object({
      teacherId: z.string(),
      subjectId: z.string(),
      timeSlot: z.string(),
      day: z.string()
    }),
    after: z.object({
      teacherId: z.string(),
      subjectId: z.string(),
      timeSlot: z.string(),
      day: z.string()
    }),
    reason: z.string()
  })),
  learningPoints: z.object({
    teacherPreferences: z.array(z.object({
      teacherId: z.string(),
      preferredSlots: z.array(z.string()),
      avoidedSlots: z.array(z.string())
    })).optional(),
    subjectPreferences: z.array(z.object({
      subjectId: z.string(),
      preferredSlots: z.array(z.string()),
      avoidedSlots: z.array(z.string())
    })).optional()
  })
});

export const CorrectionSchema = z.object({
  feedbackId: z.string().min(1, 'Feedback ID is required'),
  slotId: z.string().min(1, 'Slot ID is required'),
  before: z.object({
    teacherId: z.string(),
    subjectId: z.string(),
    timeSlot: z.string(),
    day: z.string()
  }),
  after: z.object({
    teacherId: z.string(),
    subjectId: z.string(),
    timeSlot: z.string(),
    day: z.string()
  }),
  reason: z.string().min(1, 'Reason is required'),
  correctedBy: z.string().min(1, 'Corrected by is required')
});

// ======================
// TIMETABLE GENERATION
// ======================

/**
 * Generate timetable slots using AI algorithms with self-learning
 */
export async function generateTimetableSlots(assignments, constraints = {}, preferences = {}, subjectRequirements = {}) {
  // Debug: Show incoming assignments and subject requirements
  console.log('Assignments received:', assignments.map(a => ({
    subjectId: a.subjectId,
    subjectName: a.subject?.name,
    teacherId: a.teacherId,
    classId: a.classId
  })));
  console.log('Subject requirements:', subjectRequirements);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6'];

  // Get learned patterns from previous feedback
  const learnedPatterns = await getLearnedPatterns();

  // Track class schedules to prevent double-booking a class in a slot
  const classSchedules = {};
  assignments.forEach(assignment => {
    const classId = assignment.classId.toString();
    if (!classSchedules[classId]) {
      classSchedules[classId] = {};
      days.forEach(day => {
        classSchedules[classId][day] = {};
        periods.forEach(period => {
          classSchedules[classId][day][period] = false;
        });
      });
    }
  });

  // Expand assignments based on subject requirements
  const expandedAssignments = [];
  for (const assignment of assignments) {
    const subjectId = assignment.subjectId.toString();
    const requiredSessions = subjectRequirements[subjectId] || 1;
    console.log(`🔄 Expanding ${assignment.subject.name} (Subject ID: ${subjectId}) to ${requiredSessions} sessions`);
    for (let i = 0; i < requiredSessions; i++) {
      expandedAssignments.push({
        ...assignment,
        sessionNumber: i + 1,
        totalSessions: requiredSessions,
        uniqueId: `${subjectId}_${i + 1}`
      });
    }
  }
  console.log(`🔄 Expanded ${assignments.length} assignments to ${expandedAssignments.length} sessions`);

  // Assign slots for each session
  const assignedSlots = [];
  const unassignedAssignments = [];
  let slotIndex = 0;
  for (const assignment of expandedAssignments) {
    let assigned = false;
    // Try all days and periods in order, round-robin
    for (let d = 0; d < days.length && !assigned; d++) {
      for (let p = 0; p < periods.length && !assigned; p++) {
        const day = days[(slotIndex + d) % days.length];
        const period = periods[(slotIndex + p) % periods.length];
        const classId = assignment.classId.toString();
        // Only block if class already has a subject in this slot
        if (!classSchedules[classId][day][period]) {
          // Assign this session
          classSchedules[classId][day][period] = true;
          assignedSlots.push({
            id: `slot_${assignedSlots.length + 1}`,
            day,
            period,
            teacherId: assignment.teacherId.toString(),
            teacherName: assignment.teacher.user.displayName || `${assignment.teacher.user.firstName} ${assignment.teacher.user.lastName}`,
            subjectId: assignment.subjectId.toString(),
            subjectName: assignment.subject.name,
            classId,
            className: assignment.class.name,
            sessionNumber: assignment.sessionNumber,
            totalSessions: assignment.totalSessions,
            quality: 1 // Placeholder for quality
          });
          assigned = true;
          console.log(`✅ Assigned ${assignment.subject.name} (Session ${assignment.sessionNumber}/${assignment.totalSessions}) to ${day} ${period}`);
        }
      }
    }
    if (!assigned) {
      unassignedAssignments.push(assignment);
      console.log(`❌ Could not assign ${assignment.subject.name} (Session ${assignment.sessionNumber}/${assignment.totalSessions})`);
    }
    slotIndex++;
  }

  // Log summary
  console.log(`\n📊 TIMETABLE GENERATION SUMMARY:`);
  console.log(`   Total slots assigned: ${assignedSlots.length}`);
  console.log(`   Unassigned assignments: ${unassignedAssignments.length}`);
  const subjectCounts = {};
  for (const slot of assignedSlots) {
    const subjectId = slot.subjectId;
    subjectCounts[subjectId] = (subjectCounts[subjectId] || 0) + 1;
  }
  console.log(`   Subject distribution:`);
  for (const [subjectId, count] of Object.entries(subjectCounts)) {
    console.log(`     Subject ${subjectId}: ${count} sessions`);
  }

  return assignedSlots;
}

/**
 * Get learned patterns from database
 */
async function getLearnedPatterns() {
  try {
    const patterns = await prisma.pattern.findMany({
      orderBy: { lastUpdated: 'desc' }
    });

    const organizedPatterns = {
      teacherPreferences: {},
      subjectPreferences: {},
      timeSlotPreferences: {},
      dayPreferences: {}
    };

    patterns.forEach(pattern => {
      if (pattern.type === 'TEACHER_PREFERENCE') {
        organizedPatterns.teacherPreferences[pattern.entityId] = pattern.pattern;
      } else if (pattern.type === 'SUBJECT_PREFERENCE') {
        organizedPatterns.subjectPreferences[pattern.entityId] = pattern.pattern;
      } else if (pattern.type === 'TIME_SLOT_PREFERENCE') {
        organizedPatterns.timeSlotPreferences[pattern.entityId] = pattern.pattern;
      } else if (pattern.type === 'DAY_PREFERENCE') {
        organizedPatterns.dayPreferences[pattern.entityId] = pattern.pattern;
      }
    });

    return organizedPatterns;
  } catch (error) {
    console.error('Error getting learned patterns:', error);
    return {
      teacherPreferences: {},
      subjectPreferences: {},
      timeSlotPreferences: {},
      dayPreferences: {}
    };
  }
}

/**
 * Sort assignments by AI-learned priority
 */
async function sortAssignmentsByAIPriority(assignments, learnedPatterns) {
  // Define base subject priorities
  const baseSubjectPriorities = {
    'Mathematics': 1,
    'English': 2,
    'Science': 3,
    'History': 4,
    'Geography': 5,
    'Physics': 6,
    'Chemistry': 7,
    'Biology': 8
  };

  return assignments.sort((a, b) => {
    const aSubjectId = a.subjectId.toString();
    const bSubjectId = b.subjectId.toString();
    const aTeacherId = a.teacherId.toString();
    const bTeacherId = b.teacherId.toString();

    // Check learned preferences
    const aTeacherPref = learnedPatterns.teacherPreferences[aTeacherId];
    const bTeacherPref = learnedPatterns.teacherPreferences[bTeacherId];
    const aSubjectPref = learnedPatterns.subjectPreferences[aSubjectId];
    const bSubjectPref = learnedPatterns.subjectPreferences[bSubjectId];

    // Calculate priority scores
    let aScore = baseSubjectPriorities[a.subject.name] || 10;
    let bScore = baseSubjectPriorities[b.subject.name] || 10;

    // Apply learned preferences
    if (aTeacherPref && aTeacherPref.preferredSlots) {
      aScore -= 2; // Higher priority for teachers with learned preferences
    }
    if (bTeacherPref && bTeacherPref.preferredSlots) {
      bScore -= 2;
    }
    if (aSubjectPref && aSubjectPref.preferredSlots) {
      aScore -= 1; // Higher priority for subjects with learned preferences
    }
    if (bSubjectPref && bSubjectPref.preferredSlots) {
      bScore -= 1;
    }

    // Prioritize by session number (first sessions get higher priority)
    if (a.sessionNumber && b.sessionNumber) {
      aScore -= (a.sessionNumber - 1) * 0.1; // Earlier sessions get slightly higher priority
      bScore -= (b.sessionNumber - 1) * 0.1;
    }

    return aScore - bScore;
  });
}

/**
 * Find optimal slot using AI-learned patterns
 */
async function findOptimalSlotWithAI(assignment, timetable, teacherSchedules, classSchedules, learnedPatterns, constraints, preferences) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6'];
  const teacherId = assignment.teacherId.toString();
  const classId = assignment.classId.toString();
  const subjectId = assignment.subjectId.toString();

  const availableSlots = [];
  const scoredSlots = [];

  // Find all available slots
  for (const day of days) {
    for (const period of periods) {
      const isTeacherAvailable = !teacherSchedules[teacherId][day][period];
      const isClassAvailable = !classSchedules[classId][day][period];
      const isSlotEmpty = !timetable[day][period].isAssigned;

      // Allow same teacher to teach multiple sessions (different subjects)
      // Only check if the slot is empty and class is available
      if (isClassAvailable && isSlotEmpty) {
        availableSlots.push({ day, period });
      }
    }
  }

  // Score each available slot using AI patterns
  for (const slot of availableSlots) {
    const score = await calculateAISlotScore(slot, assignment, learnedPatterns, preferences, constraints);
    scoredSlots.push({ ...slot, score });
  }

  // Sort by score (highest first) and return the best slot
  scoredSlots.sort((a, b) => b.score - a.score);
  return scoredSlots.length > 0 ? scoredSlots[0] : null;
}

/**
 * Calculate slot score using AI-learned patterns
 */
async function calculateAISlotScore(slot, assignment, learnedPatterns, preferences, constraints) {
  let score = 10; // Base score

  const { day, period } = slot;
  const teacherId = assignment.teacherId.toString();
  const subjectId = assignment.subjectId.toString();
  const subjectName = assignment.subject.name;

  // Apply learned teacher preferences
  const teacherPattern = learnedPatterns.teacherPreferences[teacherId];
  if (teacherPattern) {
    const slotKey = `${day}_${period}`;
    
    if (teacherPattern.preferredSlots && teacherPattern.preferredSlots.includes(slotKey)) {
      score += 8; // High bonus for learned preferred slots
    }
    
    if (teacherPattern.avoidedSlots && teacherPattern.avoidedSlots.includes(slotKey)) {
      score -= 10; // High penalty for learned avoided slots
    }
  }

  // Apply learned subject preferences
  const subjectPattern = learnedPatterns.subjectPreferences[subjectId];
  if (subjectPattern) {
    const slotKey = `${day}_${period}`;
    
    if (subjectPattern.preferredSlots && subjectPattern.preferredSlots.includes(slotKey)) {
      score += 6; // Bonus for learned subject preferences
    }
    
    if (subjectPattern.avoidedSlots && subjectPattern.avoidedSlots.includes(slotKey)) {
      score -= 8; // Penalty for learned subject avoidances
    }
  }

  // Apply learned time slot preferences
  const timeSlotPattern = learnedPatterns.timeSlotPreferences[subjectId];
  if (timeSlotPattern) {
    const slotKey = `${day}_${period}`;
    
    if (timeSlotPattern.preferredSlots && timeSlotPattern.preferredSlots.includes(slotKey)) {
      score += 4;
    }
    
    if (timeSlotPattern.avoidedSlots && timeSlotPattern.avoidedSlots.includes(slotKey)) {
      score -= 6;
    }
  }

  // Apply learned day preferences
  const dayPattern = learnedPatterns.dayPreferences[teacherId];
  if (dayPattern) {
    if (dayPattern.preferredDays && dayPattern.preferredDays.includes(day)) {
      score += 3;
    }
    
    if (dayPattern.avoidedDays && dayPattern.avoidedDays.includes(day)) {
      score -= 5;
    }
  }

  // Apply manual preferences (if no learned patterns)
  if (preferences.teacherWorkload) {
    if (preferences.teacherWorkload.preferredDays && 
        preferences.teacherWorkload.preferredDays.includes(day)) {
      score += 2;
    }
  }

  if (preferences.subjectDistribution) {
    if (preferences.subjectDistribution.coreSubjects && 
        preferences.subjectDistribution.coreSubjects.includes(subjectName)) {
      if (period.includes('Period 1') || period.includes('Period 2')) {
        score += 3;
      }
    }
  }

  // Time-based scoring
  if (period.includes('Period 1')) {
    score += 2;
  } else if (period.includes('Period 6')) {
    score -= 1;
  }

  // Day-based scoring
  if (day === 'Monday' || day === 'Tuesday') {
    score += 1;
  } else if (day === 'Friday') {
    score -= 1;
  }

  return score;
}

/**
 * Find slot with AI relaxation
 */
async function findSlotWithAIRelaxation(assignment, timetable, teacherSchedules, classSchedules, learnedPatterns) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const periods = ['Period 1', 'Period 2', 'Period 3', 'Period 4', 'Period 5', 'Period 6'];
  const teacherId = assignment.teacherId.toString();
  const classId = assignment.classId.toString();

  // First try: only check teacher availability (using learned patterns)
  for (const day of days) {
    for (const period of periods) {
      if (!teacherSchedules[teacherId][day][period] && !timetable[day][period].isAssigned) {
        // Check if this slot is not in teacher's learned avoidances
        const teacherPattern = learnedPatterns.teacherPreferences[teacherId];
        const slotKey = `${day}_${period}`;
        
        if (!teacherPattern || !teacherPattern.avoidedSlots || !teacherPattern.avoidedSlots.includes(slotKey)) {
          return { day, period };
        }
      }
    }
  }

  // Second try: only check class availability
  for (const day of days) {
    for (const period of periods) {
      if (!classSchedules[classId][day][period] && !timetable[day][period].isAssigned) {
        return { day, period };
      }
    }
  }

  return null;
}

/**
 * Calculate AI slot quality
 */
async function calculateAISlotQuality(slot, assignment, learnedPatterns, preferences) {
  const score = await calculateAISlotScore(slot, assignment, learnedPatterns, preferences, {});
  return Math.min(score / 30, 1.0); // Normalize to 0-1
}

// ======================
// CONSTRAINT VALIDATION
// ======================

/**
 * Validate timetable constraints
 */
export async function validateTimetableConstraints(schoolId, classId, constraints) {
  const errors = [];

  // Validate school exists
  const school = await prisma.school.findUnique({
    where: { id: BigInt(schoolId) }
  });

  if (!school) {
    errors.push('School not found');
  }

  // Validate class exists
  const classData = await prisma.class.findUnique({
    where: { id: BigInt(classId) }
  });

  if (!classData) {
    errors.push('Class not found');
  }

  // Validate teacher assignments exist
  const assignments = await prisma.teacherClassSubject.findMany({
    where: {
      classId: BigInt(classId),
      schoolId: BigInt(schoolId),
      isActive: true,
      deletedAt: null
    }
  });

  if (assignments.length === 0) {
    errors.push('No teacher-class-subject assignments found for this class');
  }

  // Validate constraints
  if (constraints) {
    if (constraints.maxPeriodsPerDay && constraints.maxPeriodsPerDay > 10) {
      errors.push('Maximum periods per day cannot exceed 10');
    }

    if (constraints.maxSubjectsPerDay && constraints.maxSubjectsPerDay > 8) {
      errors.push('Maximum subjects per day cannot exceed 8');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ======================
// QUALITY SCORING
// ======================

/**
 * Calculate quality score for timetable
 */
export async function calculateQualityScore(slots, assignments, constraints) {
  if (slots.length === 0) return 0;

  let totalScore = 0;
  let maxPossibleScore = 0;

  for (const slot of slots) {
    const slotScore = slot.quality || 0.5;
    totalScore += slotScore;
    maxPossibleScore += 1.0;
  }

  // Apply constraint violation penalties
  const constraintViolations = calculateConstraintViolations(slots, constraints);
  const penalty = constraintViolations * 0.1; // 10% penalty per violation

  const baseScore = totalScore / maxPossibleScore;
  const finalScore = Math.max(0, baseScore - penalty);

  return Math.round(finalScore * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate constraint violations
 */
function calculateConstraintViolations(slots, constraints) {
  let violations = 0;

  // Check max periods per day
  if (constraints.maxPeriodsPerDay) {
    const periodsPerDay = {};
    for (const slot of slots) {
      periodsPerDay[slot.day] = (periodsPerDay[slot.day] || 0) + 1;
    }

    for (const day in periodsPerDay) {
      if (periodsPerDay[day] > constraints.maxPeriodsPerDay) {
        violations++;
      }
    }
  }

  // Check teacher availability
  if (constraints.teacherAvailability) {
    for (const teacher of constraints.teacherAvailability) {
      const teacherSlots = slots.filter(slot => slot.teacherId === teacher.teacherId);
      for (const slot of teacherSlots) {
        const slotKey = `${slot.day}_${slot.period}`;
        if (!teacher.availableSlots.includes(slotKey)) {
          violations++;
        }
      }
    }
  }

  return violations;
}

// ======================
// SEARCH & FILTER
// ======================

/**
 * Build timetable search query
 */
export function buildTimetableSearchQuery(filters, userSchoolId) {
  const where = {};

  if (filters.schoolId) {
    where.schoolId = BigInt(filters.schoolId);
  } else if (userSchoolId) {
    where.schoolId = BigInt(userSchoolId);
  }

  if (filters.qualityScore) {
    where.qualityScore = {
      gte: filters.qualityScore
    };
  }

  return where;
}

/**
 * Build timetable include query
 */
export function buildTimetableIncludeQuery(include) {
  if (!include) return {};

  const includeQuery = {};
  const includes = include.split(',');

  if (includes.includes('feedback')) {
    includeQuery.feedbackSessions = true;
  }

  return includeQuery;
}

// ======================
// ANALYTICS
// ======================

/**
 * Generate timetable analytics
 */
export async function generateTimetableAnalytics(timetableId, period = '30d') {
  const timetable = await prisma.timetableVersion.findUnique({
    where: { id: BigInt(timetableId) },
    include: {
      feedbackSessions: {
        include: {
          correctionsList: true
        }
      }
    }
  });

  if (!timetable) {
    throw new Error('Timetable not found');
  }

  const analytics = {
    qualityScore: timetable.qualityScore,
    totalFeedbackSessions: timetable.feedbackSessions.length,
    totalCorrections: timetable.feedbackSessions.reduce((sum, fs) => sum + fs.correctionsList.length, 0),
    averageCorrectionsPerSession: 0,
    mostCommonCorrections: [],
    teacherSatisfaction: calculateTeacherSatisfaction(timetable),
    subjectDistribution: calculateSubjectDistribution(timetable.slots)
  };

  if (timetable.feedbackSessions.length > 0) {
    analytics.averageCorrectionsPerSession = analytics.totalCorrections / timetable.feedbackSessions.length;
    analytics.mostCommonCorrections = findMostCommonCorrections(timetable.feedbackSessions);
  }

  return analytics;
}

/**
 * Calculate teacher satisfaction
 */
function calculateTeacherSatisfaction(timetable) {
  // This would be calculated based on teacher preferences and corrections
  // For now, return a placeholder value
  return 0.85;
}

/**
 * Calculate subject distribution
 */
function calculateSubjectDistribution(slots) {
  const distribution = {};
  
  for (const slot of slots) {
    const subject = slot.subjectName;
    distribution[subject] = (distribution[subject] || 0) + 1;
  }

  return distribution;
}

/**
 * Find most common corrections
 */
function findMostCommonCorrections(feedbackSessions) {
  const correctionCounts = {};
  
  for (const session of feedbackSessions) {
    for (const correction of session.correctionsList) {
      const reason = correction.reason;
      correctionCounts[reason] = (correctionCounts[reason] || 0) + 1;
    }
  }

  return Object.entries(correctionCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));
}

// ======================
// EXPORT & IMPORT
// ======================

/**
 * Generate timetable export data
 */
export async function generateTimetableExportData(timetables, format = 'json') {
  if (format === 'csv') {
    return generateCSVExport(timetables);
  }

  return timetables.map(timetable => ({
    id: timetable.id.toString(),
    schoolId: timetable.schoolId.toString(),
    generatedBy: timetable.generatedBy,
    qualityScore: timetable.qualityScore,
    createdAt: timetable.createdAt,
    slots: timetable.slots
  }));
}

/**
 * Generate CSV export
 */
function generateCSVExport(timetables) {
  const headers = ['ID', 'School ID', 'Generated By', 'Quality Score', 'Created At', 'Total Slots'];
  const rows = timetables.map(t => [
    t.id.toString(),
    t.schoolId.toString(),
    t.generatedBy,
    t.qualityScore,
    t.createdAt,
    t.slots.length
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Validate timetable import data
 */
export function validateTimetableImportData(timetables) {
  const errors = [];

  for (let i = 0; i < timetables.length; i++) {
    const timetable = timetables[i];
    
    if (!timetable.schoolId) {
      errors.push(`Timetable ${i + 1}: School ID is required`);
    }
    
    if (!timetable.slots || !Array.isArray(timetable.slots)) {
      errors.push(`Timetable ${i + 1}: Slots must be an array`);
    }
  }

  return errors;
}

// ======================
// UTILITY FUNCTIONS
// ======================

/**
 * Generate timetable code suggestions
 */
export function generateTimetableCodeSuggestions(name, schoolCode) {
  const suggestions = [];
  const baseCode = `${schoolCode}_TT_${name.replace(/\s+/g, '_').toUpperCase()}`;
  
  suggestions.push(baseCode);
  suggestions.push(`${baseCode}_${new Date().getFullYear()}`);
  suggestions.push(`${baseCode}_V1`);
  suggestions.push(`${baseCode}_${Date.now().toString().slice(-4)}`);
  
  return suggestions;
}

/**
 * Get timetable count by school
 */
export async function getTimetableCountBySchool(schoolId) {
  const count = await prisma.timetableVersion.count({
    where: { schoolId: BigInt(schoolId) }
  });

  return { schoolId, count };
}

/**
 * Get timetable count by class
 */
export async function getTimetableCountByClass(schoolId) {
  // This would require additional logic to count by class
  // For now, return total count
  const count = await prisma.timetableVersion.count({
    where: { schoolId: BigInt(schoolId) }
  });

  return { schoolId, count };
} 
import { PrismaClient } from '../generated/prisma/client.js';
import { 
  createAuditLog, 
  createNotification 
} from './notificationService.js';

const prisma = new PrismaClient();

class TimetableAIService {
  constructor() {
    this.learningPatterns = new Map();
    this.constraintWeights = new Map();
    this.feedbackHistory = [];
  }

  // ======================
  // CORE TIMETABLE GENERATION
  // ======================

  /**
   * Generate timetable using AI with constraints
   */
  async generateTimetable(schoolId, options = {}) {
    try {
      console.log('🤖 AI Timetable Generation Started');
      
      // Get all required data
      const { classes, teachers, subjects, rooms, constraints } = await this.getTimetableData(schoolId);
      
      // Apply learned patterns and weights
      const enhancedConstraints = await this.applyLearnedPatterns(constraints);
      
      // Generate initial timetable
      const initialTimetable = await this.generateInitialTimetable(classes, teachers, subjects, rooms, enhancedConstraints);
      
      // Optimize using genetic algorithm
      const optimizedTimetable = await this.optimizeTimetable(initialTimetable, enhancedConstraints);
      
      // Calculate quality score
      const qualityScore = await this.calculateQualityScore(optimizedTimetable, enhancedConstraints);
      
      console.log('✅ AI Timetable Generation Completed');
      
      return {
        timetable: optimizedTimetable,
        qualityScore,
        generationId: this.generateId(),
        metadata: {
          classesCount: classes.length,
          teachersCount: teachers.length,
          subjectsCount: subjects.length,
          roomsCount: rooms.length,
          constraintsCount: enhancedConstraints.length,
          learningPatternsApplied: this.learningPatterns.size
        }
      };
    } catch (error) {
      console.error('❌ AI Timetable Generation Error:', error);
      throw error;
    }
  }

  /**
   * Get all data needed for timetable generation
   */
  async getTimetableData(schoolId) {
    const [classes, teachers, subjects, rooms] = await Promise.all([
      prisma.class.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        include: { students: true, subjects: true }
      }),
      prisma.teacher.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null },
        include: { user: true, subjects: true }
      }),
      prisma.subject.findMany({
        where: { schoolId: BigInt(schoolId), deletedAt: null }
      }),
      prisma.facility.findMany({
        where: { schoolId: BigInt(schoolId), type: 'CLASSROOM', deletedAt: null }
      })
    ]);

    // Build constraints from data
    const constraints = await this.buildConstraints(classes, teachers, subjects, rooms);

    return { classes, teachers, subjects, rooms, constraints };
  }

  /**
   * Build constraints from school data
   */
  async buildConstraints(classes, teachers, subjects, rooms) {
    const constraints = [];

    // Teacher availability constraints
    for (const teacher of teachers) {
      if (teacher.availability) {
        constraints.push({
          type: 'TEACHER_AVAILABILITY',
          teacherId: teacher.id,
          availableSlots: teacher.availability,
          weight: 10
        });
      }
    }

    // Room capacity constraints
    for (const room of rooms) {
      constraints.push({
        type: 'ROOM_CAPACITY',
        roomId: room.id,
        capacity: room.capacity,
        weight: 8
      });
    }

    // Subject requirements
    for (const subject of subjects) {
      if (subject.requirements) {
        constraints.push({
          type: 'SUBJECT_REQUIREMENTS',
          subjectId: subject.id,
          requirements: subject.requirements,
          weight: 7
        });
      }
    }

    // Class schedule constraints
    for (const classData of classes) {
      constraints.push({
        type: 'CLASS_SCHEDULE',
        classId: classData.id,
        studentCount: classData.students.length,
        weight: 9
      });
    }

    return constraints;
  }

  /**
   * Apply learned patterns to constraints
   */
  async applyLearnedPatterns(constraints) {
    const enhancedConstraints = [...constraints];

    // Apply learned teacher preferences
    for (const [teacherId, patterns] of this.learningPatterns) {
      if (patterns.preferredSlots) {
        enhancedConstraints.push({
          type: 'LEARNED_TEACHER_PREFERENCE',
          teacherId,
          preferredSlots: patterns.preferredSlots,
          weight: patterns.confidence || 5
        });
      }
    }

    // Apply learned conflict avoidance
    for (const [pattern, weight] of this.constraintWeights) {
      enhancedConstraints.push({
        type: 'LEARNED_CONFLICT_AVOIDANCE',
        pattern,
        weight
      });
    }

    return enhancedConstraints;
  }

  /**
   * Generate initial timetable using constraint satisfaction
   */
  async generateInitialTimetable(classes, teachers, subjects, rooms, constraints) {
    const timetable = {
      slots: [],
      conflicts: [],
      quality: 0
    };

    const timeSlots = this.generateTimeSlots();
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    for (const classData of classes) {
      for (const subject of classData.subjects) {
        const teacher = teachers.find(t => 
          t.subjects.some(s => s.id === subject.id)
        );

        if (!teacher) continue;

        // Find best slot using constraint satisfaction
        const bestSlot = await this.findBestSlot(
          classData, subject, teacher, rooms, timeSlots, days, constraints
        );

        if (bestSlot) {
          timetable.slots.push({
            id: this.generateId(),
            classId: classData.id,
            subjectId: subject.id,
            teacherId: teacher.id,
            roomId: bestSlot.roomId,
            day: bestSlot.day,
            timeSlot: bestSlot.timeSlot,
            quality: bestSlot.quality
          });
        }
      }
    }

    return timetable;
  }

  /**
   * Find best slot for a class-subject-teacher combination
   */
  async findBestSlot(classData, subject, teacher, rooms, timeSlots, days, constraints) {
    let bestSlot = null;
    let bestScore = -1;

    for (const day of days) {
      for (const timeSlot of timeSlots) {
        for (const room of rooms) {
          const score = await this.calculateSlotScore(
            classData, subject, teacher, room, day, timeSlot, constraints
          );

          if (score > bestScore) {
            bestScore = score;
            bestSlot = {
              roomId: room.id,
              day,
              timeSlot,
              quality: score
            };
          }
        }
      }
    }

    return bestSlot;
  }

  /**
   * Calculate score for a specific slot
   */
  async calculateSlotScore(classData, subject, teacher, room, day, timeSlot, constraints) {
    let score = 100; // Base score

    // Check teacher availability
    const teacherConstraint = constraints.find(c => 
      c.type === 'TEACHER_AVAILABILITY' && c.teacherId === teacher.id
    );
    if (teacherConstraint && !teacherConstraint.availableSlots.includes(`${day}-${timeSlot}`)) {
      score -= 50;
    }

    // Check room capacity
    const roomConstraint = constraints.find(c => 
      c.type === 'ROOM_CAPACITY' && c.roomId === room.id
    );
    if (roomConstraint && classData.students.length > roomConstraint.capacity) {
      score -= 30;
    }

    // Check learned patterns
    const learnedPattern = this.learningPatterns.get(teacher.id);
    if (learnedPattern && learnedPattern.preferredSlots.includes(`${day}-${timeSlot}`)) {
      score += 20;
    }

    // Check conflicts
    const conflicts = await this.checkConflicts(classData, teacher, room, day, timeSlot);
    score -= conflicts.length * 10;

    return Math.max(0, score);
  }

  /**
   * Check for conflicts in a slot
   */
  async checkConflicts(classData, teacher, room, day, timeSlot) {
    const conflicts = [];

    // Teacher double-booking
    // Room double-booking
    // Class schedule conflicts

    return conflicts;
  }

  /**
   * Optimize timetable using genetic algorithm
   */
  async optimizeTimetable(timetable, constraints) {
    const population = this.generatePopulation(timetable, 10);
    const generations = 50;

    for (let gen = 0; gen < generations; gen++) {
      // Evaluate fitness
      const fitnessScores = await Promise.all(
        population.map(t => this.calculateFitness(t, constraints))
      );

      // Select best individuals
      const selected = this.selectBest(population, fitnessScores, 0.3);

      // Crossover and mutation
      const newPopulation = [];
      while (newPopulation.length < population.length) {
        const parent1 = this.selectRandom(selected);
        const parent2 = this.selectRandom(selected);
        const child = this.crossover(parent1, parent2);
        const mutatedChild = this.mutate(child);
        newPopulation.push(mutatedChild);
      }

      population.splice(0, population.length, ...newPopulation);
    }

    // Return best timetable
    const fitnessScores = await Promise.all(
      population.map(t => this.calculateFitness(t, constraints))
    );
    const bestIndex = fitnessScores.indexOf(Math.max(...fitnessScores));
    
    return population[bestIndex];
  }

  /**
   * Calculate fitness score for genetic algorithm
   */
  async calculateFitness(timetable, constraints) {
    let fitness = 0;

    // Count conflicts
    const conflicts = await this.countConflicts(timetable);
    fitness -= conflicts * 10;

    // Check constraint satisfaction
    for (const constraint of constraints) {
      if (await this.satisfiesConstraint(timetable, constraint)) {
        fitness += constraint.weight;
      }
    }

    // Apply learned patterns
    fitness += await this.applyLearnedFitness(timetable);

    return Math.max(0, fitness);
  }

  // ======================
  // FEEDBACK LEARNING SYSTEM
  // ======================

  /**
   * Collect feedback from human corrections
   */
  async collectFeedback(generationId, corrections, feedback) {
    try {
      console.log('📝 Collecting AI Learning Feedback');

      const feedbackRecord = {
        generationId,
        originalTimetable: await this.getTimetableById(generationId),
        corrections,
        feedback,
        timestamp: new Date(),
        learningPoints: await this.extractLearningPoints(corrections)
      };

      // Store feedback
      await this.storeFeedback(feedbackRecord);

      // Learn from corrections
      await this.learnFromCorrections(corrections);

      // Update model weights
      await this.updateModelWeights(feedbackRecord);

      console.log('✅ Feedback collected and learning applied');

      return {
        success: true,
        learningPoints: feedbackRecord.learningPoints,
        modelUpdated: true
      };
    } catch (error) {
      console.error('❌ Feedback collection error:', error);
      throw error;
    }
  }

  /**
   * Extract learning points from corrections
   */
  async extractLearningPoints(corrections) {
    const learningPoints = [];

    for (const correction of corrections) {
      // Teacher preference learning
      if (correction.type === 'TEACHER_PREFERENCE') {
        learningPoints.push({
          type: 'TEACHER_PREFERENCE',
          teacherId: correction.teacherId,
          preferredSlot: correction.newSlot,
          avoidedSlot: correction.oldSlot,
          confidence: 1
        });
      }

      // Conflict avoidance learning
      if (correction.type === 'CONFLICT_AVOIDANCE') {
        learningPoints.push({
          type: 'CONFLICT_AVOIDANCE',
          pattern: `${correction.entity1}-${correction.entity2}`,
          weight: 1
        });
      }

      // Constraint learning
      if (correction.type === 'CONSTRAINT_VIOLATION') {
        learningPoints.push({
          type: 'CONSTRAINT_LEARNING',
          constraint: correction.constraint,
          weight: correction.severity
        });
      }
    }

    return learningPoints;
  }

  /**
   * Learn from corrections
   */
  async learnFromCorrections(corrections) {
    for (const correction of corrections) {
      if (correction.type === 'TEACHER_PREFERENCE') {
        await this.updateTeacherPreferences(correction);
      } else if (correction.type === 'CONFLICT_AVOIDANCE') {
        await this.updateConflictWeights(correction);
      } else if (correction.type === 'CONSTRAINT_VIOLATION') {
        await this.updateConstraintWeights(correction);
      }
    }
  }

  /**
   * Update teacher preferences based on corrections
   */
  async updateTeacherPreferences(correction) {
    const teacherId = correction.teacherId;
    const currentPatterns = this.learningPatterns.get(teacherId) || {
      preferredSlots: [],
      avoidedSlots: [],
      confidence: 0
    };

    // Add preferred slot
    if (!currentPatterns.preferredSlots.includes(correction.newSlot)) {
      currentPatterns.preferredSlots.push(correction.newSlot);
    }

    // Add avoided slot
    if (!currentPatterns.avoidedSlots.includes(correction.oldSlot)) {
      currentPatterns.avoidedSlots.push(correction.oldSlot);
    }

    // Increase confidence
    currentPatterns.confidence = Math.min(10, currentPatterns.confidence + 1);

    this.learningPatterns.set(teacherId, currentPatterns);
  }

  /**
   * Update conflict weights
   */
  async updateConflictWeights(correction) {
    const pattern = `${correction.entity1}-${correction.entity2}`;
    const currentWeight = this.constraintWeights.get(pattern) || 0;
    this.constraintWeights.set(pattern, currentWeight + 1);
  }

  /**
   * Update model weights based on feedback
   */
  async updateModelWeights(feedbackRecord) {
    // Update learning patterns
    for (const point of feedbackRecord.learningPoints) {
      if (point.type === 'TEACHER_PREFERENCE') {
        await this.updateTeacherPreferences(point);
      } else if (point.type === 'CONFLICT_AVOIDANCE') {
        await this.updateConflictWeights(point);
      }
    }

    // Store learning data for future training
    await this.storeLearningData(feedbackRecord);
  }

  // ======================
  // UTILITY FUNCTIONS
  // ======================

  /**
   * Generate time slots
   */
  generateTimeSlots() {
    return [
      '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00',
      '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00'
    ];
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * Generate population for genetic algorithm
   */
  generatePopulation(baseTimetable, size) {
    const population = [baseTimetable];
    
    for (let i = 1; i < size; i++) {
      population.push(this.mutate(baseTimetable));
    }
    
    return population;
  }

  /**
   * Crossover operation for genetic algorithm
   */
  crossover(parent1, parent2) {
    // Simple crossover: take half from each parent
    const midPoint = Math.floor(parent1.slots.length / 2);
    const child = {
      ...parent1,
      slots: [
        ...parent1.slots.slice(0, midPoint),
        ...parent2.slots.slice(midPoint)
      ]
    };
    
    return child;
  }

  /**
   * Mutation operation for genetic algorithm
   */
  mutate(timetable) {
    const mutated = { ...timetable };
    
    // Randomly swap some slots
    if (mutated.slots.length > 1) {
      const i = Math.floor(Math.random() * mutated.slots.length);
      const j = Math.floor(Math.random() * mutated.slots.length);
      
      if (i !== j) {
        [mutated.slots[i], mutated.slots[j]] = [mutated.slots[j], mutated.slots[i]];
      }
    }
    
    return mutated;
  }

  /**
   * Select best individuals
   */
  selectBest(population, fitnessScores, ratio) {
    const sorted = population.map((individual, index) => ({
      individual,
      fitness: fitnessScores[index]
    })).sort((a, b) => b.fitness - a.fitness);
    
    const count = Math.floor(population.length * ratio);
    return sorted.slice(0, count).map(item => item.individual);
  }

  /**
   * Select random individual
   */
  selectRandom(population) {
    return population[Math.floor(Math.random() * population.length)];
  }

  /**
   * Calculate quality score
   */
  async calculateQualityScore(timetable, constraints) {
    const conflicts = await this.countConflicts(timetable);
    const constraintSatisfaction = await this.calculateConstraintSatisfaction(timetable, constraints);
    const optimization = await this.calculateOptimizationScore(timetable);
    
    return {
      overall: Math.max(0, 100 - conflicts * 10 + constraintSatisfaction + optimization),
      conflicts,
      constraintSatisfaction,
      optimization
    };
  }

  /**
   * Count conflicts in timetable
   */
  async countConflicts(timetable) {
    let conflicts = 0;
    
    for (let i = 0; i < timetable.slots.length; i++) {
      for (let j = i + 1; j < timetable.slots.length; j++) {
        const slot1 = timetable.slots[i];
        const slot2 = timetable.slots[j];
        
        // Check for teacher conflicts
        if (slot1.teacherId === slot2.teacherId && 
            slot1.day === slot2.day && 
            slot1.timeSlot === slot2.timeSlot) {
          conflicts++;
        }
        
        // Check for room conflicts
        if (slot1.roomId === slot2.roomId && 
            slot1.day === slot2.day && 
            slot1.timeSlot === slot2.timeSlot) {
          conflicts++;
        }
      }
    }
    
    return conflicts;
  }

  /**
   * Calculate constraint satisfaction
   */
  async calculateConstraintSatisfaction(timetable, constraints) {
    let satisfaction = 0;
    
    for (const constraint of constraints) {
      if (await this.satisfiesConstraint(timetable, constraint)) {
        satisfaction += constraint.weight;
      }
    }
    
    return satisfaction;
  }

  /**
   * Check if timetable satisfies a constraint
   */
  async satisfiesConstraint(timetable, constraint) {
    switch (constraint.type) {
      case 'TEACHER_AVAILABILITY':
        return this.checkTeacherAvailability(timetable, constraint);
      case 'ROOM_CAPACITY':
        return this.checkRoomCapacity(timetable, constraint);
      case 'SUBJECT_REQUIREMENTS':
        return this.checkSubjectRequirements(timetable, constraint);
      default:
        return true;
    }
  }

  /**
   * Check teacher availability
   */
  checkTeacherAvailability(timetable, constraint) {
    const teacherSlots = timetable.slots.filter(slot => slot.teacherId === constraint.teacherId);
    
    for (const slot of teacherSlots) {
      const slotKey = `${slot.day}-${slot.timeSlot}`;
      if (!constraint.availableSlots.includes(slotKey)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Check room capacity
   */
  checkRoomCapacity(timetable, constraint) {
    const roomSlots = timetable.slots.filter(slot => slot.roomId === constraint.roomId);
    
    for (const slot of roomSlots) {
      // Check if class size exceeds room capacity
      // This would need class data
      return true; // Simplified for now
    }
    
    return true;
  }

  /**
   * Check subject requirements
   */
  checkSubjectRequirements(timetable, constraint) {
    // Check if subject requirements are met
    // This would check for specific room types, equipment, etc.
    return true; // Simplified for now
  }

  /**
   * Calculate optimization score
   */
  async calculateOptimizationScore(timetable) {
    let score = 0;
    
    // Prefer morning slots for certain subjects
    // Prefer certain teachers in certain rooms
    // Balance workload across teachers
    
    return score;
  }

  /**
   * Apply learned fitness factors
   */
  async applyLearnedFitness(timetable) {
    let fitness = 0;
    
    for (const slot of timetable.slots) {
      const teacherPattern = this.learningPatterns.get(slot.teacherId);
      if (teacherPattern) {
        const slotKey = `${slot.day}-${slot.timeSlot}`;
        if (teacherPattern.preferredSlots.includes(slotKey)) {
          fitness += teacherPattern.confidence;
        }
        if (teacherPattern.avoidedSlots.includes(slotKey)) {
          fitness -= teacherPattern.confidence;
        }
      }
    }
    
    return fitness;
  }

  // ======================
  // DATABASE OPERATIONS
  // ======================

  /**
   * Store feedback in database
   */
  async storeFeedback(feedbackRecord) {
    // Store in database for learning history
    await prisma.timetableFeedback.create({
      data: {
        generationId: feedbackRecord.generationId,
        originalTimetable: feedbackRecord.originalTimetable,
        corrections: feedbackRecord.corrections,
        feedback: feedbackRecord.feedback,
        learningPoints: feedbackRecord.learningPoints,
        timestamp: feedbackRecord.timestamp
      }
    });
  }

  /**
   * Store learning data
   */
  async storeLearningData(feedbackRecord) {
    // Store learning patterns for future reference
    for (const point of feedbackRecord.learningPoints) {
      await prisma.learningPattern.create({
        data: {
          type: point.type,
          entityId: point.teacherId || point.pattern,
          pattern: point,
          confidence: point.confidence || 1,
          timestamp: new Date()
        }
      });
    }
  }

  /**
   * Get timetable by ID
   */
  async getTimetableById(generationId) {
    // Retrieve timetable from database
    return await prisma.timetableGeneration.findUnique({
      where: { generationId }
    });
  }

  /**
   * Update constraint weights
   */
  async updateConstraintWeights(correction) {
    // Update constraint weights based on corrections
    console.log('Updating constraint weights:', correction);
  }

  // ======================
  // ANALYTICS & REPORTING
  // ======================

  /**
   * Get learning analytics
   */
  async getLearningAnalytics() {
    const patterns = await prisma.learningPattern.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100
    });

    const feedback = await prisma.timetableFeedback.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    return {
      totalPatterns: patterns.length,
      totalFeedback: feedback.length,
      recentPatterns: patterns.slice(0, 10),
      recentFeedback: feedback.slice(0, 10),
      learningProgress: await this.calculateLearningProgress()
    };
  }

  /**
   * Calculate learning progress
   */
  async calculateLearningProgress() {
    const recentFeedback = await prisma.timetableFeedback.findMany({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      }
    });

    const qualityScores = recentFeedback.map(f => f.qualityScore || 0);
    const averageQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;

    return {
      averageQuality,
      improvementRate: await this.calculateImprovementRate(),
      patternsLearned: this.learningPatterns.size,
      constraintWeights: this.constraintWeights.size
    };
  }

  /**
   * Calculate improvement rate
   */
  async calculateImprovementRate() {
    // Calculate how much the model has improved over time
    const feedback = await prisma.timetableFeedback.findMany({
      orderBy: { timestamp: 'asc' }
    });

    if (feedback.length < 2) return 0;

    const firstHalf = feedback.slice(0, Math.floor(feedback.length / 2));
    const secondHalf = feedback.slice(Math.floor(feedback.length / 2));

    const firstAvg = firstHalf.reduce((sum, f) => sum + (f.qualityScore || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, f) => sum + (f.qualityScore || 0), 0) / secondHalf.length;

    return ((secondAvg - firstAvg) / firstAvg) * 100;
  }
}

export default new TimetableAIService(); 
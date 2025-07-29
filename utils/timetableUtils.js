import { z } from 'zod';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

// ======================
// VALIDATION SCHEMAS
// ======================

export const TimetableGenerateSchema = z.object({
  schoolId: z.number().int().positive(),
  classIds: z.array(z.number().int().positive()).optional(),
  academicSessionId: z.number().int().positive().optional(),
  termId: z.number().int().positive().optional(),
  constraints: z.object({
    maxPeriodsPerDay: z.number().int().positive().default(8),
    maxSubjectsPerDay: z.number().int().positive().default(6),
    breakPeriods: z.array(z.number().int().positive()).default([3, 6]), // After which periods to have breaks
    preferredTimeSlots: z.record(z.string(), z.array(z.number())).optional(), // subject -> preferred periods
    avoidTimeSlots: z.record(z.string(), z.array(z.number())).optional(), // subject -> avoid periods
    teacherAvailability: z.record(z.string(), z.array(z.number())).optional(), // teacherId -> available periods
    roomConstraints: z.record(z.string(), z.array(z.string())).optional(), // room -> subjects that can be taught there
  }).optional(),
  optimization: z.object({
    algorithm: z.enum(['genetic', 'constraint-satisfaction', 'heuristic']).default('genetic'),
    maxIterations: z.number().int().positive().default(1000),
    populationSize: z.number().int().positive().default(50),
    mutationRate: z.number().min(0).max(1).default(0.1),
    crossoverRate: z.number().min(0).max(1).default(0.8),
  }).optional(),
});

export const TimetableUpdateSchema = z.object({
  day: z.number().int().min(1).max(7).optional(),
  period: z.number().int().positive().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  classId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().optional(),
  roomNumber: z.string().optional(),
});

export const TimetableSearchSchema = z.object({
  schoolId: z.number().int().positive(),
  classId: z.number().int().positive().optional(),
  teacherId: z.number().int().positive().optional(),
  subjectId: z.number().int().positive().optional(),
  day: z.number().int().min(1).max(7).optional(),
  period: z.number().int().positive().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(20),
  sort: z.string().default('day'),
  order: z.enum(['asc', 'desc']).default('asc'),
  include: z.string().optional(),
});

// ======================
// DATA FETCHING FUNCTIONS
// ======================

export const fetchTimetableData = async (schoolId, classIds = null) => {
  try {
    // Fetch classes
    const classWhere = classIds 
      ? { schoolId: BigInt(schoolId), id: { in: classIds.map(id => BigInt(id)) }, deletedAt: null }
      : { schoolId: BigInt(schoolId), deletedAt: null };
    
    const classes = await prisma.class.findMany({
      where: classWhere,
      include: {
        students: {
          where: { deletedAt: null },
          select: { id: true, admissionNo: true }
        },
        classTeacher: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });

    // Fetch teacher-class-subject assignments
    const teacherAssignments = await prisma.teacherClassSubject.findMany({
      where: {
        schoolId: BigInt(schoolId),
        isActive: true,
        deletedAt: null,
        classId: classIds ? { in: classIds.map(id => BigInt(id)) } : undefined
      },
      include: {
        teacher: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true }
            },
            department: true
          }
        },
        class: true,
        subject: true
      }
    });

    // Fetch existing timetables to avoid conflicts
    const existingTimetables = await prisma.timetable.findMany({
      where: {
        schoolId: BigInt(schoolId),
        deletedAt: null,
        classId: classIds ? { in: classIds.map(id => BigInt(id)) } : undefined
      }
    });

    return {
      classes,
      teacherAssignments,
      existingTimetables
    };
  } catch (error) {
    console.error('Error fetching timetable data:', error);
    throw new Error('Failed to fetch timetable data');
  }
};

// ======================
// AI TIMETABLE GENERATION
// ======================

export const generateTimetable = async (params) => {
  const { algorithm = 'genetic', ...options } = params.optimization || {};
  
  switch (algorithm) {
    case 'genetic':
      return await generateGeneticTimetable(params);
    case 'constraint-satisfaction':
      return await generateConstraintSatisfactionTimetable(params);
    case 'heuristic':
      return await generateHeuristicTimetable(params);
    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
};

const generateGeneticTimetable = async (params) => {
  const { maxIterations = 1000, populationSize = 50, mutationRate = 0.1, crossoverRate = 0.8 } = params.optimization || {};
  
  const { classes, teacherAssignments, existingTimetables } = await fetchTimetableData(params.schoolId, params.classIds);
  
  let population = initializePopulation(classes, teacherAssignments, populationSize);
  let bestSolution = null;
  let bestFitness = -Infinity;
  
  for (let generation = 0; generation < maxIterations; generation++) {
    const fitnessScores = population.map(solution => ({
      solution,
      fitness: calculateFitness(solution, params.constraints, existingTimetables)
    }));
    
    fitnessScores.sort((a, b) => b.fitness - a.fitness);
    
    if (fitnessScores[0].fitness > bestFitness) {
      bestFitness = fitnessScores[0].fitness;
      bestSolution = fitnessScores[0].solution;
    }
    
    if (bestFitness > 0.95) break;
    
    const newPopulation = [];
    const eliteCount = Math.floor(populationSize * 0.1);
    
    for (let i = 0; i < eliteCount; i++) {
      newPopulation.push(fitnessScores[i].solution);
    }
    
    while (newPopulation.length < populationSize) {
      const parent1 = selectParent(fitnessScores);
      const parent2 = selectParent(fitnessScores);
      let child = crossover(parent1, parent2, crossoverRate);
      child = mutate(child, mutationRate);
      newPopulation.push(child);
    }
    
    population = newPopulation;
  }
  
  return {
    timetable: bestSolution,
    fitness: bestFitness,
    algorithm: 'genetic',
    iterations: maxIterations
  };
};

const generateConstraintSatisfactionTimetable = async (params) => {
  const { classes, teacherAssignments, existingTimetables } = await fetchTimetableData(params.schoolId, params.classIds);
  
  const timetable = [];
  const constraints = params.constraints || {};
  const maxPeriodsPerDay = constraints.maxPeriodsPerDay || 8;
  const days = [1, 2, 3, 4, 5];
  
  const classAssignments = new Map();
  teacherAssignments.forEach(assignment => {
    if (!classAssignments.has(assignment.classId.toString())) {
      classAssignments.set(assignment.classId.toString(), []);
    }
    classAssignments.get(assignment.classId.toString()).push(assignment);
  });
  
  for (const [classId, assignments] of classAssignments) {
    for (const day of days) {
      for (let period = 1; period <= maxPeriodsPerDay; period++) {
        if (constraints.breakPeriods?.includes(period)) continue;
        
        const availableAssignment = findAvailableAssignment(
          assignments,
          day,
          period,
          timetable,
          existingTimetables,
          constraints
        );
        
        if (availableAssignment) {
          timetable.push({
            day,
            period,
            classId: BigInt(classId),
            subjectId: availableAssignment.subjectId,
            teacherId: availableAssignment.teacherId,
            schoolId: BigInt(params.schoolId),
            startTime: calculateStartTime(period),
            endTime: calculateEndTime(period)
          });
        }
      }
    }
  }
  
  return {
    timetable,
    fitness: calculateFitness(timetable, constraints, existingTimetables),
    algorithm: 'constraint-satisfaction'
  };
};

const generateHeuristicTimetable = async (params) => {
  const { classes, teacherAssignments, existingTimetables } = await fetchTimetableData(params.schoolId, params.classIds);
  
  const timetable = [];
  const constraints = params.constraints || {};
  const maxPeriodsPerDay = constraints.maxPeriodsPerDay || 8;
  const days = [1, 2, 3, 4, 5];
  
  const sortedAssignments = teacherAssignments.sort((a, b) => 
    (b.subject.creditHours || 0) - (a.subject.creditHours || 0)
  );
  
  const classAssignments = new Map();
  sortedAssignments.forEach(assignment => {
    if (!classAssignments.has(assignment.classId.toString())) {
      classAssignments.set(assignment.classId.toString(), []);
    }
    classAssignments.get(assignment.classId.toString()).push(assignment);
  });
  
  for (const [classId, assignments] of classAssignments) {
    const classTimetable = generateClassTimetable(
      assignments,
      days,
      maxPeriodsPerDay,
      constraints,
      existingTimetables,
      params.schoolId
    );
    timetable.push(...classTimetable);
  }
  
  return {
    timetable,
    fitness: calculateFitness(timetable, constraints, existingTimetables),
    algorithm: 'heuristic'
  };
};

// ======================
// HELPER FUNCTIONS
// ======================

const initializePopulation = (classes, teacherAssignments, populationSize) => {
  const population = [];
  
  for (let i = 0; i < populationSize; i++) {
    const solution = [];
    const classAssignments = new Map();
    
    teacherAssignments.forEach(assignment => {
      if (!classAssignments.has(assignment.classId.toString())) {
        classAssignments.set(assignment.classId.toString(), []);
      }
      classAssignments.get(assignment.classId.toString()).push(assignment);
    });
    
    for (const [classId, assignments] of classAssignments) {
      const days = [1, 2, 3, 4, 5];
      const maxPeriodsPerDay = 8;
      
      for (const day of days) {
        for (let period = 1; period <= maxPeriodsPerDay; period++) {
          if (Math.random() > 0.3) {
            const randomAssignment = assignments[Math.floor(Math.random() * assignments.length)];
            solution.push({
              day,
              period,
              classId: BigInt(classId),
              subjectId: randomAssignment.subjectId,
              teacherId: randomAssignment.teacherId,
              schoolId: randomAssignment.schoolId,
              startTime: calculateStartTime(period),
              endTime: calculateEndTime(period)
            });
          }
        }
      }
    }
    
    population.push(solution);
  }
  
  return population;
};

const calculateFitness = (timetable, constraints, existingTimetables) => {
  let fitness = 0;
  const maxFitness = 100;
  
  const { errors } = validateTimetableConstraints(timetable, constraints, existingTimetables);
  if (errors.length > 0) {
    fitness -= errors.length * 10;
  }
  
  const subjectDistribution = analyzeSubjectDistribution(timetable);
  fitness += subjectDistribution.score;
  
  const teacherWorkload = analyzeTeacherWorkload(timetable);
  fitness += teacherWorkload.score;
  
  if (constraints?.preferredTimeSlots) {
    fitness += calculatePreferredTimeSlotScore(timetable, constraints.preferredTimeSlots);
  }
  
  return Math.max(0, Math.min(maxFitness, fitness));
};

const selectParent = (fitnessScores) => {
  const tournamentSize = 3;
  let best = null;
  
  for (let i = 0; i < tournamentSize; i++) {
    const randomIndex = Math.floor(Math.random() * fitnessScores.length);
    const candidate = fitnessScores[randomIndex];
    
    if (!best || candidate.fitness > best.fitness) {
      best = candidate;
    }
  }
  
  return best.solution;
};

const crossover = (parent1, parent2, crossoverRate) => {
  if (Math.random() > crossoverRate) {
    return parent1;
  }
  
  const child = [];
  const crossoverPoint = Math.floor(Math.random() * Math.min(parent1.length, parent2.length));
  
  child.push(...parent1.slice(0, crossoverPoint));
  
  const existingKeys = new Set(child.map(entry => `${entry.classId}-${entry.day}-${entry.period}`));
  
  parent2.slice(crossoverPoint).forEach(entry => {
    const key = `${entry.classId}-${entry.day}-${entry.period}`;
    if (!existingKeys.has(key)) {
      child.push(entry);
      existingKeys.add(key);
    }
  });
  
  return child;
};

const mutate = (solution, mutationRate) => {
  const mutated = [...solution];
  
  for (let i = 0; i < mutated.length; i++) {
    if (Math.random() < mutationRate) {
      if (Math.random() < 0.5) {
        mutated[i].period = Math.floor(Math.random() * 8) + 1;
      } else {
        mutated[i].day = Math.floor(Math.random() * 5) + 1;
      }
    }
  }
  
  return mutated;
};

const findAvailableAssignment = (assignments, day, period, timetable, existingTimetables, constraints) => {
  const shuffledAssignments = [...assignments].sort(() => Math.random() - 0.5);
  
  for (const assignment of shuffledAssignments) {
    const teacherConflict = timetable.some(entry => 
      entry.teacherId === assignment.teacherId && 
      entry.day === day && 
      entry.period === period
    );
    
    if (teacherConflict) continue;
    
    const existingConflict = existingTimetables.some(entry => 
      entry.teacherId === assignment.teacherId && 
      entry.day === day && 
      entry.period === period
    );
    
    if (existingConflict) continue;
    
    return assignment;
  }
  
  return null;
};

const generateClassTimetable = (assignments, days, maxPeriodsPerDay, constraints, existingTimetables, schoolId) => {
  const timetable = [];
  
  for (const day of days) {
    for (let period = 1; period <= maxPeriodsPerDay; period++) {
      if (constraints.breakPeriods?.includes(period)) continue;
      
      const assignment = findAvailableAssignment(
        assignments,
        day,
        period,
        timetable,
        existingTimetables,
        constraints
      );
      
      if (assignment) {
        timetable.push({
          day,
          period,
          classId: assignment.classId,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
          schoolId: BigInt(schoolId),
          startTime: calculateStartTime(period),
          endTime: calculateEndTime(period)
        });
      }
    }
  }
  
  return timetable;
};

const calculateStartTime = (period) => {
  const startHour = 8;
  const periodDuration = 45;
  const breakDuration = 15;
  
  let totalMinutes = (period - 1) * (periodDuration + breakDuration);
  const hour = Math.floor(totalMinutes / 60) + startHour;
  const minute = totalMinutes % 60;
  
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
};

const calculateEndTime = (period) => {
  const startTime = calculateStartTime(period);
  const [hour, minute] = startTime.split(':').map(Number);
  
  const endMinute = minute + 45;
  const endHour = hour + Math.floor(endMinute / 60);
  const finalMinute = endMinute % 60;
  
  return `${endHour.toString().padStart(2, '0')}:${finalMinute.toString().padStart(2, '0')}:00`;
};

const analyzeSubjectDistribution = (timetable) => {
  const distribution = new Map();
  let score = 0;
  
  timetable.forEach(entry => {
    const key = `${entry.classId}-${entry.day}`;
    if (!distribution.has(key)) {
      distribution.set(key, new Set());
    }
    distribution.get(key).add(entry.subjectId.toString());
  });
  
  distribution.forEach((subjects, key) => {
    const subjectCount = subjects.size;
    if (subjectCount >= 4 && subjectCount <= 6) {
      score += 5;
    } else if (subjectCount < 3) {
      score -= 3;
    } else if (subjectCount > 7) {
      score -= 2;
    }
  });
  
  return { score, distribution };
};

const analyzeTeacherWorkload = (timetable) => {
  const workload = new Map();
  let score = 0;
  
  timetable.forEach(entry => {
    const key = `${entry.teacherId}-${entry.day}`;
    workload.set(key, (workload.get(key) || 0) + 1);
  });
  
  const maxPeriodsPerDay = 8;
  workload.forEach((periods, key) => {
    if (periods >= 3 && periods <= 6) {
      score += 3;
    } else if (periods > 7) {
      score -= 5;
    } else if (periods < 2) {
      score -= 2;
    }
  });
  
  return { score, workload };
};

const calculatePreferredTimeSlotScore = (timetable, preferredTimeSlots) => {
  let score = 0;
  
  timetable.forEach(entry => {
    const subjectId = entry.subjectId.toString();
    if (preferredTimeSlots[subjectId]) {
      if (preferredTimeSlots[subjectId].includes(entry.period)) {
        score += 2;
      }
    }
  });
  
  return score;
};

// ======================
// CONSTRAINT VALIDATION
// ======================

export const validateTimetableConstraints = (timetable, constraints, existingTimetables = []) => {
  const errors = [];
  const warnings = [];

  const teacherConflicts = checkTeacherConflicts(timetable, existingTimetables);
  if (teacherConflicts.length > 0) {
    errors.push(...teacherConflicts);
  }

  const roomConflicts = checkRoomConflicts(timetable, existingTimetables);
  if (roomConflicts.length > 0) {
    errors.push(...roomConflicts);
  }

  const classConflicts = checkClassConflicts(timetable, existingTimetables);
  if (classConflicts.length > 0) {
    errors.push(...classConflicts);
  }

  const subjectDistribution = checkSubjectDistribution(timetable, constraints);
  if (subjectDistribution.length > 0) {
    warnings.push(...subjectDistribution);
  }

  const teacherWorkload = checkTeacherWorkload(timetable, constraints);
  if (teacherWorkload.length > 0) {
    warnings.push(...teacherWorkload);
  }

  return { errors, warnings };
};

const checkTeacherConflicts = (timetable, existingTimetables) => {
  const conflicts = [];
  const teacherSchedules = new Map();

  existingTimetables.forEach(entry => {
    const key = `${entry.teacherId}-${entry.day}-${entry.period}`;
    teacherSchedules.set(key, entry);
  });

  timetable.forEach(entry => {
    const key = `${entry.teacherId}-${entry.day}-${entry.period}`;
    if (teacherSchedules.has(key)) {
      conflicts.push(`Teacher conflict: Teacher ${entry.teacherId} already assigned to period ${entry.period} on day ${entry.day}`);
    }
    teacherSchedules.set(key, entry);
  });

  return conflicts;
};

const checkRoomConflicts = (timetable, existingTimetables) => {
  const conflicts = [];
  const roomSchedules = new Map();

  existingTimetables.forEach(entry => {
    if (entry.roomNumber) {
      const key = `${entry.roomNumber}-${entry.day}-${entry.period}`;
      roomSchedules.set(key, entry);
    }
  });

  timetable.forEach(entry => {
    if (entry.roomNumber) {
      const key = `${entry.roomNumber}-${entry.day}-${entry.period}`;
      if (roomSchedules.has(key)) {
        conflicts.push(`Room conflict: Room ${entry.roomNumber} already occupied in period ${entry.period} on day ${entry.day}`);
      }
      roomSchedules.set(key, entry);
    }
  });

  return conflicts;
};

const checkClassConflicts = (timetable, existingTimetables) => {
  const conflicts = [];
  const classSchedules = new Map();

  existingTimetables.forEach(entry => {
    const key = `${entry.classId}-${entry.day}-${entry.period}`;
    classSchedules.set(key, entry);
  });

  timetable.forEach(entry => {
    const key = `${entry.classId}-${entry.day}-${entry.period}`;
    if (classSchedules.has(key)) {
      conflicts.push(`Class conflict: Class ${entry.classId} already has a subject in period ${entry.period} on day ${entry.day}`);
    }
    classSchedules.set(key, entry);
  });

  return conflicts;
};

const checkSubjectDistribution = (timetable, constraints) => {
  const warnings = [];
  const subjectCounts = new Map();

  timetable.forEach(entry => {
    const key = `${entry.classId}-${entry.day}-${entry.subjectId}`;
    subjectCounts.set(key, (subjectCounts.get(key) || 0) + 1);
  });

  subjectCounts.forEach((count, key) => {
    if (count > 1) {
      const [classId, day, subjectId] = key.split('-');
      warnings.push(`Subject ${subjectId} is taught ${count} times on day ${day} for class ${classId}`);
    }
  });

  return warnings;
};

const checkTeacherWorkload = (timetable, constraints) => {
  const warnings = [];
  const teacherPeriods = new Map();

  timetable.forEach(entry => {
    const key = `${entry.teacherId}-${entry.day}`;
    teacherPeriods.set(key, (teacherPeriods.get(key) || 0) + 1);
  });

  const maxPeriodsPerDay = constraints?.maxPeriodsPerDay || 8;
  teacherPeriods.forEach((count, key) => {
    if (count > maxPeriodsPerDay) {
      const [teacherId, day] = key.split('-');
      warnings.push(`Teacher ${teacherId} has ${count} periods on day ${day} (max: ${maxPeriodsPerDay})`);
    }
  });

  return warnings;
};

// ======================
// TIMETABLE MANAGEMENT
// ======================

export const saveTimetable = async (timetable, schoolId, createdBy) => {
  try {
    const classIds = [...new Set(timetable.map(entry => entry.classId))];
    
    await prisma.timetable.deleteMany({
      where: {
        schoolId: BigInt(schoolId),
        classId: { in: classIds },
        deletedAt: null
      }
    });
    
    const timetableData = timetable.map(entry => ({
      ...entry,
      createdBy: BigInt(createdBy),
      updatedBy: BigInt(createdBy)
    }));
    
    const savedTimetable = await prisma.timetable.createMany({
      data: timetableData
    });
    
    return {
      success: true,
      message: `Timetable saved successfully. ${savedTimetable.count} entries created.`,
      count: savedTimetable.count
    };
  } catch (error) {
    console.error('Error saving timetable:', error);
    throw new Error('Failed to save timetable');
  }
};

export const getTimetable = async (schoolId, filters = {}) => {
  try {
    const where = {
      schoolId: BigInt(schoolId),
      deletedAt: null,
      ...filters
    };
    
    const timetable = await prisma.timetable.findMany({
      where,
      include: {
        class: {
          include: {
            classTeacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true }
                }
              }
            }
          }
        },
        subject: true,
        school: {
          select: { name: true, code: true }
        }
      },
      orderBy: [
        { day: 'asc' },
        { period: 'asc' }
      ]
    });
    
    return timetable;
  } catch (error) {
    console.error('Error fetching timetable:', error);
    throw new Error('Failed to fetch timetable');
  }
};

export const buildTimetableSearchQuery = (filters) => {
  const where = {};
  
  if (filters.classId) {
    where.classId = BigInt(filters.classId);
  }
  
  if (filters.teacherId) {
    where.teacherId = BigInt(filters.teacherId);
  }
  
  if (filters.subjectId) {
    where.subjectId = BigInt(filters.subjectId);
  }
  
  if (filters.day) {
    where.day = filters.day;
  }
  
  if (filters.period) {
    where.period = filters.period;
  }
  
  return where;
};

export const buildTimetableIncludeQuery = (include = []) => {
  const includeQuery = {};
  
  if (include.includes('class')) {
    includeQuery.class = {
      include: {
        classTeacher: {
          include: {
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      }
    };
  }
  
  if (include.includes('subject')) {
    includeQuery.subject = true;
  }
  
  if (include.includes('teacher')) {
    includeQuery.teacher = {
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      }
    };
  }
  
  if (include.includes('school')) {
    includeQuery.school = {
      select: { name: true, code: true }
    };
  }
  
  return includeQuery;
};

// ======================
// EXPORT FUNCTIONS
// ======================

export const exportTimetable = async (schoolId, format = 'json', filters = {}) => {
  try {
    const timetable = await getTimetable(schoolId, filters);
    
    if (format === 'csv') {
      return generateCSVExport(timetable);
    } else if (format === 'pdf') {
      return generatePDFExport(timetable);
    } else {
      return generateJSONExport(timetable);
    }
  } catch (error) {
    console.error('Error exporting timetable:', error);
    throw new Error('Failed to export timetable');
  }
};

const generateCSVExport = (timetable) => {
  const headers = ['Day', 'Period', 'Class', 'Subject', 'Teacher', 'Start Time', 'End Time', 'Room'];
  const rows = timetable.map(entry => [
    getDayName(entry.day),
    entry.period,
    entry.class?.name || '',
    entry.subject?.name || '',
    `${entry.teacher?.user?.firstName || ''} ${entry.teacher?.user?.lastName || ''}`.trim(),
    entry.startTime,
    entry.endTime,
    entry.roomNumber || ''
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  return csvContent;
};

const generateJSONExport = (timetable) => {
  return JSON.stringify(timetable, null, 2);
};

const generatePDFExport = (timetable) => {
  // This would require a PDF generation library like puppeteer or jsPDF
  // For now, return a placeholder
  return 'PDF export not implemented yet';
};

const getDayName = (day) => {
  const days = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[day] || `Day ${day}`;
}; 
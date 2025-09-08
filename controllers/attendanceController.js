import { PrismaClient } from '../generated/prisma/client.js';
import { createSuccessResponse, createErrorResponse } from '../utils/responseUtils.js';
import smsService from '../services/smsService.js';

// ======================
// TIME-BASED ATTENDANCE CONSTRAINTS
// ======================

// Afghanistan timezone (UTC+4:30)
const AFGHANISTAN_TIMEZONE = 'Asia/Kabul';
// Fixed offset in minutes for Asia/Kabul (no DST)
const AFGHANISTAN_UTC_OFFSET_MIN = 270; // 4 hours 30 minutes

// Attendance time windows (in Afghanistan time)
const ATTENDANCE_TIMES = {
  MARK_IN_START: 7,    // 7:00 AM
  MARK_IN_END: 8,      // 8:00 AM
  MARK_OUT_START: 12,  // 12:00 PM (noon)
  MARK_OUT_END: 13,    // 1:00 PM
  AUTO_ABSENT_TIME: 9  // 9:00 AM - after this time, mark absent if no mark-in
};

/**
 * Get current time in Afghanistan timezone
 */
const getAfghanistanTime = () => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: AFGHANISTAN_TIMEZONE }));
};

// ======================
// TIMEZONE HELPERS
// ======================

// Parse an input date/time string as Afghanistan local time and return a UTC Date
// Accepts: ISO-like strings with or without time (e.g., '2025-09-08', '2025-09-08 08:15', '2025-09-08T08:15:00')
const parseAfghanistanLocalToUTC = (input) => {
  if (!input) return null;
  const normalized = String(input).replace(' ', 'T');
  // If input has no time, default to 00:00:00
  const withTime = /T\d{2}:\d{2}/.test(normalized) ? normalized : `${normalized}T00:00:00`;
  const local = new Date(withTime);
  // Derive Afghanistan wall-clock components using Intl timeZone
  const afLocal = new Date(local.toLocaleString('en-US', { timeZone: AFGHANISTAN_TIMEZONE }));
  const y = afLocal.getFullYear();
  const m = afLocal.getMonth(); // 0-based
  const d = afLocal.getDate();
  const hh = afLocal.getHours();
  const mm = afLocal.getMinutes();
  const ss = afLocal.getSeconds();
  const ms = afLocal.getMilliseconds();
  // Compute UTC by subtracting the fixed Kabul offset
  const utcMillis = Date.UTC(y, m, d, hh, mm, ss, ms) - (AFGHANISTAN_UTC_OFFSET_MIN * 60 * 1000);
  return new Date(utcMillis);
};

// Given a UTC Date, format as Afghanistan-local ISO-like string 'YYYY-MM-DDTHH:mm:ss'
const formatAfghanistanLocalISO = (date) => {
  if (!date) return null;
  const afMillis = date.getTime() + (AFGHANISTAN_UTC_OFFSET_MIN * 60 * 1000);
  const af = new Date(afMillis);
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = af.getUTCFullYear();
  const mm = pad(af.getUTCMonth() + 1);
  const dd = pad(af.getUTCDate());
  const HH = pad(af.getUTCHours());
  const MM = pad(af.getUTCMinutes());
  const SS = pad(af.getUTCSeconds());
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`;
};

// Get Afghanistan day range (start/end) in UTC for a given input (Date or string)
const getAfghanistanDayRangeUTC = (input) => {
  const dateUTC = parseAfghanistanLocalToUTC(input);
  if (!dateUTC) return { startOfDayUTC: null, endOfDayUTC: null };
  // Reconstruct Afghanistan date parts from input, then compute UTC start/end by subtracting offset
  const afLocal = new Date(new Date(String(input).replace(' ', 'T')).toLocaleString('en-US', { timeZone: AFGHANISTAN_TIMEZONE }));
  const y = afLocal.getFullYear();
  const m = afLocal.getMonth();
  const d = afLocal.getDate();
  const startUTCms = Date.UTC(y, m, d, 0, 0, 0, 0) - (AFGHANISTAN_UTC_OFFSET_MIN * 60 * 1000);
  const endUTCms = Date.UTC(y, m, d, 23, 59, 59, 999) - (AFGHANISTAN_UTC_OFFSET_MIN * 60 * 1000);
  return { startOfDayUTC: new Date(startUTCms), endOfDayUTC: new Date(endUTCms) };
};

/**
 * Check if current time is within mark-in window (7-8 AM Afghanistan time)
 */
const isMarkInTimeWindow = () => {
  const afghanTime = getAfghanistanTime();
  const hour = afghanTime.getHours();
  return hour >= ATTENDANCE_TIMES.MARK_IN_START && hour < ATTENDANCE_TIMES.MARK_IN_END;
};

/**
 * Check if current time is within mark-out window (12-1 PM Afghanistan time)
 */
const isMarkOutTimeWindow = () => {
  const afghanTime = getAfghanistanTime();
  const hour = afghanTime.getHours();
  return hour >= ATTENDANCE_TIMES.MARK_OUT_START && hour < ATTENDANCE_TIMES.MARK_OUT_END;
};

/**
 * Check if it's time to automatically mark absent students (after 9 AM)
 */
const isAutoAbsentTime = () => {
  const afghanTime = getAfghanistanTime();
  const hour = afghanTime.getHours();
  return hour >= ATTENDANCE_TIMES.AUTO_ABSENT_TIME;
};

/**
 * Get formatted Afghanistan time string
 */
const getFormattedAfghanTime = () => {
  const afghanTime = getAfghanistanTime();
  return afghanTime.toLocaleString('en-US', { 
    timeZone: AFGHANISTAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const prisma = new PrismaClient();

/**
 * Get all attendances with optional filtering
 */
export const getAllAttendances = async (req, res) => {
  try {
    const { 
      studentId, 
      classId, 
      date, 
      status, 
      schoolId = 1, // Default school ID for testing
      page = 1, 
      limit = 50 
    } = req.query;

    const where = {
      schoolId: BigInt(schoolId),
      deletedAt: null
    };

    if (studentId) where.studentId = BigInt(studentId);
    if (classId) where.classId = BigInt(classId);
    if (date) {
      const { startOfDayUTC, endOfDayUTC } = getAfghanistanDayRangeUTC(date);
      if (startOfDayUTC && endOfDayUTC) {
        where.date = { gte: startOfDayUTC, lte: endOfDayUTC };
      }
    }
    if (status) where.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [attendances, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              uuid: true,
              rollNo: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          class: {
            select: {
              id: true,
              name: true,
              code: true
            }
          },
          subject: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take
      }),
      prisma.attendance.count({ where })
    ]);

    // Convert BigInt values to regular numbers for JSON serialization
    const serializedAttendances = attendances.map(attendance => ({
      ...attendance,
      id: Number(attendance.id),
      studentId: attendance.studentId ? Number(attendance.studentId) : null,
      classId: attendance.classId ? Number(attendance.classId) : null,
      subjectId: attendance.subjectId ? Number(attendance.subjectId) : null,
      schoolId: attendance.schoolId ? Number(attendance.schoolId) : null,
      createdBy: attendance.createdBy ? Number(attendance.createdBy) : null,
      updatedBy: attendance.updatedBy ? Number(attendance.updatedBy) : null,
      student: attendance.student ? {
        ...attendance.student,
        id: Number(attendance.student.id),
        user: attendance.student.user ? {
          ...attendance.student.user
        } : null
      } : null,
      class: attendance.class ? {
        ...attendance.class,
        id: Number(attendance.class.id)
      } : null,
      subject: attendance.subject ? {
        ...attendance.subject,
        id: Number(attendance.subject.id)
      } : null,
      // Times formatted in Afghanistan local time
      date: attendance.date ? formatAfghanistanLocalISO(attendance.date) : null,
      inTime: attendance.inTime ? formatAfghanistanLocalISO(attendance.inTime) : null,
      outTime: attendance.outTime ? formatAfghanistanLocalISO(attendance.outTime) : null
    }));

    res.json({
      success: true,
      message: 'Attendances retrieved successfully',
      data: {
        attendances: serializedAttendances,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error in getAllAttendances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve attendances',
      message: error.message
    });
  }
};

/**
 * Get attendance by ID
 */
export const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;
    
  const attendance = await prisma.attendance.findUnique({
      where: { id: BigInt(id) },
      include: {
        student: {
          select: {
            id: true,
            uuid: true,
            rollNo: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true
          }
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });

    if (!attendance) {
      return createErrorResponse(res, 'Attendance not found', 404);
    }

    const formatted = {
      ...attendance,
      date: attendance.date ? formatAfghanistanLocalISO(attendance.date) : null,
      inTime: attendance.inTime ? formatAfghanistanLocalISO(attendance.inTime) : null,
      outTime: attendance.outTime ? formatAfghanistanLocalISO(attendance.outTime) : null
    };

    return createSuccessResponse(res, 'Attendance retrieved successfully', formatted);
  } catch (error) {
    console.error('Error in getAttendanceById:', error);
    return createErrorResponse(res, 'Failed to retrieve attendance', 500);
  }
};

/**
 * Create new attendance record
 */
export const createAttendance = async (req, res) => {
  try {
    const {
      studentId,
      classId,
      subjectId,
      date,
      status,
      inTime,
      outTime,
      remarks
    } = req.body;

    const schoolId = req.user.schoolId;
    const createdBy = req.user.id;

    // Validate required fields
    if (!studentId || !classId || !date || !status) {
      return createErrorResponse(res, 'Missing required fields: studentId, classId, date, status', 400);
    }

    // Check if attendance already exists for this student, class, subject, and date
    // Normalize incoming datetime and match by day range
    const parsedDate = new Date(String(date).replace(' ', 'T'));
    const cStart = new Date(parsedDate); cStart.setHours(0,0,0,0);
    const cEnd = new Date(parsedDate);   cEnd.setHours(23,59,59,999);
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        studentId: BigInt(studentId),
        classId: BigInt(classId),
        subjectId: subjectId ? BigInt(subjectId) : null,
        date: { gte: cStart, lte: cEnd },
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (existingAttendance) {
      return createErrorResponse(res, 'Attendance record already exists for this student, class, and date', 409);
    }

    // Create attendance record (store UTC based on Afghanistan local input)
  const attendance = await prisma.attendance.create({
      data: {
        date: parseAfghanistanLocalToUTC(parsedDate),
        status,
        inTime: inTime ? parseAfghanistanLocalToUTC(inTime) : null,
        outTime: outTime ? parseAfghanistanLocalToUTC(outTime) : null,
        remarks,
        studentId: BigInt(studentId),
        classId: BigInt(classId),
        subjectId: subjectId ? BigInt(subjectId) : null,
        schoolId: BigInt(schoolId),
        createdBy: BigInt(createdBy)
      },
      include: {
        student: {
          select: {
            id: true,
            rollNo: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        class: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Format times as Afghanistan local in response
    const responseAttendance = {
      ...attendance,
      date: attendance.date ? formatAfghanistanLocalISO(attendance.date) : null,
      inTime: attendance.inTime ? formatAfghanistanLocalISO(attendance.inTime) : null,
      outTime: attendance.outTime ? formatAfghanistanLocalISO(attendance.outTime) : null
    };

    return createSuccessResponse(res, 'Attendance created successfully', responseAttendance, 201);
  } catch (error) {
    console.error('Error in createAttendance:', error);
    return createErrorResponse(res, 'Failed to create attendance', 500);
  }
};

/**
 * Update attendance record
 */
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      inTime,
      outTime,
      remarks
    } = req.body;

    const updatedBy = req.user.id;

    // Check if attendance exists
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingAttendance) {
      return createErrorResponse(res, 'Attendance not found', 404);
    }

    // Update attendance (normalize times if provided; store UTC)
  const attendance = await prisma.attendance.update({
      where: { id: BigInt(id) },
      data: {
        status,
        inTime: inTime ? parseAfghanistanLocalToUTC(inTime) : undefined,
        outTime: outTime ? parseAfghanistanLocalToUTC(outTime) : undefined,
        remarks,
        updatedBy: BigInt(updatedBy)
      },
      include: {
        student: {
          select: {
            id: true,
            rollNo: true,
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        class: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const responseAttendance = {
      ...attendance,
      date: attendance.date ? formatAfghanistanLocalISO(attendance.date) : null,
      inTime: attendance.inTime ? formatAfghanistanLocalISO(attendance.inTime) : null,
      outTime: attendance.outTime ? formatAfghanistanLocalISO(attendance.outTime) : null
    };
    return createSuccessResponse(res, 'Attendance updated successfully', responseAttendance);
  } catch (error) {
    console.error('Error in updateAttendance:', error);
    return createErrorResponse(res, 'Failed to update attendance', 500);
  }
};

/**
 * Mark student in-time (arrival)
 */
export const markInTime = async (req, res) => {
  try {
    console.log('🚀 markInTime endpoint called');
    console.log('📝 Request body:', req.body);
    
    const { studentId, subjectId, date } = req.body;
    
    console.log('🔍 Extracted values:', { studentId, subjectId, date });
    
    // Validate required fields
    if (!studentId || !date) {
      console.log('❌ Missing required fields');
      return createErrorResponse(res, 400, 'Missing required fields: studentId, date');
    }

    const currentTime = new Date();
    const attendanceDateUTC = parseAfghanistanLocalToUTC(date); // store in UTC
    const { startOfDayUTC: startOfDay, endOfDayUTC: endOfDay } = getAfghanistanDayRangeUTC(date);
    const schoolId = 1; // Default school ID for testing
    const createdBy = 1; // Default user ID for testing

    // Time window check removed - attendance can be marked at any time
    console.log('✅ Time window restrictions removed - attendance can be marked at any time');

    console.log('⏰ Current time:', currentTime);
    console.log('📅 Attendance date:', attendanceDate);
    console.log('🏫 School ID:', schoolId);
    console.log('👤 Created by:', createdBy);
    console.log('🌍 Current Afghanistan time:', getFormattedAfghanTime());
    console.log('✅ Mark-in time window is open');

    // First, find the student by userId (match against users table)
    console.log('🔍 Finding student by userId (from users table):', studentId);
    const student = await prisma.student.findFirst({
      where: {
        userId: BigInt(studentId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        parent: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true
              }
            }
          }
        },
        class: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!student) {
      console.log('❌ Student not found with userId:', studentId);
      return createErrorResponse(res, 404, `Student with userId ${studentId} not found`);
    }

    console.log('✅ Student found:', {
      id: student.id,
      rollNo: student.rollNo,
      name: `${student.user.firstName} ${student.user.lastName}`
    });

    // Check if attendance record exists for the same day
    console.log('🔍 Checking if attendance record exists...');
    let attendance = await prisma.attendance.findFirst({
      where: {
        studentId: student.id,
        classId: student.class?.id || null,
        subjectId: subjectId ? BigInt(subjectId) : null,
        date: { gte: startOfDay, lte: endOfDay },
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (attendance) {
      console.log('📝 Updating existing attendance record:', attendance.id);
      // Update existing record with in-time based on provided timestamp
      attendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          inTime: attendanceDateUTC,
          status: 'PRESENT'
        }
      });
      console.log('✅ Attendance record updated successfully');
    } else {
      console.log('🆕 Creating new attendance record...');
      // Create new record using provided timestamp for both date and inTime
      attendance = await prisma.attendance.create({
        data: {
          date: attendanceDateUTC, // UTC based on Afghanistan local
          status: 'PRESENT',
          inTime: attendanceDateUTC,
          studentId: student.id,
          classId: student.class?.id || null,
          subjectId: subjectId ? BigInt(subjectId) : null,
          schoolId: BigInt(schoolId),
          createdBy: BigInt(createdBy)
        }
      });
      console.log('✅ New attendance record created with ID:', attendance.id);
    }

    // Convert BigInt values to regular numbers and dates to ISO strings for JSON serialization
    console.log('🔄 Serializing attendance data...');
    const serializedAttendance = {
      ...attendance,
      id: Number(attendance.id),
      studentId: attendance.studentId ? Number(attendance.studentId) : null,
      classId: attendance.classId ? Number(attendance.classId) : null,
      subjectId: attendance.subjectId ? Number(attendance.subjectId) : null,
      schoolId: attendance.schoolId ? Number(attendance.schoolId) : null,
      createdBy: attendance.createdBy ? Number(attendance.createdBy) : null,
      updatedBy: attendance.updatedBy ? Number(attendance.updatedBy) : null,
      date: attendance.date ? formatAfghanistanLocalISO(attendance.date) : null,
      inTime: attendance.inTime ? formatAfghanistanLocalISO(attendance.inTime) : null,
      outTime: attendance.outTime ? formatAfghanistanLocalISO(attendance.outTime) : null,
      createdAt: attendance.createdAt ? attendance.createdAt.toISOString() : null,
      updatedAt: attendance.updatedAt ? attendance.updatedAt.toISOString() : null
    };
    console.log('✅ Data serialized successfully');

    // Send SMS notification (non-blocking)
    try {
      console.log('🔍 Starting SMS process for student ID:', studentId);
      console.log('📱 About to call SMS service...');
      console.log('📱 Student data:', {
        hasStudent: !!student,
        hasUser: !!student?.user,
        hasPhone: !!student?.user?.phone,
        phone: student?.user?.phone
      });
      
      // Class information already available from student lookup
      const classInfo = student.class;

      const recipientPhone = student?.parent?.user?.phone || student?.user?.phone || null;
      if (student && recipientPhone) {
        console.log('👤 Student found:', {
          name: `${student.user.firstName} ${student.user.lastName}`,
          phone: recipientPhone,
          parentPhoneUsed: !!student?.parent?.user?.phone
        });
        console.log('📚 Class info:', classInfo);
        
        // Send SMS notification asynchronously (don't wait for it)
        console.log('📱 Calling SMS service with data:', {
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          phone: recipientPhone,
          inTime: formatAfghanistanLocalISO(attendanceDateUTC),
          date: formatAfghanistanLocalISO(attendanceDateUTC),
          className: classInfo?.name || 'Unknown Class',
          status: 'PRESENT',
          campaignId: 'inTime'
        });
        
        console.log('📱 Calling SMS service...');
        
        // Make SMS service call synchronous to see the response
        try {
          const smsResult = await smsService.sendAttendanceSMS(
            {
              name: `${student.user.firstName} ${student.user.lastName}`,
              phone: recipientPhone
            },
            {
              inTime: formatAfghanistanLocalISO(attendanceDateUTC),
              date: formatAfghanistanLocalISO(attendanceDateUTC),
              className: classInfo?.name || 'Unknown Class',
              status: 'PRESENT'
            },
            'inTime' // Use campaign ID 403 for in-time
          );
          
          console.log('📱 SMS service completed!');
          console.log('📱 SMS API Response Data:', smsResult);
          
          if (smsResult && smsResult.success) {
            console.log('✅ SMS sent successfully for student:', student.user.firstName, {
              campaignId: smsResult.campaignId,
              phone: recipientPhone,
              time: attendanceDate,
              fullResponse: smsResult
            });
          } else if (smsResult === null) {
            console.log('❌ SMS service returned null - check SMS service logs above');
          } else {
            console.log('⚠️ SMS service returned unsuccessful result:', smsResult);
          }
        } catch (smsError) {
          console.error('❌ SMS sending failed:', {
            error: smsError.message,
            stack: smsError.stack,
            fullError: smsError
          });
        }
      } else {
        console.log('⚠️ Student or phone not found:', {
          student: !!student,
          user: !!student?.user,
          phone: student?.user?.phone
        });
      }
    } catch (smsError) {
      console.error('Failed to prepare SMS data (non-critical):', smsError.message);
    }

    console.log('📤 Sending success response...');
    res.json({
      success: true,
      message: 'In-time marked successfully',
      data: serializedAttendance
    });
    console.log('✅ Response sent successfully');
  } catch (error) {
    console.error('Error in markInTime:', error);
    return createErrorResponse(res, 500, 'Failed to mark in-time');
  }
};

/**
 * Mark student out-time (departure)
 */
export const markOutTime = async (req, res) => {
  try {
    console.log('🚀 markOutTime endpoint called');
    console.log('📝 Request body:', req.body);
    
    const { studentId, subjectId, date } = req.body;
    const schoolId = req.user?.schoolId || 1; // Default school ID for testing
    const updatedBy = req.user?.id || 1; // Default user ID for testing

    console.log('🔍 Extracted values:', { studentId, subjectId, date });

    // Validate required fields
    if (!studentId || !date) {
      console.log('❌ Missing required fields');
      return createErrorResponse(res, 400, 'Missing required fields: studentId, date');
    }

    const currentTime = new Date();
    const attendanceDateUTC = parseAfghanistanLocalToUTC(date); // store in UTC
    const { startOfDayUTC: startOfDay, endOfDayUTC: endOfDay } = getAfghanistanDayRangeUTC(date);

    // Time window check removed - attendance can be marked at any time
    console.log('✅ Time window restrictions removed - attendance can be marked at any time');

    console.log('⏰ Current time:', currentTime);
    console.log('📅 Attendance date:', attendanceDate);
    console.log('🏫 School ID:', schoolId);
    console.log('👤 Updated by:', updatedBy);
    console.log('🌍 Current Afghanistan time:', getFormattedAfghanTime());
    console.log('✅ Mark-out time window is open');

    // First, find the student by userId (match against users table)
    console.log('🔍 Finding student by userId (from users table):', studentId);
    const student = await prisma.student.findFirst({
      where: {
        userId: BigInt(studentId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        parent: {
          select: {
            id: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true
              }
            }
          }
        },
        class: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!student) {
      console.log('❌ Student not found with userId:', studentId);
      return createErrorResponse(res, 404, `Student with userId ${studentId} not found`);
    }

    console.log('✅ Student found:', {
      id: student.id,
      rollNo: student.rollNo,
      name: `${student.user.firstName} ${student.user.lastName}`
    });

    // Find existing attendance record for the same day
    const attendance = await prisma.attendance.findFirst({
      where: {
        studentId: student.id,
        classId: student.class?.id || null,
        subjectId: subjectId ? BigInt(subjectId) : null,
        date: { gte: startOfDay, lte: endOfDay },
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (!attendance) {
      return createErrorResponse(res, 404, 'No attendance record found for this student, class, and date');
    }

    // Update with out-time
    const updatedAttendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        outTime: attendanceDateUTC,
        updatedBy: BigInt(updatedBy)
      }
    });

    // Send SMS notification for out-time (non-blocking)
    try {
      console.log('🔍 Starting SMS process for student ID:', studentId);
      console.log('📱 About to call SMS service...');
      console.log('📱 Student data:', {
        hasStudent: !!student,
        hasUser: !!student?.user,
        hasPhone: !!student?.user?.phone,
        phone: student?.user?.phone
      });
      
      const recipientPhone = student?.parent?.user?.phone || student?.user?.phone || null;
      if (student && recipientPhone) {
        // Send SMS notification asynchronously (don't wait for it)
        smsService.sendAttendanceSMS(
          {
            name: `${student.user.firstName} ${student.user.lastName}`,
            phone: recipientPhone
          },
          {
            outTime: formatAfghanistanLocalISO(attendanceDateUTC),
            date: formatAfghanistanLocalISO(attendanceDateUTC),
            className: student.class?.name || 'Unknown Class',
            status: 'DEPARTED'
          },
          'outTime' // Use campaign ID 404 for out-time
        ).then(smsResult => {
          if (smsResult && smsResult.success) {
            console.log('📱 SMS sent successfully for student:', student.user.firstName, {
              campaignId: smsResult.campaignId,
              phone: recipientPhone,
              time: attendanceDate
            });
          }
        }).catch(smsError => {
          console.error('❌ SMS sending failed (non-critical):', smsError.message);
        });
      }
    } catch (smsError) {
      console.error('Failed to prepare SMS data (non-critical):', smsError.message);
    }

    // Serialize the attendance data to handle BigInt values and dates
    const serializedAttendance = {
      ...updatedAttendance,
      id: Number(updatedAttendance.id),
      studentId: Number(updatedAttendance.studentId),
      classId: Number(updatedAttendance.classId),
      schoolId: Number(updatedAttendance.schoolId),
      createdBy: Number(updatedAttendance.createdBy),
      updatedBy: Number(updatedAttendance.updatedBy),
      date: updatedAttendance.date ? updatedAttendance.date.toISOString() : null,
      inTime: updatedAttendance.inTime ? updatedAttendance.inTime.toISOString() : null,
      outTime: updatedAttendance.outTime ? updatedAttendance.outTime.toISOString() : null,
      createdAt: updatedAttendance.createdAt ? updatedAttendance.createdAt.toISOString() : null,
      updatedAt: updatedAttendance.updatedAt ? updatedAttendance.updatedAt.toISOString() : null
    };

    return createSuccessResponse(res, 'Out-time marked successfully', serializedAttendance);
  } catch (error) {
    console.error('Error in markOutTime:', error);
    return createErrorResponse(res, 500, 'Failed to mark out-time');
  }
};

/**
 * Bulk create attendance records
 */
export const bulkCreateAttendance = async (req, res) => {
  try {
    const { attendances } = req.body;
    const schoolId = req.user.schoolId;
    const createdBy = req.user.id;

    if (!Array.isArray(attendances) || attendances.length === 0) {
      return createErrorResponse(res, 'Attendances array is required and must not be empty', 400);
    }

    const attendanceData = attendances.map(att => ({
      date: new Date(att.date),
      status: att.status,
      inTime: att.inTime ? new Date(att.inTime) : null,
      outTime: att.outTime ? new Date(att.outTime) : null,
      remarks: att.remarks,
      studentId: BigInt(att.studentId),
      classId: BigInt(att.classId),
      subjectId: att.subjectId ? BigInt(att.subjectId) : null,
      schoolId: BigInt(schoolId),
      createdBy: BigInt(createdBy)
    }));

    const createdAttendances = await prisma.attendance.createMany({
      data: attendanceData,
      skipDuplicates: true
    });

    return createSuccessResponse(res, 'Bulk attendance created successfully', {
      created: createdAttendances.count
    }, 201);
  } catch (error) {
    console.error('Error in bulkCreateAttendance:', error);
    return createErrorResponse(res, 'Failed to create bulk attendance', 500);
  }
};

/**
 * Delete attendance record (soft delete)
 */
export const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBy = req.user.id;

    // Check if attendance exists
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id: BigInt(id) }
    });

    if (!existingAttendance) {
      return createErrorResponse(res, 'Attendance not found', 404);
    }

    // Soft delete
    await prisma.attendance.update({
      where: { id: BigInt(id) },
      data: {
        deletedAt: new Date(),
        updatedBy: BigInt(updatedBy)
      }
    });

    return createSuccessResponse(res, 'Attendance deleted successfully');
  } catch (error) {
    console.error('Error in deleteAttendance:', error);
    return createErrorResponse(res, 'Failed to delete attendance', 500);
  }
};

/**
 * Get attendance summary for a specific class and date
 */
export const getClassAttendanceSummary = async (req, res) => {
  try {
    console.log('🔍 getClassAttendanceSummary called with:', { query: req.query, user: req.user });
    
    const { classId, date, schoolId: querySchoolId } = req.query;
    const schoolId = req.user?.schoolId || querySchoolId || 1;

    if (!classId || !date) {
      return createErrorResponse(res, 'Class ID and date are required', 400);
    }

    console.log('🔍 Fetching students for class:', classId, 'school:', schoolId);
    
    // Get all students in the class
    const classStudents = await prisma.student.findMany({
      where: {
        classId: BigInt(classId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        class: {
          select: {
            id: true,
            name: true,
            code: true
          }
        }
      }
    });
    
    console.log('🔍 Found students:', classStudents.length);

    console.log('🔍 Fetching attendance records for class:', classId, 'date:', date, 'school:', schoolId);
    
    // Get attendance records for the class and date
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        classId: BigInt(classId),
        ...(date ? (() => { const { startOfDayUTC, endOfDayUTC } = getAfghanistanDayRangeUTC(date); return { date: { gte: startOfDayUTC, lte: endOfDayUTC } }; })() : {}),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });
    
    console.log('🔍 Found attendance records:', attendanceRecords.length);
    
    // Debug: Show sample attendance records
    if (attendanceRecords.length > 0) {
      console.log('🔍 Sample attendance records:');
      attendanceRecords.slice(0, 3).forEach((record, index) => {
        console.log(`  Record ${index + 1}:`, {
          studentId: record.studentId.toString(),
          date: record.date.toISOString().split('T')[0],
          dateRaw: record.date,
          status: record.status,
          inTime: record.inTime?.toISOString(),
          outTime: record.outTime?.toISOString()
        });
      });
    }

    // Calculate summary statistics
    const totalStudents = classStudents.length;
    const present = attendanceRecords.filter(r => r.status === 'PRESENT').length;
    const absent = totalStudents - present;
    const late = attendanceRecords.filter(r => r.status === 'LATE').length;
    const attendanceRate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;
    
    console.log('🔍 Summary calculation:');
    console.log('🔍 Total students:', totalStudents);
    console.log('🔍 Present count:', present);
    console.log('🔍 Absent count:', absent);
    console.log('🔍 Late count:', late);
    console.log('🔍 Attendance rate:', attendanceRate);

    // Create student attendance details
    const students = classStudents.map(student => {
      console.log('🔍 Processing student:', { studentId: student.id, studentIdType: typeof student.id });
      console.log('🔍 Available attendance records:', attendanceRecords.map(r => ({ 
        attendanceStudentId: r.studentId, 
        attendanceStudentIdType: typeof r.studentId,
        status: r.status 
      })));
      
      const attendance = attendanceRecords.find(r => {
        const match = BigInt(r.studentId) === student.id;
        console.log('🔍 Attendance matching:', { 
          attendanceStudentId: r.studentId, 
          studentId: student.id, 
          match 
        });
        return match;
      });
      
      // Check if user data exists
      if (!student.user || !student.user.firstName || !student.user.lastName) {
        console.warn('⚠️ Student missing user data:', student.id);
        return {
          studentId: Number(student.id).toString(),
          studentName: 'Unknown Student',
          rollNo: student.rollNo || '',
          status: attendance?.status || 'ABSENT',
          inTime: attendance?.inTime ? attendance.inTime.toISOString() : null,
          outTime: attendance?.outTime ? attendance.outTime.toISOString() : null
        };
      }
      
      return {
        studentId: Number(student.id).toString(),
        studentName: `${student.user.firstName} ${student.user.lastName}`,
        rollNo: student.rollNo || '',
        status: attendance?.status || 'ABSENT',
        inTime: attendance?.inTime ? formatAfghanistanLocalISO(attendance.inTime) : null,
        outTime: attendance?.outTime ? formatAfghanistanLocalISO(attendance.outTime) : null
      };
    });

    const summary = {
      classId: Number(classId),
      className: classStudents[0]?.class?.name || 'Unknown Class',
      date,
      totalStudents,
      present,
      absent,
      late,
      excused: 0,
      halfDay: 0,
      attendanceRate,
      students
    };

    console.log('🔍 Returning summary:', summary);
    console.log('🔍 Sample student data:', students[0]);
    console.log('🔍 All students data:', students);
    console.log('🔍 Attendance records:', attendanceRecords);
    return createSuccessResponse(res, 'Class attendance summary retrieved successfully', summary);
  } catch (error) {
    console.error('❌ Error in getClassAttendanceSummary:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Check if it's a Prisma error
    if (error.code) {
      console.error('❌ Prisma error code:', error.code);
    }
    
    return createErrorResponse(res, 'Failed to retrieve class attendance summary', 500);
  }
};

/**
 * Get overall attendance summary with filters
 */
export const getAttendanceSummary = async (req, res) => {
  try {
    console.log('🔍 getAttendanceSummary called with:', { query: req.query, user: req.user });
    
    const { classId, date, schoolId: querySchoolId = 1 } = req.query;
    const effectiveSchoolId = req.user?.schoolId || querySchoolId;

    const where = {
      schoolId: BigInt(effectiveSchoolId),
      deletedAt: null
    };

    if (classId) where.classId = BigInt(classId);
    if (date) {
      const { startOfDayUTC, endOfDayUTC } = getAfghanistanDayRangeUTC(date);
      where.date = { gte: startOfDayUTC, lte: endOfDayUTC };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        class: {
          select: { name: true }
        }
      }
    });

    const totalStudents = attendances.length;
    const present = attendances.filter(r => r.status === 'PRESENT').length;
    const absent = attendances.filter(r => r.status === 'ABSENT').length;
    const late = attendances.filter(r => r.status === 'LATE').length;
    const excused = attendances.filter(r => r.status === 'EXCUSED').length;
    const halfDay = attendances.filter(r => r.status === 'HALF_DAY').length;

    const attendanceRate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;
    const onTimeRate = totalStudents > 0 ? Math.round(((present - late) / totalStudents) * 100) : 0;
    const lateRate = totalStudents > 0 ? Math.round((late / totalStudents) * 100) : 0;

    const summary = {
      date: date || new Date().toISOString().split('T')[0],
      classId: classId || '',
      className: attendances[0]?.class?.name || 'All Classes',
      totalStudents,
      present,
      absent,
      late,
      excused,
      halfDay,
      attendanceRate,
      onTimeRate,
      lateRate
    };

    return createSuccessResponse(res, 'Attendance summary retrieved successfully', summary);
  } catch (error) {
    console.error('Error in getAttendanceSummary:', error);
    return createErrorResponse(res, 'Failed to retrieve attendance summary', 500);
  }
};

/**
 * Get comprehensive attendance statistics and analytics
 */
export const getAttendanceStats = async (req, res) => {
  try {
    console.log('🔍 getAttendanceStats called with:', { query: req.query, user: req.user });
    
    const { classId, startDate, endDate, schoolId: querySchoolId = 1 } = req.query;
    const effectiveSchoolId = req.user?.schoolId || querySchoolId;

    const where = {
      schoolId: BigInt(effectiveSchoolId),
      deletedAt: null
    };

    if (classId) where.classId = BigInt(classId);
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        class: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Calculate basic statistics
    const totalDays = new Set(attendances.map(r => (r.date ? formatAfghanistanLocalISO(r.date).split('T')[0] : ''))).size;
    const totalPresent = attendances.filter(r => r.status === 'PRESENT').length;
    const totalAbsent = attendances.filter(r => r.status === 'ABSENT').length;
    const totalLate = attendances.filter(r => r.status === 'LATE').length;
    const totalExcused = attendances.filter(r => r.status === 'EXCUSED').length;
    const averageAttendanceRate = totalDays > 0 ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0;

    // Calculate total hours and average time
    const totalHours = attendances.reduce((total, record) => {
      if (record.inTime && record.outTime) {
        const diffMs = new Date(record.outTime) - new Date(record.inTime);
        return total + (diffMs / (1000 * 60 * 60));
      }
      return total;
    }, 0);

    // Daily attendance trends
    const dailyTrends = {};
    attendances.forEach(record => {
      const date = record.date ? formatAfghanistanLocalISO(record.date).split('T')[0] : '';
      if (!dailyTrends[date]) {
        dailyTrends[date] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      }
      
      dailyTrends[date].total++;
      if (record.status === 'PRESENT') dailyTrends[date].present++;
      else if (record.status === 'ABSENT') dailyTrends[date].absent++;
      else if (record.status === 'LATE') dailyTrends[date].late++;
      else if (record.status === 'EXCUSED') dailyTrends[date].excused++;
    });

    // Weekly patterns
    const weeklyPatterns = {};
    attendances.forEach(record => {
      const date = record.date ? new Date(record.date) : new Date();
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyPatterns[weekKey]) {
        weeklyPatterns[weekKey] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      }
      
      weeklyPatterns[weekKey].total++;
      if (record.status === 'PRESENT') weeklyPatterns[weekKey].present++;
      else if (record.status === 'ABSENT') weeklyPatterns[weekKey].absent++;
      else if (record.status === 'LATE') weeklyPatterns[weekKey].late++;
      else if (record.status === 'EXCUSED') weeklyPatterns[weekKey].excused++;
    });

    // Monthly trends
    const monthlyTrends = {};
    attendances.forEach(record => {
      const date = record.date ? new Date(record.date) : new Date();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      }
      
      monthlyTrends[monthKey].total++;
      if (record.status === 'PRESENT') monthlyTrends[monthKey].present++;
      else if (record.status === 'ABSENT') monthlyTrends[monthKey].absent++;
      else if (record.status === 'LATE') monthlyTrends[monthKey].late++;
      else if (record.status === 'EXCUSED') monthlyTrends[monthKey].excused++;
    });

    // Student performance ranking
    const studentStats = {};
    attendances.forEach(record => {
      const studentId = record.studentId.toString();
      if (!studentStats[studentId]) {
        const studentUser = record.student && record.student.user ? record.student.user : null;
        const studentName = studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : 'Unknown Student';
        studentStats[studentId] = {
          studentId,
          studentName: studentName,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          total: 0,
          averageTime: 0,
          totalTime: 0
        };
      }
      
      studentStats[studentId].total++;
      if (record.status === 'PRESENT') studentStats[studentId].present++;
      else if (record.status === 'ABSENT') studentStats[studentId].absent++;
      else if (record.status === 'LATE') studentStats[studentId].late++;
      else if (record.status === 'EXCUSED') studentStats[studentId].excused++;
      
      if (record.inTime && record.outTime) {
        const diffMs = new Date(record.outTime) - new Date(record.inTime);
        const hours = diffMs / (1000 * 60 * 60);
        studentStats[studentId].totalTime += hours;
      }
    });

    // Calculate averages and rankings
    Object.values(studentStats).forEach(student => {
      if (student.total > 0) {
        student.averageTime = Math.round((student.totalTime / student.total) * 100) / 100;
        student.attendanceRate = Math.round((student.present / student.total) * 100);
      }
    });

    // Sort students by attendance rate
    const topStudents = Object.values(studentStats)
      .sort((a, b) => b.attendanceRate - a.attendanceRate)
      .slice(0, 10);

    const bottomStudents = Object.values(studentStats)
      .sort((a, b) => a.attendanceRate - b.attendanceRate)
      .slice(0, 10);

    // Time-based analysis
    const timeAnalysis = {
      earlyArrivals: 0, // Before 8 AM
      onTime: 0, // 8 AM - 8:30 AM
      lateArrivals: 0, // After 8:30 AM
      earlyDepartures: 0, // Before 3 PM
      onTimeDepartures: 0, // 3 PM - 3:30 PM
      lateDepartures: 0 // After 3:30 PM
    };

    attendances.forEach(record => {
      if (record.inTime) {
        const hour = new Date(record.inTime).getHours();
        const minutes = new Date(record.inTime).getMinutes();
        const timeInMinutes = hour * 60 + minutes;
        
        if (timeInMinutes < 480) timeAnalysis.earlyArrivals++; // Before 8 AM
        else if (timeInMinutes <= 510) timeAnalysis.onTime++; // 8 AM - 8:30 AM
        else timeAnalysis.lateArrivals++; // After 8:30 AM
      }
      
      if (record.outTime) {
        const hour = new Date(record.outTime).getHours();
        const minutes = new Date(record.outTime).getMinutes();
        const timeInMinutes = hour * 60 + minutes;
        
        if (timeInMinutes < 900) timeAnalysis.earlyDepartures++; // Before 3 PM
        else if (timeInMinutes <= 930) timeAnalysis.onTimeDepartures++; // 3 PM - 3:30 PM
        else timeAnalysis.lateDepartures++; // After 3:30 PM
      }
    });

    // Predictive analytics
    const recentTrend = Object.values(dailyTrends)
      .slice(-7) // Last 7 days
      .reduce((sum, day) => sum + (day.present / day.total), 0) / 7;

    const trendDirection = recentTrend > (averageAttendanceRate / 100) ? 'improving' : 'declining';
    const trendPercentage = Math.abs(recentTrend - (averageAttendanceRate / 100)) * 100;

    const comprehensiveStats = {
      // Basic stats
      totalDays,
      totalPresent,
      totalAbsent,
      totalLate,
      totalExcused,
      averageAttendanceRate,
      totalHours: Math.round(totalHours * 100) / 100,
      
      // Trends
      dailyTrends: Object.entries(dailyTrends).map(([date, data]) => ({
        date,
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      })),
      weeklyPatterns: Object.entries(weeklyPatterns).map(([week, data]) => ({
        week,
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      })),
      monthlyTrends: Object.entries(monthlyTrends).map(([month, data]) => ({
        month,
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      })),
      
      // Student performance
      studentStats: Object.values(studentStats),
      topStudents,
      bottomStudents,
      
      // Time analysis
      timeAnalysis,
      
      // Predictive analytics
      recentTrend: Math.round(recentTrend * 100),
      trendDirection,
      trendPercentage: Math.round(trendPercentage * 100) / 100,
      
      // Insights
      insights: {
        bestDay: Object.entries(dailyTrends).reduce((best, [date, data]) => 
          data.total > 0 && (data.present / data.total) > (best.rate || 0) 
            ? { date, rate: data.present / data.total } 
            : best, { date: '', rate: 0 }
        ),
        worstDay: Object.entries(dailyTrends).reduce((worst, [date, data]) => 
          data.total > 0 && (data.present / data.total) < (worst.rate || 1) 
            ? { date, rate: data.present / data.total } 
            : worst, { date: '', rate: 1 }
        ),
        mostPunctualStudent: topStudents[0] || null,
        needsAttention: bottomStudents.slice(0, 3) || []
      }
    };

    return createSuccessResponse(res, 'Comprehensive attendance statistics retrieved successfully', comprehensiveStats);
  } catch (error) {
    console.error('Error in getAttendanceStats:', error);
    return createErrorResponse(res, 500, 'Failed to retrieve attendance statistics', error?.message || 'ATTENDANCE_STATS_ERROR');
  }
};

/**
 * Get comprehensive attendance analytics with chart data
 */
export const getAttendanceAnalytics = async (req, res) => {
  try {
    console.log('🔍 getAttendanceAnalytics called with:', { query: req.query, user: req.user });
    
    const { classId, period = 'daily', startDate, endDate, schoolId: querySchoolId = 1, chartType = 'all' } = req.query;
    const effectiveSchoolId = req.user?.schoolId || querySchoolId;

    const where = {
      schoolId: BigInt(effectiveSchoolId),
      deletedAt: null
    };

    if (classId) where.classId = BigInt(classId);
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        class: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Generate chart data based on requested type
    let chartData = {};

    if (chartType === 'all' || chartType === 'daily') {
      // Daily attendance trends
      const dailyTrends = {};
      attendances.forEach(record => {
        // Skip records without valid date
        if (!record.date) {
          console.warn('Skipping attendance record without valid date:', record.id);
          return;
        }
        
        const date = record.date.toISOString().split('T')[0];
        if (!dailyTrends[date]) {
          dailyTrends[date] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
        }
        
        dailyTrends[date].total++;
        if (record.status === 'PRESENT') dailyTrends[date].present++;
        else if (record.status === 'ABSENT') dailyTrends[date].absent++;
        else if (record.status === 'LATE') dailyTrends[date].late++;
        else if (record.status === 'EXCUSED') dailyTrends[date].excused++;
      });

      chartData.daily = Object.entries(dailyTrends).map(([date, data]) => ({
      date,
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      }));
    }

    if (chartType === 'all' || chartType === 'weekly') {
      // Weekly patterns
      const weeklyPatterns = {};
      attendances.forEach(record => {
        // Skip records without valid date
        if (!record.date) {
          console.warn('Skipping attendance record without valid date for weekly analysis:', record.id);
          return;
        }
        
        const date = new Date(record.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        if (!weeklyPatterns[weekKey]) {
          weeklyPatterns[weekKey] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
        }
        
        weeklyPatterns[weekKey].total++;
        if (record.status === 'PRESENT') weeklyPatterns[weekKey].present++;
        else if (record.status === 'ABSENT') weeklyPatterns[weekKey].absent++;
        else if (record.status === 'LATE') weeklyPatterns[weekKey].late++;
        else if (record.status === 'EXCUSED') weeklyPatterns[weekKey].excused++;
      });

      chartData.weekly = Object.entries(weeklyPatterns).map(([week, data]) => ({
        week,
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      }));
    }

    if (chartType === 'all' || chartType === 'monthly') {
      // Monthly trends
      const monthlyTrends = {};
      attendances.forEach(record => {
        const date = new Date(record.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyTrends[monthKey]) {
          monthlyTrends[monthKey] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
        }
        
        monthlyTrends[monthKey].total++;
        if (record.status === 'PRESENT') monthlyTrends[monthKey].present++;
        else if (record.status === 'ABSENT') monthlyTrends[monthKey].absent++;
        else if (record.status === 'LATE') monthlyTrends[monthKey].late++;
        else if (record.status === 'EXCUSED') monthlyTrends[monthKey].excused++;
      });

      chartData.monthly = Object.entries(monthlyTrends).map(([month, data]) => ({
        month,
        ...data,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
      }));
    }

    if (chartType === 'all' || chartType === 'student') {
      // Student performance ranking
      const studentStats = {};
      attendances.forEach(record => {
        // Skip records without complete student/user data
        if (!record.student || !record.student.user) {
          console.warn('Skipping attendance record with incomplete student data:', record.id);
          return;
        }
        
        const studentId = record.studentId.toString();
        if (!studentStats[studentId]) {
          studentStats[studentId] = {
            studentId,
            studentName: `${record.student.user.firstName} ${record.student.user.lastName}`,
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            total: 0,
            attendanceRate: 0
          };
        }
        
        studentStats[studentId].total++;
        if (record.status === 'PRESENT') studentStats[studentId].present++;
        else if (record.status === 'ABSENT') studentStats[studentId].absent++;
        else if (record.status === 'LATE') studentStats[studentId].late++;
        else if (record.status === 'EXCUSED') studentStats[studentId].excused++;
      });

      // Calculate attendance rates
      Object.values(studentStats).forEach(student => {
        if (student.total > 0) {
          student.attendanceRate = Math.round((student.present / student.total) * 100);
        }
      });

      chartData.student = Object.values(studentStats);
    }

    if (chartType === 'all' || chartType === 'time') {
      // Time-based analysis
      const timeAnalysis = {
        earlyArrivals: 0, // Before 8 AM
        onTime: 0, // 8 AM - 8:30 AM
        lateArrivals: 0, // After 8:30 AM
        earlyDepartures: 0, // Before 3 PM
        onTimeDepartures: 0, // 3 PM - 3:30 PM
        lateDepartures: 0 // After 3:30 PM
      };

      attendances.forEach(record => {
        if (record.inTime) {
          try {
            const hour = new Date(record.inTime).getHours();
            const minutes = new Date(record.inTime).getMinutes();
            const timeInMinutes = hour * 60 + minutes;
            
            if (timeInMinutes < 480) timeAnalysis.earlyArrivals++;
            else if (timeInMinutes <= 510) timeAnalysis.onTime++;
            else timeAnalysis.lateArrivals++;
          } catch (timeError) {
            console.warn('Skipping record with invalid inTime:', record.id, record.inTime);
          }
        }
        
        if (record.outTime) {
          try {
            const hour = new Date(record.outTime).getHours();
            const minutes = new Date(record.outTime).getMinutes();
            const timeInMinutes = hour * 60 + minutes;
            
            if (timeInMinutes < 900) timeAnalysis.earlyDepartures++;
            else if (timeInMinutes <= 930) timeAnalysis.onTimeDepartures++;
            else timeAnalysis.lateDepartures++;
          } catch (timeError) {
            console.warn('Skipping record with invalid outTime:', record.id, record.outTime);
          }
        }
      });

      chartData.time = timeAnalysis;
    }

    if (chartType === 'all' || chartType === 'comparison') {
      // Class comparison (if multiple classes)
      const classStats = {};
      attendances.forEach(record => {
        // Skip records without complete class data
        if (!record.class) {
          console.warn('Skipping attendance record with incomplete class data:', record.id);
          return;
        }
        
        const className = record.class.name;
        if (!classStats[className]) {
          classStats[className] = { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
        }
        
        classStats[className].total++;
        if (record.status === 'PRESENT') classStats[className].present++;
        else if (record.status === 'ABSENT') classStats[className].absent++;
        else if (record.status === 'LATE') classStats[className].late++;
        else if (record.status === 'EXCUSED') classStats[className].excused++;
      });

      // Calculate rates
      Object.values(classStats).forEach(cls => {
        if (cls.total > 0) {
          cls.rate = Math.round((cls.present / cls.total) * 100);
        }
      });

      chartData.comparison = Object.entries(classStats).map(([className, data]) => ({
        className,
        ...data
      }));
    }

    // Add metadata
    const analytics = {
      chartData,
      metadata: {
        totalRecords: attendances.length,
        dateRange: {
          start: startDate || 'all',
          end: endDate || 'all'
        },
        classId: classId || 'all',
        period,
        chartType,
        generatedAt: new Date().toISOString()
      }
    };

    return createSuccessResponse(res, 'Attendance analytics retrieved successfully', analytics);
  } catch (error) {
    console.error('Error in getAttendanceAnalytics:', error);
    return createErrorResponse(res, 'Failed to retrieve attendance analytics', 500);
  }
};

/**
 * Get monthly attendance matrix for a class
 */
export const getMonthlyAttendanceMatrix = async (req, res) => {
  try {
    console.log('🔍 getMonthlyAttendanceMatrix called with:', { query: req.query, user: req.user });
    
    const { classId, month, year, schoolId: querySchoolId = 1 } = req.query;
    const schoolId = req.user?.schoolId || querySchoolId || 1;

    if (!classId || !month || !year) {
      return createErrorResponse(res, 'Class ID, month, and year are required', 400);
    }

    console.log('🔍 Fetching monthly attendance for class:', classId, 'month:', month, 'year:', year, 'school:', schoolId);
    
    // Get all students in the class
    const classStudents = await prisma.student.findMany({
      where: {
        classId: BigInt(classId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    console.log('🔍 Found students:', classStudents.length);

    // Get month range - FIXED
    const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthEnd = new Date(parseInt(year), parseInt(month), 0); // Last day of the month
    const monthEndInclusive = new Date(monthEnd);
    monthEndInclusive.setHours(23, 59, 59, 999);
    
    console.log('🔍 Month range:', monthStart.toISOString(), 'to', monthEndInclusive.toISOString());
    console.log('🔍 Month start date:', monthStart.toDateString());
    console.log('🔍 Month end date:', monthEnd.toDateString());
    
    // Debug: Check what classes have attendance records
    const classesWithAttendance = await prisma.attendance.groupBy({
      by: ['classId'],
      where: {
        schoolId: BigInt(schoolId),
        deletedAt: null,
        date: {
          gte: monthStart,
          lte: monthEndInclusive
        }
      },
      _count: {
        classId: true
      }
    });
    
    console.log('🔍 Classes with attendance in this month:', classesWithAttendance);
    
    // Debug: Check what attendance records exist in the database for this class
    const allClassAttendance = await prisma.attendance.findMany({
      where: {
        classId: BigInt(classId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      select: {
        date: true,
        status: true,
        studentId: true
      },
      orderBy: {
        date: 'desc'
      },
      take: 10
    });
    
    console.log('🔍 Recent attendance records for this class:', allClassAttendance.length);
    if (allClassAttendance.length > 0) {
      console.log('🔍 Sample dates in database:', allClassAttendance.slice(0, 5).map(r => r.date.toISOString().split('T')[0]));
    }
    
    // Get attendance records for the month - DATE FILTERED (inclusive end of month)
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        classId: BigInt(classId),
        date: {
          gte: monthStart,
          lte: monthEndInclusive
        },
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });
    
    console.log('🔍 Found attendance records for month (date-filtered):', attendanceRecords.length);

    // Create monthly matrix data
    const monthlyMatrix = {};
    
    classStudents.forEach(student => {
      monthlyMatrix[student.id] = {
        studentId: Number(student.id).toString(),
        studentName: `${student.user.firstName} ${student.user.lastName}`,
        rollNo: student.rollNo || '',
        dailyAttendance: {}
      };
      
      // Initialize all days of the month - FIXED
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        monthlyMatrix[student.id].dailyAttendance[dateStr] = {
          status: null,
          inTime: null,
          outTime: null
        };
      }
      
      console.log(`🔍 Created matrix for student ${student.id} with ${Object.keys(monthlyMatrix[student.id].dailyAttendance).length} days`);
    });
    
    console.log('🔍 Created matrix for 31 days of August');

    // Fill in actual attendance data - SIMPLIFIED
    attendanceRecords.forEach((record) => {
      const studentId = record.studentId.toString();
      const dateStr = record.date ? formatAfghanistanLocalISO(record.date).split('T')[0] : null;
      
      console.log(`🔍 Processing attendance record: Student ${studentId}, Date ${dateStr}, Status ${record.status}`);
      
      if (monthlyMatrix[studentId]) {
        if (dateStr) {
          monthlyMatrix[studentId].dailyAttendance[dateStr] = {
            status: record.status,
            inTime: record.inTime ? formatAfghanistanLocalISO(record.inTime) : null,
            outTime: record.outTime ? formatAfghanistanLocalISO(record.outTime) : null
          };
        }
        console.log(`✅ Updated matrix for student ${studentId} on ${dateStr}`);
      } else {
        console.log(`❌ Student ${studentId} not found in matrix`);
      }
    });
    
    console.log('🔍 Finished processing attendance records');

    // Convert to array format
    const matrixData = Object.values(monthlyMatrix);
    
    console.log('🔍 Returning monthly matrix with', matrixData.length, 'students');
    console.log('🔍 Sample data:', matrixData[0] ? Object.keys(matrixData[0].dailyAttendance).length : 0, 'days');
    
    return createSuccessResponse(res, 'Monthly attendance matrix retrieved successfully', {
      classId: Number(classId),
      month: parseInt(month),
      year: parseInt(year),
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString(),
      totalStudents: matrixData.length,
      students: matrixData
    });
  } catch (error) {
    console.error('Error in getMonthlyAttendanceMatrix:', error);
    return createErrorResponse(res, 'Failed to retrieve monthly attendance matrix', 500);
  }
};

/**
 * Export attendance data in various formats
 */
export const exportAttendanceData = async (req, res) => {
  try {
    console.log('🔍 exportAttendanceData called with:', { query: req.query, user: req.user });
    
    const { 
      format = 'pdf', 
      classId, 
      startDate, 
      endDate, 
      schoolId: querySchoolId = 1 
    } = req.query;
    
    const schoolId = req.user?.schoolId || querySchoolId;

    if (!['pdf', 'excel', 'csv'].includes(format)) {
      return createErrorResponse(res, 'Invalid export format. Supported formats: pdf, excel, csv', 400);
    }

    console.log('🔍 Exporting attendance data:', { format, classId, startDate, endDate, schoolId });

    // Build where clause
    const where = {
      schoolId: BigInt(schoolId),
      deletedAt: null
    };

    if (classId) where.classId = BigInt(classId);
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Fetch attendance data
    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        class: {
          select: {
            name: true,
            code: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { student: { rollNo: 'asc' } }
      ]
    });

    console.log('🔍 Found attendance records for export:', attendances.length);

    // Filter out incomplete records and log any issues
    const filteredAttendances = attendances.filter(attendance => {
      if (!attendance.student) {
        console.warn('Skipping attendance record without student data:', attendance.id);
        return false;
      }
      if (!attendance.student.user) {
        console.warn('Skipping attendance record without user data:', attendance.id, 'studentId:', attendance.studentId);
        return false;
      }
      if (!attendance.class) {
        console.warn('Skipping attendance record without class data:', attendance.id, 'classId:', attendance.classId);
        return false;
      }
      return true;
    });

    console.log('🔍 Filtered attendance records for export:', filteredAttendances.length);

    // Prepare data for export
    const exportData = filteredAttendances
      .map(attendance => ({
        date: attendance.date ? formatAfghanistanLocalISO(attendance.date).split('T')[0] : '',
        studentName: `${attendance.student.user.firstName} ${attendance.student.user.lastName}`,
        rollNo: attendance.student.rollNo || 'N/A',
        className: attendance.class.name,
        status: attendance.status,
        inTime: attendance.inTime ? formatAfghanistanLocalISO(attendance.inTime).split('T')[1].substring(0, 5) : '--',
        outTime: attendance.outTime ? formatAfghanistanLocalISO(attendance.outTime).split('T')[1].substring(0, 5) : '--',
        remarks: attendance.remarks || ''
      }));

    // Generate export based on format
    let exportContent, contentType, filename;

    switch (format) {
      case 'csv':
        const csvHeaders = ['Date', 'Student Name', 'Roll No', 'Class', 'Status', 'In Time', 'Out Time', 'Remarks'];
        const csvRows = exportData.map(row => [
          row.date,
          row.studentName,
          row.rollNo,
          row.className,
          row.status,
          row.inTime,
          row.outTime,
          row.remarks
        ]);
        
        exportContent = [csvHeaders, ...csvRows]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n');
        contentType = 'text/csv';
        filename = `attendance_${startDate || 'all'}_${endDate || 'data'}.csv`;
        break;

      case 'excel':
        // For now, return CSV as Excel (you can implement proper Excel generation later)
        const excelHeaders = ['Date', 'Student Name', 'Roll No', 'Class', 'Status', 'In Time', 'Out Time', 'Remarks'];
        const excelRows = exportData.map(row => [
          row.date,
          row.studentName,
          row.rollNo,
          row.className,
          row.status,
          row.inTime,
          row.outTime,
          row.remarks
        ]);
        
        exportContent = [excelHeaders, ...excelRows]
          .map(row => row.map(field => `"${field}"`).join(','))
          .join('\n');
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        filename = `attendance_${startDate || 'all'}_${endDate || 'data'}.xlsx`;
        break;

      case 'pdf':
      default:
        try {
          console.log('🔍 Generating PDF file...');
          
          // Import PDFKit library dynamically to avoid issues
          const PDFDocument = require('pdfkit');
          console.log('✅ PDFKit imported successfully');
          
          // Create a new PDF document
          const doc = new PDFDocument({
            size: 'A4',
            margin: 50,
            info: {
              Title: 'Attendance Report',
              Author: 'School Management System',
              Subject: 'Student Attendance Report',
              Keywords: 'attendance, students, report',
              CreationDate: new Date()
            }
          });
          
          console.log('✅ PDF document created');
          
          // Validate that we have data to export
          if (!exportData || exportData.length === 0) {
            console.error('❌ No data to export for PDF');
            throw new Error('No attendance data available for export');
          }
          
          console.log('🔍 Data validation passed, rows to export:', exportData.length);
          
          // Set up response headers for PDF
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="attendance_${startDate || 'all'}_${endDate || 'data'}.pdf"`);
          res.setHeader('Cache-Control', 'no-cache');
          
          // Pipe the PDF to the response
          doc.pipe(res);
          
          console.log('🔍 Starting PDF content generation...');
          
          // Add title
          doc.fontSize(24)
             .font('Helvetica-Bold')
             .text('ATTENDANCE REPORT', { align: 'center' });
          
          doc.moveDown(0.5);
          console.log('✅ Title added');
          
          // Add subtitle
          doc.fontSize(14)
             .font('Helvetica')
             .text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
          
          doc.moveDown(0.5);
          console.log('✅ Subtitle added');
          
          // Add report details
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text('Report Details:', { underline: true });
          
          doc.fontSize(10)
             .font('Helvetica')
             .text(`Class: ${classId ? 'Specific Class' : 'All Classes'}`)
             .text(`Date Range: ${startDate || 'All'} to ${endDate || 'All'}`)
             .text(`Total Records: ${exportData.length}`);
          
          doc.moveDown(1);
          console.log('✅ Report details added');
          
          // Create table headers
          const tableTop = doc.y;
          const tableLeft = 50;
          const colWidths = [80, 120, 80, 80, 80, 80, 80];
          const headers = ['Date', 'Student Name', 'Roll No', 'Class', 'Status', 'In Time', 'Out Time'];
          
          console.log('🔍 Creating table headers at Y position:', tableTop);
          
          // Draw table headers
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .fillColor('black');
          
          headers.forEach((header, i) => {
            doc.text(header, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop);
          });
          
          // Draw header underline
          doc.moveTo(tableLeft, tableTop + 15)
             .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
             .stroke();
          
          doc.moveDown(0.5);
          console.log('✅ Table headers created');
          
          // Add data rows
          let currentY = doc.y;
          doc.fontSize(9)
             .font('Helvetica');
          
          console.log('🔍 Adding data rows, starting Y position:', currentY);
          console.log('🔍 Total rows to add:', exportData.length);
          
          exportData.forEach((row, index) => {
            // Check if we need a new page
            if (currentY > 700) {
              doc.addPage();
              currentY = 50;
              console.log('📄 Added new page at row:', index);
            }
            
            const rowData = [
              row.date,
              row.studentName,
              row.rollNo,
              row.className,
              row.status,
              row.inTime,
              row.outTime
            ];
            
            // Draw row data
            rowData.forEach((cell, i) => {
              const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
              doc.text(cell || '--', x, currentY);
            });
            
            currentY += 20;
            
            // Add alternating row background
            if (index % 2 === 0) {
              doc.rect(tableLeft, currentY - 20, colWidths.reduce((a, b) => a + b, 0), 20)
                 .fillColor('#f8f9fa')
                 .fill();
              doc.fillColor('black'); // Reset fill color
            }
            
            // Log progress every 10 rows
            if (index % 10 === 0 || index === exportData.length - 1) {
              console.log(`📝 Processed row ${index + 1}/${exportData.length}, Y position: ${currentY}`);
            }
          });
          
          console.log('✅ All data rows added successfully');
          
          // Add summary at the end
          doc.addPage();
          doc.fontSize(16)
             .font('Helvetica-Bold')
             .text('Summary', { underline: true });
          
          doc.moveDown(0.5);
          
          const statusCounts = {};
          exportData.forEach(row => {
            statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
          });
          
          doc.fontSize(12)
             .font('Helvetica');
          
          Object.entries(statusCounts).forEach(([status, count]) => {
            doc.text(`${status}: ${count} students`);
          });
          
          doc.moveDown(1);
          doc.text(`Total Students: ${exportData.length}`);
          doc.text(`Report Generated: ${new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })}`);
          
          console.log('✅ PDF content added successfully');
          console.log('🔍 PDF document info:', {
            pageCount: doc.bufferedPageRange().count,
            currentPage: doc.page.pageNumber,
            yPosition: doc.y
          });
          
          // Finalize the PDF
          doc.end();
          console.log('✅ PDF finalized and sent');
          
          // Add a small delay to ensure the PDF is fully written
          setTimeout(() => {
            console.log('✅ PDF generation completed');
          }, 100);
          
          // Return early since we're piping to response
          return;
          
        } catch (pdfError) {
          console.error('❌ PDF generation failed, falling back to CSV:', pdfError);
          console.error('❌ Error details:', {
            message: pdfError.message,
            stack: pdfError.stack,
            name: pdfError.name
          });
          
          // Try to generate a simple text-based PDF as fallback
          try {
            console.log('🔄 Attempting simple PDF fallback...');
            
            const simpleDoc = new (require('pdfkit'))({
              size: 'A4',
              margin: 50
            });
            
            // Set headers for fallback PDF
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="attendance_${startDate || 'all'}_${endDate || 'data'}.pdf"`);
            
            simpleDoc.pipe(res);
            simpleDoc.fontSize(16).text('ATTENDANCE REPORT', { align: 'center' });
            simpleDoc.moveDown(1);
            simpleDoc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`);
            simpleDoc.moveDown(1);
            simpleDoc.text(`Total Records: ${exportData.length}`);
            simpleDoc.moveDown(1);
            simpleDoc.text('Note: This is a simplified version due to generation error.');
            simpleDoc.end();
            
            console.log('✅ Simple PDF fallback sent');
            return;
          } catch (fallbackError) {
            console.error('❌ PDF fallback also failed:', fallbackError);
            
            // Final fallback to CSV
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="attendance_${startDate || 'all'}_${endDate || 'data'}.csv"`);
            res.send(exportContent);
            console.log('✅ Final fallback CSV sent');
            return;
          }
        }
        break;
      }

      // Set response headers for file download (only for non-PDF formats)
      if (format !== 'pdf') {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(exportContent, 'utf8'));
      }

      console.log('✅ Export completed successfully:', { format, filename, records: exportData.length });
      
      // For Excel format, we need to create a proper Excel file
      if (format === 'excel') {
        try {
          console.log('🔍 Generating Excel file...');
          
          // Import ExcelJS library dynamically to avoid issues
          const ExcelJS = require('exceljs');
          console.log('✅ ExcelJS imported successfully');
          
          // Create workbook and worksheet
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Attendance Data');
          console.log('✅ Workbook and worksheet created');
          
          // Add headers
          worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Student Name', key: 'studentName', width: 25 },
            { header: 'Roll No', key: 'rollNo', width: 15 },
            { header: 'Class', key: 'className', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'In Time', key: 'inTime', width: 15 },
            { header: 'Out Time', key: 'outTime', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 30 }
          ];
          console.log('✅ Headers added');
          
          // Add data rows
          exportData.forEach((row, index) => {
            worksheet.addRow(row);
            if (index < 5) console.log('📝 Added row:', row); // Log first 5 rows for debugging
          });
          console.log(`✅ Added ${exportData.length} data rows`);
          
          // Style the header row
          worksheet.getRow(1).font = { bold: true };
          worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
          console.log('✅ Header styling applied');
          
          // Write to buffer
          console.log('🔍 Writing to buffer...');
          const buffer = await workbook.xlsx.writeBuffer();
          console.log('✅ Buffer created, size:', buffer.length);
          
          // Set proper headers for Excel
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Length', buffer.length);
          res.setHeader('Cache-Control', 'no-cache');
          console.log('✅ Headers set for Excel');
          
          // Send the buffer
          res.send(buffer);
          console.log('✅ Excel buffer sent successfully');
        } catch (excelError) {
          console.error('❌ Excel generation failed, falling back to CSV:', excelError);
          console.error('❌ Error details:', {
            message: excelError.message,
            stack: excelError.stack,
            name: excelError.name
          });
          
          // Fallback to CSV if Excel fails
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="attendance_${startDate || 'all'}_${endDate || 'data'}.csv"`);
          res.send(exportContent);
          console.log('✅ Fallback CSV sent');
        }
      } else if (format === 'csv') {
        // Send the CSV content
        res.send(exportContent);
        console.log('✅ CSV content sent');
      }
      // Note: PDF is handled separately above with doc.pipe(res)

    } catch (error) {
      console.error('Error in exportAttendanceData:', error);
      return createErrorResponse(res, 'Failed to export attendance data', 500);
    }
  };

  /**
   * Automatically mark absent students who haven't marked in by 9 AM
   * This function should be called by a scheduled task/cron job
   * COMMENTED OUT: Automatic attendance marking is disabled
   */
  /*
  export const autoMarkAbsentStudents = async (req, res) => {
    try {
      console.log('🤖 Auto-marking absent students...');
      
      // Check if it's time to auto-mark absent (after 9 AM Afghanistan time)
      if (!isAutoAbsentTime()) {
        const afghanTime = getFormattedAfghanTime();
        console.log('⏰ Not yet time to auto-mark absent. Current Afghanistan time:', afghanTime);
        console.log('⏰ Auto-mark absent runs after 9:00 AM Afghanistan time');
        return createErrorResponse(res, 'Not yet time to auto-mark absent', 400, {
          message: `Auto-mark absent runs after 9:00 AM Afghanistan time. Current time: ${afghanTime}`,
          currentAfghanTime: afghanTime,
          autoMarkTime: 'After 9:00 AM (Afghanistan time)'
        });
      }

      const afghanTime = getFormattedAfghanTime();
      const today = new Date();
      const schoolId = req.user?.schoolId || 1;

      console.log('🌍 Current Afghanistan time:', afghanTime);
      console.log('📅 Processing date:', today.toISOString());
      console.log('🏫 School ID:', schoolId);

      // Get all active students for the school
      const students = await prisma.student.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          user: {
            status: 'ACTIVE'
          }
        },
        include: {
          class: {
            select: {
              id: true,
              name: true
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true
            }
          }
        }
      });

      console.log(`📚 Found ${students.length} active students`);

      let absentCount = 0;
      let presentCount = 0;
      let errorCount = 0;

      // Process each student
      for (const student of students) {
        try {
          // Check if attendance record already exists for today
          const existingAttendance = await prisma.attendance.findFirst({
            where: {
              studentId: student.id,
              classId: student.classId,
              date: today,
              schoolId: BigInt(schoolId),
              deletedAt: null
            }
          });

          if (existingAttendance) {
            // Student already has attendance record for today
            if (existingAttendance.status === 'PRESENT' || existingAttendance.inTime) {
              presentCount++;
              console.log(`✅ Student ${student.user.firstName} ${student.user.lastName} already marked present`);
            } else {
              // Update existing record to mark as absent
              await prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  status: 'ABSENT',
                  updatedAt: new Date()
                }
              });
              absentCount++;
              console.log(`❌ Updated student ${student.user.firstName} ${student.user.lastName} as absent`);
            }
          } else {
            // Create new absent record
            await prisma.attendance.create({
              data: {
                date: today,
                status: 'ABSENT',
                studentId: student.id,
                classId: student.classId,
                schoolId: BigInt(schoolId),
                createdBy: BigInt(req.user?.id || 1),
                createdAt: new Date()
              }
            });
            absentCount++;
            console.log(`❌ Created absent record for student ${student.user.firstName} ${student.user.lastName}`);

            // Send SMS notification for absent student (non-blocking)
            try {
              if (student.user && student.user.phone) {
                smsService.sendAttendanceSMS(
                  {
                    name: `${student.user.firstName} ${student.user.lastName}`,
                    phone: student.user.phone
                  },
                  {
                    date: today,
                    className: student.class?.name || 'Unknown Class',
                    status: 'ABSENT',
                    reason: 'No mark-in recorded by 9:00 AM'
                  },
                  'absent' // Use appropriate campaign ID for absent notifications
                ).then(smsResult => {
                  if (smsResult && smsResult.success) {
                    console.log(`📱 Absent SMS sent to ${student.user.firstName} ${student.user.lastName}`);
                  }
                }).catch(smsError => {
                  console.error(`❌ Failed to send absent SMS to ${student.user.firstName}:`, smsError.message);
                });
              }
            } catch (smsError) {
              console.error(`❌ SMS preparation failed for ${student.user.firstName}:`, smsError.message);
            }
          }
        } catch (studentError) {
          errorCount++;
          console.error(`❌ Error processing student ${student.user?.firstName || 'Unknown'}:`, studentError.message);
        }
      }

      const summary = {
        totalStudents: students.length,
        presentCount,
        absentCount,
        errorCount,
        processedAt: afghanTime,
        date: today.toISOString()
      };

      console.log('📊 Auto-mark absent summary:', summary);

      return createSuccessResponse(res, 'Auto-mark absent completed successfully', summary);
    } catch (error) {
      console.error('❌ Error in autoMarkAbsentStudents:', error);
      return createErrorResponse(res, 'Failed to auto-mark absent students', 500, {
        error: error.message
      });
    }
  };
  */

  /**
   * Automatically mark absent students who don't have both inTime and outTime before today
   * This function checks for students without complete attendance records and marks them absent
   */
  export const markIncompleteAttendanceAsAbsent = async (req, res) => {
    try {
      console.log('🤖 Marking students with incomplete attendance as absent...');
      
      const afghanTime = getFormattedAfghanTime();
      const today = new Date();
      const schoolId = req.user?.schoolId || 1;

      console.log('🌍 Current Afghanistan time:', afghanTime);
      console.log('📅 Processing date:', today.toISOString());
      console.log('🏫 School ID:', schoolId);

      // Get all active students for the school
      const students = await prisma.student.findMany({
        where: {
          schoolId: BigInt(schoolId),
          deletedAt: null,
          user: {
            status: 'ACTIVE'
          }
        },
        include: {
          class: {
            select: {
              id: true,
              name: true
            }
          },
          user: {
            select: {
              firstName: true,
              lastName: true,
              phone: true
            }
          }
        }
      });

      console.log(`📚 Found ${students.length} active students`);

      let absentCount = 0;
      let presentCount = 0;
      let errorCount = 0;

      // Process each student
      for (const student of students) {
        try {
          // Check if student has complete attendance record for today (both inTime and outTime)
          const existingAttendance = await prisma.attendance.findFirst({
            where: {
              studentId: student.id,
              classId: student.classId,
              date: today,
              schoolId: BigInt(schoolId),
              deletedAt: null
            }
          });

          if (existingAttendance) {
            // Check if the student has both inTime and outTime
            if (existingAttendance.inTime && existingAttendance.outTime) {
              // Student has complete attendance record
              presentCount++;
              console.log(`✅ Student ${student.user.firstName} ${student.user.lastName} has complete attendance record`);
            } else {
              // Student has incomplete attendance record (missing inTime or outTime)
              // Mark as absent
              await prisma.attendance.update({
                where: { id: existingAttendance.id },
                data: {
                  status: 'ABSENT',
                  updatedAt: new Date()
                }
              });
              absentCount++;
              console.log(`❌ Updated student ${student.user.firstName} ${student.user.lastName} as absent (incomplete attendance)`);
            }
          } else {
            // No attendance record exists for today - create absent record
            await prisma.attendance.create({
              data: {
                date: today,
                status: 'ABSENT',
                studentId: student.id,
                classId: student.classId,
                schoolId: BigInt(schoolId),
                createdBy: BigInt(req.user?.id || 1),
                createdAt: new Date()
              }
            });
            absentCount++;
            console.log(`❌ Created absent record for student ${student.user.firstName} ${student.user.lastName} (no attendance record)`);
          }

          // Send SMS notification for absent student (non-blocking)
          try {
            if (student.user && student.user.phone) {
              smsService.sendAttendanceSMS(
                {
                  name: `${student.user.firstName} ${student.user.lastName}`,
                  phone: student.user.phone
                },
                {
                  date: today,
                  className: student.class?.name || 'Unknown Class',
                  status: 'ABSENT',
                  reason: 'Incomplete attendance record (missing inTime or outTime)'
                },
                'absent'
              ).then(smsResult => {
                if (smsResult && smsResult.success) {
                  console.log(`📱 Absent SMS sent to ${student.user.firstName} ${student.user.lastName}`);
                }
              }).catch(smsError => {
                console.error(`❌ Failed to send absent SMS to ${student.user.firstName}:`, smsError.message);
              });
            }
          } catch (smsError) {
            console.error(`❌ SMS preparation failed for ${student.user.firstName}:`, smsError.message);
          }
        } catch (studentError) {
          errorCount++;
          console.error(`❌ Error processing student ${student.user?.firstName || 'Unknown'}:`, studentError.message);
        }
      }

      const summary = {
        totalStudents: students.length,
        presentCount,
        absentCount,
        errorCount,
        processedAt: afghanTime,
        date: today.toISOString(),
        description: 'Marked students absent who have incomplete attendance records (missing inTime or outTime)'
      };

      console.log('📊 Mark incomplete attendance as absent summary:', summary);

      return createSuccessResponse(res, 'Marked incomplete attendance as absent successfully', summary);
    } catch (error) {
      console.error('❌ Error in markIncompleteAttendanceAsAbsent:', error);
      return createErrorResponse(res, 'Failed to mark incomplete attendance as absent', 500, {
        error: error.message
      });
    }
  };

  /**
   * Get attendance time windows and current status
   */
  export const getAttendanceTimeStatus = async (req, res) => {
    try {
      const afghanTime = getAfghanistanTime();
      const currentHour = afghanTime.getHours();
      const currentMinute = afghanTime.getMinutes();

      const status = {
        currentAfghanTime: getFormattedAfghanTime(),
        currentHour,
        currentMinute,
        timeWindows: {
          markIn: {
            start: 'Any time',
            end: 'Any time',
            isOpen: true,
            description: 'Time restrictions removed - attendance can be marked at any time'
          },
          markOut: {
            start: 'Any time',
            end: 'Any time',
            isOpen: true,
            description: 'Time restrictions removed - attendance can be marked at any time'
          },
          autoAbsent: {
            time: 'Disabled',
            isActive: false,
            description: 'Auto-absent feature disabled - time restrictions removed'
          }
        },
        nextWindow: getNextWindowInfo(currentHour),
        timezone: AFGHANISTAN_TIMEZONE,
        utcOffset: '+04:30'
      };

      return createSuccessResponse(res, 'Attendance time status retrieved successfully', status);
    } catch (error) {
      console.error('❌ Error in getAttendanceTimeStatus:', error);
      return createErrorResponse(res, 'Failed to get attendance time status', 500, {
        error: error.message
      });
    }
  };

  /**
   * Get information about the next available time window
   */
  const getNextWindowInfo = (currentHour) => {
    if (currentHour < ATTENDANCE_TIMES.MARK_IN_START) {
      return {
        type: 'markIn',
        time: `${ATTENDANCE_TIMES.MARK_IN_START}:00 AM`,
        description: 'Mark-in window opens at 7:00 AM',
        waitTime: `${ATTENDANCE_TIMES.MARK_IN_START - currentHour} hours`
      };
    } else if (currentHour < ATTENDANCE_TIMES.MARK_IN_END) {
      return {
        type: 'markIn',
        time: `${ATTENDANCE_TIMES.MARK_IN_END}:00 AM`,
        description: 'Mark-in window closes at 8:00 AM',
        remainingTime: `${ATTENDANCE_TIMES.MARK_IN_END - currentHour} hours`
      };
    } else if (currentHour < ATTENDANCE_TIMES.MARK_OUT_START) {
      return {
        type: 'markOut',
        time: `${ATTENDANCE_TIMES.MARK_OUT_START}:00 PM`,
        description: 'Mark-out window opens at 12:00 PM',
        waitTime: `${ATTENDANCE_TIMES.MARK_OUT_START - currentHour} hours`
      };
    } else if (currentHour < ATTENDANCE_TIMES.MARK_OUT_END) {
      return {
        type: 'markOut',
        time: `${ATTENDANCE_TIMES.MARK_OUT_END}:00 PM`,
        description: 'Mark-out window closes at 1:00 PM',
        remainingTime: `${ATTENDANCE_TIMES.MARK_OUT_END - currentHour} hours`
      };
    } else {
      return {
        type: 'nextDay',
        time: '7:00 AM tomorrow',
        description: 'Next mark-in window opens tomorrow at 7:00 AM',
        waitTime: 'Next day'
      };
    }
  };

  export default {
    getAllAttendances,
    getAttendanceById,
    createAttendance,
    updateAttendance,
    markInTime,
    markOutTime,
    bulkCreateAttendance,
    deleteAttendance,
    getClassAttendanceSummary,
    getAttendanceSummary,
    getAttendanceStats,
    getAttendanceAnalytics,
    getMonthlyAttendanceMatrix,
    exportAttendanceData,
    // autoMarkAbsentStudents, // COMMENTED OUT: Automatic attendance marking is disabled
    markIncompleteAttendanceAsAbsent,
    getAttendanceTimeStatus
  };

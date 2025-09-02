import { PrismaClient } from '../generated/prisma/index.js';
import smsService from './smsService.js';

const prisma = new PrismaClient();

// Afghanistan timezone (UTC+4:30)
const AFGHANISTAN_TIMEZONE = 'Asia/Kabul';

// Attendance time windows (in Afghanistan time)
const ATTENDANCE_TIMES = {
  AUTO_ABSENT_TIME: 9  // 9:00 AM - after this time, mark absent if no mark-in
};

/**
 * Get current time in Afghanistan timezone
 */
const getAfghanistanTime = () => {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: AFGHANISTAN_TIMEZONE }));
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

/**
 * Automatically mark absent students who don't have both inTime and outTime before today
 * This function checks for students without complete attendance records and marks them absent
 * Note: No SMS notifications are sent for automatic absent marking to avoid spam
 */
export const markIncompleteAttendanceAsAbsent = async (schoolId = 1) => {
  try {
    console.log('🤖 Auto-marking students with incomplete attendance as absent...');
    
    const afghanTime = getFormattedAfghanTime();
    const today = new Date();
    
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
              createdBy: BigInt(1), // System user
              createdAt: new Date()
            }
          });
          absentCount++;
          console.log(`❌ Created absent record for student ${student.user.firstName} ${student.user.lastName} (no attendance record)`);
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
    return summary;

  } catch (error) {
    console.error('❌ Error in markIncompleteAttendanceAsAbsent:', error);
    throw error;
  }
};

/**
 * Automatically mark absent students who haven't marked in by 9 AM
 * This function should be called by a scheduled task/cron job
 * Note: No SMS notifications are sent for automatic absent marking to avoid spam
 * COMMENTED OUT: Automatic attendance marking is disabled
 */
/*
export const autoMarkAbsentStudents = async (schoolId = 1) => {
  try {
    console.log('🤖 Auto-marking absent students...');
    
    // Check if it's time to auto-mark absent (after 9 AM Afghanistan time)
    if (!isAutoAbsentTime()) {
      const afghanTime = getFormattedAfghanTime();
      console.log('⏰ Not yet time to auto-mark absent. Current Afghanistan time:', afghanTime);
      console.log('⏰ Auto-mark absent runs after 9:00 AM Afghanistan time');
      return {
        success: false,
        message: 'Not yet time to auto-mark absent',
        currentTime: afghanTime
      };
    }

    const afghanTime = getFormattedAfghanTime();
    const today = new Date();

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
              createdBy: BigInt(1), // System user
              createdAt: new Date()
            }
          });
          absentCount++;
          console.log(`❌ Created absent record for student ${student.user.firstName} ${student.user.lastName}`);


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
    return summary;

  } catch (error) {
    console.error('❌ Error in autoMarkAbsentStudents:', error);
    throw error;
  }
};
*/

/**
 * Get current attendance time status
 */
export const getAttendanceTimeStatus = () => {
  const afghanTime = getAfghanistanTime();
  const currentHour = afghanTime.getHours();
  const currentMinute = afghanTime.getMinutes();

  return {
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
        time: '9:00 AM',
        isActive: isAutoAbsentTime(),
        description: 'Auto-absent feature runs after 9:00 AM Afghanistan time'
      }
    },
    timezone: AFGHANISTAN_TIMEZONE,
    utcOffset: '+04:30'
  };
};

/**
 * Start the automatic attendance service
 * This function will run the attendance marking service at regular intervals
 * COMMENTED OUT: Automatic attendance marking is disabled
 */
/*
export const startAttendanceService = (schoolId = 1) => {
  console.log('🚀 Starting Automatic Attendance Service...');
  
  // Run immediately if it's the right time
  if (isAutoAbsentTime()) {
    console.log('⏰ It\'s time to run attendance service, executing now...');
    autoMarkAbsentStudents(schoolId).catch(error => {
      console.error('❌ Error running immediate attendance service:', error);
    });
  }

  // Set up interval to check every 15 minutes
  const ATTENDANCE_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
  
  setInterval(async () => {
    try {
      const afghanTime = getFormattedAfghanTime();
      console.log(`⏰ Checking attendance service at ${afghanTime}...`);
      
      if (isAutoAbsentTime()) {
        console.log('✅ Time to run attendance service, executing...');
        const result = await autoMarkAbsentStudents(schoolId);
        console.log('✅ Attendance service completed:', result);
      } else {
        console.log('⏳ Not yet time to run attendance service');
      }
    } catch (error) {
      console.error('❌ Error in scheduled attendance service:', error);
    }
  }, ATTENDANCE_CHECK_INTERVAL);

  console.log(`✅ Automatic Attendance Service started. Checking every 15 minutes.`);
  console.log(`⏰ Next check will be at ${new Date(Date.now() + ATTENDANCE_CHECK_INTERVAL).toLocaleString()}`);
};
*/

export default {
  markIncompleteAttendanceAsAbsent,
  // autoMarkAbsentStudents, // COMMENTED OUT: Automatic attendance marking is disabled
  getAttendanceTimeStatus,
  // startAttendanceService // COMMENTED OUT: Automatic attendance marking is disabled
}; 

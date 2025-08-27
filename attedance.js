#!/usr/bin/env node

/**
 * Automated Attendance Management Script
 * 
 * This script automatically marks absent students who haven't marked in by 9 AM Afghanistan time.
 * It should be run as a cron job every day at 9:15 AM Afghanistan time (4:45 AM UTC).
 * 
 * Usage:
 * 1. Set up cron job: 0 4 45 * * * /usr/bin/node /path/to/scripts/autoAttendance.js
 * 2. Or run manually: node scripts/autoAttendance.js
 * 
 * Environment Variables Required:
 * - DATABASE_URL: Prisma database connection string
 * - JWT_SECRET: For authentication
 * - SCHOOL_ID: Default school ID (defaults to 1)
 */

import { PrismaClient } from './generated/prisma/client.js';
import smsService from './services/smsService.js';

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
    hour12: false
  });
};

/**
 * Automatically mark absent students who haven't marked in by 9 AM
 */
const autoMarkAbsentStudents = async () => {
  try {
    console.log('🤖 Auto-marking absent students...');
    console.log('🌍 Current Afghanistan time:', getFormattedAfghanTime());
    
    // Check if it's time to auto-mark absent (after 9 AM Afghanistan time)
    if (!isAutoAbsentTime()) {
      const afghanTime = getFormattedAfghanTime();
      console.log('⏰ Not yet time to auto-mark absent. Current Afghanistan time:', afghanTime);
      console.log('⏰ Auto-mark absent runs after 9:00 AM Afghanistan time');
      return;
    }

    const afghanTime = getFormattedAfghanTime();
    const today = new Date();
    const schoolId = process.env.SCHOOL_ID || 1;

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
    console.log('✅ Auto-mark absent completed successfully');

  } catch (error) {
    console.error('❌ Error in autoMarkAbsentStudents:', error);
    throw error;
  }
};

/**
 * Main execution function
 */
const main = async () => {
  try {
    console.log('🚀 Starting automated attendance management...');
    console.log('🌍 Current Afghanistan time:', getFormattedAfghanTime());
    
    await autoMarkAbsentStudents();
    
    console.log('✅ Automated attendance management completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Automated attendance management failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 

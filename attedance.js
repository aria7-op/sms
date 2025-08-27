import { PrismaClient } from './generated/prisma/index.js';
import { format, startOfDay, endOfDay } from 'date-fns';
import { z } from 'zod';

const prisma = new PrismaClient();

// Timezone constants
const AFGHANISTAN_TIMEZONE = 'Asia/Kabul';
const ATTENDANCE_TIMES = {
  MARK_IN_START: '07:00',
  MARK_IN_END: '08:00',
  MARK_OUT_START: '12:00',
  MARK_OUT_END: '13:00',
  AUTO_ABSENT_TIME: '09:00'
};

// Helper functions
function getAfghanistanTime() {
  return new Date().toLocaleString('en-US', { timeZone: AFGHANISTAN_TIMEZONE });
}

function isMarkInTimeWindow() {
  const now = new Date();
  const afghanTime = now.toLocaleString('en-US', { timeZone: AFGHANISTAN_TIMEZONE });
  const currentTime = afghanTime.split(', ')[1];
  const [hours, minutes] = currentTime.split(':');
  const currentMinutes = parseInt(hours) * 60 + parseInt(minutes);
  
  const [startHours, startMinutes] = ATTENDANCE_TIMES.MARK_IN_START.split(':');
  const startTimeMinutes = parseInt(startHours) * 60 + parseInt(startMinutes);
  
  const [endHours, endMinutes] = ATTENDANCE_TIMES.MARK_IN_END.split(':');
  const endTimeMinutes = parseInt(endHours) * 60 + parseInt(endMinutes);
  
  return currentMinutes >= startTimeMinutes && currentMinutes <= endTimeMinutes;
}

function isMarkOutTimeWindow() {
  const now = new Date();
  const afghanTime = now.toLocaleString('en-US', { timeZone: AFGHANISTAN_TIMEZONE });
  const currentTime = afghanTime.split(', ')[1];
  const [hours, minutes] = currentTime.split(':');
  const currentMinutes = parseInt(hours) * 60 + parseInt(minutes);
  
  const [startHours, startMinutes] = ATTENDANCE_TIMES.MARK_OUT_START.split(':');
  const startTimeMinutes = parseInt(startHours) * 60 + parseInt(startMinutes);
  
  const [endHours, endMinutes] = ATTENDANCE_TIMES.MARK_OUT_END.split(':');
  const endTimeMinutes = parseInt(endHours) * 60 + parseInt(endMinutes);
  
  return currentMinutes >= startTimeMinutes && currentMinutes <= endTimeMinutes;
}

function isAutoAbsentTime() {
  const now = new Date();
  const afghanTime = now.toLocaleString('en-US', { timeZone: AFGHANISTAN_TIMEZONE });
  const currentTime = afghanTime.split(', ')[1];
  const [hours, minutes] = currentTime.split(':');
  const currentMinutes = parseInt(hours) * 60 + parseInt(minutes);
  
  const [autoAbsentHours, autoAbsentMinutes] = ATTENDANCE_TIMES.AUTO_ABSENT_TIME.split(':');
  const autoAbsentTimeMinutes = parseInt(autoAbsentHours) * 60 + parseInt(autoAbsentMinutes);
  
  return currentMinutes >= autoAbsentTimeMinutes;
}

function getFormattedAfghanTime() {
  const now = new Date();
  return now.toLocaleString('en-US', { 
    timeZone: AFGHANISTAN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

// Main function to automatically mark absent students
async function autoMarkAbsentStudents() {
  try {
    console.log('🚀 Starting automated absent marking process...');
    const afghanTime = getFormattedAfghanTime();
    console.log('⏰ Current Afghanistan time:', afghanTime);
    
    // Check if it's time to auto-mark absent
    if (!isAutoAbsentTime()) {
      console.log('⏰ Not yet time to auto-mark absent students');
      console.log(`⏰ Auto-absent marking is scheduled for ${ATTENDANCE_TIMES.AUTO_ABSENT_TIME} Afghanistan time`);
      return;
    }
    
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    
    console.log('📅 Processing date:', format(today, 'yyyy-MM-dd'));
    
    // Get all active students
    const students = await prisma.student.findMany({
      where: {
        isActive: true,
        deletedAt: null
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
            lastName: true
          }
        }
      }
    });
    
    console.log(`👥 Found ${students.length} active students`);
    
    let markedAbsent = 0;
    let alreadyMarked = 0;
    let errors = 0;
    
    for (const student of students) {
      try {
        // Check if student already has attendance for today
        const existingAttendance = await prisma.attendance.findFirst({
          where: {
            studentId: student.id,
            date: {
              gte: today,
              lte: todayEnd
            },
            deletedAt: null
          }
        });
        
        if (existingAttendance) {
          console.log(`✅ Student ${student.user?.firstName || 'Unknown'} already has attendance for today`);
          alreadyMarked++;
          continue;
        }
        
        // Mark student as absent
        const absentAttendance = await prisma.attendance.create({
          data: {
            studentId: student.id,
            classId: student.class?.id || null,
            date: today,
            status: 'ABSENT',
            markInTime: null,
            markOutTime: null,
            reason: 'No mark-in recorded by 9:00 AM',
            isAutoMarked: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        });
        
        console.log(`❌ Marked ${student.user?.firstName || 'Unknown'} ${student.user?.lastName || 'Student'} as ABSENT`);
        markedAbsent++;
        
      } catch (error) {
        console.error(`❌ Error processing student ${student.id}:`, error.message);
        errors++;
      }
    }
    
    console.log('\n📊 Automated absent marking completed:');
    console.log(`✅ Already marked: ${alreadyMarked}`);
    console.log(`❌ Newly marked absent: ${markedAbsent}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📅 Date: ${format(today, 'yyyy-MM-dd')}`);
    console.log(`⏰ Time: ${afghanTime}`);
    
  } catch (error) {
    console.error('❌ Fatal error in autoMarkAbsentStudents:', error);
  }
}

// Main execution function
async function main() {
  try {
    console.log('🚀 Starting automated attendance system...');
    console.log('⏰ Current Afghanistan time:', getFormattedAfghanTime());
    
    // Run the auto-mark absent function
    await autoMarkAbsentStudents();
    
    console.log('✅ Automated attendance process completed successfully');
    
  } catch (error) {
    console.error('❌ Error in main function:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Export the main function for PM2
export { autoMarkAbsentStudents };

// For PM2, we want the process to exit after completion
// This prevents constant restarting
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('✅ Process completed, exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Process failed:', error);
      process.exit(1);
    });
} 

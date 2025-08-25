  import { PrismaClient } from '../generated/prisma/client.js';
  import { createSuccessResponse, createErrorResponse } from '../utils/responseUtils.js';
  import smsService from '../services/smsService.js';

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
      if (date) where.date = new Date(date);
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
                    lastName: true,
                    email: true
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
        } : null
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
                  lastName: true,
                  email: true
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

      return createSuccessResponse(res, 'Attendance retrieved successfully', attendance);
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
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          studentId: BigInt(studentId),
          classId: BigInt(classId),
          subjectId: subjectId ? BigInt(subjectId) : null,
          date: new Date(date),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (existingAttendance) {
        return createErrorResponse(res, 'Attendance record already exists for this student, class, and date', 409);
      }

      // Create attendance record
    const attendance = await prisma.attendance.create({
        data: {
          date: new Date(date),
          status,
          inTime: inTime ? new Date(inTime) : null,
          outTime: outTime ? new Date(outTime) : null,
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

      return createSuccessResponse(res, 'Attendance created successfully', attendance, 201);
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

      // Update attendance
    const attendance = await prisma.attendance.update({
        where: { id: BigInt(id) },
        data: {
          status,
          inTime: inTime ? new Date(inTime) : null,
          outTime: outTime ? new Date(outTime) : null,
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

      return createSuccessResponse(res, 'Attendance updated successfully', attendance);
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
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: studentId, date'
        });
      }

      const currentTime = new Date();
      const attendanceDate = new Date(date);
      const schoolId = 1; // Default school ID for testing
      const createdBy = 1; // Default user ID for testing

      console.log('⏰ Current time:', currentTime);
      console.log('📅 Attendance date:', attendanceDate);
      console.log('🏫 School ID:', schoolId);
      console.log('👤 Created by:', createdBy);

      // First, find the student by ID
      console.log('🔍 Finding student by ID:', studentId);
      const student = await prisma.student.findUnique({
        where: {
          id: BigInt(studentId),
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
          class: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!student) {
        console.log('❌ Student not found with ID:', studentId);
        return res.status(404).json({
          success: false,
          error: `Student with ID ${studentId} not found`
        });
      }

      console.log('✅ Student found:', {
        id: student.id,
        rollNo: student.rollNo,
        name: `${student.user.firstName} ${student.user.lastName}`
      });

      // Check if attendance record exists
      console.log('🔍 Checking if attendance record exists...');
      let attendance = await prisma.attendance.findFirst({
        where: {
          studentId: student.id,
          classId: student.class.id,
          subjectId: subjectId ? BigInt(subjectId) : null,
          date: attendanceDate,
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (attendance) {
        console.log('📝 Updating existing attendance record:', attendance.id);
        // Update existing record with in-time
        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            inTime: currentTime,
            status: 'PRESENT'
          }
        });
        console.log('✅ Attendance record updated successfully');
      } else {
        console.log('🆕 Creating new attendance record...');
        // Create new record
        attendance = await prisma.attendance.create({
          data: {
            date: attendanceDate,
            status: 'PRESENT',
            inTime: currentTime,
            studentId: student.id,
            classId: student.class.id,
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
        date: attendance.date ? attendance.date.toISOString() : null,
        inTime: attendance.inTime ? attendance.inTime.toISOString() : null,
        outTime: attendance.outTime ? attendance.outTime.toISOString() : null,
        createdAt: attendance.createdAt ? attendance.createdAt.toISOString() : null,
        updatedAt: attendance.updatedAt ? attendance.updatedAt.toISOString() : null
      };
      console.log('✅ Data serialized successfully');

      // Send SMS notification (non-blocking)
      try {
        console.log('🔍 Starting SMS process for student ID:', studentId);
        console.log('📱 About to call SMS service...');
        
        // Class information already available from student lookup
        const classInfo = student.class;

        if (student && student.user && student.user.phone) {
          console.log('👤 Student found:', {
            name: `${student.user.firstName} ${student.user.lastName}`,
            phone: student.user.phone
          });
          console.log('📚 Class info:', classInfo);
          
          // Send SMS notification asynchronously (don't wait for it)
          console.log('📱 Calling SMS service with data:', {
            studentName: `${student.user.firstName} ${student.user.lastName}`,
            phone: student.user.phone,
            inTime: currentTime,
            date: attendanceDate,
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
                phone: student.user.phone
              },
              {
                inTime: currentTime,
                date: attendanceDate,
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
                phone: student.user.phone,
                time: currentTime,
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
      res.status(500).json({
        success: false,
        error: 'Failed to mark in-time',
        message: error.message
      });
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
        return createErrorResponse(res, 'Missing required fields: studentId, date', 400);
      }

      const currentTime = new Date();
      const attendanceDate = new Date(date);

      console.log('⏰ Current time:', currentTime);
      console.log('📅 Attendance date:', attendanceDate);
      console.log('🏫 School ID:', schoolId);
      console.log('👤 Updated by:', updatedBy);

      // First, find the student by ID
      console.log('🔍 Finding student by ID:', studentId);
      const student = await prisma.student.findUnique({
        where: {
          id: BigInt(studentId),
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
          class: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!student) {
        console.log('❌ Student not found with ID:', studentId);
        return createErrorResponse(res, `Student with ID ${studentId} not found`, 404);
      }

      console.log('✅ Student found:', {
        id: student.id,
        rollNo: student.rollNo,
        name: `${student.user.firstName} ${student.user.lastName}`
      });

      // Find existing attendance record
      const attendance = await prisma.attendance.findFirst({
        where: {
          studentId: student.id,
          classId: student.class.id,
          subjectId: subjectId ? BigInt(subjectId) : null,
          date: attendanceDate,
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!attendance) {
        return createErrorResponse(res, 'No attendance record found for this student, class, and date', 404);
      }

      // Update with out-time
      const updatedAttendance = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          outTime: currentTime,
          updatedBy: BigInt(updatedBy)
        }
      });

      // Send SMS notification for out-time (non-blocking)
      try {
        console.log('🔍 Starting SMS process for student ID:', studentId);
        console.log('📱 About to call SMS service...');
        
        if (student && student.user && student.user.phone) {
          // Send SMS notification asynchronously (don't wait for it)
          smsService.sendAttendanceSMS(
            {
              name: `${student.user.firstName} ${student.user.lastName}`,
              phone: student.user.phone
            },
            {
              outTime: currentTime,
              date: attendanceDate,
              className: student.class.name,
              status: 'DEPARTED'
            },
            'outTime' // Use campaign ID 404 for out-time
          ).then(smsResult => {
            if (smsResult && smsResult.success) {
              console.log('📱 SMS sent successfully for student:', student.user.firstName, {
                campaignId: smsResult.campaignId,
                phone: student.user.phone,
                time: currentTime
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
      return createErrorResponse(res, 'Failed to mark out-time', 500);
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
          date: new Date(date),
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
          inTime: attendance?.inTime ? attendance.inTime.toISOString() : null,
          outTime: attendance?.outTime ? attendance.outTime.toISOString() : null
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
      if (date) where.date = new Date(date);

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
   * Get attendance statistics and analytics
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
        orderBy: { date: 'asc' }
      });

      // Calculate statistics
      const totalDays = new Set(attendances.map(r => r.date.toISOString().split('T')[0])).size;
      const totalPresent = attendances.filter(r => r.status === 'PRESENT').length;
      const totalAbsent = attendances.filter(r => r.status === 'ABSENT').length;
      const totalLate = attendances.filter(r => r.status === 'LATE').length;
      const totalExcused = attendances.filter(r => r.status === 'EXCUSED').length;
      const averageAttendanceRate = totalDays > 0 ? Math.round((totalPresent / (totalPresent + totalAbsent)) * 100) : 0;

      // Calculate total hours
      const totalHours = attendances.reduce((total, record) => {
        if (record.inTime && record.outTime) {
          const diffMs = new Date(record.outTime) - new Date(record.inTime);
          return total + (diffMs / (1000 * 60 * 60));
        }
        return total;
      }, 0);

      const stats = {
        totalDays,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        averageAttendanceRate,
        bestAttendanceDay: '', // TODO: Implement calculation
        worstAttendanceDay: '', // TODO: Implement calculation
        consecutivePresentDays: 0, // TODO: Implement calculation
        totalHours: Math.round(totalHours * 100) / 100
      };

      return createSuccessResponse(res, 'Attendance statistics retrieved successfully', stats);
    } catch (error) {
      console.error('Error in getAttendanceStats:', error);
      return createErrorResponse(res, 'Failed to retrieve attendance statistics', 500);
    }
  };

  /**
   * Get attendance trends and analytics
   */
  export const getAttendanceAnalytics = async (req, res) => {
    try {
      const { classId, period = 'daily', startDate, endDate, schoolId: querySchoolId = 1 } = req.query;
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
        orderBy: { date: 'asc' }
      });

      // Group by date and calculate daily trends
      const dailyTrends = {};
      attendances.forEach(record => {
        const date = record.date.toISOString().split('T')[0];
        if (!dailyTrends[date]) {
          dailyTrends[date] = { present: 0, absent: 0, late: 0, excused: 0 };
        }
        
        if (record.status === 'PRESENT') dailyTrends[date].present++;
        else if (record.status === 'ABSENT') dailyTrends[date].absent++;
        else if (record.status === 'LATE') dailyTrends[date].late++;
        else if (record.status === 'EXCUSED') dailyTrends[date].excused++;
      });

      const trends = Object.entries(dailyTrends).map(([date, counts]) => ({
        date,
        ...counts
      }));

      return createSuccessResponse(res, 'Attendance analytics retrieved successfully', trends);
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

      // Calculate month start and end dates
      const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
      const monthEnd = new Date(parseInt(year), parseInt(month), 0);
      
      console.log('🔍 Month range:', monthStart.toISOString(), 'to', monthEnd.toISOString());
      
      // Get attendance records for the month
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          classId: BigInt(classId),
          date: {
            gte: monthStart,
            lte: monthEnd
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
        }
      });
      
      console.log('🔍 Found attendance records:', attendanceRecords.length);

      // Create monthly matrix data
      const monthlyMatrix = {};
      
      classStudents.forEach(student => {
        monthlyMatrix[student.id] = {
          studentId: Number(student.id).toString(),
          studentName: `${student.user.firstName} ${student.user.lastName}`,
          rollNo: student.rollNo || '',
          dailyAttendance: {}
        };
        
        // Initialize all days of the month
        for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          monthlyMatrix[student.id].dailyAttendance[dateStr] = {
            status: null,
            inTime: null,
            outTime: null
          };
        }
      });

      // Fill in actual attendance data
      attendanceRecords.forEach((record) => {
        const studentId = record.studentId.toString();
        const dateStr = record.date.toISOString().split('T')[0];
        
        if (monthlyMatrix[studentId] && monthlyMatrix[studentId].dailyAttendance[dateStr]) {
          monthlyMatrix[studentId].dailyAttendance[dateStr] = {
            status: record.status,
            inTime: record.inTime ? record.inTime.toISOString() : null,
            outTime: record.outTime ? record.outTime.toISOString() : null
          };
        }
      });

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

      // Prepare data for export
      const exportData = attendances.map(attendance => ({
        date: attendance.date.toISOString().split('T')[0],
        studentName: `${attendance.student.user.firstName} ${attendance.student.user.lastName}`,
        rollNo: attendance.student.rollNo,
        className: attendance.class.name,
        status: attendance.status,
        inTime: attendance.inTime ? attendance.inTime.toISOString().split('T')[1].substring(0, 5) : '--',
        outTime: attendance.outTime ? attendance.outTime.toISOString().split('T')[1].substring(0, 5) : '--',
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
          // For now, return formatted text as PDF (you can implement proper PDF generation later)
          const pdfContent = [
            'ATTENDANCE REPORT',
            '================',
            '',
            `Generated on: ${new Date().toLocaleDateString()}`,
            `Class: ${classId ? 'Specific Class' : 'All Classes'}`,
            `Date Range: ${startDate || 'All'} to ${endDate || 'All'}`,
            `Total Records: ${exportData.length}`,
            '',
            ...exportData.map(row => 
              `${row.date} | ${row.studentName} (${row.rollNo}) | ${row.className} | ${row.status} | ${row.inTime} - ${row.outTime}`
            )
          ].join('\n');
          
          exportContent = pdfContent;
          contentType = 'application/pdf';
          filename = `attendance_${startDate || 'all'}_${endDate || 'data'}.pdf`;
          break;
      }

      // Set response headers for file download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(exportContent, 'utf8'));

      console.log('✅ Export completed successfully:', { format, filename, records: exportData.length });
      
      // For Excel format, we need to create a proper Excel file
      if (format === 'excel') {
        try {
          // Import ExcelJS library dynamically to avoid issues
          const ExcelJS = require('exceljs');
          
          // Create workbook and worksheet
          const workbook = new ExcelJS.Workbook();
          const worksheet = workbook.addWorksheet('Attendance Data');
          
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
          
          // Add data rows
          exportData.forEach(row => {
            worksheet.addRow(row);
          });
          
          // Style the header row
          worksheet.getRow(1).font = { bold: true };
          worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
          };
          
          // Write to buffer
          const buffer = await workbook.xlsx.writeBuffer();
          
          // Set proper headers for Excel
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Length', buffer.length);
          
          // Send the buffer
          res.send(buffer);
        } catch (excelError) {
          console.error('❌ Excel generation failed, falling back to CSV:', excelError);
          // Fallback to CSV if Excel fails
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="attendance_${startDate || 'all'}_${endDate || 'data'}.csv"`);
          res.send(exportContent);
        }
      } else {
        // Send the file content for other formats
        res.send(exportContent);
      }

    } catch (error) {
      console.error('Error in exportAttendanceData:', error);
      return createErrorResponse(res, 'Failed to export attendance data', 500);
    }
  };


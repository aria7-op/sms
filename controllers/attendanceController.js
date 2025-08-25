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

    // Convert BigInt values to regular numbers for JSON serialization
    console.log('🔄 Serializing attendance data...');
    const serializedAttendance = {
      ...attendance,
      id: Number(attendance.id),
      studentId: attendance.studentId ? Number(attendance.studentId) : null,
      classId: attendance.classId ? Number(attendance.classId) : null,
      subjectId: attendance.subjectId ? Number(attendance.subjectId) : null,
      schoolId: attendance.schoolId ? Number(attendance.schoolId) : null,
      createdBy: attendance.createdBy ? Number(attendance.createdBy) : null,
      updatedBy: attendance.updatedBy ? Number(attendance.updatedBy) : null
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
      
      // Get class information for SMS (student info already available)
      const classInfo = await prisma.class.findUnique({
        where: { id: BigInt(classId) },
        select: { name: true }
      });

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
            className: classInfo?.name || 'Unknown Class',
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

    return createSuccessResponse(res, 'Out-time marked successfully', updatedAttendance);
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

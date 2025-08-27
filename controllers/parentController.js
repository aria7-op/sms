  import { PrismaClient } from '../generated/prisma/client.js';
  import { formatResponse, handleError } from '../utils/responseUtils.js';

  const prisma = new PrismaClient();

  // BigInt conversion utility
  function convertBigInts(obj) {
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    if (Array.isArray(obj)) {
      return obj.map(convertBigInts);
    }
    if (typeof obj === 'object') {
      const newObj = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          newObj[key] = convertBigInts(obj[key]);
        }
      }
      return newObj;
    }
    return obj;
  }

  class ParentController {
    // ======================
    // CRUD OPERATIONS
    // ======================

    async createParent(req, res) {
      try {
        const { schoolId } = req.user;
        const userId = req.user.id;
        const parentData = req.body;

        // Validate required fields
        if (!parentData.userId) {
          return res.status(400).json({
            success: false,
            message: 'User ID is required'
          });
        }

        // Check if user exists and is not already a parent
        const existingUser = await prisma.user.findUnique({
          where: { id: BigInt(parentData.userId) }
        });

        if (!existingUser) {
          return res.status(404).json({
            success: false,
            message: 'User not found'
          });
        }

        const existingParent = await prisma.parent.findUnique({
          where: { userId: BigInt(parentData.userId) }
        });

        if (existingParent) {
          return res.status(400).json({
            success: false,
            message: 'User is already a parent'
          });
        }

        // Create parent record
        const parent = await prisma.parent.create({
          data: {
            userId: BigInt(parentData.userId),
            occupation: parentData.occupation || null,
            annualIncome: parentData.annualIncome ? parseFloat(parentData.annualIncome) : null,
            education: parentData.education || null,
            schoolId: BigInt(schoolId),
            createdBy: BigInt(userId)
          },
          include: {
            user: {
              select: {
                id: true,
                uuid: true,
                username: true,
                email: true,
                phone: true,
                firstName: true,
                middleName: true,
                lastName: true,
                displayName: true,
                gender: true,
                birthDate: true,
                avatar: true,
                status: true
              }
            }
          }
        });

        const convertedParent = convertBigInts(parent);

        return res.status(201).json({
          success: true,
          message: 'Parent created successfully',
          data: convertedParent
        });

      } catch (error) {
        console.error('Create parent error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to create parent',
          error: error.message
        });
      }
    }

    async getParents(req, res) {
      try {
        const { schoolId } = req.user;
        const { page = 1, limit = 10, search, status } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // Build where clause
        const where = {
          schoolId: BigInt(schoolId),
          deletedAt: null
        };

        // Add search filter
        if (search) {
          where.OR = [
            {
              user: {
                firstName: { contains: search, mode: 'insensitive' }
              }
            },
            {
              user: {
                lastName: { contains: search, mode: 'insensitive' }
              }
            },
            {
              user: {
                email: { contains: search, mode: 'insensitive' }
              }
            },
            {
              user: {
                phone: { contains: search, mode: 'insensitive' }
              }
            }
          ];
        }

        // Add status filter
        if (status) {
          where.user = {
            ...where.user,
            status: status
          };
        }

        // Get parents with pagination
        const [parents, total] = await Promise.all([
          prisma.parent.findMany({
            where,
            include: {
              user: {
                select: {
                  id: true,
                  uuid: true,
                  username: true,
                  email: true,
                  phone: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  displayName: true,
                  gender: true,
                  birthDate: true,
                  avatar: true,
                  status: true
                }
              },
              students: {
                select: {
                  id: true,
                  uuid: true,
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                      email: true
                    }
                  }
                }
              }
            },
            skip,
            take,
            orderBy: { createdAt: 'desc' }
          }),
          prisma.parent.count({ where })
        ]);

        const convertedParents = convertBigInts(parents);

        return res.json({
          success: true,
          message: 'Parents retrieved successfully',
          data: convertedParents,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        });

      } catch (error) {
        console.error('Get parents error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve parents',
          error: error.message
        });
      }
    }

    async getParentById(req, res) {
      try {
        const { schoolId } = req.user;
        const { id } = req.params; // This is actually the user ID

        // Find parent by userId (which is the user ID)
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(id),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            user: {
              select: {
                id: true,
                uuid: true,
                username: true,
                email: true,
                phone: true,
                firstName: true,
                middleName: true,
                lastName: true,
                displayName: true,
                gender: true,
                birthDate: true,
                avatar: true,
                status: true
              }
            },
            students: {
              select: {
                id: true,
                uuid: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        });

        if (!parent) {
          return res.status(404).json({
            success: false,
            message: 'Parent not found'
          });
        }

        const convertedParent = convertBigInts(parent);

        return res.json({
          success: true,
          message: 'Parent retrieved successfully',
          data: convertedParent
        });

      } catch (error) {
        console.error('Get parent by ID error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve parent',
          error: error.message
        });
      }
    }

    async updateParent(req, res) {
      try {
        const { schoolId } = req.user;
        const userId = req.user.id;
        const { id } = req.params; // This is actually the user ID
        const updateData = req.body;

        // Check if parent exists by userId
        const existingParent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(id),
            schoolId: BigInt(schoolId),
            deletedAt: null
          }
        });

        if (!existingParent) {
          return res.status(404).json({
            success: false,
            message: 'Parent not found'
          });
        }

        // Prepare update data
        const dataToUpdate = {};
        if (updateData.occupation !== undefined) dataToUpdate.occupation = updateData.occupation;
        if (updateData.annualIncome !== undefined) dataToUpdate.annualIncome = parseFloat(updateData.annualIncome);
        if (updateData.education !== undefined) dataToUpdate.education = updateData.education;
        dataToUpdate.updatedBy = BigInt(userId);

        // Update parent by userId
        const parent = await prisma.parent.update({
          where: { userId: BigInt(id) },
          data: dataToUpdate,
          include: {
            user: {
              select: {
                id: true,
                uuid: true,
                username: true,
                email: true,
                phone: true,
                firstName: true,
                middleName: true,
                lastName: true,
                displayName: true,
                gender: true,
                birthDate: true,
                avatar: true,
                status: true
              }
            }
          }
        });

        const convertedParent = convertBigInts(parent);

        return res.json({
          success: true,
          message: 'Parent updated successfully',
          data: convertedParent
        });

      } catch (error) {
        console.error('Update parent error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to update parent',
          error: error.message
        });
      }
    }

    async deleteParent(req, res) {
      try {
        const { schoolId } = req.user;
        const userId = req.user.id;
        const { id } = req.params; // This is actually the user ID

        // Check if parent exists by userId
        const existingParent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(id),
            schoolId: BigInt(schoolId),
            deletedAt: null
          }
        });

        if (!existingParent) {
          return res.status(404).json({
            success: false,
            message: 'Parent not found'
          });
        }

        // Soft delete parent by userId
        await prisma.parent.update({
          where: { userId: BigInt(id) },
          data: {
            deletedAt: new Date(),
            updatedBy: BigInt(userId)
          }
        });

        return res.json({
          success: true,
          message: 'Parent deleted successfully'
        });

      } catch (error) {
        console.error('Delete parent error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to delete parent',
          error: error.message
        });
      }
    }

    // ======================
    // PARENT STUDENTS
    // ======================

    // Get parent's students by user ID (since user ID is the parent's user ID)
    async getParentStudents(req, res) {
      try {
        const { schoolId } = req.user;
        const { id } = req.params; // This is actually the user ID

        console.log('🔍 ParentController: getParentStudents called with:', {
          schoolId,
          parentUserId: id,
          user: req.user
        });

        // Find parent by userId (which is the user ID)
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(id),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { deletedAt: null },
              include: {
                user: {
                  select: {
                    id: true,
                    uuid: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                    avatar: true,
                    status: true
                  }
                },
                class: {
                  select: {
                    id: true,
                    name: true
                  }
                },
                section: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        });

        if (!parent) {
          console.log('❌ ParentController: Parent not found for user ID:', id);
          return res.status(404).json({
            success: false,
            message: 'Parent not found'
          });
        }

        console.log('✅ ParentController: Parent found:', {
          parentId: parent.id,
          userId: parent.userId,
          studentsCount: parent.students?.length || 0
        });

        const convertedParent = convertBigInts(parent);

        const responseData = {
          success: true,
          message: 'Parent students retrieved successfully',
          data: convertedParent.students
        };

        console.log('✅ ParentController: Sending students response:', JSON.stringify(responseData, null, 2));

        return res.json(responseData);

      } catch (error) {
        console.error('Get parent students error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve parent students',
          error: error.message
        });
      }
    }

    // ======================
    // SIMPLE STATISTICS
    // ======================

    async getParentStats(req, res) {
      try {
        const { schoolId } = req.user;

        const stats = await prisma.parent.aggregate({
          where: {
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          _count: {
            id: true
          }
        });

        const totalParents = Number(stats._count.id);

        return res.json({
          success: true,
          message: 'Parent statistics retrieved successfully',
          data: {
            totalParents,
            activeParents: totalParents
          }
        });

      } catch (error) {
        console.error('Get parent stats error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve parent statistics',
          error: error.message
        });
      }
    }

    // ======================
    // COMPREHENSIVE PARENT PORTAL ENDPOINTS
    // ======================

    // Get student attendance data
    async getStudentAttendance(req, res) {
      try {
        const { schoolId } = req.user;
        const { parentId, studentId } = req.params;
        const { startDate, endDate, period } = req.query;

        console.log('🔍 ParentController: getStudentAttendance called with:', {
          schoolId,
          parentId,
          studentId,
          startDate,
          endDate,
          period,
          user: req.user
        });

        // Verify parent has access to this student
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(parentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { id: BigInt(studentId), deletedAt: null }
            }
          }
        });

        if (!parent || parent.students.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Student not found or access denied'
          });
        }

        // Build date filter based on period
        const dateFilter = {};
        const now = new Date();
        
        if (period === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter.date = { gte: weekAgo, lte: now };
        } else if (period === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          dateFilter.date = { gte: monthAgo, lte: now };
        } else if (period === 'semester') {
          const semesterAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          dateFilter.date = { gte: semesterAgo, lte: now };
        } else if (startDate && endDate) {
          dateFilter.date = {
            gte: new Date(startDate),
            lte: new Date(endDate)
          };
        }

        // Get attendance records
        const attendance = await prisma.attendance.findMany({
          where: {
            studentId: BigInt(studentId),
            schoolId: BigInt(schoolId),
            deletedAt: null,
            ...dateFilter
          },
          include: {
            subject: {
              select: {
                name: true
              }
            },
            class: {
              select: {
                name: true
              }
            }
          },
          orderBy: { date: 'desc' },
          take: 100 // Limit to last 100 records
        });

        const convertedAttendance = convertBigInts(attendance);

        console.log('📊 ParentController: Raw attendance data:', convertedAttendance);
        console.log('📊 ParentController: Attendance count:', convertedAttendance.length);

        // Calculate attendance summary
        const totalDays = convertedAttendance.length;
        const presentDays = convertedAttendance.filter(a => a.status === 'PRESENT').length;
        const absentDays = convertedAttendance.filter(a => a.status === 'ABSENT').length;
        const lateDays = convertedAttendance.filter(a => a.status === 'LATE').length;
        const excusedDays = convertedAttendance.filter(a => a.status === 'EXCUSED').length;
        const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

        console.log('📊 ParentController: Calculated summary:', {
          totalDays,
          presentDays,
          absentDays,
          lateDays,
          excusedDays,
          attendancePercentage
        });

        // Calculate current streak
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        
        for (let i = 0; i < convertedAttendance.length; i++) {
          if (convertedAttendance[i].status === 'PRESENT') {
            tempStreak++;
            if (i === 0) currentStreak = tempStreak;
          } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 0;
          }
        }
        longestStreak = Math.max(longestStreak, tempStreak);

        // Generate monthly data for charts
        const monthlyData = [];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        for (let i = 11; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
          
          const monthAttendance = convertedAttendance.filter(a => {
            const recordDate = new Date(a.date);
            return recordDate >= monthDate && recordDate <= monthEnd;
          });
          
          const monthPresent = monthAttendance.filter(a => a.status === 'PRESENT').length;
          const monthAbsent = monthAttendance.filter(a => a.status === 'ABSENT').length;
          const monthLate = monthAttendance.filter(a => a.status === 'LATE').length;
          const monthExcused = monthAttendance.filter(a => a.status === 'EXCUSED').length;
          
          monthlyData.push({
            month: monthNames[monthDate.getMonth()],
            present: monthPresent,
            absent: monthAbsent,
            late: monthLate,
            excused: monthExcused
          });
        }

        // Transform attendance records to match frontend interface
        const records = convertedAttendance.map(record => ({
          id: record.id,
          date: record.date,
          status: record.status.toLowerCase(),
          subject: record.subject?.name,
          remarks: record.remarks
        }));

        // Create summary object
        const summary = {
          studentId,
          studentName: `${parent.students[0].user.firstName} ${parent.students[0].user.lastName}`,
          totalDays,
          presentDays,
          absentDays,
          lateDays,
          excusedDays,
          attendancePercentage,
          currentStreak,
          longestStreak
        };

        const responseData = {
          success: true,
          message: 'Student attendance retrieved successfully',
          data: {
            records,
            summary,
            monthlyData
          }
        };

        console.log('✅ ParentController: Sending response:', JSON.stringify(responseData, null, 2));

        return res.json(responseData);

      } catch (error) {
        console.error('Get student attendance error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve attendance data',
          error: error.message
        });
      }
    }

    // Get student grades
    async getStudentGrades(req, res) {
      try {
        const { schoolId } = req.user;
        const { parentId, studentId } = req.params;

        // Verify parent has access to this student
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(parentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { id: BigInt(studentId), deletedAt: null }
            }
          }
        });

        if (!parent || parent.students.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Student not found or access denied'
          });
        }

        // Get grades for the student
        const grades = await prisma.grade.findMany({
          where: {
            studentId: BigInt(studentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            subject: {
              select: {
                name: true
              }
            },
            exam: {
              select: {
                name: true,
                code: true,
                type: true,
                startDate: true
              }
            }
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 100
        });

        // Transform grades to include calculated fields
        const transformedGrades = grades.map(grade => ({
          id: grade.id,
          subject: grade.subject?.name || 'N/A',
          exam: grade.exam?.name || 'N/A',
          examCode: grade.exam?.code || 'N/A',
          examType: grade.exam?.type || 'N/A',
          examDate: grade.exam?.startDate || null,
          marks: grade.marks,
          maxMarks: grade.maxMarks || 100,
          percentage: grade.maxMarks ? (Number(grade.marks) / Number(grade.maxMarks)) * 100 : 0,
          grade: grade.grade || 'N/A',
          remarks: grade.remarks || null,
          isAbsent: grade.isAbsent,
          createdAt: grade.createdAt
        }));

        const convertedGrades = convertBigInts(transformedGrades);

        return res.json({
          success: true,
          message: 'Student grades retrieved successfully',
          data: convertedGrades
        });

      } catch (error) {
        console.error('Get student grades error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve student grades',
          error: error.message
        });
      }
    }

    // Get student assignments
    async getStudentAssignments(req, res) {
      try {
        const { schoolId } = req.user;
        const { parentId, studentId } = req.params;

        // Verify parent has access to this student
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(parentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { id: BigInt(studentId), deletedAt: null }
            }
          }
        });

        if (!parent || parent.students.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Student not found or access denied'
          });
        }

        const student = parent.students[0];

        // Get assignments for the student's class and subjects
        const assignments = await prisma.assignment.findMany({
          where: {
            schoolId: BigInt(schoolId),
            deletedAt: null,
            OR: [
              { classId: student.classId },
              { subjectId: { in: student.subjects?.map(s => BigInt(s.id)) || [] } }
            ]
          },
          include: {
            subject: {
              select: {
                name: true
              }
            },
            class: {
              select: {
                name: true
              }
            }
          },
          orderBy: {
            dueDate: "asc"
          },
          take: 100
        });

        // Get student's submissions for these assignments
        const submissions = await prisma.assignmentSubmission.findMany({
          where: {
            studentId: BigInt(studentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          select: {
            assignmentId: true,
            submittedAt: true,
            score: true,
            feedback: true
          }
        });

        // Combine assignments with submission status
        const assignmentsWithStatus = assignments.map(assignment => {
          const submission = submissions.find(s => s.assignmentId === assignment.id);
          return {
            id: assignment.id,
            title: assignment.title,
            description: assignment.description,
            dueDate: assignment.dueDate,
            maxScore: assignment.maxScore,
            subject: assignment.subject?.name || 'N/A',
            class: assignment.class?.name || 'N/A',
            status: submission ? 'SUBMITTED' : new Date(assignment.dueDate) < new Date() ? 'OVERDUE' : 'PENDING',
            submittedAt: submission?.submittedAt || null,
            score: submission?.score || null,
            feedback: submission?.feedback || null
          };
        });

        const convertedAssignments = convertBigInts(assignmentsWithStatus);

        return res.json({
          success: true,
          message: 'Student assignments retrieved successfully',
          data: convertedAssignments
        });

      } catch (error) {
        console.error('Get student assignments error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve student assignments',
          error: error.message
        });
      }
    }

    // Get student exams data
    async getStudentExams(req, res) {
      try {
        const { schoolId } = req.user;
        const { parentId, studentId } = req.params;
        const { subject, status, academicYear } = req.query;

        // Verify parent has access to this student
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(parentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { id: BigInt(studentId) }
            }
          }
        });

        if (!parent || parent.students.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to student data'
          });
        }

        // Build filter
        const filter = { studentId: BigInt(studentId) };
        if (subject) filter.subject = { name: { contains: subject, mode: 'insensitive' } };
        if (status) filter.status = status.toUpperCase();
        if (academicYear) filter.academicYear = { name: { contains: academicYear, mode: 'insensitive' } };

        // Get exams
        const exams = await prisma.exam.findMany({
          where: filter,
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
            academicYear: { select: { name: true } }
          },
          orderBy: { date: 'asc' },
          take: 100
        });

        const convertedExams = convertBigInts(exams);

        return res.json({
          success: true,
          message: 'Student exams retrieved successfully',
          data: convertedExams
        });

      } catch (error) {
        console.error('Get student exams error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve exams data',
          error: error.message
        });
      }
    }

    // Get student fees data
    async getStudentFees(req, res) {
      try {
        const { schoolId } = req.user;
        const { parentId, studentId } = req.params;
        const { status, academicYear, feeType } = req.query;

        // Verify parent has access to this student
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(parentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { id: BigInt(studentId) }
            }
          }
        });

        if (!parent || parent.students.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to student data'
          });
        }

        // Build filter
        const filter = { studentId: BigInt(studentId) };
        if (status) filter.status = status.toUpperCase();
        if (academicYear) filter.academicYear = { name: { contains: academicYear, mode: 'insensitive' } };
        if (feeType) filter.feeType = { name: { contains: feeType, mode: 'insensitive' } };

        // Get fees
        const fees = await prisma.fee.findMany({
          where: filter,
          include: {
            feeType: { select: { name: true } },
            academicYear: { select: { name: true } }
          },
          orderBy: { dueDate: 'asc' },
          take: 100
        });

        const convertedFees = convertBigInts(fees);

        return res.json({
          success: true,
          message: 'Student fees retrieved successfully',
          data: convertedFees
        });

      } catch (error) {
        console.error('Get student fees error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve fees data',
          error: error.message
        });
      }
    }

    // Get student timetable
    async getStudentTimetable(req, res) {
      try {
        const { schoolId } = req.user;
        const { parentId, studentId } = req.params;
        const { day, week } = req.query;

        // Verify parent has access to this student
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(parentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { id: BigInt(studentId) }
            }
          }
        });

        if (!parent || parent.students.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to student data'
          });
        }

        // Get student's class
        const student = await prisma.student.findUnique({
          where: { id: BigInt(studentId) },
          include: { class: true }
        });

        if (!student?.class) {
          return res.status(404).json({
            success: false,
            message: 'Student class not found'
          });
        }

        // Build filter
        const filter = { classId: student.class.id };
        if (day) filter.day = day;

        // Get timetable
        const timetable = await prisma.timetable.findMany({
          where: filter,
          include: {
            subject: { select: { name: true } },
            teacher: { 
              select: { 
                user: { select: { firstName: true, lastName: true, email: true } }
              }
            }
          },
          orderBy: [{ day: 'asc' }, { startTime: 'asc' }]
        });

        const convertedTimetable = convertBigInts(timetable);

        return res.json({
          success: true,
          message: 'Student timetable retrieved successfully',
          data: convertedTimetable
        });

      } catch (error) {
        console.error('Get student timetable error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve timetable data',
          error: error.message
        });
      }
    }

    // Get student notifications
    async getStudentNotifications(req, res) {
      try {
        const { schoolId } = req.user;
        const { parentId, studentId } = req.params;
        const { type, read, limit = 50 } = req.query;

        // Verify parent has access to this student
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(parentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { id: BigInt(studentId) }
            }
          }
        });

        if (!parent || parent.students.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to student data'
          });
        }

        // Build filter
        const filter = { 
          studentId: BigInt(studentId),
          schoolId: BigInt(schoolId)
        };
        if (type) filter.type = type.toUpperCase();
        if (read !== undefined) filter.read = read === 'true';

        // Get notifications
        const notifications = await prisma.notification.findMany({
          where: filter,
          orderBy: { createdAt: 'desc' },
          take: parseInt(limit)
        });

        const convertedNotifications = convertBigInts(notifications);

        return res.json({
          success: true,
          message: 'Student notifications retrieved successfully',
          data: convertedNotifications
        });

      } catch (error) {
        console.error('Get student notifications error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve notifications data',
          error: error.message
        });
      }
    }

    // Get student academic summary
    async getStudentAcademicSummary(req, res) {
      try {
        const { schoolId } = req.user;
        const { parentId, studentId } = req.params;
        const { academicYear, term } = req.query;

        // Verify parent has access to this student
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(parentId),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            students: {
              where: { id: BigInt(studentId) }
            }
          }
        });

        if (!parent || parent.students.length === 0) {
          return res.status(403).json({
            success: false,
            message: 'Access denied to student data'
          });
        }

        // Build filter
        const filter = { studentId: BigInt(studentId) };
        if (academicYear) filter.academicYear = { name: { contains: academicYear, mode: 'insensitive' } };
        if (term) filter.term = { name: { contains: term, mode: 'insensitive' } };

        // Get academic summary data
        const [grades, attendance, assignments] = await Promise.all([
          prisma.grade.findMany({
            where: filter,
            include: { subject: { select: { name: true } } }
          }),
          prisma.attendance.findMany({
            where: { studentId: BigInt(studentId) }
          }),
          prisma.assignment.findMany({
            where: filter,
            include: { subject: { select: { name: true } } }
          })
        ]);

        // Calculate summary statistics
        const totalGrades = grades.length;
        const averageGrade = totalGrades > 0 
          ? grades.reduce((sum, grade) => sum + parseFloat(grade.score), 0) / totalGrades 
          : 0;

        const totalAttendance = attendance.length;
        const presentDays = attendance.filter(a => a.status === 'PRESENT').length;
        const attendancePercentage = totalAttendance > 0 ? (presentDays / totalAttendance) * 100 : 0;

        const totalAssignments = assignments.length;
        const completedAssignments = assignments.filter(a => a.status === 'COMPLETED').length;
        const assignmentCompletionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0;

        const summary = {
          studentId,
          academicYear: academicYear || 'Current',
          term: term || 'All',
          grades: {
            total: totalGrades,
            average: Math.round(averageGrade * 100) / 100,
            subjects: grades.map(g => g.subject.name)
          },
          attendance: {
            total: totalAttendance,
            present: presentDays,
            percentage: Math.round(attendancePercentage * 100) / 100
          },
          assignments: {
            total: totalAssignments,
            completed: completedAssignments,
            completionRate: Math.round(assignmentCompletionRate * 100) / 100
          }
        };

        return res.json({
          success: true,
          message: 'Student academic summary retrieved successfully',
          data: summary
        });

      } catch (error) {
        console.error('Get student academic summary error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to retrieve academic summary',
          error: error.message
        });
      }
    }

    // Debug endpoint to check parent and students
    async debugParent(req, res) {
      try {
        const { schoolId } = req.user;
        const { id } = req.params; // This is the user ID

        console.log('🔍 Debug: Checking parent with user ID:', id, 'school ID:', schoolId);

        // Find parent by userId
        const parent = await prisma.parent.findFirst({
          where: {
            userId: BigInt(id),
            schoolId: BigInt(schoolId),
            deletedAt: null
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true
              }
            },
            students: {
              where: { deletedAt: null },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        });

        if (!parent) {
          console.log('❌ Debug: Parent not found');
          return res.json({
            success: false,
            message: 'Parent not found',
            debug: {
              searchedUserId: id,
              searchedSchoolId: schoolId,
              parentExists: false
            }
          });
        }

        console.log('✅ Debug: Parent found:', {
          parentId: parent.id,
          userId: parent.userId,
          studentsCount: parent.students.length
        });

        const convertedParent = convertBigInts(parent);

        return res.json({
          success: true,
          message: 'Debug info retrieved',
          data: {
            parent: {
              id: convertedParent.id,
              userId: convertedParent.userId,
              user: convertedParent.user
            },
            students: convertedParent.students,
            studentsCount: convertedParent.students.length,
            debug: {
              searchedUserId: id,
              searchedSchoolId: schoolId,
              parentExists: true,
              parentId: convertedParent.id
            }
          }
        });

      } catch (error) {
        console.error('Debug parent error:', error);
        return res.status(500).json({
          success: false,
          message: 'Debug failed',
          error: error.message
        });
      }
    }
  }

  export default new ParentController(); 

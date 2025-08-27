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
        return res.status(404).json({
          success: false,
          message: 'Parent not found'
        });
      }

      const convertedParent = convertBigInts(parent);

      return res.json({
        success: true,
        message: 'Parent students retrieved successfully',
        data: convertedParent.students
      });

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
      const { startDate, endDate } = req.query;

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

      // Build date filter
      const dateFilter = {};
      if (startDate && endDate) {
        dateFilter.date = {
          gte: new Date(startDate),
          lte: new Date(endDate)
        };
      }

      // Get attendance records
      const attendance = await prisma.attendance.findMany({
        where: {
          studentId: BigInt(studentId),
          ...dateFilter
        },
        orderBy: { date: 'desc' },
        take: 100 // Limit to last 100 records
      });

      const convertedAttendance = convertBigInts(attendance);

      return res.json({
        success: true,
        message: 'Student attendance retrieved successfully',
        data: convertedAttendance
      });

    } catch (error) {
      console.error('Get student attendance error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve attendance data',
        error: error.message
      });
    }
  }

  // Get student grades data
  async getStudentGrades(req, res) {
    try {
      const { schoolId } = req.user;
      const { parentId, studentId } = req.params;
      const { subject, term, academicYear } = req.query;

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
      if (term) filter.term = { name: { contains: term, mode: 'insensitive' } };
      if (academicYear) filter.academicYear = { name: { contains: academicYear, mode: 'insensitive' } };

      // Get grades
      const grades = await prisma.grade.findMany({
        where: filter,
        include: {
          subject: { select: { name: true } },
          term: { select: { name: true } },
          academicYear: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });

      const convertedGrades = convertBigInts(grades);

      return res.json({
        success: true,
        message: 'Student grades retrieved successfully',
        data: convertedGrades
      });

    } catch (error) {
      console.error('Get student grades error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve grades data',
        error: error.message
      });
    }
  }

  // Get student assignments data
  async getStudentAssignments(req, res) {
    try {
      const { schoolId } = req.user;
      const { parentId, studentId } = req.params;
      const { status, subject, dueDate } = req.query;

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
      if (subject) filter.subject = { name: { contains: subject, mode: 'insensitive' } };
      if (dueDate) filter.dueDate = { gte: new Date(dueDate) };

      // Get assignments
      const assignments = await prisma.assignment.findMany({
        where: filter,
        include: {
          subject: { select: { name: true } },
          class: { select: { name: true } }
        },
        orderBy: { dueDate: 'asc' },
        take: 100
      });

      const convertedAssignments = convertBigInts(assignments);

      return res.json({
        success: true,
        message: 'Student assignments retrieved successfully',
        data: convertedAssignments
      });

    } catch (error) {
      console.error('Get student assignments error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignments data',
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
}

export default new ParentController(); 

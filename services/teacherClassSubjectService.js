import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

class TeacherClassSubjectService {
  /**
   * Assign a teacher to teach a subject in a specific class
   */
  async assignTeacherToClassSubject(data) {
    const { teacherId, classId, subjectId, schoolId, assignedBy } = data;

    // Check if assignment already exists
    const existingAssignment = await prisma.teacherClassSubject.findFirst({
      where: {
        teacherId: BigInt(teacherId),
        classId: BigInt(classId),
        subjectId: BigInt(subjectId),
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (existingAssignment) {
      throw new Error('Teacher is already assigned to this subject in this class');
    }

    // Verify that teacher, class, and subject exist and belong to the school
    const [teacher, class_, subject] = await Promise.all([
      prisma.teacher.findFirst({
        where: {
          id: BigInt(teacherId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      }),
      prisma.class.findFirst({
        where: {
          id: BigInt(classId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      }),
      prisma.subject.findFirst({
        where: {
          id: BigInt(subjectId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      })
    ]);

    if (!teacher) {
      throw new Error('Teacher not found or does not belong to this school');
    }
    if (!class_) {
      throw new Error('Class not found or does not belong to this school');
    }
    if (!subject) {
      throw new Error('Subject not found or does not belong to this school');
    }

    const assignment = await prisma.teacherClassSubject.create({
      data: {
        teacherId: BigInt(teacherId),
        classId: BigInt(classId),
        subjectId: BigInt(subjectId),
        schoolId: BigInt(schoolId),
        assignedBy: BigInt(assignedBy),
        isActive: true
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
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

    return assignment;
  }

  /**
   * Get all teacher-class-subject assignments for a school
   */
  async getAssignmentsBySchool(schoolId, options = {}) {
    const { 
      teacherId, 
      classId, 
      subjectId, 
      isActive = true,
      page = 1,
      limit = 10
    } = options;

    const where = {
      schoolId: BigInt(schoolId),
      deletedAt: null
    };

    if (teacherId) where.teacherId = BigInt(teacherId);
    if (classId) where.classId = BigInt(classId);
    if (subjectId) where.subjectId = BigInt(subjectId);
    if (isActive !== undefined) where.isActive = isActive;

    const skip = (page - 1) * limit;

    const [assignments, total] = await Promise.all([
      prisma.teacherClassSubject.findMany({
        where,
        skip,
        take: limit,
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  id: true,
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
        orderBy: {
          assignedAt: 'desc'
        }
      }),
      prisma.teacherClassSubject.count({ where })
    ]);

    return {
      assignments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get assignments by teacher
   */
  async getAssignmentsByTeacher(teacherId, schoolId) {
    return await prisma.teacherClassSubject.findMany({
      where: {
        teacherId: BigInt(teacherId),
        schoolId: BigInt(schoolId),
        deletedAt: null,
        isActive: true
      },
      include: {
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
      orderBy: {
        assignedAt: 'desc'
      }
    });
  }

  /**
   * Get assignments by class
   */
  async getAssignmentsByClass(classId, schoolId) {
    return await prisma.teacherClassSubject.findMany({
      where: {
        classId: BigInt(classId),
        schoolId: BigInt(schoolId),
        deletedAt: null,
        isActive: true
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
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
      orderBy: {
        assignedAt: 'desc'
      }
    });
  }

  /**
   * Get assignments by subject
   */
  async getAssignmentsBySubject(subjectId, schoolId) {
    return await prisma.teacherClassSubject.findMany({
      where: {
        subjectId: BigInt(subjectId),
        schoolId: BigInt(schoolId),
        deletedAt: null,
        isActive: true
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
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
        }
      },
      orderBy: {
        assignedAt: 'desc'
      }
    });
  }

  /**
   * Update assignment status
   */
  async updateAssignmentStatus(id, schoolId, isActive, updatedBy) {
    const assignment = await prisma.teacherClassSubject.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    return await prisma.teacherClassSubject.update({
      where: {
        id: BigInt(id)
      },
      data: {
        isActive,
        updatedBy: BigInt(updatedBy),
        updatedAt: new Date()
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
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
  }

  /**
   * Remove assignment (soft delete)
   */
  async removeAssignment(id, schoolId, updatedBy) {
    const assignment = await prisma.teacherClassSubject.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    return await prisma.teacherClassSubject.update({
      where: {
        id: BigInt(id)
      },
      data: {
        deletedAt: new Date(),
        updatedBy: BigInt(updatedBy),
        updatedAt: new Date()
      }
    });
  }

  /**
   * Get assignment by ID
   */
  async getAssignmentById(id, schoolId) {
    return await prisma.teacherClassSubject.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
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
  }

  /**
   * Bulk assign teachers to classes and subjects
   */
  async bulkAssign(data) {
    const { assignments, schoolId, assignedBy } = data;

    const results = [];
    const errors = [];

    for (const assignment of assignments) {
      try {
        const result = await this.assignTeacherToClassSubject({
          ...assignment,
          schoolId,
          assignedBy
        });
        results.push(result);
      } catch (error) {
        errors.push({
          assignment,
          error: error.message
        });
      }
    }

    return {
      success: results,
      errors
    };
  }
}

export default new TeacherClassSubjectService(); 
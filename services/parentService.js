import { PrismaClient } from '../generated/prisma/client.js';

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

class ParentService {
  // ======================
  // CRUD OPERATIONS
  // ======================

  async createParent(parentData, userId, schoolId) {
    try {
      // Validate required fields
      if (!parentData.userId) {
        throw new Error('User ID is required');
      }

      // Check if user exists and is not already a parent
      const existingUser = await prisma.user.findUnique({
        where: { id: BigInt(parentData.userId) }
      });

      if (!existingUser) {
        throw new Error('User not found');
      }

      const existingParent = await prisma.parent.findUnique({
        where: { userId: BigInt(parentData.userId) }
      });

      if (existingParent) {
        throw new Error('User is already a parent');
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

      return convertBigInts(parent);
    } catch (error) {
      console.error('Create parent service error:', error);
      throw error;
    }
  }

  async getParents(filters = {}, schoolId, include = []) {
    try {
      const { page = 1, limit = 10, search, status } = filters;

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

      // Build include object
      const includeObj = {
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
      };

      // Add students if requested
      if (include.includes('students')) {
        includeObj.students = {
          where: { deletedAt: null },
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
        };
      }

      // Get parents with pagination
      const [parents, total] = await Promise.all([
        prisma.parent.findMany({
          where,
          include: includeObj,
          skip,
          take,
          orderBy: { createdAt: 'desc' }
        }),
        prisma.parent.count({ where })
      ]);

      const convertedParents = convertBigInts(parents);

      return {
        parents: convertedParents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };
    } catch (error) {
      console.error('Get parents service error:', error);
      throw error;
    }
  }

  async getParentById(parentId, schoolId, include = []) {
    try {
      // Build include object
      const includeObj = {
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
      };

      // Add students if requested
      if (include.includes('students')) {
        includeObj.students = {
          where: { deletedAt: null },
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
        };
      }

      const parent = await prisma.parent.findFirst({
        where: {
          id: BigInt(parentId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        include: includeObj
      });

      if (!parent) {
        throw new Error('Parent not found');
      }

      return convertBigInts(parent);
    } catch (error) {
      console.error('Get parent by ID service error:', error);
      throw error;
    }
  }

  async updateParent(parentId, updateData, userId, schoolId) {
    try {
      // Check if parent exists
      const existingParent = await prisma.parent.findFirst({
        where: {
          id: BigInt(parentId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!existingParent) {
        throw new Error('Parent not found');
      }

      // Prepare update data
      const dataToUpdate = {};
      if (updateData.occupation !== undefined) dataToUpdate.occupation = updateData.occupation;
      if (updateData.annualIncome !== undefined) dataToUpdate.annualIncome = parseFloat(updateData.annualIncome);
      if (updateData.education !== undefined) dataToUpdate.education = updateData.education;
      dataToUpdate.updatedBy = BigInt(userId);

      // Update parent
      const parent = await prisma.parent.update({
        where: { id: BigInt(parentId) },
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

      return convertBigInts(parent);
    } catch (error) {
      console.error('Update parent service error:', error);
      throw error;
    }
  }

  async deleteParent(parentId, userId, schoolId) {
    try {
      // Check if parent exists
      const existingParent = await prisma.parent.findFirst({
        where: {
          id: BigInt(parentId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!existingParent) {
        throw new Error('Parent not found');
      }

      // Soft delete parent
      await prisma.parent.update({
        where: { id: BigInt(parentId) },
        data: {
          deletedAt: new Date(),
          updatedBy: BigInt(userId)
        }
      });

      return { message: 'Parent deleted successfully' };
    } catch (error) {
      console.error('Delete parent service error:', error);
      throw error;
    }
  }

  // ======================
  // PARENT STUDENTS
  // ======================

  async getParentStudents(parentId, schoolId) {
    try {
      const parent = await prisma.parent.findFirst({
        where: {
          id: BigInt(parentId),
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
        throw new Error('Parent not found');
      }

      const convertedParent = convertBigInts(parent);

      return {
        students: convertedParent.students,
        total: convertedParent.students.length
      };
    } catch (error) {
      console.error('Get parent students service error:', error);
      throw error;
    }
  }

  // ======================
  // SIMPLE STATISTICS
  // ======================

  async getParentStats(schoolId) {
    try {
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

      return {
        totalParents,
        activeParents: totalParents
      };
    } catch (error) {
      console.error('Get parent stats service error:', error);
      throw error;
    }
  }
}

export default new ParentService(); 

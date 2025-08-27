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
}

export default new ParentController(); 

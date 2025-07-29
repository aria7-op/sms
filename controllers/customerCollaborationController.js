import { PrismaClient } from '../generated/prisma/client.js';
import { logger } from '../config/logger.js';
import { formatResponse, handleError } from '../utils/responseUtils.js';

const prisma = new PrismaClient();

// ======================
// COLLABORATION TYPES FOR SCHOOLS
// ======================
const COLLABORATION_TYPES = {
  // Academic Collaboration
  STUDENT_SUPPORT: 'student_support',
  PARENT_COMMUNICATION: 'parent_communication',
  TEACHER_COLLABORATION: 'teacher_collaboration',
  ACADEMIC_PLANNING: 'academic_planning',
  
  // Administrative Collaboration
  ENROLLMENT_PROCESS: 'enrollment_process',
  FINANCIAL_DISCUSSION: 'financial_discussion',
  POLICY_DISCUSSION: 'policy_discussion',
  STAFF_COORDINATION: 'staff_coordination',
  
  // Support Collaboration
  TECHNICAL_SUPPORT: 'technical_support',
  COUNSELING_SESSION: 'counseling_session',
  HEALTH_SUPPORT: 'health_support',
  BEHAVIORAL_SUPPORT: 'behavioral_support',
  
  // Project Collaboration
  EVENT_PLANNING: 'event_planning',
  CURRICULUM_DEVELOPMENT: 'curriculum_development',
  FACILITY_MAINTENANCE: 'facility_maintenance',
  TECHNOLOGY_UPGRADE: 'technology_upgrade',
  
  // Communication Channels
  GENERAL_DISCUSSION: 'general_discussion',
  ANNOUNCEMENTS: 'announcements',
  FEEDBACK_COLLECTION: 'feedback_collection',
  SURVEY_DISCUSSION: 'survey_discussion'
};

// ======================
// COLLABORATION STATUS
// ======================
const COLLABORATION_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
  ON_HOLD: 'on_hold'
};

// ======================
// PRIORITY LEVELS
// ======================
const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

class CustomerCollaborationController {
  // ======================
  // GET CUSTOMER COLLABORATIONS
  // ======================
  async getCustomerCollaborations(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const { status, type, priority, assignedTo } = req.query;

      const whereClause = {
        customerId: BigInt(id),
        schoolId: BigInt(schoolId)
      };

      if (status) whereClause.status = status;
      if (type) whereClause.type = type;
      if (priority) whereClause.priority = priority;
      if (assignedTo) whereClause.assignedTo = BigInt(assignedTo);

      const collaborations = await prisma.customerCollaboration.findMany({
        where: whereClause,
        include: {
          customer: {
            include: {
              user: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          participants: {
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
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          attachments: {
            take: 3
          },
          tasks: {
            where: { status: { not: 'completed' } },
            take: 5
          }
        },
        orderBy: { updatedAt: 'desc' }
      });

      return formatResponse(res, {
        success: true,
        message: 'Customer collaborations retrieved successfully',
        data: collaborations,
        meta: {
          total: collaborations.length,
          customerId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get customer collaborations error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // CREATE COLLABORATION
  // ======================
  async createCollaboration(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const collaborationData = req.body;

      // Validate required fields
      if (!collaborationData.title || !collaborationData.type) {
        return formatResponse(res, {
          success: false,
          message: 'Title and type are required',
          data: null
        }, 400);
      }

      // Create collaboration with participants
      const collaboration = await prisma.$transaction(async (tx) => {
        // Create main collaboration
        const collaboration = await tx.customerCollaboration.create({
          data: {
            customerId: BigInt(id),
            schoolId: BigInt(schoolId),
            title: collaborationData.title,
            description: collaborationData.description,
            type: collaborationData.type,
            status: collaborationData.status || COLLABORATION_STATUS.ACTIVE,
            priority: collaborationData.priority || PRIORITY_LEVELS.MEDIUM,
            dueDate: collaborationData.dueDate ? new Date(collaborationData.dueDate) : null,
            assignedTo: collaborationData.assignedTo ? BigInt(collaborationData.assignedTo) : null,
            settings: collaborationData.settings || {},
            metadata: collaborationData.metadata || {},
            createdBy: BigInt(userId)
          }
        });

        // Add participants
        if (collaborationData.participants && collaborationData.participants.length > 0) {
          const participants = collaborationData.participants.map(participantId => ({
            collaborationId: collaboration.id,
            userId: BigInt(participantId),
            role: 'participant',
            joinedAt: new Date()
          }));

          await tx.collaborationParticipant.createMany({
            data: participants
          });
        }

        // Add creator as participant
        await tx.collaborationParticipant.create({
          data: {
            collaborationId: collaboration.id,
            userId: BigInt(userId),
            role: 'owner',
            joinedAt: new Date()
          }
        });

        return collaboration;
      });

      // Get complete collaboration data
      const completeCollaboration = await prisma.customerCollaboration.findUnique({
        where: { id: collaboration.id },
        include: {
          customer: {
            include: {
              user: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          participants: {
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
          }
        }
      });

      return formatResponse(res, {
        success: true,
        message: 'Collaboration created successfully',
        data: completeCollaboration,
        meta: {
          collaborationId: collaboration.id,
          customerId: parseInt(id)
        }
      }, 201);

    } catch (error) {
      logger.error('Create collaboration error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET COLLABORATION BY ID
  // ======================
  async getCollaborationById(req, res) {
    try {
      const { id, collaborationId } = req.params;
      const { schoolId } = req.user;

      const collaboration = await prisma.customerCollaboration.findFirst({
        where: {
          id: BigInt(collaborationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        },
        include: {
          customer: {
            include: {
              user: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          participants: {
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
          messages: {
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              },
              attachments: true
            }
          },
          attachments: true,
          tasks: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          activities: {
            orderBy: { createdAt: 'desc' },
            take: 20,
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

      if (!collaboration) {
        return formatResponse(res, {
          success: false,
          message: 'Collaboration not found',
          data: null
        }, 404);
      }

      return formatResponse(res, {
        success: true,
        message: 'Collaboration retrieved successfully',
        data: collaboration
      });

    } catch (error) {
      logger.error('Get collaboration by ID error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // UPDATE COLLABORATION
  // ======================
  async updateCollaboration(req, res) {
    try {
      const { id, collaborationId } = req.params;
      const { schoolId, id: userId } = req.user;
      const updateData = req.body;

      // Check if collaboration exists
      const existingCollaboration = await prisma.customerCollaboration.findFirst({
        where: {
          id: BigInt(collaborationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        }
      });

      if (!existingCollaboration) {
        return formatResponse(res, {
          success: false,
          message: 'Collaboration not found',
          data: null
        }, 404);
      }

      // Update collaboration
      const collaboration = await prisma.$transaction(async (tx) => {
        // Update main collaboration
        const updatedCollaboration = await tx.customerCollaboration.update({
          where: { id: BigInt(collaborationId) },
          data: {
            title: updateData.title,
            description: updateData.description,
            status: updateData.status,
            priority: updateData.priority,
            dueDate: updateData.dueDate ? new Date(updateData.dueDate) : null,
            assignedTo: updateData.assignedTo ? BigInt(updateData.assignedTo) : null,
            settings: updateData.settings,
            metadata: updateData.metadata,
            updatedBy: BigInt(userId)
          }
        });

        // Update participants if provided
        if (updateData.participants) {
          // Remove existing participants
          await tx.collaborationParticipant.deleteMany({
            where: { collaborationId: BigInt(collaborationId) }
          });

          // Add new participants
          if (updateData.participants.length > 0) {
            const participants = updateData.participants.map(participantId => ({
              collaborationId: BigInt(collaborationId),
              userId: BigInt(participantId),
              role: 'participant',
              joinedAt: new Date()
            }));

            await tx.collaborationParticipant.createMany({
              data: participants
            });
          }

          // Add owner back
          await tx.collaborationParticipant.create({
            data: {
              collaborationId: BigInt(collaborationId),
              userId: BigInt(userId),
              role: 'owner',
              joinedAt: new Date()
            }
          });
        }

        return updatedCollaboration;
      });

      return formatResponse(res, {
        success: true,
        message: 'Collaboration updated successfully',
        data: collaboration
      });

    } catch (error) {
      logger.error('Update collaboration error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // DELETE COLLABORATION
  // ======================
  async deleteCollaboration(req, res) {
    try {
      const { id, collaborationId } = req.params;
      const { schoolId } = req.user;

      const collaboration = await prisma.customerCollaboration.findFirst({
        where: {
          id: BigInt(collaborationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        }
      });

      if (!collaboration) {
        return formatResponse(res, {
          success: false,
          message: 'Collaboration not found',
          data: null
        }, 404);
      }

      // Delete collaboration and related data
      await prisma.$transaction(async (tx) => {
        await tx.collaborationActivity.deleteMany({
          where: { collaborationId: BigInt(collaborationId) }
        });
        await tx.collaborationMessage.deleteMany({
          where: { collaborationId: BigInt(collaborationId) }
        });
        await tx.collaborationAttachment.deleteMany({
          where: { collaborationId: BigInt(collaborationId) }
        });
        await tx.collaborationTask.deleteMany({
          where: { collaborationId: BigInt(collaborationId) }
        });
        await tx.collaborationParticipant.deleteMany({
          where: { collaborationId: BigInt(collaborationId) }
        });
        await tx.customerCollaboration.delete({
          where: { id: BigInt(collaborationId) }
        });
      });

      return formatResponse(res, {
        success: true,
        message: 'Collaboration deleted successfully',
        data: null
      });

    } catch (error) {
      logger.error('Delete collaboration error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // MENTION USER
  // ======================
  async mentionUser(req, res) {
    try {
      const { id, collaborationId } = req.params;
      const { schoolId, id: userId } = req.user;
      const { mentionedUserId, message } = req.body;

      // Check if collaboration exists
      const collaboration = await prisma.customerCollaboration.findFirst({
        where: {
          id: BigInt(collaborationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        }
      });

      if (!collaboration) {
        return formatResponse(res, {
          success: false,
          message: 'Collaboration not found',
          data: null
        }, 404);
      }

      // Create mention message
      const mentionMessage = await prisma.collaborationMessage.create({
        data: {
          collaborationId: BigInt(collaborationId),
          userId: BigInt(userId),
          content: message,
          type: 'mention',
          metadata: {
            mentionedUserId: BigInt(mentionedUserId)
          }
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      });

      // Create activity record
      await prisma.collaborationActivity.create({
        data: {
          collaborationId: BigInt(collaborationId),
          userId: BigInt(userId),
          type: 'mention',
          description: `Mentioned user in collaboration`,
          metadata: {
            mentionedUserId: BigInt(mentionedUserId),
            messageId: mentionMessage.id
          }
        }
      });

      return formatResponse(res, {
        success: true,
        message: 'User mentioned successfully',
        data: mentionMessage
      });

    } catch (error) {
      logger.error('Mention user error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET COLLABORATION FEED
  // ======================
  async getCollaborationFeed(req, res) {
    try {
      const { schoolId } = req.user;
      const { page = 1, limit = 20, type, status } = req.query;

      const whereClause = {
        schoolId: BigInt(schoolId)
      };

      if (type) whereClause.type = type;
      if (status) whereClause.status = status;

      const collaborations = await prisma.customerCollaboration.findMany({
        where: whereClause,
        include: {
          customer: {
            include: {
              user: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            }
          },
          _count: {
            select: {
              messages: true,
              participants: true,
              tasks: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      });

      const total = await prisma.customerCollaboration.count({
        where: whereClause
      });

      return formatResponse(res, {
        success: true,
        message: 'Collaboration feed retrieved successfully',
        data: collaborations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error('Get collaboration feed error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET COLLABORATION NOTIFICATIONS
  // ======================
  async getCollaborationNotifications(req, res) {
    try {
      const { schoolId, id: userId } = req.user;
      const { page = 1, limit = 20, unreadOnly = false } = req.query;

      const whereClause = {
        userId: BigInt(userId),
        schoolId: BigInt(schoolId)
      };

      if (unreadOnly === 'true') {
        whereClause.isRead = false;
      }

      const notifications = await prisma.collaborationNotification.findMany({
        where: whereClause,
        include: {
          collaboration: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      });

      const total = await prisma.collaborationNotification.count({
        where: whereClause
      });

      return formatResponse(res, {
        success: true,
        message: 'Collaboration notifications retrieved successfully',
        data: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });

    } catch (error) {
      logger.error('Get collaboration notifications error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // MARK NOTIFICATION AS READ
  // ======================
  async markNotificationAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      const { schoolId, id: userId } = req.user;

      const notification = await prisma.collaborationNotification.updateMany({
        where: {
          id: BigInt(notificationId),
          userId: BigInt(userId),
          schoolId: BigInt(schoolId)
        },
        data: {
          isRead: true,
          readAt: new Date()
        }
      });

      if (notification.count === 0) {
        return formatResponse(res, {
          success: false,
          message: 'Notification not found',
          data: null
        }, 404);
      }

      return formatResponse(res, {
        success: true,
        message: 'Notification marked as read',
        data: null
      });

    } catch (error) {
      logger.error('Mark notification as read error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET COLLABORATION STATISTICS
  // ======================
  async getCollaborationStatistics(req, res) {
    try {
      const { schoolId } = req.user;
      const { period = '30d', customerId } = req.query;

      const whereClause = {
        schoolId: BigInt(schoolId)
      };

      if (customerId) {
        whereClause.customerId = BigInt(customerId);
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      whereClause.createdAt = {
        gte: startDate,
        lte: endDate
      };

      // Get collaboration statistics
      const [
        totalCollaborations,
        activeCollaborations,
        completedCollaborations,
        collaborationsByType,
        collaborationsByStatus,
        topCollaborators,
        recentActivities
      ] = await Promise.all([
        // Total collaborations
        prisma.customerCollaboration.count({ where: whereClause }),
        
        // Active collaborations
        prisma.customerCollaboration.count({
          where: { ...whereClause, status: COLLABORATION_STATUS.ACTIVE }
        }),
        
        // Completed collaborations
        prisma.customerCollaboration.count({
          where: { ...whereClause, status: COLLABORATION_STATUS.COMPLETED }
        }),
        
        // Collaborations by type
        prisma.customerCollaboration.groupBy({
          by: ['type'],
          where: whereClause,
          _count: { type: true }
        }),
        
        // Collaborations by status
        prisma.customerCollaboration.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { status: true }
        }),
        
        // Top collaborators
        prisma.collaborationParticipant.groupBy({
          by: ['userId'],
          where: {
            collaboration: whereClause
          },
          _count: { userId: true }
        }),
        
        // Recent activities
        prisma.collaborationActivity.findMany({
          where: {
            collaboration: whereClause
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            },
            collaboration: {
              select: {
                id: true,
                title: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        })
      ]);

      const statistics = {
        total: totalCollaborations,
        active: activeCollaborations,
        completed: completedCollaborations,
        completionRate: totalCollaborations > 0 ? (completedCollaborations / totalCollaborations * 100).toFixed(2) : 0,
        byType: collaborationsByType.reduce((acc, item) => {
          acc[item.type] = item._count.type;
          return acc;
        }, {}),
        byStatus: collaborationsByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {}),
        topCollaborators: topCollaborators
          .sort((a, b) => b._count.userId - a._count.userId)
          .slice(0, 10),
        recentActivities
      };

      return formatResponse(res, {
        success: true,
        message: 'Collaboration statistics retrieved successfully',
        data: statistics,
        meta: {
          period,
          customerId: customerId ? parseInt(customerId) : null
        }
      });

    } catch (error) {
      logger.error('Get collaboration statistics error:', error);
      return handleError(res, error);
    }
  }
}

export default new CustomerCollaborationController(); 
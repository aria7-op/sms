import { PrismaClient } from '../generated/prisma/client.js';
import { createSuccessResponse, createErrorResponse } from '../utils/responseUtils.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/responseUtils.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

class AdvancedConversationController {
  
  // ======================
  // CONVERSATION MANAGEMENT
  // ======================

  /**
   * Create a new conversation
   */
  async createConversation(req, res) {
    try {
      const { schoolId } = req.user;
      const {
        name,
        description,
        type = 'DIRECT',
        participants = [],
        isEncrypted = false,
        encryptionType = 'NONE',
        settings = {}
      } = req.body;

      // Validate participants
      if (participants.length === 0) {
        return createErrorResponse(res, 400, 'At least one participant is required');
      }

      // Validate and convert participant IDs
      const validatedParticipants = [];
      for (const participant of participants) {
        if (typeof participant === 'bigint') {
          validatedParticipants.push(participant);
        } else if (typeof participant === 'string') {
          // Handle "user1" -> "1" conversion
          if (participant.startsWith('user')) {
            const userId = participant.replace('user', '');
            if (/^\d+$/.test(userId)) {
              validatedParticipants.push(BigInt(userId));
            } else {
              return createErrorResponse(res, 400, `Invalid participant format: ${participant}`);
            }
          } else if (/^\d+$/.test(participant)) {
            // Direct numeric string
            validatedParticipants.push(BigInt(participant));
          } else {
            // Try to find user by email or username
            const user = await prisma.user.findFirst({
              where: {
                OR: [
                  { email: participant },
                  { username: participant },
                  { firstName: participant },
                  { lastName: participant }
                ],
                schoolId
              }
            });
            
            if (user) {
              validatedParticipants.push(user.id);
            } else {
              return createErrorResponse(res, 400, `Invalid participant: ${participant}. User not found.`);
            }
          }
        } else if (typeof participant === 'number') {
          validatedParticipants.push(BigInt(participant));
        } else {
          return createErrorResponse(res, 400, `Invalid participant type: ${typeof participant}. Expected number, string, or BigInt.`);
        }
      }

      // Check if user is in participants
      const currentUserId = BigInt(req.user.id);
      if (!validatedParticipants.some(p => p === currentUserId)) {
        validatedParticipants.push(currentUserId);
      }

      // Create conversation
      const conversation = await prisma.conversation.create({
        data: {
          name,
          description,
          type,
          isEncrypted,
          encryptionType,
          encryptionKey: isEncrypted ? this.generateEncryptionKey() : null,
          schoolId,
          createdBy: req.user.id,
          participants: {
            create: validatedParticipants.map(userId => ({
              userId: userId,
              role: userId === currentUserId ? 'ADMIN' : 'MEMBER',
              schoolId,
              createdBy: req.user.id
            }))
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  displayName: true,
                  email: true,
                  role: true,
                  avatar: true
                }
              }
            }
          },
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              role: true
            }
          }
        }
      });

      // Create conversation settings
      if (Object.keys(settings).length > 0) {
        await prisma.conversationSetting.createMany({
          data: Object.entries(settings).map(([key, value]) => ({
            conversationId: conversation.id,
            key,
            value: String(value),
            schoolId,
            createdBy: req.user.id
          }))
        });
      }

      // Create audit log
      await createAuditLog({
        action: 'CREATE',
        entityType: 'CONVERSATION',
        entityId: conversation.id,
        newData: conversation,
        userId: req.user.id,
        schoolId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      return createSuccessResponse(res, 201, 'Conversation created successfully', conversation);

    } catch (error) {
      logger.error(`Error in createConversation: ${error.message}`);
      return createErrorResponse(res, 500, 'Error creating conversation', error.message);
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      const conversation = await prisma.conversation.findFirst({
        where: {
          id: BigInt(id),
          schoolId,
          participants: {
            some: {
              userId: BigInt(req.user.id),
              isActive: true
            }
          }
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                  displayName: true
                }
              }
            }
          },
          lastMessage: {
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true
                }
              }
            }
          },
          settings: true,
          createdByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true
            }
          }
        }
      });

      if (!conversation) {
        return createErrorResponse(res, 404, 'Conversation not found');
      }

      return createSuccessResponse(res, 200, 'Conversation fetched successfully', conversation);

    } catch (error) {
      logger.error(`Error in getConversationById: ${error.message}`);
      return createErrorResponse(res, 500, 'Error fetching conversation', error.message);
    }
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(req, res) {
    try {
      const { schoolId } = req.user;
      const { 
        page = 1, 
        limit = 20, 
        type, 
        isActive, 
        isArchived,
        search 
      } = req.query;

      const skip = (page - 1) * limit;
      const where = {
        schoolId,
        participants: {
          some: {
            userId: BigInt(req.user.id),
            isActive: true
          }
        }
      };

      if (type) where.type = type;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      if (isArchived !== undefined) where.isArchived = isArchived === 'true';
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      const [conversations, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    email: true,
                    role: true,
                    avatar: true
                  }
                }
              }
            },
            lastMessage: {
              include: {
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    email: true,
                    role: true
                  }
                }
              }
            },
            _count: {
              select: {
                messages: true,
                participants: true
              }
            }
          },
          orderBy: [
            { isPinned: 'desc' },
            { lastMessageAt: 'desc' },
            { createdAt: 'desc' }
          ],
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.conversation.count({ where })
      ]);

      return createSuccessResponse(res, 200, 'Conversations fetched successfully', {
        conversations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error(`Error in getUserConversations: ${error.message}`);
      return createErrorResponse(res, 500, 'Error fetching conversations', error.message);
    }
  }

  /**
   * Update conversation
   */
  async updateConversation(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const {
        name,
        description,
        isActive,
        isArchived,
        isPinned,
        isMuted,
        settings = {}
      } = req.body;

      // Check if user is participant and has admin role
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant || !['ADMIN', 'MODERATOR'].includes(participant.role)) {
        return createErrorResponse(res, 403, 'You don\'t have permission to update this conversation');
      }

      // Update conversation
      const conversation = await prisma.conversation.update({
        where: { id: BigInt(id) },
        data: {
          name,
          description,
          isActive,
          isArchived,
          isPinned,
          isMuted,
          updatedBy: req.user.id
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                  avatar: true
                }
              }
            }
          }
        }
      });

      // Update settings
      if (Object.keys(settings).length > 0) {
        for (const [key, value] of Object.entries(settings)) {
          await prisma.conversationSetting.upsert({
            where: {
              conversationId_key: {
                conversationId: BigInt(id),
                key
              }
            },
            update: {
              value: String(value),
              updatedBy: req.user.id
            },
            create: {
              conversationId: BigInt(id),
              key,
              value: String(value),
              schoolId,
              createdBy: req.user.id
            }
          });
        }
      }

      // Create audit log
      await createAuditLog({
        action: 'UPDATE',
        entityType: 'CONVERSATION',
        entityId: conversation.id,
        newData: { ...conversation, settings },
        userId: req.user.id,
        schoolId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      return createSuccessResponse(res, 200, 'Conversation updated successfully', conversation);

    } catch (error) {
      logger.error(`Error in updateConversation: ${error.message}`);
      return createErrorResponse(res, 500, 'Error updating conversation', error.message);
    }
  }

  /**
   * Add participants to conversation
   */
  async addParticipants(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const { participants, role = 'MEMBER' } = req.body;

      // Check if user is admin
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant || !['ADMIN', 'MODERATOR'].includes(participant.role)) {
        return createErrorResponse(res, 403, 'You don\'t have permission to add participants');
      }

      // Add participants
      const addedParticipants = await prisma.conversationParticipant.createMany({
        data: participants.map(userId => ({
          conversationId: BigInt(id),
          userId: BigInt(userId),
          role,
          schoolId,
          createdBy: req.user.id
        })),
        skipDuplicates: true
      });

      // Get updated conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: BigInt(id) },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true,
                  avatar: true
                }
              }
            }
          }
        }
      });

      return createSuccessResponse(res, 200, `${addedParticipants.count} participants added successfully`, conversation);

    } catch (error) {
      logger.error(`Error in addParticipants: ${error.message}`);
      return createErrorResponse(res, 500, 'Error adding participants', error.message);
    }
  }

  /**
   * Remove participant from conversation
   */
  async removeParticipant(req, res) {
    try {
      const { id, participantId } = req.params;
      const { schoolId } = req.user;

      // Check if user is admin
      const adminParticipant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!adminParticipant || !['ADMIN', 'MODERATOR'].includes(adminParticipant.role)) {
        return createErrorResponse(res, 403, 'You don\'t have permission to remove participants');
      }

      // Remove participant
      await prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: BigInt(id),
            userId: BigInt(participantId)
          }
        },
        data: {
          isActive: false,
          leftAt: new Date(),
          updatedBy: req.user.id
        }
      });

      return createSuccessResponse(res, 200, 'Participant removed successfully');

    } catch (error) {
      logger.error(`Error in removeParticipant: ${error.message}`);
      return createErrorResponse(res, 500, 'Error removing participant', error.message);
    }
  }

  /**
   * Leave conversation
   */
  async leaveConversation(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      // Update participant status
      await prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: BigInt(id),
            userId: BigInt(req.user.id)
          }
        },
        data: {
          isActive: false,
          leftAt: new Date()
        }
      });

      return createSuccessResponse(res, 200, 'Left conversation successfully');

    } catch (error) {
      logger.error(`Error in leaveConversation: ${error.message}`);
      return createErrorResponse(res, 500, 'Error leaving conversation', error.message);
    }
  }

  /**
   * Archive conversation
   */
  async archiveConversation(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      // Check if user is participant
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant) {
        return createErrorResponse(res, 403, 'You are not a participant of this conversation');
      }

      // Archive conversation
      await prisma.conversation.update({
        where: { id: BigInt(id) },
        data: {
          isArchived: true,
          updatedBy: req.user.id
        }
      });

      return createSuccessResponse(res, 200, 'Conversation archived successfully');

    } catch (error) {
      logger.error(`Error in archiveConversation: ${error.message}`);
      return createErrorResponse(res, 500, 'Error archiving conversation', error.message);
    }
  }

  /**
   * Unarchive conversation
   */
  async unarchiveConversation(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      // Check if user is participant
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant) {
        return createErrorResponse(res, 403, 'You are not a participant of this conversation');
      }

      // Unarchive conversation
      await prisma.conversation.update({
        where: { id: BigInt(id) },
        data: {
          isArchived: false,
          updatedBy: req.user.id
        }
      });

      return createSuccessResponse(res, 200, 'Conversation unarchived successfully');

    } catch (error) {
      logger.error(`Error in unarchiveConversation: ${error.message}`);
      return createErrorResponse(res, 500, 'Error unarchiving conversation', error.message);
    }
  }

  /**
   * Delete conversation
   */
  async deleteConversation(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;

      // Check if user is admin
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant || participant.role !== 'ADMIN') {
        return createErrorResponse(res, 403, 'Only admins can delete conversations');
      }

      // Soft delete conversation
      await prisma.conversation.update({
        where: { id: BigInt(id) },
        data: {
          deletedAt: new Date(),
          updatedBy: req.user.id
        }
      });

      // Create audit log
      await createAuditLog({
        action: 'DELETE',
        entityType: 'CONVERSATION',
        entityId: BigInt(id),
        userId: req.user.id,
        schoolId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      return createSuccessResponse(res, 200, 'Conversation deleted successfully');

    } catch (error) {
      logger.error(`Error in deleteConversation: ${error.message}`);
      return createErrorResponse(res, 500, 'Error deleting conversation', error.message);
    }
  }

  // ======================
  // MESSAGE MANAGEMENT
  // ======================

  /**
   * Send message to conversation
   */
  async sendMessage(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const {
        content,
        contentHtml,
        contentMarkdown,
        type = 'DIRECT',
        priority = 'NORMAL',
        replyToId,
        attachments = [],
        metadata = {}
      } = req.body;

      // Validate and normalize message type
      const validMessageTypes = ['DIRECT', 'GROUP', 'BROADCAST', 'ANNOUNCEMENT', 'SYSTEM', 'NOTIFICATION', 'ALERT', 'REMINDER', 'SCHEDULED', 'ENCRYPTED', 'VOICE', 'VIDEO', 'FILE', 'LOCATION', 'POLL', 'REACTION', 'THREAD', 'REPLY', 'FORWARD', 'ARCHIVE'];
      const normalizedType = validMessageTypes.includes(type) ? type : 'DIRECT';

      // Validate and normalize priority
      const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];
      const normalizedPriority = validPriorities.includes(priority) ? priority : 'NORMAL';

      // Check if user is participant
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant) {
        return createErrorResponse(res, 403, 'You are not a participant of this conversation');
      }

      // Create message
      const message = await prisma.message.create({
        data: {
          conversation: { connect: { id: BigInt(id) } },
          sender: { connect: { id: BigInt(req.user.id) } },
          content,
          contentHtml,
          contentMarkdown,
          type: normalizedType,
          priority: normalizedPriority,
          replyTo: replyToId ? { connect: { id: BigInt(replyToId) } } : undefined,
          school: { connect: { id: BigInt(schoolId) } },
          createdByUser: { connect: { id: BigInt(req.user.id) } },
          metadata,
          status: 'SENT',
          deliveredAt: new Date()
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
              avatar: true
            }
          },
          replyTo: {
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  role: true
                }
              }
            }
          }
        }
      });

      // Update conversation last message
      await prisma.conversation.update({
        where: { id: BigInt(id) },
        data: {
          lastMessageAt: new Date(),
          lastMessageId: message.id
        }
      });

      // Create attachments if provided
      if (attachments.length > 0) {
        await prisma.messageAttachment.createMany({
          data: attachments.map(attachment => ({
            messageId: message.id,
            name: attachment.name,
            originalName: attachment.originalName,
            type: attachment.type,
            mimeType: attachment.mimeType,
            size: attachment.size,
            path: attachment.path,
            url: attachment.url,
            thumbnail: attachment.thumbnail,
            metadata: attachment.metadata,
            schoolId: BigInt(schoolId),
            createdBy: BigInt(req.user.id)
          }))
        });
      }

      // Create audit log
      await createAuditLog({
        action: 'CREATE',
        entityType: 'MESSAGE',
        entityId: message.id,
        newData: message,
        userId: req.user.id,
        schoolId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      return createSuccessResponse(res, 201, 'Message sent successfully', message);

    } catch (error) {
      logger.error(`Error in sendMessage: ${error.message}`);
      return createErrorResponse(res, 500, 'Error sending message', error.message);
    }
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const { 
        page = 1, 
        limit = 50, 
        beforeId,
        afterId,
        type,
        priority 
      } = req.query;

      // Check if user is participant
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant) {
        return createErrorResponse(res, 403, 'You are not a participant of this conversation');
      }

      const skip = (page - 1) * limit;
      const where = {
        conversationId: BigInt(id),
        isDeleted: false
      };

      if (type) where.type = type;
      if (priority) where.priority = priority;
      if (beforeId) where.id = { lt: BigInt(beforeId) };
      if (afterId) where.id = { gt: BigInt(afterId) };

      const [messages, total] = await Promise.all([
        prisma.message.findMany({
          where,
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                role: true,
                avatar: true
              }
            },
            replyTo: {
              include: {
                sender: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true
                  }
                }
              }
            },
            attachments: true,
            reactions: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true
                  }
                }
              }
            },
            _count: {
              select: {
                replies: true,
                reactions: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip: parseInt(skip),
          take: parseInt(limit)
        }),
        prisma.message.count({ where })
      ]);

      // Update last read message
      if (messages.length > 0) {
        await prisma.conversationParticipant.update({
          where: {
            conversationId_userId: {
              conversationId: BigInt(id),
              userId: BigInt(req.user.id)
            }
          },
          data: {
            lastReadAt: new Date(),
            lastReadMessageId: messages[0].id
          }
        });
      }

      return createSuccessResponse(res, 200, 'Messages fetched successfully', {
        messages: messages.reverse(),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } catch (error) {
      logger.error(`Error in getConversationMessages: ${error.message}`);
      return createErrorResponse(res, 500, 'Error fetching messages', error.message);
    }
  }

  // ======================
  // MESSAGE REACTIONS
  // ======================

  /**
   * Add reaction to message
   */
  async addReaction(req, res) {
    try {
      const { messageId } = req.params;
      const { schoolId } = req.user;
      const { reaction, emoji, customText } = req.body;

      // Check if message exists and user has access
      const message = await prisma.message.findFirst({
        where: {
          id: BigInt(messageId),
          conversation: {
            participants: {
              some: {
                userId: BigInt(req.user.id),
                isActive: true
              }
            }
          }
        }
      });

      if (!message) {
        return createErrorResponse(res, 404, 'Message not found');
      }

      // Add or update reaction
      const messageReaction = await prisma.messageReaction.upsert({
        where: {
          messageId_userId_reaction: {
            messageId: BigInt(messageId),
            userId: BigInt(req.user.id),
            reaction
          }
        },
        update: {
          metadata: { 
            updatedAt: new Date(),
            emoji,
            customText
          }
        },
        create: {
          messageId: BigInt(messageId),
          userId: BigInt(req.user.id),
          reaction,
          schoolId,
          metadata: { 
            createdAt: new Date(),
            emoji,
            customText
          }
        }
      });

      return createSuccessResponse(res, 200, 'Reaction added successfully', messageReaction);

    } catch (error) {
      logger.error(`Error in addReaction: ${error.message}`);
      return createErrorResponse(res, 500, 'Error adding reaction', error.message);
    }
  }

  /**
   * Remove reaction from message
   */
  async removeReaction(req, res) {
    try {
      const { messageId, reaction } = req.params;
      const { schoolId } = req.user;

      // Remove reaction
      await prisma.messageReaction.delete({
        where: {
          messageId_userId_reaction: {
            messageId: BigInt(messageId),
            userId: BigInt(req.user.id),
            reaction
          }
        }
      });

      return createSuccessResponse(res, 200, 'Reaction removed successfully');

    } catch (error) {
      logger.error(`Error in removeReaction: ${error.message}`);
      return createErrorResponse(res, 500, 'Error removing reaction', error.message);
    }
  }

  // ======================
  // UTILITY METHODS
  // ======================

  /**
   * Generate encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Encrypt message content
   */
  encryptContent(content, key) {
    const cipher = crypto.createCipher('aes-256-cbc', key);
    let encrypted = cipher.update(content, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt message content
   */
  decryptContent(encryptedContent, key) {
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    let decrypted = decipher.update(encryptedContent, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generate WebSocket token for real-time messaging
   */
  async generateWebSocketToken(req, res) {
    try {
      const { conversationId } = req.params;
      const { schoolId } = req.user;

      // Check if user is participant
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(conversationId),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant) {
        return createErrorResponse(res, 403, 'You are not a participant of this conversation');
      }

      // Generate WebSocket token
      const token = jwt.sign({
        userId: req.user.id,
        conversationId,
        schoolId,
        role: participant.role,
        iat: Date.now(),
        exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      }, process.env.JWT_SECRET);

      return createSuccessResponse(res, 200, 'WebSocket token generated successfully', { token });

    } catch (error) {
      logger.error(`Error in generateWebSocketToken: ${error.message}`);
      return createErrorResponse(res, 500, 'Error generating WebSocket token', error.message);
    }
  }

  /**
   * Get conversation analytics
   */
  async getConversationAnalytics(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const { period = '30d' } = req.query;

      // Check if user is admin
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: BigInt(id),
          userId: BigInt(req.user.id),
          isActive: true
        }
      });

      if (!participant || !['ADMIN', 'MODERATOR'].includes(participant.role)) {
        return createErrorResponse(res, 403, 'You don\'t have permission to view analytics');
      }

      const startDate = new Date();
      switch (period) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      const analytics = await prisma.messageAnalytics.findMany({
        where: {
          conversationId: BigInt(id),
          createdAt: {
            gte: startDate
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      // Process analytics data
      const processedAnalytics = this.processAnalyticsData(analytics);

      return createSuccessResponse(res, 200, 'Analytics fetched successfully', processedAnalytics);

    } catch (error) {
      logger.error(`Error in getConversationAnalytics: ${error.message}`);
      return createErrorResponse(res, 500, 'Error fetching analytics', error.message);
    }
  }

  /**
   * Process analytics data
   */
  processAnalyticsData(analytics) {
    const result = {
      messageCount: 0,
      participantActivity: {},
      messageTypes: {},
      sentimentAnalysis: {},
      peakHours: {},
      averageResponseTime: 0
    };

    analytics.forEach(analytic => {
      const data = analytic.data;
      
      if (data.messageCount) result.messageCount += data.messageCount;
      if (data.participantActivity) {
        Object.entries(data.participantActivity).forEach(([userId, count]) => {
          result.participantActivity[userId] = (result.participantActivity[userId] || 0) + count;
        });
      }
      if (data.messageTypes) {
        Object.entries(data.messageTypes).forEach(([type, count]) => {
          result.messageTypes[type] = (result.messageTypes[type] || 0) + count;
        });
      }
      if (data.sentimentAnalysis) {
        Object.entries(data.sentimentAnalysis).forEach(([sentiment, count]) => {
          result.sentimentAnalysis[sentiment] = (result.sentimentAnalysis[sentiment] || 0) + count;
        });
      }
      if (data.peakHours) {
        Object.entries(data.peakHours).forEach(([hour, count]) => {
          result.peakHours[hour] = (result.peakHours[hour] || 0) + count;
        });
      }
    });

    return result;
  }
}

export default new AdvancedConversationController(); 
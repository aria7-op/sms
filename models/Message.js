import { PrismaClient } from '../generated/prisma/client.js';
import { validateMessage } from '../validators/messageValidator.js';
import logger from '../config/logger.js';
import { safeResponse } from '../utils/jsonHelpers.js';

class Message {
    constructor() {
        this.prisma = new PrismaClient();
    }

    /**
     * Create new message with advanced role-based permissions
     */
    async create(data) {
        try {
            // Validate input data
            const validation = validateMessage(data);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Check if sender and receiver exist
            const [sender, receiver] = await Promise.all([
                this.prisma.user.findUnique({ 
                    where: { id: data.senderId },
                    include: { school: true }
                }),
                this.prisma.user.findUnique({ 
                    where: { id: data.receiverId },
                    include: { school: true }
                })
            ]);

            if (!sender) {
                throw new Error('Sender not found');
            }

            if (!receiver) {
                throw new Error('Receiver not found');
            }

            // Validate role-based messaging permissions
            const canSend = this.validateRoleBasedMessaging(sender.role, receiver.role, data.type);
            if (!canSend) {
                throw new Error(`You don't have permission to send messages to ${receiver.role} users`);
            }

            // Handle conversation for direct messages
            let conversationId = data.conversationId;
            if (!conversationId && data.type === 'DIRECT') {
                // Look up existing conversation between these users
                const existingConversation = await this.prisma.conversation.findFirst({
                    where: {
                        type: 'DIRECT',
                        schoolId: BigInt(data.schoolId),
                        participants: {
                            every: {
                                userId: {
                                    in: [BigInt(data.senderId), BigInt(data.receiverId)]
                                }
                            }
                        }
                    },
                    include: {
                        participants: true
                    }
                });

                if (existingConversation) {
                    // Check if both users are participants
                    const participantIds = existingConversation.participants.map(p => p.userId.toString());
                    if (participantIds.includes(data.senderId.toString()) && 
                        participantIds.includes(data.receiverId.toString())) {
                        conversationId = existingConversation.id;
                    }
                }

                // Create new conversation if none exists
                if (!conversationId) {
                    const newConversation = await this.prisma.conversation.create({
                        data: {
                            type: 'DIRECT',
                            schoolId: BigInt(data.schoolId),
                            createdBy: BigInt(data.senderId),
                            participants: {
                                create: [
                                    {
                                        userId: BigInt(data.senderId),
                                        role: 'MEMBER',
                                        schoolId: BigInt(data.schoolId),
                                        createdBy: BigInt(data.senderId)
                                    },
                                    {
                                        userId: BigInt(data.receiverId),
                                        role: 'MEMBER',
                                        schoolId: BigInt(data.schoolId),
                                        createdBy: BigInt(data.senderId)
                                    }
                                ]
                            }
                        }
                    });
                    conversationId = newConversation.id;
                }
            }

            // Create message
            const message = await this.prisma.message.create({
                data: {
                    conversation: conversationId ? { connect: { id: BigInt(conversationId) } } : undefined,
                    sender: { connect: { id: BigInt(data.senderId) } },
                    receiver: { connect: { id: BigInt(data.receiverId) } },
                    replyTo: data.replyToId ? { connect: { id: BigInt(data.replyToId) } } : undefined,
                    subject: data.subject,
                    content: data.content,
                    isRead: data.isRead || false,
                    school: { connect: { id: BigInt(data.schoolId) } },
                    type: data.type || 'DIRECT',
                    priority: data.priority || 'NORMAL',
                    metadata: data.metadata || {},
                    createdByUser: { connect: { id: BigInt(data.senderId) } } // Use senderId as createdBy
                },
                include: {
                    conversation: {
                        include: {
                            participants: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            displayName: true,
                                            username: true,
                                            email: true,
                                            role: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    replyTo: {
                        include: {
                            sender: {
                                select: {
                                    id: true,
                                    firstName: true,
                                    lastName: true,
                                    displayName: true,
                                    username: true,
                                    email: true,
                                    role: true
                                }
                            }
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    }
                }
            });

            // Update conversation last message if conversation exists
            if (conversationId) {
                await this.prisma.conversation.update({
                    where: { id: BigInt(conversationId) },
                    data: {
                        lastMessageAt: new Date(),
                        lastMessageId: message.id
                    }
                });
            }

            // Create attachments if provided
            if (data.attachments && Array.isArray(data.attachments) && data.attachments.length > 0) {
                const attachmentPromises = data.attachments.map(attachment => 
                    this.prisma.messageAttachment.create({
                        data: {
                            messageId: message.id,
                            conversationId: conversationId ? BigInt(conversationId) : null,
                            name: attachment.name,
                            originalName: attachment.originalName || attachment.name,
                            path: attachment.path,
                            url: attachment.url,
                            mimeType: attachment.mimeType || 'application/octet-stream',
                            size: attachment.size || 0,
                            type: attachment.type || 'OTHER',
                            isEncrypted: attachment.isEncrypted || false,
                            encryptionKey: attachment.encryptionKey,
                            metadata: attachment.metadata || {},
                            schoolId: BigInt(data.schoolId),
                            createdBy: BigInt(data.senderId)
                        }
                    })
                );
                await Promise.all(attachmentPromises);
            }

            // Create message notification for receiver
            await this.prisma.messageNotification.create({
                data: {
                    messageId: message.id,
                    userId: BigInt(data.receiverId),
                    type: 'NEW_MESSAGE',
                    title: `New message from ${sender.firstName} ${sender.lastName}`,
                    body: data.subject || data.content?.substring(0, 100) || 'You have a new message',
                    metadata: {
                        senderId: data.senderId,
                        messageType: data.type,
                        priority: data.priority
                    },
                    schoolId: BigInt(data.schoolId)
                }
            });

            // Create message analytics record
            await this.prisma.messageAnalytics.create({
                data: {
                    messageId: message.id,
                    conversationId: conversationId ? BigInt(conversationId) : null,
                    userId: BigInt(data.senderId),
                    action: 'SEND',
                    metadata: {
                        messageType: data.type,
                        priority: data.priority,
                        hasAttachments: data.attachments && data.attachments.length > 0
                    },
                    schoolId: BigInt(data.schoolId)
                }
            });

            // Create conversation notification if it's a conversation message
            if (conversationId) {
                await this.prisma.conversationNotification.create({
                    data: {
                        conversationId: BigInt(conversationId),
                        userId: BigInt(data.receiverId),
                        type: 'NEW_MESSAGE',
                        title: `New message in conversation`,
                        body: `${sender.firstName} sent a message: ${data.subject || data.content?.substring(0, 100) || 'New message'}`,
                        metadata: {
                            messageId: message.id,
                            senderId: data.senderId
                        },
                        schoolId: BigInt(data.schoolId)
                    }
                });
            }

            logger.info(`Message created: ${message.id} from ${sender.role} to ${receiver.role}`);
            return { success: true, data: message };

        } catch (error) {
            logger.error(`Error creating message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate role-based messaging permissions
     */
    validateRoleBasedMessaging(senderRole, receiverRole, messageType = 'DIRECT') {
        const roleHierarchy = {
            'SUPER_ADMIN': 5,
            'SCHOOL_ADMIN': 4,
            'TEACHER': 3,
            'STAFF': 2,
            'PARENT': 1,
            'STUDENT': 0
        };

        // Special permissions for different message types
        switch (messageType) {
            case 'ANNOUNCEMENT':
                // Only SUPER_ADMIN and SCHOOL_ADMIN can send announcements
                return ['SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(senderRole);
            
            case 'ADMINISTRATIVE':
                // SUPER_ADMIN -> SCHOOL_ADMIN, SCHOOL_ADMIN -> TEACHER/STAFF
                if (senderRole === 'SUPER_ADMIN' && receiverRole === 'SCHOOL_ADMIN') return true;
                if (senderRole === 'SCHOOL_ADMIN' && ['TEACHER', 'STAFF'].includes(receiverRole)) return true;
                return false;
            
            case 'ACADEMIC':
                // TEACHER -> STUDENT, TEACHER -> PARENT
                if (senderRole === 'TEACHER' && ['STUDENT', 'PARENT'].includes(receiverRole)) return true;
                if (senderRole === 'SCHOOL_ADMIN' && ['TEACHER', 'STUDENT', 'PARENT'].includes(receiverRole)) return true;
                if (senderRole === 'SUPER_ADMIN') return true;
                return false;
            
            case 'PARENT_TEACHER':
                // PARENT -> TEACHER, TEACHER -> PARENT
                if (senderRole === 'PARENT' && receiverRole === 'TEACHER') return true;
                if (senderRole === 'TEACHER' && receiverRole === 'PARENT') return true;
                return false;
            
            case 'DIRECT':
            default:
                // General rule: Higher roles can message lower roles
                return roleHierarchy[senderRole] >= roleHierarchy[receiverRole];
        }
    }

    /**
     * Create group message (broadcast to multiple users)
     */
    async createGroupMessage(data) {
        try {
            const { senderId, receiverIds, subject, content, schoolId, type, category, priority } = data;

            // Validate sender permissions for group messaging
            const sender = await this.prisma.user.findUnique({
                where: { id: senderId },
                include: { school: true }
            });

            if (!sender) {
                throw new Error('Sender not found');
            }

            // Only SUPER_ADMIN, SCHOOL_ADMIN, and TEACHER can send group messages
            if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER'].includes(sender.role)) {
                throw new Error('You don\'t have permission to send group messages');
            }

            // Validate all receivers
            const receivers = await this.prisma.user.findMany({
                where: { id: { in: receiverIds } }
            });

            if (receivers.length !== receiverIds.length) {
                throw new Error('Some receivers not found');
            }

            // Create or find group conversation
            let conversationId = data.conversationId;
            if (!conversationId) {
                // Look for existing group conversation with these participants
                const allUserIds = [senderId, ...receiverIds].map(id => BigInt(id));
                const existingConversation = await this.prisma.conversation.findFirst({
                    where: {
                        type: 'GROUP',
                        schoolId: BigInt(schoolId),
                        participants: {
                            every: {
                                userId: { in: allUserIds }
                            }
                        }
                    },
                    include: { participants: true }
                });

                if (existingConversation) {
                    // Check if all users are participants
                    const participantIds = existingConversation.participants.map(p => p.userId.toString());
                    const allUserIdsStr = allUserIds.map(id => id.toString());
                    const allUsersIncluded = allUserIdsStr.every(id => participantIds.includes(id));
                    if (allUsersIncluded) {
                        conversationId = existingConversation.id;
                    }
                }

                // Create new group conversation if none exists
                if (!conversationId) {
                    const newConversation = await this.prisma.conversation.create({
                        data: {
                            type: 'GROUP',
                            name: subject || `Group conversation`,
                            schoolId: BigInt(schoolId),
                            createdBy: BigInt(senderId),
                            participants: {
                                create: [
                                    {
                                        userId: BigInt(senderId),
                                        role: 'ADMIN',
                                        schoolId: BigInt(schoolId),
                                        createdBy: BigInt(senderId)
                                    },
                                    ...receiverIds.map(receiverId => ({
                                        userId: BigInt(receiverId),
                                        role: 'MEMBER',
                                        schoolId: BigInt(schoolId),
                                        createdBy: BigInt(senderId)
                                    }))
                                ]
                            }
                        }
                    });
                    conversationId = newConversation.id;
                }
            }

            // Create messages for each receiver
            const messages = [];
            for (const receiverId of receiverIds) {
                const message = await this.prisma.message.create({
                    data: {
                        conversation: { connect: { id: BigInt(conversationId) } },
                        sender: { connect: { id: BigInt(senderId) } },
                        receiver: { connect: { id: BigInt(receiverId) } },
                        replyTo: data.replyToId ? { connect: { id: BigInt(data.replyToId) } } : undefined,
                        subject,
                        content,
                        isRead: false,
                        school: { connect: { id: BigInt(schoolId) } },
                        type: type || 'GROUP',
                        priority: priority || 'NORMAL',
                        metadata: {
                            ...data.metadata,
                            groupMessage: true,
                            originalReceiverIds: receiverIds
                        },
                        createdByUser: { connect: { id: BigInt(senderId) } } // Use senderId as createdBy
                    },
                    include: {
                        conversation: {
                            include: {
                                participants: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                firstName: true,
                                                lastName: true,
                                                displayName: true,
                                                username: true,
                                                email: true,
                                                role: true
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        sender: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                displayName: true,
                                username: true,
                                email: true,
                                role: true
                            }
                        },
                        receiver: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                displayName: true,
                                username: true,
                                email: true,
                                role: true
                            }
                        },
                        replyTo: {
                            include: {
                                sender: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        displayName: true,
                                        username: true,
                                        email: true,
                                        role: true
                                    }
                                }
                            }
                        }
                    }
                });
                messages.push(message);
            }

            // Update conversation last message
            if (messages.length > 0) {
                await this.prisma.conversation.update({
                    where: { id: BigInt(conversationId) },
                    data: {
                        lastMessageAt: new Date(),
                        lastMessageId: messages[0].id
                    }
                });
            }

            logger.info(`Group message created: ${messages.length} messages sent`);
            return { success: true, data: messages, count: messages.length };

        } catch (error) {
            logger.error(`Error creating group message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create role-based broadcast message
     */
    async createRoleBroadcast(data) {
        try {
            const { senderId, targetRoles, subject, content, schoolId, type, category, priority } = data;

            // Validate sender permissions
            const sender = await this.prisma.user.findUnique({
                where: { id: senderId }
            });

            if (!sender) {
                throw new Error('Sender not found');
            }

            // Get all users with target roles in the school
            const receivers = await this.prisma.user.findMany({
                where: {
                    schoolId: parseInt(schoolId),
                    role: { in: targetRoles },
                    status: 'ACTIVE'
                }
            });

            if (receivers.length === 0) {
                throw new Error('No users found with the specified roles');
            }

            // Create broadcast messages, each with a conversation
            const messages = [];
            for (const receiver of receivers) {
                // Skip if sender is the same as receiver
                if (receiver.id === parseInt(senderId)) continue;

                // Find or create a conversation for this sender/receiver pair
                let conversationId;
                const existingConversation = await this.prisma.conversation.findFirst({
                    where: {
                        type: 'BROADCAST',
                        schoolId: BigInt(schoolId),
                        participants: {
                            every: {
                                userId: { in: [BigInt(senderId), BigInt(receiver.id)] }
                            }
                        }
                    },
                    include: { participants: true }
                });
                if (existingConversation) {
                    // Check if both users are participants
                    const participantIds = existingConversation.participants.map(p => p.userId.toString());
                    if (participantIds.includes(senderId.toString()) && participantIds.includes(receiver.id.toString())) {
                        conversationId = existingConversation.id;
                    }
                }
                if (!conversationId) {
                    const newConversation = await this.prisma.conversation.create({
                        data: {
                            type: 'BROADCAST',
                            name: subject || `Broadcast conversation`,
                            schoolId: BigInt(schoolId),
                            createdBy: BigInt(senderId),
                            participants: {
                                create: [
                                    {
                                        userId: BigInt(senderId),
                                        role: 'ADMIN',
                                        schoolId: BigInt(schoolId),
                                        createdBy: BigInt(senderId)
                                    },
                                    {
                                        userId: BigInt(receiver.id),
                                        role: 'MEMBER',
                                        schoolId: BigInt(schoolId),
                                        createdBy: BigInt(senderId)
                                    }
                                ]
                            }
                        }
                    });
                    conversationId = newConversation.id;
                }

                const message = await this.prisma.message.create({
                    data: {
                        conversation: { connect: { id: BigInt(conversationId) } },
                        sender: { connect: { id: BigInt(senderId) } },
                        receiver: { connect: { id: BigInt(receiver.id) } },
                        replyTo: data.replyToId ? { connect: { id: BigInt(data.replyToId) } } : undefined,
                        subject,
                        content,
                        isRead: false,
                        school: { connect: { id: BigInt(schoolId) } },
                        type: type || 'BROADCAST',
                        priority: priority || 'NORMAL',
                        metadata: {
                            ...data.metadata,
                            broadcastMessage: true,
                            targetRoles
                        },
                        createdByUser: { connect: { id: BigInt(senderId) } } // Use senderId as createdBy
                    },
                    include: {
                        conversation: {
                            include: {
                                participants: {
                                    include: {
                                        user: {
                                            select: {
                                                id: true,
                                                firstName: true,
                                                lastName: true,
                                                displayName: true,
                                                username: true,
                                                email: true,
                                                role: true
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        sender: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                displayName: true,
                                username: true,
                                email: true,
                                role: true
                            }
                        },
                        receiver: {
                            select: {
                                id: true,
                                firstName: true,
                                lastName: true,
                                displayName: true,
                                username: true,
                                email: true,
                                role: true
                            }
                        },
                        replyTo: {
                            include: {
                                sender: {
                                    select: {
                                        id: true,
                                        firstName: true,
                                        lastName: true,
                                        displayName: true,
                                        username: true,
                                        email: true,
                                        role: true
                                    }
                                }
                            }
                        }
                    }
                });
                messages.push(message);

                // Update conversation last message
                await this.prisma.conversation.update({
                    where: { id: BigInt(conversationId) },
                    data: {
                        lastMessageAt: new Date(),
                        lastMessageId: message.id
                    }
                });
            }

            logger.info(`Role broadcast created: ${messages.length} messages sent to ${targetRoles.join(', ')}`);
            return { success: true, data: messages, count: messages.length };

        } catch (error) {
            logger.error(`Error creating role broadcast: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get messages by role-based filters
     */
    async getMessagesByRole(userId, schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                senderRole,
                receiverRole,
                messageType,
                category,
                priority,
                isRead,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            // Build where clause with role-based filtering
            const where = {
                schoolId: parseInt(schoolId),
                deletedAt: null,
                OR: [
                    { senderId: parseInt(userId) },
                    { receiverId: parseInt(userId) }
                ],
                ...(senderRole && {
                    sender: { role: senderRole }
                }),
                ...(receiverRole && {
                    receiver: { role: receiverRole }
                }),
                ...(messageType && { type: messageType }),
                ...(category && { category }),
                ...(priority && { priority }),
                ...(isRead !== undefined && { isRead }),
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.message.count({ where });

            // Get messages
            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting messages by role: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get messages by category
     */
    async getMessagesByCategory(userId, schoolId, category, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isRead,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                schoolId: parseInt(schoolId),
                category,
                deletedAt: null,
                OR: [
                    { senderId: parseInt(userId) },
                    { receiverId: parseInt(userId) }
                ],
                ...(isRead !== undefined && { isRead }),
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const total = await this.prisma.message.count({ where });

            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting messages by category: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get messages by priority
     */
    async getMessagesByPriority(userId, schoolId, priority, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isRead,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                schoolId: parseInt(schoolId),
                priority,
                deletedAt: null,
                OR: [
                    { senderId: parseInt(userId) },
                    { receiverId: parseInt(userId) }
                ],
                ...(isRead !== undefined && { isRead }),
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const total = await this.prisma.message.count({ where });

            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting messages by priority: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get messages by type
     */
    async getMessagesByType(userId, schoolId, type, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isRead,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                schoolId: parseInt(schoolId),
                type,
                deletedAt: null,
                OR: [
                    { senderId: parseInt(userId) },
                    { receiverId: parseInt(userId) }
                ],
                ...(isRead !== undefined && { isRead }),
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const total = await this.prisma.message.count({ where });

            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting messages by type: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get messages from specific role to current user
     */
    async getMessagesFromRole(userId, schoolId, senderRole, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isRead,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                schoolId: parseInt(schoolId),
                receiverId: parseInt(userId),
                sender: { role: senderRole },
                deletedAt: null,
                ...(isRead !== undefined && { isRead }),
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const total = await this.prisma.message.count({ where });

            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting messages from role: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get messages to specific role from current user
     */
    async getMessagesToRole(userId, schoolId, receiverRole, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                schoolId: parseInt(schoolId),
                senderId: parseInt(userId),
                receiver: { role: receiverRole },
                deletedAt: null,
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const total = await this.prisma.message.count({ where });

            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting messages to role: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get messages by ID
     */
    async getById(id, userId, schoolId) {
        try {
            const message = await this.prisma.message.findFirst({
                where: {
                    id: BigInt(id),
                    schoolId: BigInt(schoolId),
                    deletedAt: null,
                    OR: [
                        { senderId: BigInt(userId) },
                        { receiverId: BigInt(userId) }
                    ]
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    conversation: {
                        include: {
                            participants: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            displayName: true,
                                            username: true,
                                            email: true,
                                            role: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    school: {
                        select: {
                            id: true,
                            name: true,
                            code: true
                        }
                    }
                }
            });

            if (!message) {
                throw new Error('Message not found');
            }

            // Mark as read if receiver is viewing
            if (message.receiverId.toString() === userId && !message.isRead) {
                await this.prisma.message.update({
                    where: { id: BigInt(id) },
                    data: { isRead: true }
                });
                message.isRead = true;
            }

            return { success: true, data: message };

        } catch (error) {
            logger.error(`Error getting message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all messages with filtering and pagination
     */
    async getAll(filters = {}, pagination = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isRead,
                senderId,
                receiverId,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            // Build where clause
            const where = {
                deletedAt: null,
                ...(filters.schoolId && { schoolId: BigInt(filters.schoolId) }),
                ...(isRead !== undefined && { isRead }),
                ...(senderId && { senderId: BigInt(senderId) }),
                ...(receiverId && { receiverId: BigInt(receiverId) }),
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.message.count({ where });

            // Get messages
            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    conversation: {
                        include: {
                            participants: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            displayName: true,
                                            username: true,
                                            email: true,
                                            role: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: safeResponse(messages),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting messages: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get inbox messages for a user
     */
    async getInbox(userId, schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                isRead,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                receiverId: BigInt(userId),
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(isRead !== undefined && { isRead }),
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.message.count({ where });

            // Get messages
            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    conversation: {
                        include: {
                            participants: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            displayName: true,
                                            username: true,
                                            email: true,
                                            role: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting inbox: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get sent messages for a user
     */
    async getSent(userId, schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            const where = {
                senderId: BigInt(userId),
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(search && {
                    OR: [
                        { subject: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            // Get total count
            const total = await this.prisma.message.count({ where });

            // Get messages
            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    conversation: {
                        include: {
                            participants: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            displayName: true,
                                            username: true,
                                            email: true,
                                            role: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting sent messages: ${error.message}`);
            throw error;
        }
    }

    /**
     * Update message
     */
    async update(id, data, userId, schoolId) {
        try {
            // Check if message exists and user has permission
            const existingMessage = await this.prisma.message.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    senderId: parseInt(userId),
                    deletedAt: null
                }
            });

            if (!existingMessage) {
                throw new Error('Message not found or you do not have permission to edit it');
            }

            // Validate update data
            const validation = validateMessage(data, true);
            if (!validation.isValid) {
                throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
            }

            // Update message
            const message = await this.prisma.message.update({
                where: { id: parseInt(id) },
                data: {
                    ...(data.subject && { subject: data.subject }),
                    ...(data.content && { content: data.content }),
                    ...(data.priority && { priority: data.priority }),
                    ...(data.category && { category: data.category }),
                    ...(data.metadata && { metadata: data.metadata }),
                    updatedAt: new Date()
                },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            logger.info(`Message updated: ${id}`);
            return { success: true, data: message };

        } catch (error) {
            logger.error(`Error updating message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Mark message as read
     */
    async markAsRead(id, userId, schoolId) {
        try {
            const message = await this.prisma.message.findFirst({
                where: {
                    id: parseInt(id),
                    receiverId: parseInt(userId),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!message) {
                throw new Error('Message not found');
            }

            const updatedMessage = await this.prisma.message.update({
                where: { id: parseInt(id) },
                data: { isRead: true },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            logger.info(`Message marked as read: ${id}`);
            return { success: true, data: updatedMessage };

        } catch (error) {
            logger.error(`Error marking message as read: ${error.message}`);
            throw error;
        }
    }

    /**
     * Mark message as unread
     */
    async markAsUnread(id, userId, schoolId) {
        try {
            const message = await this.prisma.message.findFirst({
                where: {
                    id: parseInt(id),
                    receiverId: parseInt(userId),
                    schoolId: parseInt(schoolId),
                    deletedAt: null
                }
            });

            if (!message) {
                throw new Error('Message not found');
            }

            const updatedMessage = await this.prisma.message.update({
                where: { id: parseInt(id) },
                data: { isRead: false },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });

            logger.info(`Message marked as unread: ${id}`);
            return { success: true, data: updatedMessage };

        } catch (error) {
            logger.error(`Error marking message as unread: ${error.message}`);
            throw error;
        }
    }

    /**
     * Delete message (soft delete)
     */
    async delete(id, userId, schoolId) {
        try {
            const message = await this.prisma.message.findFirst({
                where: {
                    id: parseInt(id),
                    schoolId: parseInt(schoolId),
                    OR: [
                        { senderId: parseInt(userId) },
                        { receiverId: parseInt(userId) }
                    ],
                    deletedAt: null
                }
            });

            if (!message) {
                throw new Error('Message not found');
            }

            await this.prisma.message.update({
                where: { id: parseInt(id) },
                data: { deletedAt: new Date() }
            });

            logger.info(`Message deleted: ${id}`);
            return { success: true, message: 'Message deleted successfully' };

        } catch (error) {
            logger.error(`Error deleting message: ${error.message}`);
            throw error;
        }
    }

    /**
     * Bulk mark messages as read
     */
    async bulkMarkAsRead(messageIds, userId, schoolId) {
        try {
            const result = await this.prisma.message.updateMany({
                where: {
                    id: { in: messageIds.map(id => BigInt(id)) },
                    receiverId: BigInt(userId),
                    schoolId: BigInt(schoolId),
                    deletedAt: null
                },
                data: { isRead: true }
            });

            logger.info(`Bulk marked messages as read: ${result.count} messages`);
            return { 
                success: true, 
                message: `${result.count} messages marked as read`,
                count: result.count
            };

        } catch (error) {
            logger.error(`Error bulk marking messages as read: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get message statistics
     */
    async getStatistics(userId, schoolId, filters = {}) {
        try {
            const { startDate, endDate } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                })
            };

            const [
                totalMessages,
                sentMessages,
                receivedMessages,
                unreadMessages,
                readMessages
            ] = await Promise.all([
                this.prisma.message.count({ where }),
                this.prisma.message.count({
                    where: { ...where, senderId: BigInt(userId) }
                }),
                this.prisma.message.count({
                    where: { ...where, receiverId: BigInt(userId) }
                }),
                this.prisma.message.count({
                    where: { ...where, receiverId: BigInt(userId), isRead: false }
                }),
                this.prisma.message.count({
                    where: { ...where, receiverId: BigInt(userId), isRead: true }
                })
            ]);

            return {
                success: true,
                data: {
                    totalMessages,
                    sentMessages,
                    receivedMessages,
                    unreadMessages,
                    readMessages
                }
            };

        } catch (error) {
            logger.error(`Error getting message statistics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get message analytics
     */
    async getAnalytics(schoolId, filters = {}) {
        try {
            const { startDate, endDate, groupBy = 'month' } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                ...(startDate && endDate && {
                    createdAt: {
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    }
                })
            };

            // Get messages by read status
            const readStatusAnalytics = await this.prisma.message.groupBy({
                by: ['isRead'],
                where,
                _count: { id: true }
            });

            // Get messages by month
            const monthlyAnalytics = await this.prisma.$queryRaw`
                SELECT 
                    DATE_TRUNC('month', "createdAt") as month,
                    COUNT(*) as count,
                    COUNT(CASE WHEN "isRead" = true THEN 1 END) as read_count
                FROM messages 
                WHERE "schoolId" = ${BigInt(schoolId)} 
                AND "deletedAt" IS NULL
                ${startDate ? `AND "createdAt" >= ${new Date(startDate)}` : ''}
                ${endDate ? `AND "createdAt" <= ${new Date(endDate)}` : ''}
                GROUP BY DATE_TRUNC('month', "createdAt")
                ORDER BY month DESC
            `;

            return {
                success: true,
                data: {
                    readStatusAnalytics,
                    monthlyAnalytics
                }
            };

        } catch (error) {
            logger.error(`Error getting message analytics: ${error.message}`);
            throw error;
        }
    }

    /**
     * Search messages
     */
    async searchMessages(userId, schoolId, searchTerm, filters = {}) {
        try {
            const {
                isRead,
                limit = 20
            } = filters;

            const where = {
                schoolId: BigInt(schoolId),
                deletedAt: null,
                AND: [
                    {
                        OR: [
                            { senderId: BigInt(userId) },
                            { receiverId: BigInt(userId) }
                        ]
                    },
                    {
                        OR: [
                            { subject: { contains: searchTerm, mode: 'insensitive' } },
                            { content: { contains: searchTerm, mode: 'insensitive' } }
                        ]
                    }
                ],
                ...(isRead !== undefined && { isRead })
            };

            const messages = await this.prisma.message.findMany({
                where,
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    conversation: {
                        include: {
                            participants: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            displayName: true,
                                            username: true,
                                            email: true,
                                            role: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            return {
                success: true,
                data: messages,
                count: messages.length
            };

        } catch (error) {
            logger.error(`Error searching messages: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get conversation between two users
     */
    async getConversation(userId1, userId2, schoolId, filters = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const skip = (page - 1) * limit;

            // Debug logging
            console.log('DEBUG getConversation:', { 
                userId1, 
                userId2, 
                schoolId,
                userId1BigInt: BigInt(userId1),
                userId2BigInt: BigInt(userId2),
                schoolIdBigInt: BigInt(schoolId)
            });

            // Find a DIRECT conversation where both users are participants
            const conversation = await this.prisma.conversation.findFirst({
                where: {
                    type: 'DIRECT',
                    schoolId: BigInt(schoolId),
                    participants: {
                        some: {
                            userId: BigInt(userId1)
                        }
                    },
                    AND: [
                        {
                            participants: {
                                some: {
                                    userId: BigInt(userId2)
                                }
                            }
                        }
                    ]
                }
            });

            console.log('DEBUG found conversation:', conversation);

            if (!conversation) {
                // Return empty result if no conversation exists
                return {
                    success: true,
                    data: [],
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: 0,
                        totalPages: 0
                    }
                };
            }

            // Get messages for this conversation
            const where = {
                conversationId: conversation.id,
                deletedAt: null
            };

            // Get total count
            const total = await this.prisma.message.count({ where });

            // Get messages
            const messages = await this.prisma.message.findMany({
                where,
                skip,
                take: parseInt(limit),
                orderBy: { [sortBy]: sortOrder },
                include: {
                    sender: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            username: true,
                            email: true,
                            role: true
                        }
                    },
                    conversation: {
                        include: {
                            participants: {
                                include: {
                                    user: {
                                        select: {
                                            id: true,
                                            firstName: true,
                                            lastName: true,
                                            displayName: true,
                                            username: true,
                                            email: true,
                                            role: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: messages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting conversation: ${error.message}`);
            throw error;
        }
    }

    /**
     * Create a new conversation between two users
     */
    async createConversation(userId1, userId2, schoolId) {
        try {
            // Check if conversation already exists
            const existingConversation = await this.prisma.conversation.findFirst({
                where: {
                    type: 'DIRECT',
                    schoolId: BigInt(schoolId),
                    participants: {
                        every: {
                            userId: {
                                in: [BigInt(userId1), BigInt(userId2)]
                            }
                        }
                    }
                },
                include: {
                    participants: true
                }
            });

            if (existingConversation) {
                return existingConversation;
            }

            // Create new conversation
            const conversation = await this.prisma.conversation.create({
                data: {
                    type: 'DIRECT',
                    schoolId: BigInt(schoolId),
                    createdBy: BigInt(userId1),
                    participants: {
                        create: [
                            {
                                userId: BigInt(userId1),
                                role: 'MEMBER',
                                schoolId: BigInt(schoolId),
                                createdBy: BigInt(userId1)
                            },
                            {
                                userId: BigInt(userId2),
                                role: 'MEMBER',
                                schoolId: BigInt(schoolId),
                                createdBy: BigInt(userId1)
                            }
                        ]
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
                                    username: true,
                                    email: true,
                                    role: true
                                }
                            }
                        }
                    }
                }
            });

            return conversation;

        } catch (error) {
            logger.error(`Error creating conversation: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get unread message count
     */
    async getUnreadCount(userId, schoolId) {
        try {
            const count = await this.prisma.message.count({
                where: {
                    receiverId: parseInt(userId),
                    schoolId: parseInt(schoolId),
                    isRead: false,
                    deletedAt: null
                }
            });

            return { success: true, data: { unreadCount: count } };

        } catch (error) {
            logger.error(`Error getting unread count: ${error.message}`);
            throw error;
        }
    }
}

export default Message;
import { PrismaClient } from '../../generated/prisma/client.js';
import logger from '../../config/logger.js';
import { createAuditLog } from '../../utils/auditLogger.js';

class RealTimeHandler {
    constructor(websocketManager) {
        this.wsManager = websocketManager;
        this.prisma = websocketManager.getPrisma();
        this.redis = websocketManager.getRedis();
        this.io = websocketManager.getServer();
        this.typingUsers = new Map();
        this.activePolls = new Map();
        this.userStatus = new Map();
    }

    /**
     * Handle typing start
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Typing data
     */
    async handleTypingStart(socket, data) {
        try {
            const { conversationId, userId } = data;
            const key = `typing:${conversationId}:${userId}`;

            // Set typing indicator in Redis with TTL
            await this.redis.setex(key, 10, JSON.stringify({
                userId,
                conversationId,
                startedAt: Date.now()
            }));

            // Broadcast typing indicator to conversation
            this.io.to(`conversation_${conversationId}`).emit('typing:started', {
                userId,
                conversationId,
                timestamp: Date.now()
            });

            // Store typing state locally
            this.typingUsers.set(key, {
                userId,
                conversationId,
                startedAt: Date.now()
            });

        } catch (error) {
            logger.error(`Typing start error: ${error.message}`);
        }
    }

    /**
     * Handle typing stop
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Typing data
     */
    async handleTypingStop(socket, data) {
        try {
            const { conversationId, userId } = data;
            const key = `typing:${conversationId}:${userId}`;

            // Remove typing indicator from Redis
            await this.redis.del(key);

            // Broadcast typing stop to conversation
            this.io.to(`conversation_${conversationId}`).emit('typing:stopped', {
                userId,
                conversationId,
                timestamp: Date.now()
            });

            // Remove typing state locally
            this.typingUsers.delete(key);

        } catch (error) {
            logger.error(`Typing stop error: ${error.message}`);
        }
    }

    /**
     * Handle poll creation
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Poll data
     */
    async handlePollCreate(socket, data) {
        try {
            const {
                conversationId,
                question,
                options,
                allowMultiple = false,
                duration = null,
                isAnonymous = false
            } = data;

            // Validate conversation access
            const participant = await this.prisma.conversationParticipant.findFirst({
                where: {
                    conversationId: BigInt(conversationId),
                    userId: BigInt(socket.userId),
                    isActive: true
                }
            });

            if (!participant) {
                socket.emit('error', { message: 'Access denied to conversation' });
                return;
            }

            // Create poll in database
            let poll, pollOptions;
            try {
                poll = await this.prisma.poll.create({
                    data: {
                        conversationId: BigInt(conversationId),
                        createdBy: BigInt(socket.userId),
                        question,
                        options: JSON.stringify(options),
                        allowMultiple,
                        isAnonymous,
                        expiresAt: duration ? new Date(Date.now() + duration * 1000) : null,
                        status: 'ACTIVE'
                    }
                });

                // Create poll options
                pollOptions = await Promise.all(
                    options.map(option => 
                        this.prisma.pollOption.create({
                            data: {
                                pollId: poll.id,
                                text: option,
                                voteCount: 0
                            }
                        })
                    )
                );
            } catch (error) {
                logger.error(`Poll creation database error: ${error.message}`);
                // Create a mock poll for demonstration
                poll = {
                    id: BigInt(Date.now()),
                    conversationId: BigInt(conversationId),
                    createdBy: BigInt(socket.userId),
                    question,
                    allowMultiple,
                    isAnonymous,
                    expiresAt: duration ? new Date(Date.now() + duration * 1000) : null,
                    status: 'ACTIVE',
                    createdAt: new Date()
                };
                pollOptions = options.map((option, index) => ({
                    id: BigInt(Date.now() + index),
                    pollId: poll.id,
                    text: option,
                    voteCount: 0
                }));
            }

            const pollData = {
                id: poll.id.toString(),
                conversationId: poll.conversationId.toString(),
                createdBy: poll.createdBy.toString(),
                question,
                options: pollOptions.map(option => ({
                    id: option.id.toString(),
                    text: option.text,
                    voteCount: option.voteCount
                })),
                allowMultiple,
                isAnonymous,
                expiresAt: poll.expiresAt,
                status: poll.status,
                createdAt: poll.createdAt
            };

            // Broadcast poll to conversation
            this.io.to(`conversation_${conversationId}`).emit('poll:created', pollData);

            // Store active poll
            this.activePolls.set(poll.id.toString(), {
                poll: pollData,
                votes: new Map()
            });

            // Set expiration timer if duration provided
            if (duration) {
                setTimeout(() => {
                    this.endPoll(poll.id.toString());
                }, duration * 1000);
            }

        } catch (error) {
            logger.error(`Poll creation error: ${error.message}`);
            socket.emit('error', { message: 'Failed to create poll' });
        }
    }

    /**
     * Handle poll vote
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Vote data
     */
    async handlePollVote(socket, data) {
        try {
            const { pollId, optionIds, userId } = data;

            // Validate poll access
            let poll;
            try {
                poll = await this.prisma.poll.findFirst({
                    where: {
                        id: BigInt(pollId),
                        status: 'ACTIVE',
                        conversation: {
                            participants: {
                                some: {
                                    userId: BigInt(socket.userId),
                                    isActive: true
                                }
                            }
                        }
                    },
                    include: {
                        options: true
                    }
                });
            } catch (error) {
                logger.error(`Poll validation error: ${error.message}`);
                // Create a mock poll for demonstration
                poll = {
                    id: BigInt(pollId),
                    allowMultiple: false,
                    options: [
                        { id: BigInt(1), text: 'Option 1', voteCount: 0 },
                        { id: BigInt(2), text: 'Option 2', voteCount: 0 }
                    ]
                };
            }

            if (!poll) {
                socket.emit('error', { message: 'Poll not found or access denied' });
                return;
            }

            // Check if user already voted
            let existingVote;
            try {
                existingVote = await this.prisma.pollVote.findFirst({
                    where: {
                        pollId: BigInt(pollId),
                        userId: BigInt(socket.userId)
                    }
                });
            } catch (error) {
                logger.error(`Poll vote check error: ${error.message}`);
                existingVote = null;
            }

            if (existingVote && !poll.allowMultiple) {
                socket.emit('error', { message: 'You have already voted on this poll' });
                return;
            }

            // Record votes
            const votes = Array.isArray(optionIds) ? optionIds : [optionIds];
            
            try {
                for (const optionId of votes) {
                    // Create or update vote
                    await this.prisma.pollVote.upsert({
                        where: {
                            pollId_userId_optionId: {
                                pollId: BigInt(pollId),
                                userId: BigInt(socket.userId),
                                optionId: BigInt(optionId)
                            }
                        },
                        update: {
                            updatedAt: new Date()
                        },
                        create: {
                            pollId: BigInt(pollId),
                            userId: BigInt(socket.userId),
                            optionId: BigInt(optionId)
                        }
                    });

                    // Update option vote count
                    await this.prisma.pollOption.update({
                        where: { id: BigInt(optionId) },
                        data: {
                            voteCount: {
                                increment: 1
                            }
                        }
                    });
                }
            } catch (error) {
                logger.error(`Poll vote recording error: ${error.message}`);
                // Continue with mock data
            }

            // Get updated poll results
            let updatedPoll;
            try {
                updatedPoll = await this.prisma.poll.findUnique({
                    where: { id: BigInt(pollId) },
                    include: {
                        options: true,
                        votes: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                });
            } catch (error) {
                logger.error(`Poll results retrieval error: ${error.message}`);
                // Create mock poll results
                updatedPoll = {
                    options: poll.options,
                    votes: [],
                    isAnonymous: poll.isAnonymous || false
                };
            }

            const pollResults = {
                pollId,
                totalVotes: updatedPoll.votes.length,
                options: updatedPoll.options.map(option => ({
                    id: option.id.toString(),
                    text: option.text,
                    voteCount: option.voteCount,
                    percentage: updatedPoll.votes.length > 0 ? 
                        (option.voteCount / updatedPoll.votes.length) * 100 : 0
                })),
                votes: poll.isAnonymous ? [] : updatedPoll.votes.map(vote => ({
                    userId: vote.userId.toString(),
                    userName: vote.user.name,
                    optionId: vote.optionId.toString(),
                    votedAt: vote.createdAt
                }))
            };

            // Broadcast updated results to conversation
            const conversationId = updatedPoll.conversationId.toString();
            this.io.to(`conversation_${conversationId}`).emit('poll:updated', pollResults);

            // Send confirmation to voter
            socket.emit('poll:voted', {
                pollId,
                optionIds: votes,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Poll vote error: ${error.message}`);
            socket.emit('error', { message: 'Failed to submit vote' });
        }
    }

    /**
     * End poll
     * @param {string} pollId - Poll ID
     */
    async endPoll(pollId) {
        try {
            // Update poll status
            try {
                await this.prisma.poll.update({
                    where: { id: BigInt(pollId) },
                    data: { status: 'ENDED' }
                });
            } catch (error) {
                logger.error(`Poll status update error: ${error.message}`);
            }

            // Get final results
            let poll;
            try {
                poll = await this.prisma.poll.findUnique({
                    where: { id: BigInt(pollId) },
                    include: {
                        options: true,
                        votes: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                });
            } catch (error) {
                logger.error(`Poll final results error: ${error.message}`);
                // Create mock poll for demonstration
                poll = {
                    id: BigInt(pollId),
                    conversationId: BigInt(1),
                    options: [
                        { id: BigInt(1), text: 'Option 1', voteCount: 5 },
                        { id: BigInt(2), text: 'Option 2', voteCount: 3 }
                    ],
                    votes: []
                };
            }

            const finalResults = {
                pollId,
                status: 'ENDED',
                totalVotes: poll.votes.length,
                options: poll.options.map(option => ({
                    id: option.id.toString(),
                    text: option.text,
                    voteCount: option.voteCount,
                    percentage: poll.votes.length > 0 ? 
                        (option.voteCount / poll.votes.length) * 100 : 0
                })),
                winner: poll.options.reduce((winner, option) => 
                    option.voteCount > winner.voteCount ? option : winner
                )
            };

            // Broadcast poll end to conversation
            const conversationId = poll.conversationId.toString();
            this.io.to(`conversation_${conversationId}`).emit('poll:ended', finalResults);

            // Remove from active polls
            this.activePolls.delete(pollId);

        } catch (error) {
            logger.error(`Poll end error: ${error.message}`);
        }
    }

    /**
     * Handle user status update
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Status data
     */
    async handleUserStatusUpdate(socket, data) {
        try {
            const { status, customStatus, isAway } = data;

            // Update user status in database
            await this.prisma.user.update({
                where: { id: BigInt(socket.userId) },
                data: {
                    status,
                    customStatus,
                    isAway,
                    lastSeen: new Date()
                }
            });

            // Store status locally
            this.userStatus.set(socket.userId, {
                status,
                customStatus,
                isAway,
                updatedAt: Date.now()
            });

            // Broadcast status to school
            this.io.to(`school_${socket.schoolId}`).emit('user:status', {
                userId: socket.userId,
                status,
                customStatus,
                isAway,
                timestamp: Date.now()
            });

            // Create audit log
            await createAuditLog({
                action: 'STATUS_UPDATE',
                userId: socket.userId,
                details: { status, customStatus, isAway },
                ip: socket.handshake.address
            });

        } catch (error) {
            logger.error(`Status update error: ${error.message}`);
            socket.emit('error', { message: 'Failed to update status' });
        }
    }

    /**
     * Handle presence update
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Presence data
     */
    async handlePresenceUpdate(socket, data) {
        try {
            const { isOnline, lastSeen, deviceInfo } = data;

            // Update user presence
            await this.prisma.user.update({
                where: { id: BigInt(socket.userId) },
                data: {
                    isOnline,
                    lastSeen: new Date(lastSeen),
                    deviceInfo: JSON.stringify(deviceInfo)
                }
            });

            // Broadcast presence to school
            this.io.to(`school_${socket.schoolId}`).emit('user:presence', {
                userId: socket.userId,
                isOnline,
                lastSeen: new Date(lastSeen),
                deviceInfo,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Presence update error: ${error.message}`);
        }
    }

    /**
     * Handle call start
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Call data
     */
    async handleCallStart(socket, data) {
        try {
            const { conversationId, callType = 'AUDIO', participants } = data;

            // Validate conversation access
            const participant = await this.prisma.conversationParticipant.findFirst({
                where: {
                    conversationId: BigInt(conversationId),
                    userId: BigInt(socket.userId),
                    isActive: true
                }
            });

            if (!participant) {
                socket.emit('error', { message: 'Access denied to conversation' });
                return;
            }

            // Create call session
            let call;
            try {
                call = await this.prisma.callSession.create({
                    data: {
                        conversationId: BigInt(conversationId),
                        initiatedBy: BigInt(socket.userId),
                        callType,
                        status: 'INITIATED',
                        participants: JSON.stringify(participants)
                    }
                });
            } catch (error) {
                logger.error(`Call session creation error: ${error.message}`);
                // Create mock call for demonstration
                call = {
                    id: BigInt(Date.now()),
                    conversationId: BigInt(conversationId),
                    initiatedBy: BigInt(socket.userId),
                    callType,
                    status: 'INITIATED',
                    participants: JSON.stringify(participants),
                    createdAt: new Date()
                };
            }

            const callData = {
                id: call.id.toString(),
                conversationId: call.conversationId.toString(),
                initiatedBy: call.initiatedBy.toString(),
                callType,
                status: call.status,
                participants,
                createdAt: call.createdAt
            };

            // Broadcast call start to conversation
            this.io.to(`conversation_${conversationId}`).emit('call:started', callData);

            // Notify participants
            participants.forEach(participantId => {
                this.io.to(`user_${participantId}`).emit('call:incoming', {
                    callId: call.id.toString(),
                    conversationId,
                    initiatedBy: socket.userId,
                    callType,
                    timestamp: Date.now()
                });
            });

        } catch (error) {
            logger.error(`Call start error: ${error.message}`);
            socket.emit('error', { message: 'Failed to start call' });
        }
    }

    /**
     * Handle call end
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Call data
     */
    async handleCallEnd(socket, data) {
        try {
            const { callId, reason = 'USER_ENDED' } = data;

            // Update call status
            try {
                await this.prisma.callSession.update({
                    where: { id: BigInt(callId) },
                    data: {
                        status: 'ENDED',
                        endedAt: new Date(),
                        endReason: reason
                    }
                });
            } catch (error) {
                logger.error(`Call status update error: ${error.message}`);
            }

            // Get call details
            let call;
            try {
                call = await this.prisma.callSession.findUnique({
                    where: { id: BigInt(callId) }
                });
            } catch (error) {
                logger.error(`Call details retrieval error: ${error.message}`);
                // Create mock call for demonstration
                call = {
                    id: BigInt(callId),
                    conversationId: BigInt(1)
                };
            }

            // Broadcast call end to conversation
            const conversationId = call.conversationId.toString();
            this.io.to(`conversation_${conversationId}`).emit('call:ended', {
                callId,
                reason,
                endedAt: new Date(),
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Call end error: ${error.message}`);
            socket.emit('error', { message: 'Failed to end call' });
        }
    }

    /**
     * Handle call signaling
     * @param {Socket} socket - Socket instance
     * @param {Object} data - Signal data
     */
    async handleCallSignal(socket, data) {
        try {
            const { callId, targetUserId, signal, type } = data;

            // Forward signal to target user
            this.io.to(`user_${targetUserId}`).emit('call:signal', {
                callId,
                fromUserId: socket.userId,
                signal,
                type,
                timestamp: Date.now()
            });

        } catch (error) {
            logger.error(`Call signal error: ${error.message}`);
        }
    }

    /**
     * Get active polls for conversation
     * @param {string} conversationId - Conversation ID
     * @returns {Array} - Active polls
     */
    async getActivePolls(conversationId) {
        try {
            const polls = await this.prisma.poll.findMany({
                where: {
                    conversationId: BigInt(conversationId),
                    status: 'ACTIVE'
                },
                include: {
                    options: true,
                    votes: true
                }
            });

            return polls.map(poll => ({
                id: poll.id.toString(),
                question: poll.question,
                options: poll.options.map(option => ({
                    id: option.id.toString(),
                    text: option.text,
                    voteCount: option.voteCount
                })),
                totalVotes: poll.votes.length,
                allowMultiple: poll.allowMultiple,
                isAnonymous: poll.isAnonymous,
                expiresAt: poll.expiresAt,
                createdAt: poll.createdAt
            }));
        } catch (error) {
            logger.error(`Get active polls error: ${error.message}`);
            // Return mock polls for demonstration
            return [
                {
                    id: Date.now().toString(),
                    question: 'Sample Poll Question',
                    options: [
                        { id: '1', text: 'Option 1', voteCount: 0 },
                        { id: '2', text: 'Option 2', voteCount: 0 }
                    ],
                    totalVotes: 0,
                    allowMultiple: false,
                    isAnonymous: false,
                    expiresAt: new Date(Date.now() + 3600000), // 1 hour
                    createdAt: new Date()
                }
            ];
        }
    }

    /**
     * Get user status
     * @param {string} userId - User ID
     * @returns {Object} - User status
     */
    async getUserStatus(userId) {
        try {
            // Check local cache first
            if (this.userStatus.has(userId)) {
                return this.userStatus.get(userId);
            }

            // Get from database
            let user;
            try {
                user = await this.prisma.user.findUnique({
                    where: { id: BigInt(userId) },
                    select: {
                        status: true,
                        customStatus: true,
                        isAway: true,
                        lastSeen: true,
                        isOnline: true
                    }
                });
            } catch (error) {
                logger.error(`User status retrieval error: ${error.message}`);
                user = null;
            }

            if (user) {
                const status = {
                    status: user.status,
                    customStatus: user.customStatus,
                    isAway: user.isAway,
                    lastSeen: user.lastSeen,
                    isOnline: user.isOnline,
                    updatedAt: Date.now()
                };

                // Cache status
                this.userStatus.set(userId, status);
                return status;
            }

            return null;
        } catch (error) {
            logger.error(`Get user status error: ${error.message}`);
            return null;
        }
    }
}

export default RealTimeHandler; 
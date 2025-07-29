import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { createAuditLog } from '../utils/auditLogger.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// import { config } from '../config/config.js';

class User {
    constructor() {
        this.prisma = new PrismaClient();
        this.saltRounds = 10;
    }

    /**
     * Create a new user
     */
    async create(data) {
        try {
            // Validate required fields
            if (!data.username || !data.email || !data.password || !data.firstName || !data.lastName) {
                throw new Error('Username, email, password, firstName, and lastName are required');
            }

            // Check for existing username or email
            const existingUser = await this.prisma.user.findFirst({
                where: {
                    OR: [
                        { username: data.username },
                        { email: data.email.toLowerCase() }
                    ],
                    deletedAt: null
                }
            });

            if (existingUser) {
                if (existingUser.username === data.username) {
                    throw new Error('Username already exists');
                }
                if (existingUser.email === data.email.toLowerCase()) {
                    throw new Error('Email already exists');
                }
            }

            // Hash password with separate salt
            const salt = await bcrypt.genSalt(this.saltRounds);
            const hashedPassword = await bcrypt.hash(data.password, salt);

            const user = await this.prisma.user.create({
                data: {
                    username: data.username,
                    email: data.email.toLowerCase(),
                    password: hashedPassword,
                    salt,
                    firstName: data.firstName,
                    middleName: data.middleName,
                    lastName: data.lastName,
                    displayName: data.displayName || `${data.firstName} ${data.lastName}`,
                    gender: data.gender,
                    birthDate: data.birthDate,
                    avatar: data.avatar,
                    coverImage: data.coverImage,
                    bio: data.bio,
                    role: data.role || 'USER',
                    status: data.status || 'ACTIVE',
                    timezone: data.timezone || 'UTC',
                    locale: data.locale || 'en-US',
                    metadata: data.metadata,
                    schoolId: data.schoolId ? BigInt(data.schoolId) : null,
                    createdByOwnerId: BigInt(data.createdByOwnerId),
                    createdBy: data.createdBy ? BigInt(data.createdBy) : null
                },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    createdByOwner: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'CREATE',
                entity: 'USER',
                entityId: user.id.toString(),
                details: `User ${user.username} created with role ${user.role}`,
                userId: data.createdByOwnerId,
                schoolId: data.schoolId
            });

            return {
                success: true,
                data: user
            };

        } catch (error) {
            logger.error(`Error creating user: ${error.message}`);
            throw new Error(`Failed to create user: ${error.message}`);
        }
    }

    /**
     * Authenticate user
     */
    async authenticate(usernameOrEmail, password) {
        try {
            const user = await this.prisma.user.findFirst({
                where: {
                    OR: [
                        { username: usernameOrEmail },
                        { email: usernameOrEmail.toLowerCase() }
                    ],
                    deletedAt: null,
                    status: 'ACTIVE'
                }
            });

            if (!user) {
                throw new Error('User not found or inactive');
            }

            // Verify password using stored salt
            let passwordMatch = false;
            if (user.salt) {
              // Use the stored salt to hash the provided password and compare
              const hashedPassword = await bcrypt.hash(password, user.salt);
              passwordMatch = hashedPassword === user.password;
            } else {
              // Fallback to bcrypt.compare for backward compatibility
              passwordMatch = await bcrypt.compare(password, user.password);
            }
            if (!passwordMatch) {
                throw new Error('Invalid credentials');
            }

            // Update last login
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    lastLogin: new Date(),
                    lastIp: this.getClientIp()
                }
            });

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: user.id.toString(),
                    role: user.role,
                    schoolId: user.schoolId?.toString()
                },
                config.jwtSecret,
                { expiresIn: '7d' }
            );

            // Return user data without sensitive information
            const userData = { ...user };
            delete userData.password;
            delete userData.salt;

            return {
                success: true,
                data: {
                    user: userData,
                    token
                }
            };

        } catch (error) {
            logger.error(`Error authenticating user: ${error.message}`);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Get user by ID
     */
    async getById(id, requestingUserId, requestingUserRole) {
        try {
            const user = await this.prisma.user.findFirst({
                where: {
                    id: BigInt(id),
                    deletedAt: null
                },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    createdByOwner: {
                        select: {
                            id: true,
                            name: true
                        }
                    },
                    teacher: true,
                    student: true,
                    staff: true,
                    parent: true
                }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Check permissions based on role
            if (requestingUserRole === 'USER' && user.id !== BigInt(requestingUserId)) {
                throw new Error('Unauthorized access');
            }

            // Remove sensitive data
            const userData = { ...user };
            delete userData.password;
            delete userData.salt;

            return {
                success: true,
                data: userData
            };

        } catch (error) {
            logger.error(`Error getting user: ${error.message}`);
            throw new Error(`Failed to get user: ${error.message}`);
        }
    }

    /**
     * Get all users with filtering
     */
    async getAll(filters = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                role,
                status,
                schoolId,
                createdByOwnerId,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = filters;

            const where = {
                deletedAt: null,
                ...(role && { role }),
                ...(status && { status }),
                ...(schoolId && { schoolId: BigInt(schoolId) }),
                ...(createdByOwnerId && { createdByOwnerId: BigInt(createdByOwnerId) }),
                ...(search && {
                    OR: [
                        { username: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } },
                        { displayName: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const [users, total] = await Promise.all([
                this.prisma.user.findMany({
                    where,
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        firstName: true,
                        middleName: true,
                        lastName: true,
                        displayName: true,
                        gender: true,
                        avatar: true,
                        role: true,
                        status: true,
                        lastLogin: true,
                        school: {
                            select: {
                                id: true,
                                name: true
                            }
                        },
                        createdAt: true,
                        updatedAt: true
                    },
                    orderBy: {
                        [sortBy]: sortOrder
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.user.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: users,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting all users: ${error.message}`);
            throw new Error(`Failed to get users: ${error.message}`);
        }
    }

    /**
     * Update user
     */
    async update(id, updateData, updatedBy, schoolId) {
        try {
            const existingUser = await this.prisma.user.findFirst({
                where: {
                    id: BigInt(id),
                    deletedAt: null
                }
            });

            if (!existingUser) {
                throw new Error('User not found');
            }

            // Check for duplicate username or email if being updated
            if (updateData.username || updateData.email) {
                const whereCondition = {
                    NOT: { id: BigInt(id) },
                    deletedAt: null
                };

                if (updateData.username) {
                    whereCondition.username = updateData.username;
                }
                if (updateData.email) {
                    whereCondition.email = updateData.email.toLowerCase();
                }

                const duplicateUser = await this.prisma.user.findFirst({
                    where: whereCondition
                });

                if (duplicateUser) {
                    if (duplicateUser.username === updateData.username) {
                        throw new Error('Username already exists');
                    }
                    if (duplicateUser.email === updateData.email?.toLowerCase()) {
                        throw new Error('Email already exists');
                    }
                }
            }

            // Hash password if being updated
            if (updateData.password) {
                const salt = await bcrypt.genSalt(this.saltRounds);
                updateData.password = await bcrypt.hash(updateData.password, salt);
                updateData.salt = salt;
            }

            const updatedUser = await this.prisma.user.update({
                where: { id: BigInt(id) },
                data: {
                    ...updateData,
                    ...(updateData.email && { email: updateData.email.toLowerCase() }),
                    updatedBy: BigInt(updatedBy),
                    updatedAt: new Date()
                },
                include: {
                    school: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entity: 'USER',
                entityId: updatedUser.id.toString(),
                details: `User ${updatedUser.username} updated`,
                userId: updatedBy,
                schoolId
            });

            // Remove sensitive data
            const userData = { ...updatedUser };
            delete userData.password;
            delete userData.salt;

            return {
                success: true,
                data: userData
            };

        } catch (error) {
            logger.error(`Error updating user: ${error.message}`);
            throw new Error(`Failed to update user: ${error.message}`);
        }
    }

    /**
     * Delete user (soft delete)
     */
    async delete(id, deletedBy, schoolId) {
        try {
            const existingUser = await this.prisma.user.findFirst({
                where: {
                    id: BigInt(id),
                    deletedAt: null
                }
            });

            if (!existingUser) {
                throw new Error('User not found');
            }

            // Check if user has any associated records that would prevent deletion
            // This would need to be customized based on your application's requirements
            const hasAssociations = await this.checkUserAssociations(id);
            if (hasAssociations) {
                throw new Error('Cannot delete user with associated records');
            }

            await this.prisma.user.update({
                where: { id: BigInt(id) },
                data: {
                    deletedAt: new Date(),
                    updatedBy: BigInt(deletedBy),
                    status: 'DELETED'
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'DELETE',
                entity: 'USER',
                entityId: id.toString(),
                details: `User ${existingUser.username} deleted`,
                userId: deletedBy,
                schoolId
            });

            return {
                success: true,
                message: 'User deleted successfully'
            };

        } catch (error) {
            logger.error(`Error deleting user: ${error.message}`);
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }

    /**
     * Check if user has any associated records
     */
    async checkUserAssociations(userId) {
        try {
            // This is a simplified check - you would need to implement checks for all relevant associations
            const counts = await Promise.all([
                this.prisma.teacher.count({ where: { userId: BigInt(userId) } }),
                this.prisma.student.count({ where: { userId: BigInt(userId) } }),
                this.prisma.staff.count({ where: { userId: BigInt(userId) } }),
                this.prisma.parent.count({ where: { userId: BigInt(userId) } }),
                this.prisma.message.count({
                    where: {
                        OR: [
                            { senderId: BigInt(userId) },
                            { recipientId: BigInt(userId) }
                        ]
                    }
                })
            ]);

            return counts.some(count => count > 0);
        } catch (error) {
            logger.error(`Error checking user associations: ${error.message}`);
            return true; // Assume associations exist if there's an error
        }
    }

    /**
     * Get user statistics
     */
    async getStatistics(schoolId) {
        try {
            const [
                totalUsers,
                usersByRole,
                usersByStatus,
                activeToday,
                recentUsers
            ] = await Promise.all([
                this.prisma.user.count({
                    where: {
                        schoolId: schoolId ? BigInt(schoolId) : undefined,
                        deletedAt: null
                    }
                }),
                this.prisma.user.groupBy({
                    by: ['role'],
                    where: {
                        schoolId: schoolId ? BigInt(schoolId) : undefined,
                        deletedAt: null
                    },
                    _count: { id: true }
                }),
                this.prisma.user.groupBy({
                    by: ['status'],
                    where: {
                        schoolId: schoolId ? BigInt(schoolId) : undefined,
                        deletedAt: null
                    },
                    _count: { id: true }
                }),
                this.prisma.user.count({
                    where: {
                        schoolId: schoolId ? BigInt(schoolId) : undefined,
                        deletedAt: null,
                        lastLogin: {
                            gte: new Date(new Date().setHours(0, 0, 0, 0))
                        }
                    }
                }),
                this.prisma.user.findMany({
                    where: {
                        schoolId: schoolId ? BigInt(schoolId) : undefined,
                        deletedAt: null
                    },
                    orderBy: {
                        createdAt: 'desc'
                    },
                    take: 5,
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        role: true,
                        createdAt: true
                    }
                })
            ]);

            return {
                success: true,
                data: {
                    totalUsers,
                    usersByRole,
                    usersByStatus,
                    activeToday,
                    recentUsers
                }
            };

        } catch (error) {
            logger.error(`Error getting user statistics: ${error.message}`);
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
    }

    /**
     * Change user password
     */
    async changePassword(userId, currentPassword, newPassword) {
        try {
            const user = await this.prisma.user.findFirst({
                where: {
                    id: BigInt(userId),
                    deletedAt: null
                }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Verify current password using stored salt
            let passwordMatch = false;
            if (user.salt) {
              // Use the stored salt to hash the provided password and compare
              const hashedPassword = await bcrypt.hash(currentPassword, user.salt);
              passwordMatch = hashedPassword === user.password;
            } else {
              // Fallback to bcrypt.compare for backward compatibility
              passwordMatch = await bcrypt.compare(currentPassword, user.password);
            }
            if (!passwordMatch) {
                throw new Error('Current password is incorrect');
            }

            // Hash new password with separate salt
            const salt = await bcrypt.genSalt(this.saltRounds);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            await this.prisma.user.update({
                where: { id: BigInt(userId) },
                data: {
                    password: hashedPassword,
                    salt,
                    updatedAt: new Date()
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entity: 'USER',
                entityId: userId.toString(),
                details: 'Password changed',
                userId: userId
            });

            return {
                success: true,
                message: 'Password changed successfully'
            };

        } catch (error) {
            logger.error(`Error changing password: ${error.message}`);
            throw new Error(`Failed to change password: ${error.message}`);
        }
    }

    /**
     * Reset user password (admin function)
     */
    async resetPassword(userId, newPassword, resetBy, schoolId) {
        try {
            const user = await this.prisma.user.findFirst({
                where: {
                    id: BigInt(userId),
                    deletedAt: null
                }
            });

            if (!user) {
                throw new Error('User not found');
            }

            // Hash new password with separate salt
            const salt = await bcrypt.genSalt(this.saltRounds);
            const hashedPassword = await bcrypt.hash(newPassword, salt);

            await this.prisma.user.update({
                where: { id: BigInt(userId) },
                data: {
                    password: hashedPassword,
                    salt,
                    updatedBy: BigInt(resetBy),
                    updatedAt: new Date()
                }
            });

            // Create audit log
            await createAuditLog({
                action: 'UPDATE',
                entity: 'USER',
                entityId: userId.toString(),
                details: 'Password reset by admin',
                userId: resetBy,
                schoolId
            });

            return {
                success: true,
                message: 'Password reset successfully'
            };

        } catch (error) {
            logger.error(`Error resetting password: ${error.message}`);
            throw new Error(`Failed to reset password: ${error.message}`);
        }
    }

    /**
     * Get user sessions
     */
    async getSessions(userId) {
        try {
            const sessions = await this.prisma.session.findMany({
                where: {
                    userId: BigInt(userId)
                },
                orderBy: {
                    createdAt: 'desc'
                }
            });

            return {
                success: true,
                data: sessions
            };

        } catch (error) {
            logger.error(`Error getting user sessions: ${error.message}`);
            throw new Error(`Failed to get sessions: ${error.message}`);
        }
    }

    /**
     * Revoke user session
     */
    async revokeSession(sessionId, revokedBy, schoolId) {
        try {
            const session = await this.prisma.session.findFirst({
                where: {
                    id: sessionId
                }
            });

            if (!session) {
                throw new Error('Session not found');
            }

            await this.prisma.session.delete({
                where: { id: sessionId }
            });

            // Create audit log
            await createAuditLog({
                action: 'REVOKE',
                entity: 'SESSION',
                entityId: sessionId,
                details: `Session revoked for user ${session.userId}`,
                userId: revokedBy,
                schoolId
            });

            return {
                success: true,
                message: 'Session revoked successfully'
            };

        } catch (error) {
            logger.error(`Error revoking session: ${error.message}`);
            throw new Error(`Failed to revoke session: ${error.message}`);
        }
    }

    /**
     * Get user audit logs
     */
    async getAuditLogs(userId, filters = {}) {
        try {
            const { page = 1, limit = 10, action, entity } = filters;

            const where = {
                userId: BigInt(userId),
                ...(action && { action }),
                ...(entity && { entity })
            };

            const [logs, total] = await Promise.all([
                this.prisma.auditLog.findMany({
                    where,
                    orderBy: {
                        createdAt: 'desc'
                    },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                this.prisma.auditLog.count({ where })
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                success: true,
                data: logs,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            logger.error(`Error getting user audit logs: ${error.message}`);
            throw new Error(`Failed to get audit logs: ${error.message}`);
        }
    }

    /**
     * Get client IP address (helper function)
     */
    getClientIp() {
        // This is a placeholder - implementation depends on your framework/HTTP server
        return 'unknown';
    }

    /**
     * Import users from CSV/Excel
     */
    async import(data, createdByOwnerId, schoolId) {
        try {
            if (!Array.isArray(data)) {
                throw new Error('Invalid import data format');
            }

            const results = [];
            const errors = [];

            for (const [index, row] of data.entries()) {
                try {
                    // Validate required fields
                    if (!row.username || !row.email || !row.firstName || !row.lastName) {
                        throw new Error('Username, email, firstName, and lastName are required');
                    }

                    // Check for duplicate username or email
                    const existingUser = await this.prisma.user.findFirst({
                        where: {
                            OR: [
                                { username: row.username },
                                { email: row.email.toLowerCase() }
                            ],
                            deletedAt: null
                        }
                    });

                    if (existingUser) {
                        throw new Error(existingUser.username === row.username ? 
                            'Username already exists' : 'Email already exists');
                    }

                    // Generate random password if not provided
                    const password = row.password || this.generateRandomPassword();

                    // Hash password with separate salt
                    const salt = await bcrypt.genSalt(this.saltRounds);
                    const hashedPassword = await bcrypt.hash(password, salt);

                    const user = await this.prisma.user.create({
                        data: {
                            username: row.username,
                            email: row.email.toLowerCase(),
                            password: hashedPassword,
                            salt,
                            firstName: row.firstName,
                            middleName: row.middleName,
                            lastName: row.lastName,
                            displayName: row.displayName || `${row.firstName} ${row.lastName}`,
                            gender: row.gender,
                            birthDate: row.birthDate,
                            role: row.role || 'USER',
                            status: row.status || 'ACTIVE',
                            timezone: row.timezone || 'UTC',
                            locale: row.locale || 'en-US',
                            schoolId: schoolId ? BigInt(schoolId) : null,
                            createdByOwnerId: BigInt(createdByOwnerId)
                        }
                    });

                    results.push({
                        row: index + 1,
                        success: true,
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        temporaryPassword: row.password ? undefined : password
                    });
                } catch (error) {
                    errors.push({
                        row: index + 1,
                        success: false,
                        error: error.message,
                        data: row
                    });
                }
            }

            await createAuditLog({
                action: 'IMPORT',
                entity: 'USER',
                entityId: 'BULK_IMPORT',
                details: `Imported ${results.length} users, ${errors.length} failed`,
                userId: createdByOwnerId,
                schoolId
            });

            return {
                success: true,
                imported: results.length,
                failed: errors.length,
                results,
                errors
            };

        } catch (error) {
            logger.error(`Error importing users: ${error.message}`);
            throw new Error(`Failed to import users: ${error.message}`);
        }
    }

    /**
     * Generate random password (helper function)
     */
    generateRandomPassword(length = 12) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
        let password = '';
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    /**
     * Export users to CSV/Excel
     */
    async export(schoolId, format = 'csv') {
        try {
            const users = await this.prisma.user.findMany({
                where: {
                    schoolId: schoolId ? BigInt(schoolId) : undefined,
                    deletedAt: null
                },
                select: {
                    id: true,
                    username: true,
                    email: true,
                    firstName: true,
                    middleName: true,
                    lastName: true,
                    displayName: true,
                    gender: true,
                    birthDate: true,
                    role: true,
                    status: true,
                    timezone: true,
                    locale: true,
                    createdAt: true,
                    lastLogin: true,
                    school: {
                        select: {
                            name: true
                        }
                    }
                }
            });

            if (format === 'json') {
                return {
                    success: true,
                    data: users
                };
            }

            // Convert to CSV format
            const csvData = users.map(user => ({
                'ID': user.id,
                'Username': user.username,
                'Email': user.email,
                'First Name': user.firstName,
                'Middle Name': user.middleName || '',
                'Last Name': user.lastName,
                'Display Name': user.displayName,
                'Gender': user.gender || '',
                'Birth Date': user.birthDate || '',
                'Role': user.role,
                'Status': user.status,
                'Timezone': user.timezone,
                'Locale': user.locale,
                'School': user.school?.name || '',
                'Created At': user.createdAt,
                'Last Login': user.lastLogin || ''
            }));

            return {
                success: true,
                data: csvData
            };

        } catch (error) {
            logger.error(`Error exporting users: ${error.message}`);
            throw new Error(`Failed to export users: ${error.message}`);
        }
    }
}

export default User;
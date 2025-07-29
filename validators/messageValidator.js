/**
 * Message Validator
 * Validates message data for creation and updates with advanced role-based features
 */

export const validateMessage = (data, isUpdate = false) => {
    const errors = [];

    // Required fields for creation
    if (!isUpdate) {
        if (!data.senderId) {
            errors.push('Sender ID is required');
        }

        if (!data.receiverId && !data.receiverIds) {
            errors.push('Receiver ID or Receiver IDs are required');
        }

        if (!data.content || data.content.trim().length === 0) {
            errors.push('Content is required');
        }
    }

    // Validate sender ID
    if (data.senderId !== undefined) {
        if (!Number.isInteger(parseInt(data.senderId)) || parseInt(data.senderId) <= 0) {
            errors.push('Invalid sender ID');
        }
    }

    // Validate receiver ID (for direct messages)
    if (data.receiverId !== undefined) {
        if (!Number.isInteger(parseInt(data.receiverId)) || parseInt(data.receiverId) <= 0) {
            errors.push('Invalid receiver ID');
        }
    }

    // Validate receiver IDs (for group messages)
    if (data.receiverIds !== undefined) {
        if (!Array.isArray(data.receiverIds) || data.receiverIds.length === 0) {
            errors.push('Receiver IDs must be a non-empty array');
        } else {
            for (const id of data.receiverIds) {
                if (!Number.isInteger(parseInt(id)) || parseInt(id) <= 0) {
                    errors.push(`Invalid receiver ID: ${id}`);
                }
            }
        }
    }

    // Validate that sender and receiver are different (for direct messages)
    if (data.senderId && data.receiverId && data.senderId === data.receiverId) {
        errors.push('Sender and receiver cannot be the same');
    }

    // Validate subject
    if (data.subject !== undefined && data.subject !== null) {
        if (data.subject.length > 255) {
            errors.push('Subject cannot exceed 255 characters');
        }
    }

    // Validate content
    if (data.content !== undefined) {
        if (data.content.trim().length === 0) {
            errors.push('Content cannot be empty');
        } else if (data.content.length > 10000) {
            errors.push('Content cannot exceed 10,000 characters');
        }
    }

    // Validate school ID
    if (data.schoolId !== undefined) {
        if (!Number.isInteger(parseInt(data.schoolId)) || parseInt(data.schoolId) <= 0) {
            errors.push('Invalid school ID');
        }
    }

    // Validate message type
    if (data.type !== undefined) {
        const validTypes = [
            'DIRECT',
            'GROUP',
            'BROADCAST',
            'ANNOUNCEMENT',
            'ADMINISTRATIVE',
            'ACADEMIC',
            'PARENT_TEACHER',
            'SYSTEM'
        ];
        if (!validTypes.includes(data.type)) {
            errors.push(`Invalid message type. Must be one of: ${validTypes.join(', ')}`);
        }
    }

    // Validate message category
    if (data.category !== undefined) {
        const validCategories = [
            'GENERAL',
            'ACADEMIC',
            'ADMINISTRATIVE',
            'FINANCIAL',
            'ATTENDANCE',
            'EXAM',
            'HOMEWORK',
            'EVENT',
            'EMERGENCY',
            'REMINDER',
            'ANNOUNCEMENT',
            'PARENT_TEACHER',
            'SYSTEM'
        ];
        if (!validCategories.includes(data.category)) {
            errors.push(`Invalid message category. Must be one of: ${validCategories.join(', ')}`);
        }
    }

    // Validate message priority
    if (data.priority !== undefined) {
        const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
        if (!validPriorities.includes(data.priority)) {
            errors.push(`Invalid message priority. Must be one of: ${validPriorities.join(', ')}`);
        }
    }

    // Validate boolean fields
    if (data.isRead !== undefined && typeof data.isRead !== 'boolean') {
        errors.push('isRead must be a boolean value');
    }

    // Validate metadata
    if (data.metadata !== undefined && typeof data.metadata !== 'object') {
        errors.push('Metadata must be an object');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate group message data
 */
export const validateGroupMessage = (data) => {
    const errors = [];

    // Required fields
    if (!data.senderId) {
        errors.push('Sender ID is required');
    }

    if (!data.receiverIds || !Array.isArray(data.receiverIds) || data.receiverIds.length === 0) {
        errors.push('Receiver IDs array is required and cannot be empty');
    }

    if (!data.content || data.content.trim().length === 0) {
        errors.push('Content is required');
    }

    if (!data.schoolId) {
        errors.push('School ID is required');
    }

    // Validate sender ID
    if (!Number.isInteger(parseInt(data.senderId)) || parseInt(data.senderId) <= 0) {
        errors.push('Invalid sender ID');
    }

    // Validate receiver IDs
    for (const id of data.receiverIds) {
        if (!Number.isInteger(parseInt(id)) || parseInt(id) <= 0) {
            errors.push(`Invalid receiver ID: ${id}`);
        }
    }

    // Validate content length
    if (data.content.length > 10000) {
        errors.push('Content cannot exceed 10,000 characters');
    }

    // Validate subject length
    if (data.subject && data.subject.length > 255) {
        errors.push('Subject cannot exceed 255 characters');
    }

    // Validate school ID
    if (!Number.isInteger(parseInt(data.schoolId)) || parseInt(data.schoolId) <= 0) {
        errors.push('Invalid school ID');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate role broadcast message data
 */
export const validateRoleBroadcast = (data) => {
    const errors = [];

    // Required fields
    if (!data.senderId) {
        errors.push('Sender ID is required');
    }

    if (!data.targetRoles || !Array.isArray(data.targetRoles) || data.targetRoles.length === 0) {
        errors.push('Target roles array is required and cannot be empty');
    }

    if (!data.content || data.content.trim().length === 0) {
        errors.push('Content is required');
    }

    if (!data.schoolId) {
        errors.push('School ID is required');
    }

    // Validate sender ID
    if (!Number.isInteger(parseInt(data.senderId)) || parseInt(data.senderId) <= 0) {
        errors.push('Invalid sender ID');
    }

    // Validate target roles
    const validRoles = ['OWNER', 'ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'];
    for (const role of data.targetRoles) {
        if (!validRoles.includes(role)) {
            errors.push(`Invalid target role: ${role}. Must be one of: ${validRoles.join(', ')}`);
        }
    }

    // Validate content length
    if (data.content.length > 10000) {
        errors.push('Content cannot exceed 10,000 characters');
    }

    // Validate subject length
    if (data.subject && data.subject.length > 255) {
        errors.push('Subject cannot exceed 255 characters');
    }

    // Validate school ID
    if (!Number.isInteger(parseInt(data.schoolId)) || parseInt(data.schoolId) <= 0) {
        errors.push('Invalid school ID');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate message filters
 */
export const validateMessageFilters = (filters) => {
    const errors = [];

    // Validate pagination
    if (filters.page !== undefined) {
        const page = parseInt(filters.page);
        if (isNaN(page) || page < 1) {
            errors.push('Page must be a positive integer');
        }
    }

    if (filters.limit !== undefined) {
        const limit = parseInt(filters.limit);
        if (isNaN(limit) || limit < 1 || limit > 100) {
            errors.push('Limit must be between 1 and 100');
        }
    }

    // Validate user ID filters
    if (filters.senderId !== undefined) {
        if (!Number.isInteger(parseInt(filters.senderId)) || parseInt(filters.senderId) <= 0) {
            errors.push('Invalid sender ID filter');
        }
    }

    if (filters.receiverId !== undefined) {
        if (!Number.isInteger(parseInt(filters.receiverId)) || parseInt(filters.receiverId) <= 0) {
            errors.push('Invalid receiver ID filter');
        }
    }

    // Validate role filters
    if (filters.senderRole !== undefined) {
        const validRoles = ['OWNER', 'ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'];
        if (!validRoles.includes(filters.senderRole)) {
            errors.push(`Invalid sender role filter. Must be one of: ${validRoles.join(', ')}`);
        }
    }

    if (filters.receiverRole !== undefined) {
        const validRoles = ['OWNER', 'ADMIN', 'TEACHER', 'STAFF', 'PARENT', 'STUDENT'];
        if (!validRoles.includes(filters.receiverRole)) {
            errors.push(`Invalid receiver role filter. Must be one of: ${validRoles.join(', ')}`);
        }
    }

    // Validate message type filter
    if (filters.messageType !== undefined) {
        const validTypes = [
            'DIRECT',
            'GROUP',
            'BROADCAST',
            'ANNOUNCEMENT',
            'ADMINISTRATIVE',
            'ACADEMIC',
            'PARENT_TEACHER',
            'SYSTEM'
        ];
        if (!validTypes.includes(filters.messageType)) {
            errors.push(`Invalid message type filter. Must be one of: ${validTypes.join(', ')}`);
        }
    }

    // Validate message category filter
    if (filters.category !== undefined) {
        const validCategories = [
            'GENERAL',
            'ACADEMIC',
            'ADMINISTRATIVE',
            'FINANCIAL',
            'ATTENDANCE',
            'EXAM',
            'HOMEWORK',
            'EVENT',
            'EMERGENCY',
            'REMINDER',
            'ANNOUNCEMENT',
            'PARENT_TEACHER',
            'SYSTEM'
        ];
        if (!validCategories.includes(filters.category)) {
            errors.push(`Invalid message category filter. Must be one of: ${validCategories.join(', ')}`);
        }
    }

    // Validate message priority filter
    if (filters.priority !== undefined) {
        const validPriorities = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
        if (!validPriorities.includes(filters.priority)) {
            errors.push(`Invalid message priority filter. Must be one of: ${validPriorities.join(', ')}`);
        }
    }

    // Validate sort fields
    if (filters.sortBy !== undefined) {
        const validSortFields = [
            'id',
            'subject',
            'isRead',
            'type',
            'category',
            'priority',
            'createdAt',
            'updatedAt'
        ];
        if (!validSortFields.includes(filters.sortBy)) {
            errors.push('Invalid sort field');
        }
    }

    if (filters.sortOrder !== undefined) {
        const validSortOrders = ['asc', 'desc'];
        if (!validSortOrders.includes(filters.sortOrder.toLowerCase())) {
            errors.push('Sort order must be asc or desc');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate message search parameters
 */
export const validateMessageSearch = (searchTerm, filters = {}) => {
    const errors = [];

    // Validate search term
    if (!searchTerm || searchTerm.trim().length === 0) {
        errors.push('Search term is required');
    } else if (searchTerm.length < 2) {
        errors.push('Search term must be at least 2 characters long');
    } else if (searchTerm.length > 100) {
        errors.push('Search term cannot exceed 100 characters');
    }

    // Validate limit
    if (filters.limit !== undefined) {
        const limit = parseInt(filters.limit);
        if (isNaN(limit) || limit < 1 || limit > 50) {
            errors.push('Search limit must be between 1 and 50');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate conversation parameters
 */
export const validateConversationParams = (userId1, userId2, filters = {}) => {
    const errors = [];

    // Validate user IDs
    if (!userId1 || !Number.isInteger(parseInt(userId1)) || parseInt(userId1) <= 0) {
        errors.push('Invalid first user ID');
    }

    if (!userId2 || !Number.isInteger(parseInt(userId2)) || parseInt(userId2) <= 0) {
        errors.push('Invalid second user ID');
    }

    // Validate that users are different
    if (userId1 === userId2) {
        errors.push('User IDs must be different');
    }

    // Validate pagination
    if (filters.page !== undefined) {
        const page = parseInt(filters.page);
        if (isNaN(page) || page < 1) {
            errors.push('Page must be a positive integer');
        }
    }

    if (filters.limit !== undefined) {
        const limit = parseInt(filters.limit);
        if (isNaN(limit) || limit < 1 || limit > 100) {
            errors.push('Limit must be between 1 and 100');
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate bulk operations
 */
export const validateBulkOperations = (messageIds, userId) => {
    const errors = [];

    // Validate message IDs array
    if (!Array.isArray(messageIds) || messageIds.length === 0) {
        errors.push('Message IDs array is required and cannot be empty');
    } else {
        for (const id of messageIds) {
            if (!Number.isInteger(parseInt(id)) || parseInt(id) <= 0) {
                errors.push(`Invalid message ID: ${id}`);
            }
        }
    }

    // Validate user ID
    if (!userId || !Number.isInteger(parseInt(userId)) || parseInt(userId) <= 0) {
        errors.push('Invalid user ID');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate role-based messaging permissions
 */
export const validateRoleBasedPermissions = (senderRole, receiverRole, messageType) => {
    const roleHierarchy = {
        'OWNER': 5,
        'ADMIN': 4,
        'TEACHER': 3,
        'STAFF': 2,
        'PARENT': 1,
        'STUDENT': 0
    };

    // Special permissions for different message types
    switch (messageType) {
        case 'ANNOUNCEMENT':
            return ['OWNER', 'ADMIN'].includes(senderRole);
        
        case 'ADMINISTRATIVE':
            if (senderRole === 'OWNER' && receiverRole === 'ADMIN') return true;
            if (senderRole === 'ADMIN' && ['TEACHER', 'STAFF'].includes(receiverRole)) return true;
            return false;
        
        case 'ACADEMIC':
            if (senderRole === 'TEACHER' && ['STUDENT', 'PARENT'].includes(receiverRole)) return true;
            if (senderRole === 'ADMIN' && ['TEACHER', 'STUDENT', 'PARENT'].includes(receiverRole)) return true;
            if (senderRole === 'OWNER') return true;
            return false;
        
        case 'PARENT_TEACHER':
            if (senderRole === 'PARENT' && receiverRole === 'TEACHER') return true;
            if (senderRole === 'TEACHER' && receiverRole === 'PARENT') return true;
            return false;
        
        case 'DIRECT':
        default:
            return roleHierarchy[senderRole] >= roleHierarchy[receiverRole];
    }
};
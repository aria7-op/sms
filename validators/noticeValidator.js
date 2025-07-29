/**
 * Notice Validator
 * Validates notice data for creation and updates
 */

export const validateNotice = (data, isUpdate = false) => {
    const errors = [];

    // Required fields for creation
    if (!isUpdate) {
        if (!data.title || data.title.trim().length === 0) {
            errors.push('Title is required');
        }

        if (!data.content || data.content.trim().length === 0) {
            errors.push('Content is required');
        }

        if (!data.startDate) {
            errors.push('Start date is required');
        }

        if (!data.endDate) {
            errors.push('End date is required');
        }

        if (!data.schoolId) {
            errors.push('School ID is required');
        }

        if (!data.createdBy) {
            errors.push('Created by user ID is required');
        }
    }

    // Validate title
    if (data.title !== undefined) {
        if (data.title.trim().length === 0) {
            errors.push('Title cannot be empty');
        } else if (data.title.length > 255) {
            errors.push('Title cannot exceed 255 characters');
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

    // Validate dates
    if (data.startDate && data.endDate) {
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);

        if (isNaN(startDate.getTime())) {
            errors.push('Invalid start date format');
        }

        if (isNaN(endDate.getTime())) {
            errors.push('Invalid end date format');
        }

        if (startDate >= endDate) {
            errors.push('End date must be after start date');
        }
    }

    // Validate priority
    if (data.priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(data.priority.toLowerCase())) {
            errors.push('Priority must be one of: low, medium, high');
        }
    }

    // Validate target roles
    if (data.targetRoles !== undefined) {
        if (!Array.isArray(data.targetRoles)) {
            errors.push('Target roles must be an array');
        } else {
            const validRoles = [
                'SUPER_ADMIN',
                'SCHOOL_ADMIN',
                'TEACHER',
                'STUDENT',
                'STAFF',
                'PARENT',
                'ACCOUNTANT',
                'LIBRARIAN'
            ];

            for (const role of data.targetRoles) {
                if (!validRoles.includes(role)) {
                    errors.push(`Invalid target role: ${role}`);
                }
            }
        }
    }

    // Validate class IDs
    if (data.classIds !== undefined) {
        if (!Array.isArray(data.classIds)) {
            errors.push('Class IDs must be an array');
        } else {
            for (const classId of data.classIds) {
                if (!Number.isInteger(parseInt(classId)) || parseInt(classId) <= 0) {
                    errors.push(`Invalid class ID: ${classId}`);
                }
            }
        }
    }

    // Validate school ID
    if (data.schoolId !== undefined) {
        if (!Number.isInteger(parseInt(data.schoolId)) || parseInt(data.schoolId) <= 0) {
            errors.push('Invalid school ID');
        }
    }

    // Validate user IDs
    if (data.createdBy !== undefined) {
        if (!Number.isInteger(parseInt(data.createdBy)) || parseInt(data.createdBy) <= 0) {
            errors.push('Invalid created by user ID');
        }
    }

    if (data.updatedBy !== undefined) {
        if (!Number.isInteger(parseInt(data.updatedBy)) || parseInt(data.updatedBy) <= 0) {
            errors.push('Invalid updated by user ID');
        }
    }

    // Validate boolean fields
    if (data.isPublished !== undefined && typeof data.isPublished !== 'boolean') {
        errors.push('isPublished must be a boolean value');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};

/**
 * Validate notice filters
 */
export const validateNoticeFilters = (filters) => {
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

    // Validate priority filter
    if (filters.priority !== undefined) {
        const validPriorities = ['low', 'medium', 'high'];
        if (!validPriorities.includes(filters.priority.toLowerCase())) {
            errors.push('Invalid priority filter');
        }
    }

    // Validate target role filter
    if (filters.targetRole !== undefined) {
        const validRoles = [
            'SUPER_ADMIN',
            'SCHOOL_ADMIN',
            'TEACHER',
            'STUDENT',
            'STAFF',
            'PARENT',
            'ACCOUNTANT',
            'LIBRARIAN'
        ];
        if (!validRoles.includes(filters.targetRole)) {
            errors.push('Invalid target role filter');
        }
    }

    // Validate class ID filter
    if (filters.classId !== undefined) {
        if (!Number.isInteger(parseInt(filters.classId)) || parseInt(filters.classId) <= 0) {
            errors.push('Invalid class ID filter');
        }
    }

    // Validate date filters
    if (filters.startDate !== undefined) {
        const startDate = new Date(filters.startDate);
        if (isNaN(startDate.getTime())) {
            errors.push('Invalid start date filter');
        }
    }

    if (filters.endDate !== undefined) {
        const endDate = new Date(filters.endDate);
        if (isNaN(endDate.getTime())) {
            errors.push('Invalid end date filter');
        }
    }

    // Validate sort fields
    if (filters.sortBy !== undefined) {
        const validSortFields = [
            'id',
            'title',
            'startDate',
            'endDate',
            'priority',
            'isPublished',
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
 * Validate notice search parameters
 */
export const validateNoticeSearch = (searchTerm, filters = {}) => {
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
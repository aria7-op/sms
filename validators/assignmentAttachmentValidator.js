import Joi from 'joi';
import logger from '../config/logger.js';

class AssignmentAttachmentValidator {
    /**
     * Validate create attachment data
     */
    static validateCreate(data) {
        const schema = Joi.object({
            assignmentId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'Assignment ID must be a number',
                    'number.integer': 'Assignment ID must be an integer',
                    'number.positive': 'Assignment ID must be positive',
                    'any.required': 'Assignment ID is required'
                }),
            name: Joi.string().trim().min(1).max(255).required()
                .messages({
                    'string.empty': 'File name cannot be empty',
                    'string.min': 'File name must be at least 1 character long',
                    'string.max': 'File name cannot exceed 255 characters',
                    'any.required': 'File name is required'
                }),
            path: Joi.string().trim().min(1).max(500).required()
                .messages({
                    'string.empty': 'File path cannot be empty',
                    'string.min': 'File path must be at least 1 character long',
                    'string.max': 'File path cannot exceed 500 characters',
                    'any.required': 'File path is required'
                }),
            mimeType: Joi.string().trim().min(1).max(100).required()
                .messages({
                    'string.empty': 'MIME type cannot be empty',
                    'string.min': 'MIME type must be at least 1 character long',
                    'string.max': 'MIME type cannot exceed 100 characters',
                    'any.required': 'MIME type is required'
                }),
            size: Joi.number().integer().min(0).max(100 * 1024 * 1024) // 100MB max
                .messages({
                    'number.base': 'File size must be a number',
                    'number.integer': 'File size must be an integer',
                    'number.min': 'File size cannot be negative',
                    'number.max': 'File size cannot exceed 100MB'
                }),
            schoolId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'School ID must be a number',
                    'number.integer': 'School ID must be an integer',
                    'number.positive': 'School ID must be positive',
                    'any.required': 'School ID is required'
                })
        });

        return schema.validate(data);
    }

    /**
     * Validate update attachment data
     */
    static validateUpdate(data) {
        const schema = Joi.object({
            name: Joi.string().trim().min(1).max(255)
                .messages({
                    'string.empty': 'File name cannot be empty',
                    'string.min': 'File name must be at least 1 character long',
                    'string.max': 'File name cannot exceed 255 characters'
                }),
            path: Joi.string().trim().min(1).max(500)
                .messages({
                    'string.empty': 'File path cannot be empty',
                    'string.min': 'File path must be at least 1 character long',
                    'string.max': 'File path cannot exceed 500 characters'
                }),
            mimeType: Joi.string().trim().min(1).max(100)
                .messages({
                    'string.empty': 'MIME type cannot be empty',
                    'string.min': 'MIME type must be at least 1 character long',
                    'string.max': 'MIME type cannot exceed 100 characters'
                }),
            size: Joi.number().integer().min(0).max(100 * 1024 * 1024) // 100MB max
                .messages({
                    'number.base': 'File size must be a number',
                    'number.integer': 'File size must be an integer',
                    'number.min': 'File size cannot be negative',
                    'number.max': 'File size cannot exceed 100MB'
                })
        }).min(1); // At least one field must be provided

        return schema.validate(data);
    }

    /**
     * Validate file upload data
     */
    static validateFileUpload(data) {
        const schema = Joi.object({
            assignmentId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'Assignment ID must be a number',
                    'number.integer': 'Assignment ID must be an integer',
                    'number.positive': 'Assignment ID must be positive',
                    'any.required': 'Assignment ID is required'
                }),
            schoolId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'School ID must be a number',
                    'number.integer': 'School ID must be an integer',
                    'number.positive': 'School ID must be positive',
                    'any.required': 'School ID is required'
                }),
            file: Joi.object({
                originalname: Joi.string().required(),
                mimetype: Joi.string().required(),
                size: Joi.number().integer().min(1).max(100 * 1024 * 1024).required() // 100MB max
            }).required()
                .messages({
                    'object.base': 'File object is required',
                    'any.required': 'File is required'
                })
        });

        return schema.validate(data);
    }

    /**
     * Validate bulk operations
     */
    static validateBulkDelete(data) {
        const schema = Joi.object({
            attachmentIds: Joi.array().items(
                Joi.number().integer().positive()
            ).min(1).max(100).required()
                .messages({
                    'array.base': 'Attachment IDs must be an array',
                    'array.min': 'At least one attachment ID is required',
                    'array.max': 'Cannot delete more than 100 attachments at once',
                    'any.required': 'Attachment IDs are required'
                })
        });

        return schema.validate(data);
    }

    /**
     * Validate search parameters
     */
    static validateSearch(filters) {
        const schema = Joi.object({
            searchTerm: Joi.string().trim().min(1).max(100)
                .messages({
                    'string.empty': 'Search term cannot be empty',
                    'string.min': 'Search term must be at least 1 character long',
                    'string.max': 'Search term cannot exceed 100 characters'
                }),
            assignmentId: Joi.number().integer().positive()
                .messages({
                    'number.base': 'Assignment ID must be a number',
                    'number.integer': 'Assignment ID must be an integer',
                    'number.positive': 'Assignment ID must be positive'
                }),
            mimeType: Joi.string().trim().min(1).max(100)
                .messages({
                    'string.empty': 'MIME type cannot be empty',
                    'string.min': 'MIME type must be at least 1 character long',
                    'string.max': 'MIME type cannot exceed 100 characters'
                }),
            minSize: Joi.number().integer().min(0)
                .messages({
                    'number.base': 'Minimum size must be a number',
                    'number.integer': 'Minimum size must be an integer',
                    'number.min': 'Minimum size cannot be negative'
                }),
            maxSize: Joi.number().integer().min(0)
                .messages({
                    'number.base': 'Maximum size must be a number',
                    'number.integer': 'Maximum size must be an integer',
                    'number.min': 'Maximum size cannot be negative'
                }),
            startDate: Joi.date().iso()
                .messages({
                    'date.base': 'Start date must be a valid date',
                    'date.format': 'Start date must be in ISO format'
                }),
            endDate: Joi.date().iso().min(Joi.ref('startDate'))
                .messages({
                    'date.base': 'End date must be a valid date',
                    'date.format': 'End date must be in ISO format',
                    'date.min': 'End date must be after start date'
                }),
            page: Joi.number().integer().min(1).default(1)
                .messages({
                    'number.base': 'Page must be a number',
                    'number.integer': 'Page must be an integer',
                    'number.min': 'Page must be at least 1'
                }),
            limit: Joi.number().integer().min(1).max(100).default(10)
                .messages({
                    'number.base': 'Limit must be a number',
                    'number.integer': 'Limit must be an integer',
                    'number.min': 'Limit must be at least 1',
                    'number.max': 'Limit cannot exceed 100'
                }),
            sortBy: Joi.string().valid('name', 'size', 'mimeType', 'createdAt', 'updatedAt').default('createdAt')
                .messages({
                    'string.base': 'Sort by must be a string',
                    'any.only': 'Sort by must be one of: name, size, mimeType, createdAt, updatedAt'
                }),
            sortOrder: Joi.string().valid('asc', 'desc').default('desc')
                .messages({
                    'string.base': 'Sort order must be a string',
                    'any.only': 'Sort order must be either asc or desc'
                })
        });

        return schema.validate(filters);
    }

    /**
     * Validate statistics parameters
     */
    static validateStatistics(filters) {
        const schema = Joi.object({
            startDate: Joi.date().iso()
                .messages({
                    'date.base': 'Start date must be a valid date',
                    'date.format': 'Start date must be in ISO format'
                }),
            endDate: Joi.date().iso().min(Joi.ref('startDate'))
                .messages({
                    'date.base': 'End date must be a valid date',
                    'date.format': 'End date must be in ISO format',
                    'date.min': 'End date must be after start date'
                }),
            assignmentId: Joi.number().integer().positive()
                .messages({
                    'number.base': 'Assignment ID must be a number',
                    'number.integer': 'Assignment ID must be an integer',
                    'number.positive': 'Assignment ID must be positive'
                }),
            mimeType: Joi.string().trim().min(1).max(100)
                .messages({
                    'string.empty': 'MIME type cannot be empty',
                    'string.min': 'MIME type must be at least 1 character long',
                    'string.max': 'MIME type cannot exceed 100 characters'
                }),
            groupBy: Joi.string().valid('day', 'week', 'month', 'year', 'mimeType', 'assignment').default('month')
                .messages({
                    'string.base': 'Group by must be a string',
                    'any.only': 'Group by must be one of: day, week, month, year, mimeType, assignment'
                })
        });

        return schema.validate(filters);
    }

    /**
     * Validate file type filter
     */
    static validateFileTypeFilter(filters) {
        const schema = Joi.object({
            mimeType: Joi.string().trim().min(1).max(100).required()
                .messages({
                    'string.empty': 'MIME type cannot be empty',
                    'string.min': 'MIME type must be at least 1 character long',
                    'string.max': 'MIME type cannot exceed 100 characters',
                    'any.required': 'MIME type is required'
                }),
            page: Joi.number().integer().min(1).default(1)
                .messages({
                    'number.base': 'Page must be a number',
                    'number.integer': 'Page must be an integer',
                    'number.min': 'Page must be at least 1'
                }),
            limit: Joi.number().integer().min(1).max(100).default(10)
                .messages({
                    'number.base': 'Limit must be a number',
                    'number.integer': 'Limit must be an integer',
                    'number.min': 'Limit must be at least 1',
                    'number.max': 'Limit cannot exceed 100'
                }),
            sortBy: Joi.string().valid('name', 'size', 'createdAt', 'updatedAt').default('createdAt')
                .messages({
                    'string.base': 'Sort by must be a string',
                    'any.only': 'Sort by must be one of: name, size, createdAt, updatedAt'
                }),
            sortOrder: Joi.string().valid('asc', 'desc').default('desc')
                .messages({
                    'string.base': 'Sort order must be a string',
                    'any.only': 'Sort order must be either asc or desc'
                })
        });

        return schema.validate(filters);
    }

    /**
     * Validate ID parameter
     */
    static validateId(id) {
        const schema = Joi.number().integer().positive().required()
            .messages({
                'number.base': 'ID must be a number',
                'number.integer': 'ID must be an integer',
                'number.positive': 'ID must be positive',
                'any.required': 'ID is required'
            });

        return schema.validate(id);
    }

    /**
     * Validate assignment ID parameter
     */
    static validateAssignmentId(assignmentId) {
        const schema = Joi.number().integer().positive().required()
            .messages({
                'number.base': 'Assignment ID must be a number',
                'number.integer': 'Assignment ID must be an integer',
                'number.positive': 'Assignment ID must be positive',
                'any.required': 'Assignment ID is required'
            });

        return schema.validate(assignmentId);
    }

    /**
     * Validate school ID parameter
     */
    static validateSchoolId(schoolId) {
        const schema = Joi.number().integer().positive().required()
            .messages({
                'number.base': 'School ID must be a number',
                'number.integer': 'School ID must be an integer',
                'number.positive': 'School ID must be positive',
                'any.required': 'School ID is required'
            });

        return schema.validate(schoolId);
    }

    /**
     * Validate file size
     */
    static validateFileSize(size) {
        const maxSize = 100 * 1024 * 1024; // 100MB
        const schema = Joi.number().integer().min(1).max(maxSize).required()
            .messages({
                'number.base': 'File size must be a number',
                'number.integer': 'File size must be an integer',
                'number.min': 'File size must be at least 1 byte',
                'number.max': `File size cannot exceed ${maxSize / (1024 * 1024)}MB`,
                'any.required': 'File size is required'
            });

        return schema.validate(size);
    }

    /**
     * Validate MIME type
     */
    static validateMimeType(mimeType) {
        const allowedTypes = [
            // Documents
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/csv',
            // Images
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'image/svg+xml',
            // Audio
            'audio/mpeg',
            'audio/wav',
            'audio/ogg',
            // Video
            'video/mp4',
            'video/webm',
            'video/ogg',
            // Archives
            'application/zip',
            'application/x-rar-compressed',
            'application/x-7z-compressed'
        ];

        const schema = Joi.string().valid(...allowedTypes).required()
            .messages({
                'string.base': 'MIME type must be a string',
                'any.only': 'File type not allowed. Allowed types: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, Images, Audio, Video, Archives',
                'any.required': 'MIME type is required'
            });

        return schema.validate(mimeType);
    }

    /**
     * Get validation error message
     */
    static getErrorMessage(validationResult) {
        if (validationResult.error) {
            const error = validationResult.error.details[0];
            return error.message;
        }
        return null;
    }

    /**
     * Validate and sanitize input
     */
    static validateAndSanitize(data, validationType) {
        let validationResult;

        switch (validationType) {
            case 'create':
                validationResult = this.validateCreate(data);
                break;
            case 'update':
                validationResult = this.validateUpdate(data);
                break;
            case 'fileUpload':
                validationResult = this.validateFileUpload(data);
                break;
            case 'bulkDelete':
                validationResult = this.validateBulkDelete(data);
                break;
            case 'search':
                validationResult = this.validateSearch(data);
                break;
            case 'statistics':
                validationResult = this.validateStatistics(data);
                break;
            case 'fileType':
                validationResult = this.validateFileTypeFilter(data);
                break;
            case 'id':
                validationResult = this.validateId(data);
                break;
            case 'assignmentId':
                validationResult = this.validateAssignmentId(data);
                break;
            case 'schoolId':
                validationResult = this.validateSchoolId(data);
                break;
            case 'fileSize':
                validationResult = this.validateFileSize(data);
                break;
            case 'mimeType':
                validationResult = this.validateMimeType(data);
                break;
            default:
                throw new Error(`Unknown validation type: ${validationType}`);
        }

        if (validationResult.error) {
            const errorMessage = this.getErrorMessage(validationResult);
            logger.warn(`Validation failed for ${validationType}: ${errorMessage}`);
            throw new Error(errorMessage);
        }

        return validationResult.value;
    }
}


export default AssignmentAttachmentValidator;
import Joi from 'joi';
import logger from '../config/logger.js';

class AssignmentSubmissionValidator {
    /**
     * Validate create submission data
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
            studentId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'Student ID must be a number',
                    'number.integer': 'Student ID must be an integer',
                    'number.positive': 'Student ID must be positive',
                    'any.required': 'Student ID is required'
                }),
            content: Joi.string().trim().min(1).max(10000).required()
                .messages({
                    'string.empty': 'Content cannot be empty',
                    'string.min': 'Content must be at least 1 character long',
                    'string.max': 'Content cannot exceed 10000 characters',
                    'any.required': 'Content is required'
                }),
            submittedAt: Joi.date().iso()
                .messages({
                    'date.base': 'Submitted date must be a valid date',
                    'date.format': 'Submitted date must be in ISO format'
                }),
            status: Joi.string().valid('DRAFT', 'SUBMITTED', 'LATE', 'GRADED', 'RETURNED').default('SUBMITTED')
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: DRAFT, SUBMITTED, LATE, GRADED, RETURNED'
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
     * Validate update submission data
     */
    static validateUpdate(data) {
        const schema = Joi.object({
            content: Joi.string().trim().min(1).max(10000)
                .messages({
                    'string.empty': 'Content cannot be empty',
                    'string.min': 'Content must be at least 1 character long',
                    'string.max': 'Content cannot exceed 10000 characters'
                }),
            status: Joi.string().valid('DRAFT', 'SUBMITTED', 'LATE', 'GRADED', 'RETURNED')
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: DRAFT, SUBMITTED, LATE, GRADED, RETURNED'
                }),
            score: Joi.number().min(0).max(100)
                .messages({
                    'number.base': 'Score must be a number',
                    'number.min': 'Score cannot be negative',
                    'number.max': 'Score cannot exceed 100'
                }),
            feedback: Joi.string().trim().max(2000)
                .messages({
                    'string.max': 'Feedback cannot exceed 2000 characters'
                })
        }).min(1); // At least one field must be provided

        return schema.validate(data);
    }

    /**
     * Validate grade submission data
     */
    static validateGrade(data) {
        const schema = Joi.object({
            score: Joi.number().min(0).max(100).required()
                .messages({
                    'number.base': 'Score must be a number',
                    'number.min': 'Score cannot be negative',
                    'number.max': 'Score cannot exceed 100',
                    'any.required': 'Score is required'
                }),
            feedback: Joi.string().trim().max(2000)
                .messages({
                    'string.max': 'Feedback cannot exceed 2000 characters'
                })
        });

        return schema.validate(data);
    }

    /**
     * Validate bulk grade data
     */
    static validateBulkGrade(data) {
        const schema = Joi.object({
            submissions: Joi.array().items(
                Joi.object({
                    id: Joi.number().integer().positive().required()
                        .messages({
                            'number.base': 'Submission ID must be a number',
                            'number.integer': 'Submission ID must be an integer',
                            'number.positive': 'Submission ID must be positive',
                            'any.required': 'Submission ID is required'
                        }),
                    score: Joi.number().min(0).max(100).required()
                        .messages({
                            'number.base': 'Score must be a number',
                            'number.min': 'Score cannot be negative',
                            'number.max': 'Score cannot exceed 100',
                            'any.required': 'Score is required'
                        }),
                    feedback: Joi.string().trim().max(2000)
                        .messages({
                            'string.max': 'Feedback cannot exceed 2000 characters'
                        })
                })
            ).min(1).max(100).required()
                .messages({
                    'array.base': 'Submissions must be an array',
                    'array.min': 'At least one submission is required',
                    'array.max': 'Cannot grade more than 100 submissions at once',
                    'any.required': 'Submissions are required'
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
            studentId: Joi.number().integer().positive()
                .messages({
                    'number.base': 'Student ID must be a number',
                    'number.integer': 'Student ID must be an integer',
                    'number.positive': 'Student ID must be positive'
                }),
            status: Joi.string().valid('DRAFT', 'SUBMITTED', 'LATE', 'GRADED', 'RETURNED')
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: DRAFT, SUBMITTED, LATE, GRADED, RETURNED'
                }),
            graded: Joi.string().valid('true', 'false')
                .messages({
                    'string.base': 'Graded must be a string',
                    'any.only': 'Graded must be either true or false'
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
            minScore: Joi.number().min(0).max(100)
                .messages({
                    'number.base': 'Minimum score must be a number',
                    'number.min': 'Minimum score cannot be negative',
                    'number.max': 'Minimum score cannot exceed 100'
                }),
            maxScore: Joi.number().min(0).max(100)
                .messages({
                    'number.base': 'Maximum score must be a number',
                    'number.min': 'Maximum score cannot be negative',
                    'number.max': 'Maximum score cannot exceed 100'
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
            sortBy: Joi.string().valid('submittedAt', 'score', 'status', 'createdAt', 'updatedAt').default('submittedAt')
                .messages({
                    'string.base': 'Sort by must be a string',
                    'any.only': 'Sort by must be one of: submittedAt, score, status, createdAt, updatedAt'
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
            teacherId: Joi.number().integer().positive()
                .messages({
                    'number.base': 'Teacher ID must be a number',
                    'number.integer': 'Teacher ID must be an integer',
                    'number.positive': 'Teacher ID must be positive'
                }),
            groupBy: Joi.string().valid('day', 'week', 'month', 'year', 'status', 'assignment').default('month')
                .messages({
                    'string.base': 'Group by must be a string',
                    'any.only': 'Group by must be one of: day, week, month, year, status, assignment'
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
     * Validate student ID parameter
     */
    static validateStudentId(studentId) {
        const schema = Joi.number().integer().positive().required()
            .messages({
                'number.base': 'Student ID must be a number',
                'number.integer': 'Student ID must be an integer',
                'number.positive': 'Student ID must be positive',
                'any.required': 'Student ID is required'
            });

        return schema.validate(studentId);
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
     * Validate score
     */
    static validateScore(score) {
        const schema = Joi.number().min(0).max(100).required()
            .messages({
                'number.base': 'Score must be a number',
                'number.min': 'Score cannot be negative',
                'number.max': 'Score cannot exceed 100',
                'any.required': 'Score is required'
            });

        return schema.validate(score);
    }

    /**
     * Validate status
     */
    static validateStatus(status) {
        const schema = Joi.string().valid('DRAFT', 'SUBMITTED', 'LATE', 'GRADED', 'RETURNED').required()
            .messages({
                'string.base': 'Status must be a string',
                'any.only': 'Status must be one of: DRAFT, SUBMITTED, LATE, GRADED, RETURNED',
                'any.required': 'Status is required'
            });

        return schema.validate(status);
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
            case 'grade':
                validationResult = this.validateGrade(data);
                break;
            case 'bulkGrade':
                validationResult = this.validateBulkGrade(data);
                break;
            case 'search':
                validationResult = this.validateSearch(data);
                break;
            case 'statistics':
                validationResult = this.validateStatistics(data);
                break;
            case 'id':
                validationResult = this.validateId(data);
                break;
            case 'assignmentId':
                validationResult = this.validateAssignmentId(data);
                break;
            case 'studentId':
                validationResult = this.validateStudentId(data);
                break;
            case 'schoolId':
                validationResult = this.validateSchoolId(data);
                break;
            case 'score':
                validationResult = this.validateScore(data);
                break;
            case 'status':
                validationResult = this.validateStatus(data);
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

export default AssignmentSubmissionValidator;
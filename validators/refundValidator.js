import Joi from 'joi';
import logger from '../config/logger.js';

class RefundValidator {
    /**
     * Validate create refund data
     */
    static validateCreate(data) {
        const schema = Joi.object({
            paymentId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'Payment ID must be a number',
                    'number.integer': 'Payment ID must be an integer',
                    'number.positive': 'Payment ID must be positive',
                    'any.required': 'Payment ID is required'
                }),
            amount: Joi.number().positive().precision(2).required()
                .messages({
                    'number.base': 'Amount must be a number',
                    'number.positive': 'Amount must be positive',
                    'number.precision': 'Amount can have maximum 2 decimal places',
                    'any.required': 'Amount is required'
                }),
            reason: Joi.string().trim().min(1).max(255).required()
                .messages({
                    'string.empty': 'Reason cannot be empty',
                    'string.min': 'Reason must be at least 1 character long',
                    'string.max': 'Reason cannot exceed 255 characters',
                    'any.required': 'Reason is required'
                }),
            status: Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED').default('PENDING')
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED'
                }),
            processedDate: Joi.date().iso()
                .messages({
                    'date.base': 'Processed date must be a valid date',
                    'date.format': 'Processed date must be in ISO format'
                }),
            gatewayRefundId: Joi.string().trim().max(255)
                .messages({
                    'string.max': 'Gateway refund ID cannot exceed 255 characters'
                }),
            remarks: Joi.string().trim().max(255)
                .messages({
                    'string.max': 'Remarks cannot exceed 255 characters'
                }),
            schoolId: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'School ID must be a number',
                    'number.integer': 'School ID must be an integer',
                    'number.positive': 'School ID must be positive',
                    'any.required': 'School ID is required'
                }),
            createdBy: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'Created by must be a number',
                    'number.integer': 'Created by must be an integer',
                    'number.positive': 'Created by must be positive',
                    'any.required': 'Created by is required'
                })
        });

        return schema.validate(data);
    }

    /**
     * Validate update refund data
     */
    static validateUpdate(data) {
        const schema = Joi.object({
            status: Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED'
                }),
            processedDate: Joi.date().iso()
                .messages({
                    'date.base': 'Processed date must be a valid date',
                    'date.format': 'Processed date must be in ISO format'
                }),
            gatewayRefundId: Joi.string().trim().max(255)
                .messages({
                    'string.max': 'Gateway refund ID cannot exceed 255 characters'
                }),
            remarks: Joi.string().trim().max(255)
                .messages({
                    'string.max': 'Remarks cannot exceed 255 characters'
                })
        }).min(1); // At least one field must be provided

        return schema.validate(data);
    }

    /**
     * Validate bulk update data
     */
    static validateBulkUpdate(data) {
        const schema = Joi.object({
            refundIds: Joi.array().items(
                Joi.number().integer().positive()
            ).min(1).max(100).required()
                .messages({
                    'array.base': 'Refund IDs must be an array',
                    'array.min': 'At least one refund ID is required',
                    'array.max': 'Cannot update more than 100 refunds at once',
                    'any.required': 'Refund IDs are required'
                }),
            updates: Joi.object({
                status: Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
                    .messages({
                        'string.base': 'Status must be a string',
                        'any.only': 'Status must be one of: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED'
                    }),
                remarks: Joi.string().trim().max(255)
                    .messages({
                        'string.max': 'Remarks cannot exceed 255 characters'
                    })
            }).min(1).required()
                .messages({
                    'object.base': 'Updates must be an object',
                    'object.min': 'At least one update field is required',
                    'any.required': 'Updates are required'
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
            paymentId: Joi.number().integer().positive()
                .messages({
                    'number.base': 'Payment ID must be a number',
                    'number.integer': 'Payment ID must be an integer',
                    'number.positive': 'Payment ID must be positive'
                }),
            status: Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED'
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
            minAmount: Joi.number().positive().precision(2)
                .messages({
                    'number.base': 'Minimum amount must be a number',
                    'number.positive': 'Minimum amount must be positive',
                    'number.precision': 'Minimum amount can have maximum 2 decimal places'
                }),
            maxAmount: Joi.number().positive().precision(2)
                .messages({
                    'number.base': 'Maximum amount must be a number',
                    'number.positive': 'Maximum amount must be positive',
                    'number.precision': 'Maximum amount can have maximum 2 decimal places'
                }),
            reason: Joi.string().trim().min(1).max(255)
                .messages({
                    'string.empty': 'Reason cannot be empty',
                    'string.min': 'Reason must be at least 1 character long',
                    'string.max': 'Reason cannot exceed 255 characters'
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
            sortBy: Joi.string().valid('createdAt', 'amount', 'status', 'processedDate').default('createdAt')
                .messages({
                    'string.base': 'Sort by must be a string',
                    'any.only': 'Sort by must be one of: createdAt, amount, status, processedDate'
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
            status: Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED'
                }),
            paymentId: Joi.number().integer().positive()
                .messages({
                    'number.base': 'Payment ID must be a number',
                    'number.integer': 'Payment ID must be an integer',
                    'number.positive': 'Payment ID must be positive'
                }),
            groupBy: Joi.string().valid('day', 'week', 'month', 'year', 'status', 'payment').default('month')
                .messages({
                    'string.base': 'Group by must be a string',
                    'any.only': 'Group by must be one of: day, week, month, year, status, payment'
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
     * Validate payment ID parameter
     */
    static validatePaymentId(paymentId) {
        const schema = Joi.number().integer().positive().required()
            .messages({
                'number.base': 'Payment ID must be a number',
                'number.integer': 'Payment ID must be an integer',
                'number.positive': 'Payment ID must be positive',
                'any.required': 'Payment ID is required'
            });

        return schema.validate(paymentId);
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
     * Validate amount
     */
    static validateAmount(amount) {
        const schema = Joi.number().positive().precision(2).required()
            .messages({
                'number.base': 'Amount must be a number',
                'number.positive': 'Amount must be positive',
                'number.precision': 'Amount can have maximum 2 decimal places',
                'any.required': 'Amount is required'
            });

        return schema.validate(amount);
    }

    /**
     * Validate status
     */
    static validateStatus(status) {
        const schema = Joi.string().valid('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED').required()
            .messages({
                'string.base': 'Status must be a string',
                'any.only': 'Status must be one of: PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED',
                'any.required': 'Status is required'
            });

        return schema.validate(status);
    }

    /**
     * Validate reason
     */
    static validateReason(reason) {
        const schema = Joi.string().trim().min(1).max(255).required()
            .messages({
                'string.empty': 'Reason cannot be empty',
                'string.min': 'Reason must be at least 1 character long',
                'string.max': 'Reason cannot exceed 255 characters',
                'any.required': 'Reason is required'
            });

        return schema.validate(reason);
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
            case 'bulkUpdate':
                validationResult = this.validateBulkUpdate(data);
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
            case 'paymentId':
                validationResult = this.validatePaymentId(data);
                break;
            case 'schoolId':
                validationResult = this.validateSchoolId(data);
                break;
            case 'amount':
                validationResult = this.validateAmount(data);
                break;
            case 'status':
                validationResult = this.validateStatus(data);
                break;
            case 'reason':
                validationResult = this.validateReason(data);
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

export default RefundValidator;
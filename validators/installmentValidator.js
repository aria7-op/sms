import Joi from 'joi';
import logger from '../config/logger.js';

class InstallmentValidator {
    /**
     * Validate installment creation data
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
            installmentNumber: Joi.number().integer().positive().required()
                .messages({
                    'number.base': 'Installment number must be a number',
                    'number.integer': 'Installment number must be an integer',
                    'number.positive': 'Installment number must be positive',
                    'any.required': 'Installment number is required'
                }),
            amount: Joi.number().positive().precision(2).required()
                .messages({
                    'number.base': 'Amount must be a number',
                    'number.positive': 'Amount must be positive',
                    'number.precision': 'Amount can have maximum 2 decimal places',
                    'any.required': 'Amount is required'
                }),
            dueDate: Joi.date().iso().required()
                .messages({
                    'date.base': 'Due date must be a valid date',
                    'date.format': 'Due date must be in ISO format',
                    'any.required': 'Due date is required'
                }),
            paidDate: Joi.date().iso().optional()
                .messages({
                    'date.base': 'Paid date must be a valid date',
                    'date.format': 'Paid date must be in ISO format'
                }),
            status: Joi.string().valid('PENDING', 'PAID', 'OVERDUE', 'CANCELLED').optional()
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: PENDING, PAID, OVERDUE, CANCELLED'
                }),
            lateFee: Joi.number().min(0).precision(2).optional()
                .messages({
                    'number.base': 'Late fee must be a number',
                    'number.min': 'Late fee cannot be negative',
                    'number.precision': 'Late fee can have maximum 2 decimal places'
                }),
            remarks: Joi.string().max(500).optional()
                .messages({
                    'string.base': 'Remarks must be a string',
                    'string.max': 'Remarks cannot exceed 500 characters'
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
     * Validate installment update data
     */
    static validateUpdate(data) {
        const schema = Joi.object({
            amount: Joi.number().positive().precision(2).optional()
                .messages({
                    'number.base': 'Amount must be a number',
                    'number.positive': 'Amount must be positive',
                    'number.precision': 'Amount can have maximum 2 decimal places'
                }),
            dueDate: Joi.date().iso().optional()
                .messages({
                    'date.base': 'Due date must be a valid date',
                    'date.format': 'Due date must be in ISO format'
                }),
            status: Joi.string().valid('PENDING', 'PAID', 'OVERDUE', 'CANCELLED').optional()
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: PENDING, PAID, OVERDUE, CANCELLED'
                }),
            lateFee: Joi.number().min(0).precision(2).optional()
                .messages({
                    'number.base': 'Late fee must be a number',
                    'number.min': 'Late fee cannot be negative',
                    'number.precision': 'Late fee can have maximum 2 decimal places'
                }),
            remarks: Joi.string().max(500).optional()
                .messages({
                    'string.base': 'Remarks must be a string',
                    'string.max': 'Remarks cannot exceed 500 characters'
                })
        });

        return schema.validate(data);
    }

    /**
     * Validate installment payment data
     */
    static validatePayment(data) {
        const schema = Joi.object({
            remarks: Joi.string().max(500).optional()
                .messages({
                    'string.base': 'Remarks must be a string',
                    'string.max': 'Remarks cannot exceed 500 characters'
                }),
            paymentMethod: Joi.string().valid('CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'MOBILE_PAYMENT').optional()
                .messages({
                    'string.base': 'Payment method must be a string',
                    'any.only': 'Payment method must be one of: CASH, CARD, BANK_TRANSFER, CHECK, MOBILE_PAYMENT'
                }),
            transactionId: Joi.string().max(100).optional()
                .messages({
                    'string.base': 'Transaction ID must be a string',
                    'string.max': 'Transaction ID cannot exceed 100 characters'
                })
        });

        return schema.validate(data);
    }

    /**
     * Validate bulk installment creation
     */
    static validateBulkCreate(data) {
        const schema = Joi.object({
            installments: Joi.array().items(
                Joi.object({
                    paymentId: Joi.number().integer().positive().required(),
                    installmentNumber: Joi.number().integer().positive().required(),
                    amount: Joi.number().positive().precision(2).required(),
                    dueDate: Joi.date().iso().required(),
                    status: Joi.string().valid('PENDING', 'PAID', 'OVERDUE', 'CANCELLED').optional(),
                    lateFee: Joi.number().min(0).precision(2).optional(),
                    remarks: Joi.string().max(500).optional()
                })
            ).min(1).max(50).required()
                .messages({
                    'array.min': 'At least one installment is required',
                    'array.max': 'Maximum 50 installments can be created at once',
                    'any.required': 'Installments array is required'
                })
        });

        return schema.validate(data);
    }

    /**
     * Validate installment filters
     */
    static validateFilters(filters) {
        const schema = Joi.object({
            page: Joi.number().integer().min(1).optional()
                .messages({
                    'number.base': 'Page must be a number',
                    'number.integer': 'Page must be an integer',
                    'number.min': 'Page must be at least 1'
                }),
            limit: Joi.number().integer().min(1).max(100).optional()
                .messages({
                    'number.base': 'Limit must be a number',
                    'number.integer': 'Limit must be an integer',
                    'number.min': 'Limit must be at least 1',
                    'number.max': 'Limit cannot exceed 100'
                }),
            paymentId: Joi.number().integer().positive().optional()
                .messages({
                    'number.base': 'Payment ID must be a number',
                    'number.integer': 'Payment ID must be an integer',
                    'number.positive': 'Payment ID must be positive'
                }),
            status: Joi.string().valid('PENDING', 'PAID', 'OVERDUE', 'CANCELLED').optional()
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: PENDING, PAID, OVERDUE, CANCELLED'
                }),
            startDate: Joi.date().iso().optional()
                .messages({
                    'date.base': 'Start date must be a valid date',
                    'date.format': 'Start date must be in ISO format'
                }),
            endDate: Joi.date().iso().optional()
                .messages({
                    'date.base': 'End date must be a valid date',
                    'date.format': 'End date must be in ISO format'
                }),
            minAmount: Joi.number().min(0).optional()
                .messages({
                    'number.base': 'Minimum amount must be a number',
                    'number.min': 'Minimum amount cannot be negative'
                }),
            maxAmount: Joi.number().min(0).optional()
                .messages({
                    'number.base': 'Maximum amount must be a number',
                    'number.min': 'Maximum amount cannot be negative'
                }),
            overdue: Joi.boolean().optional()
                .messages({
                    'boolean.base': 'Overdue must be a boolean'
                }),
            sortBy: Joi.string().valid('dueDate', 'amount', 'status', 'createdAt', 'paidDate').optional()
                .messages({
                    'string.base': 'Sort by must be a string',
                    'any.only': 'Sort by must be one of: dueDate, amount, status, createdAt, paidDate'
                }),
            sortOrder: Joi.string().valid('asc', 'desc').optional()
                .messages({
                    'string.base': 'Sort order must be a string',
                    'any.only': 'Sort order must be one of: asc, desc'
                })
        });

        return schema.validate(filters);
    }

    /**
     * Validate installment statistics filters
     */
    static validateStatisticsFilters(filters) {
        const schema = Joi.object({
            startDate: Joi.date().iso().optional()
                .messages({
                    'date.base': 'Start date must be a valid date',
                    'date.format': 'Start date must be in ISO format'
                }),
            endDate: Joi.date().iso().optional()
                .messages({
                    'date.base': 'End date must be a valid date',
                    'date.format': 'End date must be in ISO format'
                }),
            paymentId: Joi.number().integer().positive().optional()
                .messages({
                    'number.base': 'Payment ID must be a number',
                    'number.integer': 'Payment ID must be an integer',
                    'number.positive': 'Payment ID must be positive'
                }),
            status: Joi.string().valid('PENDING', 'PAID', 'OVERDUE', 'CANCELLED').optional()
                .messages({
                    'string.base': 'Status must be a string',
                    'any.only': 'Status must be one of: PENDING, PAID, OVERDUE, CANCELLED'
                })
        });

        return schema.validate(filters);
    }

    /**
     * Validate installment search
     */
    static validateSearch(searchTerm, filters) {
        const searchSchema = Joi.string().min(1).max(100).required()
            .messages({
                'string.base': 'Search term must be a string',
                'string.min': 'Search term must be at least 1 character',
                'string.max': 'Search term cannot exceed 100 characters',
                'any.required': 'Search term is required'
            });

        const searchValidation = searchSchema.validate(searchTerm);
        if (searchValidation.error) {
            return searchValidation;
        }

        return this.validateFilters(filters);
    }

    /**
     * Validate installment ID
     */
    static validateId(id) {
        const schema = Joi.number().integer().positive().required()
            .messages({
                'number.base': 'Installment ID must be a number',
                'number.integer': 'Installment ID must be an integer',
                'number.positive': 'Installment ID must be positive',
                'any.required': 'Installment ID is required'
            });

        return schema.validate(id);
    }

    /**
     * Validate payment ID
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
     * Validate date range
     */
    static validateDateRange(startDate, endDate) {
        const schema = Joi.object({
            startDate: Joi.date().iso().required()
                .messages({
                    'date.base': 'Start date must be a valid date',
                    'date.format': 'Start date must be in ISO format',
                    'any.required': 'Start date is required'
                }),
            endDate: Joi.date().iso().greater(Joi.ref('startDate')).required()
                .messages({
                    'date.base': 'End date must be a valid date',
                    'date.format': 'End date must be in ISO format',
                    'date.greater': 'End date must be after start date',
                    'any.required': 'End date is required'
                })
        });

        return schema.validate({ startDate, endDate });
    }

    /**
     * Validate amount range
     */
    static validateAmountRange(minAmount, maxAmount) {
        const schema = Joi.object({
            minAmount: Joi.number().min(0).required()
                .messages({
                    'number.base': 'Minimum amount must be a number',
                    'number.min': 'Minimum amount cannot be negative',
                    'any.required': 'Minimum amount is required'
                }),
            maxAmount: Joi.number().min(Joi.ref('minAmount')).required()
                .messages({
                    'number.base': 'Maximum amount must be a number',
                    'number.min': 'Maximum amount must be greater than or equal to minimum amount',
                    'any.required': 'Maximum amount is required'
                })
        });

        return schema.validate({ minAmount, maxAmount });
    }

    /**
     * Sanitize installment data
     */
    static sanitizeData(data) {
        const sanitized = { ...data };

        // Remove extra whitespace from string fields
        if (sanitized.remarks) {
            sanitized.remarks = sanitized.remarks.trim();
        }

        // Ensure numeric fields are properly formatted
        if (sanitized.amount) {
            sanitized.amount = parseFloat(sanitized.amount);
        }

        if (sanitized.lateFee) {
            sanitized.lateFee = parseFloat(sanitized.lateFee);
        }

        // Ensure dates are properly formatted
        if (sanitized.dueDate) {
            sanitized.dueDate = new Date(sanitized.dueDate);
        }

        if (sanitized.paidDate) {
            sanitized.paidDate = new Date(sanitized.paidDate);
        }

        return sanitized;
    }

    /**
     * Validate installment business rules
     */
    static validateBusinessRules(data, existingInstallments = []) {
        const errors = [];

        // Check if installment number is unique for the payment
        const duplicateNumber = existingInstallments.find(
            inst => inst.installmentNumber === data.installmentNumber
        );

        if (duplicateNumber) {
            errors.push(`Installment number ${data.installmentNumber} already exists for this payment`);
        }

        // Check if due date is not in the past for new installments
        if (data.dueDate && new Date(data.dueDate) < new Date()) {
            errors.push('Due date cannot be in the past for new installments');
        }

        // Check if amount is reasonable (not too high or too low)
        if (data.amount) {
            if (data.amount < 1) {
                errors.push('Installment amount must be at least $1');
            }

            if (data.amount > 10000) {
                errors.push('Installment amount cannot exceed $10,000');
            }
        }

        // Check if late fee is reasonable
        if (data.lateFee && data.lateFee > data.amount * 0.5) {
            errors.push('Late fee cannot exceed 50% of the installment amount');
        }

        return errors;
    }
}

export default InstallmentValidator;
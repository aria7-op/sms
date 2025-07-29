/**
 * Assignment Validator
 * Validates assignment data for creation and updates
 */

import Joi from 'joi';

/**
 * Validation schemas for Assignment operations
 */
const assignmentSchemas = {
    // Create assignment schema
    create: Joi.object({
        title: Joi.string().min(3).max(255).required()
            .messages({
                'string.min': 'Title must be at least 3 characters long',
                'string.max': 'Title cannot exceed 255 characters',
                'any.required': 'Title is required'
            }),
        description: Joi.string().min(10).max(2000).required()
            .messages({
                'string.min': 'Description must be at least 10 characters long',
                'string.max': 'Description cannot exceed 2000 characters',
                'any.required': 'Description is required'
            }),
        dueDate: Joi.date().iso().greater('now').required()
            .messages({
                'date.base': 'Due date must be a valid date',
                'date.format': 'Due date must be in ISO format',
                'date.greater': 'Due date must be in the future',
                'any.required': 'Due date is required'
            }),
        openDate: Joi.date().iso().less(Joi.ref('dueDate')).optional()
            .messages({
                'date.base': 'Open date must be a valid date',
                'date.format': 'Open date must be in ISO format',
                'date.less': 'Open date must be before due date'
            }),
        maxScore: Joi.number().integer().min(1).max(1000).required()
            .messages({
                'number.base': 'Max score must be a number',
                'number.integer': 'Max score must be an integer',
                'number.min': 'Max score must be at least 1',
                'number.max': 'Max score cannot exceed 1000',
                'any.required': 'Max score is required'
            }),
        weight: Joi.number().min(0).max(1).precision(2).required()
            .messages({
                'number.base': 'Weight must be a number',
                'number.min': 'Weight must be at least 0',
                'number.max': 'Weight cannot exceed 1',
                'number.precision': 'Weight can have maximum 2 decimal places',
                'any.required': 'Weight is required'
            }),
        type: Joi.string().valid('HOMEWORK', 'PROJECT', 'QUIZ', 'EXAM', 'LAB_REPORT', 'ESSAY', 'PRESENTATION', 'RESEARCH_PAPER', 'OTHER').required()
            .messages({
                'string.base': 'Type must be a string',
                'any.only': 'Type must be one of: HOMEWORK, PROJECT, QUIZ, EXAM, LAB_REPORT, ESSAY, PRESENTATION, RESEARCH_PAPER, OTHER',
                'any.required': 'Type is required'
            }),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').default('MEDIUM')
            .messages({
                'string.base': 'Priority must be a string',
                'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT'
            }),
        status: Joi.string().valid('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED').default('ACTIVE')
            .messages({
                'string.base': 'Status must be a string',
                'any.only': 'Status must be one of: DRAFT, ACTIVE, INACTIVE, ARCHIVED'
            }),
        allowLateSubmission: Joi.boolean().default(false)
            .messages({
                'boolean.base': 'Allow late submission must be a boolean'
            }),
        latePenalty: Joi.when('allowLateSubmission', {
            is: true,
            then: Joi.number().min(0).max(100).precision(2).required()
                .messages({
                    'number.base': 'Late penalty must be a number',
                    'number.min': 'Late penalty must be at least 0',
                    'number.max': 'Late penalty cannot exceed 100',
                    'number.precision': 'Late penalty can have maximum 2 decimal places',
                    'any.required': 'Late penalty is required when late submission is allowed'
                }),
            otherwise: Joi.number().min(0).max(100).precision(2).default(0)
                .messages({
                    'number.base': 'Late penalty must be a number',
                    'number.min': 'Late penalty must be at least 0',
                    'number.max': 'Late penalty cannot exceed 100',
                    'number.precision': 'Late penalty can have maximum 2 decimal places'
                })
        }),
        allowResubmission: Joi.boolean().default(false)
            .messages({
                'boolean.base': 'Allow resubmission must be a boolean'
            }),
        maxResubmissions: Joi.when('allowResubmission', {
            is: true,
            then: Joi.number().integer().min(1).max(10).required()
                .messages({
                    'number.base': 'Max resubmissions must be a number',
                    'number.integer': 'Max resubmissions must be an integer',
                    'number.min': 'Max resubmissions must be at least 1',
                    'number.max': 'Max resubmissions cannot exceed 10',
                    'any.required': 'Max resubmissions is required when resubmission is allowed'
                }),
            otherwise: Joi.number().integer().min(0).max(10).default(0)
                .messages({
                    'number.base': 'Max resubmissions must be a number',
                    'number.integer': 'Max resubmissions must be an integer',
                    'number.min': 'Max resubmissions must be at least 0',
                    'number.max': 'Max resubmissions cannot exceed 10'
                })
        }),
        attachments: Joi.array().items(
            Joi.object({
                name: Joi.string().min(1).max(255).required()
                    .messages({
                        'string.min': 'Attachment name must be at least 1 character long',
                        'string.max': 'Attachment name cannot exceed 255 characters',
                        'any.required': 'Attachment name is required'
                    }),
                url: Joi.string().uri().required()
                    .messages({
                        'string.uri': 'Attachment URL must be a valid URI',
                        'any.required': 'Attachment URL is required'
                    }),
                type: Joi.string().valid('PDF', 'DOC', 'DOCX', 'PPT', 'PPTX', 'XLS', 'XLSX', 'IMAGE', 'VIDEO', 'AUDIO', 'OTHER').required()
                    .messages({
                        'string.base': 'Attachment type must be a string',
                        'any.only': 'Attachment type must be one of: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, IMAGE, VIDEO, AUDIO, OTHER',
                        'any.required': 'Attachment type is required'
                    }),
                size: Joi.number().integer().min(1).max(100 * 1024 * 1024).optional()
                    .messages({
                        'number.base': 'Attachment size must be a number',
                        'number.integer': 'Attachment size must be an integer',
                        'number.min': 'Attachment size must be at least 1 byte',
                        'number.max': 'Attachment size cannot exceed 100MB'
                    })
            })
        ).max(10).optional()
            .messages({
                'array.max': 'Cannot have more than 10 attachments'
            }),
        instructions: Joi.string().min(10).max(2000).optional()
            .messages({
                'string.min': 'Instructions must be at least 10 characters long',
                'string.max': 'Instructions cannot exceed 2000 characters'
            }),
        rubric: Joi.object({
            criteria: Joi.array().items(
                Joi.object({
                    name: Joi.string().min(1).max(100).required()
                        .messages({
                            'string.min': 'Criteria name must be at least 1 character long',
                            'string.max': 'Criteria name cannot exceed 100 characters',
                            'any.required': 'Criteria name is required'
                        }),
                    maxScore: Joi.number().integer().min(1).max(100).required()
                        .messages({
                            'number.base': 'Criteria max score must be a number',
                            'number.integer': 'Criteria max score must be an integer',
                            'number.min': 'Criteria max score must be at least 1',
                            'number.max': 'Criteria max score cannot exceed 100',
                            'any.required': 'Criteria max score is required'
                        }),
                    description: Joi.string().min(5).max(500).optional()
                        .messages({
                            'string.min': 'Criteria description must be at least 5 characters long',
                            'string.max': 'Criteria description cannot exceed 500 characters'
                        })
                })
            ).min(1).max(10).required()
                .messages({
                    'array.min': 'Rubric must have at least 1 criteria',
                    'array.max': 'Rubric cannot have more than 10 criteria',
                    'any.required': 'Rubric criteria is required'
                })
        }).optional()
            .messages({
                'object.base': 'Rubric must be an object'
            }),
        teacherId: Joi.number().integer().positive().required()
            .messages({
                'number.base': 'Teacher ID must be a number',
                'number.integer': 'Teacher ID must be an integer',
                'number.positive': 'Teacher ID must be positive',
                'any.required': 'Teacher ID is required'
            }),
        classId: Joi.number().integer().positive().required()
            .messages({
                'number.base': 'Class ID must be a number',
                'number.integer': 'Class ID must be an integer',
                'number.positive': 'Class ID must be positive',
                'any.required': 'Class ID is required'
            }),
        subjectId: Joi.number().integer().positive().required()
            .messages({
                'number.base': 'Subject ID must be a number',
                'number.integer': 'Subject ID must be an integer',
                'number.positive': 'Subject ID must be positive',
                'any.required': 'Subject ID is required'
            }),
        tags: Joi.array().items(
            Joi.string().min(1).max(50)
                .messages({
                    'string.min': 'Tag must be at least 1 character long',
                    'string.max': 'Tag cannot exceed 50 characters'
                })
        ).max(10).optional()
            .messages({
                'array.max': 'Cannot have more than 10 tags'
            }),
        metadata: Joi.object().optional()
            .messages({
                'object.base': 'Metadata must be an object'
            })
    }),

    // Update assignment schema
    update: Joi.object({
        title: Joi.string().min(3).max(255).optional()
            .messages({
                'string.min': 'Title must be at least 3 characters long',
                'string.max': 'Title cannot exceed 255 characters'
            }),
        description: Joi.string().min(10).max(2000).optional()
            .messages({
                'string.min': 'Description must be at least 10 characters long',
                'string.max': 'Description cannot exceed 2000 characters'
            }),
        dueDate: Joi.date().iso().greater('now').optional()
            .messages({
                'date.base': 'Due date must be a valid date',
                'date.format': 'Due date must be in ISO format',
                'date.greater': 'Due date must be in the future'
            }),
        openDate: Joi.date().iso().less(Joi.ref('dueDate')).optional()
            .messages({
                'date.base': 'Open date must be a valid date',
                'date.format': 'Open date must be in ISO format',
                'date.less': 'Open date must be before due date'
            }),
        maxScore: Joi.number().integer().min(1).max(1000).optional()
            .messages({
                'number.base': 'Max score must be a number',
                'number.integer': 'Max score must be an integer',
                'number.min': 'Max score must be at least 1',
                'number.max': 'Max score cannot exceed 1000'
            }),
        weight: Joi.number().min(0).max(1).precision(2).optional()
            .messages({
                'number.base': 'Weight must be a number',
                'number.min': 'Weight must be at least 0',
                'number.max': 'Weight cannot exceed 1',
                'number.precision': 'Weight can have maximum 2 decimal places'
            }),
        type: Joi.string().valid('HOMEWORK', 'PROJECT', 'QUIZ', 'EXAM', 'LAB_REPORT', 'ESSAY', 'PRESENTATION', 'RESEARCH_PAPER', 'OTHER').optional()
            .messages({
                'string.base': 'Type must be a string',
                'any.only': 'Type must be one of: HOMEWORK, PROJECT, QUIZ, EXAM, LAB_REPORT, ESSAY, PRESENTATION, RESEARCH_PAPER, OTHER'
            }),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional()
            .messages({
                'string.base': 'Priority must be a string',
                'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT'
            }),
        status: Joi.string().valid('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED').optional()
            .messages({
                'string.base': 'Status must be a string',
                'any.only': 'Status must be one of: DRAFT, ACTIVE, INACTIVE, ARCHIVED'
            }),
        allowLateSubmission: Joi.boolean().optional()
            .messages({
                'boolean.base': 'Allow late submission must be a boolean'
            }),
        latePenalty: Joi.number().min(0).max(100).precision(2).optional()
            .messages({
                'number.base': 'Late penalty must be a number',
                'number.min': 'Late penalty must be at least 0',
                'number.max': 'Late penalty cannot exceed 100',
                'number.precision': 'Late penalty can have maximum 2 decimal places'
            }),
        allowResubmission: Joi.boolean().optional()
            .messages({
                'boolean.base': 'Allow resubmission must be a boolean'
            }),
        maxResubmissions: Joi.number().integer().min(0).max(10).optional()
            .messages({
                'number.base': 'Max resubmissions must be a number',
                'number.integer': 'Max resubmissions must be an integer',
                'number.min': 'Max resubmissions must be at least 0',
                'number.max': 'Max resubmissions cannot exceed 10'
            }),
        attachments: Joi.array().items(
            Joi.object({
                name: Joi.string().min(1).max(255).required()
                    .messages({
                        'string.min': 'Attachment name must be at least 1 character long',
                        'string.max': 'Attachment name cannot exceed 255 characters',
                        'any.required': 'Attachment name is required'
                    }),
                url: Joi.string().uri().required()
                    .messages({
                        'string.uri': 'Attachment URL must be a valid URI',
                        'any.required': 'Attachment URL is required'
                    }),
                type: Joi.string().valid('PDF', 'DOC', 'DOCX', 'PPT', 'PPTX', 'XLS', 'XLSX', 'IMAGE', 'VIDEO', 'AUDIO', 'OTHER').required()
                    .messages({
                        'string.base': 'Attachment type must be a string',
                        'any.only': 'Attachment type must be one of: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, IMAGE, VIDEO, AUDIO, OTHER',
                        'any.required': 'Attachment type is required'
                    }),
                size: Joi.number().integer().min(1).max(100 * 1024 * 1024).optional()
                    .messages({
                        'number.base': 'Attachment size must be a number',
                        'number.integer': 'Attachment size must be an integer',
                        'number.min': 'Attachment size must be at least 1 byte',
                        'number.max': 'Attachment size cannot exceed 100MB'
                    })
            })
        ).max(10).optional()
            .messages({
                'array.max': 'Cannot have more than 10 attachments'
            }),
        instructions: Joi.string().min(10).max(2000).optional()
            .messages({
                'string.min': 'Instructions must be at least 10 characters long',
                'string.max': 'Instructions cannot exceed 2000 characters'
            }),
        rubric: Joi.object({
            criteria: Joi.array().items(
                Joi.object({
                    name: Joi.string().min(1).max(100).required()
                        .messages({
                            'string.min': 'Criteria name must be at least 1 character long',
                            'string.max': 'Criteria name cannot exceed 100 characters',
                            'any.required': 'Criteria name is required'
                        }),
                    maxScore: Joi.number().integer().min(1).max(100).required()
                        .messages({
                            'number.base': 'Criteria max score must be a number',
                            'number.integer': 'Criteria max score must be an integer',
                            'number.min': 'Criteria max score must be at least 1',
                            'number.max': 'Criteria max score cannot exceed 100',
                            'any.required': 'Criteria max score is required'
                        }),
                    description: Joi.string().min(5).max(500).optional()
                        .messages({
                            'string.min': 'Criteria description must be at least 5 characters long',
                            'string.max': 'Criteria description cannot exceed 500 characters'
                        })
                })
            ).min(1).max(10).required()
                .messages({
                    'array.min': 'Rubric must have at least 1 criteria',
                    'array.max': 'Rubric cannot have more than 10 criteria',
                    'any.required': 'Rubric criteria is required'
                })
        }).optional()
            .messages({
                'object.base': 'Rubric must be an object'
            }),
        tags: Joi.array().items(
            Joi.string().min(1).max(50)
                .messages({
                    'string.min': 'Tag must be at least 1 character long',
                    'string.max': 'Tag cannot exceed 50 characters'
                })
        ).max(10).optional()
            .messages({
                'array.max': 'Cannot have more than 10 tags'
            }),
        metadata: Joi.object().optional()
            .messages({
                'object.base': 'Metadata must be an object'
            })
    }),

    // Filter schema
    filters: Joi.object({
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
        status: Joi.string().valid('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED').optional()
            .messages({
                'string.base': 'Status must be a string',
                'any.only': 'Status must be one of: DRAFT, ACTIVE, INACTIVE, ARCHIVED'
            }),
        type: Joi.string().valid('HOMEWORK', 'PROJECT', 'QUIZ', 'EXAM', 'LAB_REPORT', 'ESSAY', 'PRESENTATION', 'RESEARCH_PAPER', 'OTHER').optional()
            .messages({
                'string.base': 'Type must be a string',
                'any.only': 'Type must be one of: HOMEWORK, PROJECT, QUIZ, EXAM, LAB_REPORT, ESSAY, PRESENTATION, RESEARCH_PAPER, OTHER'
            }),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional()
            .messages({
                'string.base': 'Priority must be a string',
                'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT'
            }),
        teacherId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Teacher ID must be a number',
                'number.integer': 'Teacher ID must be an integer',
                'number.positive': 'Teacher ID must be positive'
            }),
        classId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Class ID must be a number',
                'number.integer': 'Class ID must be an integer',
                'number.positive': 'Class ID must be positive'
            }),
        subjectId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Subject ID must be a number',
                'number.integer': 'Subject ID must be an integer',
                'number.positive': 'Subject ID must be positive'
            }),
        startDate: Joi.date().iso().optional()
            .messages({
                'date.base': 'Start date must be a valid date',
                'date.format': 'Start date must be in ISO format'
            }),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
            .messages({
                'date.base': 'End date must be a valid date',
                'date.format': 'End date must be in ISO format',
                'date.min': 'End date must be after start date'
            }),
        search: Joi.string().min(1).max(100).optional()
            .messages({
                'string.min': 'Search term must be at least 1 character long',
                'string.max': 'Search term cannot exceed 100 characters'
            }),
        sortBy: Joi.string().valid('title', 'dueDate', 'createdAt', 'updatedAt', 'priority', 'type', 'status').default('dueDate')
            .messages({
                'string.base': 'Sort by must be a string',
                'any.only': 'Sort by must be one of: title, dueDate, createdAt, updatedAt, priority, type, status'
            }),
        sortOrder: Joi.string().valid('asc', 'desc').default('asc')
            .messages({
                'string.base': 'Sort order must be a string',
                'any.only': 'Sort order must be one of: asc, desc'
            }),
        allowLateSubmission: Joi.boolean().optional()
            .messages({
                'boolean.base': 'Allow late submission must be a boolean'
            }),
        allowResubmission: Joi.boolean().optional()
            .messages({
                'boolean.base': 'Allow resubmission must be a boolean'
            }),
        tags: Joi.array().items(Joi.string()).optional()
            .messages({
                'array.base': 'Tags must be an array'
            }),
        dashboard: Joi.boolean().optional()
            .messages({
                'boolean.base': 'Dashboard must be a boolean'
            }),
        calendar: Joi.string().valid('daily', 'weekly', 'monthly').optional()
            .messages({
                'string.base': 'Calendar must be a string',
                'any.only': 'Calendar must be one of: daily, weekly, monthly'
            }),
        format: Joi.string().valid('json', 'csv', 'excel').optional()
            .messages({
                'string.base': 'Format must be a string',
                'any.only': 'Format must be one of: json, csv, excel'
            })
    }),

    // Search schema
    search: Joi.object({
        q: Joi.string().min(1).max(100).required()
            .messages({
                'string.min': 'Search query must be at least 1 character long',
                'string.max': 'Search query cannot exceed 100 characters',
                'any.required': 'Search query is required'
            }),
        type: Joi.string().valid('HOMEWORK', 'PROJECT', 'QUIZ', 'EXAM', 'LAB_REPORT', 'ESSAY', 'PRESENTATION', 'RESEARCH_PAPER', 'OTHER').optional()
            .messages({
                'string.base': 'Type must be a string',
                'any.only': 'Type must be one of: HOMEWORK, PROJECT, QUIZ, EXAM, LAB_REPORT, ESSAY, PRESENTATION, RESEARCH_PAPER, OTHER'
            }),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional()
            .messages({
                'string.base': 'Priority must be a string',
                'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT'
            }),
        teacherId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Teacher ID must be a number',
                'number.integer': 'Teacher ID must be an integer',
                'number.positive': 'Teacher ID must be positive'
            }),
        classId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Class ID must be a number',
                'number.integer': 'Class ID must be an integer',
                'number.positive': 'Class ID must be positive'
            }),
        subjectId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Subject ID must be a number',
                'number.integer': 'Subject ID must be an integer',
                'number.positive': 'Subject ID must be positive'
            }),
        startDate: Joi.date().iso().optional()
            .messages({
                'date.base': 'Start date must be a valid date',
                'date.format': 'Start date must be in ISO format'
            }),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
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
            })
    }),

    // Statistics schema
    statistics: Joi.object({
        startDate: Joi.date().iso().optional()
            .messages({
                'date.base': 'Start date must be a valid date',
                'date.format': 'Start date must be in ISO format'
            }),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
            .messages({
                'date.base': 'End date must be a valid date',
                'date.format': 'End date must be in ISO format',
                'date.min': 'End date must be after start date'
            }),
        teacherId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Teacher ID must be a number',
                'number.integer': 'Teacher ID must be an integer',
                'number.positive': 'Teacher ID must be positive'
            }),
        classId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Class ID must be a number',
                'number.integer': 'Class ID must be an integer',
                'number.positive': 'Class ID must be positive'
            }),
        subjectId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Subject ID must be a number',
                'number.integer': 'Subject ID must be an integer',
                'number.positive': 'Subject ID must be positive'
            }),
        type: Joi.string().valid('HOMEWORK', 'PROJECT', 'QUIZ', 'EXAM', 'LAB_REPORT', 'ESSAY', 'PRESENTATION', 'RESEARCH_PAPER', 'OTHER').optional()
            .messages({
                'string.base': 'Type must be a string',
                'any.only': 'Type must be one of: HOMEWORK, PROJECT, QUIZ, EXAM, LAB_REPORT, ESSAY, PRESENTATION, RESEARCH_PAPER, OTHER'
            }),
        groupBy: Joi.string().valid('day', 'week', 'month', 'quarter', 'year', 'teacher', 'class', 'subject', 'type').optional()
            .messages({
                'string.base': 'Group by must be a string',
                'any.only': 'Group by must be one of: day, week, month, quarter, year, teacher, class, subject, type'
            })
    }),

    // Upcoming assignments schema
    upcoming: Joi.object({
        days: Joi.number().integer().min(1).max(365).default(7)
            .messages({
                'number.base': 'Days must be a number',
                'number.integer': 'Days must be an integer',
                'number.min': 'Days must be at least 1',
                'number.max': 'Days cannot exceed 365'
            }),
        teacherId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Teacher ID must be a number',
                'number.integer': 'Teacher ID must be an integer',
                'number.positive': 'Teacher ID must be positive'
            }),
        classId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Class ID must be a number',
                'number.integer': 'Class ID must be an integer',
                'number.positive': 'Class ID must be positive'
            }),
        subjectId: Joi.number().integer().positive().optional()
            .messages({
                'number.base': 'Subject ID must be a number',
                'number.integer': 'Subject ID must be an integer',
                'number.positive': 'Subject ID must be positive'
            }),
        priority: Joi.string().valid('LOW', 'MEDIUM', 'HIGH', 'URGENT').optional()
            .messages({
                'string.base': 'Priority must be a string',
                'any.only': 'Priority must be one of: LOW, MEDIUM, HIGH, URGENT'
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
            })
    })
};

/**
 * Validation functions
 */
export const validateAssignment = (data) => {
    const { error, value } = assignmentSchemas.create.validate(data, { abortEarly: false });
    return {
        isValid: !error,
        errors: error ? error.details.map(detail => detail.message) : [],
        value
    };
};

export const validateAssignmentUpdate = (data) => {
    const { error, value } = assignmentSchemas.update.validate(data, { abortEarly: false });
    return {
        isValid: !error,
        errors: error ? error.details.map(detail => detail.message) : [],
        value
    };
};

export const validateAssignmentFilters = (filters) => {
    const { error, value } = assignmentSchemas.filters.validate(filters, { abortEarly: false });
    return {
        isValid: !error,
        errors: error ? error.details.map(detail => detail.message) : [],
        value
    };
};

export const validateAssignmentSearch = (searchTerm, filters) => {
    const searchData = { q: searchTerm, ...filters };
    const { error, value } = assignmentSchemas.search.validate(searchData, { abortEarly: false });
    return {
        isValid: !error,
        errors: error ? error.details.map(detail => detail.message) : [],
        value
    };
};

export const validateAssignmentStatistics = (filters) => {
    const { error, value } = assignmentSchemas.statistics.validate(filters, { abortEarly: false });
    return {
        isValid: !error,
        errors: error ? error.details.map(detail => detail.message) : [],
        value
    };
};

export const validateUpcomingAssignments = (filters) => {
    const { error, value } = assignmentSchemas.upcoming.validate(filters, { abortEarly: false });
    return {
        isValid: !error,
        errors: error ? error.details.map(detail => detail.message) : [],
        value
    };
};

export default {
    validateAssignment,
    validateAssignmentUpdate,
    validateAssignmentFilters,
    validateAssignmentSearch,
    validateAssignmentStatistics,
    validateUpcomingAssignments,
    assignmentSchemas
};
import { PrismaClient } from '../generated/prisma/client.js';
import logger from '../config/logger.js';
import { formatResponse, handleError } from '../utils/responseUtils.js';

const prisma = new PrismaClient();

// ======================
// AUTOMATION TYPES FOR SCHOOLS
// ======================
const AUTOMATION_TYPES = {
  // Enrollment Automations
  ENROLLMENT_REMINDER: 'enrollment_reminder',
  ENROLLMENT_CONFIRMATION: 'enrollment_confirmation',
  ENROLLMENT_FOLLOW_UP: 'enrollment_follow_up',
  
  // Payment Automations
  PAYMENT_REMINDER: 'payment_reminder',
  PAYMENT_OVERDUE: 'payment_overdue',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  
  // Academic Automations
  CLASS_SCHEDULE: 'class_schedule',
  EXAM_REMINDER: 'exam_reminder',
  GRADE_NOTIFICATION: 'grade_notification',
  ATTENDANCE_ALERT: 'attendance_alert',
  
  // Communication Automations
  WELCOME_MESSAGE: 'welcome_message',
  BIRTHDAY_WISH: 'birthday_wish',
  HOLIDAY_GREETING: 'holiday_greeting',
  NEWSLETTER: 'newsletter',
  
  // Support Automations
  SUPPORT_TICKET: 'support_ticket',
  FEEDBACK_REQUEST: 'feedback_request',
  SURVEY_INVITATION: 'survey_invitation',
  
  // Marketing Automations
  OPEN_HOUSE_INVITATION: 'open_house_invitation',
  COURSE_PROMOTION: 'course_promotion',
  REFERRAL_PROGRAM: 'referral_program',
  
  // Administrative Automations
  DOCUMENT_EXPIRY: 'document_expiry',
  CONTRACT_RENEWAL: 'contract_renewal',
  STAFF_ASSIGNMENT: 'staff_assignment'
};

// ======================
// TRIGGER CONDITIONS
// ======================
const TRIGGER_CONDITIONS = {
  // Time-based triggers
  ON_ENROLLMENT: 'on_enrollment',
  ON_PAYMENT: 'on_payment',
  ON_ATTENDANCE: 'on_attendance',
  ON_GRADE: 'on_grade',
  ON_DOCUMENT_UPLOAD: 'on_document_upload',
  ON_STATUS_CHANGE: 'on_status_change',
  
  // Schedule-based triggers
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM_SCHEDULE: 'custom_schedule',
  
  // Event-based triggers
  ON_BIRTHDAY: 'on_birthday',
  ON_ANNIVERSARY: 'on_anniversary',
  ON_HOLIDAY: 'on_holiday',
  ON_EXAM_DATE: 'on_exam_date',
  ON_CLASS_START: 'on_class_start'
};

// ======================
// ACTION TYPES
// ======================
const ACTION_TYPES = {
  SEND_EMAIL: 'send_email',
  SEND_SMS: 'send_sms',
  SEND_PUSH_NOTIFICATION: 'send_push_notification',
  CREATE_TASK: 'create_task',
  CREATE_TICKET: 'create_ticket',
  UPDATE_STATUS: 'update_status',
  ASSIGN_STAFF: 'assign_staff',
  SCHEDULE_FOLLOW_UP: 'schedule_follow_up',
  GENERATE_REPORT: 'generate_report',
  EXPORT_DATA: 'export_data',
  SEND_REMINDER: 'send_reminder',
  CREATE_APPOINTMENT: 'create_appointment'
};

class CustomerAutomationController {
  // ======================
  // GET CUSTOMER AUTOMATIONS
  // ======================
  async getCustomerAutomations(req, res) {
    try {
      const { id } = req.params;
      const { schoolId } = req.user;
      const { status, type, active } = req.query;

      const whereClause = {
        customerId: BigInt(id),
        schoolId: BigInt(schoolId)
      };

      if (status) whereClause.status = status;
      if (type) whereClause.type = type;
      if (active !== undefined) whereClause.isActive = active === 'true';

      const automations = await prisma.customerAutomation.findMany({
        where: whereClause,
        include: {
          triggers: true,
          actions: true,
          customer: {
            include: {
              user: true
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return formatResponse(res, {
        success: true,
        message: 'Customer automations retrieved successfully',
        data: automations,
        meta: {
          total: automations.length,
          customerId: parseInt(id)
        }
      });

    } catch (error) {
      logger.error('Get customer automations error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // CREATE AUTOMATION
  // ======================
  async createAutomation(req, res) {
    try {
      const { id } = req.params;
      const { schoolId, id: userId } = req.user;
      const automationData = req.body;

      // Validate automation data
      if (!automationData.name || !automationData.type || !automationData.triggers || !automationData.actions) {
        return formatResponse(res, {
          success: false,
          message: 'Missing required fields: name, type, triggers, actions',
          data: null
        }, 400);
      }

      // Create automation with triggers and actions
      const automation = await prisma.$transaction(async (tx) => {
        // Create main automation
        const automation = await tx.customerAutomation.create({
          data: {
            customerId: BigInt(id),
            schoolId: BigInt(schoolId),
            name: automationData.name,
            description: automationData.description,
            type: automationData.type,
            status: automationData.status || 'ACTIVE',
            isActive: automationData.isActive !== false,
            priority: automationData.priority || 'MEDIUM',
            conditions: automationData.conditions || {},
            settings: automationData.settings || {},
            createdBy: BigInt(userId)
          }
        });

        // Create triggers
        if (automationData.triggers && automationData.triggers.length > 0) {
          const triggers = automationData.triggers.map(trigger => ({
            automationId: automation.id,
            type: trigger.type,
            condition: trigger.condition,
            schedule: trigger.schedule,
            parameters: trigger.parameters || {},
            isActive: trigger.isActive !== false
          }));

          await tx.automationTrigger.createMany({
            data: triggers
          });
        }

        // Create actions
        if (automationData.actions && automationData.actions.length > 0) {
          const actions = automationData.actions.map(action => ({
            automationId: automation.id,
            type: action.type,
            parameters: action.parameters || {},
            order: action.order || 1,
            isActive: action.isActive !== false,
            delay: action.delay || 0
          }));

          await tx.automationAction.createMany({
            data: actions
          });
        }

        return automation;
      });

      // Get the complete automation with triggers and actions
      const completeAutomation = await prisma.customerAutomation.findUnique({
        where: { id: automation.id },
        include: {
          triggers: true,
          actions: true,
          customer: {
            include: {
              user: true
            }
          }
        }
      });

      return formatResponse(res, {
        success: true,
        message: 'Automation created successfully',
        data: completeAutomation,
        meta: {
          automationId: automation.id,
          customerId: parseInt(id)
        }
      }, 201);

    } catch (error) {
      logger.error('Create automation error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET AUTOMATION BY ID
  // ======================
  async getAutomationById(req, res) {
    try {
      const { id, automationId } = req.params;
      const { schoolId } = req.user;

      const automation = await prisma.customerAutomation.findFirst({
        where: {
          id: BigInt(automationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        },
        include: {
          triggers: true,
          actions: true,
          customer: {
            include: {
              user: true
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          },
          executions: {
            orderBy: { createdAt: 'desc' },
            take: 10
          }
        }
      });

      if (!automation) {
        return formatResponse(res, {
          success: false,
          message: 'Automation not found',
          data: null
        }, 404);
      }

      return formatResponse(res, {
        success: true,
        message: 'Automation retrieved successfully',
        data: automation
      });

    } catch (error) {
      logger.error('Get automation by ID error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // UPDATE AUTOMATION
  // ======================
  async updateAutomation(req, res) {
    try {
      const { id, automationId } = req.params;
      const { schoolId, id: userId } = req.user;
      const updateData = req.body;

      // Check if automation exists
      const existingAutomation = await prisma.customerAutomation.findFirst({
        where: {
          id: BigInt(automationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        }
      });

      if (!existingAutomation) {
        return formatResponse(res, {
          success: false,
          message: 'Automation not found',
          data: null
        }, 404);
      }

      // Update automation
      const automation = await prisma.$transaction(async (tx) => {
        // Update main automation
        const updatedAutomation = await tx.customerAutomation.update({
          where: { id: BigInt(automationId) },
          data: {
            name: updateData.name,
            description: updateData.description,
            status: updateData.status,
            isActive: updateData.isActive,
            priority: updateData.priority,
            conditions: updateData.conditions,
            settings: updateData.settings,
            updatedBy: BigInt(userId)
          }
        });

        // Update triggers if provided
        if (updateData.triggers) {
          // Delete existing triggers
          await tx.automationTrigger.deleteMany({
            where: { automationId: BigInt(automationId) }
          });

          // Create new triggers
          if (updateData.triggers.length > 0) {
            const triggers = updateData.triggers.map(trigger => ({
              automationId: BigInt(automationId),
              type: trigger.type,
              condition: trigger.condition,
              schedule: trigger.schedule,
              parameters: trigger.parameters || {},
              isActive: trigger.isActive !== false
            }));

            await tx.automationTrigger.createMany({
              data: triggers
            });
          }
        }

        // Update actions if provided
        if (updateData.actions) {
          // Delete existing actions
          await tx.automationAction.deleteMany({
            where: { automationId: BigInt(automationId) }
          });

          // Create new actions
          if (updateData.actions.length > 0) {
            const actions = updateData.actions.map(action => ({
              automationId: BigInt(automationId),
              type: action.type,
              parameters: action.parameters || {},
              order: action.order || 1,
              isActive: action.isActive !== false,
              delay: action.delay || 0
            }));

            await tx.automationAction.createMany({
              data: actions
            });
          }
        }

        return updatedAutomation;
      });

      return formatResponse(res, {
        success: true,
        message: 'Automation updated successfully',
        data: automation
      });

    } catch (error) {
      logger.error('Update automation error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // DELETE AUTOMATION
  // ======================
  async deleteAutomation(req, res) {
    try {
      const { id, automationId } = req.params;
      const { schoolId } = req.user;

      const automation = await prisma.customerAutomation.findFirst({
        where: {
          id: BigInt(automationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        }
      });

      if (!automation) {
        return formatResponse(res, {
          success: false,
          message: 'Automation not found',
          data: null
        }, 404);
      }

      // Delete automation and related data
      await prisma.$transaction(async (tx) => {
        await tx.automationExecution.deleteMany({
          where: { automationId: BigInt(automationId) }
        });
        await tx.automationAction.deleteMany({
          where: { automationId: BigInt(automationId) }
        });
        await tx.automationTrigger.deleteMany({
          where: { automationId: BigInt(automationId) }
        });
        await tx.customerAutomation.delete({
          where: { id: BigInt(automationId) }
        });
      });

      return formatResponse(res, {
        success: true,
        message: 'Automation deleted successfully',
        data: null
      });

    } catch (error) {
      logger.error('Delete automation error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // ACTIVATE/DEACTIVATE AUTOMATION
  // ======================
  async activateAutomation(req, res) {
    try {
      const { id, automationId } = req.params;
      const { schoolId } = req.user;

      const automation = await prisma.customerAutomation.updateMany({
        where: {
          id: BigInt(automationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        },
        data: { isActive: true }
      });

      if (automation.count === 0) {
        return formatResponse(res, {
          success: false,
          message: 'Automation not found',
          data: null
        }, 404);
      }

      return formatResponse(res, {
        success: true,
        message: 'Automation activated successfully',
        data: null
      });

    } catch (error) {
      logger.error('Activate automation error:', error);
      return handleError(res, error);
    }
  }

  async deactivateAutomation(req, res) {
    try {
      const { id, automationId } = req.params;
      const { schoolId } = req.user;

      const automation = await prisma.customerAutomation.updateMany({
        where: {
          id: BigInt(automationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId)
        },
        data: { isActive: false }
      });

      if (automation.count === 0) {
        return formatResponse(res, {
          success: false,
          message: 'Automation not found',
          data: null
        }, 404);
      }

      return formatResponse(res, {
        success: true,
        message: 'Automation deactivated successfully',
        data: null
      });

    } catch (error) {
      logger.error('Deactivate automation error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET AUTOMATION TEMPLATES
  // ======================
  async getAutomationTemplates(req, res) {
    try {
      const { schoolId } = req.user;
      const { category } = req.query;

      const templates = [
        // Enrollment Templates
        {
          id: 'enrollment_welcome',
          name: 'Welcome New Student',
          description: 'Automatically send welcome message and enrollment confirmation',
          category: 'enrollment',
          type: AUTOMATION_TYPES.ENROLLMENT_CONFIRMATION,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.ON_ENROLLMENT,
              condition: 'customer.status === "enrolled"'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'welcome_email',
                subject: 'Welcome to Our School!'
              },
              order: 1
            },
            {
              type: ACTION_TYPES.CREATE_TASK,
              parameters: {
                title: 'Follow up with new student',
                description: 'Schedule initial meeting',
                assignTo: 'admissions_team'
              },
              order: 2,
              delay: 86400 // 24 hours
            }
          ]
        },
        {
          id: 'enrollment_reminder',
          name: 'Enrollment Reminder',
          description: 'Send reminders for incomplete enrollments',
          category: 'enrollment',
          type: AUTOMATION_TYPES.ENROLLMENT_REMINDER,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.CUSTOM_SCHEDULE,
              schedule: '0 9 * * 1', // Every Monday at 9 AM
              condition: 'customer.status === "pending" && daysSinceCreated > 7'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'enrollment_reminder',
                subject: 'Complete Your Enrollment'
              },
              order: 1
            },
            {
              type: ACTION_TYPES.SEND_SMS,
              parameters: {
                message: 'Hi {name}, please complete your enrollment. Call us at {phone}'
              },
              order: 2
            }
          ]
        },

        // Payment Templates
        {
          id: 'payment_reminder',
          name: 'Payment Reminder',
          description: 'Send payment reminders before due date',
          category: 'payment',
          type: AUTOMATION_TYPES.PAYMENT_REMINDER,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.CUSTOM_SCHEDULE,
              schedule: '0 10 * * *', // Daily at 10 AM
              condition: 'payment.dueDate <= 7 && payment.status !== "paid"'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'payment_reminder',
                subject: 'Payment Due Soon'
              },
              order: 1
            }
          ]
        },
        {
          id: 'payment_overdue',
          name: 'Payment Overdue Alert',
          description: 'Handle overdue payments with escalation',
          category: 'payment',
          type: AUTOMATION_TYPES.PAYMENT_OVERDUE,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.CUSTOM_SCHEDULE,
              schedule: '0 9 * * *', // Daily at 9 AM
              condition: 'payment.dueDate < today && payment.status !== "paid"'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'payment_overdue',
                subject: 'Payment Overdue - Action Required'
              },
              order: 1
            },
            {
              type: ACTION_TYPES.CREATE_TASK,
              parameters: {
                title: 'Follow up on overdue payment',
                description: 'Contact customer about overdue payment',
                assignTo: 'finance_team'
              },
              order: 2
            },
            {
              type: ACTION_TYPES.UPDATE_STATUS,
              parameters: {
                status: 'payment_overdue'
              },
              order: 3
            }
          ]
        },

        // Academic Templates
        {
          id: 'class_schedule',
          name: 'Class Schedule Notification',
          description: 'Notify students about upcoming classes',
          category: 'academic',
          type: AUTOMATION_TYPES.CLASS_SCHEDULE,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.CUSTOM_SCHEDULE,
              schedule: '0 8 * * *', // Daily at 8 AM
              condition: 'hasUpcomingClass && classTime <= 24'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_PUSH_NOTIFICATION,
              parameters: {
                title: 'Upcoming Class',
                message: 'You have a class in {hours} hours'
              },
              order: 1
            }
          ]
        },
        {
          id: 'exam_reminder',
          name: 'Exam Reminder',
          description: 'Send exam reminders and preparation tips',
          category: 'academic',
          type: AUTOMATION_TYPES.EXAM_REMINDER,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.CUSTOM_SCHEDULE,
              schedule: '0 9 * * *', // Daily at 9 AM
              condition: 'examDate <= 7 && examDate > today'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'exam_reminder',
                subject: 'Exam Reminder - {examName}'
              },
              order: 1
            },
            {
              type: ACTION_TYPES.SEND_SMS,
              parameters: {
                message: 'Exam reminder: {examName} on {examDate}. Good luck!'
              },
              order: 2
            }
          ]
        },

        // Communication Templates
        {
          id: 'birthday_wish',
          name: 'Birthday Wish',
          description: 'Send birthday wishes to students',
          category: 'communication',
          type: AUTOMATION_TYPES.BIRTHDAY_WISH,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.ON_BIRTHDAY,
              condition: 'customer.birthDate === today'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'birthday_wish',
                subject: 'Happy Birthday, {name}!'
              },
              order: 1
            },
            {
              type: ACTION_TYPES.SEND_SMS,
              parameters: {
                message: 'Happy Birthday, {name}! 🎉'
              },
              order: 2
            }
          ]
        },
        {
          id: 'holiday_greeting',
          name: 'Holiday Greeting',
          description: 'Send holiday greetings to students and families',
          category: 'communication',
          type: AUTOMATION_TYPES.HOLIDAY_GREETING,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.ON_HOLIDAY,
              condition: 'isHoliday'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'holiday_greeting',
                subject: 'Happy {holiday}!'
              },
              order: 1
            }
          ]
        },

        // Support Templates
        {
          id: 'support_follow_up',
          name: 'Support Follow-up',
          description: 'Follow up on support tickets',
          category: 'support',
          type: AUTOMATION_TYPES.SUPPORT_TICKET,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.ON_STATUS_CHANGE,
              condition: 'ticket.status === "open" && daysSinceCreated > 3'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'support_follow_up',
                subject: 'Update on Your Support Request'
              },
              order: 1
            },
            {
              type: ACTION_TYPES.CREATE_TASK,
              parameters: {
                title: 'Escalate support ticket',
                description: 'Ticket {ticketId} needs attention',
                assignTo: 'support_team'
              },
              order: 2
            }
          ]
        },

        // Marketing Templates
        {
          id: 'open_house_invitation',
          name: 'Open House Invitation',
          description: 'Invite prospects to open house events',
          category: 'marketing',
          type: AUTOMATION_TYPES.OPEN_HOUSE_INVITATION,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.CUSTOM_SCHEDULE,
              schedule: '0 10 * * 1', // Every Monday at 10 AM
              condition: 'customer.status === "prospect" && hasOpenHouseEvent'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'open_house_invitation',
                subject: 'You\'re Invited to Our Open House!'
              },
              order: 1
            },
            {
              type: ACTION_TYPES.CREATE_TASK,
              parameters: {
                title: 'Follow up on open house invitation',
                description: 'Call prospect about open house',
                assignTo: 'admissions_team'
              },
              order: 2,
              delay: 86400 // 24 hours
            }
          ]
        },

        // Administrative Templates
        {
          id: 'document_expiry',
          name: 'Document Expiry Alert',
          description: 'Alert about expiring documents',
          category: 'administrative',
          type: AUTOMATION_TYPES.DOCUMENT_EXPIRY,
          triggers: [
            {
              type: TRIGGER_CONDITIONS.CUSTOM_SCHEDULE,
              schedule: '0 9 * * *', // Daily at 9 AM
              condition: 'document.expiryDate <= 30 && document.expiryDate > today'
            }
          ],
          actions: [
            {
              type: ACTION_TYPES.SEND_EMAIL,
              parameters: {
                template: 'document_expiry',
                subject: 'Document Expiry Alert - {documentName}'
              },
              order: 1
            },
            {
              type: ACTION_TYPES.CREATE_TASK,
              parameters: {
                title: 'Renew expiring document',
                description: 'Document {documentName} expires on {expiryDate}',
                assignTo: 'admin_team'
              },
              order: 2
            }
          ]
        }
      ];

      // Filter by category if provided
      const filteredTemplates = category 
        ? templates.filter(template => template.category === category)
        : templates;

      return formatResponse(res, {
        success: true,
        message: 'Automation templates retrieved successfully',
        data: filteredTemplates,
        meta: {
          total: filteredTemplates.length,
          categories: [...new Set(templates.map(t => t.category))]
        }
      });

    } catch (error) {
      logger.error('Get automation templates error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // EXECUTE AUTOMATION
  // ======================
  async executeAutomation(req, res) {
    try {
      const { id, automationId } = req.params;
      const { schoolId } = req.user;
      const { triggerData } = req.body;

      // Get automation with triggers and actions
      const automation = await prisma.customerAutomation.findFirst({
        where: {
          id: BigInt(automationId),
          customerId: BigInt(id),
          schoolId: BigInt(schoolId),
          isActive: true
        },
        include: {
          triggers: true,
          actions: {
            orderBy: { order: 'asc' }
          },
          customer: {
            include: {
              user: true
            }
          }
        }
      });

      if (!automation) {
        return formatResponse(res, {
          success: false,
          message: 'Automation not found or inactive',
          data: null
        }, 404);
      }

      // Check if triggers are met
      const shouldExecute = await this.checkTriggers(automation.triggers, triggerData);
      
      if (!shouldExecute) {
        return formatResponse(res, {
          success: false,
          message: 'Automation triggers not met',
          data: null
        }, 400);
      }

      // Execute automation
      const execution = await prisma.$transaction(async (tx) => {
        // Create execution record
        const execution = await tx.automationExecution.create({
          data: {
            automationId: BigInt(automationId),
            customerId: BigInt(id),
            schoolId: BigInt(schoolId),
            status: 'RUNNING',
            triggerData: triggerData || {},
            startedAt: new Date()
          }
        });

        // Execute actions
        const results = [];
        for (const action of automation.actions) {
          try {
            const result = await this.executeAction(action, automation.customer, triggerData);
            results.push({
              actionId: action.id,
              type: action.type,
              success: true,
              result
            });
          } catch (error) {
            results.push({
              actionId: action.id,
              type: action.type,
              success: false,
              error: error.message
            });
          }
        }

        // Update execution record
        await tx.automationExecution.update({
          where: { id: execution.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            results: results
          }
        });

        return execution;
      });

      return formatResponse(res, {
        success: true,
        message: 'Automation executed successfully',
        data: execution
      });

    } catch (error) {
      logger.error('Execute automation error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // GET AUTOMATION ANALYTICS
  // ======================
  async getAutomationAnalytics(req, res) {
    try {
      const { schoolId } = req.user;
      const { period = '30d', customerId } = req.query;

      const whereClause = {
        schoolId: BigInt(schoolId)
      };

      if (customerId) {
        whereClause.customerId = BigInt(customerId);
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      whereClause.createdAt = {
        gte: startDate,
        lte: endDate
      };

      // Get execution statistics
      const executions = await prisma.automationExecution.findMany({
        where: whereClause,
        include: {
          automation: {
            select: {
              id: true,
              name: true,
              type: true
            }
          }
        }
      });

      // Calculate analytics
      const analytics = {
        totalExecutions: executions.length,
        successfulExecutions: executions.filter(e => e.status === 'COMPLETED').length,
        failedExecutions: executions.filter(e => e.status === 'FAILED').length,
        averageExecutionTime: 0,
        topAutomations: [],
        executionTrend: [],
        actionTypeBreakdown: {}
      };

      // Calculate average execution time
      const completedExecutions = executions.filter(e => e.status === 'COMPLETED' && e.completedAt);
      if (completedExecutions.length > 0) {
        const totalTime = completedExecutions.reduce((sum, e) => {
          return sum + (new Date(e.completedAt) - new Date(e.startedAt));
        }, 0);
        analytics.averageExecutionTime = totalTime / completedExecutions.length;
      }

      // Get top automations
      const automationCounts = {};
      executions.forEach(e => {
        const automationName = e.automation?.name || 'Unknown';
        automationCounts[automationName] = (automationCounts[automationName] || 0) + 1;
      });

      analytics.topAutomations = Object.entries(automationCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get execution trend (daily)
      const dailyExecutions = {};
      executions.forEach(e => {
        const date = e.createdAt.toISOString().split('T')[0];
        dailyExecutions[date] = (dailyExecutions[date] || 0) + 1;
      });

      analytics.executionTrend = Object.entries(dailyExecutions)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return formatResponse(res, {
        success: true,
        message: 'Automation analytics retrieved successfully',
        data: analytics,
        meta: {
          period,
          customerId: customerId ? parseInt(customerId) : null
        }
      });

    } catch (error) {
      logger.error('Get automation analytics error:', error);
      return handleError(res, error);
    }
  }

  // ======================
  // HELPER METHODS
  // ======================
  async checkTriggers(triggers, triggerData) {
    // This is a simplified trigger checking logic
    // In a real implementation, you would have more sophisticated trigger evaluation
    return triggers.some(trigger => trigger.isActive);
  }

  async executeAction(action, customer, triggerData) {
    // This is a simplified action execution
    // In a real implementation, you would have proper action handlers
    switch (action.type) {
      case ACTION_TYPES.SEND_EMAIL:
        return await this.sendEmail(action.parameters, customer);
      case ACTION_TYPES.SEND_SMS:
        return await this.sendSMS(action.parameters, customer);
      case ACTION_TYPES.CREATE_TASK:
        return await this.createTask(action.parameters, customer);
      case ACTION_TYPES.UPDATE_STATUS:
        return await this.updateStatus(action.parameters, customer);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  async sendEmail(parameters, customer) {
    // Implement email sending logic
    logger.info(`Sending email to ${customer.user?.email} with template: ${parameters.template}`);
    return { success: true, messageId: 'mock-message-id' };
  }

  async sendSMS(parameters, customer) {
    // Implement SMS sending logic
    logger.info(`Sending SMS to ${customer.user?.phone} with message: ${parameters.message}`);
    return { success: true, messageId: 'mock-sms-id' };
  }

  async createTask(parameters, customer) {
    // Implement task creation logic
    logger.info(`Creating task for customer ${customer.id}: ${parameters.title}`);
    return { success: true, taskId: 'mock-task-id' };
  }

  async updateStatus(parameters, customer) {
    // Implement status update logic
    logger.info(`Updating status for customer ${customer.id} to: ${parameters.status}`);
    return { success: true, previousStatus: customer.status };
  }
}

export default new CustomerAutomationController(); 
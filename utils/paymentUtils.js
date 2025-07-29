import Joi from 'joi';
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Payment validation schemas
const paymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  discount: Joi.number().min(0).default(0),
  fine: Joi.number().min(0).default(0),
  total: Joi.number().positive().required(),
  paymentDate: Joi.date().required(),
  dueDate: Joi.date().optional(),
  status: Joi.string().valid('PAID', 'UNPAID', 'PARTIALLY_PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED', 'PENDING', 'FAILED', 'PROCESSING', 'DISPUTED', 'VOIDED').required(),
  method: Joi.string().valid('CASH', 'CARD', 'BANK_TRANSFER', 'MOBILE_PAYMENT', 'CHECK', 'SCHOLARSHIP', 'CRYPTO', 'DIGITAL_WALLET', 'INSTALLMENT', 'GRANT').required(),
  type: Joi.string().valid('TUITION_FEE', 'TRANSPORT_FEE', 'LIBRARY_FEE', 'LABORATORY_FEE', 'SPORTS_FEE', 'EXAM_FEE', 'UNIFORM_FEE', 'MEAL_FEE', 'HOSTEL_FEE', 'OTHER').optional(),
  gateway: Joi.string().valid('STRIPE', 'PAYPAL', 'SQUARE', 'RAZORPAY', 'PAYTM', 'CASHFREE', 'CUSTOM').optional(),
  transactionId: Joi.string().max(100).optional(),
  gatewayTransactionId: Joi.string().max(255).optional(),
  receiptNumber: Joi.string().max(50).optional(),
  remarks: Joi.string().max(255).optional(),
  metadata: Joi.object().optional(),
  isRecurring: Joi.boolean().default(false),
  recurringFrequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly').optional(),
  nextPaymentDate: Joi.date().optional(),
  studentId: Joi.number().optional(),
  parentId: Joi.number().optional(),
  feeStructureId: Joi.number().optional(),
  items: Joi.array().items(Joi.object({
    feeItemId: Joi.number().required(),
    amount: Joi.number().positive().required(),
    discount: Joi.number().min(0).default(0),
    fine: Joi.number().min(0).default(0),
    total: Joi.number().positive().required(),
    description: Joi.string().max(255).optional()
  })).optional()
});

const refundSchema = Joi.object({
  paymentId: Joi.number().required(),
  amount: Joi.number().positive().required(),
  reason: Joi.string().max(255).required(),
  remarks: Joi.string().max(255).optional()
});

const installmentSchema = Joi.object({
  paymentId: Joi.number().required(),
  installmentNumber: Joi.number().positive().required(),
  amount: Joi.number().positive().required(),
  dueDate: Joi.date().required(),
  remarks: Joi.string().max(255).optional()
});

// Validation functions
export const validatePaymentData = (data, isUpdate = false) => {
  const schema = isUpdate ? paymentSchema.fork(['amount', 'total', 'paymentDate', 'status', 'method'], (schema) => schema.optional()) : paymentSchema;
  return schema.validate(data);
};

export const validateRefundData = (data) => {
  return refundSchema.validate(data);
};

export const validateInstallmentData = (data) => {
  return installmentSchema.validate(data);
};

// Receipt number generation
export const generateReceiptNumber = async (schoolId) => {
  const year = new Date().getFullYear();
  const prefix = `RCP-${year}-`;
  
  // Get the last receipt number for this school and year
  const lastPayment = await prisma.payment.findFirst({
    where: {
      schoolId: BigInt(schoolId),
      receiptNumber: { startsWith: prefix },
      deletedAt: null
    },
    orderBy: { receiptNumber: 'desc' }
  });

  let sequence = 1;
  if (lastPayment && lastPayment.receiptNumber) {
    const lastSequence = parseInt(lastPayment.receiptNumber.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(6, '0')}`;
};

// Fine calculation
export const calculateFines = async (dueDate, amount) => {
  const today = new Date();
  const due = new Date(dueDate);
  
  if (today <= due) return 0;
  
  const daysLate = Math.ceil((today - due) / (1000 * 60 * 60 * 24));
  const fineRate = 0.01; // 1% per day
  const fine = amount * fineRate * daysLate;
  
  return Math.min(fine, amount * 0.5); // Cap at 50% of amount
};

// Payment log creation
export const createPaymentLog = async (paymentId, action, oldValue, newValue, ipAddress, userAgent, schoolId, userId) => {
  try {
    await prisma.paymentLog.create({
      data: {
        paymentId: BigInt(paymentId),
        action,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )) : null,
        ipAddress,
        userAgent,
        schoolId: BigInt(schoolId),
        createdBy: userId ? BigInt(userId) : null
      }
    });
  } catch (error) {
    console.error('Error creating payment log:', error);
  }
};

// Payment calculations
export const calculatePaymentTotal = (amount, discount = 0, fine = 0) => {
  return amount - discount + fine;
};

export const calculateInstallmentAmount = (totalAmount, numberOfInstallments) => {
  const baseAmount = Math.floor(totalAmount / numberOfInstallments);
  const remainder = totalAmount % numberOfInstallments;
  
  const installments = [];
  for (let i = 0; i < numberOfInstallments; i++) {
    installments.push(baseAmount + (i < remainder ? 1 : 0));
  }
  
  return installments;
};

// Payment status helpers
export const isPaymentOverdue = (dueDate) => {
  return new Date() > new Date(dueDate);
};

export const canRefundPayment = (payment) => {
  return payment.status === 'PAID' && parseFloat(payment.total) > 0;
};

export const canCancelPayment = (payment) => {
  return ['PENDING', 'PROCESSING'].includes(payment.status);
};

// Date utilities
export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const addMonths = (date, months) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

export const addYears = (date, years) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
};

// Recurring payment calculation
export const calculateNextPaymentDate = (currentDate, frequency) => {
  switch (frequency) {
    case 'daily':
      return addDays(currentDate, 1);
    case 'weekly':
      return addDays(currentDate, 7);
    case 'monthly':
      return addMonths(currentDate, 1);
    case 'yearly':
      return addYears(currentDate, 1);
    default:
      return currentDate;
  }
};

// Payment summary calculations
export const calculatePaymentSummary = (payments) => {
  return payments.reduce((summary, payment) => {
    const amount = parseFloat(payment.total);
    
    summary.totalPayments++;
    summary.totalAmount += amount;
    
    switch (payment.status) {
      case 'PAID':
        summary.paidAmount += amount;
        summary.paidCount++;
        break;
      case 'PENDING':
        summary.pendingAmount += amount;
        summary.pendingCount++;
        break;
      case 'OVERDUE':
        summary.overdueAmount += amount;
        summary.overdueCount++;
        break;
      case 'PARTIALLY_PAID':
        summary.partialAmount += amount;
        summary.partialCount++;
        break;
      case 'CANCELLED':
        summary.cancelledAmount += amount;
        summary.cancelledCount++;
        break;
      case 'REFUNDED':
        summary.refundedAmount += amount;
        summary.refundedCount++;
        break;
    }
    
    return summary;
  }, {
    totalPayments: 0,
    totalAmount: 0,
    paidAmount: 0,
    paidCount: 0,
    pendingAmount: 0,
    pendingCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    partialAmount: 0,
    partialCount: 0,
    cancelledAmount: 0,
    cancelledCount: 0,
    refundedAmount: 0,
    refundedCount: 0
  });
};

// Payment method validation
export const validatePaymentMethod = (method, gateway) => {
  const methodGatewayMap = {
    'CARD': ['STRIPE', 'PAYPAL', 'SQUARE'],
    'MOBILE_PAYMENT': ['PAYTM', 'CASHFREE'],
    'BANK_TRANSFER': ['CUSTOM'],
    'CRYPTO': ['CUSTOM'],
    'DIGITAL_WALLET': ['CUSTOM']
  };
  
  if (methodGatewayMap[method]) {
    return methodGatewayMap[method].includes(gateway);
  }
  
  return true; // CASH, CHECK, SCHOLARSHIP don't need gateway validation
};
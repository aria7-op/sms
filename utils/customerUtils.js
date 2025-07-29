import { z } from 'zod';

const BigIntLike = z.union([z.bigint(), z.number(), z.string()]);

export const CustomerCreateSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  gender: z.string().optional(),
  source: z.string().optional(),
  purpose: z.string().optional(),
  department: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdBy: BigIntLike.optional(),
  updatedBy: BigIntLike.optional(),
  serialNumber: z.string().optional(),
  totalSpent: z.number().optional(),
  orderCount: z.number().optional(),
  type: z.string().optional(),
  referredTo: z.enum(['OWNER', 'ADMIN', 'FINANCE', 'ACADEMIC', 'SUPPORT', 'OTHER']).optional(),
  referredById: BigIntLike.optional(),
  schoolId: BigIntLike.optional(),
  ownerId: BigIntLike.optional(),
  pipelineStageId: BigIntLike.optional(),
  createdAt: z.union([z.string(), z.date()]).transform(val => val ? new Date(val) : undefined).optional(),
  updatedAt: z.union([z.string(), z.date()]).transform(val => val ? new Date(val) : undefined).optional(),
  deletedAt: z.union([z.string(), z.date(), z.null()]).transform(val => val ? new Date(val) : null).optional(),
}).passthrough();

export const CustomerUpdateSchema = CustomerCreateSchema;

export function formatCustomerResponse(customer) {
  try {
    return {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      metadata: customer.metadata || {},
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt
    };
  } catch (error) {
    console.error('formatCustomerResponse error:', error);
    return {};
  }
}

export async function validateCustomerData(data, isUpdate = false) {
  try {
    console.log('[validateCustomerData] Input:', data, 'isUpdate:', isUpdate);
    if (isUpdate) {
      CustomerUpdateSchema.parse(data);
    } else {
      CustomerCreateSchema.parse(data);
    }
    return { isValid: true };
  } catch (error) {
    console.error('[validateCustomerData] Validation error:', error.errors || error.message);
    return { 
      isValid: false, 
      errors: error.errors || [error.message] 
    };
  }
}

export const customerUtils = {
  CustomerCreateSchema,
  CustomerUpdateSchema,
  formatCustomerResponse,
  validateCustomerData,
}; 
import { CustomerCreateSchema, CustomerUpdateSchema } from '../utils/customerUtils.js';
import { z } from 'zod';

export const validateCustomerCreate = (req, res, next) => {
  try {
    CustomerCreateSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid customer data', details: error.errors || error.message });
  }
};

export const validateCustomerUpdate = (req, res, next) => {
  try {
    CustomerUpdateSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid customer update data', details: error.errors || error.message });
  }
};

export const validateCustomerId = (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id) || id <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid customer ID' });
    }
    next();
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid customer ID', details: error.message });
  }
};

export const validateCustomerData = (req, res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    req.body = {};
  }
  try {
    CustomerCreateSchema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid customer data', details: error.errors || error.message });
  }
};

const CustomerFilterSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  status: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const validateCustomerFilters = (req, res, next) => {
  try {
    CustomerFilterSchema.parse(req.query);
    next();
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid customer filters', details: error.errors || error.message });
  }
}; 
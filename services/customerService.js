import { PrismaClient } from '../generated/prisma/index.js';
const prisma = new PrismaClient();

export const getAllCustomers = async () => {
  try {
    // Replace with real Prisma query if model exists
    return await prisma.customer.findMany();
  } catch (error) {
    console.error('getAllCustomers error:', error);
    return [];
  }
};

export const getCustomerById = async (id) => {
  try {
    return await prisma.customer.findUnique({ where: { id: Number(id) } });
  } catch (error) {
    console.error('getCustomerById error:', error);
    return null;
  }
};

export const createCustomer = async (data) => {
  try {
    return await prisma.customer.create({ data });
  } catch (error) {
    console.error('createCustomer error:', error);
    return null;
  }
};

export const updateCustomer = async (id, data) => {
  try {
    return await prisma.customer.update({ where: { id: Number(id) }, data });
  } catch (error) {
    console.error('updateCustomer error:', error);
    return null;
  }
};

export const deleteCustomer = async (id) => {
  try {
    return await prisma.customer.delete({ where: { id: Number(id) } });
  } catch (error) {
    console.error('deleteCustomer error:', error);
    return null;
  }
};

export const partialUpdateCustomer = async (id, data) => {
  try {
    return await prisma.customer.update({ where: { id: Number(id) }, data });
  } catch (error) {
    console.error('partialUpdateCustomer error:', error);
    return null;
  }
};

export const customerService = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  partialUpdateCustomer,
}; 
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Helper function to convert BigInt values to strings
const convertBigInts = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(convertBigInts);
  if (typeof obj === 'object') {
    const converted = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigInts(value);
    }
    return converted;
  }
  return obj;
};

export const getAllExpenses = async (req, res) => {
  try {
    console.log('🔍 getAllExpenses called');
    console.log('🔍 req.user:', req.user);
    console.log('🔍 req.headers:', req.headers);
    
    // Safety check for req.user
    if (!req.user) {
      console.error('❌ req.user is undefined in getAllExpenses');
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required - req.user is undefined' 
      });
    }
    
    const { schoolId } = req.user;
    console.log('🔍 schoolId extracted:', schoolId);
    
    // Check if prisma and expense model exist
    if (!prisma || !prisma.expense) {
      console.log('⚠️ Expense model not available in Prisma schema');
      return res.status(501).json({ success: false, message: 'Expense model not configured' });
    }
    
    const expenses = await prisma.expense.findMany({
      where: { schoolId: BigInt(schoolId) },
      orderBy: { date: 'desc' }
    });
    
    res.json({ success: true, data: convertBigInts(expenses) });
  } catch (error) {
    console.error('❌ Get expenses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expenses', error: error.message });
  }
};

export const getExpenseById = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    
    if (!prisma || !prisma.expense) {
      return res.status(404).json({ success: false, message: 'Expense model not configured' });
    }
    
    // Validate ID
    if (!id || isNaN(id) || !Number.isInteger(Number(id))) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }
    
    const expense = await prisma.expense.findFirst({
      where: { id: BigInt(id), schoolId: BigInt(schoolId) }
    });
    
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    
    res.json({ success: true, data: convertBigInts(expense) });
  } catch (error) {
    console.error('❌ Get expense by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expense', error: error.message });
  }
};

export const createExpense = async (req, res) => {
  try {
    const { schoolId, id: userId } = req.user;
    const { title, description, amount, category, date } = req.body;
    
    if (!prisma || !prisma.expense) {
      return res.status(501).json({ success: false, message: 'Expense model not configured' });
    }
    
    // Validate required fields
    if (!title || !amount || !category || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: title, amount, category, date' 
      });
    }
    
    const expense = await prisma.expense.create({
      data: { 
        title, 
        description, 
        amount: parseFloat(amount), 
        category, 
        date: new Date(date), 
        status: 'PENDING',
        schoolId: BigInt(schoolId),
        createdBy: BigInt(userId),
        updatedBy: BigInt(userId)
      }
    });
    
    res.status(201).json({ success: true, data: convertBigInts(expense) });
  } catch (error) {
    console.error('❌ Create expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to create expense', error: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    const { schoolId, id: userId } = req.user;
    const { id } = req.params;
    const { title, description, amount, category, date, status } = req.body;
    
    if (!prisma || !prisma.expense) {
      return res.status(501).json({ success: false, message: 'Expense model not configured' });
    }
    
    if (!id || isNaN(id) || !Number.isInteger(Number(id))) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }
    
    const expense = await prisma.expense.update({
      where: { id: BigInt(id), schoolId: BigInt(schoolId) },
      data: { 
        title, 
        description, 
        amount: amount ? parseFloat(amount) : undefined, 
        category, 
        date: date ? new Date(date) : undefined, 
        status,
        updatedBy: BigInt(userId)
      }
    });
    
    res.json({ success: true, data: convertBigInts(expense) });
  } catch (error) {
    console.error('❌ Update expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to update expense', error: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    
    if (!prisma || !prisma.expense) {
      return res.status(501).json({ success: false, message: 'Expense model not configured' });
    }
    
    if (!id || isNaN(id) || !Number.isInteger(Number(id))) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }
    
    await prisma.expense.delete({
      where: { id: BigInt(id), schoolId: BigInt(schoolId) }
    });
    
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('❌ Delete expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete expense', error: error.message });
  }
};

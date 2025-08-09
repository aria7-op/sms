import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllExpenses = async (req, res) => {
  try {
    // Check if prisma and expense model exist
    if (!prisma || !prisma.expense) {
      console.log('⚠️ Expense model not available in Prisma schema');
      return res.json({ success: true, data: [], message: 'Expense model not configured' });
    }
    
    const expenses = await prisma.expense.findMany();
    res.json({ success: true, data: expenses });
  } catch (error) {
    console.error('❌ Get expenses error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expenses', error: error.message });
  }
};

export const getExpenseById = async (req, res) => {
  try {
    if (!prisma || !prisma.expense) {
      return res.status(404).json({ success: false, message: 'Expense model not configured' });
    }
    
    const { id } = req.params;
    
    // Validate ID
    if (!id || isNaN(id) || !Number.isInteger(Number(id))) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }
    
    const expense = await prisma.expense.findUnique({
      where: { id: BigInt(id) }
    });
    
    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }
    
    res.json({ success: true, data: expense });
  } catch (error) {
    console.error('❌ Get expense by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch expense', error: error.message });
  }
};

export const createExpense = async (req, res) => {
  try {
    if (!prisma || !prisma.expense) {
      return res.status(501).json({ success: false, message: 'Expense model not configured' });
    }
    
    const { expense_type, amount, added_by } = req.body;
    const expense = await prisma.expense.create({
      data: { expense_type, amount, added_by: added_by ? BigInt(added_by) : null }
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error) {
    console.error('❌ Create expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to create expense', error: error.message });
  }
};

export const updateExpense = async (req, res) => {
  try {
    if (!prisma || !prisma.expense) {
      return res.status(501).json({ success: false, message: 'Expense model not configured' });
    }
    
    const { id } = req.params;
    if (!id || isNaN(id) || !Number.isInteger(Number(id))) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }
    
    const { expense_type, amount, added_by } = req.body;
    const expense = await prisma.expense.update({
      where: { id: BigInt(id) },
      data: { expense_type, amount, added_by: added_by ? BigInt(added_by) : null }
    });
    res.json({ success: true, data: expense });
  } catch (error) {
    console.error('❌ Update expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to update expense', error: error.message });
  }
};

export const deleteExpense = async (req, res) => {
  try {
    if (!prisma || !prisma.expense) {
      return res.status(501).json({ success: false, message: 'Expense model not configured' });
    }
    
    const { id } = req.params;
    if (!id || isNaN(id) || !Number.isInteger(Number(id))) {
      return res.status(400).json({ success: false, message: 'Invalid expense ID' });
    }
    
    await prisma.expense.delete({
      where: { id: BigInt(id) }
    });
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('❌ Delete expense error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete expense', error: error.message });
  }
};

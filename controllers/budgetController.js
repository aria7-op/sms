import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllBudgets = async (req, res) => {
  try {
    if (!prisma || !prisma.budget) {
      console.log('⚠️ Budget model not available in Prisma schema');
      return res.json({ success: true, data: [], message: 'Budget model not configured' });
    }
    
    const budgets = await prisma.budget.findMany();
    res.json({ success: true, data: budgets });
  } catch (error) {
    console.error('❌ Get budgets error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch budgets', error: error.message });
  }
};

export const getBudgetById = async (req, res) => {
  const budget = await prisma.budget.findUnique({
    where: { id: BigInt(req.params.id) }
  });
  if (!budget) return res.status(404).json({ error: 'Budget not found' });
  res.json(budget);
};

export const createBudget = async (req, res) => {
  const { category, allocated_amount, spend_amount, currency, month, notes, added_by } = req.body;
  const budget = await prisma.budget.create({
    data: { category, allocated_amount, spend_amount, currency, month, notes, added_by: added_by ? BigInt(added_by) : null }
  });
  res.status(201).json(budget);
};

export const updateBudget = async (req, res) => {
  const { category, allocated_amount, spend_amount, currency, month, notes, added_by } = req.body;
  const budget = await prisma.budget.update({
    where: { id: BigInt(req.params.id) },
    data: { category, allocated_amount, spend_amount, currency, month, notes, added_by: added_by ? BigInt(added_by) : null }
  });
  res.json(budget);
};

export const deleteBudget = async (req, res) => {
  await prisma.budget.delete({ where: { id: BigInt(req.params.id) } });
  res.json({ message: 'Budget deleted' });
}; 

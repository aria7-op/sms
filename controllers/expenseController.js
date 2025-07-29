import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllExpenses = async (req, res) => {
  const expenses = await prisma.expense.findMany();
  res.json(expenses);
};

export const getExpenseById = async (req, res) => {
  const expense = await prisma.expense.findUnique({
    where: { id: BigInt(req.params.id) }
  });
  if (!expense) return res.status(404).json({ error: 'Expense not found' });
  res.json(expense);
};

export const createExpense = async (req, res) => {
  const { expense_type, amount, added_by } = req.body;
  const expense = await prisma.expense.create({
    data: { expense_type, amount, added_by: added_by ? BigInt(added_by) : null }
  });
  res.status(201).json(expense);
};

export const updateExpense = async (req, res) => {
  const { expense_type, amount, added_by } = req.body;
  const expense = await prisma.expense.update({
    where: { id: BigInt(req.params.id) },
    data: { expense_type, amount, added_by: added_by ? BigInt(added_by) : null }
  });
  res.json(expense);
};

export const deleteExpense = async (req, res) => {
  await prisma.expense.delete({
    where: { id: BigInt(req.params.id) }
  });
  res.status(204).send();
};
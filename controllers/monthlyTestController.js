import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllMonthlyTests = async (req, res) => {
  const monthlyTests = await prisma.monthlyTest.findMany();
  res.json(monthlyTests);
};

export const getMonthlyTestById = async (req, res) => {
  const monthlyTest = await prisma.monthlyTest.findUnique({
    where: { testId: BigInt(req.params.id) }
  });
  if (!monthlyTest) return res.status(404).json({ error: 'MonthlyTest not found' });
  res.json(monthlyTest);
};

export const createMonthlyTest = async (req, res) => {
  const { studentId, subjectId, testDate, score, remarks, teacherId } = req.body;
  const monthlyTest = await prisma.monthlyTest.create({
    data: { studentId: BigInt(studentId), subjectId: BigInt(subjectId), testDate, score, remarks, teacherId: BigInt(teacherId) }
  });
  res.status(201).json(monthlyTest);
};

export const updateMonthlyTest = async (req, res) => {
  const { studentId, subjectId, testDate, score, remarks, teacherId } = req.body;
  const monthlyTest = await prisma.monthlyTest.update({
    where: { testId: BigInt(req.params.id) },
    data: { studentId: BigInt(studentId), subjectId: BigInt(subjectId), testDate, score, remarks, teacherId: BigInt(teacherId) }
  });
  res.json(monthlyTest);
};

export const deleteMonthlyTest = async (req, res) => {
  await prisma.monthlyTest.delete({ where: { testId: BigInt(req.params.id) } });
  res.json({ message: 'MonthlyTest deleted' });
}; 
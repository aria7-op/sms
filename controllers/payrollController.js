import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllPayrolls = async (req, res) => {
  try {
    if (!prisma || !prisma.payroll) {
      console.log('⚠️ Payroll model not available in Prisma schema');
      return res.json({ success: true, data: [], message: 'Payroll model not configured' });
    }
    
    const payrolls = await prisma.payroll.findMany();
    res.json({ success: true, data: payrolls });
  } catch (error) {
    console.error('❌ Get payrolls error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payrolls', error: error.message });
  }
};

export const getPayrollById = async (req, res) => {
  const payroll = await prisma.payroll.findUnique({
    where: { id: BigInt(req.params.id) }
  });
  if (!payroll) return res.status(404).json({ error: 'Payroll not found' });
  res.json(payroll);
};

export const createPayroll = async (req, res) => {
  const { salaryAmount, deduction, netSalary } = req.body;
  const payroll = await prisma.payroll.create({
    data: { salaryAmount, deduction, netSalary }
  });
  res.status(201).json(payroll);
};

export const updatePayroll = async (req, res) => {
  const { salaryAmount, deduction, netSalary } = req.body;
  const payroll = await prisma.payroll.update({
    where: { id: BigInt(req.params.id) },
    data: { salaryAmount, deduction, netSalary }
  });
  res.json(payroll);
};

export const deletePayroll = async (req, res) => {
  await prisma.payroll.delete({ where: { id: BigInt(req.params.id) } });
  res.json({ message: 'Payroll deleted' });
}; 

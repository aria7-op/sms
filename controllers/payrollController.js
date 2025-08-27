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

export const getAllPayrolls = async (req, res) => {
  try {
    const { schoolId } = req.user;
    
    if (!prisma || !prisma.payroll) {
      console.log('⚠️ Payroll model not available in Prisma schema');
      return res.json({ success: true, data: [], message: 'Payroll model not configured' });
    }
    
    const payrolls = await prisma.payroll.findMany({
      where: { schoolId: BigInt(schoolId) },
      include: {
        staff: {
          select: {
            id: true,
            uuid: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        }
      },
      orderBy: { salaryMonth: 'desc' }
    });
    
    res.json({ success: true, data: convertBigInts(payrolls) });
  } catch (error) {
    console.error('❌ Get payrolls error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payrolls', error: error.message });
  }
};

export const getPayrollById = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid payroll ID' });
    }
    
    const payroll = await prisma.payroll.findFirst({
      where: { 
        id: BigInt(id), 
        schoolId: BigInt(schoolId) 
      },
      include: {
        staff: {
          select: {
            id: true,
            uuid: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              }
            }
          }
        }
      }
    });
    
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll not found' });
    }
    
    res.json({ success: true, data: convertBigInts(payroll) });
  } catch (error) {
    console.error('❌ Get payroll by ID error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payroll', error: error.message });
  }
};

export const createPayroll = async (req, res) => {
  try {
    const { schoolId, id: userId } = req.user;
    const { 
      staffId, 
      salaryMonth, 
      basicSalary, 
      allowances, 
      deductions, 
      tax, 
      bonus, 
      netSalary,
      paymentDate,
      status,
      method,
      transactionId,
      remarks 
    } = req.body;
    
    // Validate required fields
    if (!staffId || !salaryMonth || !basicSalary || !netSalary) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: staffId, salaryMonth, basicSalary, netSalary' 
      });
    }
    
    const payroll = await prisma.payroll.create({
      data: {
        staffId: BigInt(staffId),
        salaryMonth: new Date(salaryMonth),
        basicSalary: parseFloat(basicSalary),
        allowances: parseFloat(allowances || 0),
        deductions: parseFloat(deductions || 0),
        tax: parseFloat(tax || 0),
        bonus: parseFloat(bonus || 0),
        netSalary: parseFloat(netSalary),
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        status: status || 'PENDING',
        method: method || 'BANK_TRANSFER',
        transactionId,
        remarks,
        schoolId: BigInt(schoolId),
        createdBy: BigInt(userId),
        updatedBy: BigInt(userId)
      }
    });
    
    res.status(201).json({ success: true, data: convertBigInts(payroll) });
  } catch (error) {
    console.error('❌ Create payroll error:', error);
    res.status(500).json({ success: false, message: 'Failed to create payroll', error: error.message });
  }
};

export const updatePayroll = async (req, res) => {
  try {
    const { schoolId, id: userId } = req.user;
    const { id } = req.params;
    const { 
      staffId, 
      salaryMonth, 
      basicSalary, 
      allowances, 
      deductions, 
      tax, 
      bonus, 
      netSalary,
      paymentDate,
      status,
      method,
      transactionId,
      remarks 
    } = req.body;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid payroll ID' });
    }
    
    const payroll = await prisma.payroll.update({
      where: { 
        id: BigInt(id), 
        schoolId: BigInt(schoolId) 
      },
      data: {
        staffId: staffId ? BigInt(staffId) : undefined,
        salaryMonth: salaryMonth ? new Date(salaryMonth) : undefined,
        basicSalary: basicSalary ? parseFloat(basicSalary) : undefined,
        allowances: allowances !== undefined ? parseFloat(allowances) : undefined,
        deductions: deductions !== undefined ? parseFloat(deductions) : undefined,
        tax: tax !== undefined ? parseFloat(tax) : undefined,
        bonus: bonus !== undefined ? parseFloat(bonus) : undefined,
        netSalary: netSalary ? parseFloat(netSalary) : undefined,
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        status,
        method,
        transactionId,
        remarks,
        updatedBy: BigInt(userId)
      }
    });
    
    res.json({ success: true, data: convertBigInts(payroll) });
  } catch (error) {
    console.error('❌ Update payroll error:', error);
    res.status(500).json({ success: false, message: 'Failed to update payroll', error: error.message });
  }
};

export const deletePayroll = async (req, res) => {
  try {
    const { schoolId } = req.user;
    const { id } = req.params;
    
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid payroll ID' });
    }
    
    await prisma.payroll.delete({ 
      where: { 
        id: BigInt(id), 
        schoolId: BigInt(schoolId) 
      } 
    });
    
    res.json({ success: true, message: 'Payroll deleted successfully' });
  } catch (error) {
    console.error('❌ Delete payroll error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete payroll', error: error.message });
  }
}; 

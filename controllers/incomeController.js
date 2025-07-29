import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

export const getAllIncomes = async (req, res) => {
  try {
    const { schoolId } = req.user;
    
    if (!schoolId) {
      return res.status(400).json({ 
        success: false, 
        error: 'School ID is required' 
      });
    }

    const incomes = await prisma.income.findMany({
      where: {
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        updatedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    res.json({
      success: true,
      data: incomes,
      meta: {
        timestamp: new Date().toISOString(),
        count: incomes.length
      }
    });
  } catch (error) {
    console.error('Error fetching incomes:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

export const getIncomeById = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;

    if (!schoolId) {
      return res.status(400).json({ 
        success: false, 
        error: 'School ID is required' 
      });
    }

    const income = await prisma.income.findFirst({
      where: { 
        id: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        updatedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!income) {
      return res.status(404).json({ 
        success: false,
        error: 'Income not found' 
      });
    }

    res.json({
      success: true,
      data: income
    });
  } catch (error) {
    console.error('Error fetching income:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

export const createIncome = async (req, res) => {
  try {
    const { amount, reference_id, added_by, description, source, income_date } = req.body;
    const { schoolId, id: userId } = req.user;

    if (!schoolId) {
      return res.status(400).json({ 
        success: false, 
        error: 'School ID is required' 
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount is required and must be greater than 0'
      });
    }

    const income = await prisma.income.create({
      data: {
        amount: parseFloat(amount),
        reference_id: reference_id ? BigInt(reference_id) : null,
        added_by: added_by ? BigInt(added_by) : null,
        description: description || null,
        source: source || 'other',
        income_date: income_date ? new Date(income_date) : new Date(),
        schoolId: BigInt(schoolId),
        createdBy: BigInt(userId)
      },
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: income,
      message: 'Income created successfully'
    });
  } catch (error) {
    console.error('Error creating income:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

export const updateIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reference_id, added_by, description, source, income_date, status } = req.body;
    const { schoolId, id: userId } = req.user;

    if (!schoolId) {
      return res.status(400).json({ 
        success: false, 
        error: 'School ID is required' 
      });
    }

    // Check if income exists and belongs to the school
    const existingIncome = await prisma.income.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (!existingIncome) {
      return res.status(404).json({
        success: false,
        error: 'Income not found'
      });
    }

    const updateData = {};
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (reference_id !== undefined) updateData.reference_id = reference_id ? BigInt(reference_id) : null;
    if (added_by !== undefined) updateData.added_by = added_by ? BigInt(added_by) : null;
    if (description !== undefined) updateData.description = description;
    if (source !== undefined) updateData.source = source;
    if (income_date !== undefined) updateData.income_date = new Date(income_date);
    if (status !== undefined) updateData.status = status;
    updateData.updatedBy = BigInt(userId);

    const income = await prisma.income.update({
      where: { id: BigInt(id) },
      data: updateData,
      include: {
        createdByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        updatedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: income,
      message: 'Income updated successfully'
    });
  } catch (error) {
    console.error('Error updating income:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
};

export const deleteIncome = async (req, res) => {
  try {
    const { id } = req.params;
    const { schoolId } = req.user;

    if (!schoolId) {
      return res.status(400).json({ 
        success: false, 
        error: 'School ID is required' 
      });
    }

    // Check if income exists and belongs to the school
    const existingIncome = await prisma.income.findFirst({
      where: {
        id: BigInt(id),
        schoolId: BigInt(schoolId),
        deletedAt: null
      }
    });

    if (!existingIncome) {
      return res.status(404).json({
        success: false,
        error: 'Income not found'
      });
    }

    // Soft delete
    await prisma.income.update({
      where: { id: BigInt(id) },
      data: { deletedAt: new Date() }
    });

    res.json({
      success: true,
      message: 'Income deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting income:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}; 
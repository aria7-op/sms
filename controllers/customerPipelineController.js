import { PrismaClient } from '../generated/prisma/index.js';
const prisma = new PrismaClient();

// Helper to convert all BigInt fields to strings and Date objects to ISO strings
function convertBigInts(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  } else if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (typeof obj[key] === 'bigint') {
        newObj[key] = obj[key].toString();
      } else if (obj[key] instanceof Date) {
        newObj[key] = obj[key].toISOString();
      } else {
        newObj[key] = convertBigInts(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// Get the full pipeline (all stages with customers)
export const getPipeline = async (req, res) => {
  try {
    // Example: get all stages with customer counts
    const stages = await prisma.customerPipelineStage.findMany({
      include: {
        _count: { select: { customers: true } }
      }
    });
    res.json({ success: true, data: convertBigInts(stages) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get all pipeline stages
export const getPipelineStages = async (req, res) => {
  try {
    const stages = await prisma.customerPipelineStage.findMany();
    res.json({ success: true, data: convertBigInts(stages) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get customers by stage
export const getCustomersByStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const customers = await prisma.customer.findMany({
      where: { pipelineStageId: Number(stageId) }
    });
    res.json({ success: true, data: convertBigInts(customers) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Move a customer to a different stage
export const moveCustomerToStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const { customerId } = req.body;
    const customer = await prisma.customer.update({
      where: { id: Number(customerId) },
      data: { pipelineStageId: Number(stageId) }
    });
    res.json({ success: true, data: convertBigInts(customer) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get pipeline analytics (mock)
export const getPipelineAnalytics = async (req, res) => {
  try {
    res.json({ success: true, data: convertBigInts({ totalStages: 5, totalCustomers: 100 }) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get pipeline forecast (mock)
export const getPipelineForecast = async (req, res) => {
  try {
    res.json({ success: true, data: convertBigInts({ forecast: 50 }) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new pipeline stage
export const createPipelineStage = async (req, res) => {
  try {
    const { name, order } = req.body;
    const stage = await prisma.customerPipelineStage.create({
      data: { name, order }
    });
    res.status(201).json({ success: true, data: convertBigInts(stage) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update a pipeline stage
export const updatePipelineStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    const { name, order } = req.body;
    const stage = await prisma.customerPipelineStage.update({
      where: { id: Number(stageId) },
      data: { name, order }
    });
    res.json({ success: true, data: convertBigInts(stage) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete a pipeline stage
export const deletePipelineStage = async (req, res) => {
  try {
    const { stageId } = req.params;
    await prisma.customerPipelineStage.delete({
      where: { id: Number(stageId) }
    });
    res.json({ success: true, message: 'Pipeline stage deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 
import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Get all segments
export const getSegments = async (req, res) => {
  try {
    const segments = await prisma.customerSegment.findMany();
    res.json({ success: true, data: segments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new segment
export const createSegment = async (req, res) => {
  try {
    const { name, criteria } = req.body;
    const segment = await prisma.customerSegment.create({
      data: { name, criteria }
    });
    res.status(201).json({ success: true, data: segment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get a segment by ID
export const getSegmentById = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const segment = await prisma.customerSegment.findUnique({
      where: { id: Number(segmentId) }
    });
    if (!segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }
    res.json({ success: true, data: segment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update a segment
export const updateSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const { name, criteria } = req.body;
    const segment = await prisma.customerSegment.update({
      where: { id: Number(segmentId) },
      data: { name, criteria }
    });
    res.json({ success: true, data: segment });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete a segment
export const deleteSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    await prisma.customerSegment.delete({
      where: { id: Number(segmentId) }
    });
    res.json({ success: true, message: 'Segment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get customers in a segment
export const getCustomersInSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const customers = await prisma.customer.findMany({
      where: { segmentId: Number(segmentId) }
    });
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Add a customer to a segment
export const addCustomerToSegment = async (req, res) => {
  try {
    const { segmentId } = req.params;
    const { customerId } = req.body;
    const customer = await prisma.customer.update({
      where: { id: Number(customerId) },
      data: { segmentId: Number(segmentId) }
    });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Remove a customer from a segment
export const removeCustomerFromSegment = async (req, res) => {
  try {
    const { segmentId, customerId } = req.params;
    const customer = await prisma.customer.update({
      where: { id: Number(customerId) },
      data: { segmentId: null }
    });
    res.json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get segment analytics (mock)
export const getSegmentAnalytics = async (req, res) => {
  try {
    res.json({ success: true, data: { totalSegments: 10, totalCustomers: 100 } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Auto-segment customers (mock)
export const autoSegmentCustomers = async (req, res) => {
  try {
    res.json({ success: true, message: 'Auto-segmentation started', jobId: 'mock-job-456' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 
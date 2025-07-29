import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Get all interactions for a customer
export const getCustomerInteractions = async (req, res) => {
  try {
    const { id: customerId } = req.params;
    const interactions = await prisma.customerInteraction.findMany({
      where: { customerId: Number(customerId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: interactions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new interaction for a customer
export const createInteraction = async (req, res) => {
  try {
    const { id: customerId } = req.params;
    const { type, content, createdBy, metadata } = req.body;
    const interaction = await prisma.customerInteraction.create({
      data: {
        customerId: Number(customerId),
        type,
        content,
        createdBy,
        metadata: metadata || {},
      },
    });
    res.status(201).json({ success: true, data: interaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get a specific interaction by ID
export const getInteractionById = async (req, res) => {
  try {
    const { id: customerId, interactionId } = req.params;
    const interaction = await prisma.customerInteraction.findFirst({
      where: {
        id: Number(interactionId),
        customerId: Number(customerId)
      }
    });
    if (!interaction) {
      return res.status(404).json({ success: false, error: 'Interaction not found' });
    }
    res.json({ success: true, data: interaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update an interaction
export const updateInteraction = async (req, res) => {
  try {
    const { id: customerId, interactionId } = req.params;
    const { type, content, metadata } = req.body;
    const interaction = await prisma.customerInteraction.update({
      where: { id: Number(interactionId) },
      data: {
        type,
        content,
        metadata,
        updatedAt: new Date(),
      },
    });
    res.json({ success: true, data: interaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete an interaction
export const deleteInteraction = async (req, res) => {
  try {
    const { interactionId } = req.params;
    await prisma.customerInteraction.delete({
      where: { id: Number(interactionId) }
    });
    res.json({ success: true, message: 'Interaction deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get analytics for interactions (example: count by type)
export const getInteractionAnalytics = async (req, res) => {
  try {
    const analytics = await prisma.customerInteraction.groupBy({
      by: ['type'],
      _count: { type: true }
    });
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get timeline of interactions (all, ordered by createdAt)
export const getInteractionTimeline = async (req, res) => {
  try {
    const timeline = await prisma.customerInteraction.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: timeline });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Bulk create interactions
export const bulkCreateInteractions = async (req, res) => {
  try {
    const { id: customerId } = req.params;
    const { interactions } = req.body; // Array of { type, content, createdBy, metadata }
    if (!Array.isArray(interactions) || interactions.length === 0) {
      return res.status(400).json({ success: false, error: 'No interactions provided' });
    }
    const created = await prisma.customerInteraction.createMany({
      data: interactions.map(i => ({
        customerId: Number(customerId),
        type: i.type,
        content: i.content,
        createdBy: i.createdBy,
        metadata: i.metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 
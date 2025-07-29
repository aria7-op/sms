import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();

// Get all tickets for a customer
export const getCustomerTickets = async (req, res) => {
  try {
    const { id: customerId } = req.params;
    const tickets = await prisma.customerTicket.findMany({
      where: { customerId: Number(customerId) },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Create a new ticket for a customer
export const createTicket = async (req, res) => {
  try {
    const { id: customerId } = req.params;
    const { subject, description, status, assignedTo, createdBy, priority, metadata } = req.body;
    const ticket = await prisma.customerTicket.create({
      data: {
        customerId: Number(customerId),
        subject,
        description,
        status: status || 'OPEN',
        assignedTo,
        createdBy,
        priority: priority || 'NORMAL',
        metadata: metadata || {},
      },
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get a specific ticket by ID
export const getTicketById = async (req, res) => {
  try {
    const { id: customerId, ticketId } = req.params;
    const ticket = await prisma.customerTicket.findFirst({
      where: {
        id: Number(ticketId),
        customerId: Number(customerId)
      }
    });
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update a ticket
export const updateTicket = async (req, res) => {
  try {
    const { id: customerId, ticketId } = req.params;
    const { subject, description, status, assignedTo, priority, metadata } = req.body;
    const ticket = await prisma.customerTicket.update({
      where: { id: Number(ticketId) },
      data: {
        subject,
        description,
        status,
        assignedTo,
        priority,
        metadata,
        updatedAt: new Date(),
      },
    });
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Delete a ticket
export const deleteTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    await prisma.customerTicket.delete({
      where: { id: Number(ticketId) }
    });
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Assign a ticket
export const assignTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { assignedTo } = req.body;
    const ticket = await prisma.customerTicket.update({
      where: { id: Number(ticketId) },
      data: { assignedTo, updatedAt: new Date() }
    });
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Resolve a ticket
export const resolveTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await prisma.customerTicket.update({
      where: { id: Number(ticketId) },
      data: { status: 'RESOLVED', resolvedAt: new Date(), updatedAt: new Date() }
    });
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Escalate a ticket
export const escalateTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await prisma.customerTicket.update({
      where: { id: Number(ticketId) },
      data: { status: 'ESCALATED', escalatedAt: new Date(), updatedAt: new Date() }
    });
    res.json({ success: true, data: ticket });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get ticket dashboard (example: count by status)
export const getTicketDashboard = async (req, res) => {
  try {
    const dashboard = await prisma.customerTicket.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    res.json({ success: true, data: dashboard });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get ticket analytics (example: count by priority)
export const getTicketAnalytics = async (req, res) => {
  try {
    const analytics = await prisma.customerTicket.groupBy({
      by: ['priority'],
      _count: { priority: true }
    });
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get SLA analytics (example: average resolution time)
export const getSLAAnalytics = async (req, res) => {
  try {
    const tickets = await prisma.customerTicket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true }
    });
    const times = tickets.map(t => (new Date(t.resolvedAt) - new Date(t.createdAt)) / 1000);
    const avgSeconds = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    res.json({ success: true, data: { averageResolutionSeconds: avgSeconds } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 
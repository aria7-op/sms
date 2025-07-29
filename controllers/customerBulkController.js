import { PrismaClient } from '../generated/prisma/index.js';
const prisma = new PrismaClient();

export const bulkCreateCustomers = async (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ success: false, error: 'No customers provided' });
    }
    const created = await prisma.customer.createMany({ data: customers });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkUpdateCustomers = async (req, res) => {
  try {
    const { updates } = req.body; // [{ id, data }]
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'No updates provided' });
    }
    const results = [];
    for (const update of updates) {
      const updated = await prisma.customer.update({
        where: { id: update.id },
        data: update.data
      });
      results.push(updated);
    }
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkDeleteCustomers = async (req, res) => {
  try {
    const { customerIds } = req.body;
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No customer IDs provided' });
    }
    const deleted = await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
    res.json({ success: true, data: deleted });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkImportCustomers = async (req, res) => {
  try {
    // Mock import
    res.json({ success: true, message: 'Bulk import started', jobId: 'import-job-789' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkExportCustomers = async (req, res) => {
  try {
    // Mock export
    res.json({ success: true, message: 'Bulk export started', jobId: 'export-job-789' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkMergeCustomers = async (req, res) => {
  try {
    // Mock merge
    res.json({ success: true, message: 'Bulk merge started', jobId: 'merge-job-789' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkDuplicateCustomers = async (req, res) => {
  try {
    // Mock duplicate
    res.json({ success: true, message: 'Bulk duplicate started', jobId: 'duplicate-job-789' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkAssignCustomers = async (req, res) => {
  try {
    // Mock assign
    res.json({ success: true, message: 'Bulk assign started', jobId: 'assign-job-789' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const bulkTagCustomers = async (req, res) => {
  try {
    // Mock tag
    res.json({ success: true, message: 'Bulk tag started', jobId: 'tag-job-789' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBulkJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    // Mock job status
    res.json({ success: true, data: { jobId, status: 'completed' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}; 
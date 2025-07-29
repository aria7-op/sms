import express from 'express';
import fileController from '../controllers/fileController.js';
import rbacController from '../controllers/rbacController.js';
import { authenticateToken, authorizeRoles } from '../middleware/auth.js';
import { PrismaClient } from '../generated/prisma/client.js';

const router = express.Router();
const prisma = new PrismaClient();

// ======================
// FILE MANAGEMENT ROUTES
// ======================

/**
 * @route   GET /api/files/bill/:billId
 * @desc    Get all files for a bill
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, TEACHER)
 */
router.get('/bill/:billId',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'TEACHER']),
  fileController.getBillFiles
);

/**
 * @route   GET /api/files/:fileId/download
 * @desc    Download a file
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, TEACHER)
 */
router.get('/:fileId/download',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'TEACHER']),
  fileController.downloadFile
);

/**
 * @route   GET /api/files/:fileId/view
 * @desc    View a file (for PDFs and images)
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN, ACCOUNTANT, TEACHER)
 */
router.get('/:fileId/view',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACCOUNTANT', 'TEACHER']),
  fileController.viewFile
);

/**
 * @route   DELETE /api/files/:fileId
 * @desc    Delete a file
 * @access  Private (SUPER_ADMIN, SCHOOL_ADMIN)
 */
router.delete('/:fileId',
  authenticateToken,
  authorizeRoles(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  fileController.deleteFile
);

/**
 * @route   POST /api/files/permissions
 * @desc    Create file access policy
 * @access  Private (ADMIN)
 */
router.post('/permissions', authenticateToken, authorizeRoles(['ADMIN']), rbacController.createFileAccessPolicy);

/**
 * @route   GET /api/files/permissions/:id
 * @desc    Get file access policy by ID
 * @access  Private (ADMIN)
 */
router.get('/permissions/:id', authenticateToken, authorizeRoles(['ADMIN']), async (req, res) => {
  try {
    const filePermission = await prisma.filePermission.findUnique({
      where: { id: BigInt(req.params.id) },
      include: { file: true, conditions: true }
    });
    if (!filePermission) return res.status(404).json({ error: 'Not found' });
    res.json(filePermission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   PUT /api/files/permissions/:id
 * @desc    Update file access policy
 * @access  Private (ADMIN)
 */
router.put('/permissions/:id', authenticateToken, authorizeRoles(['ADMIN']), async (req, res) => {
  try {
    const filePermission = await prisma.filePermission.update({
      where: { id: BigInt(req.params.id) },
      data: req.body
    });
    res.json(filePermission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   DELETE /api/files/permissions/:id
 * @desc    Delete file access policy
 * @access  Private (ADMIN)
 */
router.delete('/permissions/:id', authenticateToken, authorizeRoles(['ADMIN']), async (req, res) => {
  try {
    await prisma.filePermission.delete({ where: { id: BigInt(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/files/permissions/check
 * @desc    Check file access
 * @access  Private
 */
router.post('/permissions/check', authenticateToken, rbacController.checkFileAccessEndpoint);

export default router; 
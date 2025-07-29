import { PrismaClient } from '../generated/prisma/client.js';
const prisma = new PrismaClient();
import fs from 'fs-extra';
import path from 'path';

class FileController {
  /**
   * Get files for a bill
   */
  async getBillFiles(req, res) {
    try {
      const { billId } = req.params;
      const { schoolId } = req.user;

      const files = await prisma.file.findMany({
        where: {
          entityType: 'bill',
          entityId: BigInt(billId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({
        success: true,
        data: files.map(file => ({
          id: file.id.toString(),
          filename: file.filename,
          originalName: file.originalName,
          fileSize: file.fileSize.toString(),
          mimeType: file.mimeType,
          fileType: file.fileType,
          description: file.description,
          tags: file.tags,
          createdAt: file.createdAt
        }))
      });
    } catch (error) {
      console.error('Get bill files error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Download a file
   */
  async downloadFile(req, res) {
    try {
      const { fileId } = req.params;
      const { schoolId } = req.user;

      const file = await prisma.file.findFirst({
        where: {
          id: BigInt(fileId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!file) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      const filePath = file.filePath;
      
      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found on disk' });
      }

      // Increment download count
      await prisma.file.update({
        where: { id: BigInt(fileId) },
        data: { downloadCount: { increment: 1 } }
      });

      res.download(filePath, file.originalName);
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * View a file (for PDFs and images)
   */
  async viewFile(req, res) {
    try {
      const { fileId } = req.params;
      const { schoolId } = req.user;

      const file = await prisma.file.findFirst({
        where: {
          id: BigInt(fileId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!file) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      const filePath = file.filePath;
      
      if (!await fs.pathExists(filePath)) {
        return res.status(404).json({ success: false, message: 'File not found on disk' });
      }

      // Increment download count
      await prisma.file.update({
        where: { id: BigInt(fileId) },
        data: { downloadCount: { increment: 1 } }
      });

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('View file error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(req, res) {
    try {
      const { fileId } = req.params;
      const { schoolId, id: userId } = req.user;

      const file = await prisma.file.findFirst({
        where: {
          id: BigInt(fileId),
          schoolId: BigInt(schoolId),
          deletedAt: null
        }
      });

      if (!file) {
        return res.status(404).json({ success: false, message: 'File not found' });
      }

      // Soft delete the file
      await prisma.file.update({
        where: { id: BigInt(fileId) },
        data: { 
          deletedAt: new Date(),
          updatedBy: BigInt(userId)
        }
      });

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}

export default new FileController(); 
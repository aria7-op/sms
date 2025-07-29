import googleDriveService from '../services/googleDriveService.js';
import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

class GoogleDriveController {
  /**
   * Helper method to get school ID for the current user
   */
  async getSchoolIdForUser(user) {
    console.log('🔍 getSchoolIdForUser called with user:', JSON.stringify(user, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    
    let schoolId = user.schoolId;
    console.log('🔍 Initial schoolId from user.schoolId:', schoolId);
    
    // Handle owner users who have schoolIds array
    if (!schoolId && user.type === 'owner' && user.schoolIds && user.schoolIds.length > 0) {
      schoolId = user.schoolIds[0];
      console.log('🔍 Using schoolId from schoolIds array:', schoolId);
    }
    
    // For owner users, always query the database to get the latest school information
    if (user.type === 'owner' && user.id) {
      console.log('🔍 Querying database for latest school info for owner:', user.id, 'Type:', typeof user.id);
      try {
        const { PrismaClient } = await import('../generated/prisma/index.js');
        const prisma = new PrismaClient();
        
        // Convert owner ID to BigInt safely
        const ownerIdBigInt = BigInt(user.id);
        console.log('🔍 Converted owner ID to BigInt:', ownerIdBigInt.toString());
        
        // First, let's check if the owner exists
        const owner = await prisma.owner.findUnique({
          where: { id: ownerIdBigInt },
          select: { id: true, name: true, email: true }
        });
        console.log('🔍 Owner found in database:', owner);
        
        // Then check for schools with the specific owner ID
        const schools = await prisma.school.findMany({
          where: { ownerId: ownerIdBigInt },
          select: { id: true, name: true, ownerId: true }
        });
        
        console.log('🔍 Found schools from database for owner', ownerIdBigInt.toString(), ':', schools);
        
        // Also check all schools to see what's in the database
        const allSchools = await prisma.school.findMany({
          select: { id: true, name: true, ownerId: true }
        });
        console.log('🔍 All schools in database:', allSchools);
        
        // Try a more flexible search - check if any school has this owner ID as string or number
        const flexibleSchools = await prisma.school.findMany({
          where: {
            OR: [
              { ownerId: ownerIdBigInt },
              { ownerId: BigInt(parseInt(user.id)) },
              { ownerId: BigInt(user.id.toString()) }
            ]
          },
          select: { id: true, name: true, ownerId: true }
        });
        console.log('🔍 Flexible search results:', flexibleSchools);
        
        if (schools.length > 0) {
          schoolId = schools[0].id.toString();
          console.log('🔍 Using schoolId from database:', schoolId);
        } else if (flexibleSchools.length > 0) {
          schoolId = flexibleSchools[0].id.toString();
          console.log('🔍 Using schoolId from flexible search:', schoolId);
        } else {
          console.log('🔍 No schools found for owner in database');
        }
        
        await prisma.$disconnect();
      } catch (dbError) {
        console.error('🔍 Error fetching schools from database:', dbError);
      }
    }
    
    console.log('🔍 Final schoolId returned:', schoolId);
    return schoolId;
  }

  /**
   * Get Google Drive authentication URL
   */
  getAuthUrl = async (req, res) => {
    try {
      // Convert BigInt values to strings for logging
      const userForLogging = JSON.parse(JSON.stringify(req.user, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
      console.log('🔍 User object:', JSON.stringify(userForLogging, null, 2));
      
      console.log('🔍 Calling getSchoolIdForUser helper...');
      const schoolId = await this.getSchoolIdForUser(req.user);
      console.log('🔍 getSchoolIdForUser returned:', schoolId);
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'No school ID found. Please ensure user is associated with a school.'
        });
      }
      
      const authUrl = googleDriveService.generateAuthUrl(schoolId);
      
      res.json({
        success: true,
        authUrl,
        message: 'Please visit this URL to authenticate with Google Drive'
      });
    } catch (error) {
      console.error('Get auth URL error:', error);
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  /**
   * Handle Google OAuth callback
   */
  handleCallback = async (req, res) => {
    try {
      console.log('🔍 OAuth callback request received');
      console.log('🔍 Query parameters:', req.query);
      
      const { code, state } = req.query;
      
      if (!code || !state) {
        console.log('❌ Missing code or state parameter');
        return res.status(400).json({ 
          success: false, 
          message: 'Missing authorization code or state' 
        });
      }

      console.log('🔍 Calling googleDriveService.handleCallback...');
      const result = await googleDriveService.handleCallback(code, state);
      console.log('🔍 handleCallback result:', result);
      
      res.json({
        success: true,
        message: 'Google Drive connected successfully!',
        data: {
          schoolId: result.schoolId.toString(), // Convert BigInt to string
          connected: true
        }
      });
    } catch (error) {
      console.error('❌ OAuth callback error details:');
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error name:', error.name);
      console.error('❌ Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      
      res.status(500).json({ 
        success: false, 
        message: 'Failed to connect Google Drive',
        error: error.message // Include the actual error message for debugging
      });
    }
  }

  /**
   * List Excel files from Google Drive
   */
  listExcelFiles = async (req, res) => {
    try {
      let schoolId = req.user.schoolId;
      
      // Handle owner users who have schoolIds array
      if (!schoolId && req.user.type === 'owner' && req.user.schoolIds && req.user.schoolIds.length > 0) {
        schoolId = req.user.schoolIds[0];
      }
      
      // If still no schoolId and user is owner, try to get schools from database
      if (!schoolId && req.user.type === 'owner' && req.user.id) {
        try {
          const { PrismaClient } = await import('../generated/prisma/index.js');
          const prisma = new PrismaClient();
          
          const schools = await prisma.school.findMany({
            where: { ownerId: BigInt(req.user.id) },
            select: { id: true, name: true }
          });
          
          if (schools.length > 0) {
            schoolId = schools[0].id.toString();
          }
          
          await prisma.$disconnect();
        } catch (dbError) {
          console.error('Error fetching schools from database:', dbError);
        }
      }
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'No school ID found. Please ensure user is associated with a school.'
        });
      }
      
      // Check if Google Drive is connected
      const isConnected = await googleDriveService.isConnected(schoolId);
      if (!isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Google Drive not connected. Please authenticate first.',
          needsAuth: true
        });
      }

      const files = await googleDriveService.listExcelFiles(schoolId);
      
      res.json({
        success: true,
        data: files,
        message: `Found ${files.length} Excel files in Google Drive`
      });
    } catch (error) {
      console.error('List Excel files error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to list Excel files' 
      });
    }
  }

  /**
   * Set bill template from Google Drive
   */
  setBillTemplate = async (req, res) => {
    try {
      let schoolId = req.user.schoolId;
      
      // Handle owner users who have schoolIds array
      if (!schoolId && req.user.type === 'owner' && req.user.schoolIds && req.user.schoolIds.length > 0) {
        schoolId = req.user.schoolIds[0];
      }
      
      // If still no schoolId and user is owner, try to get schools from database
      if (!schoolId && req.user.type === 'owner' && req.user.id) {
        try {
          const { PrismaClient } = await import('../generated/prisma/index.js');
          const prisma = new PrismaClient();
          
          const schools = await prisma.school.findMany({
            where: { ownerId: BigInt(req.user.id) },
            select: { id: true, name: true }
          });
          
          if (schools.length > 0) {
            schoolId = schools[0].id.toString();
          }
          
          await prisma.$disconnect();
        } catch (dbError) {
          console.error('Error fetching schools from database:', dbError);
        }
      }
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'No school ID found. Please ensure user is associated with a school.'
        });
      }
      
      const { fileId, fileName } = req.body;
      
      if (!fileId || !fileName) {
        return res.status(400).json({
          success: false,
          message: 'File ID and file name are required'
        });
      }

      // Check if Google Drive is connected
      const isConnected = await googleDriveService.isConnected(schoolId);
      if (!isConnected) {
        return res.status(400).json({
          success: false,
          message: 'Google Drive not connected. Please authenticate first.',
          needsAuth: true
        });
      }

      const result = await googleDriveService.setBillTemplate(schoolId, fileId, fileName);
      
      res.json({
        success: true,
        message: 'Bill template set successfully!',
        data: {
          templatePath: result.templatePath,
          fileName: result.fileName
        }
      });
    } catch (error) {
      console.error('Set bill template error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to set bill template' 
      });
    }
  }

  /**
   * Get current bill template status
   */
  getBillTemplateStatus = async (req, res) => {
    try {
      const schoolId = await this.getSchoolIdForUser(req.user);
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'No school ID found. Please ensure user is associated with a school.'
        });
      }
      
      const isConnected = await googleDriveService.isConnected(schoolId);
      const template = await googleDriveService.getBillTemplate(schoolId);
      
      res.json({
        success: true,
        data: {
          googleDriveConnected: isConnected,
          hasTemplate: !!template,
          template: template ? {
            fileId: template.fileId,
            fileName: template.fileName,
            setAt: template.setAt
          } : null
        }
      });
    } catch (error) {
      console.error('Get template status error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get template status' 
      });
    }
  }

  /**
   * Disconnect Google Drive
   */
  disconnect = async (req, res) => {
    try {
      const schoolId = await this.getSchoolIdForUser(req.user);
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'No school ID found. Please ensure user is associated with a school.'
        });
      }
      
      await googleDriveService.disconnect(schoolId);
      
      res.json({
        success: true,
        message: 'Google Drive disconnected successfully'
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to disconnect Google Drive' 
      });
    }
  }

  /**
   * Get Google Drive connection status
   */
  getConnectionStatus = async (req, res) => {
    try {
      const schoolId = await this.getSchoolIdForUser(req.user);
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'No school ID found. Please ensure user is associated with a school.'
        });
      }
      
      const isConnected = await googleDriveService.isConnected(schoolId);
      const template = await googleDriveService.getBillTemplate(schoolId);
      
      res.json({
        success: true,
        data: {
          connected: isConnected,
          hasTemplate: !!template,
          template: template ? {
            fileName: template.fileName,
            setAt: template.setAt
          } : null
        }
      });
    } catch (error) {
      console.error('Get connection status error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get connection status' 
      });
    }
  }

  /**
   * Get Google Drive setup status for payment creation
   */
  getPaymentSetupStatus = async (req, res) => {
    try {
      const schoolId = await this.getSchoolIdForUser(req.user);
      
      if (!schoolId) {
        return res.status(400).json({
          success: false,
          message: 'No school ID found. Please ensure user is associated with a school.'
        });
      }
      
      const isConnected = await googleDriveService.isConnected(schoolId);
      const hasTemplate = await googleDriveService.hasBillTemplate(schoolId);
      
      let setupStatus = 'ready';
      let message = 'Google Drive is ready for bill generation';
      let needsAction = null;
      
      if (!isConnected) {
        setupStatus = 'needs_auth';
        message = 'Google Drive authentication required';
        needsAction = {
          type: 'authenticate',
          description: 'Connect to Google Drive to access bill templates',
          authUrl: googleDriveService.generateAuthUrl(schoolId)
        };
      } else if (!hasTemplate) {
        setupStatus = 'needs_template';
        message = 'Bill template not configured';
        needsAction = {
          type: 'select_template',
          description: 'Select an Excel file from Google Drive to use as bill template',
          filesUrl: '/api/google/files'
        };
      }
      
      res.json({
        success: true,
        data: {
          setupStatus,
          message,
          isConnected,
          hasTemplate,
          needsAction
        }
      });
    } catch (error) {
      console.error('Get payment setup status error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to get payment setup status' 
      });
    }
  }
}

export default new GoogleDriveController(); 
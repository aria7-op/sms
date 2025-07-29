import { google } from 'googleapis';
import { PrismaClient } from '../generated/prisma/client.js';
import fs from 'fs-extra';
import path from 'path';

const prisma = new PrismaClient();

class GoogleDriveService {
  constructor() {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/google/callback';
    console.log('🔧 Google OAuth redirect URI:', redirectUri);
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Generate Google OAuth URL for authentication
   */
  generateAuthUrl(schoolId) {
    const scopes = [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file'
    ];

    // Convert schoolId to string to avoid BigInt serialization error
    const state = Buffer.from(JSON.stringify({ schoolId: schoolId.toString() })).toString('base64');
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent'
    });
  }

  /**
   * Handle OAuth callback and get tokens
   */
  async handleCallback(code, state) {
    try {
      console.log('🔍 OAuth callback started with code:', code.substring(0, 10) + '...');
      console.log('🔍 State parameter:', state);
      
      console.log('🔍 Getting tokens from Google...');
      const { tokens } = await this.oauth2Client.getToken(code);
      console.log('🔍 Tokens received successfully');
      console.log('🔍 Token details:', {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        tokenType: tokens.token_type
      });
      
      console.log('🔍 Decoding state parameter...');
      let { schoolId } = JSON.parse(Buffer.from(state, 'base64').toString());
      console.log('🔍 Decoded schoolId:', schoolId, 'Type:', typeof schoolId);
      
      // Convert back to BigInt if needed
      if (schoolId && typeof schoolId === 'string' && /^\d+$/.test(schoolId)) {
        schoolId = BigInt(schoolId);
        console.log('🔍 Converted to BigInt:', schoolId.toString());
      }
      
      // Verify school exists before storing tokens
      console.log('🔍 Verifying school exists in database...');
      const school = await prisma.school.findUnique({
        where: { id: BigInt(schoolId) },
        select: { id: true, name: true, ownerId: true }
      });
      
      if (!school) {
        throw new Error(`School with ID ${schoolId} not found in database`);
      }
      
      console.log('🔍 School found:', {
        id: school.id.toString(),
        name: school.name,
        ownerId: school.ownerId.toString()
      });
      
      // Store tokens for the school
      console.log('🔍 Storing tokens for school:', schoolId.toString());
      await this.storeSchoolTokens(schoolId, tokens);
      console.log('🔍 Tokens stored successfully');
      
      return {
        success: true,
        schoolId: schoolId.toString(), // Convert BigInt to string
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token
      };
    } catch (error) {
      console.error('❌ Google OAuth callback error details:');
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error name:', error.name);
      
      // Don't wrap the error, let the original error pass through for better debugging
      throw error;
    }
  }

  /**
   * Store Google Drive tokens for a school
   */
  async storeSchoolTokens(schoolId, tokens) {
    try {
      await prisma.school.update({
        where: { id: BigInt(schoolId) },
        data: {
          googleDriveAccessToken: tokens.access_token,
          googleDriveRefreshToken: tokens.refresh_token,
          googleDriveTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          googleDriveConnected: true,
          googleDriveConnectedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error storing Google Drive tokens:', error);
      throw error;
    }
  }

  /**
   * Get valid access token for a school
   */
  async getValidAccessToken(schoolId) {
    try {
      const school = await prisma.school.findFirst({
        where: { id: BigInt(schoolId) },
        select: {
          googleDriveAccessToken: true,
          googleDriveRefreshToken: true,
          googleDriveTokenExpiry: true
        }
      });

      if (!school || !school.googleDriveAccessToken) {
        throw new Error('Google Drive not connected for this school');
      }

      // Check if token is expired
      if (school.googleDriveTokenExpiry && new Date() > school.googleDriveTokenExpiry) {
        // Refresh token
        this.oauth2Client.setCredentials({
          refresh_token: school.googleDriveRefreshToken
        });

        const { credentials } = await this.oauth2Client.refreshAccessToken();
        
        // Update stored tokens
        await this.storeSchoolTokens(schoolId, credentials);
        
        return credentials.access_token;
      }

      return school.googleDriveAccessToken;
    } catch (error) {
      console.error('Error getting valid access token:', error);
      throw error;
    }
  }

  /**
   * List Excel files from Google Drive
   */
  async listExcelFiles(schoolId) {
    try {
      const accessToken = await this.getValidAccessToken(schoolId);
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const response = await this.drive.files.list({
        q: "mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType='application/vnd.ms-excel'",
        fields: 'files(id,name,size,modifiedTime,webViewLink)',
        orderBy: 'modifiedTime desc'
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing Excel files:', error);
      throw error;
    }
  }

  /**
   * Download Excel file from Google Drive
   */
  async downloadExcelFile(schoolId, fileId) {
    try {
      const accessToken = await this.getValidAccessToken(schoolId);
      this.oauth2Client.setCredentials({ access_token: accessToken });

      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' });

      return response.data;
    } catch (error) {
      console.error('Error downloading Excel file:', error);
      throw error;
    }
  }

  /**
   * Set bill template for a school
   */
  async setBillTemplate(schoolId, fileId, fileName) {
    try {
      // Download the template file
      const fileBuffer = await this.downloadExcelFile(schoolId, fileId);
      
      // Save template locally
      const templatesDir = 'templates/bills';
      await fs.ensureDir(templatesDir);
      
      const templatePath = path.join(templatesDir, `school_${schoolId}_template.xlsx`);
      await fs.writeFile(templatePath, fileBuffer);

      // Update school record
      await prisma.school.update({
        where: { id: BigInt(schoolId) },
        data: {
          billTemplateFileId: fileId,
          billTemplateFileName: fileName,
          billTemplatePath: templatePath,
          billTemplateSetAt: new Date()
        }
      });

      return {
        success: true,
        templatePath,
        fileName
      };
    } catch (error) {
      console.error('Error setting bill template:', error);
      throw error;
    }
  }

  /**
   * Get bill template for a school
   */
  async getBillTemplate(schoolId) {
    try {
      const school = await prisma.school.findFirst({
        where: { id: BigInt(schoolId) },
        select: {
          billTemplateFileId: true,
          billTemplateFileName: true,
          billTemplatePath: true,
          googleDriveConnected: true
        }
      });

      if (!school || !school.billTemplatePath) {
        return null;
      }

      // Check if template file exists
      if (!(await fs.pathExists(school.billTemplatePath))) {
        // Re-download from Google Drive
        if (school.billTemplateFileId && school.googleDriveConnected) {
          await this.setBillTemplate(schoolId, school.billTemplateFileId, school.billTemplateFileName);
        } else {
          return null;
        }
      }

      return {
        fileId: school.billTemplateFileId,
        fileName: school.billTemplateFileName,
        templatePath: school.billTemplatePath
      };
    } catch (error) {
      console.error('Error getting bill template:', error);
      return null;
    }
  }

  /**
   * Check if school has Google Drive connected
   */
  async isConnected(schoolId) {
    try {
      const school = await prisma.school.findFirst({
        where: { id: BigInt(schoolId) },
        select: { googleDriveConnected: true }
      });

      return school?.googleDriveConnected || false;
    } catch (error) {
      console.error('Error checking Google Drive connection:', error);
      return false;
    }
  }

  /**
   * Disconnect Google Drive for a school
   */
  async disconnect(schoolId) {
    try {
      await prisma.school.update({
        where: { id: BigInt(schoolId) },
        data: {
          googleDriveAccessToken: null,
          googleDriveRefreshToken: null,
          googleDriveTokenExpiry: null,
          googleDriveConnected: false,
          googleDriveConnectedAt: null,
          billTemplateFileId: null,
          billTemplateFileName: null,
          billTemplatePath: null,
          billTemplateSetAt: null
        }
      });

      // Remove template file
      const templatePath = path.join('templates/bills', `school_${schoolId}_template.xlsx`);
      if (await fs.pathExists(templatePath)) {
        await fs.remove(templatePath);
      }

      return { success: true };
    } catch (error) {
      console.error('Error disconnecting Google Drive:', error);
      throw error;
    }
  }

  /**
   * Generate bill from Excel template
   */
  async generateBillFromTemplate(schoolId, paymentData, billData) {
    try {
      // Get the template
      const template = await this.getBillTemplate(schoolId);
      if (!template) {
        throw new Error('No bill template found. Please set a template first.');
      }

      // Check if Google Drive is connected
      const isConnected = await this.isConnected(schoolId);
      if (!isConnected) {
        throw new Error('Google Drive not connected. Please authenticate first.');
      }

      // Import ExcelJS for Excel processing
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      
      // Load the template
      await workbook.xlsx.readFile(template.templatePath);
      const worksheet = workbook.getWorksheet(1); // Get first worksheet

      // Get school information
      const school = await prisma.school.findFirst({
        where: { id: BigInt(schoolId) },
        select: { id: true, name: true, address: true, phone: true, email: true }
      });

      // Get student information if available
      let student = null;
      if (paymentData.studentId) {
        student = await prisma.student.findFirst({
          where: { id: BigInt(paymentData.studentId) },
          include: { 
            user: { select: { firstName: true, lastName: true, email: true } },
            class: { select: { name: true } },
            section: { select: { name: true } }
          }
        });
      }

      // Get parent information if available
      let parent = null;
      if (paymentData.parentId) {
        parent = await prisma.parent.findFirst({
          where: { id: BigInt(paymentData.parentId) },
          include: { 
            user: { select: { firstName: true, lastName: true, email: true, phone: true } }
          }
        });
      }

      // Replace placeholders in the template
      this.replaceTemplatePlaceholders(worksheet, {
        // School information
        '{{SCHOOL_NAME}}': school?.name || '',
        '{{SCHOOL_ADDRESS}}': school?.address || '',
        '{{SCHOOL_PHONE}}': school?.phone || '',
        '{{SCHOOL_EMAIL}}': school?.email || '',
        
        // Bill information
        '{{BILL_NUMBER}}': billData.billNumber || '',
        '{{BILL_DATE}}': new Date().toLocaleDateString(),
        '{{DUE_DATE}}': billData.dueDate ? new Date(billData.dueDate).toLocaleDateString() : '',
        '{{TOTAL_AMOUNT}}': billData.totalAmount?.toString() || '0.00',
        
        // Payment information
        '{{RECEIPT_NUMBER}}': paymentData.receiptNumber || '',
        '{{PAYMENT_METHOD}}': paymentData.method || '',
        '{{PAYMENT_TYPE}}': paymentData.type || '',
        '{{PAYMENT_AMOUNT}}': paymentData.amount?.toString() || '0.00',
        '{{PAYMENT_DISCOUNT}}': paymentData.discount?.toString() || '0.00',
        '{{PAYMENT_FINE}}': paymentData.fine?.toString() || '0.00',
        '{{PAYMENT_TOTAL}}': paymentData.total?.toString() || '0.00',
        
        // Student information
        '{{STUDENT_NAME}}': student?.user ? `${student.user.firstName} ${student.user.lastName}` : '',
        '{{STUDENT_EMAIL}}': student?.user?.email || '',
        '{{STUDENT_CLASS}}': student?.class?.name || '',
        '{{STUDENT_SECTION}}': student?.section?.name || '',
        
        // Parent information
        '{{PARENT_NAME}}': parent?.user ? `${parent.user.firstName} ${parent.user.lastName}` : '',
        '{{PARENT_EMAIL}}': parent?.user?.email || '',
        '{{PARENT_PHONE}}': parent?.user?.phone || '',
        
        // Additional fields
        '{{REMARKS}}': paymentData.remarks || '',
        '{{GENERATED_DATE}}': new Date().toLocaleString(),
        '{{GENERATED_BY}}': 'System'
      });

      // Generate unique filename
      const timestamp = Date.now();
      const billFilename = `bill_${billData.billNumber}_${timestamp}.xlsx`;
      const billPath = path.join('uploads/bills', billFilename);
      
      // Ensure directory exists
      await fs.ensureDir(path.dirname(billPath));
      
      // Save the generated bill
      await workbook.xlsx.writeFile(billPath);

      return {
        success: true,
        filename: billFilename,
        filePath: billPath,
        fileSize: (await fs.stat(billPath)).size,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };
    } catch (error) {
      console.error('Error generating bill from template:', error);
      throw error;
    }
  }

  /**
   * Replace placeholders in Excel worksheet
   */
  replaceTemplatePlaceholders(worksheet, replacements) {
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        if (cell.value && typeof cell.value === 'string') {
          let cellValue = cell.value;
          
          // Replace all placeholders
          Object.keys(replacements).forEach(placeholder => {
            cellValue = cellValue.replace(new RegExp(placeholder, 'g'), replacements[placeholder]);
          });
          
          if (cellValue !== cell.value) {
            cell.value = cellValue;
          }
        }
      });
    });
  }

  /**
   * Check if school has bill template configured
   */
  async hasBillTemplate(schoolId) {
    try {
      const template = await this.getBillTemplate(schoolId);
      return !!template;
    } catch (error) {
      console.error('Error checking bill template:', error);
      return false;
    }
  }
}

export default new GoogleDriveService(); 
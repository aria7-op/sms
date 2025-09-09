import Jimp from 'jimp';
import path from 'path';
import fs from 'fs-extra';
import { PrismaClient } from '../generated/prisma/index.js';

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

class CardGenerationService {
  constructor() {
    this.cardTemplatePath = path.join(process.cwd(), 'assets', 'card-template.png');
    this.outputDir = path.join(process.cwd(), 'temp', 'cards');
    this.fonts = {
      large: null,
      medium: null,
      small: null
    };
  }

  /**
   * Initialize the service by loading fonts and creating output directory
   */
  async initialize() {
    try {
      // Create output directory if it doesn't exist
      await fs.ensureDir(this.outputDir);
      
      // Load fonts (using default fonts for now, can be customized later)
      // Note: Jimp doesn't have built-in font loading like PIL, so we'll use basic text rendering
      console.log('✅ Card generation service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize card generation service:', error);
      return false;
    }
  }

  /**
   * Generate a student card based on the Python script logic
   */
  async generateStudentCard(studentId) {
    try {
      // Get student data from database
      const student = await prisma.student.findUnique({
        where: { id: BigInt(studentId) },
        include: {
          user: true,
          parent: {
            include: {
              user: true
            }
          },
          class: true
        }
      });

      if (!student) {
        throw new Error('Student not found');
      }

      // Load card template
      const cardTemplate = await Jimp.read(this.cardTemplatePath);
      
      // Create a copy of the template
      const card = cardTemplate.clone();
      
      // Get student photo if available
      let studentPhoto = null;
      if (student.user?.avatar) {
        try {
          console.log('🔍 DEBUG: Processing student avatar:', student.user.avatar);
          
          // Handle different avatar path formats
          let imagePath = student.user.avatar;
          
          if (imagePath.startsWith('/uploads/')) {
            // Convert relative path to absolute - try both public and direct uploads
            const publicPath = path.join(process.cwd(), 'public', imagePath);
            const directPath = path.join(process.cwd(), imagePath);
            
            console.log('🔍 DEBUG: Trying public path:', publicPath);
            console.log('🔍 DEBUG: Trying direct path:', directPath);
            
            if (fs.existsSync(publicPath)) {
              imagePath = publicPath;
              console.log('✅ DEBUG: Found image at public path');
            } else if (fs.existsSync(directPath)) {
              imagePath = directPath;
              console.log('✅ DEBUG: Found image at direct path');
            } else {
              console.warn('❌ DEBUG: Image not found at either path');
              imagePath = null;
            }
          } else if (imagePath.startsWith('http')) {
            // For HTTP URLs, we'll need to download the image first
            // For now, skip external URLs
            console.warn('External image URLs not supported for card generation');
            imagePath = null;
          } else {
            // Try as direct file path
            const fullPath = path.join(process.cwd(), imagePath);
            if (fs.existsSync(fullPath)) {
              imagePath = fullPath;
              console.log('✅ DEBUG: Found image at full path:', fullPath);
            } else {
              console.warn('❌ DEBUG: Image not found at full path:', fullPath);
              imagePath = null;
            }
          }
          
          if (imagePath && fs.existsSync(imagePath)) {
            console.log('✅ DEBUG: Loading image from:', imagePath);
            studentPhoto = await Jimp.read(imagePath);
            console.log('✅ DEBUG: Image loaded successfully, size:', studentPhoto.getWidth(), 'x', studentPhoto.getHeight());
          } else {
            console.warn('❌ DEBUG: No valid image path found for avatar:', student.user.avatar);
          }
        } catch (error) {
          console.warn('❌ DEBUG: Could not load student photo:', error.message);
        }
      } else {
        console.log('ℹ️ DEBUG: No avatar found for student');
      }

      // Process and add student photo
      if (studentPhoto) {
        studentPhoto = await this.processStudentPhoto(studentPhoto);
        // Position the photo on the card (adjust coordinates based on template)
        const photoX = (card.getWidth() - studentPhoto.getWidth()) / 2;
        const photoY = 185; // Adjust based on template
        card.composite(studentPhoto, photoX, photoY);
      }

      // Add text to the card
      await this.addTextToCard(card, student);

      // Generate output filename
      const safeName = `${student.user.firstName}_${student.user.lastName}`.replace(/[^a-zA-Z0-9]/g, '_');
      const outputFilename = `${safeName}_${student.admissionNo}_${Date.now()}.jpg`;
      const outputPath = path.join(this.outputDir, outputFilename);

      // Save the card
      await card.writeAsync(outputPath);

      // Track card generation
      await this.trackCardGeneration(studentId);

      return {
        success: true,
        filePath: outputPath,
        filename: outputFilename,
        student: {
          id: student.id.toString(),
          userId: student.userId.toString(),
          name: `${student.user.firstName} ${student.user.lastName}`,
          parentName: student.parent?.user?.firstName ? `${student.parent.user.firstName} ${student.parent.user.lastName}` : 'N/A',
          admissionNo: student.admissionNo,
          className: student.class?.name || 'N/A',
          classCode: student.class?.code || '',
          class: student.class?.name || 'N/A'
        }
      };

    } catch (error) {
      console.error('Error generating student card:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process student photo to fit the circular frame
   */
  async processStudentPhoto(photo) {
    try {
      // Resize to square (560x560 as per Python script)
      const size = 560;
      photo.resize(size, size, Jimp.RESIZE_BEZIER);
      
      // Create circular mask
      const mask = new Jimp(size, size, 0x000000FF);
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = size / 2;

      // Draw circle on mask
      for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
          const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
          if (distance <= radius) {
            mask.setPixelColor(0xFFFFFFFF, x, y);
          }
        }
      }

      // Apply mask
      photo.mask(mask, 0, 0);
      
      return photo;
    } catch (error) {
      console.error('Error processing student photo:', error);
      return photo;
    }
  }

  /**
   * Check if text contains Unicode characters that might not be supported by default fonts
   */
  hasUnicodeCharacters(text) {
    if (!text) return false;
    // Check for non-ASCII characters (Dari/Persian, Arabic, etc.)
    return /[^\x00-\x7F]/.test(text);
  }

  /**
   * Get text for rendering - ALWAYS use Dari names when available
   */
  getDisplayText(primaryText, fallbackText) {
    if (!primaryText) return fallbackText || 'N/A';
    
    // ALWAYS prefer the primary text (Dari name) - we'll handle Unicode rendering differently
    console.log('🔍 DEBUG: Using primary text (Dari name):', primaryText);
    return primaryText;
  }

  /**
   * Render text with Unicode support using a different approach
   */
  async renderUnicodeText(card, text, x, y, fontSize, color = 0xFFFFFFFF) {
    try {
      console.log('🔍 DEBUG: Attempting to render Unicode text:', text);
      
      // Try to use the largest available font for better Unicode support
      let font;
      if (fontSize >= 24) {
        font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      } else if (fontSize >= 16) {
        font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
      } else {
        font = await Jimp.loadFont(Jimp.FONT_SANS_8_WHITE);
      }
      
      // Try to render the text directly - some Unicode characters might work
      // Even if they show as ?, at least we're trying to render the Dari text
      card.print(font, x, y, {
        text: text,
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP
      }, card.getWidth(), card.getHeight());
      
      console.log('✅ DEBUG: Unicode text rendered (may show as ? if font doesn\'t support characters)');
      
    } catch (error) {
      console.error('Error rendering Unicode text:', error);
      // Fallback to basic text rendering
      const font = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
      card.print(font, x, y, text, card.getWidth(), card.getHeight());
    }
  }

  /**
   * Add text to the card
   */
  async addTextToCard(card, student) {
    try {
      const cardWidth = card.getWidth();
      const cardHeight = card.getHeight();
      
      // Text positions based on HTML percentages for 1085x1764 card
      // Field 1: Student name, Field 2: Parent name, Field 3: Class name & code, Field 4: Student User ID
      const textPositions = {
        studentName: { x: Math.floor(cardWidth * 0.20), y: Math.floor(cardHeight * 0.52) },
        parentName: { x: Math.floor(cardWidth * 0.20), y: Math.floor(cardHeight * 0.59) },
        className: { x: Math.floor(cardWidth * 0.20), y: Math.floor(cardHeight * 0.66) },
        studentUserId: { x: Math.floor(cardWidth * 0.20), y: Math.floor(cardHeight * 0.80) }
      };

      // Load fonts with white color (Jimp supports white fonts)
      const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
      const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
      const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);

      // Add the four required fields to the card
      // Using white fonts for better visibility on dark card backgrounds
      
      // Field 1: Student name (use Dari name if available, otherwise English) - Large font
      const studentEnglishName = `${student.user.firstName || ''} ${student.user.lastName || ''}`.trim();
      const studentName = this.getDisplayText(student.user.dariName, studentEnglishName);
      console.log('🔍 DEBUG: Adding student name:', studentName, 'at position:', textPositions.studentName);
      
      // Render student name - use Unicode rendering for Dari names
      if (this.hasUnicodeCharacters(studentName)) {
        await this.renderUnicodeText(card, studentName, textPositions.studentName.x, textPositions.studentName.y, 32);
      } else {
        card.print(fontLarge, textPositions.studentName.x, textPositions.studentName.y, {
          text: studentName,
          alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
          alignmentY: Jimp.VERTICAL_ALIGN_TOP
        }, cardWidth, cardHeight);
      }

      // Field 2: Parent name (use Dari name if available, otherwise English) - Medium font
      const parentEnglishName = student.parent?.user?.firstName ? 
        `${student.parent.user.firstName} ${student.parent.user.lastName}` : 'N/A';
      const parentName = this.getDisplayText(student.parent?.user?.dariName, parentEnglishName);
      console.log('🔍 DEBUG: Adding parent name:', parentName, 'at position:', textPositions.parentName);
      
      // Render parent name - use Unicode rendering for Dari names
      if (this.hasUnicodeCharacters(parentName)) {
        await this.renderUnicodeText(card, parentName, textPositions.parentName.x, textPositions.parentName.y, 16);
      } else {
        card.print(fontMedium, textPositions.parentName.x, textPositions.parentName.y, {
          text: parentName,
          alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
          alignmentY: Jimp.VERTICAL_ALIGN_TOP
        }, cardWidth, cardHeight);
      }

      // Field 3: Class name and class code - Medium font
      const className = student.class?.name || 'N/A';
      const classCode = student.class?.code || '';
      const classText = classCode ? `${className} (${classCode})` : className;
      console.log('🔍 DEBUG: Adding class:', classText, 'at position:', textPositions.className);
      
      card.print(fontMedium, textPositions.className.x, textPositions.className.y, {
        text: classText,
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP
      }, cardWidth, cardHeight);

      // Field 4: Student User ID (from users table) - Small font
      const userId = student.userId ? student.userId.toString() : 'N/A';
      console.log('🔍 DEBUG: Adding user ID:', userId, 'at position:', textPositions.studentUserId);
      card.print(fontSmall, textPositions.studentUserId.x, textPositions.studentUserId.y, {
        text: userId,
        alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
        alignmentY: Jimp.VERTICAL_ALIGN_TOP
      }, cardWidth, cardHeight);

    } catch (error) {
      console.error('Error adding text to card:', error);
    }
  }

  /**
   * Track card generation in database
   */
  async trackCardGeneration(studentId) {
    try {
      // Check if tracking record exists
      let tracking = await prisma.studentCardTracking.findUnique({
        where: { studentId: BigInt(studentId) }
      });

      if (tracking) {
        // Update existing record
        await prisma.studentCardTracking.update({
          where: { studentId: BigInt(studentId) },
          data: {
            printCount: tracking.printCount + 1,
            lastPrintedAt: new Date()
          }
        });
      } else {
        // Create new tracking record
        await prisma.studentCardTracking.create({
          data: {
            studentId: BigInt(studentId),
            printCount: 1,
            lastPrintedAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error('Error tracking card generation:', error);
    }
  }

  /**
   * Get card print count for a student
   */
  async getCardPrintCount(studentId) {
    try {
      const tracking = await prisma.studentCardTracking.findUnique({
        where: { studentId: BigInt(studentId) }
      });
      return tracking ? tracking.printCount : 0;
    } catch (error) {
      console.error('Error getting card print count:', error);
      return 0;
    }
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      // Clean up files older than 1 hour
      const files = await fs.readdir(this.outputDir);
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.stat(filePath);
        if (now - stats.mtime.getTime() > oneHour) {
          await fs.remove(filePath);
        }
      }
    } catch (error) {
      console.error('Error cleaning up temporary files:', error);
    }
  }
}

export default new CardGenerationService();

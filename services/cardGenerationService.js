import Jimp from 'jimp';
import path from 'path';
import fs from 'fs-extra';
import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

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
      if (student.user?.profilePicture) {
        try {
          studentPhoto = await Jimp.read(student.user.profilePicture);
        } catch (error) {
          console.warn('Could not load student photo:', error.message);
        }
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
          name: `${student.user.firstName} ${student.user.lastName}`,
          admissionNo: student.admissionNo,
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
   * Add text to the card
   */
  async addTextToCard(card, student) {
    try {
      const cardWidth = card.getWidth();
    const cardHeight = card.getHeight();
    
    // Text positions based on HTML percentages for 1085x1764 card
    // HTML uses: name=50%, parent=57%, class=64%, id=78%
    const textPositions = {
      name: { x: Math.floor(cardWidth * 0.20), y: Math.floor(cardHeight * 0.52) },
      fathername: { x: Math.floor(cardWidth * 0.20), y: Math.floor(cardHeight * 0.59) },
      class: { x: Math.floor(cardWidth * 0.20), y: Math.floor(cardHeight * 0.66) },
      id: { x: Math.floor(cardWidth * 0.20), y: Math.floor(cardHeight * 0.80) }
    };

    // Load fonts (Jimp has limited font support, using default for now)
    const fontLarge = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
    const fontMedium = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    const fontSmall = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);

    // Add student information with white text
    card.print(fontLarge, textPositions.name.x, textPositions.name.y, {
      text: `${student.user.firstName} ${student.user.lastName}`,
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, cardWidth, cardHeight);

    card.print(fontMedium, textPositions.fathername.x, textPositions.fathername.y, {
      text: student.parent?.user?.firstName ? `${student.parent.user.firstName} ${student.parent.user.lastName}` : 'N/A',
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, cardWidth, cardHeight);

    card.print(fontMedium, textPositions.class.x, textPositions.class.y, {
      text: student.class?.name || 'N/A',
      alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT,
      alignmentY: Jimp.VERTICAL_ALIGN_TOP
    }, cardWidth, cardHeight);

    card.print(fontSmall, textPositions.id.x, textPositions.id.y, {
      text: student.admissionNo || 'N/A',
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
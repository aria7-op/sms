import PDFDocument from 'pdfkit';
import fs from 'fs-extra';
import path from 'path';

class FileGenerationService {
  constructor() {
    this.uploadDir = 'uploads/payments';
  }

  /**
   * Generate receipt PDF for payment
   */
  async generateReceiptPDF(payment, bill, school, student = null, parent = null) {
    try {
      // Ensure upload directory exists
      await fs.ensureDir(this.uploadDir);

      const filename = `receipt-${payment.receiptNumber}-${Date.now()}.pdf`;
      const filePath = path.join(this.uploadDir, filename);
      
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('PAYMENT RECEIPT', { align: 'center' })
         .moveDown();

      // School Information
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(school?.name || 'School Name', { align: 'center' })
         .font('Helvetica')
         .fontSize(10)
         .text(school?.address || 'School Address', { align: 'center' })
         .text(`Phone: ${school?.phone || 'N/A'} | Email: ${school?.email || 'N/A'}`, { align: 'center' })
         .moveDown(2);

      // Receipt Details
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Receipt Details')
         .moveDown();

      const receiptData = [
        ['Receipt Number:', payment.receiptNumber],
        ['Date:', new Date(payment.paymentDate).toLocaleDateString()],
        ['Payment Method:', payment.method],
        ['Payment Type:', payment.type],
        ['Status:', payment.status],
        ['Amount:', `$${payment.amount}`],
        ['Discount:', `$${payment.discount || '0.00'}`],
        ['Fine:', `$${payment.fine || '0.00'}`],
        ['Total:', `$${payment.total}`]
      ];

      receiptData.forEach(([label, value]) => {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text(label, { continued: true })
           .font('Helvetica')
           .text(` ${value}`)
           .moveDown(0.5);
      });

      // Student/Parent Information
      if (student || parent) {
        doc.moveDown()
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('Student/Parent Information')
           .moveDown();

        if (student?.user) {
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .text('Student:', { continued: true })
             .font('Helvetica')
             .text(` ${student.user.firstName} ${student.user.lastName}`)
             .moveDown(0.5);
        }

        if (parent?.user) {
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .text('Parent:', { continued: true })
             .font('Helvetica')
             .text(` ${parent.user.firstName} ${parent.user.lastName}`)
             .moveDown(0.5);
        }
      }

      // Bill Information
      if (bill) {
        doc.moveDown()
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('Bill Information')
           .moveDown();

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Bill Number:', { continued: true })
           .font('Helvetica')
           .text(` ${bill.billNumber}`)
           .moveDown(0.5);

        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('Issue Date:', { continued: true })
           .font('Helvetica')
           .text(` ${new Date(bill.issueDate).toLocaleDateString()}`)
           .moveDown(0.5);

        if (bill.dueDate) {
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .text('Due Date:', { continued: true })
             .font('Helvetica')
             .text(` ${new Date(bill.dueDate).toLocaleDateString()}`)
             .moveDown(0.5);
        }
      }

      // Remarks
      if (payment.remarks) {
        doc.moveDown()
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Remarks:')
           .font('Helvetica')
           .fontSize(10)
           .text(payment.remarks)
           .moveDown();
      }

      // Footer
      doc.moveDown(2)
         .fontSize(10)
         .font('Helvetica')
         .text('Thank you for your payment!', { align: 'center' })
         .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          resolve({
            filename,
            filePath,
            fileSize: fs.statSync(filePath).size,
            mimeType: 'application/pdf'
          });
        });
        stream.on('error', reject);
      });
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      throw error;
    }
  }

  /**
   * Generate invoice PDF for bill
   */
  async generateInvoicePDF(bill, payment, school, student = null, parent = null) {
    try {
      // Ensure upload directory exists
      await fs.ensureDir(this.uploadDir);

      const filename = `invoice-${bill.billNumber}-${Date.now()}.pdf`;
      const filePath = path.join(this.uploadDir, filename);
      
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc.fontSize(24)
         .font('Helvetica-Bold')
         .text('INVOICE', { align: 'center' })
         .moveDown();

      // School Information
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text(school?.name || 'School Name', { align: 'center' })
         .font('Helvetica')
         .fontSize(10)
         .text(school?.address || 'School Address', { align: 'center' })
         .text(`Phone: ${school?.phone || 'N/A'} | Email: ${school?.email || 'N/A'}`, { align: 'center' })
         .moveDown(2);

      // Invoice Details
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .text('Invoice Details')
         .moveDown();

      const invoiceData = [
        ['Invoice Number:', bill.billNumber],
        ['Issue Date:', new Date(bill.issueDate).toLocaleDateString()],
        ['Due Date:', bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : 'N/A'],
        ['Status:', bill.status],
        ['Total Amount:', `$${bill.totalAmount}`],
        ['Payment Receipt:', payment.receiptNumber]
      ];

      invoiceData.forEach(([label, value]) => {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text(label, { continued: true })
           .font('Helvetica')
           .text(` ${value}`)
           .moveDown(0.5);
      });

      // Student/Parent Information
      if (student || parent) {
        doc.moveDown()
           .fontSize(14)
           .font('Helvetica-Bold')
           .text('Student/Parent Information')
           .moveDown();

        if (student?.user) {
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .text('Student:', { continued: true })
             .font('Helvetica')
             .text(` ${student.user.firstName} ${student.user.lastName}`)
             .moveDown(0.5);
        }

        if (parent?.user) {
          doc.fontSize(10)
             .font('Helvetica-Bold')
             .text('Parent:', { continued: true })
             .font('Helvetica')
             .text(` ${parent.user.firstName} ${parent.user.lastName}`)
             .moveDown(0.5);
        }
      }

      // Description
      if (bill.description) {
        doc.moveDown()
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Description:')
           .font('Helvetica')
           .fontSize(10)
           .text(bill.description)
           .moveDown();
      }

      // Remarks
      if (bill.remarks) {
        doc.moveDown()
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Remarks:')
           .font('Helvetica')
           .fontSize(10)
           .text(bill.remarks)
           .moveDown();
      }

      // Footer
      doc.moveDown(2)
         .fontSize(10)
         .font('Helvetica')
         .text('Please pay this invoice by the due date.', { align: 'center' })
         .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          resolve({
            filename,
            filePath,
            fileSize: fs.statSync(filePath).size,
            mimeType: 'application/pdf'
          });
        });
        stream.on('error', reject);
      });
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw error;
    }
  }

  /**
   * Generate all files for a payment
   */
  async generatePaymentFiles(payment, bill, school, student = null, parent = null) {
    try {
      const files = [];

      // Generate receipt PDF
      const receiptFile = await this.generateReceiptPDF(payment, bill, school, student, parent);
      files.push({
        ...receiptFile,
        originalName: `Receipt-${payment.receiptNumber}.pdf`,
        fileType: 'pdf',
        entityType: 'bill',
        description: `Receipt for payment ${payment.receiptNumber}`,
        tags: ['payment', 'receipt', 'pdf']
      });

      // Generate invoice PDF
      const invoiceFile = await this.generateInvoicePDF(bill, payment, school, student, parent);
      files.push({
        ...invoiceFile,
        originalName: `Invoice-${bill.billNumber}.pdf`,
        fileType: 'pdf',
        entityType: 'bill',
        description: `Invoice for bill ${bill.billNumber}`,
        tags: ['payment', 'invoice', 'pdf']
      });

      return files;
    } catch (error) {
      console.error('Error generating payment files:', error);
      throw error;
    }
  }
}

export default new FileGenerationService(); 
import ExcelJS from 'exceljs';
import fs from 'fs-extra';
import path from 'path';

/**
 * Generate a sample Excel bill template with placeholders
 */
async function generateSampleTemplate() {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Bill Template');

    // Set up the template structure
    worksheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 40 }
    ];

    // Add sections with placeholders
    worksheet.addRow({ field: 'SCHOOL INFORMATION', value: '' });
    worksheet.addRow({ field: 'School Name', value: '{{SCHOOL_NAME}}' });
    worksheet.addRow({ field: 'School Address', value: '{{SCHOOL_ADDRESS}}' });
    worksheet.addRow({ field: 'School Phone', value: '{{SCHOOL_PHONE}}' });
    worksheet.addRow({ field: 'School Email', value: '{{SCHOOL_EMAIL}}' });
    worksheet.addRow({ field: '', value: '' });

    worksheet.addRow({ field: 'BILL INFORMATION', value: '' });
    worksheet.addRow({ field: 'Bill Number', value: '{{BILL_NUMBER}}' });
    worksheet.addRow({ field: 'Bill Date', value: '{{BILL_DATE}}' });
    worksheet.addRow({ field: 'Due Date', value: '{{DUE_DATE}}' });
    worksheet.addRow({ field: 'Total Amount', value: '{{TOTAL_AMOUNT}}' });
    worksheet.addRow({ field: '', value: '' });

    worksheet.addRow({ field: 'PAYMENT INFORMATION', value: '' });
    worksheet.addRow({ field: 'Receipt Number', value: '{{RECEIPT_NUMBER}}' });
    worksheet.addRow({ field: 'Payment Method', value: '{{PAYMENT_METHOD}}' });
    worksheet.addRow({ field: 'Payment Type', value: '{{PAYMENT_TYPE}}' });
    worksheet.addRow({ field: 'Payment Amount', value: '{{PAYMENT_AMOUNT}}' });
    worksheet.addRow({ field: 'Payment Total', value: '{{PAYMENT_TOTAL}}' });
    worksheet.addRow({ field: '', value: '' });

    worksheet.addRow({ field: 'STUDENT INFORMATION', value: '' });
    worksheet.addRow({ field: 'Student Name', value: '{{STUDENT_NAME}}' });
    worksheet.addRow({ field: 'Student Class', value: '{{STUDENT_CLASS}}' });
    worksheet.addRow({ field: 'Student Section', value: '{{STUDENT_SECTION}}' });
    worksheet.addRow({ field: '', value: '' });

    worksheet.addRow({ field: 'PARENT INFORMATION', value: '' });
    worksheet.addRow({ field: 'Parent Name', value: '{{PARENT_NAME}}' });
    worksheet.addRow({ field: 'Parent Phone', value: '{{PARENT_PHONE}}' });
    worksheet.addRow({ field: '', value: '' });

    worksheet.addRow({ field: 'ADDITIONAL INFORMATION', value: '' });
    worksheet.addRow({ field: 'Remarks', value: '{{REMARKS}}' });
    worksheet.addRow({ field: 'Generated Date', value: '{{GENERATED_DATE}}' });

    // Style the header rows
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        row.font = { bold: true, size: 14 };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
      }
      
      // Style section headers
      if (row.getCell(1).value && row.getCell(1).value.toString().includes('INFORMATION')) {
        row.font = { bold: true, size: 12 };
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
      }
    });

    // Create templates directory
    const templatesDir = 'templates/samples';
    await fs.ensureDir(templatesDir);
    
    const templatePath = path.join(templatesDir, 'sample_bill_template.xlsx');
    await workbook.xlsx.writeFile(templatePath);

    console.log(`Sample template generated at: ${templatePath}`);
    console.log('\nAvailable placeholders:');
    console.log('- {{SCHOOL_NAME}}, {{SCHOOL_ADDRESS}}, {{SCHOOL_PHONE}}, {{SCHOOL_EMAIL}}');
    console.log('- {{BILL_NUMBER}}, {{BILL_DATE}}, {{DUE_DATE}}, {{TOTAL_AMOUNT}}');
    console.log('- {{RECEIPT_NUMBER}}, {{PAYMENT_METHOD}}, {{PAYMENT_TYPE}}, {{PAYMENT_AMOUNT}}');
    console.log('- {{PAYMENT_TOTAL}}');
    console.log('- {{STUDENT_NAME}}, {{STUDENT_CLASS}}, {{STUDENT_SECTION}}');
    console.log('- {{PARENT_NAME}}, {{PARENT_PHONE}}');
    console.log('- {{REMARKS}}, {{GENERATED_DATE}}');

  } catch (error) {
    console.error('Error generating sample template:', error);
  }
}

// Run the function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSampleTemplate();
}

export default generateSampleTemplate; 
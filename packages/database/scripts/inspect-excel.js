/**
 * Inspect the Fantasy Football Information Excel file structure
 */

import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCEL_FILE = path.join(__dirname, '../../../Fantasy Football Information.xlsx');

async function inspectExcel() {
  console.log('Inspecting Fantasy Football Information.xlsx...\n');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);

  console.log('Worksheets:');
  workbook.worksheets.forEach((sheet, index) => {
    console.log(`  ${index + 1}. ${sheet.name} (${sheet.rowCount} rows, ${sheet.columnCount} columns)`);
  });

  const skillsSheet = workbook.getWorksheet('Skills & Traits');
  if (skillsSheet) {
    console.log('\n=== Skills & Traits Sheet ===');
    console.log(`Rows: ${skillsSheet.rowCount}, Columns: ${skillsSheet.columnCount}`);
    console.log('\nFirst 20 rows:');

    let rowNum = 0;
    skillsSheet.eachRow((row, rowNumber) => {
      if (rowNum++ >= 20) return;

      const cells = row.values.slice(1); // Skip the weird first empty element
      const cellValues = cells.map((cell, idx) => {
        const val = cell?.toString() || '';
        return `[${idx}]="${val.substring(0, 40)}"`;
      }).join(' ');

      console.log(`Row ${rowNumber}: ${cellValues}`);
    });
  } else {
    console.log('\n"Skills & Traits" worksheet not found!');
    console.log('\nSearching for similar names...');
    workbook.worksheets.forEach(sheet => {
      if (sheet.name.toLowerCase().includes('skill') || sheet.name.toLowerCase().includes('trait')) {
        console.log(`  Found: "${sheet.name}"`);
      }
    });
  }
}

inspectExcel().catch(console.error);

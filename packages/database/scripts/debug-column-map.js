const ExcelJS = require('exceljs');

const EXCEL_FILE_PATH = '/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx';

async function checkColumns() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);

  const worksheet = workbook.getWorksheet('Amazon');
  const headerRow = worksheet.getRow(1);
  const columnMap = {};

  console.log('Amazon sheet header row columns:\n');

  for (let i = 1; i <= headerRow.cellCount; i++) {
    const headerText = (headerRow.getCell(i).value || '').toString().trim();
    console.log(`Column ${i}: "${headerText}"`);

    const headerLower = headerText.toLowerCase();
    if (headerLower.includes('minimum quantity')) columnMap.minQty = i;
    else if (headerLower.includes('maximum quantity')) columnMap.maxQty = i;
    else if (headerLower.includes('position name')) columnMap.name = i;
    else if (headerLower.includes('position type')) columnMap.type = i;
    else if (headerLower === 'race') columnMap.race = i;
    else if (headerLower === 'cost') columnMap.cost = i;
    else if (headerLower === 'movement') columnMap.movement = i;
    else if (headerLower === 'strength') columnMap.strength = i;
    else if (headerLower === 'agility') columnMap.agility = i;
    else if (headerLower === 'passing') columnMap.passing = i;
    else if (headerLower.includes('armor value') || headerLower.includes('armour value')) columnMap.av = i;
    else if (headerLower.match(/skills?\s*&?\s*traits?\s*1/i)) columnMap.skill1 = i;
    else if (headerLower.match(/primary\s*upgrade\s*1/i)) columnMap.primary1 = i;
    else if (headerLower.match(/secondary\s*upgrade\s*1/i)) columnMap.secondary1 = i;
  }

  console.log('\nColumn map:');
  console.log(JSON.stringify(columnMap, null, 2));

  console.log('\nEagle Warrior (row 2) data:');
  const row2 = worksheet.getRow(2);

  if (columnMap.skill1) {
    console.log('\nSkills collected (starting from column', columnMap.skill1, '):');
    for (let i = 0; i < 8; i++) {
      const cellNum = columnMap.skill1 + i;
      const value = row2.getCell(cellNum).value;
      const header = headerRow.getCell(cellNum).value;
      console.log(`  Column ${cellNum} (${header}): ${value}`);
    }
  }
}

checkColumns().catch(console.error);

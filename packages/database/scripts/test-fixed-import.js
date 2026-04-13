const ExcelJS = require('exceljs');

const EXCEL_FILE_PATH = '/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx';

async function testSkillCollection() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);

  const worksheet = workbook.getWorksheet('Amazon');
  const headerRow = worksheet.getRow(1);
  const columnMap = {};

  for (let i = 1; i <= headerRow.cellCount; i++) {
    const headerText = (headerRow.getCell(i).value || '').toString().trim().toLowerCase();

    if (headerText.match(/skills?\s*&?\s*traits?\s*1/i)) columnMap.skill1 = i;
    else if (headerText.match(/primary\s*upgrade\s*1/i)) columnMap.primary1 = i;
    else if (headerText.match(/secondary\s*upgrade\s*1/i)) columnMap.secondary1 = i;
  }

  console.log('Column map:', columnMap);
  console.log('Max skill columns:', columnMap.primary1 - columnMap.skill1);

  const row2 = worksheet.getRow(2); // Eagle Warrior
  const row3 = worksheet.getRow(3); // Python Warrior

  // Test Eagle Warrior
  console.log('\nEagle Warrior:');
  const skills1 = [];
  const maxSkillColumns = columnMap.primary1 - columnMap.skill1;
  for (let i = 0; i < maxSkillColumns; i++) {
    const skill = row2.getCell(columnMap.skill1 + i).value;
    if (skill) skills1.push(skill);
  }
  console.log('  Skills:', skills1);

  // Test Python Warrior
  console.log('\nPython Warrior:');
  const skills2 = [];
  for (let i = 0; i < maxSkillColumns; i++) {
    const skill = row3.getCell(columnMap.skill1 + i).value;
    if (skill) skills2.push(skill);
  }
  console.log('  Skills:', skills2);

  // Collect primary skills
  const primarySkills = [];
  for (let i = 0; i < 2; i++) {
    const skill = row2.getCell(columnMap.primary1 + i).value;
    if (skill) primarySkills.push(skill);
  }
  console.log('\nEagle Warrior Primary:', primarySkills);

  // Collect secondary skills
  const secondarySkills = [];
  for (let i = 0; i < 3; i++) {
    const skill = row2.getCell(columnMap.secondary1 + i).value;
    if (skill) secondarySkills.push(skill);
  }
  console.log('Eagle Warrior Secondary:', secondarySkills);
}

testSkillCollection().catch(console.error);

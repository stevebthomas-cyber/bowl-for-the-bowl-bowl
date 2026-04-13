const XLSX = require('xlsx');

const workbook = XLSX.readFile('/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx');
const sheetName = 'Amazon';
const worksheet = workbook.Sheets[sheetName];

if (!worksheet) {
  console.error('Sheet "Amazon" not found');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Amazon Roster Positions:\n');

data.slice(0, 4).forEach((row, i) => {
  console.log(`${i + 1}. ${row['Position Name']}`);
  console.log(`   Position Type: ${row['Position Type']}`);
  console.log(`   Cost: ${row.Cost}`);

  // Show all skill columns
  const skillColumns = Object.keys(row).filter(k => k.includes('Skills') || k.includes('Traits'));
  console.log(`   Skill columns found: ${skillColumns.length}`);
  skillColumns.forEach(col => {
    console.log(`     ${col}: ${row[col]}`);
  });

  // Show all primary upgrade columns
  const primaryColumns = Object.keys(row).filter(k => k.includes('Primary'));
  console.log(`   Primary upgrade columns found: ${primaryColumns.length}`);
  primaryColumns.forEach(col => {
    console.log(`     ${col}: ${row[col]}`);
  });

  // Show all secondary upgrade columns
  const secondaryColumns = Object.keys(row).filter(k => k.includes('Secondary'));
  console.log(`   Secondary upgrade columns found: ${secondaryColumns.length}`);
  secondaryColumns.forEach(col => {
    console.log(`     ${col}: ${row[col]}`);
  });

  console.log('');
});

const XLSX = require('xlsx');

const workbook = XLSX.readFile('/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx');
const sheetName = 'Skills & Traits';
const worksheet = workbook.Sheets[sheetName];

if (!worksheet) {
  console.error('Sheet "Skills & Traits" not found');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Skills & Traits Sheet Structure:');
console.log('Columns:', Object.keys(data[0]));
console.log('\nFirst 10 entries:\n');

data.slice(0, 10).forEach((row, i) => {
  console.log(`${i + 1}. Name: ${row.Name}`);
  console.log(`   Category: ${row.Category}`);
  console.log(`   Description: ${row.Explainer?.substring(0, 80)}...`);
  console.log('');
});

console.log(`\nTotal entries: ${data.length}`);

// Get unique categories
const categories = [...new Set(data.map(row => row.Category))];
console.log('\nUnique Categories:', categories);

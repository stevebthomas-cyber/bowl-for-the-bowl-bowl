const XLSX = require('xlsx');

const workbook = XLSX.readFile('/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx');
const sheetName = 'All Teams';
const worksheet = workbook.Sheets[sheetName];

if (!worksheet) {
  console.error('Sheet "All Teams" not found');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Extracting league data from Excel file...\n');

data.forEach(row => {
  const teamName = row['Name'] || '';
  const league1 = row['League 1'] || '';

  if (teamName && league1) {
    console.log(`Team: ${teamName.padEnd(25)} | League: ${league1}`);
  }
});

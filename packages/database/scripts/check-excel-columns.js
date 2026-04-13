const XLSX = require('xlsx');

const workbook = XLSX.readFile('/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx');

console.log('Available sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);

  if (data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
    console.log('First row:', data[0]);
  }
});

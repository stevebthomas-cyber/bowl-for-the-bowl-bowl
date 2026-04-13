/**
 * Parse Skills & Traits from Fantasy Football Information.xlsx (Blood Bowl Season 3)
 * This script extracts all skills and traits with their descriptions
 */

import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXCEL_FILE = path.join(__dirname, '../../../Fantasy Football Information.xlsx');
const OUTPUT_FILE = path.join(__dirname, 'skills-traits-data.json');

async function parseSkillsAndTraits() {
  console.log('Parsing Skills & Traits from Fantasy Football Information.xlsx (Blood Bowl Season 3)...\n');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE);

  const worksheet = workbook.getWorksheet('Skills & Traits');
  if (!worksheet) {
    console.error('ERROR: Could not find "Skills & Traits" worksheet');
    process.exit(1);
  }

  const skills = [];
  const traits = [];
  let rowNum = 0;

  worksheet.eachRow((row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) return;

    const cells = row.values.slice(1); // Skip the weird first empty element
    const name = cells[0]?.toString()?.trim();
    const category = cells[1]?.toString()?.trim();
    const description = cells[2]?.toString()?.trim();

    if (!name || !category || !description) return;

    const entry = {
      name,
      description,
      official_reference: 'Blood Bowl Season 3 (November 2024)'
    };

    // Traits have category "Trait", everything else is a skill
    if (category.toLowerCase() === 'trait') {
      traits.push(entry);
    } else {
      skills.push({
        ...entry,
        category
      });
    }

    rowNum++;
  });

  console.log(`Parsed ${skills.length} skills and ${traits.length} traits`);

  // Group skills by category for stats
  const categories = {};
  skills.forEach(skill => {
    categories[skill.category] = (categories[skill.category] || 0) + 1;
  });

  console.log('\nSkills by Category:');
  Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
  });

  // Save to JSON
  const output = { skills, traits };
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved data to: ${OUTPUT_FILE}`);

  // Display samples
  if (skills.length > 0) {
    console.log('\nSample Skills:');
    console.log('  -', skills[0].name, `(${skills[0].category})`);
    console.log('  -', skills[1]?.name, `(${skills[1]?.category})`);
    console.log('  -', skills[2]?.name, `(${skills[2]?.category})`);
  }
  if (traits.length > 0) {
    console.log('\nSample Traits:');
    console.log('  -', traits[0].name);
    console.log('  -', traits[1]?.name);
    console.log('  -', traits[2]?.name);
  }

  return { skills, traits };
}

// Run parser
parseSkillsAndTraits().catch(console.error);

/**
 * Import Blood Bowl Season 3 Skills and Traits into the database
 * Run with: SUPABASE_SERVICE_ROLE_KEY="your-key" node packages/database/scripts/import-season3-skills-traits.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_FILE = path.join(__dirname, 'skills-traits-data.json');

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.error('Get it from: supabase status');
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY="your-key" node packages/database/scripts/import-season3-skills-traits.js');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function importSkillsAndTraits() {
  console.log('Importing Blood Bowl Season 3 Skills and Traits...\n');

  // Load the parsed data
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const { skills, traits } = data;

  console.log(`Loaded ${skills.length} skills and ${traits.length} traits from JSON`);

  try {
    // Clear existing data first
    console.log('\nClearing existing data...');
    await supabase.from('skills').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('traits').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Import Skills
    console.log(`\nImporting ${skills.length} skills...`);
    const { data: skillsData, error: skillsError } = await supabase
      .from('skills')
      .insert(skills);

    if (skillsError) {
      console.error('Error importing skills:', skillsError);
      throw skillsError;
    }

    console.log(`✓ Inserted ${skills.length} skills`);

    // Show category breakdown
    const categories = {};
    skills.forEach(skill => {
      categories[skill.category] = (categories[skill.category] || 0) + 1;
    });

    console.log('\n  Skills by Category:');
    Object.entries(categories).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`    ${cat}: ${count}`);
    });

    // Import Traits
    console.log(`\nImporting ${traits.length} traits...`);
    const { data: traitsData, error: traitsError } = await supabase
      .from('traits')
      .insert(traits);

    if (traitsError) {
      console.error('Error importing traits:', traitsError);
      throw traitsError;
    }

    console.log(`✓ Inserted ${traits.length} traits`);

    console.log('\n✅ Import complete!');
    console.log(`\nTotal: ${skills.length} skills + ${traits.length} traits = ${skills.length + traits.length} entries`);
    console.log('\nBlood Bowl Season 3 (November 2024) skills and traits are now available!');

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run import
importSkillsAndTraits();

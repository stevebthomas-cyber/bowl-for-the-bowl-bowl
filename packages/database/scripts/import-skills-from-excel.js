const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabaseUrl = 'https://osdnloxaoleylsitqgta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zZG5sb3hhb2xleWxzaXRxZ3RhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ0NjY1NywiZXhwIjoyMDgwMDIyNjU3fQ.3W5ta9lignQqjt6BxbcXhbZ04kSh1UqZnL8Pc2YiWUc';

const supabase = createClient(supabaseUrl, supabaseKey);

async function importSkillsAndTraits() {
  console.log('Reading Skills & Traits from Excel file...\n');

  const workbook = XLSX.readFile('/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx');
  const sheetName = 'Skills & Traits';
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    console.error('Sheet "Skills & Traits" not found');
    process.exit(1);
  }

  const data = XLSX.utils.sheet_to_json(worksheet);

  const skills = [];
  const traits = [];

  // Separate skills from traits
  data.forEach(row => {
    const name = row.Name;
    const category = row.Category;
    const description = row.Explainer || '';

    if (!name || !category) {
      console.warn('Skipping row with missing name or category:', row);
      return;
    }

    if (category === 'Trait') {
      traits.push({
        name,
        description,
        official_reference: 'Blood Bowl Season 3'
      });
    } else {
      // Categories: General, Agility, Strength, Passing, Mutation, Devious
      skills.push({
        name,
        category,
        description,
        official_reference: 'Blood Bowl Season 3'
      });
    }
  });

  console.log(`Found ${skills.length} skills and ${traits.length} traits\n`);

  // Import skills
  console.log('Importing skills...');
  if (skills.length > 0) {
    const { data: insertedSkills, error: skillsError } = await supabase
      .from('skills')
      .upsert(skills, { onConflict: 'name' })
      .select();

    if (skillsError) {
      console.error('Error importing skills:', skillsError);
    } else {
      console.log(`✓ Successfully imported ${insertedSkills?.length || skills.length} skills`);
    }
  }

  // Import traits
  console.log('\nImporting traits...');
  if (traits.length > 0) {
    const { data: insertedTraits, error: traitsError } = await supabase
      .from('traits')
      .upsert(traits, { onConflict: 'name' })
      .select();

    if (traitsError) {
      console.error('Error importing traits:', traitsError);
    } else {
      console.log(`✓ Successfully imported ${insertedTraits?.length || traits.length} traits`);
    }
  }

  console.log('\n✅ Import complete!');

  // Show summary by category
  console.log('\nSkills by category:');
  const skillsByCategory = skills.reduce((acc, skill) => {
    acc[skill.category] = (acc[skill.category] || 0) + 1;
    return acc;
  }, {});
  Object.entries(skillsByCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count} skills`);
  });
  console.log(`\nTraits: ${traits.length}`);
}

importSkillsAndTraits().catch(console.error);

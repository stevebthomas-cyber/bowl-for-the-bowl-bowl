/**
 * Import game data from Fantasy Football Information.xlsx
 * Run with: node scripts/import-game-data.js
 */

require('./load-env');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Supabase connection
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// Path to Excel file
const excelPath = path.join(__dirname, '../../../Fantasy Football Information.xlsx');

console.log('Loading Excel file:', excelPath);
const workbook = XLSX.readFile(excelPath);

/**
 * Import Special Rules Leagues (from All Teams sheet)
 */
async function importSpecialRulesLeagues() {
  console.log('\n=== Importing Special Rules Leagues ===');

  const sheet = workbook.Sheets['All Teams'];
  const data = XLSX.utils.sheet_to_json(sheet);

  // Extract unique league names
  const leagueNames = new Set();
  data.forEach(row => {
    if (row['League']) {
      leagueNames.add(row['League']);
    }
  });

  const leagues = Array.from(leagueNames).map(name => ({
    name,
    description: `Blood Bowl ${name} league`
  }));

  console.log(`Found ${leagues.length} unique leagues:`, leagues.map(l => l.name));

  const { data: inserted, error } = await supabase
    .from('special_rules_leagues')
    .upsert(leagues, { onConflict: 'name' })
    .select();

  if (error) {
    console.error('Error importing leagues:', error);
  } else {
    console.log(`✓ Imported ${inserted.length} special rules leagues`);
  }

  return inserted;
}

/**
 * Import Star Players
 */
async function importStarPlayers() {
  console.log('\n=== Importing Star Players ===');

  const sheet = workbook.Sheets['Star Players'];
  if (!sheet) {
    console.error('Star Players sheet not found!');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${data.length} star players in Excel`);

  const starPlayers = data.map(row => {
    const playsFor = row['Plays For'] || '';
    const excludedLeagues = [];

    // Parse "Any Team but X" format
    if (playsFor.includes('but')) {
      const match = playsFor.match(/but\s+(.+)$/i);
      if (match) {
        excludedLeagues.push(match[1].trim());
      }
    }

    return {
      name: row['Name'],
      cost: parseInt(row['Cost']) || 0,
      ma: parseInt(row['MA']) || 0,
      st: parseInt(row['ST']) || 0,
      ag: parseInt(row['AG']) || 0,
      pa: row['PA'] ? parseInt(row['PA']) : null,
      av: parseInt(row['AV']) || 0,
      skills: row['Skills'] ? row['Skills'].split(',').map(s => s.trim()) : [],
      special_rules: row['Special Rules'] ? row['Special Rules'].split(',').map(s => s.trim()) : [],
      plays_for: playsFor,
      excluded_leagues: excludedLeagues
    };
  }).filter(sp => sp.name); // Filter out empty rows

  console.log(`Processing ${starPlayers.length} star players`);

  const { data: inserted, error } = await supabase
    .from('star_players')
    .insert(starPlayers)
    .select();

  if (error) {
    console.error('Error importing star players:', error);
  } else {
    console.log(`✓ Imported ${inserted.length} star players`);
  }
}

/**
 * Import Inducements
 */
async function importInducements() {
  console.log('\n=== Importing Inducements ===');

  const sheet = workbook.Sheets['Inducements'];
  if (!sheet) {
    console.error('Inducements sheet not found!');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${data.length} inducements in Excel`);

  const inducements = data.map(row => ({
    name: row['Name'],
    type: row['Type'] || 'other',
    base_cost: parseInt(row['Cost']) || 0,
    bribery_corruption_cost: row['Bribery & Corruption Cost'] ? parseInt(row['Bribery & Corruption Cost']) : null,
    max_quantity: row['Max Quantity'] ? parseInt(row['Max Quantity']) : null,
    description: row['Description'] || ''
  })).filter(i => i.name);

  const { data: inserted, error} = await supabase
    .from('inducements')
    .insert(inducements)
    .select();

  if (error) {
    console.error('Error importing inducements:', error);
  } else {
    console.log(`✓ Imported ${inserted.length} inducements`);
  }
}

/**
 * Import Prayers to Nuffle
 */
async function importPrayersToNuffle() {
  console.log('\n=== Importing Prayers to Nuffle ===');

  const sheet = workbook.Sheets['Prayers to Nuffle Results'];
  if (!sheet) {
    console.error('Prayers to Nuffle Results sheet not found!');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${data.length} prayers in Excel`);

  const prayers = data.map(row => ({
    prayer_name: row['Prayer Name'] || row['Name'],
    d6_result: parseInt(row['D6 Result']) || parseInt(row['Roll']),
    effect_description: row['Effect'] || row['Description']
  })).filter(p => p.prayer_name && p.d6_result);

  const { data: inserted, error } = await supabase
    .from('prayers_to_nuffle')
    .insert(prayers)
    .select();

  if (error) {
    console.error('Error importing prayers:', error);
  } else {
    console.log(`✓ Imported ${inserted.length} prayers to nuffle`);
  }
}

/**
 * Import Random Skills Table
 */
async function importRandomSkills() {
  console.log('\n=== Importing Random Skills ===');

  const sheet = workbook.Sheets['Random Skill Table'];
  if (!sheet) {
    console.error('Random Skill Table sheet not found!');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${data.length} random skill entries in Excel`);

  const skills = data.map(row => ({
    skill_category: row['Category'], // Primary or Secondary
    d6_roll_1: parseInt(row['First D6']) || parseInt(row['D6 #1']),
    d6_roll_2: parseInt(row['Second D6']) || parseInt(row['D6 #2']),
    skill_name: row['Skill'] || row['Skill Name']
  })).filter(s => s.skill_category && s.d6_roll_1 && s.d6_roll_2 && s.skill_name);

  const { data: inserted, error } = await supabase
    .from('random_skills')
    .insert(skills)
    .select();

  if (error) {
    console.error('Error importing random skills:', error);
  } else {
    console.log(`✓ Imported ${inserted.length} random skill entries`);
  }
}

/**
 * Import Characteristic Improvements
 */
async function importCharacteristicImprovements() {
  console.log('\n=== Importing Characteristic Improvements ===');

  const sheet = workbook.Sheets['Characteristic Improvement Table'];
  if (!sheet) {
    console.error('Characteristic Improvement Table sheet not found!');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${data.length} characteristic improvements in Excel`);

  const improvements = data.map(row => ({
    d8_roll: parseInt(row['D8 Roll']) || parseInt(row['Roll']),
    improvement_type: row['Improvement'] || row['Type'],
    improvement_value: parseInt(row['Value']) || 1
  })).filter(i => i.d8_roll && i.improvement_type);

  const { data: inserted, error } = await supabase
    .from('characteristic_improvements')
    .upsert(improvements, { onConflict: 'd8_roll' })
    .select();

  if (error) {
    console.error('Error importing characteristic improvements:', error);
  } else {
    console.log(`✓ Imported ${inserted.length} characteristic improvements`);
  }
}

/**
 * Import Advancement Costs
 */
async function importAdvancementCosts() {
  console.log('\n=== Importing Advancement Costs ===');

  const sheet = workbook.Sheets['Advancement Table'];
  if (!sheet) {
    console.error('Advancement Table sheet not found!');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${data.length} advancement cost entries in Excel`);

  const costs = data.map(row => ({
    player_level: row['Level'] || row['Player Level'],
    min_spp: parseInt(row['Min SPP']) || parseInt(row['SPP Min']) || 0,
    max_spp: row['Max SPP'] ? parseInt(row['Max SPP']) : null,
    primary_skill_cost: parseInt(row['Primary']) || parseInt(row['Primary Skill Cost']) || 0,
    secondary_skill_cost: parseInt(row['Secondary']) || parseInt(row['Secondary Skill Cost']) || 0,
    characteristic_improvement_cost: parseInt(row['Characteristic']) || parseInt(row['Characteristic Improvement Cost']) || 0
  })).filter(c => c.player_level);

  const { data: inserted, error } = await supabase
    .from('advancement_costs')
    .insert(costs)
    .select();

  if (error) {
    console.error('Error importing advancement costs:', error);
  } else {
    console.log(`✓ Imported ${inserted.length} advancement cost entries`);
  }
}

/**
 * Import Expensive Mistakes
 */
async function importExpensiveMistakes() {
  console.log('\n=== Importing Expensive Mistakes ===');

  const sheet = workbook.Sheets['Expensive Mistakes'];
  if (!sheet) {
    console.error('Expensive Mistakes sheet not found!');
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`Found ${data.length} expensive mistake entries in Excel`);

  const mistakes = data.map(row => ({
    treasury_min: parseInt(row['Treasury Min']) || 0,
    treasury_max: row['Treasury Max'] ? parseInt(row['Treasury Max']) : null,
    d6_roll: parseInt(row['D6 Roll']) || parseInt(row['Roll']),
    outcome: row['Outcome'] || row['Effect']
  })).filter(m => m.d6_roll && m.outcome);

  const { data: inserted, error } = await supabase
    .from('expensive_mistakes')
    .insert(mistakes)
    .select();

  if (error) {
    console.error('Error importing expensive mistakes:', error);
  } else {
    console.log(`✓ Imported ${inserted.length} expensive mistake entries`);
  }
}

/**
 * Update Roster Templates with Primary/Secondary Skills
 */
async function updateRosterTemplatesWithSkills() {
  console.log('\n=== Updating Roster Templates with Skills ===');

  // Get all team sheet names (excluding the reference sheets)
  const excludeSheets = [
    'All Teams', 'Star Players', 'Inducements', 'Prayers to Nuffle Results',
    'Random Skill Table', 'Characteristic Improvement Table', 'Advancement Table',
    'Advancement Value', 'Expensive Mistakes'
  ];

  const teamSheets = workbook.SheetNames.filter(name => !excludeSheets.includes(name));
  console.log(`Found ${teamSheets.length} team sheets to process`);

  for (const sheetName of teamSheets) {
    console.log(`\nProcessing ${sheetName}...`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) continue;

    // Look for columns that indicate primary/secondary skills
    const firstRow = data[0];
    const primarySkillsCol = Object.keys(firstRow).find(k => k.toLowerCase().includes('primary'));
    const secondarySkillsCol = Object.keys(firstRow).find(k => k.toLowerCase().includes('secondary'));

    if (!primarySkillsCol || !secondarySkillsCol) {
      console.log(`  ⚠ Skipping ${sheetName} - no skill columns found`);
      continue;
    }

    // Process each position in the sheet
    for (const row of data) {
      const positionName = row['Position'] || row['Position Name'];
      if (!positionName) continue;

      const primarySkills = row[primarySkillsCol]
        ? row[primarySkillsCol].split(',').map(s => s.trim()).filter(Boolean)
        : [];
      const secondarySkills = row[secondarySkillsCol]
        ? row[secondarySkillsCol].split(',').map(s => s.trim()).filter(Boolean)
        : [];

      // Update roster_positions table
      const { error } = await supabase
        .from('roster_positions')
        .update({
          primary_skills: primarySkills,
          secondary_skills: secondarySkills
        })
        .eq('position_name', positionName)
        .eq('race', sheetName);

      if (error) {
        console.error(`  Error updating ${positionName}:`, error.message);
      } else {
        console.log(`  ✓ Updated ${positionName}`);
      }
    }
  }

  console.log('\n✓ Finished updating roster templates with skills');
}

/**
 * Main import function
 */
async function main() {
  console.log('🚀 Starting Blood Bowl game data import...\n');

  try {
    await importSpecialRulesLeagues();
    await importStarPlayers();
    await importInducements();
    await importPrayersToNuffle();
    await importRandomSkills();
    await importCharacteristicImprovements();
    await importAdvancementCosts();
    await importExpensiveMistakes();
    await updateRosterTemplatesWithSkills();

    console.log('\n✅ All data imported successfully!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import
main();

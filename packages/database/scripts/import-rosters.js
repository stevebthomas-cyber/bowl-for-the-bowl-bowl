const { createClient } = require('@supabase/supabase-js');
const ExcelJS = require('exceljs');
const path = require('path');

// Get Supabase credentials from environment
const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const EXCEL_FILE_PATH = '/Users/steve/Documents/Blood-Bowl-Manager/Fantasy Football Information.xlsx';

async function parseTeamMetadata(workbook) {
  const worksheet = workbook.getWorksheet('All Teams');
  const teams = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const teamName = row.getCell(1).value;
    if (!teamName) return;

    const specialRules = [];
    for (let i = 4; i <= 10; i++) {
      const rule = row.getCell(i).value;
      if (rule) specialRules.push(rule);
    }

    teams.push({
      team_name: teamName,
      tier_1: row.getCell(2).value,
      tier_2: row.getCell(3).value,
      special_rules: specialRules,
      min_rerolls: parseInt(row.getCell(11).value) || 0,
      max_rerolls: parseInt(row.getCell(12).value) || 8,
      reroll_cost: parseInt(row.getCell(13).value) || 0,
      apothecary_allowed: row.getCell(14).value === 'Yes',
      apothecary_cost: 50000,
    });
  });

  return teams;
}

async function parseTeamRoster(workbook, teamName) {
  const worksheet = workbook.getWorksheet(teamName);
  if (!worksheet) {
    console.warn(`Warning: No worksheet found for team "${teamName}"`);
    return [];
  }

  // Parse header row dynamically to find column indices
  const headerRow = worksheet.getRow(1);
  const columnMap = {};

  for (let i = 1; i <= headerRow.cellCount; i++) {
    const headerText = (headerRow.getCell(i).value || '').toString().trim().toLowerCase();

    if (headerText.includes('minimum quantity')) columnMap.minQty = i;
    else if (headerText.includes('maximum quantity')) columnMap.maxQty = i;
    else if (headerText.includes('position name')) columnMap.name = i;
    else if (headerText.includes('position type')) columnMap.type = i;
    else if (headerText === 'race') columnMap.race = i;
    else if (headerText === 'cost') columnMap.cost = i;
    else if (headerText === 'movement') columnMap.movement = i;
    else if (headerText === 'strength') columnMap.strength = i;
    else if (headerText === 'agility') columnMap.agility = i;
    else if (headerText === 'passing') columnMap.passing = i;
    else if (headerText.includes('armor value') || headerText.includes('armour value')) columnMap.av = i;
    else if (headerText.match(/skills?\s*&?\s*traits?\s*1/i)) columnMap.skill1 = i;
    else if (headerText.match(/primary\s*upgrade\s*1/i)) columnMap.primary1 = i;
    else if (headerText.match(/secondary\s*upgrade\s*1/i)) columnMap.secondary1 = i;
  }

  const positions = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const positionName = row.getCell(columnMap.name).value;
    if (!positionName) return; // Stop at first empty row

    const positionType = row.getCell(columnMap.type).value;
    const raceCell = row.getCell(columnMap.race).value;

    // Handle Excel formula cells - extract result value
    const race = raceCell && typeof raceCell === 'object' && raceCell.result
      ? raceCell.result
      : raceCell;

    // Skip rows with missing required fields
    if (!positionType || !race) {
      console.warn(`    Skipping ${positionName || 'unknown'}: missing position_type or race`);
      return;
    }

    // Collect skills - find all skill columns starting from skill1
    // Stop before Primary Upgrade columns
    const skills = [];
    if (columnMap.skill1 !== undefined) {
      const maxSkillColumns = columnMap.primary1 !== undefined
        ? (columnMap.primary1 - columnMap.skill1)
        : 8;

      for (let i = 0; i < maxSkillColumns; i++) {
        const skill = row.getCell(columnMap.skill1 + i).value;
        if (skill) skills.push(skill);
      }
    }

    // Collect primary upgrades
    const primarySkills = [];
    if (columnMap.primary1 !== undefined) {
      for (let i = 0; i < 2; i++) {
        const skill = row.getCell(columnMap.primary1 + i).value;
        if (skill) primarySkills.push(skill);
      }
    }

    // Collect secondary upgrades
    const secondarySkills = [];
    if (columnMap.secondary1 !== undefined) {
      for (let i = 0; i < 3; i++) {
        const skill = row.getCell(columnMap.secondary1 + i).value;
        if (skill) secondarySkills.push(skill);
      }
    }

    const paValue = row.getCell(columnMap.passing).value;
    const pa = (paValue === '-' || paValue === null) ? null : parseInt(paValue);

    // Truncate position_name if too long (max 100 chars)
    const truncatedPositionName = positionName.length > 100 ? positionName.substring(0, 100) : positionName;
    // Truncate position_type if too long (max 50 chars)
    const truncatedPositionType = positionType.length > 50 ? positionType.substring(0, 50) : positionType;

    positions.push({
      min_quantity: parseInt(row.getCell(columnMap.minQty).value) || 0,
      max_quantity: parseInt(row.getCell(columnMap.maxQty).value) || 0,
      position_name: truncatedPositionName,
      position_type: truncatedPositionType,
      race: race,
      cost: parseInt(row.getCell(columnMap.cost).value) || 0,
      ma: parseInt(row.getCell(columnMap.movement).value) || 0,
      st: parseInt(row.getCell(columnMap.strength).value) || 0,
      ag: parseInt(row.getCell(columnMap.agility).value) || 0,
      pa: pa,
      av: parseInt(row.getCell(columnMap.av).value) || 0,
      skills: skills,
      primary_skills: primarySkills,
      secondary_skills: secondarySkills,
    });
  });

  return positions;
}

async function importRosters() {
  console.log('Loading Excel file...');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);

  console.log('Parsing team metadata...');
  const teams = await parseTeamMetadata(workbook);
  console.log(`Found ${teams.length} teams`);

  console.log('\nClearing existing roster data...');
  await supabase.from('roster_positions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('roster_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('\nImporting roster templates...');
  const { data: insertedTemplates, error: templatesError } = await supabase
    .from('roster_templates')
    .insert(teams)
    .select();

  if (templatesError) {
    console.error('Error inserting roster templates:', templatesError);
    process.exit(1);
  }

  console.log(`✓ Inserted ${insertedTemplates.length} roster templates`);

  console.log('\nImporting roster positions...');
  let totalPositions = 0;

  for (const template of insertedTemplates) {
    console.log(`  Parsing ${template.team_name}...`);
    const positions = await parseTeamRoster(workbook, template.team_name);

    if (positions.length === 0) {
      console.warn(`    Warning: No positions found for ${template.team_name}`);
      continue;
    }

    // Add roster_template_id to each position
    const positionsWithTemplateId = positions.map(pos => ({
      ...pos,
      roster_template_id: template.id,
    }));

    const { error: positionsError } = await supabase
      .from('roster_positions')
      .insert(positionsWithTemplateId);

    if (positionsError) {
      console.error(`    Error inserting positions for ${template.team_name}:`, positionsError);
      console.error(`    Data sample:`, JSON.stringify(positionsWithTemplateId[0], null, 2));
      continue;
    }

    console.log(`    ✓ Inserted ${positions.length} positions`);
    totalPositions += positions.length;
  }

  console.log(`\n✓ Import complete!`);
  console.log(`  ${insertedTemplates.length} roster templates`);
  console.log(`  ${totalPositions} roster positions`);
}

// Run the import
importRosters().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

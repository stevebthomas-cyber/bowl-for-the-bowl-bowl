#!/usr/bin/env node
/**
 * Parses Blood Bowl roster HTML files from Google Sheets exports
 * and converts them to structured JSON
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const TEAMS_DIR = '/Users/steve/Desktop/Teams/Teams';
const OUTPUT_FILE = path.join(__dirname, '../rosters.json');

// Parse the "All Teams.html" file for team-level metadata
function parseAllTeams() {
  const htmlPath = path.join(TEAMS_DIR, 'All Teams.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const dom = new JSDOM(html);
  const rows = dom.window.document.querySelectorAll('tr');

  const teams = {};

  // Skip header row (index 0), start at row 1
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td');
    if (cells.length < 14) continue;

    const name = cells[0].textContent.trim();
    if (!name) continue;

    const league1 = cells[1].textContent.trim();
    const league2 = cells[2].textContent.trim();

    // Collect special rules (columns 3-9)
    const specialRules = [];
    for (let j = 3; j <= 9; j++) {
      const rule = cells[j]?.textContent.trim();
      if (rule) specialRules.push(rule);
    }

    teams[name] = {
      name,
      leagues: [league1, league2].filter(Boolean),
      specialRules,
      minRerolls: parseInt(cells[10].textContent.trim()) || 0,
      maxRerolls: parseInt(cells[11].textContent.trim()) || 8,
      rerollCost: parseInt(cells[12].textContent.trim()) || 0,
      apothecary: cells[13].textContent.trim() === 'Yes',
      positions: []
    };
  }

  return teams;
}

// Parse individual team roster files with dynamic column detection
function parseTeamRoster(teamName, teams) {
  const htmlPath = path.join(TEAMS_DIR, `${teamName}.html`);

  if (!fs.existsSync(htmlPath)) {
    console.warn(`⚠️  No roster file found for ${teamName}`);
    return;
  }

  const html = fs.readFileSync(htmlPath, 'utf-8');
  const dom = new JSDOM(html);

  // Get rows from tbody only (thead contains column letters A-Z, not actual headers)
  const rows = dom.window.document.querySelectorAll('tbody tr');

  if (rows.length < 2) {
    console.warn(`⚠️  No data rows found for ${teamName}`);
    return;
  }

  // Parse header row (first row in tbody) to find column indices dynamically
  const headerCells = rows[0].querySelectorAll('td');
  const columnMap = {};

  for (let i = 0; i < headerCells.length; i++) {
    const headerText = headerCells[i].textContent.trim().toLowerCase();

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

  // Parse data rows (start at row 1, skip header)
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].querySelectorAll('td');

    // Check if this is an empty row
    const positionName = cells[columnMap.name]?.textContent.trim();
    if (!positionName || cells.length < 5) continue;

    // Collect skills - find all skill columns starting from skill1
    const skills = [];
    if (columnMap.skill1 !== undefined) {
      for (let j = columnMap.skill1; j < columnMap.skill1 + 6; j++) {
        const skill = cells[j]?.textContent.trim();
        if (skill && skill !== '') skills.push(skill);
      }
    }

    // Collect primary upgrades - find all primary upgrade columns
    const primaryUpgrades = [];
    if (columnMap.primary1 !== undefined) {
      for (let j = columnMap.primary1; j < columnMap.primary1 + 2; j++) {
        const upgrade = cells[j]?.textContent.trim();
        if (upgrade && upgrade !== '') primaryUpgrades.push(upgrade);
      }
    }

    // Collect secondary upgrades - find all secondary upgrade columns
    const secondaryUpgrades = [];
    if (columnMap.secondary1 !== undefined) {
      for (let j = columnMap.secondary1; j < columnMap.secondary1 + 3; j++) {
        const upgrade = cells[j]?.textContent.trim();
        if (upgrade && upgrade !== '') secondaryUpgrades.push(upgrade);
      }
    }

    positions.push({
      minQty: parseInt(cells[columnMap.minQty]?.textContent.trim()) || 0,
      maxQty: parseInt(cells[columnMap.maxQty]?.textContent.trim()) || 0,
      name: positionName,
      positionType: cells[columnMap.type]?.textContent.trim() || '',
      race: cells[columnMap.race]?.textContent.trim() || teamName,
      cost: parseInt(cells[columnMap.cost]?.textContent.trim()) || 0,
      movement: parseInt(cells[columnMap.movement]?.textContent.trim()) || 0,
      strength: parseInt(cells[columnMap.strength]?.textContent.trim()) || 0,
      agility: parseInt(cells[columnMap.agility]?.textContent.trim()) || 0,
      passing: parseInt(cells[columnMap.passing]?.textContent.trim()) || 0,
      armourValue: parseInt(cells[columnMap.av]?.textContent.trim()) || 0,
      skills,
      primarySkills: primaryUpgrades,
      secondarySkills: secondaryUpgrades
    });
  }

  if (teams[teamName]) {
    teams[teamName].positions = positions;
  }
}

// Main execution
console.log('📊 Parsing Blood Bowl roster data...\n');

const teams = parseAllTeams();
console.log(`✅ Found ${Object.keys(teams).length} teams in All Teams.html\n`);

// Parse each team's roster
for (const teamName of Object.keys(teams)) {
  parseTeamRoster(teamName, teams);
  console.log(`  ✅ ${teamName}: ${teams[teamName].positions.length} positions`);
}

// Write to JSON file
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(teams, null, 2));

console.log(`\n✅ Roster data written to: ${OUTPUT_FILE}`);
console.log(`\n📈 Summary:`);
console.log(`   Teams: ${Object.keys(teams).length}`);
console.log(`   Total positions: ${Object.values(teams).reduce((sum, t) => sum + t.positions.length, 0)}`);

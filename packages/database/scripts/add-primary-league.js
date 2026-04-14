require('./load-env');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || 'https://osdnloxaoleylsitqgta.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const leagueData = [
  { team: 'Amazon', league: 'Lustrian Superleague' },
  { team: 'Black Orc', league: 'Badlands Brawl' },
  { team: 'Bretonnian', league: 'Old World Classic' },
  { team: 'Chaos Chosen', league: 'Chaos Clash' },
  { team: 'Chaos Dwarf', league: 'Badlands Brawl' },
  { team: 'Chaos Renegade', league: 'Chaos Clash' },
  { team: 'Dark Elf', league: 'Even Kingdoms League' },
  { team: 'Dwarf', league: 'Worlds Edge Superleague' },
  { team: 'Elven Union', league: 'Elven Kingdoms League' },
  { team: 'Gnome', league: 'Halfling Thimble Cup' },
  { team: 'Goblin', league: 'Badlands Brawl' },
  { team: 'Halfling', league: 'Halfling Thimble Cup' },
  { team: 'High Elf', league: 'Elven Kingdom Leagues' },
  { team: 'Human', league: 'Old World Classic' },
  { team: 'Imperial Nobility', league: 'Old World Classic' },
  { team: 'Khorne', league: 'Chaos Clash' },
  { team: 'Lizardmen', league: 'Lustrian Superleague' },
  { team: 'Necromantic Horror', league: 'Sylvanian Spotlight' },
  { team: 'Norse', league: 'Chaos Clash' },
  { team: 'Nurgle', league: 'Chaos Clash' },
  { team: 'Ogre', league: 'Badlands Brawl' },
  { team: 'Old World Alliance', league: 'Old World Classic' },
  { team: 'Orc', league: 'Badlands Brawl' },
  { team: 'Shambling Undead', league: 'Sylvanian Spotlight' },
  { team: 'Skaven', league: 'Underworld Challenge' },
  { team: 'Snotling', league: 'Underworld Challenge' },
  { team: 'Tomb Kings', league: 'Sylvanian Spotlight' },
  { team: 'Underworld Denizens', league: 'Underworld Challenge' },
  { team: 'Vampire', league: 'Sylvanian Spotlight' },
  { team: 'Wood Elf', league: 'Elven Kingdoms League' },
];

async function addPrimaryLeague() {
  console.log('Updating roster_templates with primary_league_name...\n');

  for (const { team, league } of leagueData) {
    console.log(`Updating ${team} with league: ${league}`);

    const { data, error } = await supabase
      .from('roster_templates')
      .update({ primary_league_name: league })
      .eq('team_name', team);

    if (error) {
      console.error(`Error updating ${team}:`, error.message);
    } else {
      console.log(`✓ ${team} updated`);
    }
  }

  console.log('\nDone! All teams updated with their primary leagues.');
}

addPrimaryLeague().catch(console.error);

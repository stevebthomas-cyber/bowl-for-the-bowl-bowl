const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://osdnloxaoleylsitqgta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zZG5sb3hhb2xleWxzaXRxZ3RhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQ0NjY1NywiZXhwIjoyMDgwMDIyNjU3fQ.3W5ta9lignQqjt6BxbcXhbZ04kSh1UqZnL8Pc2YiWUc';

const supabase = createClient(supabaseUrl, supabaseKey);

// All unique league names from tier_1 and tier_2
const leagues = [
  'Badlands Brawl',
  'Brawlin\' Brutes',
  'Chaos Clash',
  'Elven Kingdom Leagues',
  'Elven Kingdoms League',
  'Even Kingdoms League',
  'Halfling Thimble Cup',
  'Lustrian Superleague',
  'Old World Classic',
  'Sylvanian Spotlight',
  'Underworld Challenge',
  'Woodland League',
  'Worlds Edge Superleague',
];

async function populateLeagues() {
  console.log('Populating special_rules_leagues table...\n');

  for (const leagueName of leagues) {
    console.log(`Inserting: ${leagueName}`);

    const { data, error } = await supabase
      .from('special_rules_leagues')
      .insert({
        name: leagueName,
        description: `Blood Bowl Season 3 league: ${leagueName}`,
      })
      .select();

    if (error) {
      if (error.code === '23505') {
        console.log(`  ⚠ Already exists: ${leagueName}`);
      } else {
        console.error(`  ✗ Error:`, error.message);
      }
    } else {
      console.log(`  ✓ Inserted successfully`);
    }
  }

  console.log('\n✅ Done! All leagues populated.');
}

populateLeagues().catch(console.error);

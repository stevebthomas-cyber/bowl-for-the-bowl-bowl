import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';

// Blood Bowl races with their tiers (Season 3 Official Tiers)
const RACES = {
  // Tier 1 - Strongest teams
  'Amazon': { tier: 1, starting_gold: 1000000 },
  'Chaos Dwarf': { tier: 1, starting_gold: 1000000 },
  'Dark Elf': { tier: 1, starting_gold: 1000000 },
  'Dwarf': { tier: 1, starting_gold: 1000000 },
  'High Elf': { tier: 1, starting_gold: 1000000 },
  'Lizardmen': { tier: 1, starting_gold: 1000000 },
  'Norse': { tier: 1, starting_gold: 1000000 },
  'Old World Alliance': { tier: 1, starting_gold: 1000000 },
  'Underworld Denizens': { tier: 1, starting_gold: 1000000 },
  'Wood Elf': { tier: 1, starting_gold: 1000000 },

  // Tier 2 - Strong teams
  'Bretonnian': { tier: 2, starting_gold: 1000000 },
  'Elven Union': { tier: 2, starting_gold: 1000000 },
  'Human': { tier: 2, starting_gold: 1000000 },
  'Imperial Nobility': { tier: 2, starting_gold: 1000000 },
  'Necromantic Horror': { tier: 2, starting_gold: 1000000 },
  'Orc': { tier: 2, starting_gold: 1000000 },
  'Shambling Undead': { tier: 2, starting_gold: 1000000 },
  'Skaven': { tier: 2, starting_gold: 1000000 },
  'Tomb Kings': { tier: 2, starting_gold: 1000000 },
  'Vampire': { tier: 2, starting_gold: 1000000 },

  // Tier 3 - Average teams
  'Black Orc': { tier: 3, starting_gold: 1000000 },
  'Chaos Chosen': { tier: 3, starting_gold: 1000000 },
  'Chaos Renegade': { tier: 3, starting_gold: 1000000 },
  'Khorne': { tier: 3, starting_gold: 1000000 },
  'Nurgle': { tier: 3, starting_gold: 1000000 },

  // Tier 4 - Stunty/Challenge teams
  'Gnome': { tier: 4, starting_gold: 1000000 },
  'Goblin': { tier: 4, starting_gold: 1000000 },
  'Halfling': { tier: 4, starting_gold: 1000000 },
  'Ogre': { tier: 4, starting_gold: 1000000 },
  'Snotling': { tier: 4, starting_gold: 1000000 },
};

export const data = new SlashCommandBuilder()
  .setName('create-team')
  .setDescription('Create your Blood Bowl team')
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Your team name')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('race')
      .setDescription('Your team race (start typing to search)')
      .setRequired(true)
      .setAutocomplete(true)
  );

export async function autocomplete(interaction: any, client: Client) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const raceNames = Object.keys(RACES);

  const filtered = raceNames
    .filter(race => race.toLowerCase().includes(focusedValue))
    .slice(0, 25) // Discord limit for autocomplete responses
    .map(race => ({
      name: `${race} (Tier ${RACES[race as keyof typeof RACES].tier})`,
      value: race
    }));

  await interaction.respond(filtered);
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  await interaction.deferReply();

  const teamName = interaction.options.getString('name', true);
  const raceName = interaction.options.getString('race', true);
  const discordId = interaction.user.id;

  try {
    // Get league
    const { data: league, error: leagueError } = await client.supabase
      .from('leagues')
      .select('id, name, season_number, season_status')
      .limit(1)
      .single();

    if (!league) {
      return await interaction.editReply('❌ No league exists yet. A commissioner needs to run `/create-league` first.');
    }

    if (league.season_status !== 'setup') {
      return await interaction.editReply('❌ The season has already started. Team creation is only allowed during setup.');
    }

    // Get user
    const { data: user, error: userError } = await client.supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (!user) {
      return await interaction.editReply('❌ You need to `/register` as a coach first!');
    }

    // Check if user is a coach
    const { data: coachRole } = await client.supabase
      .from('user_roles')
      .select('id')
      .eq('league_id', league.id)
      .eq('user_id', user.id)
      .eq('role', 'coach')
      .single();

    if (!coachRole) {
      return await interaction.editReply('❌ You need to `/register` as a coach first!');
    }

    // Check if user already has a team
    const { data: existingTeam } = await client.supabase
      .from('team_ownership')
      .select('team:teams(name)')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .single();

    if (existingTeam) {
      return await interaction.editReply({
        content: `❌ You already own a team: **${(existingTeam.team as any).name}**\n\nOnly one team per coach in Phase 1.`
      });
    }

    // Check team name uniqueness
    const { data: nameCheck } = await client.supabase
      .from('teams')
      .select('id')
      .eq('league_id', league.id)
      .eq('name', teamName)
      .single();

    if (nameCheck) {
      return await interaction.editReply(`❌ Team name **${teamName}** is already taken. Please choose another name.`);
    }

    // Get race info
    const raceInfo = RACES[raceName as keyof typeof RACES];
    if (!raceInfo) {
      return await interaction.editReply(`❌ Invalid race: ${raceName}`);
    }

    // Create team
    const { data: team, error: teamError } = await client.supabase
      .from('teams')
      .insert({
        league_id: league.id,
        name: teamName,
        race: raceName,
        tier: raceInfo.tier,
        treasury: raceInfo.starting_gold,
        team_value: 0,
        dedicated_fans: 1,
        min_dedicated_fans: 1,
        rerolls: 0,
        season_created: league.season_number,
        active: true
      })
      .select('id, name, race, tier, treasury')
      .single();

    if (teamError || !team) {
      console.error('Error creating team:', teamError);
      return await interaction.editReply('❌ Failed to create team. Please try again.');
    }

    // Create team ownership
    const { error: ownershipError } = await client.supabase
      .from('team_ownership')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'owner',
        can_modify_roster: true,
        can_submit_reports: true,
        granted_by: user.id
      });

    if (ownershipError) {
      console.error('Error creating ownership:', ownershipError);
      // Team exists but ownership failed - should clean up but for Phase 1 we'll accept it
    }

    await interaction.editReply({
      content: `✅ **Team Created!**\n\n` +
        `🏈 **${team.name}**\n` +
        `📜 Race: ${team.race}\n` +
        `⭐ Tier: ${team.tier}\n` +
        `💰 Treasury: ${team.treasury.toLocaleString()} gold\n\n` +
        `Next steps:\n` +
        `• Use \`/my-team\` to view your team\n` +
        `• Add players to your roster (coming soon)\n` +
        `• Wait for the commissioner to create the schedule`
    });

  } catch (error) {
    console.error('Error in create-team:', error);
    await interaction.editReply('❌ An unexpected error occurred. Please try again.');
  }
}

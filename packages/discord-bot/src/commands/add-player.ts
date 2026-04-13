import { SlashCommandBuilder, ChatInputCommandInteraction, Client } from 'discord.js';
import {
  getRosterForRace,
  findPosition,
  canAddPosition,
  calculateTeamSpending,
  isJerseyNumberAvailable,
  DRAFT_BUDGET
} from '../utils/roster-validator.js';

export const data = new SlashCommandBuilder()
  .setName('add-player')
  .setDescription('Add a player to your roster')
  .addStringOption(option =>
    option
      .setName('position')
      .setDescription('Player position (start typing to search)')
      .setRequired(true)
      .setAutocomplete(true)
  )
  .addStringOption(option =>
    option
      .setName('name')
      .setDescription('Player name')
      .setRequired(true)
  )
  .addIntegerOption(option =>
    option
      .setName('number')
      .setDescription('Jersey number (1-99)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(99)
  );

export async function autocomplete(interaction: any, client: Client) {
  const focusedValue = interaction.options.getFocused().toLowerCase();
  const discordId = interaction.user.id;

  try {
    // Get user's team
    const { data: user } = await client.supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (!user) {
      return await interaction.respond([]);
    }

    const { data: teamOwnership } = await client.supabase
      .from('team_ownership')
      .select('team:teams(race)')
      .eq('user_id', user.id)
      .single();

    if (!teamOwnership || !teamOwnership.team) {
      return await interaction.respond([]);
    }

    const raceName = (teamOwnership.team as any).race;
    const roster = getRosterForRace(raceName);

    if (!roster) {
      return await interaction.respond([]);
    }

    // Filter positions by focused value, exclude header row
    const filtered = roster.positions
      .filter(p => p.name !== 'Position Name')
      .filter(p => p.name.toLowerCase().includes(focusedValue))
      .slice(0, 25)
      .map(p => ({
        name: `${p.name} (${p.cost.toLocaleString()} gold)`,
        value: p.name
      }));

    await interaction.respond(filtered);
  } catch (error) {
    console.error('Error in add-player autocomplete:', error);
    await interaction.respond([]);
  }
}

export async function execute(interaction: ChatInputCommandInteraction, client: Client) {
  await interaction.deferReply();

  const positionName = interaction.options.getString('position', true);
  const playerName = interaction.options.getString('name', true);
  const jerseyNumber = interaction.options.getInteger('number', true);
  const discordId = interaction.user.id;

  try {
    // Get user
    const { data: user } = await client.supabase
      .from('users')
      .select('id')
      .eq('discord_id', discordId)
      .single();

    if (!user) {
      return await interaction.editReply('❌ You need to `/register` first!');
    }

    // Get team
    const { data: teamOwnership } = await client.supabase
      .from('team_ownership')
      .select(`
        team:teams (
          id,
          name,
          race,
          treasury,
          rerolls
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (!teamOwnership || !teamOwnership.team) {
      return await interaction.editReply('❌ You don\'t own a team! Use `/create-team` first.');
    }

    const team = teamOwnership.team as any;
    const roster = getRosterForRace(team.race);

    if (!roster) {
      return await interaction.editReply(`❌ Roster data not found for ${team.race}`);
    }

    // Check jersey number availability
    const { data: existingPlayers } = await client.supabase
      .from('players')
      .select('number')
      .eq('team_id', team.id)
      .not('number', 'is', null);

    const usedNumbers = existingPlayers?.map(p => p.number).filter(Boolean) || [];

    if (!isJerseyNumberAvailable(usedNumbers, jerseyNumber)) {
      return await interaction.editReply(
        `❌ Jersey number ${jerseyNumber} is already taken!\n\nUsed numbers: ${usedNumbers.sort((a, b) => a - b).join(', ')}`
      );
    }

    // Get current position counts
    const { data: currentPlayers } = await client.supabase
      .from('players')
      .select('id, position, player_value')
      .eq('team_id', team.id)
      .eq('status', 'active');

    const positionCounts: Record<string, number> = {};
    (currentPlayers || []).forEach(p => {
      positionCounts[p.position] = (positionCounts[p.position] || 0) + 1;
    });

    // Validate position
    const validation = canAddPosition(roster, positionName, positionCounts);
    if (!validation.valid) {
      return await interaction.editReply(`❌ ${validation.reason}`);
    }

    const position = validation.position!;

    // Check budget
    const spending = calculateTeamSpending({
      players: currentPlayers || [],
      rerolls: team.rerolls || 0,
      rerollCost: roster.rerollCost,
      assistantCoaches: 0, // TODO: get from team
      cheerleaders: 0,
      hasApothecary: false,
      dedicatedFans: 1
    });

    if (position.cost > spending.treasury) {
      return await interaction.editReply(
        `❌ Not enough gold!\n\n` +
        `💰 Cost: ${position.cost.toLocaleString()}\n` +
        `💰 Treasury: ${spending.treasury.toLocaleString()}\n` +
        `💰 Short by: ${(position.cost - spending.treasury).toLocaleString()}`
      );
    }

    // Add player
    const { data: newPlayer, error: playerError } = await client.supabase
      .from('players')
      .insert({
        team_id: team.id,
        name: playerName,
        position: position.name,
        number: jerseyNumber,
        movement: position.movement,
        strength: position.strength,
        agility: position.agility,
        armor_value: position.armourValue,
        skills: position.skills,
        status: 'active',
        player_value: position.cost,
        season_joined: 1 // TODO: get current season
      })
      .select()
      .single();

    if (playerError || !newPlayer) {
      console.error('Error adding player:', playerError);
      return await interaction.editReply('❌ Failed to add player. Please try again.');
    }

    // Update treasury
    const newTreasury = spending.treasury - position.cost;
    await client.supabase
      .from('teams')
      .update({ treasury: newTreasury })
      .eq('id', team.id);

    await interaction.editReply(
      `✅ **Player Added!**\n\n` +
      `👤 #${jerseyNumber} **${playerName}** (${position.name})\n` +
      `📊 MA${position.movement} ST${position.strength} AG${position.agility} PA${position.passing} AV${position.armourValue}\n` +
      `💰 Cost: ${position.cost.toLocaleString()}\n` +
      `💰 New Treasury: ${newTreasury.toLocaleString()}\n\n` +
      `Use \`/add-player\` to add more players or \`/my-roster\` to view your team.`
    );

  } catch (error) {
    console.error('Error in add-player:', error);
    await interaction.editReply('❌ An unexpected error occurred. Please try again.');
  }
}
